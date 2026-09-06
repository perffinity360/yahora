# Pre-launch checklist — launch blockers, email capacity and OTP limits

Started 2026-09-01, after Block D step 4. Owner: Vishwajeet.

**Why this file exists.** Our OTP rate limits were tuned against numbers that production
cannot deliver. Nothing is broken for development, so the fix is deliberately deferred —
but it must not be *forgotten*, and the reasoning is easier to trust written down than
re-derived at 2am on launch night. The file has since grown to hold **every** blocker
standing between us and launch, not only the email ones — see the list immediately below.

---

## Launch blockers — as of 4 Sep 2026

### 1. OTP ceilings are tuned to numbers production cannot deliver  ⛔
The original subject of this file. `OTP_HOURLY_CEILING` is 2,000/hour; Supabase stops
sending at 30/hour and Brevo's free tier at 300/day, so our circuit breaker is code that
cannot execute. Full measurements, the decision it is waiting on, and the five-minute
correctness fix to apply *now* are in the rest of this file, from
"Blocker 1 in detail" onwards.

### 2. Production CORS answers every origin  ⛔
`backend/src/app.js:69` — `if (isProduction) return callback(null, '*')`.
Any website can call our API from a user's browser. The comment at
line 35 describes this exact behaviour as the bug being fixed, so the
production branch contradicts its own documentation.

Not session-hijackable (we use bearer tokens, not cookies), but it
means anyone can drive `/api/auth/request-otp` from any page, which
undercuts the rate limiting and Turnstile work in Blocks D and E.

Fix: explicit allowlist for production containing the Netlify domain.
`allowedHeaders` at line 83 is already correct and shared across both
branches — do not touch it.

### 3. Community posts cannot be commented on
`public.comments` has `product_id` and no `post_id`, and there is no
post-comment table. Found while seeding demo engagement — the 10 demo
comments had to be attached to listings instead.

A campus feed where nobody can reply is a noticeboard, not a
community. Needs a migration and UI. Phase 3 scope, not a launch
blocker for the marketplace, but decide deliberately rather than by
omission.

### 4. `docs/DESIGN.md` describes a rebrand that was never adopted
Both `CLAUDE.md` files instruct Claude Code to read DESIGN.md before
any UI work. Phase 3 is entirely UI. Either adopt the rebrand or
retract the document — leaving it ambiguous means every Phase 3
session starts from a false premise.

### 5. Production/local divergence — one instance found and fixed
On 3 Sep, production had `yahoo.com` as IIT Tirupati's domain and
`gmail.com` as NIT Delhi's. Since `handle_new_user` assigns a
university by matching the email domain, any gmail signup would have
been enrolled as an NIT Delhi student — destroying the campus-verified
premise the whole product rests on. Corrected in the dashboard.

---

## Blocker 1 in detail — the numbers, measured (not assumed)

Read from the Supabase Management API on 2026-09-01 (`GET /v1/projects/{ref}/config/auth`).

| Layer | Limit | Where it is set |
|---|---|---|
| Brevo (our SMTP) | **300 emails/day** | Brevo account — free tier |
| Supabase | **30 emails/hour**, project-wide | Dashboard → Authentication → Rate Limits → "Rate limit for sending emails" |
| Supabase | **1s** minimum gap per address | `smtp_max_frequency`; NOT on the Rate Limits page — it is with the SMTP settings |
| Our code | `OTP_HOURLY_CEILING = 2000`/hour | `backend/src/modules/auth/auth.controller.js` |

**The mismatch:** our circuit breaker allows 2,000/hour. Supabase stops sending at 30.
So **limit (a) can never fire in production** — the 31st OTP in any hour fails at Supabase
instead, with a 429 whose message carries no seconds, so `retry_after_seconds` falls back
to 60 and tells the student to wait a minute for what may be an hour.

Note also 30/hour × 24 = 720/day, which is **more than double Brevo's 300/day**. The two
ceilings do not model each other. Supabase can happily accept sends that Brevo then refuses.

---

## Do these BEFORE launch

1. **Pick the Brevo plan** for expected launch-week volume. One OTP per signup, plus
   retries. This is the number everything else is derived from — do it first.
2. **Raise Supabase's hourly email limit** to what that plan sustains:
   Dashboard → Authentication → Rate Limits → "Rate limit for sending emails".
   Keep it at or below `plan_daily_limit / 24` so a busy hour cannot exhaust the day.
3. **Set `OTP_HOURLY_CEILING` just below that**, in `auth.controller.js`. The point of the
   breaker is a controlled `503 SERVICE_BUSY` of our own. If it sits above Supabase's cap it
   never runs and students meet an opaque Supabase 429 instead.
4. **Update `backend/API.md`** §request-otp — the measured-values table there carries today's
   numbers and will be stale.
5. **Re-run Block D** steps 4–6 after the change.

---

## Do this NOW — do not defer (5 minutes)

**Lower `OTP_HOURLY_CEILING` from 2000 to ~25**, below Supabase's current 30/hour.

Not a capacity change — a correctness one. As written, limit (a) is code that has never
executed and cannot execute. Setting it under 30 means the breaker is actually exercised
during Phase 2 testing, so we find out now whether `503 SERVICE_BUSY` works, rather than
discovering it during the first traffic spike we ever get. Raise it again at step 3 above.

---

## Watch for this during Phase 2 testing

**If OTP emails stop arriving, check Brevo's dashboard before debugging our code.**

At 300/day, heavy testing can exhaust the daily quota. When it does, Brevo refuses the send,
GoTrue returns a non-429 error, and our catch-all turns it into:

    500 {"error": "Internal server error while sending OTP."}

That is the *exact* symptom of the `max_frequency` bug fixed on 2026-09-01 — and of the dead
`SUPABASE_URL` lease before it. Three different causes, one indistinguishable 500. The
backend log has the real error; read it before assuming.

---

## ⚠ Never run `supabase config push`

We are linked (`supabase projects list` reports `linked: true`), so it is one command away.
`supabase/config.toml` now holds **local test values** — `max_frequency = "1ms"` and
`email_sent = 100` — chosen so Block D exercises *our* limiter rather than GoTrue's. Pushing
would overwrite production with a 1ms cooldown and an email ceiling above what Brevo can
actually send. Production auth config is changed in the dashboard, by hand, deliberately.

---

## What is already correct — do not "fix" these

- `smtp_max_frequency = 1s` in production is **fine**. Limit (b) ("3 free, then 60s") engages
  properly for human-paced retries; a student clicking resend is seconds apart, not
  milliseconds. It was worth checking — a 60s value there would have made (b) unreachable.
- The Block D burst script is a **local-only** test. Against production its four requests land
  inside the 1s gap and return `200, 429, 429, 429`. That is correct behaviour, not a
  regression. Local `max_frequency` is `1ms` precisely so the script tests limits b–d.
- OTP length (8), expiry (3600s) and the five per-5-minute / per-hour limits all match
  between local and production. No drift.
