-- ============================================================================
-- search_users(): a piece of a name or handle finds the person.
--
-- Phase 6B, Block V-F. One function. No table, policy, trigger, grant or index
-- is touched. The signature and the returned columns do not change.
--
--
-- THE BUG
-- -------
-- In the Mark as Sold picker, "Who bought it?", typing ".ver" said "No students
-- on your campus match “.ver”", with rahul.verma on the same campus. The same
-- happened for "ver" and for "@rah".
--
-- search_users() found a person in three ways only:
--   · the handle STARTS with what was typed      (username like q || '%')
--   · the handle is trigram-similar to it        (username % q)
--   · the full name is trigram-similar to it     (full_name % q)
--
-- "Similar" means pg_trgm's similarity() is at least 0.3. That compares the
-- WHOLE string, so a short piece of a longer handle scores low:
-- similarity('rahul.verma', '.ver') = 0.231. A piece from the middle of a handle
-- or a surname therefore never matched, unless it was most of the string.
-- A leading "@" was treated as part of the text too, so "@rah" was neither a
-- prefix of "rahul.verma" nor similar enough to it.
--
--
-- THE RULE NOW
-- ------------
-- What was typed, trimmed and lower-cased, with one leading "@" dropped, finds
-- a person when:
--   · their handle starts with it, or contains it anywhere ("ver", ".ver",
--     "verma" all find rahul.verma), or
--   · their full name starts with it, or any word of it does ("ver" finds
--     Rahul Verma), or
--   · either is trigram-similar to it, as before.
--
-- A name is matched by WORD start, not anywhere inside it, the way WhatsApp
-- searches contacts: "erm" does not find "Rahul Verma" by his name. A handle
-- is one word with dots and underscores in it, so any part of it counts:
-- "erm" does find him by rahul.verma.
--
-- Order of results:
--   1. an exact handle match            (unchanged)
--   2. the viewer's own campus first    (unchanged)
--   3. how it matched: handle or name starts with it, then a later word or
--      a piece of the handle, then similar only            (NEW)
--   4. similarity                       (unchanged)
--
-- LIKE treats "_" and "%" as wildcards, and "_" is legal in a handle, so the
-- typed text is escaped before it goes into a pattern. The old prefix match
-- did not escape it, so "a_b" also matched "axb…". It does now.
--
-- Speed: users_username_trgm_idx and users_full_name_trgm_idx (005) are GIN
-- trigram indexes, which serve LIKE / ILIKE '%…%' as well as %, so no new
-- index is needed.
--
--
-- WHAT IS PRESERVED, AND WHY IT IS RESTATED
-- -----------------------------------------
-- Same reason as 017 and 018: CREATE OR REPLACE resets every property it does
-- not restate. Restated, unchanged from 018:
--
--   · language plpgsql · stable · security invoker
--   · set search_path = public, pg_temp
--   · the demo isolation (un.is_demo = viewer_is_demo) and fail-closed viewer
--     lookup from 018
--   · u.username is not null
--
-- Callers: GET /api/users/search (user module) and
-- GET /api/products/:id/buyer-candidates?q= (products module). Neither changes.
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
  -- One leading "@": the search box says "Search by name or @username".
  q              text := regexp_replace(lower(trim(p_query)), '^@', '');
  -- q with LIKE's wildcards (and its escape character) escaped.
  q_like         text;
  viewer_uni     uuid;
  viewer_is_demo boolean;
begin
  if q = '' then
    return;
  end if;
  q_like := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');

  -- Unchanged from 018: an inner join, so a viewer with no row, or with no
  -- university, finds nothing, and gets nothing.
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
     and un.is_demo = viewer_is_demo
     and (u.username like '%' || q_like || '%'
          or u.full_name ilike q_like || '%'
          or u.full_name ilike '% ' || q_like || '%'
          or u.username % q
          or coalesce(u.full_name, '') % q)
   order by
     (u.username = q) desc,
     (u.university_id = viewer_uni) desc,
     case
       when u.username like q_like || '%' or u.full_name ilike q_like || '%' then 0
       when u.username like '%' || q_like || '%' or u.full_name ilike '% ' || q_like || '%' then 1
       else 2
     end,
     rank desc
   limit p_limit;
end;
$function$;

commit;
