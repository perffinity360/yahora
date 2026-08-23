-- ============================================================================
-- Migration 007 — get_login_identity()
--
-- Closes the gap recorded in backend/API.md under POST /api/auth/login-password
-- ("Known limitation — the has_password=false console log only fires for
-- username logins").
--
-- The login endpoint wants three facts about whatever the student typed, BEFORE
-- it hands anything to GoTrue: which user is this, what address do we sign in
-- with, and does that account actually have a password. Today it can only get
-- them for a handle:
--
--   * public.users has no email column, so an address cannot be resolved to a
--     user id from the public schema at all;
--   * get_login_email() (005) matches on u.username only, so an email in goes
--     nowhere;
--   * GoTrue's admin API cannot look a user up by address.
--
-- And the one student this check exists for — OTP verified, onboarding
-- abandoned — has username NULL (005 §9c leaves it NULL until onboarding), so
-- they can ONLY ever log in by email. The branch that logs the real reason was
-- therefore unreachable in practice for exactly the population it was written
-- for.
--
-- This function answers for BOTH identifier forms in one round trip, which also
-- collapses the two parallel lookups loginWithPassword currently does for a
-- handle (get_login_email + a users select) into a single call.
--
-- NOTHING about client-visible behaviour changes. The response is the same
-- generic INVALID_CREDENTIALS either way — see the revoke note below for why
-- that is not optional.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. get_login_identity(p_identifier)
--
-- Returns at most one row. Zero rows means "no account matches", which the
-- backend must treat identically to a wrong password.
--
-- Identifier form is decided the same way the controller decides it — anything
-- containing an '@' is an address — so the two can never disagree about which
-- lookup was performed. Folding (lower + trim) happens here as well as in JS:
-- the controller folds so the lockout ledger keys consistently, this folds so
-- the comparison is correct even if some future caller forgets.
--
-- auth.users.email is already stored lowercased by GoTrue, but the comparison
-- is written lower(au.email) anyway rather than trusting that: a case-sensitive
-- miss here would be an account that silently cannot log in.
--
-- has_password is read from public.users, NOT from auth.users.encrypted_password.
-- That column is the cache 005 §2 defined, and set-password / onboarding are the
-- only writers. Reading encrypted_password here would be a second source of
-- truth that could disagree with the one the rest of the app uses — and would
-- put a credential hash inside a function's result set for no reason.
--
-- LEFT JOIN, not JOIN: an auth user whose public.users row is missing (the
-- trigger dropped, a partial restore) must still resolve to an email so the
-- endpoint can sign them in and return its own 404, instead of looking like a
-- wrong password.
-- ---------------------------------------------------------------------------

create or replace function public.get_login_identity(p_identifier text)
  returns table (
    id           uuid,
    email        text,
    has_password boolean
  )
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $function$
  -- Email form. Matched case-insensitively on purpose. GoTrue normalises
  -- addresses to lowercase on signup, so `au.email = ident` would almost always
  -- work and would use the unique index — but "almost always" on the login path
  -- means a student who can never sign in and no way to tell why, and that is a
  -- worse outcome than a scan of auth.users on a table this size. Revisit with
  -- a functional index if auth.users ever gets large; do not "optimise" it by
  -- dropping the lower().
  select au.id,
         au.email::text,
         coalesce(u.has_password, false) as has_password
    from auth.users au
    left join public.users u on u.id = au.id
   where position('@' in lower(trim(coalesce(p_identifier, '')))) > 0
     and lower(au.email) = lower(trim(p_identifier))

  union all

  -- Handle form. Hits users_username_key directly.
  select u.id,
         au.email::text,
         coalesce(u.has_password, false) as has_password
    from public.users u
    join auth.users au on au.id = u.id
   where lower(trim(coalesce(p_identifier, ''))) <> ''
     and position('@' in lower(trim(coalesce(p_identifier, '')))) = 0
     and u.username = lower(trim(p_identifier))

   limit 1;
$function$;


-- ---------------------------------------------------------------------------
-- 2. Lock it down. THESE REVOKES ARE LOAD-BEARING.
--
-- Same reasoning as get_login_email() in 005, and one degree worse: this
-- function maps a public handle to a private email address AND discloses
-- whether an account exists at a given address at all. In the hands of anyone
-- holding the publishable key that is a mass harvest of the student body plus a
-- free "is this specific classmate on Yahora?" oracle — the harassment
-- precursor runbook §0.6 shapes the entire login endpoint to avoid.
--
-- FROM PUBLIC is required as well as FROM anon: Postgres grants EXECUTE to
-- PUBLIC by default and anon inherits it, so revoking only from anon leaves the
-- function wide open. docs/CURRENT_STATE.md item 2 records that we learned this
-- the hard way once already.
--
-- Only the backend's service_role client may call this.
-- ---------------------------------------------------------------------------

revoke execute on function public.get_login_identity(text) from public;
revoke execute on function public.get_login_identity(text) from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. Backfill users.has_password from the source of truth.
--
-- ⚠️ THIS IS NOT OPTIONAL, and it must ship with the function above.
--
-- has_password was added by 005 with `default false`, and 006 backfilled only
-- `username`. Nothing ever set the flag for accounts whose password already
-- existed in auth.users — the six named seed.sql logins and every seedDemo.js
-- persona. backend/API.md records the consequence: they read `false` while
-- having a perfectly good password.
--
-- Until now that was survivable, because the login endpoint could only read the
-- flag for a HANDLE, and an email login skipped the check and went straight to
-- GoTrue. Once get_login_identity() makes the flag readable for BOTH forms —
-- which is the entire point of this migration — a stale `false` stops being a
-- cosmetic wart and starts locking those accounts out of every login path.
--
-- So the cache gets reconciled with what it is a cache OF. encrypted_password
-- is read here and nowhere else; it never leaves the database.
--
-- Idempotent, and narrow on purpose: it only ever flips false → true for an
-- account that demonstrably has a password. It never clears the flag, because
-- a true with no encrypted_password would mean something wrote the cache
-- without going through set-password, and silently "fixing" that would hide it.
-- ---------------------------------------------------------------------------

update public.users u
   set has_password = true
  from auth.users au
 where au.id = u.id
   and au.encrypted_password is not null
   and au.encrypted_password <> ''
   and u.has_password is distinct from true;


-- ---------------------------------------------------------------------------
-- 4. get_login_email() is deliberately left in place.
--
-- It is not dropped: dropping it would break any deployed backend that has not
-- shipped the controller change yet, and a login outage is a bad trade for
-- removing one redundant function. It has exactly one caller today
-- (loginWithPassword, which this migration retires) and can be dropped in a
-- later migration once every environment is past it.
-- ---------------------------------------------------------------------------

comment on function public.get_login_identity(text) is
  'Resolves a username OR email to (id, email, has_password) for the login '
  'endpoint. Backend-only: revoked from PUBLIC, anon and authenticated. '
  'Supersedes get_login_email(), which handled handles only.';
