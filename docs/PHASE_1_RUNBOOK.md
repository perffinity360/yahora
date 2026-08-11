# Phase 1 Runbook — Usernames: Database & Backend

**Companion to `docs/YAHORA_BUILD_PLAN.md`. Read plan §1.1 and §1.2 before starting.**

> ### ⚠️ Correction to the build plan — read this first
>
> Plan §1.2 put the `users_username_required_when_complete` constraint in migration **002**. That is wrong and it will fail when you push to production.
>
> **Why:** `ALTER TABLE ... ADD CONSTRAINT` checks every existing row immediately. Your production `users` table already has students with `is_profile_complete = true` and `username = NULL`. The constraint says those rows are invalid, so Postgres rejects the whole migration.
>
> **It passes locally and fails in production** — because your local `users` table is empty, so there are no rows to violate it. That's the worst kind of bug.
>
> **The fix:** the constraint moves to migration **003**, added *after* the backfill has filled every username. `docs/YAHORA_BUILD_PLAN.md` has been corrected. The SQL in this runbook is the correct version — use it.

---

## Files touched in Phase 1

| Path (from repo root) | Action | Owner |
|---|---|---|
| `supabase/migrations/<ts>_usernames.sql` | **create** | Vishwajeet |
| `supabase/migrations/<ts>_username_backfill.sql` | **create** | Vishwajeet |
| `backend/scripts/seedDemo.js` | **modify** | Vishwajeet |
| `backend/src/modules/auth/auth.controller.js` | **modify** | Vishwajeet |
| `backend/src/modules/products/products.controller.js` | **modify** | Vishwajeet |
| `backend/API.md` | **modify** | both |
| `docs/CHANGELOG.md` | **modify** | both |
| `docs/LEARNINGS.md` | **modify** | both |
| `backend/src/modules/user/user.routes.js` | **modify** (stub exists) | Neeraj |
| `backend/src/modules/user/user.controller.js` | **modify** (stub exists) | Neeraj |

`<ts>` is the timestamp the CLI generates — you don't choose it.

---

## How Phase 1 flows

```
        VISHWAJEET                              NEERAJ
────────────────────────────────────────────────────────────────
DAY 1   Block A  Migration 002 (local)          ⛔ blocked
        Block B  Migration 003 + seedDemo
        Block C  Test on local, then push
        ──────────── HANDOFF A ─────────────→
────────────────────────────────────────────────────────────────
DAY 2   Block D  Onboarding change (auth)       Block A  Sync + verify DB
        Block E  Security fixes (products)      Block B  Build user module
────────────────────────────────────────────────────────────────
DAY 3   Block F  API.md + handoff               Block C  Test 5 endpoints
        Review Neeraj's PR                      Open PR
────────────────────────────────────────────────────────────────
```

---

# ══════════════════════════════════════════
# TRACK 1 — VISHWAJEET: manual steps
# ══════════════════════════════════════════

## A note on where you're allowed to run SQL

The rule from Phase 0 was "no SQL in the dashboard". Let me make it precise, because you'll be running a lot of queries today:

| | Local Studio (`http://127.0.0.1:54323`) | Production dashboard |
|---|---|---|
| `SELECT`, calling a function to test it | ✅ Encouraged | ✅ Fine (read-only) |
| `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE` | ❌ Put it in a migration file | ❌ Never |

Testing `SELECT is_username_available('rahul')` in local Studio is exactly what it's for. Changing schema anywhere except a migration file is what breaks things.

---

## BLOCK A — Migration 002 (usernames)

### A1. Create the migration file

```bash
cd /path/to/Yahora
git checkout main && git pull
supabase migration new usernames
```

Note the exact path it prints — something like `supabase/migrations/20260810093000_usernames.sql`. That's the file you'll fill in.

### A2. Fill it in

Run **CC-1** (Track 2). It writes the SQL from plan §1.2 into that file, minus the constraint that moved to 003.

### A3. Test it locally

```bash
supabase db reset
```

✔ **Check:** it applies your new migration with no error. If it errors, read the message — it names the line. Fix and re-run. **Never push a migration that hasn't survived a clean `db reset`.**

### A4. 👁️ Verify visually in local Studio

Open **`http://127.0.0.1:54323`** in your browser.

- [ ] **Table Editor → `users`** — the columns `username` and `username_changed_at` are there, at the far right
- [ ] **Table Editor → `reserved_usernames`** — the table exists and has roughly 60 rows. Scroll it. You should see `admin`, `marketplace`, `settings`, `yahora`
- [ ] **Table Editor → `username_history`** — exists, empty (correct — nobody has changed a handle yet)
- [ ] **Database → Functions** — you see `is_username_available`, `generate_username`, `suggest_usernames`, `search_users`

### A5. 👁️ Test the functions by hand

Local Studio → **SQL Editor**. Run these one at a time and read each result. This is the real test of migration 002 — if any answer is wrong, fix it now, before it's baked into two clients.

```sql
SELECT is_username_available('rahul');          -- expect: true
SELECT is_username_available('admin');          -- expect: false  (reserved)
SELECT is_username_available('ab');             -- expect: false  (too short)
SELECT is_username_available('Rahul');          -- expect: false  (uppercase)
SELECT is_username_available('rahul..sharma');  -- expect: false  (double dot)
SELECT is_username_available('.rahul');         -- expect: false  (leading dot)
SELECT is_username_available('rahul.');         -- expect: false  (trailing dot)
SELECT is_username_available('a_very_long_username_here'); -- expect: false (>20)
SELECT is_username_available('rahul_2026');     -- expect: true
```

- [ ] All nine give the expected answer

```sql
SELECT generate_username('Rahul Sharma');   -- expect: rahul.sharma
SELECT generate_username('   ');            -- expect: something starting 'student'
SELECT generate_username('R');              -- expect: something starting 'student'
SELECT generate_username('Ravi!!!  Kumar'); -- expect: ravi.kumar
```

- [ ] No errors, no NULLs, every result is 3–20 lowercase characters

```sql
SELECT suggest_usernames(
  'Rahul Sharma',
  (SELECT id FROM universities WHERE domain = 'iiitk.ac.in')
);
```

- [ ] Returns an array of exactly 3 distinct handles
- [ ] At least one includes the campus slug (something like `rahul.sharma_iiitk`)

> If `suggest_usernames` returns NULL, your `seed.sql` universities didn't load. Run `supabase db reset` again and check `SELECT * FROM universities;` first.

---

## BLOCK B — Migration 003 (backfill) and the seed script

### B1. Create the migration

```bash
supabase migration new username_backfill
```

### B2. Fill it in

Run **CC-2** (Track 2). This writes the backfill loop *and* the constraint that was moved out of 002.

### B3. ⚠️ Expect `seedDemo.js` to break — this is the point

Migration 003 makes a username mandatory for any user with `is_profile_complete = true`. Your current `backend/scripts/seedDemo.js` creates completed users with no username, so it will now fail.

```bash
supabase db reset
node backend/scripts/seedDemo.js
```

✔ **Check:** it fails with a constraint violation mentioning `users_username_required_when_complete`.

**That failure is a good sign** — it means the database is now enforcing the rule and no code path can create a user without a handle. Confirm you see it before fixing it.

### B4. Fix the seed script

Run **CC-3** (Track 2). It updates `backend/scripts/seedDemo.js` to give every demo user a handle.

```bash
supabase db reset
node backend/scripts/seedDemo.js
```

✔ **Check:** completes with no errors.

### B5. 👁️ Verify the seeded data in local Studio

Open **`http://127.0.0.1:54323`** → Table Editor → `users`.

- [ ] Every row has a username
- [ ] They look like real handles (`rahul.sharma`, `priya_niet`) — not `user1`, `user2`, `test_a`
- [ ] They're all lowercase
- [ ] No two are the same

Then in SQL Editor:

```sql
SELECT count(*) FROM users WHERE username IS NULL AND is_profile_complete = true;
-- expect: 0

SELECT username, count(*) FROM users
WHERE username IS NOT NULL GROUP BY username HAVING count(*) > 1;
-- expect: no rows
```

- [ ] Both come back clean

### B6. Test the backfill loop actually works

The backfill ran against an empty table, so it hasn't been proven yet. Simulate real conditions in local Studio SQL Editor:

```sql
-- Break some users, as if they were pre-migration accounts
UPDATE users SET username = NULL
WHERE id IN (SELECT id FROM users WHERE is_profile_complete = true LIMIT 3);

-- Confirm they're broken
SELECT id, full_name, username FROM users WHERE username IS NULL;
```

That `UPDATE` will fail with the constraint violation — which proves the constraint works, but blocks the test. So drop it temporarily, test, and put it back:

```sql
ALTER TABLE users DROP CONSTRAINT users_username_required_when_complete;

UPDATE users SET username = NULL
WHERE id IN (SELECT id FROM users WHERE is_profile_complete = true LIMIT 3);

-- Now run the backfill loop from your migration file
DO $$
DECLARE r RECORD; new_username TEXT;
BEGIN
  FOR r IN SELECT id, full_name FROM users
           WHERE username IS NULL AND is_profile_complete = true LOOP
    new_username := generate_username(coalesce(r.full_name, 'student'));
    UPDATE users SET username = new_username WHERE id = r.id;
  END LOOP;
END $$;

SELECT count(*) FROM users WHERE username IS NULL AND is_profile_complete = true;
-- expect: 0

ALTER TABLE users ADD CONSTRAINT users_username_required_when_complete CHECK (
  is_profile_complete = false OR username IS NOT NULL
);
```

- [ ] The three users got new handles
- [ ] The constraint went back on without error

> This is local only, and `supabase db reset` wipes it all anyway. It's the only way to prove the backfill works before it runs on real data.

### B7. Test the collision case — the subtle one

Plan §1.3 explains why the backfill must loop instead of running as one `UPDATE`. Prove it:

```sql
ALTER TABLE users DROP CONSTRAINT users_username_required_when_complete;

-- Two users with the SAME name and no handle
UPDATE users SET username = NULL, full_name = 'Test Duplicate'
WHERE id IN (SELECT id FROM users WHERE is_profile_complete = true LIMIT 2);

-- Run the loop again
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

- [ ] Two **different** handles — something like `test.duplicate` and `test.duplicat4821`
- [ ] Neither is NULL, no error

If both came out identical or the block errored, `generate_username` isn't seeing the row written by the previous iteration. Stop and tell me.

Then `supabase db reset && node backend/scripts/seedDemo.js` to clean up.

---

## BLOCK C — Push to production

### C1. 👁️ Take a "before" reading from production

Open your **production** Supabase dashboard → SQL Editor. These are read-only, so they're safe.

```sql
SELECT count(*) AS total_users FROM users;
SELECT count(*) AS completed FROM users WHERE is_profile_complete = true;
```

- [ ] Write both numbers down. You'll compare after.

### C2. Push

```bash
supabase db push
```

It should list exactly two migrations — `usernames` and `username_backfill` — and ask you to confirm.

✔ **Check:** both apply with no error.

> If it fails on `username_backfill`, the most likely cause is a production user with `is_profile_complete = true` whose `full_name` is NULL or empty. The `coalesce` handles it, but tell me the error rather than improvising.

### C3. 👁️ Verify production

Production dashboard → SQL Editor:

```sql
SELECT count(*) FROM users;
-- must match your "total_users" from C1 exactly

SELECT count(*) FROM users WHERE username IS NULL AND is_profile_complete = true;
-- expect: 0

SELECT username, count(*) FROM users
WHERE username IS NOT NULL GROUP BY username HAVING count(*) > 1;
-- expect: no rows

SELECT full_name, username FROM users
WHERE username IS NOT NULL ORDER BY created_at LIMIT 20;
```

- [ ] User count unchanged — the migration added columns, it must not have deleted anyone
- [ ] Zero completed users without a handle
- [ ] No duplicates
- [ ] **Read those 20 handles.** They're your real students' permanent identities. If any looks wrong — an email fragment, a roll number, gibberish — stop and tell me before anyone sees it.

### C4. Send Handoff A

Append the Handoff A message from plan §1.6 to **`docs/CHANGELOG.md`**, commit everything, push to `main`, and message Neeraj.

```bash
git add supabase/ backend/scripts/seedDemo.js docs/CHANGELOG.md
git commit -m "feat(db): usernames — migrations 002 and 003"
git push origin main
```

**Neeraj is now unblocked.** Everything below runs in parallel with his work.

---

## BLOCK D — Onboarding accepts a username

Run **CC-4** (Track 2). It modifies **`backend/src/modules/auth/auth.controller.js`**.

### 👁️ CHECK — test the real signup flow end to end

This is the most important manual test in Phase 1, because it's the path every new student takes.

**Get an OTP.** Local Supabase includes Mailpit, a fake inbox that catches every email your app sends.

```bash
cd backend && npm run dev
```

```bash
curl -X POST http://localhost:5000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@iiitk.ac.in"}'
```

- [ ] Open **`http://127.0.0.1:54324`** in your browser (Mailpit). The email is there with the code.

```bash
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@iiitk.ac.in","token":"12345678"}'
```

- [ ] Returns a session with an access token. **Copy it** — you need it for the next calls.

**Complete onboarding with a username:**

```bash
curl -X PATCH http://localhost:5000/api/auth/onboarding \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test User","username":"testuser2026","qualification":"Graduation"}'
```

- [ ] Returns the user object, including `"username": "testuser2026"`

**Now the four failure cases** — run each and read the response:

```bash
# Reserved word
-d '{"full_name":"X","username":"admin", ...}'
# expect: 400 { "error": "USERNAME_RESERVED" }

# Already taken (use a handle from seedDemo)
-d '{"full_name":"X","username":"rahul.sharma", ...}'
# expect: 400 { "error": "USERNAME_TAKEN" }

# Bad format
-d '{"full_name":"X","username":"Rahul..S", ...}'
# expect: 400 { "error": "INVALID_FORMAT" }

# No username at all
-d '{"full_name":"X","qualification":"Graduation"}'
# expect: 400, NOT a 500
```

- [ ] All four give a clean `400` with a specific error code
- [ ] **None of them returns a 500.** A 500 means a database error leaked through instead of being caught — that's the bug this endpoint exists to prevent

**The race condition test** — the one thing that can't be caught by reading code:

```bash
curl -X PATCH ... -d '{"username":"racetest"}' & \
curl -X PATCH ... -d '{"username":"racetest"}' &
wait
```

Use two different users' tokens.

- [ ] One succeeds, one returns `400 USERNAME_TAKEN`
- [ ] Neither returns 500

👁️ Then check **`http://127.0.0.1:54323`** → `users` → confirm only one row has `racetest`.

---

## BLOCK E — Security fixes

Run **CC-5** (Track 2). It modifies **`backend/src/modules/products/products.controller.js`**.

### 👁️ CHECK — verify the holes are actually closed

You need two tokens from two different seeded users, ideally at different campuses.

```bash
# 1. Try to edit someone else's listing
curl -X PATCH http://localhost:5000/api/products/<other-users-product-id> \
  -H "Authorization: Bearer <YOUR-token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"HACKED"}'
```

- [ ] Returns `403 FORBIDDEN`
- [ ] 👁️ Open Studio → `products` → confirm the title did **not** change

```bash
# 2. Try to delete someone else's listing
curl -X DELETE http://localhost:5000/api/products/<other-users-product-id> \
  -H "Authorization: Bearer <YOUR-token>"
```

- [ ] Returns `403 FORBIDDEN`
- [ ] 👁️ Studio → the product still exists

```bash
# 3. Try to like a product from another campus
curl -X POST http://localhost:5000/api/products/<other-campus-product-id>/like \
  -H "Authorization: Bearer <YOUR-token>"
```

- [ ] Returns `403 CROSS_CAMPUS_INTERACTION_BLOCKED`

```bash
# 4. Confirm normal use still works — edit your OWN listing
curl -X PATCH http://localhost:5000/api/products/<your-own-product-id> \
  -H "Authorization: Bearer <YOUR-token>" \
  -d '{"title":"Updated title"}'
```

- [ ] Returns 200 and the title changes in Studio

> Step 4 matters as much as steps 1–3. A security fix that also blocks legitimate use is a bug, not a fix.

---

## BLOCK F — Wrap up

- [ ] `backend/API.md` — the onboarding endpoint entry now shows the `username` field and all four error codes
- [ ] `docs/LEARNINGS.md` — five new entries (CC-6 writes them; read them and send back anything you can't follow)
- [ ] `docs/CHANGELOG.md` — Handoff A posted
- [ ] Everything committed and pushed to `main`
- [ ] Neeraj's PR reviewed against the checklist in `backend/CLAUDE.md`

---

# ══════════════════════════════════════════
# TRACK 2 — VISHWAJEET: Claude Code prompts
# ══════════════════════════════════════════

Six prompts, run in order, from the **repo root**.

---

## ▶ CC-1 — Write migration 002

```
Read docs/YAHORA_BUILD_PLAN.md §1.1 and §1.2 in full, and
docs/PHASE_1_RUNBOOK.md the correction box at the top.

TASK: Write the SQL for the usernames migration into the empty file
I just created at supabase/migrations/ (find the newest file ending
in _usernames.sql).

Copy the SQL from plan §1.2 exactly, with ONE change:

  DO NOT include the users_username_required_when_complete constraint.
  It moves to migration 003, after the backfill. Including it here
  breaks production, where existing completed users have username=NULL.

Everything else from §1.2 goes in, in this order:
  1. CREATE EXTENSION pg_trgm
  2. ALTER TABLE users — add username, username_changed_at
  3. The users_username_valid CHECK constraint (this one is fine here,
     because it allows NULL)
  4. The four indexes
  5. reserved_usernames table + the full INSERT list from the plan
  6. check_username_not_reserved() + its trigger
  7. username_history table + indexes
  8. record_username_change() + its trigger
  9. is_username_available()
 10. generate_username()
 11. suggest_usernames()
 12. search_users()

Add a comment header at the top of the file saying what it does and
which plan section it comes from.

HARD CONSTRAINTS:
- Write ONLY into that one migration file. No other file.
- Do NOT run any supabase command. I run those myself.
- Do NOT invent SQL that isn't in the plan. If something in §1.2 looks
  wrong to you, say so in your response and leave it as written —
  don't silently "improve" it.

When done, print the full relative path of the file you wrote and the
list of database objects it creates.
```

---

## ▶ CC-2 — Write migration 003

```
Read docs/YAHORA_BUILD_PLAN.md §1.3 and the correction box at the top
of docs/PHASE_1_RUNBOOK.md.

TASK: Write the backfill migration into the newest file in
supabase/migrations/ ending in _username_backfill.sql.

Contents, in this order:

1. The DO $$ ... LOOP block from plan §1.3, with this WHERE clause:
     WHERE username IS NULL AND is_profile_complete = true
   Only users who have finished onboarding get a generated handle.
   Users mid-signup will choose their own.

2. AFTER the loop, add the constraint that was moved out of 002:
     ALTER TABLE users ADD CONSTRAINT users_username_required_when_complete
     CHECK (is_profile_complete = false OR username IS NOT NULL);

3. A comment above the DO block explaining, in 3-4 lines, why this is a
   row-by-row loop and not a single UPDATE statement. A future reader
   will be tempted to "optimise" it into one statement and break it.

HARD CONSTRAINTS:
- Write ONLY into that migration file.
- Do NOT run any supabase command.
```

---

## ▶ CC-3 — Update the seed script

```
TASK: Update backend/scripts/seedDemo.js so every demo user it creates
has a username.

Migration 003 added a constraint: any user with is_profile_complete =
true must have a non-null username. The script currently violates this
and fails.

Requirements:
- Give each demo user a realistic handle derived from their name —
  rahul.sharma, priya_niet, aditya.k. Not user1/user2/test_a.
- All lowercase, 3-20 chars, matching [a-z0-9._], no leading/trailing
  dot or underscore, no doubled dots.
- Handles must be unique across the whole script.
- Any user the script creates with is_profile_complete = false may have
  a null username — that's valid.
- If the script has a "safety guard" checking SUPABASE_URL is local,
  leave it exactly as it is.

Also: read the script and tell me whether it inserts into the
universities, courses or specializations tables. Those are now seeded
by supabase/seed.sql, so a duplicate insert here could conflict.
Report what you find; don't change it without telling me.

HARD CONSTRAINTS:
- Modify only backend/scripts/seedDemo.js.
- Do NOT change what the script seeds beyond adding usernames.
- Do NOT run the script.
```

---

## ▶ CC-4 — Onboarding accepts a username

```
Read docs/YAHORA_BUILD_PLAN.md §1.4 and backend/API.md.

TASK: Modify backend/src/modules/auth/auth.controller.js so the
onboarding endpoint accepts and saves a username.

Behaviour:
1. Accept `username` in the request body. Lowercase and trim it before
   doing anything else.
2. Call the is_username_available(p_username, p_user_id) RPC. If false,
   return 400 with the right code:
     USERNAME_RESERVED   — it's in reserved_usernames
     USERNAME_TAKEN      — another user has it
     INVALID_FORMAT      — fails the format rules
   You may need a second cheap check to tell these apart; that's fine.
3. Save it along with the other onboarding fields.
4. Wrap the update in try/catch. Map errors via mapDbError() from
   backend/src/utils/respond.js:
     - Postgres 23505 -> 400 USERNAME_TAKEN
     - USERNAME_RESERVED in the message -> 400 USERNAME_RESERVED
   THIS CATCH IS THE POINT OF THE TASK. Two students can pass the
   availability check at the same moment; only the unique index can
   arbitrate. A 500 here is a bug.
5. Missing username on an otherwise-complete onboarding -> 400
   INVALID_FORMAT with a clear message. Never a 500.
6. Update backend/API.md for this endpoint in the same change: the new
   body field and every error code.

HARD CONSTRAINTS:
- Modify only backend/src/modules/auth/auth.controller.js and
  backend/API.md.
- Do NOT touch backend/src/utils/ or backend/src/middleware/ — frozen
  shared infrastructure.
- Do NOT touch backend/src/modules/user/ — that's Neeraj's.
- Do NOT change any existing onboarding behaviour beyond adding
  username handling.
```

---

## ▶ CC-5 — The three security fixes

```
Read docs/YAHORA_BUILD_PLAN.md §1.6.

TASK: Fix three security holes in
backend/src/modules/products/products.controller.js.

1. updateProduct — currently takes an id from the URL and updates with
   no check that the caller owns the product. Fetch the product's
   seller_id first; 404 if missing, 403 FORBIDDEN if it isn't
   req.user.id.

2. deleteProduct — same hole, same fix.

3. toggleLikeProduct and the save/wishlist toggle — neither checks that
   the product is on the caller's campus. Our rule is browse-only
   across campuses: you can see another college's listings but not
   interact with them. Compare the product's university_id to the
   caller's; return 403 CROSS_CAMPUS_INTERACTION_BLOCKED on mismatch.

Use sendError() from backend/src/utils/respond.js for every error.
Update backend/API.md with the new error codes on all four endpoints.

HARD CONSTRAINTS:
- Modify only backend/src/modules/products/products.controller.js and
  backend/API.md.
- Legitimate use MUST keep working: a seller editing or deleting their
  own listing, and a student liking a listing on their own campus.
  Do not over-restrict.
- Do NOT refactor anything else in the file while you're in there.

When done, list every function you changed and the exact check you
added to each.
```

---

## ▶ CC-6 — Learning notes

```
TASK: Add five entries to docs/LEARNINGS.md covering what came up in
Phase 1. Use the existing entry format in that file.

1. Race conditions and unique constraints — why "check availability
   then insert" can never be safe on its own, and why catching
   Postgres error 23505 is the actual fix. Use our real username flow.

2. Why the backfill is a row-by-row loop and not one UPDATE — a single
   statement sees a snapshot from before it started, so two students
   named "Rahul Sharma" both generate rahul.sharma and the whole
   statement rolls back. Show both versions.

3. Adding a CHECK constraint to a table that already has data — why
   users_username_required_when_complete had to move from migration 002
   to 003, and why it passed locally (empty table) but would have
   failed in production. Include the general lesson about migrations
   that pass on an empty database.

4. text_pattern_ops — why a normal btree index can't serve
   LIKE 'rah%' under most collations, and what the second index does.

5. SECURITY DEFINER — what it means, why is_username_available needs
   it, and the risk of using it carelessly.

REQUIREMENTS:
- Audience is a developer with under two years of experience. Write
  each one fresh, from scratch. Do not compress into revision notes.
- Every example must use this project's real tables and columns —
  users, username, products, follows. No foo/bar.
- Where there's a wrong version and a right version, show both.

HARD CONSTRAINTS:
- Modify only docs/LEARNINGS.md.
```

---

# ══════════════════════════════════════════
# TRACK 3 — NEERAJ: manual steps
# ══════════════════════════════════════════

**Start only after Handoff A lands in `docs/CHANGELOG.md`.**

You're building the `user` module — 5 endpoints. The stub files already exist from Phase 0:

- `backend/src/modules/user/user.routes.js`
- `backend/src/modules/user/user.controller.js`

Those two files are the only ones you create code in this phase.

---

## BLOCK A — Sync and verify

### A1. Pull and rebuild your local database

```bash
cd /path/to/Yahora
git checkout main && git pull
supabase db reset
node backend/scripts/seedDemo.js
```

✔ **Check:** `db reset` applies four migrations now (baseline, storage, usernames, backfill) with no errors, and the seed completes.

### A2. 👁️ Confirm the new schema in local Studio

Open **`http://127.0.0.1:54323`**.

- [ ] **Table Editor → `users`** — `username` column exists, and **every seeded user has a value in it**
- [ ] **Table Editor → `reserved_usernames`** — exists, ~60 rows
- [ ] **Table Editor → `username_history`** — exists, empty

### A3. 👁️ Try the database functions yourself before calling them from code

Local Studio → SQL Editor:

```sql
SELECT is_username_available('rahul');   -- true
SELECT is_username_available('admin');   -- false
SELECT suggest_usernames('Rahul Sharma', (SELECT id FROM universities LIMIT 1));
SELECT * FROM search_users('rah', NULL, 10);
```

- [ ] All four return sensible results

**This matters more than it looks.** `is_username_available` already checks format, reserved words, existing handles *and* the 30-day cooling-off window. Your controller calls it once — it does not re-implement any of those four checks in JavaScript. If your code and the function ever disagree, you get a bug nobody can find.

### A4. Read before you build

- [ ] `docs/YAHORA_BUILD_PLAN.md` §1.1 — the four problems this design solves
- [ ] `docs/YAHORA_BUILD_PLAN.md` §1.5 — your five endpoints
- [ ] `backend/API.md` — the exact contract you're implementing
- [ ] `backend/src/utils/respond.js` — `sendError`, `mapDbError`, `sendPage`. Use these. Don't write your own error shapes.

---

## BLOCK B — Build the module

Run **N-CC-1** (Track 4).

---

## BLOCK C — 👁️ Test all five endpoints by hand

```bash
cd backend && npm run dev
```

There's no UI yet, so curl is your interface. Run every one of these and **read the response body**, not just the status code.

### C1. Availability check

```bash
curl "http://localhost:5000/api/users/username-available?username=rahul"
# expect: { "available": true }

curl "http://localhost:5000/api/users/username-available?username=admin"
# expect: { "available": false, "reason": "RESERVED", "suggestions": [...] }

curl "http://localhost:5000/api/users/username-available?username=Rahul"
# expect: { "available": false, "reason": "INVALID_FORMAT" }

curl "http://localhost:5000/api/users/username-available?username=ab"
# expect: { "available": false, "reason": "INVALID_FORMAT" }
```

Then pick a real handle from Studio and try it:

```bash
curl "http://localhost:5000/api/users/username-available?username=<a-seeded-handle>"
# expect: { "available": false, "reason": "TAKEN", "suggestions": [...] }
```

- [ ] All five correct
- [ ] Every unavailable response includes `suggestions` with 3 entries
- [ ] **Works with no Authorization header** — a student checks a handle before they have an account

### C2. Suggestions

```bash
curl "http://localhost:5000/api/users/username-suggestions?name=Rahul%20Sharma"
```

- [ ] 3 distinct handles, all genuinely available (spot-check one against C1)

### C3. Profile by username

```bash
curl "http://localhost:5000/api/users/by-username/<a-seeded-handle>"
curl "http://localhost:5000/api/users/by-username/definitelynobody99"
```

- [ ] First returns the user with `username`, `full_name`, `avatar_url`, `university`, and the `viewer` block
- [ ] Second returns `404 { "error": "USER_NOT_FOUND" }`
- [ ] Neither leaks the user's **email** — check the response body carefully. Email is not in the contract and must not appear.

### C4. Search

Get a token first — request an OTP, then read it from Mailpit at **`http://127.0.0.1:54324`** in your browser:

```bash
curl -X POST http://localhost:5000/api/auth/request-otp \
  -H "Content-Type: application/json" -d '{"email":"n1@iiitk.ac.in"}'
# open http://127.0.0.1:54324, copy the code
curl -X POST http://localhost:5000/api/auth/verify-otp \
  -H "Content-Type: application/json" -d '{"email":"n1@iiitk.ac.in","token":"<code>"}'
```

```bash
curl "http://localhost:5000/api/users/search?q=rah" -H "Authorization: Bearer <token>"
curl "http://localhost:5000/api/users/search?q=zzzzz" -H "Authorization: Bearer <token>"
curl "http://localhost:5000/api/users/search?q=rah&limit=9999" -H "Authorization: Bearer <token>"
curl "http://localhost:5000/api/users/search?q=rah"
```

- [ ] Matching users returned, own-campus first
- [ ] No match returns an empty array — **not** a 404
- [ ] `limit=9999` is capped at 50, not honoured
- [ ] No token returns `401`

### C5. Change username

```bash
curl -X PATCH http://localhost:5000/api/users/me/username \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"username":"newhandle2026"}'
# expect: 200, user object with the new handle

# immediately again
curl -X PATCH http://localhost:5000/api/users/me/username \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"username":"anotherone"}'
# expect: 429 { "error": "RATE_LIMITED", "next_allowed_at": "..." }
```

- [ ] First succeeds, second is rate-limited with a real timestamp
- [ ] 👁️ Studio → `username_history` — a row appeared with the **old** handle and a `reserved_until` about 30 days out

### C6. The redirect case — easy to miss, and it breaks shared links

The old handle from C5 must still resolve:

```bash
curl "http://localhost:5000/api/users/by-username/<the-OLD-handle>"
# expect: 200 { "redirect_to": "newhandle2026" }
```

- [ ] Returns `redirect_to`, not a 404

This is what keeps a `yahora.com/rahul` link posted in a WhatsApp group working after Rahul renames himself.

### C7. The race condition

```bash
curl -X PATCH http://localhost:5000/api/users/me/username \
  -H "Authorization: Bearer <tokenA>" -d '{"username":"raceme"}' & \
curl -X PATCH http://localhost:5000/api/users/me/username \
  -H "Authorization: Bearer <tokenB>" -d '{"username":"raceme"}' &
wait
```

- [ ] One succeeds, one returns `400 USERNAME_TAKEN`
- [ ] **Neither returns 500.** A 500 means the unique-violation catch is missing — that's the single most important line in your module

---

## BLOCK D — Before you open the PR

- [ ] Run the 8-item security checklist in `backend/CLAUDE.md` against all five endpoints
- [ ] `git diff --stat` shows changes only in `backend/src/modules/user/` and `backend/API.md`
- [ ] `backend/API.md` matches what you actually built. **If you deviated from the contract anywhere, say so explicitly in the PR description** — Vishwajeet's mobile app is being written against that document
- [ ] Post the Neeraj → Vishwajeet handoff template (plan §0.3) in `docs/CHANGELOG.md`

```bash
git checkout -b neeraj
git add backend/src/modules/user/ backend/API.md docs/CHANGELOG.md
git commit -m "feat(backend): user module — usernames and search"
git push origin neeraj
```

Open a PR and request Vishwajeet's review. Backend PRs need it.

---

# ══════════════════════════════════════════
# TRACK 4 — NEERAJ: Claude Code prompts
# ══════════════════════════════════════════

## ▶ N-CC-1 — Build the user module

```
Read these before writing anything:
- docs/YAHORA_BUILD_PLAN.md §1.1, §1.2, §1.5
- backend/API.md — the entries tagged OWNER: Neeraj, PHASE 1
- backend/src/utils/respond.js
- backend/src/middleware/requireAuth.js and optionalAuth.js
- backend/CLAUDE.md — ownership rules and the security checklist

TASK: Implement the user module in these two files ONLY:
  backend/src/modules/user/user.routes.js
  backend/src/modules/user/user.controller.js

Five endpoints, exactly as specified in backend/API.md:

  GET   /api/users/username-available?username=     optionalAuth
  GET   /api/users/username-suggestions?name=       optionalAuth
  GET   /api/users/by-username/:username            optionalAuth
  GET   /api/users/search?q=&limit=                 requireAuth
  PATCH /api/users/me/username                      requireAuth

CRITICAL — the database already does the hard work. Call these RPCs
rather than reimplementing their logic in JavaScript:
  is_username_available(p_username, p_user_id)
  suggest_usernames(p_name, p_university_id)
  generate_username(p_name)
  search_users(p_query, p_viewer, p_limit)

Do NOT write your own format validation, reserved-word list, or
cooling-off check. is_username_available already covers all four. If
your JS and that function ever disagree, we get a bug nobody can find.

Specific requirements:

1. username-available must work WITHOUT auth — students check handles
   before they have an account. Use optionalAuth.
   When unavailable, include a `reason` (TAKEN | RESERVED |
   INVALID_FORMAT | RECENTLY_RELEASED) and 3 suggestions.

2. by-username must handle the redirect case. If no user has that
   handle, look in username_history for a row where
   reserved_until > now(). If found, return
   { "redirect_to": "<their current username>" }. Otherwise 404
   USER_NOT_FOUND.
   NEVER include the user's email in the response.

3. search must cap `limit` at 50 regardless of what's requested. An
   uncapped limit is a denial-of-service.
   No results is an empty array with 200 — never a 404.

4. PATCH /me/username must:
   - check username_changed_at; if under 30 days, return 429
     RATE_LIMITED with next_allowed_at
   - call is_username_available passing the caller's own id, so their
     current handle doesn't read as "taken"
   - wrap the update in try/catch and route errors through
     mapDbError(). Postgres 23505 must become 400 USERNAME_TAKEN.
     THIS CATCH IS THE MOST IMPORTANT LINE IN THE MODULE — the
     availability check cannot prevent two people submitting the same
     handle in the same instant. Only the unique index can, and it
     reports that as 23505. A 500 here is a bug.

5. Use sendError() for every error response. Never hand-roll a shape.

6. Keep the OWNER banner at the top of both files.

HARD CONSTRAINTS:
- Create or modify ONLY those two files.
- Do NOT touch backend/src/app.js — the route mount already exists.
- Do NOT touch backend/src/utils/, middleware/ or config/ — frozen.
- Do NOT touch any other module folder.
- Do NOT write SQL or run any supabase command. If you think a schema
  change is needed, stop and tell me — I file a migration request.
- Do NOT add npm dependencies.

When done: list every endpoint you implemented, and for each one state
which RPC it calls and which error codes it can return.
```

---

## ▶ N-CC-2 — Self-review before the PR

```
TASK: Review your own work in backend/src/modules/user/ before I open
a PR. Report findings; change nothing yet.

Check each of the five endpoints against:

1. The 8-item security checklist in backend/CLAUDE.md.

2. The contract in backend/API.md — every field name, every error code,
   character for character. List any deviation, however small.
   Casing counts: full_name is not fullName.

3. Leakage — does any response include a field not in the contract?
   Specifically: does any endpoint return a user's email address?

4. Error handling — is there any path where a Supabase error could
   reach the client as a 500 instead of a mapped 4xx? Name the line.

5. Duplication — did I reimplement in JavaScript anything that
   is_username_available or search_users already does? Name it.

6. Limits — is `limit` capped everywhere it's accepted?

Report as a numbered list, most serious first. For each: the file, the
line, what's wrong, and the fix. Then wait for me to tell you which
ones to apply.

HARD CONSTRAINTS:
- Change no files in this task. Report only.
```

---

# PHASE 1 SIGN-OFF

Tick together before Phase 2.

**Database**
- [ ] Migrations 002 and 003 applied to local and production
- [ ] Production user count unchanged from the C1 reading
- [ ] Zero completed users without a username in production
- [ ] Zero duplicate usernames in production
- [ ] Vishwajeet has read 20 real production handles and they look right

**Backend**
- [ ] Onboarding accepts a username; all four failure cases return clean 400s
- [ ] The race condition returns 400, never 500 — verified on both onboarding and PATCH
- [ ] All five user-module endpoints tested with curl
- [ ] `redirect_to` works for a changed handle
- [ ] Three security fixes verified, and legitimate use still works
- [ ] `backend/scripts/seedDemo.js` produces users with realistic handles

**Docs**
- [ ] `backend/API.md` matches what was built, on both sides
- [ ] `docs/CHANGELOG.md` has Handoff A and Neeraj's module handoff
- [ ] `docs/LEARNINGS.md` has the five Phase 1 entries
- [ ] Neeraj's PR reviewed and merged to `main`

---

*When every box is ticked, ask for the Phase 2 runbook (username UI, both surfaces).*
