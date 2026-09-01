-- ============================================================================
-- Migration 009 — no two separators in a row in a username
--
-- Migration 005 §3 deliberately ALLOWED repeated separators, matching
-- Instagram, and wrote down what that costs:
--
--     "rahul.sharma and rahul..sharma are different handles. Those are
--      impersonation vectors on a campus app and the reserved list does not
--      cover them — the Phase 8 moderation queue is what has to."
--
-- We are not waiting for Phase 8. This closes it in the format rule instead.
--
-- BANNING ALL SEPARATOR PAIRS, NOT ONLY '..'. The question that started this
-- was about two dots, but look at what is actually being imitated:
--
--     rahul.sharma        the real handle
--     rahul..sharma       '..'
--     rahul._sharma       '._'
--     rahul-_sharma       '-_'
--
-- All three of the impostors are trying to read as the first one. Banning only
-- '..' closes one door and leaves '._', '_.', '--', '-.', '__' and the rest
-- open, for exactly the same amount of code. So the rule is "no two of . _ -
-- adjacent", full stop. No legitimate handle anyone would choose is lost:
-- rah.ul.sharma, rahul.sharma and rahul_sharma all still pass.
--
-- THE RULE, BEFORE AND AFTER:
--
--   before   username = lower(username)
--            length 3..25
--            username ~ '^[a-z][a-z0-9._-]*$'
--
--   after    username = lower(username)          unchanged
--            length 3..25                        unchanged
--            username ~ '^[a-z][a-z0-9._-]*$'    unchanged
--            username !~ '[._-]{2}'              NEW
--
-- Three places state this rule and ALL THREE move together — the CHECK
-- constraint (§2), is_username_available() (§3), and the existing rows (§1).
-- 005 §7 says why the second one is not optional: if the function and the
-- constraint ever disagree, the function says "available" and the insert
-- raises, and the student sees a 500 on a handle we just told them was free.
--
-- Trailing and leading single separators are still legal (rahul_ passes).
-- That is unchanged behaviour and out of scope here.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Repair existing rows. THIS MUST RUN BEFORE §2, NOT AFTER.
--
-- ALTER TABLE ... ADD CONSTRAINT validates every existing row immediately and
-- refuses the whole statement if even one fails. So the constraint cannot go on
-- until nothing violates it.
--
-- Production is empty after the Block A wipe, so this updates zero rows there.
-- LOCAL IS NOT EMPTY — seed.sql and seedDemo.js personas are in the table, and
-- migration 006 backfilled handles from full names. One seeded handle with a
-- '..' in it is all it takes to make `supabase db reset` fail at this
-- migration, on every developer machine, with an error that points at the
-- constraint rather than at the data. Repairing first makes local and
-- production behave identically, which is the entire point of the ordering.
--
-- The repair collapses ANY run of two or more separators to a single dot:
-- rahul..sharma and rahul-_sharma both become rahul.sharma. A dot rather than
-- "whichever separator came first" because the generator in 005 §7 already
-- treats '.' as the canonical separator, so the repaired handle looks like one
-- the system would have produced itself.
--
-- ⚠️ TWO WAYS THIS UPDATE CAN STILL FAIL, both only on a machine with unusual
-- seed data, both loud rather than silent:
--
--   a) Collision. If rahul..sharma is repaired to rahul.sharma and that handle
--      already belongs to someone else, users_username_key rejects the update.
--   b) Length. 'a__' is 3 characters and legal today; repaired it is 'a.',
--      which is 2, and §2 then rejects the row.
--
-- Neither is worth pre-empting with code here — production has no rows and
-- both would surface immediately on `db reset` with a clear unique-violation
-- or check-violation. If you hit one, fix the offending seed row by hand and
-- re-run; do not weaken the constraint.
--
-- NOTE ON THE TRIGGER THIS FIRES. public.users carries trg_record_username_change
-- (005 §6), a BEFORE UPDATE OF username trigger. Each repaired row therefore
-- also gets its OLD handle written to username_history with a 30-day
-- reserved_until, and its username_changed_at stamped to now(). Both are
-- correct and harmless: the handle being reserved is one the new rule makes
-- unclaimable anyway, and the only rows affected are local seed personas. The
-- trigger is left enabled on purpose — suppressing it would be a bigger change
-- than the thing it is protecting against.
-- ---------------------------------------------------------------------------

update public.users
   set username = regexp_replace(username, '[._-]{2,}', '.', 'g')
 where username ~ '[._-]{2}';


-- ---------------------------------------------------------------------------
-- 2. Replace the format constraint.
--
-- users_username_valid is the name from migration 005 §3. It is dropped and
-- recreated rather than amended because Postgres has no "alter constraint" for
-- a CHECK — a new predicate means a new constraint object.
--
-- `drop constraint if exists` so a partially-applied local database can be
-- reset without hand-editing. The three original conditions are reproduced
-- verbatim; only the fourth line is new.
--
-- The new condition is a SEPARATE line rather than folded into the regex on
-- purpose. It could have been written as one pattern —
-- '^[a-z]([a-z0-9]|[._-](?![._-]))*$' or similar — and that would be shorter
-- and considerably harder to read, review or change. As its own line, a future
-- reader can see at a glance exactly which rule 009 added and what it says.
--
-- `!~` is "does not match". '[._-]{2}' is "any two characters from that set,
-- adjacent". It is unanchored on purpose: the pair is banned anywhere in the
-- handle, not just at the start.
--
-- users_username_required_when_complete (migration 006) is a DIFFERENT
-- constraint on the same column and is deliberately untouched.
-- ---------------------------------------------------------------------------

alter table public.users drop constraint if exists users_username_valid;

alter table public.users add constraint users_username_valid check (
  username is null or (
        username = lower(username)
    and length(username) between 3 and 25
    and username ~ '^[a-z][a-z0-9._-]*$'
    and username !~ '[._-]{2}'          -- 009: no two separators in a row
  )
);


-- ---------------------------------------------------------------------------
-- 3. is_username_available() — the same rule, in the place the student meets.
--
-- This function carries its own copy of the format check, and 005 §7 is
-- explicit about why the two must never drift: the constraint decides whether
-- the write succeeds, but THIS is what the onboarding UI calls while the
-- student is typing. Change §2 and not this one and 'rahul..sharma' reads as
-- available, the student taps submit, and the insert raises a raw
-- check-violation they cannot act on.
--
-- CREATE OR REPLACE, and the format condition is the ONLY thing that changes.
-- The reserved-word check, the taken check, the 30-day cooling-off check, the
-- fold at the top, `stable`, `security definer` and the pinned search_path are
-- all reproduced exactly as migration 005 wrote them.
--
-- The new line reads `or u ~ '[._-]{2}'` rather than `and u !~ ...` because
-- this block is a chain of FAILURE conditions returning false, the inverse of
-- the constraint's chain of passing ones. Same rule, opposite polarity.
--
-- It stays un-revoked, for the reason 005 gave: it returns one boolean and
-- leaks nothing the public profile URL does not already.
-- ---------------------------------------------------------------------------

create or replace function public.is_username_available(
  p_username text,
  p_user_id  uuid default null
)
  returns boolean
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $function$
declare
  u text := lower(trim(p_username));
begin
  -- The fold happens FIRST, so this answers "is the handle you would actually
  -- get available?" rather than "did you type it in the right case?". A caps
  -- lock user asking about RAHUL is asking about rahul, and gets a straight
  -- answer instead of a format error they cannot act on. The remaining checks
  -- mirror the users_username_valid CHECK exactly — if the two ever drift,
  -- this function says yes and the insert says no, and the student sees a 500
  -- on a handle we just told them was free.
  if u is null
     or length(u) not between 3 and 25
     or u !~ '^[a-z][a-z0-9._-]*$'
     or u ~ '[._-]{2}'                  -- 009: no two separators in a row
  then
    return false;
  end if;

  -- reserved
  if exists (select 1 from public.reserved_usernames where username = u) then
    return false;
  end if;

  -- already taken by someone else
  if exists (select 1 from public.users
             where username = u
               and (p_user_id is null or id <> p_user_id))
  then
    return false;
  end if;

  -- inside the 30-day cooling-off window after someone released it
  if exists (select 1 from public.username_history
             where username = u
               and reserved_until > now()
               and (p_user_id is null or user_id <> p_user_id))
  then
    return false;
  end if;

  return true;
end;
$function$;


-- ---------------------------------------------------------------------------
-- 4. generate_username() and suggest_usernames() are deliberately NOT changed.
--
-- Both were read before this decision was made, and neither can emit a handle
-- the new rule rejects. The reason is the same first line in each:
--
--     regexp_replace(lower(...), '[^a-z0-9]+', '.', 'g')
--
-- That collapses every RUN of non-alphanumeric characters — dots, underscores,
-- hyphens, spaces, punctuation, mixed — into exactly one dot. After it the
-- only separator present anywhere is '.', and two dots cannot be adjacent,
-- because reaching a second dot requires an alphanumeric in between. Every
-- later step is a prefix strip, a truncation or a trim, none of which can
-- bring two separators together.
--
-- The two concatenations were checked specifically, since concatenation is the
-- one operation that could:
--
--   * generate_username's `left(base, 20) || '.' || suffix` — base is already
--     capped at 19 by the preceding left(base, 19), so the truncation is a
--     no-op and base still ends in the alphanumeric its trim(both '.')
--     guaranteed. No '..' is reachable.
--   * suggest_usernames' `base || '_' || uni_slug` — base ends alphanumeric
--     for the same reason, and uni_slug is built with '[^a-z0-9]' stripped
--     entirely, so it cannot begin with a separator either.
--
-- generate_username's redundant `regexp_replace(base, '\.{2,}', '.', 'g')` is
-- left in place. It was already belt-and-braces before today and it is
-- belt-and-braces now.
--
-- Both also gate every candidate through is_username_available(), which §3
-- just tightened — so even if one of them were changed carelessly later, a
-- bad candidate would be rejected rather than written.
-- ---------------------------------------------------------------------------

comment on function public.is_username_available(text, uuid) is
  'Answers format + reserved + taken + 30-day cooling-off in one round trip. '
  'Format rule must stay identical to the users_username_valid CHECK: '
  'lowercase, 3-25 chars, ^[a-z][a-z0-9._-]*$, and no two of . _ - adjacent '
  '(added in migration 009).';
