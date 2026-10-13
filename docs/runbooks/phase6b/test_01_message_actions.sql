-- Behaviour tests for m1_message_actions.sql. Runs inside a transaction and rolls back.
\set ON_ERROR_STOP on
begin;
set local client_min_messages = notice;

do $$
declare
  arjun uuid := 'b0000000-0000-4000-8000-000000000001';
  priya uuid := 'b0000000-0000-4000-8000-000000000002';
  rahul uuid := 'b0000000-0000-4000-8000-000000000003';
  p_wacom uuid := 'e0000000-0000-4000-8000-000000000004';
  p_cycle uuid := 'e0000000-0000-4000-8000-000000000007';
  uni uuid := 'a0000000-0000-4000-8000-000000000001';
  r record; v_id uuid; v_reply uuid; v_msg public.messages; ok boolean; n int;
begin
  -- T1 reply in the same conversation fills sender + preview
  insert into messages (sender_id, receiver_id, university_id, product_id, content, reply_to_id)
  values (arjun, priya, uni, p_wacom, 'Great, see you there', 'f0000000-0000-4000-8000-000000000006')
  returning * into v_msg;
  assert v_msg.reply_to_sender_id = priya, 'T1 sender copied';
  assert v_msg.reply_preview like 'Works for me%', 'T1 preview copied';
  v_reply := v_msg.id;
  raise notice 'T1 ok: reply fills reply_to_sender_id and reply_preview';

  -- T2 a caller cannot forge the quote
  insert into messages (sender_id, receiver_id, university_id, product_id, content, reply_to_id, reply_preview, reply_to_sender_id)
  values (arjun, priya, uni, p_wacom, 'x', 'f0000000-0000-4000-8000-000000000002', 'FORGED', rahul)
  returning * into v_msg;
  assert v_msg.reply_preview like 'Yes it is%' and v_msg.reply_to_sender_id = priya, 'T2 forged quote overwritten';
  insert into messages (sender_id, receiver_id, university_id, product_id, content, reply_preview, reply_to_sender_id)
  values (arjun, priya, uni, p_wacom, 'not a reply', 'FORGED', rahul) returning * into v_msg;
  assert v_msg.reply_preview is null and v_msg.reply_to_sender_id is null, 'T2 non-reply cleared';
  raise notice 'T2 ok: callers cannot write the quote themselves';

  -- T3 reply to a message from ANOTHER conversation is rejected
  ok := false;
  begin
    insert into messages (sender_id, receiver_id, university_id, product_id, content, reply_to_id)
    values (arjun, priya, uni, p_wacom, 'sneaky', 'f0000000-0000-4000-8000-000000000008');
  exception when others then ok := sqlerrm = 'REPLY_TARGET_INVALID';
  end;
  assert ok, 'T3 cross-conversation reply rejected';
  -- same two people, different listing: also rejected
  ok := false;
  begin
    insert into messages (sender_id, receiver_id, university_id, product_id, content, reply_to_id)
    values (arjun, priya, uni, p_cycle, 'other listing', 'f0000000-0000-4000-8000-000000000001');
  exception when others then ok := sqlerrm = 'REPLY_TARGET_INVALID';
  end;
  assert ok, 'T3b other-listing reply rejected';
  raise notice 'T3 ok: replies must stay inside their own conversation';

  -- T4 delete for everyone: stranger, receiver, sender
  ok := false;
  begin perform delete_message_for_everyone('f0000000-0000-4000-8000-000000000006', rahul);
  exception when others then ok := sqlerrm = 'MESSAGE_NOT_FOUND'; end;
  assert ok, 'T4 stranger gets MESSAGE_NOT_FOUND';
  ok := false;
  begin perform delete_message_for_everyone('f0000000-0000-4000-8000-000000000006', arjun);
  exception when others then ok := sqlerrm = 'NOT_MESSAGE_SENDER'; end;
  assert ok, 'T4 receiver gets NOT_MESSAGE_SENDER';
  -- seeded message is two days old -> window expired
  ok := false;
  begin perform delete_message_for_everyone('f0000000-0000-4000-8000-000000000006', priya);
  exception when others then ok := sqlerrm = 'DELETE_WINDOW_EXPIRED'; end;
  assert ok, 'T4 old message: DELETE_WINDOW_EXPIRED';
  raise notice 'T4 ok: only the sender, and only inside the window';

  -- T5 fresh message, deleted by its sender; quotes of it are wiped
  insert into messages (sender_id, receiver_id, university_id, product_id, content)
  values (priya, arjun, uni, p_wacom, 'my number is 98765 43210') returning id into v_id;
  insert into messages (sender_id, receiver_id, university_id, product_id, content, reply_to_id)
  values (arjun, priya, uni, p_wacom, 'saved it', v_id) returning id into v_reply;
  assert (select reply_preview from messages where id = v_reply) like 'my number%', 'T5 quote exists before delete';
  v_msg := delete_message_for_everyone(v_id, priya);
  assert v_msg.content = '' and v_msg.deleted_at is not null, 'T5 tombstone';
  assert (select reply_preview from messages where id = v_reply) is null, 'T5 quote wiped';
  assert (select reply_to_sender_id from messages where id = v_reply) = priya, 'T5 still marked as a reply';
  -- second delete is idempotent
  v_msg := delete_message_for_everyone(v_id, priya);
  assert v_msg.deleted_at is not null, 'T5 idempotent';
  -- cannot reply to a tombstone
  ok := false;
  begin
    insert into messages (sender_id, receiver_id, university_id, product_id, content, reply_to_id)
    values (arjun, priya, uni, p_wacom, 'replying to deleted', v_id);
  exception when others then ok := sqlerrm = 'REPLY_TARGET_INVALID'; end;
  assert ok, 'T5 reply to tombstone rejected';
  -- the words are gone, whoever tries to put them back
  ok := false;
  begin update messages set content = 'back' where id = v_id;
  exception when check_violation then ok := true; end;
  assert ok, 'T5 check constraint keeps tombstones empty';
  raise notice 'T5 ok: tombstone, quotes wiped, idempotent, no replies to it, constraint holds';

  -- T6 the window edge: 59 minutes old deletes, 61 minutes old does not
  insert into messages (sender_id, receiver_id, university_id, product_id, content, created_at)
  values (priya, arjun, uni, p_wacom, '59 min', now() - interval '59 minutes') returning id into v_id;
  v_msg := delete_message_for_everyone(v_id, priya);
  assert v_msg.deleted_at is not null, 'T6 59 minutes ok';
  insert into messages (sender_id, receiver_id, university_id, product_id, content, created_at)
  values (priya, arjun, uni, p_wacom, '61 min', now() - interval '61 minutes') returning id into v_id;
  ok := false;
  begin perform delete_message_for_everyone(v_id, priya);
  exception when others then ok := sqlerrm = 'DELETE_WINDOW_EXPIRED'; end;
  assert ok, 'T6 61 minutes refused';
  raise notice 'T6 ok: 60-minute window';

  -- T7 hide for me
  ok := false;
  begin perform hide_message_for_me('f0000000-0000-4000-8000-000000000006', rahul);
  exception when others then ok := sqlerrm = 'MESSAGE_NOT_FOUND'; end;
  assert ok, 'T7 stranger cannot hide';
  perform hide_message_for_me('f0000000-0000-4000-8000-000000000011', rahul);
  perform hide_message_for_me('f0000000-0000-4000-8000-000000000011', rahul); -- twice is fine
  assert (select count(*) from message_hides where user_id = rahul) = 1, 'T7 one hide row';
  raise notice 'T7 ok: hide is participant-only and idempotent';
end $$;

-- T8 the inbox: hidden messages skipped, new columns correct
\echo '--- T8 inbox for rahul: last visible msg should now be #10 (he hid #11), unread 0'
select contact_name, left(last_message, 25) as last_message, unread_count, last_sender_id = 'b0000000-0000-4000-8000-000000000003' as last_is_mine, last_message_deleted
  from get_user_inbox('b0000000-0000-4000-8000-000000000003');
\echo '--- T8 inbox for priya (wacom thread): newest visible is a tombstone sent by her -> deleted=t, last_is_mine=t'
select contact_name, product_title, last_message, last_message_deleted, last_sender_id = 'b0000000-0000-4000-8000-000000000002' as last_is_mine, unread_count
  from get_user_inbox('b0000000-0000-4000-8000-000000000002') order by last_message_time desc limit 3;

-- T9 hide every message of a thread: the conversation leaves that person's inbox only
do $$
declare r record;
begin
  for r in select id from messages where product_id = 'e0000000-0000-4000-8000-000000000011' loop
    perform hide_message_for_me(r.id, 'b0000000-0000-4000-8000-000000000005');
  end loop;
  assert not exists (select 1 from get_user_inbox('b0000000-0000-4000-8000-000000000005')
                      where product_id = 'e0000000-0000-4000-8000-000000000011'), 'T9 gone for karan';
  assert exists (select 1 from get_user_inbox('b0000000-0000-4000-8000-000000000004')
                  where product_id = 'e0000000-0000-4000-8000-000000000011'), 'T9 still there for sneha';
  raise notice 'T9 ok: hiding a whole thread removes it for that person only';
end $$;

-- T10 privileges: anon and authenticated cannot run the new functions or read hides
\echo '--- T10 privileges (all false expected)'
select has_function_privilege('anon', 'public.delete_message_for_everyone(uuid,uuid)', 'execute') as anon_delete,
       has_function_privilege('authenticated', 'public.hide_message_for_me(uuid,uuid)', 'execute') as auth_hide,
       has_function_privilege('anon', 'public.get_user_inbox(uuid,integer,timestamptz)', 'execute') as anon_inbox,
       has_table_privilege('authenticated', 'public.message_hides', 'select') as auth_read_hides,
       exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'message_hides') as hides_in_realtime;

rollback;
