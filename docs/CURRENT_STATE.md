# Current state — rewritten 15 Sep 2026, corrected 13 Oct 2026

> **13 Oct 2026 correction pass, at commit `46c8fb0` (Phase 6B, Day 2).** Only claims that the
> repository now contradicts were changed: the migration list (14 → 18 files), open issue 1
> (pagination shipped in Phase 4), file:line references that moved, `PRODUCTION_ORIGINS`,
> `cache.md`, the stale-docs note, and the ownership loan. Everything else is still the 15 Sep
> text. This file has **no** summary of what Phases 4, 5 and 6A shipped; read
> `docs/changelog/` and the phase runbooks for that.

Supersedes the **25 Aug 2026** version entirely. That one was written before Phase 2 and
Phase 3 shipped and had drifted in **both** directions: it listed 8 migrations when there are
14, it carried the `PUT /api/users/:userId/profile` hole as the worst open issue when it is
fixed, it listed nine unauthenticated write endpoints in `products` and `messages` that are
**all** authenticated today, and it asked for a migration to drop two dead RPCs that migration
003 had already dropped. In the other direction, everything it said about production — row
counts, drift, live RLS state — was true on 25 Aug and **cannot be re-checked from this
session**, so it is carried with a marker rather than as fact.

**What "verified" means in this file.** Every claim below was re-read out of the repository
working tree on 15 Sep 2026, at commit `a7ad212` (branch `neeraj`, level with `main`). Claims
that require a database connection — production row counts, whether local and production
actually match, what `relrowsecurity` is set to on a live table — were **not** re-checked;
this session has no production access and the project's hard rules forbid it. Those lines are
marked `[not re-verified]`. A migration file proves what was *written*, not what is *applied*.

Re-check the database half with (Vishwajeet only, needs the production password):

```bash
PROD_DB_URL_FILE=/path/outside/the/repo node backend/scripts/schema-drift.mjs
```

---

## Migrations — 18 files in `supabase/migrations/`

Applied state is `[not re-verified]` for every row: the filenames are verifiable from the
repo, the ledger is not.

| # | File | Landed in |
|---|---|---|
| 001 | `20260808143802_remote_schema` | Phase 0 |
| 002 | `20260808144138_storage_policies` | Phase 0 |
| — | `20260809141828_performance_and_grants` | Phase 0 |
| 003 | `20260812121140_rls_stage1_backend_only_tables` | Phase 0 |
| 005 | `20260815061951_usernames` | Phase 1 |
| 006 | `20260815072147_username_backfill` | Phase 1 |
| 007 | `20260823055415_login_identity` | Phase 1 |
| 004 | `20260823140202_rls_stage2_users_messages` | Phase 1 |
| 008 | `20260831085218_otp_rate_limits` | Phase 2 |
| 009 | `20260831095101_username_no_double_separator` | Phase 2 |
| 010 | `20260903115437_pin_search_path_cascade_triggers` | Phase 2 |
| 011 | `20260903121302_counter_triggers_security_definer` | Phase 2 |
| 012 | `20260903123107_pin_search_path_remaining_functions` | Phase 2 |
| 013 | `20260910171153_universities_expansion` | Phase 3 |
| 015 | `20260915070505_inbox_pagination` | Phase 4 |
| 016 | `20260916072324_suggest_usernames_bounded_topup` | Phase 4 |
| 017 | `20260919093440_search_users_full_name_cast` | Phase 4 bug, committed 19 Sep |
| 018 | `20261001122844_search_demo_isolation` | Phase 6A (V-A) |

**There is no 014.** No migration header carries that number; the labels jump from 013 to 015.
That is a numbering gap, not a missing file.

The four added since 15 Sep, from their headers. None of them creates a table, enables RLS or
adds a policy:

- **015 `inbox_pagination`** — `get_user_inbox()` gains `p_limit` and `p_cursor`. It drops the
  one-argument function rather than `CREATE OR REPLACE`, because two overloads make the
  one-argument call ambiguous.
- **016 `suggest_usernames_bounded_topup`** — bounds the top-up loop in
  `suggest_usernames()`, which spun until the statement timeout for the first student with a
  given name.
- **017 `search_users_full_name_cast`** — casts `full_name` to `text` in `search_users()`.
  Every search that matched a row used to return 500 (`42804`).
- **018 `search_demo_isolation`** — `universities.is_demo` (a generated column) and a
  `search_users()` that keeps demo accounts and real students apart. If the viewer can't be
  identified, it returns zero rows.

The 25 Aug file listed only the first eight. The six new ones are numbered 008–013 in their
own headers; **013 is the fourteenth file**, because `performance_and_grants` never took a
conversational number.

What the six new ones do, from their headers:

- **008 `otp_rate_limits`** — `public.otp_requests` ledger plus two cleanup jobs. Counts OTP
  requests three ways deliberately: campus Wi-Fi puts a whole college behind one NAT address,
  so an IP-based limit would lock out an entire university by mid-morning.
- **009 `username_no_double_separator`** — closes the `rahul.sharma` / `rahul..sharma`
  impersonation pair that 005 knowingly allowed and deferred to Phase 8 moderation.
- **010 `pin_search_path_cascade_triggers`** — deleting a row from `auth.users` failed with
  `relation "products" does not exist`, surfacing through GoTrue as "Database error deleting
  user". Pins `search_path` on the five trigger functions that cascade reaches.
- **011 `counter_triggers_security_definer`** — the same delete then failed with
  `permission denied for table products`. `SECURITY DEFINER` on the three counter triggers.
- **012 `pin_search_path_remaining_functions`** — the other six public functions. After it,
  nothing in `public` outside `pg_trgm` is unpinned.
- **013 `universities_expansion`** — the `is_active` column and the core institution set,
  loaded inactive. See Phase 3 below.

Numbers 001–018 are conversational labels and do **not** sort the same as the timestamps. 004
has a later timestamp than 005/006/007 and applies after them. Timestamps decide order; do not
rename anything to force a sequence.

`20260808143802_remote_schema.sql` is still MANUALLY EDITED from the original `db pull`
(removed spurious `DROP EXTENSION pg_net` / `pg_graphql`, `IF NOT EXISTS` guard on
`CREATE ROLE supabase_privileged_role`, quoted `"domain"`). Cause was a stale local Postgres
image. Do not regenerate it.

---

## Security posture

### Row Level Security — what the migrations declare

Counted from `alter table ... enable row level security` across all 18 files (015–018 add
none): **17 public
tables**, one more than the 16 the 25 Aug file reported, because `public.otp_requests` arrived
with 008.

| Migration | Tables it enables RLS on |
|---|---|
| 003 | `universities`, `courses`, `specializations`, `products`, `product_likes`, `product_saves`, `purchases`, `comments`, `comment_votes`, `posts`, `visitor_metrics` (11) |
| 004 | `users`, `messages` (2) |
| 005 | `reserved_usernames`, `username_history`, `auth_attempts` (3) |
| 008 | `otp_requests` (1) |

**Three of the 17 carry a policy.** The other 14 have RLS on with no policy, which is
deliberate — they are backend-only, reached solely through the service-role key, and a
policy-less table denies every row to `anon` and `authenticated`.

| Table | Policy | Effect |
|---|---|---|
| `public.users` | `users_select_own` — `authenticated`, `id = (select auth.uid())` | own row only |
| `public.messages` | `messages_select_own` — `authenticated`, `sender_id = uid OR receiver_id = uid` | own threads only |
| `public.visitor_metrics` | `visitor_metrics_select_all` (from 003) | footer counter |

No migration after 004 adds a policy to any table. Storage carries seven policies, all from
002 and 003/004: product uploads/viewing/delete, post uploads/viewing/delete, and
`"Avatar uploads"` — INSERT only (see open issue 3).

**`[not re-verified]`** — that these are the settings actually live on either database, that
`anon` really has no `SELECT` on `users`/`messages`, and the 25 Aug JWT test results (own user
rows 1, own messages 82, `permission denied` as `anon`, 112 users / 141 messages as
`service_role`).

### Functions reachable by `anon` / `authenticated`

The 11 Aug lesson — `REVOKE ... FROM anon` is useless without `FROM PUBLIC`, because Postgres
grants EXECUTE to PUBLIC by default and `anon` inherits it — is applied in 005 and 007, and
the grant surface was re-pinned again by 010–012. The 25 Aug audit found exactly two functions
anon-reachable, `increment_page_view` and `increment_product_views`, both `SECURITY DEFINER`
and both deliberate. **`[not re-verified]`** that this is still the live grant set; migrations
010–012 changed function definitions after that audit.

### Realtime

`public.messages` is the only table in the `supabase_realtime` publication `[not re-verified]`.
Both clients subscribe **unfiltered** — `frontend/src/pages/messages/Messages.jsx:1306`
(`.channel("realtime:messages")`) and `mobile/src/contexts/RealtimeContext.tsx:215` — and
`messages_select_own` is what makes that safe, because Realtime re-checks the SELECT policy per
row. If `public.products` is ever added to the publication it needs a SELECT policy in the same
migration.

---

## Known open issues, in priority order

The 25 Aug list had nine numbered issues. Three of them are closed — items 1, 2 and 6 — see
"Recently resolved". The remaining six are renumbered below.

### 1. ✅ Resolved in Phase 4 — cursor pagination on the list endpoints

*Kept under its old number so references to issues 2–6 still point at the right ones.*

On 15 Sep this said every list returned the whole table. That is no longer true. As of 13 Oct,
`GET /api/products`, the product comments list, `GET /api/messages/inbox/:userId` (with
migration 015) and `GET /api/messages/history` all take `limit` and `cursor`. Each
controller's `parsePageLimit()` caps `limit` at 50: `products.controller.js:294` and
`messages.controller.js:42`. They return `{ items, next_cursor }`.

The 15 Sep check, `grep "\.range("`, still prints 0. That is expected: the code uses keyset
cursors (`.limit()` plus a comparison on the cursor column), not `.range()`, and `OFFSET` is
banned by `backend/API.md`. Don't use the grep as a test for pagination.

### 2. `products.views` is incremented by two independent paths

`frontend/src/components/ProductCard/ProductCard.jsx:233` (direct RPC from the browser) and
`backend/src/modules/products/products.controller.js:656` (on `GET /products/:id`). Different
rules, no coordination, so the count is not meaningful. Pick one. Still open on 13 Oct. It was
scheduled for Phase 5 and slipped. **Phase 6B fixes it** (`docs/runbooks/PHASE_6B_RUNBOOK.md`
§0.4 workstream C, §1.11): a `product_views` table counts one view per student, and the RPC is
closed to the public key. The runbook's finding 7 covers that public-key grant.

`mobile/src/hooks/useComments.ts:15` documents a third hazard in the same area — a posted
comment or vote inflating the view count.

### 3. `avatars` bucket has no SELECT or DELETE policy

INSERT was narrowed to `authenticated` by 004 (was `anon, authenticated`). Grepping every
migration for `create policy` confirms `"Avatar uploads"` is the only policy that names the
bucket, in 003 and again in 004, and both are `with check (bucket_id = 'avatars')` — INSERT.
There is still no SELECT and no DELETE. Reads work only because the bucket is `public = true`,
and nothing can delete an old avatar through RLS. Partially resolved; the other half is open.

### 4. `utils/notify.js` writes to a table that does not exist

`backend/src/utils/notify.js:61` does `supabase.from('notifications').upsert(...)`. There is
**no `create table ... notifications`** anywhere under `supabase/` — the only two mentions are
a comment in 003 and a reserved-word row in 005. `notify()` is wrapped so a failure never
breaks the calling action, so this fails silently today. Phase 7 per the Phase 3 runbook.

### 5. `backend/API.md` is wrong about `increment_page_view()`

`backend/API.md:3055` still says *"the RPC and table exist; nothing calls it."* (13 Oct)
`frontend/src/components/footer/footer.jsx:56` calls it on every page load. One-line doc fix.
The 25 Aug file cited line 2448, and the 15 Sep file line 2807; API.md keeps growing. Phase 8
housekeeping.

### 6. 👁️ Block G5 browser verification is still outstanding `[not re-verified]`

004 was applied and verified in SQL (G4) and by re-push (G6), but G5 — two real accounts in two
browser profiles on the live site, different message counts, live chat between them, and the
marketplace campus switcher for a logged-in student — was open on 25 Aug and nothing in the
repository records it being done since. It needs a human; it cannot be done from a Claude
session. **Carried forward as unknown, not as open.**

---

## Recently resolved — do not re-open these

### Closed since 25 Aug

| Was | Status |
|---|---|
| 🚨 **`PUT /api/users/:userId/profile` — arbitrary target, arbitrary columns** (was open issue 1, "the worst remaining hole in the backend") | ✅ **Fixed, Phase 3.** `user.routes.js:43` is `router.put('/:userId/profile', requireAuth, updateProfile)`. `updateProfile` takes `const userId = req.user.id` and ignores `req.params.userId` outright, then runs the body through `pickAllowedProfileFields()` (`user.controller.js:48`), an allow-list that uses `hasOwnProperty` rather than truthiness so `null` can still clear a field. Unknown keys are dropped in silence. Neither an arbitrary target nor an arbitrary column survives. |
| 🚨 **Unauthenticated writes across `products` and `messages`** (was open issue 2 — nine endpoints) | ✅ **Fixed, Phase 4 Block V-A** (commit `660c012`, 15 Sep). Re-verified route by route below — **zero** of the nine are still open. |
| `GET /:userId/dashboard`, `POST /:userId/avatar` taking their actor from the path | ✅ **Fixed, Phase 3.** Both have `requireAuth`; `getDashboardData` returns 403 unless `req.params.userId === req.user.id`. |
| `increment_product_likes` / `decrement_product_likes` are dead, "drop them in a future migration" (was open issue 6) | ✅ **Already done, and the 25 Aug file missed it.** `20260812121140_rls_stage1_backend_only_tables.sql:138-139` is `drop function if exists`. There was nothing left to drop when the item was written. |

### The nine "unauthenticated writes" — re-verified endpoint by endpoint, 15 Sep

The task that produced this file expected these to still be open. They are not. Every route
below was read in `products.routes.js` / `messages.routes.js`, and each handler was read to
confirm the middleware is backed by a real identity change rather than being decorative.

| Endpoint | Route today | Handler takes actor from |
|---|---|---|
| `POST /api/products` | `requireAuth` before multer | `const seller_id = req.user.id` (`:19`) |
| `POST /api/products/:id/comments` | `requireAuth` | `req.user.id` (`:620`) |
| `POST /api/products/comments/:commentId/vote` | `requireAuth` | `req.user.id` (`:575`) |
| `POST /api/products/:id/sold` | `requireAuth` | `existing.seller_id !== req.user.id` → 403 (`:676`) |
| `POST /api/products/:id/available` | `requireAuth` | ownership check, same pattern |
| `GET /api/messages/inbox/:userId` | `requireAuth` | `userId !== req.user.id` → 403 (`:42`), RPC gets `req.user.id` (`:49`) |
| `POST /api/messages/send` | `requireAuth` | `const sender_id = req.user.id` (`:126`) |
| `PUT /api/messages/read` | `requireAuth` | `const userId = req.user.id` (`:270`) |
| `PUT /api/messages/deliver` | `requireAuth` | `const userId = req.user.id` (`:295`) |

`POST /send` was called out on 25 Aug as the notable one, because it read `sender_id` from the
body and then ran the campus check against the *claimed* sender's row, validating nothing. That
is closed: the body value is ignored in silence (both clients still send one, and a 400 would
break them for no security gain).

Two **reads** were tightened in the same block and are worth knowing about, because they are new
since 25 Aug: `GET /api/products` and `GET /api/products/:id` attached `is_liked` / `is_saved`
— and `/:id` also each comment's `user_vote` — for whatever uuid the caller put in `?user_id=`,
leaking a third party's like, save and vote state. Both now use `optionalAuth`, take the viewer
from `req.user?.id`, and ignore the query param. `optionalAuth` and **not** `requireAuth` is
deliberate: anonymous marketplace browsing is a feature, and a 401 there would empty the
logged-out landing page.

`GET /api/user/:userId/public` has no auth **on purpose** — it is a public page with an explicit
non-sensitive column projection. `user.routes.js:48-50` says so. Do not "fix" it.

### Closed before 25 Aug — unchanged

| Was | Status |
|---|---|
| RLS disabled on all 13 production tables; `GRANT ALL` to `anon` | ✅ Resolved (003 + 004, 25 Aug) |
| `REVOKE ... FROM anon` on functions does not work | ✅ Resolved as a pattern. 005/007 use `FROM PUBLIC` as well |
| `messages.controller.js` `.or()` filter injection | ✅ Fixed 23 Aug. Anchored uuid regex, participation check, `requireAuth`. Was confirmed exploitable first |
| `products.controller.js` like/save took `user_id` from the body | ✅ Fixed 23 Aug. Actor is `req.user.id`; campus check added |
| `updateProduct` / `deleteProduct` had no ownership check | ✅ Fixed 23 Aug. `requireAuth` + `seller_id === req.user.id` (`:132`, `:241`) |
| Production RLS enabled with no policies (silent zero reads) | ✅ Fixed 25 Aug — see `docs/PROD_RECONCILIATION.md` `[not re-verified]` |
| All 112 production accounts had `has_password = false` with a real password | ✅ Fixed 25 Aug by 007's backfill `[not re-verified]` |
| Seeded accounts could never log in with a password | ✅ Fixed 25 Aug in `seed.sql` / `seedDemo.js` |
| `mobile/.env` API base URL vars commented out | ✅ Not an issue — `EXPO_PUBLIC_API_URL` is intentionally unset for local dev |
| `POST /api/auth/demo-login` returned 500 on every call | ✅ Fixed 20 Aug (CC-4) |
| First-time signup landed on `/` instead of `/onboarding` | ✅ Fixed 23 Aug. Render-ordering race in `GuestOnly` |
| Chat history blanked on reopen; 9 like/save call sites 401ing | ✅ Fixed 25 Aug. Missing `Authorization` header |

---

## What Phase 3 shipped (was not in the 25 Aug file at all)

Reconstructed from the repo on 15 Sep; the narrative is in `docs/runbooks/PHASE_3_RUNBOOK.md` and the
handoff entry is in `docs/CHANGELOG.md` (15 Sep, reconstructed).

- **Migration 013 `universities_expansion`** — `is_active boolean not null default true`, a
  partial index `universities_is_active_idx ... where is_active = true`, and five `insert into
  public.universities` blocks totalling **112 value rows** (the migration header says "~100"),
  every one `is_active = false`. `on conflict (domain) do nothing` on every insert, so the
  migration only ever inserts and never overwrites a live row. `default true` is deliberate and
  only looks backwards: `false` would have deactivated the eight existing live campuses the
  instant it applied.
- **`is_active` is enforced in two places** — `auth.controller.js` `requestOtp` adds
  `.eq('is_active', true)` and returns the *same* 403 body for inactive as for unknown, so the
  endpoint cannot be probed to enumerate staged colleges; `university.controller.js`
  `getUniversities` adds `.eq('is_active', true)` so the campus switcher does not fill with
  ~100 empty colleges.
- **CORS** — production answered every origin with `Access-Control-Allow-Origin: *`. Replaced
  with an exact-string allowlist in `backend/src/app.js` (`PRODUCTION_ORIGINS` + `WEB_ORIGINS`
  env, plus local origins in dev only). `PRODUCTION_ORIGINS` holds `https://yahora.netlify.app`.
  See "Credential hygiene and open actions".
- **OTP 8 → 6 digits.** `supabase/config.toml` `otp_length = 6` in both blocks;
  `frontend/src/pages/auth/Auth.jsx:925` `maxLength={6}`. `frontend/CLAUDE.md` §2, §6 and §13
  said 8 until 13 Oct and now say 6.
- **Mobile Turnstile** via `mobile/src/components/TurnstileWebView.tsx` (new, 286 lines) —
  Turnstile has no native RN component, so it runs in a WebView and posts the token out through
  `window.ReactNativeWebView.postMessage`.
- **Home campus pinned** to the top of the campus switcher on both surfaces —
  `frontend/src/components/modal/UniversityModal.jsx` + `Marketplace.jsx` (commit `7b5750c`),
  `mobile/src/components/CampusSwitcherModal.tsx` (commit `bbe2263`).
- **Dev API port 5000 → 5001** everywhere, because macOS AirPlay Receiver holds 5000 and
  answers with a bodiless 403. `frontend/.env.example` was the last file still on 5000 and was
  fixed on 15 Sep.

---

## Facts established by audit

- **`on_auth_user_created` EXISTS on `auth.users`** and creates the `public.users` row inside
  the auth insert's own transaction (migration 005). Any JS that creates a `public.users` row
  must be an **upsert on `id`**. ⚠️ The 11 Aug version of this file said *"No trigger on
  auth.users"* — true when written, false since 005.
- **No `service_role` key in `frontend/` or `mobile/`.** Re-verified 15 Sep: grepping
  `frontend/src`, `mobile/src`, `mobile/app` and both `.env.example` files for
  `service_role` / `SERVICE_ROLE` returns nothing. Both use the publishable key only.
- The backend uses the **service-role key**, so every backend query **bypasses RLS**. RLS is
  not a backstop for backend routes — the controller is the only control. Identity must come
  from `req.user.id`, never from the request body or path. Phase 3 and Phase 4 V-A were both
  applications of exactly this rule.
- **Zero schema drift between local and production.** `[not re-verified]` — was true on 25 Aug
  via `schema-drift.mjs`; ten migrations (008–018) have landed since and this session cannot
  check.
- Production carries **112 users / 141 messages** `[not re-verified]`, a 25 Aug figure. The
  25 Aug "local seed carries 11 users" is stale. The 6A V-D entry (`docs/changelog/`, 9 Oct)
  records `node backend/scripts/seedLocal.js` → 696 students and 928 products across 116
  universities, and `seedDemo.js` → 15 users, 40 products.
- `toggleLikeProduct` does not double-count — the trigger owns the counter. `[not re-verified]`
- The fixed `c0000000-…-0001` (B.Tech) and `d0000000-…-0002` (Mechanical Engineering) seed ids
  still do not exist after a reset; legacy no-id inserts claimed those names first. Do not
  hardcode them. `[not re-verified]`
- **`backend/scripts/verify-domains.sh` does not exist.** `docs/YAHORA_BUILD_PLAN.md` §"Phase 3"
  lists it as shipped. `backend/scripts/` contains `diagnose-token.mjs`, `schema-drift.mjs`,
  `seedDemo.js`, `seedLocal.js`, `verify-block-f.mjs` and nothing else. Either it was never
  written or it lives somewhere the plan does not say.

---

## Ownership

- **Vishwajeet** (MacBook): the database exclusively, shared backend infra, `posts`, `admin`,
  `products`, `auth`, `messages`, `university`, `academic`, and the mobile app. Only he writes
  files under `supabase/migrations/` and only he runs anything touching production.
- **Neeraj** (MacBook): the website, plus the `user`, `social`, `notifications` and `reports`
  backend modules.

Authoritative file-by-file map: `backend/CLAUDE.md`. Every file under `backend/src/modules/`
carries an `OWNER:` banner.

**Phase 4 loan — ended.** Neeraj wrote the cursor pagination in the READ handlers of
`products` and `messages`. The loan ended with Phase 4. Written up in `docs/CHANGELOG.md`, 15 Sep.

**Phase 6B loan — current.** `backend/src/modules/products/` and `backend/src/modules/share/`
are lent to Neeraj from Day 2 (13 Oct) until 6B sign-off. Vishwajeet does not edit them in
that time, and the `OWNER:` banners stay unchanged. See `docs/runbooks/PHASE_6B_RUNBOOK.md`
§2.2. Vishwajeet files the loan entry in Block V-A; as of 13 Oct it isn't in `docs/changelog/`
yet.

---

## Credential hygiene and open actions

- ✅ **`PRODUCTION_ORIGINS` in `backend/src/app.js:54` is filled:** `https://yahora.netlify.app`,
  added 10 Sep in commit `3757be0`. The 15 Sep version of this file said the array was empty,
  which was already wrong then. A hosted frontend on any other domain still needs `WEB_ORIGINS`
  set on Render. The Expo app isn't affected by CORS:
  `if (!origin) return callback(null, true)` is the first check, in both environments, because
  CORS is a browser mechanism. Do not remove that line. That the live deploy accepts the Netlify
  origin is `[not re-verified]`.
- **`cache.md` is still a tracked file** and still not in `.gitignore`. On 13 Oct it holds only
  phase start dates. No commit in its history contains a connection string or password. It has
  held the production connection string in the working tree before, so the advice stands: never
  put a credential in it. If you want it out of git, use `git rm --cached cache.md` plus a
  `.gitignore` entry. Whether the database password was rotated is `[not re-verified]`.
- The production dumps (`prod-backup-data.sql`, `prod-backup-schema.sql` — 112 real emails and
  112 bcrypt hashes) were moved to `~/yahora-backups/`, outside the repo. ✅ Resolved 25 Aug.
  There are no automated backups on this project (free tier), so keep taking them — just not
  inside the repository. `[not re-verified]`
