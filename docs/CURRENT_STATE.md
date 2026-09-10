# Current state — rewritten 25 Aug 2026

Supersedes the 11 Aug version entirely. That one was written before migrations 003–007
shipped and had drifted badly: it claimed RLS was off on all 13 production tables, that
`performance_and_grants` and `rls_stage1` were unpushed, and that nothing created
`public.users` rows except JavaScript. **All three were wrong by the time it was read.**

Every claim below was **re-verified against both databases on 25 Aug 2026** unless the line
says otherwise. Anything carried over unverified is marked `[not re-verified]`.

Re-check any of it with:

```bash
PROD_DB_URL_FILE=/path/outside/the/repo node backend/scripts/schema-drift.mjs
```

---

## Migrations — 8 files, all applied to BOTH local and production

| # | File | Local | Production |
|---|---|---|---|
| 001 | `20260808143802_remote_schema` | ✅ | ✅ |
| 002 | `20260808144138_storage_policies` | ✅ | ✅ |
| — | `20260809141828_performance_and_grants` | ✅ | ✅ |
| 003 | `20260812121140_rls_stage1_backend_only_tables` | ✅ | ✅ |
| 005 | `20260815061951_usernames` | ✅ | ✅ |
| 006 | `20260815072147_username_backfill` | ✅ | ✅ |
| 007 | `20260823055415_login_identity` | ✅ | ✅ **25 Aug 15:28** |
| 004 | `20260823140202_rls_stage2_users_messages` | ✅ | ✅ **25 Aug 15:30** |

`supabase_migrations.schema_migrations` ends at `20260823140202` on both. **Zero drift** —
`schema-drift.mjs` reports 10/10 MATCH across ledger contents, `relrowsecurity`, policies and
`anon`/`authenticated` grants for `public.users`, `public.messages` and `storage.objects`.

Numbers 001–007 are conversational labels and do **not** sort the same as the timestamps.
004 has a later timestamp than 005/006/007 and applies last. Timestamps decide order; do not
rename anything to force a sequence.

`20260808143802_remote_schema.sql` is still MANUALLY EDITED from the original `db pull`
(removed spurious `DROP EXTENSION pg_net` / `pg_graphql`, `IF NOT EXISTS` guard on
`CREATE ROLE supabase_privileged_role`, quoted `"domain"`). Cause was a stale local Postgres
image. Do not regenerate it.

---

## Security posture — what is actually locked down

**Row Level Security: all 16 public tables have `relrowsecurity = true`** on both databases.
Three carry policies; the other 13 have RLS on with **no policy**, which is deliberate — they
are backend-only, reached solely through the service-role key, and a policy-less table denies
every row to `anon` and `authenticated`.

| Table | Policy | Effect |
|---|---|---|
| `public.users` | `users_select_own` — `authenticated`, `id = (select auth.uid())` | own row only |
| `public.messages` | `messages_select_own` — `authenticated`, `sender_id = uid OR receiver_id = uid` | own threads only |
| `public.visitor_metrics` | 1 policy (from 003) | footer counter |

`anon` has **no `SELECT`** on `users` or `messages`. It fails loudly with
`permission denied for table users`, not silently with an empty set.

Verified on production with a real student JWT: own user rows **1**, own messages **82**.
As `anon`: `permission denied` on both. As `service_role`: 112 users / 141 messages.

**Functions reachable by `anon` / `authenticated`** — exactly two, both deliberate:

```
increment_page_view       <- anon, authenticated   (SECURITY DEFINER, footer, logged-out)
increment_product_views   <- anon, authenticated   (SECURITY DEFINER, ProductCard, logged-out)
```

`get_login_email`, `get_login_identity`, `is_username_available`, `suggest_usernames`,
`generate_username` and `search_users` are **not** reachable by either role. The 11 Aug lesson
— `REVOKE ... FROM anon` is useless without `FROM PUBLIC`, because Postgres grants EXECUTE to
PUBLIC by default and `anon` inherits it — is applied correctly in 005 and 007.

**Realtime:** `public.messages` is the only table in the `supabase_realtime` publication.
`Messages.jsx:352` and mobile `RealtimeContext.tsx:181` subscribe **unfiltered**;
`messages_select_own` is what makes that safe, because Realtime re-checks the SELECT policy
per row. If `public.products` is ever added to the publication it needs a SELECT policy in the
same migration.

---

## Known open issues, in priority order

### 1. 🚨 `PUT /api/users/:userId/profile` — arbitrary target, arbitrary columns

`user.routes.js:36` has **no `requireAuth`**, and the handler spreads `req.body` wholesale
into `.update()`. Anyone who knows a UUID can rewrite any student's row — including
`username`, `has_password`, `is_profile_complete` and `university_id`. Stealing a handle or
moving a student to another campus are both one request.

This is the worst remaining hole in the backend. **`OWNER: Neeraj`** — it is his file and his
call, but it should not wait.

### 2. 🚨 Unauthenticated writes — the rest of the CC-4 audit

`requireAuth` is now on 8 routes. These still take their actor from the request:

| Module | Open routes |
|---|---|
| products | `POST /` (createProduct), `POST /:id/comments`, `POST /comments/:commentId/vote`, `POST /:id/sold`, `POST /:id/available` |
| messages | `GET /inbox/:userId`, `POST /send`, `PUT /read`, `PUT /deliver` |
| user | `GET /:userId/dashboard`, `PUT /:userId/profile`, `POST /:userId/avatar`, `GET /:userId/public` |

`POST /send` is the notable one: it reads `sender_id` from the body and the campus check reads
the *claimed* sender's row, so it validates nothing. Full audit in `docs/CHANGELOG.md`
(2026-08-20, CC-4 Part A).

### 3. `products.views` is incremented by two independent paths

`frontend/src/components/ProductCard/ProductCard.jsx:506` (direct RPC from the browser) and
`backend/src/modules/products/products.controller.js:352` (on `GET /products/:id`). Different
rules, no coordination, so the count is not meaningful. Pick one.

### 4. No pagination anywhere

**`.range()` has 0 call sites** across `backend/src`, `frontend/src`, `mobile/src` and
`mobile/app`. Every list endpoint returns the whole table. `backend/CLAUDE.md` requires
`limit` capped at 50 on new endpoints; nothing existing honours it.

### 5. `avatars` bucket has no SELECT or DELETE policy

INSERT was narrowed to `authenticated` by 004 (was `anon, authenticated`). There is still no
SELECT and no DELETE policy — reads work only because the bucket is `public = true`, and
nothing can delete an old avatar through RLS. Partially resolved; the other half is open.

### 6. `increment_product_likes` / `decrement_product_likes` are dead

0 callers in `backend/src`, `frontend/src` or `mobile`. The counter is maintained by
`trg_update_likes_count`. Drop them in a future migration.

### 7. `utils/notify.js` writes to a table that does not exist

`public.notifications` is absent from both databases. `notify()` is wrapped so a failure never
breaks the calling action, so this fails silently today. Phase 5 work.

### 8. `backend/API.md:2448` is wrong about `increment_page_view()`

It says *"the RPC and table exist; nothing calls it."* `frontend/src/components/footer/footer.jsx:56`
calls it on every page load. One-line doc fix.

### 9. 👁️ Block G5 browser verification is outstanding

004 is applied and verified in SQL (G4) and by re-push (G6), but **G5 has not been done**: two
real accounts in two browser profiles on the live site, checking different message counts, live
chat between them, and the marketplace campus switcher for a logged-in student. That last one is
the `users` read 004 narrows. This needs a human; it cannot be done from a Claude session.

---

## Recently resolved — do not re-open these

| Was | Status |
|---|---|
| RLS disabled on all 13 production tables; `GRANT ALL` to `anon` | ✅ **Resolved.** 16/16 tables have RLS; `anon` lost `SELECT` on `users`/`messages` (003 + 004, 25 Aug) |
| `REVOKE ... FROM anon` on functions does not work | ✅ **Resolved as a pattern.** 005/007 use `FROM PUBLIC` as well; verified only the two intended functions are anon-reachable |
| `messages.controller.js` `.or()` filter injection | ✅ **Fixed 23 Aug.** Anchored uuid regex before the filter string, plus a participation check and `requireAuth`. Was confirmed exploitable first |
| `products.controller.js` like/save took `user_id` from the body | ✅ **Fixed 23 Aug.** Actor is `req.user.id`; body value ignored; campus check added |
| `updateProduct` / `deleteProduct` had no ownership check | ✅ **Fixed 23 Aug.** `requireAuth` + `seller_id === req.user.id` |
| Production RLS enabled with no policies (silent zero reads) | ✅ **Fixed 25 Aug.** 004 applied — see `docs/PROD_RECONCILIATION.md` |
| All 112 production accounts had `has_password = false` with a real password | ✅ **Fixed 25 Aug.** 007's backfill; password login works on production for the first time |
| Seeded accounts could never log in with a password | ✅ **Fixed 25 Aug.** `seed.sql` and `seedDemo.js` now write `has_password = true` (migrations run before `seed.sql`, so 007's backfill could never reach seed rows) |
| `mobile/.env` API base URL vars commented out | ✅ **Not an issue.** `EXPO_PUBLIC_API_URL` is intentionally unset for local dev — the app auto-detects. `EXPO_PUBLIC_SUPABASE_URL` is set |
| `POST /api/auth/demo-login` returned 500 on every call | ✅ **Fixed 20 Aug** (CC-4) |
| First-time signup landed on `/` instead of `/onboarding` | ✅ **Fixed 23 Aug.** Render-ordering race in `GuestOnly` |
| Chat history blanked on reopen; 9 like/save call sites 401ing | ✅ **Fixed 25 Aug.** Missing `Authorization` header from the §1.6 change |

---

## Facts established by audit

- **`on_auth_user_created` EXISTS on `auth.users`** and creates the `public.users` row inside
  the auth insert's own transaction. ⚠️ The 11 Aug version of this file said *"No trigger on
  auth.users"* — that was true when written and became false with migration 005. Any JS that
  creates a `public.users` row must be an **upsert on `id`**.
- **Zero schema drift between local and production** across the compared surface, verified
  25 Aug by `backend/scripts/schema-drift.mjs`.
- **No `service_role` key in `frontend/` or `mobile/`.** Both use the publishable key only.
  Re-verified 25 Aug.
- The backend uses the **service-role key**, so every backend query **bypasses RLS**. RLS is
  not a backstop for backend routes — the controller is the only control. Identity must come
  from `req.user.id`, never from the request body or path.
- Production carries **112 users / 141 messages**; local seed carries 11 users.
- `toggleLikeProduct` does not double-count — the trigger owns the counter. `[not re-verified]`
- The fixed `c0000000-…-0001` (B.Tech) and `d0000000-…-0002` (Mechanical Engineering) seed ids
  still do not exist after a reset; legacy no-id inserts claimed those names first. Do not
  hardcode them. `[not re-verified]`

---

## Ownership

- **Vishwajeet** (MacBook): the database exclusively, shared backend infra, `posts`, `admin`,
  `products`, `auth`, `messages`, `university`, `academic`, and the mobile app. Only he writes
  files under `supabase/migrations/` and only he runs anything touching production.
- **Neeraj** (Macbook): the website, plus the `user`, `social`, `notifications` and `reports`
  backend modules.

Authoritative file-by-file map: `backend/CLAUDE.md`. Every file under `backend/src/modules/`
carries an `OWNER:` banner.

---

## Credential hygiene — open

- **`cache.md` is a tracked file** that has held the production connection string, password
  included, in the working tree. It is empty and matches `HEAD` right now, and the password is
  **not** in committed history — but anything written into it later is one `commit -a` from
  being published. Suggested: `git rm --cached cache.md` plus a `.gitignore` entry, and rotate
  the database password on the assumption a plaintext copy sat in a repo with a remote.
- The production dumps (`prod-backup-data.sql`, `prod-backup-schema.sql` — 112 real emails and
  112 bcrypt hashes) **have been moved to `~/yahora-backups/`, outside the repo.** ✅ Resolved.
  There are no automated backups on this project (free tier), so keep taking them — just not
  inside the repository.
