# Yahora Backend — rules for this directory

**Two developers write code in here at the same time, in separate Claude Code sessions that
cannot see each other.** Everything in this file exists to stop them colliding. Read it before
touching anything under `backend/`.

Plan of record: `docs/YAHORA_BUILD_PLAN.md` §0.1, §0.2, §0.5.
Contract of record: `backend/API.md`.

---

## File ownership map

From plan §0.1. **Check this before editing any file.** Every file in `backend/src/modules/`
also carries an `OWNER:` banner in its first five lines — if the banner names the other
person, do not edit the file. Say so in your response and stop.

| Area | Owner | Notes |
|---|---|---|
| Supabase database (schema, migrations, RLS, triggers, functions) | **Vishwajeet** | Neeraj never runs SQL. Ever. See the migration-request protocol below. |
| `backend/API.md` (the contract) | **Vishwajeet** writes it all, both implement to it | Written in Phase 0, before anyone codes |
| Shared backend infrastructure (`app.js`, `middleware/`, `config/`, `utils/`) | **Vishwajeet** | Frozen after Phase 0. Neeraj imports, never edits. |
| `backend/src/modules/user/` (usernames, search) | **Neeraj** | |
| `backend/src/modules/social/` (follows, blocks, privacy) | **Neeraj** | |
| `backend/src/modules/notifications/` (read side) | **Neeraj** | |
| `backend/src/modules/reports/` | **Neeraj** | |
| `backend/src/modules/posts/` (community feeds) | **Vishwajeet** | |
| `backend/src/modules/admin/` (moderation queue) | **Vishwajeet** | |
| `backend/src/modules/products/`, `auth/`, `messages/` (existing) | **Vishwajeet** | Includes the three security fixes in §1.6 |
| `backend/src/modules/university/`, `academic/` (existing) | **Vishwajeet** | Not named in §0.1; existing modules, same owner as the rest |
| `backend/scripts/seedDemo.js` | **Vishwajeet** | Neeraj requests additions |
| Website (`frontend/`) | **Neeraj** | Vishwajeet doesn't touch this |
| Mobile app (`mobile/`) | **Vishwajeet** | Neeraj doesn't touch this |
| `docs/CHANGELOG.md` | Both append | How you tell each other things |

**The principle behind this split:** Vishwajeet owns everything where **a mistake is silent and
permanent** — the database, security-critical paths, shared infrastructure. Neeraj owns things
where **a mistake is loud and immediate** — endpoints he consumes in his own UI the next day.

**Two routers are mounted on `/api/users` deliberately.** Express tries `user.routes.js` first
and falls through to `social.routes.js` when no path matches. That is what lets follows live in
a different file from usernames, so the two of you never open the same file.

---

## Mandatory: API.md is part of every backend change

Whenever you add, remove, or modify ANY route, controller response
shape, or error code in this backend, you MUST update backend/API.md
in the SAME response. This is not optional and does not need to be
requested.

If you change a response shape, also add a line to docs/CHANGELOG.md
under a "BREAKING" heading, because a separate developer is building
a client against this API and cannot see this conversation.

Never mark a backend task complete until API.md reflects the change.

`API.md` has two parts. **Part 1** describes routes that exist today, bugs included — if the
code and Part 1 disagree, the doc is wrong. **Part 2** is the contract for routes not yet
built — if the code and Part 2 disagree, the code is wrong. Implement to Part 2 exactly; both
the web and mobile clients are written against it.

---

## Frozen shared infrastructure — do not edit unless you are Vishwajeet

These files are frozen after Phase 0:

- `backend/src/app.js`
- `backend/src/middleware/` — `requireAuth.js`, `optionalAuth.js`
- `backend/src/config/` — `supabase.js`
- `backend/src/utils/` — `respond.js`, `notify.js`, `cronJobs.js`

**Import from them. Never edit them. Never write a parallel version inside your own module.**

- Every route mount you will ever need is already registered in `app.js`. Add routes inside
  your own module's `*.routes.js`, never in `app.js`.
- All errors go through `sendError` / `mapDbError` from `utils/respond.js`. All paginated
  lists go through `sendPage`. Do not hand-roll an error shape or a pagination envelope.
- All Supabase clients live in `config/supabase.js`. Do not call `createClient` anywhere else.
  There are three, and picking the wrong one is a silent security bug: **`supabase`** (service
  role) for everything normal; **`createSessionClient()`** for the two calls that mint a session,
  so they cannot demote the shared client; **`supabaseAnon`** for `signInWithOtp`, because GoTrue
  exempts service-role callers from CAPTCHA and minting an OTP on the service-role client makes
  Turnstile decorative.
- Notifications are emitted with `notify()` from `utils/notify.js`, wrapped so a failed
  notification never breaks the action that triggered it.

If you genuinely need a change to one of these, **message Vishwajeet.** Do not edit and do not
work around it.

---

## Networking: no hardcoded LAN IPs, ever

A LAN IP written into a file is a DHCP lease waiting to expire. When the router hands this Mac
a new address, every call fails with `ConnectTimeoutError` and then `EHOSTDOWN`, and
`/api/auth/request-otp` returns 500 — a failure that reads as "Supabase is down" and costs an
hour. This already happened once, with `SUPABASE_URL` pinned to a dead lease.

- **The backend always talks to local Supabase over `http://127.0.0.1:54321`.** The Express
  server and Supabase run on the same machine, so a LAN address here buys nothing and breaks
  on every network change. In production `SUPABASE_URL` is the hosted
  `https://<project>.supabase.co` origin.
- **The server binds `0.0.0.0`** (`HOST` overrides, `PORT` stays configurable) so phones and a
  second laptop on the same Wi-Fi can reach port 5000. On boot it prints the current LAN
  address as a convenience line — read it off the log, never write it down.
- **Clients resolve the dev host themselves.** The Expo app derives it from the Expo dev server
  (`mobile/src/lib/config.ts`); the web app uses the Vite `/supabase` and `/api` proxies. Neither
  needs an IP pasted into a config file, so nobody edits a file when the network changes.
- **CORS branches on `NODE_ENV`.** In development any `localhost` / `127.0.0.1` / RFC-1918
  origin is accepted on any port. Production behaviour is unchanged. `allowedHeaders` must keep
  listing `X-Device-Id` — the OTP rate limiter sends it, and it is not a CORS-safelisted header,
  so dropping it fails every preflight.

⚠ **A production deploy must set `NODE_ENV=production`.** Without it the server applies the
development origin rules and rejects the hosted frontend's origin.

If you find a hardcoded `10.x`, `192.168.x` or `172.16–31.x` anywhere under `backend/`, it is a
bug — replace it with loopback or with runtime resolution.

---

## Never write SQL, and never run a supabase command from here

- **Do not** run `supabase db push`, `db reset`, `migration new`, or any other `supabase` CLI
  command from the backend directory. Do not open the Supabase dashboard SQL editor — not to
  test, not for a read-only-looking query that turns out to write.
- **Do not** write a `.sql` file. Migrations live in `supabase/migrations/` and are Vishwajeet's.
- A schema change that exists only in the dashboard exists nowhere in the repo, and the other
  developer can never find out about it.

**When you need a schema change — the migration request protocol:**

1. Append a request to `docs/CHANGELOG.md` under `## MIGRATION REQUESTS`, and message
   Vishwajeet. Say what you need, why, and what it is blocking:
   > *Need: `users.last_seen_at TIMESTAMPTZ` — for the "active recently" badge on profile
   > cards. Blocking: social module follower list.*
2. Vishwajeet writes the migration, applies it, and replies with the migration number.
3. Target turnaround is **same day**. If it will take longer, work around it and revisit.

**Business rules live in the database, not in your controller.** Follow status, block checks,
rate limits, reply nesting and every counter are enforced by triggers. Your code says "insert a
follow"; the trigger decides what that means. **Do not re-implement a trigger's rule in
JavaScript** — if your code and the trigger ever disagree, you get a bug nobody can find. Read
the trigger's outcome back and map its exception through `mapDbError()`.

---

## Security checklist — run through this on every endpoint before opening a PR

From plan §0.5.4. Every item, every endpoint, every time.

- [ ] Does it require auth? If it's optional-auth, is the unauthenticated path safe?
- [ ] Does it verify the **caller owns** the thing being modified? (`seller_id === req.user.id`)
- [ ] Does it verify **campus match** where required? (products, messages, campus posts)
- [ ] Does it call `can_view_social_content()` before returning anything from a profile?
- [ ] Does it filter out blocked users with `is_blocked_pair()`?
- [ ] Are `limit` and `cursor` validated? (`limit` capped at 50 — an uncapped limit is a denial-of-service)
- [ ] Does it use `mapDbError()` rather than leaking raw Postgres errors to the client?
- [ ] Is every ID in the response a UUID the caller is allowed to know about?

**Why this matters more than it looks:** the backend uses the Supabase **service-role key**, so
every query **bypasses RLS**. Row Level Security is not a backstop for these routes — your
controller is the only thing standing between a caller and the data. Identity comes from
`req.user.id` set by `requireAuth`, **never** from a `user_id` in the body or query string.

---

## Pull request rules

- **Every backend PR requires a review from the other person before merge.** Frontend and
  mobile PRs don't.
- Rebase on `main` before opening a backend PR, always.
- **One module per PR.** Don't bundle `social` and `notifications` into one review.
- Merge promptly — a long-lived backend branch is where conflicts breed.
- Post a handoff entry in `docs/CHANGELOG.md` when a module lands. Use the template there.
