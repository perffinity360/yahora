# Phase 0 Runbook — Foundation Setup

**Companion to `YAHORA_BUILD_PLAN.md`. Read plan §0 first, then work through this.**

---

## How Phase 0 flows

Phase 0 is **not** simultaneous. Vishwajeet works alone for about a day, then Neeraj joins.

```
        VISHWAJEET                              NEERAJ
────────────────────────────────────────────────────────────────────
DAY 1   Block A  Machine setup      (manual)    ⛔ waiting
 AM     Block B  Commit the plan    (manual)    ⛔
────────────────────────────────────────────────────────────────────
DAY 1   ▶ CC-1   Document existing API          ⛔
 PM       ✔ CHECK 1
        ▶ CC-2   Scaffold the backend           ⛔
          ✔ CHECK 2
────────────────────────────────────────────────────────────────────
DAY 2   ▶ CC-3   Write the 37-endpoint contract ⛔
 AM       ✔ CHECK 3
        ▶ CC-4   Governance files               ⛔
          ✔ CHECK 4
        Block C  .env.example + share secrets
        ──────────── HANDOFF 0 sent ──────────→
────────────────────────────────────────────────────────────────────
DAY 2   (available for Neeraj's questions)      Block A  Setup
 PM                                             ▶ N-CC-1  CLAUDE.md drift
                                                  ✔ CHECK
                                                ▶ N-CC-2  Contract audit
                                                  ✔ CHECK
                                                Block B  Read the contract
────────────────────────────────────────────────────────────────────
DAY 2   ═══ JOINT SESSION — 1 hour, both of you together ═══
 EVE    Contract review. This is the gate out of Phase 0.
────────────────────────────────────────────────────────────────────
```

**Why Vishwajeet goes first and alone:** everything Neeraj does in Phase 0 depends on files that don't exist yet. There is no way to parallelise this particular phase — it's the only one like that.

---

# ══════════════════════════════════════════
# TRACK 1 — VISHWAJEET: manual steps
# ══════════════════════════════════════════

## BLOCK A — Machine setup

**Everything in Block A is done by hand. Do not open Claude Code yet.**

### A1. Install Docker Desktop

You need Docker because `supabase start` runs a real Postgres in a container on your laptop. That local database is what lets you test a migration before it ever touches production.

Download Docker Desktop, install it, **and launch it**. The app has to be running, not just installed.

```bash
docker --version
docker ps
```

✔ **Check:** `docker --version` prints a version, and `docker ps` prints a table header (empty is fine). If `docker ps` says "Cannot connect to the Docker daemon", Docker Desktop isn't running — open the app and wait for the whale icon to go steady.

### A2. Install the Supabase CLI

```bash
npm install -g supabase
supabase --version
```

✔ **Check:** a version number prints. If you get "command not found" after a successful install, your npm global bin folder isn't on your PATH. Quick fix: use `npx supabase` instead of `supabase` for every command in this runbook.

### A3. Log in

```bash
supabase login
```

A browser opens, you approve, a token is saved to your machine.

✔ **Check:** the terminal says you're logged in.

### A4. Collect two secrets before you continue

**Your project ref.** Open your Supabase dashboard. The URL looks like:

```
https://supabase.com/dashboard/project/abcdefghijklmnopqrst
                                        └──── this is your project ref ────┘
```

**Your database password.** The one you set when you created the project. If you don't have it, don't guess — go to **Dashboard → Project Settings → Database → Reset database password**, generate a new one, and save it somewhere. Resetting it is safe; it doesn't affect your API keys or your running app.

✔ **Check:** you have both written down before moving on. `supabase link` will fail without them and the error message is not obvious.

### A5. Initialise Supabase inside your repo

```bash
cd /path/to/yahora
git checkout main
git pull
supabase init
```

✔ **Check:** a `supabase/` folder now exists with `config.toml` inside it.

### A6. Link to your live project

```bash
supabase link --project-ref abcdefghijklmnopqrst
```

It prompts for the database password from A4.

✔ **Check:** it prints a success message. If it hangs or times out, your network may be blocking port 5432 — try from a mobile hotspot.

### A7. Pull your existing schema — the step that saves you the most work

```bash
supabase db pull
```

This reads your **live** database and writes everything — tables, columns, indexes, constraints, triggers, functions, policies — into a migration file under `supabase/migrations/`.

✔ **Check:** a new `.sql` file appeared. Open it. It should be long (hundreds of lines).

### A8. Verify the pull actually captured everything

This is the step people skip, and it's the one that causes a mysterious failure three weeks later. `db pull` defaults to the `public` schema, and **some of your objects live elsewhere** — specifically your storage policies, which are on `storage.objects`.

Save this as `scripts/verify-baseline.sh` and run it:

```bash
#!/usr/bin/env bash
# Checks that db pull captured every object we know exists.
FILE=$(ls -t supabase/migrations/*.sql | head -1)
echo "Checking: $FILE"
echo

echo "--- TABLES (expect all present) ---"
for t in universities users products product_likes product_saves posts \
         messages comments comment_votes purchases courses specializations \
         visitor_metrics; do
  grep -qi "create table[^;]*\b$t\b" "$FILE" && echo "  OK   $t" || echo "  MISS $t"
done

echo
echo "--- FUNCTIONS / RPCs (expect all present) ---"
for f in increment_page_view increment_product_views update_product_likes_count \
         update_product_comments_count toggle_comment_vote \
         update_comment_vote_counts get_user_inbox cleanup_demo_users; do
  grep -qi "function[^(]*\b$f\b" "$FILE" && echo "  OK   $f" || echo "  MISS $f"
done

echo
echo "--- STORAGE POLICIES (these often DON'T come through) ---"
grep -qi "storage.objects" "$FILE" \
  && echo "  OK   storage policies present" \
  || echo "  MISS storage policies — see step A9"
```

```bash
chmod +x scripts/verify-baseline.sh
./scripts/verify-baseline.sh
```

✔ **Check:** every table and function says `OK`. If any says `MISS`, do not proceed — the baseline is incomplete and every future migration will be built on sand. Re-run `supabase db pull` and check again; if it's still missing, add that object by hand in step A9.

### A9. Add anything the pull missed

If storage policies said `MISS` (they usually do), create a follow-up migration:

```bash
supabase migration new storage_policies
```

Paste your existing storage SQL into it — and take this opportunity to fix the security hole from plan §1.6, where your bucket currently accepts uploads from anyone on the internet:

```sql
-- Tightened: only authenticated users may upload.
DROP POLICY IF EXISTS "Allow product uploads" ON storage.objects;
CREATE POLICY "Authenticated product uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products');

DROP POLICY IF EXISTS "Allow product image viewing" ON storage.objects;
CREATE POLICY "Public product image viewing"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'products');

-- Bucket for community post images (needed from Phase 6).
INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated post uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'posts');

CREATE POLICY "Public post image viewing"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'posts');
```

### A10. Start your local database

```bash
supabase start
```

**First run downloads several GB of Docker images. Expect 5–15 minutes.** Leave it alone.

When it finishes it prints a block of local URLs and keys. **Copy that entire block into a scratch file** — you need it in Block C and it's annoying to get back (`supabase status` reprints it).

```
API URL:      http://127.0.0.1:54321
DB URL:       postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL:   http://127.0.0.1:54323
anon key:     eyJ...
service_role: eyJ...
```

✔ **Check:** open the Studio URL in your browser. You should see your tables, empty.

### A11. Prove your migration files are complete

```bash
supabase db reset
```

This wipes the local database and replays every migration file from scratch.

✔ **Check:** it completes with no errors. **This is the single most important check in Block A.** If `db reset` runs clean, your migration files fully describe your schema. If it errors, something in your baseline is broken — fix it now, while it's cheap.

> ⚠️ **`supabase db reset` affects your LOCAL database only.** There is a `--linked` flag that resets *production*. Never type it. Never let Claude Code type it.

### A12. Apply the storage migration to production

```bash
supabase db push
```

✔ **Check:** it reports applying only the `storage_policies` migration (the baseline is already applied — the CLI knows this). Confirm in the Supabase dashboard that your policies changed.

### A13. Commit

```bash
git add supabase/ scripts/verify-baseline.sh
git commit -m "chore: baseline schema captured, storage policies tightened"
git push origin main
```

---

## BLOCK B — Prepare the repo for Claude Code

### B1. Put the build plan in the repo

**Do this before any Claude Code prompt.** Every prompt in Track 2 says "read `docs/YAHORA_BUILD_PLAN.md` §X". If the file isn't there, Claude Code invents its own version of the plan.

```bash
mkdir -p docs
# copy YAHORA_BUILD_PLAN.md and PHASE_0_RUNBOOK.md into docs/
git add docs/
git commit -m "docs: build plan and phase 0 runbook"
git push origin main
```

✔ **Check:** `ls docs/` shows both files.

### B2. Note your backend port

```bash
grep -rn "PORT\|listen(" backend/src/server.js backend/src/app.js
```

Write it down — you need it for the checks below. (Referred to as `$PORT` from here on.)

---

## ▶ RUN CC-1, THEN COME BACK

*(prompt is in Track 2)*

### ✔ CHECK 1 — after CC-1

```bash
# The file exists and is substantial
wc -l backend/API.md

# Count documented endpoints
grep -c "^### " backend/API.md

# Count actual routes in the code
grep -rhoE "router\.(get|post|put|patch|delete)\(" backend/src/modules/*/*.routes.js | wc -l
```

- [ ] The two counts match. If API.md has **fewer**, endpoints were missed. If it has **more**, Claude Code invented some — delete them.
- [ ] Open `backend/API.md` and spot-check three endpoints you know well against the actual controller code. Response fields must match exactly, including casing (`full_name` not `fullName`).
- [ ] `git diff --stat` shows **only** `backend/API.md` added. Nothing else should have changed.

> If CC-1 modified any code file, that's a red flag — it was told to document, not refactor. `git checkout` those files and re-run.

---

## ▶ RUN CC-2, THEN COME BACK

### ✔ CHECK 2 — after CC-2 (the most important check in Phase 0)

**Does the server still boot?**

```bash
cd backend && npm run dev
```

- [ ] Server starts with no errors. If it crashes, the most likely cause is a stub router file that doesn't export a valid Express router.

**Are all six new routes actually mounted?** In a second terminal:

```bash
for r in users notifications reports posts admin; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/$r)
  echo "/api/$r -> $code"
done
```

- [ ] Each returns **404 from the router** or **401**, but the server does not crash. You're checking that Express recognises the mount path — an empty router legitimately 404s on every path inside it.
- [ ] Existing routes still work: `curl http://localhost:$PORT/api/universities` returns your universities.

**Is the ownership scaffolding right?**

```bash
# Every module file should carry an owner banner
grep -rL "OWNER:" backend/src/modules/*/*.js
```

- [ ] Prints nothing. Any file listed is missing its banner.

```bash
# app.js must be frozen
head -5 backend/src/app.js
```

- [ ] The FROZEN comment is at the top.

```bash
ls backend/src/utils/respond.js backend/src/utils/notify.js \
   backend/src/middleware/requireAuth.js backend/src/middleware/optionalAuth.js \
   backend/src/config/supabase.js
```

- [ ] All five exist and none is empty (`wc -l` on each > 5).

**Did it delete anything?**

```bash
git diff --stat
git status
```

- [ ] No existing controller or route file shows deletions. If `products.controller.js` shrank, stop and investigate.

---

## ▶ RUN CC-3, THEN COME BACK

### ✔ CHECK 3 — after CC-3

```bash
grep -c "^### " backend/API.md          # total endpoints now
grep -c "OWNER: Neeraj" backend/API.md
grep -c "OWNER: Vishwajeet" backend/API.md
```

- [ ] Total went up by roughly 37
- [ ] Neeraj's count ≈ 20, yours ≈ 17
- [ ] Every new entry has both an `OWNER:` and a `PHASE` tag

**Now read it yourself, properly.** This is the contract your mobile app will be built against, and it's cheaper to fix on paper than in two codebases. For each of the four Neeraj-owned modules, ask:

- [ ] Does every list endpoint have `cursor` and `limit` params, and return `next_cursor`?
- [ ] Is every error case from the build plan present? (`USERNAME_TAKEN`, `BLOCKED`, `PRIVATE_ACCOUNT`, `RATE_LIMIT_*`, `CONTENT_BLOCKED` …)
- [ ] Does `GET /api/users/by-username/:username` document **both** the normal response and the `redirect_to` response?
- [ ] Does the user object include `username`, `followers_count`, `following_count`, `is_private` — and the `viewer` block?
- [ ] Are the three feed cursor types documented as *different*? (timestamp / hot_score float / epoch seconds)

Fix anything wrong by hand or with a follow-up prompt. Don't move on with a contract you haven't read.

---

## ▶ RUN CC-4, THEN COME BACK

### ✔ CHECK 4 — after CC-4

```bash
ls -la CLAUDE.md backend/CLAUDE.md docs/LEARNINGS.md docs/CHANGELOG.md
grep -c "^## " docs/LEARNINGS.md        # expect 5 seed entries
grep -n "MIGRATION REQUESTS" docs/CHANGELOG.md
```

- [ ] All four files exist and are non-empty
- [ ] `backend/CLAUDE.md` contains the file-ownership map, the API.md rule, and the 8-item security checklist from plan §0.5.4
- [ ] Root `CLAUDE.md` contains the LEARNINGS.md rule and the ownership section
- [ ] `docs/LEARNINGS.md` has 5 entries, and each uses **your** tables in its worked example — not a generic `foo`/`bar` example. If any entry is generic, send it back.
- [ ] `frontend/CLAUDE.md` §16 was **not** touched — that's Neeraj's file and his job

**Read the LEARNINGS entries yourself.** They're for you, and if you can't follow one, it's not written well enough. Ask Claude Code to rewrite any that lose you.

---

## BLOCK C — Environment handover

Your repo has no `.env.example`, which means Neeraj can't set up a working environment without guessing.

### C1. Create `backend/.env.example`

```bash
# backend/.env.example — committed to Git. NEVER put real values here.
PORT=5000
NODE_ENV=development

# LOCAL development (from `supabase start` output):
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
SUPABASE_ANON_KEY=your-local-anon-key

# Production values are NOT in this file. Ask Vishwajeet.
```

### C2. Confirm `.env` is git-ignored

```bash
grep -n "\.env" .gitignore
git status --short | grep "\.env$"   # must print NOTHING
```

- [ ] `.env` is in `.gitignore` and is not staged. If a real `.env` was ever committed, tell me and we'll deal with it properly — rotating keys, not just deleting the file.

### C3. Decide what Neeraj gets

**Give him the LOCAL keys only** (from your `supabase start` output). He develops against his own local database.

**Do not give him the production service-role key.** That key bypasses every RLS policy you're about to write. He doesn't need it — his backend modules run against local Supabase, and the website runs against the production *anon* key, which he already has.

- [ ] Send Neeraj: the local anon key, the local service-role key, and the local API URL
- [ ] Do **not** send: the production service-role key, or the database password

### C4. Commit and send Handoff 0

```bash
git add .
git commit -m "chore(phase-0): backend scaffolding, API contract, governance files"
git push origin main
```

Then send Neeraj the Handoff 0 message from plan §0.F, plus:

> Local Supabase keys are in [wherever you sent them]. Use those, not
> production. Run `supabase start` then `supabase db reset` to get a
> local copy of the schema — never with `--linked`.
>
> Your Phase 0 job is in `docs/PHASE_0_RUNBOOK.md` Track 3. Do that,
> then let's do the contract review together.

---

# ══════════════════════════════════════════
# TRACK 2 — VISHWAJEET: Claude Code prompts
# ══════════════════════════════════════════

Four prompts, run in order, with your checks in between. **Do not combine them.** Phase 0 touches too many files for one prompt to do reliably — and if something goes wrong in a combined run, you won't know which part broke.

Start every session (all four) by opening Claude Code in the **repo root**, not inside `backend/`.

---

## ▶ CC-1 — Document the existing backend

```
Read docs/YAHORA_BUILD_PLAN.md §0.5.3 first for context on why this
document matters.

TASK: Create backend/API.md documenting every endpoint that CURRENTLY
EXISTS in this backend.

Method:
1. Read every *.routes.js file under backend/src/modules/ to find the
   routes.
2. For each route, read the matching controller function to determine
   the real request and response shapes.
3. Document what the code actually does — not what you think it should
   do. If a controller returns an inconsistent shape across branches,
   document every branch.

Format each entry exactly like this:

### POST /api/products
**Module:** products
**Auth:** required (Bearer token) | optional | none
**Content-Type:** multipart/form-data
**Body:**
  - title: string, required, max 255
  - images: File[], required, max 5
**200:** { "product": { "id": "uuid", "title": "string", ... } }
**400:** { "error": "VALIDATION_ERROR", "message": "string" }
**401:** { "error": "UNAUTHORIZED" }
**Notes:** any surprising behaviour worth knowing

Group entries by module with ## headings. Add a table of contents.

HARD CONSTRAINTS:
- Do NOT modify any file except backend/API.md. No refactoring, no
  "while I was here" fixes, no formatting changes.
- Do NOT invent endpoints. If a route exists but its controller is
  missing or empty, document it as "NOT IMPLEMENTED".
- Field names must match the code character for character, including
  snake_case vs camelCase.

When done, print: the number of routes you found, the number you
documented, and any route you could not fully document and why.
```

---

## ▶ CC-2 — Scaffold the shared backend

```
Read docs/YAHORA_BUILD_PLAN.md sections 0.1, 0.5.1, 0.5.2 and 0.F
before doing anything. They specify exactly what to build.

CONTEXT: Two developers are about to write backend code in this repo
simultaneously, in separate Claude Code sessions that cannot see each
other. This task builds the structure that stops them colliding.

TASK, in this order:

1. Create six module folders under backend/src/modules/:
   user, social, notifications, reports, posts, admin
   Each gets <name>.routes.js and <name>.controller.js as working
   stubs — the routes file must export a valid empty Express Router.

2. Put an owner banner at the top of EVERY file in every module
   folder, in the exact format shown in plan §0.F Step 1. Owners:
     user, social, notifications, reports  -> NEERAJ
     posts, admin                          -> VISHWAJEET
   Also add a banner to the existing modules (auth, products,
   messages, universities, academic) -> VISHWAJEET

3. Rewrite backend/src/app.js to match plan §0.5.1 exactly, including
   the FROZEN comment block at the top. Every existing mount must be
   preserved — read the current file first and do not drop anything.

4. Create backend/src/utils/respond.js with sendError, mapDbError and
   sendPage, exactly as written in plan §0.5.2.

5. Create backend/src/middleware/requireAuth.js and
   optionalAuth.js. requireAuth rejects with 401 UNAUTHORIZED.
   optionalAuth attaches req.user if a valid token is present and sets
   it to null otherwise — it must never reject.

6. backend/src/config/supabase.js is currently empty. Find where the
   Supabase client is currently being constructed, move that logic
   here, export it, and update the importers.

7. backend/src/utils/notify.js — implement the notify() helper from
   plan §5.2. It will not work until migration 006 exists; that is
   expected. Guard it so a missing table logs a warning rather than
   throwing.

HARD CONSTRAINTS:
- Do NOT delete or rewrite any existing controller logic. Step 6 is a
  move-and-import change only; the behaviour must be identical.
- Do NOT add any new npm dependency.
- Do NOT write any SQL, and do NOT run any supabase command.
- Existing routes must keep working exactly as before.

When done:
- Run the server and confirm it boots.
- Print a list of every file you created or modified, with one line
  each saying what changed.
- Print anything you were unsure about rather than guessing silently.
```

---

## ▶ CC-3 — Write the full API contract

```
Read docs/YAHORA_BUILD_PLAN.md in full. Phases 1, 3, 5, 6 and 8 each
contain endpoint tables and response shapes.

TASK: Extend backend/API.md with every NEW endpoint the plan
specifies. This is transcription from the plan, not design — the
shapes are already decided.

Sources in the plan:
  §1.5  user module          -> 5 endpoints   OWNER: Neeraj
  §3.2  social module        -> 11 endpoints  OWNER: Neeraj
  §5.3  notifications module -> 3 endpoints   OWNER: Neeraj
  §6.6  reports              -> 1 endpoint    OWNER: Neeraj
  §6.6  posts module         -> 12 endpoints  OWNER: Vishwajeet
  §8.1  admin module         -> 5 endpoints   OWNER: Vishwajeet

Use the same entry format as the existing entries, plus two tags on
the heading line:

### POST /api/users/:id/follow   `OWNER: Neeraj`  `PHASE 3`

Requirements for every entry:
- Every error response the plan mentions for that endpoint
- For list endpoints: the cursor and limit query params, and a
  next_cursor field in the response
- State the cursor TYPE explicitly. The three feeds differ:
    campus + following -> created_at timestamp
    global?sort=hot    -> hot_score float
    global?sort=new    -> epoch seconds
  Getting this wrong causes silently skipped posts, so make it loud.
- Where the plan says a database trigger enforces a rule, add a
  "**Enforced by:**" line naming the trigger, so whoever implements it
  knows not to duplicate the check in JavaScript.

Also add a section at the top of API.md:
  - the standard error envelope: { "error": "CODE", ...extra }
  - the standard list envelope: { "items": [...], "next_cursor": ... }
  - a table of every error code used anywhere in this API

HARD CONSTRAINTS:
- Do NOT implement any endpoint. This task produces documentation only.
- Do NOT modify any .js file.
- Do NOT invent endpoints that aren't in the plan. If the plan is
  ambiguous about a shape, add "**TODO — ambiguous in plan:**" with
  your question rather than deciding for us.

When done, print: total endpoints documented, the count per owner, and
every TODO you raised.
```

---

## ▶ CC-4 — Governance and teaching files

```
Read docs/YAHORA_BUILD_PLAN.md §0.1, §0.2, §0.5 and §0.B/0.C.

(create files if not present and modify if present)

1. Root CLAUDE.md — ADD (do not replace the existing content):
   - The "Repo ownership" section from plan §0.D
   - The "Mandatory: teaching notes" rule from plan §0.C Step 2

2. Create backend/CLAUDE.md containing:
   - The full file-ownership map from plan §0.1
   - The "Mandatory: API.md is part of every backend change" rule from
     plan §0.B Step 2
   - The 8-item security checklist from plan §0.5.4, as a checklist to
     run before opening any PR
   - A rule: never edit app.js, middleware/, config/ or utils/ unless
     you are Vishwajeet; these are frozen shared infrastructure
   - A rule: never write SQL or run supabase commands from this repo's
     backend directory; post a migration request in docs/CHANGELOG.md

3. Create docs/CHANGELOG.md with the header, the six-section handoff
   template from plan §0.3, the Neeraj->Vishwajeet template from the
   same section, and an empty "## MIGRATION REQUESTS" heading.

4. Create docs/LEARNINGS.md using the structure in plan §0.C Step 1,
   then write these five seed entries:
     1. Database indexes, and why a UNIQUE index is also a lookup index
     2. Race conditions, and why "check then insert" is never safe
     3. What ON DELETE CASCADE actually does to your data
     4. Row Level Security: the anon key vs the service-role key, and
        why RLS does not protect your Express routes
     5. Cursor pagination vs offset pagination

   CRITICAL for these entries: the audience is developers with
   under 1 years of experience. Write each one fresh for a beginner.
   Compressed bullets points.

HARD CONSTRAINTS:
- Do NOT touch frontend/CLAUDE.md or mobile/CLAUDE.md. Different owner.
- Do NOT modify any .js file.
- Preserve all existing content in the root CLAUDE.md.

```

---

# ══════════════════════════════════════════
# TRACK 3 — NEERAJ: manual steps
# ══════════════════════════════════════════

**Start only after Vishwajeet sends Handoff 0.** Nothing here works before then.

## BLOCK A — Get a working local environment

### A1. Install Docker Desktop and the Supabase CLI

Same as Vishwajeet's A1 and A2:

```bash
docker --version && docker ps
npm install -g supabase && supabase --version
```

✔ **Check:** both print versions and `docker ps` doesn't error.

### A2. Pull the repo

```bash
cd /path/to/yahora
git checkout main
git pull
ls docs/          # you should see YAHORA_BUILD_PLAN.md and PHASE_0_RUNBOOK.md
```

### A3. Start a local database

```bash
supabase start
```

First run takes 5–15 minutes.

```bash
supabase db reset
```

This replays Vishwajeet's migration files into your local Postgres, so you get an exact copy of the schema.

✔ **Check:** `supabase db reset` finishes with no errors. Open the Studio URL it printed and confirm the tables are there.

> ### ⛔ Three commands you must never run
>
> ```bash
> supabase db push              # applies migrations to PRODUCTION
> supabase db reset --linked    # WIPES PRODUCTION
> supabase migration new ...    # creates migration files — Vishwajeet's job
> ```
>
> And never open the SQL Editor in the Supabase dashboard, even to look. If you need a schema change, use the migration request protocol (Block C3). Also add these three commands to a "never run" note in your Claude Code session — see N-CC-1.

### A4. Configure the backend and run it

```bash
cp backend/.env.example backend/.env
```

Fill in `backend/.env` with the **local** keys Vishwajeet sent you (or run `supabase status` to reprint them). Not production keys.

```bash
cd backend && npm install && npm run dev
```

✔ **Check:** server boots. Then:

```bash
curl http://localhost:5000/api/universities
```

- [ ] Returns data (or an empty array — the local DB has no seed data yet)
- [ ] `git status` shows `backend/.env` is **not** staged

### A5. Seed local test data

```bash
node backend/scripts/seedDemo.js
```

✔ **Check:** `curl http://localhost:5000/api/products` now returns demo products.

### A6. Run the website against your local backend

```bash
cd frontend && npm install && npm run dev
```

✔ **Check:** the site loads and the marketplace shows the seeded demo products. **If this works, your whole local stack works** — website → local backend → local database — and you can develop without touching production at all.

---

## ▶ RUN N-CC-1, THEN COME BACK

### ✔ CHECK — after N-CC-1

```bash
cd frontend && npm run dev
```

- [ ] The site still builds and runs
- [ ] `frontend/CLAUDE.md` §16 no longer mandates libraries that aren't in `package.json`
- [ ] `frontend/CLAUDE.md` §11 now points at `backend/API.md` instead of restating the API
- [ ] `git diff --stat` shows changes **only** under `frontend/`. If anything under `backend/`, `mobile/`, `supabase/` or `docs/` changed, revert it — those aren't yours.

---

## ▶ RUN N-CC-2, THEN COME BACK

### ✔ CHECK — after N-CC-2

N-CC-2 produces a review document, not code.

- [ ] `docs/reviews/neeraj-api-review.md` exists
- [ ] `git diff --stat` shows **only** that one new file — N-CC-2 must not have changed any code
- [ ] Read the whole thing yourself. Claude Code's review is a first pass to make yours sharper, not a substitute for it.

---

## BLOCK B — Review the contract yourself

**This is your real Phase 0 deliverable, and it's thinking work, not typing.** You're going to implement 20 of these endpoints, so an awkward shape costs you days later.

Open `backend/API.md`. For each of your four modules, work through:

### B1. Can you actually build your screens from this?

Take one screen you'll build and trace it. Example — the profile page:

- You need: name, handle, avatar, bio, university, follower counts, whether *you* follow them, whether they're private, their listings, their posts.
- Does `GET /api/users/by-username/:username` return all of that in **one** call?
- If it returns only some, how many requests does the page need? Two is fine. Five means the contract is wrong.

Do this trace for: profile page, followers list, notifications screen, community feed, composer.

### B2. Specific things to check

- [ ] Every list endpoint has `cursor` and `limit`, and returns `next_cursor`
- [ ] `next_cursor: null` is documented as meaning "no more pages"
- [ ] Errors are always `{ "error": "CODE" }` — same shape everywhere, no exceptions
- [ ] Every error code you'd need to show different UI for actually exists as a distinct code (you can't branch on a message string)
- [ ] Timestamps are ISO 8601 strings, consistently
- [ ] Booleans are named consistently (`is_private`, `is_following` — not `private` and `following`)
- [ ] Nothing returns an ID without also returning the fields you'd need to render it (avoiding a second lookup)
- [ ] Optional-auth endpoints document what a logged-out visitor gets

### B3. Write down every disagreement

Put them in `docs/reviews/neeraj-api-review.md` under a "MY CONCERNS" heading, in this shape:

```markdown
## Concern 3 — GET /api/users/:id/followers

**Problem:** returns only id, username, full_name, avatar_url. To show
a Follow button on each row I also need is_following per user, or I'll
make 30 extra requests to render one list.

**Proposed:** add "is_following": boolean to each item.

**Blocking:** yes — the followers list screen can't be built without it.
```

Mark each one **blocking** or **nice-to-have**. That distinction is what makes the joint session fast.

---

## BLOCK C — Things to internalise before Phase 1

### C1. Read plan §0.5 twice

It's the section that keeps you two from breaking each other's work. Specifically know: which files you must never edit, and why the response helpers are shared.

### C2. Know your boundaries

```bash
grep -rn "OWNER:" backend/src/modules/*/*.js | grep -i neeraj
```

Those files are yours. Everything else in `backend/` is not.

### C3. Know the migration request protocol

When you discover you need a column that doesn't exist:

1. Append to `docs/CHANGELOG.md` under `## MIGRATION REQUESTS`:
   > **Need:** `users.last_seen_at TIMESTAMPTZ` — for the "active recently" badge on follower rows. **Blocking:** followers list. **Requested:** 8 Aug.
2. Message Vishwajeet.
3. Keep working on something else. Same-day turnaround is the target.
4. Never write the SQL yourself, "just to test."

---

# ══════════════════════════════════════════
# TRACK 4 — NEERAJ: Claude Code prompts
# ══════════════════════════════════════════

Open Claude Code in the **repo root**.

---

## ▶ N-CC-1 — Fix the frontend CLAUDE.md drift

```
Read docs/YAHORA_BUILD_PLAN.md §0.D and §0.5 first.

BACKGROUND: frontend/CLAUDE.md §16 currently mandates design libraries
— motion (Framer Motion), GSAP, Lenis — and a file src/styles/tokens.css.
None of those are in frontend/package.json and that CSS file does not
exist. So this instruction file is currently telling you to use things
that aren't installed, which produces code that won't run.

TASK:

1. Audit frontend/CLAUDE.md against reality. For every library,
   file path, script, or convention it mentions, check whether it
   actually exists in the repo. Produce a list of every mismatch.

2. Resolve the §16 drift. Present me with two options and your
   recommendation, then wait for my answer before changing anything:
     (a) Install the missing libraries and create tokens.css
     (b) Rewrite §16 to describe what we actually use today
   Do not decide this for me.

3. Replace §11 (API Contract) with a pointer to backend/API.md:
     "The authoritative API contract is backend/API.md. Read it before
      writing any code that calls the backend. Do not infer response
      shapes from existing frontend code — it may be out of date."
   Delete the endpoint documentation currently inline in §11 — it now
   lives in one place only.

4. Add a section at the top of frontend/CLAUDE.md:

   ## Ownership and hard limits (Neeraj's session)

   I own: frontend/ and these backend modules —
   backend/src/modules/{user,social,notifications,reports}/

   NEVER modify:
   - backend/src/app.js, middleware/, config/, utils/  (frozen, shared)
   - backend/src/modules/{posts,admin,auth,products,messages,universities,academic}/
   - supabase/ or any .sql file
   - mobile/

   NEVER run:
   - supabase db push
   - supabase db reset --linked
   - supabase migration new
   - any SQL, in any tool, including the Supabase dashboard

   Need a schema change? Add a request under "## MIGRATION REQUESTS"
   in docs/CHANGELOG.md and stop. Do not work around it with SQL.

   Always use sendError, mapDbError and sendPage from
   backend/src/utils/respond.js. Never hand-roll a response shape.

HARD CONSTRAINTS:
- Change nothing outside frontend/ in this task.
- Do not install anything until I answer step 2.
```

---

## ▶ N-CC-2 — Audit the API contract as a frontend consumer

```
Read backend/API.md in full, then read docs/YAHORA_BUILD_PLAN.md
Phases 2, 4, 5 and 7 — those are the web screens I'm going to build.

TASK: Review the API contract from the point of view of someone who
has to build those screens in React, and write your findings to
docs/reviews/neeraj-api-review.md.

For each screen listed in the plan (username onboarding, profile page,
followers/following lists, follow requests, notifications, community
feed with the desktop two-column layout, composer, post detail,
report modal), work out:

1. Which endpoints does this screen call?
2. How many round trips does one render take? Flag anything over two.
3. Is any field the screen needs missing from the response? Name the
   exact field and the exact endpoint.
4. Would rendering a list require a per-item extra request? That's an
   N+1 problem and it must be fixed in the contract, not worked around
   in React.

Then check the contract as a whole:
- Are naming conventions consistent across all endpoints
  (snake_case vs camelCase, is_x vs x)?
- Do all list endpoints paginate the same way?
- Is the error envelope identical everywhere?
- Does every error state that needs distinct UI have its own code?
- What does each optional-auth endpoint return to a logged-out visitor?

Write findings as numbered concerns. For each one give: the problem,
a concrete proposed change to the contract, and whether it's BLOCKING
(I cannot build the screen) or NICE-TO-HAVE.

Sort BLOCKING concerns first.

HARD CONSTRAINTS:
- Write only docs/reviews/neeraj-api-review.md. Change no code, and do
  not edit backend/API.md — I'm reviewing it, not rewriting it.
- Don't invent problems to fill the document. If a screen is cleanly
  served by the contract, say so in one line and move on.
```

---

# ══════════════════════════════════════════
# THE JOINT SESSION — both of you, ~1 hour
# ══════════════════════════════════════════

**This is the gate out of Phase 0.** Don't skip it because you're keen to start coding — changing a contract on paper takes minutes, changing it after two clients are built takes days.

**Run it like this:**

1. Neeraj reads out his BLOCKING concerns one at a time (from `docs/reviews/neeraj-api-review.md`)
2. For each: agree a change, or agree it's fine and record why
3. Vishwajeet edits `backend/API.md` live, in the session
4. Then the NICE-TO-HAVEs — timebox to 15 minutes, defer anything that isn't quick
5. Vishwajeet commits the updated contract
6. Neeraj adds a line to his review file: "Reviewed and agreed, 8 Aug 2026"

**One rule for the session:** if you disagree about a response shape, the tiebreaker is *whichever shape makes the mobile app simpler*. Mobile has the harder constraints — slower networks, offline states, no easy refresh — and a shape that works there will work on the web. The reverse isn't true.

---

# PHASE 0 SIGN-OFF

Both of you tick these together. Phase 1 does not start until every box is checked.

**Database**
- [ ] `supabase db pull` baseline captured, `verify-baseline.sh` shows all OK
- [ ] `supabase db reset` runs clean on Vishwajeet's machine
- [ ] `supabase db reset` runs clean on Neeraj's machine
- [ ] Storage policies tightened and the `posts` bucket created

**Backend scaffolding**
- [ ] Six module folders exist with owner-bannered stubs
- [ ] `app.js` final, frozen, banner in place, server boots
- [ ] `respond.js`, `notify.js`, `requireAuth`, `optionalAuth`, `config/supabase.js` all written and non-empty
- [ ] All existing endpoints still work

**Contract**
- [ ] `backend/API.md` documents all existing endpoints, verified against the code
- [ ] `backend/API.md` documents all 37 new endpoints with owner and phase tags
- [ ] Neeraj's review complete, blocking concerns resolved, contract updated

**Governance**
- [ ] Root `CLAUDE.md` has the ownership section and the LEARNINGS rule
- [ ] `backend/CLAUDE.md` has the ownership map, API.md rule and security checklist
- [ ] `frontend/CLAUDE.md` drift resolved, §11 points at API.md, ownership limits added
- [ ] `docs/CHANGELOG.md` exists with both handoff templates and a MIGRATION REQUESTS heading
- [ ] `docs/LEARNINGS.md` has 5 beginner-level entries using real tables from this repo

**Environments**
- [ ] `backend/.env.example` committed; real `.env` git-ignored on both machines
- [ ] Neeraj has local Supabase keys only — no production service-role key, no DB password
- [ ] Neeraj's full local stack works: website → local backend → local database

**Everything pushed to `main` and both of you have pulled it.**

---

*When every box is ticked, ask for the Phase 1 runbook.*
