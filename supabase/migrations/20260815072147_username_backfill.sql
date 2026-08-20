-- ============================================================================
-- Migration 006 — username backfill
--
-- Every user who completed onboarding before migration 005 has username = NULL.
-- This gives each of them a handle, and only THEN adds the constraint making a
-- handle mandatory — the ordering 005 deliberately left open, because adding
-- that constraint before the backfill passes locally (empty table) and fails on
-- production (existing completed users with NULL handles).
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Backfill — one UPDATE per row.
--
-- DO NOT "OPTIMISE" THIS INTO A SINGLE UPDATE. A single statement sees a
-- snapshot taken before it started, so for two students both named "Rahul
-- Sharma" generate_username() reads that same stale snapshot twice and returns
-- rahul.sharma both times — the unique index then rejects the statement and
-- rolls back EVERY row, including the thousands that were fine. One UPDATE per
-- row means iteration 2 sees what iteration 1 wrote and returns rahul.sharma.7402.
--
-- Only completed profiles are touched. A student mid-signup picks their own
-- handle at onboarding; 005's handle_new_user trigger leaves it NULL until then.
--
-- Note what does NOT happen here: trg_record_username_change is a BEFORE UPDATE
-- OF username trigger, but its body is guarded on `old.username is not null`.
-- Every row below has a NULL old handle, so no username_history row is written
-- and username_changed_at stays NULL. That is correct — a backfilled handle is
-- an assignment, not a change, and it must not start the student's 30-day
-- rename clock before they have even seen their own username.
-- ---------------------------------------------------------------------------

do $$
declare
  r            record;
  new_username text;
begin
  for r in select id, full_name
             from public.users
            where username is null
              and is_profile_complete = true
  loop
    new_username := public.generate_username(coalesce(r.full_name, 'student'));

    update public.users
       set username = new_username
     where id = r.id;
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 2. Now — and only now — a handle becomes mandatory for a completed profile.
--
-- This is the constraint 005 deliberately omitted. With the backfill above
-- already committed in the same migration, every existing row satisfies it, so
-- the ALTER validates cleanly against production data.
--
-- From here the invariant is the database's, not the backend's: no code path
-- can mark a profile complete without a handle, on any surface, ever.
--
-- One gap worth knowing rather than discovering: users.is_profile_complete is
-- nullable (boolean DEFAULT false, no NOT NULL). For a row where it is NULL,
-- this expression evaluates to NULL, and a CHECK constraint accepts NULL — so
-- such a row may hold a NULL handle. The backfill's `= true` filter skips those
-- same rows, so the two agree and nothing fails. Making the column NOT NULL is
-- a separate migration and a separate decision.
-- ---------------------------------------------------------------------------

alter table public.users add constraint users_username_required_when_complete check (
  is_profile_complete = false or username is not null
);


-- ---------------------------------------------------------------------------
-- 3. Normalise has_password.
--
-- Defensive. 005 added the column as `boolean not null default false`, so no
-- row can hold NULL and none can be wrong — but `is distinct from true` is the
-- null-safe form, and plain `<> true` would skip NULLs, which is exactly the
-- case this exists to catch if the column is ever relaxed.
--
-- Note it matches false as well as NULL, so this REWRITES EVERY ROW that is not
-- already true — today, all of them — setting each to the value it already
-- holds. Harmless (no trigger fires; trg_record_username_change is scoped to
-- UPDATE OF username), but on a large users table it is a full-table rewrite
-- and the dead tuples it leaves behind want an autovacuum pass.
-- ---------------------------------------------------------------------------

update public.users
   set has_password = false
 where has_password is distinct from true;
