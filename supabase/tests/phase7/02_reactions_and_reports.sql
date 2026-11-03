-- Phase 7 · V-B · tests for migration reactions_and_reports. Local database only.
-- Runs in one transaction and rolls back. Every line it prints should end in "ok".
-- It acts as service_role, as the backend does, so a missing grant fails here too.
\set ON_ERROR_STOP on
\set QUIET on

begin;

create function pg_temp.u(p_username text) returns uuid language sql stable as $$
  select id from public.users where username = p_username
$$;

create function pg_temp.post(p_author text, p_body text, p_scope text default 'campus', p_images text[] default '{}')
  returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.posts (author_id, content, scope, image_urls)
  values (pg_temp.u(p_author), p_body, p_scope, p_images)
  returning id into v_id;
  return v_id;
end $$;

create function pg_temp.report(p_reporter text, p_post uuid, p_reason text) returns void language sql as $$
  select public.create_report(pg_temp.u(p_reporter), 'post', p_post, p_reason, null)
$$;

create function pg_temp.status(p_post uuid) returns text language sql stable as $$
  select moderation_status from public.posts where id = p_post
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

grant execute on all functions in schema pg_temp to service_role;

set local role service_role;

-- ── Reactions ───────────────────────────────────────────────────────────────
do $$
declare
  v_post  uuid := pg_temp.post('arjun.mehta', 'react to me', 'global');
  v_sneha uuid := pg_temp.u('sneha.gupta');
  v_lena  uuid := pg_temp.u('lena.test');
  r record;
begin
  select * into r from public.react_to_post(v_post, v_sneha, '❤️');
  assert r.reactions_total = 1 and r.reaction_counts = '{"❤️": 1}' and r.viewer_reaction = '❤️', 'first reaction';

  select * into r from public.react_to_post(v_post, v_sneha, '😂');
  assert r.reactions_total = 1 and r.reaction_counts = '{"😂": 1}' and r.viewer_reaction = '😂', 'changing';
  assert (select count(*) from public.post_reactions where post_id = v_post and user_id = v_sneha) = 1, 'two rows';
  raise notice 'one reaction per person, and changing it keeps reaction_counts right: ok';

  select * into r from public.react_to_post(v_post, v_sneha, '😂');
  assert r.reactions_total = 1 and r.reaction_counts = '{"😂": 1}', 'the same emoji twice';

  select * into r from public.react_to_post(v_post, v_lena, '😂');
  assert r.reactions_total = 2 and r.reaction_counts = '{"😂": 2}', 'second person';
  select * into r from public.react_to_post(v_post, v_lena, null);
  assert r.reactions_total = 1 and r.reaction_counts = '{"😂": 1}' and r.viewer_reaction is null, 'removing';
  select * into r from public.react_to_post(v_post, v_sneha, null);
  assert r.reactions_total = 0 and r.reaction_counts = '{}', 'a key at 0 is removed';
  select * into r from public.react_to_post(v_post, v_sneha, null);
  assert r.reactions_total = 0, 'removing twice';
  raise notice 'removing keeps reaction_counts right, and never goes below 0: ok';

  select * into r from public.react_to_post(v_post, v_lena, '😮');
  assert (select viewer_reaction from public.get_post_item(v_lena, v_post)) = '😮', 'viewer_reaction for Lena';
  assert (select viewer_reaction from public.get_post_item(v_sneha, v_post)) is null, 'viewer_reaction for Sneha';
  raise notice 'viewer_reaction is your own, and Lena can react to any post she can see: ok';

  perform pg_temp.fails(format($f$select public.react_to_post(%L, pg_temp.u('lena.test'), %L)$f$, v_post, repeat('x', 17)),
                        'post_reactions_emoji_check');
  raise notice 'the length check is a backstop for the emoji: ok';
end $$;

do $$
declare
  v_campus uuid := pg_temp.post('arjun.mehta', 'campus only');
  v_held   uuid;
  v_covered uuid := pg_temp.post('arjun.mehta', 'covered', 'global');
begin
  perform pg_temp.fails(format($f$select public.react_to_post(%L, pg_temp.u('sneha.gupta'), '❤️')$f$, v_campus), 'POST_NOT_FOUND');
  perform pg_temp.fails($f$select public.react_to_post(gen_random_uuid(), pg_temp.u('sneha.gupta'), '❤️')$f$, 'POST_NOT_FOUND');
  raise notice 'reacting to an invisible post is POST_NOT_FOUND: ok';

  insert into public.posts (author_id, content, moderation_status) values (pg_temp.u('arjun.mehta'), 'held', 'pending') returning id into v_held;
  perform pg_temp.fails(format($f$select public.react_to_post(%L, pg_temp.u('arjun.mehta'), '❤️')$f$, v_held), 'POST_NOT_FOUND');
  update public.posts set moderation_status = 'under_review' where id = v_covered;
  perform pg_temp.fails(format($f$select public.react_to_post(%L, pg_temp.u('arjun.mehta'), '❤️')$f$, v_covered), 'POST_NOT_FOUND');
  raise notice 'not even the author can react to a held or covered post: ok';
end $$;

-- ── Reports: who may report ─────────────────────────────────────────────────
do $$
declare
  v_post   uuid := pg_temp.post('arjun.mehta', 'report me', 'global');
  v_campus uuid := pg_temp.post('arjun.mehta', 'campus only');
begin
  perform pg_temp.fails(format($f$select pg_temp.report('arjun.mehta', %L, 'spam')$f$, v_post), 'CANNOT_REPORT_OWN');
  raise notice 'reporting your own post is CANNOT_REPORT_OWN: ok';

  perform pg_temp.report('sneha.gupta', v_post, 'spam');
  begin
    perform pg_temp.report('sneha.gupta', v_post, 'violence');
    raise exception 'a second report went through';
  exception when unique_violation then
    raise notice 'reporting twice is a unique_violation: ok';
  end;

  perform pg_temp.fails(format($f$select pg_temp.report('sneha.gupta', %L, 'spam')$f$, v_campus), 'POST_NOT_FOUND');
  perform pg_temp.fails(format($f$select public.create_report(pg_temp.u('sneha.gupta'), 'user', %L, 'spam')$f$, v_post), 'POST_NOT_FOUND');
  raise notice 'a post you can''t see, or a target that isn''t a post, is POST_NOT_FOUND: ok';

  assert (select reporter_in_audience from public.reports where target_id = v_post and reporter_id = pg_temp.u('sneha.gupta')), 'global audience';
end $$;

-- ── Reports: the cover rules ────────────────────────────────────────────────
do $$
declare
  v_photo uuid := pg_temp.post('arjun.mehta', 'photos', 'global', '{https://x.test/a.jpg}');
  v_text  uuid := pg_temp.post('arjun.mehta', 'text only', 'global');
  v_viol  uuid := pg_temp.post('arjun.mehta', 'violence', 'global');
begin
  perform pg_temp.report('sneha.gupta', v_photo, 'child_safety');
  assert pg_temp.status(v_photo) = 'under_review', 'one report on a photo post';
  raise notice 'one child_safety report covers a post with photos: ok';

  perform pg_temp.report('sneha.gupta', v_text, 'child_safety');
  assert pg_temp.status(v_text) = 'active', 'one report on a text post';
  perform pg_temp.report('karan.singh', v_text, 'child_safety');
  assert pg_temp.status(v_text) = 'under_review', 'two reports on a text post';
  raise notice 'a text-only post needs 2 child_safety reports: ok';

  perform pg_temp.report('sneha.gupta', v_viol, 'violence');
  perform pg_temp.report('karan.singh', v_viol, 'sexual_content');
  assert pg_temp.status(v_viol) = 'active', 'two serious reports';
  perform pg_temp.report('lena.test', v_viol, 'self_harm');
  assert pg_temp.status(v_viol) = 'under_review', 'three serious reports';
  raise notice '3 serious reports cover a post, counted together and from everyone: ok';

  assert (select report_count from public.posts where id = v_viol) = 3, 'report_count';

  -- Already covered, and still reportable.
  perform pg_temp.report('priya.nair', v_viol, 'spam');
  assert (select report_count from public.posts where id = v_viol) = 4, 'report_count on a covered post';
  assert pg_temp.status(v_viol) = 'under_review', 'still covered';
  raise notice 'a post that is already under_review can still be reported: ok';
end $$;

do $$
declare v_post uuid := pg_temp.post('arjun.mehta', 'violence, dismissed', 'global');
begin
  perform pg_temp.report('sneha.gupta', v_post, 'violence');
  perform pg_temp.report('karan.singh', v_post, 'violence');
  update public.reports set status = 'dismissed', reviewed_at = now() where target_id = v_post;
  perform pg_temp.report('lena.test', v_post, 'violence');
  assert pg_temp.status(v_post) = 'active', 'dismissed reports counted';
  assert (select report_count from public.posts where id = v_post) = 3, 'report_count should still be 3';
  raise notice 'dismissed reports don''t count toward a threshold, and report_count is still 3: ok';
end $$;

do $$
declare v_post uuid := pg_temp.post('arjun.mehta', 'spammy');
begin
  perform pg_temp.report('priya.nair',       v_post, 'spam');
  perform pg_temp.report('rahul.verma',      v_post, 'harassment');
  perform pg_temp.report('test.kurnool',     v_post, 'other');
  perform pg_temp.report('vishwajeet.singh', v_post, 'spam');
  assert pg_temp.status(v_post) = 'active', '4 reports';
  perform pg_temp.report('v-test1', v_post, 'spam');
  assert pg_temp.status(v_post) = 'under_review', '5 reports';
  raise notice '4 spam reports on a campus post don''t cover it, the 5th does: ok';
end $$;

-- A lower threshold, so one report from each side shows who counts.
reset role;
update public.community_settings set value = 1 where key = 'report_threshold_other_wide';
set local role service_role;
do $$
declare v_post uuid := pg_temp.post('arjun.mehta', 'india post', 'country');
begin
  perform pg_temp.report('lena.test', v_post, 'spam');
  assert not (select reporter_in_audience from public.reports where target_id = v_post), 'Lena is not the audience';
  assert pg_temp.status(v_post) = 'active', 'Lena''s report counted';
  raise notice 'spam reports from lena.test on an India post don''t count toward 10: ok';

  perform pg_temp.report('sneha.gupta', v_post, 'spam');
  assert pg_temp.status(v_post) = 'under_review', 'an Indian report did not count';
  raise notice 'a spam report from India does count: ok';
end $$;

do $$
declare v_post uuid := pg_temp.post('arjun.mehta', 'violence, from abroad', 'country');
begin
  perform pg_temp.report('lena.test',   v_post, 'violence');
  perform pg_temp.report('sneha.gupta', v_post, 'violence');
  perform pg_temp.report('karan.singh', v_post, 'violence');
  assert pg_temp.status(v_post) = 'under_review', 'a serious report from abroad did not count';
  raise notice 'a serious report from outside the audience still counts: ok';
end $$;

reset role;
update public.community_settings set value = 2 where key = 'report_threshold_other_campus';
set local role service_role;
do $$
declare v_post uuid := pg_temp.post('arjun.mehta', 'low threshold');
begin
  perform pg_temp.report('priya.nair', v_post, 'spam');
  assert pg_temp.status(v_post) = 'active', 'one report';
  perform pg_temp.report('rahul.verma', v_post, 'spam');
  assert pg_temp.status(v_post) = 'under_review', 'two reports';
  raise notice 'the thresholds come from community_settings: with 2, two spam reports cover a campus post: ok';
end $$;

reset role;
delete from public.community_settings where key = 'report_threshold_child_safety_photo';
set local role service_role;
do $$
declare v_post uuid := pg_temp.post('arjun.mehta', 'fallback', 'global', '{https://x.test/a.jpg}');
begin
  perform pg_temp.report('sneha.gupta', v_post, 'child_safety');
  assert pg_temp.status(v_post) = 'under_review', 'no fallback';
  raise notice 'a deleted threshold row falls back to the default: ok';
end $$;

-- The restore steps from runbook §1.7.
do $$
declare v_post uuid := pg_temp.post('rahul.verma', 'restored', 'global');
begin
  perform pg_temp.report('sneha.gupta', v_post, 'violence');
  perform pg_temp.report('karan.singh', v_post, 'violence');
  perform pg_temp.report('lena.test',   v_post, 'violence');
  assert pg_temp.status(v_post) = 'under_review', 'covered';
  update public.reports set status = 'dismissed', reviewed_at = now()
   where target_type = 'post' and target_id = v_post and status = 'open';
  update public.posts set moderation_status = 'active' where id = v_post;

  perform pg_temp.report('priya.nair', v_post, 'violence');
  assert pg_temp.status(v_post) = 'active', 'a 4th report covered a restored post';
  assert (select report_count from public.posts where id = v_post) = 4, 'report_count should say 4';
  raise notice 'the worked example of §1.7: restored, then a 4th report leaves it up, report_count 4: ok';
end $$;

reset role;

-- ── Account deletion must still work: the two counter triggers are on that path ─
do $$
begin
  assert (select prosecdef from pg_proc where oid = 'public.sync_post_reaction_counts()'::regprocedure), 'reaction trigger';
  assert (select prosecdef from pg_proc where oid = 'public.sync_replies_count()'::regprocedure), 'replies trigger';
  raise notice 'the two counter triggers on the account-deletion path are SECURITY DEFINER: ok';
end $$;

-- ── Privileges ──────────────────────────────────────────────────────────────
do $$
declare r text; f record; t text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    for f in
      select p.oid, p.oid::regprocedure as sig from pg_proc p
       where p.pronamespace = 'public'::regnamespace
         and p.proname = any (array['bump_reaction_counts','sync_post_reaction_counts','react_to_post',
                                    'create_report','apply_report_rules'])
    loop
      assert not has_function_privilege(r, f.oid, 'execute'), format('%s can run %s', r, f.sig);
    end loop;

    foreach t in array array['public.post_reactions', 'public.reports'] loop
      assert not has_table_privilege(r, t, 'select'), format('%s can read %s', r, t);
      assert not has_table_privilege(r, t, 'insert'), format('%s can write %s', r, t);
    end loop;
  end loop;

  assert (select relrowsecurity from pg_class where oid = 'public.post_reactions'::regclass), 'RLS off';
  assert (select relrowsecurity from pg_class where oid = 'public.reports'::regclass), 'RLS off';
  raise notice 'anon and authenticated can''t run the new functions or read the new tables: ok';
end $$;

rollback;
