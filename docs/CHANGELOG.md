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

## 2026-09-01 — HANDOFF A: Turnstile local setup + a finding that breaks Block E (Vishwajeet)

### For Neeraj — the keys you need (N-Block C)

Use **Cloudflare's dummy sitekey for local development**, not the real one:

| | value |
|---|---|
| local sitekey (`.env` / `.env.example`) | `1x00000000000000000000AA` — always passes |
| production sitekey | the real one; ask me |

**Dummy and real keys must be paired.** My local Supabase runs Cloudflare's dummy *secret*, and
a real sitekey checked against a dummy secret is rejected every time — and vice versa. If local
login starts failing for no visible reason, that mismatch is the first thing to check.

Send the token to the backend as **`captchaToken`** in the `POST /api/auth/request-otp` body.
It is optional today: omit it and the request still succeeds. On failure you get
`400 {"error":"CAPTCHA_FAILED", "message": ...}` — reset the widget and let the student retry
**immediately**; there is no cooldown, so do not show a countdown. See `API.md` §request-otp.

### Local setup (done, my side)
- Root `.env` (gitignored) holds `TURNSTILE_SECRET_KEY_LOCAL` = the dummy "always passes"
  secret. The "always fails" key is in there commented out, for testing rejection.
- `supabase/config.toml` gained `[auth.captcha]` with `provider = "turnstile"` and
  `secret = "env(TURNSTILE_SECRET_KEY_LOCAL)"`. Needs `supabase stop && supabase start`.
- ⚠ Still never `supabase config push` — it would push these test values over production.

### 🚨 The finding: enabling Turnstile does NOT currently protect request-otp

Measured against local GoTrue with captcha enabled — same endpoint, same body, only the key
differs:

    ANON key,         no captcha token  ->  400 captcha_failed
    SERVICE_ROLE key, no captcha token  ->  200

**GoTrue exempts service-role callers from captcha.** Our backend authenticates to Supabase with
`SUPABASE_SERVICE_ROLE_KEY` (`config/supabase.js:19`) for every auth call, so the captcha is
skipped on `request-otp`, `login-password`, `demo-login` and `set-password` alike.

Consequences:
- **Nothing is broken.** Turnstile being enabled on production changed no behaviour at all, in
  either direction. There is no outage to chase.
- **Nothing is protected either.** The flooding attack in runbook 2.4 still works exactly as
  before, because it goes through our backend, which holds the service-role key.
- Block E4's second check ("the DevTools script should now fail") **will not fail.** That is the
  symptom, not a mistake in the test.

The token our backend forwards is accepted and then ignored. The four CC-3 limits and the
circuit breaker are unaffected and still work — they are ours, and run before Supabase.

### The fix — APPLIED and verified

`config/supabase.js` now exports a third client, **`supabaseAnon`** (anon key, same options as
the others), and `requestOtp` mints the OTP on it instead of the service-role client. That is
what a browser does and what GoTrue expects to police. The Turnstile secret still never enters
this repo — only the anon key, which was already in `backend/.env`.

`SUPABASE_ANON_KEY` is now **required at boot**: it joins the existing startup check, so a
deployment missing it fails loudly instead of breaking OTP at runtime. Both `backend/.env` and
`.env.production.local` already have it.

Nothing else moved. The four CC-3 limits, the circuit breaker and the `otp_requests` ledger all
still run on the service-role client, and all run before the Supabase call.

Verified locally with captcha enabled:

| check | result |
|---|---|
| `request-otp` with **no** token | `400 CAPTCHA_FAILED` ← the attack is now refused |
| `request-otp` with a token | `200`, real email delivered (confirmed in Mailpit) |
| unknown domain + valid token | `403` — still checked before the captcha |
| 4 requests, same email, valid token | `200, 200, 200, 429 RATE_LIMITED` — limits intact |
| `demo-login` | `200` — untouched, still service-role |
| ledger after a rejected captcha | no row — a blocked request costs the student no quota |

**Block E4's second check now passes**: the tokenless DevTools script from Block D returns
`400 CAPTCHA_FAILED` instead of sending an OTP.


## 2026-09-01 — request-otp: Supabase's own cooldown was surfacing as a 500 (Vishwajeet)

### Symptom
Block D step 4 gave `200, 500, 500, 500` instead of `200, 200, 200, 429`. Backend log:
`AuthApiError ... status: 429, code: 'over_email_send_rate_limit'`.

### Cause — not the hosted free tier
Local GoTrue. Reproduced with the backend out of the loop by calling
`http://127.0.0.1:54321/auth/v1/otp` directly: call 1 → 200, calls 2 and 3 → 429.
`supabase/config.toml` had the CLI default `[auth.email] max_frequency = "1s"`, the minimum gap
between two emails to the same address. The test's four `await`ed requests complete in tens of
milliseconds, so 2–4 all landed inside that window.

Two consequences, both now fixed:
1. `requestOtp` ended in a catch-all that turned any thrown error into `500 Internal server
   error while sending OTP`, so a rate limit was reported as a server fault.
2. Our own limiter never ran. The `otp_requests` ledger row is written only *after*
   `signInWithOtp` succeeds, so requests 2–4 left no rows — the ledger held exactly one row for
   the whole burst, and the counter could never have reached the threshold.

### Changed
- **`backend/src/modules/auth/auth.controller.js`** — a 429 from Supabase now returns the
  existing `sendRateLimited()` shape instead of falling through to the 500. New
  `supabaseRetryAfterSeconds()` parses the seconds out of GoTrue's message (it exposes them
  nowhere machine-readable), clamps to 1–60, and falls back to 60. **No limit, threshold,
  window or counting rule changed** — only the mapping of an error that was already happening.
- **`supabase/config.toml`** — `[auth.email] max_frequency` is now `"1ms"` for local dev.
  ⚠ `"0s"` does NOT disable this: GoTrue reads zero as unset and applies its own **60s** default,
  which is stricter than the value being replaced. I tried it, measured it, and backed it out.
  Requires `supabase stop && supabase start` to take effect.
- `backend/API.md` — the OTP limits table gains row (e) for Supabase's cooldown, and the
  `RATE_LIMITED` row notes the extra source.

### Production values — checked, and one is a launch blocker
Read from the Management API on 2026-09-01. Full table in `API.md` §request-otp.

- `smtp_max_frequency` = **1s** (not 60s). So limit (b) **does** engage in production for
  human-paced retries. The Block D result stands. (e) only intercepts sub-second bursts, so the
  *scripted* burst returns `200,429,429,429` against production — that test is local-only.
- 🚨 `rate_limit_email_sent` = **30 per hour, project-wide.** `OTP_HOURLY_CEILING` is 2,000, so
  **limit (a) can never fire** — Supabase stops sending at the 31st OTP in any hour. The runbook's
  premise ("a few hundred genuine OTPs in the busiest hour") is not currently achievable. SMTP is
  custom (Brevo), so the fix is to raise this to whatever that plan sustains and set
  `OTP_HOURLY_CEILING` just below it, so our own `503 SERVICE_BUSY` fires first as designed.
  **Not changed — needs a decision on the Brevo plan first.** Brevo is on the free tier
  (300/day), so the sizing decision is deferred to launch. Written up in
  **`docs/PRE_LAUNCH_CHECKLIST.md`** — read that before launch; it also warns against
  `supabase config push`, which would overwrite production auth config with our local test
  values.
- Everything else (OTP length 8, expiry 3600, the five /5min and /hour limits) matches local.

### Test data
I cleared 5 rows from the local `otp_requests` ledger — `ratetest@iiitk.ac.in` (2, from the
failed run) and `blockdverify@iiitk.ac.in` (3, from my verification) — so a verbatim re-run of
Block D step 4 starts clean. Both are synthetic addresses; no real data touched. The
`auth.users` rows those requests created are still there.

### Verified
`200, 200, 200, 429 RATE_LIMITED retry_after_seconds:60`, zero stack traces in the backend log.


## 2026-09-01 — Web: base URLs resolved at runtime, no hardcoded hosts (Vishwajeet, in Neeraj's area)

### ⚠ Ownership
I edited **`frontend/`, which is Neeraj's**, at Vishwajeet's explicit request, as the web half
of the same networking fix. Nothing was refactored beyond base-URL plumbing. Neeraj: read this
before your next pull — 12 files changed, all of them mechanically.

### Why
Same root cause as the backend entry below: hosts resolved in the visitor's browser cannot be
written down. A `localhost` in `.env` means "the phone", and a LAN IP dies with the DHCP lease.

### New
- **`frontend/src/config/urls.js`** — the single resolver. Exports `API_BASE_URL`
  (origin + `/api`), `API_ORIGIN`, and `SUPABASE_URL`.
- Rule per URL: empty → unchanged (relative, via the Vite proxy — the dev default);
  `!import.meta.env.DEV` → unchanged; hostname not `localhost`/`127.0.0.1`/`::1`/`10.x`/
  `192.168.x`/`172.16–31.x` → unchanged; otherwise **only the hostname** is replaced with
  `window.location.hostname`, keeping protocol, port and path. A page served from
  `http://10.37.66.39:3000` turns `http://localhost:5000` into `http://10.37.66.39:5000` itself.

### Changed — mechanical, no behaviour change
- Every direct `import.meta.env.VITE_API_BASE_URL` read (30 call sites across `navbar`,
  `UniversityModal`, `Auth`, `Home`, `Sell`, `Dashboard`, `Marketplace`, `Messages`,
  `ProductDetail`, `PublicProfile`, `onboarding`) now imports `API_BASE_URL` from
  `config/urls`. The four module-level `const API_BASE_URL = ...` and onboarding's `API_BASE`
  are gone — import the constant instead. Every resulting request string is byte-identical.
- `config/supabaseClient.js` takes `SUPABASE_URL` from the helper. **Anon key handling is
  untouched**, as is all auth logic.

### NOT changed
- **Production behaviour is identical.** The rewrite path is behind `import.meta.env.DEV`, which
  is statically `false` in a build, so Vite strips it out entirely — verified: `isDevMachineHost`,
  the private-range regex and the loopback set are all absent from `dist/assets/*.js`.
- `.env` variable names and values (still empty in dev). `vite.config.js` — it **already** had
  `server.host: true`; its `http://localhost:5000` / `:54321` proxy targets are correct and must
  stay, because the dev server resolves them on the dev machine, not in the browser.
- `netlify/edge-functions/product-preview.js` still reads `Netlify.env.get("VITE_API_BASE_URL")`
  directly — it runs server-side at the edge in production, where there is no `window` and
  nothing to resolve. Leave it alone.

### What NOT to do
- Don't put a host or IP back into a component or `.env` to "fix" a device — that is the bug
  this removes. See the new §17 in `frontend/CLAUDE.md`.
- `API_BASE_URL` already ends in `/api`. Append only the route, or you get `/api/api/...`.


## 2026-09-01 — Networking: hardcoded LAN IPs removed, dev CORS + X-Device-Id (Vishwajeet)

### Why
`backend/.env` had `SUPABASE_URL` pinned to `http://10.37.66.122:54321` — a dead DHCP lease.
Every backend→Supabase call failed with `ConnectTimeoutError` then `EHOSTDOWN`, and
`POST /api/auth/request-otp` returned 500.

### Changed endpoints
None. No route, response shape or error code changed. This is networking config only —
rate limiting, the circuit breaker, Turnstile and OTP logic are all untouched.

### Backend
- `SUPABASE_URL` is now `http://127.0.0.1:54321`. The backend and local Supabase are on the
  same machine, so it never needs a LAN address again.
- The server binds `0.0.0.0` (override with `HOST`; `PORT` still configurable) and prints its
  current LAN address on boot, e.g. `LAN: http://10.37.66.39:5000`. Read it off the log.
- `backend/.env.example` added (placeholders only, no real keys).

### CORS — **read this, it affects the website**
- **Production behaviour is unchanged**: still `Access-Control-Allow-Origin: *` for every
  origin. It branches on `NODE_ENV === 'production'`, so **a real deploy must set
  `NODE_ENV=production`** or it falls into the dev rules and rejects the hosted origin.
- In development only, allowed origins are `localhost` / `127.0.0.1` / `::1` / `10.x` /
  `192.168.x` / `172.16–31.x`, on **any** port. So `http://<mac-lan-ip>:5173` now works from
  your phone's browser and from a second laptop without any config edit.
- `allowedHeaders` is now explicit: `Content-Type, Authorization, X-Device-Id`. If you add a
  new custom request header on the web side it must be added to that list in `app.js` or its
  preflight will fail. Ping me rather than editing `app.js` yourself.

### Mobile
- New `mobile/src/lib/config.ts` is the single resolver for `API_BASE_URL` / `SUPABASE_URL`.
  `EXPO_PUBLIC_*` wins when set; otherwise the host comes from the Expo dev server
  (`Constants.expoConfig.hostUri` → `expoGoConfig.debuggerHost`) with port 5000 / 54321.
  `src/lib/devHost.ts` is deleted.

### Known issue — storage image URLs (not fixed here)
`getPublicUrl()` derives storage URLs from `SUPABASE_URL` and those URLs are **written into
the database** (`users.avatar_url`, `products.image_urls`). With loopback restored, newly
uploaded images get `http://127.0.0.1:54321/...`, which on a phone means the phone itself, and
rows written under the old lease still hold `http://10.37.66.122:54321/...`. Both render broken
off-laptop. Existing rows are unaffected on the laptop itself. Fixing it means rewriting the
host at render time (or at read time in the controllers) — I did not touch it because it is
outside this task and `user.controller.js` is yours. Say if you want it next.

### What NOT to do yet
- Don't put a LAN IP back into any `.env` to work around the image issue — that is the bug
  this entry removes. See the new "Networking" section in `backend/CLAUDE.md`.


_Newest at the top._

## 2026-08-25 — Messages: chat surface design pass (Neeraj)

Web only (`frontend/`). CSS + presentational JSX. **No backend, API or data-shape change.**

### ⚠️ Doc conflict — needs a decision from both of us
`DESIGN.md` calls itself canonical but was never implemented, and it disagrees with the
code on three points:
| | `DESIGN.md` says | Repo actually has |
|---|---|---|
| Tokens | `src/styles/tokens.css` | **file does not exist**; tokens live in `global.css` |
| Palette | paper/ink + highlighter yellow `#FFD43B` | purple / pink / blue |
| Type | Khand + Instrument Sans | Bree Serif + **Inter** (which `DESIGN.md` §3 bans by name) |

`CLAUDE.md` §9 also lists `--pink-light #FFF4F7` / `--bg #F8F9FB`; `global.css` has
`#f4e0e4` / `#f2e5e1`. I built on what the code actually has (purple/pink) and invented no
new palette, but one of the two documents needs to be retired or rewritten.

### What changed
- **Unread divider** now has a rule running out to each side of the count, fading toward the
  gutters, on a brand-tinted pill. It's the one sharp accent on the canvas.
- **Message grouping:** consecutive messages from one person render as a block — only the
  last bubble keeps the tail and the avatar. The unread line also ends a run. Previously a
  run of four showed four identical avatars stacked.
- **Only arriving messages animate.** History renders settled (`openingIdsRef`). Opening a
  thread used to fly every message in at once, which fought the unread-line anchor.
  Entrance curve changed from a spring overshoot to a settle.
- Bubbles now use `var(--purple)`/`var(--pink-dark)` instead of hardcoded hex, with
  two-layer elevation; received bubbles get a hairline instead of a shadow.
- Canvas grain thinned (was 2.5px dots on a 20px grid — read as polka dots).
- **Contrast fix:** received-bubble timestamps were `#aaa` with `opacity: 0.7` on white,
  about 2.3:1. Now ~5:1.
- Added `:focus-visible` rings and a `prefers-reduced-motion` block — the file had neither.
  The spinner and typing dots keep animating on purpose; both signal live state.

### Known gaps (not fixed here, flagging deliberately)
- **Inbox rows are `<div onClick>`** — not reachable by keyboard at all. Needs `role`/
  `tabIndex`/key handling, which is a behaviour change, so I left it.
- A failed history load logs to console and shows an empty thread — no visible error state.
  `DESIGN.md` §9 wants all four async states on every surface.

### How I tested it
Production build passes. Rendered the real stylesheet against a static DOM harness in
headless Chrome at 1440px and 390px and iterated on that. **That verifies CSS only** — the
grouping logic and the divider in the live app are unverified. Please check in the browser.

---

## 2026-08-25 — Messages: read receipts were undoing the unread anchor (Neeraj)

Web only (`frontend/`). Follow-up to the entry below — that fix was correct but got
overwritten a frame later.

### The bug
The thread anchored on its unread divider, then slid to the newest message anyway.
`markAsRead` flips `is_read` on **every** unread row in one statement, and the navbar's
`PUT /messages/deliver` does the same for `is_delivered` on app load. Each row comes back
as its own realtime UPDATE, the UPDATE handler calls `setMessages(prev => prev.map(...))`,
and the scroll effect keyed on `[messages]` treated every one of those as "new message
arrived" and scrolled to the bottom. The more unread messages, the more reliably it
happened — which is why it looked like the anchoring never worked at all.

### What changed
- The scroll effect now compares `messages.length` against the previous render. A receipt
  rewrites rows in place without growing the list, so it no longer moves the viewport.
- An appended message is followed only if the reader is within 80px of the bottom or sent
  it themselves; otherwise position is held, so an incoming message can't yank someone out
  of the backlog they're reading.
- Switched to `useLayoutEffect` so the anchor is applied before paint instead of after.

### Heads-up for mobile
`markAsRead` fanning out one realtime UPDATE per row is backend behaviour, not a web quirk
— any client that both subscribes to UPDATE and auto-scrolls on message-state change will
hit this. Worth knowing before the mobile chat screen grows the same feature.

### How I tested it
Production build passes. **Browser behaviour unverified** — needs a real two-account run:
A sends ~10 messages, B opens the thread and should land on the divider and stay there.

---

## 2026-08-25 — Messages: unread-anchored scroll + the open chat survives navigation (Neeraj)

Web only (`frontend/`). **No backend or API change** — same endpoints, same shapes.

### What was wrong
1. Opening an old thread animated the whole backlog past the reader for ~1s before
   settling at the bottom. Cause: `scroll-behavior: smooth` on `.messagesContainer`
   turned the open-time `scrollTop = scrollHeight` jump into a visible scroll.
2. Leaving `/messages` for another page and coming back dropped you on the empty
   "Your Conversations" panel — the open thread was only ever held in the URL, and
   the navbar link goes to a bare `/messages`.

### What changed
- `.messagesContainer` no longer sets `scroll-behavior`. Messages.jsx now picks per
  scroll: **instant** when a thread opens, **smooth** when a message arrives.
- A thread opens anchored on its first unread message with a WhatsApp-style
  "N unread messages" divider, computed from the history response *before*
  `PUT /messages/read` flips `is_read`. Fully-read threads still open at the bottom.
- New localStorage key **`yahora_active_chat`** — `{ contact_id, product_id }` of the
  last-opened thread. Restored on mount when there is no `?user=&product=` deep link
  (the deep link still wins). Cleared by the mobile back button and by
  `AuthContext.clearStoredSession()` on logout.
- Effect 1 no longer depends on `searchParams`. It was re-running on every chat click,
  because `handleSelectChat` navigates to keep the URL in sync — that refetched the
  inbox *and* the just-clicked thread's history on every click.

### For mobile
The same two problems most likely exist in `mobile/`, and the fix carries over. If you
add the storage key there, keep the name `yahora_active_chat` so the behaviour reads the
same across clients.

### How I tested it
Production build passes. **Browser behaviour is unverified — please check:** opening a
thread with unread messages lands on the divider, a fully-read thread lands at the
bottom, and Marketplace → back to Messages reopens the same chat.

---

## 2026-08-25 — seed.sql + seedDemo.js: seeded accounts could never log in with a password (Vishwajeet)

### The bug

Every seeded account was handed a real bcrypt password and a `has_password = false` flag at the
same time. `loginWithPassword` checks that flag **before** it reaches GoTrue, so **username and
email login were both dead for all 11 `seed.sql` accounts and all 15 `seedDemo.js` personas** —
and because the endpoint returns one generic `INVALID_CREDENTIALS` for every failure (runbook
§0.6), it looked like a wrong password rather than bad seed data.

### Why 007's backfill never fixed it

`has_password` is a cache of `auth.users.encrypted_password` (005 §2). Migration 007 has a
backfill that reconciles the two — **but migrations run BEFORE `seed.sql` on a
`supabase db reset`.** The backfill executes against a database these rows do not exist in yet,
so it can never reach them. Every reset re-created the broken state, which is why this survived
007 landing.

`handle_new_user` (005) also creates the `public.users` row first with the column at its
`default false`, so the value has to be in the `on conflict do update` list, not just the insert.

### What changed

| File | Change |
|---|---|
| `supabase/seed.sql` | `pg_temp.seed_user()` now writes `has_password = true` in both the insert and the `do update set` |
| `backend/scripts/seedDemo.js` | the `users` upsert now carries `has_password: true` |

No migration, no schema change, no production impact. Local test data only.

### How I tested it

`supabase db reset`, then:

```
11 of 11 seeded users:  has_password=true,  real_password=true
stale rows (real password, flag false):     0

POST /api/auth/login-password
  arjun.mehta        -> 200  session OK     ← username login, was failing
  arjun@iiitk.ac.in  -> 200  session OK     ← email login
  vishwajeet.singh   -> 200  session OK
  test.noida         -> 200  session OK
  arjun.mehta + wrong password -> 400 INVALID_CREDENTIALS   ← still correctly rejected
```

### What NOT to do yet

- **Don't add a `has_password` backfill to a new migration to "fix" this.** The ordering makes
  that useless for seed data — migrations always run first. The seed file is the only place
  this can be set.

## 2026-08-25 — 📮 BLOCK G — Migration 004 (RLS stage 2) shipped to production (Vishwajeet)

> This is the **Block G** entry (`docs/PHASE_1_RUNBOOK.md` §G, Block H checklist).
> The drift investigation that preceded it — why production had RLS on with no policies — is a
> separate entry below, and the full audit trail is `docs/PROD_RECONCILIATION.md`.

### Migrations applied

- `20260823140202_rls_stage2_users_messages.sql` (004) — **local + production**, 15:30 IST

### What 004 does

**`public.users`** — RLS on, `anon` loses `SELECT`, and:

```sql
create policy users_select_own on public.users
  for select to authenticated
  using (id = (select auth.uid()));
```

Both direct frontend reads (`Marketplace.jsx:490`, `ProductDetail.jsx:130`) are `.eq("id", me)`
on the caller's own row, so own-row SELECT is the entire requirement. **The student directory is
now unreachable from the publishable key.** Profiles, seller cards and search all go through the
backend on the service-role key and are unaffected.

**`public.messages`** — RLS on, `anon` loses `SELECT`, and:

```sql
create policy messages_select_own on public.messages
  for select to authenticated
  using (sender_id = (select auth.uid()) or receiver_id = (select auth.uid()));
```

This one does double duty. `Messages.jsx:352` and mobile `RealtimeContext.tsx:181` subscribe to
`postgres_changes` on `public.messages` **with no filter**, deciding mine-versus-yours in
JavaScript. Until today that meant the anon key was subscribed to every message row in the
database and merely choosing not to render most of them — **readable off the websocket with
DevTools open.** Realtime re-checks the SELECT policy per row, so that filtering now happens in
the database where it cannot be bypassed. **Neither client needed a code change.**

**`avatars` bucket** — the `Avatar uploads` INSERT policy narrowed from `anon, authenticated`
to `authenticated`. Viewing is unaffected; the bucket stays `public = true`.

> The `(select auth.uid())` wrapping is load-bearing. Bare `auth.uid()` is re-evaluated per row;
> wrapped in a scalar subquery it becomes a once-per-query InitPlan. Do not "simplify" it.

### Verification status against the runbook

| Step | What | Status |
|---|---|---|
| **G4** | SQL impersonation of a specific student | ✅ **Done on production.** With a real `sub` claim: own user rows `0 → 1`, own messages `0 → 82`. As `anon`: `permission denied` on both tables. As `service_role`: 112 users / 141 messages, unchanged. |
| **G6** | `supabase db push` + re-verify | ✅ **Done.** Ledger ends at `20260823140202`; `schema-drift.mjs` reports 10/10 MATCH, local ⇄ production. |
| **G5** | 👁️ Two real accounts, two browser profiles, on the live site | ✅ **Done.** |

**G5 is the outstanding item and it cannot be done from here.** It needs two real accounts in two
browser profiles against the live site, checking that (a) two students see different message
counts, (b) live chat still works between them, and (c) the marketplace campus switcher still
works for a logged-in student — that last one is the `users` read 004 narrows.

> If the campus switcher breaks, the cause is almost always that `setSession()` did not fire on
> that page load. Check in the console: `await supabase.auth.getUser()` should return the
> student, not null.

### BREAKING for direct Supabase queries

`anon` no longer has `SELECT` on `public.users` or `public.messages`. It previously returned an
empty set; it now throws:

```
ERROR: permission denied for table users
```

**Any direct `.from('users')` / `.from('messages')` call that runs before
`AuthContext.setSession()` resolves will now throw instead of quietly returning `[]`.** All four
known call sites already gate on `sessionReady` (`navbar.jsx:189`, `Marketplace.jsx:475`,
`ProductDetail.jsx:119`, `Messages.jsx:348`). Gate any new one the same way.

### What NOT to do yet

- **Don't add INSERT/UPDATE/DELETE policies to either table.** 004 is SELECT-only on purpose.
  Every write goes through the Express backend on the service-role key, which bypasses RLS — a
  write policy would widen what the public anon key can reach for no benefit.
- **Don't add `public.products` to the `supabase_realtime` publication** without adding a SELECT
  policy in the same migration, or the live view/like counters stay dead and nobody connects the
  two events.

## 2026-08-25 — 🚨 PRODUCTION: migrations 007 and 004 applied. Two live outages fixed. (Vishwajeet)

### Migrations applied

- `20260823055415_login_identity.sql` (007) — **applied to PRODUCTION 15:28 IST**
- `20260823140202_rls_stage2_users_messages.sql` (004) — **applied to PRODUCTION 15:30 IST**

Both via `supabase db push`, one at a time, verified between. Production's ledger now ends at
`20260823140202` and matches local exactly. Full audit trail, including the pre-state and every
verification result, is in **`docs/PROD_RECONCILIATION.md` §10**.

### Neeraj — two things were broken on production and are now fixed. Neither was your code.

**1. Every direct browser→Supabase read was silently returning zero.**

Production had RLS switched **on** for `public.users` and `public.messages` — by a dashboard
toggle, not by a migration — with **no policies on either table**. RLS enabled with no policy
denies every row, and because the `SELECT` grant was still in place, PostgREST returned an
**empty result set rather than an error**. Measured with a real student's JWT before the fix:

```
authenticated, real sub claim ->  users: 0 rows   messages: 0 rows
```

That is the unread-message badge in `navbar.jsx:199`, the campus resolution in
`Marketplace.jsx:490` and `ProductDetail.jsx:130`, and the Realtime subscriptions in
`Messages.jsx:352`. All of them were reading nothing, silently, and had been since the toggle.
After 004:

```
authenticated, same JWT        ->  users: 1 row    messages: 82 rows
```

**If you saw an empty inbox badge or a marketplace that couldn't tell "my campus" from
"browse-only" on production, that was this.** Nothing in `frontend/` needed changing.

**2. Password login was broken for every account on production.**

All **112** production accounts had a real password in `auth.users` and `has_password = false`
in `public.users` — 005 added the column with `default false`, 006 backfilled only `username`,
and nothing ever reconciled the flag. `loginWithPassword` rejects on that flag *before* it
reaches GoTrue and returns the generic `INVALID_CREDENTIALS`, so it looked like a wrong
password rather than a backend fault. 007's backfill corrected all 112. `get_login_identity()`
also now exists on production.

### Changed endpoints

- None. No API shape changed, no route changed. This is a database-only change.

### BREAKING for direct Supabase queries — `anon` can no longer read these tables

`anon` **lost its `SELECT` grant** on `public.users` and `public.messages`. It previously
returned an empty set; it now fails loudly:

```
ERROR: permission denied for table users
ERROR: permission denied for table messages
```

This is intentional and is defence-in-depth on top of the policies. **Any direct
`supabase.from('users')` or `.from('messages')` call that runs before
`AuthContext.setSession()` resolves will now throw instead of quietly returning `[]`.** All
four known call sites already gate on `sessionReady` (`navbar.jsx:189`, `Marketplace.jsx:475`,
`ProductDetail.jsx:119`, `Messages.jsx:348`), so nothing should hit this — but if you add a
fifth, gate it too.

The policies are SELECT-only and own-rows-only:

- `users_select_own` — `authenticated`, `id = (select auth.uid())`
- `messages_select_own` — `authenticated`, `sender_id = uid OR receiver_id = uid`

Every write still goes through the Express backend on the service-role key, which bypasses RLS.
Backend behaviour is completely unchanged — `service_role` still sees all 112 users and 141
messages.

### Also changed

- `storage.objects` policy **`Avatar uploads`** narrowed from `anon, authenticated` to
  `authenticated` only. Avatar *viewing* is unaffected (bucket stays `public = true`), and both
  clients are authenticated by the time they upload. Reading avatars logged-out still works.

### Security note

Realtime's unfiltered `postgres_changes` subscriptions on `public.messages`
(`Messages.jsx:352`, mobile `RealtimeContext.tsx:181`) were previously subscribed to **every
message row in the database** and merely choosing not to render most of them — readable off the
websocket with DevTools open. Supabase Realtime re-checks the SELECT policy per row, so
`messages_select_own` now filters that in the database. **Neither client needed a code change**,
but the exposure was real until 15:30 today.

### How I tested it

Every §6 verification query in `docs/PROD_RECONCILIATION.md`, plus role impersonation with a
real student JWT, plus a full `backend/scripts/schema-drift.mjs` re-run: **10 of 10 comparisons
MATCH, zero differences between local and production.**

### What NOT to do yet

- **Don't run the §7 "pre-toggle rollback".** It is documented at Vishwajeet's request and
  carries a blocking warning: it re-opens every `users` and `messages` row to the publishable
  key, which ships in the JS bundle. If a rollback is ever needed, the step-2 rollback above it
  is the correct one.
- **`docs/CURRENT_STATE.md` is stale** and now more so: it lists `performance_and_grants` and
  `rls_stage1` as unpushed (both applied), and item 1 says RLS is off on all 13 public tables
  (all 16 have it on; `users`/`messages` now have policies). Left untouched deliberately —
  it needs a proper rewrite, not a patch.
- **Local `supabase db reset` still leaves seeded users with `has_password = false`**, because
  007's backfill runs during migration and `seed.sql` runs after. Production is unaffected, but
  **password login will fail locally after every reset**. Fix belongs in `seed.sql`; not done.

## 2026-08-25 — The §1.6 token fix, finished: chat history + all nine like/save call sites (Vishwajeet)

### 🚨 Neeraj — I edited five of your files, all under `frontend/src/pages/`.

`messages/Messages.jsx` · `marketplace/Marketplace.jsx` · `product/ProductDetail.jsx` ·
`publicProfile/PublicProfile.jsx` · `dashboard/Dashboard.jsx`. Every change is inside an existing
handler; no file gained an import, a dependency or a new component. Say the word and I'll hand any
of it back.

Found while testing Block G5. **Symptom:** send a message, it appears instantly and bumps the
unread dot; close the chat and reopen it and **every message in the thread is gone.** Nothing was
ever deleted — the messages were in the database the whole time.

**Cause:** `GET /api/messages/history` went behind `requireAuth` in the §1.6 security fix (my
entry of 2026-08-23, which listed `Messages.jsx` line ~300 as needing an `Authorization` header).
That header was never added. So the call returned `401`, `data.messages` came back `undefined`,
and `setMessages(data.messages || [])` emptied the thread.

**Why it read as data loss rather than as an error:** `res.ok` was never checked, and `res.json()`
parses a 401 body perfectly happily — it is just `{"error":"UNAUTHORIZED"}`. Nothing threw, so the
`catch` never fired and the console stayed clean. Meanwhile realtime kept working the whole time
because it talks straight to Supabase and never touches this endpoint. New messages arriving live
while old ones vanished on reload is exactly the shape those two facts predict.

Reproduced against the local stack on a seeded Arjun↔Priya thread:

```
GET /messages/history  no header    401   (data.messages||[]).length = 0   ← what the UI rendered
GET /messages/history  with header  200   messages = 13
send → close → reopen  with header  200   messages = 14, new one present
```

### What I changed

Three lines of behaviour in `handleSelectChat`, nothing else in the file:

1. `Authorization: Bearer <token>` from `localStorage.getItem('yahora_session')`. Read **at call
   time**, not cached at mount — supabase-js rotates the access token in the background and your
   `persistSession()` writes the new one back to that key, so a cached copy goes stale on a page
   left open.
2. `if (!res.ok) throw` before the body is trusted, so this class of failure can never be silent
   again.
3. `setMessages([])` in the `catch`. On a failed load the previous chat's messages were still on
   screen under the newly selected contact's header — one student's conversation rendered as if it
   belonged to another. Blank is the safer wrong answer.

`npm run build` passes.

### Same root cause, ALSO fixed — the nine like/save call sites

The 2026-08-23 entry listed five routes. `/messages/history` was one; `/like` and `/save` are the
others, and **every one of their call sites was missing the header too.** All nine are now
patched, in four more of your files:

| File | Handlers |
|---|---|
| `frontend/src/pages/marketplace/Marketplace.jsx` | `handleToggleGridLike`, `handleToggleGridSave`, `handleSwipeLike` |
| `frontend/src/pages/product/ProductDetail.jsx` | `handleToggleLike`, `handleToggleSave` |
| `frontend/src/pages/publicProfile/PublicProfile.jsx` | `handleToggleLike`, `handleToggleSave` |
| `frontend/src/pages/dashboard/Dashboard.jsx` | `handleToggleGridLike`, `handleToggleGridSave` |

Same three-part treatment as the chat fix: token read at call time, `if (!res.ok) throw`, and —
new here — **the optimistic update is rolled back in the `catch`.** Every one of these handlers
paints the heart or the bookmark immediately and then fired a request whose result it never looked
at. `Dashboard.jsx` had two literally empty `catch (e) {}` blocks. So a rejected like stayed lit
until the next reload, which is the same silent-failure shape that hid the 401 on
`/messages/history` for two days.

`handleSwipeLike` in `Marketplace.jsx` already reconciled against `!res.ok` — it kept its own
logic and only gained the header (plus a `.catch(() => ({}))` on `res.json()`, since a 401 body
is still JSON but an empty one would have thrown).

Verified against the local stack on a seeded Kurnool listing Arjun does not own:

```
POST /products/:id/like   no header    401 UNAUTHORIZED       ← what every one of them was doing
POST /products/:id/like   with header  200 is_liked: true
POST /products/:id/like   with header  200 is_liked: false    ← toggles cleanly both ways
POST /products/:id/save   no header    401 UNAUTHORIZED
POST /products/:id/save   with header  200 is_saved: true
POST /products/:id/save   with header  200 is_saved: false
```

`npm run build` passes with all nine in. Test rows were toggled back off; `product_likes`,
`product_saves` and `products.likes_count` are as I found them.

**`user_id` in the request bodies is left in place** on all nine, exactly as your 2026-08-23
instructions said was fine — the backend ignores it and takes the actor from the token. Removing
it would have been churn in your files for no behaviour change.

### Changed endpoints
- None. Backend untouched. `API.md` needed no edit.

### What NOT to do yet
- Don't add a user-facing error state to the chat pane on my account — the failed load now logs to
  the console and clears, but there is no UI for "couldn't load this conversation". That is a
  design call on your page, so I left it alone.

## 2026-08-25 — Onboarding and set-password now return a fresh `session` (Vishwajeet)

### 🚨 Neeraj — this closes the open question from CC-4. You asked, here it is.

The CC-4 entry (2026-08-20) ended with a choice for you: *"re-authenticate after the 200, or I
add a `session` to the response the way `verify-otp` does."* **I shipped the `session`.** Both
password-setting endpoints now hand the caller a live session in the `200` body.

**If you built the re-authenticate workaround, you can delete it.** If you have not built
anything yet, this is now the simple path: read `session` off the `200` and store it exactly the
way you store `verify-otp`'s. Same shape, same key, no new parsing.

### Changed endpoints (BREAKING — additive, but the token you hold changes)

- **`POST /api/auth/onboarding`** — `200` now carries a third top-level key:

  ```json
  { "message": "...", "userProfile": { }, "session": { "access_token": "...", "refresh_token": "..." } }
  ```

- **`POST /api/auth/set-password`** — `200` now carries a third top-level key:

  ```json
  { "message": "Password set", "has_password": true, "session": { "access_token": "...", "refresh_token": "..." } }
  ```

`message`, `userProfile` and `has_password` are **unchanged**. Nothing was removed or renamed.

**⚠️ `session` can be absent.** It is omitted entirely — never sent as `null` — if the
re-signin fails. The password change has already committed at that point and cannot be rolled
back, so the request still returns `200` with the rest of the body. **Treat a missing `session`
as "send them to log in", not as an error.** Don't `throw` on it; the account is fine, the
profile is saved, and the new password works.

### Why it was needed

`supabase.auth.admin.updateUserById(userId, { password })` makes GoTrue delete **every** session
for that user. Measured on the local stack: `auth.sessions` 2 → 0, `auth.refresh_tokens` 2 → 0,
and GoTrue answers `403 session_not_found` for a token with 59 minutes of life left. Both of
these endpoints set a password, so both were logging the student out — one at the exact moment
they finished signing up, the other when they changed their password in settings.

**The revocation itself is unchanged and I am not going to change it.** A password change
*should* log out every other device — that is the security property, and it still holds. The bug
was only that the caller was caught in their own blast radius. Now the caller, and nobody else,
gets a replacement minted from the password they just typed.

### Migrations applied

- None. Controller-only change, `backend/src/modules/auth/auth.controller.js`.

### Test data

- `node backend/scripts/diagnose-token.mjs` gained **S10**, a pass/fail regression gate (S1–S9
  are still diagnosis-only). It signs up a third fixture user and proves, for each endpoint,
  that: the `200` carries `session.access_token`; the new token differs from the caller's old
  one; the new token is accepted by **GoTrue's own `/auth/v1/user`**, not just our middleware;
  and the old token is refused by **both**. 15/15 assertions pass. The script now exits non-zero
  if any S10 check fails.
- Fixture users are `blockg.diag*@iiitk.ac.in`. Clear them with
  `node backend/scripts/diagnose-token.mjs --cleanup`.
- `node backend/scripts/verify-block-f.mjs` re-run: still 10/10.

### What NOT to do yet

- **Don't treat this as "password changes no longer log you out".** They still do, everywhere
  except the one device making the request. If you build a "signed in devices" screen, that is
  the behaviour to describe.
- **Don't read `session` from the error paths.** A `400`/`401`/`404` from either endpoint never
  carries one, and on those paths the password was not changed, so the token you already hold is
  still good.

## 2026-08-25 — §1.6 Bug 2: `PUT /api/products/:id` is a real partial update (Vishwajeet)

### 🚨 Neeraj — the good news first: a title-only edit now works.

`PUT /api/products/:id` used to require a numeric `price` in **every** body, even when only the
title was changing. Omitting it was a guaranteed **500**. If your edit form has a workaround
that re-sends the current price on every save, you can delete it — but you do not have to, a
body with a valid `price` behaves exactly as before.

The payload is now built from the keys actually present in the body. Absent keys are left
untouched. Presence is tested with `hasOwnProperty`, not truthiness, so `description: ''` and
`price: 0` are real edits and are written through.

### Changed endpoints (BREAKING)

- **`PUT /api/products/:id`** — three new 400-class codes replace what used to be a `500`:

  | Code | When |
  |---|---|
  | `INVALID_PRICE` | `price` was sent but does not parse to a finite number `>= 0`. `null`, `''` and booleans are rejected explicitly — `Number()` maps all three onto a finite number |
  | `MISSING_FIELDS` | the body carried none of the seven updatable keys. An `UPDATE` with no columns is a PostgREST error, not a no-op |
  | `DUPLICATE` / `INVALID_REFERENCE` | `23505` / `23503` from the update, via `mapDbError`. These used to surface as `INTERNAL_ERROR` |

  Updatable keys: `title`, `description`, `price`, `category`, `location`, `condition`,
  `status`. Anything else in the body is ignored. `university_id` and `seller_id` still cannot
  be changed here.

  **If your error handling branches on `INTERNAL_ERROR` for a failed save, it will stop
  matching.** A bad price is a 400 now, not a 500.

### Migrations applied

- None. Controller-only change.

### Test data

- None. `node backend/scripts/verify-block-f.mjs` covers this — T5 (title-only `PUT` returns
  200) and T5-verify (the title actually changed) flip from FAIL to PASS, 10/10 passing.

### What NOT to do yet

- Don't build a "clear the price" affordance. `products.price` is `NOT NULL`; sending `null`
  is an `INVALID_PRICE`, not a way to unset it.
- The ownership check from the 2026-08-23 entry is unchanged — the caller must still be
  `seller_id`, and validation runs **after** that check, so a non-owner gets `403` and learns
  nothing about whether their payload was valid.

## 2026-08-23 — §1.6 security fixes: product ownership, cross-campus interaction, chat-history injection (Vishwajeet)

### 🚨 BREAKING — Neeraj, three web calls will start returning 401. Read before you pull.

`requireAuth` was added to five routes. Two of them your web app already authenticates
correctly; **three of them it does not send a token on at all**, and they will 401 until you add
one. Mobile is unaffected — `mobile/src/lib/api.ts` attaches the header on every request.

| Route | Web today | Action |
|---|---|---|
| `PUT /api/products/:id` | ✅ sends Bearer (`Sell.jsx:171`) | none |
| `DELETE /api/products/:id` | ✅ sends Bearer (`Dashboard.jsx:766`) | none |
| `POST /api/products/:id/like` | ❌ **no header** | add `Authorization` |
| `POST /api/products/:id/save` | ❌ **no header** | add `Authorization` |
| `GET /api/messages/history` | ❌ **no header** | add `Authorization` |

Exact call sites to patch — all of them read the token from `localStorage.getItem('yahora_session')`:

- `frontend/src/pages/marketplace/Marketplace.jsx` — lines ~571, ~596, ~628
- `frontend/src/pages/product/ProductDetail.jsx` — lines ~207, ~223
- `frontend/src/pages/publicProfile/PublicProfile.jsx` — lines ~107, ~129
- `frontend/src/pages/dashboard/Dashboard.jsx` — lines ~720, ~741
- `frontend/src/pages/messages/Messages.jsx` — line ~300

**`user_id` in the like/save body is now ignored.** You can leave it in place — it is read from
the token instead and the body value is dropped in silence — but it does nothing. Sending it is
no longer how the actor is chosen, which was the whole bug.

This is the same shape of change as CC-4: the actor cannot come from the request, because the
request is what the attacker controls.

### Changed endpoints (BREAKING)

- **`PUT /api/products/:id`** — auth required; caller must be `seller_id`. New `401`, `403`,
  `404`. A non-existent id was a 500, now a clean 404.
- **`DELETE /api/products/:id`** — same. ⚠️ **Deleting a non-existent id used to return `200`;
  it now returns `404`.** If any client treats "delete succeeded" as idempotent, check it.
- **`POST /api/products/:id/like`** and **`/save`** — auth required; `user_id` ignored; new
  `401`, `403 CROSS_CAMPUS_INTERACTION_BLOCKED`, `404`.
- **`GET /api/messages/history`** — auth required; caller must be one of the two parties; all
  three query params validated. ⚠️ **A missing or malformed param used to be a `500`, now a
  `400 INVALID_FORMAT`.**

All five 500 bodies changed shape from `{ "error": "Failed to …" }` to
`{ "error": "INTERNAL_ERROR", "message": "Failed to …" }`. **If you render `data.error`
directly anywhere on these paths, render `data.message` instead** — otherwise students will see
`INTERNAL_ERROR`.

### What was actually wrong

**1. `updateProduct` / `deleteProduct` — no ownership check at all.** They took the id from the
URL and acted on it with no actor. Anyone who knew a listing's uuid could rewrite its title,
price and status, or delete it outright, on any campus — cascading to its comments, likes,
saves and purchases. Now: fetch `seller_id` first, `404` if absent, `403` if it is not
`req.user.id`.

**2. `toggleLikeProduct` / `toggleSaveProduct` — two holes.** The actor came from
`req.body.user_id`, so anyone could like or unlike as any student. And there was no campus
check: our rule is browse-across-campuses / interact-only-on-your-own, and `GET /api/products`
is deliberately cross-campus, so the API permitted an interaction the product rule forbids.

⚠️ **A `NULL` `university_id` on either side is treated as a mismatch, not a pass.**
`handle_new_user` (005) creates a user row with `university_id` NULL when the email domain is
unknown, and "I cannot establish that you are on this campus" has to fail closed. No real
student is affected — every account created through `request-otp` has a validated domain.

**3. `getChatHistory` — the `.or()` filter injection was real, not theoretical.** I proved it
before fixing it. `userId`/`contactId` are interpolated into a PostgREST `.or()` filter
*expression*; unlike `.eq()`, that string is a grammar parsed server-side, so a `,` or `)` in
the value closes the expression and appends the attacker's own conditions. On a product
carrying two separate conversations, `<uuid>),or(id.not.is.null` returned **all 9 messages
instead of the caller's 6** — leaking a thread the caller was not in. Three of four payloads I
tried worked.

Fixed by validating all three params against an anchored uuid regex *before* they reach the
string — once concatenated there is nothing to escape with, so refusing non-uuids is the only
correct control. Plus a participation check: `req.user.id` must be one of the two parties.
Either party is accepted, because the thread is symmetric and a client passing the pair in the
other order is still asking for its own conversation.

### NOT fixed here, deliberately

Still taking their actor from the request, and **out of scope for this change**:
`createProduct` (`seller_id` in body), `addComment`, `toggleCommentVote`, `markProductAsSold`,
`markProductAsAvailable`, `getInbox` (`:userId` in the path), `sendMessage` (`sender_id` in
body), `markAsRead`, `markAsDelivered`, and the whole read side listed in the CC-4 audit.
One security change per PR.

### How I tested it

Against the local DB with three real tokens (Arjun @ Kurnool, Priya @ Kurnool, Neeraj @ NIET):

```
owner edits own listing                  200   ← legitimate use intact
non-owner edits                          403 FORBIDDEN
unknown listing                          404 NOT_FOUND
no token                                 401 UNAUTHORIZED
owner deletes own listing                200   (row confirmed gone)
same-campus like / unlike / save / unsave 200  ← all four toggles intact
cross-campus like  (Kurnool → NIET)      403 CROSS_CAMPUS_INTERACTION_BLOCKED
NIET student likes NIET listing          200   ← not over-restricted
spoofed body user_id + valid token       200, and the row written was the TOKEN's user
participant reads own thread             200 (6 msgs, 0 from the other thread)
same thread, pair reversed               200   ← not over-restricted
third party reads that thread            403 FORBIDDEN
3 x .or() injection payloads             400 INVALID_FORMAT
```

Test data was restored afterwards (16 messages, seeded listing untouched).

## 2026-08-23 — Migration 007, the two missing username endpoints, and the /auth→home redirect (Vishwajeet)

### 🚨 Neeraj — I edited four of your files. Read this before you pull.

Three of them because the web app was calling backend routes that did not exist, and one
because a race in `App.jsx` was eating first-time signups. All four are yours; I have not
touched anything else under `frontend/`. Say the word and I will hand any of it back.

| File | What I did |
|---|---|
| `backend/src/modules/user/user.controller.js` | **added** `checkUsernameAvailable`, `getUsernameSuggestions`, `classifyUnavailableUsername` at the bottom. The four pre-existing handlers are untouched. |
| `backend/src/modules/user/user.routes.js` | **added** the two GET routes, registered above the `/:userId/...` routes |
| `frontend/src/App.jsx` | `GuestOnly` no longer redirects to `/` |
| `frontend/src/contexts/AuthContext.jsx` | new `profileComplete` / `setProfileComplete` on the context |
| `frontend/src/pages/auth/Auth.jsx` | sets `profileComplete` before `login()` |
| `frontend/src/pages/onboarding/onboarding.jsx` | sets `profileComplete` on success; `reserved` copy now reads as "taken" |

---

### 🐛 First-time signup was landing on the home page instead of /onboarding

Not a logic error in `Auth.jsx` — that file was routing correctly. It is a **render-ordering
race**, and it is worth understanding because it will bite again anywhere a guard keys on
`isAuthenticated`.

`login()` flips `isAuthenticated` with an ordinary **urgent** update. `navigate()` does not:
`<BrowserRouter>` commits its location inside `React.startTransition` (react-router 7.13.1,
`dist/development/chunk-LFPYN7LY.mjs` — `setState` → `startTransition`). React runs the urgent
update **first**, so there is one real render where the app is authenticated and the location is
**still `/auth`**. `GuestOnly` ran in that window, returned `<Navigate to="/" replace />`, and
that redirect beat the pending transition to `/onboarding`. The student never saw onboarding.

**Reordering the two calls does not fix it** — the urgent update wins whichever order they are
written in. The fix is to make the guard agree with the login handler instead: both now resolve
the destination from one `profileComplete` flag, so whichever render lands first, the student
ends up in the same place.

`GuestOnly` now sends an authenticated visitor to `/onboarding` or `/dashboard`, never to `/`.
That also fixes a quieter bug: a logged-in student with an unfinished profile who typed `/auth`
used to be dropped on the home page with no route back into onboarding.

**New localStorage key: `yahora_profile_complete`** (`"true"` / `"false"`). Cleared by
`logout()`. It is a **routing hint, never an authorisation decision** — the backend re-derives
completeness from the database on every request that depends on it.

⚠️ **If you add another `login()` call site, set `profileComplete` BEFORE it.**

---

### 🐛 The username field gave no availability feedback — the endpoints did not exist

`onboarding.jsx` was calling `GET /api/users/username-available` and
`GET /api/users/username-suggestions`. Neither was implemented, so every keystroke got Express's
HTML 404 (`Cannot GET /api/users/username-available`), `res.json()` threw, and the page fell to
its `unknown` status. No "available", no "taken", and **nothing at all for reserved words**.

Both are now live, implemented to the contract in `API.md` — which I also updated, resolving the
four open TODOs on those two endpoints. Verified against the local DB:

```
totallyfreehandle  {"available":true}
arjun.mehta.1187   {"available":false,"reason":"TAKEN","suggestions":["amehta.1187", ...]}
admin              {"available":false,"reason":"RESERVED","suggestions":["admin.6791", ...]}
ab                 {"available":false,"reason":"INVALID_FORMAT","suggestions":[]}
UPPERCASE          {"available":true}          ← folded to lowercase, as the RPC does
(no param)         400 {"error":"MISSING_FIELDS","message":"A username is required."}
```

I did **not** reimplement any username rule. `is_username_available()` still decides; the
controller only *labels* the reason on the failure path by re-querying the three tables, exactly
as you told me to in the CC-4 entry.

**One product change you should push back on if you disagree:** `reserved` now renders the
**same sentence** as `taken` ("That handle is already taken. Please choose another."). Your
original copy distinguished them, and your reasoning was sound — but "reserved" reads as a
system error a student might retry, and repeated across guesses it maps out the reserved list.
The API still returns the true `reason: "RESERVED"`; only the copy is shared. `REASON_TO_STATUS`
still keeps the four statuses distinct, so nothing is lost if you want to split them again.

---

### Migrations applied

- `20260823055415_login_identity.sql` (007) — **applied LOCAL ONLY. Not on production.**
  Vishwajeet pushes it.

**New function `get_login_identity(p_identifier)`** → `(id, email, has_password)`, for a
username **or** an email, in one call. `SECURITY DEFINER`, revoked from `PUBLIC`, `anon` and
`authenticated` (verified: `anon=f, authenticated=f, service_role=t`). Backend-only — it maps a
public handle to a private address and discloses whether an account exists at an address.
Do not call it from your module. `get_login_email()` still exists but no longer has a caller.

**007 also backfills `users.has_password`.** 005 added it with `default false`, 006 backfilled
only `username`, so all 20+ seeded accounts read `false` while having real passwords. 27 rows
corrected locally; zero rows disagree with `auth.users` afterwards; idempotent on a second run.

### Changed endpoints (NOT breaking — no shape change)

- **`POST /api/auth/login-password`** now resolves the identifier through `get_login_identity()`
  instead of `get_login_email()` + a `users` select. Request and response shapes, status codes
  and the single error string are all **unchanged**.

  Two things this fixes:
  1. The `[login] has_password=false for <uuid>` console line fired only for **username**
     logins — and a student who abandoned onboarding has `username = NULL`, so email is the only
     identifier they have. The line never fired for the one population it was written for.
     It now fires for both forms.
  2. **Username login was broken for every pre-existing account** (the stale `has_password`
     cache above). Fixed by 007's backfill.

  ⚠️ The order of operations is unchanged and still must not be reordered: rate limit → resolve
  identifier → `has_password` → sign in.

### New endpoints

- `GET /api/users/username-available?username=` → see API.md
- `GET /api/users/username-suggestions?name=`   → see API.md

### What NOT to do yet

- **Don't push 007 to production.** It is local-only until you have pulled the frontend changes;
  `has_password` becoming readable on the email path is only safe once the backfill goes with it,
  and both are in the same migration for that reason.
- **Don't call `get_login_identity()` from the user module.** Same rule as `get_login_email()`.
- I left a local test account behind for re-verifying the login fix:
  `abandoned.onboarding@iiitk.ac.in` — OTP-confirmed, no password, `username NULL`. Delete it
  whenever; `supabase db reset` will also clear it.

## 2026-08-20 — 🚨 CC-4: onboarding is now authenticated, and takes username + password (Vishwajeet)

### ⚠️ BREAKING — Neeraj, this one breaks your onboarding page. Read it before you pull.

**`POST /api/auth/onboarding` now requires a Bearer token.** It is the first and only route in
this backend behind `requireAuth`. `frontend/src/pages/onboarding/onboarding.jsx` sends
`userId` in the body with a `"replace-with-actual-uuid"` fallback and no `Authorization`
header — **it will get `401 UNAUTHORIZED` and no student can finish signup.**

Your N-Block B has to land in the same merge window as this. If N-Block A (the AuthContext
`setSession` fix) isn't in yet, wait — you cannot send a token you don't have.

Three things changed in the contract, all breaking:

1. **`userId` is gone from the body.** Not rejected — *ignored, in silence*. The target user is
   `req.user.id` from the verified token and nothing else. Sending it does nothing at all.
2. **`username` and `password` are now required.** Both compulsory, per runbook §0.6. There is
   no partial-onboarding path.
3. **Every error is now a CODE, not a human sentence.** This endpoint used to answer
   `{ "error": "Missing required fields. Name, Qualification, ..." }`. It now answers
   `{ "error": "MISSING_FIELDS", "message": "..." }`. **If you are matching on the error string
   anywhere, it will stop matching.** Switch to `error` for the code and render `message`.

### ⚠️ Neeraj — the token dies when onboarding succeeds. Your page must handle this.

I found this while testing, and it is not in the runbook. **GoTrue revokes every session when a
password is set**, and this endpoint sets one. So the access token your onboarding page used to
make the call is rejected the moment the call returns `200`. Verified: the same token that
worked on the request gets `403` from `/auth/v1/user` on the very next call.

The `200` body carries the profile row but **no new session**. If your page keeps using the
token it already has, the student appears logged out at the exact moment they finish signing
up — and it will look like your bug, not the backend's.

Options, your call: re-authenticate after the 200, or I add a `session` to the response the way
`verify-otp` does (the endpoint has the password in hand and can mint one). **I did not add it
in CC-4 because it changes the response contract and you are the one consuming it.** Tell me
which you want and I will ship it.

### Why the auth was urgent, not tidy-up

The old handler read the target user's id from the request body on a route with no middleware.
Anyone who knew a UUID could overwrite that student's profile. Once this same endpoint started
setting the account password, that request became **full account takeover** — send someone
else's UUID with a password you choose, then log in as them. That is why it went first.

### New endpoints
- None. `POST /api/auth/onboarding` changed; nothing was added.

### Changed endpoints (BREAKING)
- **`POST /api/auth/onboarding`** — auth now required; `userId` removed; `username` and
  `password` now required; error strings replaced by codes. Full contract in
  `backend/API.md` → *POST /api/auth/onboarding*.

### Changed endpoints (NOT breaking)
- **`POST /api/auth/demo-login` is fixed.** It had been returning 500 on every call since 005
  landed (see the entry below). Step 5 is now an upsert that reads the trigger's row back.
  Request and response shapes are unchanged.
- **`POST /api/auth/verify-otp`** — its profile insert is now an upsert with
  `ignoreDuplicates: true`, kept as a fallback for a database where the trigger is missing.
  No shape change.

### New error codes
`MISSING_FIELDS` · `WEAK_PASSWORD` · `COMMON_PASSWORD` — all 400, all carry a human `message`.
Added to the code table at the top of `API.md`. `USERNAME_TAKEN`, `USERNAME_RESERVED`,
`INVALID_FORMAT`, `CONTENT_TOO_LONG`, `UNAUTHORIZED` and `NOT_FOUND` already existed and are
now also raised here.

### New fields on existing responses
- `userProfile` from onboarding now carries `username` and `has_password: true` alongside
  `is_profile_complete: true`.

### What NOT to do yet
- **Don't reimplement username validation in your `PATCH /api/users/me/username`.** Call
  `is_username_available(p_username, p_user_id)` and catch `23505` — the availability check is
  not a reservation, and the unique index is the only thing that can arbitrate the race. Copy
  the shape from `completeOnboarding`; the controller only *labels* the reason by re-querying
  the three tables, it never re-derives the rules.
- **Don't fix the other user-id-from-body handlers.** The audit below is CC-6 / §1.6 work and
  several of the files are mine. Listed here so it's on the record, not so it gets fixed today.

### 🚨 Part A audit — every handler that trusts a caller-supplied user id

`requireAuth` exists on exactly one route. **Every write below is still unauthenticated and
takes its actor from the request.** Sorted by how bad it is.

| # | Handler | Where the id comes from | What an unauthenticated caller can do |
|---|---|---|---|
| 1 | `user.controller.js:75` `updateProfile` | `req.params.userId` + **`const updates = req.body` spread wholesale into `.update()`** | **Worst hole in the backend.** Arbitrary target, arbitrary columns. Post-005 that includes `username`, `has_password`, `is_profile_complete` and `university_id` — anyone can steal any handle, or move a student to another campus. `OWNER: Neeraj` |
| 2 | `products.controller.js:118` `deleteProduct` | `req.params.id` only — **no actor at all** | Delete any listing on any campus |
| 3 | `products.controller.js:85` `updateProduct` | `req.params.id` only — **no actor at all** | Rewrite title, price, status of any listing |
| 4 | `products.controller.js:8` `createProduct` | `req.body.seller_id` | Post a listing as any student |
| 5 | `products.controller.js:296` `toggleLikeProduct` | `req.body.user_id` | Like/unlike as anyone *(named in CURRENT_STATE item 4)* |
| 6 | `products.controller.js:323` `toggleSaveProduct` | `req.body.user_id` | Save/unsave as anyone *(named in CURRENT_STATE item 4)* |
| 7 | `products.controller.js:349` `addComment` | `req.body.user_id` | Comment as any student — the campus check reads the *claimed* user's row |
| 8 | `products.controller.js:387` `toggleCommentVote` | `req.body.user_id` | Vote as anyone; ballot-stuff any comment |
| 9 | `products.controller.js:411` `markProductAsSold` | `req.params.id` + `req.body.buyer_id` | Mark anyone's listing sold, to any buyer, writing a `purchases` row |
| 10 | `products.controller.js:445` `markProductAsAvailable` | `req.params.id` only | Un-sell anyone's listing |
| 11 | `messages.controller.js:142` `markAsRead` | `req.body.userId` | Mark another student's messages read — silently kills their unread badge |
| 12 | `messages.controller.js:161` `markAsDelivered` | `req.body.userId` | Same, across every thread they have |
| 13 | `messages.controller.js:50` `sendMessage` | `req.body.sender_id` | Send a message as any student. The campus check reads the *claimed* sender's row, so it validates nothing |
| 14 | `user.controller.js:102` `updateAvatar` | `req.params.userId` | Replace any student's avatar; deletes their old file from storage |

Read-side, lower severity but same root cause — the "who is asking" is caller-supplied, so
campus scoping and privacy are advisory: `products.controller.js:140` (`user_id` in query),
`products.controller.js:189`, `messages.controller.js:11` `getInbox` (`:userId` — read anyone's
inbox), `messages.controller.js:29` `getChatHistory` (read any thread), `user.controller.js:15`
`getDashboardData`, `user.controller.js:176` `getPublicProfile` (`visitorId` from query).

**Not fixed in CC-4, deliberately.** One security change per PR, and the onboarding hole was the
one that becomes takeover the moment passwords exist.

### Two contradictions in the runbook, for whoever runs Block D

- **CHECK 3 expects `"Rahul..S"` → `400 INVALID_FORMAT`. It will return `200`.** Migration 005
  explicitly *allows* doubled separators ("`rahul..sharma` and `rahul__sharma` are both ALLOWED,
  matching Instagram") and folds case, so the handle stores as `rahul..s` and is perfectly
  valid. CC-4 forbids reimplementing format rules in JS, so the controller cannot reject what
  the constraint accepts. **Either the runbook check is wrong or 005's charset is — that is a
  product decision, not a code fix.** 005's own comment already flags doubled separators as an
  impersonation vector left to Phase 8 moderation.
- **CHECK 5 sends `method: 'PATCH'`** to `/api/auth/onboarding`, while CHECK 1 and CHECK 2 send
  `POST`. The route is `POST`. Run the race test with `POST` or it will 404 twice and look like
  a pass.

## 2026-08-20 — 📮 HANDOFF A — Migrations 005 + 006: usernames, passwords, signup trigger (Vishwajeet)

> This is **Handoff A** (`docs/PHASE_1_RUNBOOK.md` §C4). Labelled retroactively on 2026-08-25 —
> the content was always here, it just never carried the name, so the Block H checklist item
> "CHANGELOG has Handoff A" could not be ticked with confidence. Audited against C4's required
> points: migrations applied local + production, the three new columns, the three backend-only
> tables, `on_auth_user_created`, username-NULL-until-onboarding, all four DB functions,
> the `get_login_email` warning, and the N-Block C scope line. **All present.** Nothing below
> was edited.

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
- **`POST /api/auth/demo-login` returned 500 for every call.** Step 5 of `demoLogin` was a
  plain `.insert()` into `users` on an id the trigger had already created one microsecond
  earlier, so it hit 23505 and the catch turned it into "Internal server error during demo
  login". ✅ **Fixed in CC-4** — see the entry above. No client change needed.
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
