# Phase 4 Runbook — Mobile Auth Parity + Cursor Pagination

**Version 1.1 — 14 September 2026**
**Verified against `main` at commit `538cfea`.**
**v1.1: the five scope decisions are settled (§0.8); the decision section is gone.**

Save as `docs/PHASE_4_RUNBOOK.md` and commit it.

---

## HOW TO READ THIS DOCUMENT

Read PART 0, PART 1 and PART 2 **together, both of you, before anyone writes code.**

Five scope questions had to be answered before any of this could be written. They are
answered. §0.8 records them, and every answer is already baked into the blocks and the
Claude Code prompts, so there is nothing left to agree before you start.

Then each of you works from your own two tracks:

| Track | Who | What |
|---|---|---|
| TRACK 1 | Vishwajeet | Manual steps, in blocks, each ending in a checkpoint |
| TRACK 2 | Vishwajeet | Claude Code prompts, one per block, copy-paste them whole |
| TRACK 3 | Neeraj | Manual steps, in blocks |
| TRACK 4 | Neeraj | Claude Code prompts |

**👁️ means a human has to look at something.** A browser, a phone, the Supabase
Studio table editor, a terminal. Everything without 👁️ is left to Claude Code to
verify itself — we are not going to make you re-check things a machine already
checked.

---

# PART 0 — WHAT I FOUND IN THE REPO

I cloned the repo and read the code on `main` at commit `538cfea`. Everything below
is verified, not carried over from the build plan. Where the build plan and the code
disagree, I say so.

## 0.1 The good news

**Phase 3 is genuinely on `main`.** ✅ The warning in build plan §9.1 is resolved.
`main` contains everything that is on `infiniper`, and `infiniper` has nothing extra.

**There are 14 migrations**, ending at `20260910171153_universities_expansion.sql`.

**The mobile Turnstile WebView is in place.** ✅ `mobile/app/(auth)/login.tsx`
imports `TurnstileWebView`, holds a single-use token, resets the widget after every
attempt, and handles the case where the check cannot run at all (`captchaFailed`).

**Every backend endpoint Phase 4 depends on already exists:**

| Endpoint | Status |
|---|---|
| `POST /api/auth/login-password` | ✅ live |
| `POST /api/auth/set-password` | ✅ live |
| `GET /api/auth/password-status` | ✅ live |
| `GET /api/users/username-available` | ✅ live |
| `GET /api/users/username-suggestions` | ✅ live |

So none of Phase 4's mobile work is blocked on backend work. That is a good place
to start a phase from.

**CORS is properly locked down.** ✅ `backend/src/app.js` has a real production
allowlist, with LAN origins permitted only when `isProduction` is false.

**`PUT /api/users/:userId/profile` is fixed.** ✅ It has `requireAuth`, it takes
`req.user.id` and deliberately ignores `req.params.userId`, and it runs the body
through `pickAllowedProfileFields()`.

## 0.2 🚨 Finding 1 — mobile signup is broken today

**This is the most urgent thing in this phase and it is not in the build plan.**

`POST /api/auth/onboarding` in `backend/src/modules/auth/auth.controller.js` now
treats username and password as **mandatory**:

```js
const username = typeof rawUsername === 'string' ? rawUsername.trim().toLowerCase() : '';

if (!username) {
    return sendError(res, 400, 'INVALID_FORMAT', {
        message: 'A username is required to complete onboarding.',
    });
}

if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return sendError(res, 400, 'WEAK_PASSWORD', {
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
}
```

And this is the entire body `mobile/app/(auth)/onboarding.tsx` sends:

```ts
{
  userId,
  full_name: fullName.trim(),
  avatar_url: avatarUrl || null,
  qualification,
  course_id: courseId,
  year_of_study: yearOfStudy,
  specialization_id: specializationId,
  bio: bio.trim() || null,
}
```

No `username`. No `password`.

**What this means in practice.** A student downloads the app. They enter their
college email. They get the OTP. They verify it. They fill in their name, course,
year and specialization. They press Save. The server rejects it with a 400.

And because `mobile/src/lib/api.ts` puts the backend's `error` field into the thrown
error's message before falling back to `message`, the student does not even see a
sentence. They see the literal text **`INVALID_FORMAT`** in a red box.

They cannot get past this screen. There is no workaround inside the app.

**Why you have not seen it.** You have been testing with accounts that were already
onboarded, so the app routes you straight into the tabs and never opens this screen.
The break only appears on a genuinely new account.

**What this changes.** The build plan (§5.5) files "username selection" and
"set password" as missing *parity features*. They are not. They are the missing half
of a flow that cannot complete. Block V-B moves to the front of your track.

## 0.3 🚨 Finding 2 — nine write endpoints still take their actor from the request

The build plan, §4, under Phase 3, says:

> Every other unauthenticated write endpoint across products, messages and user
> `POST /messages/send` took `sender_id` from the body, so the campus check validated nothing

The `user` module part of that is true. The `products` and `messages` part is not.

Verified in `backend/src/modules/messages/messages.routes.js` on `main`:

```js
router.get('/inbox/:userId', getInbox);
router.get('/history', requireAuth, getChatHistory);
router.post('/send', sendMessage);
router.put('/read', markAsRead);
router.put('/deliver', markAsDelivered);
```

Only `/history` is protected. And `sendMessage` begins:

```js
const { sender_id, receiver_id, product_id, content } = req.body;

const { data: user } = await supabase
    .from('users')
    .select('university_id')
    .eq('id', sender_id)      // ← the CLAIMED sender
    .single();
```

**Spelled out.** There is no `requireAuth`, so no login token is needed to reach this
endpoint. The sender's identity is whatever the caller typed into the request body.
The campus lookup then reads *that claimed person's* row and stamps their
`university_id` onto the message. It never compares the sender to the receiver. So it
is not enforcing campus isolation — it is copying a field and calling it a check.

A stranger with two user UUIDs can do this from any terminal on earth:

```bash
curl -X POST https://yahora-yst4.onrender.com/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{"sender_id":"<any-student-uuid>",
       "receiver_id":"<any-other-uuid>",
       "content":"meet me behind the hostel"}'
```

No account. No password. No token. The message lands in a real student's inbox and
appears to have come from a real classmate. UUIDs are not secret — `GET
/api/user/:userId/public` hands them out by design.

The full list, all verified:

| Endpoint | Module | Problem |
|---|---|---|
| `POST /api/messages/send` | messages | No auth. `sender_id` from body |
| `GET /api/messages/inbox/:userId` | messages | No auth. Reads anyone's inbox |
| `PUT /api/messages/read` | messages | No auth |
| `PUT /api/messages/deliver` | messages | No auth |
| `POST /api/products` | products | No auth. `seller_id` from body |
| `POST /api/products/:id/comments` | products | No auth. `user_id` from body |
| `POST /api/products/comments/:commentId/vote` | products | No auth |
| `POST /api/products/:id/sold` | products | No auth |
| `POST /api/products/:id/available` | products | No auth |

These are all in **Vishwajeet's** modules, which is why Neeraj's Phase 3 work did not
reach them. Neeraj fixed his own module correctly and completely.

**The scheduling risk.** Because the build plan's summary sentence says these are
closed, every future reader will believe it. If they are not put in a phase now, they
will not be picked up by accident later. They are Block V-A, and they go first.

## 0.4 Pagination — the current state, exactly

`.range()` has **0 call sites** across `backend/src`, `frontend/src`, `mobile/src`
and `mobile/app`. Confirmed. Every list endpoint returns every matching row.

**The helper already exists.** `backend/src/utils/respond.js`:

```js
export function sendPage(res, items, cursorField = 'created_at', limit = 20) {
  const next = items.length === limit ? items[items.length - 1][cursorField] : null;
  return res.json({ items, next_cursor: next });
}
```

It is in `utils/`, which `backend/CLAUDE.md` marks as **frozen shared infrastructure —
only Vishwajeet may edit it.** Import it, never edit it, and never write a parallel
version inside your own module. That constraint bites once, in Block N-C — the chat
history page needs a `next_cursor` that `sendPage()` cannot compute. The prompt there
says what to do instead.

Now the five endpoints, each with the thing that makes it different:

| Endpoint | How it reads today | The complication |
|---|---|---|
| `GET /api/products` | `.order('created_at', { ascending: false })` | None. This is the easy one |
| `POST/GET product comments` | plain select | Threaded — parent and child comments |
| `GET /api/messages/inbox/:userId` | RPC `get_user_inbox(p_user_id)` | **RPC has no limit and no cursor. Needs a migration** |
| `GET /api/messages/history` | `.order('created_at', { ascending: true })` | **Ascending.** Chat pages *backwards*. See §1.5 |
| `GET /api/users/search` | RPC `search_users(p_query, p_viewer, p_limit)` | **Ordered by a computed rank.** No cursor is possible; it is exempt (§0.8) |

Two of the five are RPCs. An RPC is a function that lives inside the database, so
changing it means **a migration**, which is Vishwajeet's work regardless of who owns
the controller. That is a cross-owner dependency the build plan does not mention.

## 0.5 Two contract questions that API.md flagged as unresolved

`backend/API.md:66` says:

> ⚠️ **`items` vs named keys — unresolved.** `sendPage()` emits `items` [...] But the
> plan's own worked examples use named keys: `{ "users": [...] }` [...] Both cannot be
> right. [...] **Resolve this at the §0.F Step 5 contract review, before anyone writes
> a client** — it touches every list screen on both surfaces.

`backend/API.md:1730` says:

> **this list is not cursor-paginated and cannot be.** [...] `search_users()` takes only
> `p_limit`, has no cursor parameter, and is ordered by a computed `rank` that no index
> can seek into. **Is search exempt (a fixed top-N with no `next_cursor`), or does the
> RPC need a cursor parameter?**

Phase 4 is the phase that writes this code, so both had to be answered first. Both are
now settled — see §0.8. Resolve the flags inside `API.md` itself, in the same commits
that implement them, so the file stops describing them as open.

## 0.6 Documentation and housekeeping

**`docs/CURRENT_STATE.md` is dated 25 August and is now wrong in both directions.**
It lists 8 migrations when 14 exist. It still calls `PUT /api/users/:userId/profile`
"the worst remaining hole in the backend" when that one is fixed. Build plan §2.4
requires every Claude Code session to open by reading it, so both of your Claude Code
sessions will start Phase 4 by reading a document that misleads them twice.

**There is no Phase 3 handoff entry in `docs/CHANGELOG.md`.** The newest entries are
12 September (the port 5001 fix) and 8 September (the Phase 2 handoff). Phase 3
shipped, but per your own rule — *"Files are the shared memory. Chat history is
not."* — Neeraj has no written record of it.

**Branches are behind `main`:**

```
origin/neeraj      7 commits behind
origin/vishwajeet  5 commits behind
origin/infiniper   2 commits behind
```

Nobody starts until these are pulled.

**`frontend/.env.example` still has `VITE_API_PORT=5000`.** The 12 September CHANGELOG
entry asked for this under a heading literally reading "🔴 Neeraj — one thing for
you." The next fresh clone walks straight into the macOS AirPlay 403.

**`cache.md` and `cache.jsx` are still tracked files.** Both are empty and match
`HEAD` right now. `CURRENT_STATE.md` records that `cache.md` has previously held the
production connection string with the password in it.

## 0.7 Confirmations on your four points

1. **Phase 3 verification.** Noted, and the parts you verified do hold up in the code.
   The nine endpoints in §0.3 were never built in Phase 3, so there was nothing for
   your verification to catch. This is a scope gap, not a testing gap.
2. **Expo Go SDK 56 on both phones.** Noted and relied on throughout. Neeraj's OPPO
   K14 is the primary test device for every mobile check in Track 3.
3. **`activate_verified_universities` deferred.** Already correctly placed — it is in
   Phase 9 of the build plan, with the reasoning that domains verified two months
   early go stale. Nothing to move. Leaving it there.
4. **Even split, testing to Neeraj.** Done. PART 2 has the day-by-day. Every 👁️ human
   check in this runbook is in Track 3 except two that physically require your Mac.

## 0.8 Scope decisions, settled

Five questions had to be answered before a line of this could be written. All five are
settled. Every one is already built into the blocks and the Claude Code prompts below,
so there is nothing to decide while you work. They are recorded here so that anyone
reading this in three months knows each was a deliberate choice rather than an accident.

| # | The question | The answer |
|---|---|---|
| 1 | Are the nine unauthenticated endpoints (§0.3) inside Phase 4? | **Yes, and they go first.** Block V-A, Day 1 |
| 2 | Who writes the pagination in `products` and `messages`? | **Neeraj, for this phase only**, under the conditions below |
| 3 | `items` or a named key in every list response? | **`items`. Everywhere. No exceptions** |
| 4 | Is user search cursor-paginated? | **No. Exempt.** Fixed top-N, `next_cursor` always `null` |
| 5 | Does `get_user_inbox` get a cursor? | **Yes.** One migration, Block V-C |

Three of them carry reasoning that matters while you are coding, so it is written out
here rather than left in a table cell.

**On decision 1.** The nine endpoints are live in production right now. The fix pattern
already exists and works in `user.controller.js`, so there is a correct example to copy
rather than a design to invent. And the build plan currently states that they are
closed — which means that if they are not fixed in this phase, no later phase will pick
them up, because every future reader will believe the job is done.

**On decision 2 — the conditions that make it safe.** This deviates from
`backend/CLAUDE.md`, which lists `products/` and `messages/` as Vishwajeet's. Four of
the five endpoints needing pagination are in those modules, so following the map to the
letter would have given Vishwajeet almost the whole phase. Three things make the
deviation safe, and **all three are load-bearing**:

1. **Sequencing, not simultaneity.** Vishwajeet's Block V-A lands on `main` on Day 1 and
   touches only the *write* handlers. Neeraj then pulls and touches only the *read*
   handlers. Different functions, never the same day. §2.2 has the detail.
2. **Vishwajeet reviews every pagination PR.** This is not a new rule for this phase; it
   is build plan rule 10, which already requires the other person's review on backend
   pull requests.
3. **It is written down.** Block N-A puts the loan in `docs/CHANGELOG.md`, stating that
   it is scoped to Phase 4 and that the ownership map is unchanged from Phase 5 onward.
   Without that, somebody reads the diff later and concludes the map is dead.

**On decision 3 — what it costs.** A single envelope means one client-side helper can
read any paginated endpoint, instead of one per endpoint. On mobile that matters:
`useInfiniteQuery` gets configured once and reused. The price is that
`GET /api/users/search` returns `{ users: [...] }` today and the web already reads that
key, so renaming it to `items` is a **BREAKING** change. Backend and web both change in
the same commit, and both are Neeraj's, so it is coordinated by default.

---

# PART 1 — THE CONCEPTS, FROM SCRATCH

Read this part even if some of it is familiar. Every worked example below uses your
actual data shapes, so it doubles as a reference while you are writing the code.

## 1.1 What "the actor comes from the token" actually means

When a student logs in, the backend hands them a **token** — a long string that is
cryptographically signed. It is signed with a secret only Supabase and your backend
know. That signature is the point: nobody can forge one, and nobody can edit the
inside of a token without breaking the signature.

Inside that token, among other things, is the student's user id.

Your `requireAuth` middleware does three things:

1. Reads the `Authorization: Bearer <token>` header off the request.
2. Asks Supabase to verify the signature. If it is missing or broken, it replies 401
   and the handler never runs.
3. If it is valid, it sets `req.user` and calls the handler.

So by the time your controller runs, **`req.user.id` is a proven fact.** Nobody could
have tampered with it.

Now compare that with `req.body.sender_id`. The body is just text the caller typed. It
is not signed, not verified, not checked against anything.

**Worked example.** Two students:

```
Rahul   id = aaaa-1111   university_id = iiitk
Priya   id = bbbb-2222   university_id = iiitk
Mallory id = cccc-3333   university_id = (not a student at all)
```

Mallory sends this, with no token:

```json
POST /api/messages/send
{ "sender_id": "aaaa-1111", "receiver_id": "bbbb-2222", "content": "call me" }
```

Today's handler looks up `aaaa-1111`, finds Rahul, sees `university_id = iiitk`,
stamps that onto the message and inserts it. Priya opens the app and sees a message
from Rahul that Rahul never sent.

With `requireAuth` and `req.user.id`, Mallory has no token, so the request dies at the
middleware with a 401 and the handler is never reached. If Mallory *did* have her own
account, `req.user.id` would be `cccc-3333` and the message would be from Mallory,
under her own name, where it belongs.

**The one-line rule:** the request body says what the caller *wants to do*. The token
says who the caller *is*. Never let the body answer the second question.

## 1.2 What offset pagination is, and why it breaks

Offset pagination is the obvious approach. Page 1 is rows 1–20, page 2 is rows 21–40,
and so on. In SQL:

```sql
SELECT * FROM products ORDER BY created_at DESC LIMIT 20 OFFSET 20;
```

It has two problems and they get worse as you grow.

**Problem one: it gets slower the deeper you go.** `OFFSET 20000` does not let Postgres
skip ahead. Postgres must *produce* all 20,000 rows, in order, and throw them away,
before it starts returning anything. Page 1 is instant; page 1000 is a crawl.

**Problem two, the nastier one: rows shift underneath you.**

Worked example. Priya opens the marketplace. Newest first. The feed is:

```
position 1   Cycle          created 10:00
position 2   Lamp           created 09:00
position 3   Desk           created 08:00
position 4   Chair          created 07:00
position 5   Kettle         created 06:00
```

She loads page 1 with `LIMIT 2 OFFSET 0` and sees **Cycle, Lamp**.

While she is reading, Rahul posts a Fan at 10:30. The list is now:

```
position 1   Fan            created 10:30   ← new
position 2   Cycle          created 10:00
position 3   Lamp           created 09:00
position 4   Desk           created 08:00
position 5   Chair          created 07:00
```

Priya scrolls. The app asks for `LIMIT 2 OFFSET 2` — positions 3 and 4. That is now
**Lamp and Desk**.

She has seen Lamp twice, and she has not seen Fan at all. On a busy campus feed this
happens constantly, and users read it as "the app is buggy" because from their side it
is a duplicate.

## 1.3 What cursor pagination is

Instead of counting positions, you remember **the last item you actually saw** and ask
for things after it.

The cursor is a value from the last row of the previous page. For a feed ordered by
`created_at DESC`, it is that row's `created_at`.

Same scenario, cursor-based. Page 1:

```
GET /api/products?limit=2
```

```json
{
  "items": [
    { "title": "Cycle", "created_at": "2026-09-14T10:00:00Z" },
    { "title": "Lamp",  "created_at": "2026-09-14T09:00:00Z" }
  ],
  "next_cursor": "2026-09-14T09:00:00Z"
}
```

Note that `next_cursor` is the `created_at` of the **last item on the page**.

Rahul posts the Fan at 10:30. Priya scrolls, and the app sends the cursor back:

```
GET /api/products?limit=2&cursor=2026-09-14T09:00:00Z
```

which becomes:

```sql
SELECT * FROM products
WHERE created_at < '2026-09-14T09:00:00Z'
ORDER BY created_at DESC
LIMIT 2;
```

She gets **Desk and Chair**. No duplicate. The Fan is not skipped either — it is newer
than everything she has seen, so it appears the next time the feed refreshes from the
top, which is where a new item belongs.

And it is fast at any depth, because `WHERE created_at < X` uses the index to jump
straight to the right place instead of counting.

**How you know you have reached the end.** `sendPage()` handles it:

```js
const next = items.length === limit ? items[items.length - 1][cursorField] : null;
```

Read that as: *if I asked for 20 and got exactly 20, there is probably more, so hand
back a cursor. If I asked for 20 and got 13, I have hit the bottom, so hand back
`null`.*

`next_cursor: null` is the **only** end-of-list signal. Clients must not guess from an
empty array or a short page.

**One edge case worth knowing.** If the total happens to be exactly 20, the client gets
a cursor, asks once more, and receives an empty page with `next_cursor: null`. That is
one wasted request and it is correct behaviour. Do not try to be clever about it.

## 1.4 Why `created_at` alone is not quite enough

`created_at` is a timestamp with microsecond precision, so two rows sharing one is
unlikely. Unlikely is not never — bulk inserts and seed scripts do it routinely.

If two products share a `created_at` and one lands on the page boundary, `WHERE
created_at < X` skips both.

**The fix** is a tie-breaker: order by the timestamp *and* the id, and compare both.

```sql
ORDER BY created_at DESC, id DESC
```

and the cursor carries both values. In PostgREST that is a compound filter:

```js
.or(`created_at.lt.${cursorTime},and(created_at.eq.${cursorTime},id.lt.${cursorId})`)
```

Read that as: *rows strictly older than the cursor time, OR rows at exactly the cursor
time whose id sorts below the cursor id.*

**For Phase 4, do this only where rows can genuinely collide.** Comments and messages
can be inserted in bulk by scripts. The products feed is created by humans pressing a
button, so a plain timestamp cursor is fine there. Claude Code prompts in Track 4 say
which is which, so you do not have to decide per endpoint.

## 1.5 Chat history pages backwards, and that changes the cursor

Every other list here is newest-first. Chat is not.

`getChatHistory` reads:

```js
.order('created_at', { ascending: true }); // Oldest first for chat UI
```

That is right for rendering — a chat reads top to bottom, oldest at the top, newest at
the bottom.

But think about what "load more" means in a chat. You open it and see the **newest**
30 messages. You scroll **up** for older ones.

So the screen renders ascending while it pages descending. If you naively add
`WHERE created_at > cursor` to the existing ascending query, "load more" fetches
*newer* messages, which the user already has.

**The correct shape:**

1. Query **descending** from the cursor: `WHERE created_at < cursor ORDER BY created_at DESC LIMIT 30`
2. The cursor is the `created_at` of the **oldest** message currently on screen.
3. **Reverse the page before sending it**, so the client still receives oldest-first
   and its render loop is unchanged.

Worked example. A thread with six messages:

```
09:00  Rahul  "is the cycle still there?"
09:01  Priya  "yes"
09:02  Rahul  "what condition"
09:03  Priya  "good, barely used"
09:04  Rahul  "can I see it today"
09:05  Priya  "after 5, near the canteen"
```

First load, `limit=3`, no cursor. Query descending, take 3 — that is 09:05, 09:04,
09:03. Reverse it. Send:

```json
{
  "items": [ "09:03 good, barely used", "09:04 can I see it today", "09:05 after 5, near the canteen" ],
  "next_cursor": "2026-09-14T09:03:00Z"
}
```

The cursor is the **oldest** item on the page, because that is the direction of travel.

Rahul scrolls up. The client sends `cursor=09:03`. Query descending from there — 09:02,
09:01, 09:00. Reverse. Send those three with `next_cursor: null`, because only three
came back for a limit of three... which actually means a cursor *is* returned. On the
following request the query returns zero rows and `next_cursor` is `null`. One extra
round trip, exactly as described in §1.3.

**This is the single most error-prone piece of Phase 4.** The prompt in Track 4 for
this block is deliberately explicit about it.

## 1.6 Debouncing, and why 400ms

When the student types a username, you want to ask the server whether it is free. The
naive version asks on every keystroke.

Typing `rahul` fires six requests: `r`, `ra`, `rah`, `rahu`, `rahul`. Five of them are
about prefixes the student never intended to submit.

Worse, they can arrive out of order. The `r` request might be slow and land *after*
`rahul` came back, so the UI ends up showing the answer for `r`.

**Debouncing** means: wait until the typing stops, then send one request.

In practice you set a timer on every keystroke and cancel the previous one:

```ts
useEffect(() => {
  const timer = setTimeout(() => {
    checkAvailability(username);
  }, 400);

  return () => clearTimeout(timer);   // ← cancels if they type again first
}, [username]);
```

The `return () => clearTimeout(timer)` is the whole trick. React runs that cleanup
before the effect runs again, so each keystroke cancels the pending timer. Only when
400ms passes with no new keystroke does the request actually fire.

**Why 400ms.** Comfortable typing is roughly 150–250ms between keys, so 400ms is long
enough to sit out a normal burst but short enough that it does not feel laggy. The web
already uses 400ms in `frontend/src/pages/onboarding/onboarding.jsx`, so mobile
matching it means both platforms behave identically. Do not invent a different number.

**Debouncing does not fix out-of-order responses on its own.** If the student types,
pauses, types again, two requests can still be in flight. The web solves this with a
monotonically increasing request id and ignores any response that is not the latest.
Mirror that; the prompt in Track 2 specifies it.

## 1.7 Why every login failure returns the identical message

`POST /api/auth/login-password` returns exactly one failure response for four different
situations:

- wrong password
- username does not exist
- email does not exist
- account exists but has no password set

All four: `400`, code `INVALID_CREDENTIALS`, and the same sentence.

**Why this matters more on a campus app than elsewhere.** Suppose "no such user" and
"wrong password" differed. Anyone could type a username and learn from the response
whether that person is on Yahora.

That gives an attacker a list of real accounts to concentrate password guessing on.
But on a campus app it does something worse: it answers *"is this specific classmate on
Yahora?"* for anybody who asks. That is a harassment tool, and you would have built it
yourself.

**What this means for the mobile screen.** Do not branch on the reason. There is no
reason in the payload to branch on. One constant string, used for every failure:

```
Incorrect username or password. Please try again.
```

**Where new-user guidance goes.** It is a fair worry that a first-time student will
type their email into the password tab and get stuck. The answer is **permanent helper
text under the form**, always visible, not an error:

```
New to Yahora? Use the College Email & OTP tab to create your account.
```

Permanent, because an error only appears after they have already failed. Helper text
is there before they try.

## 1.8 What "never block paste" means and why it is in the plan

Some apps disable pasting into password fields, believing it is safer. It is not.

Blocking paste breaks password managers. A student using one either cannot log in at
all, or gives up and types something short and memorable instead. You have traded a
strong random password for a weak human one.

On React Native the practical rules are:

- Do not set `contextMenuHidden` on a password `TextInput`.
- Set `secureTextEntry` for the masking, and give the student a show/hide toggle.
- When the server rejects the password, **keep what they typed.** Clearing the field
  on error is the single most irritating thing a signup form can do, and on a phone
  keyboard it is worse.

---

# PART 2 — FILES, OWNERSHIP AND THE DAY-BY-DAY

## 2.1 Every file this phase touches

**Vishwajeet**

```
backend/src/modules/messages/messages.routes.js        Block V-A
backend/src/modules/messages/messages.controller.js    Block V-A  (write handlers only)
backend/src/modules/products/products.routes.js        Block V-A
backend/src/modules/products/products.controller.js    Block V-A  (write handlers only)
backend/API.md                                         Blocks V-A, V-C
supabase/migrations/<new>_inbox_pagination.sql         Block V-C
mobile/src/contexts/AuthContext.tsx                    Blocks V-B, V-D
mobile/app/(auth)/onboarding.tsx                       Block V-B
mobile/app/(auth)/login.tsx                            Block V-D
mobile/src/components/  (new: UsernameField, PasswordField)   Blocks V-B, V-D
docs/CHANGELOG.md                                      every block
```

**Neeraj**

```
docs/CURRENT_STATE.md                                  Block N-A
docs/CHANGELOG.md                                      every block
frontend/.env.example                                  Block N-A
backend/src/modules/products/products.controller.js    Block N-B  (read handlers only)
backend/src/modules/messages/messages.controller.js    Block N-C  (read handlers only)
backend/src/modules/user/user.controller.js            Block N-C
backend/API.md                                         Blocks N-B, N-C
```

**Nobody touches, this phase or any phase:**

```
backend/src/app.js
backend/src/middleware/
backend/src/config/
backend/src/utils/respond.js
```

If a block seems to need a change in one of those, **stop and tell Vishwajeet.** Do not
work around it by writing a local copy inside your own module.

## 2.2 The one file you are both in

`products.controller.js` and `messages.controller.js` are each edited by both of you
this phase, which is normally exactly what the ownership map exists to prevent. The
sequencing is what makes it safe:

```
Day 1   Vishwajeet  V-A   write handlers   →  merged to main by end of day
Day 2   Neeraj      N-B   read handlers    →  starts from a pulled main
Day 3   Neeraj      N-C   read handlers
```

**Two hard rules.**

Vishwajeet's V-A must reach `main` before Neeraj opens either file. If V-A slips, N-B
and N-C slip with it — do not start them in parallel to save a day.

Neeraj touches only `getProducts`, `getProductById` comments, `getInbox` and
`getChatHistory`. If a prompt seems to want a change inside `sendMessage`,
`createProduct`, `addComment` or `toggleCommentVote`, that is a signal the prompt has
drifted. Stop and ask.

## 2.3 The day-by-day

| Day | Vishwajeet | Neeraj |
|---|---|---|
| **1** | V-0 setup, then **V-A** — auth on 9 endpoints. Merge to `main` by end of day | **N-A** — pull `main`, docs housekeeping, the two small fixes |
| **2** | **V-B** — mobile onboarding: username + password. The broken flow | **N-B** — pagination: products feed + comments |
| **3** | **V-B** continued, into review | **N-C** — pagination: inbox, chat history, user search |
| **4** | **V-D** — mobile password login tab | **N-D** — 👁️ human testing round 1, web + both phones |
| **5** | **V-D** continued. Review Neeraj's backend PRs | **N-D** — 👁️ round 2, then joint SIGN-OFF |

Vishwajeet is blocked on nothing. Neeraj is blocked on V-A for one day, which is why
N-A is the housekeeping day.

**V-C, the inbox migration, is deliberately not on this grid.** It is small and it
gates N-C. Vishwajeet fits it in on Day 1 or the morning of Day 2, before Neeraj needs
it. It is written as its own block so it does not get lost inside V-A.

## 2.4 What "done" means for this phase

- A brand-new student can sign up on the Android app, choose a username, set a
  password, and reach the marketplace. 👁️
- That same student can sign out and log back in with username and password. 👁️
- No write endpoint in `products` or `messages` accepts an actor from the request body.
- All five list endpoints accept `limit` and `cursor`, cap the limit at 50, and return
  `{ items, next_cursor }`.
- Clients that send neither `limit` nor `cursor` still work, unchanged. 👁️
- `API.md` matches the code. `CHANGELOG.md` has a handoff entry from each of you.

---

# TRACK 1 — VISHWAJEET, MANUAL STEPS

## Block V-0 — Setup (20 minutes)

You are on the `infiniper` branch, 2 commits behind `main`.

```bash
cd ~/path/to/yahora
git checkout main
git pull origin main
git checkout infiniper
git merge main
git push origin infiniper
```

Then confirm your local database is actually in step with the migration files:

```bash
supabase start
supabase db reset
```

`db reset` wipes the local database, replays all 14 migrations from scratch, then runs
`seed.sql`. If a migration is broken, this is where you find out — not on production.

Then seed test data:

```bash
node backend/scripts/seedLocal.js
node backend/scripts/seedDemo.js
```

**👁️ CHECKPOINT V-0.** Three things only you can check, because they need your Mac:

1. `supabase db reset` finished with no error. If it failed, stop and paste the full
   output before going further.
2. Open Supabase Studio at `http://127.0.0.1:54323`, open the `universities` table,
   and confirm `iiitk.ac.in` has `is_active = true`. This is what makes local signup
   testable at all.
3. Run the drift check against production:

```bash
PROD_DB_URL_FILE=~/yahora-backups/prod-db-url node backend/scripts/schema-drift.mjs
```

It should report MATCH on every line. If it reports drift, **stop and tell Neeraj
before either of you writes anything** — a schema difference between local and
production invalidates every test you run this week.

## Block V-A — Close the nine unauthenticated endpoints (half a day)

This is §0.3. It goes first because it is live in production right now, and because
Neeraj cannot start N-B until it is on `main`.

Run prompt **CC-V1** from Track 2.

The pattern already exists and works — `updateProfile` in
`backend/src/modules/user/user.controller.js` is the reference. Read it before you
start so you can tell whether Claude Code produced the same shape.

**What you are checking for when it finishes.** Claude Code will run the code, but it
cannot tell you whether the *policy* is right. Read the diff and confirm:

- Every one of the nine routes now has `requireAuth` in front of it.
- Every handler takes its actor from `req.user.id`.
- The route *paths* are unchanged. `POST /api/messages/send` is still
  `POST /api/messages/send`. If a path moved, both clients break.
- `GET /api/user/:userId/public` still has **no** auth. It is a public page by design
  and there is a comment in the file saying so.

**👁️ CHECKPOINT V-A.** One check, and it is genuinely worth the two minutes, because
it is the exact attack from §0.3.

Start the backend (`cd backend && npm run dev`), then from a terminal:

```bash
curl -i -X POST http://localhost:5001/api/messages/send \
  -H "Content-Type: application/json" \
  -d '{"sender_id":"00000000-0000-4000-8000-000000000001",
       "receiver_id":"00000000-0000-4000-8000-000000000002",
       "content":"test"}'
```

**Before the fix** this returns `201 Created` and inserts a row.
**After the fix** it must return `401` with `{"error":"UNAUTHORIZED"}`.

If it returns 201, the fix did not land. Do not merge.

Then merge to `main` and tell Neeraj in the same breath:

```bash
git add -A
git commit -m "security: require auth on 9 write endpoints in products and messages"
git push origin infiniper
# open the PR, get Neeraj's review (rule 10), merge to main
```

## Block V-C — Migration: pagination for the inbox RPC (1 hour)

Do this on Day 1 evening or Day 2 morning. It gates Neeraj's N-C.

Run prompt **CC-V2**.

**Concept, in case it is unfamiliar.** `get_user_inbox` is a function stored inside
Postgres, not in your JavaScript. Your controller calls it with
`supabase.rpc('get_user_inbox', { p_user_id: userId })`. To give it a limit and a
cursor you have to change the function itself, and changing anything inside the
database means a migration file.

Rule 2 from the build plan applies: **never edit an applied migration.** You are
writing a new one that replaces the function with `CREATE OR REPLACE FUNCTION`.

**👁️ CHECKPOINT V-C.**

```bash
supabase db reset
```

Then in Supabase Studio at `http://127.0.0.1:54323`, open the SQL editor and run:

```sql
select * from get_user_inbox('<a seeded user uuid>', 2, null);
```

You should get at most 2 rows back. Then take the `last_message_at` from the second
row and run it again as the third argument — you should get the *next* conversations,
not the same two.

Then push:

```bash
supabase db push
```

and add the migration to `docs/CHANGELOG.md` under `### Migrations applied`, because
Neeraj needs to know it exists before he writes N-C.

## Block V-B — Mobile onboarding: username and password (1.5 days)

**This is the broken flow from §0.2. It is the most important block in the phase.**

Run prompt **CC-V3**.

Before you start, open `frontend/src/pages/onboarding/onboarding.jsx` and read lines
338–430. That is the web's username availability logic — the 400ms debounce, the
monotonic request id, the suggestions fetch. You are mirroring its *behaviour*, not
its code; React Native has no DOM and the styling system is different.

**What the screen needs when it is done:**

- A username field. Silently lowercases as they type. Debounced 400ms availability
  check. Three tappable suggestions derived from their name.
- The live rules: starts with a letter, 3–25 characters, only `a-z 0-9 . _ -`, and no
  two separators in a row.
- A password field and a confirm field. Minimum 8 characters. Show/hide toggle on both.
- Paste allowed. Never `contextMenuHidden`.
- On server rejection, **the typed values stay.**
- The submit body now includes `username` and `password`.

**👁️ CHECKPOINT V-B.** Only one check here is yours, because it needs your Expo
server. Everything else goes to Neeraj in N-D.

Create a genuinely new account against your **local** backend and get all the way
through to the marketplace. Use Mailpit at `http://127.0.0.1:54324` to read the OTP —
it catches every outgoing email locally so you never burn a real one.

The single thing to confirm: **you reach the marketplace.** That is the bug from §0.2
being fixed. Neeraj will handle every edge case in N-D.

## Block V-D — Mobile password login (1.5 days)

Run prompt **CC-V4**.

Open `frontend/src/pages/auth/Auth.jsx` first and read the tab switcher around line
611, plus the `handlePasswordLogin` function around line 486. That is the shape you
are mirroring.

**What the screen needs:**

- Two tabs: `College Email & OTP` and `Username & Password`.
- The OTP tab is exactly what exists today, untouched, Turnstile and all.
- The password tab posts `{ identifier, password }` to `/api/auth/login-password`.
- **One error string, always:** `Incorrect username or password. Please try again.`
- Permanent helper text under the password form, always visible, not an error:
  `New to Yahora? Use the College Email & OTP tab to create your account.`
- A `429` shows a countdown from `retry_after_seconds`, and the button stays disabled
  until it reaches zero.
- Turnstile stays on the OTP tab only. `login-password` does not take a captcha token.

**👁️ CHECKPOINT V-D.** Yours is one check: log in with a username and password on
your POCO X2 and reach the marketplace. Everything else — the error states, the
lockout, the tab persistence — is Neeraj's in N-D.

---

# TRACK 2 — VISHWAJEET, CLAUDE CODE PROMPTS

Paste each one whole. They end with hard constraints, and those constraints are the
part that stops Claude Code from being helpful in a direction you did not ask for.

Start every session with the standard opener from build plan §2.4:

```
Before we start: read CLAUDE.md, docs/CHANGELOG.md, backend/API.md,
and docs/CURRENT_STATE.md. Summarise in 5 bullets what changed most
recently and what I should be careful about.

Note: docs/CURRENT_STATE.md is dated 25 August and is known to be stale.
It lists 8 migrations; there are 14. It lists
PUT /api/users/:userId/profile as unauthenticated; that was fixed in
Phase 3. Treat it as historical context, not current fact.
```

## CC-V1 — Require auth on nine write endpoints

```
Phase 4, Block V-A. Security fix in two modules I own.

CONTEXT
Nine endpoints in backend/src/modules/products/ and
backend/src/modules/messages/ take the acting user's identity from the
request body or the URL, and seven of them have no authentication at all.
A caller with no account can send a message that appears to come from a
real student, or create a listing under someone else's name.

THE REFERENCE IMPLEMENTATION
backend/src/modules/user/user.controller.js -> updateProfile is already
correct. Read it first. Copy its shape exactly: requireAuth on the route,
`const userId = req.user.id` as the only source of identity, and the path
parameter deliberately ignored with a comment saying why.

THE NINE ENDPOINTS
messages.routes.js:
  GET  /inbox/:userId       -> getInbox
  POST /send                -> sendMessage
  PUT  /read                -> markAsRead
  PUT  /deliver             -> markAsDelivered
products.routes.js:
  POST /                    -> createProduct
  POST /:id/comments        -> addComment
  POST /comments/:commentId/vote -> toggleCommentVote
  POST /:id/sold            -> markProductAsSold
  POST /:id/available       -> markProductAsAvailable

WHAT TO DO FOR EACH
1. Add requireAuth to the route.
2. In the handler, take the actor from req.user.id. Delete the
   destructure of sender_id / seller_id / user_id from req.body. If the
   body still sends it, ignore it silently — do not error, because both
   clients still send it today and I am not breaking them this week.
3. For GET /inbox/:userId, keep the path parameter but return 403 if
   req.user.id !== req.params.userId. Do not change the path.
4. sendMessage: the campus check currently reads the CLAIMED sender's
   university_id and stamps it on the row. Change it to read the
   authenticated sender's university_id, and ADD a check that the
   receiver is in the same university. Return 403 FORBIDDEN if not.
   Use sendError from utils/respond.js.
5. markProductAsSold / markProductAsAvailable: add an ownership check.
   Only the seller may change the status of their own listing. 403
   otherwise. Copy the check from updateProduct, which already does this.

ERROR SHAPES
Use sendError and mapDbError from backend/src/utils/respond.js. Do not
invent new codes. UNAUTHORIZED (401) comes from requireAuth itself;
FORBIDDEN (403) is yours to send.

ALSO REQUIRED
- Update backend/API.md in this same response for all nine endpoints:
  the Auth line, and the new 403 cases. backend/CLAUDE.md says API.md is
  part of the change, not a follow-up.
- Add a docs/CHANGELOG.md entry headed
  "## 2026-09-XX — Phase 4 V-A: auth on nine write endpoints (Vishwajeet)"
  using the six-section template. The "Changed endpoints (BREAKING)"
  section matters: any client calling these without an Authorization
  header will now get 401.

HARD CONSTRAINTS
- Files you may touch: backend/src/modules/messages/messages.routes.js,
  backend/src/modules/messages/messages.controller.js,
  backend/src/modules/products/products.routes.js,
  backend/src/modules/products/products.controller.js,
  backend/API.md, docs/CHANGELOG.md.
- Do NOT touch backend/src/app.js, backend/src/middleware/,
  backend/src/config/, or backend/src/utils/. They are frozen.
- Do NOT touch any file under backend/src/modules/user/,
  social/, notifications/ or reports/. Those are Neeraj's.
- Do NOT change any route PATH. Both a web app and a mobile app call
  these URLs today.
- Do NOT add pagination. That is a separate block owned by Neeraj.
- Do NOT remove auth from GET /:userId/public in user.routes.js. It is
  deliberately public.
- If you find a tenth endpoint with the same problem, REPORT it at the
  end. Do not fix it.
```

## CC-V2 — Migration: inbox pagination

```
Phase 4, Block V-C. One migration. I own the database.

GOAL
get_user_inbox(p_user_id uuid) returns every conversation a student has,
with no limit and no cursor. Add cursor pagination to it.

WHAT TO DO
1. Run: supabase migration new inbox_pagination
2. In the new file, use CREATE OR REPLACE FUNCTION to redefine
   get_user_inbox with this signature:

   get_user_inbox(
     p_user_id uuid,
     p_limit   int         default 20,
     p_cursor  timestamptz default null
   )

3. Behaviour:
   - Order by the conversation's last message time, DESCENDING.
   - When p_cursor is null, return the newest p_limit conversations.
   - When p_cursor is given, return conversations whose last message
     time is strictly less than p_cursor.
   - Cap p_limit at 50 inside the function. Floor it at 1. A caller
     asking for 100000 gets 50; asking for 0 or -1 gets 1.
4. Keep the existing return columns EXACTLY as they are. The web and the
   mobile inbox both read them by name. Read the current definition
   first and preserve every column and its type.
5. Preserve the existing SECURITY setting and the pinned search_path.
   Do not change the function from invoker to definer or the other way
   round. If it is currently SECURITY INVOKER, it stays invoker.
6. Do NOT change the JavaScript controller. Neeraj owns that change and
   will do it in his own block.

RULES FROM docs/YAHORA_BUILD_PLAN.md §3.1 THAT APPLY
- One migration, one idea. This file changes one function and nothing
  else.
- Never edit a migration that has already been applied.
- A migration that passes on an empty local database can fail on
  production. Say explicitly in your response whether anything here
  could fail against existing rows.

AFTER WRITING IT
Run: supabase db reset
Confirm it replays cleanly. Then show me a SQL snippet I can paste into
Studio to verify the limit and the cursor both work against seeded data.
Do NOT run supabase db push — I run anything that touches production.

HARD CONSTRAINTS
- Create exactly ONE new file under supabase/migrations/.
- Do NOT modify any existing migration file.
- Do NOT touch backend/, frontend/ or mobile/.
- Do NOT run supabase db push.
- Update docs/CHANGELOG.md with the migration under
  "### Migrations applied" so Neeraj knows it exists.
```

## CC-V3 — Mobile onboarding: username and password

```
Phase 4, Block V-B. Mobile app. This fixes a flow that is currently
broken in production.

THE BUG
POST /api/auth/onboarding requires `username` and `password` in the body.
Read backend/src/modules/auth/auth.controller.js -> completeOnboarding
to confirm. mobile/app/(auth)/onboarding.tsx sends neither, so a new
student gets 400 INVALID_FORMAT and cannot finish signing up. There is no
workaround inside the app.

THE REFERENCE
frontend/src/pages/onboarding/onboarding.jsx does all of this already on
web. Read it, especially lines 256-275 (state) and 338-430 (the debounced
availability check and the suggestions fetch). Mirror its BEHAVIOUR.
Do not try to port its code — React Native has no DOM and this project
styles with StyleSheet, not CSS modules.

WHAT TO BUILD

1. A username field.
   - Lowercase the input silently as the student types. Do not show an
     error for typing a capital letter; just fold it.
   - Debounce 400ms, then GET
     /api/users/username-available?username=<handle>
   - Use a monotonically increasing request id and ignore any response
     that is not the newest. Two requests can be in flight after a
     type-pause-type, and the slower one must not overwrite the faster.
   - Show three states: checking, available, taken. Use colors.successText
     and colors.errorText from src/theme.
   - Rules to enforce client-side before even sending the request:
     ^[a-z][a-z0-9._-]*$, 3-25 characters, and no two separators in a
     row (so rahul..sharma and rahul._sharma are both invalid, but
     rah.ul.sharma is fine).

2. Three tappable username suggestions.
   - Debounce 400ms on the full_name field, then GET
     /api/users/username-suggestions?name=<name>
   - Tapping one fills the username field and re-runs the availability
     check.

3. A password field and a confirm field.
   - secureTextEntry, with a show/hide toggle on each.
   - Minimum 8 characters, checked client-side before submit.
   - The two must match, checked client-side before submit.
   - Do NOT set contextMenuHidden. Paste must work — blocking it breaks
     password managers.

4. Wire them into the submit.
   - Add `username` and `password` to the body posted to
     /api/auth/onboarding.
   - On any server error, KEEP what the student typed in every field.
     Do not clear the form.
   - The backend can return WEAK_PASSWORD, COMMON_PASSWORD,
     INVALID_FORMAT and USERNAME_TAKEN. Map each to a readable sentence.
     Today mobile/src/lib/api.ts surfaces the raw `error` code as the
     message, so without this mapping the student literally sees the text
     "WEAK_PASSWORD".

5. Put the two inputs in reusable components under mobile/src/components/
   (UsernameField.tsx and PasswordField.tsx). Block V-D needs the
   password one again on the login screen.

STYLE
- Colours and spacing ONLY from mobile/src/theme. No new hex values.
  Build plan rule 13.
- Match the existing visual language of the screen: the same input
  styling, the same focus border, the same error box.

HARD CONSTRAINTS
- Files you may touch: mobile/app/(auth)/onboarding.tsx, new files under
  mobile/src/components/, and mobile/src/types/ if a type needs adding.
- Do NOT touch backend/ or frontend/. The endpoints already exist and
  are correct.
- Do NOT touch mobile/app/(auth)/login.tsx. That is a separate block.
- Do NOT add a new colour to mobile/src/theme.
- Do NOT persist the password anywhere — not AsyncStorage, not state
  that outlives the screen, not a log line. Build plan rule 14.
- Do NOT change the OTP flow or the routing guard.
- Run `npx tsc --noEmit` in mobile/ when you are done and fix any type
  errors you introduced.
- Report at the end: anything in the web version you deliberately did
  NOT mirror, and why.
```

## CC-V4 — Mobile password login tab

```
Phase 4, Block V-D. Mobile app.

GOAL
mobile/app/(auth)/login.tsx is OTP-only. Its state is
`type Step = 'email' | 'otp'`. Add a second way in: username/email and
password, as a tabbed interface, mirroring the web.

THE REFERENCE
frontend/src/pages/auth/Auth.jsx. Read the tab switcher around line 611
and handlePasswordLogin around line 486. Mirror the behaviour.

THE ENDPOINT
POST /api/auth/login-password with body { identifier, password }.
Read the contract in backend/API.md before you start. It returns the
SAME response shape as verify-otp -- { message, session, userAuth,
userProfile } -- deliberately, so you can reuse the existing storage
path in AuthContext rather than writing a second one.

WHAT TO BUILD

1. Two tabs at the top of the card: "College Email & OTP" and
   "Username & Password".
   - The OTP tab is exactly what exists today. Do not change its
     behaviour, its Turnstile handling, or its copy.
   - Remember the selected tab in AsyncStorage so reopening the app
     returns to the tab they used last. The web does this with
     sessionStorage under the key yahora_auth_tab.

2. Add loginWithPassword to mobile/src/contexts/AuthContext.tsx.
   - Follow the exact shape of the existing verifyOtp function:
     post, then supabase.auth.setSession(), then saveProfile(),
     then setDemoFlag(false) and setSkippedFlag(false).
   - Return the userProfile, same as verifyOtp does.

3. The password form.
   - One field for the identifier, accepting a username OR an email.
     Trim it. Do not validate it as an email — a username is valid here.
   - Reuse PasswordField.tsx from Block V-B.
   - Submit button disabled while the request is in flight.

4. Error handling. This part is a security requirement, not a
   preference.
   - EVERY failure shows exactly this string, with no variation:
     "Incorrect username or password. Please try again."
   - Do not branch on the reason. The API deliberately returns one
     identical response for wrong password, unknown username, unknown
     email, and an account with no password set. Branching on it would
     let anyone test whether a specific classmate is on Yahora.
   - EXCEPTION: a 429 TOO_MANY_ATTEMPTS is different and should be
     shown as such. Read retry_after_seconds from the body, show a
     live countdown, and keep the submit button disabled until it hits
     zero. Reuse the countdown pattern already in this file for the OTP
     cooldown if there is one.
   - EXCEPTION: check `fromApi` on the thrown ApiError before
     translating any status code. mobile/src/lib/api.ts sets it. A 403
     from a proxy or from the macOS AirPlay Receiver is not a statement
     about this student, and this exact bug has already cost us a day
     once. If fromApi is false, show
     "Could not reach the Yahora server. Please try again."

5. Permanent helper text under the password form. Always visible, not an
   error, not conditional:
     "New to Yahora? Use the College Email & OTP tab to create your
      account."

6. Turnstile stays on the OTP tab ONLY. login-password does not accept a
   captcha token. Do not render the widget on the password tab.

STYLE
- Colours and spacing only from mobile/src/theme.
- Match the existing card, input and error-box styling in this file.

HARD CONSTRAINTS
- Files you may touch: mobile/app/(auth)/login.tsx,
  mobile/src/contexts/AuthContext.tsx, and existing components under
  mobile/src/components/.
- Do NOT touch backend/ or frontend/.
- Do NOT change the OTP flow, the Turnstile component, or the routing
  guard in mobile/app/_layout.tsx.
- Do NOT persist the password to AsyncStorage or log it anywhere. Not
  even in a dev-only console.log. Build plan rule 14.
- Do NOT add a PASSWORD_NOT_SET branch. That code does not exist in this
  API and adding a client branch for it would be a security regression.
- Run `npx tsc --noEmit` in mobile/ and fix any type errors you
  introduced.
- Report at the end: every distinct error state you implemented and the
  exact string shown for each, so I can check them against API.md.
```

---

# TRACK 3 — NEERAJ, MANUAL STEPS

You have four blocks. N-A is housekeeping on Day 1 while Vishwajeet's security fix is
in flight. N-B and N-C are the backend pagination. N-D is the human testing, and it is
the biggest single block in this phase — nearly everything that needs a person to look
at a screen is yours.

## Block N-0 — Setup (20 minutes)

Your branch is **7 commits behind `main`**, and those seven commits are all of Phase 3.
If you start without pulling, you build Phase 4 against a Phase 2 codebase and nothing
will make sense.

```bash
cd ~/path/to/yahora
git checkout main
git pull origin main
git checkout neeraj
git merge main
git push origin neeraj
```

Then install, because Phase 3 may have added dependencies:

```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

**👁️ CHECKPOINT N-0.**

1. Confirm the merge brought Phase 3 in:

```bash
git log --oneline -5
```

You should see `bbe2263 security holes, CORS, universities, mobile CAPTCHA, small fixes`
in the history. If you do not, the merge did not work — stop and say so.

2. Confirm your `frontend/.env` has `VITE_API_PORT=5001`, not 5000. On a Mac, port
   5000 is held by the AirPlay Receiver, which answers every request with a bodiless
   `403 Forbidden`. That 403 is a real HTTP response, so the app reports it as an
   application error and it reads like a database problem. This already cost a day
   once.

```bash
grep VITE_API_PORT frontend/.env
```

3. Start the backend and the site, and confirm the site loads:

```bash
cd backend && npm run dev     # one terminal
cd frontend && npm run dev    # another terminal
```

Open `http://localhost:5173`. If it loads and you can see listings, you are set up.

## Block N-A — Housekeeping (half a day, Day 1)

Four small things. None are hard; all of them cost somebody a day later if skipped.

Run prompt **CC-N1** from Track 4.

**What it covers:**

1. **`frontend/.env.example` still says `VITE_API_PORT=5000`.** The 12 September
   CHANGELOG entry asked for this under a heading reading "🔴 Neeraj — one thing for
   you". Your own `.env` is already on 5001 so nothing is broken for you today, but
   the next fresh clone hits the AirPlay 403 immediately.

2. **`docs/CURRENT_STATE.md` is dated 25 August and is wrong in two directions.** It
   lists 8 migrations when there are 14. It calls `PUT /api/users/:userId/profile`
   "the worst remaining hole in the backend" when you fixed it in Phase 3. Both of
   your Claude Code sessions read this file at the start of every session, so it is
   actively misleading both of you right now.

3. **There is no Phase 3 handoff entry in `docs/CHANGELOG.md`.** Phase 3 shipped. It
   was never written down. Your own rule says *"Files are the shared memory. Chat
   history is not."*

4. **Write down the ownership loan** (§0.8). In three months somebody will read a diff
   showing you editing `products.controller.js` and conclude the ownership map is dead.
   One paragraph in the CHANGELOG prevents that.

**👁️ CHECKPOINT N-A.** Read the rewritten `docs/CURRENT_STATE.md` yourself, top to
bottom, before committing. Claude Code can update the facts it can verify from the
repo, but only you and Vishwajeet know which of the "known open issues" you actually
closed in Phase 3. Three specific things to confirm:

- The migration table lists 14 files, ending at `universities_expansion`.
- Issue 1 (`PUT /api/users/:userId/profile`) has moved to "Recently resolved".
- Issues 2 (unauthenticated writes) and 4 (no pagination) are still listed as open,
  because Vishwajeet's V-A and your N-B/N-C are what close them — and on Day 1 they
  are not closed yet.

## Block N-B — Pagination: products feed and comments (Day 2)

**Do not start this until Vishwajeet's V-A is merged into `main`.** You are editing the
same two files he is, and the only thing keeping that safe is that he goes first and
you touch different functions. Pull before you start:

```bash
git checkout neeraj
git merge main
```

Run prompt **CC-N2**.

**What you are building.** `GET /api/products` currently returns every listing on the
campus in one response. Add `limit` and `cursor` to it, plus the comments list inside
`GET /api/products/:id`.

**Read PART 1 §1.2 and §1.3 first** if you have not. The whole reason for cursors
rather than page numbers is in there with a worked example, and you will make better
decisions in the code review if you know why.

**Backward compatibility is the requirement that matters most.** The web app and the
mobile app both call `GET /api/products` today, sending no `limit` and no `cursor`.
After your change they must still work. That means:

- `limit` optional, defaulting to 20.
- `cursor` optional, defaulting to "start from the newest".
- The response gains `next_cursor`. Existing clients ignore a key they do not read.

But note this is still a **BREAKING** change in one specific sense, and it has to be
written up as one: a client that today receives all 60 listings will tomorrow receive
20. If you deploy the backend before the web app can page, the marketplace silently
shows fewer items. Which is why §2.3 puts your web work in Phase 5 and not this week.

**👁️ CHECKPOINT N-B.** Three checks, in the browser, against your local backend.

1. Ask for a small page and confirm the envelope:

```
http://localhost:5001/api/products?limit=2
```

You should get `{ "items": [ ... 2 items ... ], "next_cursor": "2026-..." }`.

2. Take that `next_cursor` value and paste it back:

```
http://localhost:5001/api/products?limit=2&cursor=<paste it here>
```

The two items you get back must be **different** from the first two. If they are the
same, the cursor is not being applied.

3. The one that matters most — confirm you did not break the existing clients:

```
http://localhost:5001/api/products
```

with no query string at all. Then open `http://localhost:5173/marketplace` in the
browser and confirm the marketplace still renders listings. If it renders, an existing
client survived the change.

## Block N-C — Pagination: inbox, chat history, user search (Day 3)

**Prerequisite:** Vishwajeet's V-C migration must be pushed and you must have pulled
it. Check `docs/CHANGELOG.md` for the `inbox_pagination` migration under "Migrations
applied", then:

```bash
git merge main
supabase db reset     # replays all migrations including the new one
```

Run prompt **CC-N3**.

**Read PART 1 §1.5 before you start.** Chat history is the trickiest single thing in
this phase. It renders oldest-first but pages backwards, so the query runs descending
and the result is reversed before it is sent. If that sentence does not yet make
sense, read §1.5 — it has the six-message worked example.

Three endpoints, three different shapes:

| Endpoint | Shape |
|---|---|
| `GET /api/messages/inbox/:userId` | Calls the RPC. Pass `p_limit` and `p_cursor` through. The RPC does the work |
| `GET /api/messages/history` | Query descending, **reverse before sending** |
| `GET /api/users/search` | Exempt from cursors (§0.8): fixed top-N, `next_cursor` always `null`. Rename the key from `users` to `items` |

**The search rename is a real breaking change and it is yours on both sides.**
`frontend/` currently reads `data.users`. If you change the backend key without
changing the web, user search breaks on the live site. Both changes go in the same
commit.

**👁️ CHECKPOINT N-C.** Four checks.

1. Inbox paging, in the browser with a valid token, or in Postman:

```
GET http://localhost:5001/api/messages/inbox/<your-user-id>?limit=1
```

Then feed `next_cursor` back and confirm you get a *different* conversation.

2. **Chat history direction — this is the important one.** Open a seeded conversation
   with `limit=3`:

```
GET http://localhost:5001/api/messages/history?userA=<id>&userB=<id>&limit=3
```

Look at the `created_at` of the three items. They must be in **ascending** order —
oldest first — because that is what the chat UI renders. And they must be the
**three newest** messages in the thread, because that is what you see when a chat
opens.

If you get the three *oldest* messages in the thread, the reverse step is missing.

3. Feed the `next_cursor` back. You should get three **older** messages, still in
   ascending order.

4. 👁️ Open `http://localhost:5173/messages` in the browser and send a message to
   another account. Confirm the chat still loads and the new message appears. Realtime
   delivery must not have regressed.

## Block N-D — Human testing (Days 4 and 5)

This is the block that needs a person, and it is the largest one in the phase. Nothing
here can be checked by Claude Code, because every item is "does a human, holding a
phone, end up in the right place".

**Setup.** Vishwajeet runs the Expo server on his Mac:

```bash
cd mobile && npx expo start
```

You scan the QR with **Expo Go 56.0.0** on your OPPO K14, on the same Wi-Fi. Not
56.0.1 — that version is broken for SDK 56 on Android.

Test against the **local** backend, not production. That way you can create as many
accounts as you like without burning OTP quota, and Vishwajeet can read every OTP from
Mailpit at `http://127.0.0.1:54324`.

### N-D.1 👁️ New student signup, end to end — the §0.2 bug

This is the flow that is broken today. It is the single most important test in the
phase.

Use an email that has never been used before, on an active domain, e.g.
`neeraj.test.01@iiitk.ac.in`.

| # | Step | Expected |
|---|---|---|
| 1 | Enter the email, pass the Turnstile check, tap Send Code | A message saying the code was sent, naming the university |
| 2 | Vishwajeet reads the OTP from Mailpit and gives it to you | 6 digits, not 8 |
| 3 | Enter it | You land on the onboarding screen |
| 4 | Fill name, qualification, course, year, specialization | Fields accept input |
| 5 | **A username field is present** | It is there. Before this phase it was not |
| 6 | **Password and confirm fields are present** | They are there |
| 7 | Fill everything and submit | **You reach the marketplace** |

**Step 7 is the whole point of Phase 4.** Before this phase it fails with a red box
reading `INVALID_FORMAT`.

### N-D.2 👁️ Username field behaviour

| # | Check | Expected |
|---|---|---|
| 1 | Type `RAHUL` | It becomes `rahul` on screen as you type. No error about capitals |
| 2 | Type a username you know is taken (use a seeded one) | It says taken, in red, within about half a second of you stopping |
| 3 | Type a fresh one | It says available, in green |
| 4 | Type `ab` (2 characters) | Rejected — minimum is 3 |
| 5 | Type `1rahul` | Rejected — must start with a letter |
| 6 | Type `rahul..sharma` | Rejected — no two separators in a row |
| 7 | Type `rahul._sharma` | Rejected — same rule, different pair. This one is easy to miss |
| 8 | Type `rah.ul.sharma` | **Accepted.** Separators are fine, just not adjacent |
| 9 | Type quickly, then stop | The status should settle on the **final** thing you typed, not flicker back to an earlier answer |
| 10 | Tap a suggested username | It fills the field and re-checks availability |

Item 9 is testing the out-of-order response guard. If the status ends up showing the
answer for a prefix you typed three keystrokes ago, that guard is missing.

### N-D.3 👁️ Password field behaviour

| # | Check | Expected |
|---|---|---|
| 1 | Type 7 characters | Rejected — minimum is 8 |
| 2 | Make the two fields differ | Rejected — they must match |
| 3 | Tap the show/hide toggle | The characters become visible, and hide again |
| 4 | Long-press the field and paste something | **Paste works.** If it is blocked, that is a bug |
| 5 | Use `password` as the password | Rejected — it is on the common-password list |
| 6 | Make the password the same as the username | Rejected |
| 7 | Trigger any server rejection | **Everything you typed is still there.** Nothing is cleared |

Item 7 is the one people forget to check and the one users hate most.

### N-D.4 👁️ Password login

Sign out, then log back in.

| # | Check | Expected |
|---|---|---|
| 1 | Two tabs are visible | "College Email & OTP" and "Username & Password" |
| 2 | Log in with the username and password you just set | You reach the marketplace |
| 3 | Log in with the **email** and the same password | Also works — the identifier accepts either |
| 4 | Wrong password | "Incorrect username or password. Please try again." |
| 5 | A username that does not exist | **Exactly the same sentence.** Character for character |
| 6 | An email that does not exist | **Exactly the same sentence again** |
| 7 | Helper text is under the form | "New to Yahora? Use the College Email & OTP tab..." — visible **before** you make any mistake, not after |
| 8 | Turnstile is on the OTP tab only | No captcha widget on the password tab |
| 9 | Close the app and reopen it | It returns to the tab you last used |

**Checks 4, 5 and 6 are a security requirement, not polish.** If the three strings
differ in any way — even a full stop — anyone can type a classmate's name and learn
whether they are on Yahora. Compare them carefully. If they differ, that is a blocker,
not a nitpick.

### N-D.5 👁️ Lockout

| # | Check | Expected |
|---|---|---|
| 1 | Get the password wrong 10 times for the same identifier | The 11th attempt returns a "too many attempts" message with a countdown |
| 2 | Watch the countdown | It ticks down, and the submit button stays disabled until it reaches zero |
| 3 | Try the same identifier with different capitalisation (`Rahul` vs `rahul`) | **Still locked.** The server trims and lowercases, so it is the same lock |

Check 3 matters: if changing the capitalisation resets the lock, the rate limiter is
trivially bypassed.

### N-D.6 👁️ Both phones, and nothing regressed

Everything above on your OPPO K14. Then the shortlist on Vishwajeet's POCO X2:
N-D.1 (new signup) and N-D.4 (password login). Two different Android versions catch
layout bugs that one device never will.

Then confirm Phase 3 still works:

| # | Check | Expected |
|---|---|---|
| 1 | OTP login with an existing account | Still works. You have not broken the old path |
| 2 | "Explore Live Demo" | Still works |
| 3 | Marketplace loads, swipe deck works, campus switcher works | Unchanged |
| 4 | Open a chat and send a message | Delivered, and appears on the other device |
| 5 | Web site: log in, browse the marketplace, open messages | Unchanged |

### N-D.7 👁️ Pagination, from the user's side

Backend pagination is invisible if nothing has more than 20 rows. Ask Vishwajeet for
the production row counts first. If no campus has more than 20 listings, say so in the
sign-off — that is a real result and it means the protection is in place for later
rather than changing anything today.

If any list **does** exceed the limit:

| # | Check | Expected |
|---|---|---|
| 1 | Open the marketplace on web and on mobile | Listings appear. They may be capped at 20 — that is correct for this phase |
| 2 | Open a long chat | The most recent messages are there, and they are the ones you expect to see when a chat opens |
| 3 | Open a product with many comments | Comments render |

Nothing here should show a duplicate or a gap. If you see the same listing twice,
stop and report it — that is the exact failure mode cursors exist to prevent.

---

# TRACK 4 — NEERAJ, CLAUDE CODE PROMPTS

Start every session with the standard opener:

```
Before we start: read CLAUDE.md, docs/CHANGELOG.md, backend/API.md,
and docs/CURRENT_STATE.md. Summarise in 5 bullets what changed most
recently and what I should be careful about.
```

## CC-N1 — Housekeeping and documentation

```
Phase 4, Block N-A. Four small tasks, no feature work.

TASK 1 — frontend/.env.example
It still has VITE_API_PORT=5000. Change it to 5001. On macOS the AirPlay
Receiver holds port 5000 and answers every request with a bodiless 403,
so the next fresh clone hits it immediately. The 2026-09-12 CHANGELOG
entry asked for this.

TASK 2 — rewrite docs/CURRENT_STATE.md
It is dated 25 August and is now wrong in both directions. Verify every
claim against the repo as it stands and rewrite it. Specifically:

  - The migration table lists 8 files. There are 14 in
    supabase/migrations/. List all 14.
  - "Known open issue 1", PUT /api/users/:userId/profile having no
    requireAuth, is FIXED. user.routes.js has requireAuth and
    user.controller.js -> updateProfile takes req.user.id and runs the
    body through pickAllowedProfileFields. Move it to "Recently
    resolved".
  - "Known open issue 2", unauthenticated writes: the user module part
    is fixed. The products and messages part is NOT. Re-verify against
    products.routes.js and messages.routes.js and list exactly which
    endpoints are still open today.
  - "Known open issue 4", no pagination: re-run the check. Report the
    actual number of .range() call sites you find.
  - Anything you cannot verify from the repo (production row counts,
    whether local and production match) must be marked
    [not re-verified] rather than carried over as fact.

  Put today's date at the top and say what it supersedes, matching the
  style of the existing file.

TASK 3 — the missing Phase 3 handoff entry
docs/CHANGELOG.md has no entry for Phase 3. Its newest entries are
2026-09-12 (the port change) and 2026-09-08 (Phase 2). Reconstruct a
Phase 3 entry from the actual commits and the diff:

  git log --oneline main -15
  git show bbe2263 --stat

Use the six-section template at the top of CHANGELOG.md: Migrations
applied / New endpoints / Changed endpoints (BREAKING) / New fields on
existing responses / Test data / What NOT to do yet.

Mark it clearly as reconstructed after the fact, with today's date, so
nobody reads it as a contemporaneous record.

TASK 4 — record the ownership loan
Add a short CHANGELOG entry saying that for Phase 4 only, Neeraj writes
the cursor pagination in the READ handlers of
backend/src/modules/products/ and backend/src/modules/messages/, even
though backend/CLAUDE.md lists those modules as Vishwajeet's. State
that Vishwajeet reviews the PRs (build plan rule 10), that Vishwajeet's
Block V-A lands first so the two of us are never in the same file on the
same day, and that the ownership map is unchanged from Phase 5 onward.

HARD CONSTRAINTS
- Files you may touch: frontend/.env.example, docs/CURRENT_STATE.md,
  docs/CHANGELOG.md.
- Do NOT touch any file under backend/src/ or mobile/.
- Do NOT touch frontend/.env — only the .example file.
- Do NOT invent facts for CURRENT_STATE.md. If you cannot verify
  something from the repository, mark it [not re-verified]. A
  verification document that states something it did not check is worse
  than no document.
- Report at the end: every claim in the OLD CURRENT_STATE.md that you
  could not verify either way, so a human can decide.
```

## CC-N2 — Pagination: products feed and comments

```
Phase 4, Block N-B. Cursor pagination on two lists.

OWNERSHIP NOTE
backend/src/modules/products/ is normally Vishwajeet's. For Phase 4 only,
I have his agreement to add pagination to the READ handlers. See the
ownership-loan entry in docs/CHANGELOG.md. I touch read handlers only.

CONTEXT
.range() has zero call sites in this repo. Every list endpoint returns
every matching row. sendPage() already exists in
backend/src/utils/respond.js and produces { items, next_cursor }. Use it.
It is frozen infrastructure -- import it, never edit it, never write a
parallel version.

DECISION ALREADY MADE
Every list response uses the key "items", not a named key. Do not emit
{ products: [...] }.

WHAT TO DO

1. GET /api/products (getProducts)
   - Accept optional `limit` and `cursor` query parameters.
   - limit: default 20, cap at 50, floor at 1. Parse defensively --
     limit=abc, limit=0, limit=-1 and limit=100000 must all land
     somewhere sane. Copy the parsing already in
     user.controller.js -> searchUsers; it does exactly this.
   - The feed is ordered .order('created_at', { ascending: false }).
     The cursor is a created_at timestamp. Apply
     .lt('created_at', cursor) when a cursor is present.
   - Return via sendPage(res, items, 'created_at', limit).
   - A plain timestamp cursor is fine here; listings are created by
     humans pressing a button, so identical timestamps are not a
     realistic concern.

2. The comments list inside GET /api/products/:id (getProductById)
   - Same limit and cursor handling.
   - Comments here ARE bulk-inserted by seed scripts, so identical
     created_at values are realistic. Use a compound cursor:
     order by created_at DESC, id DESC, and filter with
     .or(`created_at.lt.${t},and(created_at.eq.${t},id.lt.${id})`)
   - Encode the compound cursor as a single opaque string so the client
     never has to assemble one. Base64 of `${created_at}|${id}` is fine.
     Decode defensively: a malformed cursor is a 400 INVALID_FORMAT, not
     a 500.
   - Preserve the existing threading. Parent comments and their replies
     must still arrive in a shape the clients already render. Read how
     the response is built before you change it, and say in your reply
     what you did about replies to a parent that fell off the page.

BACKWARD COMPATIBILITY -- THIS IS THE REQUIREMENT THAT MATTERS MOST
The web app and the mobile app both call GET /api/products today with no
limit and no cursor. After this change they must still work.
  - limit optional.
  - cursor optional.
  - next_cursor is additive; existing clients ignore it.
Do not make either parameter required. Do not change the shape of an
individual item.

ALSO REQUIRED
- Update backend/API.md for both endpoints: the query parameters, the
  response envelope, the cap, and the cursor type.
- Add a docs/CHANGELOG.md entry with the six-section template. The
  "Changed endpoints (BREAKING)" section must say plainly that a client
  which used to receive every listing now receives 20 by default, and
  that the clients gain infinite scroll in Phase 5.

HARD CONSTRAINTS
- Files you may touch: backend/src/modules/products/products.controller.js,
  backend/API.md, docs/CHANGELOG.md.
- Do NOT touch products.routes.js. No route paths change.
- Do NOT touch the WRITE handlers in this file: createProduct,
  updateProduct, deleteProduct, addComment, toggleCommentVote,
  toggleLikeProduct, toggleSaveProduct, markProductAsSold,
  markProductAsAvailable. Vishwajeet changed those this week in Block
  V-A and I must not collide with him.
- Do NOT touch backend/src/utils/respond.js. Import sendPage; do not
  modify it.
- Do NOT touch backend/src/modules/messages/. That is a separate block.
- Do NOT use .range() with offsets, LIMIT/OFFSET, or page numbers.
  Cursors only.
- Do NOT touch frontend/ or mobile/. Clients get infinite scroll in
  Phase 5.
- Report at the end: the exact cursor type for each endpoint, and what
  happens when a client sends a cursor that cannot be decoded.
```

## CC-N3 — Pagination: inbox, chat history, user search

```
Phase 4, Block N-C. Three lists, three different shapes. Read all of
this before starting -- the second one is the tricky one.

OWNERSHIP NOTE
backend/src/modules/messages/ is normally Vishwajeet's. Phase 4 ownership
loan, read handlers only. See docs/CHANGELOG.md.

PREREQUISITE
Vishwajeet has pushed a migration adding p_limit and p_cursor to the
get_user_inbox RPC. Confirm it exists before you start:
  grep -rn "get_user_inbox" supabase/migrations/ | tail -2
If the newest definition does not take three parameters, STOP and tell
me. Do not write a workaround in JavaScript.

DECISIONS ALREADY MADE
- Every list uses the key "items".
- User search is EXEMPT from cursor pagination. Fixed top-N,
  next_cursor always null. Reason: search_users() orders by an exact-
  match flag, then same-campus, then a trigram similarity rank. None of
  those can be seeked into by an index.

ENDPOINT 1 -- GET /api/messages/inbox/:userId (getInbox)
Straightforward. The RPC does the work now.
  - Accept optional limit (default 20, cap 50, floor 1) and cursor.
  - Pass them through as p_limit and p_cursor.
  - Return via sendPage. The RPC orders by last message time descending,
    so the cursor field is that column -- read the migration to get its
    exact name rather than guessing.

ENDPOINT 2 -- GET /api/messages/history (getChatHistory)
READ THIS TWICE. This is the one that goes wrong.

The chat UI renders OLDEST FIRST. The current query is
.order('created_at', { ascending: true }) and that is correct for
rendering.

But paging goes the OTHER WAY. When a chat opens you see the NEWEST
messages. Scrolling UP loads OLDER ones. So:

  1. Query DESCENDING: .order('created_at', { ascending: false })
     with .lt('created_at', cursor) when a cursor is present.
  2. Take `limit` rows.
  3. REVERSE the array before sending it, so the client still receives
     oldest-first and its rendering loop does not change at all.
  4. next_cursor is the created_at of the OLDEST message on the page --
     which after the reverse is items[0], not the last element.

     WARNING: sendPage() computes next_cursor from the LAST element.
     After reversing, that is the NEWEST message and it is WRONG.
     Compute next_cursor yourself from the pre-reverse data and return
     { items, next_cursor } directly with res.json(). Do not edit
     sendPage -- it is frozen and correct for descending lists.
     Say clearly in your reply that you did this and why.

  5. Messages ARE bulk-inserted by seed scripts, so use a compound
     cursor on (created_at, id), same encoding as the comments list.

  6. Keep the existing participation check and requireAuth exactly as
     they are. GET /history already verifies that req.user.id is one of
     the two parties. Do not weaken, move, or reorder that check.

ENDPOINT 3 -- GET /api/users/search (searchUsers)
  - Keep the existing limit parsing. It already caps and floors
    correctly.
  - Do NOT add a cursor parameter.
  - Change the response key from { users: [...] } to
    { items: [...], next_cursor: null }.
  - This is a BREAKING change. frontend/ reads data.users today. Find
    every read of it and update it in the SAME commit:
      grep -rn "\.users" frontend/src/ | grep -i search
  - Add one sentence to backend/API.md explaining WHY search is exempt,
    so the next person does not read it as an oversight. API.md line
    ~1730 already flags this as an open question -- resolve it there.

ALSO REQUIRED
- Update backend/API.md for all three endpoints.
- docs/CHANGELOG.md entry, six-section template. The search key rename
  goes under "Changed endpoints (BREAKING)".

HARD CONSTRAINTS
- Files you may touch:
  backend/src/modules/messages/messages.controller.js,
  backend/src/modules/user/user.controller.js,
  backend/API.md, docs/CHANGELOG.md, and the frontend/ files that read
  the search response key.
- Do NOT touch messages.routes.js. No route paths change.
- Do NOT touch the WRITE handlers in messages.controller.js:
  sendMessage, markAsRead, markAsDelivered. Vishwajeet changed those in
  Block V-A.
- Do NOT touch backend/src/utils/respond.js.
- Do NOT write any SQL or create any migration. I never write SQL --
  if the database needs a change, stop and tell me and I will file a
  migration request in docs/CHANGELOG.md for Vishwajeet.
- Do NOT touch mobile/.
- Do NOT change the participation check or requireAuth on
  GET /history.
- Report at the end, explicitly: (a) that you reversed the chat page
  and how you computed next_cursor, (b) every frontend file you changed
  for the search rename.
```

---

# SIGN-OFF

Go through this together, out loud, at the end of Day 5. One person reads, the other
confirms. If any line cannot be confirmed, it goes into Phase 5 with a name against it
rather than being quietly assumed.

## The flow that was broken

- [ ] 👁️ A brand-new student can sign up on Android and reach the marketplace.
- [ ] 👁️ That same student can sign out and log back in with username and password.
- [ ] 👁️ They can also log in with their **email** and that password.
- [ ] 👁️ Verified on both the OPPO K14 and the POCO X2.

## Security

- [ ] 👁️ The `curl` from checkpoint V-A returns `401`, not `201`.
- [ ] All nine endpoints from §0.3 have `requireAuth` and take `req.user.id`.
- [ ] 👁️ Wrong password, unknown username and unknown email produce **byte-identical**
      messages on the mobile login screen. Somebody actually compared them.
- [ ] No password is written to AsyncStorage, to a log, or to any persisted state.
- [ ] `GET /api/user/:userId/public` is still unauthenticated, deliberately.

## Pagination

- [ ] All five list endpoints accept `limit` and `cursor`.
- [ ] `limit` is capped at 50 and floored at 1 on every one of them.
- [ ] Every one returns `{ items, next_cursor }`.
- [ ] 👁️ A client sending neither parameter still works — web marketplace and mobile
      both verified.
- [ ] 👁️ Chat history returns the **newest** messages on first load, in **ascending**
      order.
- [ ] User search returns `{ items, next_cursor: null }`, and the web reads the new key.
- [ ] 👁️ No list shows a duplicate or a gap while paging.

## Database

- [ ] The `inbox_pagination` migration is applied to **both** local and production.
- [ ] `schema-drift.mjs` reports MATCH on every line.
- [ ] No migration file that was already applied has been edited.

## Documentation — the part that gets skipped

- [ ] `backend/API.md` matches the code for all eight endpoints touched this phase.
- [ ] `docs/CHANGELOG.md` has a handoff entry from **each** of you.
- [ ] `docs/CURRENT_STATE.md` is rewritten, dated today, and read by a human.
- [ ] The reconstructed Phase 3 entry is in the CHANGELOG, marked as reconstructed.
- [ ] The ownership loan is written down.
- [ ] The two open flags in `backend/API.md` (the `items`-vs-named-keys warning near
      line 66, and the search-pagination TODO near line 1730) are resolved **in the file**,
      not only in the code.
- [ ] `frontend/.env.example` says `VITE_API_PORT=5001`.

## Merged

- [ ] `infiniper` and `neeraj` are both merged into `main`.
- [ ] `main` is pushed.
- [ ] Both of you have pulled `main` and your branches are level with it.

**Do not skip that last group.** Phase 3 finished with `main` two commits behind and
all the work on a personal branch, and it was only caught because somebody wrote a
handover document. The same mistake this week puts Neeraj's Phase 5 on top of a Phase 3
codebase.

---

# APPENDIX — QUICK REFERENCE

**Local URLs**

| Service | URL |
|---|---|
| Supabase Studio | `http://127.0.0.1:54323` |
| Mailpit (catches every outgoing email) | `http://127.0.0.1:54324` |
| Supabase API | `http://127.0.0.1:54321` |
| Backend | `http://localhost:5001` |
| Website | `http://localhost:5173` |

**Commands**

```bash
supabase db reset                      # wipe, replay all migrations, run seed.sql
node backend/scripts/seedLocal.js      # test data in the real universities
node backend/scripts/seedDemo.js       # demo tenant data
supabase migration new <name>          # new migration file
supabase db push                       # apply to production — Vishwajeet only

cd mobile && npx expo start            # then Neeraj scans with Expo Go 56.0.0
ipconfig getifaddr en0                 # the LAN IP for EXPO_PUBLIC_API_URL
```

**Things that have already cost this project a day**

- Port 5000 on macOS is the AirPlay Receiver. It returns a bodiless 403. Use 5001.
- Expo Go 56.0.1 is broken for SDK 56 on Android. Use 56.0.0.
- `REVOKE ... FROM anon` does nothing without `FROM PUBLIC` as well.
- A migration that passes on an empty local database can fail on production.
- `localhost` on Neeraj's phone means *the phone*, not the Mac.

---

*End of Phase 4 runbook. Next: Phase 5 — pagination in the clients, plus mobile
navigation fixes.*
