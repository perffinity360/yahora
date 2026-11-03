-- Phase 7 · V-B · tests for migration message_reactions_gifs. Local database only.
-- Runs in one transaction and rolls back. Every line it prints should end in "ok".
-- It acts as service_role, as the backend does, so a missing grant fails here too.
\set ON_ERROR_STOP on
\set QUIET on

begin;

create function pg_temp.u(p_username text) returns uuid language sql stable as $$
  select id from public.users where username = p_username
$$;

create function pg_temp.fails(p_sql text, p_expected text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_expected in sqlerrm) = 0 then
      raise exception 'expected % but got: %', p_expected, sqlerrm;
    end if;
    return;
  end;
  raise exception 'expected % but the statement succeeded: %', p_expected, p_sql;
end $$;

-- A message about a seeded product. Returns its id.
create function pg_temp.msg(p_from text, p_to text, p_content text, p_gif jsonb default null, p_reply_to uuid default null)
  returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.messages (sender_id, receiver_id, university_id, product_id, content, gif, reply_to_id)
  select pg_temp.u(p_from), pg_temp.u(p_to), u.university_id,
         (select p.id from public.products p order by p.id limit 1),
         p_content, p_gif, p_reply_to
    from public.users u where u.id = pg_temp.u(p_from)
  returning id into v_id;
  return v_id;
end $$;

grant execute on all functions in schema pg_temp to service_role;

set local role service_role;

-- ── react_to_message ────────────────────────────────────────────────────────
do $$
declare
  v_arjun uuid := pg_temp.u('arjun.mehta');
  v_priya uuid := pg_temp.u('priya.nair');
  v_id    uuid := pg_temp.msg('arjun.mehta', 'priya.nair', 'hi');
  m public.messages;
begin
  select * into m from public.react_to_message(v_id, v_priya, '❤️');
  assert m.reactions = jsonb_build_object(v_priya::text, '❤️'), 'the receiver reacts';
  select * into m from public.react_to_message(v_id, v_arjun, '😂');
  assert m.reactions = jsonb_build_object(v_priya::text, '❤️', v_arjun::text, '😂'), 'the sender reacts';
  select * into m from public.react_to_message(v_id, v_priya, '👍');
  assert m.reactions ->> v_priya::text = '👍', 'changing';
  select * into m from public.react_to_message(v_id, v_priya, null);
  assert m.reactions = jsonb_build_object(v_arjun::text, '😂'), 'removing';
  select * into m from public.react_to_message(v_id, v_priya, null);
  assert m.reactions = jsonb_build_object(v_arjun::text, '😂'), 'removing twice';
  raise notice 'react_to_message by a participant sets and removes: ok';

  perform pg_temp.fails(format($f$select public.react_to_message(%L, pg_temp.u('sneha.gupta'), '❤️')$f$, v_id), 'MESSAGE_NOT_FOUND');
  perform pg_temp.fails($f$select public.react_to_message(gen_random_uuid(), pg_temp.u('sneha.gupta'), '❤️')$f$, 'MESSAGE_NOT_FOUND');
  raise notice 'an outsider gets MESSAGE_NOT_FOUND: ok';

  perform public.delete_message_for_everyone(v_id, v_arjun);
  perform pg_temp.fails(format($f$select public.react_to_message(%L, pg_temp.u('arjun.mehta'), '❤️')$f$, v_id), 'MESSAGE_DELETED');
  raise notice 'on a tombstone it is MESSAGE_DELETED: ok';
end $$;

-- ── Tombstones ──────────────────────────────────────────────────────────────
do $$
declare
  v_arjun uuid := pg_temp.u('arjun.mehta');
  v_priya uuid := pg_temp.u('priya.nair');
  v_id    uuid := pg_temp.msg('arjun.mehta', 'priya.nair', '', '{"provider":"klipy","id":"1","url":"https://x.test/a.gif"}');
  m public.messages;
begin
  perform public.react_to_message(v_id, v_priya, '❤️');
  select * into m from public.delete_message_for_everyone(v_id, v_arjun);
  assert m.gif is null and m.reactions = '{}' and m.content = '' and m.deleted_at is not null, 'tombstone not clean';
  raise notice 'delete_message_for_everyone clears gif and reactions: ok';

  perform pg_temp.fails(format($f$update public.messages set gif = '{"provider":"k","id":"1","url":"u"}' where id = %L$f$, v_id),
                        'messages_deleted_has_no_content');
  perform pg_temp.fails(format($f$update public.messages set reactions = '{"a":"b"}' where id = %L$f$, v_id),
                        'messages_deleted_has_no_content');
  raise notice 'a tombstone can''t hold a GIF or reactions: ok';
end $$;

-- ── Checks ──────────────────────────────────────────────────────────────────
do $$
begin
  perform pg_temp.fails($f$select pg_temp.msg('arjun.mehta', 'priya.nair', '')$f$, 'messages_has_content');
  raise notice 'a message with no text and no GIF is refused: ok';

  perform pg_temp.fails($f$select pg_temp.msg('arjun.mehta', 'priya.nair', '', '{"provider":"klipy"}')$f$, 'messages_gif_shape');
  raise notice 'a GIF has the same shape as on posts: ok';

  perform pg_temp.msg('arjun.mehta', 'priya.nair', '', '{"provider":"klipy","id":"1","url":"https://x.test/a.gif"}');
  perform pg_temp.msg('arjun.mehta', 'priya.nair', 'with text', '{"provider":"klipy","id":"1","url":"https://x.test/a.gif"}');
  raise notice 'a GIF may have empty content or text: ok';
end $$;

-- ── Quoting a GIF ───────────────────────────────────────────────────────────
do $$
declare
  v_gif  uuid := pg_temp.msg('arjun.mehta', 'priya.nair', '', '{"provider":"klipy","id":"1","url":"https://x.test/a.gif"}');
  v_both uuid := pg_temp.msg('arjun.mehta', 'priya.nair', 'look at this', '{"provider":"klipy","id":"2","url":"https://x.test/b.gif"}');
  v_text uuid := pg_temp.msg('arjun.mehta', 'priya.nair', 'plain text');
  v_r1   uuid := pg_temp.msg('priya.nair', 'arjun.mehta', 'nice', null, v_gif);
  v_r2   uuid := pg_temp.msg('priya.nair', 'arjun.mehta', 'nice', null, v_both);
  v_r3   uuid := pg_temp.msg('priya.nair', 'arjun.mehta', 'nice', null, v_text);
begin
  assert (select reply_preview from public.messages where id = v_r1) = 'GIF', 'GIF only';
  raise notice 'a reply to a GIF message gets reply_preview GIF: ok';
  assert (select reply_preview from public.messages where id = v_r2) = 'look at this', 'GIF with text';
  assert (select reply_preview from public.messages where id = v_r3) = 'plain text', 'text only';
  raise notice 'a GIF with text, and plain text, still quote their text: ok';

  perform public.delete_message_for_everyone(v_gif, pg_temp.u('arjun.mehta'));
  assert (select reply_preview from public.messages where id = v_r1) is null, 'the quote survived the delete';
  raise notice 'deleting a GIF for everyone wipes the quote of it: ok';
end $$;

-- ── The inbox ───────────────────────────────────────────────────────────────
do $$
declare
  v_karan uuid := pg_temp.u('karan.singh');
  r record;
begin
  perform pg_temp.msg('sneha.gupta', 'karan.singh', 'text first');
  select * into r from public.get_user_inbox(v_karan) i where i.contact_id = pg_temp.u('sneha.gupta') limit 1;
  assert r.last_message_has_gif is false, 'false for text';

  perform pg_temp.msg('sneha.gupta', 'karan.singh', '', '{"provider":"klipy","id":"1","url":"https://x.test/a.gif"}');
  -- now() doesn't move inside a transaction, so make this one clearly the last.
  update public.messages set created_at = now() + interval '1 minute' where gif is not null and receiver_id = v_karan;
  select * into r from public.get_user_inbox(v_karan) i where i.contact_id = pg_temp.u('sneha.gupta') limit 1;
  assert r.last_message_has_gif is true, 'true for a GIF';
  assert r.last_message = '', 'a GIF has no preview text';
  raise notice 'get_user_inbox returns last_message_has_gif: ok';

  assert (select count(*) from information_schema.routines rt
            join information_schema.parameters pa using (specific_schema, specific_name)
           where rt.routine_schema = 'public' and rt.routine_name = 'get_user_inbox' and pa.parameter_mode = 'OUT') = 12,
    'the inbox should have 12 columns';
  assert (select pa.parameter_name from information_schema.routines rt
            join information_schema.parameters pa using (specific_schema, specific_name)
           where rt.routine_schema = 'public' and rt.routine_name = 'get_user_inbox' and pa.parameter_mode = 'OUT'
           order by pa.ordinal_position desc limit 1) = 'last_message_has_gif', 'it should come last';
  raise notice 'it comes after the existing 11 columns: ok';
end $$;

reset role;

-- ── Privileges ──────────────────────────────────────────────────────────────
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    assert not has_function_privilege(r, 'public.react_to_message(uuid, uuid, text)', 'execute'), r || ' react_to_message';
    assert not has_function_privilege(r, 'public.get_user_inbox(uuid, integer, timestamptz)', 'execute'), r || ' get_user_inbox';
    assert not has_function_privilege(r, 'public.delete_message_for_everyone(uuid, uuid)', 'execute'), r || ' delete_message';
    assert not has_table_privilege(r, 'public.messages', 'insert'), r || ' insert messages';
    assert not has_table_privilege(r, 'public.messages', 'update'), r || ' update messages';
  end loop;
  assert has_function_privilege('service_role', 'public.get_user_inbox(uuid, integer, timestamptz)', 'execute'), 'the re-grant';
  assert has_function_privilege('service_role', 'public.delete_message_for_everyone(uuid, uuid)', 'execute'), 'the delete grant';
  assert (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') = 1, 'Realtime';
  raise notice 'anon and authenticated can''t run the new functions, and messages stays in Realtime: ok';
end $$;

rollback;
