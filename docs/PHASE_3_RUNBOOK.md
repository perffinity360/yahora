# Phase 3 Runbook — Closing the Launch Blockers

**Version 1.0 — 8 September 2026.**

---

# PART 0 — How many phases are left?

You asked. Here is the honest answer, with each phase sized to be roughly what Phase 2 was.

| Phase | Theme | Roughly |
|---|---|---|
| **3** ← you are here | Close the launch blockers: security holes, CORS, universities, mobile CAPTCHA, small fixes | 5–6 days |
| **4** | Mobile auth parity — password login, username selection, set-password. Plus pagination everywhere. | 5–6 days |
| **5** | Marketplace completeness — Mark as Sold rework, delete message, view-count fix, messages UX parity | 5–6 days |
| **6** | Community feed — the `posts` module, comments on posts, feed UI on both surfaces | 6–7 days |
| **7** | Social graph and notifications — follows, blocks, privacy, notifications table, push | 6–7 days |
| **8** | Reports, moderation, admin tooling, app store submission, full manual test pass | 5–6 days |

**Five phases after this one.** Six in total.

## A strategic note worth thinking about

You could launch after **Phase 5** rather than Phase 8.

At that point you would have: a working marketplace, both platforms, secure, with real universities. What you would *not* have is the community feed, follows, and notifications.

The argument for launching then: a marketplace that works and has real students on it teaches you more in two weeks than three more months of building would. You find out which features people actually miss, instead of guessing.

The argument against: your own original insight was that "a marketplace alone might not bring users back every day" — the community feed is what makes people open the app when they are not buying anything.

**My suggestion:** launch to **one or two campuses** after Phase 5 as a pilot. Keep building the community feed while real students use the marketplace. Then open to more campuses once the feed ships. You get real feedback without betting everything on a wide launch that has to be perfect.

You do not have to decide this now. Just know the option exists, because it changes what "done" means.

---

# PART 1 — Two decisions I need you to make first

Both of these poison work if left open. Take twenty minutes and settle them together.

## 1.1 DESIGN.md — my recommendation is to retract it

The situation: `docs/DESIGN.md` describes a rebrand — near-white paper, highlighter yellow, Khand and Instrument Sans, with Inter explicitly banned. It names two files, `src/theme/tokens.ts` and `src/styles/tokens.css`. **Neither file exists.** Both `CLAUDE.md` files tell Claude Code to read DESIGN.md before any UI work.

Meanwhile your actual shipped apps use purple `#800080`, pink and blue, with Inter and Bree Serif — consistently, on both platforms.

**My recommendation: delete DESIGN.md and write the real palette into both `CLAUDE.md` files as canonical.**

Here is the reasoning, and I want you to disagree if you think I have it wrong.

Adopting the rebrand means touching **every component on two platforms** — every colour, every font, every spacing token. That is not a design task, it is a full visual rewrite. And you would be doing it in the weeks immediately before launch, which is the single worst time to make a change that touches everything. Rebrands are also very hard to do halfway: a half-migrated app looks broken in a way that a consistently old-looking app does not.

Your current look is not a placeholder that somebody threw together. The purple palette is in `global.css`, it is used consistently, and the app looks coherent. It is a real brand, not a lack of one.

**And this is not a door you are closing.** A rebrand after launch is a normal, healthy thing that companies do all the time — and it is much easier when you can do it deliberately, with a designer, with no launch deadline, and with real students to show it to.

**What to actually do**, whichever way you decide:

If you retract (recommended):
1. `git rm docs/DESIGN.md` — or move it to `docs/archive/DESIGN-proposal-unadopted.md` with a header saying it was never adopted
2. In **both** `CLAUDE.md` files, delete the "read DESIGN.md before any UI work" line
3. Replace it with: *"The canonical palette is `frontend/src/styles/global.css` (web) and `mobile/src/theme` (app). Use only those tokens. Do not introduce new colours."*

If you adopt: that is Phase 8 work at the earliest, and it needs its own runbook. Do not start it inside another phase.

- [ ] **Decided:** ☐ retract ☐ adopt

## 1.2 Mobile CAPTCHA — you have three options, and I recommend the first

Your note is right and it is the thing that blocks mobile today: Turnstile is enabled on your production Supabase project, the Expo app sends no token, so **mobile login against production fails right now**.

Turnstile has no native React Native widget. It is a browser thing. So the options are:

**Option A — build a WebView-based Turnstile (recommended).**
You render a tiny local HTML page inside a `WebView`, that page loads the Turnstile script, and when it produces a token the page posts it back to your React Native code. This is the standard approach and it is well-trodden.

Cost: about a day, including testing on a real device.

**Option B — turn CAPTCHA off in production until mobile is ready.**
Simple, but it re-opens the exact hole you closed in Phase 2, and Part 2.4 of the Phase 2 runbook explains why that hole is expensive. Also, "until mobile is ready" tends to become "forever".

**Option C — develop mobile against local Supabase, deal with it at submission time.**
This lets mobile work continue today with no code change. But it does not solve the problem, it postpones it — and you find out whether your WebView approach works at the worst possible moment, the week you are submitting to the app stores.

**Recommendation: Option A, in this phase.** It is the only one that leaves you with a working product on both platforms, and a day of work now is much cheaper than discovering a problem during store submission. Block D covers it.

- [ ] **Decided:** ☐ A ☐ B ☐ C

---

# PART 2 — The work split, and how testing works

## 2.1 Who does what

You asked for an even split with the human testing going to Neeraj and the mobile work to you.

| Area | Owner |
|---|---|
| Mobile app (`mobile/`) | **Vishwajeet** |
| Database and migrations (`supabase/`) | **Vishwajeet** |
| Backend security fixes (`backend/src/modules/`) | **Neeraj** |
| CORS and app config (`backend/src/app.js`) | **Neeraj** |
| Website (`frontend/`) | **Neeraj** |
| **All human testing, both platforms** | **Neeraj** |

That works out roughly even: you have the mobile CAPTCHA plus the universities migration; Neeraj has the security holes, CORS, the campus switcher change, and the testing.

## 2.2 How Neeraj tests the mobile app without a mobile setup

This is worth spelling out, because it is easier than it sounds and it is the thing that makes the split work.

Neeraj does not need Xcode, Android Studio, or the Expo CLI. He needs **Expo Go on his Android phone** and to be in the same room as you — which he is.

Here is the arrangement:

```
Vishwajeet's MacBook                    Neeraj's Android phone
─────────────────────                   ──────────────────────
  npx expo start                              Expo Go app
        │                                          │
        │  prints a QR code                        │
        │  and a URL like                          │
        │  exp://192.168.1.7:8081                  │
        └──────── same Wi-Fi ──────────────────────┘
                        │
                  Neeraj scans the QR
                  and the app opens on his phone
```

**Setup, once:**

1. Neeraj installs **Expo Go** from the Play Store
   - ⚠️ Your notes say Expo Go **56.0.1 on Android is broken** for SDK 56. He needs **56.0.0**, sideloaded. Send him the APK.
2. Both machines and the phone on the **same Wi-Fi**
3. Vishwajeet runs `cd mobile && npx expo start`
4. Neeraj scans the QR code with Expo Go

**Why this is genuinely good**, and not just a workaround:

- Neeraj tests on a **different physical device** from yours. Two Android phones, two screen sizes, two Android versions. That catches things one device never will.
- He is testing **your live code** — you change a file, it reloads on his phone in seconds. He can say "that button is off" and you fix it while he is still holding the phone.
- He has **fresh eyes**. You built it, so you unconsciously tap things in the order that works. He will not.

**One thing to set up:** `EXPO_PUBLIC_API_URL` in `mobile/.env` must be your Mac's LAN address, not `localhost`. Find it with:

```bash
ipconfig getifaddr en0
```

That prints something like `192.168.1.7`. So `EXPO_PUBLIC_API_URL=http://192.168.1.7:5000`. And your backend must listen on `0.0.0.0`, not `127.0.0.1`, or the phone cannot reach it.

> **Why `localhost` does not work here.** `localhost` means "this machine". On Neeraj's phone, `localhost` is *the phone*, which is not running your backend. The LAN address is the specific machine on the network, so the phone knows where to go.

## 2.3 Noted for the record — your GoTrue discovery

You wrote:

> *Deleting a user cascades into related tables and fires their triggers — and it runs as GoTrue's role, not ours, which has no permissions on our tables. Cost me two migrations to find.*

That is a genuinely nasty one and worth writing down properly, because it will come back.

**What is happening:** when Supabase's auth service deletes a row from `auth.users`, that delete runs as GoTrue's own database role. Your `ON DELETE CASCADE` then fires against `public.users`, and any trigger on `public.users` runs — still as GoTrue's role. That role has no permissions on your tables, so the trigger fails, so the delete fails.

**The general lesson:** a trigger does not run as "the database". It runs as whoever caused it to fire. So a trigger that can be reached from a cascade must either be `SECURITY DEFINER` (so it runs as its creator, who does have permissions) or must not need permissions your caller lacks.

**Add this to `docs/CURRENT_STATE.md`**, because the next person to add a trigger on `public.users` will hit it too, and two migrations is a lot to spend twice.

---

# PART 3 — Universities: why I am not giving you 200 domains

You asked me to research university email domains and give you a query to load them. I did the research, and I want to be straight with you about what came back.

## 3.1 The problem with a bulk list

Every wrong domain is a **security hole**, and you already know this — your own notes say a wrong domain in production would have let Gmail signups become NIT Delhi students.

Here is why a bulk list is dangerous, with real examples from the searching I did:

**Website domain is not always the email domain.** NIT Trichy's website is `nitt.edu`. NITK Surathkal's is `nitk.ac.in` — not `nitk.edu.in`, which is what I would have guessed. IIIT Bhubaneswar uses `iiit-bh.ac.in`, with a hyphen. One character wrong and no student at that college can ever sign up.

**Some colleges use a student subdomain.** Plenty of institutions give staff `@college.ac.in` but students `@student.college.ac.in` or `@ug.college.ac.in`. If you add the staff domain, students are locked out. If you add both, you might be letting in people who are not students.

**Some colleges use Gmail or Outlook underneath.** That is fine — the domain is still theirs. But some genuinely use plain `@gmail.com` addresses for students, and those you must never add.

**Look at what is already in your table.** You have IIITDM Kurnool as `iiitk.ac.in`. IIT Kanpur is `iitk.ac.in`. **Three i's versus two.** If either one is ever typed wrong, students from one institute get enrolled into the other's campus, see each other's listings, and message each other. Your entire isolation guarantee breaks from a single missing letter.

So: I could write you 200 rows, most of them right. But "most" is not a standard you can launch on, and you would have no way to tell which ones were wrong until a student complained — or worse, until they did not complain because it silently worked for the wrong people.

## 3.2 What I am giving you instead

Three things, which together get you further than a list would:

1. **A verified core set** — institutions where I am confident, marked with a confidence level so you know which to double-check
2. **A verification script** — so you can check any domain in seconds rather than trusting me or anyone else
3. **A safe way to add the long tail** — the request form, designed so students verify their own college

Plus one schema change that makes all of this safe: an **`is_active` flag**, so a university row can exist without being usable yet.

## 3.3 The `is_active` flag — a small change that makes everything else safe

Right now, adding a row to `universities` immediately allows signups from that domain. There is no middle state.

Add one column:

```sql
alter table public.universities
  add column is_active boolean not null default true;
```

Now a university can be in one of two states:

| `is_active` | What it means |
|---|---|
| `true` | Students at this domain can sign up. It appears in the supported-campuses list. |
| `false` | The row exists, but `requestOtp` rejects the domain and it does not appear in the list. |

**Why this matters so much.** You can now add fifty universities in one migration, all as `is_active = false`, verify them at your own pace, and flip them on one at a time. If one turns out to be wrong, no damage was done, because nobody could sign up with it.

It also gives you a clean answer to the request form: a student asks for their college, you add the row as inactive, verify it, then activate.

## 3.4 How to verify a domain in about thirty seconds

Three checks. Any domain that fails one does not get activated.

**Check 1 — can it receive email at all?**

In a terminal:

```bash
dig +short MX iitb.ac.in
```

`MX` records say "here is where email for this domain goes". If nothing comes back, the domain cannot receive email, so an OTP would go nowhere.

You will often see Google or Microsoft in the answer — that just means the college uses Gmail or Outlook for their own domain, which is completely normal and fine.

**Check 2 — is it really that institution's domain?**

Open `https://<domain>` in a browser. It should be the college's actual website. If it redirects somewhere unrelated, or does not resolve, stop.

**Check 3 — is it a public email provider?**

Never add `gmail.com`, `outlook.com`, `yahoo.com`, `rediffmail.com`, `hotmail.com`, `protonmail.com`, or anything similar. Anyone in the world can get an address there.

**Then the real test:** ask an actual student at that college what their college email address looks like. One WhatsApp message settles it definitively, and you and Neeraj between you probably know somebody at a dozen of these places.

The migration in Block A includes a script that runs checks 1 and 3 automatically over every domain in your table, so you can run it in one go rather than by hand.

## 3.5 The core set

Below is what goes into the migration. I have split it by how confident I am, and everything goes in as `is_active = false` so nothing is live until you check it.

**Group 1 — IITs.** For these the institute's main domain is the student email domain, and the pattern is very consistent across all of them. Confidence: high.

**Group 2 — NITs.** The domain is usually the website domain, but with real exceptions — NIT Trichy is `.edu`, not `.ac.in`. Confidence: medium-high. Verify each.

**Group 3 — IIITs and GFTIs.** More variation, more hyphens, more subdomains. Confidence: medium. Verify each carefully.

**Group 4 — large private universities.** These change more often and some use separate student domains. Confidence: medium. Verify each.

The full SQL is in **CC-1** in Track 2, and Claude Code will write it into a migration. The important thing is not the list — it is that every row lands inactive and gets verified before you switch it on.

## 3.6 The "request your college" form

You are right that this needs thought. Here is a design that keeps it safe without much work.

**The naive version, which you should not build:** a form where a student types a college name and domain, and it gets added. Anybody could submit `gmail.com` and every Gmail user on earth becomes a student.

**The version to build:** the student's own email address is the proof.

```
1. Student on the login page types  rahul@iitb.ac.in
2. Domain not found → instead of just an error, show:
   "Yahora isn't at IIT Bombay yet. Want us to add it?"  [Request]
3. They tap Request. You store the email address, the domain, and a
   college name they type in.
4. You see it in an admin list, with a count:
   "iitb.ac.in — 14 requests"
5. You verify the domain (§3.4), add it as inactive, then activate.
6. Everyone who requested it gets an email: "IIT Bombay is now on Yahora."
```

**Why the count matters more than any single request.** One request could be anyone. Fourteen requests from fourteen different addresses at the same domain is strong evidence that a real community exists there — and it also tells you which colleges to prioritise. You are not just collecting requests, you are collecting a launch queue sorted by demand.

**One safety rule:** never auto-activate. No matter how many requests a domain gets, a human looks at it before it goes live. That is the entire defence, and it costs you two minutes per college.

**This is not Phase 3 work.** It needs a table, an endpoint, a form on both platforms, and a small admin screen. That is Phase 8, alongside the other admin tooling. Block A adds the `is_active` column now so the shape is ready when you get there.

---

# PART 4 — What is in this phase, and what is not

## In Phase 3

| # | Job | Owner |
|---|---|---|
| 1 | Universities: `is_active` column + core set + verification script | Vishwajeet |
| 2 | Mobile CAPTCHA via WebView — unblocks mobile against production | Vishwajeet |
| 3 | OTP length 8 → 6 | Vishwajeet |
| 4 | Close the unauthenticated write holes | Neeraj |
| 5 | CORS allowlist | Neeraj |
| 6 | Pin home university in the campus switcher | Neeraj (web) + Vishwajeet (mobile) |
| 7 | DESIGN.md decision | Both, 20 minutes |
| 8 | Manual test pass | Neeraj |

## Deliberately NOT in Phase 3 — recorded so nothing is lost

Everything you raised that is not above. Each has a phase.

| Item | Phase | Why not now |
|---|---|---|
| Mobile password login, username selection, set-password | **4** | Big enough to be its own phase; mobile CAPTCHA unblocks logins today |
| Pagination everywhere (`.range()` has zero call sites) | **4** | Needed before real traffic, not before real testing |
| **Mark as Sold rework** (buyer search, no-conversation case) | **5** | Needs a schema change and UI on both platforms |
| Delete message, WhatsApp-style | **5** | Sits with the other messaging work |
| `products.views` double-counting | **5** | Cosmetic until you have real traffic |
| Web messages UX fixes ported to mobile | **5** | Grouped with messaging |
| Read-tick colour and bubble style: web vs mobile mismatch | **5** | Same |
| **Comments on community posts** (`comments` has no `post_id`) | **6** | Part of building the feed — a feed nobody can reply to is a noticeboard, as you said |
| Community feed itself | **6** | |
| Follows, blocks, privacy, notifications, push | **7** | |
| Reports, moderation, admin tooling | **8** | |
| **"Request your college" form** | **8** | Needs the admin screen that arrives with moderation |
| Email provider decision + OTP ceiling correction | **8** | Must be settled before launch; not blocking development |
| `utils/notify.js` writes to a non-existent table | **7** | Fails silently; fix it when notifications are built |
| Dead RPCs, `API.md` line 2448 error | **8** | Housekeeping |
| App store accounts, EAS build, icons, privacy policy | **8** | |
| Back-navigation from Dashboard → product lands on Marketplace | **4** | Mobile navigation work, grouped with other mobile |
| `focusManager` / AppState wiring question | **4** | Same |
| iOS Simulator pass | **8** | Needs the app finished |

---

# PART 5 — Files and flow

| Path | Action | Owner |
|---|---|---|
| `supabase/migrations/<ts>_universities_expansion.sql` | new | Vishwajeet |
| `scripts/verify-domains.sh` | new | Vishwajeet |
| `mobile/src/components/TurnstileWebView.tsx` | new | Vishwajeet |
| `mobile/app/(auth)/login.tsx` | edit | Vishwajeet |
| `mobile/src/lib/api.ts` (or wherever the API client lives) | edit | Vishwajeet |
| `mobile/app/(tabs)/index.tsx` | edit (campus switcher) | Vishwajeet |
| `backend/src/modules/user/user.routes.js` | edit | Neeraj |
| `backend/src/modules/products/products.routes.js` | edit | Neeraj |
| `backend/src/modules/messages/messages.routes.js` | edit | Neeraj |
| `backend/src/modules/*/**.controller.js` | edit | Neeraj |
| `backend/src/app.js` | edit (CORS) | Neeraj |
| `backend/src/modules/auth/auth.controller.js` | edit (OTP length) | Vishwajeet |
| `frontend/src/components/UniversityModal.jsx` | edit | Neeraj |
| `docs/DESIGN.md` | delete or archive | Both |
| `CLAUDE.md`, `frontend/CLAUDE.md`, `mobile/CLAUDE.md` | edit | Both |

## Flow

```
        VISHWAJEET                         NEERAJ
──────────────────────────────────────────────────────────────────
DAY 0   ═══ 20 minutes together: decide DESIGN.md and mobile CAPTCHA ═══
──────────────────────────────────────────────────────────────────
DAY 1   BLOCK A  Universities migration    N-BLOCK A  🚨 Security holes
        BLOCK B  Verify domains                       (do this first —
                                                       it is live today)
──────────────────────────────────────────────────────────────────
DAY 2   BLOCK C  OTP 6 digits              N-BLOCK B  CORS allowlist
        BLOCK D  Mobile CAPTCHA            N-BLOCK C  Pin home campus (web)
──────────────────────────────────────────────────────────────────
DAY 3   BLOCK D continues                  N-BLOCK D  Test the web changes
        BLOCK E  Pin home campus (mobile)
──────────────────────────────────────────────────────────────────
DAY 4   Fix what Neeraj finds              N-BLOCK E  Test the mobile app
                                                      on his Android
──────────────────────────────────────────────────────────────────
DAY 5   Activate verified universities     N-BLOCK F  Full pass, both
        Push everything                               platforms
──────────────────────────────────────────────────────────────────
```

**Neeraj starts with the security holes and they are not negotiable.** `PUT /api/users/:userId/profile` has no `requireAuth` and spreads `req.body` straight into `.update()`. Anyone holding a UUID can rewrite any student's row — including `username`, `has_password` and `university_id`. Changing someone's `university_id` moves them to another campus. That is live right now.

---

# ══════════════════════════════════════════
# TRACK 1 — VISHWAJEET: what you do by hand
# ══════════════════════════════════════════

## BLOCK A — The universities migration

### A1. What this migration does

Three things:

1. Adds the `is_active` column (§3.3), defaulting to `true` so your existing eight rows keep working exactly as they do now
2. Inserts the core set, every one of them with `is_active = false`
3. Changes `requestOtp` to only accept **active** universities

That third part is the one that makes the whole thing safe, and it is easy to forget. If you add the column but do not check it, every inactive university works anyway and the flag does nothing.

### A2. Protecting the demo university

You asked to make sure `Yahora University (Demo)` is not lost.

It cannot be, because this migration only ever **inserts**, never deletes or updates existing rows. And the inserts use `on conflict (domain) do nothing`, which means: if a domain already exists, skip it silently rather than failing.

Your eight existing rows — including the demo one — are untouched and stay `is_active = true` because of the column default.

There is a check for it in A5 anyway. Belt and braces on the one row that would break your investor demo.

### A3. Create it

```bash
cd /path/to/Yahora
git checkout main
git pull
supabase migration new universities_expansion
```

### A4. Fill it in

Run **CC-1** from Track 2.

### A5. Test locally

```bash
supabase db reset
```

Then in local Studio (`http://127.0.0.1:54323`) → SQL Editor:

```sql
-- your original eight are all still active
select name, domain, is_active from public.universities
where is_active = true order by name;
```

- [ ] 👁️ Exactly your original eight rows, including **Yahora University (Demo)**

```sql
-- everything new is inactive
select count(*) from public.universities where is_active = false;
```

- [ ] 👁️ A number in the dozens

```sql
-- the near-collision, checked deliberately
select name, domain from public.universities
where domain in ('iiitk.ac.in', 'iitk.ac.in');
```

- [ ] 👁️ **Two different rows.** `iiitk.ac.in` is IIITDM Kurnool. `iitk.ac.in` is IIT Kanpur. Three i's versus two. Read them character by character — this is the one that would silently merge two campuses.

### A6. Test that inactive universities really are blocked

Start the backend and try to sign up with an inactive domain:

```bash
cd backend && npm run dev
```

In your browser on `localhost:5173`, DevTools console:

```js
await fetch('http://localhost:5000/api/auth/request-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@iitb.ac.in' })
}).then(async r => console.log(r.status, await r.json()));
```

- [ ] 👁️ Returns `403` with the "not yet available at your university" message

If it returns `200`, the `is_active` check is missing from `requestOtp` and every unverified domain is live. Stop and fix it.

---

## BLOCK B — Verify domains and activate them

### B1. Run the automated checks

Run **CC-2** to create `scripts/verify-domains.sh`, then:

```bash
chmod +x scripts/verify-domains.sh
./scripts/verify-domains.sh
```

It reads every domain from your local database and checks each one for MX records and against a public-provider blocklist. Output looks like:

```
  OK    iitb.ac.in           MX: aspmx.l.google.com
  OK    nitt.edu             MX: mx1.nitt.edu
  FAIL  example.ac.in        no MX records
  BLOCK gmail.com            public email provider
```

- [ ] 👁️ Note every `FAIL` and `BLOCK`. Those never get activated.

> **What an MX record is.** When somebody sends email to `rahul@iitb.ac.in`, their mail server asks the internet "where does mail for `iitb.ac.in` go?" The answer is the MX record. No MX record means the domain cannot receive email at all, so an OTP sent there would simply vanish.

### B2. Do the human check

The script cannot tell you whether `nitk.ac.in` is really NITK's student domain. Only a person can.

For each domain you want to activate:

1. Open `https://<domain>` — is it the college's site?
2. Better: ask somebody who studies there what their college email looks like

Between you and Neeraj you probably know students at a dozen of these. One WhatsApp message each settles it.

**Start small.** Activate ten or fifteen you are confident about. You do not need all of them on day one, and every one you activate without checking is a risk you did not have to take.

### B3. Activate

Activation is a data change, not a schema change, so it goes in a migration too — that way it is recorded and reproducible.

```bash
supabase migration new activate_verified_universities
```

```sql
-- Verified by hand on 2026-09-XX. Each of these was checked for MX
-- records, confirmed to resolve to the institution's own website, and
-- confirmed with a student who studies there.
update public.universities
set is_active = true
where domain in (
  'iitb.ac.in',
  'iitd.ac.in',
  'nitt.edu'
  -- ...only the ones you actually verified
);
```

**Write the date and how you verified in the comment.** In four months you will want to know whether a domain was checked properly or guessed.

### B4. Push to production

```bash
supabase db push
```

- [ ] Both migrations apply cleanly

Then, on the **production** dashboard:

```sql
select name, domain from public.universities
where is_active = true order by name;
```

- [ ] 👁️ Your original eight plus exactly the ones you verified
- [ ] 👁️ **Yahora University (Demo)** is in the list
- [ ] 👁️ Go to the live site and use the demo login — it still works

---

## BLOCK C — OTP length: 8 digits to 6

### C1. Where the length actually comes from

This one has a trap in it, so read before changing anything.

The OTP is generated by **Supabase**, not by your code. Your backend never picks the digits. So changing a number in `auth.controller.js` will do nothing at all.

The length is a **project setting in the Supabase dashboard**:

**Dashboard → Authentication → Providers → Email → OTP Length**

Change it there, on **both** your local project and production.

> On local, Supabase config lives in `supabase/config.toml`. Look for an `[auth.email]` section. If there is an OTP length setting, change it there and re-run `supabase start` so it is version-controlled rather than a dashboard click you will forget.

### C2. What in your code needs to change

Your code does not generate the OTP, but it does **validate the length** in a few places. Those will reject a valid 6-digit code if they still expect 8.

Run **CC-3**, which finds and updates them.

The places to expect: the web `Auth.jsx` input (`maxLength`, and any "enter the 8-digit code" text), the mobile `login.tsx` input, and any backend length check in `verifyOtp`.

### C3. Check

- [ ] 👁️ Request a code on the web. **Look at the email in Mailpit** (`127.0.0.1:54324`) — the code has 6 digits.
- [ ] 👁️ The input accepts 6 and does not wait for a 7th
- [ ] 👁️ No text anywhere still says "8-digit"

> **Why fewer digits is fine.** An 8-digit code has 100 million combinations; 6 digits has 1 million. That sounds much weaker, but guessing is not how these get broken — codes expire in minutes and your rate limiting stops repeated attempts. 6 digits is what almost every service uses because it is the point where security is still fine and people stop making typing mistakes. Two fewer digits genuinely reduces failed logins.

---

## BLOCK D — Mobile CAPTCHA (the WebView approach)

This is the biggest piece of your work this phase. Take your time with it.

### D1. Why this needs a WebView, in plain terms

Turnstile is a piece of **web** technology. It works by loading a JavaScript file from Cloudflare into a web page, watching how the browser behaves, and producing a token.

React Native has no browser. Your app draws native Android and iOS views — there is no place for Cloudflare's JavaScript to run.

A **WebView** is a browser window embedded inside a native app. You give it some HTML and it renders it, exactly like a browser would, inside your screen.

So the plan is: put a tiny web page inside a WebView, let Turnstile run in there, and pass the token it produces back out to your React Native code.

```
   React Native screen
   ┌─────────────────────────────────┐
   │  Email:  [ rahul@iitb.ac.in ]   │
   │                                 │
   │  ┌───── WebView ─────────────┐  │
   │  │  a tiny HTML page that    │  │
   │  │  loads Turnstile          │  │
   │  │                           │  │
   │  │  gets a token ────────────┼──┼──► postMessage
   │  └───────────────────────────┘  │        │
   │                                 │        ▼
   │        [ Send code ]  ◄─────────┼─── setCaptchaToken(token)
   └─────────────────────────────────┘
```

The WebView is usually invisible or a thin strip, because Turnstile in Managed mode normally shows nothing.

### D2. How the token gets out of the WebView

This is the one genuinely new concept, so let me explain it properly.

The HTML inside the WebView is a separate little world. It cannot call your React functions directly. But `react-native-webview` gives it one channel: a function called `window.ReactNativeWebView.postMessage(...)`.

Whatever string the page passes to that function arrives in your React Native code as an `onMessage` event.

Inside the HTML:

```html
<script>
  function onTurnstileSuccess(token) {
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'token', token: token })
    );
  }
</script>
```

In your React Native component:

```tsx
<WebView
  onMessage={(event) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'token') {
      setCaptchaToken(data.token);
    }
  }}
/>
```

Two things worth knowing:

**You can only send strings.** That is why both sides use `JSON.stringify` and `JSON.parse`. You cannot pass an object directly across the boundary.

**Give every message a `type` field.** Right now you only send tokens. Later you will also want to send errors and expiry notices, and having a `type` from the start means you never have to guess what a message is.

### D3. The four things that will break it

**1. Turnstile checks the hostname.** When you created the widget in Phase 2 you listed allowed hostnames. A WebView loading raw HTML has a strange origin, so Turnstile may reject it.

The fix: give the WebView a `baseUrl` matching a hostname you registered. `react-native-webview` supports this:

```tsx
<WebView source={{ html: htmlString, baseUrl: 'https://yahora.com' }} />
```

You may also need to add `localhost` to your Turnstile widget's hostname list in the Cloudflare dashboard for development.

**2. A token can only be used once.** Same rule as the web. After each request, tell the WebView to reset — send a message in, or reload the WebView.

**3. Tokens expire after about five minutes.** If somebody opens the login screen and walks away, the token is stale. Use Turnstile's `expired-callback` to tell React Native to clear it.

**4. Android needs `javaScriptEnabled`.** On iOS it is on by default; on Android it is not, and Turnstile is entirely JavaScript. Set `javaScriptEnabled={true}` explicitly.

### D4. Build it

Run **CC-4** from Track 2.

### D5. 👁️ Check — on a real phone, not the simulator

CAPTCHAs behave differently in emulators — some of the signals Turnstile looks at are absent or odd. **Test on your real Android device.**

- [ ] 👁️ Open the login screen. Either you see nothing, or you see a small widget briefly. The layout does not jump.
- [ ] 👁️ Type an email, tap send → the code arrives
- [ ] 👁️ Request a **second** code → it still works. If the second fails, the token is not being reset (§D3.2).
- [ ] 👁️ Turn off Wi-Fi, open the login screen → it fails gracefully with a message, not a blank screen or a crash
- [ ] 👁️ Point the app at **production** (`EXPO_PUBLIC_API_URL` = your Netlify backend URL) and log in → **it works**

That last one is the whole point of this block. Mobile login against production is broken today; this is what fixes it.

---

## BLOCK E — Pin the home university in the campus switcher (mobile)

### E1. What you are changing and why

Right now: a student at IIITDM Kurnool switches to NIET to browse. To come back, they have to search for their own college in a list of dozens.

That is a small annoyance that happens every single time, which makes it a big one.

**The fix:** the student's own campus is always pinned at the very top of the switcher, visually separated, labelled as theirs.

```
┌──────────────────────────────────┐
│  Switch campus                   │
├──────────────────────────────────┤
│  YOUR CAMPUS                     │
│  ● IIITDM Kurnool         ✓      │  ← always first, always visible
├──────────────────────────────────┤
│  [ Search campuses...          ] │
│                                  │
│  ALL CAMPUSES                    │
│    Galgotias University          │
│    NIET Greater Noida            │
│    Sharda University             │
│    ...                           │
└──────────────────────────────────┘
```

**Three details that make it feel right:**

**Pin it above the search box, not inside the list.** If it is in the list, typing in the search box filters it away — which is exactly when you most want it. Above the box, it is always there.

**Do not also show it in the list below.** Seeing your own college twice is confusing. Filter it out of the main list.

**Show a tick when you are currently on it.** So the student can see at a glance whether they are home or browsing elsewhere.

### E2. Build it

Run **CC-5** from Track 2. Neeraj does the same change on web in N-Block C — compare afterwards so they behave identically.

### E3. Check

- [ ] 👁️ Open the switcher → your own campus is at the top, under "Your campus"
- [ ] 👁️ It does **not** also appear in the list below
- [ ] 👁️ Type in the search box → the pinned one stays, the list filters
- [ ] 👁️ Switch to another campus, reopen the switcher → your campus is still pinned at the top, and the tick has moved

---

# ══════════════════════════════════════════
# TRACK 2 — VISHWAJEET: Claude Code prompts
# ══════════════════════════════════════════

Five prompts, one at a time, from the repo root.

---

## ▶ CC-1 — The universities migration

```
Read docs/PHASE_3_RUNBOOK.md Part 3 in full before writing anything.
It explains why every new row must land inactive.

Follow the conventions in supabase/migrations/ — lowercase SQL,
comments explaining WHY, search_path pinned on SECURITY DEFINER
functions.

TASK: Write the SQL into the newest empty file in supabase/migrations/
ending in _universities_expansion.sql.

=== 1. THE is_active COLUMN ===

  alter table public.universities
    add column is_active boolean not null default true;

The default of true is deliberate: the eight rows already in the table
must keep working exactly as they do now. Comment that.

Add an index on (is_active) where is_active = true — the supported-
campuses list and the signup domain check both filter on it.

=== 2. INSERT THE CORE SET ===

Every row: is_active = false. No exceptions. Verification happens
before activation, in a separate migration.

Use  on conflict (domain) do nothing  on every insert, so a domain that
already exists is skipped silently rather than failing the migration.
This is what protects the existing eight rows, including
'Yahora University (Demo)' / 'demo.yahora.com', which must never be
touched.

Group the inserts with a comment header per group and a confidence
note, so whoever verifies knows where to look hardest:

  -- Group 1: IITs. Institute domain = student email domain, very
  -- consistent across all of them. Confidence: high.
  ('IIT Bombay',        'iitb.ac.in'),
  ('IIT Delhi',         'iitd.ac.in'),
  ('IIT Madras',        'iitm.ac.in'),
  ('IIT Kanpur',        'iitk.ac.in'),
  ('IIT Kharagpur',     'iitkgp.ac.in'),
  ('IIT Roorkee',       'iitr.ac.in'),
  ('IIT Guwahati',      'iitg.ac.in'),
  ('IIT BHU Varanasi',  'iitbhu.ac.in'),
  ('IIT Ropar',         'iitrpr.ac.in'),
  ('IIT Mandi',         'iitmandi.ac.in'),
  ('IIT Gandhinagar',   'iitgn.ac.in'),
  ('IIT Jodhpur',       'iitj.ac.in'),
  ('IIT Indore',        'iiti.ac.in'),
  ('IIT Patna',         'iitp.ac.in'),
  ('IIT Bhubaneswar',   'iitbbs.ac.in'),
  ('IIT Palakkad',      'iitpkd.ac.in'),
  ('IIT Dharwad',       'iitdh.ac.in'),
  ('IIT Bhilai',        'iitbhilai.ac.in'),
  ('IIT Goa',           'iitgoa.ac.in'),
  ('IIT Jammu',         'iitjammu.ac.in'),
  ('IIT Dhanbad (ISM)', 'iitism.ac.in'),

  ⚠️ IIT Hyderabad (iith.ac.in) and IIT Tirupati (iittp.ac.in) are
  ALREADY in the table and active. The on-conflict clause skips them.
  Do not remove or alter those rows.

  ⚠️ 'iitk.ac.in' (IIT Kanpur) and 'iiitk.ac.in' (IIITDM Kurnool,
  already present) differ by ONE character. Add a comment on the IIT
  Kanpur line saying so, so nobody ever "fixes" one into the other.

  -- Group 2: NITs. Usually the website domain, but with real
  -- exceptions — NIT Trichy is .edu, NITK Surathkal is nitk.ac.in
  -- (NOT nitk.edu.in). Confidence: medium-high. VERIFY EACH.
  ('NIT Tiruchirappalli',  'nitt.edu'),
  ('NIT Karnataka Surathkal', 'nitk.ac.in'),
  ('NIT Warangal',         'nitw.ac.in'),
  ('NIT Calicut',          'nitc.ac.in'),
  ('NIT Rourkela',         'nitrkl.ac.in'),
  ('MNNIT Allahabad',      'mnnit.ac.in'),
  ('MNIT Jaipur',          'mnit.ac.in'),
  ('MANIT Bhopal',         'manit.ac.in'),
  ('SVNIT Surat',          'svnit.ac.in'),
  ('NIT Kurukshetra',      'nitkkr.ac.in'),
  ('NIT Hamirpur',         'nith.ac.in'),
  ('NIT Durgapur',         'nitdgp.ac.in'),
  ('NIT Jamshedpur',       'nitjsr.ac.in'),
  ('NIT Patna',            'nitp.ac.in'),
  ('NIT Silchar',          'nits.ac.in'),
  ('NIT Raipur',           'nitrr.ac.in'),
  ('NIT Agartala',         'nita.ac.in'),
  ('NIT Srinagar',         'nitsri.ac.in'),
  ('NIT Goa',              'nitgoa.ac.in'),
  ('NIT Meghalaya',        'nitm.ac.in'),
  ('NIT Puducherry',       'nitpy.ac.in'),
  ('NIT Uttarakhand',      'nituk.ac.in'),
  ('NIT Arunachal Pradesh','nitap.ac.in'),
  ('NIT Mizoram',          'nitmz.ac.in'),
  ('NIT Manipur',          'nitmanipur.ac.in'),
  ('NIT Nagaland',         'nitnagaland.ac.in'),
  ('NIT Sikkim',          'nitsikkim.ac.in'),
  ('NIT Andhra Pradesh',   'nitandhra.ac.in'),
  ('VNIT Nagpur',          'vnit.ac.in'),

  ⚠️ NIT Delhi (nitdelhi.ac.in) is ALREADY in the table.

  -- Group 3: IIITs and GFTIs. More variation, some hyphens.
  -- Confidence: medium. VERIFY EACH CAREFULLY.
  ('IIIT Hyderabad',       'iiit.ac.in'),
  ('IIIT Delhi',           'iiitd.ac.in'),
  ('IIIT Allahabad',       'iiita.ac.in'),
  ('IIIT Gwalior',         'iiitm.ac.in'),
  ('IIIT Bangalore',       'iiitb.ac.in'),
  ('IIITDM Kancheepuram',  'iiitdm.ac.in'),
  ('IIIT Bhubaneswar',     'iiit-bh.ac.in'),
  ('IIIT Lucknow',         'iiitl.ac.in'),
  ('IIIT Vadodara',        'iiitvadodara.ac.in'),
  ('IIIT Una',             'iiitu.ac.in'),
  ('IIIT Kottayam',        'iiitkottayam.ac.in'),
  ('IIIT Sri City',        'iiits.ac.in'),
  ('IIIT Nagpur',          'iiitn.ac.in'),
  ('IIIT Pune',            'iiitp.ac.in'),
  ('IIIT Ranchi',          'iiitranchi.ac.in'),
  ('IIIT Dharwad',         'iiitdwd.ac.in'),
  ('IIIT Kalyani',         'iiitkalyani.ac.in'),
  ('IIIT Guwahati',        'iiitg.ac.in'),
  ('IIIT Manipur',         'iiitmanipur.ac.in'),
  ('DA-IICT Gandhinagar',  'daiict.ac.in'),
  ('LNMIIT Jaipur',        'lnmiit.ac.in'),
  ('BIT Mesra',            'bitmesra.ac.in'),
  ('IIEST Shibpur',        'iiests.ac.in'),
  ('NSUT Delhi',           'nsut.ac.in'),
  ('DTU Delhi',            'dtu.ac.in'),
  ('IIITDM Jabalpur',      'iiitdmj.ac.in'),

  -- Group 4: large private universities. These change more often and
  -- some use a separate student domain. Confidence: medium.
  -- VERIFY EACH.
  ('BITS Pilani',          'pilani.bits-pilani.ac.in'),
  ('VIT Vellore',          'vit.ac.in'),
  ('VIT Bhopal',           'vitbhopal.ac.in'),
  ('SRM Institute',        'srmist.edu.in'),
  ('Manipal Academy of Higher Education', 'learner.manipal.edu'),
  ('Thapar Institute',     'thapar.edu'),
  ('Amity University Noida','amity.edu'),
  ('Lovely Professional University', 'lpu.in'),
  ('Christ University',    'christuniversity.in'),
  ('Shiv Nadar University','snu.edu.in'),
  ('Ashoka University',    'ashoka.edu.in'),
  ('Jaypee Institute (JIIT) Noida', 'mail.jiit.ac.in'),
  ('PES University',       'pesu.pes.edu'),
  ('RV College of Engineering', 'rvce.edu.in'),
  ('BMS College of Engineering', 'bmsce.ac.in'),
  ('MSRIT Bangalore',      'msrit.edu'),
  ('KIIT Bhubaneswar',     'kiit.ac.in'),
  ('Bennett University',   'bennett.edu.in'),
  ('Chandigarh University','cuchd.in'),
  ('Graphic Era University','geu.ac.in'),
  ('Delhi University',     'du.ac.in'),
  ('Jamia Millia Islamia', 'jmi.ac.in'),
  ('Aligarh Muslim University', 'myamu.ac.in'),
  ('Anna University',      'annauniv.edu'),
  ('Jadavpur University',  'jadavpuruniversity.in')

  For Group 4 especially, add a comment above the block saying these
  are the LEAST certain and several may use a student subdomain such
  as student.<domain> — every one must be confirmed with an actual
  student before activation.

=== 3. ENFORCE is_active IN requestOtp ===

This is the part that makes the flag mean anything, and it is in the
BACKEND, not this migration. Note it in your response so it is not
forgotten — CC-3 will do it.

=== 4. ALSO UPDATE THE SUPPORTED-CAMPUSES ENDPOINT ===

Same — a backend change, noted for CC-3. The universities list shown
to students must filter on is_active = true, or inactive colleges
appear in the campus switcher and confuse everyone.

HARD CONSTRAINTS:
- Write ONLY into that one migration file.
- Do NOT run any supabase command.
- Do NOT delete, update, or re-insert any existing university row.
  Especially not 'Yahora University (Demo)'.
- Every new row must be is_active = false. If you find yourself typing
  true for a new row, stop.

When you finish, print how many rows you inserted per group, and
confirm the on-conflict clause is on every insert.
```

---

## ▶ CC-2 — The domain verification script

```
Read docs/PHASE_3_RUNBOOK.md §3.4.

TASK: Create scripts/verify-domains.sh — a bash script that checks
every university domain in the LOCAL database and reports which ones
are safe to activate.

For each domain, three checks:

1. MX RECORDS. Run  dig +short MX <domain>  and report the first
   result. No output means the domain cannot receive email at all, so
   an OTP would vanish. Mark FAIL.

2. PUBLIC PROVIDER BLOCKLIST. If the domain is in this list, mark
   BLOCK and make the line impossible to miss:
     gmail.com, googlemail.com, outlook.com, hotmail.com, live.com,
     yahoo.com, yahoo.in, rediffmail.com, protonmail.com, proton.me,
     icloud.com, aol.com, zoho.com, mail.com, yandex.com
   Anyone in the world can get an address at these. Adding one would
   let anybody sign up as a student.

3. RESOLVES. Does the domain resolve at all (dig +short A <domain>)?
   Report it, but do NOT mark it FAIL on its own — some institutions
   serve their website only on www.

Read the domain list from the local Supabase database using psql
against the local connection string
  postgresql://postgres:postgres@127.0.0.1:54322/postgres
with the query:
  select domain from public.universities order by domain;

Output format, one line per domain, aligned:
  OK     iitb.ac.in            MX: aspmx.l.google.com
  FAIL   example.ac.in         no MX records
  BLOCK  gmail.com             public email provider

At the end print a summary: how many OK, how many FAIL, how many
BLOCK, and exit with a non-zero status if there are any BLOCK results.

Also print a reminder that an OK result does NOT mean the domain is
correct — only that it can receive email. A human still has to confirm
it is really that institution's student domain.

HARD CONSTRAINTS:
- Create ONLY scripts/verify-domains.sh.
- Read only. The script must never write to the database.
- It must work if dig is missing — check for it and print a clear
  install hint (brew install bind) rather than failing confusingly.
```

---

## ▶ CC-3 — is_active enforcement and OTP length

```
Read docs/PHASE_3_RUNBOOK.md §3.3 and Block C.

TASK, two unrelated small changes in the auth area.

=== PART A — ENFORCE is_active ===

A migration added universities.is_active. Nothing checks it yet, which
means every inactive university currently works and the flag does
nothing.

1. In backend/src/modules/auth/auth.controller.js, requestOtp looks up
   the email domain in the universities table. Add
   .eq('is_active', true) to that lookup, so an inactive domain gets
   the same 403 "not yet available at your university" response as an
   unknown one.

   Do NOT invent a different error message for inactive vs unknown.
   From the student's point of view they are the same situation, and a
   different message would tell somebody probing which domains you have
   queued up.

2. Find the endpoint that returns the list of supported campuses (in
   backend/src/modules/university/). Filter it on is_active = true.
   Otherwise inactive colleges appear in the campus switcher and
   students try to switch to a campus with nobody in it.

3. Search the backend for any OTHER query against the universities
   table and report what you find. Say for each whether it should
   filter on is_active. Do not change them without telling me first.

=== PART B — OTP LENGTH 8 -> 6 ===

IMPORTANT: your code does NOT generate the OTP. Supabase does, and the
length is a project setting in the dashboard. So do not look for a
place to change the number — there isn't one.

What DOES need changing is every place that VALIDATES or DESCRIBES the
length. If any still expects 8, a valid 6-digit code gets rejected.

Search the whole repo — backend/, frontend/src/, mobile/ — for:
  - maxLength or max_length of 8 on an OTP input
  - any length check like otp.length !== 8
  - any user-facing text saying "8-digit" or "8 digit"
  - any regex like /^\d{8}$/
  - any array of 8 input boxes for a segmented code entry

Change each to 6. List every file and line you changed.

If you find a place where the length is written as a literal in more
than one file, say so — it should be one constant, and I would rather
know than have it drift again.

HARD CONSTRAINTS:
- Do NOT change how the OTP is generated or verified beyond the length.
- Do NOT touch supabase/config.toml — I will handle the dashboard and
  config settings myself.
- Update backend/API.md if it documents the OTP length anywhere.
```

---

## ▶ CC-4 — Mobile Turnstile via WebView

```
Read docs/PHASE_3_RUNBOOK.md Block D in full. It explains the approach
and the four things that break it.

CONTEXT: Turnstile is enabled on our production Supabase project. The
Expo app sends no captcha token, so mobile login against production
fails today. Turnstile has no native React Native component — it is
browser technology — so we run it inside a WebView and pass the token
out.

Read mobile/CLAUDE.md first for our conventions. Read
frontend/src/pages/auth/Auth.jsx as READ-ONLY reference for how the
web does it.

TASK:

=== 1. INSTALL ===
  cd mobile && npx expo install react-native-webview

Use `expo install`, not `npm install` — it picks the version matching
our Expo SDK.

=== 2. CREATE mobile/src/components/TurnstileWebView.tsx ===

A component that renders a WebView containing a minimal HTML page which
loads the Turnstile script and renders the widget.

Props:
  siteKey: string
  onToken: (token: string) => void
  onError?: (message: string) => void
  onExpire?: () => void

The HTML page must:
  - load https://challenges.cloudflare.com/turnstile/v0/api.js
  - render the widget with the site key
  - on success, call
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'token', token })
      )
  - on error, post { type: 'error', message }
  - on expiry, post { type: 'expired' }

The component parses onMessage, switches on `type`, and calls the right
prop. Every message is a JSON string in both directions — you cannot
pass objects across the WebView boundary.

FOUR THINGS THAT WILL BREAK IT — handle all four:

  a) HOSTNAME. Turnstile validates the origin against the hostnames
     registered on the widget. Raw HTML in a WebView has an odd origin.
     Set  source={{ html, baseUrl: 'https://yahora.netlify.app' }}  and add a
     comment saying localhost may also need adding to the Cloudflare
     widget's hostname list for development. We may need to change https://yahora.netlify.app later to purchased domain.

  b) ONE USE PER TOKEN. Expose a reset method via useImperativeHandle
     (or accept a `resetKey` prop that remounts the WebView). After
     every request, successful or failed, the parent resets it.
     Without this the SECOND login attempt always fails.

  c) EXPIRY. Tokens die after about 5 minutes. Wire the
     expired-callback so onExpire fires and the parent clears its
     stored token.

  d) ANDROID. Set javaScriptEnabled={true} explicitly. It is on by
     default on iOS but NOT on Android, and Turnstile is entirely
     JavaScript.

Styling: the widget usually renders nothing visible in Managed mode.
Size the WebView so the layout does not jump either way — do not
reserve a fixed 65px that leaves a hole. Transparent background.

=== 3. WIRE IT INTO mobile/app/(auth)/login.tsx ===
  - render TurnstileWebView above the send button, OTP flow only
  - hold the token in state
  - disable the send button until a token exists
  - include captchaToken in the request-otp body — the backend already
    accepts it, see backend/API.md
  - reset after every attempt

=== 4. THE SITE KEY ===
Read it from process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY. Add it to
mobile/.env.example with a placeholder.

The site key is PUBLIC by design — it only identifies the widget. The
SECRET key lives in the Supabase dashboard and must NEVER appear
anywhere in this repo. If you find yourself wanting an env var for a
secret key, stop and say so: it means the flow has been misunderstood.

=== 5. FAIL GRACEFULLY ===
If the WebView cannot load — no network, Cloudflare unreachable — the
login screen must show a clear message and not a blank space or a
crash. A student with a bad connection should be told to try again, not
left staring at nothing.

HARD CONSTRAINTS:
- Change only files under mobile/.
- Treat ../frontend and ../backend as READ-ONLY reference.
- Put the widget on the OTP flow ONLY.
- Follow mobile/CLAUDE.md: TypeScript, colours only from src/theme,
  no realtime subscriptions inside screens.
- Do NOT commit a real site key.

When you finish, state where reset is called from and confirm
javaScriptEnabled is set.
```

---

## ▶ CC-5 — Pin the home campus (mobile)

```
Read docs/PHASE_3_RUNBOOK.md Block E.

TASK: In the campus switcher in mobile/app/(tabs)/index.tsx (and any
component it uses), pin the student's own university at the top. This need to be done 
in Marketplace campus switcher and the home page "See supported Campuses" (only if the student is logged in).
Do this change in the /mobile only (Mobile app only).

Behaviour:

1. A section at the very top labelled "Your campus", containing only
   the student's own university, ABOVE the search box.

   Above the search box, not inside the list — otherwise typing filters
   away the one entry the student most wants, which is exactly the
   wrong behaviour.

2. Remove the student's own university from the main list below. Seeing
   it twice is confusing.

3. Show a checkmark or highlight on whichever campus is currently
   selected, so the student can see at a glance whether they are home
   or browsing elsewhere.

4. Tapping the pinned entry switches back to their own campus and
   closes the switcher.

5. A visible divider between the pinned section and the full list.

EDGE CASES:
  - a demo user, whose own campus IS the demo university — pin it the
    same way, no special case
  - a student whose university_id is somehow null — render no pinned
    section rather than crashing
  - the student is already on their own campus — still show the pin,
    with the tick

HARD CONSTRAINTS:
- Change only files under mobile/.
- Colours and spacing only from mobile/src/theme.
- Do NOT change what the campus switcher does beyond the pinning —
  the browse-only banner and the demo restriction alert must behave
  exactly as they do now.
```

---

# ══════════════════════════════════════════
# TRACK 3 — NEERAJ: what you do by hand
# ══════════════════════════════════════════

## N-BLOCK A — 🚨 The security holes (do this first, today)

### A1. Why this is first, before anything else

`docs/CURRENT_STATE.md` records this and it is live in production right now:

```js
// backend/src/modules/user/user.routes.js
router.put('/:userId/profile', updateProfile);   // ← no requireAuth
```

```js
// the controller
const { userId } = req.params;
await supabase.from('users').update({ ...req.body }).eq('id', userId);
```

Two separate problems, and together they are the worst hole left in the project.

**Problem 1: no authentication.** Anybody who knows a user's UUID can call this. And UUIDs are not secret — `GET /api/users/:userId/public` hands them out.

**Problem 2: `...req.body` spreads whatever arrived.** The caller does not just get to change a bio. They get to change **any column on that row**, because the object they sent is copied straight into the update.

So somebody can send:

```json
PUT /api/users/<any-uuid>/profile
{ "username": "stolen_handle", "university_id": "<another-campus-uuid>" }
```

That last field is the serious one. Changing `university_id` **moves a student to a different campus.** They now see that campus's listings and can message its students. Your entire isolation guarantee — the thing Yahora is built on — is bypassed by one unauthenticated HTTP request.

### A2. The two fixes, and why you need both

**Fix 1 — require authentication.**

```js
router.put('/:userId/profile', requireAuth, updateProfile);
```

Then, inside the controller, **ignore `req.params.userId` completely** and use `req.user.id` instead:

```js
const userId = req.user.id;      // ✅ from the verified token
```

You learned this in Phase 1 with the onboarding hole: never trust an identity that arrives in a URL or a body. If the caller supplies the ID, they can supply anybody's.

**Fix 2 — allowlist the fields.**

Even with auth, `...req.body` is still wrong. A logged-in student could change **their own** `username` (bypassing the 30-day limit and the reserved-word check), their own `has_password`, or their own `university_id`.

So spell out exactly what may be changed:

```js
const ALLOWED_PROFILE_FIELDS = [
  'full_name', 'bio', 'avatar_url',
  'qualification', 'course_id', 'specialization_id', 'year_of_study',
];

const updates = {};
for (const field of ALLOWED_PROFILE_FIELDS) {
  if (field in req.body) updates[field] = req.body[field];
}
```

> **This is called an allowlist**, and it is the opposite of a blocklist.
>
> A **blocklist** says "reject these dangerous fields". It fails the moment you add a new column and forget to add it to the list — the new column is writable by default.
>
> An **allowlist** says "accept only these safe fields". Add a new column and it is *not* writable until somebody deliberately adds it. It fails closed instead of open.
>
> **Whenever you are choosing between the two, pick the allowlist.** The version that fails safely when you forget something is worth more than the one that fails dangerously, because you will forget something.

Note what is deliberately absent: `username` has its own endpoint with its own rules, `has_password` is set only by the password endpoints, `university_id` is set once at signup and never again, and `is_profile_complete` is set only by onboarding.

### A3. The rest of the unauthenticated endpoints

`CURRENT_STATE.md` §2.2.2 lists more. Every one of these accepts writes with no token:

**Products:** `POST /api/products`, `POST /:id/comments`, `POST /comments/:id/vote`, `PATCH /:id/sold`, `PATCH /:id/available`

**Messages:** `GET /inbox/:userId`, `POST /messages/send`, `PUT /read`, `PUT /deliver`

**User:** `GET /:userId/dashboard`, `POST /:userId/avatar`, `GET /:userId/public`

Two of these deserve a special mention:

**`POST /messages/send` takes `sender_id` from the body.** So anybody can send a message *as* anybody else. And because the campus check compares against that same supplied `sender_id`, the check validates nothing — the attacker just supplies a matching pair.

**`GET /:userId/public` should stay open**, but check what it returns. A public profile is meant to be public. Just make sure it does not include the email address or anything else that is not on the visible profile page.

Run **N-CC-1**, which handles all of them systematically.

### A4. 👁️ Check

Get a token for user A, and user B's UUID from Studio.

📮 Postman, or the DevTools console:

| Test | Expected |
|---|---|
| `PUT /api/users/<B's uuid>/profile` with **no** Authorization header | `401` |
| Same, with **A's** token, body `{"full_name":"Hacked"}` | 👁️ **B's row unchanged.** A's row changed instead, or a `403` — either is fine, silently editing B is not |
| With A's token, body `{"university_id":"<other campus uuid>"}` | 👁️ **A's `university_id` is unchanged.** The field was ignored. |
| With A's token, body `{"username":"stolen"}` | 👁️ **A's username unchanged.** Ignored. |
| With A's token, body `{"bio":"Hello"}` | `200`, and 👁️ the bio actually changed |

That last row matters as much as the others. A security fix that also breaks editing your own bio is a bug, not a fix.

---

## N-BLOCK B — The CORS allowlist

### B1. What CORS is, in plain English

**CORS** stands for Cross-Origin Resource Sharing. It is a browser rule.

By default, a browser will not let JavaScript running on `evil-site.com` make a request to `api.yahora.com` and read the response. That protection is built into every browser, and it is why a random website cannot quietly read your Gmail while you have it open in another tab.

Your server can **opt out** of that protection by sending a header that says "requests from this origin are fine". That header is `Access-Control-Allow-Origin`.

Your `backend/src/app.js:69` currently sends:

```
Access-Control-Allow-Origin: *
```

The `*` means **every origin on the internet**. You have opted out of the protection entirely, for everybody.

### B2. Why that undoes some of your other work

Think about what you built in Phase 2. Turnstile stops scripts. Rate limiting slows down abuse. Both of those assume requests come from *your* site.

With `*`, anybody can build a page at `fake-yahora.com` that looks exactly like your login screen, and their JavaScript can call your real API and read the real responses. A student who lands there types their real credentials into a real-looking form, and the attacker's page has their session.

Fixing this is about ten lines.

### B3. The fix

```js
const ALLOWED_ORIGINS = [
  'https://yahora.netlify.app',      // your actual Netlify domain
  'https://www.yahora.com',          // if/when you have a custom domain
  'https://yahora.com',
];

app.use(cors({
  origin(origin, callback) {
    // Requests with no Origin header — mobile apps, curl, server-to-server —
    // are not browser requests, so CORS does not apply to them.
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
```

**Three things to understand here:**

**Why `if (!origin) return callback(null, true)`.** The `Origin` header is sent by browsers. Your Expo app, Postman, and `curl` do not send it. If you rejected requests without an Origin, **you would break the mobile app completely.** CORS is a browser protection, and non-browser clients are simply outside its scope — they are protected by your auth token instead.

**In development, allow localhost.** Your Vite dev server runs at `http://localhost:5173`. Add it, but only when `NODE_ENV !== 'production'`, so it never reaches the live allowlist.

**Get the exact Netlify URL right.** No trailing slash. `https://`, not `http://`. Origins are matched as exact strings — `https://yahora.netlify.app/` with a slash will not match. Copy it from your browser's address bar.

Run **N-CC-2**.

### B4. 👁️ Check

- [ ] 👁️ The live website still works after deploying — this is the one that breaks loudly if the allowlist is wrong
- [ ] 👁️ `curl https://<your-backend>/api/universities` still works (no Origin header, so it is allowed)
- [ ] 👁️ Ask Vishwajeet to test the mobile app against production — it must still work
- [ ] 👁️ In DevTools on **some other website**, run a `fetch` to your API. It should fail with a CORS error in the console.

> ⚠️ **Deploy this carefully.** If the allowlist is wrong, your live website stops working immediately and the error appears only in the browser console, not in your server logs. Have the site open in a tab and refresh it the moment the deploy finishes.

---

## N-BLOCK C — Pin the home campus (web)

Read **Block E** in Track 1 — the design and the reasoning are there, and Vishwajeet is making the identical change on mobile.

Your file is `frontend/src/components/UniversityModal.jsx`.

The four rules:

1. The student's own university pinned at the top, **above the search box**, under a "Your campus" heading
2. **Not** repeated in the list below
3. A tick or highlight on whichever campus is currently selected
4. A visible divider between the pinned section and the list

**Why above the search box and not inside the list:** if it is inside, typing in the box filters it away — which is exactly the moment the student most wants to find it.

Run **N-CC-3**.

### 👁️ Check

- [ ] 👁️ Open the switcher → your own campus at the top under "Your campus"
- [ ] 👁️ It does not also appear in the list below
- [ ] 👁️ Type in the search box → the pinned one stays, the list filters
- [ ] 👁️ Switch campus, reopen → still pinned, tick has moved
- [ ] 👁️ **At 375px width** — your notes say `UniversityModal` has zero media queries, so check this one carefully for overflow

---

## N-BLOCK D — Test the web changes

Standard pass on everything that moved:

- [ ] 👁️ Sign up with a **new** email at an active university → works end to end
- [ ] 👁️ Sign up with an **inactive** university domain → clear "not available at your university" message
- [ ] 👁️ The OTP email contains a **6-digit** code, and the input accepts 6
- [ ] 👁️ No text anywhere still says "8-digit"
- [ ] 👁️ Edit your own profile → saves
- [ ] 👁️ Campus switcher pinning works
- [ ] 👁️ Log in with username and password → works
- [ ] 👁️ At 375px: navbar, campus switcher modal, auth page, onboarding

---

## N-BLOCK E — Test the mobile app on your Android

Set up per **§2.2** — Expo Go on your phone, Vishwajeet runs `npx expo start`, same Wi-Fi, scan the QR.

**Focus on what changed this phase:**

- [ ] 👁️ Login screen loads, no layout jump from the CAPTCHA
- [ ] 👁️ Request a code → it arrives, **6 digits**
- [ ] 👁️ Request a **second** code without restarting the app → still works *(this catches the token-reset bug)*
- [ ] 👁️ Wrong code → clear error
- [ ] 👁️ Turn off Wi-Fi, open login → graceful message, no crash or blank screen
- [ ] 👁️ Campus switcher → home campus pinned at top, not duplicated below
- [ ] 👁️ Against **production** (Vishwajeet points `EXPO_PUBLIC_API_URL` at the live backend) → login works

**Then a broader sweep**, since nobody has manually tested this app before:

Work through `docs/` §4.1 of the mobile status notes — every screen, in order. You do not have to finish it in Phase 3, but **start it**, and write down everything you find in `docs/CHANGELOG.md` under a "Mobile test findings" heading.

**How to report a bug so it is fixable.** Not "the marketplace is broken", but:

> *Marketplace → filter by Electronics → pull to refresh → the filter resets to All. Expected it to stay. Pixel 6a, Android 14.*

Screen, steps, what happened, what you expected, which phone. Vishwajeet can fix that in ten minutes. He cannot fix "it feels laggy".

---

## N-BLOCK F — Before your pull request

- [ ] `git diff --stat` shows only `backend/` and `frontend/`
- [ ] Every fixed endpoint tested for both the attack **and** normal use
- [ ] Findings written into `docs/CHANGELOG.md`
- [ ] `backend/API.md` updated with the new `401`/`403` responses

```bash
git checkout -b neeraj
git add backend/ frontend/ docs/
git commit -m "fix(security): requireAuth + field allowlist, CORS allowlist; feat(web): pin home campus"
git push origin neeraj
```

---

# ══════════════════════════════════════════
# TRACK 4 — NEERAJ: Claude Code prompts
# ══════════════════════════════════════════

## ▶ N-CC-1 — 🚨 Close the unauthenticated write holes

```
Read docs/PHASE_3_RUNBOOK.md N-Block A, and docs/CURRENT_STATE.md
§2.2. This is a live security hole in production.

TASK: Add authentication and field allowlisting across the backend.

=== PART A — THE WORST ONE ===

backend/src/modules/user/ — PUT /:userId/profile

  1. Add requireAuth to the route.
  2. In the controller, take the user id from req.user.id ONLY. Ignore
     req.params.userId entirely — if the caller supplies the id, they
     can supply anybody's.
  3. Replace the { ...req.body } spread with an explicit ALLOWLIST:

       const ALLOWED_PROFILE_FIELDS = [
         'full_name', 'bio', 'avatar_url',
         'qualification', 'course_id', 'specialization_id',
         'year_of_study',
       ];

     Copy only those fields. Anything else in the body is silently
     ignored — do not error on it, just do not use it.

     An allowlist, not a blocklist. When we add a column later it must
     be un-writable by default, not writable by default.

     Deliberately NOT in the list, and each for a reason:
       username             — has its own endpoint with a 30-day limit
                              and reserved-word checks
       has_password         — set only by the password endpoints
       university_id        — set once at signup; changing it moves a
                              student to another campus and breaks
                              tenant isolation entirely
       is_profile_complete  — set only by onboarding
       id, created_at       — never writable

=== PART B — EVERY OTHER UNAUTHENTICATED WRITE ===

Add requireAuth to all of these, and in each controller take the acting
user from req.user.id rather than from params or body:

  products:  POST /api/products
             POST /:id/comments
             POST /comments/:id/vote
             PATCH /:id/sold
             PATCH /:id/available
  messages:  GET  /inbox/:userId
             POST /messages/send
             PUT  /read
             PUT  /deliver
  user:      GET  /:userId/dashboard
             POST /:userId/avatar

SPECIAL ATTENTION — POST /messages/send takes sender_id from the BODY.
That means anyone can send a message AS anyone else. Worse, the campus
check compares against that same supplied sender_id, so it validates
nothing — an attacker just supplies a matching pair. Use req.user.id
and re-derive the campus check from it.

LEAVE OPEN (they are meant to be public):
  GET /api/users/:userId/public
  GET /api/users/username-available
  GET /api/users/username-suggestions
  GET /api/users/by-username/:username
  GET /api/universities
  POST /api/auth/*  (except onboarding, which already has requireAuth)

For GET /:userId/public, do NOT add auth — but DO check what it
returns. Report whether it includes an email address or any field not
shown on the public profile page. Do not change it without telling me.

=== PART C — OWNERSHIP CHECKS ===

Authentication says who you are. It does not say what you may touch.
For each endpoint above, verify there is also an ownership check:

  - marking a product sold/available: is req.user.id the seller?
  - deleting a comment: is it theirs?
  - reading an inbox: is it their own?

Report any that are missing. Fix the obvious ones; ask me about
anything ambiguous rather than guessing.

=== PART D — REPORT ===
List every route you changed, and separately every route you found
that has requireAuth but NO ownership check. The second list is the one
I most want to see.

HARD CONSTRAINTS:
- Modify only backend/src/modules/ and backend/API.md.
- Do NOT touch backend/src/app.js — that is a separate task.
- Do NOT touch utils/, middleware/ or config/ — frozen.
- Use sendError() from utils/respond.js for every error.
- LEGITIMATE USE MUST KEEP WORKING. A student editing their own bio,
  marking their own listing sold, or reading their own inbox must
  behave exactly as it does now. Do not over-restrict.
- Update backend/API.md with the new 401 and 403 responses.
```

---

## ▶ N-CC-2 — The CORS allowlist

```
Read docs/PHASE_3_RUNBOOK.md N-Block B.

CONTEXT: backend/src/app.js line 69 returns
Access-Control-Allow-Origin: '*' in production. That tells every
browser that any website on the internet may call our API and read the
response. It undoes part of the Turnstile and rate-limiting work from
Phase 2.

TASK: Replace it with an explicit allowlist.

1. Define ALLOWED_ORIGINS as a named constant at the top of app.js:
     - the production Netlify domain
     - any custom domain we use
     - in development ONLY (NODE_ENV !== 'production'), also
       http://localhost:5173 and http://127.0.0.1:5173

   Read the actual Netlify domain from frontend/netlify.toml or an env
   var if one exists. If you cannot determine it, leave a clearly
   marked TODO and tell me — do not guess a domain.

2. Use the cors() function form:

     origin(origin, callback) {
       if (!origin) return callback(null, true);
       if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
       return callback(new Error('Not allowed by CORS'));
     }

   THE  if (!origin)  LINE IS ESSENTIAL. Requests from our Expo app,
   from Postman and from curl carry no Origin header, because CORS is
   a browser mechanism and they are not browsers. Rejecting them would
   break the mobile app completely. They are protected by the auth
   token instead.

3. Keep credentials: true.

4. Add a comment above the constant explaining what CORS does and why
   '*' was dangerous, so nobody reverts it for convenience.

5. Read the whole of app.js and report any OTHER place that sets CORS
   headers manually — a res.header('Access-Control-Allow-Origin', ...)
   somewhere would silently override this.

HARD CONSTRAINTS:
- Modify ONLY backend/src/app.js.
- Do NOT change any route mount, middleware order, or anything else in
  the file. app.js is frozen except for this.
- Match origins as exact strings. No trailing slash, no wildcards, no
  regex.
```

---

## ▶ N-CC-3 — Pin the home campus (web)

```
Read docs/PHASE_3_RUNBOOK.md Block E and N-Block C.

TASK: In frontend/src/components/UniversityModal.jsx, pin the
student's own university at the top of the campus switcher.

1. A section at the very top labelled "Your campus", containing only
   the student's own university, ABOVE the search input.

   Above the search box, not inside the list — otherwise typing filters
   away the one entry the student most wants to reach.

2. Remove the student's own university from the main list below.
   Showing it twice is confusing.

3. A tick or highlight on whichever campus is currently selected.

4. Clicking the pinned entry switches back and closes the modal.

5. A visible divider between the pinned section and the full list.

EDGE CASES:
  - a demo user, whose own campus IS the demo university — pin it the
    same way, no special case
  - a student whose university_id is somehow null — render no pinned
    section rather than crashing
  - already on their own campus — still show the pin, with the tick

RESPONSIVENESS: our notes record that this component has ZERO media
queries. Check it at 375px and add mobile-only media queries if the
pinned section causes overflow.

RULE: only ever ADD mobile-only media queries. Never modify an existing
desktop rule.

Vishwajeet is making the identical change in mobile/app/(tabs)/index.tsx.
Do NOT edit anything under mobile/.

HARD CONSTRAINTS:
- Change only files under frontend/src/.
- Use the CSS variables already in frontend/src/styles/global.css. No
  new colours.
- Do NOT change what the switcher does beyond the pinning — the
  browse-only behaviour and the demo restriction must be untouched.
```

---

# PHASE 3 SIGN-OFF

**Decisions**
- [ ] DESIGN.md decided, and both `CLAUDE.md` files updated to match
- [ ] Mobile CAPTCHA approach decided

**Security — blocking, do not launch without these**
- [ ] `PUT /api/users/:userId/profile` requires auth and uses a field allowlist
- [ ] Sending another user's UUID changes nothing on their row
- [ ] `university_id` cannot be changed through any profile endpoint
- [ ] Every write endpoint from `CURRENT_STATE.md` §2.2.2 requires auth
- [ ] `POST /messages/send` uses `req.user.id`, not a body field
- [ ] CORS returns an allowlist, not `*`
- [ ] The live website and the mobile app both still work after the CORS change

**Universities**
- [ ] `is_active` added; the original eight rows are still active
- [ ] **Yahora University (Demo) is still active and the demo login works**
- [ ] Every new row landed inactive
- [ ] `requestOtp` and the campuses list both filter on `is_active`
- [ ] An inactive domain is rejected at signup
- [ ] `verify-domains.sh` run; no `BLOCK` result was ever activated
- [ ] Only hand-verified domains were activated, with the date recorded in the migration
- [ ] 👁️ `iitk.ac.in` and `iiitk.ac.in` read character by character and confirmed correct

**Small fixes**
- [ ] OTP is 6 digits in the email, in both inputs, and in all wording
- [ ] Home campus pinned in the switcher on **both** platforms, behaving identically

**Mobile**
- [ ] Turnstile WebView works on a **real Android device**
- [ ] A second OTP request in the same session works
- [ ] Mobile login against **production** succeeds
- [ ] Neeraj has run at least the login and marketplace screens on his own phone

**Documentation**
- [ ] `docs/CURRENT_STATE.md` — §2.2.1 and §2.2.2 marked resolved; the GoTrue cascade lesson recorded
- [ ] `docs/CHANGELOG.md` has both handoffs and Neeraj's test findings
- [ ] `backend/API.md` updated

**Carried into Phase 4**
- [ ] Mobile password login, username selection, set-password
- [ ] Pagination — `.range()` still has zero call sites
- [ ] Dashboard → product back-navigation landing on Marketplace
- [ ] `focusManager` / AppState decision

---

*Phase 4 is mobile auth parity and pagination. Ask when you are ready.*
