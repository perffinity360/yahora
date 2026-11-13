-- post_rate_limit_retry_at — Phase 7, 13 Nov (owner: "the posting limit
-- message doesn't show the time when I should try; it should").
--
-- prepare_post() is the original from 20261103053142_community_posts, with
-- one change: RATE_LIMIT_POSTS and RATE_LIMIT_REPLIES now carry, as their
-- HINT, the moment the 60-minute window has room again, as an ISO 8601 UTC
-- timestamp ("2026-11-13T12:41:07.512Z"). That is an hour after the post (or
-- reply) whose leaving the window brings the count under the limit: with
-- v_used counted and v_limit allowed, the (v_used - v_limit + 1)th oldest.
--
-- The rule itself, the lock, the limits and every other line are unchanged.
-- The backend reads the hint in mapDbError() and sends it as next_allowed_at
-- (backend/API.md). A HINT, not DETAIL: the backend never passes a failed
-- insert's DETAIL on, because a check violation puts the post's text there.

create or replace function public.prepare_post()
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
  v_retry_at   timestamptz;
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

    v_limit := public.community_setting('rate_limit_replies_per_hour', 45);
    if v_used >= v_limit then
      -- When the window has room again: an hour after the reply whose
      -- leaving brings the count under the limit.
      select p.created_at + interval '1 hour' into v_retry_at
        from public.posts p
       where p.author_id = new.author_id
         and p.parent_post_id is not null
         and p.created_at > now() - interval '1 hour'
       order by p.created_at
      offset v_used - v_limit
       limit 1;
      raise exception 'RATE_LIMIT_REPLIES' using errcode = 'P0001',
        hint = to_char(v_retry_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
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
      select p.created_at + interval '1 hour' into v_retry_at
        from public.posts p
       where p.author_id = new.author_id
         and p.parent_post_id is null
         and p.scope = new.scope
         and p.created_at > now() - interval '1 hour'
       order by p.created_at
      offset v_used - v_limit
       limit 1;
      raise exception 'RATE_LIMIT_POSTS' using errcode = 'P0001',
        hint = to_char(v_retry_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
    end if;

    -- No reactions, no replies, age 0: so a new post enters Hot at once.
    new.hot_score := public.post_hot_score(0, 0, 0);
  end if;

  return new;
end;
$function$;
