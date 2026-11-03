-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 7 · Block V-B · Migration 1 of 4 — the community: posts and feeds
--
-- What this adds, and why it lives in the database (runbook §1.1–§1.5):
--
--   1. universities.country_code   every campus now belongs to a country.
--   2. public.posts, reworked      one table for posts and replies, with a
--                                  scope, media, counters and moderation state.
--   3. public.community_settings   the rate limits and report thresholds, as
--                                  rows, so Phase 9 only has to change numbers.
--   4. A BEFORE INSERT trigger     fills the campus, country and world, checks
--                                  who may reply, and applies the rate limits.
--   5. replies_count triggers      the parent's count of VISIBLE replies.
--   6. post_visibility + helpers   the one statement of who may see what.
--   7. Read functions              every feed returns the same PostItem.
--   8. refresh_hot_scores + cron   the stored Hot score, every 5 minutes.
--
-- Error names (mapped to HTTP by utils/respond.js):
--   POST_NOT_FOUND             the parent is missing, deleted or not active
--   NESTED_REPLY_NOT_ALLOWED   the parent is itself a reply
--   NOT_ALLOWED_HERE           you may read this feed but not post or reply in it
--   RATE_LIMIT_POSTS           too many top-level posts in this feed in an hour
--   RATE_LIMIT_REPLIES         too many replies in an hour
--
-- Who runs what: the backend, on the service_role key, is the only caller.
-- Everything is SECURITY INVOKER except sync_replies_count(), which says why.
--
-- post_reactions arrives in the NEXT migration. post_items_by_ids() reads it,
-- which is why that function is plpgsql: plpgsql bodies are not resolved until
-- they run. All four Phase 7 migrations are pushed together.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ---------------------------------------------------------------------------
-- 1. universities.country_code
-- ---------------------------------------------------------------------------
alter table public.universities
  add column country_code char(2) not null default 'IN',
  add constraint universities_country_code_format check (country_code ~ '^[A-Z]{2}$');

comment on column public.universities.country_code is
  'ISO 3166-1 alpha-2 country of this campus. Decides which country feed its '
  'students may post in (runbook §1.1). The default is IN because every campus '
  'that existed before Phase 7 is in India, including the demo campus.';

-- ---------------------------------------------------------------------------
-- 2. public.posts — no code uses it yet. Existing rows are kept and converted:
--    seedDemo.js may have written persona posts to it, so "probably empty" is
--    not something this file may assume.
-- ---------------------------------------------------------------------------
alter table public.posts
  alter column content type text,
  alter column content set default '',
  add column image_urls                text[]           not null default '{}',
  add column scope                     text             not null default 'campus',
  add column country_code              char(2),
  add column parent_post_id            uuid             references public.posts(id) on delete cascade,
  add column gif                       jsonb,
  add column is_demo                   boolean          not null default false,
  add column reactions_total           integer          not null default 0,
  add column reaction_counts           jsonb            not null default '{}',
  add column replies_count             integer          not null default 0,
  add column hot_score                 double precision not null default 0,
  add column moderation_status         text             not null default 'active',
  add column moderation_flagged        boolean          not null default false,
  add column moderation_support        boolean          not null default false,
  add column moderation_photo_failures integer          not null default 0,
  add column moderation_scores         jsonb,
  add column moderation_checked_at     timestamptz,
  add column report_count              integer          not null default 0,
  add column deleted_at                timestamptz;

-- Converting the rows that already exist. A row with no author cannot be
-- converted, and the NOT NULL below then fails the whole migration, loudly and
-- with nothing applied. That is deliberate: this file does not delete data.
update public.posts
   set image_urls = array[image_url]
 where image_url is not null and image_url <> '';

update public.posts p
   set university_id = u.university_id
  from public.users u
 where u.id = p.author_id and p.university_id is null;

update public.posts p
   set is_demo = un.is_demo, country_code = un.country_code
  from public.universities un
 where un.id = p.university_id;

update public.posts set created_at = now() where created_at is null;

alter table public.posts drop column image_url;

-- Both foreign keys (on delete cascade) already exist, from remote_schema.
alter table public.posts
  alter column author_id     set not null,
  alter column university_id set not null,
  alter column created_at    set not null,
  alter column created_at    set default now();

alter table public.posts
  add constraint posts_content_length      check (char_length(content) <= 1000),
  add constraint posts_scope_valid         check (scope in ('campus', 'country', 'global')),
  add constraint posts_country_code_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add constraint posts_moderation_status_valid
    check (moderation_status in ('active', 'pending', 'under_review', 'removed')),
  add constraint posts_at_most_3_photos    check (cardinality(image_urls) <= 3),
  add constraint posts_photos_or_gif       check (cardinality(image_urls) = 0 or gif is null),
  add constraint posts_reply_has_no_photos check (parent_post_id is null or cardinality(image_urls) = 0),
  add constraint posts_not_empty
    check (btrim(content) <> '' or cardinality(image_urls) > 0 or gif is not null),
  -- "is not distinct from", not "=": a missing key gives NULL, and a CHECK that
  -- comes out NULL passes.
  add constraint posts_gif_shape check (
    gif is null or (
          jsonb_typeof(gif)               =                    'object'
      and jsonb_typeof(gif -> 'provider') is not distinct from 'string'
      and jsonb_typeof(gif -> 'id')       is not distinct from 'string'
      and jsonb_typeof(gif -> 'url')      is not distinct from 'string'
    )
  );

comment on table public.posts is
  'Community posts and their replies. A reply is a post with a parent, and '
  'replies go one level deep only (runbook §1.2). Backend-only: RLS on, no '
  'policies, no grants to anon or authenticated.';
comment on column public.posts.content is
  'The text, at most 1,000 code points (char_length, runbook §1.12). Empty when '
  'the post is only photos or a GIF.';
comment on column public.posts.image_urls is
  'Up to 3 photo URLs in the posts bucket, in display order. Replies have none.';
comment on column public.posts.scope is
  'campus, country or global: the one feed this post appears in. A reply '
  'inherits its parent''s scope.';
comment on column public.posts.country_code is
  'Set by trg_prepare_post: the author''s country on a top-level post, the '
  'parent''s on a reply. Only the country feed reads it.';
comment on column public.posts.parent_post_id is
  'The post this one replies to. NULL = a top-level post.';
comment on column public.posts.gif is
  'A KLIPY GIF description, {provider, id, url, preview_url, width, height}. '
  'The GIF itself stays on KLIPY (runbook §1.9). Never together with photos.';
comment on column public.posts.is_demo is
  'Copied from the author''s campus by trg_prepare_post. Real and demo accounts '
  'live in two worlds that never see each other (runbook §1.11).';
comment on column public.posts.reactions_total is
  'How many people reacted. Kept by a trigger on post_reactions; never written '
  'by the backend.';
comment on column public.posts.reaction_counts is
  'People per emoji, for example {"❤️": 3}. Kept by a trigger on post_reactions.';
comment on column public.posts.replies_count is
  'The number of visible replies (active and not deleted). Kept by '
  'trg_sync_replies_count; never below 0.';
comment on column public.posts.hot_score is
  'The stored Hot score (runbook §1.3). Set on insert, then refreshed every 5 '
  'minutes for 7 days. Only the country and global feeds rank by it.';
comment on column public.posts.moderation_status is
  'active = public. pending = held by moderation, only the author sees it. '
  'under_review = covered by reports, only the author sees it. removed = taken '
  'down.';
comment on column public.posts.moderation_flagged is
  'The moderation check nudged and the post was published anyway: look at it '
  'first in the Phase 9 review.';
comment on column public.posts.moderation_support is
  'Held because of self-harm: while it is held, the author sees the support card '
  'with helplines under this post.';
comment on column public.posts.moderation_photo_failures is
  'Re-check runs where a photo could not be fetched or read. At 6 the job stops '
  'picking this post up, so missing photos cannot block the queue. An OpenAI '
  'outage does not count. Not part of the PostItem.';
comment on column public.posts.moderation_scores is
  'The moderation service''s scores, {text, images: [...]}, for the Phase 9 review.';
comment on column public.posts.moderation_checked_at is
  'When a moderation check last answered. NULL on a pending post means the check '
  'could not run, which is what the re-check job looks for.';
comment on column public.posts.report_count is
  'Distinct people who ever reported this post, whatever the outcome. The cover '
  'rules do not read it: they count open reports only (runbook §1.7).';
comment on column public.posts.deleted_at is
  'Set when the author deletes the post. It disappears at once, and the backend '
  'removes the row and its photos after 90 days (runbook §1.8).';

-- Indexes. Each feed reads its index in order and stops at the page size, so a
-- page costs the same at ten thousand posts as at ten million (runbook §1.1).
create index posts_feed_campus_new_idx
  on public.posts (university_id, created_at desc, id desc)
  where scope = 'campus' and parent_post_id is null
    and moderation_status = 'active' and deleted_at is null;

create index posts_feed_country_new_idx
  on public.posts (country_code, is_demo, created_at desc, id desc)
  where scope = 'country' and parent_post_id is null
    and moderation_status = 'active' and deleted_at is null;

create index posts_feed_country_hot_idx
  on public.posts (country_code, is_demo, hot_score desc, id desc)
  where scope = 'country' and parent_post_id is null
    and moderation_status = 'active' and deleted_at is null;

create index posts_feed_global_new_idx
  on public.posts (is_demo, created_at desc, id desc)
  where scope = 'global' and parent_post_id is null
    and moderation_status = 'active' and deleted_at is null;

create index posts_feed_global_hot_idx
  on public.posts (is_demo, hot_score desc, id desc)
  where scope = 'global' and parent_post_id is null
    and moderation_status = 'active' and deleted_at is null;

-- A thread, oldest first. Includes hidden replies: the author still sees theirs.
create index posts_replies_idx
  on public.posts (parent_post_id, created_at, id)
  where parent_post_id is not null;

-- A profile's Posts tab, and the rate-limit count for top-level posts.
create index posts_author_top_level_idx
  on public.posts (author_id, created_at desc, id desc)
  where parent_post_id is null;

-- The rate-limit count for replies.
create index posts_author_replies_idx
  on public.posts (author_id, created_at desc)
  where parent_post_id is not null;

-- refresh_hot_scores(): only ranked posts from the last 7 days.
create index posts_hot_refresh_idx
  on public.posts (created_at)
  where scope in ('country', 'global') and parent_post_id is null
    and moderation_status = 'active' and deleted_at is null;

-- The two backend jobs of Block V-C: the 10-minute re-check, and the daily purge.
create index posts_recheck_queue_idx
  on public.posts (created_at)
  where moderation_status = 'pending' and moderation_checked_at is null;

create index posts_deleted_at_idx
  on public.posts (deleted_at)
  where deleted_at is not null;

alter table public.posts enable row level security;
revoke all on public.posts from anon, authenticated;
grant select, insert, update, delete on public.posts to service_role;

-- ---------------------------------------------------------------------------
-- 3. public.community_settings
-- ---------------------------------------------------------------------------
create table public.community_settings (
  key         text        primary key,
  value       integer     not null check (value > 0),
  description text        not null,
  updated_at  timestamptz not null default now()
);

comment on table public.community_settings is
  'The numbers the Phase 9 admin page will tune: rate limits and report '
  'thresholds. Until that page exists, change a row with a one-line migration '
  '(runbook §1.5). Backend-only.';
comment on column public.community_settings.key is
  'The setting''s name, as read by community_setting().';
comment on column public.community_settings.value is
  'The number. Read on every use, so a change applies to the very next post.';
comment on column public.community_settings.description is
  'What the number controls, in one line, for the admin page.';
comment on column public.community_settings.updated_at is
  'When the row was created. Phase 9''s admin page will set it on each change.';

insert into public.community_settings (key, value, description) values
  ('rate_limit_campus_posts_per_hour',     15, 'Top-level posts one person may make in their campus feed in any 60 minutes.'),
  ('rate_limit_country_posts_per_hour',     8, 'Top-level posts one person may make in their country feed in any 60 minutes.'),
  ('rate_limit_global_posts_per_hour',      8, 'Top-level posts one person may make in the Global feed in any 60 minutes.'),
  ('rate_limit_replies_per_hour',          45, 'Replies one person may make, in any feed, in any 60 minutes.'),
  ('report_threshold_child_safety',         2, 'Open child-safety reports that cover a text-only post.'),
  ('report_threshold_child_safety_photo',   1, 'Open child-safety reports that cover a post with photos: covered at once.'),
  ('report_threshold_serious',              3, 'Open sexual-content, violence and self-harm reports, together, that cover a post.'),
  ('report_threshold_other_campus',         5, 'Open reports for other reasons, from its audience, that cover a campus post.'),
  ('report_threshold_other_wide',          10, 'Open reports for other reasons, from its audience, that cover a country or Global post.');

alter table public.community_settings enable row level security;
revoke all on public.community_settings from anon, authenticated;
grant select on public.community_settings to service_role;

create function public.community_setting(p_key text, p_default integer)
  returns integer
  language sql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
  select coalesce(
    (select s.value from public.community_settings s where s.key = p_key),
    p_default
  );
$function$;

comment on function public.community_setting(text, integer) is
  'A row''s value from community_settings, or p_default when the row is missing, '
  'so a deleted row can never stop posting.';

-- ---------------------------------------------------------------------------
-- 4. Shared pieces, then the BEFORE INSERT trigger
-- ---------------------------------------------------------------------------

create function public.post_hot_score(p_reactions integer, p_replies integer, p_age_hours double precision)
  returns double precision
  language sql
  immutable
  security invoker
  set search_path = public, pg_temp
as $function$
  -- Rounded because the score is also the Hot cursor. Postgres can send a float
  -- as JSON with only 15 significant digits. An unrounded score then comes back
  -- slightly different from the row it came from, the cursor no longer lands
  -- after that row, and the same row is returned on every page, for ever.
  -- 9 decimal places fit in 15 digits for any score below a million.
  select round(
    ((p_reactions + 2 * p_replies + 1)::double precision
     / power(greatest(p_age_hours, 0) + 2, 1.5))::numeric,
    9
  )::double precision;
$function$;

comment on function public.post_hot_score(integer, integer, double precision) is
  'The Hot formula of runbook §1.3: (reactions + 2 × replies + 1) ÷ (hours + 2)^1.5, '
  'rounded to 9 decimal places so the value survives the JSON round trip as a cursor.';

create function public.community_viewer(p_user uuid)
  returns table (university_id uuid, country_code char(2), is_demo boolean)
  language sql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
  select u.university_id, un.country_code, un.is_demo
    from public.users u
    join public.universities un on un.id = u.university_id
   where u.id = p_user;
$function$;

comment on function public.community_viewer(uuid) is
  'A person''s campus, country and world. No row for an unknown user or one with '
  'no campus, and every caller treats that as "may do nothing" (fail closed, the '
  'same rule as search_users).';

create function public.post_reply_refusal(p_user uuid, p_parent_id uuid)
  returns text
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_parent     public.posts;
  v_university uuid;
  v_country    char(2);
  v_is_demo    boolean;
begin
  select * into v_parent from public.posts p where p.id = p_parent_id;

  if not found or v_parent.deleted_at is not null or v_parent.moderation_status <> 'active' then
    return 'POST_NOT_FOUND';
  end if;

  if v_parent.parent_post_id is not null then
    return 'NESTED_REPLY_NOT_ALLOWED';
  end if;

  select v.university_id, v.country_code, v.is_demo
    into v_university, v_country, v_is_demo
    from public.community_viewer(p_user) v;

  if not found or v_is_demo <> v_parent.is_demo then
    return 'NOT_ALLOWED_HERE';
  end if;

  if (v_parent.scope = 'campus'  and v_university <> v_parent.university_id)
  or (v_parent.scope = 'country' and v_country    <> v_parent.country_code) then
    return 'NOT_ALLOWED_HERE';
  end if;

  return null;
end;
$function$;

comment on function public.post_reply_refusal(uuid, uuid) is
  'The one statement of who may reply: the error name that would refuse this '
  'reply, or NULL when it is allowed. trg_prepare_post raises it and '
  'can_reply_to_post() reports it, so the two can never disagree.';

create function public.prepare_post()
  returns trigger
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_university uuid;
  v_country    char(2);
  v_is_demo    boolean;
  v_refusal    text;
  v_used       integer;
  v_limit      integer;
begin
  select v.university_id, v.country_code, v.is_demo
    into v_university, v_country, v_is_demo
    from public.community_viewer(new.author_id) v;

  if not found then
    raise exception 'NOT_ALLOWED_HERE' using errcode = 'P0001';
  end if;

  -- Never the caller's to choose.
  new.university_id := v_university;
  new.is_demo       := v_is_demo;

  if new.parent_post_id is null then
    -- A country post can only go to your own country (runbook §1.1).
    new.country_code := v_country;
  else
    v_refusal := public.post_reply_refusal(new.author_id, new.parent_post_id);
    if v_refusal is not null then
      raise exception '%', v_refusal using errcode = 'P0001';
    end if;

    select p.scope, p.country_code
      into new.scope, new.country_code
      from public.posts p
     where p.id = new.parent_post_id;
  end if;

  -- Rate limits (runbook §1.5). Deleted rows count, so deleting and re-posting
  -- does not help. The lock makes two simultaneous posts by one person take
  -- turns: without it, both could count 14 and both go through.
  perform pg_advisory_xact_lock(hashtextextended('post_rate_limit:' || new.author_id::text, 0));

  if new.parent_post_id is not null then
    select count(*) into v_used
      from public.posts p
     where p.author_id = new.author_id
       and p.parent_post_id is not null
       and p.created_at > now() - interval '1 hour';

    if v_used >= public.community_setting('rate_limit_replies_per_hour', 45) then
      raise exception 'RATE_LIMIT_REPLIES' using errcode = 'P0001';
    end if;
  else
    v_limit := case new.scope
      when 'campus'  then public.community_setting('rate_limit_campus_posts_per_hour', 15)
      when 'country' then public.community_setting('rate_limit_country_posts_per_hour', 8)
      when 'global'  then public.community_setting('rate_limit_global_posts_per_hour', 8)
    end;

    select count(*) into v_used
      from public.posts p
     where p.author_id = new.author_id
       and p.parent_post_id is null
       and p.scope = new.scope
       and p.created_at > now() - interval '1 hour';

    if v_used >= v_limit then
      raise exception 'RATE_LIMIT_POSTS' using errcode = 'P0001';
    end if;

    -- No reactions, no replies, age 0: so a new post enters Hot at once.
    new.hot_score := public.post_hot_score(0, 0, 0);
  end if;

  return new;
end;
$function$;

comment on function public.prepare_post() is
  'BEFORE INSERT on posts: fills the campus, country and world, inherits scope '
  'on replies, checks who may reply, applies the rate limits and sets the first '
  'Hot score.';

create trigger trg_prepare_post
  before insert on public.posts
  for each row execute function public.prepare_post();

-- ---------------------------------------------------------------------------
-- 5. replies_count
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER, for the reason in migration 011: deleting an account cascades
-- from auth.users into posts, and GoTrue issues that delete as
-- supabase_auth_admin, which has no grants on public tables. As SECURITY INVOKER
-- this UPDATE would fail with 42501 and the student could not delete their
-- account. The pinned search_path is what makes DEFINER safe.
create function public.sync_replies_count()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $function$
declare
  v_parent uuid;
  v_was    integer := 0;
  v_is     integer := 0;
begin
  if tg_op <> 'INSERT' and old.moderation_status = 'active' and old.deleted_at is null then
    v_was := 1;
  end if;
  if tg_op <> 'DELETE' and new.moderation_status = 'active' and new.deleted_at is null then
    v_is := 1;
  end if;

  v_parent := case when tg_op = 'DELETE' then old.parent_post_id else new.parent_post_id end;

  if v_parent is not null and v_is <> v_was then
    update public.posts p
       set replies_count = greatest(p.replies_count + v_is - v_was, 0)
     where p.id = v_parent;
  end if;

  return null;
end;
$function$;

comment on function public.sync_replies_count() is
  'Keeps the parent''s replies_count equal to its visible replies. SECURITY '
  'DEFINER because an account deletion reaches it as supabase_auth_admin.';

create trigger trg_sync_replies_count
  after insert or delete or update of deleted_at, moderation_status on public.posts
  for each row execute function public.sync_replies_count();

-- ---------------------------------------------------------------------------
-- 6. Who may see what
-- ---------------------------------------------------------------------------
create function public.post_visibility(p_viewer uuid, p_post_id uuid)
  returns text
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_post       public.posts;
  v_university uuid;
  v_is_demo    boolean;
  v_parent     text;
begin
  select * into v_post from public.posts p where p.id = p_post_id;
  if not found then
    return 'not_found';
  end if;

  select v.university_id, v.is_demo
    into v_university, v_is_demo
    from public.community_viewer(p_viewer) v;

  if not found
     or v_is_demo <> v_post.is_demo
     or (v_post.scope = 'campus' and v_university <> v_post.university_id) then
    return 'not_found';
  end if;

  if v_post.deleted_at is not null then
    return 'deleted';
  end if;
  if v_post.moderation_status = 'removed' then
    return 'removed';
  end if;

  -- A reply goes with its parent: deleting a post takes its replies with it
  -- (runbook §1.8), and a covered post's thread is covered too (§1.7).
  if v_post.parent_post_id is not null then
    v_parent := public.post_visibility(p_viewer, v_post.parent_post_id);
    if v_parent <> 'visible' then
      return v_parent;
    end if;
  end if;

  if v_post.moderation_status = 'pending' then
    return case when v_post.author_id = p_viewer then 'visible' else 'not_found' end;
  end if;
  if v_post.moderation_status = 'under_review' then
    return case when v_post.author_id = p_viewer then 'visible' else 'under_review' end;
  end if;

  return 'visible';
end;
$function$;

comment on function public.post_visibility(uuid, uuid) is
  'One of visible, under_review, not_found, deleted, removed. The one statement '
  'of who may see a post: every read and every reaction or report asks this.';

create function public.can_reply_to_post(p_viewer uuid, p_post_id uuid)
  returns boolean
  language sql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
  select public.post_reply_refusal(p_viewer, p_post_id) is null;
$function$;

comment on function public.can_reply_to_post(uuid, uuid) is
  'Would trg_prepare_post accept a reply from this person? False for pending and '
  'under-review posts. Same rules as the trigger: both use post_reply_refusal().';

create function public.can_post_in_feed(p_viewer uuid, p_scope text, p_country text default null)
  returns boolean
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_country char(2);
begin
  select v.country_code into v_country from public.community_viewer(p_viewer) v;
  if not found then
    return false;
  end if;

  return case p_scope
    when 'campus'  then true
    when 'global'  then true
    when 'country' then coalesce(v_country = p_country, false)
    else false
  end;
end;
$function$;

comment on function public.can_post_in_feed(uuid, text, text) is
  'Campus and Global: yes. Country: only your own country. Matches what '
  'trg_prepare_post does, which always posts to the author''s own country.';

-- ---------------------------------------------------------------------------
-- 7. Read functions. Every one returns public.post_item: Appendix A's PostItem,
--    plus hot_score for building cursors (the backend removes it from the answer).
--
--    Each list picks its ids in one indexed query, then post_items_by_ids() adds
--    the author and the viewer's reaction in that order. So the PostItem is
--    written exactly once.
--
--    Cursors: "(a, b) < (coalesce(cursor, +infinity), ...)" rather than "cursor
--    is null or ...", because an OR would stop a cached plan from starting the
--    index scan at the cursor, and a deep page would walk every row before it.
-- ---------------------------------------------------------------------------
create type public.post_item as (
  id                 uuid,
  parent_post_id     uuid,
  scope              text,
  country_code       char(2),
  content            text,
  image_urls         text[],
  gif                jsonb,
  created_at         timestamptz,
  reactions_total    integer,
  reaction_counts    jsonb,
  replies_count      integer,
  viewer_reaction    text,
  moderation_status  text,
  moderation_support boolean,
  author_id          uuid,
  author_username    text,
  author_name        text,
  author_avatar      text,
  author_university  text,
  is_mine            boolean,
  hot_score          double precision
);

comment on type public.post_item is
  'The PostItem of runbook Appendix A, flat, plus hot_score. Every feed, reply '
  'list and profile list returns exactly this.';

create function public.post_items_by_ids(p_viewer uuid, p_ids uuid[])
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
    p.hot_score
  from unnest(p_ids) with ordinality as wanted(post_id, position)
  join public.posts p         on p.id = wanted.post_id
  join public.users u         on u.id = p.author_id
  join public.universities un on un.id = p.university_id
  order by wanted.position;
end;
$function$;

comment on function public.post_items_by_ids(uuid, uuid[]) is
  'Internal: builds PostItems for ids a list function has already chosen, keeping '
  'their order. It checks no permissions, so it must never be reached directly '
  'from a route.';

create function public.get_campus_feed(
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
       and (p.created_at, p.id) < (coalesce(p_cursor_time, 'infinity'::timestamptz),
                                   coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
     order by p.created_at desc, p.id desc
     limit v_limit
  ));
end;
$function$;

comment on function public.get_campus_feed(uuid, integer, timestamptz, uuid) is
  'The viewer''s campus''s campus posts only, newest first (runbook §1.1, one post, '
  'one feed).';

create function public.get_country_feed(
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
         and (p.hot_score, p.id) < (coalesce(p_cursor_score, 'infinity'::double precision),
                                    coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
       order by p.hot_score desc, p.id desc
       limit v_limit
    ));
  end if;
end;
$function$;

comment on function public.get_country_feed(uuid, text, text, integer, double precision, timestamptz, uuid) is
  'One country''s country posts, in the viewer''s world. Anyone may read any '
  'country. p_sort is hot (hot_score, id) or new (created_at, id).';

create function public.get_global_feed(
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
         and (p.hot_score, p.id) < (coalesce(p_cursor_score, 'infinity'::double precision),
                                    coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
       order by p.hot_score desc, p.id desc
       limit v_limit
    ));
  end if;
end;
$function$;

comment on function public.get_global_feed(uuid, text, integer, double precision, timestamptz, uuid) is
  'Global posts, in the viewer''s world. p_sort is hot (hot_score, id) or new '
  '(created_at, id).';

create function public.get_post_item(p_viewer uuid, p_post_id uuid)
  returns setof public.post_item
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
begin
  if public.post_visibility(p_viewer, p_post_id) = 'visible' then
    return query select * from public.post_items_by_ids(p_viewer, array[p_post_id]);
  end if;
end;
$function$;

comment on function public.get_post_item(uuid, uuid) is
  'One row when post_visibility says visible, otherwise none. A covered post''s '
  'text never leaves the database for anyone but its author (runbook §1.7).';

create function public.get_post_replies(
  p_viewer      uuid,
  p_post_id     uuid,
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
  -- Without this, anyone could read another campus's thread, or a covered or
  -- deleted post's thread, by asking for its replies directly.
  if public.post_visibility(p_viewer, p_post_id) <> 'visible' then
    return;
  end if;

  return query
  select * from public.post_items_by_ids(p_viewer, array(
    select p.id from public.posts p
     where p.parent_post_id = p_post_id
       and p.deleted_at is null
       and (p.moderation_status = 'active'
            or (p.author_id = p_viewer and p.moderation_status in ('pending', 'under_review')))
       and (p.created_at, p.id) > (coalesce(p_cursor_time, '-infinity'::timestamptz),
                                   coalesce(p_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid))
     order by p.created_at, p.id
     limit v_limit
  ));
end;
$function$;

comment on function public.get_post_replies(uuid, uuid, integer, timestamptz, uuid) is
  'A post''s active replies, oldest first, plus the viewer''s own held or covered '
  'ones. Nothing at all unless the viewer may see the post itself.';

create function public.get_user_posts(
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
       and (p.created_at, p.id) < (coalesce(p_cursor_time, 'infinity'::timestamptz),
                                   coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
       and public.post_visibility(p_viewer, p.id) = 'visible'
     order by p.created_at desc, p.id desc
     limit v_limit
  ));
end;
$function$;

comment on function public.get_user_posts(uuid, uuid, integer, timestamptz, uuid) is
  'A profile''s Posts tab: the author''s top-level posts this viewer may see, '
  'newest first. The author also sees their own held and covered posts.';

create function public.count_new_campus_posts(p_viewer uuid, p_since timestamptz)
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
     and p.author_id <> p_viewer;

  return v_count;
end;
$function$;

comment on function public.count_new_campus_posts(uuid, timestamptz) is
  'How many posts get_campus_feed would show newer than p_since, leaving out the '
  'viewer''s own. Drives the "new posts" pill.';

create function public.countries_for_viewer(p_viewer uuid)
  returns table (country_code char(2), is_mine boolean)
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_country char(2);
  v_is_demo boolean;
begin
  select v.country_code, v.is_demo into v_country, v_is_demo
    from public.community_viewer(p_viewer) v;
  if not found then
    return;
  end if;

  return query
  select distinct un.country_code, (un.country_code = v_country)
    from public.universities un
   where (v_is_demo and un.is_demo)
      or (not v_is_demo and not un.is_demo and un.is_active);
end;
$function$;

comment on function public.countries_for_viewer(uuid) is
  'The countries a viewer can open: those of active campuses for a real student, '
  'the demo campus''s for a demo account.';

-- ---------------------------------------------------------------------------
-- 8. The Hot score, every 5 minutes. pg_cron rather than the backend's timer
--    because a sleeping Render server's timer does not fire (runbook §1.3).
-- ---------------------------------------------------------------------------
create function public.refresh_hot_scores()
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
$function$;

comment on function public.refresh_hot_scores() is
  'Recalculates hot_score for active top-level country and global posts from the '
  'last 7 days. Older posts keep their last score and sink naturally.';

-- Supabase's documented form. pg_catalog is where it wants the extension's
-- functions; the job tables live in the cron schema either way.
create extension if not exists pg_cron with schema pg_catalog;

-- Safe to run twice: removes a job of the same name first, and does nothing if
-- there isn't one (cron.unschedule by name raises if the job is missing).
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'refresh-hot-scores';
select cron.schedule('refresh-hot-scores', '*/5 * * * *', 'select public.refresh_hot_scores()');

-- ---------------------------------------------------------------------------
-- 9. Who may run these: the backend only. Trigger functions can't be called
--    directly, so they only lose the default grant.
-- ---------------------------------------------------------------------------
revoke execute on function public.prepare_post()                                   from public, anon, authenticated;
revoke execute on function public.sync_replies_count()                             from public, anon, authenticated;

revoke execute on function public.community_setting(text, integer)                 from public, anon, authenticated;
revoke execute on function public.post_hot_score(integer, integer, double precision) from public, anon, authenticated;
revoke execute on function public.community_viewer(uuid)                           from public, anon, authenticated;
revoke execute on function public.post_reply_refusal(uuid, uuid)                   from public, anon, authenticated;
revoke execute on function public.post_visibility(uuid, uuid)                      from public, anon, authenticated;
revoke execute on function public.can_reply_to_post(uuid, uuid)                    from public, anon, authenticated;
revoke execute on function public.can_post_in_feed(uuid, text, text)               from public, anon, authenticated;
revoke execute on function public.post_items_by_ids(uuid, uuid[])                  from public, anon, authenticated;
revoke execute on function public.get_campus_feed(uuid, integer, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.get_country_feed(uuid, text, text, integer, double precision, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.get_global_feed(uuid, text, integer, double precision, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.get_post_item(uuid, uuid)                        from public, anon, authenticated;
revoke execute on function public.get_post_replies(uuid, uuid, integer, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.get_user_posts(uuid, uuid, integer, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.count_new_campus_posts(uuid, timestamptz)        from public, anon, authenticated;
revoke execute on function public.countries_for_viewer(uuid)                       from public, anon, authenticated;
revoke execute on function public.refresh_hot_scores()                             from public, anon, authenticated;

grant execute on function public.community_setting(text, integer)                  to service_role;
grant execute on function public.post_hot_score(integer, integer, double precision) to service_role;
grant execute on function public.community_viewer(uuid)                            to service_role;
grant execute on function public.post_reply_refusal(uuid, uuid)                    to service_role;
grant execute on function public.post_visibility(uuid, uuid)                       to service_role;
grant execute on function public.can_reply_to_post(uuid, uuid)                     to service_role;
grant execute on function public.can_post_in_feed(uuid, text, text)                to service_role;
grant execute on function public.post_items_by_ids(uuid, uuid[])                   to service_role;
grant execute on function public.get_campus_feed(uuid, integer, timestamptz, uuid) to service_role;
grant execute on function public.get_country_feed(uuid, text, text, integer, double precision, timestamptz, uuid) to service_role;
grant execute on function public.get_global_feed(uuid, text, integer, double precision, timestamptz, uuid) to service_role;
grant execute on function public.get_post_item(uuid, uuid)                         to service_role;
grant execute on function public.get_post_replies(uuid, uuid, integer, timestamptz, uuid) to service_role;
grant execute on function public.get_user_posts(uuid, uuid, integer, timestamptz, uuid) to service_role;
grant execute on function public.count_new_campus_posts(uuid, timestamptz)         to service_role;
grant execute on function public.countries_for_viewer(uuid)                        to service_role;
grant execute on function public.refresh_hot_scores()                              to service_role;

commit;
