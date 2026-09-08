# Yahora Backend API

This file has **two parts, and they mean different things.** Read the part label before you
trust an entry.

| | **Part 1 — As-built** | **Part 2 — Contract** |
|---|---|---|
| What it is | What the code does **today** | What the code **must** do when written |
| Written from | Reading every controller | Transcribing `docs/YAHORA_BUILD_PLAN.md` |
| Status | Live. Deployed. | **Nothing here is implemented yet.** |
| If code and doc disagree | The doc is wrong — fix the doc | The code is wrong — fix the code |

**Part 1** documents the 33 routes that exist now, including their bugs. Where a controller
behaves surprisingly, the surprise is documented rather than corrected. Nothing in Part 1 is
aspirational.

**Part 2** is the Phase 0 contract required by plan §0.5.3 and §0.F Step 4: every endpoint
from Phases 1, 3, 5, 6 and 8, specified **before** either developer implements anything.
Neeraj implements 20 of them, Vishwajeet 16. Both clients — web and mobile — are built
against these shapes, so **a deviation must be fixed in this file in the same commit**
(Golden Rule 3). Every entry carries an `OWNER` and `PHASE` tag on its heading line.

Source of truth: `backend/src/app.js` and `backend/src/modules/**` for Part 1;
`docs/YAHORA_BUILD_PLAN.md` for Part 2; column names from
`supabase/migrations/20260808143802_remote_schema.sql`.

---

## Conventions

Everything in **Part 2** obeys these. Part 1 predates them and does not — that inconsistency
is deliberate and is why these conventions exist.

### The error envelope

Every error, from every Part 2 endpoint, is produced by `sendError()` in
`backend/src/utils/respond.js`:

```json
{ "error": "CODE", "...extra": "optional fields" }
```

`error` is always a stable, machine-readable `SCREAMING_SNAKE_CASE` code — never a sentence.
Clients branch on `error`, never on a human string. Some codes carry extra fields alongside
it (`next_allowed_at`, `until`, `max`, `message`); those are documented per endpoint.

Never hand-roll this shape. Database failures go through `mapDbError()`, which turns Postgres
codes and trigger exceptions into the table below.

### The list envelope

Every list endpoint is **cursor-paginated**. `sendPage()` in `respond.js` produces:

```json
{ "items": [ ... ], "next_cursor": "opaque value or null" }
```

- `next_cursor: null` means you have reached the end. It is the **only** end-of-list signal.
- Send the previous response's `next_cursor` back as `?cursor=`. **Never construct a cursor
  yourself** — the type differs per endpoint (see the warning in the posts module).
- `limit` defaults to 20 (notifications: 30) and is **capped at 50**. An uncapped limit is a
  denial-of-service (§0.5.4). Validate it server-side; do not trust the client.
- Never use page numbers or `OFFSET`. `OFFSET 100000` makes Postgres discard 100,000 rows
  before returning anything, and rows shift under the reader between pages.

> ⚠️ **`items` vs named keys — unresolved.** `sendPage()` emits `items`, and §0.5.2 says
> "every list endpoint returns this shape". But the plan's own worked examples use named
> keys: `{ "users": [...] }` in §3.2 and `{ "notifications": [...] }` in §5.3. Both cannot
> be right. Each list entry below documents the key the plan literally shows, and flags the
> conflict. **Resolve this at the §0.F Step 5 contract review, before anyone writes a
> client** — it touches every list screen on both surfaces.

### Error codes used anywhere in this API

| Code | HTTP | Raised by | Extra fields |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | `requireAuth` — missing or invalid Bearer token | — |
| `FORBIDDEN` | 403 | **Live.** `PUT`/`DELETE /api/products/:id` — caller is not the listing's `seller_id`; `GET /api/messages/history` — caller is not one of the two parties in the thread | `message` |
| `NOT_FOUND` | 404 | **Live.** `PUT`/`DELETE /api/products/:id` and `POST /api/products/:id/like`,`/save` — no such listing; also `/like`,`/save` when the caller has no `public.users` row. Also `POST /api/auth/onboarding`, `login-password`, `set-password` | `message` |
| `USER_NOT_FOUND` | 404 | §1.5 — no user with that handle, live or historical | — |
| `CROSS_CAMPUS_INTERACTION_BLOCKED` | 403 | **Live.** `POST /api/products/:id/like` and `/save` — the listing's `university_id` does not match the caller's. A `NULL` on either side counts as a mismatch | `message` |
| `INVALID_PRICE` | 400 | **Live.** `PUT /api/products/:id` — `price` was supplied but does not parse to a finite number `>= 0`. Only raised when the key is present; an absent `price` is simply left alone | `message` |
| `DUPLICATE` | 400 | `mapDbError` — Postgres `23505` unique violation | — |
| `INVALID_REFERENCE` | 400 | `mapDbError` — Postgres `23503` foreign-key violation | — |
| `INTERNAL_ERROR` | 500 | `mapDbError` fallback — anything unrecognised | — |
| `USERNAME_TAKEN` | 400 | Unique index `users_username_key` (`23505`); also `POST /api/auth/onboarding`, both from `is_username_available()` returning false and from catching `23505` on the race | — |
| `USERNAME_RESERVED` | 400 | Trigger `trg_username_not_reserved`; also `POST /api/auth/onboarding` via `is_username_available()` | — |
| `INVALID_FORMAT` | 400 | `CHECK users_username_valid`; also `POST /api/auth/onboarding` when `username` is missing or unavailable for a reason that is neither reserved nor taken; also `GET /api/messages/history` when `userId`, `contactId` or `productId` is not a canonical uuid | `message` (optional) |
| `MISSING_FIELDS` | 400 | `POST /api/auth/onboarding` — a mandatory profile field is absent or empty; `POST /api/auth/set-password` — `current_password` omitted on an account that already has one; `PUT /api/products/:id` — the body carried none of the seven updatable keys | `message` |
| `WEAK_PASSWORD` | 400 | `POST /api/auth/onboarding` and `POST /api/auth/set-password` — under 8 characters, equal to the caller's username, or rejected by GoTrue's own policy | `message` |
| `COMMON_PASSWORD` | 400 | `POST /api/auth/onboarding` and `POST /api/auth/set-password` — matches the ~20-entry common-password blocklist in `auth.controller.js` | `message` |
| `INVALID_CREDENTIALS` | 400 | `POST /api/auth/login-password` — **the only failure code this endpoint ever returns.** Wrong password, unknown username, unknown email and an account with no password are byte-identical, deliberately. Never branch a UI on the reason; there isn't one | `message` (always the same sentence) |
| `TOO_MANY_ATTEMPTS` | 429 | `POST /api/auth/login-password` — 10 failed attempts for one identifier inside 15 minutes. Also sent as a `Retry-After` header | `retry_after_seconds`, `message` |
| `INVALID_CURRENT_PASSWORD` | 401 | `POST /api/auth/set-password` — `current_password` did not verify. Distinct from `INVALID_CREDENTIALS` on purpose: the caller is already authenticated, so there is no account to enumerate | `message` |
| `RATE_LIMITED` | 429 | Two unrelated sources. §1.5 — the 30-day username-change window, checked in JS. **Live.** `POST /api/auth/request-otp` — any of the three OTP limits (60s email cooldown, 10/day per email, 20/day per device), **or** Supabase's own per-address send cooldown (§limit e). They deliberately share one code; the client shows one countdown and does not need to know which fired | `next_allowed_at` (§1.5) **or** `retry_after_seconds`, `message` (request-otp) — never both |
| `CAPTCHA_FAILED` | 400 | **Live.** `POST /api/auth/request-otp` — Supabase rejected the Turnstile token, or could not reach Cloudflare. Only reachable once CAPTCHA protection is enabled on the Supabase project; before that a token is ignored and its absence is fine. Retryable at once — reset the widget, do not show a countdown | `message` |
| `SERVICE_BUSY` | 503 | **Live.** `POST /api/auth/request-otp` — the global circuit breaker: more than 2,000 OTP requests platform-wide in the last hour. Not the caller's fault and not tied to their identity. No `retry_after_seconds`, because we genuinely do not know when it clears | `message` |
| `CANNOT_FOLLOW_SELF` | 400 | `CHECK no_self_follow` | — |
| `BLOCKED` | 403 | Trigger `trg_prepare_follow` | — |
| `PRIVATE_ACCOUNT` | 403 | `can_view_social_content()` returned false | — |
| `CONTENT_TOO_LONG` | 400 | §6.6 controller validation | `max` |
| `CONTENT_BLOCKED` | 400 | `contains_banned_term(content, 'block')` | `message` |
| `TOO_MANY_IMAGES` | 400 | §6.6 controller / `CHECK posts_max_3_images` | `max` |
| `NESTED_REPLY_NOT_ALLOWED` | 400 | Trigger `trg_single_level_replies` | — |
| `ACCOUNT_SUSPENDED` | **403 or 400 — see below** | Trigger `trg_post_rate_limit` | — |
| `POSTING_RESTRICTED` | **403 or 400 — see below** | Trigger `trg_post_rate_limit` | `until` |
| `RATE_LIMIT_POSTS` | 429 | Trigger `trg_post_rate_limit` — 10 top-level posts/hour | `message` |
| `RATE_LIMIT_REPLIES` | 429 | Trigger `trg_post_rate_limit` — 30 replies/hour | — |

> **TODO — ambiguous in plan: two codes have two different HTTP statuses.** §6.6's error list
> says `403 ACCOUNT_SUSPENDED` and `403 POSTING_RESTRICTED`. But `mapDbError()` in §0.5.2
> reaches neither branch for these — they don't start with `RATE_LIMIT` and aren't `BLOCKED`
> — so it falls through to **400**. If `POST /api/posts` routes trigger exceptions through
> `mapDbError()` as §6.6 step 9 implies, the client gets 400 where the plan promised 403.
> **Which is correct: patch `mapDbError` to return 403 for these two, or change §6.6 to 400?**
> Note also that `POSTING_RESTRICTED` carries an `until` field that `mapDbError` cannot
> produce — it only ever emits `{ error: CODE }`, so this needs a special case either way.

---

## Read this before any Part 1 endpoint

These apply to **every route that exists today** and are not repeated in each entry. None of
them apply to Part 2, which is specified the way it should be, not the way Part 1 is.

**There is almost no authentication in this backend — one route now has it.**
`POST /api/auth/onboarding` is behind `requireAuth` as of CC-4 and takes the caller's id from
`req.user.id` only. **Every other endpoint is still `Auth: none`**, and the caller's identity
is whatever `user_id` / `userId` / `seller_id` / `sender_id` they put in the body, params or
query string. There is no ownership check on any other write, so any caller can still edit or
delete any product, overwrite any profile, or send a message as any user. Closing the rest is
§1.6 / CC-6 — the full inventory is in `docs/CURRENT_STATE.md` item 4 and the CC-4 audit list
in `docs/CHANGELOG.md`.

**The Supabase client uses the service-role key** (`backend/src/config/supabase.js`),
so every query bypasses RLS. RLS is not a backstop for this path.

**Error convention.** Every controller is one `try/catch`. The catch returns HTTP **500**
with `{ "error": "<a fixed human string>" }`. There is no error code, no `mapDbError()`, and
no distinction between "not found", "bad input", and "database is down" — a missing row from
a `.single()` call is a Postgres error, so **most not-found cases surface as 500**, not 404.
`GET /api/products/:id/meta` is the only route in the codebase that returns a 404.
`utils/respond.js` now exists and the §1.6 retrofit has started: `updateProduct` and
`deleteProduct` in `products.controller.js` use `sendError`, and `updateProduct`'s catch also
routes `23505`/`23503` through `mapDbError`. The rest of Part 1 still hand-rolls its bodies.

**No 404 handler and no error-handling middleware.** An unmatched path or an error thrown by
middleware (e.g. multer rejecting a 6th file) falls through to Express's default handler,
which responds with an **HTML** body, not JSON.

**CORS** branches on `NODE_ENV`.

- **Production** (`NODE_ENV === 'production'`): all origins, all the time —
  `Access-Control-Allow-Origin: *`. Unchanged from the previous bare `cors()`.
- **Development** (anything else): only origins whose hostname is `localhost`,
  `127.0.0.1`, `::1`, or in a private range (`10.x`, `192.168.x`, `172.16–31.x`),
  on any port. The origin is reflected rather than `*`. Anything else is refused
  the CORS headers.

`allowedHeaders` is `Content-Type, Authorization, X-Device-Id` in **both**
environments. `X-Device-Id` is not a CORS-safelisted header, so without it every
`POST /api/auth/request-otp` preflight from a browser fails.

**Pagination does not exist.** No route accepts `limit`, `offset`, or `cursor`. Feeds, chat
histories, and comment lists return every matching row.

**Base URL** is the server root; `PORT` defaults to `5000` and the server binds `0.0.0.0`
(override with `HOST`), so it is reachable over the LAN as well as on loopback. Routers mount at `/api/auth`,
`/api/academic`, `/api/universities`, `/api/user`, `/api/products`, `/api/messages`.

**Recurring row shapes** referenced below by name:

- `<users row>` — `id`, `university_id`, `full_name`, `avatar_url`, `created_at`,
  `year_of_study`, `bio`, `is_profile_complete`, `qualification`, `course_id`,
  `specialization_id`
- `<products row>` — `id`, `seller_id`, `university_id`, `title`, `description`, `price`,
  `category`, `image_urls`, `status`, `created_at`, `location`, `condition`, `views`,
  `likes_count`, `comments_count`, `sold_to`
- `<messages row>` — `id`, `sender_id`, `receiver_id`, `university_id`, `content`,
  `created_at`, `is_read`, `product_id`, `is_delivered`

---

## Table of contents

[Conventions](#conventions) · [Error code table](#error-codes-used-anywhere-in-this-api) · [Contract review checklist](#contract-review-checklist) · [Gaps](#gaps-between-part-1-and-part-2)

### Part 1 — implemented today

**[Root / health](#root--health)** (not in a module router)
- [GET /api/health](#get-apihealth)
- [GET /](#get)

**[auth](#auth)**
- [POST /api/auth/request-otp](#post-apiauthrequest-otp)
- [POST /api/auth/verify-otp](#post-apiauthverify-otp)
- [POST /api/auth/onboarding](#post-apiauthonboarding)
- [POST /api/auth/demo-login](#post-apiauthdemo-login)
- [POST /api/auth/login-password](#post-apiauthlogin-password)
- [POST /api/auth/set-password](#post-apiauthset-password)
- [GET /api/auth/password-status](#get-apiauthpassword-status)

**[academic](#academic)**
- [GET /api/academic/courses](#get-apiacademiccourses)
- [GET /api/academic/specializations](#get-apiacademicspecializations)

**[university](#university)**
- [GET /api/universities](#get-apiuniversities)

**[user](#user)**
- [GET /api/user/:userId/dashboard](#get-apiuseruseriddashboard)
- [PUT /api/user/:userId/profile](#put-apiuseruseridprofile)
- [POST /api/user/:userId/avatar](#post-apiuseruseridavatar)
- [GET /api/user/:userId/public](#get-apiuseruseridpublic)

**[products](#products)**
- [GET /api/products](#get-apiproducts)
- [GET /api/products/:id/meta](#get-apiproductsidmeta)
- [GET /api/products/:id](#get-apiproductsid)
- [POST /api/products](#post-apiproducts)
- [PUT /api/products/:id](#put-apiproductsid)
- [DELETE /api/products/:id](#delete-apiproductsid)
- [POST /api/products/:id/like](#post-apiproductsidlike)
- [POST /api/products/:id/save](#post-apiproductsidsave)
- [POST /api/products/:id/comments](#post-apiproductsidcomments)
- [POST /api/products/comments/:commentId/vote](#post-apiproductscommentscommentidvote)
- [POST /api/products/:id/sold](#post-apiproductsidsold)
- [POST /api/products/:id/available](#post-apiproductsidavailable)

**[messages](#messages)**
- [GET /api/messages/inbox/:userId](#get-apimessagesinboxuserid)
- [GET /api/messages/history](#get-apimessageshistory)
- [POST /api/messages/send](#post-apimessagessend)
- [PUT /api/messages/read](#put-apimessagesread)
- [PUT /api/messages/deliver](#put-apimessagesdeliver)

### Part 2 — the contract, not yet implemented

**[user module](#user-module)** — Neeraj · Phase 1
- [GET /api/users/username-available](#get-apiusersusername-available---owner-neeraj--phase-1)
- [GET /api/users/username-suggestions](#get-apiusersusername-suggestions---owner-neeraj--phase-1)
- [GET /api/users/by-username/:username](#get-apiusersby-usernameusername---owner-neeraj--phase-1)
- [GET /api/users/search](#get-apiuserssearch---owner-neeraj--phase-1)
- [PATCH /api/users/me/username](#patch-apiusersmeusername---owner-neeraj--phase-1)

**[social module](#social-module)** — Neeraj · Phase 3
- [POST /api/users/:id/follow](#post-apiusersidfollow---owner-neeraj--phase-3)
- [DELETE /api/users/:id/follow](#delete-apiusersidfollow---owner-neeraj--phase-3)
- [GET /api/users/:id/followers](#get-apiusersidfollowers---owner-neeraj--phase-3)
- [GET /api/users/:id/following](#get-apiusersidfollowing---owner-neeraj--phase-3)
- [GET /api/users/me/follow-requests](#get-apiusersmefollow-requests---owner-neeraj--phase-3)
- [POST /api/users/me/follow-requests/:followerId/accept](#post-apiusersmefollow-requestsfolloweridaccept---owner-neeraj--phase-3)
- [DELETE /api/users/me/follow-requests/:followerId](#delete-apiusersmefollow-requestsfollowerid---owner-neeraj--phase-3)
- [POST /api/users/:id/block](#post-apiusersidblock---owner-neeraj--phase-3)
- [DELETE /api/users/:id/block](#delete-apiusersidblock---owner-neeraj--phase-3)
- [GET /api/users/me/blocks](#get-apiusersmeblocks---owner-neeraj--phase-3)
- [PATCH /api/users/me/privacy](#patch-apiusersmeprivacy---owner-neeraj--phase-3)

**[notifications module](#notifications-module)** — Neeraj · Phase 5
- [GET /api/notifications](#get-apinotifications---owner-neeraj--phase-5)
- [GET /api/notifications/unread-count](#get-apinotificationsunread-count---owner-neeraj--phase-5)
- [POST /api/notifications/mark-read](#post-apinotificationsmark-read---owner-neeraj--phase-5)

**[reports module](#reports-module)** — Neeraj · Phase 6
- [POST /api/reports](#post-apireports---owner-neeraj--phase-6)

**[posts module](#posts-module)** — Vishwajeet · Phase 6
- [GET /api/posts/feed/campus](#get-apipostsfeedcampus---owner-vishwajeet--phase-6)
- [GET /api/posts/feed/global](#get-apipostsfeedglobal---owner-vishwajeet--phase-6)
- [GET /api/posts/feed/following](#get-apipostsfeedfollowing---owner-vishwajeet--phase-6)
- [GET /api/posts/:id](#get-apipostsid---owner-vishwajeet--phase-6)
- [GET /api/posts/:id/replies](#get-apipostsidreplies---owner-vishwajeet--phase-6)
- [POST /api/posts](#post-apiposts---owner-vishwajeet--phase-6)
- [DELETE /api/posts/:id](#delete-apipostsid---owner-vishwajeet--phase-6)
- [POST /api/posts/:id/like](#post-apipostsidlike---owner-vishwajeet--phase-6)
- [DELETE /api/posts/:id/like](#delete-apipostsidlike---owner-vishwajeet--phase-6)
- [GET /api/users/:username/posts](#get-apiusersusernameposts---owner-vishwajeet--phase-6)
- [GET /api/posts/feed/campus/count-since](#get-apipostsfeedcampuscount-since---owner-vishwajeet--phase-6)

**[admin module](#admin-module)** — Vishwajeet · Phase 8
- [GET /api/admin/reports](#get-apiadminreports---owner-vishwajeet--phase-8)
- [POST /api/admin/reports/:id/action](#post-apiadminreportsidaction---owner-vishwajeet--phase-8)
- [POST /api/admin/users/:id/restrict](#post-apiadminusersidrestrict---owner-vishwajeet--phase-8)
- [POST /api/admin/users/:id/suspend](#post-apiadminusersidsuspend---owner-vishwajeet--phase-8)
- [GET /api/admin/stats](#get-apiadminstats---owner-vishwajeet--phase-8)

---

## Root / health

Defined inline in `backend/src/app.js`, not in a module router. Included for completeness;
excluded from the module route count.

### GET /api/health
**Module:** — (app.js)
**Auth:** none
**Content-Type:** n/a (no body)
**200:** `{ "status": "Success", "message": "Yahora backend is up and running! 🚀..." }`
**Notes:** Static literal. Does not touch Supabase, so it stays 200 even when the database
is unreachable — it is a liveness check, not a readiness check.

### GET /
**Module:** — (app.js)
**Auth:** none
**Content-Type:** n/a (no body)
**200:** `Yahora API is successfully running! 🚀...` — plain string via `res.send()`, so the
response is `text/html`, **not** JSON.

---

## auth

`backend/src/modules/auth/auth.routes.js` → `auth.controller.js`.
`auth.service.js` exists but is an **empty file**; no route imports it.

### POST /api/auth/request-otp
**Module:** auth
**Auth:** none
**Content-Type:** application/json
**Headers:**
  - `X-Device-Id`: string, **optional** — an opaque id the client generates once and stores.
    Accepted only if it matches `/^[A-Za-z0-9-]{1,64}$/` (a UUID qualifies); anything else is
    treated exactly as if the header were absent. **A missing header is never an error** — the
    mobile app does not send one and is unaffected. Its only effect is to opt the caller into
    the per-device cap below. Sending it is in the client's own interest: without it, a shared
    campus device has no separate quota.
**Body:**
  - email: string, required
  - captchaToken: string, **optional** — a Cloudflare Turnstile token from the widget on the
    login page. Forwarded verbatim to Supabase and **never validated here**; a value that is
    absent, empty, whitespace, or not a string is passed on as `undefined`. **A missing token
    is never an error on our side** — Supabase decides, and only once CAPTCHA protection is
    enabled for the project. Until then a token is accepted and ignored, and a request without
    one succeeds. That is what lets the code deploy before the dashboard setting is flipped,
    in either order, with no window where logins break.
**200:** `{ "message": "OTP sent successfully!", "university": "string" }` — `university` is
the university **name**, not its id.
**400:** `{ "error": "Email is required" }`
**400:** `{ "error": "Invalid email format" }` — when `email.split('@')[1]` is falsy (no `@`,
or nothing after it).
**400:** `{ "error": "CAPTCHA_FAILED", "message": "We could not verify that you are a real
visitor. Please reload the page and try again." }` — Supabase rejected the Turnstile token
(missing, invalid, expired, already used) or could not reach Cloudflare. Matched on GoTrue's
`captcha_failed` error code, with a message match on *captcha* as a fallback for older builds.
Checked **before** the 429 branch, so a captcha failure is never reported as a rate limit. The
client should reset the widget and let the student retry **immediately** — there is no cooldown
to wait out. A rejected token writes no `otp_requests` row, so it costs the student no quota.
**403:** `{ "error": "Unauthorized Domain. Yahora is not yet available at your university." }`
**429:** `{ "error": "RATE_LIMITED", "retry_after_seconds": 42, "message": "Too many code requests. Please try again shortly." }`
  — also sets a `Retry-After` header with the same number of seconds. Fired by any of the
  three limits in the table below; the response does not say which, on purpose.
**500:** `{ "error": "INTERNAL_ERROR" }` — `mapDbError` fallback when the `otp_requests`
  ledger cannot be read. The limiter **fails closed**, same as `login-password`.
**500:** `{ "error": "Internal server error while sending OTP." }` — the pre-existing catch-all.
**503:** `{ "error": "SERVICE_BUSY", "message": "We are temporarily unable to send login codes. Please try again in a few minutes." }`
  — the circuit breaker. No `retry_after_seconds`. Clients should show a "try again later"
  message, **not** a countdown, and must not retry automatically.

**The OTP is minted on the anon-key client** (`supabaseAnon`), not the service-role one. GoTrue
exempts service-role callers from captcha entirely, so on the service-role client the token was
forwarded and then ignored, and enabling CAPTCHA protection had no effect at all. Verified
2026-09-01 — see `docs/CHANGELOG.md` Handoff A. Every limit in the table below still runs on the
service-role client, and all of them run first.

**Turnstile keys are per-environment, and sitekey and secret only work as a matching pair.**
Local development uses Cloudflare's published **dummy** pair — the "always passes" sitekey in
`frontend/.env`, and the matching dummy secret that local Supabase reads from the root `.env`
via `supabase/config.toml`. Production uses the **real** pair: the real sitekey in the web
build, the real secret in the Supabase dashboard. **A dummy sitekey checked against a real
secret is rejected every time, and so is the reverse** — a mismatched pair fails every request
here with `400 CAPTCHA_FAILED` and no other symptom, so check the pairing first when local auth
starts failing for no visible reason. Neither key belongs in this backend: it never holds the
secret and never mints the token — it forwards `captchaToken` and nothing else. Values are in
`docs/CHANGELOG.md` Handoff A and `frontend/.env.example`.

**Rate limits.** All four checks run before `signInWithOtp`, so a blocked request sends no
email and creates no `auth.users` row. Rolling windows throughout — never calendar days.

| # | Limit | Counted over | Threshold | Response |
|---|---|---|---|---|
| a | Circuit breaker | **all** rows, last 1 hour | 2,000 | `503 SERVICE_BUSY` |
| b | Email cooldown | one email, last 24h | from the 4th request, 60s since the last | `429 RATE_LIMITED` |
| c | Email daily cap | one email, last 24h | 10 | `429 RATE_LIMITED` |
| d | Device daily cap | one `X-Device-Id`, last 24h | 20 | `429 RATE_LIMITED` |
| e | **Supabase's own cooldown** | one email address, enforced by GoTrue | `[auth.email] max_frequency` | `429 RATE_LIMITED` |

`retry_after_seconds` is computed from the oldest request that still counts against the limit —
the moment a slot actually frees — so it is an honest countdown, not a flat window length.

**Limit (e) is not ours.** GoTrue enforces a minimum gap between two emails to the same address
and answers `429 over_email_send_rate_limit`. It fires *inside* `signInWithOtp`, after a–d have
passed, so it writes no `otp_requests` row and does not move our counters. It is mapped to the
same `429 RATE_LIMITED` shape rather than surfaced as a 500; `retry_after_seconds` is parsed out
of GoTrue's message, clamped to 1–60, and falls back to 60 if the wording changes.

Because (e) is per-address and (b) allows three requests before its cooldown, **(e) is the
binding constraint whenever it is set longer than the gap between requests.** Note `"0s"` does
not disable it — GoTrue reads zero as unset and applies its own 60s default.

**Measured values (2026-09-01, via the Management API):**

| | production | local `config.toml` |
|---|---|---|
| `smtp_max_frequency` / `max_frequency` | **1s** | `1ms` |
| `rate_limit_email_sent` / `email_sent` | **30/hour** | `100/hour` |

So (b) **does** engage in production for human-paced retries — a student clicking "resend" is
seconds apart, well outside a 1s gap, and the 4th request inside a minute gets our `RATE_LIMITED`.
(e) only intercepts sub-second bursts. A *scripted* burst like Block D step 4 fires four requests
in tens of milliseconds, so against production it returns `200, 429, 429, 429` rather than the
runbook's `200, 200, 200, 429` — that test is a **local-only** validation of limits b–d, which is
why local `max_frequency` is `1ms`.

⚠ **The hourly email cap, not the circuit breaker, is the real ceiling in production.**
`OTP_HOURLY_CEILING` is 2,000/hour, but Supabase stops sending at **30/hour** project-wide, so
limit (a) can never fire — the 31st OTP in any hour fails at Supabase instead, with a 429 whose
message carries no seconds, so `retry_after_seconds` falls back to 60 and understates a wait that
may be up to an hour. Raise `rate_limit_email_sent` to match the SMTP plan (Brevo) and set
`OTP_HOURLY_CEILING` just below it, so our own `503 SERVICE_BUSY` fires first, as designed.

**No limit counts by IP address, and none ever will.** Campus Wi-Fi NATs a whole college behind
one address, so an IP limit would lock out every student after the first twenty each morning.
`req.ip` is recorded in `otp_requests` for after-the-fact analysis and is never read by a
limiter. See runbook 2.2.

**Notes:** Gate order is limits-first, then domain: the four checks above run before the
`universities` lookup, so a flood costs one indexed count rather than a domain query per
request. A request with an unknown domain still 403s and, because the ledger row is only
written after Supabase accepts, never accumulates a count of its own. Calls
`supabaseAnon.auth.signInWithOtp` with `shouldCreateUser: true`, so a valid-domain address is
created in `auth.users` on first request — `cleanup_unverified_users()` (hourly cron) deletes
those again after 24h if the code is never verified. Supabase's own per-address cooldown is
mapped to **429 `RATE_LIMITED`** — limit (e) above. It reached the catch-all as a 500 until
2026-09-01, which made a one-second local cooldown look exactly like the backend being down.
The 403 discloses whether a campus is onboarded. A successful send is recorded in
`otp_requests`; if that insert fails it is logged and the caller still gets the 200, because a
failed audit write must not break a login.

### POST /api/auth/verify-otp
**Module:** auth
**Auth:** none
**Content-Type:** application/json
**Body:**
  - email: string, required
  - otp: string, required — passed to Supabase as `token`, with `type: 'email'`
**200:**
```json
{
  "message": "Authentication successful",
  "session":  { "access_token": "string", "refresh_token": "string", "expires_in": 3600,
                "expires_at": 0, "token_type": "bearer", "user": { } },
  "userAuth": { "id": "uuid", "email": "string", "...": "full Supabase auth user" },
  "userProfile": { "<users row>": "..." }
}
```
**400:** `{ "error": "Email and OTP are required" }`
**500:** `{ "error": "Internal server error while verifying OTP." }`
**Notes:** **A wrong or expired OTP returns 500, not 401.** Every failure below the
validation check — bad token, unknown university domain, insert failure — lands in the same
catch. Clients cannot distinguish "you typed it wrong" from "the server is broken".

On first successful verification the `users` row holds only `id`, `university_id`, and
`is_profile_complete: false`; every other profile column is null. **Since migration 005 that
row is created by the `on_auth_user_created` trigger, not by this controller.** The controller
still writes it as an `upsert(..., { onConflict: 'id', ignoreDuplicates: true })` — a fallback
for a database where the trigger is missing (dropped by a Supabase upgrade, or restored from
before 005). When the trigger is present the upsert is a no-op that returns zero rows, and the
controller re-reads the row rather than calling `.single()` on nothing. The existence probe is
`.single()`, which errors when the row is absent — that error is captured into `userFetchError`
and never read, which is what makes the fallback path work.

`userProfile.is_profile_complete` is the routing flag: `false` → onboarding, `true` → home.
Response keys are camelCase (`userAuth`, `userProfile`) while the row contents are
snake_case.

### POST /api/auth/onboarding
**Module:** auth
**Auth:** **required (Bearer token)** — the only authenticated route in Part 1. The target user
is `req.user.id` from the verified token and nothing else.
**Content-Type:** application/json
**Body:**
  - full_name: string, required
  - username: string, required — trimmed and lowercased server-side before any check, so
    `"Rahul.Sharma "` is stored as `rahul.sharma`
  - password: string, required, min 8 — never logged, never echoed back
  - qualification: string, required — free text (e.g. `'Graduation'`), not an enum
  - course_id: uuid, required
  - year_of_study: string, required — free text (e.g. `'3rd year'`)
  - specialization_id: uuid, required
  - avatar_url: string, optional — stored as `null` when falsy
  - bio: string, optional, max 250 — stored as `null` when falsy
  - ~~userId~~: **removed.** If a caller sends it, it is ignored in silence — not read, not
    validated, not errored on. See the security note below.
**200:** `{ "message": "Profile completed successfully!", "userProfile": { "<users row>": "..." },
  "session": { "access_token": "...", "refresh_token": "...", "expires_at": 0, "user": {} } }`
  — the row now also carries `username`, `has_password: true` and `is_profile_complete: true`.
  **`session` is a fresh session for the caller, same shape as `verify-otp`'s.** Store it and
  replace the token you made this call with — the old one is already dead (see below).
  ⚠️ **`session` is omitted entirely — never `null` — if the re-signin failed.** The profile is
  still saved and the password is still set; the client must send the student to log in. Treat a
  missing `session` as "re-authenticate", not as an error.
**400:** `{ "error": "MISSING_FIELDS", "message": "..." }`
**400:** `{ "error": "CONTENT_TOO_LONG", "max": 250, "message": "Bio must be 250 characters or less." }`
**400:** `{ "error": "INVALID_FORMAT", "message": "..." }` — no `username` sent, or the handle
  is unavailable for a reason that is neither reserved nor taken (i.e. it fails
  `users_username_valid`)
**400:** `{ "error": "USERNAME_RESERVED" }`
**400:** `{ "error": "USERNAME_TAKEN" }` — either the availability check saw it, or the unique
  index caught the race a millisecond later. Both produce this same code.
**400:** `{ "error": "WEAK_PASSWORD", "message": "..." }` — under 8 characters, identical to the
  chosen username, or rejected by GoTrue's own policy
**400:** `{ "error": "COMMON_PASSWORD", "message": "..." }`
**401:** `{ "error": "UNAUTHORIZED" }` — missing or invalid Bearer token
**404:** `{ "error": "NOT_FOUND", "message": "No profile exists for this account." }` — the
  token is valid but no `public.users` row exists. Near-impossible with `on_auth_user_created`
  in place; documented so it is a 404 and not a 500.
**500:** `{ "error": "INTERNAL_ERROR" }` — `mapDbError` fallback only

**🔒 Security — this route used to be an account-takeover hole.** Until CC-4 it read `userId`
from the body on a route with no middleware, so anyone who knew a UUID could complete or
overwrite that student's profile. Now that the same call also sets the account password, the
same request would have been full takeover. Identity is `req.user.id`, full stop.

**⚠️ The token you called this with is DEAD when it returns — use the `session` in the body.**
GoTrue revokes every existing session when a password is set, and this endpoint sets one, so the
token that authorised the request is rejected (`403 session_not_found` from GoTrue, `401
UNAUTHORIZED` from us) immediately afterwards. That has not changed and **is not a bug**: a
password change should log out every other device.

What changed (2026-08-25) is that the caller no longer gets caught in it. After the password is
set the handler signs in once on `createSessionClient()` with the email and the password just
set, and returns that session as `session`. Verified end-to-end by
`backend/scripts/diagnose-token.mjs` **S10**: the new token is accepted by GoTrue's own
`/auth/v1/user`, the old one is refused by both hops, and the account's other sessions stay
revoked. The CC-4 open question — "should this mint a session the way `verify-otp` does?" — is
answered yes, and closed.

**Order of operations (do not reorder).** Validate everything → set the password via
`auth.admin.updateUserById` → **only if that succeeded**, write the profile row with
`is_profile_complete: true` and `has_password: true`. The reverse order strands a student with
a complete profile and no password: the app never routes them back to onboarding, so nothing
ever prompts them to set one. The failure mode of *this* order is harmless — they retry and the
password is simply set again.

**Username rules are the database's, not this controller's.** `is_username_available(p_username,
p_user_id)` decides charset, length, the reserved list and the 30-day cooling-off window in one
call. The controller re-queries `reserved_usernames` / `users` / `username_history` **only to
label** which of the four reasons applies; there is no regex and no copy of the reserved list in
JavaScript, and `INVALID_FORMAT` is reached by elimination. A JS reimplementation that drifted
from `users_username_valid` would tell a student a handle is free and then 500 on the insert.

**The `23505` catch is the point of the endpoint.** Availability is not a reservation: two
students can both be told "free" and both submit. Only `users_username_key` can arbitrate, and
it reports the loser as Postgres `23505`, mapped here to `400 USERNAME_TAKEN`. A 500 on that
path is a bug. (`mapDbError` maps `23505` to the generic `DUPLICATE`; this endpoint names it
before falling through, because the handle is the only unique column in play.)

**Notes:** The required-field check is a single truthiness test, so an empty string fails the
same way a missing key does. Nothing verifies that `course_id` and `specialization_id` are
consistent with each other. **Note the doubled-separator gap:** `users_username_valid` permits
`rahul..sharma` and `rahul__sharma` (Instagram-style), so those are accepted here — see the
runbook discrepancy logged in `docs/CHANGELOG.md`.

### POST /api/auth/demo-login
**Module:** auth
**Auth:** none
**Content-Type:** n/a — the body is ignored entirely
**200:** Same four keys as `verify-otp`:
`{ "message": "Demo login successful", "session": { }, "userAuth": { }, "userProfile": { "<users row>": "..." } }`
**500:** `{ "error": "Demo university not found. Please run the seed script first." }` — when
no `universities` row has `domain = 'demo.yahora.com'`. Note this is a **500 with a specific
message**, i.e. a 500 that is not the generic catch.
**500:** `{ "error": "Internal server error during demo login." }`
**Notes:** Every call creates a **real, permanent** `auth.users` account plus a `users` row —
email `guest_<timestamp>_<random6>@demo.yahora.com`, password `Demo!<timestamp><random6>`,
`email_confirm: true` via the admin API — then immediately signs in to mint a session. There
is no rate limit, so this endpoint is an unbounded account-creation primitive.

**This route returned 500 for every call between migration 005 and CC-4.** Each demo login
mints a brand-new auth user, so `on_auth_user_created` had always created the `users` row by
the time step 5 ran, and step 5's plain `.insert()` hit `23505` on the primary key. It is now
an `upsert(..., { onConflict: 'id', ignoreDuplicates: true })` that reads the trigger's row
back. Fixed — no client change needed.

Cleanup is the `cleanup_demo_users` RPC, run by `node-cron` at `0 0 * * *` (midnight daily)
from `backend/src/utils/cronJobs.js`. The log line there says "weekly"; the schedule is
daily.

`is_profile_complete` is deliberately `false` so demo users still see onboarding. Demo-campus
users also get the chat auto-responder — see [POST /api/messages/send](#post-apimessagessend).

### POST /api/auth/login-password
**Module:** auth
**Auth:** none — this is how a client obtains a token
**Content-Type:** application/json
**Body:**
  - identifier: string, required — a username **or** an email. Trimmed and lowercased
    server-side, so `"Rahul "` and `rahul` are the same account *and the same lock*
  - password: string, required — never logged, never echoed back
**200:** Byte-identical in shape **and message** to `verify-otp`, so clients reuse one storage path:
```json
{
  "message": "Authentication successful",
  "session":  { "access_token": "string", "refresh_token": "string", "...": "..." },
  "userAuth": { "id": "uuid", "email": "string", "...": "full Supabase auth user" },
  "userProfile": { "<users row>": "..." }
}
```
**400:** `{ "error": "INVALID_CREDENTIALS", "message": "Incorrect username or password. Please try again." }`
**429:** `{ "error": "TOO_MANY_ATTEMPTS", "retry_after_seconds": 900, "message": "Too many failed attempts. Please try again later." }`
  — also sets a `Retry-After` header with the same number of seconds
**404:** `{ "error": "NOT_FOUND", "message": "No profile exists for this account." }` — credentials
  were correct but no `public.users` row exists. Near-impossible with `on_auth_user_created`
  in place; documented so it is a 404 and not a 500.
**500:** `{ "error": "INTERNAL_ERROR" }` — `mapDbError` fallback, including an unreadable
  `auth_attempts` ledger (see "fails closed" below)

**🔒 There is exactly one failure response, and that is the feature.** Wrong password, unknown
username, unknown email, and an account that has no password all return the **same status, the
same code and the same sentence**. Do not build a client that branches on the reason — there is
no reason in the payload, and adding one would be a security regression. If these ever differ,
even in wording, anyone can test identifiers to learn which are real, then concentrate guessing
on those; on a campus app it also answers *"is this specific classmate on Yahora?"*, which is a
harassment precursor. Runbook §0.6.

**`PASSWORD_NOT_SET` does not exist in this API.** An account with `has_password = false`
(someone who verified an OTP and then abandoned onboarding) gets `INVALID_CREDENTIALS` like
everyone else. The backend logs the real reason to the **server console** —
`[login] has_password=false for <uuid> — onboarding never finished` — and tells the client
nothing. That path is only reachable when the identifier is a **username**; see the limitation
note below.

**Order of operations (do not reorder).** Rate limit → resolve identifier → `has_password`
check → sign in. The limiter runs **before any credential is touched**: a limiter placed after
the password check hands an attacker one free verification per request no matter how locked the
account is.

**The lockout is on the identifier, never the IP.** 10 failed attempts for one identifier inside
15 minutes → `429` until the tenth-newest failure ages out of the window. `req.ip` **is**
written to `auth_attempts.ip_address` for later analysis and is **never** read by the limiter —
campus Wi-Fi NATs an entire hostel behind one address, so an IP lock would take out hundreds of
students because one person fat-fingered their password. (`req.ip` is the socket address unless
`app.js` sets `trust proxy`; it is a data-quality caveat only, since nothing gates on it.)

`retry_after_seconds` is **computed, not a constant** — it is the time until the tenth-newest
failure leaves the 15-minute window, so a student 40 seconds from unlocking is told 40, not 900.
It is capped at 900 and floored at 1.

**A correct password while locked is still `429`.** The lock is on the identifier, not on being
wrong. That is what makes it a lockout rather than a speed bump. A successful login clears every
`succeeded = false` row for that identifier and writes one `succeeded = true` row, which is kept
as an audit trail.

**Every failed path writes a ledger row, including "no such user."** If a failed lookup were
free, someone could probe thousands of handles a minute at no cost. Two exceptions, neither of
them a probe: a missing/empty `identifier`, and an `identifier` longer than 320 characters
(RFC 5321's ceiling) — both return `INVALID_CREDENTIALS` without touching the database, so
`auth_attempts` cannot be used as an arbitrary-size write primitive.

**Fails closed.** If `auth_attempts` cannot be read, the request is a `500` rather than an
unlimited-guessing window. In practice the same database holds the `users` row this endpoint has
to return, so a login was failing anyway.

**Sign-in runs on `createSessionClient()`, never the shared client.** supabase-js stores the
returned session *on the client instance*; calling `signInWithPassword` on the shared
service-role client demotes it to that student's `authenticated` JWT for every later query the
**process** makes, until it restarts. See `config/supabase.js` and the 2026-08-12 CHANGELOG
entry.

**✅ FIXED (migration 007) — the `has_password=false` console log now fires for BOTH identifier
forms.** It previously fired only for a username, which meant it never fired at all in practice:
the check needs the caller's `public.users` row *before* sign-in, `public.users` has no email
column, `get_login_email()` mapped handle→email only, and a student who abandoned onboarding has
no username yet — so email was the only identifier they had, and the email path could not read
the flag. `get_login_identity(p_identifier)` (migration 007) now returns `id`, `email` and
`has_password` for both forms in one call, which also collapses the two lookups the username
path used to make. **Client-visible behaviour is unchanged**: the response is the same generic
`INVALID_CREDENTIALS` either way.

**✅ FIXED (migration 007) — the stale `has_password` cache is backfilled.** `has_password` was
added by 005 with `default false` and 006 backfilled only `username`, so nothing ever set the
flag for accounts whose password already existed in `auth.users` (the six named `seed.sql`
logins, every `seedDemo.js` persona — all 20+ rows read `false`). Username login was therefore
rejected at step 4 for every pre-existing account. Migration 007 reconciles the cache with what
it is a cache *of* (`auth.users.encrypted_password is not null`); verified locally, 27 rows
corrected and zero rows disagreeing afterwards. It is idempotent and only ever flips
`false → true`, never the reverse — a `true` with no `encrypted_password` would mean something
wrote the cache outside `set-password`, and silently repairing that would hide it.

⚠️ **This backfill is not cosmetic and must ship WITH 007.** Once `get_login_identity()` makes
the flag readable on the email path too, a stale `false` stops being a wart and starts locking
those accounts out of *every* login path, not just the username one.

**Notes:** Identifier form is decided by a single `includes('@')` test, and `get_login_identity()`
applies the same test internally so the two can never disagree about which lookup ran. It is
`SECURITY DEFINER` and revoked from `anon`, `authenticated` and `PUBLIC` — it maps a public
handle to a private address *and* discloses whether an account exists at a given address, so it
is service-role only. `get_login_email()` is left in place but no longer called; it can be
dropped once every environment is past 007. Because the lock keys on what was typed, a student locked out under their username can
still log in with their email (and vice versa) — the two identifiers are two locks. This is
inherent to identifier-based locking and is accepted: both still cost the attacker a full
lockout each, and neither reveals whether the other exists.

### POST /api/auth/set-password
**Module:** auth
**Auth:** **required (Bearer token)** — the account is `req.user.id`; there is no target
parameter to tamper with
**Content-Type:** application/json
**Body:**
  - password: string, required, min 8 — the new password. Never logged, never echoed back
  - current_password: string, **required only when the account already has a password**
    (`has_password = true`). Ignored entirely when it does not
**200:** `{ "message": "Password set", "has_password": true,
  "session": { "access_token": "...", "refresh_token": "...", "expires_at": 0, "user": {} } }`
  — `session` is a fresh session for the caller, same shape as `verify-otp`'s. **Omitted
  entirely, never `null`, if the re-signin failed** — the password change still succeeded, so
  send the student to log in rather than showing an error.
**400:** `{ "error": "WEAK_PASSWORD", "message": "..." }` — under 8 characters, identical to the
  caller's username, or rejected by GoTrue's own policy
**400:** `{ "error": "COMMON_PASSWORD", "message": "..." }`
**400:** `{ "error": "MISSING_FIELDS", "message": "Your current password is required to change it." }`
  — `has_password` is already true and `current_password` was absent or empty
**401:** `{ "error": "UNAUTHORIZED" }` — missing or invalid Bearer token
**401:** `{ "error": "INVALID_CURRENT_PASSWORD", "message": "Your current password is incorrect." }`
**404:** `{ "error": "NOT_FOUND", "message": "No profile exists for this account." }`
**500:** `{ "error": "INTERNAL_ERROR" }`

**⚠️ The token you called this with is DEAD when it returns — use the `session` in the body**
— exactly as with `POST /api/auth/onboarding`. GoTrue revokes every existing session when a
password is set, so the token that authorised this request is rejected immediately afterwards.

**Every other device stays logged out. That is the point, and it is deliberately unchanged.**
Only the caller is handed a replacement, minted from the password they just typed. A settings
screen should swap its stored token for `session.access_token` on the `200`; if it keeps the old
one, the student appears logged out the instant their password change succeeds.

**Why `current_password` is required for a change but not the first set.** The first set happens
during onboarding, seconds after the student proved they own the university inbox — that is
strong enough. A later change could be someone at a phone left unlocked on a library desk, so it
needs proof they know the existing one.

**`INVALID_CURRENT_PASSWORD` is deliberately specific**, unlike `login-password`'s single
string. The caller is already authenticated as themselves, so there is no account to enumerate
and no reason to be vague about which field was wrong.

**Order of operations (do not reorder).** Validate → verify `current_password` (via
`createSessionClient().auth.signInWithPassword`, never the shared client) → set the password via
`auth.admin.updateUserById` → write `has_password = true` → **only then** mint the replacement
session. The mint is last because it must never be able to fail the request:
the password change has already committed and GoTrue gives us nothing to roll back with. `has_password` is a
cache of `auth.users.encrypted_password` (migration 005 §2), so it must never be flipped before
GoTrue has confirmed the real change — a `true` with no password behind it would lock the
student out of the password tab with no way back except a support ticket.

**Not rate limited.** `current_password` verification does not write to `auth_attempts` and has
no lockout, so a caller holding a valid Bearer token can guess the existing password without
limit. Accepted for now: they already hold a token for that account, so the only thing guessing
buys them is the plaintext itself (worth something only if the student reuses it elsewhere).
Worth adding to the ledger if the settings screen ever ships to production — it would introduce
a `429 TOO_MANY_ATTEMPTS` on this route, which is why it was not done inside CC-5's contract.

**Notes:** The password policy is the same code and the same constants as onboarding —
`MIN_PASSWORD_LENGTH = 8` plus the ~20-entry blocklist in `auth.controller.js`, and the new
password may not equal the caller's username. **`MISSING_FIELDS` on an absent `current_password`
is an addition to the Block E contract**, which listed only `WEAK_PASSWORD`, `COMMON_PASSWORD`
and `INVALID_CURRENT_PASSWORD`; a client that forgets the field gets a precise answer instead of
a misleading "incorrect". Nothing else in the contract changed.

### GET /api/auth/password-status
**Module:** auth
**Auth:** **required (Bearer token)**
**200:** `{ "has_password": true }`
**401:** `{ "error": "UNAUTHORIZED" }` — missing or invalid Bearer token
**404:** `{ "error": "NOT_FOUND", "message": "No profile exists for this account." }`
**500:** `{ "error": "INTERNAL_ERROR" }`
**Notes:** Reports on the **caller's own** account only — `req.user.id`, never a parameter. A
public "does this account have a password?" oracle would be exactly the enumeration primitive
`login-password` is built to avoid, so this route must never grow a user id. Reads the
`users.has_password` cache, not `auth.users`. Web no longer needs this (the *"set a password to
sign in faster"* card was dropped in §0.6); it exists for mobile and for the settings screen.

---

## academic

`backend/src/modules/academic/academic.routes.js` → `academic.controller.js`.

### GET /api/academic/courses
**Module:** academic
**Auth:** none
**Content-Type:** n/a (no body)
**200:** A **bare array**, not an object:
`[ { "id": "uuid", "name": "string" } ]` — ordered by `name` ascending.
**500:** `{ "error": "Failed to fetch courses" }`
**Notes:** One of only three endpoints that return a top-level array rather than a wrapper
object (the other two are `/api/academic/specializations` and `/api/universities`). Every
other endpoint wraps its payload. Not campus-scoped: the full global list, every call, no
pagination.

### GET /api/academic/specializations
**Module:** academic
**Auth:** none
**Content-Type:** n/a (no body)
**200:** Bare array — `[ { "id": "uuid", "name": "string" } ]`, ordered by `name`.
**500:** `{ "error": "Failed to fetch specializations" }`
**Notes:** Identical shape to `/courses`. Specializations are **not** linked to a course in
the schema, so this list cannot be filtered by the `course_id` chosen during onboarding.

---

## university

`backend/src/modules/university/university.routes.js` → `university.controller.js`.

### GET /api/universities
**Module:** university
**Auth:** none
**Content-Type:** n/a (no body)
**200:** Bare array — `[ { "id": "uuid", "name": "string", "domain": "string" } ]`, ordered
by `name`.
**500:** `{ "error": "Failed to fetch universities" }`
**Notes:** Mounted at the plural `/api/universities` while every other module is singular
(`/api/user`, `/api/academic`) — except `/api/products`, which is also plural. Returns the
demo campus (`demo.yahora.com`) alongside real ones, with no flag distinguishing it.

---

## user

`backend/src/modules/user/user.routes.js` → `user.controller.js`.
Path params are camelCase (`:userId`); query params and body fields are snake_case.

### GET /api/user/:userId/dashboard
**Module:** user
**Auth:** none — any caller can read any user's full private dashboard.
**Content-Type:** n/a (no body)
**Path:**
  - userId: uuid, required
**200:**
```json
{
  "profile": {
    "<users row>": "... every column ...",
    "course":         { "name": "string" },
    "specialization": { "name": "string" },
    "university":     "string",
    "courseName":         "string",
    "specializationName": "string"
  },
  "listings": [ { "id": "uuid", "title": "string", "description": "string",
                  "category": "string", "condition": "string", "location": "string",
                  "price": 0, "status": "string", "image_urls": ["string"],
                  "created_at": "timestamptz", "likes_count": 0, "views": 0,
                  "comments_count": 0 } ],
  "purchases": [ { "id": "uuid", "created_at": "timestamptz",
                   "product": { "id": "uuid", "title": "string", "price": 0,
                                "image_urls": ["string"] } } ]
}
```
**500:** `{ "error": "Failed to fetch dashboard data." }` — **including when the user does not
exist**, because the profile fetch uses `.single()`.
**Notes:** The `profile` object is genuinely inconsistent and worth reading twice. The join
returns nested `course`, `specialization`, and `university` objects; the spread keeps all
three, then the literal `university: profile.university?.name` **overwrites** `university`
with a plain string. So `course` and `specialization` stay nested objects while `university`
is a string — and the same names also appear flattened as `courseName` and
`specializationName`. Those two are the only camelCase keys inside an otherwise snake_case
object, and when the join is null they are `undefined`, so the keys **vanish from the JSON**
rather than appearing as `null`.

`listings` has **no status filter** — sold products are included (contrast
[`/public`](#get-apiuseruseridpublic), which returns only `available`). `listings` and
`purchases` fall back to `[]`, but `profile` has no such guard. `purchases[].product` is
`null` if the product row was deleted. No `is_liked` / `is_saved` on these listings.

### PUT /api/user/:userId/profile
**Module:** user
**Auth:** none — no ownership check whatsoever.
**Content-Type:** application/json
**Path:**
  - userId: uuid, required
**Body:** **Unvalidated pass-through.** The controller does `const updates = req.body` and
hands the entire object to `.update()`. There is no allow-list and no field validation, so
any writable `users` column can be set: `university_id` (moves a user to another campus,
defeating multi-tenant isolation), `is_profile_complete`, `full_name`, `bio` (the 250-char
check from onboarding is **not** applied here), `avatar_url`, `qualification`, `course_id`,
`specialization_id`, `year_of_study`, even `id`.
**200:** `{ "message": "Profile updated successfully!", "userProfile": { "<users row>": "..." } }`
**500:** `{ "error": "Failed to update profile." }` — a key that is not a column produces a
PostgREST schema-cache error and lands here.
**Notes:** Returns the row under `userProfile`, matching `verify-otp` and `onboarding`. This
endpoint can also set `avatar_url` directly to an arbitrary string, bypassing the upload and
old-file cleanup in [POST /api/user/:userId/avatar](#post-apiuseruseridavatar).

### POST /api/user/:userId/avatar
**Module:** user
**Auth:** none
**Content-Type:** multipart/form-data
**Path:**
  - userId: uuid, required
**Body:**
  - avatar: File, required — **exactly one** file, field name `avatar` (`upload.single`)
**200:** `{ "message": "Avatar updated successfully!", "avatar_url": "string" }`
**400:** `{ "error": "No image file provided." }` — when the `avatar` field is absent.
**500:** `{ "error": "Failed to update avatar." }`
**Notes:** No MIME-type check, no size limit, no image validation — multer buffers whatever
arrives into memory and it is uploaded with the client's own `Content-Type`. A file sent
under any field name other than `avatar` makes multer throw before the controller runs; with
no error middleware, the response is Express's default **HTML** error page.

Deletion of the previous avatar is best-effort: the old public URL is split on `/avatars/`
and the trailing segment removed from the `avatars` bucket. A delete failure is logged and
swallowed on purpose, so the upload still succeeds and orphaned files accumulate. New object
name is `<userId>-<Date.now()>.<ext>` with `upsert: true`; the extension comes from the
client-supplied filename.

The response returns only the URL — it does **not** return the updated `<users row>`, unlike
every other user-mutating endpoint.

### GET /api/user/:userId/public
**Module:** user
**Auth:** none
**Content-Type:** n/a (no body)
**Path:**
  - userId: uuid, required — whose profile to read
**Query:**
  - user_id: uuid, optional — **the visitor**, i.e. who is looking. Note the collision: the
    path param `:userId` is the profile owner, the query param `user_id` is the viewer.
**200:**
```json
{
  "profile": {
    "id": "uuid", "full_name": "string", "avatar_url": "string", "bio": "string",
    "qualification": "string", "year_of_study": "string", "created_at": "timestamptz",
    "course":         { "name": "string" },
    "specialization": { "name": "string" },
    "university":     "string",
    "courseName":         "string",
    "specializationName": "string"
  },
  "listings": [ { "id": "uuid", "title": "string", "price": 0, "image_urls": ["string"],
                  "created_at": "timestamptz", "views": 0, "likes_count": 0,
                  "condition": "string", "status": "string",
                  "is_liked": false, "is_saved": false } ]
}
```
**500:** `{ "error": "Failed to fetch public profile." }` — including for an unknown user.
**Notes:** This is the safe projection: an explicit column list that omits `university_id`,
`course_id`, `specialization_id`, and `is_profile_complete`. The same `university` /
`courseName` overwrite quirk as the dashboard applies (see above).

`listings` is filtered to `status = 'available'`. `is_liked` and `is_saved` are attached
**only** when `user_id` is supplied *and* the user has at least one listing — otherwise the
keys are **absent entirely**, not `false`. Treat `undefined` as `false` on the client.

There is no campus check: any user can read any other user's public profile across campuses.

---

## products

`backend/src/modules/products/products.routes.js` → `products.controller.js`.
`products.service.js` exists but is an **empty file**; no route imports it.
Multer is configured as `multer({ storage: multer.memoryStorage() })` — every upload is
buffered in process memory with no size limit.

### GET /api/products
**Module:** products
**Auth:** none
**Content-Type:** n/a (no body)
**Query:**
  - university_id: uuid, required
  - user_id: uuid, optional — the viewer, used to attach interaction state
**200:**
```json
{
  "products": [ { "<products row>": "... every column ...",
                  "seller": { "id": "uuid", "full_name": "string", "avatar_url": "string" },
                  "is_liked": false,
                  "is_saved": false } ]
}
```
**400:** `{ "error": "university_id query parameter is required." }`
**500:** `{ "error": "Failed to fetch marketplace feed." }` — a `university_id` that is not a
valid UUID lands here (Postgres cast error), not in the 400.
**Notes:** Filtered to `status = 'available'`, ordered `created_at` descending.
**No pagination, no limit, no cursor** — the entire campus feed is returned in one response,
including every `image_urls` array. This is the endpoint most likely to hurt on mobile.

`is_liked` / `is_saved` are attached only when `user_id` is present **and** the result set is
non-empty; otherwise the keys are absent, not `false`. They are computed with two extra
queries run in parallel and matched in memory via `Set`.

`university_id` is taken from the caller, not from the caller's own record, so passing
another campus's id returns that campus's feed. Campus isolation is not enforced here.

### GET /api/products/:id/meta
**Module:** products
**Auth:** none
**Content-Type:** n/a (no body)
**Path:**
  - id: uuid, required
**200:**
```json
{
  "product": { "id": "uuid", "title": "string", "description": "string", "price": 0,
               "condition": "string", "status": "string",
               "image": "string|null",
               "seller_name": "string|null",
               "university_name": "string|null" }
}
```
**404:** `{ "error": "Product not found." }`
**500:** `{ "error": "Failed to fetch product meta." }`
**Notes:** Built for Open Graph link previews. **The only route in the codebase that returns
a 404** — its guard is `if (error || !product)`, so even a malformed (non-UUID) id yields 404
rather than 500.

Sets `Cache-Control: public, max-age=300, s-maxage=300`; the only route that sets a cache
header. Deliberately does **not** increment `views` and does **not** join comments — that is
the whole reason it is separate from `GET /api/products/:id`.

Response is flattened and renamed: `image` is `image_urls[0]` (or `null`), `seller_name` and
`university_name` are pulled out of the joins. These three key names exist nowhere else in
the API. Route registration order matters — it is declared **before** `/:id` so that `meta`
is not swallowed as an id segment.

### GET /api/products/:id
**Module:** products
**Auth:** none
**Content-Type:** n/a (no body)
**Path:**
  - id: uuid, required
**Query:**
  - user_id: uuid, optional — the viewer
**200:**
```json
{
  "product": {
    "<products row>": "... every column ...",
    "seller": { "id": "uuid", "full_name": "string", "avatar_url": "string",
                "qualification": "string", "year_of_study": "string" },
    "comments": [ { "id": "uuid", "content": "string", "created_at": "timestamptz",
                    "upvotes": 0, "downvotes": 0, "parent_comment_id": "uuid|null",
                    "user": { "id": "uuid", "full_name": "string", "avatar_url": "string" },
                    "user_vote": 0 } ],
    "is_liked": false,
    "is_saved": false
  }
}
```
**500:** `{ "error": "Failed to fetch product details." }` — **a product that does not exist
returns 500, not 404**, because of `.single()`. So does a non-UUID id.
**Notes:** **Every call increments `views`** via the `increment_product_views` RPC — including
the seller viewing their own listing, and including refreshes. The counter is a view count in
name only. (Contrast `/meta`, which was split out precisely to avoid this.)

`comments` is a **flat** list — replies are not nested; nest client-side on
`parent_comment_id`. Ordered `created_at` **descending** (newest first), which means replies
can appear before their parents. There is no depth limit in the API.

`is_liked` / `is_saved` / `user_vote` appear only when `user_id` is supplied. `user_vote` is
`1`, `-1`, or `0` (`0` meaning no vote), and is set on every comment; the whole block is
skipped without `user_id`, so the keys are then absent.

The seller projection here (5 fields) differs from the one in `GET /api/products` (3 fields).

### POST /api/products
**Module:** products
**Auth:** none — `seller_id` is a body field, so a caller can list a product as any user.
**Content-Type:** multipart/form-data
**Body:**
  - images: File[], required, **max 5**, field name `images` (`upload.array('images', 5)`)
  - seller_id: uuid, required in practice — **not** covered by the validation check
  - title: string, required — DB max 255
  - price: string→number, required — coerced with `Number(price)`
  - category: string, required — DB max 100, free text, no enum
  - description: string, optional
  - location: string, optional — DB max 255
  - condition: string, optional — DB default `'Good'`
**201:** `{ "message": "Product listed successfully!", "product": { "<products row>": "..." } }`
— note **201**, not 200.
**400:** `{ "error": "At least one image is required." }` — checked **first**, before the
title/price/category check.
**400:** `{ "error": "Title, price, and category are required." }`
**500:** `{ "error": "Failed to create product listing." }` — also the response when
`seller_id` is missing or unknown (thrown internally as `'Seller not found.'`, but that string
is only logged, never returned), and when `Number(price)` is `NaN`.
**Notes:** `university_id` is **derived from the seller's record**, not accepted from the
client — the one place campus isolation is actually enforced on write. `status` is forced to
`'available'`; `sold_to` is never written by any endpoint.

Images upload **sequentially** to the `products` bucket as
`<seller_id>-<Date.now()>-<random>.<ext>`, `upsert: false`. There is no MIME or size
validation. **If upload N fails, uploads 1..N-1 stay in the bucket and no product row is
created** — orphaned files, no cleanup path.

Sending a 6th file makes multer throw `LIMIT_UNEXPECTED_FILE` before the controller runs;
with no error middleware the client gets Express's default **HTML** error page, not JSON. The
same applies to any file sent under a field name other than `images`.

### PUT /api/products/:id
**Module:** products
**Auth:** **required (Bearer token)** — and the caller must be the listing's `seller_id`
**Content-Type:** application/json
**Path:**
  - id: uuid, required
**Body:** **a true partial update — send only the fields you are changing.** At least one of:
  - title: string
  - description: string
  - price: number (or a numeric string) — must parse to a finite number `>= 0`
  - category: string
  - location: string
  - condition: string
  - status: string — arbitrary, so this endpoint can set a status no other code produces

  Keys outside this list are ignored. Absent keys are left untouched; a key sent as `null` or
  `''` is written as sent (except `price`, which rejects both).
**200:** `{ "message": "Product updated successfully", "product": { "<products row>": "..." } }`
**400:** `{ "error": "INVALID_PRICE", "message": "Price must be a number greater than or equal
  to 0." }` — `price` was supplied but does not parse to a finite number `>= 0`. `null`, `''`
  and booleans are rejected explicitly, because `Number()` maps all three onto a finite number
**400:** `{ "error": "MISSING_FIELDS", "message": "Send at least one field to update." }` — the
  body carried none of the seven updatable keys. An `UPDATE` with no columns is a PostgREST
  error, not a no-op, so it is refused here
**400:** `{ "error": "DUPLICATE" }` / `{ "error": "INVALID_REFERENCE" }` — `23505` / `23503`
  from the update, via `mapDbError`. These used to surface as `INTERNAL_ERROR`
**401:** `{ "error": "UNAUTHORIZED" }` — missing or invalid Bearer token
**403:** `{ "error": "FORBIDDEN", "message": "You can only edit your own listings." }` — the
  caller is not the `seller_id`
**404:** `{ "error": "NOT_FOUND", "message": "That listing no longer exists." }`
**500:** `{ "error": "INTERNAL_ERROR", "message": "Failed to update product." }`
**🔒 Ownership is enforced (plan §1.6 Bug 1, fixed 2026-08-23).** The handler reads
`seller_id` for `:id` and compares it to `req.user.id` **before** the update. It used to take
the id from the URL and update with no actor at all, so anyone who knew a listing's uuid could
rewrite its title, price and status on any campus. There is deliberately no `seller_id` in the
body to compare against — a caller-supplied one would be the same hole.
**Notes:** **Partial updates work (plan §1.6 Bug 2, fixed 2026-08-25).** The payload is built
from the keys the caller actually sent, tested with `hasOwnProperty` rather than truthiness, so
`description: ''` and `price: 0` are real edits and survive. A title-only `PUT` is now a 200.

Previously the payload was built unconditionally from seven destructured fields. Six were
harmless — `JSON.stringify` drops `undefined` — but `price` was coerced with `Number(price)`
first, and `Number(undefined)` is `NaN`, which serializes to `null`. Against the `NOT NULL`
`products.price` that raised `23502` and the seller got a generic **500**, so every `PUT` had
to carry a numeric `price` even when only the title was changing. A bad `price` is now a
**400 `INVALID_PRICE`** instead.

`university_id` and `seller_id` cannot be changed here. Updating a non-existent id now returns
a clean **404** (the ownership lookup uses `maybeSingle()`); it used to be a 500.

### DELETE /api/products/:id
**Module:** products
**Auth:** **required (Bearer token)** — and the caller must be the listing's `seller_id`
**Content-Type:** n/a (no body)
**Path:**
  - id: uuid, required
**200:** `{ "message": "Product deleted successfully" }`
**401:** `{ "error": "UNAUTHORIZED" }` — missing or invalid Bearer token
**403:** `{ "error": "FORBIDDEN", "message": "You can only delete your own listings." }`
**404:** `{ "error": "NOT_FOUND", "message": "That listing no longer exists." }`
**500:** `{ "error": "INTERNAL_ERROR", "message": "Failed to delete product." }`
**🔒 Ownership is enforced (plan §1.6 Bug 1, fixed 2026-08-23).** Same check as the `PUT`, and
it mattered more here: an unauthenticated `DELETE` on a known uuid destroyed any listing on any
campus, cascading to its comments, likes, saves and purchases.
**Notes:** **Deleting an id that does not exist now returns 404, not 200.** The ownership
lookup runs first and cannot find a row to authorise, so the old "delete affecting zero rows is
a success" behaviour is gone. The response still never contains the deleted row.

Images are **not** removed from the `products` storage bucket (there is a comment in the
source acknowledging this), so every delete orphans up to 5 files.

Database cascades do the rest: `comments`, `product_likes`, `product_saves`, and `purchases`
rows are deleted; `messages.product_id` is set to `NULL`, which silently removes those
conversations from [the inbox](#get-apimessagesinboxuserid), since that RPC inner-joins
`products`.

### POST /api/products/:id/like
**Module:** products
**Auth:** **required (Bearer token)** — the actor is `req.user.id`
**Content-Type:** application/json
**Path:**
  - id: uuid, required — becomes `product_id`
**Body:** none required. ⚠️ **`user_id` is no longer read.** A body carrying one is **ignored in
  silence** — rejecting it would only tell an attacker the parameter used to work.
**200 (was liked, now removed):** `{ "message": "Product unliked", "is_liked": false }`
**200 (was not liked, now added):** `{ "message": "Product liked", "is_liked": true }`
**401:** `{ "error": "UNAUTHORIZED" }` — missing or invalid Bearer token
**403:** `{ "error": "CROSS_CAMPUS_INTERACTION_BLOCKED", "message": "You can only interact with
  listings on your own campus." }`
**404:** `{ "error": "NOT_FOUND", "message": "That listing no longer exists." }` — also returned
  when the caller has no `public.users` row (`"No profile exists for this account."`)
**500:** `{ "error": "INTERNAL_ERROR", "message": "Failed to toggle like status." }`
**🔒 Identity + campus are enforced (plan §1.6 Bug 2 / CURRENT_STATE item 4, fixed 2026-08-23).**
Two separate holes were closed here. The actor used to come from `req.body.user_id`, so anyone
could like or unlike **as any student**. And there was no campus check at all: the product rule
is *browse across campuses, interact only on your own*, and
[GET /api/products](#get-apiproducts) is deliberately cross-campus, so the API was allowing an
interaction the rule forbids. The handler now compares the product's `university_id` to the
caller's. A `NULL` on either side is treated as a **mismatch, not a pass** — every account
created through `request-otp` has a validated domain and therefore a campus, so no real student
is affected.
**Notes:** Toggle, not idempotent-set — the same request twice returns to the original state.

**The insert and delete results are never checked.** Only `data` is destructured from the
existence probe, and neither the `insert` nor the `delete` return value is inspected. A failed
insert (bad `user_id`, FK violation) still returns **200 with `is_liked: true`**, so the
client shows a like that does not exist. Re-verify with a fetch if it matters.

`likes_count` on the product is maintained by the `trg_update_likes_count` database trigger,
not by this controller — and the new count is **not** returned, so clients must either
increment locally or refetch.

### POST /api/products/:id/save
**Module:** products
**Auth:** **required (Bearer token)** — the actor is `req.user.id`
**Content-Type:** application/json
**Path:**
  - id: uuid, required — becomes `product_id`
**Body:** none required. ⚠️ **`user_id` is no longer read** — see `/like` above.
**200 (was saved, now removed):** `{ "message": "Product removed from wishlist", "is_saved": false }`
**200 (was not saved, now added):** `{ "message": "Product saved to wishlist", "is_saved": true }`
**401:** `{ "error": "UNAUTHORIZED" }`
**403:** `{ "error": "CROSS_CAMPUS_INTERACTION_BLOCKED", "message": "You can only interact with
  listings on your own campus." }`
**404:** `{ "error": "NOT_FOUND", "message": "That listing no longer exists." }`
**500:** `{ "error": "INTERNAL_ERROR", "message": "Failed to toggle save status." }`
**🔒 Identity + campus are enforced**, exactly as on `/like` — same guard, same codes.
**Notes:** Identical structure to `/like`, including the unchecked-write behaviour: a failed
insert still returns 200 with `is_saved: true`. There is no counter and no trigger for saves,
and **no endpoint exists to list a user's saved products** — `product_saves` can only be read
back through the `is_saved` flag on the feed, product detail, and public-profile endpoints.

### POST /api/products/:id/comments
**Module:** products
**Auth:** none — `user_id` is a body field, so a caller can comment as anyone.
**Content-Type:** application/json
**Path:**
  - id: uuid, required — becomes `product_id`
**Body:**
  - user_id: uuid, required
  - content: string, required — **no length limit enforced** in code or schema (`text`)
  - parent_comment_id: uuid, optional — stored as `null` when falsy
**201:**
```json
{
  "message": "Comment added successfully",
  "comment": { "id": "uuid", "content": "string", "created_at": "timestamptz",
               "upvotes": 0, "downvotes": 0, "parent_comment_id": "uuid|null",
               "user": { "id": "uuid", "full_name": "string", "avatar_url": "string" } }
}
```
**500:** `{ "error": "Failed to post comment." }` — also the response for an unknown
`user_id` (internally `'User not found.'`) and for a missing `content` (`NOT NULL` violation).
**Notes:** There is **no validation of `content` at all** — an empty string `""` satisfies
`NOT NULL` and is accepted, as is a comment of unbounded length.

`university_id` is copied from the **commenter's** record, not the product's, so a
cross-campus comment is filed under the commenter's campus.

`parent_comment_id` is **not** checked against the same product, and nesting depth is
unlimited — a reply can point at a comment on a different product entirely.

The returned `comment` shape matches the entries in `GET /api/products/:id` exactly, except
that `user_vote` is absent. `comments_count` on the product is maintained by the
`trg_update_comments_count` trigger and is not returned here.

### POST /api/products/comments/:commentId/vote
**Module:** products
**Auth:** none — `user_id` is a body field.
**Content-Type:** application/json
**Path:**
  - commentId: uuid, required
**Body:**
  - user_id: uuid, required
  - vote_value: number, required — must be exactly `1` or `-1`
**200:** `{ "message": "Vote registered successfully" }`
**400:** `{ "error": "Invalid vote value. Must be 1 or -1." }`
**500:** `{ "error": "Failed to register vote." }`
**Notes:** Path is `/api/products/comments/...` — a comment resource living under the products
prefix, and the only route in the module whose first segment is not `:id`.

The check is `[1, -1].includes(vote_value)`, a strict comparison: the **string** `"1"` is
rejected with 400. Send a JSON number.

Behaviour is delegated to the `toggle_comment_vote` RPC: no existing vote → insert; same value
again → **delete** (un-vote); opposite value → update. So this is a three-state toggle, not a
set.

**The response tells you nothing about the outcome** — not the resulting vote state, not the
new `upvotes` / `downvotes`. The counts are maintained by the `trg_update_comment_votes`
trigger. A client must predict the new state locally or refetch the product.

`user_id` is not validated before the RPC; a bad one surfaces as a 500.

### POST /api/products/:id/sold
**Module:** products
**Auth:** none — **no ownership check**. Any caller can mark any product sold.
**Content-Type:** application/json
**Path:**
  - id: uuid, required
**Body:**
  - buyer_id: uuid, optional — when present, a `purchases` row is recorded
**200:** `{ "message": "Product marked as sold", "product": { "<products row>": "..." } }`
**500:** `{ "error": "Failed to mark product as sold." }`
**Notes:** Sets `status = 'sold'`. The product then disappears from `GET /api/products` and
from `/public` listings, but still appears in the owner's `/dashboard`.

**The `purchases` insert is fire-and-forget**: its error is logged to the server console and
the endpoint still returns 200. A "sold" response does not guarantee the purchase record
exists.

There is **no idempotency** — calling this twice with the same `buyer_id` inserts two
`purchases` rows, and both show up in the buyer's dashboard.

The `products.sold_to` column is never written by this or any other endpoint.

### POST /api/products/:id/available
**Module:** products
**Auth:** none — **no ownership check**.
**Content-Type:** n/a — the body is ignored
**Path:**
  - id: uuid, required
**200:** `{ "message": "Product marked as available", "product": { "<products row>": "..." } }`
**500:** `{ "error": "Failed to mark product as available." }`
**Notes:** The inverse of `/sold`: sets `status = 'available'` and **deletes every
`purchases` row for that product** — not just the one from the most recent sale. If the item
was sold and re-listed more than once, all purchase history for it is destroyed. Like the
insert in `/sold`, the delete error is logged and ignored, so a 200 does not prove it
happened.

---

## messages

`backend/src/modules/messages/messages.routes.js` → `messages.controller.js`.
Note the casing split inside this module: **query and body params are camelCase**
(`userId`, `contactId`, `productId`) on `/history`, `/read`, and `/deliver`, but
**snake_case** (`sender_id`, `receiver_id`, `product_id`) on `/send`. There is no consistent
convention.

A conversation is keyed by the **pair of users plus the product** — the same two people
discussing two products have two separate threads. There is no `conversations` table.

The `messages` table is in the `supabase_realtime` publication, so clients receive inserts
over Supabase Realtime directly; these endpoints are the write path and the backfill.

### GET /api/messages/inbox/:userId
**Module:** messages
**Auth:** none — any caller can read any user's inbox.
**Content-Type:** n/a (no body)
**Path:**
  - userId: uuid, required
**200:**
```json
{
  "inbox": [ { "contact_id": "uuid", "contact_name": "string", "contact_avatar": "string",
               "product_id": "uuid", "product_title": "string", "product_image": "string",
               "last_message": "string", "last_message_time": "timestamptz",
               "unread_count": 0 } ]
}
```
**500:** `{ "error": "Failed to fetch inbox." }` — including for a non-UUID `userId`.
**Notes:** Entirely delegated to the `get_user_inbox(p_user_id)` RPC. One row per
`(product, contact)` pair, latest message first. Falls back to `[]`, so an empty inbox is 200
with an empty array, not an error.

`product_image` is `image_urls[1]` in Postgres — the **first** element (Postgres arrays are
1-indexed), matching `image_urls[0]` in JS.

The RPC **inner-joins** `users` and `products`, so a conversation whose product was deleted
disappears from the inbox entirely — the messages still exist and are still reachable through
`/history`, but with `product_id` set to `NULL` by the cascade they can no longer be
addressed. `unread_count` counts messages from that contact, on that product, with
`is_read = false`.

Field names here (`contact_*`, `product_title`, `product_image`) are unique to this endpoint.

### GET /api/messages/history
**Module:** messages
**Auth:** **required (Bearer token)** — and `req.user.id` must be one of the two parties
**Content-Type:** n/a (no body)
**Query:**
  - userId: uuid, required — **validated**, must be a canonical 8-4-4-4-12 uuid
  - contactId: uuid, required — **validated**
  - productId: uuid, required — **validated**
**200:** `{ "messages": [ { "<messages row>": "..." } ] }` — full rows, ordered `created_at`
**ascending** (oldest first, for chat rendering).
**400:** `{ "error": "INVALID_FORMAT", "message": "userId, contactId and productId must all be
  valid UUIDs." }` — any of the three missing or malformed. This used to be a **500**.
**401:** `{ "error": "UNAUTHORIZED" }` — missing or invalid Bearer token
**403:** `{ "error": "FORBIDDEN", "message": "You can only read conversations you are part
  of." }` — the caller is neither `userId` nor `contactId`
**500:** `{ "error": "INTERNAL_ERROR", "message": "Failed to fetch messages." }`

**🔒 Filter injection is fixed (CURRENT_STATE item 3, fixed 2026-08-23).** `userId` and
`contactId` are string-interpolated into a PostgREST `.or()` filter **expression**:
`and(sender_id.eq.${userId},receiver_id.eq.${contactId}),and(...)`. Unlike `.eq()`, where
supabase-js encodes the value, an `.or()` argument is a filter *grammar* parsed server-side, so
a value carrying `,` or `)` closes the expression early and appends conditions of the
attacker's choosing. **This was confirmed exploitable, not theoretical:** on a product carrying
two separate conversations, payloads such as `<uuid>),or(id.not.is.null` returned all 9
messages instead of the caller's 6 — leaking a thread they were not in. All three params are
now checked against an anchored uuid regex *before* they reach the string; there is nothing to
escape with once concatenated, so validation is the only correct control. `productId` is
validated too — it only reaches the injection-safe `.eq()`, but a non-uuid there made Postgres
raise `22P02`, which surfaced as a 500 on what is really a bad request.

**🔒 Participation is enforced.** Validation alone still let anyone read any thread by naming
two other students. Either party is accepted — the thread is symmetric, so a client passing the
pair in the other order is still asking for its own conversation, and pinning `userId` to
`req.user.id` would reject that legitimate call for no security gain.

Returns the **entire** history for the pair+product — no limit, no cursor, no
`before`/`after`. On a long thread this grows without bound.

Reading history does **not** mark anything read; that requires a separate
[PUT /api/messages/read](#put-apimessagesread).

### POST /api/messages/send
**Module:** messages
**Auth:** none — `sender_id` is a body field, so a caller can send a message **as any user**.
**Content-Type:** application/json
**Body:**
  - sender_id: uuid, required
  - receiver_id: uuid, required
  - product_id: uuid, required
  - content: string, required — no length limit
**201:** `{ "message": { "<messages row>": "..." } }`
**500:** `{ "error": "Failed to send message." }` — also the response for an unknown
`sender_id` (internally `'User not found.'`) and for missing `content`.
**Notes:** Here `message` is the **row object**; on nearly every other endpoint `message` is a
human-readable status string. Do not write a shared client helper that assumes one or the
other.

`university_id` is taken from the **sender's** record. `is_read` is set `false` explicitly;
`is_delivered` falls to the column default `false`. Nothing verifies that sender and receiver
share a campus, that the product exists, or that the receiver is the product's seller.

**Demo auto-responder.** After the 201 is already sent, the controller checks whether the
sender's university domain is `demo.yahora.com`. If so, it looks up the receiver's
`full_name`, picks one of **11** canned replies at random (personalised with the receiver's
first name, falling back to `'Student'`), and after a `setTimeout` of **3 seconds** inserts
that reply as a message **from the receiver to the sender**. Consequences worth knowing:

- The bot reply arrives over Realtime, not in this response.
- It is indistinguishable from a real message — same table, same columns, no bot flag.
- The timer lives in process memory: a restart within those 3 seconds loses the reply.
- The whole block is wrapped in its own `try/catch` that only logs, so a bot failure never
  affects the caller.

### PUT /api/messages/read
**Module:** messages
**Auth:** none
**Content-Type:** application/json
**Body:**
  - userId: uuid, required — the **receiver** (the person doing the reading)
  - contactId: uuid, required — the sender whose messages are being marked
  - productId: uuid, required — the thread
**200:** `{ "success": true }`
**500:** `{ "error": "Failed to update read status." }`
**Notes:** One of only two endpoints returning `{ success: true }` rather than a `message`
string — a third response convention in the same API.

Marks messages **addressed to `userId` from `contactId` on `productId`** where
`is_read = false`, setting **both** `is_read: true` and `is_delivered: true` (a message read
must have been delivered). Direction matters: this cannot mark your own sent messages read.

**Returns 200 even when zero rows matched** — no row count is checked, so success does not
mean anything was updated. Missing params reach Postgres as invalid UUIDs → 500.

### PUT /api/messages/deliver
**Module:** messages
**Auth:** none — any caller can mark any user's messages delivered.
**Content-Type:** application/json
**Body:**
  - userId: uuid, required — the receiver
**200:** `{ "success": true }`
**500:** `{ "error": "Failed to update delivery status." }`
**Notes:** **Global, not per-thread.** Marks *every* undelivered message addressed to `userId`
as `is_delivered: true`, across every conversation and every product. Intended to be called
once on app foreground.

Does not touch `is_read`. Returns 200 whether or not any row changed.

---

# PART 2 — The contract

> ⛔ **Nothing below this line is implemented.** These are the shapes both clients will be
> built against, transcribed from `docs/YAHORA_BUILD_PLAN.md` before anyone writes code. An
> entry here is a promise, not a description. If you implement one differently, you must
> change this file in the same commit (Golden Rule 3) — the other developer's client is
> already written against what it says, and they cannot see your session.

Each entry names the **migration** it depends on. Do not start an endpoint before its
migration is applied; the RPCs and triggers it calls will not exist.

**Enforced by** lines name the database object that owns a rule. Where you see one, **do not
re-implement that check in JavaScript.** §0.5.4: if your code and the trigger ever disagree,
you get a bug nobody can find. Your job is to read the outcome back and map the exception
through `mapDbError()`.

---

## user module

**Owner: Neeraj · Phase 1 · Depends on migrations 002, 003 · Files:
`backend/src/modules/user/{user.routes.js,user.controller.js}` · Mounted at `/api/users`**

Five endpoints for handles and search. Read plan §1.1 and §1.2 before starting even though
you are not writing the SQL — `is_username_available()` already does four checks in one call,
so your controller makes one RPC, not four queries.

> The four routes already live at `/api/user/...` (Part 1) are unrelated pre-existing code in
> the same files. Do not change their paths or shapes.

### GET /api/users/username-available   `OWNER: Neeraj`  `PHASE 1`
> **STATUS: IMPLEMENTED** (2026-08-23). Live at `/api/users/username-available` *and*, via the
> legacy mount, `/api/user/username-available`. Behind `optionalAuth`. ⚠️ Written by Vishwajeet
> in Neeraj's file to unblock web signup — see docs/CHANGELOG.md.
**Module:** user
**Auth:** optional — when signed in, pass the caller's own id so their *current* handle reads
as available rather than "taken by you"
**Content-Type:** n/a (no body)
**Query:**
  - username: string, required — the candidate handle
**200 (available):** `{ "available": true }`
**200 (not available):**
```json
{
  "available": false,
  "reason": "TAKEN",
  "suggestions": ["rahul.7402", "rahul_iiitk", "r.sharma"]
}
```
`reason` ∈ `"TAKEN"` | `"RESERVED"` | `"INVALID_FORMAT"` | `"RECENTLY_RELEASED"`
**Enforced by:** `is_username_available(p_username, p_user_id)` — a single `SECURITY DEFINER`
RPC that checks **all four** of: format (3–20 chars, lowercase, no leading/trailing or doubled
`.`/`_`), membership of `reserved_usernames`, an existing `users.username`, and the 30-day
`username_history.reserved_until` cooling-off window. Do not re-implement any of the four.
**Notes:** `SECURITY DEFINER` is what lets this work before the caller is fully authenticated,
and it only ever returns a boolean — it never leaks who holds the handle. Clients debounce
this by 400ms and discard stale responses (§2.1); an unthrottled call per keystroke sends 11
requests for `rahulsharma` and they arrive out of order.
**✅ SETTLED — `reason` is a LABEL, not a second opinion.** `is_username_available()` still
decides, in one RPC, on the success path. Only when it says *false* does the controller ask
`reserved_usernames` / `users` / `username_history` — three indexed lookups in parallel, on the
failure path only — purely to NAME the reason it was already given. `INVALID_FORMAT` is what is
left by elimination when none of the three hit. §1.5's "one RPC rather than four queries" is
about not re-deriving the RULES, and it holds: there is no regex in the controller and no copy
of the reserved list. Same shape as `classifyUnavailableUsername()` in `auth.controller.js`,
with one deliberate difference — that one folds `RECENTLY_RELEASED` into `TAKEN` because at
submit time the distinction changes nothing, whereas here it is worth telling a student their
handle is on a 30-day hold rather than gone forever. Neither ever says *who* held it.

**✅ SETTLED — `suggestions` is always present when `available: false`,** and is derived from the
**rejected handle**, not from a display name: `suggest_usernames()` slugifies whatever it is
given, so feeding it the rejected handle yields near-misses of what the student actually wanted
(`arjun.mehta` → `amehta`, `arjun.mehta.1961`) rather than something derived from a name they
may not have typed yet. It is `[]` when the RPC finds nothing or itself fails — suggestions are
a nicety, and a failure there must not cost the student the verdict.

**Note — reserved reads as "taken" in the UI.** The API still reports the true
`reason: "RESERVED"`. The web client deliberately renders the *same sentence* for `TAKEN` and
`RESERVED` ("That handle is already taken. Please choose another."): "reserved" reads as a
system error a student might retry, and said across enough guesses it maps out the reserved list
for anyone probing. Keep the reasons distinct in the payload; keep the copy identical.

### GET /api/users/username-suggestions   `OWNER: Neeraj`  `PHASE 1`
> **STATUS: IMPLEMENTED** (2026-08-23). Behind `optionalAuth`. ⚠️ Written by Vishwajeet in
> Neeraj's file — see docs/CHANGELOG.md.
**Module:** user
**Auth:** optional
**Content-Type:** n/a (no body)
**Query:**
  - name: string, required — the student's full name, e.g. `Rahul%20Sharma`
**200:** `{ "suggestions": ["rsharma", "rahul.sharma.5525", "rahul.sharma.5651"] }` — **settled.**
At most 3. `{ "suggestions": [] }` rather than a 404 when nothing can be generated.
**400:** `{ "error": "MISSING_FIELDS", "message": "A name is required." }`
**Enforced by:** `suggest_usernames(p_name, p_university_id)` — returns exactly 3 available
handles: the plain slug, the slug plus a campus abbreviation, and first-initial-plus-surname,
topped up with random 4-digit suffixes until it has three. Every candidate is passed through
`is_username_available()` first, so all three are free at the moment of the call.
**Notes:** free at the moment of the call is not a reservation — two students onboarding
simultaneously can be offered the same suggestion. The unique index is the real arbiter.
Suffixes are random rather than sequential so they don't leak your user count.
**✅ SETTLED — `p_university_id` comes from the caller's OWN row, or is null.** When the request
carries a valid Bearer token the controller reads `users.university_id` for `req.user.id`;
signed out it passes `null` and the campus-flavoured suggestion simply is not produced. It is
**never** taken from a query parameter — a caller-supplied `university_id` would let anyone mint
handles styled for a campus they are not on. A failure to read the campus is logged and
downgraded to `null` rather than failing the request, since it only affects one of the three
candidates.

### GET /api/users/by-username/:username   `OWNER: Neeraj`  `PHASE 1`
**Module:** user
**Auth:** optional — logged-out visitors must be able to load a public profile
**Content-Type:** n/a (no body)
**Path:**
  - username: string, required — the handle, no `@`
**200 (profile):**
```json
{
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
```
**200 (moved handle):** `{ "redirect_to": "rahul.sharma" }`
**404:** `{ "error": "USER_NOT_FOUND" }`
**Enforced by:** `trg_record_username_change` on `users` — archives the old handle into
`username_history` on every change, which is the only reason the `redirect_to` case can work.
`can_view_social_content(p_viewer, p_target)` from Phase 3 gates the private-account fields.
**Notes:** **three distinct 200 shapes** — a profile, or a redirect, or (Phase 3 onward) a
profile with `can_view_content: false`. A client that assumes `user` is always present breaks
the moment someone changes their handle. Navigate a `redirect_to` with *replace*, not push, or
the back button loops (§2.2).

`course` and `specialization` are **flat strings** here, unlike Part 1's `/api/user/:userId/public`
which returns them as nested `{ name }` objects plus `courseName`/`specializationName`. Two
different shapes for the same data — this is the one the new clients use.

`followers_count`, `following_count` and `is_private` do not exist until migration 004. In
Phase 1 they are hardcoded `0`/`0`/`false`; they become real at Handoff B.
**Phase 3 change (Handoff B):** the `viewer` block gains two fields and renames one:
```json
"viewer": {
  "is_self": false,
  "is_following": true,
  "follow_status": "accepted",
  "is_blocked_by_me": false,
  "can_view_content": true
}
```
Drive the Follow button entirely off `follow_status`: `null` → "Follow", `"pending"` →
"Requested", `"accepted"` → "Following".
**TODO — ambiguous in plan:** §1.5 specifies `is_blocked`; Handoff B specifies
`is_blocked_by_me`. **Is this a rename in Phase 3 (breaking any Phase 1–2 client), or do both
ship?** A rename needs a `BREAKING` entry in `docs/CHANGELOG.md`.
**TODO — ambiguous in plan:** when `can_view_content` is false, §3.2 says the response still
carries handle, name, avatar, university and counts but hides bio, course and year. **Are
`bio`, `course` and `year_of_study` omitted from the JSON, or present as `null`?** The two
require different client code, and "omitted" is what the Part 1 endpoints already do
accidentally with `courseName`.

### GET /api/users/search   `OWNER: Neeraj`  `PHASE 1`
**Module:** user
**Auth:** required (Bearer token)
**Content-Type:** n/a (no body)
**Query:**
  - q: string, required — the search term
  - limit: int, optional, default 20, **cap at 50**
**200:** rows of `{ "id", "username", "full_name", "avatar_url", "university_name",
"is_same_campus", "rank" }` — envelope unresolved, see the TODO below
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `search_users(p_query, p_viewer, p_limit)` — prefix match via the
`users_username_prefix_idx` (`text_pattern_ops`) plus trigram fuzzy match on username and
full name. Ordering is fixed inside the RPC: exact match first, then same-campus, then
similarity `rank`. **Do not re-sort in JavaScript** — §2.5 relies on the backend order.
**Notes:** `p_viewer` is what makes `is_same_campus` meaningful, so pass `req.user.id`. Fuzzy
matching means "rahl" still finds "rahul". Clients debounce 300ms (§2.5).
**TODO — ambiguous in plan:** **this list is not cursor-paginated and cannot be.** §3.2 says
"use cursor pagination for **every** list in this project: followers, following, feeds,
replies, notifications, **search**" — but `search_users()` takes only `p_limit`, has no cursor
parameter, and is ordered by a computed `rank` that no index can seek into. **Is search
exempt (a fixed top-N with no `next_cursor`), or does the RPC need a cursor parameter?**
**TODO — ambiguous in plan:** no envelope is specified. `{ "users": [...] }` matches the
sibling social endpoints; `{ "items": [...] }` matches `sendPage`. Pick one.

### PATCH /api/users/me/username   `OWNER: Neeraj`  `PHASE 1`
**Module:** user
**Auth:** required (Bearer token)
**Content-Type:** application/json
**Body:**
  - username: string, required — e.g. `"rahul.sharma"`. Lowercase and trim before sending.
**200:** `{ "user": { "...": "the updated user object" } }`
**400:** `{ "error": "USERNAME_TAKEN" }` — the handle went in the moment before you did
**400:** `{ "error": "USERNAME_RESERVED" }`
**400:** `{ "error": "INVALID_FORMAT" }`
**429:** `{ "error": "RATE_LIMITED", "next_allowed_at": "2026-09-06T..." }`
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:**
- `trg_username_not_reserved` on `users` → raises `USERNAME_RESERVED`. A `CHECK` constraint
  cannot query another table, which is why this is a trigger.
- Unique index `users_username_key` → Postgres `23505` → `USERNAME_TAKEN`. **This catch, not
  the availability check, is what actually protects against the race** (§1.4). Two students
  can both be told "available" and both submit; the index rejects the second.
- `CHECK users_username_valid` → `INVALID_FORMAT`.
- `trg_record_username_change` → writes the old handle to `username_history` (locked for 30
  days) and sets `username_changed_at`. You do not write either by hand.
**Notes:** **the 30-day rate limit is the one rule in this module the database does not
enforce** — §1.5 puts it in the controller, comparing `users.username_changed_at`. Both
clients must handle 429 even though their UI disables the field (§2.4).

Changing a handle frees the old one after 30 days and redirects it in the meantime. Warn the
user before saving (§2.4).

---

## social module

**Owner: Neeraj · Phase 3 · Depends on migrations 004, 005 · Files:
`backend/src/modules/social/{social.routes.js,social.controller.js}` · Mounted at `/api/users`,
after `userRoutes` (Express falls through when no path in `user.routes.js` matches)**

Eleven endpoints. **Almost every rule here is a database trigger, not your code.** Your
`POST /follow` controller is essentially "insert a row into `follows`" — `trg_prepare_follow`
decides whether that becomes `pending` or `accepted` and refuses outright if either party has
blocked the other. You cannot get the privacy rules wrong because they are not your decision.

What your code *is* responsible for: reading the trigger's outcome back, calling
`can_view_social_content()` before returning any list, cursor pagination, calling `notify()`,
and mapping trigger exceptions through `mapDbError()`.

> **Follows are global by design.** The `follows` table has no `university_id`. A student at
> IIITDM can follow a student at NIET. This is the only intentional gap in campus isolation —
> do not "fix" it.

### POST /api/users/:id/follow   `OWNER: Neeraj`  `PHASE 3`
**Module:** social
**Auth:** required (Bearer token) — the caller is always the follower
**Content-Type:** n/a — no body
**Path:**
  - id: uuid, required — the user to follow
**200 (public target):** `{ "status": "accepted" }`
**200 (private target):** `{ "status": "pending" }`
**403:** `{ "error": "BLOCKED" }`
**400:** `{ "error": "CANNOT_FOLLOW_SELF" }`
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:**
- `trg_prepare_follow` (BEFORE INSERT on `follows`) — sets `status` to `pending` when the
  target is private and `accepted` otherwise, and raises `BLOCKED` if a block exists in
  **either** direction. **Never send `status` from the client and never decide it in JS.**
- `CHECK no_self_follow` → `CANNOT_FOLLOW_SELF`.
- `trg_follow_counts` — maintains `followers_count`/`following_count`. Only `accepted` rows
  count, so a pending request moves no counter.
**Notes:** read `status` back from the inserted row rather than inferring it from the target's
`is_private` — that is the whole point of putting the decision in the trigger.

Emit `notify()` after: type `follow` for an accepted follow, `follow_request` for a pending
one. Wrap it so a notification failure never fails the follow.

Clients update optimistically and roll back on error (§4.1).

### DELETE /api/users/:id/follow   `OWNER: Neeraj`  `PHASE 3`
**Module:** social
**Auth:** required (Bearer token)
**Content-Type:** n/a — no body
**Path:**
  - id: uuid, required — the user to unfollow, **or** the private account whose pending
    request you are cancelling. One endpoint covers both (§4.1).
**200:** **TODO — ambiguous in plan: no response body specified.**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `trg_follow_counts` (AFTER DELETE) — decrements both counters, but **only if
the deleted row was `accepted`**. Cancelling a pending request correctly moves nothing.
**Notes:** deleting a follow that does not exist is a no-op in Postgres. Decide whether that
is a 200 or a 404 and write it here — Part 1's `DELETE /api/products/:id` has exactly this
bug and returns a misleading 200.
**TODO — ambiguous in plan:** no shape is given. `{ "status": null }` would mirror the POST
and let clients set the button state from one field; `204` is the other obvious choice.

### GET /api/users/:id/followers   `OWNER: Neeraj`  `PHASE 3`
**Module:** social
**Auth:** optional — `can_view_social_content()` explicitly handles a `NULL` viewer
**Content-Type:** n/a (no body)
**Path:**
  - id: uuid, required
**Query:**
  - cursor: timestamptz, optional — echo `next_cursor` from the previous response
  - limit: int, optional, default 20, **cap at 50**
**Cursor type:** **`created_at` timestamp** of the `follows` row (ISO 8601), descending.
**200:**
```json
{
  "users": [ { "id": "uuid", "username": "rahul", "full_name": "Rahul Sharma",
               "avatar_url": "https://...", "university_name": "IIITDM Kurnool",
               "is_following": false } ],
  "next_cursor": "2026-07-28T14:22:11Z"
}
```
`next_cursor` is `null` when there are no more rows.
**403:** `{ "error": "PRIVATE_ACCOUNT" }` — the viewer may not see this list
**Enforced by:** `can_view_social_content(p_viewer, p_target)` — call it **before** returning
anything. It returns false for a private account the viewer does not follow, and for either
direction of a block. `trg_apply_block` guarantees blocked pairs have no `follows` rows at all.
**Notes:** the index `follows_following_idx (following_id, status, created_at DESC)` serves
this query directly, which is what makes item 100,000 as fast as item 1.

`is_following` is *your* relationship to each listed user, not the profile owner's — it drives
the Follow button on every row (§4.2).

Filtered to `status = 'accepted'`; pending requesters appear only in `/me/follow-requests`.
**TODO — ambiguous in plan:** the envelope key is `users`, but `sendPage()` emits `items`. See
the warning in [Conventions](#conventions). This endpoint is the one the plan spells out in
full, so it is the strongest evidence either way.

### GET /api/users/:id/following   `OWNER: Neeraj`  `PHASE 3`
**Module:** social
**Auth:** optional
**Content-Type:** n/a (no body)
**Path:**
  - id: uuid, required
**Query:**
  - cursor: timestamptz, optional
  - limit: int, optional, default 20, **cap at 50**
**Cursor type:** **`created_at` timestamp** of the `follows` row, descending.
**200:** identical shape to `/followers` — `{ "users": [...], "next_cursor": "..." | null }`
**403:** `{ "error": "PRIVATE_ACCOUNT" }`
**Enforced by:** `can_view_social_content(p_viewer, p_target)`, exactly as `/followers`.
**Notes:** served by `follows_follower_idx (follower_id, status, created_at DESC)`. Same
`users` vs `items` question as above.

### GET /api/users/me/follow-requests   `OWNER: Neeraj`  `PHASE 3`
**Module:** social
**Auth:** required (Bearer token)
**Content-Type:** n/a (no body)
**200:** the pending requesters on the caller's own account — **TODO, see below**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** RLS policy `follows_update` restricts accepting to `following_id = auth.uid()`
— but note the backend uses the service-role key and bypasses RLS, so the controller must
scope this to `req.user.id` itself. This is a place where a missed check leaks another user's
pending requests.
**Notes:** rows are `follows` with `status = 'pending'` and `following_id = req.user.id`. Only
meaningful for a private account; a public account never accumulates any, because
`trg_prepare_follow` marks its follows `accepted` immediately.

§4.2 needs a **count** for the badge on the entry point.
**TODO — ambiguous in plan:** no response shape, and **no `cursor`/`limit` in the §3.2 table**
— yet §3.2 also says every list is cursor-paginated. Is this deliberately unpaginated (the
list is small by nature), and is the shape `{ "users": [...] }` like `/followers` or something
that also carries `created_at` so the UI can show "requested 3 days ago"?

### POST /api/users/me/follow-requests/:followerId/accept   `OWNER: Neeraj`  `PHASE 3`
**Module:** social
**Auth:** required (Bearer token)
**Content-Type:** n/a — no body
**Path:**
  - followerId: uuid, required — the user whose request is being approved
**200:** **TODO — ambiguous in plan: no response body specified.**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `trg_follow_counts` — the `pending → accepted` UPDATE is a branch of this
trigger, so both counters increment here rather than at follow time. Do not touch the counters.
**Notes:** the update is `status = 'accepted', accepted_at = now()` on the row
`(follower_id = :followerId, following_id = req.user.id)`. Scope it to `req.user.id` or one
user can approve requests on another user's account.

Emit `notify()` with type `follow_accepted` to the requester.

### DELETE /api/users/me/follow-requests/:followerId   `OWNER: Neeraj`  `PHASE 3`
**Module:** social
**Auth:** required (Bearer token)
**Content-Type:** n/a — no body
**Path:**
  - followerId: uuid, required
**200:** **TODO — ambiguous in plan: no response body specified.**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `trg_follow_counts` — deleting a `pending` row moves no counter, which is
correct and automatic.
**Notes:** rejection deletes the row outright, so the requester can ask again. No notification
is specified for a rejection, and §5.2's table has no `follow_rejected` type — that silence
looks deliberate (telling someone they were rejected is hostile), so **do not** emit one.

### POST /api/users/:id/block   `OWNER: Neeraj`  `PHASE 3`
**Module:** social
**Auth:** required (Bearer token)
**Content-Type:** n/a — no body
**Path:**
  - id: uuid, required — the user to block
**200:** **TODO — ambiguous in plan: no response body specified.**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:**
- `trg_apply_block` (AFTER INSERT on `blocks`) — **deletes the follow rows in both
  directions.** You insert one row; the follow graph repairs itself.
- `trg_follow_counts` then fires on those deletes and decrements both users' counters.
- `CHECK no_self_block`.
**Notes:** blocking has wide side effects that are all automatic: `trg_prepare_follow` will
refuse future follows with `BLOCKED`, `can_view_social_content()` returns false in both
directions, and `is_blocked_pair()` removes the pair from every feed query.

RLS policy `blocks_select` lets **only the blocker** read the row, so a blocked user cannot
discover they were blocked by querying the table. Preserve that in your responses too — never
expose block state to the blocked party. §4.2: "They won't be told."

### DELETE /api/users/:id/block   `OWNER: Neeraj`  `PHASE 3`
**Module:** social
**Auth:** required (Bearer token)
**Content-Type:** n/a — no body
**Path:**
  - id: uuid, required
**200:** **TODO — ambiguous in plan: no response body specified.**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** nothing — there is no un-block trigger, deliberately. **Unblocking does not
restore the follows that `trg_apply_block` deleted.** Both users must follow again. Say so in
the UI.

### GET /api/users/me/blocks   `OWNER: Neeraj`  `PHASE 3`
**Module:** social
**Auth:** required (Bearer token)
**Content-Type:** n/a (no body)
**200:** the caller's blocked users — **TODO, see below**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** RLS `blocks_select` (`blocker_id = auth.uid()`) on the direct-Supabase path.
The service-role backend bypasses it, so scope to `req.user.id` in the controller.
**Notes:** §4.2 wants a simple list with Unblock buttons, reachable from settings.
**TODO — ambiguous in plan:** no shape, and no `cursor`/`limit` in the §3.2 table despite the
"every list" rule. Same question as `/me/follow-requests`.

### PATCH /api/users/me/privacy   `OWNER: Neeraj`  `PHASE 3`
**Module:** social
**Auth:** required (Bearer token)
**Content-Type:** application/json
**Body:** **TODO — ambiguous in plan: not specified.** The table says "Toggle private". Is it
`{ "is_private": true }` (idempotent set — safe to retry, which a toggle is not), or an empty
body that flips the current value?
**200:** **TODO — ambiguous in plan: no response body specified.**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `trg_privacy_change` (AFTER UPDATE OF `is_private` on `users`) — going
**private → public auto-accepts every pending request** in one statement, and
`trg_follow_counts` then increments the counters for each. Going public→private **keeps**
existing followers (Instagram behaviour). Do not implement either in JS.
**Notes:** because going public can accept an unbounded number of requests at once, the
follower count in the response may be very different from the one the client had. Return the
updated user, or have the client refetch.

A private account still exposes: username, full name, avatar, university, follower and
following **counts**, and **their marketplace listings**. It hides: posts, follower/following
**lists**, bio, and course/year. Keeping listings public is deliberate — a private seller's
items must stay findable and buyable (§3.2, §4.2).

---

## notifications module

**Owner: Neeraj · Phase 5 · Depends on migration 006 · Files:
`backend/src/modules/notifications/{notifications.routes.js,notifications.controller.js}` ·
Mounted at `/api/notifications`**

**Read side only.** Notifications are *written* by `backend/src/utils/notify.js` (Vishwajeet,
already built) called from the social and posts modules, and by `trg_report_threshold` for
moderation. This module never inserts.

> **This module is the load valve** (§0.5.5). It is the most self-contained thing in the
> project — three read endpoints, no client writes — so it is the first thing to move to
> Vishwajeet if Neeraj is behind at the Phase 3 checkpoint.

### GET /api/notifications   `OWNER: Neeraj`  `PHASE 5`
**Module:** notifications
**Auth:** required (Bearer token)
**Content-Type:** n/a (no body)
**Query:**
  - cursor: timestamptz, optional — echo `next_cursor` from the previous response
  - limit: int, optional, **default 30** (not 20), cap at 50
**Cursor type:** **`created_at` timestamp**, descending — matches
`notifications_user_idx (user_id, created_at DESC)`.
**200:**
```json
{
  "notifications": [ {
    "id": "uuid", "type": "post_reply", "read_at": null,
    "created_at": "...",
    "actor": { "id": "uuid", "username": "rahul", "full_name": "Rahul Sharma",
               "avatar_url": "https://..." },
    "entity": { "type": "post", "id": "uuid", "preview": "first 60 chars of the post..." }
  } ],
  "next_cursor": "..."
}
```
`type` ∈ `follow` | `follow_request` | `follow_accepted` | `post_reply` | `post_like` |
`post_mention` | `product_comment` | `product_like` | `moderation_action` | `system`
`entity.type` ∈ `post` | `product` | `comment` | `user`
`read_at` is `null` for unread.
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** RLS `notifications_select` (`user_id = auth.uid()`) on the direct-Supabase
path. The service-role backend bypasses RLS, so **scope to `req.user.id` in the controller** —
this endpoint returns another user's entire activity feed if you forget.
**Notes:** **the backend must hydrate `entity`.** Fetch all referenced entities in **one query
per type** and attach them. Looping and fetching per notification is the N+1 problem — 30
notifications become 31 round trips (§5.3).

`actor` is `null` for `moderation_action`, which `notify()` inserts with `actor_id = NULL`.
Clients must handle a missing actor: "Your post was hidden after multiple reports" has no
avatar.
**TODO — ambiguous in plan:** the envelope key is `notifications`, not `items`. Same conflict
as the social lists.
**TODO — ambiguous in plan:** what is `entity.preview` for a `follow` notification, whose
entity is a *user*? The 60-character post excerpt has no analogue. Omitted, `null`, or the
handle?

### GET /api/notifications/unread-count   `OWNER: Neeraj`  `PHASE 5`
**Module:** notifications
**Auth:** required (Bearer token)
**Content-Type:** n/a (no body)
**200:** `{ "count": 7 }`
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** the **partial** index
`notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL` — it stores only
unread rows, so a user with 50,000 read and 3 unread has a 3-entry index for this query.
**Notes:** clients poll this every 60s, or subscribe via Realtime (§5.4). Polling is fine to
start. Because it is polled by every signed-in client, it must stay a single indexed count —
never join to `users` or hydrate anything here.

### POST /api/notifications/mark-read   `OWNER: Neeraj`  `PHASE 5`
**Module:** notifications
**Auth:** required (Bearer token)
**Content-Type:** application/json
**Body:** one of
  - ids: uuid[] — mark exactly these read
  - all: boolean — `{ "all": true }` marks every unread notification read
**200:** **TODO — ambiguous in plan: no response body specified.** Returning the new unread
count would save the client an immediate follow-up call to `/unread-count`.
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** RLS `notifications_update` (`user_id = auth.uid()`), bypassed by the
service-role client — **scope the UPDATE to `req.user.id`** or one user can mark another's
notifications read.
**Notes:** setting `read_at` drops the row out of `notifications_dedupe_idx` (which is
`UNIQUE ... WHERE read_at IS NULL`), which is what allows a *fresh* notification from the same
actor and type to be created later. Marking read is therefore not cosmetic — it re-arms
deduplication.

Tapping a single notification marks just that one read (§5.4), so `ids` is the common path.
**TODO — ambiguous in plan:** what if both `ids` and `all` are sent, or neither? Reject with
`400`, or let `all` win?

---

## reports module

**Owner: Neeraj · Phase 6 · Depends on migration 008 · Files:
`backend/src/modules/reports/{reports.routes.js,reports.controller.js}` · Mounted at
`/api/reports`**

One endpoint. It pairs with Neeraj's report modal in §7.7. The review side is a different
module, a different owner and a different phase — see [admin module](#admin-module).

### POST /api/reports   `OWNER: Neeraj`  `PHASE 6`
**Module:** reports
**Auth:** required (Bearer token) — `reporter_id` is `req.user.id`, never a body field
**Content-Type:** application/json
**Body:**
  - target_type: string, required — `post` | `user` | `product` | `comment` | `message`
  - target_id: uuid, required
  - reason: string, required — `spam` | `harassment` | `hate_speech` | `sexual_content` |
    `violence` | `impersonation` | `misinformation` | `self_harm` | `prohibited_item` | `other`
  - details: string, optional, **max 500**
**200:** **TODO — ambiguous in plan: no success shape specified.**
**400:** `{ "error": "DUPLICATE" }` — via `mapDbError` from the `UNIQUE (reporter_id,
target_type, target_id)` constraint. §7.7 step 7: show "You've already reported this post."
**400:** `{ "error": "INVALID_REFERENCE" }` — `target_id` does not exist
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `trg_report_threshold` (AFTER INSERT on `reports`) — recounts unique reports
for the target, writes `posts.report_count`, and **at 3 reports flips
`moderation_status` to `'hidden'` and inserts a `moderation_action` notification for the
author.** All of that is automatic. Do not count reports in JavaScript and do not hide the
post yourself.
**Notes:** **the response must not reveal the outcome.** §7.7 step 5: never tell the reporter
how many reports a post has or whether it got hidden — that lets people coordinate abuse of
the report system. The confirmation is always the same flat "Thanks. Our team will review
this."

`reason` and `target_type` must match the DB enums character for character; §7.7's radio list
is these ten values in order. A mismatch surfaces as a `CHECK` violation, not a clean 400.

The threshold trigger only acts on `target_type = 'post'`. Reports against a user, product,
comment or message are recorded for human review and auto-hide nothing.

The client hides the reported post from the reporter's own feed immediately, locally — there
is no endpoint for that.
**TODO — ambiguous in plan:** is `201` (a row was created, matching `POST /api/products`) or
`200` correct? And does the body echo the created report, or just acknowledge?

---

## posts module

**Owner: Vishwajeet · Phase 6 · Depends on migrations 007, 008, 009 · Files:
`backend/src/modules/posts/{posts.routes.js,posts.controller.js}` · Mounted at `/api/posts`**

Eleven endpoints. One `posts` table holds everything: top-level posts and replies, campus and
global. A **reply** is a post with `parent_post_id` set, one level only, no images. **`scope`**
(`campus` | `global`) is chosen by the author at compose time.

> # ⚠️ THE THREE FEEDS USE THREE DIFFERENT CURSOR TYPES
>
> This is the single easiest thing to get wrong in the entire API, and when it is wrong the
> feed **silently skips or repeats posts** — no error, no crash, just missing content that
> nobody notices for weeks.
>
> | Endpoint | Cursor is | SQL type | Comparison |
> |---|---|---|---|
> | `/feed/campus` | `created_at` **timestamp** | `TIMESTAMPTZ` | `created_at < cursor` |
> | `/feed/following` | `created_at` **timestamp** | `TIMESTAMPTZ` | `created_at < cursor` |
> | `/feed/global?sort=hot` | `hot_score` **float** | `DOUBLE PRECISION` | `hot_score < cursor` |
> | `/feed/global?sort=new` | **epoch seconds** | `DOUBLE PRECISION` | `EXTRACT(EPOCH FROM created_at) < cursor` |
>
> Note that `get_global_feed()` takes **one** `p_cursor DOUBLE PRECISION` parameter that means
> two different things depending on `p_sort`. Passing an ISO timestamp to it, or a `hot_score`
> to the `new` sort, produces a valid query that returns wrong rows.
>
> **Clients: always echo `next_cursor` back verbatim. Never construct, parse, or convert it.**
> **Server: switching `sort` mid-scroll invalidates the cursor — restart pagination.**

### GET /api/posts/feed/campus   `OWNER: Vishwajeet`  `PHASE 6`
**Module:** posts
**Auth:** required (Bearer token) — the feed is defined by *your* campus
**Content-Type:** n/a (no body)
**Query:**
  - cursor: timestamptz, optional
  - limit: int, optional, default 20, **cap at 50**
**Cursor type:** ⚠️ **`created_at` timestamp** (ISO 8601), descending.
**200:**
```json
{
  "items": [ {
    "id": "uuid", "content": "string", "image_urls": ["https://..."], "scope": "campus",
    "created_at": "...", "likes_count": 0, "replies_count": 0,
    "author_id": "uuid", "author_username": "rahul", "author_name": "Rahul Sharma",
    "author_avatar": "https://...", "author_university": "IIITDM Kurnool",
    "viewer_has_liked": false
  } ],
  "next_cursor": "2026-08-01T10:00:00Z"
}
```
The item fields are exactly the `RETURNS TABLE` columns of `get_campus_feed()` — **flat, not
nested.** There is no `author` object; the author is five sibling `author_*` keys.
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `get_campus_feed(p_viewer, p_limit, p_cursor)`. Inside the RPC:
`is_blocked_pair()` removes blocked users both ways, `moderation_status = 'active'` hides
reported posts, and `parent_post_id IS NULL` excludes replies. Index `posts_home_feed_idx`.
**Notes:** shows **both** scopes from your own campus — a campus post and a global post from
your college both appear. Chronological, newest first. Never ranked.

`viewer_has_liked` is computed in the same query. **Do not make a second request to check like
state** — that is the N+1 fix and it is why hearts do not flicker in after render.

### GET /api/posts/feed/global   `OWNER: Vishwajeet`  `PHASE 6`
**Module:** posts
**Auth:** required (Bearer token)
**Content-Type:** n/a (no body)
**Query:**
  - sort: string, optional — `hot` (**default**, and what clients should show) | `new`
  - cursor: float, optional — **meaning depends on `sort`, see below**
  - limit: int, optional, default 20, **cap at 50**
**Cursor type:** ⚠️ **`sort=hot` → `hot_score`, a float. `sort=new` → epoch seconds, a float.**
Never a timestamp, for either. Changing `sort` invalidates the cursor.
**200:** same envelope as `/feed/campus`, and each item additionally carries
`"hot_score": 2.12`. Note `get_global_feed()` does **not** return `scope` (every row is
`global` by definition) — so the item shape differs from the other two feeds by one field in
each direction.
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `get_global_feed(p_viewer, p_sort, p_limit, p_cursor)`; indexes
`posts_global_hot_idx` and `posts_global_new_idx`. `is_blocked_pair()` and
`moderation_status = 'active'` applied inside.
**Notes:** ranked by `score = (likes + replies × 2 + 1) ÷ (hours_since_posted + 2)^1.5`.
`hot_score` is a **stored column**, refreshed every 5 minutes by the
`refresh_global_hot_scores()` cron job — not computed per request. The formula depends on
`now()`, so it changes every second and Postgres cannot index it; storing it makes the feed a
straight index scan. A score up to 5 minutes stale is invisible to a human.

Only posts newer than 7 days get refreshed, so older posts keep a frozen score and sink.

### GET /api/posts/feed/following   `OWNER: Vishwajeet`  `PHASE 6`
**Module:** posts
**Auth:** required (Bearer token)
**Content-Type:** n/a (no body)
**Query:**
  - cursor: timestamptz, optional
  - limit: int, optional, default 20, **cap at 50**
**Cursor type:** ⚠️ **`created_at` timestamp** (ISO 8601), descending — same as campus, *not*
the global float.
**200:** same envelope and item shape as `/feed/campus` (includes `scope`).
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `get_following_feed(p_viewer, p_limit, p_cursor)` — inner-joins `follows` on
`status = 'accepted'`, so pending requests contribute nothing.
**Notes:** you see a followed user's **global** posts always, but their **campus** posts only
if you share their campus. Following someone at another college does not leak their campus
feed to you.

Unlike the other two, this RPC has no `is_blocked_pair()` call — it does not need one, because
`trg_apply_block` already deleted the follow rows in both directions.

### GET /api/posts/:id   `OWNER: Vishwajeet`  `PHASE 6`
**Module:** posts
**Auth:** required (Bearer token)
**Content-Type:** n/a (no body)
**Path:**
  - id: uuid, required
**200:** **TODO — ambiguous in plan: no shape specified.** §7.6 renders the parent post larger
at the top of `/post/:id`, so it needs at least the feed item's fields. Is it a bare feed item,
`{ "post": {...} }`, or a feed item plus the first page of replies?
**403 / 404:** §8.6's test says "`GET /api/posts/:id` for another campus's post → confirm
403/404". **TODO — ambiguous in plan: which, and with what error code?** `NOT_FOUND` leaks
less than `FORBIDDEN` (it does not confirm the post exists), which argues for 404.
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** none of the three feed RPCs covers this path, so the controller must apply
the same three gates itself: `moderation_status = 'active'`, `is_blocked_pair()`, and
scope/campus. RLS policy `posts_select` encodes exactly those rules and is the reference — but
the service-role client bypasses it, so it will not save you.
**Notes:** a hidden post must disappear from the author's own profile too (§8.6), so do not
special-case the author here.

### GET /api/posts/:id/replies   `OWNER: Vishwajeet`  `PHASE 6`
**Module:** posts
**Auth:** required (Bearer token)
**Content-Type:** n/a (no body)
**Path:**
  - id: uuid, required — the parent post
**Query:**
  - cursor: timestamptz, optional
  - limit: int, optional, default 20, **cap at 50**
**Cursor type:** ⚠️ **`created_at` timestamp, ASCENDING** — the opposite direction to every
other list in this API. §7.6: replies are shown oldest first because a thread is a
conversation, and the index is `posts_replies_idx (parent_post_id, created_at ASC)`. The
comparison is therefore `created_at > cursor`, not `<`. Getting the sign wrong returns an
empty page on the second request.
**200:** **TODO — ambiguous in plan: no shape specified.** Replies are posts, so presumably
the feed item shape minus `image_urls` (replies are text-only) — but the envelope key
(`items` vs `replies`) is unstated.
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `CHECK posts_replies_no_images` guarantees `image_urls` is always empty here.
**Notes:** flat, single level — `trg_single_level_replies` makes a reply-to-a-reply impossible,
so the client never has to nest. §7.6 uses an explicit "Load more replies" button rather than
infinite scroll.

### POST /api/posts   `OWNER: Vishwajeet`  `PHASE 6`
**Module:** posts
**Auth:** required (Bearer token) — `author_id` is `req.user.id`, never a body field
**Content-Type:** multipart/form-data
**Body:**
  - content: string, required, **max 250 characters after trim**
  - scope: string, optional, default `campus` — `campus` | `global`. **Ignored for replies**,
    which inherit the parent's scope.
  - parent_post_id: uuid, optional — present makes this a reply
  - images: File[], optional, **max 3**, each **≤5MB**, MIME type in the allowlist.
    **Rejected outright when `parent_post_id` is set** — replies are text only.
**200:** **TODO — ambiguous in plan: only the error shapes are specified.** Presumably the
created post in feed-item shape so the client can replace its optimistic insert. `201` would
match `POST /api/products`.
**400:** `{ "error": "CONTENT_TOO_LONG", "max": 250 }`
**400:** `{ "error": "CONTENT_BLOCKED", "message": "Your post contains language not allowed on Yahora." }`
**400:** `{ "error": "TOO_MANY_IMAGES", "max": 3 }`
**400:** `{ "error": "NESTED_REPLY_NOT_ALLOWED" }` — replying to a reply
**403:** `{ "error": "ACCOUNT_SUSPENDED" }`
**403:** `{ "error": "POSTING_RESTRICTED", "until": "2026-08-09T10:00:00Z" }`
**429:** `{ "error": "RATE_LIMIT_POSTS", "message": "You can post 10 times per hour." }`
**429:** `{ "error": "RATE_LIMIT_REPLIES" }` — 30 replies per hour
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:**
- `trg_post_rate_limit` (BEFORE INSERT) — raises `ACCOUNT_SUSPENDED`, `POSTING_RESTRICTED`,
  `RATE_LIMIT_POSTS` (≥10 top-level/hour) and `RATE_LIMIT_REPLIES` (≥30 replies/hour). **Do
  not count posts in JavaScript.** Catch these four and map them.
- `trg_single_level_replies` (BEFORE INSERT) → `NESTED_REPLY_NOT_ALLOWED`.
- `CHECK posts_max_3_images` and `CHECK posts_replies_no_images`.
- `trg_post_replies_count` maintains the parent's `replies_count`.
- `contains_banned_term(content, 'block')` → `CONTENT_BLOCKED`. Word-boundary matched, so
  "assignment" does not trip a rule about a substring.
**Notes:** **validation order matters** (§6.6): auth → length → scope → reply rules → images →
banned terms → **upload images** → insert → map trigger errors → `notify()`. Check banned
terms **before** uploading, or a blocked post still costs you 3 storage objects. Part 1's
`POST /api/products` has exactly that bug.

Emit `notify()` with type `post_reply` to the parent's author when this is a reply. The
`entity_id` is the **parent** post id, not the reply's.

`CONTENT_BLOCKED` and `RATE_LIMIT_POSTS` happen in normal use and need real UI, not a toast
(§7.4). Never clear the composer on `CONTENT_BLOCKED` — the student has to edit the text.

Images go to the `posts` storage bucket (authenticated insert only), separate from `products`.

### DELETE /api/posts/:id   `OWNER: Vishwajeet`  `PHASE 6`
**Module:** posts
**Auth:** required (Bearer token)
**Content-Type:** n/a — no body
**Path:**
  - id: uuid, required
**200:** **TODO — ambiguous in plan: no response body specified.**
**403:** `{ "error": "FORBIDDEN" }` — not your post (§1.6's pattern)
**404:** `{ "error": "NOT_FOUND" }`
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `trg_post_replies_count` decrements the parent's counter when a reply is
deleted. `ON DELETE CASCADE` on `posts.parent_post_id` removes a parent's replies with it, and
`post_likes` cascades too.
**Notes:** RLS `posts_delete_own` is `author_id = auth.uid()`, but the service-role backend
bypasses RLS — **check ownership in the controller.**

This is the author deleting their own post, and it is the only hard delete in the community
feature. **Moderation never deletes** — a removed post keeps its row with
`moderation_status = 'removed'` so you still have it if a college administration asks.

### POST /api/posts/:id/like   `OWNER: Vishwajeet`  `PHASE 6`
**Module:** posts
**Auth:** required (Bearer token)
**Content-Type:** n/a — no body
**Path:**
  - id: uuid, required
**200:** **TODO — ambiguous in plan: no response body specified.** Returning the new
`likes_count` would let the client reconcile its optimistic update.
**400:** `{ "error": "DUPLICATE" }` — already liked; `post_likes` PK is `(user_id, post_id)`
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `trg_post_likes_count` (AFTER INSERT on `post_likes`) maintains
`posts.likes_count`. Do not increment it yourself.
**Notes:** this is a **separate POST and DELETE pair**, not a toggle — unlike Part 1's
`POST /api/products/:id/like`, which flips state and is not idempotent. Liking twice here is a
duplicate-key error, which is the correct, retry-safe behaviour.

Emit `notify()` with type `post_like` to the post's author.

Clients update optimistically (§7.4), reusing the Phase 4 follow-button pattern.

### DELETE /api/posts/:id/like   `OWNER: Vishwajeet`  `PHASE 6`
**Module:** posts
**Auth:** required (Bearer token)
**Content-Type:** n/a — no body
**Path:**
  - id: uuid, required
**200:** **TODO — ambiguous in plan: no response body specified.**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `trg_post_likes_count` (AFTER DELETE) decrements, floored at 0 by
`GREATEST(likes_count - 1, 0)`.
**Notes:** unliking something you never liked deletes zero rows. Decide whether that is 200 or
404 and record it here.

No notification is emitted or withdrawn on unlike; the original `post_like` notification stays.

### GET /api/users/:username/posts   `OWNER: Vishwajeet`  `PHASE 6`
**Module:** posts
**Auth:** required (Bearer token)
**Content-Type:** n/a (no body)
**Path:**
  - username: string, required — the **handle**, not a uuid. The only endpoint in the posts
    module keyed by username rather than id.
**Query:**
  - cursor: timestamptz, optional
  - limit: int, optional, default 20, **cap at 50**
**Cursor type:** **`created_at` timestamp**, descending — index
`posts_author_idx (author_id, created_at DESC) WHERE parent_post_id IS NULL`.
**200:** **TODO — ambiguous in plan: no shape specified.** §7.8 reuses the same post card, so
presumably the feed item shape.
**403:** `{ "error": "PRIVATE_ACCOUNT" }` — §7.8: "This account is private. Follow to see
their posts", while the Listings tab **stays visible and functional**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `can_view_social_content(p_viewer, p_target)` — call it before returning
anything. Top-level posts only (`parent_post_id IS NULL`); a user's replies do not appear on
their profile.
**Notes:** hidden and removed posts must not appear here either, including for the author
(§8.6).
**TODO — this endpoint has no route to live on.** It is a **posts-module** endpoint (owner
Vishwajeet) at a **`/api/users`** path. The frozen `app.js` mounts `/api/users` to
`userRoutes` and `socialRoutes` only — both Neeraj's files — and mounts `postsRoutes` at
`/api/posts`. So it must either (a) go in one of Neeraj's files, breaking the ownership split
this scaffold exists to protect, (b) get a third `/api/users` mount added to a file that is
supposed to be frozen after Phase 0, or (c) move to `/api/posts/by-user/:username`.
**Decide at the contract review — this is a scaffolding decision, not an implementation
detail.**

### GET /api/posts/feed/campus/count-since   `OWNER: Vishwajeet`  `PHASE 6`
**Module:** posts
**Auth:** required (Bearer token)
**Content-Type:** n/a (no body)
**Query:**
  - ts: timestamptz, required — the newest `created_at` the client has already seen
**200:** **TODO — ambiguous in plan: no shape specified.** `{ "count": 3 }` would match
`/api/notifications/unread-count`, the closest sibling.
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** same visibility rules as `/feed/campus` — the count must exclude blocked
users and hidden posts, or the pill promises posts the feed will not show.
**Notes:** **campus feed only.** §7.5: the global feed at hundreds of colleges would show this
pill constantly, which is noise.

Polled every 30 seconds. Keep it a count — do not return the posts. The client must **not**
auto-insert them: shifting a feed under someone who is reading is the single most irritating
thing a feed can do. Tapping the pill scrolls to top and loads.

---

## admin module

**Owner: Vishwajeet · Phase 8 · Depends on migration 010 · Files:
`backend/src/modules/admin/{admin.routes.js,admin.controller.js}` · Mounted at `/api/admin`**

Five endpoints behind an admin allowlist. **Every route in this module needs `requireAuth`
plus an `is_admin` check** — this is the one module where a missing guard exposes other
people's reports and hands out suspension powers.

> §8.1: "If you're short on time, this can literally be the Supabase table editor for week
> one." The endpoints should still exist so the screen can be built quickly when volume grows.

**TODO — ambiguous in plan: the admin gate has no specified error code.** A signed-in
non-admin should presumably get `403 FORBIDDEN`, but §8.1 only describes "a protected route
behind a check". Confirm the code, and confirm whether a non-admin gets 403 (admits the
endpoint exists) or 404 (does not).

**TODO — ambiguous in plan: `is_admin` is set by SQL only.** §8.1 grants it with a manual
`UPDATE users SET is_admin = true WHERE username IN (...)`. There is no endpoint to grant or
revoke it, which is a deliberate-looking omission — confirm it is deliberate.

### GET /api/admin/reports   `OWNER: Vishwajeet`  `PHASE 8`
**Module:** admin
**Auth:** required (Bearer token) **+ `users.is_admin = true`**
**Content-Type:** n/a (no body)
**Query:**
  - status: string, optional, default `open` — `open` | `reviewed` | `actioned` | `dismissed`
  - cursor: timestamptz, optional
  - limit: int, optional, default 20, **cap at 50**
**Cursor type:** **`created_at` timestamp**, descending — index
`reports_open_idx (created_at DESC) WHERE status = 'open'`.
**200:** **TODO — ambiguous in plan: no shape specified.** §8.1 says the screen shows, per
report: the reported content, the reason, the reporter, the author, and **the author's prior
report count**. That last field exists nowhere in the schema as a column — it is a
`COUNT(*) FROM reports` joined by author. Confirm the exact key names and that this is
hydrated server-side in one query per type rather than N+1.
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** nothing — RLS `reports_select_own` restricts the direct-Supabase path to a
reporter's own rows, and the service-role backend bypasses it. **The `is_admin` check in this
controller is the only thing protecting the queue.**
**Notes:** the reported content must be hydrated per `target_type` (`post`, `user`, `product`,
`comment`, `message`) — five different joins. This is the N+1 trap again.

### POST /api/admin/reports/:id/action   `OWNER: Vishwajeet`  `PHASE 8`
**Module:** admin
**Auth:** required (Bearer token) **+ `users.is_admin = true`**
**Content-Type:** application/json
**Path:**
  - id: uuid, required — the report
**Body:**
  - action: string, required — `remove` | `restore` | `dismiss`
  - note: string, optional — stored in `reports.review_note`
**200:** **TODO — ambiguous in plan: no response body specified.**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** nothing automatic — this endpoint writes `reports.status`, `reviewed_by`,
`reviewed_at`, `review_note` and the target's `moderation_status` itself. `trg_report_threshold`
fires on report *inserts* only, so it will not undo a `restore`.
**Notes:** the three actions map to `posts.moderation_status`: `remove` → `'removed'`,
`restore` → `'active'`, `dismiss` → leaves the post alone and only closes the report. **Never
hard-delete** — a removed post keeps its row.

**A `restore` is fragile.** `trg_report_threshold` re-hides a post at 3 reports *on the next
insert*, and `report_count` is already ≥3, so one more report immediately re-hides it. Whether
restore should also reset `report_count` or mark the existing reports `dismissed` is not
specified — **TODO — ambiguous in plan.**

`reviewed_by` should be `req.user.id`.

### POST /api/admin/users/:id/restrict   `OWNER: Vishwajeet`  `PHASE 8`
**Module:** admin
**Auth:** required (Bearer token) **+ `users.is_admin = true`**
**Content-Type:** application/json
**Path:**
  - id: uuid, required — the user being restricted
**Body:**
  - hours: int, required — e.g. `24`; sets `users.posting_restricted_until = now() + hours`
  - reason: string, optional
**200:** **TODO — ambiguous in plan: no response body specified.**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `trg_post_rate_limit` reads `users.posting_restricted_until` on every insert
into `posts` and raises `POSTING_RESTRICTED`. This endpoint only sets the timestamp; the
enforcement is already written.
**Notes:** a temporary posting pause, not a suspension — the user can still browse, buy, sell
and message. It blocks `posts` inserts only.

`reason` has no column on `users` (`suspension_reason` is for suspensions). **TODO —
ambiguous in plan:** where is a restriction's `reason` stored?

### POST /api/admin/users/:id/suspend   `OWNER: Vishwajeet`  `PHASE 8`
**Module:** admin
**Auth:** required (Bearer token) **+ `users.is_admin = true`**
**Content-Type:** application/json
**Path:**
  - id: uuid, required
**Body:**
  - reason: string, required — stored in `users.suspension_reason`
**200:** **TODO — ambiguous in plan: no response body specified.**
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** `trg_post_rate_limit` reads `users.is_suspended` and raises
`ACCOUNT_SUSPENDED`. Setting the boolean is all this endpoint does.
**Notes:** **the trigger only guards `posts` inserts.** A suspended user can still list
products, comment, message and follow — nothing else in the schema reads `is_suspended`.
Either that is intended for v1 or the other write paths need the same check; §8.3's escalation
ladder ("post removed → temporary posting restriction → suspension") reads as though
suspension should be broader. **TODO — ambiguous in plan.**

There is no un-suspend endpoint in the §8.1 table. **TODO — ambiguous in plan:** is
`is_suspended = false` a manual SQL fix, or should this endpoint take a boolean?

`ACCOUNT_SUSPENDED` gets a full-screen client state, not a toast, with a link to appeal (§7.4).

### GET /api/admin/stats   `OWNER: Vishwajeet`  `PHASE 8`
**Module:** admin
**Auth:** required (Bearer token) **+ `users.is_admin = true`**
**Content-Type:** n/a (no body)
**200:** **TODO — ambiguous in plan: field names not specified.** §8.1 describes the contents
as "Open reports, posts today, new users today" — three counts. Confirm the exact keys before
either client renders them.
**401:** `{ "error": "UNAUTHORIZED" }`
**Enforced by:** nothing.
**Notes:** "today" needs a timezone. The database stores `TIMESTAMPTZ` and the users are in
IST; a UTC day boundary will look wrong to a human reading the dashboard at 3am IST. **TODO —
ambiguous in plan.**

---

## Contract review checklist

Per §0.F Step 5, Neeraj reads every entry above and flags anything awkward for React before
Phase 1 starts. **This review is the handoff gate for Phase 0.** Changing a contract on paper
takes minutes; changing it after two clients are built takes days.

Resolve at minimum:

1. **`items` vs named keys** on every list endpoint — affects every list screen on both
   surfaces. See [Conventions](#conventions).
2. **`ACCOUNT_SUSPENDED` / `POSTING_RESTRICTED`: 400 or 403?** `mapDbError()` and §6.6
   disagree, and `POSTING_RESTRICTED` needs an `until` field that `mapDbError()` cannot emit.
3. **`viewer.is_blocked` vs `viewer.is_blocked_by_me`** on `by-username` — a Phase 3 rename of
   a Phase 1 field, or both?
4. **Where `GET /api/users/:username/posts` lives** — a Vishwajeet endpoint on a Neeraj mount
   point, with no route registered for it in the frozen `app.js`.
5. **Whether search is exempt from cursor pagination** — `search_users()` cannot support one
   as written.
6. **The 14 endpoints with no specified success body** — every write in the social module,
   both admin sanction endpoints, and more. Clients need to know what they get back.
7. **The endpoint count.** §0.F Step 4 and Appendix C both say **37** (Neeraj 20 +
   Vishwajeet 17). The tables in §1.5, §3.2, §5.3, §6.6 and §8.1 contain **36** rows in total
   (Neeraj 20 ✓, Vishwajeet **16**). One Vishwajeet posts endpoint is described nowhere. The
   likeliest candidate is **edit-a-post**: migration 007 adds `posts.edited_at`, and no
   endpoint in the plan ever writes it. It has not been invented here. **Confirm whether a
   `PATCH /api/posts/:id` is missing from §6.6, or whether 37 is simply an off-by-one.**

---

## Gaps between Part 1 and Part 2

What Part 2 promises but the current schema and code do not yet have. Everything here is
expected — it is the work of Phases 1 through 8 — and is listed so nobody mistakes a missing
piece for an oversight:

**Schema not yet migrated.** Every Part 2 entry names the migration it waits on:

| Missing | Arrives in | Blocks |
|---|---|---|
| `users.username`, `username_history`, `reserved_usernames`, `is_username_available()`, `suggest_usernames()`, `search_users()` | 002, 003 | the whole user module |
| `follows`, `blocks`, `users.is_private`/`followers_count`/`following_count`, `can_view_social_content()`, `is_blocked_pair()` | 004, 005 | the whole social module; the `viewer` block on `by-username` |
| `notifications` | 006 | the notifications module; every `notify()` call is a logged no-op until then |
| `posts.scope`/`parent_post_id`/`hot_score`/`moderation_status`, `post_likes`, `get_campus_feed()`, `get_global_feed()`, `get_following_feed()` | 007, 009 | the whole posts module |
| `reports`, `banned_terms`, `contains_banned_term()` | 008 | the reports module; `CONTENT_BLOCKED` on `POST /api/posts` |
| `users.is_admin` | 010 | the whole admin module |

The existing `posts` table has only `author_id`, `university_id`, `content` (max 250),
`image_url` — migration 007 drops `image_url` and adds nine columns. Nothing reads or writes
it today.

**Shared infrastructure that now exists but nothing calls yet.** `utils/respond.js`,
`utils/notify.js`, `middleware/requireAuth.js` and `middleware/optionalAuth.js` were built in
Phase 0 and are used by **zero** endpoints — Part 1 predates them, Part 2 is unwritten. The
first Part 2 endpoint to land is also the first real test of them.

**Left over from Part 1, unrelated to the plan:**

- **`visitor_metrics` / `increment_page_view()`** — the RPC and table exist; nothing calls it.
- **Saved-products list** — `product_saves` is written by `/save` but no endpoint reads it
  back as a list.
- **`products.sold_to`** — column exists, never written.
- **`decrement_product_likes` / `increment_product_likes` RPCs** — superseded by the
  `trg_update_likes_count` trigger; no caller remains.

**The §0.5.4 security checklist currently fails on every Part 1 endpoint**: no auth, no
ownership verification, no campus match on read, no `limit` validation anywhere, and raw error
strings in place of `mapDbError()`. Part 2 is specified to pass it. The three worst Part 1
holes — anyone can edit any listing, cross-campus likes, and the open storage bucket — are
fixed in §1.6 during Phase 1.
