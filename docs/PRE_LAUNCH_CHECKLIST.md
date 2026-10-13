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

## Seed photos

**Phase 9:** mirror all seed photos into the Supabase products bucket and point the seeds at them.

Why: seed images are hotlinked from Unsplash, Wikimedia and Flickr, and four Unsplash links
already died in Phase 6A.

---

## Activity and recommendations (not in Phase 6B)

Added 2026-10-13. **The launch-day part is in "When" below:** the activity log has to be
recording from launch day, because history that was never recorded can't be recovered.

**The rule behind all of this:** the public view count and "interest" are two different
numbers with two different jobs.

| | Public view count (6B) | Private activity log (later) |
|---|---|---|
| What it answers | How many different students looked at this? | What is each person interested in? |
| Who sees it | Everyone | Only the backend |
| Priya opens the cycle 3 times and the cooler 7 times | +1 each | 3 rows and 7 rows, with times |
| Anonymous opens from WhatsApp | Not counted | Counted separately, as "link opens" |
| Must it be hard to fake? | Yes, because people trust it | Less, because nobody sees it |

**Rule of thumb:** keep noisy numbers private, and keep public numbers hard to fake.
People fake numbers they can show off.

### Recommendations: later, and simple first

- **Not needed now.** Each campus has a few hundred to a few thousand live listings, and
  students can only buy on their own campus. Newest first, plus filters and search, is enough.
- **When a campus has more listings than people can browse**, start with rules and SQL:
  - **Similar items:** same category, similar price, same campus.
  - **Popular on your campus this week:** the most saves and messages in the last 7 days.
  - **"Students who saved this also saved…":** count which items get saved together.
    Example: 4 students saved the cycle. 2 of them also saved a helmet, 1 a lock and
    1 a kettle, so the cycle's page shows the helmet first.
- **Machine learning comes last.** pgvector (already planned for semantic search) can
  power "similar items".

### Measuring interest: weigh actions more than opens

- Views are the weakest signal (called "implicit feedback"). Many opens can mean real
  interest, comparing, or just the app reloading.
- **Example scoring:**
  - A view is worth 1 point, and each repeat view of the same item is worth less
    (1, then ½, then ⅓, and so on).
  - A save is worth 5 points. Messaging the seller is worth 10.
  - Points halve every two weeks.
  - The cycle's 3 views: 1 + ½ + ⅓ ≈ **1.8**. The cooler's 7 views ≈ 2.6, plus 5 for the
    save and 10 for the message = **17.6**. The actions decide it, not the opens.
- **Second-hand items are one of a kind and disappear when sold.** So learn what someone
  wants by category and price range ("a cooler, ₹2–3k"), not by single items.
- **The best feature this leads to is saved-search alerts:** "A cooler was just listed on
  your campus." These need notifications (Phase 8).

### Shares and anonymous opens: separate, private numbers

- Anonymous opens never go into the public count. There's no way to count each person
  only once, so anyone could inflate it by refreshing, using incognito windows or
  running a script.
- **Measure popularity with three separate numbers:**
  1. **Shares.** When a logged-in student taps Share, record it, and count how many
     *different students* shared. This is the best popularity signal, because faking it
     needs verified accounts.
  2. **Link opens.** Count them on the backend's `/share/product/<id>` page, which every
     link from the Share button passes through. Three filters:
     - **Skip previews.** When a link is pasted, WhatsApp, Facebook or Telegram fetches the
       page to draw the preview card, and its user agent says so. That's a preview, not
       a person.
     - **Count each device once per listing per day.** Use a random ID stored in a cookie,
       like the Phase 2 OTP device ID.
     - **Cap each IP address only loosely.** A whole hostel can share one IP address.
  3. **Results.** How many of those visitors then logged in and opened the listing.
- **Show these to the seller only**, for example: "Shared by 6 students · 31 link opens
  this week". The filters cut noise but won't stop a determined faker. That's acceptable
  because these numbers are private.

### Privacy for the activity log

- **Backend-only**, like `product_views`: RLS on, and no grants to anon or authenticated.
- **Deleted with the account** (`on delete cascade`).
- **Kept for about six months.** Old interest says little.
- **Mentioned in the privacy policy**, as the DPDP Act requires.

### When

- **6B: no change.** The public count stays "different logged-in students".
- **Before launch (Phase 9, alongside rate limiting):** build the activity log (views,
  saves, likes, messages to sellers, shares, link opens) and link-open counting on the
  share page. Start recording on launch day. Production data from before launch is wiped
  anyway, and history that was never recorded can't be recovered.
- **After launch, once a campus has too many listings to browse:** add similar items,
  "popular on your campus", and saved-search alerts (after Phase 8). Rules and SQL first.

### How established companies do it

- **Amazon:** no public view count. The public number it does show is "1K+ bought in past
  month", based on purchases, the hardest action to fake. Your private browsing history
  drives "customers who viewed this also viewed".
- **YouTube:** your full watch history drives recommendations. Around 2012 it switched from
  ranking by views and clicks to ranking by watch time, because clickbait made views too
  easy to get. It does count anonymous views, but it filters them heavily and removes spam
  views later, so counts can even go down. That takes a large anti-fraud team.
- **eBay and Etsy:** sellers get detailed private stats. Buyers see only a few public
  signals, such as eBay's "X watching". eBay also offers saved searches with alerts.

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
