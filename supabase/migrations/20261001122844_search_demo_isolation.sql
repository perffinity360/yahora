-- ============================================================================
-- 018. search_users(): demo accounts and real students never see each other.
--
-- Phase 6A, Block V-A. One generated column, one function. No policy, trigger,
-- grant, index or other function is touched. The signature does not change.
--
--
-- THE HOLE
-- --------
-- search_users() had no demo filter and no campus filter. POST
-- /api/auth/demo-login has no auth, no captcha and no rate limit, and it hands
-- back a real session token for a brand-new account in the demo university. So
-- one anonymous request bought a token, and GET /api/users/search with that
-- token listed real students' names, handles, avatars and universities on every
-- campus. The other direction leaked too: real students saw demo accounts in
-- their results.
--
--
-- THE RULE
-- --------
--   · a real student searching sees only real students
--   · a demo account searching sees only demo accounts
--   · a viewer who cannot be identified gets ZERO rows (fail closed)
--
-- "Cannot be identified" covers p_viewer null, a uuid with no public.users row,
-- and a user whose university_id is null (005 creates the row that way for an
-- email domain it does not recognise). All three fall out of one inner join
-- finding nothing. None of them can be placed in a world, so none of them is
-- shown either one.
--
-- Campus is still NOT a filter. A real student keeps finding real students on
-- other campuses; same-campus only affects the ORDER BY, as before.
--
--
-- WHY is_demo IS A GENERATED COLUMN
-- ---------------------------------
-- The demo tenant is the university whose domain is 'demo.yahora.com'. That is
-- how demoLogin (auth.controller.js) finds it, how seedDemo.js creates it and
-- how seed.sql inserts it. A plain boolean would need something to set it, in
-- every environment, forever, and the day someone forgets is the day the demo
-- tenant counts as real. A STORED generated column derives it from `domain`, so
-- seed.sql, seedDemo.js, production and any future environment all get the
-- right value with no code of their own. Nothing can write it: an INSERT or
-- UPDATE naming it is rejected. Every existing writer of this table lists its
-- columns explicitly (seed.sql, seedDemo.js, 20260910171153), so none of them
-- is affected.
--
-- The coalesce is belt and braces. `domain` is NOT NULL today, so the column is
-- never null either, and `un.is_demo = viewer_is_demo` can never quietly drop a
-- row by comparing against null.
--
--
-- WHAT IS PRESERVED IN search_users(), AND WHY IT IS RESTATED
-- -----------------------------------------------------------
-- Same reason as 017: CREATE OR REPLACE resets every property it does not
-- restate, and that would silently drop the search_path 011 pinned. Restated,
-- unchanged from 017:
--
--   · language plpgsql · stable · security invoker
--   · set search_path = public, pg_temp
--   · the u.full_name::text cast (017)
--   · where u.username is not null, and the three match conditions
--   · order by exact match, then same campus, then rank
--   · limit p_limit
--
-- What changed:
--   1. The viewer lookup now fetches university_id AND that university's
--      is_demo in one query (users joined to universities).
--   2. If it finds nothing, RETURN with no rows.
--   3. `and un.is_demo = viewer_is_demo` in the WHERE clause.
--
-- The controller (backend/src/modules/user/, Neeraj's) is untouched. It
-- already passes req.user.id as p_viewer.
--
--
-- COULD THIS BEHAVE DIFFERENTLY ON PRODUCTION THAN ON AN EMPTY LOCAL DATABASE?
-- ---------------------------------------------------------------------------
-- · ADD COLUMN ... GENERATED ALWAYS ... STORED rewrites public.universities and
--   its indexes under an ACCESS EXCLUSIVE lock. At this table's size (a few
--   hundred rows at most, one row per campus) the rewrite itself takes
--   milliseconds. The real cost is the lock queue: if a long transaction is
--   holding universities, the ALTER waits, and every read of the table queues
--   behind it (signup, the campus list, every search). Nothing here holds
--   long transactions, so expect nothing, but push at a quiet time.
-- · is_demo depends only on the row's own domain, so it computes identically
--   on any data. Production has exactly one demo tenant only if its domain is
--   exactly 'demo.yahora.com', which is also the only way demoLogin works
--   there. Check after the push:
--       select id, name, domain from public.universities where is_demo;
--   It should return exactly one row.
-- · The one behaviour change real rows can see: a production user whose
--   university_id is null used to get results and now gets none. Count them
--   before the push:
--       select count(*) from public.users where university_id is null;
-- ============================================================================

begin;

alter table public.universities
  add column is_demo boolean
  generated always as (coalesce(domain = 'demo.yahora.com', false)) stored;

comment on column public.universities.is_demo is
  'True for the demo tenant (domain = demo.yahora.com). Generated from domain; '
  'never written. search_users() uses it so demo accounts and real students '
  'never see each other.';

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
  q              text := lower(trim(p_query));
  viewer_uni     uuid;
  viewer_is_demo boolean;
begin
  -- ↓ CHANGE 1 + 2. One lookup for both facts. An inner join, so a viewer with
  --   no row, or with no university, finds nothing, and gets nothing.
  select vu.university_id, vun.is_demo
    into viewer_uni, viewer_is_demo
    from public.users vu
    join public.universities vun on vun.id = vu.university_id
   where vu.id = p_viewer;

  if not found then
    return;
  end if;

  return query
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
     and un.is_demo = viewer_is_demo  -- ← CHANGE 3. Same world as the viewer.
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
