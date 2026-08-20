# Phase 1 Runbook — Usernames, Passwords & RLS Stage 2

**Version 3.0 — 14 August 2026.** Supersedes v2.0. Auth design settled (§0.6); Part 0 condensed since you've read it; `docs/PHASE_1_ADDENDUM_PASSWORDS.md` merged in and deleted.

---

# PART 0 — Quick reference

*(You've read the long version. This is what you'll need to look up.)*

## 0.1 Blocking facts

| | |
|---|---|
| 🚨 **Open hole** | `completeOnboarding` reads `userId` from `req.body`, route has no `requireAuth`. Anyone can overwrite any profile. Becomes **account takeover** once passwords land. → **Block D** |
| ⛔ **Blocker** | `frontend/src/contexts/AuthContext.jsx` never calls `supabase.auth.setSession()`. Web queries run as `anon` with `auth.uid()` NULL, so `auth.uid()` policies match nothing. Gates **Block D** and **Block G**. → Neeraj's **N-Block A** |
| ⚠️ **Env drift** | `mobile/.env` points at production while backend points at local. → **Block 0** |
| ⚠️ **Unpushed** | `infiniper` is ahead of `main`. Neeraj can't see migration 003 until you push. → **Block 0** |

## 0.2 The rule that came out of migration 003

Default privileges are revoked, so **every new table is born with zero anon/authenticated grants.** Decide access in the same migration that creates the table:

- **Backend-only** → `ENABLE ROW LEVEL SECURITY`, no policies, no grants. `service_role` bypasses RLS, so Express is unaffected.
- **Client-reachable** → RLS on **plus** an explicit policy **plus** an explicit `GRANT`. Both are needed: a grant with no policy returns nothing; a policy with no grant returns a permission error.

Phase 1's three new tables — `reserved_usernames`, `username_history`, `auth_attempts` — are all **backend-only**.

## 0.3 Migration numbering

| # | Name | Status |
|---|---|---|
| 002 | `performance_and_grants` | applied |
| 003 | `rls_stage1_backend_only_tables` | applied |
| **004** | `rls_stage2_users_messages` | Block G — blocked on Neeraj |
| **005** | `usernames` | Block A — start here |
| **006** | `username_backfill` | Block B |

> The CLI names files by timestamp, not by your number. Creating 005 before 004 is fine — timestamps decide the order, the numbers are just labels for conversation. Don't rename files to force a sequence.

## 0.4 Where you may run SQL

| | Local Studio `127.0.0.1:54323` | Production dashboard |
|---|---|---|
| `SELECT`, calling a function to test | ✅ | ✅ (read-only) |
| `CREATE` / `ALTER` / `DROP` / `INSERT` / `UPDATE` | ❌ migration file only | ❌ never |

## 0.5 Testing tools

- **🌐 Browser** — GETs with no login. Chrome shows unformatted JSON; install a viewer extension first.
- **📮 Postman** — anything with auth or a body. Environment `Yahora Local`, `baseUrl = http://localhost:5000`, `token` set automatically by this snippet in your verify-otp request's **Scripts** tab:
  ```js
  const json = pm.response.json();
  const t = json.session?.access_token || json.access_token || json.token;
  if (t) pm.environment.set("token", t);
  ```
  Then set the **collection's** auth to Bearer `{{token}}`.
  ⚠️ Your `verifyOtp` reads `otp`, not `token`: `{ "email": "...", "otp": "12345678" }`
- **🖥️ DevTools console** — two requests at the same instant. Postman sends one at a time and structurally cannot test a race. `await Promise.all([fetch(...), fetch(...)])`. CORS error? Run it from a tab on `localhost:5173`, not a blank tab.
- **📧 Mailpit** `127.0.0.1:54324` — local Supabase catches every email here. Your OTP codes appear in it.

## 0.6 ⭐ Auth design — settled 14 Aug, read this

Two tabs on the auth page:

| Tab | Who | Purpose |
|---|---|---|
| **College Email & OTP** | everyone | The **only** signup path. Mandatory for first-time users. |
| **Username & Password** | existing accounts only | Faster repeat login. |

**Why "password login only for existing accounts" needs no enforcement.** It's structurally impossible otherwise: a password is only ever set during onboarding, and onboarding only happens after an OTP login. A student who has never used OTP has no password to log in with. You don't check this — it can't happen.

**Username and password are both compulsory at onboarding.** No optional path, no partial state.

### The error message — one string, always

Every `login-password` failure returns the **same** response, byte for byte:

> **"Incorrect username or password. Please try again."**

That covers a wrong password, an unknown username, an unknown email, and an account without a password. All identical.

**Why identical matters.** If "no such account" looked different from "wrong password", anyone could test thousands of identifiers and learn which are real — then focus password guessing on those. That's **user enumeration**. For emails it's worse than efficiency: it would let someone check whether a specific classmate is on Yahora, which is a harassment precursor on a campus app.

**Where the new-user guidance goes instead:** permanent helper text under the form.

```
┌────────────────────────────────────────────┐
│  [ College Email & OTP ]  [ Username & Pass ]│
├────────────────────────────────────────────┤
│  Username or email                          │
│  [                                        ] │
│  Password                                   │
│  [                                    ] 👁  │
│                        Forgot your password? │
│                                             │
│  ⚠ Incorrect username or password.          │
│    Please try again.                        │
│                                             │
│         [        Sign in         ]          │
│  ─────────────────────────────────────────  │
│  New to Yahora? Create your account with    │
│  your college email and OTP →               │
└────────────────────────────────────────────┘
```

A new student sees the guidance **before** wasting a login attempt, rather than having to fail once to learn how to sign up.

### `PASSWORD_NOT_SET` is gone from the API

Since password is compulsory at onboarding and the test users get wiped before launch, the only way to have an account without a password is **abandoning onboarding after OTP verification** — `verifyOtp` creates the row with `is_profile_complete = false`. Rare, but onboarding abandonment is normal, so it must not 500.

**Handling:** the backend still detects `has_password = false` and logs the real reason server-side for your debugging, but returns the **same generic `INVALID_CREDENTIALS`** to the client. Three lines, no leak, no landmine.

**What this removes from Neeraj's work:** the *"Set a password to sign in faster"* prompt card. Anyone without a password is mid-onboarding, and OTP login already routes them to the onboarding screen where they'll set one.

**`POST /api/auth/set-password` stays** — it's how someone changes their password from settings later.

### Forgot password

There is **no reset-email flow**. No reset tokens, no expiring links. Forgot password → use the OTP tab → Settings → set a new one. Less code, and *more* secure: there's no reset token to leak, intercept, or replay.

## 0.7 Carried forward — not Phase 1 work

| Item | When |
|---|---|
| **Delete all existing users** (test data only). Cascades to `products`, `messages`, `posts`, `product_likes`, `comments`, `purchases`. Do it **late** — keep test data through Phases 1–2 so you have something to develop against, and so migration 006's backfill still runs against real rows. Needs a verified row count before and after. | Pre-launch checklist |
| **Rate-limit `request-otp`.** `shouldCreateUser: true` means anyone can create unlimited `auth.users` rows with made-up addresses at a valid domain — and with migration 005's trigger, junk `public.users` rows too. | Phase 2 |
| **`DESIGN.md` decision.** It declares tokens canonical (paper white, highlighter yellow, Khand + Instrument Sans, **Inter banned**) and cites `src/theme/tokens.ts` and `src/styles/tokens.css` — **neither file exists**, and the shipped apps use purple `#800080` / pink / blue with Inter + Bree Serif. Both `CLAUDE.md` files say "read DESIGN.md before ANY UI work". **Adopt it or retract it before Phase 2 opens**, or Claude Code will invent a third palette. | Before Phase 2 |

---

# PART 0.5 — The design decision: profile creation in a trigger

You asked for my reasoning rather than a verdict. Here's the reasoning, then the verdict.

## The problem, precisely

`public.users` rows are created only by JavaScript, in three places:

| File | Line | Path |
|---|---|---|
| `backend/src/modules/auth/auth.controller.js` | ~94 | `verifyOtp` |
| `backend/src/modules/auth/auth.controller.js` | ~222 | `demoLogin` |
| `backend/scripts/seedDemo.js` | ~841 | seeding |

Each writes only `id`, `university_id`, `is_profile_complete`. There is **no trigger on `auth.users`**.

The username system assumes every auth user has a profile row. If any path forgets, you get an auth user with no profile — they can log in, and every screen breaks.

## The case for a trigger

**1. It cannot be forgotten.** Three paths today; more coming — mobile signup, admin tools, Google sign-in later. Each new one is a chance to forget. A trigger fires regardless of which surface created the account.

**2. It closes a real race.** In `verifyOtp` today, Supabase creates the auth user and *then* your JS inserts the profile. If the process dies between those two steps — deploy, crash, timeout — you get an orphan auth user permanently. A trigger runs inside the same transaction as the auth insert: both happen or neither does.

**3. It makes the invariant enforceable.** "Every auth user has a profile" stops being a convention you hope everyone honours and becomes something the database guarantees.

## The case against

**1. `auth.users` is Supabase's table, not yours.** They own the schema and upgrade GoTrue underneath you. A trigger on someone else's table is coupling you don't control. *Mitigating: `handle_new_user` is a documented, widely-used Supabase pattern — a well-trodden path, not a hack.*

**2. A throwing trigger breaks signup entirely.** This is the serious one. If the trigger raises, GoTrue fails the whole insert and the student sees `Database error saving new user` — opaque, with no route to a fix. Your careful *"Yahora is not yet available at your university"* would never render.

**3. Domain→university logic gets duplicated.** `requestOtp` already resolves the domain in JavaScript. The trigger needs the same lookup in SQL. Two implementations of one rule can drift.

**4. Debugging is harder.** A trigger error surfaces as a generic GoTrue message. You'll be reading Postgres logs, not your own.

## What settles it

Objection 2 is the one that matters, and there's a design that removes it entirely.

**Notice that `requestOtp` already validates the domain before the OTP is ever sent.** By the time an auth user exists, the domain has been checked and matched. So the trigger's lookup can only fail in cases that shouldn't happen.

Which means the trigger can be written so it **can never fail**:

- domain matches → bind the university
- domain doesn't match → still create the row, with `university_id` NULL
- anything else goes wrong → swallow it and return

`users.university_id` is already nullable (`UUID REFERENCES universities(id) ON DELETE RESTRICT`), so NULL is legal. A row with NULL `university_id` becomes a monitoring signal — *"something created an account through a path that skipped domain validation"* — rather than a user-facing failure.

Wrap the body in `EXCEPTION WHEN OTHERS THEN RETURN NEW` and the trigger is structurally incapable of blocking a signup. Worst case it does nothing and your JS fallback picks it up.

Objection 3 is real but small: the SQL lookup is four lines, and the JS version stays as the user-facing gate that produces the friendly error. They aren't competing — **the JS one decides whether to send an OTP; the SQL one decides what to write on the row.**

## ✅ Verdict — yes, build the trigger, in migration 005

With three conditions:

**1. It never raises.** `EXCEPTION WHEN OTHERS THEN RETURN NEW`, always.

**2. It does not generate a username.** At `auth.users` insert time there's no `full_name` to derive from, and deriving from the email local part would bake roll numbers — which encode branch and batch year — into permanent public handles. Username stays NULL until onboarding, where the student chooses it and `users_username_required_when_complete` enforces it.

**3. The JavaScript inserts stay.** Change them to `upsert` with `onConflict: 'id', ignoreDuplicates: true`. Belt and braces: if the trigger is ever dropped during a Supabase upgrade, signup still works. Costs one word per call site.

**On `SECURITY DEFINER`:** the trigger needs it, because GoTrue's internal role can't write to `public.users`. Pin `search_path` the way migration 003 already does for your other definer functions — that's an established pattern in your codebase now, and it closes the search-path hijack class of attack.

---

# PART 1 — Files, flow, and blocks

## Files touched in Phase 1

| Path (from repo root) | Action | Owner |
|---|---|---|
| `supabase/migrations/<ts>_usernames.sql` | **create** | Vishwajeet |
| `supabase/migrations/<ts>_username_backfill.sql` | **create** | Vishwajeet |
| `supabase/migrations/<ts>_rls_stage2_users_messages.sql` | **create** | Vishwajeet |
| `backend/src/modules/auth/auth.controller.js` | modify | Vishwajeet |
| `backend/src/modules/auth/auth.routes.js` | modify | Vishwajeet |
| `backend/src/modules/products/products.controller.js` | modify | Vishwajeet |
| `backend/scripts/seedDemo.js` | modify | Vishwajeet |
| `backend/API.md` | modify | both |
| `docs/CHANGELOG.md` | modify | both |
| `docs/CURRENT_STATE.md` | modify | Vishwajeet |
| `mobile/.env` | modify | Vishwajeet |
| `docs/PHASE_1_ADDENDUM_PASSWORDS.md` | **delete** | Vishwajeet |
| `frontend/src/contexts/AuthContext.jsx` | modify | **Neeraj — first** |
| `frontend/src/pages/onboarding/onboarding.jsx` | modify | Neeraj |
| `frontend/src/pages/auth/Auth.jsx` | modify | Neeraj |
| `frontend/src/pages/auth/Auth.module.css` | modify | Neeraj |
| `backend/src/modules/user/user.routes.js` | modify | Neeraj |
| `backend/src/modules/user/user.controller.js` | modify | Neeraj |

---

## How Phase 1 flows

**Neeraj's `setSession()` fix gates two of your blocks**, so he starts first, then you both run in parallel.

```
        VISHWAJEET                          NEERAJ
─────────────────────────────────────────────────────────────────────
DAY 0   Fix mobile/.env  (§0.4)             ⭐ N-BLOCK A
        Delete the addendum file               AuthContext setSession()
                                               ← Blocks D and G wait on this
─────────────────────────────────────────────────────────────────────
DAY 1   BLOCK A  Migration 005                 (A continues)
                 usernames + password
                 + handle_new_user trigger
─────────────────────────────────────────────────────────────────────
DAY 2   BLOCK B  Migration 006 backfill      ◄── setSession merged
        BLOCK C  Test + push 005/006
        ──────────── HANDOFF A ─────────→
─────────────────────────────────────────────────────────────────────
DAY 3   BLOCK D  🚨 onboarding requireAuth   N-BLOCK B  onboarding sends
                 + username + password                  Bearer token
        ⚠️ THESE TWO MUST MERGE TOGETHER — see the warning in Block D
─────────────────────────────────────────────────────────────────────
DAY 4   BLOCK E  password endpoints          N-BLOCK C  user module
        BLOCK F  products security fixes
─────────────────────────────────────────────────────────────────────
DAY 5   BLOCK G  Migration 004 RLS stage 2   N-BLOCK D  auth tab switcher
                 (now unblocked)                        (§0.6 design)
─────────────────────────────────────────────────────────────────────
DAY 6   Review Neeraj's PRs                  Test both login paths
        Joint: two-browser Realtime test (Block G)
─────────────────────────────────────────────────────────────────────
```

**Why Block G is last for you even though it's numbered lower:** it's blocked on Neeraj; 005/006 aren't. Starting with what isn't blocked keeps you both moving, and the timestamps handle ordering.

**004 and 005/006 don't collide.** 004 touches `users` (RLS + policy) and `messages`. 005 touches `users` (adds columns) and creates new tables. Different operations on the same table are fine.

---

# ══════════════════════════════════════════
# TRACK 1 — VISHWAJEET: manual steps
# ══════════════════════════════════════════

## BLOCK 0 — Housekeeping (10 minutes)

```bash
cd /path/to/Yahora
git checkout main && git pull
rm docs/PHASE_1_ADDENDUM_PASSWORDS.md
# then edit mobile/.env per §0.4
git add -A && git commit -m "chore: merge password addendum into phase 1 runbook, point mobile at local"
git push origin main
```

Also push your 4 unpushed commits — `infiniper` is ahead of `main` and Neeraj can't see migration 003 until it lands.

- [ ] `git log origin/main..HEAD` prints nothing (everything is pushed)
- [ ] `docs/PHASE_1_ADDENDUM_PASSWORDS.md` is gone
- [ ] `mobile/.env` points at local

---

## BLOCK A — Migration 005 (usernames + passwords + trigger)

This is the biggest migration in the phase. Four things go in one file, because they're all preconditions for onboarding working.

### A1. Understand what you're building, before writing SQL

**Four problems, four pieces of schema.**

**Problem 1 — Case.** If `Rahul` and `rahul` are different rows, two people own what looks like the same handle, and `/Rahul` and `/rahul` are different URLs. → Store lowercase always, enforced by a `CHECK` so a bug in either client can't sneak a capital in.

**Problem 2 — The race.** Student A and Student B both check `rahul`, both see "available", both submit. No amount of checking prevents this, because the check and the insert are two separate moments. → The `UNIQUE` index is the real arbiter. The database rejects the second insert with error `23505`; the backend catches that specific code.

**Problem 3 — Route collisions.** You chose root-level URLs (`/rahul`), so `/settings` would be a username. → A `reserved_usernames` table, enforced by a trigger.

**Problem 4 — Squatting.** Rahul renames to `rahul.sharma`; a bot grabs `rahul` seconds later and impersonates him. → `username_history` keeps a released handle locked for 30 days.

**And two more from the password work:**

**Problem 5 — Supabase can't log in by username.** `signInWithPassword` accepts an email or a phone, never a username, and there's no setting to change that. → A `SECURITY DEFINER` function that maps username → email, callable only by your backend.

**Problem 6 — Brute force.** Without tracking, someone writes a 20-line script and tries a million passwords overnight. → An `auth_attempts` table plus a 15-minute lockout.

### A2. How passwords work in Supabase — read this before you write the migration

**You will never store a password.** Your `public.users` table gets no password column. Not a hashed one, not an encrypted one, nothing.

Supabase Auth owns a separate schema, `auth`, and `auth.users` already has an `encrypted_password` column. Supabase handles the bcrypt hashing, the per-user salting, and the timing-safe comparison. Three functions are all you need:

| Function | Does | Called by |
|---|---|---|
| `supabase.auth.admin.updateUserById(id, { password })` | Sets or changes a password | Your backend, service-role key |
| `supabase.auth.signInWithPassword({ email, password })` | Checks a password, returns a session | Your backend |
| `supabase.auth.admin.getUserById(id)` | Reads auth state | Your backend |

> **Why "never roll your own" matters here.** Password hashing looks simple and is full of traps — bcrypt vs argon2, work factors, per-user salts, and comparing hashes in constant time so an attacker can't measure how long the comparison took and deduce the password character by character. Supabase's implementation runs in a very large number of production apps and has been reviewed. Yours would run in one app and be reviewed by nobody.

**The wrinkle: your `public.users` table has no email column.** I checked — it holds `id`, `university_id`, `full_name`, `avatar_url`, `bio`, `qualification`, `course_id`, `specialization_id`, `year_of_study`, `is_profile_complete`, `created_at`. Email lives only in `auth.users`.

That's a good design: you don't want emails in a table other students could read if a policy is slightly wrong. But it means username → email has to reach across into the `auth` schema, and that's what `get_login_email()` below is for.

**Read the `REVOKE` lines on that function carefully.** `SECURITY DEFINER` means it runs with its creator's permissions, so it *can* see `auth.users` even though the caller can't. Without the revokes, anyone holding your publishable key could turn any public username into a private email address — **a mass email harvest of your entire student body**. The revokes mean only the service role can call it.

Compare with `is_username_available()`: also `SECURITY DEFINER`, but fine for anyone to call, because it returns a single boolean and reveals nothing the profile URL doesn't already. **Every `SECURITY DEFINER` function needs an explicit decision about who may execute it.**

### A3. Create the file

```bash
supabase migration new usernames
```

Note the exact path it prints — e.g. `supabase/migrations/20260814101500_usernames.sql`.

### A4. Fill it in

Run **CC-1** (Track 2). The SQL it writes is specified there in full.

### A5. Test locally

```bash
supabase db reset
```

- [ ] All five migrations apply with no error. **Never push a migration that hasn't survived a clean `db reset`.**

### A6. 👁️ Verify in local Studio

Open **`http://127.0.0.1:54323`**.

- [ ] **Table Editor → `users`** — new columns `username`, `username_changed_at`, `has_password` at the far right
- [ ] **Table Editor → `reserved_usernames`** — exists, ~60 rows. Scroll it: you should see `admin`, `marketplace`, `settings`, `yahora`
- [ ] **Table Editor → `username_history`** — exists, empty (correct — nobody has renamed yet)
- [ ] **Table Editor → `auth_attempts`** — exists, empty
- [ ] **Database → Functions** — `is_username_available`, `generate_username`, `suggest_usernames`, `search_users`, `get_login_email`, `handle_new_user`
- [ ] **Database → Triggers** — `on_auth_user_created` on `auth.users`

### A7. 👁️ Test the username functions by hand

Local Studio → **SQL Editor**. Run each and read the result — this is the real test of migration 005.

```sql
SELECT is_username_available('rahul');          -- true
SELECT is_username_available('admin');          -- false  (reserved)
SELECT is_username_available('ab');             -- false  (too short)
SELECT is_username_available('Rahul');          -- false  (uppercase)
SELECT is_username_available('rahul..sharma');  -- false  (double dot)
SELECT is_username_available('.rahul');         -- false  (leading dot)
SELECT is_username_available('rahul.');         -- false  (trailing dot)
SELECT is_username_available('a_very_long_username_here');  -- false (>20)
SELECT is_username_available('rahul_2026');     -- true
```

- [ ] All nine correct

```sql
SELECT generate_username('Rahul Sharma');   -- rahul.sharma
SELECT generate_username('   ');            -- starts with 'student'
SELECT generate_username('R');              -- starts with 'student'
SELECT generate_username('Ravi!!!  Kumar'); -- ravi.kumar
```

- [ ] No errors, no NULLs, every result 3–20 lowercase characters

```sql
SELECT suggest_usernames(
  'Rahul Sharma',
  (SELECT id FROM universities WHERE domain = 'iiitk.ac.in')
);
```

- [ ] Exactly 3 distinct handles, at least one containing the campus slug

> Returns NULL? Your `supabase/seed.sql` universities didn't load. Run `SELECT * FROM universities;` first.

### A8. 👁️ Test the trigger — the new piece

This is the one that can't be checked by reading the file, because it only fires when GoTrue inserts a user.

**Test 1 — a known domain binds the university.** Local Studio → SQL Editor:

```sql
-- Count before
SELECT count(*) FROM public.users;
```

Then 📮 Postman: `POST {{baseUrl}}/api/auth/request-otp` with `{ "email": "triggertest@iiitk.ac.in" }`, read the code from 📧 Mailpit, and `POST {{baseUrl}}/api/auth/verify-otp`.

```sql
SELECT u.id, u.username, u.is_profile_complete, un.name AS university
FROM public.users u
LEFT JOIN universities un ON un.id = u.university_id
ORDER BY u.created_at DESC LIMIT 1;
```

- [ ] A row exists for the new user
- [ ] `university` reads **IIITDM Kurnool** — the trigger resolved the domain
- [ ] `username` is **NULL** — correct, it's chosen at onboarding
- [ ] `is_profile_complete` is **false**

**Test 2 — the trigger cannot break signup.** This is the important one. Simulate an unknown domain by inserting straight into `auth.users`:

```sql
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'nobody@unknown-college.edu',
        '', now(), now(), now());

SELECT u.id, u.university_id, u.is_profile_complete
FROM public.users u
JOIN auth.users au ON au.id = u.id
WHERE au.email = 'nobody@unknown-college.edu';
```

- [ ] 👁️ **The `INSERT` succeeded.** If it errored, your trigger raises and it will break real signups — go fix it before anything else.
- [ ] A `public.users` row exists with `university_id` **NULL** and `is_profile_complete` false

```sql
DELETE FROM auth.users WHERE email = 'nobody@unknown-college.edu';
```

- [ ] The `public.users` row disappeared too — `ON DELETE CASCADE` working

**Test 3 — the JS upsert is harmless.** `verifyOtp` now upserts a row the trigger already created.

- [ ] Sign up one more test user through Postman → still `200`, no duplicate-key error
- [ ] 👁️ Studio → exactly one `public.users` row for that email

### A9. 👁️ Test the password plumbing

```sql
-- has_password exists and defaults false
SELECT column_name, column_default FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'has_password';

-- auth_attempts is locked down
SELECT rowsecurity FROM pg_tables WHERE tablename = 'auth_attempts';   -- true
SELECT count(*) FROM pg_policies WHERE tablename = 'auth_attempts';    -- 0
```

- [ ] All three correct

**Then the check that actually matters** — prove the email function is locked down:

```sql
SET ROLE anon;
SELECT get_login_email('rahul');
-- EXPECTED: ERROR: permission denied for function get_login_email
RESET ROLE;
```

- [ ] 👁️ You saw a **permission denied error**. If it returned an email, the revokes didn't take, and anyone with your publishable key can harvest every student's email address. **Stop and fix before pushing.**

> `SET ROLE anon` makes Postgres pretend to be the anonymous web visitor for the rest of the session. It's the cheapest way to test what an attacker can actually reach — use it any time you add a `SECURITY DEFINER` function.

### A10. 👁️ Verify the new tables are closed

Migration 003 revoked default privileges, so this should be automatic — but verify, because it's the whole point of that migration.

```sql
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('reserved_usernames','username_history','auth_attempts')
  AND grantee IN ('anon','authenticated');
```

- [ ] 👁️ **No rows.** Any row here means a table was born world-accessible and the default-privileges revoke didn't cover it.

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('reserved_usernames','username_history','auth_attempts');
```

- [ ] All three show `rowsecurity = true`

---

## BLOCK B — Migration 006 (backfill)

### B1. Create it

```bash
supabase migration new username_backfill
```

### B2. Fill it in

Run **CC-2** (Track 2).

> ### ⚠️ The subtlest thing in this phase — understand it before you run it
>
> You might expect the backfill to be one statement:
>
> ```sql
> UPDATE users SET username = generate_username(full_name) WHERE username IS NULL;  -- WRONG
> ```
>
> **This fails**, and the reason matters.
>
> A single SQL statement sees a snapshot of the table from when the statement *started*. Rows it writes are not visible to itself while it runs. So if two students are both named "Rahul Sharma", `generate_username` is called twice, and *both* times it looks at the old snapshot where `rahul.sharma` is free. It returns `rahul.sharma` twice. The unique index rejects the whole statement, and **every row rolls back** — including the thousands that were fine.
>
> The `DO $$ ... LOOP` version issues one `UPDATE` per row. Each completes before the next begins, so iteration 2 can see what iteration 1 wrote, and correctly returns `rahul.sharma.7402`.
>
> **The general lesson:** whenever a generated value depends on values you're writing in the same operation, you must loop, not batch.

### B3. ⚠️ Expect `seedDemo.js` to break — that's the point

Migration 006 adds the constraint making a username mandatory once `is_profile_complete = true`. Your seed script creates completed users with no username, so it will now fail.

```bash
supabase db reset
node backend/scripts/seedDemo.js
```

- [ ] 👁️ It fails with a constraint violation naming `users_username_required_when_complete`

**That failure is a good sign** — the database is now enforcing the rule, and no code path can create a completed user without a handle. Confirm you see it before fixing it.

### B4. Fix the seed script

Run **CC-3** (Track 2).

```bash
supabase db reset && node backend/scripts/seedDemo.js
```

- [ ] Completes with no errors

### B5. 👁️ Verify seeded data

Studio → Table Editor → `users`:

- [ ] Every row has a username
- [ ] They look like real handles (`rahul.sharma`, `priya_niet`) — not `user1`, `user2`, `test_a`
- [ ] All lowercase, none duplicated

```sql
SELECT count(*) FROM users WHERE username IS NULL AND is_profile_complete = true;  -- 0
SELECT username, count(*) FROM users WHERE username IS NOT NULL
  GROUP BY username HAVING count(*) > 1;                                            -- no rows
```

- [ ] Both clean

### B6. Prove the backfill loop works

The backfill ran against a table where every row already had a handle, so it hasn't been exercised. Simulate real conditions:

```sql
ALTER TABLE users DROP CONSTRAINT users_username_required_when_complete;

UPDATE users SET username = NULL
WHERE id IN (SELECT id FROM users WHERE is_profile_complete = true LIMIT 3);

-- the loop from your migration
DO $$
DECLARE r RECORD; new_username TEXT;
BEGIN
  FOR r IN SELECT id, full_name FROM users
           WHERE username IS NULL AND is_profile_complete = true LOOP
    new_username := generate_username(coalesce(r.full_name, 'student'));
    UPDATE users SET username = new_username WHERE id = r.id;
  END LOOP;
END $$;

SELECT count(*) FROM users WHERE username IS NULL AND is_profile_complete = true;  -- 0

ALTER TABLE users ADD CONSTRAINT users_username_required_when_complete CHECK (
  is_profile_complete = false OR username IS NOT NULL
);
```

- [ ] The three users got new handles; the constraint went back on without error

### B7. Prove the collision case

```sql
ALTER TABLE users DROP CONSTRAINT users_username_required_when_complete;

UPDATE users SET username = NULL, full_name = 'Test Duplicate'
WHERE id IN (SELECT id FROM users WHERE is_profile_complete = true LIMIT 2);

DO $$
DECLARE r RECORD; new_username TEXT;
BEGIN
  FOR r IN SELECT id, full_name FROM users
           WHERE username IS NULL AND is_profile_complete = true LOOP
    new_username := generate_username(coalesce(r.full_name, 'student'));
    UPDATE users SET username = new_username WHERE id = r.id;
  END LOOP;
END $$;

SELECT username FROM users WHERE full_name = 'Test Duplicate';
```

- [ ] 👁️ **Two different handles** — e.g. `test.duplicate` and `test.duplicat4821`. Neither NULL, no error.

If both came out identical or the block errored, `generate_username` isn't seeing the previous iteration's write. Stop and tell me.

```bash
supabase db reset && node backend/scripts/seedDemo.js
```

---

## BLOCK C — Push 005 and 006 to production

### C1. 👁️ Take a "before" reading

Production dashboard → SQL Editor (read-only, safe):

```sql
SELECT count(*) AS total_users FROM users;
SELECT count(*) AS completed FROM users WHERE is_profile_complete = true;
SELECT count(*) AS orphans FROM auth.users au
  LEFT JOIN public.users u ON u.id = au.id WHERE u.id IS NULL;
```

- [ ] Write all three down. The third is new — it tells you whether any auth users are already missing a profile row. If `orphans > 0`, tell me before pushing; the trigger only helps future signups and those rows need a one-off fix.

### C2. Push

```bash
supabase db push
```

- [ ] Lists exactly `usernames` and `username_backfill`, both apply cleanly

> If `username_backfill` fails, the likely cause is a production user with `is_profile_complete = true` and a NULL or empty `full_name`. The `coalesce` handles it — but send me the error rather than improvising.

### C3. 👁️ Verify production

```sql
SELECT count(*) FROM users;
-- must match total_users from C1 exactly

SELECT count(*) FROM users WHERE username IS NULL AND is_profile_complete = true;  -- 0
SELECT username, count(*) FROM users WHERE username IS NOT NULL
  GROUP BY username HAVING count(*) > 1;                                            -- no rows

SELECT full_name, username FROM users
WHERE username IS NOT NULL ORDER BY created_at LIMIT 20;
```

- [ ] User count unchanged — this migration adds columns; it must not have deleted anyone
- [ ] Zero completed users without a handle, zero duplicates
- [ ] 👁️ **Read those 20 handles.** These are your real students' permanent identities. If any looks wrong — an email fragment, a roll number, gibberish — stop and tell me before students see them.

### C4. Send Handoff A

Append to `docs/CHANGELOG.md` and message Neeraj:

> **Migrations 005 + 006 applied (local + production).**
>
> `users` gains `username`, `username_changed_at`, `has_password`. New tables: `reserved_usernames`, `username_history`, `auth_attempts` — all backend-only, RLS on, no client grants.
>
> **New:** trigger `on_auth_user_created` on `auth.users` creates the `public.users` row automatically. It never raises — unknown domains produce a row with `university_id` NULL rather than a failed signup. The JS inserts are now upserts and stay as a fallback.
>
> **Username is NULL until onboarding.** The DB rejects `is_profile_complete = true` without one.
>
> **DB functions ready for your user module:** `is_username_available`, `suggest_usernames`, `generate_username`, `search_users`. Call these — don't reimplement their logic in JS.
>
> **Not yours:** `get_login_email` is revoked from anon/authenticated and is backend-only. Don't call it from the user module.
>
> You're unblocked for N-Block C. **Don't build follow buttons or private-account UI** — that's Phase 3.

---

## BLOCK D — 🚨 The onboarding security fix (+ username + password)

> ### ⚠️ COORDINATION WARNING — read before you start
>
> Adding `requireAuth` to `/api/auth/onboarding` **breaks the current web onboarding page the moment it merges.** `frontend/src/pages/onboarding/onboarding.jsx` sends `userId` in the body with a `"replace-with-actual-uuid"` fallback and no `Authorization` header — it will start returning `401` and no student can complete signup.
>
> **Your Block D and Neeraj's N-Block B must merge in the same window.** Message him before you open the PR. If his AuthContext fix (N-Block A) isn't merged yet, wait — he cannot send a token he doesn't have.

Run **CC-4** (Track 2).

### 👁️ CHECK 1 — the security fix actually closed the hole

**This is the single most important test in Phase 1.**

Sign up two test users through Postman (request-otp → 📧 Mailpit → verify-otp). Save user A's token. Get user B's UUID from Studio.

📮 `POST {{baseUrl}}/api/auth/onboarding` · Bearer **user A's token**

```json
{
  "userId": "<USER B's uuid>",
  "full_name": "Hijacked",
  "username": "hijack2026",
  "password": "attacker123",
  "qualification": "Graduation",
  "course_id": "<real uuid from Studio>",
  "year_of_study": "3rd year",
  "specialization_id": "<real uuid from Studio>"
}
```

- [ ] 👁️ Studio → **user B's row is completely unchanged** — name, username, `has_password`, all as before
- [ ] 👁️ Studio → whatever changed, changed on **user A's** row. The `userId` in the body was ignored entirely.
- [ ] Repeat with **no Authorization header** → `401 UNAUTHORIZED`

**If user B's row changed, the fix isn't in. Do not push.**

### 👁️ CHECK 2 — normal onboarding still works

📮 Same endpoint, Bearer user A's token, no `userId` field:

```json
{
  "full_name": "Test User",
  "username": "testuser2026",
  "password": "mytestpass123",
  "qualification": "Graduation",
  "course_id": "<real uuid>",
  "year_of_study": "3rd year",
  "specialization_id": "<real uuid>"
}
```

- [ ] `200` with the user object, `"username": "testuser2026"`, `"has_password": true`
- [ ] 👁️ Studio → `users` → that row has `has_password = true`
- [ ] 👁️ Studio → SQL Editor:

```sql
SELECT email, encrypted_password IS NOT NULL AS has_pw
FROM auth.users WHERE email = 'testuser@iiitk.ac.in';
```

- [ ] `has_pw` is `true`
- [ ] 👁️ **Look at the actual `encrypted_password` value.** It's a bcrypt hash starting `$2a$`. Confirm with your own eyes that your plaintext password appears nowhere in the database.

### 👁️ CHECK 3 — the username failure cases

Same request, change only `username`:

| `username` | Expected |
|---|---|
| `"admin"` | `400` · `USERNAME_RESERVED` |
| a seeded handle, e.g. `"rahul.sharma"` | `400` · `USERNAME_TAKEN` |
| `"Rahul..S"` | `400` · `INVALID_FORMAT` |
| *(field removed)* | `400`, clear message |

- [ ] All four give a clean `400` with a specific code
- [ ] **None returns `500`.** A 500 means a raw database error leaked instead of being caught — precisely the bug this endpoint exists to prevent.

### 👁️ CHECK 4 — the password failure cases

Change only `password`:

| `password` | Expected |
|---|---|
| `"short"` | `400` · `WEAK_PASSWORD` |
| `"password"` | `400` · `COMMON_PASSWORD` |
| same as the username | `400` · `WEAK_PASSWORD` |

- [ ] All three correct

### 👁️ CHECK 5 — the race condition

🖥️ DevTools console (Postman can't do this). Get two tokens from two fresh users.

```js
const BASE = 'http://localhost:5000';
const A = 'paste-first-token';
const B = 'paste-second-token';

const call = (t) => fetch(`${BASE}/api/auth/onboarding`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
  body: JSON.stringify({
    full_name: 'Race Test', username: 'racetest', password: 'racetestpass1',
    qualification: 'Graduation', course_id: '<uuid>',
    year_of_study: '3rd year', specialization_id: '<uuid>'
  })
});

const rs = await Promise.all([call(A), call(B)]);
for (const r of rs) console.log(r.status, await r.json());
```

- [ ] One logs `200`, the other logs `400` with `USERNAME_TAKEN`
- [ ] **Neither logs `500`**
- [ ] 👁️ Studio → exactly one row has `racetest`

---

## BLOCK E — Password endpoints

Three new endpoints in `backend/src/modules/auth/` — your module, not Neeraj's.

| Method | Path | Auth | Note |
|---|---|---|---|
| `POST` | `/api/auth/login-password` | none | One generic error for every failure (§0.6) |
| `POST` | `/api/auth/set-password` | required | For the settings screen later — not used in Phase 1 UI |
| `GET` | `/api/auth/password-status` | required | Backend/mobile use; the web no longer needs it |

**Contract:**

```
POST /api/auth/login-password
Body: { "identifier": "rahul" | "rahul@iiitk.ac.in", "password": "..." }
200   { "message", "session", "userAuth", "userProfile" }   ← identical shape to verify-otp
400   { "error": "INVALID_CREDENTIALS",
        "message": "Incorrect username or password. Please try again." }
        ↑ returned for ALL of: wrong password, unknown username,
          unknown email, account without a password
429   { "error": "TOO_MANY_ATTEMPTS", "retry_after_seconds": 900 }

POST /api/auth/set-password
Body: { "password": "...", "current_password": "..." }   ← current_password required only if has_password is already true
200   { "message": "Password set", "has_password": true }
400   { "error": "WEAK_PASSWORD" | "COMMON_PASSWORD" }
401   { "error": "INVALID_CURRENT_PASSWORD" }

GET /api/auth/password-status
200   { "has_password": true }
```

### E1. The design decisions behind them

Settled in §0.6. Recapping the ones that shape the code:

**1. Password mandatory at onboarding.** No optional path, so the password tab always works for anyone who finished onboarding.

**2. One login field, username *or* email.** Instagram does this and people expect it. Contains `@` → treat as email; otherwise look up the username via `get_login_email`.

**3. One error string for every failure.** Wrong password, unknown username, unknown email, account without a password — all return byte-identical `INVALID_CREDENTIALS` with *"Incorrect username or password. Please try again."* See §0.6 for why. The new-user guidance lives in permanent UI helper text, not in the error.

**4. `PASSWORD_NOT_SET` is not returned to the client.** The backend still detects it (someone who abandoned onboarding after OTP) and logs the real reason server-side, but responds generically.

**5. Lock the identifier, not the IP.** 10 failures in 15 minutes → 15-minute lock, `429`. Campus students share NAT'd Wi-Fi, so hundreds appear as one IP; an IP lock would lock out a whole hostel because one person fat-fingered their password. Log `req.ip` for analysis, never gate on it.

**6. OTP is the password reset.** No reset tokens, no expiring links, no reset emails.

**Password rules:** minimum 8 characters, nothing else. No forced symbol, digit, or capital — complexity rules push people toward `Password1!`, which is in every cracking dictionary. Length is what matters. Do reject the obvious ones (`password`, `12345678`, `qwerty123`, their own username); a ~20-word blocklist catches most genuinely terrible choices.

> **Why the rate limit must fire for unknown identifiers too.** If a failed lookup were free, someone could probe thousands of usernames per minute at no cost. Log the failed attempt *before* returning, on every path — including "no such user".

### E2. Build them

Run **CC-5** (Track 2).

### E3. 👁️ Test in Postman

**Login with username:**

📮 `POST {{baseUrl}}/api/auth/login-password` · **no** Authorization header

```json
{ "identifier": "testuser2026", "password": "mytestpass123" }
```

- [ ] `200` with a `session` containing `access_token`
- [ ] The response shape matches `verify-otp` exactly — same keys, so the clients reuse their storage code

**Login with email:** same request, `"identifier": "testuser@iiitk.ac.in"`

- [ ] `200` — one field, both forms accepted

**Failure cases:**

| Body | Expected |
|---|---|
| correct identifier, `"password": "wrongpass"` | `400 INVALID_CREDENTIALS` |
| `"identifier": "nosuchuser999"` | `400 INVALID_CREDENTIALS` |
| `"identifier": "nobody@iiitk.ac.in"` | `400 INVALID_CREDENTIALS` |
| a user who abandoned onboarding (no password) | `400 INVALID_CREDENTIALS` |

- [ ] 👁️ **All four responses are byte-for-byte identical.** Put them side by side in Postman and compare the status, the `error` code, and the `message` string. If any differs — even the wording — you're leaking which accounts exist.
- [ ] 👁️ Check your server console: the fourth case logged something like `[login] has_password=false for <uuid>`. The backend must know the difference even though the client can't see it.

**Brute-force lockout** — 🖥️ DevTools console:

```js
const BASE = 'http://localhost:5000';
for (let i = 1; i <= 12; i++) {
  const r = await fetch(`${BASE}/api/auth/login-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'testuser2026', password: 'wrong' + i })
  });
  console.log(i, r.status, (await r.json()).error);
}
```

- [ ] 1–10 return `400 INVALID_CREDENTIALS`; 11–12 return `429 TOO_MANY_ATTEMPTS` with `retry_after_seconds`
- [ ] 👁️ Studio → `auth_attempts` → 12 rows, all `succeeded = false`

Now, still locked, try the **correct** password:

- [ ] Still `429`. The lock is on the identifier, not on being wrong — that's what makes it a lockout rather than a speed bump.

```sql
DELETE FROM auth_attempts WHERE identifier = 'testuser2026';
```

- [ ] Correct password now returns `200`
- [ ] 👁️ `auth_attempts` → a new row with `succeeded = true`, no leftover failures

**Changing a password:**

📮 `POST {{baseUrl}}/api/auth/set-password` · Bearer `{{token}}`

| Body | Expected |
|---|---|
| `{ "password": "short" }` | `400 WEAK_PASSWORD` |
| `{ "password": "password" }` | `400 COMMON_PASSWORD` |
| `{ "password": "newpass456", "current_password": "wrongone" }` | `401 INVALID_CURRENT_PASSWORD` |
| `{ "password": "newpass456", "current_password": "mytestpass123" }` | `200` |

- [ ] All four correct
- [ ] Login with the **new** password → `200`; with the **old** one → `400 INVALID_CREDENTIALS`

> **Why `current_password` is required for a change but not the first set:** the first set happens during onboarding, seconds after they proved they own the university inbox — strong enough. A later change could be someone using a phone left unlocked on a library desk, so it needs proof they know the existing password.

---

## BLOCK F — Products security fixes

`docs/CURRENT_STATE.md` items 3 and 4. Run **CC-6** (Track 2).

Four holes:
1. `updateProduct` — no ownership check
2. `deleteProduct` — no ownership check
3. `toggleLikeProduct` / save handlers — read `user_id` from `req.body`, and no campus check
4. `messages.controller.js:35` — unvalidated params interpolated into a PostgREST `.or()` filter

### 👁️ CHECK

Two accounts on **different campuses**. Save tokens as `tokenA` (IIITK) and `tokenB` (NIET). From Studio, note: a product owned by someone else, a NIET product, and one of your own.

| Test | Request | Expected |
|---|---|---|
| Edit another's listing | `PATCH /api/products/<other-id>` Bearer A, `{"title":"HACKED"}` | `403 FORBIDDEN` |
| Delete another's listing | `DELETE /api/products/<other-id>` Bearer A | `403 FORBIDDEN` |
| Like across campus | `POST /api/products/<niet-id>/like` Bearer A | `403 CROSS_CAMPUS_INTERACTION_BLOCKED` |
| Like as someone else | `POST /api/products/<own-campus-id>/like` Bearer A, body `{"user_id":"<B's uuid>"}` | recorded as **A**, not B |
| **Own listing still editable** | `PATCH /api/products/<your-id>` Bearer A, `{"title":"Updated"}` | `200`, title changes |

- [ ] 👁️ After tests 1 and 2, Studio shows the product **unchanged**
- [ ] 👁️ After test 4, Studio → `product_likes` → the row's `user_id` is **A's**
- [ ] Test 5 passes — a security fix that blocks legitimate use is a bug, not a fix

---

## BLOCK G — Migration 004 (RLS stage 2)

**⛔ Blocked until Neeraj's `setSession()` is merged and verified.** Check first:

```bash
git pull
grep -rn "setSession" frontend/src/contexts/AuthContext.jsx
```

- [ ] Prints a real call. If not, stop — these policies would silently break the site.

### G1. Why this was deferred, and what changes now

Migration 003 locked 11 tables. `users` and `messages` were left open because the web client runs as `anon` with `auth.uid()` NULL, so a policy like `using (id = auth.uid())` matches **zero rows** — the marketplace campus switcher and the unread badge would silently show nothing.

With `setSession()` in place, web queries carry a real JWT and run as `authenticated` with a working `auth.uid()`. Now the policies work.

### G2. What 004 does

**`users`** — RLS on, plus:

```sql
create policy users_select_own on public.users
  for select to authenticated
  using (id = (select auth.uid()));

revoke select on public.users from anon;
```

Both frontend reads (`Marketplace.jsx:481`, `ProductDetail.jsx:121`) are `.eq("id", currentUserId)` on their own row, so this is all they need. **Your student directory becomes unreachable from the public key entirely.**

> The `(select auth.uid())` wrapping isn't cosmetic. Postgres evaluates it once per query instead of once per row — on a large table that's the difference between a fast query and a slow one.

**`messages`** — RLS on, plus:

```sql
create policy messages_select_own on public.messages
  for select to authenticated
  using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));

revoke select on public.messages from anon;
```

This one does double duty. Right now `Messages.jsx:343` subscribes to **every message row in the database** with no filter and no auth guard, and decides mine-versus-yours in JavaScript. Anyone who opened DevTools could read the entire campus's private messages.

This policy makes Realtime deliver only rows the subscriber is actually party to — **the filtering moves from the client to the database, where it can't be bypassed.**

**`avatars` bucket** — tighten the INSERT policy from `to anon, authenticated` down to `to authenticated`. Only safe once web uploads carry a token.

### G3. Build it

Run **CC-7** (Track 2).

### G4. 👁️ Test in SQL — impersonate a specific student

Different from 003, because these policies are user-specific. Local Studio → SQL Editor:

```sql
-- Grab two real student ids
SELECT id, full_name FROM users LIMIT 2;
```

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<student A uuid>","role":"authenticated"}';

select count(*) from messages;   -- only A's conversations
select count(*) from users;      -- expect exactly 1 (their own row)
commit;
```

Repeat with student B's id.

- [ ] 👁️ **The two message counts differ.** If they're identical, a policy is wrong — you're seeing everyone's messages.
- [ ] Both `users` counts are `1`
- [ ] Every returned message row has A (or B) as sender or receiver — spot-check by selecting `sender_id, receiver_id` instead of `count(*)`

```sql
begin;
set local role anon;
select count(*) from users;      -- expect permission denied or 0
select count(*) from messages;   -- expect permission denied or 0
commit;
```

- [ ] 👁️ Anonymous callers see nothing

### G5. 👁️ Test in the browser — two profiles side by side

**This is the test that catches a policy that's technically correct but breaks chat delivery.** SQL alone won't find it, because Realtime applies policies through a different path.

1. Open **two Chrome profiles** side by side (⋮ → Profile → Add). Log in as Arjun in one, Priya in the other.
2. Open the Messages page in both.
3. Send a message from Arjun to Priya.

- [ ] 👁️ It appears **live** in Priya's window without a refresh
- [ ] 👁️ The unread badge in Priya's navbar increments
- [ ] 👁️ Priya replies → appears live in Arjun's window
- [ ] 👁️ Open a third profile as a student in neither conversation → their Messages page shows **nothing** from Arjun and Priya
- [ ] 👁️ DevTools → Network → WS → the Realtime frames arriving in the third window contain **no** message payloads from that conversation

That last check is the real proof. Before this migration, the third student's browser was receiving every message and simply choosing not to render them.

### G6. Push and re-verify

```bash
supabase db push
```

Then repeat G4 against **production** (read-only impersonation is safe), and G5 with two real accounts on the live site.

- [ ] 👁️ Production: two students see different message counts
- [ ] 👁️ Production: live chat still works between two browser profiles
- [ ] 👁️ Production: marketplace campus switcher still works for a logged-in student — this is the `users` read that 004 narrows

> If the campus switcher breaks, the cause is almost always that `setSession()` isn't firing on that particular page load. Check `auth.uid()` in the browser: `await supabase.auth.getUser()` in the console should return the student, not null.

---

## BLOCK H — Wrap up

- [ ] `backend/API.md` reflects everything built — onboarding's new fields, the three password endpoints, every new error code
- [ ] `docs/CURRENT_STATE.md` updated: items 1, 4, 8 resolved; migration list current
- [ ] `docs/CHANGELOG.md` has Handoff A and a Block G entry
- [ ] Neeraj's PRs reviewed against the checklist in `backend/CLAUDE.md`
- [ ] Everything pushed to `main`

---

# ══════════════════════════════════════════
# TRACK 2 — VISHWAJEET: Claude Code prompts
# ══════════════════════════════════════════

Seven prompts, in order, from the **repo root**. Don't combine them — if something breaks in a combined run you won't know which part caused it.

---

## ▶ CC-1 — Migration 005 (usernames + passwords + trigger)

```
Read first:
- docs/YAHORA_BUILD_PLAN.md §1.1 and §1.2
- docs/PHASE_1_RUNBOOK.md Part 0.5 (the trigger decision) and Part 1
  (the new-table RLS rule)
- supabase/migrations/20260812121140_rls_stage1_backend_only_tables.sql
  — follow its conventions: lowercase SQL, section comments explaining
  WHY, and `set search_path = public, pg_temp` on every SECURITY
  DEFINER function.

TASK: Write the SQL into the newest empty file in supabase/migrations/
ending in _usernames.sql. Nine sections.
I have Created new migration at supabase/migrations/20260815061951_usernames.sql

=== 1. EXTENSION ===
create extension if not exists pg_trgm;

=== 2. COLUMNS ON users ===
  username            text
  username_changed_at timestamptz
  has_password        boolean not null default false

  has_password is a CACHE ONLY. Never add a password or password_hash
  column — Supabase Auth owns the hash in auth.users.encrypted_password.

=== 3. FORMAT CONSTRAINT ===
check (username is null or (
       username = lower(username)
   and length(username) between 3 and 20
   and username ~ '^[a-z0-9][a-z0-9._]*[a-z0-9]$'
   and username !~ '[._]{2}' ))

DO NOT add the users_username_required_when_complete constraint here.
It goes in migration 006, AFTER the backfill. Adding it now would fail
on production, where existing completed users have username = NULL —
and it would PASS locally, where the table is empty. That divergence is
exactly the bug we're avoiding.

=== 4. INDEXES ===
  unique index on users(username)
  index on users(username text_pattern_ops)   -- serves LIKE 'rah%'
  GIN trgm index on users(username)
  GIN trgm index on users(full_name)
Comment why text_pattern_ops is a SEPARATE index from the unique one.

=== 5. reserved_usernames ===
Table (username text primary key, reason text not null default 'system').
Seed ~60 rows from plan §1.2: every current and planned top-level route
(marketplace, product, messages, dashboard, sell, auth, onboarding,
feed, hot, user, profile, settings, community, notifications, search,
explore, saved, wishlist, following, followers, post, posts, u), brand
and system words (yahora, admin, root, support, help, api, www, mail,
team, official, staff, moderator, mod, security), legal pages (about,
terms, privacy, contact, careers, blog, faq, guidelines, deletion,
childsafety, pricing, download), and future reservations (groups,
channels, events, jobs, rooms, clubs).

Enforce with a BEFORE INSERT OR UPDATE OF username trigger that raises
'USERNAME_RESERVED' with ERRCODE '23514'. A CHECK constraint cannot
query another table — say so in a comment.

=== 6. username_history ===
Table + indexes per plan §1.2, plus a BEFORE UPDATE trigger recording
the old handle and stamping username_changed_at.

=== 7. FUNCTIONS ===
is_username_available(p_username text, p_user_id uuid default null)
  -> boolean, STABLE, SECURITY DEFINER, search_path pinned.
  Checks format, reserved list, existing users, and the 30-day
  username_history cooling-off window. Callable by anyone — it returns
  one boolean and leaks nothing the profile URL doesn't. Do NOT revoke.

generate_username(p_name text) -> text
suggest_usernames(p_name text, p_university_id uuid default null) -> text[]
search_users(p_query text, p_viewer uuid default null, p_limit int default 20)
All exactly as specified in plan §1.2.

Random suffixes, never sequential — rahul.0001/rahul.0002 leaks your
user count and creates a scan hotspot.

=== 8. PASSWORD PLUMBING ===

get_login_email(p_identifier text) returns text
  language sql, STABLE, SECURITY DEFINER, search_path pinned.
  Joins public.users to auth.users on id, matching lower(trim(
  p_identifier)) against users.username. Returns auth.users.email.

  Then, and this is load-bearing:
    revoke execute on function public.get_login_email(text) from public;
    revoke execute on function public.get_login_email(text) from anon, authenticated;

  Comment above it: without these revokes anyone holding the
  publishable key can convert any public username into that student's
  private email address — a mass email harvest. FROM PUBLIC is required
  as well as FROM anon: Postgres grants EXECUTE to PUBLIC by default and
  anon inherits it. docs/CURRENT_STATE.md item 2 records that we already
  learned this the hard way.

auth_attempts table:
  id uuid pk default gen_random_uuid()
  identifier text not null
  ip_address text
  succeeded boolean not null
  created_at timestamptz not null default now()
  partial index on (identifier, created_at desc) where succeeded = false

cleanup_auth_attempts() — deletes rows older than 30 days.

=== 9. handle_new_user TRIGGER ===
Read Part 0.5 of the runbook first. Three requirements, all mandatory:

a) It must NEVER raise. Wrap the whole body in
   `exception when others then return new;`. If this trigger throws,
   GoTrue fails the entire signup and the student sees an opaque
   "Database error saving new user" — our friendly unknown-domain
   message would never render.

b) If the email domain matches a universities row, bind university_id.
   If it does NOT match, still insert the row with university_id NULL.
   NEVER raise on an unknown domain. users.university_id is nullable.
   A NULL there is a monitoring signal, not a failure.

c) It must NOT generate a username. There is no full_name at
   auth.users insert time, and deriving from the email local part would
   bake roll numbers — which encode branch and batch year — into
   permanent public handles. username stays NULL until onboarding.

  create function public.handle_new_user() returns trigger
    language plpgsql security definer set search_path = public, pg_temp

  Insert (id, university_id, is_profile_complete=false) with
  `on conflict (id) do nothing`.

  Trigger: after insert on auth.users for each row.

=== 10. RLS ON THE THREE NEW TABLES ===
Migration 003 revoked default privileges, so new tables are born with
no anon/authenticated grants. All three new tables are BACKEND-ONLY —
nothing in frontend/ or mobile/ queries them directly. So:

  alter table public.reserved_usernames enable row level security;
  alter table public.username_history   enable row level security;
  alter table public.auth_attempts      enable row level security;

Zero policies, zero grants. RLS on with no policy denies everything;
service_role has BYPASSRLS so the Express backend is unaffected.
Add a comment saying this is deliberate, matching 003's §3 style.

HARD CONSTRAINTS:
- Write ONLY into that one migration file.
- Do NOT run any supabase command — I run those.
- Do NOT invent SQL not specified here or in the plan. If something
  looks wrong to you, say so in your response and leave it as written.

When done, print the file's full relative path and list every database
object it creates.

Other Points:
1. We will allow standard usernames similar to Instagram, YouTube, and Twitter, may be we will enforce certain rules and restrictions accordingly. Not every combination of any class of characters will be allowed as a username.
2. Hey, claude code, please set EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 in such a way so that I don’t need to always fill in my LAN IP manually everytime and the code auto fetch and set it, so I can test the app smoothly on on my physical device. 

```
---

## ▶ CC-2 — Migration 006 (backfill)

```
Read docs/YAHORA_BUILD_PLAN.md §1.3 and docs/PHASE_1_RUNBOOK.md Block B2.

TASK: Write the backfill into the newest file in supabase/migrations/
ending in _username_backfill.sql.

1. A DO $$ ... LOOP block, one UPDATE per row:
     for r in select id, full_name from users
              where username is null and is_profile_complete = true
   Only users who finished onboarding get a generated handle. Users
   mid-signup will choose their own.

2. Above it, a 4-line comment explaining WHY this is a row-by-row loop
   and not a single UPDATE: a single statement sees a snapshot from
   before it started, so two students named "Rahul Sharma" both
   generate rahul.sharma and the unique index rolls back the entire
   statement. A future reader will be tempted to "optimise" this.

3. AFTER the loop, the constraint that was deliberately kept out of 005:
     alter table users add constraint users_username_required_when_complete
       check (is_profile_complete = false or username is not null);

4. Also after the loop:
     update users set has_password = false where has_password is distinct from true;

HARD CONSTRAINTS:
- Write ONLY into that migration file. Run no supabase command.
```

---

## ▶ CC-3 — Update the seed script

```
TASK: Update backend/scripts/seedDemo.js so every demo user has a
username, and its inserts survive the new handle_new_user trigger.
Also fix this error:

❌ Refusing to seed a non-local database.
   SUPABASE_URL = (not set)
   Expected http://127.0.0.1:54321
   Fix backend/.env, then try again.

Afterwards fix the following error:

1. USERNAMES. Migration 006 requires a username on any user with
   is_profile_complete = true. Give each demo user a realistic handle
   derived from their name — rahul.sharma, priya_niet, aditya.k. Not
   user1/user2/test_a. Lowercase, 3-20 chars, [a-z0-9._], no leading
   or trailing dot/underscore, no doubled dots, unique across the
   script. Users the script creates with is_profile_complete = false
   may keep a null username.

2. TRIGGER COMPATIBILITY. A trigger on auth.users now creates the
   public.users row automatically. The script's insert at ~line 841
   will hit a duplicate key. Change it to an upsert with
   { onConflict: 'id', ignoreDuplicates: false } so it updates the
   trigger-created row rather than failing.

3. If there is a safety guard checking SUPABASE_URL is local, leave it
   exactly as it is.

4. Report — do not change — whether the script inserts into
   universities, courses or specializations. Those are now seeded by
   supabase/seed.sql and a duplicate insert could conflict.

HARD CONSTRAINTS:
- Modify only backend/scripts/seedDemo.js. Do not run it.
- Do not change what the script seeds beyond the above.
```

---

## ▶ CC-4 — 🚨 Onboarding: security fix + username + password

```
Read docs/PHASE_1_RUNBOOK.md §0.2 and Block D in full. §0.2 describes
a live security hole in the file you are about to edit.

TASK: Rewrite completeOnboarding in
  backend/src/modules/auth/auth.controller.js
  backend/src/modules/auth/auth.routes.js

=== PART A — THE SECURITY FIX. DO THIS FIRST. ===

completeOnboarding reads userId from req.body and the route has no auth
middleware. Anyone can overwrite any user's profile by sending their
UUID. Once this endpoint also sets passwords, that becomes full account
takeover.

  1. Add requireAuth to the /onboarding route (import from
     ../../middleware/requireAuth.js).
  2. Take the user id from req.user.id ONLY.
  3. Remove userId from the destructured body entirely. If a caller
     sends it, ignore it silently — do not error, do not use it.

Then grep the whole backend for other handlers that take a user id from
req.body or req.params and use it to decide what the caller may modify.
docs/CURRENT_STATE.md item 4 already names products.controller.js:296
and the save/unsave handlers. REPORT everything you find; do NOT fix
them in this task — CC-6 handles those.

=== PART B — USERNAME ===
Accept `username`. Lowercase and trim before anything else.
Call the is_username_available(p_username, p_user_id) RPC. On false,
return 400 with the right code: USERNAME_RESERVED / USERNAME_TAKEN /
INVALID_FORMAT. A second cheap check to distinguish them is fine.

Do NOT reimplement format validation, the reserved list, or the
cooling-off window in JavaScript. The function already does all four.
If your JS and the function ever disagree we get a bug nobody can find.

=== PART C — PASSWORD ===
Accept `password`. Validate:
  - under 8 chars              -> 400 WEAK_PASSWORD
  - in a ~20-entry common-password blocklist (password, 12345678,
    qwerty123, iloveyou, admin123, letmein, ...) -> 400 COMMON_PASSWORD
  - equal to the chosen username -> 400 WEAK_PASSWORD

ORDER OF OPERATIONS — this matters:
  1. Validate everything, including username availability.
  2. Set the password via
     supabase.auth.admin.updateUserById(req.user.id, { password }).
  3. ONLY IF that succeeded, update the users row with the profile
     fields AND is_profile_complete: true AND has_password: true.

  If you set is_profile_complete = true before the password call and
  that call then fails, the student is stranded: complete profile, no
  password, never prompted to set one. Never do it in that order.

=== PART D — ERROR HANDLING ===
Wrap the update in try/catch and route errors through mapDbError() from
backend/src/utils/respond.js:
  - Postgres 23505 -> 400 USERNAME_TAKEN
  - 'USERNAME_RESERVED' in the message -> 400 USERNAME_RESERVED

THE 23505 CATCH IS THE POINT OF THIS TASK. Two students can pass the
availability check in the same instant; only the unique index can
arbitrate, and it reports that as 23505. A 500 here is a bug.

A missing username on an otherwise-complete onboarding -> 400
INVALID_FORMAT with a clear message. Never a 500.

=== PART E — THE UPSERT FALLBACK ===
migration 005 adds a trigger on auth.users that creates the
public.users row. Change the inserts in verifyOtp (~line 94) and
demoLogin (~line 222) to upserts with
{ onConflict: 'id', ignoreDuplicates: true }, so signup still works if
the trigger is ever dropped during a Supabase upgrade.

=== CONSTRAINTS ===
- Modify ONLY auth.controller.js, auth.routes.js, backend/API.md.
- Do NOT touch backend/src/modules/user/ — Neeraj's module.
- Do NOT touch utils/, middleware/, config/ — frozen shared infra.
- Never log, store or return a password or hash. Check every logging
  line you write.
- Use sendError() from utils/respond.js for every error path.
- Update backend/API.md in the same change: new body fields and every
  new error code, including the code table at the top.

When done print: every file changed, every new error code, and the full
Part A audit list.
```

---

## ▶ CC-5 — Password endpoints

```
Read docs/PHASE_1_RUNBOOK.md Block E, especially E1 (the six design
decisions). backend/API.md has the contracts.

TASK: Add three endpoints to
  backend/src/modules/auth/auth.controller.js
  backend/src/modules/auth/auth.routes.js

=== POST /api/auth/login-password  (no auth) ===
Body: { identifier, password }

  1. RATE LIMIT FIRST, before touching any credential. Count
     auth_attempts rows for lower(identifier) in the last 15 minutes
     where succeeded = false. If >= 10, return 429 TOO_MANY_ATTEMPTS
     with retry_after_seconds. Do not attempt the login.
  2. Resolve the identifier to an email:
       contains '@' -> use as-is
       otherwise    -> supabase.rpc('get_login_email', { p_identifier })
  3. No email found -> log a failed attempt, return
     400 INVALID_CREDENTIALS. Do NOT say "user not found".
  4. Check public.users.has_password. If false (someone who abandoned
     onboarding after OTP verification), log the real reason to the
     SERVER CONSOLE and return the SAME generic 400 INVALID_CREDENTIALS
     as every other failure. Do NOT return a distinct code or message —
     see docs/PHASE_1_RUNBOOK.md §0.6.
  5. createSessionClient().auth.signInWithPassword({ email, password }).
     Use createSessionClient(), NOT the shared `supabase` client — the
     shared one is service-role and signing in on it demotes it
     process-wide. That bug is already documented in docs/CHANGELOG.md;
     do not reintroduce it.
  6. On failure -> log a failed attempt, return 400 INVALID_CREDENTIALS
     with the SAME message and shape as step 3. Wrong password and
     non-existent user must be indistinguishable from outside. This
     prevents user enumeration.
  7. On success -> log a succeeded attempt, delete that identifier's
     failed attempts, fetch the public profile, and return EXACTLY the
     verifyOtp response shape: { message, session, userAuth,
     userProfile }. The clients must not need separate handling.

  Record req.ip in auth_attempts but NEVER gate on it — campus Wi-Fi
  NATs hundreds of students behind one address and an IP lock would
  lock out a whole hostel.

=== POST /api/auth/set-password  (requireAuth) ===
Body: { password, current_password }
  - Same password validation as CC-4 Part C.
  - If has_password is already true, current_password is REQUIRED:
    verify with signInWithPassword (via createSessionClient) before
    allowing the change. Wrong -> 401 INVALID_CURRENT_PASSWORD.
  - If has_password is false, current_password is not required.
  - Set via admin.updateUserById, then set has_password = true.

=== GET /api/auth/password-status  (requireAuth) ===
  200 { "has_password": boolean }

=== CONSTRAINTS ===
- Modify ONLY auth.controller.js, auth.routes.js, backend/API.md.
- Never log, store or return a password. Not in console.log, not in an
  error message, not in a response body.
- Use sendError() everywhere.
- Update backend/API.md in the same change.
```

---

## ▶ CC-6 — Products and messages security fixes

```
Read docs/CURRENT_STATE.md items 3 and 4, and
docs/YAHORA_BUILD_PLAN.md §1.6.

TASK: Fix four holes.

backend/src/modules/products/products.controller.js

1. updateProduct — takes an id from the URL and updates with no check
   that the caller owns the product. Fetch seller_id first; 404 if
   missing, 403 FORBIDDEN if it isn't req.user.id.

2. deleteProduct — same hole, same fix.

3. toggleLikeProduct and the save/unsave handlers (~line 296) — they
   read user_id from req.body. Use req.user.id instead and ignore any
   body value. They also don't check campus: our rule is browse-only
   across campuses, so compare the product's university_id to the
   caller's and return 403 CROSS_CAMPUS_INTERACTION_BLOCKED on
   mismatch.

backend/src/modules/messages/messages.controller.js

4. Line ~35 interpolates unvalidated query params into a PostgREST
   .or() filter expression. Validate that both ids are well-formed
   UUIDs before they reach the filter, and reject with 400 otherwise.
   Also verify req.user.id is one of the two parties in the
   conversation — a caller must not be able to read a thread they are
   not part of.

Add requireAuth to any of these routes that lacks it.
Use sendError() for every error. Update backend/API.md with the new
error codes on every affected endpoint.

HARD CONSTRAINTS:
- Legitimate use MUST keep working: a seller editing or deleting their
  own listing, a student liking a listing on their own campus, and a
  participant reading their own conversation. Do not over-restrict.
- Do NOT refactor anything else in these files.

When done, list every function changed and the exact check added to each.
```

---

## ▶ CC-7 — Migration 004 (RLS stage 2)

```
⛔ PRECONDITION: frontend/src/contexts/AuthContext.jsx must already
call supabase.auth.setSession(). Verify with:
  grep -rn "setSession" frontend/src/contexts/AuthContext.jsx
If it prints nothing, STOP and tell me — these policies would silently
break the live site.

Read docs/RLS_SURFACE.md §0.1, §1, §2 and §5, and
docs/PHASE_1_RUNBOOK.md Block G. Follow the conventions in
supabase/migrations/20260812121140_rls_stage1_backend_only_tables.sql.

TASK: Create a new migration named rls_stage2_users_messages.

=== 1. public.users ===
  alter table public.users enable row level security;

  create policy users_select_own on public.users
    for select to authenticated
    using (id = (select auth.uid()));

  revoke select on public.users from anon;

  Comment: both frontend reads (Marketplace.jsx:481, ProductDetail.jsx:121)
  are .eq("id", currentUserId) on their own row, so own-row SELECT is
  all they need. Note that (select auth.uid()) is wrapped deliberately —
  Postgres evaluates it once per query instead of once per row.

=== 2. public.messages ===
  alter table public.messages enable row level security;

  create policy messages_select_own on public.messages
    for select to authenticated
    using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));

  revoke select on public.messages from anon;

  Comment: Messages.jsx:343 currently subscribes to every message row
  in the database with no filter and decides mine-versus-yours in
  JavaScript. This policy moves that filtering into the database, where
  it cannot be bypassed — Realtime applies RLS to what it delivers.

=== 3. avatars bucket ===
  Drop and recreate the "Avatar uploads" policy from migration 003 §8,
  narrowing `to anon, authenticated` down to `to authenticated`.
  Only safe now that web uploads carry a token.

=== 4. VERIFY-BEFORE-YOU-WRITE ===
Before writing the policies, re-read docs/RLS_SURFACE.md and confirm
there is no OTHER direct client read of users or messages beyond the
four it lists. If you find one this migration would break, STOP and
report it instead of writing the policy.

HARD CONSTRAINTS:
- Write ONLY the new migration file.
- Do NOT touch users/messages GRANTs for service_role.
- Do NOT run any supabase command.
- Do NOT add INSERT/UPDATE/DELETE policies — all writes go through the
  backend on the service-role key. Adding write policies would widen
  the surface for no benefit.

When done, print the file path and every object it creates or changes.
```

---

# ══════════════════════════════════════════
# TRACK 3 — NEERAJ: manual steps
# ══════════════════════════════════════════

## ⭐ N-BLOCK A — The `setSession()` fix (do this FIRST, before anything else)

**Vishwajeet's migration 004 and his onboarding security fix are both blocked on this.** It's a small change with an outsized effect, so it comes ahead of the user module.

### N-A1. Understand what's broken

`frontend/src/contexts/AuthContext.jsx` stores the session in `localStorage` after login — but it never hands that session to the Supabase JS client. There is no `supabase.auth.*` call anywhere in `frontend/src/`.

**What that means:** every direct browser→Supabase query runs as the anonymous role, even for a logged-in student. Inside the database, `auth.uid()` is NULL.

So a policy like this:

```sql
using (id = auth.uid())
```

matches **zero rows** for everyone, and the page silently renders nothing — no error, no clue. That's why `users` and `messages` still have RLS off in production: turning it on today would break the marketplace campus switcher and the unread badge with no visible error to debug.

### N-A2. The fix

In `frontend/src/contexts/AuthContext.jsx`, wherever the session is restored or set:

```js
import { supabase } from '../lib/supabaseClient';   // adjust to your actual path

// after login, AND on app boot when restoring from localStorage:
await supabase.auth.setSession({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
});

// on logout:
await supabase.auth.signOut();
```

**Three things that are easy to get wrong:**

1. **It must run on app boot, not only at login.** A student who logs in on Monday and returns on Tuesday never passes through the login handler. If `setSession` only fires there, they're anonymous again on every subsequent visit — and that's the case you'd ship without noticing.
2. **`setSession` is async.** Any query that runs before it resolves still goes out as `anon`. Gate your first data fetch behind it — a `sessionReady` boolean in the context is the simplest way.
3. **Sign out properly.** Clearing `localStorage` alone leaves the Supabase client holding a valid token in memory, so the "logged out" user keeps making authenticated queries until the tab closes.

Run **N-CC-1** (Track 4) for the implementation.

### N-A3. 👁️ Verify — this check is the whole point

Log in on the site, open **DevTools → Console**:

```js
const { data } = await window.supabase.auth.getUser();
console.log(data.user);
```

> If `supabase` isn't on `window`, temporarily add `window.supabase = supabase` in your client file for testing, then remove it.

- [ ] 👁️ Prints the **logged-in student's** object, not `null`
- [ ] 👁️ **Hard refresh the page (Cmd/Ctrl+Shift+R), run it again** → still returns the student. This is the check people skip, and it's the one that catches "only fires at login".
- [ ] 👁️ Log out, run it again → returns `null`
- [ ] 👁️ DevTools → Network → any Supabase request → **Request Headers** → the `Authorization` header is a long JWT, not the anon key

Now confirm the database agrees:

```js
const { data, error } = await window.supabase.rpc('get_current_uid_test');
```

Ask Vishwajeet to add this one-liner to a migration if you want it — or simpler, just check that a query filtered on your own user id returns a row.

- [ ] 👁️ The marketplace campus switcher still works, logged in and logged out
- [ ] 👁️ The navbar unread badge still shows a count

**Message Vishwajeet the moment this merges.** He's waiting on it for two blocks.

---

## N-BLOCK B — Onboarding sends a Bearer token

> ⚠️ **This must land in the same window as Vishwajeet's Block D.** He's adding `requireAuth` to `/api/auth/onboarding`. The moment that merges, the current page — which sends `userId` in the body and no auth header — returns `401` and **no student can complete signup**. Coordinate directly.

### N-B1. What to change

`frontend/src/pages/onboarding/onboarding.jsx` currently does:

```js
const userId = localStorage.getItem("yahora_user_id") || "replace-with-actual-uuid";
// ...
body: JSON.stringify({ userId: userId, ... })
```

Two problems: the `userId` is now ignored by the backend, and that `"replace-with-actual-uuid"` fallback would send a garbage string.

- Remove `userId` from the body entirely, including the fallback
- Send `Authorization: Bearer <access_token>` from the stored session
- If there's no stored session, redirect to `/auth` rather than firing a request that will fail
- Add the `username` field (see N-B2)
- Add the `password` field (see N-B3)

### N-B2. The username step

- Text field, live availability check against `GET /api/users/username-available`
- **Debounced by 400ms.** Without this, typing "rahulsharma" fires 11 requests, they arrive out of order, and the answer for "rahul" can land *after* the answer for "rahulsharma" and overwrite it with the wrong result.
- Also discard stale responses: keep a counter, and ignore any response that isn't the newest request.
- Three tappable suggestion chips from `GET /api/users/username-suggestions?name=<full name>`
- Force lowercase as they type — convert silently, don't show an error for a capital letter
- Show what the URL will be: `yahora.com/rahul` — makes the concept concrete
- Tell them: "You can change this once every 30 days"

### N-B3. The password step

- Password + confirm, both with a show/hide eye toggle
- Live rule under the field: "At least 8 characters", with a tick when satisfied
- **Never block paste** — it breaks password managers, and password managers are good
- On `WEAK_PASSWORD` / `COMMON_PASSWORD` from the server, show the message under the field and **keep what they typed**

Run **N-CC-2** (Track 4).

### 👁️ CHECK — in the browser

- [ ] 👁️ Complete onboarding as a fresh user end to end → lands on the dashboard
- [ ] 👁️ DevTools → Network → the onboarding request → **Request Headers** show `Authorization: Bearer ...`
- [ ] 👁️ Same request → **Payload** contains **no** `userId`
- [ ] 👁️ Type a taken handle → red "taken" state with suggestions, Continue disabled
- [ ] 👁️ Type `admin` → rejected as reserved
- [ ] 👁️ Type fast and watch the Network tab — **one** availability request after you stop, not one per keystroke
- [ ] 👁️ 7-character password → rule stays unticked, Continue disabled
- [ ] 👁️ Mismatched confirm → inline error, no request sent
- [ ] 👁️ Server rejects the password → message shows and **the typed password is still there**
- [ ] 👁️ A password manager can fill both fields
- [ ] 👁️ Log out, clear localStorage, navigate to `/onboarding` → redirected to login, not a 401 error screen

---

## N-BLOCK C — Build the user module

Five endpoints in `backend/src/modules/user/`. Stubs exist; the file already has four pre-existing handlers (dashboard, profile, avatar) — **leave those alone**, add underneath.

### N-C1. Sync and verify the database

```bash
cd /path/to/Yahora
git checkout main && git pull
supabase db reset
node backend/scripts/seedDemo.js
```

- [ ] All six migrations apply cleanly; seed completes

👁️ Studio at `http://127.0.0.1:54323`:

- [ ] `users` → `username`, `has_password` columns exist, **every seeded user has a username**
- [ ] `reserved_usernames` → exists, ~60 rows
- [ ] `username_history`, `auth_attempts` → exist, empty

### N-C2. 👁️ Try the functions before calling them from code

Studio → SQL Editor:

```sql
SELECT is_username_available('rahul');   -- true
SELECT is_username_available('admin');   -- false
SELECT suggest_usernames('Rahul Sharma', (SELECT id FROM universities LIMIT 1));
SELECT * FROM search_users('rah', NULL, 10);
```

- [ ] All four sensible

**This matters more than it looks.** `is_username_available` already checks format, reserved words, existing handles, **and** the 30-day cooling-off window. Your controller calls it once and does not re-implement any of those four in JavaScript. If your code and the function ever disagree, you get a bug nobody can find.

```sql
SELECT get_login_email('rahul');
```

- [ ] This is **not yours**. It's revoked from anon/authenticated and used only by Vishwajeet's login endpoint. Don't call it from the user module.

### N-C3. Read before building

- [ ] `docs/YAHORA_BUILD_PLAN.md` §1.1 — the four problems this design solves
- [ ] `backend/API.md` — the exact contract, entries tagged `OWNER: Neeraj` `PHASE 1`
- [ ] `backend/src/utils/respond.js` — `sendError`, `mapDbError`, `sendPage`. Use these; don't write your own error shapes.

### N-C4. Build it

Run **N-CC-3** (Track 4).

### 👁️ CHECK — test all five endpoints

**C1. Availability — 🌐 browser**, no login needed:

| URL | Expected |
|---|---|
| `http://localhost:5000/api/users/username-available?username=rahul` | `available: true` |
| `…?username=admin` | `false`, `reason: "RESERVED"` |
| `…?username=Rahul` | `false`, `reason: "INVALID_FORMAT"` |
| `…?username=ab` | `false`, `reason: "INVALID_FORMAT"` |
| `…?username=<a seeded handle>` | `false`, `reason: "TAKEN"` |

- [ ] All five correct, every unavailable response includes 3 `suggestions`
- [ ] 👁️ **All five worked in a plain browser tab with no login.** That's the requirement — students check handles before they have an account. A `401` means you used `requireAuth` where `optionalAuth` belongs.

**C2. Suggestions — 🌐 browser:** `…/username-suggestions?name=Rahul%20Sharma`

- [ ] 3 distinct handles; spot-check one through C1 → comes back available

**C3. Profile by username — 🌐 browser:**

- [ ] `…/by-username/<seeded-handle>` → `200`, full user object with the `viewer` block
- [ ] `…/by-username/definitelynobody99` → `404 USER_NOT_FOUND`
- [ ] 👁️ **Ctrl+F the response for `email`.** It must not be there. Email is not in the contract, and leaking it is a privacy bug.

**C4. Search — 📮 Postman** (get a token: request-otp → 📧 Mailpit → verify-otp):

| Request | Expected |
|---|---|
| `?q=rah` | matches, own campus first |
| `?q=zzzzz` | `200` with an **empty array**, not a 404 |
| `?q=rah&limit=9999` | at most 50 results |
| `?q=rah` with Authorization off | `401` |

- [ ] All four correct

**C5. Change username — 📮 Postman:**

- [ ] `PATCH /api/users/me/username` `{ "username": "newhandle2026" }` → `200`
- [ ] Immediately again with a different handle → `429 RATE_LIMITED` with a real `next_allowed_at`
- [ ] 👁️ Studio → `username_history` → a row with the **old** handle and `reserved_until` ~30 days out

**C6. The redirect case — 🌐 browser.** Easy to miss, and it's what keeps shared links alive:

- [ ] `…/by-username/<the OLD handle>` → `{ "redirect_to": "newhandle2026" }`, **not** a 404

This is what stops a `yahora.com/rahul` link posted in a WhatsApp group from dying the moment Rahul renames himself.

**C7. The race — 🖥️ DevTools console.** Postman sends one request at a time and structurally cannot test this. Two tokens from two users:

```js
const BASE = 'http://localhost:5000';
const call = (t) => fetch(`${BASE}/api/users/me/username`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
  body: JSON.stringify({ username: 'raceme' })
});
const rs = await Promise.all([call('tokenA'), call('tokenB')]);
for (const r of rs) console.log(r.status, await r.json());
```

- [ ] One `200`, one `400 USERNAME_TAKEN`
- [ ] **Neither `500`.** A 500 means the unique-violation catch is missing — the single most important line in your module.
- [ ] 👁️ Studio → exactly one row has `raceme`

---

## N-BLOCK D — Auth page: the tab switcher

Read **§0.6** first — the auth design is settled there and this block implements it.

`frontend/src/pages/auth/Auth.jsx` is currently a 2-step email → OTP flow. It becomes two tabs, with the OTP flow unchanged underneath one of them.

**Layout and copy are specified in §0.6.** Build to that.

**The points that matter:**

- **Tab labels:** *"College Email & OTP"* and *"Username & Password"*. Not just "Email" — students think of it as their college ID.
- **Default to College Email & OTP.** It's the only path that works for a brand-new student, and a first-time visitor has no stored preference.
- **Remember the last-used tab** in `localStorage`, so a returning student lands on theirs.
- **One error string.** Every `login-password` failure returns the same code and the same message. Show it verbatim: *"Incorrect username or password. Please try again."* **Do not add anything more specific** — no "user not found", no "wrong password". The server deliberately makes those indistinguishable; a helpful UI message would undo it.
- **Permanent helper text below the form:** *"New to Yahora? Create your account with your college email and OTP →"*, switching to the OTP tab. This is where new-user guidance lives — visible before a failed attempt, not after one.
- **"Forgot your password? Sign in with email OTP instead."** — a link that switches tabs. There is no reset-email flow.
- **`TOO_MANY_ATTEMPTS`** → show the wait from `retry_after_seconds`, ideally counting down.
- The response shape from `login-password` is **identical** to `verify-otp` (`{ message, session, userAuth, userProfile }`) — reuse the exact same session-storage and redirect code. Don't write a second path.

> **Removed from this block:** the *"Set a password to sign in faster"* prompt card is no longer needed. Password is compulsory at onboarding, so anyone without one is mid-onboarding — and OTP login already routes them to the onboarding screen where they'll set it. One less component to build and test.
>
> The `POST /api/auth/set-password` endpoint still exists, for changing a password from settings later. That screen is not Phase 1 work.

Run **N-CC-4** (Track 4).

### 👁️ CHECK — in the browser

- [ ] 👁️ Both tabs work end to end
- [ ] 👁️ Both tabs store the session identically — log in each way, land on the same dashboard
- [ ] 👁️ Wrong password → generic message, and the UI adds nothing more specific
- [ ] 👁️ 11 wrong attempts → the wait time shows, derived from `retry_after_seconds`
- [ ] 👁️ Helper text *"New to Yahora? Create your account with your college email and OTP →"* is visible **before** any failed attempt, and switches tabs
- [ ] 👁️ Reload mid-tab → the tab and typed identifier survive; **the password field does not**
- [ ] 👁️ DevTools → Application → Local Storage → **no password stored anywhere**
- [ ] 👁️ Log in as a user with `has_password: false` → prompt appears; set a password → prompt gone and stays gone after re-login
- [ ] 👁️ **Test at 375px width** (DevTools device toolbar). The segmented control must not wrap or overflow.

---

## N-BLOCK E — Before you open PRs

- [ ] Run the 8-item security checklist in `backend/CLAUDE.md` against all five user endpoints
- [ ] `git diff --stat` shows only your files: `frontend/`, `backend/src/modules/user/`, `backend/API.md`
- [ ] `backend/API.md` matches what you actually built. **Any deviation goes in the PR description explicitly** — Vishwajeet's mobile app is written against that document.
- [ ] Post the handoff template in `docs/CHANGELOG.md`

```bash
git checkout -b neeraj
git add frontend/ backend/src/modules/user/ backend/API.md docs/CHANGELOG.md
git commit -m "feat: setSession, onboarding auth, user module, password login UI"
git push origin neeraj
```

Backend PRs need Vishwajeet's review before merge.

---

# ══════════════════════════════════════════
# TRACK 4 — NEERAJ: Claude Code prompts
# ══════════════════════════════════════════

## ▶ N-CC-1 — The setSession fix

```
Read docs/PHASE_1_RUNBOOK.md §0.3 and N-Block A, and
docs/RLS_SURFACE.md §0.1.

CONTEXT: frontend/src/contexts/AuthContext.jsx stores a session in
localStorage but never gives it to the Supabase JS client. There is no
supabase.auth.* call anywhere in frontend/src/. Every direct
browser→Supabase query therefore runs as `anon` with auth.uid() NULL,
even for a logged-in student. This blocks two database migrations.

TASK: Make the Supabase client authenticated.

1. In AuthContext, call
     supabase.auth.setSession({ access_token, refresh_token })
   in BOTH places:
     a) right after a successful login (OTP, password, or demo)
     b) on app boot, when restoring a session from localStorage

   (b) is the one that gets missed. A student who logged in yesterday
   never passes through the login handler today, so without it they are
   anonymous on every subsequent visit.

2. setSession is async. Expose a `sessionReady` boolean from the
   context and gate the first data fetch on it — a query that runs
   before setSession resolves still goes out as anon.

3. On logout call supabase.auth.signOut() as well as clearing
   localStorage. Clearing storage alone leaves the client holding a
   valid token in memory.

4. Handle refresh: if setSession reports an expired or invalid token,
   clear the session and route to /auth rather than leaving the app in
   a half-authenticated state.

5. Find every place in frontend/src/ that reads
   localStorage.getItem("yahora_user_id") and report them. Do NOT
   change them in this task — they still work, but after migration 004
   they become the fragile path and we'll want a list.

VERIFY before you finish: describe exactly what I should see in the
browser console when I run
  await supabase.auth.getUser()
while logged in, after a hard refresh, and after logging out.

HARD CONSTRAINTS:
- Change only files under frontend/src/.
- Do NOT touch backend/, supabase/ or mobile/.
- Do NOT change any existing login flow behaviour beyond adding
  setSession — the OTP flow must work exactly as it does now.
```

---

## ▶ N-CC-2 — Onboarding: token, username, password

```
Read docs/PHASE_1_RUNBOOK.md N-Block B, and backend/API.md for
POST /api/auth/onboarding and the two username endpoints.

⚠️ BREAKING: the backend now requires authentication on
POST /api/auth/onboarding. The current code sends userId in the body
with a "replace-with-actual-uuid" fallback and no auth header — it now
returns 401.

TASK, in frontend/src/pages/onboarding/onboarding.jsx (+ its CSS):

=== 1. FIX THE REQUEST (do first) ===
  - Remove userId from the body entirely, including the fallback.
  - Send Authorization: Bearer <access_token> from the stored session.
  - If there is no stored session, redirect to /auth instead of
    sending a request that will fail.

=== 2. USERNAME FIELD ===
  - Live availability check against
    GET /api/users/username-available, DEBOUNCED BY 400ms.
    Without debouncing, typing "rahulsharma" fires 11 requests, they
    arrive out of order, and the answer for "rahul" can land after the
    answer for "rahulsharma" and overwrite it with the wrong result.
  - Also discard stale responses: keep a request counter and ignore any
    response that is not the newest.
  - Three tappable suggestion chips from
    GET /api/users/username-suggestions?name=<full name>.
  - Force lowercase as they type — convert silently, do not show an
    error for a capital letter.
  - Show the resulting URL: yahora.com/<handle>.
  - Note: "You can change this once every 30 days."
  - Handle USERNAME_TAKEN, USERNAME_RESERVED and INVALID_FORMAT
    distinctly.

=== 3. PASSWORD FIELDS ===
  - Password + confirm, both with a show/hide toggle.
  - Live rule: "At least 8 characters" with a tick when satisfied.
  - Do NOT block paste — that breaks password managers.
  - On WEAK_PASSWORD or COMMON_PASSWORD, show the message under the
    field and KEEP what they typed.

=== 4. SUBMIT GATING ===
Continue disabled until: username available, password valid, confirm
matches, and all existing required fields filled.

HARD CONSTRAINTS:
- Change only frontend/src/pages/onboarding/ files.
- Do NOT touch backend/, supabase/ or mobile/.
- Never log a password or persist one to localStorage/sessionStorage.
- Use the CSS variables already in frontend/src/styles/global.css.
  No new colours.
- Do NOT restructure the existing onboarding steps while you are in
  there — add to them.
```

---

## ▶ N-CC-3 — The user module

```
Read first:
- docs/YAHORA_BUILD_PLAN.md §1.1, §1.2, §1.5
- backend/API.md — entries tagged OWNER: Neeraj, PHASE 1
- backend/src/utils/respond.js, middleware/requireAuth.js,
  middleware/optionalAuth.js
- backend/CLAUDE.md — ownership rules and the security checklist

TASK: Implement five endpoints in these two files ONLY:
  backend/src/modules/user/user.routes.js
  backend/src/modules/user/user.controller.js

The controller already has four pre-existing handlers (dashboard,
profile, avatar) written before the ownership split. They are live in
web and mobile — do NOT change their behaviour or response shapes. Add
underneath them.

  GET   /api/users/username-available?username=     optionalAuth
  GET   /api/users/username-suggestions?name=       optionalAuth
  GET   /api/users/by-username/:username            optionalAuth
  GET   /api/users/search?q=&limit=                 requireAuth
  PATCH /api/users/me/username                      requireAuth

CRITICAL — the database already does the hard work. Call these RPCs
rather than reimplementing their logic:
  is_username_available(p_username, p_user_id)
  suggest_usernames(p_name, p_university_id)
  generate_username(p_name)
  search_users(p_query, p_viewer, p_limit)

Do NOT write your own format validation, reserved-word list, or
cooling-off check. is_username_available covers all four. If your JS
and that function disagree we get a bug nobody can find.

Do NOT call get_login_email — it is revoked from anon/authenticated and
belongs to Vishwajeet's login endpoint.

Requirements:

1. username-available must work WITHOUT auth (optionalAuth) — students
   check handles before they have an account. When unavailable, include
   a `reason` (TAKEN | RESERVED | INVALID_FORMAT | RECENTLY_RELEASED)
   and 3 suggestions.

2. by-username must handle the redirect case. If no user has that
   handle, look in username_history for a row with
   reserved_until > now(). If found, return
   { "redirect_to": "<current username>" }. Otherwise 404
   USER_NOT_FOUND. NEVER include the user's email in the response.

3. search must cap `limit` at 50 regardless of what is requested — an
   uncapped limit is a denial-of-service. No results is an empty array
   with 200, never a 404.

4. PATCH /me/username must:
   - take the user id from req.user.id, never from the body
   - check username_changed_at; under 30 days -> 429 RATE_LIMITED with
     next_allowed_at
   - call is_username_available passing the caller's own id, so their
     current handle does not read as taken
   - wrap the update in try/catch and route errors through
     mapDbError(). Postgres 23505 must become 400 USERNAME_TAKEN.
     THIS CATCH IS THE MOST IMPORTANT LINE IN THE MODULE — the
     availability check cannot prevent two people submitting the same
     handle in the same instant. Only the unique index can, and it
     reports that as 23505. A 500 here is a bug.

5. Use sendError() for every error. Never hand-roll a shape.

6. Keep the OWNER banner at the top of both files.

HARD CONSTRAINTS:
- Modify ONLY those two files.
- Do NOT touch backend/src/app.js — the route mount already exists.
- Do NOT touch utils/, middleware/ or config/ — frozen.
- Do NOT touch any other module folder.
- Do NOT write SQL or run any supabase command. If you think a schema
  change is needed, STOP and tell me — I file a migration request in
  docs/CHANGELOG.md.
- Do NOT add npm dependencies.

When done: list every endpoint, which RPC it calls, and which error
codes it can return.
```

---

## ▶ N-CC-4 — Auth page tab switcher

```
Read docs/PHASE_1_RUNBOOK.md §0.6 (the settled auth design, including
the layout sketch and exact copy) and N-Block D, plus backend/API.md
for POST /api/auth/login-password.

TASK: Add a login-method switcher to
  frontend/src/pages/auth/Auth.jsx
  frontend/src/pages/auth/Auth.module.css

=== 1. TAB SWITCHER ===
  - Segmented control with these exact labels:
      "College Email & OTP"  |  "Username & Password"
  - DEFAULT to College Email & OTP — it is the only path that works for
    a brand-new student, and a first-time visitor has no stored
    preference.
  - Persist the last-used tab in localStorage.
  - Keep the existing OTP flow and its localStorage step-persistence
    working exactly as they do now. Do not restructure that flow.

=== 2. PASSWORD FORM ===
  - One field labelled "Username or email", one password field with a
    show/hide toggle, one Sign in button.
  - POST /api/auth/login-password with { identifier, password }.
  - The response shape is IDENTICAL to verify-otp
    ({ message, session, userAuth, userProfile }) — reuse the exact
    same session-storage and redirect code path. Do not write a second.

=== 3. ERROR HANDLING — read this carefully ===
  The API returns ONE error code for every login failure: wrong
  password, unknown username, unknown email, and account-without-
  password all come back as 400 INVALID_CREDENTIALS with the same
  message.

  Show that message VERBATIM:
    "Incorrect username or password. Please try again."

  Do NOT add anything more specific — no "user not found", no "wrong
  password", no "account doesn't exist". The server deliberately makes
  these indistinguishable to prevent user enumeration; a helpful UI
  message would undo that protection entirely. There is nothing to
  branch on, and that is by design.

  TOO_MANY_ATTEMPTS -> show the wait derived from retry_after_seconds,
  ideally counting down.

=== 4. NEW-USER GUIDANCE — permanent, not an error ===
  Below the password form, always visible:
    "New to Yahora? Create your account with your college email and
     OTP →"
  Clicking it switches to the OTP tab.

  This is where signup guidance belongs. A new student should see it
  BEFORE wasting a login attempt, not after failing one.

=== 5. FORGOT PASSWORD ===
  "Forgot your password? Sign in with email OTP instead." — a link that
  switches tabs. There is NO reset-email flow. OTP is the reset.

=== NOT IN SCOPE ===
  Do NOT build a "set a password" prompt card. Password is compulsory
  at onboarding, so anyone without one is mid-onboarding and OTP login
  already routes them to the onboarding screen.

HARD CONSTRAINTS:
- Change only files under frontend/src/.
- Never log a password, and never persist one to localStorage or
  sessionStorage. The identifier field may survive a reload; the
  password must not.
- Use the CSS variables already in frontend/src/styles/global.css. No
  new colours. (docs/DESIGN.md describes an unadopted rebrand — ignore
  it; that decision is being made separately before Phase 2.)
- Must work at 375px width without the segmented control wrapping.

When done, list every file changed and confirm that the password form
has exactly ONE error message string.
```

---

# PHASE 1 SIGN-OFF

Tick together before Phase 2.

**Security — blocking, do not launch without these**
- [ ] `POST /api/auth/onboarding` requires a valid token
- [ ] Sending another user's `userId` in the body changes nothing on their row
- [ ] `SET ROLE anon; SELECT get_login_email(...)` returns permission denied
- [ ] Wrong password and non-existent user return byte-identical responses
- [ ] 11 failed logins → `429`; the correct password is still rejected while locked
- [ ] 👁️ `auth.users.encrypted_password` is a bcrypt hash; plaintext appears nowhere
- [ ] `products` ownership + campus checks verified; `user_id` no longer read from the body
- [ ] `messages` params validated; a non-participant cannot read a thread
- [ ] CC-4's full audit list of body/param user-id handlers reviewed and triaged

**Database**
- [ ] Migrations 005 and 006 applied to local **and** production
- [ ] Production user count unchanged from the C1 reading
- [ ] Zero completed users without a username; zero duplicates
- [ ] 👁️ 20 real production handles read and they look right
- [ ] `handle_new_user` trigger verified: binds a known domain, and an **unknown domain does not break signup**
- [ ] The three new tables show zero anon/authenticated grants and `rowsecurity = true`

**RLS stage 2 (Block G)**
- [ ] `setSession()` merged and verified in the browser
- [ ] Migration 004 applied local **and** production
- [ ] 👁️ Two impersonated students return **different** message counts
- [ ] 👁️ Two browser profiles: live chat still works; a third student sees nothing
- [ ] 👁️ Production marketplace campus switcher still works logged in

**Passwords & auth**
- [ ] Password set at onboarding; `has_password` true on both `users` and `auth.users`
- [ ] Login works with username **and** with email
- [ ] Changing a password requires the current one; the old one stops working
- [ ] 👁️ **All four failure cases return byte-identical responses** — wrong password, unknown username, unknown email, account without password
- [ ] A user who abandoned onboarding gets the same generic error, and the server console logs the real reason
- [ ] `PASSWORD_NOT_SET` appears nowhere in any client-facing response or in `backend/API.md`

**Web**
- [ ] Onboarding sends a Bearer token and no `userId`
- [ ] Username field debounced, stale responses discarded
- [ ] Tab switcher works, labels are "College Email & OTP" / "Username & Password", defaults to OTP, remembers the last choice
- [ ] The password form shows exactly **one** error string, verbatim from the server
- [ ] New-user helper text is visible **before** any failed attempt
- [ ] Password never persisted to storage
- [ ] Tested at 375px

**Docs**
- [ ] `backend/API.md` matches what was built, on both sides
- [ ] `docs/CURRENT_STATE.md` updated — items 1, 3, 4, 8 resolved
- [ ] `docs/CHANGELOG.md` has Handoff A, Neeraj's module handoff, and a Block G entry
- [ ] `docs/PHASE_1_ADDENDUM_PASSWORDS.md` deleted

**Carried into Phase 2**
- [ ] §0.5 decided — `DESIGN.md` adopted or retracted, and both `CLAUDE.md` files updated to match

---

*When every box is ticked, ask for the Phase 2 runbook (username UI on both surfaces).*
