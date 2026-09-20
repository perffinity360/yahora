# Yahora — Master Build Plan & Handover

**Version 2.0 — 12 September 2026**
**Replaces the original `YAHORA_BUILD_PLAN.md`.**

This document is the single source of truth for the project. It exists so that a new
conversation, a new machine, or a new person can pick up Yahora without losing context.

Save it as `docs/YAHORA_BUILD_PLAN.md` and commit it.

---

# TABLE OF CONTENTS

1. What Yahora is
2. The team and how we work
3. The rules we have committed to
4. What is finished — Phases 0 to 3
5. Where the codebase stands today
6. The remaining phases — 4 to 9
7. Every open item, in one place
8. Lessons we paid for
9. How to start a new Claude conversation

---

# 1. WHAT YAHORA IS

## 1.1 The product

A **student-only marketplace and community**, one campus at a time.

You can only join with a verified university email address. That single requirement is the
whole differentiator — it removes the scammers that make Facebook Marketplace unpleasant,
and it means every buyer and seller is somebody you could physically meet on campus.

- **Started:** 25 February 2026
- **Main tagline:** *Because Every Item Has a Memory.*
- **Secondary:** *Where Every Thing Finds Its Next Story.*
- **Tertiary:** *Keep the Story Going.*

## 1.2 The three value propositions

**Trust** — only verified students can buy or sell.

**Hyper-local** — everything is scoped to one campus, so handover is a five-minute walk.

**Social** — a community feed sits alongside the marketplace. The original insight was that
a marketplace alone will not bring people back every day; the feed is what makes them open
the app when they are not buying anything.

## 1.3 The architecture that everything depends on

Yahora is **multi-tenant**. Each university is a tenant, and they are isolated from each
other.

Almost every table carries a `university_id`. Every query filters on it. Row Level Security
enforces it at the database level, so it holds even if somebody bypasses the API entirely.

**One deliberate exception:** students can *browse* another campus's listings through the
campus switcher, but cannot buy, message, or interact across campuses. The intent is to let
somebody see that Yahora is alive elsewhere and tell their friends.

> **Why this matters more than any other design decision:** if campus isolation ever leaks,
> the product's core promise is broken. A one-character typo in a domain would merge two
> campuses silently. Treat anything touching `university_id` with suspicion.

## 1.4 The tech stack

| Layer | Technology |
|---|---|
| Database | Supabase (PostgreSQL), managed through the Supabase CLI |
| Backend | Node.js + Express, plain JavaScript |
| Website | React 19 + Vite, CSS modules |
| Mobile | Expo SDK 56, React Native 0.85, React 19.2, TypeScript |
| Mobile data | TanStack Query with an AsyncStorage persister (offline-capable) |
| Auth | Supabase Auth — OTP by email, plus username/password |
| Email | Brevo (SMTP) — **capacity is a launch blocker, see §7** |
| Bot protection | Cloudflare Turnstile |
| Web hosting | Netlify |
| Payments | **Deliberately none.** Students meet in person and settle with UPI or cash. |

## 1.5 Repository layout

```
yahora/
├── backend/          Express API          OWNER varies per module
├── frontend/         React website        OWNER: Neeraj
├── mobile/           Expo app             OWNER: Vishwajeet
├── supabase/
│   ├── migrations/   every schema change  OWNER: Vishwajeet
│   └── seed.sql      reference data (universities, courses, specializations)
├── scripts/          repo tooling (verify-baseline.sh, verify-domains.sh)
├── docs/             this file, CHANGELOG, CURRENT_STATE, runbooks
└── .claude/
```

There is **no root `package.json`**. Install dependencies separately in `backend/`,
`frontend/` and `mobile/`.

---

# 2. THE TEAM AND HOW WE WORK

## 2.1 Who does what

| | Vishwajeet | Neeraj |
|---|---|---|
| GitHub | `github.com/infiniper` | |
| Owns | Database, migrations, mobile app | Website, most backend modules |
| Branch | `infiniper` | `neeraj` |
| Phone | POCO X2 (Android) | OPPO K14 (Android) |
| Mobile dev setup | Yes | **No** — tests through Expo Go |

Both work on separate MacBooks, **in the same room**.

## 2.2 Module ownership inside the backend

Ownership is written into the files themselves as an `OWNER:` banner at the top. Respect it.

| Module | Owner |
|---|---|
| `auth`, `products`, `messages`, `posts`, `admin` | Vishwajeet |
| `user`, `social`, `notifications`, `reports` | Neeraj |
| `university`, `academic` | Vishwajeet |
| `app.js`, `middleware/`, `config/`, `utils/` | **Frozen shared infrastructure.** Only Vishwajeet, and only with a good reason. |

## 2.3 How Neeraj tests the mobile app without a mobile setup

This works and it is better than it sounds.

```
Vishwajeet's MacBook                 Neeraj's OPPO K14
─────────────────────                ─────────────────
  npx expo start                        Expo Go app
        │                                    │
        │  QR code + exp://192.168.x.x:8081  │
        └──────── same Wi-Fi ────────────────┘
```

1. Neeraj installs **Expo Go 56.0.0** (not 56.0.1 — that version is broken for SDK 56 on
   Android; sideload the APK)
2. Both devices on the same Wi-Fi
3. Vishwajeet runs `cd mobile && npx expo start`
4. Neeraj scans the QR code

**Why this is genuinely good, not a workaround:**

- Two different physical phones, two Android versions — catches layout bugs one device never
  will
- Neeraj tests *live* code. Vishwajeet changes a file, it reloads on Neeraj's phone in
  seconds, and they are sitting next to each other.
- Fresh eyes. Vishwajeet unconsciously taps things in the order that works. Neeraj does not.

**Setup detail:** `EXPO_PUBLIC_API_URL` in `mobile/.env` must be the Mac's LAN address, not
`localhost`. Find it with `ipconfig getifaddr en0`. The backend must bind `0.0.0.0`.

> `localhost` means "this machine". On Neeraj's phone, `localhost` is *the phone*, which is
> not running the backend.

## 2.4 How the two of them stay in sync

They work in **separate Claude conversations** that cannot see each other. So:

**Files are the shared memory. Chat history is not.**

- `docs/CHANGELOG.md` — every handoff, every migration request, every test finding
- `backend/API.md` — the API contract, authoritative
- `docs/CURRENT_STATE.md` — verified database and security posture
- `CLAUDE.md` files — conventions Claude Code reads automatically

**Every Claude Code session starts with:**

```
Before we start: read CLAUDE.md, docs/CHANGELOG.md, backend/API.md,
and docs/CURRENT_STATE.md. Summarise in 5 bullets what changed most
recently and what I should be careful about.
```

## 2.5 The handoff format

When one of them finishes something the other depends on, it goes in `docs/CHANGELOG.md`
with six sections:

```markdown
## 2026-09-XX — Phase N complete (Vishwajeet)

### Migrations applied
### New endpoints
### Changed endpoints (BREAKING)
### New fields on existing responses
### Test data
### What NOT to do yet
```

The last section is the one people skip and the one that saves the most time.

---

# 3. THE RULES WE HAVE COMMITTED TO

These were learned the hard way. Breaking any one of them costs a day.

## 3.1 Database

1. **Nobody runs SQL in the Supabase dashboard.** Every schema change goes into a migration
   file, gets committed, then gets applied with `supabase db push`. Reads are fine anywhere.
2. **Never edit a migration that has already been applied.** If `003` was wrong, write `004`
   to correct it. History does not change.
3. **One migration, one idea.** Two unrelated changes get two files. `supabase migration new`
   takes two seconds and it makes the history readable forever.
4. **Every new table gets its access decided in the same migration that creates it.** Default
   privileges are revoked, so new tables are born with zero grants to `anon` and
   `authenticated`. Backend-only table → RLS on, no policies, no grants. Client-reachable →
   RLS on *plus* an explicit policy *plus* an explicit grant.
5. **Every `SECURITY DEFINER` function needs an explicit decision about who may execute it.**
   `REVOKE EXECUTE ... FROM PUBLIC` as well as from `anon` — Postgres grants to `PUBLIC` by
   default and `anon` inherits it. We have learned this twice, with `get_login_email` and
   `get_login_identity`.
6. **Migrations reach `main` immediately.** If they sit on a personal branch while production
   already has the schema, the other person pulls `main` and gets a database that does not
   match production.

## 3.2 Backend

7. **`backend/API.md` is updated in the same commit as the endpoint.** Not after.
8. **Never trust an identity that arrives in a request body or URL.** `req.user.id` from a
   verified token, never `req.body.userId` or `req.params.userId`.
9. **Allowlist, never blocklist.** An allowlist fails closed when you forget something; a
   blocklist fails open. Always pick the one that fails safely.
10. **Backend pull requests need the other person's review.** Frontend and mobile do not.

## 3.3 Frontend and mobile

11. **Only ever ADD mobile-only media queries. Never modify a desktop rule.**
12. **Mobile: never subscribe to a realtime channel inside a screen.** `RealtimeContext` owns
    the socket.
13. **Mobile: colours and spacing only from `src/theme`.** Web: only from
    `frontend/src/styles/global.css`. No new colours.
14. **Never log a password, and never persist one to localStorage or AsyncStorage.**

---

# 4. WHAT IS FINISHED — PHASES 0 TO 3

## Phase 0 — Foundation (complete)

**The problem it solved:** schema changes lived only in the Supabase dashboard. Nothing was
in Git, nothing was reproducible, and the two developers could not see each other's changes.

- Supabase CLI set up; `supabase db pull` captured the existing schema as migration 001
- Local Postgres via Docker, so migrations are tested before they touch production
- `backend/API.md` written for all existing endpoints *and* all 37 planned ones, before any
  of them were implemented
- `backend/src/app.js` finalised and **frozen** — every future route mount registered up
  front against empty stub routers, so the two of them never edit the same file
- Shared helpers written and frozen: `utils/respond.js` (`sendError`, `mapDbError`,
  `sendPage`), `middleware/requireAuth.js`, `middleware/optionalAuth.js`,
  `config/supabase.js`
- Six module folders scaffolded with `OWNER:` banners
- `docs/CHANGELOG.md` created with the handoff template
- `scripts/verify-baseline.sh` — confirms the migration files fully describe the schema

## Phase 1 — Usernames, passwords, RLS stage 2 (complete)

**Migrations:** `usernames`, `username_backfill`, `rls_stage2_users_messages`,
`login_identity`

**Username system**
- `username` column, globally unique, lowercase enforced by a `CHECK`
- `reserved_usernames` table (~60 rows) blocking every current and planned route, brand word,
  and legal page — enforced by a trigger, because a `CHECK` cannot query another table
- `username_history` with a 30-day cooling-off window, so a released handle cannot be
  instantly squatted, and old shared links keep redirecting
- `is_username_available()`, `generate_username()`, `suggest_usernames()`, `search_users()`
- Root-level profile URLs: `/rahul`

**Passwords**
- Supabase Auth owns the hash in `auth.users.encrypted_password`. We store only a
  `has_password` boolean. **We never store a password ourselves.**
- `get_login_email()` → later replaced by `get_login_identity()`, which resolves a username
  *or* an email. Both `SECURITY DEFINER` and revoked from `anon`.
- `login-password`, `set-password`, `password-status` endpoints
- `auth_attempts` table with a 15-minute lockout after 10 failures
- **One generic error for every login failure** — wrong password, unknown username, unknown
  email, no password set. All identical, to prevent user enumeration.
- **OTP is the password reset.** No reset tokens, no expiring links, no reset emails.

**The `handle_new_user` trigger**
- Fires on `auth.users` insert, creates the `public.users` row
- **Never raises** — an unknown email domain produces a row with `university_id` NULL rather
  than a failed signup
- Does **not** generate a username — there is no `full_name` at that point, and deriving from
  the email local part would bake roll numbers into permanent public handles

**Security fixes**
- `POST /api/auth/onboarding` was completely unauthenticated and read `userId` from the body.
  Anyone could overwrite any student's profile. Fixed with `requireAuth` + `req.user.id`.

**RLS stage 2**
- `users` and `messages` locked down. `messages_select_own` means Realtime only delivers rows
  the subscriber is party to — the filtering moved from JavaScript into the database.

## Phase 2 — Auth hardening and demo data (complete)

**Migrations:** `otp_rate_limits`, `username_no_double_separator`

**OTP protection**
- `otp_requests` table logging email, device ID, IP, timestamp
- Per email: 3 free, then 60-second cooldown, 10 per rolling 24 hours
- Per device ID: 20 per rolling 24 hours. The device ID is a random UUID the browser
  generates and stores in `localStorage`, sent as `X-Device-Id`.
- **IP is logged but never gated on** — campus Wi-Fi NATs hundreds of students behind one
  address, so an IP limit would lock out a whole hostel
- **Global circuit breaker** — a hard ceiling on total OTPs per hour across the platform,
  returning `503 SERVICE_BUSY` and logging loudly
- **Cloudflare Turnstile** on `request-otp`. This is the real defence; the rate limits alone
  do not stop a script using a fresh email address each time.
- **Hourly cleanup of unverified accounts** older than 24 hours. `signInWithOtp` with
  `shouldCreateUser: true` creates the `auth.users` row when the code is *requested*, not
  verified — so junk accounts accumulate without this.

**Production wipe**
- All test users deleted with a single `delete from auth.users`, cascading to everything else
- Universities, courses and specializations survived, correctly — they are reference data

**Username rules tightened**
- Final format: `^[a-z][a-z0-9._-]*$`, 3–25 characters, **no two separators in a row**
- `rahul..sharma` rejected; `rah.ul.sharma` allowed
- Banned *all* separator pairs, not just dots, because `rahul._sharma` is equally usable for
  impersonating `rahul.sharma`

**Seed scripts, with deliberately different rules**

| Script | Writes to | May reach production? |
|---|---|---|
| `seedDemo.js` | The demo university only | Yes, with `SEED_ALLOW_REMOTE=yes-seed-production-demo-tenant` |
| `seedLocal.js` | Real universities | **Never. No override exists.** |

## Phase 3 — Launch blockers (complete)

**Migration:** `universities_expansion`

**Security holes closed**
- `PUT /api/users/:userId/profile` had no `requireAuth` and spread `req.body` into
  `.update()`. Anyone with a UUID could rewrite any row — including `university_id`, which
  would move a student to another campus. Fixed with auth plus a field allowlist.
- Every other unauthenticated write endpoint across products, messages and user
- `POST /messages/send` took `sender_id` from the body, so the campus check validated nothing

**CORS** — `app.js` returned `Access-Control-Allow-Origin: *` in production. Replaced with an
explicit allowlist. Requests with no `Origin` header (the mobile app, curl) are still allowed,
because CORS is a browser mechanism and rejecting them would break mobile.

**Universities**
- `is_active` column, defaulting to `true` so the original rows kept working
- ~100 institutions inserted as **inactive** — IITs, NITs, IIITs, GFTIs, large private
  universities
- `requestOtp` and the campuses list both filter on `is_active`
- `scripts/verify-domains.sh` checks MX records and a public-provider blocklist

**Mobile CAPTCHA** — Turnstile has no native React Native component, so it runs inside a
WebView that posts the token out via `window.ReactNativeWebView.postMessage`. This unblocked
mobile login against production.

**Small fixes** — OTP shortened from 8 digits to 6; the student's home campus is now pinned at
the top of the campus switcher on both platforms.

**DESIGN.md** — resolved.

---

# 5. WHERE THE CODEBASE STANDS TODAY

## 5.1 Backend — mature

| Module | State |
|---|---|
| `auth` | OTP request/verify (6-digit, Supabase + Brevo), password login, set-password, password-status, demo/guest login, onboarding, Turnstile, rate limiting, circuit breaker |
| `products` | Full CRUD, multi-image upload (≤5), campus-scoped feed, detail with seller and comments, like/save toggles, threaded comments with votes, mark sold/available, purchases |
| `messages` | Inbox RPC, chat history, send, mark read, mark delivered, demo auto-responder bot |
| `user` | Dashboard, profile update, avatar upload, public profile, username availability/suggestions/search/by-username |
| `university`, `academic` | Supported campuses (filtered on `is_active`), courses, specializations |
| `posts`, `social`, `notifications`, `reports`, `admin` | **Route stubs only** — mounted in `app.js`, not implemented |
| Infrastructure | `requireAuth`, `optionalAuth`, cron cleanup jobs, seed scripts |

## 5.2 Database

- Migrations applied to **both** local and production, zero drift
- RLS enabled on all 16 public tables — 3 with policies, 13 backend-only and policy-less
  (which in Postgres means deny-all)
- `messages` is the only table in the realtime publication, which is safe because
  `messages_select_own` is re-checked per row

## 5.3 Website — feature-complete for MVP

Home · Auth (tabbed, OTP + password) · Onboarding (username + password) · Dashboard ·
Marketplace · Product Detail · Public Profile · Sell · Messages

Components: Navbar, Footer, ProductCard, SmartImage, UniversityModal, OnboardingRequired

## 5.4 Mobile app — core built, auth parity missing

**Foundation:** Expo Router file-based navigation · theme tokens · Supabase client with
AsyncStorage session persistence · typed API client · TanStack Query with AsyncStorage
persister · auth context and routing guard · a single app-level `RealtimeContext` that never
re-subscribes on navigation · `AppState` foreground resync · optimistic updates with rollback

**Screens shipped:** login (OTP + Turnstile WebView) · onboarding · marketplace (FlashList
grid, search, filters, sorts including "Hot at [School]", swipe deck, campus switcher) ·
messages inbox · profile/dashboard · product detail · public profile · chat · sell ·
edit-profile

**Tested on:** POCO X2 and OPPO K14, both via Expo Go on SDK 56. Working on both.

## 5.5 ⚠️ The web is ahead of mobile — this is the biggest gap

| Feature | Web | Mobile |
|---|---|---|
| Password login | ✅ tabbed identity UI | ❌ **OTP only** |
| Set password during onboarding | ✅ | ❌ missing |
| Username selection with live availability | ✅ | ❌ missing |
| Turnstile | ✅ | ✅ (Phase 3) |
| Username display / by-username profiles | ✅ | ❌ |
| User search | ✅ | ❌ |
| Messages UX fixes (unread anchoring, chat persistence) | ✅ | ❌ |

**Why mobile auth parity is urgent:** OTP capacity is a launch blocker — Supabase's built-in
service sends roughly 30 per hour, and Brevo's free tier is 300 a day. Password login is the
*mitigation*, because returning users skip OTP entirely. A mobile app that can only do OTP
hits that ceiling first and hardest.

Also, mobile users currently **cannot choose a username**, so they end up with a backfilled
handle they never picked.

## 5.6 Things mobile has that web does not

Worth backporting eventually:

- Offline-persisted query cache — mobile is more resilient than web here
- Optimistic like/save/vote with rollback — web does some of this ad hoc
- Supabase-managed session. **Web stashes a raw token in `localStorage`; mobile's approach is
  more robust and should eventually be backported.**

---

# 6. THE REMAINING PHASES

Six phases left. Each is sized to be roughly what Phase 2 and Phase 3 were — about five
working days.

## Phase 4 — Mobile auth parity + backend pagination

**Vishwajeet (mobile):**
- **Password login** — mirror the web's tabbed design: "College Email & OTP" | "Username &
  Password". Calls `POST /api/auth/login-password` with `{ identifier, password }`. One
  generic error string for every failure. Permanent helper text for new users, not an error.
- **Username selection in onboarding** — debounced 400 ms availability check, three tappable
  suggestions, silent lowercasing. Rules: `^[a-z][a-z0-9._-]*$`, 3–25, no consecutive
  separators.
- **Password and confirm in onboarding** — minimum 8 characters, show/hide toggle, never
  block paste (it breaks password managers), keep what they typed when the server rejects it.

**Neeraj (backend):**
- **Pagination on every list endpoint.** `.range()` currently has **zero call sites** across
  the whole repo — every list endpoint returns the entire table.
- Cursor-based, not offset — offset gets slower the deeper you go and skips or duplicates rows
  when data shifts underneath.
- Backward compatible: `limit` and `cursor` optional, a sensible default limit, and a
  `next_cursor` in the response that existing clients can ignore.
- Endpoints: products feed, comments, messages inbox, chat history, user search.
- **Check current row counts first.** If no campus has more than the default limit today,
  nothing changes visibly and the protection is simply in place for later.

**Neeraj (testing):** every new mobile screen, on his OPPO K14.

## Phase 5 — Pagination in the clients + mobile navigation fixes

- Infinite scroll on web: marketplace, comments, chat
- Same on mobile, using TanStack Query's `useInfiniteQuery`
- **Back-navigation bug:** opening a product from the Dashboard and pressing back lands on
  Marketplace instead of the Dashboard. It returns correctly from Marketplace and public
  profiles. This is the known root-`<Slot/>` tab-reset behaviour and needs precise
  back-to-origin.
- **`focusManager` decision.** `refetchOnWindowFocus: true` is inert on React Native —
  TanStack's `focusManager` is web-only unless wired to `AppState`. It was deliberately not
  wired globally, because that would re-run `GET /products/:id` on every foreground and
  inflate view counts. The explicit `AppState` resync does the real work. Decide whether to
  keep this or wire it properly.
- **Confirm realtime delivery on mobile.** It depends on `messages` being in the
  `supabase_realtime` publication and RLS letting the client see its own rows. Mobile uses the
  same anon client and channel name as web, so if web realtime works this should too — but
  nobody has verified it on a phone.
- **NOT in Phase 5: a user-search screen.** Decided 2026-09-19. Block V-A fixed the
  `search_users()` RPC — the endpoint works — but **there is no search box anywhere in the web
  app or the mobile app**, and building one here would mean designing a people-search surface
  in a phase that is otherwise pagination and navigation. It moves to Phase 8, where the
  social graph gives it somewhere to go: a result row whose only action is "view profile" is
  thin, and the same row with follow, block and campus context is the actual feature. The
  endpoint stays live and verified by direct call until then.

## Phase 6 — Marketplace completeness

### Mark as Sold — a proper rework

The current implementation assumes the buyer messaged the seller through Yahora. That is
often not what happens.

**The real scenario:** a seller lists an item. A classmate sees it on Yahora, then finds the
seller in person — in class, in the corridor, on WhatsApp. The sale happens offline. The
seller now wants to mark it Sold on Yahora.

**Requirements:**
- Marking sold must work with **no conversation, no message, no in-app transaction** ever
  having existed between the two people
- Give the seller a **search box to find the buyer by name or username**
- Allow "sold to someone not on Yahora" as an explicit option — plenty of sales will be to a
  friend who has not joined
- The status must reflect consistently across **web and mobile**, in the feed, on the product
  page, on the seller's dashboard, and in the buyer's purchase history
- Think through every UI state and edge case: sold item still visible on the seller's profile
  for social proof, but filtered out of the feed; what happens to existing likes and saves;
  what happens if it is marked sold by mistake and reverted; what a buyer sees if they are
  tagged in a sale they did not make

This needs a schema change and UI on both platforms. It is the largest single item in
Phase 6.

### Also in Phase 6

- **Delete message**, WhatsApp-style — delete for me, and delete for everyone within a time
  window
- **`products.views` is incremented by two uncoordinated paths** — a browser RPC and the
  backend on detail fetch. The number is currently not meaningful. Pick one.
- **Port the web messages UX fixes to mobile:** chat opens anchored at the first unread
  message; read receipts no longer undo the unread anchor; chat stays open across navigation;
  the design pass on the chat surface
- **Reconcile the chat visual differences.** Mobile uses blue read ticks; the web CSS uses
  amber with an explicit `/* not blue */` comment. Mobile bubbles are solid purple rather than
  a gradient, because gradients inside list rows cost frames on mid-range Android. Decide one
  answer and make both platforms match — and make both look good.

## Phase 7 — Community feed

The `posts` module is a stub. The web routes `/feed` and `/hot` were placeholders.

- **Comments on posts.** The `comments` table has `product_id` and no `post_id`. Needs a
  migration. *A campus feed where nobody can reply is a noticeboard, not a community.*
- Two feeds: home college (chronological) and global (ranked by a time-decay hot score)
- Desktop shows both side by side; mobile uses a switcher
- Author's profile reachable by tapping their name or picture
- Posts: 250 characters, up to 3 images, one level of replies, likes
- Report button on every post; auto-hide at 3 unique reports
- Rate limits: roughly 10 posts and 30 replies per hour
- A Hinglish slur list — off-the-shelf English profanity filters miss what actually causes
  problems on Indian campuses
- **Never hard-delete.** Removed posts keep their row with a `removed` status.
- "Posting as @rahul · IIITDM Kurnool" always visible on the composer. Visible accountability
  is the cheapest moderation tool there is.
- **No anonymous posting in v1.** It drives engagement enormously and it would consume the
  entire moderation capacity of a two-person team.

## Phase 8 — Social graph, notifications, push

- **Follows** — global, cross-campus. This is the only intentional gap in campus isolation,
  and the `follows` table should carry a comment saying so, or somebody will "fix" it.
- **Private accounts** — follow requests, `status` of `pending` or `accepted`. Private hides
  posts, bio and follower lists; **marketplace listings stay public**, or sellers become
  invisible.
- **Blocks** — removes follows both directions, prevents messaging, hides posts. Needed for
  Play Store compliance.
- **Notifications table** — one row per event, with a partial index on unread rows and a
  unique dedupe index so follow/unfollow/follow does not produce three unread entries
- **Push notifications** — needs the notifications backend first
- **`utils/notify.js` currently writes to `public.notifications`, which does not exist.** It
  fails silently. Fix it here.
- **User search, web and mobile** — moved here from Phase 5 on 2026-09-19. The backend has
  been ready since Phase 5 Block V-A: `GET /api/users/search` returns
  `{ items, next_cursor: null }` with the ordering fixed inside the RPC (exact match, then
  same campus, then trigram rank), and it is **deliberately exempt from cursor pagination**.
  No client has ever called it. Build the box once there is a profile worth landing on.
- **⚠ Before that box ships: keep `Yahora University (Demo)` accounts out of the results.**
  See §7.2 — this is the one piece of it that is not just UI work.

## Phase 9 — Moderation, admin, launch

- **Reports and moderation queue** — `/admin/reports`, an `is_admin` flag, actions to remove,
  restore, dismiss, restrict and suspend
- **"Request your college" form.** Design already settled: the student's own email is the
  proof; requests aggregate per domain into a demand-sorted launch queue; a human always
  activates, never automatically. One request could be anyone; fourteen from the same domain
  is evidence of a real community.
- **`activate_verified_universities` migration** — deliberately deferred to just before
  launch, because domains verified two months early go stale. Verify each with
  `verify-domains.sh`, confirm with an actual student at that college, then activate in a
  migration with the date and method recorded in a comment.
- **Community guidelines page** and a required acceptance checkbox at onboarding
- **Email provider decision** and correcting the OTP ceiling
- App Store and Play Store accounts, EAS Build, icons, splash screen, store listing,
  screenshots, privacy policy
- Performance pass on a low-end Android
- Full manual test pass on both platforms
- Housekeeping: drop the dead `increment_product_likes` / `decrement_product_likes` RPCs; fix
  `backend/API.md:2448`, which incorrectly says nothing calls `increment_page_view()` (the
  footer does)

## A strategic option worth keeping in mind

**You could launch after Phase 6 rather than Phase 9.**

At that point you would have a working, secure marketplace on both platforms with real
universities. What you would not have is the community feed, follows and notifications.

**The case for:** a marketplace with real students on it teaches you more in two weeks than
three more months of building. You find out what people actually miss instead of guessing.

**The case against:** your own original insight was that a marketplace alone will not bring
people back daily.

**Middle path:** launch to one or two campuses as a pilot after Phase 6, keep building the
feed while real students use the marketplace, then open wider once it ships. Real feedback
without betting everything on one wide launch that has to be perfect.

---

# 7. EVERY OPEN ITEM, IN ONE PLACE

Nothing here is forgotten. Each has a phase.

## 7.1 Launch blockers still open

| Item | Phase | Detail |
|---|---|---|
| **Email capacity** | 9 | `OTP_HOURLY_CEILING` is 2,000/hr, but Supabase's built-in service sends ~30/hr and Brevo's free tier is 300/day. **The circuit breaker cannot fire before the real limit does.** Needs a real provider decision and a corrected ceiling. |
| **Community posts cannot be commented on** | 7 | `comments` has `product_id`, no `post_id` |
| **Production/local divergence** | ongoing | One instance found and fixed — wrong university domains in production would have enrolled Gmail signups as NIT Delhi students. Needs a recurring reconciliation check. |

## 7.2 Security and correctness

| Item | Phase | Detail |
|---|---|---|
| `avatars` bucket has no SELECT/DELETE policy | 9 | Reads work only because the bucket is public; old avatars cannot be deleted through RLS |
| No pagination anywhere | 4–5 | `.range()` has zero call sites |
| `products.views` double-counted | 6 | Two uncoordinated increment paths |
| `utils/notify.js` writes to a non-existent table | 8 | Fails silently |
| **Demo accounts are searchable by real students** | 8 | `Yahora University (Demo)` (`demo.yahora.com`) users are ordinary `public.users` rows and `search_users()` filters nobody out, so once a search box exists a real student searching a common name can get demo personas and up-to-7-day-old `guest_*` throwaways (`cleanup_demo_users()` only removes them past 7 days) mixed into their results. There is **no `is_demo` flag** — the only handle is `universities.domain = 'demo.yahora.com'`. Decide where the exclusion lives (the RPC, so every caller inherits it, versus the controller) and whether a demo user searching should still see their own campus. **Invisible locally:** the seed creates no demo-campus users, so this cannot be reproduced on a fresh `db reset` — only production has them. |
| Dead RPCs `increment_product_likes` / `decrement_product_likes` | 9 | Drop in a migration |
| `backend/API.md:2448` factually wrong | 9 | Says nothing calls `increment_page_view()`; the footer does |

## 7.3 Mobile

| Item | Phase |
|---|---|
| Password login, username selection, set-password | 4 |
| Back-navigation: Dashboard → product → back lands on Marketplace | 5 |
| `focusManager` / `AppState` decision | 5 |
| Confirm realtime delivery works on a phone | 5 |
| Username display and by-username profiles | 5 |
| User search (UI) — **moved to 8 on 2026-09-19**; the RPC was fixed in 5 (Block V-A), no client calls it | 8 |
| Messages UX fixes ported from web | 6 |
| Read-tick colour: blue on mobile, amber on web | 6 |
| Bubble style: solid purple on mobile, gradient on web | 6 |
| iOS Simulator pass — the app has only been developed on Android | 9 |
| Low-end Android performance pass | 9 |
| Push notifications | 8 |
| EAS Build, store accounts, icons, screenshots, privacy policy | 9 |

## 7.4 Web

| Item | Phase |
|---|---|
| Mobile responsiveness gaps — **Navbar has only 1 media query, UniversityModal has 0** | 5 |
| Block G5 browser verification — two accounts, two profiles, live chat + campus switcher | 5 |
| **User search box — there isn't one.** The Phase 5 runbook assumed the website had one; it does not. Moved to 8 with the mobile side | 8 |
| Backport mobile's Supabase-managed session (web keeps a raw token in `localStorage`) | 9 |

## 7.5 Deliberately not doing

| Item | Why |
|---|---|
| **Payments** | Students meet in person and settle with UPI or cash. Avoids commission and gateway fees entirely. |
| **AI features** — auto-categorization, image moderation, semantic search with pgvector, multilingual hate-speech detection | Post-MVP, all of it |
| **Anonymous posting** | Would consume the entire moderation capacity of a two-person team |

---

# 8. LESSONS WE PAID FOR

Written down so nobody spends the same day twice.

**Deleting an `auth.users` row cascades into your tables and fires their triggers — running as
GoTrue's role, which has no permissions on your tables.** Cost two migrations to find. Any
trigger reachable from a cascade must be `SECURITY DEFINER`, or the delete fails with an
opaque error. A trigger does not run as "the database" — it runs as whoever caused it to fire.

**A migration that passes on an empty local database can fail on production.** `ALTER TABLE
... ADD CONSTRAINT` validates every existing row immediately. Local was empty, so it passed;
production had rows that violated it. Always ask what the constraint means for data that
already exists.

**A backfill that generates values must loop, not batch.** A single `UPDATE` sees a snapshot
from before it started, so two students named "Rahul Sharma" both generate `rahul.sharma` and
the unique index rolls back the entire statement. `DO $$ ... LOOP` issues one update per row,
so each iteration sees what the last one wrote.

**A verification script that checks the wrong thing is worse than no script.** `verify-baseline.sh`
originally read only the newest migration file and reported 21 false failures. The same bug
could just as easily have reported all-clear on an incomplete baseline. When a check says
something surprising, verify the check before acting on the result.

**Website domain is not reliably the student email domain.** NIT Trichy is `nitt.edu`. NITK
Surathkal is `nitk.ac.in`, not `nitk.edu.in`. IIIT Bhubaneswar is `iiit-bh.ac.in`, with a
hyphen. And `iitk.ac.in` (IIT Kanpur) differs from `iiitk.ac.in` (IIITDM Kurnool) by one
character — a typo there would silently merge two campuses.

**You cannot give somebody a password.** Either they do not know it, or you had to email it to
them. This is why no real service ever sends you a password — they send a link or a code that
lets you set your own.

**IP address is not a machine.** Campus Wi-Fi NATs hundreds of students behind one address.
Rate limiting by IP would lock out an entire hostel by mid-morning.

**`shouldCreateUser: true` creates the account when the code is requested, not when it is
verified.** So junk accounts accumulate from people who never received anything. The cleanup
job is the real defence; rate limits only slow the accumulation.

**Unauthenticated endpoints are not theoretical.** `PUT /api/users/:userId/profile` shipped
with no auth and a `...req.body` spread. Anyone with a UUID — which the public profile
endpoint hands out — could have changed any student's `university_id` and moved them to
another campus.

---

# 9. HOW TO START A NEW CLAUDE CONVERSATION

## 9.1 Before you open the chat

**1. Merge everything into `main`.**

As of 12 September, `main` was two commits behind and all of Phase 3 was sitting on the
`infiniper` branch. If that is still true, fix it first — otherwise Neeraj pulls `main` and
builds Phase 4 against a Phase 2 codebase.

```bash
git checkout main
git merge infiniper
git push origin main
```

**2. Commit this document.**

```bash
cp YAHORA_BUILD_PLAN.md docs/YAHORA_BUILD_PLAN.md
git add docs/YAHORA_BUILD_PLAN.md
git commit -m "docs: master build plan and handover, v2.0"
git push origin main
```

**3. Check that the repo is readable.**

In the new conversation, Claude will try to clone the repo. That only works if network access
is on **and the sandbox was created after you turned it on**. Turning the setting on does not
reconfigure a conversation that already exists — which is exactly why you are starting a new
one.

## 9.2 The first message to send

Paste this:

```
Hi Claude. I'm Vishwajeet. My co-founder Neeraj and I are building Yahora,
a student-only campus marketplace and community app.

We've finished Phases 0 to 3 and we're starting Phase 4. Everything you
need is in the repo:

  https://github.com/perffinity360/yahora

Please read these first, in this order:

  1. docs/YAHORA_BUILD_PLAN.md   — the master plan. Read it fully.
  2. docs/CURRENT_STATE.md        — verified database and security posture
  3. docs/CHANGELOG.md            — the handoff record between the two of us
  4. backend/API.md               — the API contract

Then look at the code itself, especially:
  mobile/app/(auth)/login.tsx
  mobile/app/(auth)/onboarding.tsx
  frontend/src/pages/auth/Auth.jsx          (the web version we're mirroring)
  frontend/src/pages/onboarding/onboarding.jsx

Two things about how we work together:

We are beginners — about six months of experience. Please explain concepts
in simple English as you go, and assume we may not know the basics. Don't
pack too much into one line; keep things detailed and clear. We'd rather
read more and understand it than read less and guess.

We work from runbooks you write, split into four tracks:
  Track 1 — Vishwajeet's manual steps, with checkpoints
  Track 2 — copy-pasteable Claude Code prompts for Vishwajeet
  Track 3 — Neeraj's manual steps, with checkpoints
  Track 4 — copy-pasteable Claude Code prompts for Neeraj

Only include checks that genuinely need a human — things Claude Code
cannot verify itself.

When you've read everything, tell me what you found and confirm the Phase 4
scope in §6 still makes sense given the current state of the code. Then
write the Phase 4 runbook.
```

## 9.3 What Claude should confirm before writing anything

A good first response will tell you:

- How many migrations exist and whether local and production match
- Whether the Phase 3 work is actually on `main`
- The current state of `mobile/app/(auth)/login.tsx` — the Turnstile WebView from Phase 3
  should be there
- Whether anything in §6's Phase 4 scope is already done
- Anything in the code that contradicts this document

If Claude starts writing the runbook without reading the repo, stop it and ask it to read
first. Everything in these runbooks depends on knowing what is actually there.

## 9.4 What to do with this conversation

Nothing. Leave it. You can come back and search it if you need the reasoning behind a
decision — the *why* is often here in more depth than in this summary.

## 9.5 Keeping the new conversation useful

**Paste real output.** Error messages, terminal output, `git log`, SQL results. Do not
describe them.

**Say when something did not work.** A runbook step that failed is more useful information
than one that succeeded.

**Ask when something is unclear** rather than guessing. You have done this consistently and
it has caught several real problems — the email flooding question in Phase 2 found a genuine
hole in the plan.

**Push back when something feels wrong.** You did this with the `get_login_email` gap in Phase
1 and were right. You know your code better than any summary of it.

---

# APPENDIX A — The runbook format

Every phase gets a runbook at `docs/PHASE_N_RUNBOOK.md` with this shape:

```
PART 0    What I found in the repo — current state, verified
PART 1    Decisions that need making before work starts
PART 2    The concepts behind this phase, explained from scratch
PART 3    Files touched, who owns what, the day-by-day flow

TRACK 1   Vishwajeet — manual steps in blocks, each with a checkpoint
TRACK 2   Vishwajeet — Claude Code prompts, one per block
TRACK 3   Neeraj — manual steps in blocks
TRACK 4   Neeraj — Claude Code prompts

SIGN-OFF  A checklist both go through together
```

**Checks are marked 👁️ when a human has to look at something** — a browser, a phone, the
Supabase Studio table editor, a terminal. Everything else is left to Claude Code.

**Claude Code prompts always end with hard constraints** — which files may be touched, what
must not change, and what to report rather than fix.

---

# APPENDIX B — Standard commands

**Fresh local database:**

```bash
supabase db reset                       # wipe, replay all migrations, run seed.sql
node backend/scripts/seedLocal.js       # test data in the real universities
node backend/scripts/seedDemo.js        # demo tenant data
```

**New migration:**

```bash
supabase migration new descriptive_name
# write the SQL
supabase db reset                       # test locally
supabase db push                        # apply to production
```

**Local URLs:**

| Service | URL |
|---|---|
| Supabase Studio | `http://127.0.0.1:54323` |
| Mailpit — catches every outgoing email | `http://127.0.0.1:54324` |
| Supabase API | `http://127.0.0.1:54321` |
| Backend | `http://localhost:5000` |
| Website | `http://localhost:5173` |

**Mobile:**

```bash
cd mobile && npx expo start
# Neeraj scans the QR with Expo Go 56.0.0 on the same Wi-Fi
ipconfig getifaddr en0                  # the LAN IP for EXPO_PUBLIC_API_URL
```

**Seeding the demo tenant on production** — the only command that writes demo data to
production:

```bash
SEED_ALLOW_REMOTE=yes-seed-production-demo-tenant \
SUPABASE_URL=<production url> \
SUPABASE_SERVICE_ROLE_KEY=<production service key> \
node backend/scripts/seedDemo.js
```

Pass the URL and key on the command line, never by editing `.env` — so the next command you
run is safe again.

---

*End of handover. Phase 4 is mobile auth parity and backend pagination.*
