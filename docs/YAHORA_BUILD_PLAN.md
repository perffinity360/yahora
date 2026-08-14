# Yahora — Build Plan: Usernames, Follows & Community

**Version 1.0 — 7 August 2026**
**Owners:** Vishwajeet (database, backend, mobile app) · Neeraj (website)

---

## 0. How to use this document

This is the single source of truth for the next two features. Read Section 0 fully before starting anything — it explains how you two avoid stepping on each other. After that, work through the phases in order.

Every phase has:

- **Who does it** — Vishwajeet, Neeraj, or both
- **Blocking or parallel** — whether the other person can work at the same time
- **Exact steps** — with the actual SQL and code shapes
- **Definition of done** — how you know you can move on
- **Handoff** — what the other person needs to be told before *they* can start

### 0.1 The ownership split

| Area | Owner | Notes |
|---|---|---|
| Supabase database (schema, migrations, RLS, triggers, functions) | **Vishwajeet** | Neeraj never runs SQL. Ever. See §0.5 for the request protocol. |
| `backend/API.md` (the contract) | **Vishwajeet** writes it all, both implement to it | Written in Phase 0, before anyone codes |
| Shared backend infrastructure (`app.js`, `middleware/`, `config/`, `utils/`) | **Vishwajeet** | Frozen after Phase 0. Neeraj imports, never edits. |
| `backend/src/modules/user/` (usernames, search) | **Neeraj** | |
| `backend/src/modules/social/` (follows, blocks, privacy) | **Neeraj** | |
| `backend/src/modules/notifications/` (read side) | **Neeraj** | |
| `backend/src/modules/reports/` | **Neeraj** | |
| `backend/src/modules/posts/` (community feeds) | **Vishwajeet** | |
| `backend/src/modules/admin/` (moderation queue) | **Vishwajeet** | |
| `backend/src/modules/products/`, `auth/`, `messages/` (existing) | **Vishwajeet** | Includes the three security fixes in §1.6 |
| `backend/scripts/seedDemo.js` | **Vishwajeet** | Neeraj requests additions |
| Website (`frontend/`) | **Neeraj** | Vishwajeet doesn't touch this |
| Mobile app (`mobile/`) | **Vishwajeet** | Neeraj doesn't touch this |
| `docs/CHANGELOG.md` | Both append | How you tell each other things |

**The principle behind this split:** Vishwajeet owns everything where **a mistake is silent and permanent** — the database, security-critical paths, shared infrastructure. Neeraj owns things where **a mistake is loud and immediate** — endpoints he consumes in his own UI the next day, so a wrong response shape shows up on his screen within hours.

Read §0.5 in full before writing any backend code. It explains exactly how two people share one Express app without colliding.

> ⚠️ **This split trades one bottleneck for another, so watch it.** Vishwajeet is no longer the bottleneck for backend, but Neeraj now carries 20 endpoints *plus* the entire website. If either of you starts falling behind, use the **load valve** in §0.5.5 rather than quietly slipping. Don't wait until it's a week late to say something.

### 0.2 The Golden Rules

These are non-negotiable. Breaking any one of them will cost you a day of debugging.

**Rule 1 — Nobody runs SQL in the Supabase dashboard.**
Every schema change goes into a migration file first, gets committed to Git, and is then applied through the CLI. Not the other way around. If you type SQL into the dashboard SQL Editor, that change exists nowhere in your repo and the other person can never find out about it.

**Rule 2 — Never edit a migration that has already been applied.**
If migration `002` was wrong, you write `004_fix_002.sql`. An applied migration is history. History does not change. If you edit an applied migration, your local database and production database silently diverge and there is no way to tell.

**Rule 3 — `backend/API.md` is updated in the same commit as the endpoint.**
Not after. Not "later". The same commit. If the endpoint exists but the doc doesn't, Neeraj's Claude Code will guess the response shape and guess wrong.

**Rule 4 — Neeraj does not start a UI phase until the handoff for that phase is posted.**
Building a screen against an endpoint that doesn't exist yet means building against your imagination.

**Rule 5 — Both of you start every Claude Code session the same way.**
Paste this as your first message:

```
Before we start: read CLAUDE.md, docs/CHANGELOG.md, backend/API.md,
and database/schema.md. Summarise in 5 bullets what changed most
recently and what I should be careful about.
```

This is how you get "cross-chat memory". Your two Claude sessions cannot talk to each other. But they can both read the same files. **The files are your shared memory.** Chat history is not.

### 0.3 The handoff protocol

You're in separate chats, so a handoff has to be written down. When you finish a backend phase, append an entry to `docs/CHANGELOG.md` and send Neeraj the same text on WhatsApp.

Every handoff entry must contain these six things:

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

That last section — "What NOT to do yet" — is the one people skip and the one that saves the most time.

**A second handoff type now exists: Neeraj → Vishwajeet, when a backend module lands.** Shorter, but mandatory, because Vishwajeet's mobile app consumes it:

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

"Deviations from API.md" is the section that matters most here. If Neeraj had to change a response shape mid-implementation, Vishwajeet's mobile code is already written against the old one.

### 0.4 What "done" means for the whole project

At the end of all phases:

- Every student has a unique handle, reachable at `yahora.com/rahul`
- Students can follow each other across colleges, with private accounts and follow requests working
- Students can block each other, and blocking works everywhere (feeds, profiles, messages)
- There are two community feeds — home college (chronological) and global (ranked)
- Posts have up to 3 images, one level of replies, and likes
- Every post can be reported; 3 reports auto-hides it
- There's a notifications screen with an unread badge
- All of the above works identically on web and mobile

---

### 0.5 Sharing one backend between two people

This is the section that makes the split safe. Two people editing one Express app is genuinely dangerous — but only in specific, predictable ways. Here are the five failure modes and the mechanism that prevents each.

#### 0.5.1 Failure: you both edit `app.js` and get a merge conflict every single day

`app.js` is where routes get registered. If Neeraj adds `app.use('/api/users', userRoutes)` and Vishwajeet adds `app.use('/api/posts', postsRoutes)` on the same day, Git can usually merge it — but the moment either of you reorders or adds middleware, you get a conflict in the one file that makes the whole server boot.

**Mechanism: Vishwajeet writes the final `app.js` in Phase 0 and then it is frozen.**

Every route mount for every future module goes in *now*, pointing at empty stub routers. Nobody touches the file again.

```js
// backend/src/app.js — ⛔ FROZEN AFTER PHASE 0. Do not edit.
// Adding a route? Add it inside your own module's routes file.

// --- existing ---
app.use('/api/auth',          authRoutes);
app.use('/api/products',      productsRoutes);
app.use('/api/messages',      messagesRoutes);
app.use('/api/universities',  universitiesRoutes);
app.use('/api/academic',      academicRoutes);

// --- new: NEERAJ owns these files ---
app.use('/api/users',         userRoutes);          // usernames, search
app.use('/api/users',         socialRoutes);        // follows, blocks, privacy
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reports',       reportsRoutes);

// --- new: VISHWAJEET owns these files ---
app.use('/api/posts',         postsRoutes);
app.use('/api/admin',         adminRoutes);
```

> Two routers mounted on `/api/users` is deliberate and it works. Express tries `userRoutes` first; if no path inside it matches, it falls through to `socialRoutes`. This lets follows live at `/api/users/:id/follow` in a separate file from usernames, so the two of you never open the same file.

Vishwajeet also creates the stub files in Phase 0, so both of you start from a working server:

```js
// backend/src/modules/social/social.routes.js
import { Router } from 'express';
const router = Router();
// OWNER: Neeraj — Phase 3
export default router;
```

#### 0.5.2 Failure: your two modules return errors in different shapes

If Neeraj's endpoints return `{ error: "NOT_FOUND" }` and Vishwajeet's return `{ message: "not found", code: 404 }`, then the web and mobile clients each need two error-handling code paths. This is the kind of inconsistency that never gets cleaned up.

**Mechanism: Vishwajeet writes shared helpers in Phase 0. Both modules must use them.**

```js
// backend/src/utils/respond.js — OWNER: Vishwajeet. Frozen after Phase 0.

export function sendError(res, status, code, extra = {}) {
  return res.status(status).json({ error: code, ...extra });
}

/** Maps a Postgres/Supabase error to our standard response. */
export function mapDbError(res, error) {
  if (error.code === '23505') return sendError(res, 400, 'DUPLICATE');
  if (error.code === '23503') return sendError(res, 400, 'INVALID_REFERENCE');

  // Our triggers RAISE EXCEPTION with these names.
  const raised = [
    'USERNAME_RESERVED', 'BLOCKED', 'NESTED_REPLY_NOT_ALLOWED',
    'RATE_LIMIT_POSTS', 'RATE_LIMIT_REPLIES',
    'POSTING_RESTRICTED', 'ACCOUNT_SUSPENDED',
  ].find(name => error.message?.includes(name));

  if (raised) {
    const status = raised.startsWith('RATE_LIMIT') ? 429
                 : raised === 'BLOCKED' ? 403 : 400;
    return sendError(res, status, raised);
  }

  console.error('[db]', error);
  return sendError(res, 500, 'INTERNAL_ERROR');
}

/** Standard cursor-paginated envelope. Every list endpoint returns this shape. */
export function sendPage(res, items, cursorField = 'created_at', limit = 20) {
  const next = items.length === limit ? items[items.length - 1][cursorField] : null;
  return res.json({ items, next_cursor: next });
}
```

Also frozen in Phase 0: `middleware/requireAuth.js`, `middleware/optionalAuth.js`, `utils/notify.js` (the notification emitter from §5.2), and `config/supabase.js`.

**If Neeraj needs a change to any of these**, he messages Vishwajeet. He does not edit them and he does not write a parallel version in his own module.

#### 0.5.3 Failure: the API gets designed around what the website needs

Neeraj implements the endpoints, so it's natural for him to shape them around the React app in front of him. Then Vishwajeet hits mobile and finds the pagination doesn't work offline, or an image field returns a size that's wrong for a phone.

**Mechanism: Vishwajeet writes `backend/API.md` for ALL ~37 endpoints in Phase 0, before either of you implements anything.** Neeraj then implements to that spec.

The reasoning: mobile is the harder surface — slower networks, offline states, no easy refresh. If the person consuming on the harder surface writes the contract, both surfaces are served. If the easier surface writes it, the harder one gets retrofitted.

Neeraj **reviews** the contract before Phase 1 starts and pushes back on anything awkward for React. It's a spec review, not a handoff — spend an hour on it together.

#### 0.5.4 Failure: Neeraj introduces a security hole

He's writing endpoints that enforce campus isolation and privacy. A missed check is a data leak.

**Three mechanisms, layered:**

1. **The database enforces the rules that must never be wrong.** This is why the plan puts follow-status, block-checking, rate limits and reply-nesting in triggers rather than in controllers. Neeraj's code says "insert a follow"; the database decides what that means. He cannot get it wrong because it isn't his decision to make.
2. **RLS is the backstop** (§3.3), so even a hole in a controller doesn't expose another campus's data through the direct-Supabase path.
3. **Mandatory review.** Every backend PR gets read by the other person before merge. This is no longer optional now that two people write backend code.

**Security checklist — run through this on every endpoint before opening a PR:**

- [ ] Does it require auth? If it's optional-auth, is the unauthenticated path safe?
- [ ] Does it verify the **caller owns** the thing being modified? (`seller_id === req.user.id`)
- [ ] Does it verify **campus match** where required? (products, messages, campus posts)
- [ ] Does it call `can_view_social_content()` before returning anything from a profile?
- [ ] Does it filter out blocked users with `is_blocked_pair()`?
- [ ] Are `limit` and `cursor` validated? (`limit` capped at 50 — an uncapped limit is a denial-of-service)
- [ ] Does it use `mapDbError()` rather than leaking raw Postgres errors to the client?
- [ ] Is every ID in the response a UUID the caller is allowed to know about?

Put this checklist in `backend/CLAUDE.md` so both Claude Code sessions apply it automatically.

#### 0.5.5 Failure: one of you needs a schema change mid-work, and stalls

Neeraj will get halfway through the social module and realise he needs a column that isn't there. If he waits, he's blocked. If he adds it himself, Rule 1 is broken and the schema drifts.

**Mechanism — the migration request protocol:**

1. Neeraj posts a request in `docs/CHANGELOG.md` under `## MIGRATION REQUESTS` and messages Vishwajeet:
   > *Need: `users.last_seen_at TIMESTAMPTZ` — for the "active recently" badge on profile cards. Blocking: social module follower list.*
2. Vishwajeet writes the migration, applies it, replies with the migration number.
3. Target turnaround: **same day**. If Vishwajeet can't do it within a few hours, Neeraj works around it and revisits.
4. Neeraj **never** opens the Supabase dashboard SQL editor. Not even to test. Not even read-only-looking queries that turn out to write.

**The load valve.** If the split turns out to be uneven once you're actually building, move a whole module — never half of one:

- **Neeraj is drowning** → the `notifications` module moves to Vishwajeet. It's the most self-contained (3 read endpoints, no writes from the client).
- **Vishwajeet is drowning** → `POST /api/posts` and the two like endpoints move to Neeraj. The three *feed* endpoints stay with Vishwajeet, because their cursor semantics differ per feed and they're tightly coupled to the RPCs.

Decide this at the Phase 3 sync point, not at the end. Moving a module mid-phase is what causes merge pain.

#### 0.5.6 Branch and PR rules (updated for a shared backend)

- Keep your personal branches: `vishwajeet` and `neeraj`
- **Every backend PR requires a review from the other person before merge.** Frontend and mobile PRs don't.
- Rebase on `main` before opening a backend PR, always
- Merge backend PRs promptly — a long-lived backend branch is where conflicts breed
- One module per PR. Don't bundle `social` and `notifications` into one review.

---

# PHASE 0 — Foundation Setup

**Who:** Vishwajeet, alone
**Neeraj:** blocked, do not start — but he should read §0.5 and review `API.md` at the end
**Estimated:** 1.5 days (up from 1 — the full API contract is now written here)
**Why it's first:** everything else assumes these files exist

---

## 0.A Set up the Supabase CLI

This replaces "paste SQL into the dashboard" forever. Here is exactly what to run.

### Step 1 — Install

```bash
npm install -g supabase
supabase --version
```

### Step 2 — Log in and connect to your project

```bash
cd /path/to/yahora
supabase login
```

That opens a browser and generates an access token.

```bash
supabase init
```

This creates a `supabase/` folder in your repo with a config file. Commit it.

Now link to your live project. You need your **project ref** — it's the random string in your Supabase dashboard URL: `https://supabase.com/dashboard/project/abcdefghijklmnop` → the ref is `abcdefghijklmnop`.

```bash
supabase link --project-ref abcdefghijklmnop
```

It will ask for your database password (the one you set when you created the project).

### Step 3 — Capture your existing schema automatically

**This is the step that saves you all the manual work.**

```bash
supabase db pull
```

This connects to your live database, reads every table, column, index, trigger, function and policy you have *right now*, and writes them out as a migration file in `supabase/migrations/`.

You do not have to copy-paste anything from your Google Doc. The CLI reads the real database and writes the real schema. Commit that file — it is now your baseline.

```bash
git add supabase/
git commit -m "chore: baseline schema captured from production"
```

### Step 4 — From now on, every change works like this

```bash
# 1. Create an empty, timestamped migration file
supabase migration new usernames
# → creates supabase/migrations/20260807143000_usernames.sql

# 2. Open that file and write your SQL into it

# 3. Test it locally first (see Step 5)

# 4. Apply it to production
supabase db push
```

`supabase db push` looks at which migrations production has already run, and applies only the new ones. You never have to track this by hand.

### Step 5 — Run a local database (strongly recommended)

```bash
supabase start
```

This spins up a full Postgres + Supabase stack on your machine using Docker. It gives you local URLs and keys.

Why this matters enormously for you two: **right now you are both testing against your production database.** If you write a broken migration, real user data is affected and Neeraj's website breaks at the same moment. With a local database, you test the migration on your machine, confirm it works, *then* push.

```bash
supabase db reset   # wipes local DB and replays ALL migrations from scratch
```

That command is your safety check. If `db reset` runs clean, your migration files are correct and complete. If it errors, you have a bug you would otherwise only have discovered in production.

### Why the CLI over the manual folder approach

You asked which is better. The CLI, clearly, for four reasons:

| | Manual `.sql` folder | Supabase CLI |
|---|---|---|
| Capturing your existing schema | Copy-paste from your doc by hand, hope you didn't miss anything | `supabase db pull` — automatic, exact |
| Tracking what's applied | You maintain a `schema_migrations` table and remember to insert into it | Automatic |
| Applying a migration | Open dashboard, paste, click Run | `supabase db push` |
| Testing before production | Impossible — you only have production | `supabase start` gives you a throwaway local copy |

The manual approach was my fallback in case you couldn't install Docker. If Docker runs on your machine, use the CLI.

> **Note on where migrations live.** The CLI uses `supabase/migrations/`. Earlier I suggested `database/migrations/`. **Use the CLI's folder — `supabase/migrations/`.** Don't fight the tool. Delete the idea of `database/migrations/` and keep `database/schema.md` as a human-readable explanation of what the tables mean (the CLI files are the machine-readable truth).

---

## 0.B Create `backend/API.md` and make Claude Code maintain it

**Yes** — Claude Code can absolutely create and maintain this for you. Here's how to make it automatic rather than something you have to remember.

### Step 1 — Have Claude Code generate the first version

Open Claude Code in the repo root and give it this:

```
Read every file under backend/src/modules/. For each route, document
the exact HTTP method, path, auth requirement, request body/query
shape, and every possible response shape including errors.

Write this to backend/API.md. Group by module. Use this format for
each endpoint:

### POST /api/products
**Auth:** required (Bearer token)
**Body:** multipart/form-data
  - title: string, 1-255 chars, required
  - images: File[], max 5, required
**200:** { "product": { "id": "uuid", "title": "string", ... } }
**400:** { "error": "VALIDATION_ERROR", "message": "string" }
**401:** { "error": "UNAUTHORIZED" }

Do not invent endpoints. Only document what exists in the code.
```

That gives you an accurate starting document for everything you've already built.

### Step 2 — Make updating it automatic

Add this to `backend/CLAUDE.md` (create the file — you don't have one yet):

```markdown
## Mandatory: API.md is part of every backend change

Whenever you add, remove, or modify ANY route, controller response
shape, or error code in this backend, you MUST update backend/API.md
in the SAME response. This is not optional and does not need to be
requested.

If you change a response shape, also add a line to docs/CHANGELOG.md
under a "BREAKING" heading, because a separate developer is building
a client against this API and cannot see this conversation.

Never mark a backend task complete until API.md reflects the change.
```

Claude Code reads `CLAUDE.md` at the start of every session in that directory. Putting the rule there means it happens without you asking, every time.

---

## 0.D Update the CLAUDE.md files

Three files to touch:

**Root `CLAUDE.md`** — add:

```markdown
## Repo ownership (two developers, separate sessions)

- Vishwajeet owns: supabase/, backend/, mobile/
- Neeraj owns: frontend/
- Shared, both may append: docs/CHANGELOG.md

Never modify a directory outside the owner's scope without saying so
loudly in your response. The two developers work in separate Claude
sessions and cannot see each other's conversations. Files in this
repo are the ONLY shared memory between them.

At the start of every session, read docs/CHANGELOG.md to find out
what the other developer changed.
```

**`backend/CLAUDE.md`** — create it, add the API.md rule from 0.B.

**`frontend/CLAUDE.md`** — §11 currently documents the API. Replace that section with a pointer:

```markdown
## 11. API Contract

The authoritative API contract is `backend/API.md`. Read it before
writing any code that calls the backend. Do not infer response shapes
from existing frontend code — it may be out of date.
```

Same edit in `mobile/CLAUDE.md`.

**Also fix the drift I found earlier:** `frontend/CLAUDE.md` §16 mandates `motion` (Framer Motion), GSAP, Lenis and `src/styles/tokens.css`. None of those exist in `package.json` and the file doesn't exist. Either install them or delete that section — right now it tells Claude Code to use libraries that aren't there, which produces code that won't run.

---

## 0.E Create `docs/CHANGELOG.md`

```markdown
# Changelog

How Vishwajeet and Neeraj tell each other what changed.
Newest at top. Every backend/database change gets an entry.

Format: see the six-section template in YAHORA_BUILD_PLAN.md §0.3
Migration requests go under ## MIGRATION REQUESTS (see §0.5.5)
```

---

## 0.F Scaffold the shared backend — the part that makes the split work

This is new, and it's the most important half-day of the whole project. Everything here exists so that you and Neeraj can write backend code simultaneously without ever opening the same file.

### Step 1 — Create every module folder now, with stub routers

```bash
mkdir -p backend/src/modules/{user,social,notifications,reports,posts,admin}
```

In each, create `<name>.routes.js` and `<name>.controller.js`. The routes file is three lines and an owner comment:

```js
// backend/src/modules/social/social.routes.js
// ══════════════════════════════════════════════
// OWNER: NEERAJ   —   built in Phase 3
// Vishwajeet: do not edit this file.
// ══════════════════════════════════════════════
import { Router } from 'express';
const router = Router();
export default router;
```

Put the owner banner at the top of **every** module file. Both Claude Code sessions read it and will refuse to edit a file they don't own.

### Step 2 — Write the final `app.js` and freeze it

Use the version in §0.5.1. Add this comment at the very top of the file:

```js
// ⛔ FROZEN. Every route mount for every planned module is already here.
// If you need a new endpoint, add it inside your own module's routes file.
// If you genuinely need a new mount, message Vishwajeet — do not edit this.
```

Verify the server boots with all six new (empty) routers mounted before you commit.

### Step 3 — Write the shared helpers

Create these, exactly as specified in §0.5.2, and mark each with an owner banner:

- `backend/src/utils/respond.js` — `sendError`, `mapDbError`, `sendPage`
- `backend/src/utils/notify.js` — the notification emitter (full code in §5.2)
- `backend/src/middleware/requireAuth.js` — rejects with `401 UNAUTHORIZED`
- `backend/src/middleware/optionalAuth.js` — attaches `req.user` if a token is present, otherwise `null`
- `backend/src/config/supabase.js` — the service-role client (this file is currently empty in your repo)

`optionalAuth` matters more than it looks: profile pages and the availability check must work for logged-out visitors, so those routes need "attach a user if there is one" rather than "reject if there isn't one."

### Step 4 — Write the FULL API contract for all 37 new endpoints

Before either of you implements anything. Every endpoint from Phases 1, 3, 5, 6 and 8, with its exact request and response shapes — they're all specified in this document, so it's transcription rather than design.

Mark each entry with its owner:

```markdown
### POST /api/users/:id/follow          `OWNER: Neeraj` `PHASE 3`
**Auth:** required
**Params:** id — UUID of the user to follow
**Body:** none
**200:** { "status": "accepted" | "pending" }
**403:** { "error": "BLOCKED" }
**400:** { "error": "CANNOT_FOLLOW_SELF" }
```

### Step 5 — Neeraj reviews the contract

Sit down together for an hour. He reads all 37 entries and flags anything awkward for React. Fix it now — changing a contract on paper takes minutes; changing it after two clients are built takes days.

**This review is the handoff gate for Phase 0.** Don't skip it because you're keen to start coding.

---

## Phase 0 — Definition of done

- [ ] `supabase login`, `init`, `link` all completed
- [ ] `supabase db pull` has captured the existing schema into `supabase/migrations/`
- [ ] `supabase start` works and `supabase db reset` runs clean
- [ ] `backend/API.md` documents all **existing** endpoints
- [ ] `backend/API.md` documents all **37 new** endpoints with owner tags (§0.F Step 4)
- [ ] Neeraj has reviewed the contract and his feedback is folded in
- [ ] All six module folders created with owner-bannered stub routers
- [ ] `app.js` final, frozen, banner added, server boots
- [ ] `respond.js`, `notify.js`, `requireAuth`, `optionalAuth`, `config/supabase.js` written
- [ ] `backend/CLAUDE.md` created with: the API.md rule, the file-ownership map, and the §0.5.4 security checklist
- [ ] Root `CLAUDE.md` has the ownership section
- [ ] `docs/CHANGELOG.md` exists with a `## MIGRATION REQUESTS` heading
- [ ] `frontend/CLAUDE.md` §16 drift resolved
- [ ] Everything committed and pushed to `main`

### 🔀 HANDOFF 0 → Neeraj

Send him this:

> **Phase 0 done. You're now writing backend code too — read §0.5 of
> the build plan before anything else.**
>
> You own four backend modules: `user`, `social`, `notifications`,
> `reports`. Stub files are already created with your name on them.
> I own `posts`, `admin`, the existing modules, and everything shared.
>
> **Four rules, no exceptions:**
> 1. Never edit `app.js`, `middleware/`, `config/`, or `utils/`. Every
>    route mount you need is already registered. Message me if
>    something's missing.
> 2. Always use `sendError`, `mapDbError` and `sendPage` from
>    `utils/respond.js`. Don't hand-roll error shapes.
> 3. Never run SQL, anywhere, including the dashboard. Post a
>    migration request in CHANGELOG.md and message me — same-day
>    turnaround.
> 4. Backend PRs need my review before merge. Frontend PRs don't.
>
> `backend/API.md` now specifies all 37 new endpoints. Implement to
> that spec exactly — my mobile app is built against it too, so if you
> change a response shape without telling me, mobile breaks silently.
>
> **Next:** you're blocked until Handoff A (migrations 002/003). Use
> the time to read §0.5 and §1.5, and to review the contract with me.

---

# PHASE 1 — Usernames: Database & Backend

**Database (§1.2–1.4, 1.6):** Vishwajeet — **blocking**
**Backend `user` module (§1.5):** Neeraj — starts after Handoff A
**Estimated:** Vishwajeet 1.5 days, then Neeraj 1.5 days
**Neeraj during the DB work:** blocked. Review the API contract, read §0.5.

---

## 1.1 Understanding the design before writing SQL

Four things make usernames hard, and each one maps to a piece of the schema below.

**Problem 1 — Case.** If `Rahul` and `rahul` are different rows, two people own what looks like the same handle, and `/Rahul` and `/rahul` are different URLs. **Solution:** store lowercase always, enforce it with a `CHECK` constraint so a bug in the app can't sneak a capital letter in.

**Problem 2 — The race condition.** Student A and Student B both check `rahul`, both see "available", both submit. No amount of checking prevents this, because the check and the insert are two separate moments in time. **Solution:** the `UNIQUE` index is the real arbiter. The database rejects the second insert with error code `23505`. The backend catches that specific code and returns a clean message.

**Problem 3 — Route collisions.** You chose root-level URLs (`/rahul`). That means `/settings` would be a username. **Solution:** a `reserved_usernames` table, enforced by a trigger, containing every current and future top-level route.

**Problem 4 — Squatting.** Rahul changes his handle to `rahul.sharma`. Within seconds a bot registers `rahul` and impersonates him. **Solution:** a `username_history` table that keeps a released handle locked for 30 days.

---

## 1.2 Migration: `002_usernames.sql`

```bash
supabase migration new usernames
```

Paste the following into the generated file. Every block is explained underneath.

```sql
-- ============================================================
-- 002_usernames.sql
-- Adds unique username handles to users.
-- ============================================================

-- pg_trgm powers fuzzy search ("rahl" should still find "rahul").
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ------------------------------------------------------------
-- 1. Columns on users
-- ------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN username            TEXT,
  ADD COLUMN username_changed_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 2. Format rules, enforced by the database itself
-- ------------------------------------------------------------
ALTER TABLE users ADD CONSTRAINT users_username_valid CHECK (
  username IS NULL OR (
        username = lower(username)                   -- lowercase only
    AND length(username) BETWEEN 3 AND 20
    AND username ~ '^[a-z0-9][a-z0-9._]*[a-z0-9]$'   -- starts & ends alphanumeric
    AND username !~ '[._]{2}'                        -- no '..' or '__' or '._'
  )
);

-- NOTE: the "username required when profile is complete" constraint is NOT
-- added here. It is added in migration 003, AFTER the backfill. Adding it
-- now would fail on production, where existing completed users still have
-- username = NULL. See PHASE_1_RUNBOOK.md for the corrected ordering.

-- ------------------------------------------------------------
-- 3. Indexes
-- ------------------------------------------------------------

-- Uniqueness AND fast exact lookup, in one index.
-- NULLs are allowed to repeat, which is what we want during backfill.
CREATE UNIQUE INDEX users_username_key ON users (username);

-- Prefix search: WHERE username LIKE 'rah%'
-- A normal index can't serve LIKE in most collations. text_pattern_ops can.
CREATE INDEX users_username_prefix_idx ON users (username text_pattern_ops);

-- Fuzzy search: typo tolerance on username and display name.
CREATE INDEX users_username_trgm_idx  ON users USING GIN (username  gin_trgm_ops);
CREATE INDEX users_full_name_trgm_idx ON users USING GIN (full_name gin_trgm_ops);

-- ------------------------------------------------------------
-- 4. Reserved usernames
-- ------------------------------------------------------------
CREATE TABLE reserved_usernames (
  username TEXT PRIMARY KEY,
  reason   TEXT NOT NULL DEFAULT 'system'
);

INSERT INTO reserved_usernames (username, reason) VALUES
  -- existing and planned routes
  ('marketplace','route'), ('product','route'),  ('products','route'),
  ('messages','route'),    ('message','route'),  ('dashboard','route'),
  ('sell','route'),        ('auth','route'),     ('login','route'),
  ('logout','route'),      ('signup','route'),   ('register','route'),
  ('onboarding','route'),  ('feed','route'),     ('hot','route'),
  ('user','route'),        ('users','route'),    ('profile','route'),
  ('settings','route'),    ('community','route'),('notifications','route'),
  ('search','route'),      ('explore','route'),  ('saved','route'),
  ('wishlist','route'),    ('following','route'),('followers','route'),
  ('post','route'),        ('posts','route'),    ('u','route'),
  -- brand and system
  ('yahora','brand'),      ('admin','system'),   ('administrator','system'),
  ('root','system'),       ('support','system'), ('help','system'),
  ('api','system'),        ('www','system'),     ('mail','system'),
  ('team','system'),       ('official','system'),('staff','system'),
  ('moderator','system'),  ('mod','system'),     ('security','system'),
  -- legal / static pages
  ('about','page'),        ('terms','page'),     ('privacy','page'),
  ('contact','page'),      ('careers','page'),   ('blog','page'),
  ('faq','page'),          ('guidelines','page'),('deletion','page'),
  ('childsafety','page'),  ('pricing','page'),   ('download','page'),
  -- reserved for future
  ('groups','future'),     ('channels','future'),('events','future'),
  ('jobs','future'),       ('rooms','future'),   ('clubs','future');

-- Enforce it. A CHECK constraint can't query another table, so we use a trigger.
CREATE OR REPLACE FUNCTION check_username_not_reserved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.username IS NOT NULL
     AND EXISTS (SELECT 1 FROM reserved_usernames WHERE username = NEW.username)
  THEN
    RAISE EXCEPTION 'USERNAME_RESERVED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_username_not_reserved
  BEFORE INSERT OR UPDATE OF username ON users
  FOR EACH ROW EXECUTE FUNCTION check_username_not_reserved();

-- ------------------------------------------------------------
-- 5. Username history (anti-squatting + old-link redirects)
-- ------------------------------------------------------------
CREATE TABLE username_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username       TEXT NOT NULL,
  released_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reserved_until TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

CREATE INDEX username_history_lookup_idx ON username_history (username, reserved_until DESC);
CREATE INDEX username_history_user_idx   ON username_history (user_id);

-- Automatically record the old handle whenever it changes.
CREATE OR REPLACE FUNCTION record_username_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.username IS NOT NULL AND NEW.username IS DISTINCT FROM OLD.username THEN
    INSERT INTO username_history (user_id, username) VALUES (OLD.id, OLD.username);
    NEW.username_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_record_username_change
  BEFORE UPDATE OF username ON users
  FOR EACH ROW EXECUTE FUNCTION record_username_change();

-- ------------------------------------------------------------
-- 6. Availability check — one function, one round trip
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_username_available(
  p_username TEXT,
  p_user_id  UUID DEFAULT NULL     -- pass your own id so your current handle reads as "available"
)
RETURNS BOOLEAN AS $$
DECLARE
  u TEXT := lower(trim(p_username));
BEGIN
  -- format
  IF u IS NULL
     OR length(u) NOT BETWEEN 3 AND 20
     OR u !~ '^[a-z0-9][a-z0-9._]*[a-z0-9]$'
     OR u ~ '[._]{2}'
  THEN RETURN FALSE; END IF;

  -- reserved
  IF EXISTS (SELECT 1 FROM reserved_usernames WHERE username = u)
  THEN RETURN FALSE; END IF;

  -- already taken by someone else
  IF EXISTS (SELECT 1 FROM users WHERE username = u
             AND (p_user_id IS NULL OR id <> p_user_id))
  THEN RETURN FALSE; END IF;

  -- in the 30-day cooling-off window after someone released it
  IF EXISTS (SELECT 1 FROM username_history
             WHERE username = u AND reserved_until > now()
             AND (p_user_id IS NULL OR user_id <> p_user_id))
  THEN RETURN FALSE; END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------
-- 7. Auto-generation from a display name
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_username(p_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base      TEXT;
  candidate TEXT;
  suffix    TEXT;
  attempts  INT := 0;
BEGIN
  -- "Rahul  Sharma!" -> "rahul.sharma"
  base := lower(coalesce(p_name, ''));
  base := regexp_replace(base, '[^a-z0-9]+', '.', 'g');
  base := regexp_replace(base, '\.{2,}', '.', 'g');
  base := trim(both '.' from base);
  base := left(base, 14);
  base := trim(both '.' from base);

  IF base IS NULL OR length(base) < 3 THEN
    base := 'student';
  END IF;

  candidate := base;

  WHILE NOT is_username_available(candidate) LOOP
    attempts := attempts + 1;
    EXIT WHEN attempts > 60;
    suffix    := lpad(floor(random() * 10000)::int::text, 4, '0');
    candidate := left(base, 20 - length(suffix) - 1) || '.' || suffix;
  END LOOP;

  RETURN candidate;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 8. Three suggestions for the onboarding UI
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION suggest_usernames(p_name TEXT, p_university_id UUID DEFAULT NULL)
RETURNS TEXT[] AS $$
DECLARE
  out_arr   TEXT[] := '{}';
  base      TEXT;
  uni_slug  TEXT;
  candidate TEXT;
BEGIN
  base := trim(both '.' from regexp_replace(lower(coalesce(p_name,'student')), '[^a-z0-9]+', '.', 'g'));
  base := left(base, 12);
  base := trim(both '.' from base);
  IF length(base) < 3 THEN base := 'student'; END IF;

  -- campus abbreviation gives us a huge amount of fresh namespace
  SELECT lower(regexp_replace(split_part(domain, '.', 1), '[^a-z0-9]', '', 'g'))
    INTO uni_slug FROM universities WHERE id = p_university_id;

  -- 1. plain
  IF is_username_available(base) THEN out_arr := out_arr || base; END IF;

  -- 2. with campus
  IF uni_slug IS NOT NULL THEN
    candidate := left(base || '_' || uni_slug, 20);
    IF is_username_available(candidate) THEN out_arr := out_arr || candidate; END IF;
  END IF;

  -- 3. first initial + surname
  candidate := regexp_replace(base, '^([a-z])[a-z0-9]*\.', '\1', '');
  IF candidate <> base AND is_username_available(candidate) THEN
    out_arr := out_arr || candidate;
  END IF;

  -- top up with random suffixes until we have 3
  WHILE array_length(out_arr, 1) IS NULL OR array_length(out_arr, 1) < 3 LOOP
    candidate := generate_username(p_name);
    IF NOT (candidate = ANY(out_arr)) THEN out_arr := out_arr || candidate; END IF;
  END LOOP;

  RETURN out_arr[1:3];
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 9. Search
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_users(
  p_query   TEXT,
  p_viewer  UUID DEFAULT NULL,
  p_limit   INT  DEFAULT 20
)
RETURNS TABLE (
  id UUID, username TEXT, full_name TEXT, avatar_url TEXT,
  university_name VARCHAR, is_same_campus BOOLEAN, rank REAL
) AS $$
DECLARE
  q          TEXT := lower(trim(p_query));
  viewer_uni UUID;
BEGIN
  SELECT university_id INTO viewer_uni FROM users WHERE users.id = p_viewer;

  RETURN QUERY
  SELECT u.id, u.username, u.full_name, u.avatar_url,
         un.name AS university_name,
         (u.university_id = viewer_uni) AS is_same_campus,
         GREATEST(
           similarity(u.username,  q),
           similarity(coalesce(u.full_name,''), q)
         ) AS rank
  FROM users u
  JOIN universities un ON un.id = u.university_id
  WHERE u.username IS NOT NULL
    AND (u.username LIKE q || '%'                    -- prefix (indexed, fast)
         OR u.username %  q                          -- fuzzy
         OR coalesce(u.full_name,'') % q)
  ORDER BY
    (u.username = q) DESC,                           -- exact match first
    (u.university_id = viewer_uni) DESC,             -- own campus next
    rank DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
```

### Why each piece looks the way it does

**`CREATE UNIQUE INDEX users_username_key`** — a unique index does two jobs at once. It stops duplicates, *and* it's the index Postgres uses for `WHERE username = 'rahul'`. You don't need a second index for lookups.

**Why `text_pattern_ops` is a separate index.** Postgres sorts text according to your database's language collation (which handles things like "does á come before b"). `LIKE 'rah%'` needs plain byte-order sorting to use an index. `text_pattern_ops` builds that second ordering. Without it, `LIKE 'rah%'` scans every row.

**Why reserved usernames are a table, not a hardcoded list.** When Neeraj adds `/events` to the website six months from now, he messages you and you run one `INSERT`. No code change, no redeploy. If it were a JavaScript array, the reserved list would live in the backend and the DB could still accept `events` through any other path.

**Why the trigger and not a CHECK constraint.** A `CHECK` constraint in Postgres cannot query another table — it can only look at the row being inserted. Checking against `reserved_usernames` requires a `SELECT`, so it has to be a trigger.

**Why `SECURITY DEFINER` on `is_username_available`.** It means the function runs with the permissions of whoever *created* it, not whoever calls it. Your signup flow needs to check availability before the user is fully authenticated, so the caller may not have permission to read `users`. `SECURITY DEFINER` lets the function do it on their behalf, while only ever returning a boolean — it never leaks who owns the handle.

**Why the generated suffix is random, not sequential.** `rahul.0001, rahul.0002` tells anyone who looks roughly how many users you have, and creates a hotspot where every new "rahul" has to scan the same range. `rahul.7402` gives away nothing.

---

## 1.3 Migration: `003_username_backfill.sql`

Existing users have `username = NULL`. This fills them in.

```bash
supabase migration new username_backfill
```

```sql
-- ============================================================
-- 003_username_backfill.sql
-- Assigns a username to every existing user.
-- ============================================================

DO $$
DECLARE
  r RECORD;
  new_username TEXT;
BEGIN
  FOR r IN SELECT id, full_name FROM users
           WHERE username IS NULL AND is_profile_complete = true LOOP
    new_username := generate_username(coalesce(r.full_name, 'student'));
    UPDATE users SET username = new_username WHERE id = r.id;
  END LOOP;
END $$;

-- NOW it is safe to require a username on completed profiles.
ALTER TABLE users ADD CONSTRAINT users_username_required_when_complete CHECK (
  is_profile_complete = false OR username IS NOT NULL
);
```

> ### ⚠️ Read this part carefully — it's the subtlest thing in the whole plan
>
> You might expect to write this instead, as a single statement:
>
> ```sql
> UPDATE users SET username = generate_username(full_name) WHERE username IS NULL;  -- WRONG
> ```
>
> This **fails**, and understanding why matters.
>
> A single SQL statement sees a snapshot of the table as it was when the statement started. Rows it writes are not visible to itself while it runs. So if two students are both named "Rahul Sharma", `generate_username` is called twice, and *both* times it looks at the old snapshot where `rahul.sharma` is free. It returns `rahul.sharma` twice. The unique index then rejects the entire statement, and every row is rolled back — including the thousands that were fine.
>
> The `DO $$ ... LOOP` version issues one `UPDATE` per row. Each `UPDATE` completes before the next iteration begins, so iteration 2 *can* see what iteration 1 wrote. It correctly returns `rahul.sharma.7402` for the second student.
>
> **This is a general lesson, not a username-specific one:** whenever a generated value depends on values you're writing in the same operation, you must loop, not batch.

**Verify before moving on:**

```sql
SELECT count(*) FROM users WHERE username IS NULL;                -- expect 0
SELECT count(*) FROM (SELECT username FROM users GROUP BY username HAVING count(*) > 1) d;  -- expect 0
```

---

## 1.4 Signup flow change

Your current `verify-otp` creates a `users` row with `full_name = NULL` and `is_profile_complete = false`. There's no name to derive a handle from yet.

**The rule:** username stays `NULL` until onboarding. The `users_username_required_when_complete` constraint (from 1.2) guarantees nobody can finish onboarding without one. The database enforces this, so a bug in either client can't produce a user without a handle.

Change to `backend/src/modules/auth/auth.controller.js`:

- In `onboarding`, before saving: call `is_username_available(username, userId)`. If false → `400 USERNAME_TAKEN`.
- Wrap the save in a `try/catch`. If Postgres returns error code `23505` (unique violation) → also return `400 USERNAME_TAKEN`. **This catch is what actually protects you against the race condition.** The availability check is only a nicety for the UI.

```js
// backend/src/modules/auth/auth.controller.js
try {
  const { data, error } = await supabase
    .from('users')
    .update({ username: username.toLowerCase().trim(), /* ...other fields */ })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'USERNAME_TAKEN', message: 'That username was just taken. Try another.' });
    }
    if (error.message?.includes('USERNAME_RESERVED')) {
      return res.status(400).json({ error: 'USERNAME_RESERVED', message: 'That username is not available.' });
    }
    throw error;
  }
  return res.json({ user: data });
} catch (err) { /* 500 */ }
```

---

## 1.5 Backend endpoints — 🧑‍💻 **NEERAJ BUILDS THIS**

> **Owner: Neeraj.** The `user` module. Vishwajeet has already created the stub files and registered the route mount in Phase 0 — you only fill in `user.routes.js` and `user.controller.js`.
>
> **Start only after Handoff A.** These endpoints call the DB functions from §1.2, which don't exist until migration 002 is applied.
>
> Read §1.1 and §1.2 first, even though you're not writing the SQL. You need to know that `is_username_available()` already checks format, reserved words, existing handles and the cooling-off window — so your controller calls one RPC rather than four queries.
>
> Run the §0.5.4 security checklist before opening your PR.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/users/username-available?username=` | optional | Live check while typing |
| `GET` | `/api/users/username-suggestions?name=` | optional | 3 suggestions for onboarding |
| `GET` | `/api/users/by-username/:username` | optional | Load a profile page |
| `GET` | `/api/users/search?q=&limit=` | required | User search |
| `PATCH` | `/api/users/me/username` | required | Change handle (max 1 per 30 days) |

**Response shapes — write these into `backend/API.md` exactly:**

```
GET /api/users/username-available?username=rahul
200 { "available": false, "reason": "TAKEN", "suggestions": ["rahul.7402","rahul_iiitk","r.sharma"] }
200 { "available": true }
    reason ∈ "TAKEN" | "RESERVED" | "INVALID_FORMAT" | "RECENTLY_RELEASED"

GET /api/users/by-username/rahul
200 {
  "user": {
    "id": "uuid", "username": "rahul", "full_name": "Rahul Sharma",
    "avatar_url": "https://...", "bio": "...",
    "university": { "id": "uuid", "name": "IIITDM Kurnool" },
    "course": "B.Tech", "specialization": "CSE", "year_of_study": "3rd",
    "followers_count": 0, "following_count": 0,
    "is_private": false,
    "created_at": "2026-03-01T..."
  },
  "viewer": { "is_self": false, "is_following": false, "follow_status": null, "is_blocked": false }
}
301-style redirect case:
200 { "redirect_to": "rahul.sharma" }      ← old handle, still within the 30-day window
404 { "error": "USER_NOT_FOUND" }

PATCH /api/users/me/username
Body: { "username": "rahul.sharma" }
200  { "user": { ... } }
400  { "error": "USERNAME_TAKEN" | "USERNAME_RESERVED" | "INVALID_FORMAT" }
429  { "error": "RATE_LIMITED", "next_allowed_at": "2026-09-06T..." }
```

The `redirect_to` case is what makes old shared links keep working. If someone posted `yahora.com/rahul` in a WhatsApp group and Rahul later became `rahul.sharma`, the backend looks in `username_history`, finds it, and tells the client where to go.

**Rate limit for username changes** — in the `PATCH` handler:

```js
if (user.username_changed_at &&
    Date.now() - new Date(user.username_changed_at) < 30 * 24 * 60 * 60 * 1000) {
  return res.status(429).json({
    error: 'RATE_LIMITED',
    next_allowed_at: new Date(new Date(user.username_changed_at).getTime() + 30*24*60*60*1000)
  });
}
```

---

## 1.6 While you're in the backend — fix three real bugs

I found these when I read your code. They're security holes, not style issues, and Phase 1 is the right time because you're already in these files.

**Bug 1 — anyone can edit anyone's listing.** `updateProduct` in `products.controller.js` takes an `id` from the URL and updates it with no check that the requester owns it.

```js
// add to updateProduct AND deleteProduct
const { data: existing } = await supabase
  .from('products').select('seller_id').eq('id', id).single();
if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });
if (existing.seller_id !== req.user.id) {
  return res.status(403).json({ error: 'FORBIDDEN' });
}
```

**Bug 2 — likes and saves cross campus boundaries.** `toggleLikeProduct` never checks that the product belongs to the liker's campus. Your product rule is browse-only across campuses, but the API allows interaction.

```js
const { data: product } = await supabase
  .from('products').select('university_id').eq('id', product_id).single();
const { data: me } = await supabase
  .from('users').select('university_id').eq('id', req.user.id).single();
if (product.university_id !== me.university_id) {
  return res.status(403).json({ error: 'CROSS_CAMPUS_INTERACTION_BLOCKED' });
}
```

**Bug 3 — the storage bucket is open to the public.** Your policy is `TO public WITH CHECK (bucket_id = 'products')`. Anyone on the internet can upload into your bucket. Tighten it in a migration:

```sql
DROP POLICY IF EXISTS "Allow product uploads" ON storage.objects;
CREATE POLICY "Authenticated product uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products' AND owner = auth.uid());
```

---

## Phase 1 — Definition of done

- [ ] Migrations `002` and `003` written, tested with `supabase db reset`, pushed
- [ ] `SELECT count(*) FROM users WHERE username IS NULL` returns 0
- [ ] No duplicate usernames
- [ ] All five endpoints implemented and manually tested (Postman/curl)
- [ ] `23505` handling verified — try to take a username twice, confirm a clean 400
- [ ] Reserved word rejected — try `/api/users/username-available?username=admin`
- [ ] `backend/API.md` updated
- [ ] Three security bugs fixed
- [ ] `seedDemo.js` updated to give demo users realistic handles

### 🔀 HANDOFF A → Neeraj (this unblocks his Phase 2)

Post to `docs/CHANGELOG.md` and message him:

> **Phase 1 done — usernames are live.**
>
> **Migrations:** 002_usernames, 003_username_backfill. Pull main and read `supabase/migrations/`.
>
> **Every user object returned by the API now includes `username`.** It is never null for a user with `is_profile_complete = true`.
>
> **New endpoints** — full shapes in `backend/API.md` §5:
> - `GET /api/users/username-available?username=`
> - `GET /api/users/username-suggestions?name=`
> - `GET /api/users/by-username/:username`
> - `GET /api/users/search?q=`
> - `PATCH /api/users/me/username`
>
> **Important for your routing:** `/:username` must be the **last** route in `App.jsx`, after every other route. Any new top-level route you add from now on must ALSO be inserted into the `reserved_usernames` table — message me and I'll run the insert. Don't add routes silently or someone will register that handle and break the page.
>
> **`by-username` can return `{ "redirect_to": "newhandle" }`** instead of a user. Handle that case — navigate to the new URL. This is how old shared links survive a username change.
>
> **Onboarding now requires a username.** The DB will reject a completed profile without one, so the field can't be optional in your form.
>
> **What NOT to do yet:** don't build follow buttons or private-account UI. `followers_count` and `is_private` don't exist on the user object until Handoff B.


---

# PHASE 2 — Usernames: UI

**Who:** Vishwajeet (mobile) and Neeraj (web) — **PARALLEL, work at the same time**
**Estimated:** 3 days
**Prerequisite:** Handoff A posted

Both of you build the same feature set on your own surface. Same endpoints, same behaviour, different code.

---

## 2.1 Onboarding — the username step

This is the most important screen in the phase, because a bad experience here means students pick a handle they regret and immediately want to change.

**The flow:**

1. Student enters their full name (this step already exists)
2. Immediately call `GET /api/users/username-suggestions?name=Rahul%20Sharma`
3. Show the three suggestions as tappable chips, plus a text field pre-filled with the first one
4. As they type in the field, check availability — **debounced by 400ms**
5. Show live state under the field: spinner → green tick "rahul is available" → red "taken, try rahul.7402"
6. Continue button is disabled until the state is green

**On debouncing** — this is the concept that makes the whole thing feel good. If you fire a request on every keystroke, typing "rahulsharma" sends 11 requests. They arrive out of order, so the answer for "rahul" might land after the answer for "rahulsharma" and overwrite it with the wrong result. Debouncing means: wait until the user has stopped typing for 400ms, *then* send one request.

```js
// The idea, in plain JavaScript
let timer;
function onUsernameChange(value) {
  setUsername(value);
  setStatus('checking');
  clearTimeout(timer);                    // cancel the previous pending check
  timer = setTimeout(() => {
    checkAvailability(value);             // only runs if 400ms passed with no typing
  }, 400);
}
```

Also **discard stale responses**. Keep a counter; when a response comes back, ignore it if it isn't the newest request. Otherwise a slow early response can overwrite a fast later one.

**UX details that matter:**

- Force lowercase as they type — don't reject a capital letter with an error, just convert it silently
- Strip spaces and convert to `.` as they type
- Show the character counter (`8/20`) once they pass 15
- Show what the URL will look like: `yahora.com/rahul` — this makes the concept concrete
- Tell them clearly: "You can change this once every 30 days"

---

## 2.2 The profile route

**Web (Neeraj):** in `App.jsx`, add the catch-all route **at the very bottom**, after every other route:

```jsx
<Routes>
  {/* ...all existing routes... */}
  <Route path="/settings" element={<Settings />} />
  <Route path="/community" element={<Community />} />

  {/* MUST BE LAST — matches anything not matched above */}
  <Route path="/:username" element={<Profile />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

React Router matches top to bottom. If `/:username` is above `/settings`, then visiting `/settings` loads a profile page for a user called "settings".

Also: `/user/:id` should not be deleted. Keep it and make it redirect — look up the user, then `navigate('/' + user.username, { replace: true })`. Any link already shared in the world still works.

**Mobile (Vishwajeet):** rename `app/profile/[id].tsx` → `app/profile/[username].tsx` and fetch via `by-username`. Deep links (`yahora://rahul` and `https://yahora.com/rahul`) need the same handling in `app.json` under `scheme` and `associatedDomains` / `intentFilters`.

**Both:** handle the `redirect_to` response. If the API returns `{ "redirect_to": "rahul.sharma" }`, navigate there and replace history — don't push, or the back button gets stuck in a loop.

---

## 2.3 Every place the username has to appear

Work through this list. It's easy to miss one and end up with a profile you can't navigate to from half the app.

| Location | Web file | Mobile file | What changes |
|---|---|---|---|
| Navbar / account menu | `components/Navbar` | `(tabs)/_layout` | Show `@handle` under the name |
| Product card | `components/ProductCard` | `components/ProductCard` | Seller name links to `/handle` |
| Product detail — seller block | `pages/marketplace/ProductDetail.jsx` | *(no PDP yet on mobile)* | Name + `@handle`, tappable |
| Product detail — comments | same | — | Commenter name links to profile |
| Messages inbox | `pages/messages/Messages.jsx` | `(tabs)/messages.tsx` | `@handle` under contact name |
| Chat header | same | same | Tappable → profile |
| Dashboard | `pages/dashboard/Dashboard.jsx` | `(tabs)/profile.tsx` | Show own handle, link to change it |
| Public profile | `pages/profile/PublicProfile.jsx` | `profile/[username].tsx` | Handle in header, share button copies the URL |
| Onboarding | `pages/onboarding/Onboarding.jsx` | `(auth)/onboarding.tsx` | New step (§2.1) |
| Settings | *(new)* | `edit-profile.tsx` | Change-username form |

**Design guidance for the handle.** Display name is primary, handle is secondary — bigger/darker name, smaller/grey `@handle` beneath or beside it. Always prefix with `@` in the UI even though it isn't stored with one; that's what makes it read as a handle rather than a nickname.

---

## 2.4 Change-username screen

- Text field, same debounced check as onboarding
- If they're inside the 30-day window: show the field disabled with "You can change your username again on 6 September 2026"
- Warn before saving: "Anyone who has your old link `yahora.com/rahul` will be redirected for 30 days, then it becomes available to others."
- Handle `429` from the API even though the UI should have prevented it

---

## 2.5 User search

- A search field that hits `GET /api/users/search?q=`
- Debounced 300ms
- Results show avatar, name, `@handle`, and a campus chip
- Same-campus users appear first (the backend already sorts this way)
- Empty state: "No students found" — never a blank screen

---

## Phase 2 — Definition of done (each of you, on your own surface)

- [ ] Onboarding has a username step with 3 suggestions and live availability
- [ ] Debouncing implemented, with stale responses discarded
- [ ] `/:username` route works and is last in the route table (web) / deep links work (mobile)
- [ ] `/user/:id` redirects to the handle URL
- [ ] `redirect_to` response handled
- [ ] All 10 rows of the §2.3 table done
- [ ] Change-username screen with the 30-day lock
- [ ] User search screen

### 🔀 HANDOFF 2 — sync point

Both post to `docs/CHANGELOG.md` when done. Compare screens side by side. Fix any behaviour that differs between web and mobile before moving on — divergence here compounds later.

---

# PHASE 3 — Follows, Blocks & Private Accounts: Database & Backend

**Database (§3.1, 3.3):** Vishwajeet — **blocking**
**Backend `social` module (§3.2):** Neeraj — starts after Handoff B
**Estimated:** Vishwajeet 1 day, then Neeraj 2 days
**⚖️ Load-valve checkpoint:** at the end of this phase, both of you honestly assess whether the split is working. See §0.5.5. This is the last easy moment to move a module.

---

## 3.1 Migration: `004_follows.sql`

```bash
supabase migration new follows
```

```sql
-- ============================================================
-- 004_follows.sql
-- Follow graph, blocking, and private accounts.
-- ============================================================

-- ------------------------------------------------------------
-- 1. New columns on users
-- ------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN is_private      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN followers_count INT     NOT NULL DEFAULT 0,
  ADD COLUMN following_count INT     NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 2. The follow graph
--
-- ⚠️ DELIBERATE DESIGN DECISION: this table has NO university_id.
-- Follows are global by design — a student at IIITDM can follow a
-- student at NIET. This is the ONLY intentional gap in campus
-- isolation. Do not "fix" it. See CLAUDE.md §12.
-- ------------------------------------------------------------
CREATE TABLE follows (
  follower_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT        NOT NULL DEFAULT 'accepted'
                           CHECK (status IN ('pending','accepted')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at  TIMESTAMPTZ,
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);

-- "Who follows me?" and "who is waiting for approval?"
CREATE INDEX follows_following_idx ON follows (following_id, status, created_at DESC);
-- "Who do I follow?"
CREATE INDEX follows_follower_idx  ON follows (follower_id,  status, created_at DESC);

-- ------------------------------------------------------------
-- 3. Blocking
-- ------------------------------------------------------------
CREATE TABLE blocks (
  blocker_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX blocks_blocked_idx ON blocks (blocked_id);

-- ------------------------------------------------------------
-- 4. Follow counters (only 'accepted' follows count)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'accepted' THEN
    UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    UPDATE users SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE users SET followers_count = followers_count + 1 WHERE id = NEW.following_id;

  ELSIF TG_OP = 'DELETE' AND OLD.status = 'accepted' THEN
    UPDATE users SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    UPDATE users SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_follow_counts
  AFTER INSERT OR UPDATE OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- ------------------------------------------------------------
-- 5. The database decides pending vs accepted — not the client
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION prepare_follow()
RETURNS TRIGGER AS $$
BEGIN
  -- refuse if either party has blocked the other
  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = NEW.following_id AND blocked_id = NEW.follower_id)
       OR (blocker_id = NEW.follower_id  AND blocked_id = NEW.following_id)
  ) THEN
    RAISE EXCEPTION 'BLOCKED' USING ERRCODE = '23514';
  END IF;

  -- private target -> request; public target -> instant follow
  IF (SELECT is_private FROM users WHERE id = NEW.following_id) THEN
    NEW.status      := 'pending';
    NEW.accepted_at := NULL;
  ELSE
    NEW.status      := 'accepted';
    NEW.accepted_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prepare_follow
  BEFORE INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION prepare_follow();

-- ------------------------------------------------------------
-- 6. Blocking removes follows in both directions
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_block_side_effects()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM follows
   WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
      OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_block
  AFTER INSERT ON blocks
  FOR EACH ROW EXECUTE FUNCTION apply_block_side_effects();

-- ------------------------------------------------------------
-- 7. Going public auto-accepts everyone waiting
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_privacy_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_private = true AND NEW.is_private = false THEN
    UPDATE follows SET status = 'accepted', accepted_at = now()
     WHERE following_id = NEW.id AND status = 'pending';
  END IF;
  -- Going private KEEPS existing followers (Instagram behaviour).
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_privacy_change
  AFTER UPDATE OF is_private ON users
  FOR EACH ROW EXECUTE FUNCTION handle_privacy_change();

-- ------------------------------------------------------------
-- 8. The one function every read path calls
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_view_social_content(p_viewer UUID, p_target UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_viewer IS NULL  THEN RETURN NOT (SELECT is_private FROM users WHERE id = p_target); END IF;
  IF p_viewer = p_target THEN RETURN TRUE; END IF;

  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = p_target AND blocked_id = p_viewer)
       OR (blocker_id = p_viewer AND blocked_id = p_target)
  ) THEN RETURN FALSE; END IF;

  IF NOT (SELECT is_private FROM users WHERE id = p_target) THEN RETURN TRUE; END IF;

  RETURN EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = p_viewer AND following_id = p_target AND status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Cheap helper used in feed queries
CREATE OR REPLACE FUNCTION is_blocked_pair(p_a UUID, p_b UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = p_a AND blocked_id = p_b)
       OR (blocker_id = p_b AND blocked_id = p_a)
  );
$$ LANGUAGE sql STABLE;
```

### Why the trigger sets `status`, not the backend

This is worth understanding, because it's a pattern you'll reuse.

If the backend decided pending-vs-accepted, then the web client and the mobile client would each need that logic, and the moment one of them is out of date they disagree. Worse, a bug could let someone follow a private account instantly.

By putting it in a `BEFORE INSERT` trigger, the rule lives in exactly one place. Both clients just say "insert a follow" and the database decides what that means. **Rules that must never be wrong belong in the database, not the application.**

### The counter contention note

`UPDATE users SET followers_count = followers_count + 1` locks that user's row for the duration. If one student gained 500 followers per second, those updates would queue up. At your scale this will never happen — but it is worth recognising if it ever does. The fix, when needed: insert into a `follow_deltas` table and roll up on a schedule.

---

## 3.2 Backend endpoints — 🧑‍💻 **NEERAJ BUILDS THIS**

> **Owner: Neeraj.** The `social` module.
>
> **The single most important thing to understand before you start:** almost every rule in this feature is enforced by a database trigger, not by your code. Your controller for `POST /follow` is roughly *"insert a row into `follows`"* — the `trg_prepare_follow` trigger decides whether that becomes `pending` or `accepted`, and refuses outright if either party has blocked the other.
>
> This is deliberate (see §0.5.4). It means you cannot get the privacy rules wrong, because they aren't your decision. **Do not re-implement these checks in JavaScript** — if your code and the trigger ever disagree, you get a bug nobody can find.
>
> What your code IS responsible for: reading the trigger's outcome back and returning the right status; calling `can_view_social_content()` before returning any list; cursor pagination; calling `notify()`; and mapping trigger exceptions through `mapDbError()`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/users/:id/follow` | Follow / request to follow |
| `DELETE` | `/api/users/:id/follow` | Unfollow / cancel request |
| `GET` | `/api/users/:id/followers?cursor=&limit=` | Follower list |
| `GET` | `/api/users/:id/following?cursor=&limit=` | Following list |
| `GET` | `/api/users/me/follow-requests` | Pending requests on my account |
| `POST` | `/api/users/me/follow-requests/:followerId/accept` | Approve |
| `DELETE` | `/api/users/me/follow-requests/:followerId` | Reject |
| `POST` | `/api/users/:id/block` | Block |
| `DELETE` | `/api/users/:id/block` | Unblock |
| `GET` | `/api/users/me/blocks` | Blocked list |
| `PATCH` | `/api/users/me/privacy` | Toggle private |

**Key response shapes:**

```
POST /api/users/:id/follow
200 { "status": "accepted" }     ← public account, now following
200 { "status": "pending"  }     ← private account, request sent
403 { "error": "BLOCKED" }
400 { "error": "CANNOT_FOLLOW_SELF" }

GET /api/users/:id/followers?cursor=2026-08-01T10:00:00Z&limit=30
200 {
  "users": [ { "id","username","full_name","avatar_url",
               "university_name","is_following": bool } ],
  "next_cursor": "2026-07-28T14:22:11Z"   // null when there are no more
}
403 { "error": "PRIVATE_ACCOUNT" }        ← viewer can't see this list
```

### Use cursor pagination, not page numbers

**This matters and it's worth understanding properly.**

The obvious way to paginate is `LIMIT 30 OFFSET 60` for page 3. Two problems:

1. **It gets slower the deeper you go.** `OFFSET 100000` makes Postgres find and discard 100,000 rows before returning anything.
2. **Rows shift under you.** If someone follows Rahul while you're on page 1, everything moves down by one, and page 2 shows you a row you already saw on page 1 — or skips one entirely.

Cursor pagination instead says "give me the next 30 items *created before this timestamp*":

```sql
SELECT ... FROM follows
WHERE following_id = $1 AND status = 'accepted'
  AND ($2::timestamptz IS NULL OR created_at < $2)   -- $2 is the cursor
ORDER BY created_at DESC
LIMIT 30;
```

The index `follows_following_idx (following_id, status, created_at DESC)` serves this directly. It's the same speed on item 1 and item 100,000, and new rows never cause duplicates.

Use cursor pagination for **every** list in this project: followers, following, feeds, replies, notifications, search.

### Privacy checks in the backend

Before returning a follower/following list, or a profile's posts:

```js
const { data: allowed } = await supabase
  .rpc('can_view_social_content', { p_viewer: req.user?.id ?? null, p_target: targetId });
if (!allowed) return res.status(403).json({ error: 'PRIVATE_ACCOUNT' });
```

Note what a private profile should *still* return: username, full name, avatar, university, follower/following **counts**, and their marketplace listings. What it hides: posts, follower/following **lists**, bio, course/year. That mirrors Instagram and keeps your marketplace intact — a private seller's items are still findable and buyable.

---

## 3.3 Row Level Security — what it is and where it applies

You asked about RLS specifically, so here's the part people get wrong.

**Supabase gives you two keys:**

- The **anon key** — safe to ship inside your website and app. Every query made with it is filtered by RLS policies.
- The **service role key** — lives only on your server. It **bypasses RLS completely**. Your Express backend uses this.

So: **RLS does nothing to protect your backend routes.** Your backend can read anything. RLS protects the paths where the *client talks to Supabase directly* — which in your app means Realtime subscriptions and Storage.

That's still critical, because a student can open DevTools, take the anon key out of your JavaScript bundle, and query Supabase directly from a script. RLS is what stops that from returning another campus's data.

```sql
-- ============================================================
-- 005_rls_social.sql
-- ============================================================

ALTER TABLE follows       ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE username_history ENABLE ROW LEVEL SECURITY;

-- FOLLOWS: you may read a follow row if you're either side of it,
-- or if the followed account is public.
CREATE POLICY follows_select ON follows FOR SELECT TO authenticated
USING (
  follower_id = auth.uid()
  OR following_id = auth.uid()
  OR NOT (SELECT is_private FROM users WHERE id = follows.following_id)
);

-- You may only create a follow where YOU are the follower.
CREATE POLICY follows_insert ON follows FOR INSERT TO authenticated
WITH CHECK (follower_id = auth.uid());

-- You may delete your own follow (unfollow), or remove a follower.
CREATE POLICY follows_delete ON follows FOR DELETE TO authenticated
USING (follower_id = auth.uid() OR following_id = auth.uid());

-- Only the account owner may accept a pending request.
CREATE POLICY follows_update ON follows FOR UPDATE TO authenticated
USING (following_id = auth.uid()) WITH CHECK (following_id = auth.uid());

-- BLOCKS: completely private. Only you can see who you blocked.
CREATE POLICY blocks_select ON blocks FOR SELECT TO authenticated
USING (blocker_id = auth.uid());

CREATE POLICY blocks_insert ON blocks FOR INSERT TO authenticated
WITH CHECK (blocker_id = auth.uid());

CREATE POLICY blocks_delete ON blocks FOR DELETE TO authenticated
USING (blocker_id = auth.uid());

-- USERNAME HISTORY: readable by all (needed for redirects), writable by nobody.
CREATE POLICY username_history_select ON username_history FOR SELECT TO public USING (true);
```

> **A note on `blocks_select`.** Only the blocker can read the row. This means the blocked person can't discover they've been blocked by querying the table — which is the correct behaviour and the reason blocking works as a safety feature at all.

**Also enable RLS on your existing tables if you haven't.** Run this to check:

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;
```

Any row showing `rowsecurity = false` is readable by anyone holding your anon key.

---

## Phase 3 — Definition of done

- [ ] Migrations `004` and `005` written, `supabase db reset` runs clean, pushed
- [ ] Follow a public account → status `accepted`, counts increment
- [ ] Follow a private account → status `pending`, counts do NOT increment
- [ ] Accept the request → counts increment
- [ ] Block someone → both follow rows disappear, counts decrement
- [ ] Try to follow after being blocked → 403
- [ ] Toggle private→public → all pending requests auto-accept
- [ ] Every list endpoint uses cursor pagination
- [ ] `SELECT tablename, rowsecurity FROM pg_tables` shows `true` for every public table
- [ ] `backend/API.md` updated
- [ ] `seedDemo.js` creates follows, a private demo account, and a block

### 🔀 HANDOFF B → Neeraj

> **Phase 3 done — follows, blocks and private accounts are live.**
>
> **Migrations:** 004_follows, 005_rls_social.
>
> **BREAKING-ish:** the user object now includes `followers_count`, `following_count`, `is_private`. Nothing was removed, so existing screens keep working.
>
> **`GET /api/users/by-username/:username` now returns a `viewer` block:**
> ```json
> "viewer": {
>   "is_self": false,
>   "is_following": true,
>   "follow_status": "accepted",   // or "pending" or null
>   "is_blocked_by_me": false,
>   "can_view_content": true
> }
> ```
> Drive your Follow button entirely off `follow_status`. Three states: `null` → "Follow", `"pending"` → "Requested", `"accepted"` → "Following".
>
> **When `can_view_content` is false**, render the private-account state: show name, handle, avatar, university, follower counts, and their marketplace listings — hide posts, bio, and the follower/following lists.
>
> **All 11 new endpoints in `API.md` §6.**
>
> **Every list is cursor-paginated.** Send `?cursor=` from the previous response's `next_cursor`. `next_cursor: null` means you've reached the end. Do not use page numbers.
>
> **What NOT to do yet:** don't build a notifications bell. Follow requests currently have no notification — that's Phase 5. Build the requests list screen (it's a plain endpoint), just don't wire a badge to it.


---

# PHASE 4 — Follows: UI

**Who:** Vishwajeet (mobile) and Neeraj (web) — **PARALLEL**
**Estimated:** 3 days
**Prerequisite:** Handoff B

---

## 4.1 The Follow button — three states, plus optimistic updates

| `follow_status` | Button label | Style | On tap |
|---|---|---|---|
| `null` | **Follow** | Filled, `--purple` | `POST /follow` |
| `"pending"` | **Requested** | Outlined, grey | `DELETE /follow` (cancel) |
| `"accepted"` | **Following** | Outlined | Confirm dialog → `DELETE /follow` |

**Optimistic updates** — change the UI *before* the server responds. Tap Follow → the button changes to "Following" instantly and the follower count goes up by one. The request goes out in the background. If it fails, roll back and show a toast.

Why this matters: a follow that takes 400ms to visibly respond feels broken. Every social app does this.

```js
// TanStack Query pattern — works the same on web and mobile
const followMutation = useMutation({
  mutationFn: () => api.post(`/users/${userId}/follow`),

  onMutate: async () => {
    await queryClient.cancelQueries({ queryKey: ['user', username] });
    const previous = queryClient.getQueryData(['user', username]);

    queryClient.setQueryData(['user', username], (old) => ({
      ...old,
      followers_count: old.followers_count + 1,
      viewer: { ...old.viewer, follow_status: old.is_private ? 'pending' : 'accepted' },
    }));

    return { previous };                      // saved so we can undo
  },

  onError: (_err, _vars, context) => {
    queryClient.setQueryData(['user', username], context.previous);   // roll back
    toast.error("Couldn't follow. Try again.");
  },

  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['user', username] });  // resync with truth
  },
});
```

Optimistic updates are one of the highest-value UI patterns you'll learn on this project, and you'll reuse them for likes in Phase 7.

---

## 4.2 Screens to build

**Followers / Following lists**
- Infinite scroll using `next_cursor`
- Each row: avatar, name, `@handle`, campus chip, and a Follow button
- Tapping a row goes to `/handle`
- On your *own* followers list, each row gets a "Remove" option
- Empty state with a real sentence, not a blank screen: "No followers yet. Share your profile to get started."

**Follow requests** (only visible if `is_private`)
- List of pending requesters with Accept / Reject buttons
- Show a count badge on the entry point

**Privacy toggle** (in settings / edit profile)
- Switch labelled "Private account"
- Explanatory text underneath, and be specific: *"When your account is private, only approved followers can see your posts, bio, and follower list. **Your marketplace listings stay public so students can still buy from you.**"*
- That last sentence prevents a support question you'd otherwise get constantly

**Blocked accounts list**
- Simple list with Unblock buttons
- Reachable from settings

**Block action**
- Lives in an overflow (⋯) menu on the profile page and on each post
- Confirm dialog: "Block @rahul? They won't be able to follow you, message you, or see your posts. They won't be told."
- After blocking, navigate away from their profile

**Profile header updates**
- Follower count and following count, both tappable
- Follow button
- ⋯ menu with Block and Report
- Private state: lock icon + "This account is private" + "Follow to see their posts" — but still render the marketplace listings section

---

## 4.3 Cross-campus visual language

Because follows are global, students will now see people from other colleges. Make campus obvious wherever a person appears outside your own campus:

- A small chip next to the name: `NIET Greater Noida`
- Use `--blue-light` background for other campuses, `--pink-light` for your own — you already have these in `global.css`
- On other-campus profiles, the marketplace section shows a note: "You can browse but not buy from another campus"

---

## Phase 4 — Definition of done

- [ ] Follow button with three states and optimistic updates
- [ ] Followers and Following lists with infinite scroll
- [ ] Follow requests screen with accept/reject
- [ ] Privacy toggle with the marketplace-stays-public explanation
- [ ] Block flow + blocked accounts list
- [ ] Private profile state renders correctly (posts hidden, listings visible)
- [ ] Campus chips on out-of-campus users

### 🔀 HANDOFF 4 — sync point
Both post to `docs/CHANGELOG.md`. Compare the follow flows side by side.

---

# PHASE 5 — Notifications

**Database (§5.1):** Vishwajeet — **blocking**
**`notify()` emitter (§5.2):** Vishwajeet — it's a shared util, called from both your modules
**Read endpoints (§5.3):** Neeraj — the `notifications` module
**UI (§5.4):** both, parallel
**Estimated:** Vishwajeet 0.5 day, Neeraj 1 day, then 2 days UI each

> **Why the emitter is split from the reader.** `notify()` gets called from Neeraj's `social` module (follows) *and* Vishwajeet's `posts` module (replies, likes) *and* a database trigger (moderation). One person has to own it or you'll end up with two versions that behave differently. Vishwajeet writes it in Phase 0; both of you just call it.
>
> **This module is the load valve.** If Neeraj is behind on web UI at the Phase 3 checkpoint, these three read endpoints move to Vishwajeet — they're the most self-contained thing in the project.

---

## 5.1 Migration: `006_notifications.sql`

```sql
-- ============================================================
-- 006_notifications.sql
-- ============================================================

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- who SEES it
  actor_id    UUID          REFERENCES users(id) ON DELETE CASCADE,  -- who CAUSED it
  type        TEXT NOT NULL CHECK (type IN (
                'follow', 'follow_request', 'follow_accepted',
                'post_reply', 'post_like', 'post_mention',
                'product_comment', 'product_like',
                'moderation_action', 'system'
              )),
  entity_id   UUID,          -- the post / product / comment being referred to
  entity_type TEXT CHECK (entity_type IN ('post','product','comment','user')),
  read_at     TIMESTAMPTZ,   -- NULL means unread
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_notify CHECK (actor_id IS NULL OR user_id <> actor_id)
);

-- Main list query: newest first for one user.
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

-- Unread badge count. A PARTIAL index only stores unread rows, so it stays
-- tiny even when a user has 50,000 read notifications.
CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;

-- Stop follow/unfollow/follow spam producing three identical unread rows.
CREATE UNIQUE INDEX notifications_dedupe_idx
  ON notifications (user_id, actor_id, type,
                    coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY notifications_update ON notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### Two things worth understanding here

**Partial indexes.** `CREATE INDEX ... WHERE read_at IS NULL` builds an index containing *only* unread rows. A student with 50,000 read notifications and 3 unread ones has an index of 3 entries for the badge query. This is one of Postgres's best features and it barely exists in other databases.

**The dedupe index.** It's `UNIQUE` and partial. It means: for a given (recipient, actor, type, entity), you can only have one **unread** notification. So if someone follows, unfollows, and follows you again before you read it, you get one row, not three. The insert must therefore use `ON CONFLICT DO NOTHING`:

```js
await supabase.from('notifications')
  .insert({ user_id, actor_id, type: 'follow', entity_type: 'user', entity_id: actorId })
  .onConflict()  // Supabase: use .upsert(..., { onConflict, ignoreDuplicates: true })
```

Once the notification is read, `read_at` is set, it drops out of the partial index, and a fresh notification can be created next time.

---

## 5.2 Emitting notifications

Add an insert to these existing code paths:

| Event | `type` | `user_id` | `actor_id` | `entity_id` |
|---|---|---|---|---|
| Follow a public account | `follow` | followed | follower | follower's id |
| Request to follow private | `follow_request` | followed | follower | follower's id |
| Request approved | `follow_accepted` | requester | approver | approver's id |
| Reply to a post | `post_reply` | post author | replier | the **parent** post id |
| Like a post | `post_like` | post author | liker | post id |
| Comment on a product | `product_comment` | seller | commenter | product id |
| Post hidden by reports | `moderation_action` | post author | NULL | post id |

Write a single helper so this is one line at each call site:

```js
// backend/src/utils/notify.js
export async function notify({ userId, actorId, type, entityType, entityId }) {
  if (userId === actorId) return;                       // never notify yourself
  const { data: blocked } = await supabase.rpc('is_blocked_pair', { p_a: userId, p_b: actorId });
  if (blocked) return;                                  // blocked users generate nothing
  await supabase.from('notifications').upsert(
    { user_id: userId, actor_id: actorId, type, entity_type: entityType, entity_id: entityId },
    { onConflict: 'user_id,actor_id,type,entity_id', ignoreDuplicates: true }
  );
}
```

**Never let a failed notification break the main action.** Wrap every `notify()` call so an error is logged, not thrown — if the notification insert fails, the follow should still succeed.

---

## 5.3 Endpoints

```
GET /api/notifications?cursor=&limit=30
200 {
  "notifications": [{
    "id": "uuid", "type": "post_reply", "read_at": null,
    "created_at": "...",
    "actor": { "id","username","full_name","avatar_url" },
    "entity": { "type":"post", "id":"uuid", "preview":"first 60 chars of the post..." }
  }],
  "next_cursor": "..."
}

GET  /api/notifications/unread-count   → 200 { "count": 7 }
POST /api/notifications/mark-read      → body { "ids": ["uuid"] } or { "all": true }
```

The backend should **hydrate** the entity — the client shouldn't have to make a second request per notification to find out what post it refers to. Fetch all referenced entities in one query per type and attach them. (If you fetch them one at a time in a loop, that's the **N+1 query problem** — 30 notifications become 31 database round trips.)

---

## 5.4 Notifications UI (both surfaces, parallel)

- Bell icon in navbar (web) / tab or header icon (mobile), with an unread dot
- Poll `unread-count` every 60s, or subscribe via Supabase Realtime — polling is fine to start
- List grouped by "New" and "Earlier"
- Each row: actor avatar, sentence, relative time, entity preview
- Tapping navigates to the right place and marks that one read
- "Mark all read" action
- Unread rows have a subtle `--pink-light` background

Sentence templates:
- `follow` → **@rahul** started following you
- `follow_request` → **@rahul** requested to follow you *(with Accept/Reject inline)*
- `post_reply` → **@rahul** replied to your post
- `post_like` → **@rahul** liked your post
- `moderation_action` → Your post was hidden after multiple reports

---

# PHASE 6 — Community Feed: Database & Backend

**Database + `posts` module:** Vishwajeet
**`reports` module (§6.6, the single POST endpoint):** Neeraj — pairs with his report modal in §7.7
**Estimated:** Vishwajeet 3 days, Neeraj 0.5 day
**Neeraj during this:** building web UI for Phases 2/4/5 — he is NOT blocked
**This is the biggest phase. Read it fully before starting.**

> **Why Vishwajeet keeps the feeds.** The three feed endpoints are thin wrappers over the RPCs in §6.4, and each one uses a *different* cursor type — a timestamp for campus and following, a float `hot_score` for global-hot, epoch seconds for global-new. Getting that wrong produces a feed that silently skips or repeats posts, which is exactly the "silent failure" category that stays with the database owner.
>
> If Vishwajeet falls behind, the load valve moves `POST /api/posts` and the two like endpoints to Neeraj. **The three feed endpoints do not move.**

---

## 6.1 The design, in plain terms

**One `posts` table** holds everything: top-level posts and replies, campus posts and global posts.

- A **reply** is a post with `parent_post_id` set. Replies can't have replies (one level only).
- **`scope`** is chosen by the author at compose time: `'campus'` or `'global'`.
- **Home feed** = `WHERE university_id = mine` — shows both scopes, newest first.
- **Global feed** = `WHERE scope = 'global'` — all campuses, ranked by `hot_score`.

So a campus post is seen by your college only. A global post is seen by your college **and** everyone else. The author decides which.

**Why the global feed is ranked, not chronological.** With hundreds of colleges, a chronological global feed produces several posts per minute forever. Your post is at the top for twenty seconds, nobody sees it, nobody engages, and people stop posting. Ranking by a decaying score means good posts stay visible for hours while the firehose sits behind them.

The formula:

```
score = (likes + replies × 2 + 1) ÷ (hours_since_posted + 2)^1.5
```

Worked example:
- Post A: 10 likes, posted 1 hour ago → `11 ÷ 3^1.5` = `11 ÷ 5.196` = **2.12**
- Post B: 40 likes, posted 24 hours ago → `41 ÷ 26^1.5` = `41 ÷ 132.6` = **0.31**

Post A wins despite having a quarter of the likes, because it's fresh. That's the point — the feed stays current without being a firehose.

---

## 6.2 Migration: `007_community.sql`

```sql
-- ============================================================
-- 007_community.sql
-- Community posts: two feeds, replies, likes, moderation.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Reshape the posts table
-- ------------------------------------------------------------
ALTER TABLE posts
  DROP COLUMN image_url,
  ADD COLUMN image_urls        TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN scope             TEXT    NOT NULL DEFAULT 'campus'
                                       CHECK (scope IN ('campus','global')),
  ADD COLUMN parent_post_id    UUID    REFERENCES posts(id) ON DELETE CASCADE,
  ADD COLUMN likes_count       INT     NOT NULL DEFAULT 0,
  ADD COLUMN replies_count     INT     NOT NULL DEFAULT 0,
  ADD COLUMN report_count      INT     NOT NULL DEFAULT 0,
  ADD COLUMN hot_score         DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN moderation_status TEXT    NOT NULL DEFAULT 'active'
                                       CHECK (moderation_status IN ('active','hidden','removed')),
  ADD COLUMN edited_at         TIMESTAMPTZ;

ALTER TABLE posts ADD CONSTRAINT posts_max_3_images
  CHECK (array_length(image_urls, 1) IS NULL OR array_length(image_urls, 1) <= 3);

-- Replies are text only.
ALTER TABLE posts ADD CONSTRAINT posts_replies_no_images
  CHECK (parent_post_id IS NULL OR array_length(image_urls, 1) IS NULL);

-- One level of replies only.
CREATE OR REPLACE FUNCTION enforce_single_level_replies()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_post_id IS NOT NULL
     AND (SELECT parent_post_id FROM posts WHERE id = NEW.parent_post_id) IS NOT NULL
  THEN
    RAISE EXCEPTION 'NESTED_REPLY_NOT_ALLOWED' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_single_level_replies
  BEFORE INSERT ON posts FOR EACH ROW
  EXECUTE FUNCTION enforce_single_level_replies();

-- ------------------------------------------------------------
-- 2. Indexes — one per feed query
-- ------------------------------------------------------------

-- Home feed: my campus, top-level, visible, newest first.
CREATE INDEX posts_home_feed_idx ON posts (university_id, created_at DESC)
  WHERE parent_post_id IS NULL AND moderation_status = 'active';

-- Global feed, ranked.
CREATE INDEX posts_global_hot_idx ON posts (hot_score DESC, created_at DESC)
  WHERE scope = 'global' AND parent_post_id IS NULL AND moderation_status = 'active';

-- Global feed, "Latest" tab.
CREATE INDEX posts_global_new_idx ON posts (created_at DESC)
  WHERE scope = 'global' AND parent_post_id IS NULL AND moderation_status = 'active';

-- Replies under a post, oldest first (conversation order).
CREATE INDEX posts_replies_idx ON posts (parent_post_id, created_at ASC)
  WHERE parent_post_id IS NOT NULL;

-- A user's posts, for their profile tab.
CREATE INDEX posts_author_idx ON posts (author_id, created_at DESC)
  WHERE parent_post_id IS NULL;

-- ------------------------------------------------------------
-- 3. Post likes
-- ------------------------------------------------------------
CREATE TABLE post_likes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX post_likes_post_idx ON post_likes (post_id);

CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_likes_count
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- ------------------------------------------------------------
-- 4. Reply counter
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_post_replies_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_post_id IS NOT NULL THEN
    UPDATE posts SET replies_count = replies_count + 1 WHERE id = NEW.parent_post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_post_id IS NOT NULL THEN
    UPDATE posts SET replies_count = GREATEST(replies_count - 1, 0) WHERE id = OLD.parent_post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_replies_count
  AFTER INSERT OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_post_replies_count();

-- ------------------------------------------------------------
-- 5. Rate limiting and sanctions
-- ------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN posting_restricted_until TIMESTAMPTZ,
  ADD COLUMN is_suspended             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN suspension_reason        TEXT;

CREATE OR REPLACE FUNCTION check_post_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent     INT;
  restricted TIMESTAMPTZ;
  suspended  BOOLEAN;
BEGIN
  SELECT posting_restricted_until, is_suspended
    INTO restricted, suspended
    FROM users WHERE id = NEW.author_id;

  IF suspended THEN
    RAISE EXCEPTION 'ACCOUNT_SUSPENDED' USING ERRCODE = '23514';
  END IF;

  IF restricted IS NOT NULL AND restricted > now() THEN
    RAISE EXCEPTION 'POSTING_RESTRICTED' USING ERRCODE = '23514';
  END IF;

  IF NEW.parent_post_id IS NULL THEN
    SELECT count(*) INTO recent FROM posts
     WHERE author_id = NEW.author_id AND parent_post_id IS NULL
       AND created_at > now() - INTERVAL '1 hour';
    IF recent >= 10 THEN
      RAISE EXCEPTION 'RATE_LIMIT_POSTS' USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT count(*) INTO recent FROM posts
     WHERE author_id = NEW.author_id AND parent_post_id IS NOT NULL
       AND created_at > now() - INTERVAL '1 hour';
    IF recent >= 30 THEN
      RAISE EXCEPTION 'RATE_LIMIT_REPLIES' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_rate_limit
  BEFORE INSERT ON posts FOR EACH ROW
  EXECUTE FUNCTION check_post_rate_limit();

-- Supporting index so the rate-limit COUNT stays fast.
CREATE INDEX posts_author_recent_idx ON posts (author_id, created_at DESC);

-- ------------------------------------------------------------
-- 6. Hot score refresh (run every 5 minutes from cron)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_global_hot_scores()
RETURNS INT AS $$
DECLARE updated INT;
BEGIN
  UPDATE posts
     SET hot_score = (likes_count + replies_count * 2 + 1)
                   / POWER(EXTRACT(EPOCH FROM (now() - created_at)) / 3600.0 + 2, 1.5)
   WHERE scope = 'global'
     AND parent_post_id IS NULL
     AND moderation_status = 'active'
     AND created_at > now() - INTERVAL '7 days';
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$ LANGUAGE plpgsql;
```

> **Why `hot_score` is a stored column and not computed in the query.** The formula depends on `now()`, so its value changes every second. Postgres cannot index something that changes on its own — so `ORDER BY (formula)` would have to compute the score for every candidate row on every request. Storing the number and refreshing it every 5 minutes means the feed query is a straight index scan. A score that's up to 5 minutes stale makes no visible difference to a human.

---

## 6.3 Migration: `008_moderation.sql`

```sql
-- ============================================================
-- 008_moderation.sql
-- ============================================================

CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','user','product','comment','message')),
  target_id   UUID NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN (
                'spam','harassment','hate_speech','sexual_content',
                'violence','impersonation','misinformation',
                'self_harm','prohibited_item','other')),
  details     TEXT CHECK (details IS NULL OR length(details) <= 500),
  status      TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','reviewed','actioned','dismissed')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- one report per person per item
  UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX reports_open_idx   ON reports (created_at DESC) WHERE status = 'open';
CREATE INDEX reports_target_idx ON reports (target_type, target_id);

-- ------------------------------------------------------------
-- Auto-hide at 3 unique reports
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION apply_report_threshold()
RETURNS TRIGGER AS $$
DECLARE
  total     INT;
  author    UUID;
  THRESHOLD CONSTANT INT := 3;
BEGIN
  IF NEW.target_type <> 'post' THEN RETURN NULL; END IF;

  SELECT count(*) INTO total FROM reports
   WHERE target_type = 'post' AND target_id = NEW.target_id;

  UPDATE posts SET report_count = total WHERE id = NEW.target_id;

  IF total >= THRESHOLD THEN
    UPDATE posts
       SET moderation_status = 'hidden'
     WHERE id = NEW.target_id AND moderation_status = 'active'
    RETURNING author_id INTO author;

    IF author IS NOT NULL THEN
      INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
      VALUES (author, NULL, 'moderation_action', 'post', NEW.target_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_report_threshold
  AFTER INSERT ON reports FOR EACH ROW
  EXECUTE FUNCTION apply_report_threshold();

-- ------------------------------------------------------------
-- Banned words (Hinglish + English + regional)
-- ------------------------------------------------------------
CREATE TABLE banned_terms (
  term       TEXT PRIMARY KEY,
  severity   TEXT NOT NULL DEFAULT 'block' CHECK (severity IN ('block','flag')),
  language   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 'block' rejects the post outright. 'flag' lets it through but marks it
-- for review. Populate this yourselves — English wordlists miss Hinglish
-- slurs written in Latin script, which is the actual problem in Indian
-- campus apps.

CREATE OR REPLACE FUNCTION contains_banned_term(p_text TEXT, p_severity TEXT DEFAULT 'block')
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM banned_terms
    WHERE severity = p_severity
      AND lower(p_text) ~* ('\m' || term || '\M')     -- \m \M = word boundaries
  );
$$ LANGUAGE sql STABLE;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports    ENABLE ROW LEVEL SECURITY;

CREATE POLICY posts_select ON posts FOR SELECT TO authenticated
USING (
  moderation_status = 'active'
  AND (
    scope = 'global'
    OR university_id = (SELECT university_id FROM users WHERE id = auth.uid())
  )
  AND NOT is_blocked_pair(auth.uid(), posts.author_id)
  AND can_view_social_content(auth.uid(), posts.author_id)
);

CREATE POLICY posts_insert ON posts FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND university_id = (SELECT university_id FROM users WHERE id = auth.uid())
);

CREATE POLICY posts_update_own ON posts FOR UPDATE TO authenticated
USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

CREATE POLICY posts_delete_own ON posts FOR DELETE TO authenticated
USING (author_id = auth.uid());

CREATE POLICY post_likes_all ON post_likes FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY reports_insert ON reports FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

CREATE POLICY reports_select_own ON reports FOR SELECT TO authenticated
USING (reporter_id = auth.uid());
```

> **On deletion.** Notice there is no `DELETE` anywhere in the moderation flow. A removed post keeps its row with `moderation_status = 'removed'`. You will want this if a college administration ever contacts you about something a student posted. Never hard-delete user content.

---

## 6.4 Feed query functions

```sql
-- ============================================================
-- 009_feed_functions.sql
-- ============================================================

CREATE OR REPLACE FUNCTION get_campus_feed(
  p_viewer UUID,
  p_limit  INT         DEFAULT 20,
  p_cursor TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID, content VARCHAR, image_urls TEXT[], scope TEXT,
  created_at TIMESTAMPTZ, likes_count INT, replies_count INT,
  author_id UUID, author_username TEXT, author_name VARCHAR, author_avatar TEXT,
  author_university VARCHAR, viewer_has_liked BOOLEAN
) AS $$
DECLARE viewer_uni UUID;
BEGIN
  SELECT university_id INTO viewer_uni FROM users WHERE users.id = p_viewer;

  RETURN QUERY
  SELECT p.id, p.content, p.image_urls, p.scope, p.created_at,
         p.likes_count, p.replies_count,
         u.id, u.username, u.full_name, u.avatar_url, un.name,
         EXISTS (SELECT 1 FROM post_likes pl
                  WHERE pl.post_id = p.id AND pl.user_id = p_viewer)
  FROM posts p
  JOIN users u        ON u.id  = p.author_id
  JOIN universities un ON un.id = u.university_id
  WHERE p.university_id    = viewer_uni
    AND p.parent_post_id  IS NULL
    AND p.moderation_status = 'active'
    AND NOT is_blocked_pair(p_viewer, p.author_id)
    AND (p_cursor IS NULL OR p.created_at < p_cursor)
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;


CREATE OR REPLACE FUNCTION get_global_feed(
  p_viewer UUID,
  p_sort   TEXT DEFAULT 'hot',     -- 'hot' | 'new'
  p_limit  INT  DEFAULT 20,
  p_cursor DOUBLE PRECISION DEFAULT NULL   -- hot_score for 'hot', epoch seconds for 'new'
)
RETURNS TABLE (
  id UUID, content VARCHAR, image_urls TEXT[], created_at TIMESTAMPTZ,
  likes_count INT, replies_count INT, hot_score DOUBLE PRECISION,
  author_id UUID, author_username TEXT, author_name VARCHAR, author_avatar TEXT,
  author_university VARCHAR, viewer_has_liked BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.content, p.image_urls, p.created_at,
         p.likes_count, p.replies_count, p.hot_score,
         u.id, u.username, u.full_name, u.avatar_url, un.name,
         EXISTS (SELECT 1 FROM post_likes pl
                  WHERE pl.post_id = p.id AND pl.user_id = p_viewer)
  FROM posts p
  JOIN users u         ON u.id  = p.author_id
  JOIN universities un ON un.id = u.university_id
  WHERE p.scope            = 'global'
    AND p.parent_post_id  IS NULL
    AND p.moderation_status = 'active'
    AND NOT is_blocked_pair(p_viewer, p.author_id)
    AND (
      p_cursor IS NULL
      OR (p_sort = 'hot' AND p.hot_score < p_cursor)
      OR (p_sort = 'new' AND EXTRACT(EPOCH FROM p.created_at) < p_cursor)
    )
  ORDER BY
    CASE WHEN p_sort = 'hot' THEN p.hot_score END DESC NULLS LAST,
    p.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;


CREATE OR REPLACE FUNCTION get_following_feed(
  p_viewer UUID,
  p_limit  INT         DEFAULT 20,
  p_cursor TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID, content VARCHAR, image_urls TEXT[], scope TEXT, created_at TIMESTAMPTZ,
  likes_count INT, replies_count INT,
  author_id UUID, author_username TEXT, author_name VARCHAR, author_avatar TEXT,
  author_university VARCHAR, viewer_has_liked BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.content, p.image_urls, p.scope, p.created_at,
         p.likes_count, p.replies_count,
         u.id, u.username, u.full_name, u.avatar_url, un.name,
         EXISTS (SELECT 1 FROM post_likes pl
                  WHERE pl.post_id = p.id AND pl.user_id = p_viewer)
  FROM posts p
  JOIN follows f       ON f.following_id = p.author_id
                      AND f.follower_id  = p_viewer
                      AND f.status       = 'accepted'
  JOIN users u         ON u.id  = p.author_id
  JOIN universities un ON un.id = u.university_id
  WHERE p.parent_post_id  IS NULL
    AND p.moderation_status = 'active'
    AND (p.scope = 'global' OR p.university_id =
         (SELECT university_id FROM users WHERE id = p_viewer))
    AND (p_cursor IS NULL OR p.created_at < p_cursor)
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
```

> **Note the `viewer_has_liked` subquery.** Without it, the client would need a second request to find out which of the 20 posts it already liked, and the heart icons would flicker in after the feed rendered. Computing it in the same query is what makes likes feel instant. This is the fix for the **N+1 query problem**.

---

## 6.5 Cron job

You already have `backend/src/utils/cronJobs.js` running the demo cleanup. Add:

```js
// every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    const { data, error } = await supabase.rpc('refresh_global_hot_scores');
    if (error) throw error;
    console.log(`[cron] refreshed ${data} global hot scores`);
  } catch (err) {
    console.error('[cron] hot score refresh failed', err);
  }
});
```

---

## 6.6 Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/posts/feed/campus?cursor=&limit=` | Home college feed |
| `GET` | `/api/posts/feed/global?sort=hot\|new&cursor=&limit=` | Global feed |
| `GET` | `/api/posts/feed/following?cursor=&limit=` | Following feed |
| `GET` | `/api/posts/:id` | Single post |
| `GET` | `/api/posts/:id/replies?cursor=&limit=` | Replies |
| `POST` | `/api/posts` | Create post or reply (multipart, ≤3 images) |
| `DELETE` | `/api/posts/:id` | Delete own post |
| `POST` | `/api/posts/:id/like` | Like |
| `DELETE` | `/api/posts/:id/like` | Unlike |
| `GET` | `/api/users/:username/posts?cursor=` | A user's posts |
| `POST` | `/api/reports` | Report anything |
| `GET` | `/api/posts/feed/campus/count-since?ts=` | For the "N new posts" pill |

**`POST /api/posts` — validation order in the controller:**

1. Auth check
2. `content` present, ≤250 characters after trim
3. `scope` ∈ `campus | global` (default `campus`)
4. If `parent_post_id` set → scope is inherited from the parent, images rejected
5. Images: ≤3, each ≤5MB, MIME type in the allowlist
6. `contains_banned_term(content, 'block')` → reject with `400 CONTENT_BLOCKED`
7. Upload images to the `posts` storage bucket
8. Insert — the DB triggers handle rate limits, nesting, and counters
9. Catch `RATE_LIMIT_POSTS` / `POSTING_RESTRICTED` / `ACCOUNT_SUSPENDED` from the trigger and map each to a clear `429`/`403` response
10. `notify()` the parent author if this is a reply

**Error responses to document in API.md:**

```
400 { "error": "CONTENT_TOO_LONG",  "max": 250 }
400 { "error": "CONTENT_BLOCKED",   "message": "Your post contains language not allowed on Yahora." }
400 { "error": "TOO_MANY_IMAGES",   "max": 3 }
403 { "error": "ACCOUNT_SUSPENDED" }
403 { "error": "POSTING_RESTRICTED","until": "2026-08-09T10:00:00Z" }
429 { "error": "RATE_LIMIT_POSTS",  "message": "You can post 10 times per hour." }
```

---

## Phase 6 — Definition of done

- [ ] Migrations `007`, `008`, `009` written, `supabase db reset` clean, pushed
- [ ] Campus feed returns only my campus; global returns all campuses
- [ ] Ranking verified — post a low-like recent post and confirm it outranks an old high-like one
- [ ] Reply to a reply → rejected by the trigger
- [ ] 4 images → rejected by the constraint
- [ ] 11 posts in an hour → 11th rejected with `RATE_LIMIT_POSTS`
- [ ] Banned term → `CONTENT_BLOCKED`
- [ ] 3 reports → post auto-hides, author gets a `moderation_action` notification
- [ ] Blocked user's posts absent from all three feeds
- [ ] Private user's posts absent from the global feed for non-followers
- [ ] Cron job running, `hot_score` visibly updating
- [ ] `posts` storage bucket created with authenticated-only insert
- [ ] `seedDemo.js` seeds ~40 campus posts across several colleges, ~15 global posts, replies, likes
- [ ] `backend/API.md` updated

### 🔀 HANDOFF C → Neeraj

> **Phase 6 done — community backend is live.**
>
> **Migrations:** 007_community, 008_moderation, 009_feed_functions.
>
> **Three feed endpoints**, all cursor-paginated. Full shapes in `API.md` §8.
> - `/api/posts/feed/campus` — chronological, newest first
> - `/api/posts/feed/global?sort=hot|new` — **`hot` is the default and what you should show**
> - `/api/posts/feed/following`
>
> **Cursor differs by feed.** Campus and Following use a `created_at` timestamp. Global-hot uses a `hot_score` float. Global-new uses epoch seconds. Always just echo back `next_cursor` from the previous response — don't construct it yourself.
>
> **Every feed item already includes `viewer_has_liked`.** Don't make a second request to check like state.
>
> **`scope` is chosen by the author when composing.** Build the composer with a campus/global toggle. Default to `campus`. Label them clearly — "My College" and "All Colleges".
>
> **Replies are posts with `parent_post_id`.** Same object shape. Replies have no images.
>
> **Handle all six error codes** in the composer (listed in API.md §8.6). `CONTENT_BLOCKED` and `RATE_LIMIT_POSTS` will happen in normal use — they need real UI, not a generic toast.
>
> **What NOT to do yet:** the admin moderation queue is Phase 8 and it's mine. Build the report *button* and the report modal; don't build any review screen.


---

# PHASE 7 — Community Feed: UI

**Who:** Vishwajeet (mobile) and Neeraj (web) — **PARALLEL**
**Estimated:** 5 days
**Prerequisite:** Handoff C

---

## 7.1 The single most important architectural instruction in this phase

**Build ONE feed component, parameterised by scope. Render it in different layouts.**

```jsx
// Web — one component, used three ways
<CommunityFeed scope="campus" />
<CommunityFeed scope="global" sort="hot" />
<CommunityFeed scope="following" />
```

Desktop renders `campus` and `global` side by side. Mobile renders one at a time behind a tab switcher. **Same component. Same data hook. Same post card. Same report flow.**

If you instead write `<CampusFeed>` and `<GlobalFeed>` as separate components, you will fix every bug twice, and the two feeds will slowly drift apart in behaviour. This is also the thing that keeps your web version and Vishwajeet's mobile version consistent — you're each building one component, not three.

---

## 7.2 Layout

### Desktop (≥1024px) — two columns

```
┌──────────────────────── Navbar ────────────────────────┐
├───────────────────────────┬────────────────────────────┤
│  MY COLLEGE               │  ALL COLLEGES     [Hot|New]│
│  IIITDM Kurnool           │                            │
│ ┌───────────────────────┐ │                            │
│ │ What's happening?  [+]│ │  (no composer here —       │
│ └───────────────────────┘ │   one composer, with a     │
│                           │   scope toggle inside it)  │
│  ┌─ post card ─────────┐  │  ┌─ post card ──────────┐  │
│  │ @rahul · 2h         │  │  │ @priya · NIET · 4h   │  │
│  │ content...          │  │  │ content...           │  │
│  │ ♡ 12   💬 3   ⋯     │  │  │ ♡ 40   💬 8   ⋯      │  │
│  └─────────────────────┘  │  └──────────────────────┘  │
│         ↕ scrolls         │         ↕ scrolls          │
└───────────────────────────┴────────────────────────────┘
```

**One composer, not two.** Put it at the top of the left column with a scope toggle inside. Two composers means students wonder which one they're in and post to the wrong feed.

**Independent scrolling.** Each column is its own scroll container with its own infinite-scroll trigger. Use `overflow-y: auto` on each column with a fixed height, and place the "load more" sentinel inside each.

**Below 1024px** collapse to the mobile layout — two columns on a tablet is cramped.

### Mobile — tab switcher

```
┌───────────── Community ─────────────┐
│  [ My College ]  [ All Colleges ]   │  ← segmented control, sticky
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │ post card                     │  │
│  └───────────────────────────────┘  │
│              ↕                      │
│                            ┌─────┐  │
│                            │  +  │  │  ← FAB opens composer
│                            └─────┘  │
└─────────────────────────────────────┘
```

- Segmented control at the top, sticky on scroll
- Swipe left/right also switches tabs
- Each tab keeps its own scroll position when you switch back
- Floating action button opens the composer as a modal sheet

---

## 7.3 The post card

Every element, top to bottom:

```
┌────────────────────────────────────────────────┐
│ (avatar) Rahul Sharma          [NIET] ⋯        │   ← name bold, campus chip only on
│          @rahul · 2h                           │      global feed, ⋯ = report/block
├────────────────────────────────────────────────┤
│ Anyone selling a scientific calculator? Need   │   ← max 250 chars, no truncation
│ it before the exam on Friday.                  │
│                                                │
│ ┌─────────┐ ┌─────────┐                        │   ← up to 3 images, tap to expand
│ │  img 1  │ │  img 2  │                        │
│ └─────────┘ └─────────┘                        │
├────────────────────────────────────────────────┤
│  ♡ 12      💬 3 replies                        │   ← like is optimistic
└────────────────────────────────────────────────┘
```

**Details that matter:**

- Avatar and name are both tappable → `/rahul`. This was one of your explicit requirements.
- Campus chip appears **only in the global feed** — in your own college's feed everyone is from your college, so it's noise.
- Never truncate a 250-character post. Truncation exists for long content; 250 characters is three lines.
- Relative time: `2h`, `3d`. Switch to a date after 7 days.
- Like button uses the same optimistic-update pattern from Phase 4.
- `⋯` menu: Report, Block user, and — if it's your own post — Delete.
- Own posts show a subtle border in `--purple-light` so students can find theirs.

**Image layout:** 1 image → full width, max-height 400px. 2 images → side by side. 3 images → one large left, two stacked right. Always `object-fit: cover` with a fixed aspect ratio, so the feed doesn't jump around as images load.

---

## 7.4 The composer

```
┌──────────────────────────────────────────────┐
│ Posting as @rahul · IIITDM Kurnool           │  ← accountability, always visible
├──────────────────────────────────────────────┤
│ What's happening on campus?                  │
│                                              │
├──────────────────────────────────────────────┤
│ [📷 0/3]              Post to:  [My College▾]│
│                                    218 left  │
│                              [    Post    ]  │
└──────────────────────────────────────────────┘
```

- **"Posting as @rahul · IIITDM Kurnool" at the top, always.** This is your cheapest and most effective moderation tool. People behave differently when they can see their name attached.
- Character counter appears at 200 characters, turns `--pink-dark` at 240, blocks at 250
- Scope dropdown: "My College" (default) / "All Colleges". Add a one-line hint under it when "All Colleges" is picked: *"Students at every college on Yahora will see this."*
- Image picker: max 3, thumbnails with an X to remove, client-side compression before upload
- Post button disabled while empty or uploading
- **Optimistic insert** — the post appears at the top of the feed immediately with a subtle "sending" opacity, then solidifies. On error, it turns red with a Retry option and the text isn't lost.

**Error handling — these will happen in normal use, so give them real UI:**

| Error | What to show |
|---|---|
| `CONTENT_BLOCKED` | Inline message under the text area: "Your post contains language that isn't allowed. Please edit it." Do NOT clear their text. |
| `RATE_LIMIT_POSTS` | "You've reached the limit of 10 posts per hour. Try again later." |
| `POSTING_RESTRICTED` | "Your posting is paused until 9 Aug, 3:00 PM." |
| `ACCOUNT_SUSPENDED` | Full-screen state, not a toast. Link to a contact/appeal page. |
| `TOO_MANY_IMAGES` | Should be impossible — the picker caps at 3. Fall back to a toast. |

---

## 7.5 The "N new posts" pill

**Campus feed only.** The global feed at hundreds of colleges would show this constantly, which is noise.

```js
// Poll every 30s, or use a Supabase Realtime INSERT subscription
const { data } = useQuery({
  queryKey: ['campus-feed-new-count', newestSeenTimestamp],
  queryFn: () => api.get(`/posts/feed/campus/count-since?ts=${newestSeenTimestamp}`),
  refetchInterval: 30_000,
});
```

- Pill appears at the top of the column: "3 new posts", `--purple` background
- **Do not auto-insert new posts.** If the feed shifts while someone is reading, they lose their place — this is the single most irritating thing a feed can do.
- Tapping the pill scrolls to top and loads the new posts
- Hide the pill while the user is already at the top of the feed

---

## 7.6 Post detail & replies

Route: `/post/:id` (web) and `app/post/[id].tsx` (mobile). **Add `post` and `posts` to `reserved_usernames` — already in the Phase 1 list.**

- The parent post rendered larger at the top
- Reply composer directly beneath it (no images, 250 chars)
- Replies in chronological order (oldest first — it's a conversation)
- Cursor-paginated with a "Load more replies" button
- Each reply: avatar, name, `@handle`, content, time, ⋯ menu
- Reply authors are tappable → their profile
- Empty state: "No replies yet. Be the first."

---

## 7.7 Report flow

Reachable from the ⋯ on every post and reply.

1. Modal: "Why are you reporting this post?"
2. Radio list matching the DB enum exactly: Spam · Harassment or bullying · Hate speech · Sexual content · Violence or threats · Impersonation · Misinformation · Self-harm · Prohibited item · Something else
3. Optional details field, max 500 chars
4. Submit → `POST /api/reports`
5. Confirmation: "Thanks. Our team will review this." — **do not tell them how many reports a post has, or whether it got hidden.** That information lets people coordinate abuse of the report system.
6. Hide the reported post from that reporter's own feed immediately
7. If they've already reported it, the API returns a duplicate error — show "You've already reported this post."

---

## 7.8 Profile "Posts" tab

The profile page (built in Phase 2) gains a Posts tab beside Listings.

- `GET /api/users/:username/posts`
- Same post card component
- Private account, not a follower → "This account is private. Follow to see their posts." — but the **Listings tab stays visible and functional**
- Empty state: "@rahul hasn't posted yet."

---

## 7.9 Navigation entry points

- Web navbar: replace the stub `/feed` and `/hot` links with a single **Community** link → `/community`
- Mobile: Community becomes a bottom tab (you currently have Marketplace, Messages, Profile — this makes four)
- Delete the `/feed` and `/hot` stub routes from `App.jsx` entirely

---

## Phase 7 — Definition of done

- [ ] One `CommunityFeed` component, used for all three feeds
- [ ] Desktop two-column layout with independent scrolling
- [ ] Mobile tab switcher with swipe and preserved scroll position
- [ ] Composer with scope toggle, "posting as" line, char counter, 3-image picker
- [ ] All six error codes have real UI
- [ ] Optimistic post insert with retry on failure
- [ ] Post card complete, avatar/name tappable to profile
- [ ] Optimistic likes
- [ ] "N new posts" pill on campus feed only, no auto-insert
- [ ] Post detail page with replies
- [ ] Report modal with all 10 reasons
- [ ] Profile Posts tab, private state correct
- [ ] `/feed` and `/hot` stubs deleted

### 🔀 HANDOFF 7 — sync point
Compare web and mobile side by side. Post from web, confirm it appears on mobile. Like from mobile, confirm the count updates on web.

---

# PHASE 8 — Moderation, Safety & Pre-Launch Hardening

**Admin module + backend:** Vishwajeet
**Guidelines page, banned-terms list, testing:** both
**Estimated:** 3 days
**This is not optional and it is not "later". It ships before launch.**

---

## 8.1 Admin moderation queue

You need somewhere to review reports. For v1 this can be simple.

**Minimum viable version:** a protected route `/admin/reports` behind a check that the logged-in user's id is in an allowlist (an `is_admin` boolean on `users`, or an env var with your two user ids).

```sql
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;
UPDATE users SET is_admin = true WHERE username IN ('your_handle','neeraj_handle');
```

**Endpoints:**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/reports?status=open&cursor=` | Review queue |
| `POST` | `/api/admin/reports/:id/action` | `{ action: 'remove'\|'restore'\|'dismiss', note }` |
| `POST` | `/api/admin/users/:id/restrict` | `{ hours: 24, reason }` |
| `POST` | `/api/admin/users/:id/suspend` | `{ reason }` |
| `GET` | `/api/admin/stats` | Open reports, posts today, new users today |

**The screen:** a list of open reports, each showing the reported content, the reason, the reporter, the author, the author's prior report count, and three buttons — Remove, Restore, Dismiss.

**If you're short on time, this can literally be the Supabase table editor for week one.** But the endpoints above should exist so you can build the screen quickly when volume grows.

---

## 8.2 The banned terms list

This is a job only you two can do, and it matters more than any other single safety measure.

- Off-the-shelf English profanity lists will miss almost everything that actually causes problems on an Indian campus app, because the slurs are Hindi/regional written in Latin script.
- Build the list from Hindi, English, and your regional languages, including common misspellings and character substitutions (`a`→`@`, `i`→`1`, `o`→`0`).
- Use `severity = 'flag'` generously and `severity = 'block'` sparingly — flagged posts go live but land in your review queue, so you learn what's actually being posted without over-blocking.
- Review the flag queue weekly for the first month and promote terms to `block` as you learn.

```sql
INSERT INTO banned_terms (term, severity, language) VALUES
  ('example_slur_1', 'block', 'hi'),
  ('example_term_2', 'flag',  'en');
```

---

## 8.3 Community guidelines

Create a `/guidelines` page (add `guidelines` to `reserved_usernames` — already in the Phase 1 list) covering:

- What Yahora is for
- Not allowed: harassment, hate speech, sexual content, threats, impersonation, spam, selling prohibited items, doxxing, academic dishonesty (selling exam papers/assignments — a real issue on campus platforms)
- What happens when you break the rules: post removed → temporary posting restriction → suspension
- How to report, and how to appeal

**Require acceptance** — a checkbox during onboarding linking to the page. Store `guidelines_accepted_at` on `users`.

---

## 8.4 Play Store requirements

Your app has user-generated content, which means Google Play requires:

- An **in-app reporting mechanism** for objectionable content ✓ (Phase 7)
- The ability to **block abusive users** ✓ (Phase 4)
- A published **content policy** ✓ (§8.3)
- **Timely action** on reports — the auto-hide at 3 reports covers you between manual reviews

Verify the current exact wording of Play's UGC policy before submitting; it does get updated.

---

## 8.5 Legal note

India's IT Rules place obligations on platforms hosting user content, including publishing a grievance officer contact and acting on complaints within defined timelines. **I'm not a lawyer and this isn't legal advice** — but it's real, it applies to you, and you should get someone qualified to look at your terms, privacy policy, and grievance process before you launch publicly with hundreds of colleges. Budget time for it now rather than discovering it after launch.

---

## 8.6 Pre-launch testing checklist

Run every one of these on **both** web and mobile before you ship.

**Campus isolation**
- [ ] Log in as a NIET student — no IIITDM campus post appears in the campus feed
- [ ] Take the anon key from your JS bundle, query `posts` directly from a script — confirm RLS blocks other campuses
- [ ] Try `GET /api/posts/:id` for another campus's post — confirm 403/404
- [ ] Confirm follows DO work across campuses (the deliberate exception)

**Usernames**
- [ ] Register `admin` → rejected
- [ ] Register an existing handle → clean 400, not a 500
- [ ] Two browsers, same handle, submit simultaneously → one succeeds, one gets a friendly error
- [ ] Change a handle, visit the old URL → redirects
- [ ] Try changing twice in a week → 429

**Privacy & blocking**
- [ ] Private account: non-follower sees no posts, but DOES see listings
- [ ] Follow request → accept → posts become visible
- [ ] Block someone → their posts vanish from all three feeds, both directions
- [ ] Blocked user tries to follow → 403
- [ ] Blocked user cannot tell they've been blocked

**Community**
- [ ] Post to campus → visible to campus only
- [ ] Post to global → visible to campus AND global
- [ ] 11 posts in an hour → blocked
- [ ] Reply to a reply → blocked
- [ ] 4 images → blocked
- [ ] Banned word → blocked, text preserved in the composer
- [ ] Report from 3 accounts → post auto-hides, author notified
- [ ] Hidden post disappears from every feed and from the author's profile

**Performance**
- [ ] Run `EXPLAIN ANALYZE` on all three feed queries — every one should show an **Index Scan**, never a **Seq Scan**
- [ ] Feed loads in under 500ms with 10,000 seeded posts
- [ ] Scroll 10 pages deep — no slowdown (this is what cursor pagination buys you)

**Cross-surface**
- [ ] Post on web → appears on mobile
- [ ] Follow on mobile → count updates on web
- [ ] Every screen exists on both surfaces and behaves the same

---

# Appendix A — Complete schema reference

## New tables

| Table | Purpose | Key columns |
|---|---|---|
| `reserved_usernames` | Handles nobody may register | `username` (PK), `reason` |
| `username_history` | Old handles: redirects + anti-squatting | `user_id`, `username`, `reserved_until` |
| `follows` | The follow graph — **global, no `university_id`** | `(follower_id, following_id)` PK, `status` |
| `blocks` | Who blocked whom | `(blocker_id, blocked_id)` PK |
| `notifications` | Activity feed | `user_id`, `actor_id`, `type`, `entity_id`, `read_at` |
| `post_likes` | Likes on community posts | `(user_id, post_id)` PK |
| `reports` | User reports on any content | `reporter_id`, `target_type`, `target_id`, `reason`, `status` |
| `banned_terms` | Wordlist filter | `term` (PK), `severity` |

## Modified tables

**`users`** — added: `username`, `username_changed_at`, `is_private`, `followers_count`, `following_count`, `posting_restricted_until`, `is_suspended`, `suspension_reason`, `is_admin`, `guidelines_accepted_at`

**`posts`** — dropped `image_url`; added: `image_urls TEXT[]`, `scope`, `parent_post_id`, `likes_count`, `replies_count`, `report_count`, `hot_score`, `moderation_status`, `edited_at`

## All new functions

| Function | Purpose |
|---|---|
| `is_username_available(text, uuid)` | Format + reserved + taken + cooling-off, in one call |
| `generate_username(text)` | Slug from a display name with a collision-safe suffix |
| `suggest_usernames(text, uuid)` | Three suggestions for onboarding |
| `search_users(text, uuid, int)` | Prefix + fuzzy search, own campus ranked first |
| `can_view_social_content(uuid, uuid)` | The privacy gate every read path calls |
| `is_blocked_pair(uuid, uuid)` | Cheap block check for feed queries |
| `contains_banned_term(text, text)` | Wordlist filter with word boundaries |
| `refresh_global_hot_scores()` | Cron: recompute ranking |
| `get_campus_feed(...)` | Home feed |
| `get_global_feed(...)` | Global feed, hot or new |
| `get_following_feed(...)` | Following feed |

## All new triggers

| Trigger | Table | Does |
|---|---|---|
| `trg_username_not_reserved` | `users` | Blocks reserved handles |
| `trg_record_username_change` | `users` | Archives the old handle |
| `trg_privacy_change` | `users` | Auto-accepts pending on going public |
| `trg_prepare_follow` | `follows` | Decides pending vs accepted; refuses if blocked |
| `trg_follow_counts` | `follows` | Maintains follower/following counts |
| `trg_apply_block` | `blocks` | Deletes follows both directions |
| `trg_single_level_replies` | `posts` | Blocks nested replies |
| `trg_post_rate_limit` | `posts` | Rate limits, restrictions, suspensions |
| `trg_post_replies_count` | `posts` | Maintains `replies_count` |
| `trg_post_likes_count` | `post_likes` | Maintains `likes_count` |
| `trg_report_threshold` | `reports` | Auto-hides at 3 reports, notifies author |

---

# Appendix B — Migration order

Run in exactly this sequence. Never renumber.

```
001_baseline.sql              ← from `supabase db pull` (Phase 0)
002_usernames.sql             ← Phase 1
003_username_backfill.sql     ← Phase 1
004_follows.sql               ← Phase 3
005_rls_social.sql            ← Phase 3
006_notifications.sql         ← Phase 5
007_community.sql             ← Phase 6
008_moderation.sql            ← Phase 6
009_feed_functions.sql        ← Phase 6
010_admin.sql                 ← Phase 8
```

---

# Appendix C — Phase timeline & who's blocked when

With the backend split, the shape changes: **Vishwajeet front-loads all the migrations**, because those are the only thing nobody else can do. Each migration unblocks a backend module for Neeraj, who then builds it and immediately consumes it in his own web UI.

```
        VISHWAJEET                          NEERAJ
        (database + shared infra +          (website + user, social,
         posts, admin, mobile)               notifications, reports)

Day 1   PHASE 0  CLI, migrations baseline    ⛔ blocked
Day 2   PHASE 0  app.js frozen, helpers,     ⛔ (reads §0.5, reviews
                 stubs, full API.md              API contract with V)
        ──────────────── HANDOFF 0 + contract review together ────────────────

Day 3   MIG 002/003  usernames               ⛔ (last blocked day)
        ──────────────── HANDOFF A ──────────────→
Day 4   MIG 004/005  follows + RLS           BACKEND: user module
Day 5   MIG 006      notifications           BACKEND: user module → PR
        ──────────────── HANDOFF B ──────────────→
Day 6   Security fixes (§1.6)                BACKEND: social module
Day 7   MIG 007/008/009  community           BACKEND: social module → PR
Day 8   BACKEND: posts module                WEB: username UI (Phase 2)
        ──────────────── HANDOFF C ──────────────→
                              ⚖️ LOAD-VALVE CHECKPOINT — decide honestly
Day 9   BACKEND: posts module → PR           WEB: username UI
Day 10  BACKEND: reports trigger side        BACKEND: notifications + reports
Day 11  MOBILE: username UI                  WEB: follows UI (Phase 4)
Day 12  MOBILE: follows UI                   WEB: follows UI
Day 13  MOBILE: notifications UI             WEB: notifications UI
Day 14  MOBILE: community UI                 WEB: community UI (Phase 7)
Day 15  MOBILE: community UI                 WEB: community UI
Day 16  MOBILE: community UI                 WEB: community UI + guidelines
Day 17  BACKEND: admin queue                 Testing (§8.6)
Day 18  Both: hardening, cross-surface testing, launch checklist
```

**What changed versus the single-owner version:**

- Vishwajeet's backend load drops from 37 endpoints to 17, and his DB work is finished by Day 7 instead of Day 9 — so mobile UI starts three days earlier.
- Neeraj is blocked for 3 days instead of 3 days (unchanged — migrations are still the gate), but he now spends Days 4–7 on backend instead of waiting.
- **Neeraj's web UI starts on Day 8 instead of Day 4.** This is the cost. It's worth paying because he isn't idle in between and because Vishwajeet stops being the single point of failure for every phase.
- The critical path is now roughly balanced: both of you finish UI around Day 16.

**Read the pipeline, not the dates.** Days are indicative — you said correctness matters more than speed. The shape is what matters:

1. Vishwajeet does migrations first and fast, because he's the only one who can
2. Each migration immediately unblocks a Neeraj backend module
3. Neeraj builds the backend for a feature, then the web UI for that same feature — so he's never waiting on anyone
4. Vishwajeet builds his own modules, then catches up on mobile UI while Neeraj does web UI

---

# Appendix D — Quick reference: opening every Claude Code session

```
Before we start: read CLAUDE.md, docs/CHANGELOG.md, backend/API.md,
and database/schema.md. Summarise in 5 bullets what changed most
recently and what I should be careful about.

Today I'm working on: [phase name] from YAHORA_BUILD_PLAN.md.
Read that section before writing any code.
```

---

*End of plan. Keep this file in `docs/` and commit it — both of you should be reading the same version.*
