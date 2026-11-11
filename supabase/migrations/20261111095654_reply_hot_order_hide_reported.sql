-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 7 · Block V-C (decided 11 Nov) — replies ranked by Hot; reported posts
-- stay hidden from the student who reported them
--
-- A. Replies use the Hot formula, like the country and Global feeds (runbook
--    §1.3): (likes + 2 × replies + 1) ÷ (hours + 2)^1.5. A reply has no replies,
--    so it is (likes + 1) ÷ (hours + 2)^1.5.
--      1. refresh_hot_scores() also scores replies from the last 7 days
--      2. a one-off backfill scores every active reply now
--      3. get_post_replies() takes p_sort: 'hot' (what the API now sends), or
--         'oldest', the old order and the default, so the controller already
--         deployed keeps working until the new one is (see below)
--      4. post_top_replies() picks the first 2 of exactly that Hot order, so
--         the preview under a post is the first page of its thread
--
-- B. A post or reply you reported no longer comes back for you after a reload
--    (Neeraj's N-D entry, 11 Nov). Instagram and X do the same. Skipped in: the
--    three feeds, a profile's Posts tab, the replies, the reply preview, and the
--    "new posts" count. The post's own page (GET /api/posts/:id) still opens it
--    when asked for directly, and nothing changes for anyone else: covering a
--    post for everyone is still apply_report_rules()'s job.
--
-- Rollout: push this first, then deploy the backend. Until the backend sends
-- p_sort, get_post_replies() answers oldest first, exactly as before. All
-- signatures except get_post_replies() are unchanged (create or replace).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ---------------------------------------------------------------------------
-- 1. Indexes
-- ---------------------------------------------------------------------------

-- A thread in Hot order. Includes hidden replies: the author still sees theirs.
create index posts_replies_hot_idx
  on public.posts (parent_post_id, hot_score desc, id desc)
  where parent_post_id is not null;

-- refresh_hot_scores(): replies from the last 7 days.
create index posts_reply_hot_refresh_idx
  on public.posts (created_at)
  where parent_post_id is not null
    and moderation_status = 'active' and deleted_at is null;

-- "Not reported by the viewer" uses the reports table's own unique key,
-- (reporter_id, target_type, target_id), so it needs no index of its own.

-- ---------------------------------------------------------------------------
-- 2. The Hot score for replies, every 5 minutes (same cron job, same function)
-- ---------------------------------------------------------------------------
create or replace function public.refresh_hot_scores()
  returns void
  language sql
  security invoker
  set search_path = public, pg_temp
as $function$
  update public.posts p
     set hot_score = public.post_hot_score(
           p.reactions_total,
           p.replies_count,
           extract(epoch from now() - p.created_at) / 3600.0
         )
   where p.scope in ('country', 'global') and p.parent_post_id is null
     and p.moderation_status = 'active' and p.deleted_at is null
     and p.created_at > now() - interval '7 days';

  -- Replies, under posts in every feed (campus too: the campus FEED is by time,
  -- but a campus post's thread is by Hot like any other).
  update public.posts p
     set hot_score = public.post_hot_score(
           p.reactions_total,
           p.replies_count,
           extract(epoch from now() - p.created_at) / 3600.0
         )
   where p.parent_post_id is not null
     and p.moderation_status = 'active' and p.deleted_at is null
     and p.created_at > now() - interval '7 days';
$function$;

comment on function public.refresh_hot_scores() is
  'Recalculates hot_score for active top-level country and global posts, and for '
  'active replies, from the last 7 days. Older ones keep their last score and '
  'sink naturally.';

-- A new reply enters Hot at once, as a new post does. prepare_post() sets the
-- birth score only for top-level posts, so without this a reply would start at
-- 0, below every other reply, until the next refresh.
create function public.score_new_reply()
  returns trigger
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
begin
  if new.parent_post_id is not null then
    new.hot_score := public.post_hot_score(0, 0, 0);
  end if;
  return new;
end;
$function$;

comment on function public.score_new_reply() is
  'Gives a new reply the birth Hot score, (0 + 1) ÷ 2^1.5, like a new post.';

-- After trg_prepare_post in name order, which never touches a reply's score.
create trigger trg_score_new_reply
  before insert on public.posts
  for each row execute function public.score_new_reply();

revoke execute on function public.score_new_reply() from public, anon, authenticated;

-- Every active reply, whatever its age, once. Without it a reply older than 7
-- days would keep the score it was given at birth, (0 + 1) ÷ 2^1.5, and sit at
-- the top of its thread for ever.
update public.posts p
   set hot_score = public.post_hot_score(
         p.reactions_total,
         p.replies_count,
         extract(epoch from now() - p.created_at) / 3600.0
       )
 where p.parent_post_id is not null
   and p.moderation_status = 'active' and p.deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. A thread, by Hot
--
-- Dropped and re-created because the signature grows. The two new arguments
-- come last and have defaults, so the deployed controller's call (p_viewer,
-- p_post_id, p_limit, p_cursor_time, p_cursor_id) still resolves, to 'oldest'.
-- Once the new backend is live everywhere, 'oldest' can go in a later migration.
-- ---------------------------------------------------------------------------
drop function public.get_post_replies(uuid, uuid, integer, timestamptz, uuid);

create function public.get_post_replies(
  p_viewer       uuid,
  p_post_id      uuid,
  p_limit        integer          default 20,
  p_cursor_time  timestamptz      default null,
  p_cursor_id    uuid             default null,
  p_sort         text             default 'oldest',
  p_cursor_score double precision default null
)
  returns setof public.post_item
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  -- Without this, anyone could read another campus's thread, or a covered or
  -- deleted post's thread, by asking for its replies directly.
  if public.post_visibility(p_viewer, p_post_id) <> 'visible' then
    return;
  end if;

  if p_sort = 'hot' then
    return query
    select * from public.post_items_by_ids(p_viewer, array(
      select p.id from public.posts p
       where p.parent_post_id = p_post_id
         and p.deleted_at is null
         and (p.moderation_status = 'active'
              or (p.author_id = p_viewer and p.moderation_status in ('pending', 'under_review')))
         and not exists (select 1 from public.reports r
                          where r.reporter_id = p_viewer and r.target_type = 'post'
                            and r.target_id = p.id)
         and (p.hot_score, p.id) < (coalesce(p_cursor_score, 'infinity'::double precision),
                                    coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
       order by p.hot_score desc, p.id desc
       limit v_limit
    ));
  else
    return query
    select * from public.post_items_by_ids(p_viewer, array(
      select p.id from public.posts p
       where p.parent_post_id = p_post_id
         and p.deleted_at is null
         and (p.moderation_status = 'active'
              or (p.author_id = p_viewer and p.moderation_status in ('pending', 'under_review')))
         and not exists (select 1 from public.reports r
                          where r.reporter_id = p_viewer and r.target_type = 'post'
                            and r.target_id = p.id)
         and (p.created_at, p.id) > (coalesce(p_cursor_time, '-infinity'::timestamptz),
                                     coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid))
       order by p.created_at, p.id
       limit v_limit
    ));
  end if;
end;
$function$;

comment on function public.get_post_replies(uuid, uuid, integer, timestamptz, uuid, text, double precision) is
  'A post''s active replies, plus the viewer''s own held or covered ones, minus '
  'any the viewer reported. p_sort hot: (hot_score, id) descending, what the API '
  'sends. oldest: (created_at, id), kept only for the backend deployed before '
  'this migration. Nothing at all unless the viewer may see the post itself.';

-- ---------------------------------------------------------------------------
-- 4. The preview: the first 2 of the Hot thread
-- ---------------------------------------------------------------------------
create or replace function public.post_top_replies(p_viewer uuid, p_post_id uuid)
  returns jsonb
  language sql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
  select coalesce(
    jsonb_agg(to_jsonb(r) - 'hot_score' order by r.hot_score desc, r.id desc),
    '[]'::jsonb)
  from public.post_items_by_ids(p_viewer, array(
    select p.id from public.posts p
     where p.parent_post_id = p_post_id
       and p.deleted_at is null
       and (p.moderation_status = 'active'
            or (p.author_id = p_viewer and p.moderation_status in ('pending', 'under_review')))
       and not exists (select 1 from public.reports r
                        where r.reporter_id = p_viewer and r.target_type = 'post'
                          and r.target_id = p.id)
     order by p.hot_score desc, p.id desc
     limit 2
  )) r;
$function$;

comment on function public.post_top_replies(uuid, uuid) is
  'Internal: the first 2 replies of get_post_replies(p_sort => ''hot'') for this '
  'viewer, as reply PostItems (JSON, hot_score removed). It does not check that '
  'the viewer may see the post itself, so it must never be reached directly from '
  'a route.';

-- ---------------------------------------------------------------------------
-- 5. The feeds, the Posts tab and the "new posts" count skip what you reported.
--    Each is its community_posts version with one added condition.
-- ---------------------------------------------------------------------------
create or replace function public.get_campus_feed(
  p_viewer      uuid,
  p_limit       integer     default 20,
  p_cursor_time timestamptz default null,
  p_cursor_id   uuid        default null
)
  returns setof public.post_item
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_limit      integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_university uuid;
  v_is_demo    boolean;
begin
  select v.university_id, v.is_demo into v_university, v_is_demo
    from public.community_viewer(p_viewer) v;
  if not found then
    return;
  end if;

  return query
  select * from public.post_items_by_ids(p_viewer, array(
    select p.id from public.posts p
     where p.scope = 'campus' and p.parent_post_id is null
       and p.moderation_status = 'active' and p.deleted_at is null
       and p.university_id = v_university and p.is_demo = v_is_demo
       and not exists (select 1 from public.reports r
                        where r.reporter_id = p_viewer and r.target_type = 'post'
                          and r.target_id = p.id)
       and (p.created_at, p.id) < (coalesce(p_cursor_time, 'infinity'::timestamptz),
                                   coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
     order by p.created_at desc, p.id desc
     limit v_limit
  ));
end;
$function$;

create or replace function public.get_country_feed(
  p_viewer       uuid,
  p_country      text,
  p_sort         text             default 'hot',
  p_limit        integer          default 20,
  p_cursor_score double precision default null,
  p_cursor_time  timestamptz      default null,
  p_cursor_id    uuid             default null
)
  returns setof public.post_item
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_limit   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_is_demo boolean;
begin
  select v.is_demo into v_is_demo from public.community_viewer(p_viewer) v;
  if not found then
    return;
  end if;

  if p_sort = 'new' then
    return query
    select * from public.post_items_by_ids(p_viewer, array(
      select p.id from public.posts p
       where p.scope = 'country' and p.parent_post_id is null
         and p.moderation_status = 'active' and p.deleted_at is null
         and p.country_code = p_country and p.is_demo = v_is_demo
         and not exists (select 1 from public.reports r
                          where r.reporter_id = p_viewer and r.target_type = 'post'
                            and r.target_id = p.id)
         and (p.created_at, p.id) < (coalesce(p_cursor_time, 'infinity'::timestamptz),
                                     coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
       order by p.created_at desc, p.id desc
       limit v_limit
    ));
  else
    return query
    select * from public.post_items_by_ids(p_viewer, array(
      select p.id from public.posts p
       where p.scope = 'country' and p.parent_post_id is null
         and p.moderation_status = 'active' and p.deleted_at is null
         and p.country_code = p_country and p.is_demo = v_is_demo
         and not exists (select 1 from public.reports r
                          where r.reporter_id = p_viewer and r.target_type = 'post'
                            and r.target_id = p.id)
         and (p.hot_score, p.id) < (coalesce(p_cursor_score, 'infinity'::double precision),
                                    coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
       order by p.hot_score desc, p.id desc
       limit v_limit
    ));
  end if;
end;
$function$;

create or replace function public.get_global_feed(
  p_viewer       uuid,
  p_sort         text             default 'hot',
  p_limit        integer          default 20,
  p_cursor_score double precision default null,
  p_cursor_time  timestamptz      default null,
  p_cursor_id    uuid             default null
)
  returns setof public.post_item
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_limit   integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_is_demo boolean;
begin
  select v.is_demo into v_is_demo from public.community_viewer(p_viewer) v;
  if not found then
    return;
  end if;

  if p_sort = 'new' then
    return query
    select * from public.post_items_by_ids(p_viewer, array(
      select p.id from public.posts p
       where p.scope = 'global' and p.parent_post_id is null
         and p.moderation_status = 'active' and p.deleted_at is null
         and p.is_demo = v_is_demo
         and not exists (select 1 from public.reports r
                          where r.reporter_id = p_viewer and r.target_type = 'post'
                            and r.target_id = p.id)
         and (p.created_at, p.id) < (coalesce(p_cursor_time, 'infinity'::timestamptz),
                                     coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
       order by p.created_at desc, p.id desc
       limit v_limit
    ));
  else
    return query
    select * from public.post_items_by_ids(p_viewer, array(
      select p.id from public.posts p
       where p.scope = 'global' and p.parent_post_id is null
         and p.moderation_status = 'active' and p.deleted_at is null
         and p.is_demo = v_is_demo
         and not exists (select 1 from public.reports r
                          where r.reporter_id = p_viewer and r.target_type = 'post'
                            and r.target_id = p.id)
         and (p.hot_score, p.id) < (coalesce(p_cursor_score, 'infinity'::double precision),
                                    coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
       order by p.hot_score desc, p.id desc
       limit v_limit
    ));
  end if;
end;
$function$;

create or replace function public.get_user_posts(
  p_viewer      uuid,
  p_author      uuid,
  p_limit       integer     default 20,
  p_cursor_time timestamptz default null,
  p_cursor_id   uuid        default null
)
  returns setof public.post_item
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  return query
  select * from public.post_items_by_ids(p_viewer, array(
    select p.id from public.posts p
     where p.author_id = p_author and p.parent_post_id is null
       and not exists (select 1 from public.reports r
                        where r.reporter_id = p_viewer and r.target_type = 'post'
                          and r.target_id = p.id)
       and (p.created_at, p.id) < (coalesce(p_cursor_time, 'infinity'::timestamptz),
                                   coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
       and public.post_visibility(p_viewer, p.id) = 'visible'
     order by p.created_at desc, p.id desc
     limit v_limit
  ));
end;
$function$;

create or replace function public.count_new_campus_posts(p_viewer uuid, p_since timestamptz)
  returns integer
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_university uuid;
  v_is_demo    boolean;
  v_count      integer;
begin
  select v.university_id, v.is_demo into v_university, v_is_demo
    from public.community_viewer(p_viewer) v;
  if not found then
    return 0;
  end if;

  select count(*) into v_count
    from public.posts p
   where p.scope = 'campus' and p.parent_post_id is null
     and p.moderation_status = 'active' and p.deleted_at is null
     and p.university_id = v_university and p.is_demo = v_is_demo
     and p.created_at > p_since
     and p.author_id <> p_viewer
     and not exists (select 1 from public.reports r
                      where r.reporter_id = p_viewer and r.target_type = 'post'
                        and r.target_id = p.id);

  return v_count;
end;
$function$;

comment on function public.get_campus_feed(uuid, integer, timestamptz, uuid) is
  'The viewer''s campus''s campus posts only, newest first (runbook §1.1, one post, '
  'one feed), minus the ones the viewer reported.';
comment on function public.get_country_feed(uuid, text, text, integer, double precision, timestamptz, uuid) is
  'One country''s country posts, in the viewer''s world, minus the ones the viewer '
  'reported. Anyone may read any country. p_sort is hot (hot_score, id) or new '
  '(created_at, id).';
comment on function public.get_global_feed(uuid, text, integer, double precision, timestamptz, uuid) is
  'Global posts, in the viewer''s world, minus the ones the viewer reported. p_sort '
  'is hot (hot_score, id) or new (created_at, id).';
comment on function public.get_user_posts(uuid, uuid, integer, timestamptz, uuid) is
  'A profile''s Posts tab: the author''s top-level posts this viewer may see and '
  'hasn''t reported, newest first. The author also sees their own held and '
  'covered posts.';
comment on function public.count_new_campus_posts(uuid, timestamptz) is
  'How many posts get_campus_feed would show newer than p_since, leaving out the '
  'viewer''s own (and, like the feed, the ones they reported). Drives the "new '
  'posts" pill.';

-- ---------------------------------------------------------------------------
-- 6. Grants. Only get_post_replies() is new (dropped and re-created); the rest
--    kept theirs through create or replace.
-- ---------------------------------------------------------------------------
revoke execute on function public.get_post_replies(uuid, uuid, integer, timestamptz, uuid, text, double precision)
  from public, anon, authenticated;
grant execute on function public.get_post_replies(uuid, uuid, integer, timestamptz, uuid, text, double precision)
  to service_role;

notify pgrst, 'reload schema';

commit;
