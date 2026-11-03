-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 7 · Block V-B · Migration 2 of 4 — reactions and reports
--
--   1. public.post_reactions   one reaction per person per post (runbook §1.4).
--   2. A counter trigger       keeps posts.reactions_total and reaction_counts.
--   3. react_to_post()         sets, changes or removes your reaction.
--   4. public.reports          every report, with a status for Phase 9.
--   5. create_report()         who may report, and whether they are the audience.
--   6. A cover trigger         covers a post when a threshold is met (§1.7).
--
-- Error names: POST_NOT_FOUND and CANNOT_REPORT_OWN. A duplicate report raises
-- unique_violation, which mapDbError already turns into DUPLICATE.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ---------------------------------------------------------------------------
-- 1. post_reactions
-- ---------------------------------------------------------------------------
create table public.post_reactions (
  post_id    uuid        not null references public.posts(id) on delete cascade,
  user_id    uuid        not null references public.users(id) on delete cascade,
  emoji      text        not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

comment on table public.post_reactions is
  'One row per person per post, which is what makes it one reaction per person '
  '(runbook §1.4). Backend-only: RLS on, no policies, no grants to anon or '
  'authenticated.';
comment on column public.post_reactions.post_id is 'The post or reply reacted to.';
comment on column public.post_reactions.user_id is 'The person reacting.';
comment on column public.post_reactions.emoji is
  'The emoji. The backend checks it is exactly one with isSingleEmoji; the length '
  'check here is the backstop (16 code points fits every RGI emoji).';
comment on column public.post_reactions.created_at is 'When this person first reacted to this post.';
comment on column public.post_reactions.updated_at is 'When this person last changed their reaction.';

-- The primary key starts with post_id. This serves the account-deletion cascade.
create index post_reactions_user_id_idx on public.post_reactions (user_id);

alter table public.post_reactions enable row level security;
revoke all on public.post_reactions from anon, authenticated;
grant select, insert, update, delete on public.post_reactions to service_role;

-- ---------------------------------------------------------------------------
-- 2. The counters
-- ---------------------------------------------------------------------------
create function public.bump_reaction_counts(p_counts jsonb, p_emoji text, p_delta integer)
  returns jsonb
  language sql
  immutable
  security invoker
  set search_path = public, pg_temp
as $function$
  select case
    when coalesce((p_counts ->> p_emoji)::integer, 0) + p_delta > 0
      then p_counts || jsonb_build_object(p_emoji, coalesce((p_counts ->> p_emoji)::integer, 0) + p_delta)
    else p_counts - p_emoji
  end;
$function$;

comment on function public.bump_reaction_counts(jsonb, text, integer) is
  'Adds p_delta to one emoji''s count. A key that reaches 0 is removed, so a count '
  'can never go below 0.';

-- SECURITY DEFINER, as in migration 011: deleting an account cascades from
-- auth.users into post_reactions as supabase_auth_admin, which has no grants on
-- public tables. As SECURITY INVOKER this UPDATE would make account deletion
-- fail with 42501. The pinned search_path is what makes DEFINER safe. It calls
-- bump_reaction_counts as its owner, so no grant is needed for that either.
create function public.sync_post_reaction_counts()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'INSERT' then
    update public.posts p
       set reactions_total = p.reactions_total + 1,
           reaction_counts = public.bump_reaction_counts(p.reaction_counts, new.emoji, 1)
     where p.id = new.post_id;

  elsif tg_op = 'DELETE' then
    update public.posts p
       set reactions_total = greatest(p.reactions_total - 1, 0),
           reaction_counts = public.bump_reaction_counts(p.reaction_counts, old.emoji, -1)
     where p.id = old.post_id;

  elsif new.emoji is distinct from old.emoji then
    update public.posts p
       set reaction_counts = public.bump_reaction_counts(
             public.bump_reaction_counts(p.reaction_counts, old.emoji, -1),
             new.emoji, 1
           )
     where p.id = new.post_id;
  end if;

  return null;
end;
$function$;

comment on function public.sync_post_reaction_counts() is
  'Keeps posts.reactions_total and posts.reaction_counts right on insert, change '
  'and delete. Each UPDATE works from the current row, so simultaneous reactions '
  'cannot overwrite each other. SECURITY DEFINER because an account deletion '
  'reaches it as supabase_auth_admin.';

create trigger trg_sync_post_reaction_counts
  after insert or delete or update of emoji on public.post_reactions
  for each row execute function public.sync_post_reaction_counts();

-- ---------------------------------------------------------------------------
-- 3. react_to_post
-- ---------------------------------------------------------------------------
create function public.react_to_post(p_post_id uuid, p_user_id uuid, p_emoji text)
  returns table (reactions_total integer, reaction_counts jsonb, viewer_reaction text)
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
begin
  -- The author sees their own held or covered post as 'visible', so the status
  -- has to be checked as well: those posts can't collect reactions.
  if public.post_visibility(p_user_id, p_post_id) <> 'visible'
     or not exists (
       select 1 from public.posts p
        where p.id = p_post_id and p.moderation_status = 'active'
     ) then
    raise exception 'POST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_emoji is null then
    delete from public.post_reactions r
     where r.post_id = p_post_id and r.user_id = p_user_id;
  else
    insert into public.post_reactions as r (post_id, user_id, emoji)
    values (p_post_id, p_user_id, p_emoji)
    on conflict (post_id, user_id) do update
      set emoji = excluded.emoji, updated_at = now();
  end if;

  return query
  select p.reactions_total,
         p.reaction_counts,
         (select r.emoji from public.post_reactions r
           where r.post_id = p_post_id and r.user_id = p_user_id)
    from public.posts p
   where p.id = p_post_id;
end;
$function$;

comment on function public.react_to_post(uuid, uuid, text) is
  'Sets or changes the caller''s reaction, or removes it when p_emoji is NULL. '
  'Answers with the post''s new totals. POST_NOT_FOUND unless the post is visible '
  'to the caller and active.';

-- ---------------------------------------------------------------------------
-- 4. reports
-- ---------------------------------------------------------------------------
create table public.reports (
  id                   uuid        primary key default gen_random_uuid(),
  reporter_id          uuid        not null references public.users(id) on delete cascade,
  target_type          text        not null check (target_type in ('post', 'user', 'product', 'comment', 'message')),
  target_id            uuid        not null,
  reason               text        not null check (reason in (
                         'spam', 'harassment', 'hate_speech', 'sexual_content', 'child_safety',
                         'violence', 'self_harm', 'impersonation', 'misinformation',
                         'prohibited_item', 'other'
                       )),
  details              text        check (char_length(details) <= 500),
  reporter_in_audience boolean     not null,
  status               text        not null default 'open' check (status in ('open', 'upheld', 'dismissed')),
  created_at           timestamptz not null default now(),
  reviewed_at          timestamptz,
  unique (reporter_id, target_type, target_id)
);

comment on table public.reports is
  'Every report. Reports never delete anything: at a threshold they cover the post '
  '(runbook §1.7). Backend-only: RLS on, no policies, no grants to anon or '
  'authenticated. The reporter is never told the outcome.';
comment on column public.reports.reporter_id is 'Who reported. Never shown to anyone else.';
comment on column public.reports.target_type is
  'What was reported. Phase 7 handles post only; the others are for later phases.';
comment on column public.reports.target_id is
  'The id of the post, user, product, comment or message. No foreign key, because '
  'it can point at five tables, and a report outlives what it reported.';
comment on column public.reports.reason is 'One of the 11 reasons of spec §7.';
comment on column public.reports.details is 'What the reporter added, at most 500 code points.';
comment on column public.reports.reporter_in_audience is
  'Was the reporter in the post''s own audience? For the "everything else" reasons '
  'only these count, so one country can''t hide another country''s posts.';
comment on column public.reports.status is
  'open, upheld or dismissed. Set by the Phase 9 admin screen, and how false reports '
  'are tracked. The cover rules count open reports only.';
comment on column public.reports.created_at is 'When it was reported.';
comment on column public.reports.reviewed_at is 'When it was upheld or dismissed.';

-- Everything the cover trigger counts for one post, and the review queue.
create index reports_target_idx on public.reports (target_type, target_id, status);
create index reports_status_created_idx on public.reports (status, created_at);

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, insert, update on public.reports to service_role;

-- ---------------------------------------------------------------------------
-- 5. create_report
-- ---------------------------------------------------------------------------
create function public.create_report(
  p_reporter    uuid,
  p_target_type text,
  p_target_id   uuid,
  p_reason      text,
  p_details     text default null
)
  returns void
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_post       public.posts;
  v_university uuid;
  v_country    char(2);
  v_visibility text;
begin
  -- Phase 7 handles posts only. The backend refuses anything else first, with
  -- INVALID_FORMAT; this is the backstop.
  if p_target_type is distinct from 'post' then
    raise exception 'POST_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- 'under_review' passes: someone who saw the post just before it was covered
  -- can still report it.
  v_visibility := public.post_visibility(p_reporter, p_target_id);
  if v_visibility not in ('visible', 'under_review') then
    raise exception 'POST_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_post from public.posts p where p.id = p_target_id;

  if v_post.author_id = p_reporter then
    raise exception 'CANNOT_REPORT_OWN' using errcode = 'P0001';
  end if;

  select v.university_id, v.country_code into v_university, v_country
    from public.community_viewer(p_reporter) v;

  insert into public.reports (reporter_id, target_type, target_id, reason, details, reporter_in_audience)
  values (
    p_reporter, 'post', p_target_id, p_reason, p_details,
    case v_post.scope
      when 'campus'  then v_university = v_post.university_id
      when 'country' then v_country = v_post.country_code
      else true
    end
  );
end;
$function$;

comment on function public.create_report(uuid, text, uuid, text, text) is
  'Records a report on a post. POST_NOT_FOUND if the reporter can''t see it, '
  'CANNOT_REPORT_OWN for your own post, unique_violation for a second report.';

-- ---------------------------------------------------------------------------
-- 6. The cover rules (runbook §1.7)
-- ---------------------------------------------------------------------------
create function public.apply_report_rules()
  returns trigger
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  v_post         public.posts;
  v_child_safety integer;
  v_serious      integer;
  v_other        integer;
  v_child_limit  integer;
  v_other_limit  integer;
begin
  -- The lock makes simultaneous reports take turns. Without it, the second and
  -- third reports could each count 2 and neither would cover the post. Each
  -- statement below takes a new snapshot, so it sees the report that went first.
  select * into v_post from public.posts p where p.id = new.target_id for update;
  if not found then
    return null;
  end if;

  update public.posts p
     set report_count = (
           select count(distinct r.reporter_id) from public.reports r
            where r.target_type = 'post' and r.target_id = new.target_id
         )
   where p.id = new.target_id;

  if v_post.moderation_status <> 'active' then
    return null;
  end if;

  select
    count(*) filter (where r.reason = 'child_safety'),
    count(*) filter (where r.reason in ('sexual_content', 'violence', 'self_harm')),
    count(*) filter (where r.reason not in ('child_safety', 'sexual_content', 'violence', 'self_harm')
                       and r.reporter_in_audience)
    into v_child_safety, v_serious, v_other
    from public.reports r
   where r.target_type = 'post' and r.target_id = new.target_id and r.status = 'open';

  v_child_limit := case
    when cardinality(v_post.image_urls) > 0
      then public.community_setting('report_threshold_child_safety_photo', 1)
      else public.community_setting('report_threshold_child_safety', 2)
  end;

  v_other_limit := case
    when v_post.scope = 'campus'
      then public.community_setting('report_threshold_other_campus', 5)
      else public.community_setting('report_threshold_other_wide', 10)
  end;

  if v_child_safety >= v_child_limit
     or v_serious >= public.community_setting('report_threshold_serious', 3)
     or v_other >= v_other_limit
  then
    update public.posts p
       set moderation_status = 'under_review'
     where p.id = new.target_id;
  end if;

  return null;
end;
$function$;

comment on function public.apply_report_rules() is
  'AFTER INSERT on reports: recounts the post''s distinct reporters, then covers an '
  'active post when a threshold from community_settings is met. Only open reports '
  'count toward a threshold.';

create trigger trg_apply_report_rules
  after insert on public.reports
  for each row
  when (new.target_type = 'post')
  execute function public.apply_report_rules();

-- ---------------------------------------------------------------------------
-- 7. Who may run these: the backend only.
-- ---------------------------------------------------------------------------
revoke execute on function public.sync_post_reaction_counts()               from public, anon, authenticated;
revoke execute on function public.apply_report_rules()                      from public, anon, authenticated;

revoke execute on function public.bump_reaction_counts(jsonb, text, integer) from public, anon, authenticated;
revoke execute on function public.react_to_post(uuid, uuid, text)           from public, anon, authenticated;
revoke execute on function public.create_report(uuid, text, uuid, text, text) from public, anon, authenticated;

grant execute on function public.bump_reaction_counts(jsonb, text, integer)  to service_role;
grant execute on function public.react_to_post(uuid, uuid, text)            to service_role;
grant execute on function public.create_report(uuid, text, uuid, text, text) to service_role;

commit;
