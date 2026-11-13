-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 7 · Block V-C (added after V-P) — top_replies on every PostItem
--
-- Each post in a feed shows its best replies under it, with a curved thread
-- (COMMUNITY_SPEC.md §4). So every PostItem now carries top_replies: up to 2
-- reply PostItems (REPLY_PREVIEW_COUNT on the clients), most liked first, oldest
-- first when tied. A reply's own top_replies is always [] (one level only).
--
-- top_replies shows exactly what get_post_replies() would show this viewer:
-- active replies, plus the viewer's own held (pending) or covered (under_review)
-- ones, never a deleted one. The parent itself is already visible, because
-- post_items_by_ids() is only ever reached through a function that checked that.
--
--   1. post_item gains top_replies jsonb (last attribute, after hot_score)
--   2. post_top_replies(): the 2 best replies of one post, as JSON
--   3. post_items_by_ids() fills the new attribute
--
-- Every read function builds its rows with "select * from post_items_by_ids()",
-- so all seven (three feeds, the post, its replies, a profile's Posts tab) gain
-- the field with no change of their own. The backend passes every column except
-- hot_score through (toPostItem), and the nested replies have hot_score removed
-- here, so no controller change is needed.
--
-- Backward compatible: a new field only; old clients ignore it.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ---------------------------------------------------------------------------
-- 1. The new attribute
-- ---------------------------------------------------------------------------
alter type public.post_item add attribute top_replies jsonb;

comment on type public.post_item is
  'The PostItem of runbook Appendix A, flat, plus hot_score, plus top_replies (up '
  'to 2 reply PostItems as JSON; [] on a reply). Every feed, reply list and '
  'profile list returns exactly this.';

-- ---------------------------------------------------------------------------
-- 2. A post's best replies
--
-- "Most liked" is reactions_total: a reply can only be liked (spec §4).
-- posts_replies_idx (parent_post_id, created_at, id) finds the thread; the sort
-- is over that one thread's replies, so it stays small.
-- ---------------------------------------------------------------------------
create function public.post_top_replies(p_viewer uuid, p_post_id uuid)
  returns jsonb
  language sql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
  select coalesce(
    jsonb_agg(to_jsonb(r) - 'hot_score'
              order by r.reactions_total desc, r.created_at, r.id),
    '[]'::jsonb)
  from public.post_items_by_ids(p_viewer, array(
    select p.id from public.posts p
     where p.parent_post_id = p_post_id
       and p.deleted_at is null
       and (p.moderation_status = 'active'
            or (p.author_id = p_viewer and p.moderation_status in ('pending', 'under_review')))
     order by p.reactions_total desc, p.created_at, p.id
     limit 2
  )) r;
$function$;

comment on function public.post_top_replies(uuid, uuid) is
  'Internal: up to 2 replies of one post as reply PostItems (JSON, hot_score '
  'removed), most liked first, oldest first when tied. The same replies '
  'get_post_replies() shows the viewer. It does not check that the viewer may '
  'see the post itself, so it must never be reached directly from a route.';

-- ---------------------------------------------------------------------------
-- 3. post_items_by_ids() fills it
--
-- Only a top-level post asks for its replies. A reply gets [] without a call,
-- so the recursion (post_top_replies calls back into this function for the
-- replies) is exactly one level deep.
-- ---------------------------------------------------------------------------
create or replace function public.post_items_by_ids(p_viewer uuid, p_ids uuid[])
  returns setof public.post_item
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
begin
  return query
  select
    p.id, p.parent_post_id, p.scope, p.country_code, p.content, p.image_urls, p.gif,
    p.created_at, p.reactions_total, p.reaction_counts, p.replies_count,
    (select r.emoji from public.post_reactions r
      where r.post_id = p.id and r.user_id = p_viewer),
    p.moderation_status,
    (p.moderation_support and p.author_id = p_viewer and p.moderation_status = 'pending'),
    p.author_id,
    u.username,
    u.full_name::text,
    u.avatar_url,
    un.name::text,
    (p.author_id = p_viewer),
    p.hot_score,
    -- Not short-cut on replies_count = 0: that counts only active replies, and
    -- the viewer's own held reply must still show, as in get_post_replies().
    case
      when p.parent_post_id is not null then '[]'::jsonb
      else public.post_top_replies(p_viewer, p.id)
    end
  from unnest(p_ids) with ordinality as wanted(post_id, position)
  join public.posts p         on p.id = wanted.post_id
  join public.users u         on u.id = p.author_id
  join public.universities un on un.id = p.university_id
  order by wanted.position;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Grants: the backend's service-role key is the only caller
-- ---------------------------------------------------------------------------
revoke execute on function public.post_top_replies(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.post_items_by_ids(uuid, uuid[]) from public, anon, authenticated;

-- The API reads these functions' return shape; make it see the new attribute.
notify pgrst, 'reload schema';

commit;
