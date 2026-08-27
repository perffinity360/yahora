# Phase 2 Runbook — Auth Hardening & Demo Data

**Version 2.0 — 25 August 2026.** Updated after reading your code at commit `ad36a6a`.

This replaces version 1.0. Nothing is renumbered, but several details changed because you built more than Phase 1 asked for.

---

# PART 0 — What I found in your repo

I read your code before rewriting this. Here is the honest picture.

## 0.1 You went further than the Phase 1 plan

Phase 1 asked for six migrations. You have **eight**, and the two extra ones are good work:

| File | What it is | In the Phase 1 plan? |
|---|---|---|
| `20260823140202_rls_stage2_users_messages.sql` | RLS on `users` and `messages` | Yes — Block G. **Done.** |
| `20260823055415_login_identity.sql` | `get_login_identity()` | **No. You added this yourselves.** |

That second one deserves a mention. You spotted that `get_login_email()` could only look a student up by their **username**, not their email. So the "this account has no password" check could never fire for the exact students it was written for — because a student who abandons onboarding has no username yet, and can *only* log in by email.

You found a real gap in my design and closed it. That is exactly the kind of thing that is hard to notice.

**One thing this changes for Phase 2:** the next migration number is **008**, not 007. Version 1.0 of this runbook said 007. That number is taken.

## 0.2 What is already built

I checked each of these directly in the code rather than assuming:

| Thing | Where | State |
|---|---|---|
| `POST /api/auth/login-password` | `auth.controller.js:624` | ✅ Built |
| `POST /api/auth/set-password` | `auth.controller.js:836` | ✅ Built |
| `GET /api/auth/password-status` | `auth.controller.js:962` | ✅ Built |
| `requireAuth` on onboarding | `auth.routes.js:37` | ✅ Fixed |
| Login rate limiting (`auth_attempts`) | `loginWithPassword` | ✅ Built |
| Auth page with two tabs | `frontend/src/pages/auth/Auth.jsx` | ✅ Built |
| A countdown timer for lockouts | `Auth.jsx` — `formatWait`, `lockoutSeconds` | ✅ Built |
| Username field on onboarding | `frontend/src/pages/onboarding/onboarding.jsx` | ✅ Built |

## 0.3 What Phase 2 still has to do

Also checked directly. None of these exist yet:

| Thing | Checked how | State |
|---|---|---|
| Rate limiting on `request-otp` | Read the whole function at `auth.controller.js:27` | ❌ None at all |
| `needs_password` in the login response | `grep -rn "needs_password"` across backend and frontend | ❌ Not found |
| Device ID in the browser | `grep -rn "deviceId\|X-Device"` across frontend | ❌ Not found |
| A set-password screen | Searched `frontend/src/pages/` | ❌ Does not exist |
| Cleanup job for unverified accounts | Read `backend/src/utils/cronJobs.js` | ❌ Only `cleanup_demo_users` runs |
| `seedDemo.js` safe for production | Read the guard at line 36 | ❌ Refuses any non-local database |

So Phase 2's scope is unchanged. Good — that means version 1.0 was aimed at the right things.

## 0.4 One small bug I found

This one is worth fixing and it is a five-minute job.

Open `frontend/src/pages/onboarding/onboarding.jsx` and look at **line 75**:

```js
invalid:
  "3–20 characters: lowercase letters, numbers, . or _ — not at the start, the end, or doubled.",
```

That sentence is shown to a student when their username is rejected. It describes the **old** rules — the ones from the first draft of Phase 1, before you changed them.

Here is what it gets wrong:

| The message says | The database actually says |
|---|---|
| 3–20 characters | 3–**25** characters |
| letters, numbers, `.` or `_` | letters, numbers, `.`, `_` **and `-`** |
| separators not at the end | a separator at the end is **fine** (`rahul.` works) |
| separators not doubled | doubled is **fine** (`rahul..s` works) |
| — | the first character must be a **letter** (`9rahul` fails) — not mentioned at all |

**Why this matters.** Imagine a student types `9rahul`. The server rejects it because it starts with a digit. But the message they see talks about dots and underscores. They have no idea what is actually wrong, so they cannot fix it. They will try `9_rahul`, `9.rahul`, and give up.

**Good news:** this is the *only* place the rules are duplicated. I searched the whole frontend for a validation regex and there isn't one. Your onboarding page sends the handle to the server and shows whatever reason comes back. That was the right decision — one set of rules, in one place. Only this help sentence drifted.

That fix is **N-Block C**, and it is genuinely one string.

---

# PART 1 — What Phase 2 does

Three jobs. No new features.

| # | Job | Why it matters | Who |
|---|---|---|---|
| 1 | Rate-limit the OTP endpoint | Right now anyone can create unlimited fake accounts | V (backend) + N (UI) |
| 2 | Give existing students a password path | 112 students in production have no password | V (backend) + N (UI) |
| 3 | Put demo data into the demo university on production | So investor demos show a full app | V |

**What Phase 2 does not do**, so you are not surprised:

- No `/username` profile pages — that is Phase 3
- No showing handles across the app — Phase 3
- No change-username screen, no user search — Phase 3
- No mobile app work at all — Phase 3

---

# PART 2 — The three decisions, explained

Please read this part before you start. Each decision changes what you build, and I would rather you understand *why* than just follow steps.

---

## 2.1 Why you cannot simply give someone a password

You asked a very reasonable question: *instead of deleting the old production users, why not just give them a username and a password?*

Let me take the two halves separately.

### Usernames — already solved

Phase 1's migration 006 already did this. It ran a loop over every user with `is_profile_complete = true` and gave each one a generated handle.

You can see it for yourself. Open your production dashboard, go to SQL Editor, and run:

```sql
select full_name, username from public.users
where username is not null
order by created_at
limit 20;
```

They have handles. That part is done.

### Passwords — here is the problem

You *can* set a password on someone's account. The code would work:

```js
await supabase.auth.admin.updateUserById(userId, { password: 'SomePassword123' });
```

But stop and think about what happens next.

**The student does not know that password.**

So you would have to tell them. And the only way you can reach them is email. Which means sending every student an email containing their password in plain text.

That is worse than having no password at all. Here is why:

- Emails are stored on a server, unencrypted, usually forever
- People read email on shared computers, library machines, a friend's phone
- Emails get forwarded, screenshotted, and backed up to cloud services
- If that inbox is ever breached — years later — the password is still sitting there

> ### The principle
>
> A password is only useful if **exactly one person knows it**.
>
> The moment you create one *for* somebody, one of two things is true: either they do not know it (so it is useless), or you had to send it to them (so it is unsafe).
>
> This is why no real website ever emails you a password. Think about it — when you forget a password, you get a **link** or a **code**. Never the password itself. Now you know why.

### So what do we do instead?

**We do not create a password for them. We ask them to create their own — at the first moment we have their attention.**

That moment is their next login. They will log in with email and OTP, because that still works for them. Right then, before they reach the dashboard, we show them one small screen.

Here is the flow, step by step:

```
1. Student opens the site and logs in with their college email + OTP
                    ↓
2. Backend checks two things about this student:
      is_profile_complete = true?    ✓  (they finished onboarding)
      has_password = false?          ✓  (but they never set a password)
                    ↓
3. Backend adds one field to the login response:
      "needs_password": true
                    ↓
4. The website sees that field and, instead of going to the dashboard,
   sends them to a small screen: "Set your password"
                    ↓
5. They type a password. It gets saved. has_password becomes true.
                    ↓
6. They land on the dashboard. They never see that screen again.
```

Nobody gets deleted. Nobody gets emailed a password.

### Should they be allowed to skip the screen?

**My recommendation: no.**

If you add a "skip" or "later" button, here is what happens in practice. A large number of students will click skip, every single time. Six months from now you still have two kinds of user — those with passwords and those without — and every new feature has to handle both.

It is one field and it takes ten seconds. If you make it required, the problem is completely gone within a few weeks of launch, and you never think about it again.

### One more thing to check first

Passwords might not be the only gap. Some of your production students signed up months ago, possibly before certain columns even existed.

So **Block A** starts with an audit — a few `SELECT` queries that count how many users are missing what. Run those before you build anything, because the answer changes how much this matters. If only 8 students need a password, this is a tiny job. If it is 400, you might want to think about announcing it.

---

## 2.2 Why "20 OTPs per machine" cannot use the IP address

Your rule was: 3 free attempts, then 1 minute between OTPs, then a hard limit of 20 per machine per day.

The rules themselves are sensible. The hard part is answering "which machine is this?", so let me walk through the options properly.

### First, what an IP address is

Every device on the internet has an address, so that replies know where to go. When a student's browser sends a request to your server, your server can see the address it came from. In Express, it is `req.ip`.

It is free. It requires nothing from the browser. So it looks like the obvious way to identify a machine.

### Why it would break your app

Here is the thing that catches everyone out.

Your college Wi-Fi does not give every student a public internet address. It has **one** address facing the internet, and every device on the campus network shares it. This is called **NAT** — Network Address Translation. The router keeps a private list of who asked for what, and translates on the way back.

You can see this yourself. Get two phones on the same Wi-Fi, open `whatismyip.com` on both. **Same address.** That is NAT.

Now apply your rule to that. Two thousand students at IIITDM Kurnool all arrive at your server looking like a single machine.

"20 OTPs per machine per day" then means:

> The first twenty students to log in each morning use up the entire campus's quota. Everybody else is locked out until tomorrow.

That is not an unlucky edge case. That is your app not working, every single day, at every college.

### What we use instead

Two limits that work in different ways. Each one catches something the other misses.

**Limit A — count by email address.**

This one is safe and it is your strongest signal. Why? Because a real student only ever asks for OTPs for **their own** email.

If someone requests 40 codes for `rahul@iiitk.ac.in`, only two things can be happening: a bug is looping, or someone is attacking Rahul's account. Blocking it cannot hurt anyone else, because it only affects that one address.

**Your "3 free, then wait 60 seconds" rule lives here.**

**Limit B — count by device ID.**

This is how we get close to "per machine" without punishing everyone behind the same router.

The idea: the browser gives itself a name. The first time someone opens Yahora, the browser generates a random ID and saves it. From then on, every request carries it in a header:

```
X-Device-Id: 8f14e45f-ceea-4d5b-b1f2-9c3a7e0d1b62
```

Two students on the same campus Wi-Fi have **different** device IDs, because each browser made its own. So they no longer collide.

**Your "20 per day" rule lives here.**

> ### Be honest about what this catches
>
> A device ID is not a security feature, and I do not want you thinking it is.
>
> Anyone can open DevTools, clear their storage, and get a fresh ID in about one second.
>
> So it stops: accidental loops, a buggy retry in your own code, a lazy script, and a curious student poking around.
>
> It does not stop: someone who actually wants to make ten thousand fake accounts.
>
> That is fine, because it is not the main defence. Read 2.3.

**IP address — write it down, never act on it.**

Store `req.ip` in the table. It is genuinely useful later: if you ever see 1,400 requests from one address in an hour, you want to know that.

But never refuse a request because of it. That is the NAT trap.

### The exact numbers

| Limit | Counted by | When it fires | What the student gets |
|---|---|---|---|
| Cooldown | one email | requests 1–3 are free; from the 4th, you must wait 60s since the last | `429` with `retry_after_seconds` |
| Daily email cap | one email | 10 requests in the last 24 hours | `429` with `retry_after_seconds` |
| Daily device cap | one device ID | 20 requests in the last 24 hours | `429` with `retry_after_seconds` |

**Two things worth explaining:**

**Why "the last 24 hours" and not "today".**

A calendar day resets at midnight. So a student who hits the limit at 11:50pm is free again ten minutes later, while one who hits it at 12:10am waits almost 24 hours. Same behaviour, wildly different punishment.

A **rolling window** just asks: "how many requests in the last 24 hours?" It is fairer, and in SQL it is simpler too — `where created_at > now() - interval '24 hours'`.

**Why the email cap is 10 but the device cap is 20.**

A real student needs one code. Maybe three if the first email is slow. Ten is already very generous for one address.

A device can legitimately serve several people, though — a shared library computer, or one student helping a friend sign up on their laptop. So the device number is higher.

---

## 2.3 The thing that actually stops fake accounts

Rate limits slow an attacker down. They do not clean up the mess. Let me show you what is really happening.

### Where the fake accounts come from

Look at `requestOtp` in `backend/src/modules/auth/auth.controller.js`, around line 55:

```js
const { data, error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
        shouldCreateUser: true,
    }
});
```

That `shouldCreateUser: true` is doing something you might not expect.

Supabase creates the row in `auth.users` **the moment the code is requested**. Not when it is verified. Not when the student proves they own the address. Right then.

And since Phase 1, your `handle_new_user` trigger sees that new auth user and creates a matching `public.users` row too.

So somebody who runs a script hitting `request-otp` with `xyz001@iiitk.ac.in` through `xyz999@iiitk.ac.in` leaves **999 accounts** in your database. Not one of those people ever received or entered a code.

### The fix is one query

> **Delete unverified accounts after 24 hours.**

An account that never confirmed its email is, by definition, an account that nobody proved they owned.

Supabase tracks this for you. The `auth.users` table has a column called `email_confirmed_at`. It stays `NULL` until somebody enters a valid code. So:

```sql
delete from auth.users
where email_confirmed_at is null
  and created_at < now() - interval '24 hours';
```

The `ON DELETE CASCADE` you set up in Phase 1 removes the `public.users` row automatically.

### Why this is better than rate limiting

Three reasons, and they are worth understanding because this pattern is useful everywhere:

**1. It has no false positives.** A real student verifies their code within minutes. Nobody real is 24 hours late. So this can never delete a genuine account.

**2. It fixes itself.** Even if somebody gets past your rate limits — and eventually somebody will — the junk disappears overnight, without you doing anything or even noticing.

**3. It caps the damage forever.** Without it, fake accounts grow without limit. With it, the worst case is "one day's worth", which is nothing.

You already have this exact pattern running. Open `backend/src/utils/cronJobs.js` — `cleanup_demo_users` runs at midnight every day. This is a second function on the same schedule.

> ### ⚠️ Do not shorten the 24 hours
>
> That number is doing real work.
>
> Picture a student who requests a code at 6pm, gets distracted, closes their laptop, and comes back after dinner at 9pm. If your cleanup ran every 2 hours, their account would be gone and they would not understand why.
>
> 24 hours is comfortably longer than any honest delay, while still keeping junk short-lived. Do not go below 6 hours without thinking hard about it.

### What comes after this, eventually

The industry-standard next step is a **CAPTCHA** on the OTP endpoint — Cloudflare Turnstile or hCaptcha. Those are the little "verify you're human" widgets.

Supabase supports this directly: you turn it on in the dashboard and add one field to the request. It is genuinely the thing that stops a determined attacker.

I would **not** add it now. It adds friction for every honest student too, and you have no evidence of real abuse yet. But it is worth knowing the option exists and that it is cheap to add the day you need it.

---

# PART 3 — Files and flow

## Files this phase touches

Every path is from the root of the repo.

| Path | What happens | Owner |
|---|---|---|
| `supabase/migrations/<timestamp>_otp_rate_limits.sql` | **new file** | Vishwajeet |
| `backend/src/modules/auth/auth.controller.js` | edit | Vishwajeet |
| `backend/src/utils/cronJobs.js` | edit | Vishwajeet |
| `backend/scripts/seedDemo.js` | edit | Vishwajeet |
| `backend/API.md` | edit | both |
| `docs/CHANGELOG.md` | edit | both |
| `frontend/src/config/deviceId.js` | **new file** | Neeraj |
| `frontend/src/pages/auth/Auth.jsx` | edit | Neeraj |
| `frontend/src/pages/onboarding/onboarding.jsx` | edit (one line) | Neeraj |
| `frontend/src/pages/settings/SetPassword.jsx` | **new file** | Neeraj |
| `frontend/src/pages/settings/SetPassword.module.css` | **new file** | Neeraj |
| `frontend/src/App.jsx` | edit | Neeraj |

> **Note on the new frontend file location.** Version 1.0 of this runbook said `frontend/src/lib/deviceId.js`. There is no `lib` folder in your project — your Supabase client lives in `frontend/src/config/supabaseClient.js`. So `deviceId.js` goes in `frontend/src/config/` alongside it, to match what you already do.

## Who does what, and when

Neeraj has one job he can start immediately, then waits about a day.

```
        VISHWAJEET                        NEERAJ
─────────────────────────────────────────────────────────────────
DAY 1   BLOCK A  Audit production        N-BLOCK C  Fix the username
        BLOCK B  Migration 008                      help text
                 (otp_requests + cleanup)           (10 minutes, standalone)
─────────────────────────────────────────────────────────────────
DAY 2   BLOCK C  Rate-limit request-otp
        BLOCK D  needs_password flag
        ───────── send HANDOFF A ────→
─────────────────────────────────────────────────────────────────
DAY 3   BLOCK E  Seed demo uni on prod   N-BLOCK A  Device ID +
                                                    OTP cooldown
                                         N-BLOCK B  Set-password screen
─────────────────────────────────────────────────────────────────
DAY 4   Review Neeraj's pull request     Test both flows end to end
─────────────────────────────────────────────────────────────────
```

## The SQL rule, unchanged from Phase 1

| | Local Studio (`http://127.0.0.1:54323`) | Production dashboard |
|---|---|---|
| Reading — `SELECT`, calling a function to test it | ✅ Yes | ✅ Yes |
| Writing — `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE` | ❌ Migration file only | ❌ Never |

---

# ══════════════════════════════════════════
# TRACK 1 — VISHWAJEET: what you do by hand
# ══════════════════════════════════════════

## BLOCK A — Find out who needs a password

**Time: about 30 minutes. Do this before anything else.**

### Why this comes first

You are about to build a screen for students who have no password. Before you build it, you should know how many of them there are.

If the answer is 8, this is a tiny job and you could even message those students personally. If it is 400, you might want to think about how you announce it. Either way, you want the number in front of you.

### How to run these queries

1. Open your Supabase dashboard in a browser
2. Pick your **production** project (`iwhtzhejyhaqctoqsolz`)
3. Click **SQL Editor** in the left sidebar
4. Paste one query at a time, press **Run**

Every query below only reads. None of them changes anything, so they are completely safe on production.

### Query 1 — the headline numbers

```sql
select
  count(*)                                       as total_users,
  count(*) filter (where is_profile_complete)    as finished_onboarding,
  count(*) filter (where is_profile_complete
                     and not has_password)       as need_a_password,
  count(*) filter (where username is null)       as no_username,
  count(*) filter (where university_id is null)  as no_university
from public.users;
```

**Reading the result:**

- `total_users` — everyone, including people who started signing up and gave up
- `finished_onboarding` — real, usable accounts
- `need_a_password` — **this is the number you care about.** These are the students who will see the new screen.
- `no_username` — should equal `total_users` minus `finished_onboarding`. If it is bigger, tell me.
- `no_university` — should be `0`. If it is not, something created accounts through a path that skipped the domain check.

> **What `filter (where ...)` does**, in case you have not met it: it counts only the rows matching that condition. It saves you writing five separate queries. `count(*) filter (where has_password)` means "how many rows have a password".

### Query 2 — are any usernames broken?

```sql
select id, username, full_name from public.users
where username is not null
  and (
    username !~ '^[a-z][a-z0-9._-]*$'
    or length(username) not between 3 and 25
  );
```

**What this checks.** `!~` means "does not match this pattern". The pattern is exactly what your database enforces. So this finds any handle that somehow got in while breaking the rules.

**You want zero rows.** If a row comes back, that student cannot use the password login tab at all — their own username is invalid. Send me the result and we will fix it in a migration.

### Query 3 — are onboarded students missing anything else?

```sql
select
  count(*) filter (where full_name is null)         as no_name,
  count(*) filter (where course_id is null)         as no_course,
  count(*) filter (where specialization_id is null) as no_specialization
from public.users
where is_profile_complete;
```

These should all be `0`, because onboarding requires them. If any is not, some students signed up before those fields existed, and their profile pages may look broken.

### Query 4 — how much junk is already there?

```sql
select
  count(*)                                         as all_auth_users,
  count(*) filter (where email_confirmed_at is null) as never_verified,
  count(*) filter (where email_confirmed_at is null
                     and created_at < now() - interval '24 hours') as old_and_unverified
from auth.users;
```

`old_and_unverified` is the number of rows your new cleanup job will delete the first time it runs. Worth knowing in advance so you are not startled when the count drops.

### ✋ Write the numbers down and send them to me

Specifically these four: `need_a_password`, the row count from Query 2, `no_university`, and `old_and_unverified`.

Two of them could change the plan, so please do not skip this.

---

## BLOCK B — Migration 008: the tracking table and cleanup jobs

### B1. Create the empty file

Open a terminal in the repo root:

```bash
cd /path/to/Yahora
git checkout main
git pull
supabase migration new otp_rate_limits
```

The last command prints the path of a new empty file, something like:

```
supabase/migrations/20260825091500_otp_rate_limits.sql
```

That is the file Claude Code will fill in. The timestamp is generated automatically — you do not choose it.

> **Why the number is 008 and not 007.** Version 1.0 of this runbook said 007. Since then you added `20260823055415_login_identity.sql`, which took that number. The file name uses a timestamp, not a number, so nothing actually breaks — but I am calling it 008 here so we are talking about the same thing.

### B2. Fill it in

Run **CC-1** from Track 2.

### B3. What that migration contains, in plain English

**A table called `otp_requests`.** Every time someone asks for an OTP, one row goes in: the email, the device ID, the IP address, and the time. Your rate limit checks are then just counting rows in this table.

Like every table you have created since migration 003, it is **backend-only**. Row Level Security is on and there are no policies at all, which in Postgres means "nobody can read this". Your Express server uses the service role key, which bypasses RLS, so it works fine. Nothing in the browser or the app can touch it.

**A function called `cleanup_unverified_users()`.** This is the one from Part 2.3 — it deletes `auth.users` rows that were never confirmed and are older than 24 hours.

**A function called `cleanup_otp_requests()`.** Housekeeping. You only ever look at the last 24 hours of that table, so anything older than 7 days is dead weight. This deletes it.

**Revokes on both functions.** `cleanup_unverified_users` runs `DELETE FROM auth.users`. That is about as dangerous as a function gets. It must be callable by your backend only — same pattern you already used for `get_login_email` and `get_login_identity`.

### B4. Test it

```bash
supabase db reset
```

**What this does:** wipes your local database and replays every migration file from the beginning, in order.

**What you want to see:** it lists all nine migrations, applies each one, and finishes with no errors.

That is the whole check for this block. If the SQL applies cleanly, it is valid. The actual behaviour gets tested in Block C, where there is a running server to call.

---

## BLOCK C — Rate-limit the OTP endpoint

Run **CC-2** from Track 2. It edits two files:

- `backend/src/modules/auth/auth.controller.js` — adds the three checks to `requestOtp`
- `backend/src/utils/cronJobs.js` — schedules the two cleanup functions

### 👁️ CHECK — the one thing Claude Code cannot verify for you

Everything here is testable in code except the actual passage of time. So this is the only manual test in this block, and it is worth doing carefully.

**Step 1 — start the backend.**

```bash
cd backend
npm run dev
```

Leave that terminal running.

**Step 2 — open your website in a browser** (`http://localhost:5173` or whatever port Vite prints).

You need to run the test from a page on your own site, not a blank tab. If you use a blank tab you will get a **CORS error** — that is your backend correctly refusing requests from unknown origins.

**Step 3 — open DevTools.** Press `F12`, then click the **Console** tab.

**Step 4 — test the 60-second cooldown.** Paste this and press Enter:

```js
const BASE = 'http://localhost:5000';

const askForCode = () =>
  fetch(`${BASE}/api/auth/request-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'test-device-aaa'
    },
    body: JSON.stringify({ email: 'ratetest@iiitk.ac.in' })
  }).then(async r => console.log(r.status, await r.json()));

for (let i = 1; i <= 4; i++) await askForCode();
```

**What you should see:**

```
200 {message: "OTP sent successfully!", ...}
200 {message: "OTP sent successfully!", ...}
200 {message: "OTP sent successfully!", ...}
429 {error: "RATE_LIMITED", retry_after_seconds: 59}
```

- [ ] First three are `200`, fourth is `429`
- [ ] `retry_after_seconds` is somewhere around 60

**Step 5 — wait 60 seconds, then run `await askForCode()` again.**

- [ ] It returns `200`. The cooldown expired correctly.

**Step 6 — test the 20-per-device limit.**

This one needs a **different email each time**, otherwise the email limit fires first and you never reach the device limit.

```js
for (let i = 1; i <= 22; i++) {
  const r = await fetch(`${BASE}/api/auth/request-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'test-device-bbb'
    },
    body: JSON.stringify({ email: `junk${i}@iiitk.ac.in` })
  });
  console.log(i, r.status);
}
```

- [ ] Around request 21, the status changes from `200` to `429`

**Step 7 — prove it is per-device, not global.** Change `test-device-bbb` to `test-device-ccc` and run one request:

- [ ] It returns `200` immediately

That last step is the important one. If a different device ID is *also* blocked, you are limiting globally, which would mean one person can lock out your entire user base.

**Step 8 — clean up your local database.**

```bash
supabase db reset
node backend/scripts/seedDemo.js
```

You just created 26 junk accounts locally. This removes them and puts your demo data back.

---

## BLOCK D — The `needs_password` flag

This is a small change. The login response needs to tell the website when a student has finished onboarding but has no password, so the website knows to show the set-password screen.

Run **CC-3** from Track 2.

### ✔ Check

You need a student who has no password. Your seeded users all have one, so create the situation by hand in **local** Studio (`http://127.0.0.1:54323` → SQL Editor):

```sql
-- pick any seeded handle and remove its password flag
update public.users
set has_password = false
where username = 'rahul.sharma';
```

Now log in as that user through Postman:

1. `POST {{baseUrl}}/api/auth/request-otp` with their email
2. Open Mailpit at `http://127.0.0.1:54324` and copy the code
3. `POST {{baseUrl}}/api/auth/verify-otp` with the email and code

- [ ] The response contains `"needs_password": true`

Then log in as a **normal** seeded user:

- [ ] The response contains `"needs_password": false`

Put your data back:

```bash
supabase db reset
node backend/scripts/seedDemo.js
```

### 📤 Send Handoff A to Neeraj

Post this in `docs/CHANGELOG.md` and message him:

> **Phase 2 backend part 1 is done. You are unblocked for N-Block A and N-Block B.**
>
> **Migration 008** (`otp_rate_limits`) is applied locally. Pull main and run `supabase db reset`.
>
> **`POST /api/auth/request-otp` is now rate limited.** It accepts an optional header `X-Device-Id`. When it refuses, it returns:
> ```
> 429 { "error": "RATE_LIMITED", "retry_after_seconds": 47 }
> ```
> There is **one error code for all three limits** — you do not need to know which one fired. Show one countdown.
>
> **`verify-otp` and `demo-login` now return `needs_password`** at the top level of the response, next to `message`. When it is `true`, send the student to the set-password screen instead of the dashboard.
>
> Full shapes are in `backend/API.md`.

---

## BLOCK E — Put demo data on production

This is the only part of Phase 2 that writes to production, so it gets the most care.

### E1. What the script does today

Open `backend/scripts/seedDemo.js`. It is about 1,000 lines. It creates:

- A university row: **"Yahora University (Demo)"**, domain `demo.yahora.com`
- 15 demo students with real-looking names and handles (`rahul.sharma`, `priya.verma`, and so on)
- Demo products with descriptions written to look good in screenshots
- Likes, saves, comments and messages between those students

The comment at the top of the file says it plainly: *"showcase data for investors, VCs, industry experts & HR demos."*

### E2. Why this is safe to run on production at all

Because of your multi-tenant design.

Every row in Yahora carries a `university_id`. Every query filters on it. So demo students and demo listings belong to the demo university, and a real student at IIITDM Kurnool can never see them — not through the UI, not through the API, and not through Supabase directly, because RLS filters on it too.

That isolation is what makes this operation safe. It is also the thing you must **verify afterwards**, in Step 4 below, rather than assume.

### E3. The guard, and how to get past it safely

Look at line 36 of `seedDemo.js`:

```js
const url = process.env.SUPABASE_URL || '';
if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
  console.error('\n❌ Refusing to seed a non-local database.');
  process.exit(1);
}
```

This has been protecting you all through Phase 1. It should stay.

**Do not delete it.** If you do, then one day — probably late at night, probably in a hurry — somebody runs this script while `.env` points at production, and 15 demo students appear in a real campus.

**Instead, make production a conscious act.** Change it so you can opt in, but only with an awkward string that nobody types by accident:

```js
const url = process.env.SUPABASE_URL || '';
const isLocal = url.includes('127.0.0.1') || url.includes('localhost');
const allowRemote =
  process.env.SEED_ALLOW_REMOTE === 'yes-seed-production-demo-tenant';

if (!isLocal && !allowRemote) {
  console.error('\n❌ Refusing to seed a non-local database.');
  console.error('   SUPABASE_URL =', url || '(not set)');
  process.exit(1);
}

if (allowRemote) {
  console.warn('\n⚠️  Seeding a REMOTE database. Demo tenant only.\n');
}
```

Now running it on production looks like this:

```bash
SEED_ALLOW_REMOTE=yes-seed-production-demo-tenant \
SUPABASE_URL=<your production url> \
SUPABASE_SERVICE_ROLE_KEY=<your production service key> \
node backend/scripts/seedDemo.js
```

Notice you are also passing the URL and key **on the command line**, not editing `.env`. That matters: your `.env` stays pointing at local, so the very next command you run is safe again. Nothing is left in a dangerous state.

> **Why an environment variable and not a `--production` flag?** Both would work. The env var is slightly better because the string itself spells out what you are agreeing to. You cannot type `yes-seed-production-demo-tenant` while thinking about something else.

### E4. Make it safe to run more than once

Right now, running the script twice would probably fail on a duplicate key, or create 30 demo students instead of 15.

You will want to refresh demo data before future investor meetings, so it needs to be what is called **idempotent**. That word just means: running it again gives you the same result, not double the result.

Two ways to get there:

1. **Upsert everything** — for each row, "insert it, or update it if it already exists"
2. **Delete the demo tenant's data first**, then insert fresh

I recommend the second. Demo data is decoration — there is nothing in it worth preserving, so a clean slate is simpler and easier to reason about.

**But that delete has to be guarded very carefully.** A delete statement that could match a real campus is the most dangerous line in this project. CC-4 handles it like this:

1. Look up the university whose domain is exactly `demo.yahora.com`
2. If that returns **zero** rows → nothing has been seeded yet, skip the delete, carry on
3. If it returns **more than one** row → stop everything with a loud error, because that should be impossible
4. Only if it returns **exactly one** row → delete users where `university_id` equals that specific id

The delete never uses a name, never uses a pattern match, never uses anything except that one resolved id.

### E5. Running it — the full procedure

**Step 1 — test on local first, twice.**

Never let production be the first place a changed script runs.

```bash
supabase db reset
node backend/scripts/seedDemo.js
node backend/scripts/seedDemo.js
```

- [ ] Both runs finish with no errors

Now open local Studio (`http://127.0.0.1:54323`) → **Table Editor** → `users`:

- [ ] 👁️ There are still **15** demo students, not 30

That is your idempotency proof.

**Step 2 — write down what production looks like right now.**

Production dashboard → SQL Editor:

```sql
select
  (select count(*) from public.users)    as users,
  (select count(*) from public.products) as products,
  (select count(*) from public.messages) as messages;
```

```sql
select un.name, count(u.id) as students
from public.universities un
left join public.users u on u.university_id = un.id
group by un.name
order by un.name;
```

- [ ] 👁️ **Copy both results into a text file.** You are going to compare against them in Step 4, and "I think it was about the same" is not good enough.

**Step 3 — run it.** Use the command from E3.

Read the output. The script should print how many rows it deleted and how many it created.

**Step 4 — check the blast radius.** This is the most important step in Block E.

Run the second query from Step 2 again — the one grouped by university.

- [ ] 👁️ The demo university shows **15** students
- [ ] 👁️ **Every real campus shows exactly the same number as before.** IIITDM Kurnool, NIET Greater Noida — identical to your saved copy.

If any real number moved, even by one, stop and message me straight away. Do not run anything else.

**Step 5 — check isolation from both directions.**

This is a two-way test and people usually only do half of it.

Direction 1 — open your live site and use the demo login button:

- [ ] 👁️ You see demo products
- [ ] 👁️ You see **no** products from IIITDM or NIET

Direction 2 — log in as a **real** student on the live site:

- [ ] 👁️ You see your own campus's listings
- [ ] 👁️ You see **no** demo products anywhere — not in the feed, not in search, not in the campus switcher

Multi-tenancy has to hold both ways. Direction 2 is the one that gets forgotten.

---

## BLOCK F — Finish up

- [ ] `backend/API.md` updated with: the `X-Device-Id` header, the `429 RATE_LIMITED` response, and the `needs_password` field
- [ ] `docs/CHANGELOG.md` has Handoff A
- [ ] `docs/CURRENT_STATE.md` — the `shouldCreateUser` item can now be marked resolved
- [ ] Neeraj's pull request reviewed and merged
- [ ] Everything pushed to `main`

---

# ══════════════════════════════════════════
# TRACK 2 — VISHWAJEET: Claude Code prompts
# ══════════════════════════════════════════

Four prompts. Run them **one at a time, in order**, from the repo root. Do not paste two together — if something goes wrong in a combined run, you will not know which half caused it.

---

## ▶ CC-1 — Migration 008: tracking table and cleanup jobs

```
Read docs/PHASE_2_RUNBOOK.md Part 2.2 and Part 2.3 first. They explain
why this is designed the way it is, and you will write better SQL
having read them.

Follow the conventions already used in
supabase/migrations/20260812121140_rls_stage1_backend_only_tables.sql
and 20260823055415_login_identity.sql:
  - lowercase SQL keywords
  - section comments explaining WHY, not just what
  - `set search_path = public, pg_temp` on every SECURITY DEFINER
    function

TASK: Write the SQL into the newest empty file in supabase/migrations/
whose name ends in _otp_rate_limits.sql.

=== 1. THE otp_requests TABLE ===

  id         uuid primary key default gen_random_uuid()
  email      text not null
  device_id  text
  ip_address text
  created_at timestamptz not null default now()

Two indexes. Both are read on EVERY otp request, so they are not
optional:

  on (lower(email), created_at desc)
  on (device_id, created_at desc) where device_id is not null

The partial index (the `where` clause) keeps it small — most rows will
have a device_id, but rows from the mobile app will not, and there is
no point indexing nulls we never query.

=== 2. LOCK THE TABLE DOWN ===

This table is backend-only. Nothing in frontend/ or mobile/ ever reads
it.

  alter table public.otp_requests enable row level security;

No policies. No grants. In Postgres, RLS enabled with zero policies
means nobody can read or write it at all. service_role has BYPASSRLS,
so the Express backend still works normally.

Add a comment saying this is deliberate, in the same style migration
003 uses, so a future reader does not "helpfully" add a policy.

=== 3. cleanup_unverified_users() ===

  language sql, security definer, search_path pinned.

  delete from auth.users
  where email_confirmed_at is null
    and created_at < now() - interval '24 hours';

Write a comment above it explaining the mechanism, because it is not
obvious: signInWithOtp with shouldCreateUser:true creates the
auth.users row when the CODE IS REQUESTED, not when it is verified. So
anyone hitting request-otp with invented addresses leaves accounts
behind that nobody ever confirmed. public.users cascades away with them
automatically.

Also comment that the 24 hours is load-bearing: anything much shorter
would delete a student who requested a code at 6pm and came back after
dinner.

=== 4. cleanup_otp_requests() ===

Deletes otp_requests rows older than 7 days. We only ever query the
last 24 hours, so older rows are dead weight.

=== 5. REVOKE EXECUTE ON BOTH ===

Both functions are called only by the backend cron job.

  revoke execute on function public.cleanup_unverified_users() from public;
  revoke execute on function public.cleanup_unverified_users() from anon, authenticated;

  ...and the same three lines for cleanup_otp_requests().

FROM PUBLIC is required as well as FROM anon — Postgres grants EXECUTE
to PUBLIC by default and anon inherits it. This repo already learned
that lesson twice, with get_login_email (005) and get_login_identity
(007).

cleanup_unverified_users runs DELETE FROM auth.users. An exposed
execute grant on that would let anyone with the publishable key delete
accounts. Treat it accordingly.

HARD CONSTRAINTS:
- Write ONLY into that one migration file.
- Do NOT run any supabase command. I run those myself.
- Do NOT modify any existing table, function, policy or index.

When you finish, print the full relative path of the file and a list of
every database object it creates.
```

---

## ▶ CC-2 — Rate-limit the OTP endpoint

```
Read docs/PHASE_2_RUNBOOK.md Part 2.2 for the design and the exact
numbers, and Part 2.3 for why the cleanup job matters.

TASK: Add rate limiting to requestOtp in
  backend/src/modules/auth/auth.controller.js
and register the two cleanup jobs in
  backend/src/utils/cronJobs.js

=== 1. WORK OUT WHO IS CALLING ===

Read the device id from the X-Device-Id request header.

Treat it as untrusted input, because it is: accept it only if it looks
plausible (a UUID, or a hex/alphanumeric string up to 64 characters).
Anything else, or a missing header, means "no device id".

A MISSING HEADER MUST NOT BE AN ERROR. The mobile app does not send it
yet and must keep working exactly as it does today.

Also read req.ip and store it. NEVER gate a request on it — see runbook
2.2. Campus Wi-Fi puts hundreds of students behind one address, and an
IP limit would lock out a whole hostel by mid-morning.

=== 2. THE THREE CHECKS, IN THIS ORDER ===

Do all three BEFORE calling Supabase. A blocked request must not send
an email and must not create an auth user.

  a) Email cooldown
     Count otp_requests rows for lower(email) in the last 24 hours.
     If that count is >= 3, find the most recent row. If it was less
     than 60 seconds ago, return 429 with retry_after_seconds set to
     the whole seconds remaining.

  b) Email daily cap
     If that same 24-hour count is >= 10, return 429. Set
     retry_after_seconds from the OLDEST row in the window — that is
     when a slot actually frees up. This is a rolling window, not a
     calendar day.

  c) Device daily cap
     Only if a device id is present. Count otp_requests rows for it in
     the last 24 hours. If >= 20, return 429, again computing
     retry_after_seconds from the oldest row.

ALL THREE RETURN THE SAME ERROR CODE: RATE_LIMITED, always with
retry_after_seconds. Do NOT invent three different codes. The website
shows one countdown and does not need to know which limit fired.

=== 3. RECORD THE REQUEST ===

Only after all three checks pass AND Supabase accepted the request,
insert one row into otp_requests: the email lowercased, the device id,
and the ip.

If that insert fails, log the error but STILL return success to the
student. A failed audit write must never break somebody's login.

=== 4. THE CRON JOBS ===

In backend/src/utils/cronJobs.js, next to the existing
cleanup_demo_users job, add two more:

  - cleanup_unverified_users()  — every hour
  - cleanup_otp_requests()      — once a day

Copy the structure of the existing job exactly, including its try/catch
and its console logging. Log how many rows each one deleted, so the
server log shows the job actually doing something.

=== 5. UPDATE backend/API.md ===

On the request-otp entry, document:
  - the new optional X-Device-Id header
  - the 429 response: { "error": "RATE_LIMITED", "retry_after_seconds": <int> }
  - add RATE_LIMITED to the error code table at the top of the file

HARD CONSTRAINTS:
- Modify ONLY auth.controller.js, cronJobs.js and backend/API.md.
- Do NOT touch utils/respond.js, middleware/ or config/. Those are
  frozen shared infrastructure.
- Use sendError() from utils/respond.js for every error response.
- Do NOT change any existing requestOtp behaviour beyond adding these
  checks. The domain validation, the Supabase call and the success
  response must all behave exactly as they do now.

When you finish, list each limit, its threshold, and the line where it
is checked.
```

---

## ▶ CC-3 — The needs_password flag

```
Read docs/PHASE_2_RUNBOOK.md Part 2.1.

CONTEXT: Some students in production finished onboarding before
passwords existed. They have a username but has_password = false. We
are NOT deleting them, and we are NOT generating passwords for them —
a password nobody knows is useless, and emailing one is unsafe.

Instead, the website sends them to a "set your password" screen after
their next OTP login. For that to work, the login response has to say
so.

TASK: In backend/src/modules/auth/auth.controller.js, add a
needs_password boolean to the response of verifyOtp and demoLogin.

  needs_password = (is_profile_complete === true && has_password === false)

Put it at the TOP LEVEL of the response object, next to `message` — not
nested inside userProfile. The website needs to branch on it
immediately without digging through nested objects.

Both endpoints already fetch the public profile, so compute this from
data you already have. Do not add another database query.

Also add it to the loginWithPassword response, for consistency. It will
always be false there — a successful password login proves they have a
password — but a client should never have to remember which endpoints
include a field and which do not.

Update backend/API.md for all three endpoints.

HARD CONSTRAINTS:
- Modify ONLY auth.controller.js and backend/API.md.
- Do NOT change or remove any existing response field. Only add.
- Do NOT change completeOnboarding. New students set a password there,
  so they will never see this flag as true.
```

---

## ▶ CC-4 — Make seedDemo safe for production

```
Read docs/PHASE_2_RUNBOOK.md Block E in full before changing anything.
This script is going to be run against the PRODUCTION database, so read
it twice.

TASK: Modify backend/scripts/seedDemo.js.

=== 1. REPLACE THE SAFETY GUARD ===

The guard at line 36 currently refuses any non-local SUPABASE_URL. Keep
that as the default, but allow an explicit opt-in:

  const url = process.env.SUPABASE_URL || '';
  const isLocal = url.includes('127.0.0.1') || url.includes('localhost');
  const allowRemote =
    process.env.SEED_ALLOW_REMOTE === 'yes-seed-production-demo-tenant';

  if (!isLocal && !allowRemote) { ...refuse and exit(1), as it does now... }
  if (allowRemote) { ...print a loud warning... }

Do NOT remove the guard.
Do NOT shorten the opt-in string to something like --prod or SEED=1.
The long awkward string is the point — nobody types it by accident.

=== 2. MAKE THE SCRIPT IDEMPOTENT ===

Running it twice must produce the same result, not double the data.

At the start of the run, delete the demo tenant's existing data, then
insert everything fresh. Demo data is decoration; there is nothing in
it worth preserving.

THE DELETE MUST BE GUARDED. Before deleting anything at all:

  a) look up the university whose domain is exactly 'demo.yahora.com'
  b) if that returns ZERO rows: nothing has been seeded yet. Skip the
     delete entirely and continue to the insert.
  c) if it returns MORE THAN ONE row: abort with a loud error. That
     should be impossible, and it means something is wrong that a
     script must not paper over.
  d) only with EXACTLY ONE row: delete from public.users where
     university_id equals that specific resolved id.

Never write a delete that could match a real campus. Never delete by
name, by pattern, by LIKE, or by anything other than that one resolved
uuid.

Products, messages, likes and comments all cascade from users, so
deleting the demo users is enough. Do NOT write separate deletes for
those tables — more delete statements means more chances for one of
them to be wrong.

Print a count of what was deleted before starting the insert.

=== 3. REPORT, DO NOT CHANGE ===

Tell me whether the script inserts into or updates the universities,
courses or specializations tables.

On local those are seeded by supabase/seed.sql. On production they
already exist with REAL data. If this script would insert or modify a
real university, course or specialization row, STOP and tell me. Do not
fix it yourself — I need to see it first.

=== 4. PRINT A SUMMARY AT THE END ===

A short table: rows deleted, users created, products created, messages
created, and the demo university uuid it used. When this runs against
production I want to read that output and know immediately whether it
did what I expected.

HARD CONSTRAINTS:
- Modify ONLY backend/scripts/seedDemo.js.
- Do NOT run the script.
- Do NOT change what demo content it creates — same 15 students, same
  products, same messages. Only the guard and the idempotency change.
- Every write in this script must be scoped to the demo university. If
  you find one that is not, report it instead of fixing it.
```

---

# ══════════════════════════════════════════
# TRACK 3 — NEERAJ: what you do by hand
# ══════════════════════════════════════════

## N-BLOCK C — Fix the username help text (start here, 10 minutes)

**Nothing blocks this.** Do it while Vishwajeet works on the migration.

### What is wrong

Open `frontend/src/pages/onboarding/onboarding.jsx` and find **line 75**. It is inside the `USERNAME_STATUS_COPY` object:

```js
invalid:
  "3–20 characters: lowercase letters, numbers, . or _ — not at the start, the end, or doubled.",
```

That sentence is shown when a student's chosen handle is rejected for being badly formatted. It describes the **old** rules — from the first draft of Phase 1, before they changed.

Here is what the database actually enforces now:

```
^[a-z][a-z0-9._-]*$     and     3 to 25 characters
```

Side by side:

| The message says | The truth |
|---|---|
| 3–20 characters | 3–**25** characters |
| letters, numbers, `.` or `_` | letters, numbers, `.`, `_` **and `-`** |
| separator not at the end | a separator at the end is **allowed** — `rahul.` is valid |
| separator not doubled | doubled is **allowed** — `rahul..s` is valid |
| *(nothing about the first character)* | the first character **must be a letter** — `9rahul` is rejected |

### Why it matters

Picture a student typing `9rahul`.

The server rejects it, correctly, because it starts with a digit. But the message they read talks about dots and underscores — neither of which they used. They have no way to work out what is wrong.

They will try `9_rahul`. Rejected. `9.rahul`. Rejected. And then they will give up, or pick a suggestion they do not like.

### The good news

This is the **only** place in the whole frontend where the rules are written down twice.

I searched `frontend/src/` for a validation regex and there is none. Your onboarding page sends the handle to the server and displays whatever reason comes back. That was the right call — one set of rules, living in one place — and it is why only this one sentence drifted.

Line 397 of the same file also already lowercases the input silently as the student types, which is exactly right. Do not change that.

### What to write instead

Something like:

```js
invalid:
  "3–25 characters. Start with a letter, then use lowercase letters, numbers, dots, underscores or hyphens.",
```

Run **N-CC-1** from Track 4 and it will find any other stale wording too.

### ✔ Check

Start the site and go to onboarding:

- [ ] 👁️ Type `9rahul` → the message now tells you it must start with a letter
- [ ] 👁️ Type `Rahul` → it silently becomes `rahul`, with no error
- [ ] 👁️ Type `rahul-sharma` → accepted (hyphens are allowed now)
- [ ] 👁️ Type `rahul..s` → accepted

---

## N-BLOCK A — Device ID and the OTP cooldown

**Start after Handoff A arrives.**

### A1. What a device ID is, and why we need one

Vishwajeet's backend now limits how many OTPs can be requested. One of those limits is meant to be "per machine".

The problem: there is no reliable way for a server to tell machines apart. Everyone on the same campus Wi-Fi arrives at the server with the same IP address — that is called NAT, and it is explained in Part 2.2 of this runbook. If we limited by IP, twenty students logging in would lock out the whole college for the day.

So instead, **the browser gives itself a name**.

The first time somebody opens Yahora, the browser generates a random ID and saves it in `localStorage`. Every request after that carries it in a header.

```js
// frontend/src/config/deviceId.js

const KEY = 'yahora_device_id';

export function getDeviceId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();     // built into every modern browser
    localStorage.setItem(KEY, id);
  }
  return id;
}
```

`crypto.randomUUID()` produces something like `8f14e45f-ceea-4d5b-b1f2-9c3a7e0d1b62`. It is random, it is unique, and it is generated on the device — nothing is sent to a server to create it.

Two students on the same Wi-Fi now have different IDs, so their limits are separate.

### A2. Three things to get right

**1. It is not a security feature.** Anybody can open DevTools, clear `localStorage`, and get a fresh ID in a second. This stops accidental loops and lazy scripts — not somebody determined. That is fine; the real defence is Vishwajeet's cleanup job.

**2. It contains nothing personal.** It is a random number generated on the device and never linked to a name, an email, or anything else. This is not tracking.

**3. It must survive logging out.** Do not clear it in your sign-out code. If it resets every time somebody logs out, the limit it feeds does nothing at all.

### A3. Where to put it

`frontend/src/config/deviceId.js` — next to `supabaseClient.js`, which is where your project already keeps this kind of module.

Then add the header to the `request-otp` call in `frontend/src/pages/auth/Auth.jsx`, around line 171:

```js
headers: {
  'Content-Type': 'application/json',
  'X-Device-Id': getDeviceId(),
}
```

### A4. The countdown

When the backend refuses, it sends back:

```json
429  { "error": "RATE_LIMITED", "retry_after_seconds": 47 }
```

**There is one error code for all three server-side limits.** You do not need to work out which one fired. Show one countdown.

> ### 🎉 You already built this
>
> `Auth.jsx` has all the pieces from the password-tab lockout:
>
> - `formatWait(totalSeconds)` at line 53 — turns `47` into `0:47`
> - `lockoutSeconds` state at line 89
> - the `useEffect` at line 105 that ticks it down once a second
>
> **Reuse them.** Do not write a second timer. Add a matching piece of state for the OTP tab — something like `otpCooldownSeconds` — and run it through the same `formatWait` and the same ticking pattern.
>
> Two timers doing the same job in one file is how a small bug becomes two small bugs.

What it should look like:

```
┌──────────────────────────────────────┐
│  College email                       │
│  [ rahul@iiitk.ac.in              ]  │
│                                      │
│     [  Resend code in 0:47  ]        │  ← disabled while counting
└──────────────────────────────────────┘
```

**Four details that matter:**

**Disable the button while counting.** Do not leave it clickable and then show an error. A disabled button tells the student what is happening; an error tells them they did something wrong.

**Use `m:ss` for anything over a minute.** `formatWait` already does this. A raw `retry_after_seconds: 3600` means nothing to a person. `59:31` does.

**If the wait is over ten minutes, show a sentence instead of a timer.** Something like *"Too many attempts. Please try again later."* Nobody sits and watches a twenty-minute countdown, and showing one just looks broken.

**Start a 60-second countdown after a successful send too** — not only after a `429`.

That last one is the most valuable and the easiest to miss. If the button is already counting down after their first code, the student physically cannot spam it, so they never hit the limit and never see an error. Preventing the problem is much better than reporting it.

### A5. Make the countdown survive a page reload

If a student refreshes the page mid-countdown, the timer would reset to zero and the button would be clickable again — even though the server would still refuse.

Fix it by storing **when the wait ends**, not **how long is left**:

```js
// when you start a cooldown:
localStorage.setItem('yahora_otp_cooldown_until', String(Date.now() + seconds * 1000));

// when the component mounts:
const until = Number(localStorage.getItem('yahora_otp_cooldown_until') || 0);
const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
```

**Why a timestamp and not a number of seconds:** if you save "47 seconds left" and the student comes back three minutes later, you would restore 47 seconds and make them wait all over again. A timestamp is an absolute point in time — the maths works out correctly no matter when they come back.

Run **N-CC-2** from Track 4.

### ✔ Check

- [ ] 👁️ Ask for a code four times quickly → the button disables and counts down
- [ ] 👁️ Wait for it to reach zero → the button works again
- [ ] 👁️ Start a countdown, then refresh the page → the countdown carries on from roughly the right number, it does not reset
- [ ] 👁️ DevTools → Application tab → Local Storage → `yahora_device_id` is there. Log out and back in → **it is the same value**

---

## N-BLOCK B — The set-password screen

### B1. Who sees this screen

Some students signed up before Yahora had passwords. They have an account and a username, but no password — so the "Username & Password" tab cannot work for them.

We are not deleting them, and we are not inventing a password for them. Part 2.1 explains why that does not work.

Instead: the next time they log in with OTP, they set one.

Vishwajeet's backend now returns `needs_password: true` in the login response for exactly these students, and only these students.

### B2. The flow

```
Student logs in with OTP — it succeeds
                ↓
    Does the response have needs_password === true?
                ↓
        YES                          NO
         ↓                            ↓
  /settings/set-password         /dashboard
         ↓
  They set a password
         ↓
     /dashboard
```

### B3. Make it required, not optional

**Do not add a skip button, a "later" link, or a close X.**

If students can skip it, a large number of them will skip it every single time. Months later you still have two kinds of user, and every feature has to cope with both.

It is one field. Required means the problem disappears within a few weeks of launch and you never think about it again.

Practically:

- No close button and no skip link on the screen
- If they try to navigate to another logged-in page while `needs_password` is true, send them back here
- If they close the tab and come back tomorrow, they land here again — because `needs_password` is still true on their next login

### B4. What the screen looks like

```
┌────────────────────────────────────────┐
│  One last thing                        │
│                                        │
│  Set a password so you can sign in     │
│  with your username next time.         │
│                                        │
│  New password                          │
│  [                              ] 👁   │
│  ✓ At least 8 characters               │
│                                        │
│  Confirm password                      │
│  [                              ] 👁   │
│                                        │
│         [   Save and continue   ]      │
└────────────────────────────────────────┘
```

It posts to `POST /api/auth/set-password` with just `{ password }`.

**Do not send `current_password`.** These students do not have one, and the endpoint only requires it when `has_password` is already `true`. That logic is already built and working — check `auth.controller.js:836` if you want to see it.

**Reuse the password rules from onboarding.** Your onboarding page already has: `MIN_PASSWORD_LENGTH = 8`, the show/hide toggle, the "At least 8 characters" tick, and the confirm-password match check. Copy that behaviour rather than inventing it again.

**Never block paste.** It breaks password managers, and password managers are one of the best things a student can be using.

**On a server error, keep what they typed.** If the server says `WEAK_PASSWORD` or `COMMON_PASSWORD`, show the message under the field and leave the text alone. Clearing the box makes people retype and give up.

Run **N-CC-3** from Track 4.

### ✔ Check

First ask Vishwajeet to run this on your **local** database, or run it yourself in local Studio:

```sql
update public.users set has_password = false
where username = 'rahul.sharma';
```

Then, in the browser:

- [ ] 👁️ Log in as that student with OTP → you land on the set-password screen, **not** the dashboard
- [ ] 👁️ Type `/dashboard` in the address bar → you get sent back to the set-password screen
- [ ] 👁️ Set a password → the dashboard loads
- [ ] 👁️ Log out, log back in → straight to the dashboard, the screen does not come back
- [ ] 👁️ Log in as any normal seeded student → they never see the screen at all

That last one matters as much as the others. A screen that shows up for everybody would be worse than no screen at all.

---

## N-BLOCK D — Before you open your pull request

- [ ] `git diff --stat` shows changes only under `frontend/src/`
- [ ] No password is ever written to `localStorage`, `sessionStorage`, or `console.log`
- [ ] Everything tested at 375px width (DevTools → the phone icon → iPhone SE)
- [ ] Post a short handoff note in `docs/CHANGELOG.md` saying what you built

```bash
git checkout -b neeraj
git add frontend/
git commit -m "feat(web): device id, OTP cooldown, set-password screen, username help text"
git push origin neeraj
```

Then open the pull request and ask Vishwajeet to review it.

---

# ══════════════════════════════════════════
# TRACK 4 — NEERAJ: Claude Code prompts
# ══════════════════════════════════════════

Three prompts. Run them one at a time, from the repo root.

---

## ▶ N-CC-1 — Fix the username help text

```
Read docs/PHASE_2_RUNBOOK.md N-Block C.

CONTEXT: The database enforces this username format:

  regex:  ^[a-z][a-z0-9._-]*$
  length: 3 to 25 characters

In plain words:
  - allowed characters: a-z, 0-9, dot, underscore, hyphen
  - length 3 to 25
  - the FIRST character must be a letter a-z, so "9rahul" is rejected
  - the LAST character may be any allowed character, so "rahul." is FINE
  - repeated separators are allowed, so "rahul__sharma" and "rahul..s"
    are both FINE
  - uppercase is silently converted to lowercase as the student types,
    and is never shown as an error
  - spaces are outside the allowed set so they cannot be typed

THE BUG: frontend/src/pages/onboarding/onboarding.jsx line 75, inside
USERNAME_STATUS_COPY, still describes the OLD rules:

  "3–20 characters: lowercase letters, numbers, . or _ — not at the
   start, the end, or doubled."

That is wrong in four ways: the length, the missing hyphen, the claim
that separators cannot end a handle, and the claim that they cannot be
doubled. It also never mentions the one rule that actually trips people
up — that the first character must be a letter.

TASK:

1. Rewrite that string so it describes the real rules accurately and
   plainly. Lead with the rule most likely to be what went wrong, which
   is "start with a letter". Keep it to one sentence a student can act
   on.

2. Search the whole of frontend/src/ for any OTHER place that describes
   or validates the username format — a regex, a maxLength attribute, a
   placeholder, a tooltip, a label, or a comment. Report everything you
   find, with the file and line number, and say whether it is correct
   or stale.

   I believe there is no client-side validation regex anywhere and that
   line 75 is the only stale copy, but check rather than assume.

3. Do NOT add a client-side format regex. The current design sends the
   handle to the server and displays whatever reason comes back, which
   means the rules live in exactly one place. That is deliberate and
   correct. Adding a second copy is what caused this bug.

4. Line 397 already lowercases the input silently as the student types.
   Leave that exactly as it is — it is the correct behaviour.

HARD CONSTRAINTS:
- Change only files under frontend/src/.
- Do NOT change the 400ms debounce or the availability-check logic.
- Do NOT touch backend/, supabase/ or mobile/.

When you finish, list every file you looked at and every stale piece of
wording you found.
```

---

## ▶ N-CC-2 — Device ID and the OTP cooldown

```
Read docs/PHASE_2_RUNBOOK.md N-Block A and Part 2.2, then read
backend/API.md for POST /api/auth/request-otp.

TASK, three parts.

=== 1. CREATE frontend/src/config/deviceId.js ===

Export getDeviceId(). It reads 'yahora_device_id' from localStorage,
generates one with crypto.randomUUID() if it is missing, saves it, and
returns it.

Put it in config/ next to supabaseClient.js — that is where this
project keeps modules like this. Do NOT create a new lib/ folder.

CRITICAL: this value must survive logging out. Do NOT clear it in the
sign-out handler. If it resets on every logout, the rate limit it feeds
does nothing at all.

=== 2. SEND THE HEADER ===

Add  X-Device-Id: getDeviceId()  to the headers of the request-otp
fetch call in frontend/src/pages/auth/Auth.jsx (around line 171).

=== 3. THE COOLDOWN ON THE OTP TAB ===

The backend now returns:

  429 { "error": "RATE_LIMITED", "retry_after_seconds": <int> }

There is ONE error code for all three server-side limits. Do not try to
tell them apart. Show one countdown.

REUSE WHAT IS ALREADY IN THIS FILE. Auth.jsx already has, for the
password tab lockout:
  - formatWait(totalSeconds)  around line 53
  - lockoutSeconds state      around line 89
  - a useEffect that ticks it down  around line 105

Add matching state for the OTP tab (otpCooldownSeconds or similar) and
run it through the SAME formatWait and the SAME ticking pattern. Do NOT
write a second timer implementation or a second formatter.

Behaviour:

  - Disable the send/resend button while the countdown is running, and
    re-enable it at zero. Do NOT leave it clickable and show an error
    instead — a disabled button explains itself.
  - Show the time using the existing formatWait, so it reads 0:47.
  - If the remaining wait is over 10 minutes, show a sentence instead
    of a timer: "Too many attempts. Please try again later." Nobody
    watches a twenty-minute countdown.
  - ALSO start a 60-second countdown after a SUCCESSFUL send, not only
    after a 429. If the button is already counting down, the student
    cannot spam it and never sees an error at all. Preventing the
    problem beats reporting it.

  - The countdown must survive a page reload. Store the TARGET
    TIMESTAMP in localStorage (Date.now() + seconds * 1000), not the
    remaining seconds, and recompute what is left on mount.

    Storing remaining seconds is wrong: if the student comes back three
    minutes later you would restore the old number and make them wait
    all over again. A timestamp is an absolute point in time, so the
    maths is correct whenever they return.

HARD CONSTRAINTS:
- Change only files under frontend/src/.
- Do NOT change the OTP verification step, the password tab, or the
  demo login.
- Use the CSS variables already in frontend/src/styles/global.css. No
  new colours.
- Must work at 375px width.

When you finish, confirm there is exactly ONE formatWait and ONE
countdown useEffect pattern in Auth.jsx.
```

---

## ▶ N-CC-3 — The set-password screen

```
Read docs/PHASE_2_RUNBOOK.md N-Block B and Part 2.1, then read
backend/API.md for POST /api/auth/set-password.

CONTEXT: Students who signed up before passwords existed have a
username but no password. The login response now includes
needs_password: true for exactly these students. They must set one
before they can continue.

TASK, three parts.

=== 1. CREATE THE SCREEN ===

  frontend/src/pages/settings/SetPassword.jsx
  frontend/src/pages/settings/SetPassword.module.css

Content:
  - Heading: "One last thing"
  - Explanation: "Set a password so you can sign in with your username
    next time."
  - Password field and confirm-password field, each with a show/hide
    toggle
  - A live rule line: "At least 8 characters", with a tick once it is
    satisfied
  - A Save and continue button, disabled until the password is long
    enough and both fields match

REUSE the password handling that already exists in
frontend/src/pages/onboarding/onboarding.jsx: MIN_PASSWORD_LENGTH, the
show/hide toggle, the tick indicator, and the confirm-match check.
Match that behaviour rather than inventing a second version.

  - POST { password } to /api/auth/set-password.
  - Do NOT send current_password. These students do not have one, and
    the endpoint only requires it when has_password is already true.
  - Do NOT block paste. It breaks password managers.
  - On WEAK_PASSWORD or COMMON_PASSWORD from the server, show the
    message under the field and KEEP what they typed. Clearing the box
    makes people give up.
  - On success, navigate to /dashboard.

=== 2. ROUTE AND GATE IT ===

  - Add the route in frontend/src/App.jsx.
  - After ANY successful login (verify-otp or demo-login), if the
    response has needs_password === true, navigate to
    /settings/set-password instead of /dashboard.
  - This screen is REQUIRED, not skippable. No close button, no
    "later" link, no way past it.
  - If the student navigates to any other authenticated route while
    needs_password is still true, redirect them back to this screen.
  - Once the password is saved, clear that state so navigation works
    normally again.

=== 3. DO NOT AFFECT ANYONE ELSE ===

A student whose response has needs_password false, or missing entirely,
must never see this screen and must land on /dashboard exactly as they
do today.

New students coming out of onboarding already set a password there, so
they are never affected.

Test this specifically: log in as a normal user and confirm nothing
about their experience changed.

HARD CONSTRAINTS:
- Change only files under frontend/src/.
- Never log a password, and never write one to localStorage or
  sessionStorage.
- Use the CSS variables already in frontend/src/styles/global.css. No
  new colours.
- Must work at 375px width.
- Do NOT restructure the existing login or routing logic beyond adding
  this one branch.
```

---

# PHASE 2 SIGN-OFF

Go through this together when you think you are done.

**OTP limits**
- [ ] The 4th request inside a minute returns `429` with a countdown, and works again after 60 seconds
- [ ] The 21st request from one device ID returns `429`, and a different device ID still works immediately
- [ ] The cleanup job runs and removes unverified accounts older than 24 hours
- [ ] `X-Device-Id` is optional — the mobile app, which does not send it, still works

**Existing students**
- [ ] The Block A audit numbers are written down and sent to Claude
- [ ] A student with `has_password = false` lands on the set-password screen and cannot skip it
- [ ] A normal student never sees that screen
- [ ] The countdown survives a page refresh

**Demo data**
- [ ] The script ran twice on local and produced 15 students, not 30
- [ ] On production: the demo university has 15 students, and **every real campus count is unchanged**
- [ ] Demo login shows demo products; a real student sees none of them

**Documentation**
- [ ] `backend/API.md` covers the `X-Device-Id` header, `RATE_LIMITED`, and `needs_password`
- [ ] `docs/CHANGELOG.md` has Handoff A and Neeraj's note
- [ ] `docs/CURRENT_STATE.md` — the `shouldCreateUser` item marked resolved

**Carried into Phase 3**
- [ ] **`docs/DESIGN.md` must be adopted or retracted.** Phase 3 is all UI, so this now genuinely blocks it. Right now both `CLAUDE.md` files say "read DESIGN.md before ANY UI work", but DESIGN.md describes a rebrand that was never built and names two files that do not exist. Left as it is, Claude Code will invent a third look.
- [ ] Mobile does not send `X-Device-Id` yet — add it in Phase 3
- [ ] A CAPTCHA on `request-otp` — only if you ever see real abuse

---

*Phase 3 is usernames in the user interface: the `/username` profile route, handles shown across both the website and the app, a change-username screen, and user search. Ask for it when you are ready.*
