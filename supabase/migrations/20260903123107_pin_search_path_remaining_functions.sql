-- ============================================================================
-- 012. Pin search_path on the remaining public functions.
--
-- Completes the work of 20260903115437 (010), which pinned the five TRIGGER
-- functions a cascade from auth.users can reach. This one takes the other six:
-- every remaining function in the public schema that has no SET search_path and
-- is not owned by an extension. After this, nothing in public outside pg_trgm
-- is unpinned.
--
-- WHY, GIVEN NOTHING IS BROKEN TODAY
-- ----------------------------------
-- An unqualified table name is resolved against the CALLER's search_path. Two
-- of these six carry genuinely unqualified references:
--
--   get_user_inbox      -> messages, users, products
--   toggle_comment_vote -> comment_votes (x4)
--
-- Both come from 20260808143802_remote_schema.sql and predate the convention.
-- They work today only because their sole callers are the Express backend on
-- the service_role key, whose connection happens to have public on its path.
-- That is the same accident that hid the trigger bug until GoTrue — on a
-- connection WITHOUT public — hit it and account deletion started failing with
-- 42P01 for any user who had ever liked or commented. Nothing structural stops
-- another caller, another role or another service from reaching these two the
-- same way.
--
-- The other four already qualify every table they touch:
--
--   cleanup_auth_attempts -> public.auth_attempts
--   search_users          -> public.users, public.universities
--   suggest_usernames     -> public.universities
--   generate_username     -> no table references at all
--
-- They are included anyway, for the reason 010 included the two triggers that
-- were not broken: they are safe by how they happen to be written today, not by
-- construction. One future edit dropping a `public.` prefix reintroduces the
-- bug on a path nobody is watching. Pinning the category is cheap; rediscovering
-- it through a production failure is not.
--
-- SEARCH_PATH ONLY. NO SECURITY CHANGE.
-- -------------------------------------
-- All six stay SECURITY INVOKER and this migration does not touch prosecdef.
--
-- 20260903121302 (011) moved three trigger functions to SECURITY DEFINER, and
-- that was NOT a precedent to follow here. It was needed because the caller in
-- that path is GoTrue's supabase_auth_admin, a role with no grants on public
-- tables; DEFINER let those functions run as their owner instead. None of the
-- six below is ever invoked on a foreign role — they are called by the backend
-- on service_role, which already holds the grants it needs. Granting DEFINER
-- without that justification would widen privilege for nothing.
--
-- ALTER FUNCTION, not create or replace: it changes only the setting and cannot
-- touch a body, so byte-identical bodies are a property of the statement rather
-- than a promise about transcription. Same reasoning as 010 and 011.
--
-- Convention per §5 of 20260812121140_rls_stage1 (called migration 003 in code
-- comments):  set search_path = public, pg_temp
--
-- NOT IN THIS FILE, deliberately:
--   · The pg_trgm functions (gtrgm_*, similarity*, gin_*, show_trgm, set_limit)
--     are also unpinned. They belong to the extension, not to us. Excluded
--     structurally via pg_depend deptype 'e', not by name matching.
--   · No FK, cascade rule, trigger definition or RLS policy is altered.
--   · No body is corrected. get_user_inbox and toggle_comment_vote would both
--     read better with their table names qualified; that is a separate change
--     with separate testing, and folding it in here would defeat the point of
--     using ALTER.
--
-- SEPARATE FINDING, NOT ADDRESSED HERE
-- ------------------------------------
-- cleanup_auth_attempts() has no caller anywhere in the repository — not the
-- backend, not a script, not pg_cron. Either public.auth_attempts is growing
-- unbounded or a scheduled job was intended and never wired up. Flagged rather
-- than fixed; it is not a search_path problem.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Latent defects: unqualified table references. These two are the reason this
-- migration exists.
--
-- Origin for both: 20260808143802_remote_schema.sql.
-- ---------------------------------------------------------------------------

-- -> messages, users, products  (backend: messages.controller.js)
alter function public.get_user_inbox(uuid)                     set search_path = public, pg_temp;

-- -> comment_votes  (backend: products.controller.js)
alter function public.toggle_comment_vote(uuid, uuid, integer) set search_path = public, pg_temp;


-- ---------------------------------------------------------------------------
-- Already qualified. Pinned to close the category, not to fix a live bug.
--
-- Origin for all four: 20260815061951_usernames.sql (005).
-- ---------------------------------------------------------------------------

-- -> public.auth_attempts
alter function public.cleanup_auth_attempts()                  set search_path = public, pg_temp;

-- -> no table references; calls public.is_username_available()
alter function public.generate_username(text)                  set search_path = public, pg_temp;

-- -> public.users, public.universities  (backend: user.controller.js)
alter function public.search_users(text, uuid, integer)        set search_path = public, pg_temp;

-- -> public.universities  (backend: user.controller.js)
alter function public.suggest_usernames(text, uuid)            set search_path = public, pg_temp;
