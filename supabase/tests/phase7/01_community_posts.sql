-- Phase 7 · V-B · tests for migration community_posts. Local database only.
-- Runs in one transaction and rolls back. Every line it prints should end in "ok".
-- It acts as service_role, as the backend does, so a missing grant fails here too.
\set ON_ERROR_STOP on
\set QUIET on

begin;

create function pg_temp.u(p_username text) returns uuid language sql stable as $$
  select id from public.users where username = p_username
$$;

create function pg_temp.post(p_author text, p_body text, p_scope text default 'campus', p_parent uuid default null)
  returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.posts (author_id, content, scope, parent_post_id)
  values (pg_temp.u(p_author), p_body, p_scope, p_parent)
  returning id into v_id;
  return v_id;
end $$;

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

-- A demo account, made the way GoTrue makes one. Names it, then returns its id.
create function pg_temp.new_user(p_email text, p_username text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email, '',
          now(), now(), now(), '{}', '{}', '', '', '', '');
  update public.users set username = p_username, full_name = p_username where id = v_id;
  return v_id;
end $$;

grant execute on all functions in schema pg_temp to service_role;

select pg_temp.new_user('t1-demo@demo.yahora.com', 'demo.t1.one');
select pg_temp.new_user('t1-newbie@iiitk.ac.in',   't1.newbie');
select pg_temp.new_user('t1-ratea@iiitk.ac.in',    't1.ratea');
select pg_temp.new_user('t1-rateb@iiitk.ac.in',    't1.rateb');
select pg_temp.new_user('t1-page@iiitk.ac.in',     't1.page');
select pg_temp.new_user('t1-hot@iiitk.ac.in',      't1.hot');

set local role service_role;

-- ── Posting fills the campus, country and world ─────────────────────────────
do $$
declare p public.posts;
begin
  insert into public.posts (author_id, content, university_id, is_demo, country_code)
  values (pg_temp.u('arjun.mehta'), 'hello', 'a0000000-0000-4000-8000-000000000002', true, 'DE')
  returning * into p;
  assert p.university_id = 'a0000000-0000-4000-8000-000000000001', 'university not overwritten';
  assert p.country_code = 'IN', 'country not overwritten';
  assert p.is_demo = false, 'is_demo not overwritten';
  raise notice 'posting fills university, country and is_demo: ok';

  assert p.hot_score > 0.35 and p.hot_score < 0.36, 'first hot score';
  raise notice 'a new post gets its first hot score: ok';
end $$;

do $$
declare
  v_id uuid := pg_temp.post('lena.test', 'hallo', 'country');
  p public.posts;
begin
  select * into p from public.posts where id = v_id;
  assert p.country_code = 'DE', 'country post went to the wrong country';
  raise notice 'a country post goes to the author''s country: ok';
end $$;

-- ── Replies ─────────────────────────────────────────────────────────────────
do $$
declare
  v_parent uuid := pg_temp.post('arjun.mehta', 'india post', 'country');
  v_reply  uuid;
  r public.posts;
begin
  -- Sneha asks for 'global'; a reply inherits its parent's scope regardless.
  v_reply := pg_temp.post('sneha.gupta', 'reply', 'global', v_parent);
  select * into r from public.posts where id = v_reply;
  assert r.scope = 'country' and r.country_code = 'IN', 'reply did not inherit scope';
  raise notice 'a reply inherits its parent''s scope: ok';
  raise notice 'a NIET student can reply to an India post: ok';

  perform pg_temp.fails(format($f$select pg_temp.post('priya.nair', 'nested', 'campus', %L)$f$, v_reply),
                        'NESTED_REPLY_NOT_ALLOWED');
  raise notice 'a nested reply is refused: ok';

  assert public.post_visibility(pg_temp.u('lena.test'), v_parent) = 'visible', 'Lena should see it';
  assert exists (select 1 from public.get_post_item(pg_temp.u('lena.test'), v_parent)), 'Lena should read it';
  assert not public.can_reply_to_post(pg_temp.u('lena.test'), v_parent), 'can_reply says yes for Lena';
  perform pg_temp.fails(format($f$select pg_temp.post('lena.test', 'guten tag', 'campus', %L)$f$, v_parent),
                        'NOT_ALLOWED_HERE');
  raise notice 'lena.test can see an India post but gets NOT_ALLOWED_HERE replying: ok';

  assert public.post_visibility(pg_temp.u('demo.t1.one'), v_parent) = 'not_found', 'demo sees a real post';
  perform pg_temp.fails(format($f$select pg_temp.post('demo.t1.one', 'hi', 'campus', %L)$f$, v_parent),
                        'NOT_ALLOWED_HERE');
  assert not public.can_reply_to_post(pg_temp.u('demo.t1.one'), v_parent), 'can_reply says yes for demo';
  raise notice 'a demo user can''t reply to a real post: ok';

  assert public.can_reply_to_post(pg_temp.u('sneha.gupta'), v_parent), 'can_reply says no for Sneha';
  assert not public.can_reply_to_post(pg_temp.u('sneha.gupta'), v_reply), 'can_reply says yes for a reply';
  raise notice 'can_reply_to_post agrees with the trigger: ok';
end $$;

do $$
declare v_campus uuid := pg_temp.post('arjun.mehta', 'campus only');
begin
  perform pg_temp.fails(format($f$select pg_temp.post('sneha.gupta', 'hi', 'campus', %L)$f$, v_campus),
                        'NOT_ALLOWED_HERE');
  assert public.post_visibility(pg_temp.u('sneha.gupta'), v_campus) = 'not_found', 'other campus sees it';
  assert not exists (select 1 from public.get_post_replies(pg_temp.u('sneha.gupta'), v_campus)),
    'another campus can list the replies';
  perform pg_temp.fails($f$select pg_temp.post('arjun.mehta', 'orphan', 'campus', gen_random_uuid())$f$,
                        'POST_NOT_FOUND');
  raise notice 'another campus can''t see or reply to a campus post; a missing parent is POST_NOT_FOUND: ok';
end $$;

-- ── Rate limits ─────────────────────────────────────────────────────────────
do $$
begin
  for i in 1..15 loop perform pg_temp.post('t1.ratea', 'campus ' || i); end loop;
  perform pg_temp.fails($f$select pg_temp.post('t1.ratea', 'the 16th')$f$, 'RATE_LIMIT_POSTS');
  raise notice 'the 16th campus post in an hour is refused: ok';

  for i in 1..8 loop perform pg_temp.post('t1.ratea', 'global ' || i, 'global'); end loop;
  raise notice 'after 15 campus posts a global post still goes through: ok';
  perform pg_temp.fails($f$select pg_temp.post('t1.ratea', 'the 9th', 'global')$f$, 'RATE_LIMIT_POSTS');
  raise notice 'the 9th global post in an hour is refused: ok';

  for i in 1..8 loop perform pg_temp.post('t1.ratea', 'country ' || i, 'country'); end loop;
  perform pg_temp.fails($f$select pg_temp.post('t1.ratea', 'the 9th', 'country')$f$, 'RATE_LIMIT_POSTS');
  raise notice 'the 9th country post is refused, counted on its own: ok';
end $$;

do $$
declare v_parent uuid := pg_temp.post('arjun.mehta', 'reply to me', 'global');
begin
  for i in 1..45 loop perform pg_temp.post('t1.rateb', 'reply ' || i, 'campus', v_parent); end loop;
  perform pg_temp.fails(format($f$select pg_temp.post('t1.rateb', 'the 46th', 'campus', %L)$f$, v_parent),
                        'RATE_LIMIT_REPLIES');
  raise notice 'the 46th reply in an hour is refused: ok';
end $$;

do $$
begin
  assert (select created_at from public.users where id = pg_temp.u('t1.newbie')) > now() - interval '1 minute',
    'not a new account';
  for i in 1..15 loop perform pg_temp.post('t1.newbie', 'new ' || i); end loop;
  perform pg_temp.fails($f$select pg_temp.post('t1.newbie', 'the 16th')$f$, 'RATE_LIMIT_POSTS');
  raise notice 'an account created a minute ago has the same limits: ok';
end $$;

do $$
declare v_id uuid;
begin
  v_id := pg_temp.post('karan.singh', 'to delete', 'global');
  update public.posts set deleted_at = now() where id = v_id;
  for i in 1..7 loop perform pg_temp.post('karan.singh', 'g' || i, 'global'); end loop;
  perform pg_temp.fails($f$select pg_temp.post('karan.singh', 'one too many', 'global')$f$, 'RATE_LIMIT_POSTS');
  raise notice 'deleted posts still count toward the limit: ok';
end $$;

reset role;
update public.community_settings set value = 2 where key = 'rate_limit_country_posts_per_hour';
set local role service_role;
do $$
begin
  perform pg_temp.post('priya.nair', 'one', 'country');
  perform pg_temp.post('priya.nair', 'two', 'country');
  perform pg_temp.fails($f$select pg_temp.post('priya.nair', 'three', 'country')$f$, 'RATE_LIMIT_POSTS');
  raise notice 'updating a community_settings row changes the limit at once: ok';
end $$;

reset role;
delete from public.community_settings where key = 'rate_limit_country_posts_per_hour';
set local role service_role;
do $$
begin
  assert public.community_setting('rate_limit_country_posts_per_hour', 8) = 8, 'no fallback';
  for i in 1..6 loop perform pg_temp.post('priya.nair', 'more ' || i, 'country'); end loop;
  perform pg_temp.fails($f$select pg_temp.post('priya.nair', 'the 9th', 'country')$f$, 'RATE_LIMIT_POSTS');
  raise notice 'deleting the row falls back to the default: ok';
end $$;

-- ── Table rules ─────────────────────────────────────────────────────────────
do $$
declare v_gif text := '{"provider":"klipy","id":"1","url":"https://x.test/a.gif"}';
begin
  perform pg_temp.fails(format($f$select pg_temp.post('rahul.verma', %L)$f$, repeat('a', 1001)), 'posts_content_length');
  perform pg_temp.post('rahul.verma', repeat('👋', 1000));
  raise notice 'a 1,001-character post is refused; 1,000 emoji are fine (code points): ok';

  perform pg_temp.fails(format($f$
    insert into public.posts (author_id, content, image_urls, gif)
    values (pg_temp.u('rahul.verma'), 'both', '{https://x.test/a.jpg}', %L)$f$, v_gif), 'posts_photos_or_gif');
  raise notice 'photos and a GIF together are refused: ok';

  perform pg_temp.fails($f$
    insert into public.posts (author_id, content, image_urls)
    values (pg_temp.u('rahul.verma'), 'four', '{a,b,c,d}')$f$, 'posts_at_most_3_photos');
  perform pg_temp.fails($f$select pg_temp.post('rahul.verma', '')$f$, 'posts_not_empty');
  perform pg_temp.fails($f$
    insert into public.posts (author_id, gif) values (pg_temp.u('rahul.verma'), '{"provider":"klipy"}')$f$, 'posts_gif_shape');
  perform pg_temp.fails($f$
    insert into public.posts (author_id, content, image_urls, parent_post_id)
    values (pg_temp.u('rahul.verma'), 'photo reply', '{a}', '70000000-0000-4000-8000-000000000001')$f$, 'posts_reply_has_no_photos');
  raise notice 'at most 3 photos, never empty, gif shape, replies have no photos: ok';
end $$;

-- ── replies_count ───────────────────────────────────────────────────────────
do $$
declare
  v_parent uuid := pg_temp.post('arjun.mehta', 'count me', 'global');
  v_a uuid := pg_temp.post('sneha.gupta', 'a', 'campus', v_parent);
  v_b uuid := pg_temp.post('lena.test',   'b', 'campus', v_parent);
  v_c uuid;
begin
  assert (select replies_count from public.posts where id = v_parent) = 2, 'two inserts';
  update public.posts set deleted_at = now() where id = v_a;
  assert (select replies_count from public.posts where id = v_parent) = 1, 'soft delete';
  update public.posts set deleted_at = now() where id = v_a;
  assert (select replies_count from public.posts where id = v_parent) = 1, 'deleting twice';
  update public.posts set moderation_status = 'under_review' where id = v_b;
  assert (select replies_count from public.posts where id = v_parent) = 0, 'covered reply';
  update public.posts set moderation_status = 'active' where id = v_b;
  assert (select replies_count from public.posts where id = v_parent) = 1, 'restored reply';
  delete from public.posts where id = v_b;
  assert (select replies_count from public.posts where id = v_parent) = 0, 'hard delete';
  delete from public.posts where id = v_a;
  assert (select replies_count from public.posts where id = v_parent) = 0, 'never below 0';

  insert into public.posts (author_id, content, parent_post_id, moderation_status)
  values (pg_temp.u('sneha.gupta'), 'held', v_parent, 'pending') returning id into v_c;
  assert (select replies_count from public.posts where id = v_parent) = 0, 'a held reply counted';
  update public.posts set moderation_status = 'active' where id = v_c;
  assert (select replies_count from public.posts where id = v_parent) = 1, 'released reply not counted';
  raise notice 'replies_count follows inserts, soft deletes, covers and restores: ok';
end $$;

-- ── One post, one feed ──────────────────────────────────────────────────────
do $$
declare
  v_arjun  uuid := pg_temp.u('arjun.mehta');
  v_demo   uuid := pg_temp.u('demo.t1.one');
  v_campus uuid := pg_temp.post('priya.nair', 'in campus only');
  v_other  uuid := pg_temp.post('sneha.gupta', 'another campus');
  v_country uuid := pg_temp.post('rahul.verma', 'in india only', 'country');
  v_global  uuid := pg_temp.post('lena.test', 'in global only', 'global');
  v_demo_campus uuid := pg_temp.post('demo.t1.one', 'demo campus');
  v_demo_global uuid := pg_temp.post('demo.t1.one', 'demo global', 'global');
begin
  assert exists (select 1 from public.get_campus_feed(v_arjun, 50) where id = v_campus), 'own campus post missing';
  assert not exists (select 1 from public.get_campus_feed(v_arjun, 50) where id = v_other), 'another campus';
  assert not exists (select 1 from public.get_campus_feed(v_arjun, 50) where id in (v_country, v_global)), 'wider post';
  assert not exists (select 1 from public.get_campus_feed(v_arjun, 50) where id = v_demo_campus), 'demo post';
  assert not exists (select 1 from public.get_campus_feed(v_arjun, 50) where scope <> 'campus'), 'scope leak';
  raise notice 'the campus feed shows only its own campus''s campus posts: ok';

  assert exists (select 1 from public.get_country_feed(v_arjun, 'IN', 'new', 50) where id = v_country), 'india post missing';
  assert not exists (select 1 from public.get_country_feed(v_arjun, 'IN', 'new', 50) where scope <> 'country'), 'country leak';
  assert exists (select 1 from public.get_global_feed(v_arjun, 'new', 50) where id = v_global), 'global post missing';
  assert not exists (select 1 from public.get_global_feed(v_arjun, 'new', 50) where scope <> 'global'), 'global leak';
  assert not exists (select 1 from public.get_global_feed(v_arjun, 'new', 50) where id = v_demo_global), 'demo in real global';
  assert exists (select 1 from public.get_country_feed(pg_temp.u('lena.test'), 'IN', 'new', 50) where id = v_country), 'Lena can''t read India';
  raise notice 'the country and global feeds never show campus posts or the other world: ok';

  assert exists (select 1 from public.get_global_feed(v_demo, 'new', 50) where id = v_demo_global), 'demo post missing for demo';
  assert not exists (select 1 from public.get_global_feed(v_demo, 'new', 50) where id = v_global), 'real post for demo';
  assert not exists (select 1 from public.get_campus_feed(gen_random_uuid(), 50)), 'unknown viewer got a feed';
  raise notice 'demo accounts see only demo posts; an unknown viewer sees nothing: ok';

  assert public.count_new_campus_posts(v_arjun, now() - interval '1 minute') >= 1, 'new count';
  assert public.count_new_campus_posts(pg_temp.u('priya.nair'), now() + interval '1 minute') = 0, 'future since';
  assert (select count(*) from public.get_campus_feed(v_arjun, 50) where created_at >= now() - interval '1 minute' and not is_mine)
       = public.count_new_campus_posts(v_arjun, now() - interval '1 minute'), 'count disagrees with feed';
  raise notice 'count_new_campus_posts matches the feed and leaves out your own: ok';

  assert public.can_post_in_feed(v_arjun, 'campus') and public.can_post_in_feed(v_arjun, 'global'), 'campus/global';
  assert public.can_post_in_feed(v_arjun, 'country', 'IN'), 'own country';
  assert not public.can_post_in_feed(v_arjun, 'country', 'DE'), 'other country';
  assert not public.can_post_in_feed(gen_random_uuid(), 'global'), 'unknown viewer';
  raise notice 'can_post_in_feed: own country only: ok';

  assert (select array_agg(country_code::text order by country_code) from public.countries_for_viewer(v_arjun)) = '{DE,IN}', 'real countries';
  assert (select is_mine from public.countries_for_viewer(v_arjun) where country_code = 'IN'), 'is_mine';
  assert (select array_agg(country_code::text) from public.countries_for_viewer(v_demo)) = '{IN}', 'demo countries';
  raise notice 'countries_for_viewer: real and demo: ok';
end $$;

-- ── Visibility: covered, held, deleted ──────────────────────────────────────
do $$
declare
  v_author uuid := pg_temp.u('rahul.verma');
  v_other  uuid := pg_temp.u('sneha.gupta');
  v_post   uuid := pg_temp.post('rahul.verma', 'covered', 'global');
  v_reply  uuid;
  v_thread uuid := pg_temp.post('rahul.verma', 'thread', 'global');
begin
  update public.posts set moderation_status = 'under_review' where id = v_post;

  assert public.post_visibility(v_other, v_post) = 'under_review', 'others';
  assert public.post_visibility(v_author, v_post) = 'visible', 'author';
  raise notice 'under_review: post_visibility is under_review for others, visible for its author: ok';

  assert exists (select 1 from public.get_post_item(v_author, v_post)), 'author item';
  assert not exists (select 1 from public.get_post_item(v_other, v_post)), 'other item';
  assert exists (select 1 from public.get_user_posts(v_author, v_author, 50) where id = v_post), 'author profile';
  assert not exists (select 1 from public.get_user_posts(v_other, v_author, 50) where id = v_post), 'other profile';
  raise notice 'get_post_item and get_user_posts return a covered post only to its author: ok';

  assert not exists (select 1 from public.get_global_feed(v_author, 'new', 50) where id = v_post), 'new feed';
  assert not exists (select 1 from public.get_global_feed(v_author, 'hot', 50) where id = v_post), 'hot feed';
  raise notice 'a covered post is in no feed: ok';

  assert not public.can_reply_to_post(v_other, v_post), 'can reply to a covered post';
  perform pg_temp.fails(format($f$select pg_temp.post('sneha.gupta', 'hi', 'campus', %L)$f$, v_post), 'POST_NOT_FOUND');
  raise notice 'nobody can reply to a covered post: ok';

  v_reply := pg_temp.post('sneha.gupta', 'a reply', 'campus', v_thread);
  update public.posts set moderation_status = 'under_review' where id = v_reply;
  assert exists (select 1 from public.get_post_replies(v_other, v_thread) where id = v_reply), 'its author';
  assert not exists (select 1 from public.get_post_replies(v_author, v_thread) where id = v_reply), 'the post''s author';
  assert not exists (select 1 from public.get_post_replies(pg_temp.u('lena.test'), v_thread) where id = v_reply), 'a stranger';
  raise notice 'a covered reply is missing from get_post_replies for everyone but its author: ok';

  update public.posts set moderation_status = 'active' where id = v_reply;
  update public.posts set deleted_at = now() where id = v_thread;
  assert public.post_visibility(v_other, v_thread) = 'deleted', 'deleted post';
  assert public.post_visibility(v_other, v_reply) = 'deleted', 'its reply';
  assert not exists (select 1 from public.get_post_replies(v_other, v_thread)), 'replies of a deleted post';
  raise notice 'deleting a post takes its replies with it: ok';

  update public.posts set moderation_status = 'removed' where id = v_post;
  assert public.post_visibility(v_author, v_post) = 'removed', 'removed';
  raise notice 'a removed post is removed even for its author: ok';
end $$;

do $$
declare
  v_author uuid := pg_temp.u('rahul.verma');
  v_id uuid;
  v_item public.post_item;
begin
  insert into public.posts (author_id, content, moderation_status, moderation_support)
  values (v_author, 'held', 'pending', true) returning id into v_id;

  select * into v_item from public.get_post_item(v_author, v_id);
  assert v_item.moderation_support is true, 'author should get true';
  assert v_item.moderation_status = 'pending', 'status';
  assert public.post_visibility(pg_temp.u('priya.nair'), v_id) = 'not_found', 'held post visible to others';
  assert not exists (select 1 from public.get_post_item(pg_temp.u('priya.nair'), v_id)), 'held item to others';

  update public.posts set moderation_status = 'active' where id = v_id;
  select * into v_item from public.get_post_item(v_author, v_id);
  assert v_item.moderation_support is false, 'false once active';
  select * into v_item from public.get_post_item(pg_temp.u('priya.nair'), v_id);
  assert v_item.moderation_support is false, 'false for others';
  raise notice 'moderation_support is true only to the author of a pending post: ok';

  assert (select moderation_photo_failures from public.posts where id = v_id) = 0, 'default';
  assert not (to_jsonb(v_item) ? 'moderation_photo_failures'), 'in the PostItem';
  raise notice 'moderation_photo_failures defaults to 0 and is not in the PostItem: ok';

  assert to_jsonb(v_item) ?& array['id','parent_post_id','scope','country_code','content','image_urls','gif',
    'created_at','reactions_total','reaction_counts','replies_count','viewer_reaction','moderation_status',
    'moderation_support','author_id','author_username','author_name','author_avatar','author_university','is_mine','hot_score'],
    'a field is missing';
  assert v_item.author_username = 'rahul.verma' and v_item.author_university = 'IIITDM Kurnool' and v_item.is_mine is false, 'author fields';
  assert not (to_jsonb(v_item) ?| array['report_count','moderation_scores','moderation_flagged','is_demo','university_id']), 'internal field leaked';
  raise notice 'the PostItem has every field of Appendix A and no internal ones: ok';
end $$;

-- ── Paging ──────────────────────────────────────────────────────────────────
do $$
declare
  v_viewer uuid := pg_temp.u('t1.page');
  v_seen   uuid[];
  v_page   public.post_item[];
  v_last   public.post_item;
  v_total  integer;
  v_pages  integer;
begin
  -- now() doesn't move inside a transaction, so these all tie on created_at. That
  -- is the case the id in the cursor is there for.
  for i in 1..7 loop perform pg_temp.post('t1.page', 'page ' || i, 'global'); end loop;
  update public.posts set hot_score = 0.5 where author_id = v_viewer;

  select count(*) into v_total from public.posts
   where scope = 'global' and parent_post_id is null and moderation_status = 'active'
     and deleted_at is null and not is_demo;

  -- New
  v_seen := '{}'; v_last := null; v_pages := 0;
  loop
    select array_agg(f) into v_page
      from public.get_global_feed(v_viewer, 'new', 3, null, v_last.created_at, v_last.id) f;
    exit when v_page is null;
    v_seen := v_seen || array(select (x).id from unnest(v_page) x);
    v_last := v_page[array_length(v_page, 1)];
    v_pages := v_pages + 1;
    assert v_pages < 200, 'New never ended';
  end loop;
  assert cardinality(v_seen) = v_total, format('New gaps: %s of %s', cardinality(v_seen), v_total);
  assert (select count(distinct x) from unnest(v_seen) x) = v_total, 'New repeats';
  raise notice 'New pages with the cursor with no repeats and no gaps: ok';

  -- Hot. The cursor goes through text with 15 significant digits, as it does when
  -- the API sends it as JSON and gets it back. Passing the float straight back
  -- would hide a score that doesn't survive that trip: the feed would never end.
  perform set_config('extra_float_digits', '0', true);
  v_seen := '{}'; v_last := null; v_pages := 0;
  loop
    select array_agg(f) into v_page
      from public.get_global_feed(v_viewer, 'hot', 3, (v_last.hot_score::text)::double precision, null, v_last.id) f;
    exit when v_page is null;
    v_seen := v_seen || array(select (x).id from unnest(v_page) x);
    v_last := v_page[array_length(v_page, 1)];
    v_pages := v_pages + 1;
    assert v_pages < 200, 'Hot never ended';
  end loop;
  assert cardinality(v_seen) = v_total, format('Hot gaps: %s of %s', cardinality(v_seen), v_total);
  assert (select count(distinct x) from unnest(v_seen) x) = v_total, 'Hot repeats';
  raise notice 'Hot pages with the cursor with no repeats and no gaps: ok';

  assert (select count(*) from public.get_global_feed(v_viewer, 'new', 500)) <= 50, 'limit cap';
  assert (select count(*) from public.get_global_feed(v_viewer, 'new', 0)) = 1, 'limit floor';
  raise notice 'limit is held between 1 and 50: ok';
end $$;

do $$
declare
  v_seen uuid[] := '{}';
  v_last public.post_item;
  v_parent uuid := '70000000-0000-4000-8000-000000000010';
  v_rows public.post_item[];
begin
  select array_agg(r) into v_rows from public.get_post_replies(pg_temp.u('karan.singh'), v_parent, 1) r;
  v_last := v_rows[1];
  v_seen := array[v_last.id];
  select array_agg(r) into v_rows from public.get_post_replies(pg_temp.u('karan.singh'), v_parent, 1, v_last.created_at, v_last.id) r;
  assert v_rows[1].id <> v_seen[1] and v_rows[1].created_at > v_last.created_at, 'replies are not oldest first';
  raise notice 'replies page oldest first: ok';
end $$;

-- ── Hot ─────────────────────────────────────────────────────────────────────
do $$
declare
  v_older uuid := pg_temp.post('t1.hot', 'older and quiet', 'global');
  v_newer uuid := pg_temp.post('t1.hot', 'newer', 'global');
  v_campus uuid := pg_temp.post('t1.hot', 'campus');
  v_old_week uuid := pg_temp.post('t1.hot', 'over a week old', 'global');
  v_score double precision;
begin
  update public.posts set created_at = now() - interval '30 hours' where id = v_older;
  update public.posts set created_at = now() - interval '8 days', hot_score = 0.123 where id = v_old_week;
  update public.posts set hot_score = 9 where id = v_older;   -- a stale score the refresh must correct

  perform public.refresh_hot_scores();

  assert (select hot_score from public.posts where id = v_newer) > (select hot_score from public.posts where id = v_older),
    'newer should outrank older';
  assert (select array_position(array_agg(id), v_newer) < array_position(array_agg(id), v_older)
            from public.get_global_feed(pg_temp.u('t1.hot'), 'hot', 50)), 'feed order';
  raise notice 'after refresh_hot_scores, a newer active post outranks an older quiet one: ok';

  select hot_score into v_score from public.posts where id = v_older;
  assert abs(v_score - 1.0 / power(32, 1.5)) < 0.0001, 'formula';
  raise notice 'the score follows the §1.3 formula: ok';

  assert (select hot_score from public.posts where id = v_old_week) = 0.123, 'a post over 7 days old was refreshed';
  raise notice 'posts over 7 days old keep their last score: ok';

  perform set_config('extra_float_digits', '0', true);
  assert not exists (select 1 from public.posts where (hot_score::text)::double precision <> hot_score),
    'a hot_score does not survive 15 significant digits';
  assert (public.post_hot_score(2000000, 0, 0)::text)::double precision = public.post_hot_score(2000000, 0, 0), 'a large score';
  assert (public.post_hot_score(0, 0, 168)::text)::double precision = public.post_hot_score(0, 0, 168), 'a small score';
  raise notice 'every hot_score survives the trip through JSON as a cursor: ok';
end $$;

reset role;

-- ── The job ─────────────────────────────────────────────────────────────────
do $$
begin
  assert (select count(*) from cron.job where jobname = 'refresh-hot-scores' and schedule = '*/5 * * * *') = 1, 'cron job';
  raise notice 'refresh-hot-scores is scheduled every 5 minutes, once: ok';

  assert (select count(*) from public.community_settings) = 9 - 1, 'settings rows (one deleted above)';
  assert (select count(*) from public.universities where country_code <> 'IN') = 1, 'only the test campus is outside India';
  raise notice 'every campus is in India except the local test campus: ok';
end $$;

-- ── Privileges ──────────────────────────────────────────────────────────────
do $$
declare r text; f record; t text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    for f in
      select p.oid, p.oid::regprocedure as sig from pg_proc p
       where p.pronamespace = 'public'::regnamespace
         and p.proname = any (array[
           'community_setting','post_hot_score','community_viewer','post_reply_refusal','prepare_post',
           'sync_replies_count','post_visibility','can_reply_to_post','can_post_in_feed','post_items_by_ids',
           'get_campus_feed','get_country_feed','get_global_feed','get_post_item','get_post_replies',
           'get_user_posts','count_new_campus_posts','countries_for_viewer','refresh_hot_scores'])
    loop
      assert not has_function_privilege(r, f.oid, 'execute'), format('%s can run %s', r, f.sig);
    end loop;

    foreach t in array array['public.posts', 'public.community_settings'] loop
      assert not has_table_privilege(r, t, 'select'), format('%s can read %s', r, t);
      assert not has_table_privilege(r, t, 'insert'), format('%s can write %s', r, t);
    end loop;
  end loop;

  assert (select relrowsecurity from pg_class where oid = 'public.community_settings'::regclass), 'RLS off';
  assert (select relrowsecurity from pg_class where oid = 'public.posts'::regclass), 'RLS off on posts';
  raise notice 'anon and authenticated can''t run the new functions or read the new tables: ok';
end $$;

rollback;
