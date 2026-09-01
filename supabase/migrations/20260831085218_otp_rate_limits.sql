-- ============================================================================
-- Migration 008 — OTP request ledger and the two cleanup jobs
--
-- Everything in this file exists to answer one question cheaply, on every
-- single call to POST /api/auth/request-otp: "how many OTPs have already been
-- asked for, and by whom?" Runbook Part 2.2 works through why that question
-- cannot be answered with an IP address — campus Wi-Fi puts an entire college
-- behind one NAT address, so an IP limit locks out IIITDM Kurnool by
-- mid-morning. The answer is a ledger table, counted three different ways.
--
-- The second half of the file is the part that actually stops fake accounts,
-- and it is not a rate limit at all. Runbook Part 2.3: signInWithOtp with
-- shouldCreateUser:true creates the auth.users row when the code is REQUESTED,
-- so a rate limit only slows the mess down. cleanup_unverified_users() is what
-- removes it.
--
-- Consumed by CC-3 (backend/src/modules/auth/auth.controller.js for the four
-- checks, backend/src/utils/cronJobs.js for the two jobs). No SQL here is
-- reachable from frontend/ or mobile/, by design — see §2 and §5.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. The ledger.
--
-- One row per accepted OTP request. The rate limits are then just `count(*)`
-- over a rolling window, which is the whole reason this is a table and not a
-- counter: a counter has to be reset, and a reset boundary is what makes a
-- calendar-day limit unfair (runbook 2.2 — the student who hits the cap at
-- 11:50pm waits ten minutes, the one who hits it at 12:10am waits a day).
-- Rows expire on their own, so "the last 24 hours" is always literally true.
--
-- email is stored as the backend lowercases it, but every read still folds
-- with lower() and the index below matches that — see §1a.
--
-- device_id is nullable and stays nullable. The mobile app sends no
-- X-Device-Id header today and must keep working exactly as it does now, so
-- "no device id" is a normal, expected row, not a defect. It is also untrusted
-- input the browser makes up about itself: it is validated for shape in the
-- controller and is worth exactly what runbook 2.2 says it is worth — it stops
-- accidental loops and lazy scripts, and nothing more. No constraint here
-- pretends otherwise.
--
-- ip_address is RECORDED AND NEVER ACTED ON. This is deliberate and it is the
-- one line in this file most likely to be "improved" by a future reader. It is
-- here so that if 1,400 requests ever arrive from one address in an hour we
-- can see that in the data. It must never appear in a WHERE clause that
-- decides whether to refuse a request. See runbook 2.2, "the NAT trap".
--
-- No foreign key to auth.users on purpose: the whole point is to record
-- requests for addresses that have no account and never will.
-- ---------------------------------------------------------------------------

create table if not exists public.otp_requests (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  device_id  text,
  ip_address text,
  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- 1a. The three indexes.
--
-- All three are read on EVERY otp request, before Supabase is called at all.
-- They are not "nice to have later" — without them the rate limiter turns a
-- login into a sequential scan of a table that grows with every attack, which
-- is precisely backwards.
--
-- Each is (key, created_at desc) rather than (key) alone because every query
-- is a rolling window: count the rows for this key since a cutoff, and read
-- the newest (cooldown) or oldest (when a slot frees up) row in it. The
-- descending timestamp lets one index serve the count and both endpoints.
--
-- The device index is PARTIAL. Requests from the mobile app carry no device
-- id, so a plain index would fill up with nulls that no query ever looks for —
-- the lookup is always `where device_id = $1`, which never matches null. The
-- WHERE clause keeps the index proportional to browser traffic instead of
-- total traffic.
--
-- The third index has no key column at all, and that is not a mistake. It
-- serves the circuit breaker in CC-3, which counts ALL requests in the last
-- hour regardless of email, device or address (runbook 2.4). That query has no
-- equality predicate to index — the timestamp range IS the whole query.
-- ---------------------------------------------------------------------------

create index if not exists otp_requests_email_created_idx
  on public.otp_requests (lower(email), created_at desc);

create index if not exists otp_requests_device_created_idx
  on public.otp_requests (device_id, created_at desc)
  where device_id is not null;

create index if not exists otp_requests_created_idx
  on public.otp_requests (created_at desc);


-- ---------------------------------------------------------------------------
-- 2. RLS on, zero policies. Same pattern as migration 003 §3.
--
-- DELIBERATE: THE ABSENCE OF POLICIES IS THE SECURITY MODEL HERE. If you are
-- reading this because something client-side got a permission error, the fix
-- is to route that call through the Express backend, NOT to add a policy.
--
-- RLS enabled with no matching policy denies everything. service_role holds
-- BYPASSRLS, so the backend is completely unaffected; it is the only thing
-- that ever touches this table. Nothing in frontend/ or mobile/ reads it, and
-- nothing should: the rows are a log of which addresses asked for a code,
-- which is a list of who is on Yahora and when they signed in. That is the
-- same disclosure runbook §0.6 shapes the entire login endpoint to avoid.
--
-- No grants either. Migration 003 revoked the baseline's default privileges on
-- future tables from anon and authenticated, so this table is born with none —
-- the RLS above is the second lock on the same door, not the only one.
-- service_role keeps its own default grant from the baseline, which is why the
-- backend needs nothing added here.
-- ---------------------------------------------------------------------------

alter table public.otp_requests enable row level security;

comment on table public.otp_requests is
  'Ledger of OTP requests, one row each, used for rate limiting and the '
  'hourly circuit breaker. Backend-only: RLS on with ZERO policies, on '
  'purpose — do not add one. ip_address is recorded for forensics and must '
  'never gate a request (campus NAT). See migration 008 and runbook 2.2.';


-- ---------------------------------------------------------------------------
-- 3. cleanup_unverified_users() — the thing that actually stops fake accounts.
--
-- The mechanism is not obvious, so: signInWithOtp({ shouldCreateUser: true })
-- creates the auth.users row THE MOMENT THE CODE IS REQUESTED, not when it is
-- verified, and the handle_new_user trigger from migration 005 immediately
-- mirrors it into public.users. So a script hitting request-otp with
-- xyz001@iiitk.ac.in through xyz999@iiitk.ac.in leaves 999 accounts behind,
-- and not one of those people ever received a code, let alone entered one.
--
-- email_confirmed_at is GoTrue's own record of "somebody entered a valid
-- code". It stays null until then. So an unconfirmed row past its window is,
-- by definition, an account nobody ever proved they owned.
--
-- public.users needs no mention here: the ON DELETE CASCADE from Phase 1
-- removes the mirrored row automatically, and everything hanging off it goes
-- with it.
--
-- ⚠️ THE 24 HOURS IS LOAD-BEARING. Do not shorten it. Picture a student who
-- requests a code at 6pm, shuts the laptop, and comes back after dinner at
-- 9pm — on a 2-hour window their account is gone and nothing explains why. 24
-- hours is comfortably longer than any honest delay while still keeping junk
-- short-lived. Below 6 hours you are deleting real students.
--
-- Returns the number of rows deleted rather than void (which is what the older
-- cleanup_demo_users does) so the hourly cron job in cronJobs.js can log what
-- it actually did. A job that logs nothing is a job you cannot tell has
-- stopped running.
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_unverified_users()
  returns integer
  language sql
  security definer
  set search_path = public, pg_temp
as $function$
  with deleted as (
    delete from auth.users
     where email_confirmed_at is null
       and created_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::integer from deleted;
$function$;


-- ---------------------------------------------------------------------------
-- 4. cleanup_otp_requests() — housekeeping.
--
-- The widest window any limit in CC-3 asks about is 24 hours, and the circuit
-- breaker only looks back one. Seven days therefore keeps a comfortable margin
-- for reading the table by hand after an incident, and everything older is
-- dead weight that only makes the three indexes above bigger and slower.
--
-- Nothing depends on these rows surviving, so this is the safe half of the
-- pair: the worst case for deleting too much here is a shorter forensic trail,
-- not a locked-out student.
--
-- Returns the deleted count for the same reason as §3.
-- ---------------------------------------------------------------------------

create or replace function public.cleanup_otp_requests()
  returns integer
  language sql
  security definer
  set search_path = public, pg_temp
as $function$
  with deleted as (
    delete from public.otp_requests
     where created_at < now() - interval '7 days'
    returning 1
  )
  select count(*)::integer from deleted;
$function$;


-- ---------------------------------------------------------------------------
-- 5. Lock both functions down. THESE REVOKES ARE LOAD-BEARING.
--
-- FROM PUBLIC is required as well as FROM anon. Postgres grants EXECUTE to
-- PUBLIC by default on every new function and anon inherits it, so revoking
-- only from anon leaves the function wide open to anyone holding the
-- publishable key. This repo has already learned that twice — get_login_email
-- in 005 §8 and get_login_identity in 007 §2. Do not drop the PUBLIC line.
--
-- service_role is unaffected: the baseline's ALTER DEFAULT PRIVILEGES grants
-- it EXECUTE on routines in its own right, not through PUBLIC, so the cron
-- jobs keep working.
--
-- cleanup_unverified_users is the dangerous one, and it deserves a moment of
-- attention. It is SECURITY DEFINER and it runs DELETE FROM auth.users. An
-- exposed execute grant on it is a button that lets anyone with the
-- publishable key destroy every account that has not confirmed yet — which,
-- during launch week, is a meaningful fraction of the people who just signed
-- up. It takes no arguments, so there is no input validation standing between
-- a caller and that DELETE. The revoke IS the validation.
-- ---------------------------------------------------------------------------

revoke execute on function public.cleanup_unverified_users() from public;
revoke execute on function public.cleanup_unverified_users() from anon, authenticated;

revoke execute on function public.cleanup_otp_requests() from public;
revoke execute on function public.cleanup_otp_requests() from anon, authenticated;

comment on function public.cleanup_unverified_users() is
  'Deletes auth.users rows never confirmed and older than 24 hours; '
  'public.users cascades. Returns rows deleted. Backend-only: revoked from '
  'PUBLIC, anon and authenticated. The 24h window is load-bearing — see '
  'migration 008 §3 and runbook 2.3 before shortening it.';

comment on function public.cleanup_otp_requests() is
  'Prunes public.otp_requests rows older than 7 days. Returns rows deleted. '
  'Backend-only: revoked from PUBLIC, anon and authenticated.';
