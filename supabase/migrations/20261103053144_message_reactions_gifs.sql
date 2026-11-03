-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 7 · Block V-B · Migration 3 of 4 — reactions and GIFs in messages
--
-- A chat has exactly two people, so reactions live on the message row instead of
-- in a new table (runbook §1.4). A reaction is an UPDATE of the row, and both apps
-- already listen for those through Realtime, so it arrives with no new
-- subscription.
--
--   1. messages.reactions, messages.gif
--   2. New checks: a tombstone carries nothing; a live message carries something
--   3. react_to_message()
--   4. delete_message_for_everyone() also clears the GIF and the reactions
--   5. fill_message_reply() quotes a GIF as 'GIF'
--   6. get_user_inbox() also returns last_message_has_gif
--
-- Error names: MESSAGE_NOT_FOUND (already mapped) and MESSAGE_DELETED.
-- Everything is backward compatible: old clients ignore the new fields.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ---------------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------------
alter table public.messages
  add column reactions jsonb not null default '{}',
  add column gif       jsonb;

comment on column public.messages.reactions is
  'Who reacted with what: {"<user id>": "❤️"}. Keys are user ids, each with one '
  'emoji, so at most the two people in the chat. Written only by react_to_message.';
comment on column public.messages.gif is
  'A KLIPY GIF description, the same shape as posts.gif. The GIF itself stays on '
  'KLIPY (runbook §1.9). A GIF message may have empty content.';

-- ---------------------------------------------------------------------------
-- 2. Checks
-- ---------------------------------------------------------------------------
alter table public.messages drop constraint messages_deleted_has_no_content;

alter table public.messages
  add constraint messages_deleted_has_no_content
    check (deleted_at is null or (content = '' and gif is null and reactions = '{}')),
  add constraint messages_has_content
    check (content <> '' or gif is not null or deleted_at is not null),
  -- "is not distinct from", not "=": a missing key gives NULL, and a CHECK that
  -- comes out NULL passes.
  add constraint messages_gif_shape check (
    gif is null or (
          jsonb_typeof(gif)               =                    'object'
      and jsonb_typeof(gif -> 'provider') is not distinct from 'string'
      and jsonb_typeof(gif -> 'id')       is not distinct from 'string'
      and jsonb_typeof(gif -> 'url')      is not distinct from 'string'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. react_to_message
-- ---------------------------------------------------------------------------
create function public.react_to_message(p_message_id uuid, p_user_id uuid, p_emoji text)
  returns public.messages
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_msg public.messages;
begin
  -- FOR UPDATE: a reaction and a delete for everyone at the same moment take
  -- turns, so a reaction can't land on a tombstone.
  select * into v_msg from public.messages m where m.id = p_message_id for update;

  -- "Not a party to it" reads exactly like "does not exist".
  if not found
     or (v_msg.sender_id is distinct from p_user_id
         and v_msg.receiver_id is distinct from p_user_id) then
    raise exception 'MESSAGE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_msg.deleted_at is not null then
    raise exception 'MESSAGE_DELETED' using errcode = 'P0001';
  end if;

  -- ONE update, so Realtime delivers it once (runbook §1.4).
  update public.messages m
     set reactions = case
           when p_emoji is null then m.reactions - p_user_id::text
           else m.reactions || jsonb_build_object(p_user_id::text, p_emoji)
         end
   where m.id = p_message_id
  returning * into v_msg;

  return v_msg;
end;
$function$;

comment on function public.react_to_message(uuid, uuid, text) is
  'Sets the caller''s reaction on a message, or removes it when p_emoji is NULL. '
  'MESSAGE_NOT_FOUND unless the caller is the sender or the receiver; '
  'MESSAGE_DELETED on a tombstone.';

-- ---------------------------------------------------------------------------
-- 4. delete_message_for_everyone: the tombstone also clears gif and reactions.
--    Nothing else changes. CREATE OR REPLACE keeps its grants.
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
     set content = '', gif = null, reactions = '{}', deleted_at = now()
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
-- 5. fill_message_reply: a quote of a GIF with no text says 'GIF'.
--    Nothing else changes. The trigger keeps pointing at this function.
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
  new.reply_preview      := case
    when v_target.content = '' and v_target.gif is not null then 'GIF'
    else left(v_target.content, 200)
  end;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6. get_user_inbox: one new column at the END. Nothing else changes. The return
--    type changes, so it is dropped and re-created, as 6B did.
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
    last_message_deleted boolean,
    last_message_has_gif boolean
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
      v.id, v.content, v.created_at, v.product_id, v.sender_id, v.deleted_at, v.gif,
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
    (rm.deleted_at is not null) as last_message_deleted,
    (rm.gif is not null)        as last_message_has_gif
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
-- ---------------------------------------------------------------------------
revoke execute on function public.get_user_inbox(uuid, integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.react_to_message(uuid, uuid, text)         from public, anon, authenticated;

grant  execute on function public.get_user_inbox(uuid, integer, timestamptz) to service_role;
grant  execute on function public.react_to_message(uuid, uuid, text)         to service_role;

commit;
