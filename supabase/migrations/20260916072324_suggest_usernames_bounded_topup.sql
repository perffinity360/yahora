-- ============================================================================
-- 016. suggest_usernames(): bound the top-up loop.
--
-- One function, one idea. No table, policy, trigger, grant or other function is
-- touched.
--
--
-- THE BUG: AN UNBOUNDED LOOP THAT ALWAYS SPINS FOR THE FIRST STUDENT OF A NAME
-- ---------------------------------------------------------------------------
-- From 20260815061951_usernames.sql (005), the tail of the function reads:
--
--     while array_length(out_arr, 1) is null or array_length(out_arr, 1) < 3 loop
--       candidate := public.generate_username(p_name);
--       if not (candidate = any(out_arr)) then
--         out_arr := out_arr || candidate;
--       end if;
--     end loop;
--
-- There is no exit condition other than reaching three suggestions, and the
-- loop cannot always reach three:
--
--   · `generate_username(p_name)` returns `base` UNCHANGED when `base` is
--     available — it only starts appending random suffixes once the plain form
--     is taken. So when base is free it is a DETERMINISTIC function: every call
--     returns the same string.
--   · Step 1 of this same function has already added `base` to `out_arr` in
--     exactly that case.
--   · So every iteration produces a duplicate, the `if` never fires, the array
--     never grows, and the loop runs until the statement timeout kills it:
--
--         [db] { code: '57014', message: 'canceling statement due to statement timeout' }
--
-- Reproduced on the local database before this was written:
--
--     suggest_usernames('Vishwajeet')    -> 57014   (base 'vishwajeet' free)
--     suggest_usernames('Priya')         -> 57014   (base 'priya' free)
--     suggest_usernames('Test User')     -> 57014   (base 'test.user' free)
--     suggest_usernames('Rahul Sharma')  -> 3 rows  (base 'rahul.sharma' TAKEN)
--
-- The pattern is not "single-word names". It is **base is available**, which is
-- the ordinary case for the FIRST student to sign up under a given name — and
-- on a new campus that is every student. It looked intermittent only because
-- once someone takes `base`, the same name works forever after.
--
-- Steps 2 and 3 can mask it by filling the array to three first, but step 2
-- needs a `p_university_id` (the suggestions endpoint does not send one) and
-- step 3 needs a dotted name whose initial+surname form is also free.
--
-- COST: the caller waits out the whole statement timeout holding a connection,
-- and the student gets no suggestions at the one moment the field is asking
-- them to pick a handle.
--
--
-- THE FIX
-- -------
-- Two changes to the loop, both inside it. Steps 1-3 above are untouched.
--
--   1. A try counter. The loop can now always end, whatever the inputs. A
--      shorter array is a fine outcome — API.md already documents `suggestions`
--      as possibly `[]`, and the callers treat it as advisory.
--   2. When `generate_username` hands back something already in the array, a
--      suffixed variant is built directly instead of calling it again. Asking a
--      deterministic function the same question twice cannot produce a new
--      answer; this is what lets the loop make progress rather than merely stop.
--
-- The suffixed variant is `left(base, 20) || '.' || <4 digits>`: at most 25
-- characters (§3), and `base` has had its dots trimmed from both ends by this
-- point, so joining with '.' can never produce two adjacent separators
-- (migration 009 §2). It is availability-checked before being added, which the
-- original did not need to do because generate_username had already done it.
--
--
-- WHAT IS PRESERVED
-- -----------------
--   · The signature, so this is CREATE OR REPLACE rather than DROP + CREATE.
--     That keeps the existing ACL (`{=X/postgres,postgres,service_role}` — note
--     PUBLIC holds EXECUTE on this one) without this file restating it. Who may
--     execute it is not this migration's idea.
--   · `SET search_path = public, pg_temp`, restated. CREATE OR REPLACE does NOT
--     preserve a function's configuration — omit it and the pinning applied by
--     migration 012 silently disappears.
--   · SECURITY INVOKER, and the behaviour of steps 1-3, byte for byte.
--   · The return contract: still `text[]`, still at most three, still ordered
--     plain -> campus -> initial+surname -> generated.
--
--
-- CAN THIS FAIL AGAINST EXISTING ROWS?
-- ------------------------------------
-- No. It is a single CREATE OR REPLACE FUNCTION: no DDL on any table, no
-- constraint, no index, no backfill, no type change. Success depends on the
-- catalogue, not on table contents, so it behaves identically on an empty local
-- database and on production.
--
-- It cannot fail on a dependency either — unlike a DROP, CREATE OR REPLACE
-- keeps the same function oid, so anything referencing it keeps working.
-- ============================================================================

begin;

create or replace function public.suggest_usernames(
  p_name          text,
  p_university_id uuid default null
)
  returns text[]
  language plpgsql
  security invoker
  set search_path = public, pg_temp
as $function$
declare
  out_arr   text[] := '{}';
  base      text;
  uni_slug  text;
  candidate text;
  -- Each try costs one or two is_username_available() calls, so this bounds the
  -- work at roughly two dozen index lookups. Twelve tries to find at most three
  -- free handles is generous: the random suffix has 10,000 values.
  tries     int := 0;
begin
  base := trim(both '.' from regexp_replace(lower(coalesce(p_name, 'student')), '[^a-z0-9]+', '.', 'g'));
  base := regexp_replace(base, '^[^a-z]+', '');   -- §3: must start with a letter
  base := left(base, 17);
  base := trim(both '.' from base);

  if length(base) < 3 then
    base := 'student';
  end if;

  select lower(regexp_replace(split_part(domain, '.', 1), '[^a-z0-9]', '', 'g'))
    into uni_slug
    from public.universities
   where id = p_university_id;

  -- 1. plain
  if public.is_username_available(base) then
    out_arr := out_arr || base;
  end if;

  -- 2. with campus
  if uni_slug is not null then
    candidate := left(base || '_' || uni_slug, 25);
    if public.is_username_available(candidate) then
      out_arr := out_arr || candidate;
    end if;
  end if;

  -- 3. first initial + surname
  candidate := regexp_replace(base, '^([a-z])[a-z0-9]*\.', '\1', '');
  if candidate <> base and public.is_username_available(candidate) then
    out_arr := out_arr || candidate;
  end if;

  -- 4. top up with random suffixes until we have 3, or we run out of tries.
  --
  -- `coalesce(array_length(...), 0)`: array_length returns NULL for an empty
  -- array, not 0, which is what the original's `is null or` arm was working
  -- around.
  while coalesce(array_length(out_arr, 1), 0) < 3 and tries < 12 loop
    tries := tries + 1;

    candidate := public.generate_username(p_name);

    -- generate_username returns `base` unchanged whenever base is free, which
    -- is exactly when step 1 has already used it. Calling it again can only
    -- return the same string, so build a distinct variant instead. Without
    -- this, the loop stops (it is bounded now) but returns one suggestion where
    -- it could return three.
    if candidate = any(out_arr) then
      candidate := left(base, 20) || '.' || lpad(floor(random() * 10000)::int::text, 4, '0');
    end if;

    if not (candidate = any(out_arr)) and public.is_username_available(candidate) then
      out_arr := out_arr || candidate;
    end if;
  end loop;

  return out_arr[1:3];
end;
$function$;

commit;
