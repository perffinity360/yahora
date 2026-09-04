-- ============================================================================
-- 010. Pin search_path on the trigger functions a cascade from auth.users
--      reaches.
--
-- THE BUG
-- -------
-- Deleting a row from auth.users fails outright:
--
--     ERROR: relation "products" does not exist (SQLSTATE 42P01)
--
-- surfacing through GoTrue as a 500 and the generic message
-- "Database error deleting user".
--
-- WHY
-- ---
-- auth.users cascades into public.users, and public.users cascades on into
-- products, product_likes, comments, comment_votes, messages, posts, purchases
-- and username_history. Those cascaded DELETEs fire row triggers, and three of
-- the trigger functions name public tables WITHOUT a schema qualifier —
-- `UPDATE products ...`, `UPDATE comments ...`.
--
-- An unqualified name is resolved against the CALLER's search_path. GoTrue
-- connects with its own search_path, which does not include `public`, so the
-- name resolves to nothing and the whole cascade aborts. The function is fine
-- when the same delete is issued from psql, where public IS on the path — which
-- is exactly why this hid for so long.
--
-- ⚠ THIS IS A PRODUCTION BUG, NOT A LOCAL SEEDING INCONVENIENCE.
--
-- It was found because backend/scripts/seedLocal.js could not delete its own
-- accounts on a re-run, but that is only the messenger. The same cascade runs
-- when a real student deletes their account: any user who has ever liked a
-- product, commented, or voted on a comment CANNOT BE DELETED in production.
-- Account deletion is a data-protection obligation, so this is not cosmetic.
-- See docs/deletion_data.md.
--
-- THE FIX
-- -------
-- Pin search_path on all five trigger functions reachable from an auth.users
-- cascade, per the convention in §5 of 20260812121140_rls_stage1 (referred to
-- as migration 003 in code comments):
--
--     set search_path = public, pg_temp
--
-- ALTER FUNCTION, deliberately, NOT create or replace. ALTER changes only the
-- setting and is structurally incapable of touching a function body, so
-- "the bodies are unchanged" is a property of the statement rather than a
-- promise about careful transcription. It also leaves every trigger definition
-- untouched — no drop, no recreate, no window where a trigger does not exist.
--
-- Three of the five are actively broken today; two are not, and are included
-- anyway. check_username_not_reserved and record_username_change fire only on
-- INSERT/UPDATE, never on DELETE, and their bodies already qualify every table
-- they touch. They are safe by coincidence of how they happen to be written
-- today, not by construction — one future edit that drops a `public.` prefix
-- would reintroduce exactly this bug on a path nobody is watching. Pinning all
-- five closes the category instead of the instance.
--
-- NOT IN THIS FILE, deliberately:
--   · get_user_inbox(uuid) has the same unqualified-`products` defect, but it
--     is a plain function that no cascade can reach. Same class, different
--     path; it needs its own change and its own testing.
--   · The pg_trgm functions (gtrgm_*, similarity*, gin_*) also lack a pinned
--     search_path. They belong to the extension, not to us.
--   · No FK, cascade rule, trigger definition or RLS policy is altered here.
--     The schema is correct. Only the functions were wrong.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Actively broken: these three fire on DELETE and use unqualified table names,
-- so each one on its own is enough to abort the cascade.
--
-- Origin for all three: 20260808143802_remote_schema.sql, which predates the
-- search_path convention.
-- ---------------------------------------------------------------------------

-- on product_likes (INSERT/DELETE) -> UPDATE products
alter function public.update_product_likes_count()    set search_path = public, pg_temp;

-- on comments (INSERT/DELETE) -> UPDATE products
alter function public.update_product_comments_count() set search_path = public, pg_temp;

-- on comment_votes (INSERT/DELETE/UPDATE) -> UPDATE comments
alter function public.update_comment_vote_counts()    set search_path = public, pg_temp;


-- ---------------------------------------------------------------------------
-- Not currently broken, pinned to close the category. Both fire on
-- INSERT/UPDATE of public.users only — never on DELETE — and both already
-- schema-qualify the tables they read and write.
--
-- Origin for both: 20260815061951_usernames.sql (005).
-- ---------------------------------------------------------------------------

-- on users (INSERT/UPDATE) -> reads public.reserved_usernames
alter function public.check_username_not_reserved()   set search_path = public, pg_temp;

-- on users (UPDATE) -> writes public.username_history
alter function public.record_username_change()        set search_path = public, pg_temp;
