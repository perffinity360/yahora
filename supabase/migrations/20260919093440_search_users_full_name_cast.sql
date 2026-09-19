-- ============================================================================
-- 017. search_users(): cast full_name to text in the body.
--
-- One function, one idea. No table, policy, trigger, grant, index or other
-- function is touched. The signature does not change.
--
--
-- THE BUG: EVERY CALL THAT MATCHES A ROW RETURNS 500
-- --------------------------------------------------
-- GET /api/users/search?q=<anything> has never once succeeded. The backend log
-- carries the Postgres error verbatim:
--
--     42804: Returned type character varying(255) does not match expected
--            type text in column 3
--
-- Column 3 of the RETURNS TABLE is declared `full_name text`. The column it
-- selects, public.users.full_name, is `character varying(255)`. PL/pgSQL
-- compares the declared row structure against the actual one **at execution
-- time, per returned row** — not when the function is created. That is why
-- 20260815061951_usernames.sql (005) applied cleanly, why `supabase db reset`
-- has never complained, and why this sat undiscovered for a month.
--
-- Column 5 is NOT the same situation and is deliberately left alone:
-- `university_name varchar` against `universities.name varchar(255)` shares a
-- base type, and the length modifier is not part of the check. It passes. It
-- keeps passing. Changing a working column for symmetry is how working things
-- break.
--
-- This is pre-existing and not a Phase 4 regression. 20260903123107 (011) only
-- pinned the search_path of this function; it did not touch the signature or
-- the body.
--
--
-- WHY THE CAST GOES IN THE BODY AND NOT IN THE SIGNATURE
-- ------------------------------------------------------
-- Declaring column 3 as `character varying(255)` would silence the error just
-- as well. It would also weld this function's public contract to the current
-- width of a column. The day someone widens full_name to varchar(320) — or
-- converts it to text, which is where it should have started — the declared
-- type silently stops matching and every search 500s again, with the same
-- error and the same month of nobody noticing.
--
-- `text` is the stable contract. The cast is the adapter. The table is free to
-- change underneath.
--
--
-- WHAT IS PRESERVED, AND WHY IT IS RESTATED HERE
-- ----------------------------------------------
-- CREATE OR REPLACE FUNCTION assigns every property from the command; anything
-- left unsaid reverts to its default. Ownership and grants survive, but the
-- `SET search_path` that 011 attached with ALTER FUNCTION does NOT — it would
-- be silently dropped, quietly undoing that migration on production and
-- leaving this function resolving unqualified names against the caller's path
-- again. So it is restated below, alongside the volatility and the security
-- setting:
--
--   · language plpgsql                    (unchanged)
--   · stable                              (unchanged)
--   · security invoker                    (unchanged — 005 relied on the
--                                          default; 011 §"SEARCH_PATH ONLY"
--                                          confirms all six stayed invoker)
--   · set search_path = public, pg_temp   (restated from 011)
--   · p_limit int default 20              (unchanged)
--   · the three-key ORDER BY              (unchanged — exact match, then own
--                                          campus, then trigram rank. Phase 4
--                                          Block N-C and both clients read the
--                                          order as given.)
--
-- No cursor, no pagination, no new parameter: search stays exempt, as settled
-- in Phase 4.
--
--
-- COULD THIS BEHAVE DIFFERENTLY AGAINST PRODUCTION ROWS THAN AGAINST LOCAL ONES?
-- -----------------------------------------------------------------------------
-- The migration itself: no. It is one CREATE OR REPLACE. Success depends on the
-- catalogue, not on table contents, and the oid is preserved, so nothing that
-- references the function needs recompiling.
--
-- The VALUES it returns: no. varchar(255) -> text is a widening cast. It cannot
-- truncate, it cannot round, it cannot fail, and NULL casts to NULL, so a user
-- with no full_name behaves exactly as before.
--
-- **The TEST is where local and production differ, and it matters here.**
-- The 42804 is raised while RETURNING A ROW. A query that matches nothing
-- returns zero rows and therefore raises nothing — the broken function and the
-- fixed one are indistinguishable on an empty database. Any check of the form
-- "search_users('x') ran without error" is worthless unless it returned at
-- least one row. The verification snippet must assert a non-zero row count, and
-- must run against seeded data.
-- ============================================================================

begin;

create or replace function public.search_users(
  p_query  text,
  p_viewer uuid default null,
  p_limit  int  default 20
)
  returns table (
    id              uuid,
    username        text,
    full_name       text,
    avatar_url      text,
    university_name varchar,
    is_same_campus  boolean,
    rank            real
  )
  language plpgsql
  stable
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  q          text := lower(trim(p_query));
  viewer_uni uuid;
begin
  select university_id into viewer_uni from public.users where users.id = p_viewer;

  return query
  -- ↓ THE ONE CHANGE. users.full_name is varchar(255); column 3 of the
  --   RETURNS TABLE above is text. Everything else in this function is
  --   byte-for-byte the body from 005.
  select u.id, u.username, u.full_name::text, u.avatar_url,
         un.name as university_name,
         (u.university_id = viewer_uni) as is_same_campus,
         greatest(
           similarity(u.username, q),
           similarity(coalesce(u.full_name, ''), q)
         ) as rank
    from public.users u
    join public.universities un on un.id = u.university_id
   where u.username is not null
     and (u.username like q || '%'
          or u.username % q
          or coalesce(u.full_name, '') % q)
   order by
     (u.username = q) desc,
     (u.university_id = viewer_uni) desc,
     rank desc
   limit p_limit;
end;
$function$;

commit;
