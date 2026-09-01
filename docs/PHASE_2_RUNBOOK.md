# Phase 2 Runbook — Auth Hardening & Demo Data

**Version 3.0 — 26 August 2026.**

---

## What changed in version 3.0

You have already read Parts 0, 1 and 2. Here is what moved, so you do not have to re-read them.

| Change | Where |
|---|---|
| **You asked whether an email-flooding attack could cost you money.** It can, and my earlier plan did not stop it. Full answer and a fix are in the new **Part 2.4**. | New section |
| **No set-password flow.** You are wiping production, so no student will be left without a password. Old Block D, N-Block B, CC-3 and N-CC-3 are gone. Part 2.1 no longer applies. | Removed |
| **The production wipe is now a Phase 2 job**, with a proper before-and-after procedure. | Block A |
| **Local test data.** A new `seedLocal.js` fills your local database with students and listings in the *real* universities, so you can test campus isolation. | Block F |
| **Consecutive separators are now banned in usernames.** `rahul..sharma` is out; `rah.ul.sharma` is fine. Needs a migration and a help-text change. | Block D, N-Block A |

**Read Part 2.4 next.** Everything from Part 3 onwards has been rewritten.

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
| 1 | Rate-limit and CAPTCHA the OTP endpoint | Right now anyone can create unlimited fake accounts, and it can cost you money | V (backend) + N (UI) |
| 2 | Wipe production, tighten the username rules | Clean slate before launch; `rahul..sharma` should not be allowed | V |
| 3 | Put test data in local, demo data on production | So you can test properly, and so investor demos show a full app | V |

**What Phase 2 does not do**, so you are not surprised:

- No `/username` profile pages — that is Phase 3
- No showing handles across the app — Phase 3
- No change-username screen, no user search — Phase 3
- No mobile app work at all — Phase 3

---

# PART 2 — The three decisions, explained

Please read this part before you start. Each decision changes what you build, and I would rather you understand *why* than just follow steps.

---

## 2.1 ~~Why you cannot simply give someone a password~~ — no longer applies

**Skip this section.** You have decided to wipe production, so there will be no students left without a password. Everyone who signs up after the wipe sets one during onboarding, which is already built and working.

The reasoning is still worth knowing if the situation ever comes up again — the short version is that a password is only useful if exactly one person knows it, so generating one for somebody means either they cannot use it or you had to email it to them.

The production wipe itself is now **Block A**.

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

## 2.4 Your question about email flooding — the honest answer

You asked: *what if somebody just scripts thousands of requests with a new random email each time, and clears their browser storage so the device limit does not catch them? Could that cost us money? Should we deal with it now, later, or not at all?*

**My answer: deal with it now, in this phase.** Here is the full reasoning, because you should be able to judge this kind of question yourself in future.

### First — you are right that my earlier plan does not stop it

Let me be straight about this. Look at the three defences from Part 2.2 and 2.3 against your exact attack:

| Defence | Does it stop the attack? |
|---|---|
| **Per-email limit** (3 free, then 60 seconds) | **No.** It counts requests *for the same address*. The attacker uses a new address every time, so the count is always 1. |
| **Per-device limit** (20 per day) | **No.** Clearing `localStorage` gives a fresh ID. And a script written with `curl` or Python never had a browser in the first place, so it sends no `X-Device-Id` header at all — and my CC-2 prompt says a missing header must not be an error, because your mobile app does not send one yet. |
| **Cleanup job** (delete unverified after 24h) | **Partly.** It removes the rows. But by then the emails have already been sent and the money has already been spent. It cleans up the mess; it does not prevent it. |

So you found a genuine hole. Well spotted — this is exactly the right instinct to have about your own system.

### Second — what would actually happen to you

Four separate kinds of damage. They are not equally bad.

**1. Email costs — depends on your setup, so go and check.**

Supabase gives every project a built-in email service. It is heavily rate-limited on purpose, and their own documentation says it is not meant for production. So if you are still on it, a flood mostly just fails — annoying, but not expensive.

If you have configured your own SMTP provider (Resend, SendGrid, Amazon SES, Postmark), then every email costs a fraction of a rupee, and a million emails is a real bill.

> **Go and look right now.** Supabase dashboard → **Project Settings** → **Authentication** → scroll to **SMTP Settings**. If there is a custom host configured, you are paying per email. If it is empty, you are on the built-in service.
>
> Whichever it is, write it down. It changes how urgent this is, and you are going to move to custom SMTP before launch anyway — the built-in one cannot handle hundreds of colleges.

**2. Monthly Active User billing — the one that can genuinely hurt.**

Supabase charges based on **Monthly Active Users**, usually shortened to MAU. Roughly: how many distinct users had an authentication event this month.

Here is the uncomfortable part. `signInWithOtp` with `shouldCreateUser: true` **is** an authentication event. It creates a user. So a fake email that nobody ever verified may still count toward your bill for that month.

And crucially, **your cleanup job does not undo this**. Deleting the row tomorrow does not un-count the event that already happened today.

I am not going to quote you exact numbers, because Supabase's pricing changes and I would rather you look than trust me. Open the **Usage** page in your dashboard and find where MAU sits against your plan's included amount. Then imagine that number multiplied by ten thousand.

**3. Your sending domain's reputation — the one I would worry about most.**

This one is not about money at all, and it is the reason I changed my recommendation.

When you send email, receiving servers (Gmail, Outlook, your colleges' mail servers) build up an opinion of your sending domain over time. Send good mail that people open, and your reputation is good. Send lots of mail to addresses that do not exist, and it collapses.

A flood of OTPs to `xyz001@iiitk.ac.in` through `xyz999@iiitk.ac.in` is exactly that: hundreds of emails to addresses that were never real. The college mail server bounces them all and quietly decides your domain is a spam source.

**The consequence: real students stop getting their OTP.** It lands in spam, or is rejected outright. Your login stops working, for everybody, and you cannot fix it with a deploy. Rebuilding sender reputation takes weeks.

That is a far worse outcome than a bill. A bill you can pay. A burned sending domain breaks your product during the exact week you are launching.

**4. Junk rows in your database.** Real, but the least of your problems. Your cleanup job handles it, and storage is cheap.

### Third — so what do we actually build?

Two things. One is the proper fix; the other is a safety net in case the proper fix has a bad day.

#### Fix 1 — a CAPTCHA on `request-otp`

A CAPTCHA is a check that the thing making the request is a person using a browser, not a script.

You have probably met the annoying kind — pick all the traffic lights. **We are not using that kind.** Cloudflare Turnstile is usually completely invisible: it watches how the browser behaves, decides the visitor is human, and never shows a puzzle. Most students will never know it is there.
**Why this is the proper fix:** it defeats the whole attack, not a symptom of it. A `curl` loop cannot solve a CAPTCHA. A headless script cannot either, not cheaply. Every one of the four damages above disappears, because the request is refused before Supabase is ever called and before any email is sent.

**Why it is not much work:** Supabase supports this natively. You turn it on in the dashboard, and then pass one extra field with the request. It is roughly half a day across both of you.

#### Fix 2 — a global circuit breaker

A **circuit breaker** is a phrase from electrical wiring, and the idea carries over exactly. In your house, if too much current flows, a switch trips and cuts the power. It does not try to work out *why* — it just refuses to let the damage grow.

In software, it means: watch a total, and when it crosses a line you decided in advance, stop doing the thing.

Here, it is one query. Before sending any OTP, count how many have been sent across the whole platform in the last hour. If that number is over a ceiling you set, stop sending and log loudly.

```sql
select count(*) from otp_requests
where created_at > now() - interval '1 hour';
```

**Why bother, if you already have a CAPTCHA?** Because the CAPTCHA might be misconfigured, or Turnstile might have an outage, or you might add a new signup path in six months and forget to protect it. The circuit breaker does not care *how* the flood started. It just guarantees a hard ceiling on how bad any single hour can get.

**Setting the number.** Think about your real peak. Launch week, hundreds of colleges, everyone signing up at once — maybe a few hundred genuine OTPs in your busiest hour. So set the ceiling well above that, at **2,000 per hour** to start. It should never fire during normal use. If it ever does, something is wrong and you want to know.

> **The general lesson, worth keeping.** When something can cost you money without limit, put a ceiling on it — even a very high one you never expect to touch. The ceiling turns "unbounded loss" into "a known maximum". That is worth having even when you are confident nothing will go wrong, because the whole point is that you are wrong about that at exactly the moment you cannot afford to be.

### Fourth — why now, and not later

I originally wrote *"add a CAPTCHA only if you see real abuse."* I was wrong, and here is what changed my mind.

**"Wait and see" only works when you can undo the damage.** If you wait and get flooded, you can stop the flood — but you cannot un-send the emails, un-count the MAU, or un-burn your sending domain. The damage is one-way.

**The attack needs no skill.** This is not a determined adversary with resources. It is ten lines of Python that any student who dislikes you could write in an evening. You are launching a competitive product on campuses full of people learning to code.

**Being visible makes you a target.** Two colleges is quiet. Hundreds of colleges is not.

**And it is genuinely cheap.** Supabase already supports it. Half a day now, versus a bad week later.

So: it goes in Phase 2, as **Block E** and **N-Block C**.

### What we are still not doing

**Rate limiting by IP address.** Everything in Part 2.2 still holds. Campus Wi-Fi puts everyone behind one address, so an IP limit would lock out whole colleges. Log the IP; do not act on it.

**Blocking requests with no device ID.** Your mobile app does not send one yet. If you rejected those requests, you would break the app. The CAPTCHA is the defence for browser traffic; mobile gets its own protection in Phase 3.

---

# PART 3 — Files and flow

## Files this phase touches

Every path is from the root of the repo.

| Path | What happens | Owner |
|---|---|---|
| `supabase/migrations/<timestamp>_otp_rate_limits.sql` | **new file** | Vishwajeet |
| `supabase/migrations/<timestamp>_username_no_double_separator.sql` | **new file** | Vishwajeet |
| `backend/src/modules/auth/auth.controller.js` | edit | Vishwajeet |
| `backend/src/utils/cronJobs.js` | edit | Vishwajeet |
| `backend/scripts/seedDemo.js` | edit | Vishwajeet |
| `backend/scripts/seedLocal.js` | **new file** | Vishwajeet |
| `backend/API.md` | edit | both |
| `docs/CHANGELOG.md` | edit | both |
| `frontend/src/config/deviceId.js` | **new file** | Neeraj |
| `frontend/src/pages/auth/Auth.jsx` | edit | Neeraj |
| `frontend/src/pages/onboarding/onboarding.jsx` | edit (one line) | Neeraj |
| `frontend/.env` | edit (add the Turnstile key) | Neeraj |

**Two files from version 2.0 are no longer needed**, because there is no set-password screen: `frontend/src/pages/settings/SetPassword.jsx` and its CSS. If Claude Code already created them, delete them.

## Two migrations, not one

Version 2.0 had one migration. Now there are two, and they are deliberately separate:

| File | What it does |
|---|---|
| `..._otp_rate_limits.sql` | The `otp_requests` table and the cleanup functions |
| `..._username_no_double_separator.sql` | Tightens the username format rule |

**Why not put them in one file?** Because they are unrelated changes. In six months, when somebody runs `git log` on your migrations folder trying to work out when the username rules changed, a file called `username_no_double_separator` answers the question instantly. A file called `otp_rate_limits` that also quietly changed the username rules does not.

> **The rule to remember: one migration, one idea.** It costs nothing extra — `supabase migration new` takes two seconds — and it makes your history readable forever.

## Who does what, and when

```
        VISHWAJEET                        NEERAJ
─────────────────────────────────────────────────────────────────
DAY 1   BLOCK A  Audit + wipe production  N-BLOCK A  Fix the username
        BLOCK B  Migration: OTP limits               help text
        BLOCK C  Migration: username rule            (20 minutes)
─────────────────────────────────────────────────────────────────
DAY 2   BLOCK D  Rate limits + circuit
                 breaker in the backend
        BLOCK E  Turnstile on the backend
        ───────── send HANDOFF A ────→
─────────────────────────────────────────────────────────────────
DAY 3   BLOCK F  seedLocal.js             N-BLOCK B  Device ID +
        BLOCK G  Demo data on production             OTP cooldown
                                          N-BLOCK C  Turnstile widget
─────────────────────────────────────────────────────────────────
DAY 4   Review Neeraj's pull request      Test everything end to end
─────────────────────────────────────────────────────────────────
```

## The SQL rule, unchanged from Phase 1

| | Local Studio (`http://127.0.0.1:54323`) | Production dashboard |
|---|---|---|
| Reading — `SELECT`, calling a function to test it | ✅ Yes | ✅ Yes |
| Writing — `CREATE`, `ALTER`, `DROP`, `INSERT`, `UPDATE`, `DELETE` | ❌ Migration file only | ❌ Never |

**One exception this phase:** Block A wipes production users, and that is a `DELETE`. It is a one-off operational task, not a schema change, so it does not belong in a migration file. Block A tells you exactly how to do it safely.

---

# ══════════════════════════════════════════
# TRACK 1 — VISHWAJEET: what you do by hand
# ══════════════════════════════════════════

## BLOCK A — Look at production, then wipe it

**Time: about an hour. Do this first, and do not rush it.**

You have decided the current production users are all friends who were testing, so the data can go. That is a reasonable call — a clean slate before launch is much easier than carrying old test accounts forever.

But deleting production data is the single most irreversible thing you will do in this project. So we do it in a specific order: **look first, write down what you saw, then delete, then check the numbers match what you expected.**

### A1. Open the SQL Editor on production

1. Open your Supabase dashboard in a browser
2. Choose your **production** project (`iwhtzhejyhaqctoqsolz`) — check the project name at the top left, twice
3. Click **SQL Editor** in the left sidebar

Everything in A2 only reads. Nothing changes until A4.

### A2. Write down what is there now

```sql
select
  count(*)                                        as total_users,
  count(*) filter (where is_profile_complete)     as finished_onboarding,
  count(*) filter (where username is not null)    as have_username,
  count(*) filter (where has_password)            as have_password
from public.users;
```

```sql
select un.name, un.domain, count(u.id) as students
from public.universities un
left join public.users u on u.university_id = un.id
group by un.name, un.domain
order by un.name;
```

```sql
select
  (select count(*) from public.products) as products,
  (select count(*) from public.messages) as messages,
  (select count(*) from public.posts)    as posts;
```

- [ ] 👁️ **Copy all three results into a text file and save it.** Not a screenshot, not "I remember roughly" — an actual file you can open in A5.

> **Why this matters more than it sounds.** After you delete, the only way to tell whether the right things went is to compare against what was there before. Without a written record you are guessing, and "I think it was about right" is not a thing you want to say about production data.

### A3. Check for anything you would regret losing

```sql
select id, full_name, username, created_at
from public.users
order by created_at
limit 30;
```

- [ ] 👁️ **Read the names.** Every one should be somebody you recognise — you two, Neeraj, friends who were testing.

If you see a name you do not recognise, stop. It could mean a real student found your site early. Tell me before deleting anything.

### A4. Do the wipe

Run this **one statement**, in the production SQL Editor:


```sql
delete from auth.users;
```

That is the whole thing. Here is what happens underneath, because it is worth understanding:

- `auth.users` is Supabase's own table of accounts
- Your `public.users` table has `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- **`ON DELETE CASCADE`** means: when a row in `auth.users` is deleted, the matching row in `public.users` is deleted automatically
- And `products`, `messages`, `posts`, `product_likes`, `comments` and `purchases` all cascade from `public.users` in the same way

So one delete removes everything, in the right order, with no orphaned rows left behind. You do not need to write six delete statements — and you should not try, because getting the order wrong causes foreign key errors that are confusing to unpick.

> **What `ON DELETE CASCADE` actually is.** When you say table B references table A, you also say what should happen to B's rows if A's row disappears. `CASCADE` means "delete them too". The database does this itself, in one transaction, so you can never end up with a message whose sender no longer exists.
>
> This is why the wipe is one line instead of six, and it is also why you must be careful: the reach of a `CASCADE` delete is much larger than the statement looks.

### A5. Check the numbers

```sql
select
  (select count(*) from auth.users)      as auth_users,
  (select count(*) from public.users)    as users,
  (select count(*) from public.products) as products,
  (select count(*) from public.messages) as messages,
  (select count(*) from public.posts)    as posts;
```

- [ ] 👁️ **Every single one is `0`.** If any is not, the cascade did not reach that table and we need to look at why.

Now check what survived:

```sql
select count(*) as universities from public.universities;
select count(*) as courses from public.courses;
select count(*) as specializations from public.specializations;
```

- [ ] 👁️ These are all **unchanged** from your saved file.

That is correct and important. Universities, courses and specializations are reference data — they describe the world, not the people in it. Nothing cascades to them, so they stay. If they had gone, your signup would be completely broken, because `requestOtp` looks up the email domain in `universities`.

### A6. Prove signup still works

Go to your live site and sign up properly, with a real college email address you control.

- [ ] 👁️ You get an OTP email
- [ ] 👁️ The code works and you reach onboarding
- [ ] 👁️ You can pick a username and set a password
- [ ] 👁️ You land on the dashboard
- [ ] 👁️ Log out, then log in with **username and password** — it works

That last step matters. It proves the whole chain works end to end on a clean database: signup, onboarding, and both login methods.

---

## BLOCK B — Migration: OTP tracking and cleanup

### B1. Create the empty file

```bash
cd /path/to/Yahora
git checkout main
git pull
supabase migration new otp_rate_limits
```

The command prints a path like `supabase/migrations/20260826091500_otp_rate_limits.sql`. That is the file Claude Code fills in. The timestamp is generated for you.

### B2. Fill it in

Run **CC-1** from Track 2.

### B3. What goes in it, in plain English

**A table called `otp_requests`.** One row per OTP request: the email, the device ID, the IP address, the time. Your limits are then just counting rows.

Like every table since migration 003, it is backend-only — Row Level Security on, no policies at all. In Postgres that means nobody can read it. Your Express server uses the service role key, which bypasses RLS, so the backend works fine and nothing else can touch it.

**`cleanup_unverified_users()`** — deletes `auth.users` rows that were never confirmed and are more than 24 hours old. Part 2.3 explains why.

**`cleanup_otp_requests()`** — housekeeping. You only ever look at the last hour or two of that table, so rows older than 7 days are dead weight.

**Revokes on both.** `cleanup_unverified_users` runs `DELETE FROM auth.users`, which is about as dangerous as a function gets. Backend only — the same pattern you already used for `get_login_email` and `get_login_identity`.

### B4. Test it

```bash
supabase db reset
```

This wipes your local database and replays every migration from the start.

- [ ] It applies all nine migrations with no errors

That is the whole check for this block. The behaviour gets tested in Block D, where there is a server running to call.

---

## BLOCK C — Migration: no consecutive separators in usernames

### C1. What is changing and why

Right now the rule is:

```
^[a-z][a-z0-9._-]*$      and      3 to 25 characters
```

That allows `rahul..sharma`, which you want to stop. It should allow `rah.ul.sharma`, which it will continue to.

**My recommendation: ban any two separators in a row, not just two dots.**

You asked specifically about `..`. But look at these three:

```
rahul.sharma
rahul..sharma
rahul._sharma
```

The second and third are both trying to look like the first. If you only ban `..`, then `._` and `_.` and `--` still work, and somebody impersonating `rahul.sharma` just uses one of those instead. You would have closed one door and left three open.

Banning all of them is the same amount of code and there is no legitimate handle it stops anybody choosing.

**The new rule:**

```
^[a-z][a-z0-9._-]*$      3 to 25 characters      and no two of . _ - next to each other
```

In SQL that second part is written as a separate condition rather than folded into the pattern, because it is much easier to read:

```sql
and username !~ '[._-]{2}'
```

`!~` means "does not match". `[._-]{2}` means "any two characters from this set, next to each other". So the whole line reads: the username must not contain two separators in a row.

> Interesting note: Phase 1's original draft had exactly this rule, as `!~ '[._]{2}'`. It was removed when you loosened the rules, and now it comes back with the hyphen added. Nothing wrong happened — requirements changed, which is normal — but it is a good illustration of why migrations are numbered and never edited. Your history shows what you believed and when.

### C2. Create the file

```bash
supabase migration new username_no_double_separator
```

### C3. Fill it in

Run **CC-2** from Track 2.

### C4. What it has to change — three places, not one

This is the part that is easy to get wrong. The rule is written down in more than one place, and all of them have to move together:

1. **The `CHECK` constraint on `public.users`** — stops bad data getting in
2. **`is_username_available()`** — the function your API calls, so the student sees a helpful message instead of a database error
3. **A check that no existing row breaks the new rule** — because adding a constraint to a table with data fails if any row violates it

Point 3 is the one that bites. You met it in Phase 1: `ALTER TABLE ... ADD CONSTRAINT` checks every existing row immediately, and refuses if even one fails.

On production you just wiped everything, so there are no rows and it cannot fail. **But on your local database you have seed data**, and if any seeded handle contains `..` the migration will fail there.

The migration handles this by fixing any offending rows before adding the constraint — collapsing runs of separators down to one. With an empty production table it does nothing; on local it quietly repairs the seed data.

### C5. Test it

```bash
supabase db reset
```

- [ ] All ten migrations apply cleanly

Then, in local Studio (`http://127.0.0.1:54323`) → SQL Editor:

```sql
select public.is_username_available('rahul..sharma');   -- expect: false
select public.is_username_available('rah.ul.sharma');   -- expect: true
select public.is_username_available('rahul._sharma');   -- expect: false
select public.is_username_available('rahul-_sharma');   -- expect: false
select public.is_username_available('rahul.sharma');    -- expect: true
select public.is_username_available('rahul_sharma');    -- expect: true
```

- [ ] 👁️ All six give the expected answer

The middle two are the ones worth checking carefully — they are the reason we banned all separator pairs and not only dots.

---

## BLOCK D — Rate limits and the circuit breaker

Run **CC-3** from Track 2. It edits `backend/src/modules/auth/auth.controller.js` and `backend/src/utils/cronJobs.js`.

### 👁️ CHECK — the one thing Claude Code cannot verify

Everything here is testable in code except the passing of time, so this is the only manual test in this block.

**Step 1 — start the backend.**

```bash
cd backend
npm run dev
```

Leave that terminal running.

**Step 2 — open your website** at `http://localhost:5173` (or whatever port Vite prints).

You must run the test from a page on your own site, not a blank tab. From a blank tab you will get a **CORS error** — that is your backend correctly refusing requests from an origin it does not know.

**Step 3 — open DevTools.** Press `F12`, click the **Console** tab.

**Step 4 — test the 60-second cooldown.**

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

You should see:

```
200 {message: "OTP sent successfully!", ...}
200 {message: "OTP sent successfully!", ...}
200 {message: "OTP sent successfully!", ...}
429 {error: "RATE_LIMITED", retry_after_seconds: 59}
```

- [ ] First three are `200`, the fourth is `429` with about 60 seconds

**Step 5 — wait 60 seconds**, then run `await askForCode()` again.

- [ ] It returns `200`

**Step 6 — test the per-device limit.** This needs a **different email every time**, or the email limit fires first and you never reach the device limit.

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

- [ ] Around request 21 the status changes from `200` to `429`

**Step 7 — prove it is per-device, not global.** Change `test-device-bbb` to `test-device-ccc` and send one request.

- [ ] It returns `200` straight away

This step matters most. If a different device is *also* blocked, you are limiting globally — which would mean one person could lock out every user you have.

**Step 8 — test the circuit breaker.**

⚠ **Clear the ledger first, or this step cannot pass.** The breaker counts *every* row in
`otp_requests` from the last hour — globally, not per email or per device. Step 6 just created
~22 rows to test the device cap, so with a ceiling of 5 the breaker is already tripped before
your first request and all six return `503`. That is the breaker working, but it does not show
you the transition from allowed to refused, which is the point of the step.

```bash
# wipes only the OTP ledger, not your seeded data
curl -s -X DELETE "http://127.0.0.1:54321/rest/v1/otp_requests?id=not.is.null" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

(`SERVICE_ROLE_KEY` is `SUPABASE_SERVICE_ROLE_KEY` from `backend/.env`. Or wait an hour — the
window is rolling.)

Then temporarily lower the ceiling so you can actually reach it. In `auth.controller.js`, find
the hourly ceiling constant and change it from `2000` to `5`, then save (the server reloads
itself).

Now send 6 requests, each with a different device ID and a different email:

```js
for (let i = 1; i <= 6; i++) {
  const r = await fetch(`${BASE}/api/auth/request-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': `breaker-${i}`
    },
    body: JSON.stringify({ email: `breaker${i}@iiitk.ac.in` })
  });
  console.log(i, r.status);
}
```

- [ ] The first five return `200`, the sixth returns `503 SERVICE_BUSY`
- [ ] 👁️ **Look at the terminal running your backend.** There should be a loud warning saying the circuit breaker tripped. That log line is the whole point — it is how you find out something is wrong.

**Put the number back to `2000` before you commit.**

**Step 9 — clean up locally.**

```bash
supabase db reset
```

You just created about 30 junk accounts on local. This removes them.

---

## BLOCK E — Turnstile: the CAPTCHA

This is the real fix from Part 2.4. It has three parts: a Cloudflare account, a Supabase setting, and a small backend change. Neeraj does the browser half in N-Block C.

### E1. Get Turnstile keys from Cloudflare

Turnstile is free and does not require you to move anything else to Cloudflare.

1. Go to `dash.cloudflare.com` and sign up or log in
2. In the left sidebar, find **Turnstile**
3. Click **Add widget**
4. **Widget name:** `Yahora`
5. **Hostnames:** add `localhost`, and your production domain
6. **Widget mode:** choose **Managed**

> **What "Managed" means.** Turnstile decides for itself how much checking is needed. For nearly every real visitor that means no puzzle at all — it just watches how the browser behaves and lets them through. Only visitors that look automated get challenged. This is why most students will never notice it exists.

7. Click Create

You now have two keys:

| Key | Where it goes | Secret? |
|---|---|---|
| **Site key** | The browser, in Neeraj's code | No — it is public by design |
| **Secret key** | Supabase dashboard only | **Yes** — never in Git, never in the frontend |

- [ ] Send Neeraj the **site key** only
- [ ] Keep the **secret key** to yourself

> **Why the site key can be public.** It only says "this widget belongs to Yahora". Verification happens between Cloudflare and Supabase using the secret key, which the browser never sees. This split is a common pattern — you will meet it again with payment providers.

### E2. Turn it on in Supabase

1. Supabase dashboard → your project → **Authentication**
2. Find **Attack Protection** (in some versions it is called **Bot and Abuse Protection**)
3. Enable CAPTCHA protection
4. Provider: **Cloudflare Turnstile**
5. Paste your **secret key**
6. Save

> ⚠️ **Do this on your local project first if you have one, and on production only after the code is deployed.** The moment you enable it, Supabase rejects any auth request that does not carry a valid CAPTCHA token. If your live site is not yet sending one, logins stop working immediately.
>
> The safe order is: build and deploy the code, confirm it works, **then** enable the setting.

### E3. Pass the token through your backend

Right now the browser talks to your Express backend, and your backend talks to Supabase. So the token has to travel: browser → your backend → Supabase.

Run **CC-4** from Track 2.

### E4. 👁️ Check

This one has to be tested in a real browser, because the token comes from a widget rendering on a page.

Once Neeraj's N-Block C is merged and you have both pulled:

- [ ] 👁️ Open the login page. Request a code. It works normally, and you probably never see a widget.
- [ ] 👁️ Now try from the DevTools console with a script (the `askForCode` snippet from Block D). It should now **fail** — no token, no OTP.

That second check is the proof. Your own test script from Block D is exactly the shape of the attack from Part 2.4, so when it stops working, so does the attack.

---

## BLOCK F — Test data for your local database

### F1. Why you need this, and why it is a separate script

`seedDemo.js` fills the **demo university**. That is right for investor demos, but wrong for testing, because everything lives in one tenant. You cannot test campus isolation with one campus.

For local development you want students and listings in the **real** universities — IIITDM Kurnool and NIET Greater Noida — so you can:

- Log in as an IIITK student and confirm you cannot see NIET listings
- Test the campus switcher with something actually in it
- Have messages, likes and comments to look at while building screens

**This is a second script, `backend/scripts/seedLocal.js`.** Keeping it separate from `seedDemo.js` matters:

| Script | Writes to | May run on production? |
|---|---|---|
| `seedDemo.js` | The demo university only | Yes, with an explicit opt-in |
| `seedLocal.js` | Real universities | **Never. No opt-in exists.** |

One script can reach production and one absolutely cannot. If you merged them, you would need a flag to tell them apart — and a flag is something you can get wrong at 1am. Two files with different rules cannot be confused.

### F2. Build it

Run **CC-5** from Track 2.

### F3. Use it

```bash
supabase db reset          # wipes local, replays migrations, runs seed.sql
node backend/scripts/seedLocal.js
node backend/scripts/seedDemo.js
```

That is your standard "give me a fresh local database" sequence. Write it in `docs/CHANGELOG.md` so Neeraj uses the same one.

### 👁️ Check

Open local Studio (`http://127.0.0.1:54323`) → **Table Editor** → `users`:

- [ ] 👁️ Students exist in IIITDM Kurnool, NIET Greater Noida, **and** the demo university

Then, in the browser, log in as one of the IIITK test students:

- [ ] 👁️ You see IIITK listings
- [ ] 👁️ You see **no** NIET listings and **no** demo listings
- [ ] 👁️ The campus switcher shows NIET, and switching lets you browse but not buy

That last one is your campus isolation working, which you could not test at all before.

---

## BLOCK G — Demo data on production

This writes to production, so it gets the most care of anything in Phase 2.

### G1. What the script does today

Open `backend/scripts/seedDemo.js`. About 1,000 lines. It creates:

- A university: **"Yahora University (Demo)"**, domain `demo.yahora.com`
- 15 demo students with real-looking names and handles
- Demo products with descriptions written to look good in screenshots
- Likes, saves, comments and messages between them

The comment at the top says it plainly: *showcase data for investors, VCs and HR demos.*

### G2. Why this is safe on production at all

Because of your multi-tenant design. Every row carries a `university_id`, every query filters on it, and RLS enforces it at the database level. Demo students belong to the demo university, so a real student can never see them — not through the UI, not through the API, not through Supabase directly.

That isolation is what makes this safe. It is also what you must **verify afterwards**, in G5 Step 4, rather than assume.

### G3. The guard, and how to get past it safely

Line 36 of `seedDemo.js`:

```js
const url = process.env.SUPABASE_URL || '';
if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
  console.error('\n❌ Refusing to seed a non-local database.');
  process.exit(1);
}
```

This has protected you all through Phase 1. It should stay.

**Do not delete it.** If you do, then one evening somebody runs this script while `.env` points at production, and demo students appear in a real campus.

**Instead, make production a conscious act** — possible, but only with a string nobody types by accident:

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

The production run then looks like this:

```bash
SEED_ALLOW_REMOTE=yes-seed-production-demo-tenant \
SUPABASE_URL=<your production url> \
SUPABASE_SERVICE_ROLE_KEY=<your production service key> \
node backend/scripts/seedDemo.js
```

Notice you pass the URL and key **on the command line**, not by editing `.env`. Your `.env` keeps pointing at local, so the very next command you run is safe again. Nothing is left in a dangerous state.

### G4. Make it safe to run twice

Right now, a second run would probably fail on a duplicate key, or create 30 demo students instead of 15.

You will want to refresh demo data before future meetings, so it needs to be **idempotent** — a word that just means "running it again gives the same result, not double the result".

The approach: delete the demo tenant's data first, then insert fresh. Demo data is decoration; there is nothing worth keeping.

**But that delete must be guarded very carefully**, because a delete that could reach a real campus is the most dangerous line in your project. CC-6 does it like this:

1. Look up the university whose domain is exactly `demo.yahora.com`
2. **Zero rows** → nothing seeded yet, skip the delete, carry on
3. **More than one row** → stop with a loud error; that should be impossible
4. **Exactly one row** → delete users where `university_id` equals that specific id

Never by name, never by pattern, never by `LIKE`. Only that one resolved id.

### G5. The procedure

**Step 1 — test on local first, twice.** Never let production be the first place a changed script runs.

```bash
supabase db reset
node backend/scripts/seedLocal.js
node backend/scripts/seedDemo.js
node backend/scripts/seedDemo.js
```

- [ ] Both `seedDemo` runs finish with no errors
- [ ] 👁️ Local Studio → `users` → still **15** demo students, not 30
- [ ] 👁️ Your IIITK and NIET test students from `seedLocal` are **untouched**

That last check proves the demo delete is properly scoped.

**Step 2 — record production's current state.**

```sql
select un.name, count(u.id) as students
from public.universities un
left join public.users u on u.university_id = un.id
group by un.name
order by un.name;
```

- [ ] 👁️ Save the result to a text file

**Step 3 — run it.** Use the command from G3. Read the output — the script prints what it deleted and what it created.

**Step 4 — check the blast radius.** This is the most important step in Block G.

Run the same query as Step 2.

- [ ] 👁️ The demo university shows **15** students
- [ ] 👁️ **Every real campus shows exactly the same number as in your saved file**

If any real number moved, even by one, stop and message me. Do not run anything else.

**Step 5 — check isolation both ways.**

Direction 1 — open the live site and use the demo login:

- [ ] 👁️ You see demo products
- [ ] 👁️ You see **no** products from IIITK or NIET

Direction 2 — log in as a **real** student on the live site:

- [ ] 👁️ You see your own campus's listings
- [ ] 👁️ You see **no** demo products anywhere — not in the feed, not in search, not in the campus switcher

Direction 2 is the one people skip. Multi-tenancy has to hold both ways.

---

## BLOCK H — Finish up

- [ ] `backend/API.md` updated with the `X-Device-Id` header, the `captchaToken` field, `RATE_LIMITED`, and the `503` circuit breaker response
- [ ] `docs/CHANGELOG.md` has Handoff A and the standard local-reset command sequence
- [ ] `docs/CURRENT_STATE.md` — the `shouldCreateUser` item marked resolved
- [ ] The circuit breaker ceiling is back to `2000`, not the `5` you used for testing
- [ ] Turnstile enabled on production **after** the frontend was deployed
- [ ] Neeraj's pull request reviewed and merged
- [ ] Everything pushed to `main`

---

# ══════════════════════════════════════════
# TRACK 2 — VISHWAJEET: Claude Code prompts
# ══════════════════════════════════════════

Six prompts. Run them **one at a time, in order**, from the repo root. Do not paste two together — if something goes wrong in a combined run, you will not know which half caused it.

---

## ▶ CC-1 — Migration: OTP tracking and cleanup

```
Read docs/PHASE_2_RUNBOOK.md Part 2.2, 2.3 and 2.4 first. They explain
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

File name: supabase/migrations/20260831085218_otp_rate_limits.sql

=== 1. THE otp_requests TABLE ===

  id         uuid primary key default gen_random_uuid()
  email      text not null
  device_id  text
  ip_address text
  created_at timestamptz not null default now()

Three indexes. All three are read on EVERY otp request, so they are not
optional:

  on (lower(email), created_at desc)
  on (device_id, created_at desc) where device_id is not null
  on (created_at desc)

The third one is for the circuit breaker in CC-3, which counts ALL
requests in the last hour regardless of who made them.

The second is partial (the `where` clause) so it stays small — requests
from the mobile app carry no device id, and there is no point indexing
nulls we never query.

=== 2. LOCK THE TABLE DOWN ===

Backend-only. Nothing in frontend/ or mobile/ ever reads it.

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

Comment above it explaining the mechanism, because it is not obvious:
signInWithOtp with shouldCreateUser:true creates the auth.users row
when the CODE IS REQUESTED, not when it is verified. So anyone hitting
request-otp with invented addresses leaves accounts behind that nobody
ever confirmed. public.users cascades away with them automatically.

Also comment that the 24 hours is load-bearing: anything much shorter
would delete a student who requested a code at 6pm and came back after
dinner.

=== 4. cleanup_otp_requests() ===

Deletes otp_requests rows older than 7 days. We only ever query the
last hour or two, so older rows are dead weight.

=== 5. REVOKE EXECUTE ON BOTH ===

  revoke execute on function public.cleanup_unverified_users() from public;
  revoke execute on function public.cleanup_unverified_users() from anon, authenticated;

...and the same three lines for cleanup_otp_requests().

FROM PUBLIC is required as well as FROM anon — Postgres grants EXECUTE
to PUBLIC by default and anon inherits it. This repo already learned
that lesson twice, with get_login_email (005) and get_login_identity
(007).

cleanup_unverified_users runs DELETE FROM auth.users. An exposed
execute grant on that would let anyone holding the publishable key
delete accounts. Treat it accordingly.

HARD CONSTRAINTS:
- Write ONLY into that one migration file.
- Do NOT run any supabase command. I run those myself.
- Do NOT modify any existing table, function, policy or index.
- Do NOT touch the username format rules — that is a separate
  migration, written next.

When you finish, print the full relative path of the file and a list of
every database object it creates.
```

---

## ▶ CC-2 — Migration: ban consecutive separators in usernames

```
Read docs/PHASE_2_RUNBOOK.md Block C for the reasoning.

CONTEXT: The username rule currently allows two separators in a row, so
"rahul..sharma" is accepted. We are banning that. "rah.ul.sharma" must
keep working.

We are banning ALL consecutive separator pairs, not only dots. The
reason: "rahul..sharma", "rahul._sharma" and "rahul-_sharma" are all
trying to look like "rahul.sharma". Banning only ".." would close one
door and leave three open, for the same amount of code.

THE NEW RULE:
  ^[a-z][a-z0-9._-]*$        (unchanged)
  length 3 to 25             (unchanged)
  and username !~ '[._-]{2}' (NEW — no two separators in a row)

TASK: Write the SQL into the newest empty file in supabase/migrations/
ending in _username_no_double_separator.sql.

File name: supabase/migrations/20260831095101_username_no_double_separator.sql

Three things must change together, and missing any one of them leaves
the rules inconsistent:

=== 1. REPAIR EXISTING ROWS FIRST ===

ALTER TABLE ... ADD CONSTRAINT checks every existing row immediately
and refuses if even one fails. Production is empty after the wipe, but
local has seed data, and a seeded handle containing ".." would make
this migration fail there.

So before touching the constraint, collapse any run of separators down
to a single one:

  update public.users
  set username = regexp_replace(username, '[._-]{2,}', '.', 'g')
  where username ~ '[._-]{2}';

Add a comment explaining why this runs first.

=== 2. REPLACE THE CHECK CONSTRAINT ===

Drop the existing username format constraint on public.users and
recreate it with the extra condition. Find the current constraint's
real name by reading
supabase/migrations/20260815061951_usernames.sql — do not guess it.

Write the new condition as a SEPARATE line rather than folding it into
the regex:

  and username !~ '[._-]{2}'

It is far easier to read that way, and a future reader can see at a
glance what rule was added.

=== 3. UPDATE is_username_available() ===

That function has its own copy of the format check. If you change the
constraint but not the function, a student typing "rahul..sharma" would
see "available", then get a raw database error on submit.

Use CREATE OR REPLACE FUNCTION and change ONLY the format condition.
Leave the reserved-word check, the taken check, the 30-day cooling-off
check, the SECURITY DEFINER marker and the pinned search_path exactly
as they are.

HARD CONSTRAINTS:
- Write ONLY into that one migration file.
- Do NOT run any supabase command.
- Do NOT change generate_username() or suggest_usernames(). Both
  already collapse runs of separators to a single dot, so they cannot
  produce a handle that breaks the new rule. Read them and confirm
  this before deciding not to change them — say in your response what
  you checked.
- Do NOT touch otp_requests or anything else from the previous
  migration.

When you finish, print the file path and state the exact old and new
format conditions side by side.
```

---

## ▶ CC-3 — Rate limits and the circuit breaker

```
Read docs/PHASE_2_RUNBOOK.md Part 2.2 for the design and the numbers,
Part 2.3 for the cleanup jobs, and Part 2.4 for the circuit breaker.

TASK: Add rate limiting to requestOtp in
  backend/src/modules/auth/auth.controller.js
and register the cleanup jobs in
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
IP limit would lock out a whole college by mid-morning.

=== 2. THE FOUR CHECKS, IN THIS ORDER ===

All of them run BEFORE calling Supabase. A blocked request must not
send an email and must not create an auth user.

  a) CIRCUIT BREAKER — check this FIRST, before anything else.
     Count ALL rows in otp_requests from the last hour, regardless of
     email, device or ip. If that count is over a ceiling defined as a
     named constant at the top of the file:

       const OTP_HOURLY_CEILING = 2000;

     ...then return 503 with { "error": "SERVICE_BUSY" } and
     console.error a LOUD warning including the actual count.

     This is a safety net, not a user-facing limit. It should never
     fire in normal use. If it does, something is wrong and the log
     line is how we find out. Make that log impossible to miss.

     Define the ceiling as a named constant so it can be found and
     changed in one place.

  b) Email cooldown
     Count otp_requests rows for lower(email) in the last 24 hours.
     If that count is >= 3, find the most recent row. If it was less
     than 60 seconds ago, return 429 with retry_after_seconds set to
     the whole seconds remaining.

  c) Email daily cap
     If that same 24-hour count is >= 10, return 429. Compute
     retry_after_seconds from the OLDEST row in the window — that is
     when a slot actually frees up. Rolling window, not calendar day.

  d) Device daily cap
     Only if a device id is present. Count otp_requests rows for it in
     the last 24 hours. If >= 20, return 429, again computing
     retry_after_seconds from the oldest row.

  b, c and d ALL return the same error code: RATE_LIMITED, always with
  retry_after_seconds. Do NOT invent three different codes — the
  website shows one countdown and does not need to know which fired.

  The circuit breaker is different: 503 SERVICE_BUSY, because it is not
  the student's fault and there is nothing they can do about it.

=== 3. RECORD THE REQUEST ===

Only after all four checks pass AND Supabase accepted the request,
insert one row into otp_requests: email lowercased, device id, ip.

If that insert fails, log the error but STILL return success to the
student. A failed audit write must never break somebody's login.

=== 4. THE CRON JOBS ===

In backend/src/utils/cronJobs.js, next to the existing
cleanup_demo_users job, add:

  - cleanup_unverified_users()  — every hour
  - cleanup_otp_requests()      — once a day

Copy the structure of the existing job exactly, including its try/catch
and its console logging. Log how many rows each one deleted, so the
server log shows the job actually doing something.

=== 5. UPDATE backend/API.md ===

On the request-otp entry, document:
  - the optional X-Device-Id header
  - 429 { "error": "RATE_LIMITED", "retry_after_seconds": <int> }
  - 503 { "error": "SERVICE_BUSY" }
  - add both codes to the error table at the top of the file

HARD CONSTRAINTS:
- Modify ONLY auth.controller.js, cronJobs.js and backend/API.md.
- Do NOT touch utils/respond.js, middleware/ or config/ — frozen
  shared infrastructure.
- Use sendError() from utils/respond.js for every error response.
- Do NOT change any existing requestOtp behaviour beyond adding these
  checks. The domain validation, the Supabase call and the success
  response must all behave exactly as they do now.

When you finish, list each limit, its threshold, and the line where it
is checked.
```

---

## ▶ CC-4 — Pass the CAPTCHA token to Supabase

```
Read docs/PHASE_2_RUNBOOK.md Part 2.4 and Block E.

CONTEXT: We are adding Cloudflare Turnstile to the OTP request, so a
script cannot flood us with signups for invented email addresses. The
browser gets a token from the Turnstile widget and sends it to our
backend. Our backend passes it on to Supabase, which verifies it with
Cloudflare using a secret key stored in the Supabase dashboard.

The token travels: browser -> our Express backend -> Supabase.

TASK: In backend/src/modules/auth/auth.controller.js, make requestOtp
accept and forward a CAPTCHA token.

1. Read `captchaToken` from the request body.

2. Pass it to Supabase in the options object:

     await supabase.auth.signInWithOtp({
       email,
       options: {
         shouldCreateUser: true,
         captchaToken,
       }
     });

3. HANDLE A MISSING TOKEN CAREFULLY. Right now the mobile app does not
   send one, and Turnstile is not yet enabled in the Supabase
   dashboard. So:
     - if captchaToken is missing, do NOT reject the request yourself
     - just pass undefined through to Supabase

   Supabase enforces it once the dashboard setting is on. Until then
   everything keeps working. That ordering is deliberate — it lets us
   deploy the code first and flip the setting second, so the live site
   never breaks in between.

4. When Supabase rejects a request because of a bad or missing captcha,
   its error message mentions captcha. Detect that and return a clear
   400 { "error": "CAPTCHA_FAILED" } instead of letting it fall through
   to a generic 500. A student seeing "internal server error" cannot
   act; a specific code lets the website ask them to try again.

5. Where does the check go in the order? AFTER the circuit breaker and
   the rate limit checks from CC-3, and immediately before the Supabase
   call — because the token is only verified by Supabase itself, so
   there is nothing for us to check earlier.

6. Update backend/API.md for request-otp: the new optional
   captchaToken body field, and the 400 CAPTCHA_FAILED response.

HARD CONSTRAINTS:
- Modify ONLY auth.controller.js and backend/API.md.
- Do NOT add any npm package. Supabase handles verification; we only
  forward the token.
- Do NOT put the Turnstile SECRET key anywhere in this repo. It lives
  only in the Supabase dashboard. If you find yourself wanting an env
  var for it, stop — that means you have misunderstood the flow, so say
  so instead of guessing.
- Do NOT reject requests that arrive without a token. Supabase decides
  that, once the dashboard setting is enabled.
```

---

## ▶ CC-5 — A local-only seed script

```
Read docs/PHASE_2_RUNBOOK.md Block F.

CONTEXT: backend/scripts/seedDemo.js fills the DEMO university, and it
is allowed to run against production with an explicit opt-in. That is
right for investor demos but useless for testing campus isolation,
because everything lives in one tenant.

We need a second script that fills the REAL universities with test data
on the LOCAL database only.

TASK: Create backend/scripts/seedLocal.js.

=== 1. THE HARDEST POSSIBLE GUARD ===

This script writes to real universities. It must NEVER run against
production, and unlike seedDemo.js there is NO opt-in, no environment
variable, and no flag. If SUPABASE_URL is not local, it refuses and
exits.

  const url = process.env.SUPABASE_URL || '';
  if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
    console.error('\\n❌ seedLocal.js is LOCAL ONLY and has no override.');
    console.error('   SUPABASE_URL =', url || '(not set)');
    process.exit(1);
  }

Put a comment above it saying the absence of an override is deliberate:
seedDemo.js can reach production because it only touches one isolated
tenant; this one cannot, because it touches real ones.

=== 2. WHAT TO CREATE ===

For EACH real university already in the database (read them from the
universities table — do NOT create universities, seed.sql does that,
and do NOT hardcode their ids):

  - 6 students with realistic Indian names, valid usernames, and
    emails at that university's actual domain
  - each with is_profile_complete = true, a username, and a password
    set via supabase.auth.admin.updateUserById so they can actually log
    in. Use one shared test password and PRINT IT at the end so we can
    use it.
  - 8 products spread across those students, with realistic titles,
    prices in rupees, and categories that already exist in the app
  - some product_likes and product_saves between them
  - a handful of messages between two students on the same campus

SKIP the demo university entirely — seedDemo.js owns that one. Filter
it out by its domain, demo.yahora.com.

=== 3. USERNAME RULES ===

Every generated username must satisfy the CURRENT rules:
  ^[a-z][a-z0-9._-]*$, 3 to 25 characters, and NO two separators in a
  row (the migration from CC-2 added that last part).

So "rahul.sharma" and "rah.ul.sharma" are fine; "rahul..sharma" is not.
Write them out by hand in a list rather than generating them, so you
can see they are all valid.

=== 4. IDEMPOTENT ===

Running it twice must not create duplicates. Delete this script's own
users first — identify them by their email domain matching a real
university AND a marker you control, for example every seeded email
ending in '+seed@'. Then insert fresh.

Do NOT delete every user in a real university. Somebody may have signed
up locally by hand to test something, and losing their account every
time they reseed would be maddening.

=== 5. SUMMARY OUTPUT ===

At the end print: which universities were seeded, how many students and
products each got, and the shared test password.

HARD CONSTRAINTS:
- Create ONLY backend/scripts/seedLocal.js.
- Do NOT modify seedDemo.js in this task.
- Do NOT create, modify or delete rows in universities, courses or
  specializations. Read them only.
- Do NOT run the script.
```

---

## ▶ CC-6 — Make seedDemo safe for production

```
Read docs/PHASE_2_RUNBOOK.md Block G in full before changing anything.
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
  b) ZERO rows: nothing has been seeded yet. Skip the delete entirely
     and continue to the insert.
  c) MORE THAN ONE row: abort with a loud error. That should be
     impossible, and it means something is wrong that a script must not
     paper over.
  d) EXACTLY ONE row: delete from public.users where university_id
     equals that specific resolved id.

Never write a delete that could match a real campus. Never delete by
name, by pattern, by LIKE, or by anything except that one resolved
uuid.

Products, messages, likes and comments all cascade from users, so
deleting the demo users is enough. Do NOT write separate deletes for
those tables — more delete statements means more chances for one of
them to be wrong.

Print a count of what was deleted before starting the insert.

=== 3. CHECK THE USERNAMES STILL PASS ===

A migration now bans two consecutive separators in a username
(^[a-z][a-z0-9._-]*$, 3-25 chars, and no '..' '__' '--' '._' etc).

Read every demo handle in this script and confirm each one still
passes. Fix any that do not. Report which ones you changed.

=== 4. REPORT, DO NOT CHANGE ===

Tell me whether the script inserts into or updates the universities,
courses or specializations tables.

On local those are seeded by supabase/seed.sql. On production they
already exist with REAL data. If this script would insert or modify a
real university, course or specialization row, STOP and tell me. Do not
fix it yourself — I need to see it first.

=== 5. PRINT A SUMMARY AT THE END ===

A short table: rows deleted, users created, products created, messages
created, and the demo university uuid it used. When this runs against
production I want to read that output and know immediately whether it
did what I expected.

HARD CONSTRAINTS:
- Modify ONLY backend/scripts/seedDemo.js.
- Do NOT run the script.
- Do NOT change what demo content it creates — same 15 students, same
  products, same messages. Only the guard, the idempotency and any
  invalid usernames change.
- Every write in this script must be scoped to the demo university. If
  you find one that is not, report it instead of fixing it.
```

---

# ══════════════════════════════════════════
# TRACK 3 — NEERAJ: what you do by hand
# ══════════════════════════════════════════

## N-BLOCK A — Fix the username help text (start here, 20 minutes)

**Nothing blocks this.** Do it while Vishwajeet works on the migrations.

### What is wrong

Open `frontend/src/pages/onboarding/onboarding.jsx` and find **line 75**. It is inside the `USERNAME_STATUS_COPY` object:

```js
invalid:
  "3–20 characters: lowercase letters, numbers, . or _ — not at the start, the end, or doubled.",
```

That sentence is shown to a student when their chosen handle is rejected for being badly formatted. It describes rules from an early draft of Phase 1, and **it has been wrong for a while**.

### What the rules actually are — after this phase

Vishwajeet's migration in Block C changes them, so here is the final version you should describe:

```
^[a-z][a-z0-9._-]*$      3 to 25 characters      no two separators in a row
```

In plain words:

| Rule | Example |
|---|---|
| Allowed characters: lowercase letters, digits, `.` `_` `-` | `rahul.sharma-1` ✅ |
| Length 3 to 25 | `ab` ❌ too short |
| **First character must be a letter** | `9rahul` ❌ |
| Last character can be any allowed character | `rahul.` ✅ |
| **No two separators in a row** | `rahul..sharma` ❌ · `rah.ul.sharma` ✅ |
| Uppercase is silently lowercased as they type | typing `Rahul` gives `rahul`, with no error |

### Comparing against what the message says

| The message claims | The truth |
|---|---|
| 3–20 characters | 3–**25** |
| letters, numbers, `.` or `_` | also **`-`** |
| separator not at the end | at the end is **fine** — `rahul.` works |
| separator not doubled | ✅ this one is now **correct again**, after Block C |
| *(says nothing about the first character)* | must be a **letter** — this is the rule people actually hit |

### Why this matters

Picture a student typing `9rahul`.

The server rejects it, correctly, because it starts with a digit. But the message they read talks about dots and underscores — neither of which they used. They cannot work out what is wrong.

They will try `9_rahul`. Rejected. `9.rahul`. Rejected. Then they give up and take a suggestion they do not like.

### The good news

This is the **only** place in the whole frontend where the rules are written down twice.

I searched `frontend/src/` for a validation regex and there is none. Your onboarding page sends the handle to the server and displays whatever reason comes back. That was the right call — one set of rules, in one place — and it is exactly why only this sentence drifted while everything else stayed correct.

Line 397 of the same file already lowercases the input silently as the student types. That is correct. Do not change it.

### What to write instead

Something like:

```js
invalid:
  "3–25 characters. Start with a letter, then use lowercase letters, numbers, dots, underscores or hyphens — no two in a row.",
```

Lead with "start with a letter", because that is the rule most likely to be what went wrong.

### ⏳ One ordering note

The "no two in a row" part is only true **after Vishwajeet's Block C migration is merged**. If you write the new text before that lands, then for a day or so the message will say `rahul..sharma` is invalid while the server still accepts it.

That is a harmless, short-lived mismatch — nobody is using your local build but you. But if you would rather avoid it, write everything except that clause now, and add it once Handoff A arrives.

Run **N-CC-1** from Track 4.

### ✔ Check

Start the site and go to onboarding:

- [ ] 👁️ Type `9rahul` → the message tells you it must start with a letter
- [ ] 👁️ Type `Rahul` → it silently becomes `rahul`, with no error
- [ ] 👁️ Type `rahul-sharma` → accepted
- [ ] 👁️ Type `rah.ul.sharma` → accepted
- [ ] 👁️ Type `rahul..sharma` → rejected *(only after Block C is merged)*

---

## N-BLOCK B — Device ID and the OTP cooldown

**Start after Handoff A arrives.**

### B1. What a device ID is, and why we need one

Vishwajeet's backend now limits how many OTPs can be requested. One of those limits is meant to be "per machine".

The problem: a server cannot reliably tell machines apart. Everyone on the same campus Wi-Fi arrives with the same IP address — that is NAT, explained in Part 2.2. If we limited by IP, twenty students logging in would lock out the whole college for the day.

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

`crypto.randomUUID()` gives something like `8f14e45f-ceea-4d5b-b1f2-9c3a7e0d1b62`. It is random, unique, and generated on the device — nothing is sent anywhere to create it.

Two students on the same Wi-Fi now have different IDs, so their limits are separate.

### B2. Three things to get right

**1. It is not a security feature.** Anybody can open DevTools, clear `localStorage`, and get a fresh ID in a second. It stops accidental loops and lazy scripts, not somebody determined. The real defence against a determined attacker is the Turnstile widget in N-Block C.

**2. It contains nothing personal.** A random number generated on the device, never linked to a name or an email. This is not tracking.

**3. It must survive logging out.** Do not clear it in your sign-out code. If it resets every logout, the limit it feeds does nothing at all.

### B3. Where the file goes

`frontend/src/config/deviceId.js` — next to `supabaseClient.js`, which is where your project already keeps modules like this. Do not create a `lib/` folder; you do not have one.

Then add the header to the `request-otp` call in `frontend/src/pages/auth/Auth.jsx`, around line 171:

```js
headers: {
  'Content-Type': 'application/json',
  'X-Device-Id': getDeviceId(),
}
```

### B4. The countdown

When the backend refuses, it sends back:

```json
429  { "error": "RATE_LIMITED", "retry_after_seconds": 47 }
```

**There is one error code for all three server-side limits.** You do not need to work out which fired. Show one countdown.

> ### 🎉 You already built this
>
> `Auth.jsx` has every piece, from the password-tab lockout:
>
> - `formatWait(totalSeconds)` around line 53 — turns `47` into `0:47`
> - `lockoutSeconds` state around line 89
> - the `useEffect` around line 105 that ticks it down once a second
>
> **Reuse them.** Add matching state for the OTP tab — `otpCooldownSeconds` or similar — and run it through the same `formatWait` and the same ticking pattern.
>
> Do not write a second timer. Two timers doing the same job in one file is how one small bug quietly becomes two.

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

**Disable the button while counting.** Do not leave it clickable and then show an error. A disabled button explains itself; an error suggests the student did something wrong.

**Use `m:ss` for anything over a minute.** `formatWait` already does this. A raw `retry_after_seconds: 3600` means nothing to a person; `59:31` does.

**If the wait is over ten minutes, show a sentence instead of a timer.** Something like *"Too many attempts. Please try again later."* Nobody watches a twenty-minute countdown, and showing one just looks broken.

**Start a 60-second countdown after a successful send too** — not only after a `429`.

That last one is the most valuable and the easiest to miss. If the button is already counting down after their first code, the student physically cannot spam it. They never hit the limit and never see an error. Preventing the problem is much better than reporting it.

### B5. Make the countdown survive a page refresh

If a student refreshes mid-countdown, the timer would reset to zero and the button would look clickable — even though the server would still refuse.

Fix it by storing **when the wait ends**, not **how much is left**:

```js
// when you start a cooldown:
localStorage.setItem(
  'yahora_otp_cooldown_until',
  String(Date.now() + seconds * 1000)
);

// when the component mounts:
const until = Number(localStorage.getItem('yahora_otp_cooldown_until') || 0);
const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
```

**Why a timestamp and not a number of seconds.** If you saved "47 seconds left" and the student came back three minutes later, you would restore 47 seconds and make them wait all over again. A timestamp is a fixed point in time, so the maths comes out right no matter when they return.

### B6. Handle the new 503

The backend can also return:

```json
503  { "error": "SERVICE_BUSY" }
```

This is the circuit breaker from Part 2.4. It means the whole platform has sent too many OTPs this hour and has stopped, deliberately, to cap the damage from a possible attack.

It is **not** the student's fault and there is nothing they can do differently, so do not show a countdown or blame them. Just:

> *"We're having trouble sending codes right now. Please try again in a few minutes."*

You will almost certainly never see this in normal use. It is here so that if it ever does happen, the page says something sensible instead of "internal server error".

Run **N-CC-2** from Track 4.

### ✔ Check

- [ ] 👁️ Ask for a code four times quickly → the button disables and counts down
- [ ] 👁️ Wait for zero → the button works again
- [ ] 👁️ Start a countdown, then refresh the page → it carries on from roughly the right number, it does not reset
- [ ] 👁️ DevTools → Application tab → Local Storage → `yahora_device_id` exists. Log out and back in → **same value**

---

## N-BLOCK C — The Turnstile widget

This is the browser half of the CAPTCHA from Part 2.4. Vishwajeet does the backend half.

### C1. What you are adding, and why it will feel like nothing

Cloudflare Turnstile is a small widget that decides whether the visitor is a person or a script.

You have met the annoying kind of CAPTCHA — pick all the traffic lights. **This is not that.** In "Managed" mode Turnstile is usually completely invisible: it watches how the browser behaves and lets real people through with no puzzle at all. Most students will never know it is there.

It matters because it is the only thing on this list that actually stops the attack in Part 2.4 — somebody scripting thousands of signups with invented email addresses, which costs real money and can damage your ability to send email at all.

### C2. Get the site key

Vishwajeet will send you a **site key** — a string starting `0x4AAAAAAA...`.

There are two keys in Turnstile and only one of them is yours:

| Key | Where it lives | Who has it |
|---|---|---|
| **Site key** | Your React code and `frontend/.env` | You. It is public by design. |
| **Secret key** | The Supabase dashboard only | Vishwajeet. Never in this repo. |

**The site key being public is fine and expected.** It only says "this widget belongs to Yahora". The actual verification happens between Cloudflare and Supabase using the secret key, which never touches a browser. You will meet this same split again with payment providers.

Put it in `frontend/.env`:

```
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...
```

Vite requires the `VITE_` prefix, otherwise the value is not exposed to your code at all.

### C3. Add the widget

Install the React wrapper:

```bash
cd frontend
npm install @marsidev/react-turnstile
```

The idea, in outline:

```jsx
import { Turnstile } from '@marsidev/react-turnstile';

const [captchaToken, setCaptchaToken] = useState('');
const turnstileRef = useRef(null);

// ...in the OTP form, above the send button:
<Turnstile
  ref={turnstileRef}
  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
  onSuccess={setCaptchaToken}
  options={{ theme: 'light' }}
/>
```

Then send the token with the request:

```js
body: JSON.stringify({ email, captchaToken })
```

### C4. Four details that will bite you if you skip them

**1. A token can only be used once.** After every request — successful or failed — reset the widget so it issues a fresh one:

```js
turnstileRef.current?.reset();
```

Forget this and the second attempt fails with a confusing error, because you sent a token that was already spent.

**2. Tokens expire after about five minutes.** If a student loads the page, walks away, and comes back, the token is stale. Use the `onExpire` callback to clear it from state and let the widget refresh itself.

**3. Disable the send button until a token exists.** Otherwise a fast student clicks before the widget has finished, and the request goes out with an empty token.

**4. Put it on the OTP form only, not the password form.** The attack we are stopping is fake account creation, which only happens through OTP. Adding it to the password login would slow down every returning student for nothing.

### C5. Where to put the widget visually

Directly above the send button, centred, with a bit of space around it.

In Managed mode it usually renders as a small bar that says "Success!" for a moment, then shrinks. Sometimes it renders nothing at all. So the layout must not break either way — **do not** reserve a fixed 65px of height and leave a hole when nothing appears.

Run **N-CC-3** from Track 4.

### ✔ Check

- [ ] 👁️ Load the login page → the widget appears briefly, or not at all, and the layout does not jump
- [ ] 👁️ Request a code → it works normally
- [ ] 👁️ Request a second code → **it still works**. If the second one fails, you are not resetting the widget (detail 1 above).
- [ ] 👁️ Test at 375px width → the widget does not overflow the card
- [ ] 👁️ Check `frontend/.env` is in `.gitignore` — `git status` must not show it

---

## N-BLOCK D — Before you open your pull request

- [ ] `git diff --stat` shows changes only under `frontend/`
- [ ] No password is ever written to `localStorage`, `sessionStorage`, or `console.log`
- [ ] `frontend/.env` is **not** committed — only the site key belongs there, but the file itself still stays out of Git
- [ ] Everything tested at 375px (DevTools → the phone icon → iPhone SE)
- [ ] Post a short note in `docs/CHANGELOG.md` saying what you built

```bash
git checkout -b neeraj
git add frontend/
git commit -m "feat(web): device id, OTP cooldown, Turnstile widget, username help text"
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
Read docs/PHASE_2_RUNBOOK.md N-Block A.

CONTEXT: After the migration in Block C, the database enforces this
username format:

  regex:  ^[a-z][a-z0-9._-]*$
  length: 3 to 25 characters
  plus:   no two separators in a row (no '..' '__' '--' '._' '_-' etc)

In plain words:
  - allowed characters: a-z, 0-9, dot, underscore, hyphen
  - length 3 to 25
  - the FIRST character must be a letter a-z, so "9rahul" is rejected
  - the LAST character may be any allowed character, so "rahul." is FINE
  - two separators in a row are NOT allowed: "rahul..sharma" is
    rejected, but "rah.ul.sharma" is fine
  - uppercase is silently converted to lowercase as the student types,
    and is never shown as an error
  - spaces are outside the allowed set so they cannot be typed

THE BUG: frontend/src/pages/onboarding/onboarding.jsx line 75, inside
USERNAME_STATUS_COPY, still describes an old draft of the rules:

  "3–20 characters: lowercase letters, numbers, . or _ — not at the
   start, the end, or doubled."

Wrong on the length, missing the hyphen, wrong that a separator cannot
end a handle, and silent about the rule people actually hit — that the
first character must be a letter.

TASK:

1. Rewrite that string so it describes the real rules accurately and
   plainly. LEAD with "start with a letter", because that is the rule
   most likely to be what went wrong. Keep it to one sentence a student
   can act on.

2. Search the whole of frontend/src/ for any OTHER place that describes
   or validates the username format — a regex, a maxLength attribute, a
   placeholder, a tooltip, a label, or a comment. Report everything you
   find, with file and line number, and say whether it is correct or
   stale.

   I believe there is no client-side validation regex anywhere and that
   line 75 is the only stale copy, but check rather than assume.

3. Do NOT add a client-side format regex. The current design sends the
   handle to the server and shows whatever reason comes back, so the
   rules live in exactly one place. That is deliberate and correct.
   Adding a second copy is what caused this bug in the first place.

4. Line 397 already lowercases the input silently as the student types.
   Leave it exactly as it is — that is the correct behaviour.

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
Read docs/PHASE_2_RUNBOOK.md N-Block B and Part 2.2, then read
backend/API.md for POST /api/auth/request-otp.

TASK, four parts.

=== 1. CREATE frontend/src/config/deviceId.js ===

Export getDeviceId(). It reads 'yahora_device_id' from localStorage,
generates one with crypto.randomUUID() if missing, saves it, returns it.

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

One error code for all three server-side limits. Do not try to tell
them apart. Show one countdown.

REUSE WHAT IS ALREADY IN THIS FILE. Auth.jsx already has, for the
password tab lockout:
  - formatWait(totalSeconds)  around line 53
  - lockoutSeconds state      around line 89
  - a useEffect that ticks it down  around line 105

Add matching state for the OTP tab (otpCooldownSeconds or similar) and
run it through the SAME formatWait and the SAME ticking pattern. Do NOT
write a second timer implementation or a second formatter.

Behaviour:
  - Disable the send/resend button while counting, re-enable at zero.
    Do NOT leave it clickable and show an error instead — a disabled
    button explains itself.
  - Show the time with the existing formatWait, so it reads 0:47.
  - If the remaining wait is over 10 minutes, show a sentence instead
    of a timer: "Too many attempts. Please try again later."
  - ALSO start a 60-second countdown after a SUCCESSFUL send, not only
    after a 429. If the button is already counting down, the student
    cannot spam it and never sees an error at all.

  - The countdown must survive a page reload. Store the TARGET
    TIMESTAMP in localStorage (Date.now() + seconds * 1000), NOT the
    remaining seconds, and recompute what is left on mount.

    Storing remaining seconds is wrong: if the student returns three
    minutes later you would restore the old number and make them wait
    again. A timestamp is absolute, so the maths is right whenever they
    come back.

=== 4. HANDLE THE NEW 503 ===

The backend can also return:

  503 { "error": "SERVICE_BUSY" }

This is a platform-wide circuit breaker, not the student's fault, and
there is nothing they can do differently. Do NOT show a countdown and
do NOT blame them. Show:

  "We're having trouble sending codes right now. Please try again in a
   few minutes."

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

## ▶ N-CC-3 — The Turnstile widget

```
Read docs/PHASE_2_RUNBOOK.md N-Block C and Part 2.4.

CONTEXT: We are adding Cloudflare Turnstile to the OTP request so a
script cannot flood us with signups for invented email addresses. The
widget gives the browser a token; we send it to our backend; our
backend passes it to Supabase, which verifies it with Cloudflare.

TASK:

=== 1. INSTALL ===
  npm install @marsidev/react-turnstile
(inside the frontend/ directory)

=== 2. THE SITE KEY ===
Read it from import.meta.env.VITE_TURNSTILE_SITE_KEY.

Add the variable to frontend/.env.example with a placeholder value so
the next person knows it is needed. Do NOT put a real key in any file
that is committed.

The site key is PUBLIC by design — it only identifies the widget. The
SECRET key lives in the Supabase dashboard and must never appear
anywhere in this repo. If you find yourself wanting an env var for a
secret key, stop and say so: it means the flow has been
misunderstood.

=== 3. RENDER IT — OTP FORM ONLY ===
Put the widget directly above the send button on the College Email &
OTP form.

Do NOT put it on the Username & Password form. The attack we are
stopping is fake account creation, which only happens through OTP.
Adding it to password login would slow down every returning student for
no benefit.

=== 4. SEND THE TOKEN ===
Include captchaToken in the request-otp body:
  body: JSON.stringify({ email, captchaToken })

=== 5. FOUR DETAILS THAT WILL BREAK IT IF MISSED ===

  a) A token can only be used ONCE. After every request, successful or
     failed, call turnstileRef.current?.reset() so the widget issues a
     fresh one. Miss this and the SECOND attempt fails with a confusing
     error because the token was already spent.

  b) Tokens expire after about 5 minutes. Use the onExpire callback to
     clear the token from state so the widget refreshes itself.

  c) Disable the send button until a token exists, otherwise a fast
     student clicks before the widget is ready and sends an empty
     token.

  d) In Managed mode the widget often renders nothing visible at all.
     The layout must not break either way — do NOT reserve a fixed
     height that leaves a hole when nothing appears.

HARD CONSTRAINTS:
- Change only files under frontend/ (src/ plus .env.example and
  package.json for the one dependency).
- Do NOT touch backend/, supabase/ or mobile/.
- Do NOT commit a real site key.
- Use the CSS variables already in frontend/src/styles/global.css.
- Must work at 375px width without the widget overflowing the card.

When you finish, confirm the widget is on the OTP form only, and state
where you call reset().
```

---

# PHASE 2 SIGN-OFF

Go through this together when you think you are done.

**Production wipe**
- [ ] Before-counts saved to a file, and the names in the user list were all recognised
- [ ] After the wipe, `auth.users`, `users`, `products`, `messages` and `posts` all show `0`
- [ ] `universities`, `courses` and `specializations` are **unchanged**
- [ ] A fresh signup works end to end on production: OTP → onboarding → username → password → dashboard
- [ ] Logging in with username and password works on that new account

**OTP protection**
- [ ] The 4th request inside a minute returns `429` with a countdown, and works again after 60 seconds
- [ ] The 21st request from one device returns `429`, and a different device ID still works immediately
- [ ] The circuit breaker returns `503` and logs loudly (tested with the ceiling temporarily lowered)
- [ ] **The ceiling is back to `2000`**
- [ ] Turnstile is live: the login page works normally, but a `fetch` from the console does not
- [ ] The cleanup job removes unverified accounts older than 24 hours
- [ ] `X-Device-Id` is optional — the mobile app, which does not send it, still works

**Usernames**
- [ ] `rahul..sharma` is rejected; `rah.ul.sharma` is accepted
- [ ] `rahul._sharma` is also rejected
- [ ] The onboarding help text describes the real rules, leading with "start with a letter"

**Test and demo data**
- [ ] `seedLocal.js` refuses to run against anything but local, with no override
- [ ] Local has students and listings in IIITDM, NIET **and** the demo university
- [ ] Logged in as an IIITK test student, you can see IIITK listings and no NIET or demo ones
- [ ] `seedDemo.js` ran twice on local and produced 15 demo students, not 30
- [ ] On production: the demo university has 15 students, and every real campus count is unchanged
- [ ] Demo login shows demo products; a real student sees none of them

**Documentation**
- [ ] `backend/API.md` covers `X-Device-Id`, `captchaToken`, `RATE_LIMITED`, `SERVICE_BUSY` and `CAPTCHA_FAILED`
- [ ] `docs/CHANGELOG.md` has Handoff A, Neeraj's note, and the standard local reset sequence
- [ ] `docs/CURRENT_STATE.md` — the `shouldCreateUser` item marked resolved

**Carried into Phase 3**
- [ ] **`docs/DESIGN.md` must be adopted or retracted.** Phase 3 is all UI, so this now genuinely blocks it. Both `CLAUDE.md` files say "read DESIGN.md before ANY UI work", but DESIGN.md describes a rebrand that was never built and names two files that do not exist. Left as it is, Claude Code will invent a third look.
- [ ] Mobile sends no `X-Device-Id` and has no CAPTCHA — both need adding in Phase 3
- [ ] Move to a custom SMTP provider before launch — the built-in Supabase email service cannot handle hundreds of colleges

---

*Phase 3 is usernames in the user interface: the `/username` profile route, handles shown across both the website and the app, a change-username screen, and user search. Ask for it when you are ready.*
