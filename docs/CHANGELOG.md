# Changelog

How Vishwajeet and Neeraj tell each other what changed.
Newest at top. Every backend/database change gets an entry.

Format: see the six-section template in YAHORA_BUILD_PLAN.md §0.3
Migration requests go under ## MIGRATION REQUESTS (see §0.5.5)

You work in separate Claude Code sessions that cannot see each other. **This file is the
handoff.** A change that isn't written down here did not happen as far as the other person is
concerned. Send the same text on WhatsApp — the file is the record, the message is the ping.

---

## Templates

Copy the right one, fill it in, and paste it under [Entries](#entries) — newest at the top.

### Vishwajeet → Neeraj (a backend or database phase lands)

All six sections are required. The last one — "What NOT to do yet" — is the one people skip
and the one that saves the most time.

```markdown
## 2026-08-XX — Phase N complete (Vishwajeet)

### Migrations applied
- 003_follows.sql   (applied to production at 14:20 IST)

### New endpoints
- POST /api/users/:id/follow      → see API.md §4.1
- DELETE /api/users/:id/follow    → see API.md §4.2

### Changed endpoints (BREAKING)
- GET /api/users/:id now returns `followers_count` and `is_private`.
  Old fields unchanged. Safe to deploy web before mobile.

### New fields on existing responses
- users object now includes: username, followers_count, following_count, is_private

### Test data
- Seeded 30 follow relationships between demo users. Run
  `node backend/scripts/seedDemo.js` to refresh your local data.

### What NOT to do yet
- Don't build the follow-request approval screen. The endpoint exists
  but notifications aren't wired until Phase 5.
```

### Neeraj → Vishwajeet (a backend module lands)

Shorter, but mandatory — Vishwajeet's mobile app consumes it.

```markdown
## 2026-08-XX — social module merged (Neeraj)

### Endpoints now live
- POST/DELETE /api/users/:id/follow
- GET /api/users/:id/followers, /following   (cursor: created_at)
- POST/DELETE /api/users/:id/block
- PATCH /api/users/me/privacy

### Deviations from API.md
- None.                     ← if there ARE any, they go here AND API.md
                              gets updated in the same commit

### Known gaps
- Follow requests return the list but don't emit notifications yet
  (waiting on Phase 5 notify()).

### How I tested it
- Seeded 2 private accounts. Verified pending→accepted transition,
  counter accuracy, and that blocking deletes both follow rows.
```

"Deviations from API.md" is the section that matters most. If you had to change a response
shape mid-implementation, the other person's client is already written against the old one.

---

## Entries

_Newest at the top._

## 2026-08-20 — Migrations 005 + 006: usernames, passwords, signup trigger (Vishwajeet)

### Migrations applied
- `20260815061951_usernames.sql` (005) — applied **local and production**
- `20260815072147_username_backfill.sql` (006) — applied **local and production**

`users` gains three columns: `username`, `username_changed_at`, `has_password`.

Three new tables: `reserved_usernames`, `username_history`, `auth_attempts`. All three are
**backend-only** — RLS on, zero policies, zero anon/authenticated grants. A direct Supabase
query from the web app returns an empty set, not an error, so this fails silently if you try
it. Go through the backend.

### The signup trigger — read this before you touch any signup path

`on_auth_user_created` on `auth.users` now creates the `public.users` row automatically,
inside the same transaction as the auth insert. Both happen or neither does, which closes the
race where a process dying mid-signup left an auth user with no profile forever.

Two properties worth knowing:

- **It never raises.** If it threw, GoTrue would fail the whole insert and the student would
  see an opaque "Database error saving new user". The body is wrapped in a catch-all.
- **An unknown email domain still creates the row**, with `university_id` NULL. That is a
  monitoring signal that something created an account through a path that skipped domain
  validation — not a failed signup. `requestOtp` validates the domain before an OTP is ever
  sent, so this should not happen.

**Any JS that creates a `public.users` row must now be an upsert on `id`.** The row already
exists by the time your code runs. See the BREAKING section below for where that is not yet
true.

### Usernames

`username` is **NULL until onboarding** — the trigger deliberately does not generate one.
There is no `full_name` at `auth.users` insert time, and deriving a handle from the email
local part would bake roll numbers (which encode branch and batch year) into a permanent
public handle.

Migration 006 backfilled every pre-existing completed profile and *then* added
`users_username_required_when_complete`. **The database now rejects `is_profile_complete =
true` with a NULL handle**, on every surface, forever. Onboarding must set both or neither.

Shape of a valid handle (`users_username_valid`): lowercase, 3–25 characters, `^[a-z][a-z0-9._-]*$`.
Uppercase is *folded, not rejected* — lowercase in the UI as the student types and again in
the backend before writing. The CHECK is the backstop, not the thing the student meets.

### DB functions ready for your user module — call these, don't reimplement them

| Function | Signature | Returns |
|---|---|---|
| `is_username_available` | `(p_username text, p_user_id uuid default null)` | `boolean` |
| `suggest_usernames` | `(p_name text, p_university_id uuid default null)` | `text[]` (3+ candidates) |
| `generate_username` | `(p_name text)` | `text` |
| `search_users` | `(p_query text, p_viewer uuid default null, p_limit int default 20)` | table: `id, username, full_name, avatar_url, university_name, is_same_campus, rank` |

`is_username_available` is not just a uniqueness check — it also enforces the charset, the
reserved list, and the 30-day `username_history` squatting lock. A JS reimplementation will
disagree with the database and you will find out via a 23505 in production. Call the function.

The unique index is the real arbiter for the race where two students pass the availability
check in the same instant; the loser gets 23505 and the backend turns that into a clean
"taken" response.

### New endpoints
- None. This is a database change only.

### Changed endpoints (BREAKING)
- **`POST /api/auth/demo-login` returns 500 for every call now.** Step 5 of `demoLogin`
  (`auth.controller.js:227`) is a plain `.insert()` into `users` on an id the trigger has
  already created one microsecond earlier, so it hits 23505 and the catch turns it into
  "Internal server error during demo login". It needs to become
  `.upsert(..., { onConflict: 'id', ignoreDuplicates: false })`. **Not fixed yet** — Vishwajeet
  is on it. Don't debug this on your side; it is not your module and it is not your env.
- `POST /api/auth/verify-otp` is fine. Its insert is guarded by an `if (!publicUser)` that the
  trigger's row now satisfies, so the insert is simply skipped. Narrow race remains; same
  upsert fix applies.

### New fields on existing responses
- `userProfile` on `POST /api/auth/verify-otp` and `POST /api/auth/demo-login` comes from
  `select('*')`, so it now also carries `username` (null until onboarding),
  `username_changed_at` (null) and `has_password` (false). Purely additive — nothing was
  removed or renamed, no client needs to change.

### Test data
- `backend/scripts/seedDemo.js` updated for both migrations. All 15 demo personas now carry a
  realistic handle derived from their name (`rahul.sharma`, `priya_verma`, `sid.menon` — none
  of them on the reserved list), and the profile write is an upsert on `id`, so it updates the
  trigger-created row instead of colliding with it. An `assertValidHandles()` check runs before
  the first write so a bad handle fails locally with a readable message instead of aborting
  the seed nine rows in.
- Also fixed: the script died with "Refusing to seed a non-local database — SUPABASE_URL (not
  set)" when run from the repo root, because `dotenv/config` resolves `.env` against
  `process.cwd()`. It now loads `backend/.env` from its own file location. The safety guard
  itself is unchanged.
- The script does **not** insert into `courses` or `specializations`, so it cannot conflict
  with `seed.sql`. It does create the `demo.yahora.com` university if absent, with a random
  id — don't hardcode that one.

### What NOT to do yet
- **Don't call `get_login_email` from the user module.** It is backend-only and revoked from
  `anon`, `authenticated` and `PUBLIC`. It maps a handle to an email so Supabase can sign in
  by username, and it is the one function in 005 that leaks something. Not yours.
- **Don't reimplement username validation, suggestion or search in JS.** See the table above.
- **Don't build follow buttons or private-account UI.** That is Phase 3. You are unblocked for
  **N-Block C** and that is the scope.
- Don't write to `reserved_usernames`, `username_history` or `auth_attempts` from a controller.
  `username_history` is written by `trg_record_username_change`; `auth_attempts` is the
  lockout ledger.

## 2026-08-12 — seed.sql: six named test accounts + 12 listings (Vishwajeet)

### Test data
Run `supabase db reset` to pick these up.

Six accounts you can actually log into, one row per person we test with. Password is
`password123` for all of them, same as the existing seeded users; OTP login works too.

| Email | Name | Campus |
|---|---|---|
| `test@iiitk.ac.in` | Test Kurnool | IIITDM Kurnool |
| `vishwajeet@iiitk.ac.in` | Vishwajeet Singh | IIITDM Kurnool |
| `test@niet.co.in` | Test Noida | NIET Greater Noida |
| `neeraj@niet.co.in` | Neeraj Kumar | NIET Greater Noida |
| `vishwajeet@iittp.ac.in` | Vishwajeet Singh | IIT Tirupati |
| `neeraj@nitdelhi.ac.in` | Neeraj Kumar | NIT Delhi |

All six are B.Tech / "Graduation" with a real `course_id`, so `is_profile_complete` is
true and they skip onboarding.

Two listings each, 12 new products (`e0…0013`–`e0…0024`), users `b0…0006`–`b0…0011`.

**NIT Delhi and IIT Tirupati now have content.** Both existed in `universities` but had
zero users and zero products, so switching to either campus showed an empty marketplace.

The same person is on two campuses on purpose — Vishwajeet at Kurnool *and* Tirupati,
Neeraj at Noida *and* Delhi. Separate accounts, separate ids. That is the pair you want
for testing cross-campus browse vs. same-campus-only interaction.

Product images are real Unsplash photos instead of `placehold.co`, and each title matches
what is actually in its picture. If you change an image, check the title still fits.

### What NOT to do yet
- `course_id` / `specialization_id` are looked up **by name**, not by the fixed `c0…`/`d0…`
  ids. Those fixed ids still never land (see the entry below) — don't hardcode them.

## 2026-08-12 — RLS stage 1 applied; both login endpoints fixed (Vishwajeet)

### Migrations applied
- `20260812121140_rls_stage1_backend_only_tables.sql` (local only — NOT yet on production)
  - RLS enabled on 11 tables. `users` and `messages` deliberately left OFF for stage 2.
  - `anon` / `authenticated` lost every table grant except `SELECT` on `users`,
    `messages` and `visitor_metrics`.
  - `increment_page_view()` is now `SECURITY DEFINER` so the footer counter still works.
  - The four storage buckets are now created by migration instead of by hand.

### Changed endpoints (NOT breaking — no shape change)
- `POST /api/auth/verify-otp` and `POST /api/auth/demo-login` were returning 500 for
  **every** call once the migration was applied. Both are fixed. Request and response
  shapes, status codes and error strings are unchanged — API.md needed no edit.

### The bug, because it will bite again
`supabase.auth.verifyOtp()` and `supabase.auth.signInWithPassword()` **store the session
they return on the client instance**. Both were being called on the one shared
service-role client in `config/supabase.js`, so from that moment on the client sent the
logged-in student's `authenticated` JWT instead of the service-role key — for the rest of
the process, not just that request.

That was invisible while `authenticated` could read and write every table. The migration
revoked those grants, so the first query after any login started failing with
`42501 permission denied`. The endpoints were broken by the migration, but the bug was
already there.

Fix: `createSessionClient()`, a new export from `config/supabase.js`. Any call that mints
a session goes on a throwaway client. **If you ever call `verifyOtp`, `signInWithPassword`
or `setSession` in the backend, use it** — do not call them on the shared `supabase`.

Do NOT try to fix a demoted client with `signOut({ scope: 'local' })`: it revokes the
refresh token you just handed the browser, so the user's session dies about an hour later.
Tested and confirmed.

### What NOT to do yet
- **Do not apply this migration to production.** It is local-only until
  `frontend/src/contexts/AuthContext.jsx` calls `supabase.auth.setSession()`.
- Neeraj: the web app's direct Supabase queries run as `anon` with `auth.uid()` NULL
  because that call is missing, so stage 2 (`users`, `messages`) is blocked on it.
  Full inventory of what breaks and why: `docs/RLS_SURFACE.md`.
- Heads-up, unrelated to the above: `frontend/.env` still points `VITE_SUPABASE_URL` at
  **production** while the backend points at local. Direct Supabase calls from the web app
  therefore do not hit your local database at all, and local RLS changes will not show up
  in the browser until that is repointed.

## 2026-08-12 — seed.sql: `db reset` was broken, plus demo marketplace content (Vishwajeet)

### Migrations applied
- None. `supabase/seed.sql` only. No schema change, nothing applied to production.

### Read this first — your local `supabase db reset` was failing, and this fixes it
If you have run `supabase db reset` recently and it died with:

```
ERROR: insert or update on table "users" violates foreign key constraint
       "users_university_id_fkey" (SQLSTATE 23503)
```

…that was not your machine. `seed.sql` inserted our two universities twice: an older block
without ids (which generated random ones and claimed the unique `domain` values) and a newer
block with the fixed `a0000000-…` ids. The newer block's untargeted `on conflict do nothing`
silently swallowed the domain collision, so `a0000000-…-0001/0002` never existed and every
seeded user failed its foreign key. **The whole seed aborted, so you had zero test users.**

Fixed by adding the ids to the first block. `supabase db reset` now completes cleanly — pull
and re-run it.

⚠️ **The same trap is still live in the `courses` and `specializations` blocks.** After a reset,
`c0000000-…-0001` (B.Tech) and `d0000000-…-0002` (Mechanical Engineering) **do not exist** —
the legacy no-id inserts took those names first. Harmless right now because nothing references
them, but do not hardcode those two ids in anything. Ping me if you need them real and I will
do the same fix. (`d0000000-…-0001` "Computer Science" *does* exist — different name, no
collision.)

### New endpoints
- None.

### Changed endpoints (BREAKING)
- None. No response shape changed.

### Test data
`supabase db reset` now gives you a populated marketplace on both campuses. All ids are
hand-assigned and stable across resets, so they are safe to hardcode in a curl or a test.

| Prefix | What |
|---|---|
| `a0000000-…` | universities (01 IIITDM Kurnool, 02 NIET Greater Noida) |
| `b0000000-…` | users (01 Arjun, 02 Priya, 03 Rahul @ Kurnool · 04 Sneha, 05 Karan @ NIET) |
| `e0000000-…` | products, 01–12 |
| `e1000000-…` | comments, 01–08 |
| `e2000000-…` | purchases, 01 |
| `f0000000-…` | messages, 01–16 |

- **12 products** — 8 at IIITDM Kurnool, 4 at NIET Greater Noida, spread over all five sellers.
  All eight `MARKETPLACE_CATEGORIES` appear, so every filter chip has something behind it, and
  `created_at` covers all four posting-date buckets (today / week / month / older). Prices
  ₹550–₹48,000, all inside the ₹50,000 slider ceiling. Every image URL is
  `https://placehold.co/600x400`; some products carry 2–3 of them so the carousel has something
  to page through.
- **1 sold listing** (`e0…08`, Rahul's kettle) with a matching `purchases` row, because that is
  what `markProductAsSold()` actually writes and what the dashboard Purchases tab reads.
- **3 message threads**, 5–6 messages each, 16 total. Both participants of every thread are on
  the same campus. Each thread's last message is delivered-but-unread, so the inbox shows a badge.
- **8 comments** including **2 reply threads** (`parent_comment_id` set — sellers answering on
  their own listing).
- **12 `product_likes` + 8 `product_saves`**. Nobody likes or saves their own listing.

**Campus isolation held throughout.** Every `products` / `messages` / `comments` row carries a
`university_id` matching every user it touches. `product_likes` / `product_saves` /`purchases`
have no `university_id` column, so isolation there is a property of the pairs chosen — a Kurnool
student never likes a Noida listing. I ran a 15-check audit after the reset; all 15 returned 0
bad rows. If you add seed rows, keep it that way.

### New fields on existing responses
- None.

### What NOT to do yet
- **Do not add `likes_count`, `comments_count`, `upvotes` or `downvotes` to any seed insert.**
  Triggers (`trg_update_likes_count`, `trg_update_comments_count`, `trg_update_comment_votes`)
  own those columns and increment *relatively* — seeding a value double-counts, silently. Seed
  the likes and the comments; let the triggers do the arithmetic. `views` has no trigger, so the
  seed does set it. Verified after reset: counters match the real child-row counts on all 12
  products.
- **Do not use `gen_random_uuid()` in `seed.sql`** for anything another row references. That is
  what caused the outage above.
- Nothing here is production data and none of it was pushed anywhere. Local only.

---

## MIGRATION REQUESTS

Neeraj posts here when he needs a schema change, then messages Vishwajeet. Say what you need,
why, and what it is blocking. Target turnaround: **same day**. If it will take longer, work
around it and revisit.

Vishwajeet replies inline with the migration number once it is applied, and moves the request
under `### Done`.

```markdown
### Open
- **Need:** `users.last_seen_at TIMESTAMPTZ`
  **Why:** the "active recently" badge on profile cards
  **Blocking:** social module follower list
  **Requested:** 2026-08-XX by Neeraj

### Done
- ~~`users.last_seen_at TIMESTAMPTZ`~~ → applied in `011_last_seen.sql`, 2026-08-XX
```

### Open

_Nothing open._

### Done

_Nothing yet._
