-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 6B · Block V-B · Message actions: reply, delete for everyone, delete for me
--
-- What this migration adds, and why each piece lives in the database:
--
--   1. Reply (quote a message).  Four new columns on public.messages. A reply
--      stores WHICH message it answers (reply_to_id) plus a frozen copy of who
--      wrote it and its first 200 characters (reply_to_sender_id, reply_preview).
--      The copy is filled by a trigger, never by the backend, so no caller can
--      quote text the original message never said.
--
--   2. Delete for everyone.  The row is KEPT as a "tombstone": its text is wiped
--      (content = '') and deleted_at is stamped. Both people's apps receive the
--      UPDATE through Realtime and draw "This message was deleted". Every reply
--      that quoted it has its reply_preview wiped in the same transaction, so the
--      deleted words do not survive inside someone else's quote.
--
--   3. Delete for me.  A private list, public.message_hides. It is NOT in the
--      Realtime publication and has no grants, so the other person can never
--      learn that you hid something. Only the backend (service_role) reads it.
--
-- Rules enforced here (error names are mapped to HTTP by utils/respond.js):
--   REPLY_TARGET_INVALID   the quoted message is not in this conversation, or
--                          was deleted for everyone
--   MESSAGE_NOT_FOUND      no such message, or the caller is not one of its two people
--   NOT_MESSAGE_SENDER     only the sender may delete for everyone
--   DELETE_WINDOW_EXPIRED  delete for everyone is allowed for 60 minutes after sending
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ---------------------------------------------------------------------------
-- 1. New columns on public.messages
-- ---------------------------------------------------------------------------
alter table public.messages
  add column reply_to_id        uuid references public.messages(id) on delete set null,
  add column reply_to_sender_id uuid,
  add column reply_preview      text,
  add column deleted_at         timestamptz;

comment on column public.messages.reply_to_id is
  'The message this one replies to. NULL = not a reply. Set by the backend; '
  'validated by trg_fill_message_reply.';
comment on column public.messages.reply_to_sender_id is
  'Who wrote the quoted message. Filled by trg_fill_message_reply. A non-NULL '
  'value is how clients know a message is a reply.';
comment on column public.messages.reply_preview is
  'First 200 characters of the quoted message, copied at send time. Set to NULL '
  'when the quoted message is deleted for everyone; clients then show '
  '"This message was deleted" inside the quote.';
comment on column public.messages.deleted_at is
  'Set when the sender deletes the message for everyone. The row stays as a '
  'tombstone with content = ''''. NULL = not deleted.';

-- A tombstone carries no text. This makes "deleted but the words are still
-- in the table" impossible, whoever writes the row.
alter table public.messages
  add constraint messages_deleted_has_no_content
  check (deleted_at is null or content = '');

-- delete_message_for_everyone() looks up every reply to the deleted message.
-- Partial: almost no messages are replies, so the index stays tiny.
create index messages_reply_to_id_idx
  on public.messages (reply_to_id)
  where reply_to_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Delete for me — a private list per person
-- ---------------------------------------------------------------------------
create table public.message_hides (
  user_id    uuid        not null references public.users(id)    on delete cascade,
  message_id uuid        not null references public.messages(id) on delete cascade,
  hidden_at  timestamptz not null default now(),
  primary key (user_id, message_id)
);

comment on table public.message_hides is
  '"Delete for me". One row = this user hid this message from their own view. '
  'Backend-only: RLS on, no policies, no grants to anon/authenticated, and '
  'deliberately NOT in the supabase_realtime publication — the other person '
  'must never learn that a message was hidden.';

alter table public.message_hides enable row level security;
revoke all on public.message_hides from anon, authenticated;
grant select, insert, delete on public.message_hides to service_role;

-- ---------------------------------------------------------------------------
-- 3. Reply validation + the frozen quote, filled on INSERT
-- ---------------------------------------------------------------------------
create or replace function public.fill_message_reply()
  returns trigger
  language plpgsql
  set search_path = public, pg_temp
as $function$
declare
  v_target public.messages;
begin
  -- Not a reply: make sure the two copied fields are empty too, whatever the
  -- caller sent. The quote is never the caller's to write.
  if new.reply_to_id is null then
    new.reply_to_sender_id := null;
    new.reply_preview      := null;
    return new;
  end if;

  select * into v_target from public.messages where id = new.reply_to_id;

  -- Same listing, same two people (either direction), and not a tombstone.
  if not found
     or v_target.deleted_at is not null
     or v_target.product_id is distinct from new.product_id
     or not (
          (v_target.sender_id = new.sender_id   and v_target.receiver_id = new.receiver_id)
       or (v_target.sender_id = new.receiver_id and v_target.receiver_id = new.sender_id)
     )
  then
    raise exception 'REPLY_TARGET_INVALID' using errcode = 'P0001';
  end if;

  new.reply_to_sender_id := v_target.sender_id;
  new.reply_preview      := left(v_target.content, 200);
  return new;
end;
$function$;

create trigger trg_fill_message_reply
  before insert on public.messages
  for each row execute function public.fill_message_reply();

-- ---------------------------------------------------------------------------
-- 4. Delete for everyone
-- ---------------------------------------------------------------------------
create or replace function public.delete_message_for_everyone(
  p_message_id uuid,
  p_user_id    uuid
)
  returns public.messages
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_msg public.messages;
begin
  -- FOR UPDATE: two deletes of the same message at once wait for each other.
  select * into v_msg from public.messages where id = p_message_id for update;

  -- "Not a party to it" reads exactly like "does not exist": a stranger
  -- learns nothing about other people's message ids.
  if not found
     or (v_msg.sender_id is distinct from p_user_id
         and v_msg.receiver_id is distinct from p_user_id) then
    raise exception 'MESSAGE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_msg.sender_id is distinct from p_user_id then
    raise exception 'NOT_MESSAGE_SENDER' using errcode = 'P0001';
  end if;

  -- Already deleted: answer with the tombstone. A double tap is not an error.
  if v_msg.deleted_at is not null then
    return v_msg;
  end if;

  -- The window. 60 minutes, matching DELETE_FOR_EVERYONE_MINUTES in both apps
  -- (the apps only use it to decide whether to SHOW the button; this is the rule).
  if v_msg.created_at < now() - interval '60 minutes' then
    raise exception 'DELETE_WINDOW_EXPIRED' using errcode = 'P0001';
  end if;

  update public.messages
     set content = '', deleted_at = now()
   where id = p_message_id
  returning * into v_msg;

  -- The deleted words must not live on inside quotes of them.
  update public.messages
     set reply_preview = null
   where reply_to_id = p_message_id
     and reply_preview is not null;

  return v_msg;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Delete for me
-- ---------------------------------------------------------------------------
create or replace function public.hide_message_for_me(
  p_message_id uuid,
  p_user_id    uuid
)
  returns void
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
begin
  if not exists (
    select 1 from public.messages
     where id = p_message_id
       and (sender_id = p_user_id or receiver_id = p_user_id)
  ) then
    raise exception 'MESSAGE_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Hiding twice is not an error.
  insert into public.message_hides (user_id, message_id)
  values (p_user_id, p_message_id)
  on conflict do nothing;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. The inbox learns about hidden and deleted messages
--
-- Two new columns at the END (so nothing existing moves):
--   last_sender_id        who sent the last visible message — lets the apps
--                         write "You deleted this message" and "You: ..."
--   last_message_deleted  the last visible message is a tombstone
-- Messages the viewer hid are skipped everywhere: for the preview, for the
-- ordering, and for the unread count. If every message in a conversation is
-- hidden, the conversation leaves that person's inbox until a new one arrives.
--
-- The return type changes, so the function is dropped and re-created (the
-- same thing 20260915070505_inbox_pagination did). Ordering, the cursor and
-- the 1..50 limit clamp are unchanged.
-- ---------------------------------------------------------------------------
drop function if exists public.get_user_inbox(uuid, integer, timestamptz);

create function public.get_user_inbox (
  p_user_id uuid,
  p_limit   int         default 20,
  p_cursor  timestamptz default null
)
  returns table (
    contact_id           uuid,
    contact_name         character varying,
    contact_avatar       text,
    product_id           uuid,
    product_title        character varying,
    product_image        text,
    last_message         text,
    last_message_time    timestamp with time zone,
    unread_count         bigint,
    last_sender_id       uuid,
    last_message_deleted boolean
  )
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  return query
  with visible as (
    select m.*
      from public.messages m
     where (m.sender_id = p_user_id or m.receiver_id = p_user_id)
       and not exists (
             select 1 from public.message_hides h
              where h.user_id = p_user_id and h.message_id = m.id
           )
  ),
  ranked_messages as (
    select
      v.id, v.content, v.created_at, v.product_id, v.sender_id, v.deleted_at,
      case when v.sender_id = p_user_id then v.receiver_id else v.sender_id end as chat_partner_id,
      row_number() over (
        partition by v.product_id,
                     case when v.sender_id = p_user_id then v.receiver_id else v.sender_id end
        order by v.created_at desc, v.id desc
      ) as rn
    from visible v
  )
  select
    u.id            as contact_id,
    u.full_name     as contact_name,
    u.avatar_url    as contact_avatar,
    p.id            as product_id,
    p.title         as product_title,
    p.image_urls[1] as product_image,
    rm.content      as last_message,
    rm.created_at   as last_message_time,
    (select count(*) from visible m2
      where m2.receiver_id = p_user_id
        and m2.sender_id   = u.id
        and m2.product_id  = p.id
        and m2.is_read     = false) as unread_count,
    rm.sender_id                as last_sender_id,
    (rm.deleted_at is not null) as last_message_deleted
  from ranked_messages rm
  join public.users u    on u.id = rm.chat_partner_id
  join public.products p on p.id = rm.product_id
  where rm.rn = 1
    and (p_cursor is null or rm.created_at < p_cursor)
  order by rm.created_at desc, p.id, u.id
  limit v_limit;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Who may run these: the backend only.
--
-- Postgres grants EXECUTE to PUBLIC by default, and anon inherits PUBLIC, so
-- without these lines anyone holding the publishable key could call them.
-- ---------------------------------------------------------------------------
revoke execute on function public.get_user_inbox(uuid, integer, timestamptz)   from public, anon, authenticated;
revoke execute on function public.delete_message_for_everyone(uuid, uuid)      from public, anon, authenticated;
revoke execute on function public.hide_message_for_me(uuid, uuid)              from public, anon, authenticated;

grant  execute on function public.get_user_inbox(uuid, integer, timestamptz)   to service_role;
grant  execute on function public.delete_message_for_everyone(uuid, uuid)      to service_role;
grant  execute on function public.hide_message_for_me(uuid, uuid)              to service_role;

commit;
