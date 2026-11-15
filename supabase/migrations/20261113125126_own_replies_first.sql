-- own_replies_first — Phase 7, 13 Nov (owner: "keep our replies on top after a
-- reload, as X does").
--
-- A thread in Hot order now puts THE VIEWER'S OWN replies first, newest first,
-- then everyone else's by Hot, as before. Only the viewer's own: each person
-- sees their replies on top of their own screen, nobody else's.
--
-- How, without touching the API: the thread's sort key becomes
--
--     the viewer's reply   1e12 + its created_at in epoch seconds
--     anyone else's        hot_score, as before
--
-- A Hot score is (likes + 1) ÷ (hours + 2)^1.5, far below 1e12, so every own
-- reply sorts above every other, and among themselves by time, newest first.
-- The time is rounded to hundredths of a second, so the key has 15 significant
-- digits: a double turned into jsonb keeps only 15 (jsonb_populate_record
-- below), and with microseconds the key came back larger than itself, so the
-- cursor never moved past the row (checked locally, 13 Nov). Ties are broken
-- by id, as before.
-- get_post_replies() hands that key back in the PostItem's hot_score column,
-- which is what the backend already builds the opaque `value|id` cursor from
-- (buildPage) and strips before anything reaches a client (toPostItem). So the
-- cursor, the controller, backend/API.md's shapes and both clients are
-- unchanged; the key is exact to the millisecond in a double, and the id breaks
-- ties, so paging stays gap-free.
--
-- post_top_replies(), the preview under a post in a feed, is the first 2 of
-- that same order, so your own replies lead the preview too.
--
-- Unchanged: who sees what (visibility, held and covered own replies, reported
-- ones left out), the limit cap, and the 'oldest' branch.

-- ---------------------------------------------------------------------------
-- 1. A thread
-- ---------------------------------------------------------------------------
create or replace function public.get_post_replies(
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
    with page as (
      select p.id, s.k
        from public.posts p
       cross join lateral (
         select case when p.author_id = p_viewer
                     then (1e12 + round(extract(epoch from p.created_at), 2))::double precision
                     else p.hot_score
                end as k
       ) s
       where p.parent_post_id = p_post_id
         and p.deleted_at is null
         and (p.moderation_status = 'active'
              or (p.author_id = p_viewer and p.moderation_status in ('pending', 'under_review')))
         and not exists (select 1 from public.reports r
                          where r.reporter_id = p_viewer and r.target_type = 'post'
                            and r.target_id = p.id)
         and (s.k, p.id) < (coalesce(p_cursor_score, 'infinity'::double precision),
                            coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
       order by s.k desc, p.id desc
       limit v_limit
    )
    -- The key goes back in hot_score: the backend's cursor is built from it.
    select (jsonb_populate_record(i, jsonb_build_object('hot_score', pg.k))).*
      from public.post_items_by_ids(p_viewer, array(select id from page)) i
      join page pg on pg.id = i.id
     order by pg.k desc, pg.id desc;
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
  'any the viewer reported. p_sort hot: the viewer''s own replies first, newest '
  'first, then the rest by (hot_score, id) descending; the sort key comes back '
  'in hot_score for the cursor (migration own_replies_first). oldest: '
  '(created_at, id), kept only for the backend deployed before migration '
  'reply_hot_order_hide_reported. Nothing at all unless the viewer may see the post.';

-- ---------------------------------------------------------------------------
-- 2. The preview: the first 2 of that thread
-- ---------------------------------------------------------------------------
create or replace function public.post_top_replies(p_viewer uuid, p_post_id uuid)
  returns jsonb
  language sql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
  with page as (
    select p.id,
           case when p.author_id = p_viewer
                then (1e12 + round(extract(epoch from p.created_at), 2))::double precision
                else p.hot_score
           end as k
      from public.posts p
     where p.parent_post_id = p_post_id
       and p.deleted_at is null
       and (p.moderation_status = 'active'
            or (p.author_id = p_viewer and p.moderation_status in ('pending', 'under_review')))
       and not exists (select 1 from public.reports r
                        where r.reporter_id = p_viewer and r.target_type = 'post'
                          and r.target_id = p.id)
     order by k desc, p.id desc
     limit 2
  )
  select coalesce(
    jsonb_agg(to_jsonb(r) - 'hot_score' order by pg.k desc, pg.id desc),
    '[]'::jsonb)
  from public.post_items_by_ids(p_viewer, array(select id from page)) r
  join page pg on pg.id = r.id;
$function$;

comment on function public.post_top_replies(uuid, uuid) is
  'Internal: the first 2 replies of get_post_replies(p_sort => ''hot'') for this '
  'viewer (their own first, newest first, then Hot), as reply PostItems (JSON, '
  'hot_score removed). It does not check that the viewer may see the post '
  'itself, so it must never be reached directly from a route.';
