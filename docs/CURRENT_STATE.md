# Current state — updated 11 Aug 2026

## Migrations (supabase/migrations/)
- 20260808143802_remote_schema.sql — production baseline captured via `db pull`.
  MANUALLY EDITED: removed spurious `DROP EXTENSION pg_net` / `pg_graphql`,
  wrapped `CREATE ROLE supabase_privileged_role` in an IF NOT EXISTS guard,
  quoted `"domain"` in universities_domain_key. Cause: stale local Postgres
  image on the Mac when the diff was generated.
- 20260808144138_storage_policies.sql — Phase 0 storage hardening. Applied to prod.
- 20260809141828_performance_and_grants.sql — 19 performance indexes + grant
  fixes. NOT yet pushed to production.

## Known open issues, in priority order
1. RLS is disabled on all 13 public tables in production, and `GRANT ALL`
   is given to `anon` on every one. Anon key is public (it ships in the JS
   bundle). This is the top priority. → migration 003.
2. `REVOKE ... FROM anon` on functions does not work — PostgreSQL grants
   EXECUTE to PUBLIC by default and anon inherits it. Needs `FROM PUBLIC`.
3. ~~messages.controller.js:35 — unvalidated query params interpolated into a
   PostgREST `.or()` filter expression.~~ ✅ FIXED 2026-08-23. All three params
   validated against an anchored uuid regex before reaching the filter, plus a
   participation check (req.user.id must be one of the two parties) and
   requireAuth. Confirmed exploitable before the fix — see docs/CHANGELOG.md.
4. ~~products.controller.js:296 — `user_id` read from req.body instead of the
   auth token. Same pattern in the save/unsave handlers.~~ ✅ FIXED 2026-08-23.
   Actor is req.user.id on both like and save; body `user_id` ignored. Also
   added the §1.6 Bug 2 campus check and ownership checks on
   updateProduct/deleteProduct. Remaining actor-from-request handlers (create,
   comments, votes, sold/available, messages send/read/deliver, inbox) are
   still open — see the CC-4 audit in docs/CHANGELOG.md.
5. products.views is incremented by two independent paths with different rules
   (frontend ProductCard.jsx:506 and backend products.controller.js:237).
6. No pagination anywhere — `.range()` is never called in any package.
7. mobile/.env has the API base URL vars commented out.
8. `avatars` storage bucket accepts INSERT from anon; has no SELECT or DELETE policy.
9. increment_product_likes / decrement_product_likes have zero callers — dead.
10. utils/notify.js writes to a `notifications` table that does not exist yet.
11. backend/API.md:2082 incorrectly says nothing calls increment_page_view().

## Facts established by audit
- Zero structural drift between production and the baseline migration.
- No trigger on auth.users. public.users rows are created only by JavaScript:
  auth.controller.js:94-102 (verifyOtp), auth.controller.js:222-230 (demoLogin),
  seedDemo.js:841. Only id, university_id, is_profile_complete are written.
- toggleLikeProduct does NOT double-count likes — the trigger handles it.
- No service_role key in frontend/ or mobile/. Both use the anon key only.

## Ownership
- Vishwajeet (MacBook): database exclusively, shared backend infra, posts module,
  admin module, mobile app. Only he writes files under supabase/migrations/.
- Neeraj (Ubuntu): website, plus the user, social, notifications and reports
  backend modules.