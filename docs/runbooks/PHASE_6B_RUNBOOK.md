# Phase 6B Runbook — Privacy, Message Actions, Mark as Sold

**Written 11 October 2026, against `main` at commit `80567ef` (PR #60).**
**For Vishwajeet and Neeraj. Start Monday 12 October. Sign off Thursday 29 October.**

---

## HOW TO READ THIS DOCUMENT

This runbook has the same shape as Phases 4, 5 and 6A:

- **PART 0** — what I found in the code, and what I already built and tested for you.
- **PART 1** — every new idea in this phase, explained from the beginning, with an example.
- **PART 2** — who changes which files, the calendar with real dates, and when each part goes
  live.
- **TRACK 1** — Vishwajeet's manual steps. **TRACK 2** — Vishwajeet's Claude Code prompts.
- **TRACK 3** — Neeraj's manual steps. **TRACK 4** — Neeraj's Claude Code prompts.
- **SIGN-OFF** — the checklist you tick together on the last day.
- **APPENDIX** — commands, the full list of API changes, error codes, and traps.

Two symbols:

- **👁️** marks a check only a human can do: looking at a screen, tapping on a phone, reading
  a result and deciding whether it is right. These are the checks that matter. Don't skip them.
- **⛔** marks a rule that, if broken, costs at least a day.

**Work one block at a time.** Each block ends with a checkpoint. Don't start the next block
until the checkpoint passes. If something in a checkpoint looks wrong, stop and write down
what you saw. That note is worth more than pushing on.

**Each Claude Code prompt is one copy-paste.** Copy everything inside the grey box, paste it
into Claude Code, and let it finish. Then do the "VERIFY AFTER" steps it asks for. Claude
Code tells you what it changed. You check that it works.

---

# PART 0 — WHAT I FOUND, AND WHAT IS ALREADY DONE

## 0.1 The repo, today

I cloned `https://github.com/perffinity360/yahora` and read it at `main` = `80567ef`.

| Fact | Value |
|---|---|
| Latest commit | `80567ef`, "Merge pull request #60 from perffinity360/neeraj", 11 Oct 19:05 |
| Your branches | `infiniper` and `neeraj` are **behind** main and have nothing that main doesn't. Good. |
| Old branch | `vishwajeet` on GitHub is **94 commits behind** and unused since 14 September. Safe to delete (GitHub → Branches → the bin icon). |
| Migrations | **18**. Newest: `20261001122844_search_demo_isolation.sql` (6A, V-A) |
| Changelog entries | **18** files in `docs/changelog/`, all tagged phase `6A` |
| How long 6A took | `cache.md` says Phase 6 started **29 September**. The last 6A merge is **11 October**. That is **13 days** for a plan of 6 |

**Five files at the repo root that nothing uses.** V-0 removes the three leftovers (one
commit, Vishwajeet); the other two are your call:

| File | What it is |
|---|---|
| `phase6-design-assets.zip` | 1.7 MB. The 6A package was committed **as a zip** as well as unzipped. Its contents already live in `docs/design/`. A zip in git is dead weight: every clone downloads it forever. Removed in V-0 |
| `cache.jsx`, `temp.cpp` | Empty (0 bytes). Removed in V-0 |
| `README.md` | Empty (0 bytes). Delete it, or write two lines about what Yahora is |
| `cache.md` | Two lines with phase start dates. Keep it if you like it — it is how I measured 6A |

**About the 13 days.** I'm not saying this to blame anyone. 6A also gained work the runbook
never asked for: four animated welcome stickers, photo swiping on cards, the folding
"List an item" button, emoji sizing, jump-to-latest. All of that is good work, and all of it
took days. So for 6B I have planned in **your real days**, at the pace 6A showed. If extra
ideas come up during 6B, write them down for Phase 10 instead of building them now. That is
the only way the 29 October date holds.

## 0.2 Your question 1 — will all these changelog files become a problem?

**No. And the one-file-per-entry system you built is exactly what large projects use.** The
full explanation is in PART 1, §1.1. In short:

- **Git doesn't care.** The Linux kernel has about 80,000 files in git. 18 small files a
  phase is nothing, for git or for your disk.
- **What does grow is clutter for people reading the folder.** Big projects solve that with a
  **release step**. At the end of each version (your phases), a tool joins all that phase's
  entries into **one file** and deletes the small ones. The tools are called **changesets**
  (used by thousands of JavaScript projects) and **towncrier** (used by pip and pytest).
- **I built that release step for you and tested it on your 18 real 6A entries.** It writes
  `docs/changelog/releases/phase-6A.md` (76 KB, 18 entries, oldest first) and removes the 18
  files. Git shows exactly **1 file added and 18 deleted**. Each entry keeps its original file
  name inside the release file, so an old reference like `2026-10-04-184315` still finds it.

Neeraj adds it on Day 1 (Block N-A) and releases 6A. At the end of 6B you release 6B. From
then on, `docs/changelog/` only ever holds the current phase's entries.

## 0.3 Your question 3 — the privacy findings. All four are real.

You reported four places where someone without a real student account can read real
students' details. I checked each one in the code.

| # | What you found | Confirmed in the code |
|---|---|---|
| 1 | `GET /api/products?university_id=` needs no login and returns each seller's id, full name and photo | ✅ `products.routes.js` line 29 (`optionalAuth`); `products.controller.js` `getProducts`, around line 432: `seller:users!seller_id(id, full_name, avatar_url)`. It also returns `seller_id` itself, because the query selects `*` |
| 2 | `GET /api/user/:userId/public` has no auth; returns name, photo, bio, qualification, year, course, specialization, university; and `?user_id=` shows any user's likes and saves | ✅ `user.routes.js` line 50 has **no middleware at all**. `user.controller.js` `getPublicProfile`, line 253: `const { user_id: visitorId } = req.query` — the caller names whose likes are read. This is an **IDOR**, the same bug Phase 4 fixed in `getProducts` (§1.4 explains the word) |
| 3 | `GET /api/users/by-username/:username` works with or without login | ✅ `user.routes.js` line 84 (`optionalAuth`); `getProfileByUsername` returns name, bio, course, specialization, year, university. **No screen calls this endpoint yet**, on web or mobile — so fixing it can't break anything |
| 4 | `GET /api/products/:id` works with or without login; returns the seller's name, photo, qualification, year, and every commenter's id, name, photo | ✅ `getProductById`, around line 568, and `COMMENT_SELECT`, around line 379 |

You were right that **messaging is not a gap**: `sendMessage` already rejects two people on
different campuses, and the demo campus is a different campus.

**I found three more of the same kind.**

| # | Finding | Where |
|---|---|---|
| 5 | **Link previews give the seller's full name to anyone.** `GET /api/products/:id/meta` returns `seller_name`, and the share page `GET /share/product/:id` writes "listed by <full name>" into its HTML. No login. Given product ids from finding 1, this is another way to collect names. | `products.controller.js` `getProductMeta` (around line 702); `share.controller.js` around lines 190 and 232 |
| 6 | **Comments and comment votes skip the campus check.** Like, save and message all refuse a different campus. `addComment` and `toggleCommentVote` don't. So a demo account — one click, no college email — can post questions under listings on **every real campus**, and vote on their comments. Real students would then see a demo guest's comment on their listing. | `addComment` (around line 834), `toggleCommentVote` (around line 879) |
| 7 | **Anyone can add views to any listing.** `increment_product_views` is a database function that runs with full rights (`SECURITY DEFINER`), and the public key is allowed to call it. Anyone can call it in a loop. This is also the root of the "views are double-counted" bug already planned for 6B. | Migration `20260808143802_remote_schema.sql`, `GRANT ALL ON FUNCTION public.increment_product_views(uuid) TO anon` — never revoked |

**Your decision (from my question):** a real student's identity is shown **only to verified
students**. Logged-out visitors and demo accounts still see every listing — title, price,
photos, condition, campus — but the person shows as **"Yahora student"**, and profiles ask
them to log in. Demo accounts still see the demo campus completely. §1.2 explains why demo
accounts must be treated like logged-out visitors. §1.5 explains "hide the person, keep the
listing".

**What is deliberately not changing:** `GET /api/users/username-available` still says whether
a handle is taken. Every app that lets you pick a username does this, and a handle on its
own is not identity. Limiting how fast anyone can ask is a Phase 9 job (rate limits).

## 0.4 What Phase 6B contains

From your message and your three answers:

| Workstream | What you get | Size |
|---|---|---|
| **A. Changelog release** | `node scripts/changelog.mjs release <phase>`, and 6A released | small |
| **B. Privacy** | The identity rule on 6 endpoints, the IDOR fixed, the comment/vote campus checks added | medium |
| **C. Views** | `products.views` means "how many different students opened this listing" | small |
| **D. Message actions** | **Reply** (quote a message), **Copy**, **Delete for me**, **Delete for everyone** (within 60 minutes), on web and mobile | large |
| **E. Mark as Sold, reworked** | Find the buyer by search, "someone not on Yahora", "That wasn't me", change buyer, relist, sold listings on the profile — on web and mobile | large |

You chose: Reply, Copy and Delete (not Edit or Reactions); Mark as Sold **inside** 6B; and
"verified students only" for privacy.

## 0.5 What I already built and tested, so you don't have to

Everything below was **run**, not just written. I set up a Postgres 16 database, applied your
**18 existing migrations** in order, loaded `supabase/seed.sql` on top, and then tested my
work against that real data.

| Thing | Where it is | What was tested |
|---|---|---|
| **3 migrations** | `docs/runbooks/phase6b/01_message_actions.sql`, `02_product_views.sql`, `03_mark_sold.sql` | All three apply cleanly after your 18, and `seed.sql` still loads after them. **The seed's one sold listing gets its `sold_at` from the new trigger.** |
| **Test script 1** (message actions) | `test_01_message_actions.sql` | 10 groups of checks, all pass: a reply copies the quote; nobody can forge a quote; a reply can't point into another conversation, or another listing between the same two people; only the sender can delete for everyone; 59 minutes works and 61 doesn't; deleting wipes the text **and every quote of it**; a deleted message can't be replied to or un-deleted; "delete for me" is private and repeatable; the inbox skips hidden messages and reports deleted ones; hiding a whole thread removes it for one person only; the public key can't call any of the new functions |
| **Test script 2** (views and Mark as Sold) | `test_02_views_and_sold.sql` | All pass: one view per person per listing; the seller's own views, repeat views, demo accounts on real listings and real students on demo listings are not counted; only the seller can mark sold; the buyer must be on the listing's campus (demo accounts are refused too); one buyer per listing; "someone not on Yahora"; "That wasn't me"; relist clears the buyer and the date; "people who messaged you" works; the old view function is closed to the public key but still works for the backend |
| **The changelog release command** | `docs/runbooks/phase6b/changelog.mjs` | Run on a copy of your real 18 entries: a dry run changes nothing; the real run writes `phase-6A.md` and deletes the 18 files; git shows 1 added and 18 deleted; `recent` then points at the release; a new 6B entry works normally afterwards |
| **`viewer.js`** (the identity rule in one file) | inside prompt CC-V1 | 11 checks of its rules pass (who may see whom; hiding a seller removes `seller_id` too; comment text survives when its author is hidden) |
| **Two designs, measured** | `docs/design/MESSAGES_SPEC.md` **v3** (new §10) and `docs/design/MARK_SOLD_SPEC.md`, with pictures `message_actions.png` and `mark_sold.png` | Every new colour pair was measured for contrast. **Two of my first choices failed** — a white-tinted quote inside your own pink bubble (3.38:1) and 85% white for "You deleted this message" (4.29:1). Both were replaced with values that pass (5.13 and 4.64). Both specs record the rejected values, so nobody "improves" them back |

What I could **not** test here: anything that needs Supabase's own servers (PostgREST,
Realtime, login) or your phones. Those are exactly the 👁️ checks in this runbook.

## 0.6 The design decisions, and why

| Decision | Why |
|---|---|
| **"Delete for everyone" works for 60 minutes** after sending | Long enough for "wrong chat" and typos, the reasons people actually use it. Short enough that a price agreed in a chat ("₹500, deal") can't silently vanish days later. WhatsApp allows about 2½ days; a marketplace needs to be more accountable than a family group. It is one number in one SQL function, plus one constant per app. |
| **A deleted message stays as a "tombstone"** ("This message was deleted"), not removed | The other person already saw that something was there. A silent gap would look like a bug, and a tombstone also keeps replies to it making sense. The **words** are wiped from the database, and so are any quotes of them (§1.6). |
| **"Delete for me" is a private list in its own table** | If it were a column on the message, Realtime would send the change to **both** people, and the other person's app would learn you hid something. A separate table that Realtime never sees keeps it private (§1.7). |
| **A reply stores a copy of the quoted words**, filled in by the database | The quote shows instantly when the reply arrives live, and old replies still show their quote after scrolling far away. The database fills it, so no app can quote words that were never said (§1.8). |
| **The buyer is never shown publicly** | Who bought what is personal. The seller sees it on their own listing, the buyer in their own purchases, and everyone else sees **SOLD**. |
| **The website's message actions button sits beside the bubble, not inside it** | Inside, it would cover the end of the first line of text. Beside it, the bubble never changes size. |
| **On Android 13 and newer, no "Copied" toast** | Android itself shows a clipboard confirmation there. Two confirmations look like a bug. |
| **The privacy rule lives in one file** (`backend/src/utils/viewer.js`) | Four endpoints ask it who may see whom (the other two simply stop sending the name). If each wrote its own version, sooner or later one would be wrong. |

## 0.7 The deadline

**18 days. Start Monday 12 October. Sign off Thursday 29 October 2026.**
**If anything slips, the hard stop is Sunday 1 November** — three buffer days.

This assumes 5–6 hours a day each, every day, as you said. The calendar is in §2.3. It has
three milestones you can check yourselves against:

| Milestone | Date | What is live by then |
|---|---|---|
| **M1** | **Fri 16 Oct** (Day 5) | The privacy fix and the views fix, on the real website |
| **M2** | **Thu 22 Oct** (Day 11) | Message actions on the real website, and working on all three phones in Vishwajeet's build |
| **M3** | **Wed 28 Oct** (Day 17) | Mark as Sold on the real website, and working on all three phones |

**If you miss M1 by more than a day, tell each other the same day and move every later date
by the same amount.** Don't try to win the time back by skipping the 👁️ checks. Dussehra falls
inside these three weeks. If either of you takes a day off for it, move every date after it by
one day.

## 0.8 The package — what is in it and where it goes

`phase6b-package.zip` unzips at the **repo root**. It adds files, and replaces exactly one
(`MESSAGES_SPEC.md`, v2 → v3):

```
docs/runbooks/PHASE_6B_RUNBOOK.md            ← this document
docs/runbooks/phase6b/01_message_actions.sql ← migration bodies (Vishwajeet, V-B)
docs/runbooks/phase6b/02_product_views.sql
docs/runbooks/phase6b/03_mark_sold.sql
docs/runbooks/phase6b/test_01_message_actions.sql   ← local test scripts (V-B)
docs/runbooks/phase6b/test_02_views_and_sold.sql
docs/runbooks/phase6b/changelog.mjs          ← tested release command (Neeraj, N-A)
docs/design/MESSAGES_SPEC.md                 ← v3, replaces v2 (adds §10)
docs/design/MARK_SOLD_SPEC.md                ← new
docs/design/message-actions-mockup.html      ← open in Chrome
docs/design/message_actions.png
docs/design/mark-sold-mockup.html
docs/design/mark_sold.png
```

Neeraj unzips it and commits it first thing on Day 1 (Block N-0).

---
# PART 1 — THE IDEAS IN THIS PHASE, FROM THE BEGINNING

Read the sections for your own blocks before you start them. Each one is short, and each has
a worked example.

## 1.1 Changelog fragments, and the release step (your question 1)

**The problem you solved in 6A.** You both added entries to the top of one big file. Two
people editing the same lines of the same file is exactly what git calls a **conflict**, so
the second pull request always conflicted. In 6A you switched to **one file per entry**.
Adding a new file never edits an existing one, so there is nothing to conflict.

**Your worry now.** One file per entry means many files. Is that a problem?

**What a "problem" would actually mean, and whether it happens:**

| Possible problem | Real? |
|---|---|
| Git gets slow with many files | **No.** Git handles hundreds of thousands. The Linux kernel has about 80,000 files. You add about 18 a phase. |
| The repo gets big | **No.** Your 18 entries total about 75 KB. One photo is bigger. |
| Claude Code reads them all at startup and wastes tokens | **No**, because sessions run `node scripts/changelog.mjs recent 8`, which reads 8. |
| **The folder gets cluttered for humans** | **Yes, slowly.** After four phases it would hold 70 files, and the one you need is hard to spot. |

**What the industry does — "fragments", then a "release".** This exact pattern has a name.
Each change gets a small file called a **fragment** (a "changeset" or a "news fragment").
When a version is released, a tool **joins all the fragments into one file and deletes
them**. Examples:

- **changesets** — used by thousands of JavaScript projects. Each pull request adds a file
  in `.changeset/`. `changeset version` joins them into `CHANGELOG.md` and deletes them.
- **towncrier** — used by Python projects such as pip and pytest. Fragments live in a
  `news/` or `changelog/` folder; `towncrier build` joins them and deletes them.
- Some teams skip files and build the changelog from commit messages instead. That works for
  "what changed", but it has no room for your best section, **"What NOT to do yet"**, which
  is a message to the other person, not a description of code.

**For you, a "version" is a phase.** So at each phase's sign-off, one command:

```bash
node scripts/changelog.mjs release 6A --dry-run   # shows what it WOULD do, changes nothing
node scripts/changelog.mjs release 6A             # does it
```

**Worked example (I ran this on your real 18 entries):**

```
Wrote docs/changelog/releases/phase-6A.md (18 entries, 76 KB)
  deleted  docs/changelog/2026-10-01-184400-neeraj-changelog-one-file-per-entry.md
  deleted  docs/changelog/2026-10-03-114316-neeraj-add-messages-design-package.md
  ... 16 more ...
```

Then `git status` shows **1 added, 18 deleted**. Nothing is lost:

- each entry keeps its **original file name** as a heading inside `phase-6A.md`, so an old
  reference like "see `2026-10-04-184315`" still finds it with a search;
- the 18 original files stay in **git history** forever (`git log --all -- <path>`).

The release file starts with a table — date, author, block, who it was for, title — and each
title links down to its full entry. `recent` keeps working: it shows the current phase's
entries, then one line saying where older ones are:

```
2026-10-12 10:05  neeraj      Changelog: release command  [phase 6B · block N-A · for vishwajeet]  — 2026-10-12-...md
Released phases (older entries): docs/changelog/releases/phase-6A.md
```

**One rule:** release a phase **only at its sign-off**, after both of you have merged
everything. An entry tagged 6A that arrives after the release can't be added to it — the tool
refuses and tells you to tag it 6B instead.

## 1.2 Who is asking? Anonymous, demo, student

Every request to your API is made by one of three kinds of caller.

| Kind | How the API knows | Example |
|---|---|---|
| **Anonymous** | no token, or a token that doesn't check out | someone opening a product link that was shared on WhatsApp, without logging in |
| **Demo** | a valid token whose account belongs to the **demo campus** (`universities.is_demo = true`) | anyone who pressed **Explore Live Demo** |
| **Student** | a valid token whose account belongs to a **real campus** | Arjun, logged in with his `@iiitk.ac.in` email |

**Why a demo account counts the same as anonymous.** Look at what demo login asks for:

```bash
curl -s -X POST https://yahora-yst4.onrender.com/api/auth/demo-login
```

Nothing. No email, no captcha, no limit. It returns a real session token. So "is the caller
logged in?" is the wrong question: anyone in the world can be logged in, one click from now.
The right question is **"is the caller a verified student?"** — and only a real-campus account
proves that, because only a college email can create one.

**"But the screens already stop demo accounts."** They do, partly. On both the website and the
app, a demo account that picks another campus in the campus switcher gets the **Unlock All
Campuses** box and stays in the sandbox. That is a rule in the *screen*. The API behind it
answers anyone who asks directly: a script with a demo token, or a demo account that taps a
shared link to a real listing. A rule that lives only in the screen is a suggestion; this
phase puts it in the API. (It's also why the tests in this runbook open real listings **by
link** while logged in as a demo account — the switcher won't take you there.)

**Worked example.** Rahul (real student, IIITDM Kurnool) lists a cycle.

| Who looks at the listing | Sees the cycle? | Sees "Rahul Verma" and his photo? |
|---|---|---|
| Priya (student, same campus) | yes | **yes** |
| Sneha (student, NIET, browsing Kurnool with the campus switcher) | yes | **yes** — cross-campus browsing stays exactly as designed |
| A demo account | yes | **no** — "Yahora student" |
| Someone not logged in | yes | **no** — "Yahora student" |

And for a listing on the **demo campus**, by one of the demo personas: **everyone** sees the
persona's name, because the persona isn't a real person. That's what keeps the demo working.

**In code**, all of this lives in one small file, `backend/src/utils/viewer.js` (CC-V1):

- `resolveViewer(req)` answers "who is asking?" → `anonymous`, `demo` or `student`.
- `isDemoCampus(universityId)` answers "does this person belong to the demo campus?"
- `canSeeIdentity(viewer, subjectIsDemo)` answers the only question that matters:
  `true` if the viewer is a student, **or** the person being shown is from the demo campus.

**"Fail closed."** If the API can't work out who you are — say your account has no campus —
it treats you as anonymous. The safe answer when unsure is "show less", never "show more".

## 1.3 Why a name, a photo and a college together are sensitive

One name on its own is harmless. The danger is **collecting them in bulk**.

**Worked example — what a script could do before this fix.** It doesn't log in:

1. Ask for a campus's listings, 50 at a time. Each one carries the seller's id, full name and
   photo (finding 1).
2. For each seller id, ask `/api/user/<id>/public` — no login — and get their bio, course,
   year and specialization (finding 2).
3. Repeat for every campus in `/api/universities`.

In an afternoon that builds a spreadsheet: **name, photo, college, course, year**, for every
student who ever listed anything. That is exactly the information a stalker, a scammer
("Hi Priya, 2nd-year CSE at IIITDM? I'm from your placement cell…") or a spammer wants.
Yahora's promise is "verified students only". This fix makes the API keep that promise, not
just the screens.

India's data-protection law (the DPDP Act, 2023) points the same way: collect and show only
the personal data a purpose needs. A logged-out visitor's purpose — "what's for sale?" —
doesn't need the seller's name.

## 1.4 IDOR — "the caller names whose data they get"

**IDOR** stands for *Insecure Direct Object Reference*. It means: the request contains an id,
and the server trusts that id to decide **whose** data to return, without checking that the
caller is allowed to see it.

**Worked example — finding 2.** `getPublicProfile` reads:

```js
const { user_id: visitorId } = req.query;   // ← the CALLER chooses this
...
supabase.from('product_likes').select('product_id').eq('user_id', visitorId) ...
```

So this request, sent by anyone, with no login:

```
GET /api/user/<Rahul's id>/public?user_id=<Priya's id>
```

returns Rahul's listings with `is_liked` / `is_saved` filled in **for Priya**. Anyone can find
out which of Rahul's items Priya has liked and saved — for any two students.

**The fix** is the one Phase 4 applied to `getProducts`: the viewer comes from the **token**,
never from the URL. The `?user_id=` parameter is then **ignored in silence**: both apps still
send it today, and rejecting it would break them for no gain.

## 1.5 Hide the person, keep the listing

There were two ways to fix findings 1–4:

| Option | What a logged-out visitor sees | Problem |
|---|---|---|
| **Require login everywhere** | a login wall instead of the listing | Kills sharing. A listing link sent on WhatsApp would open on a login page. |
| **Hide the person, keep the listing** (chosen) | title, price, photos, condition, campus — and **"Yahora student"** as the seller | none for safety: nothing in the response identifies anyone |

**What "hidden" looks like in the API.** For a viewer who may not see the seller:

```json
{ "id": "…", "title": "26T Geared Cycle", "price": 3200,
  "seller": null, "seller_hidden": true }
```

Three details matter:

1. `seller` is `null` — no name, no photo.
2. **`seller_id` is removed too.** It is the key to `/api/user/<id>/public`. Leaving it in
   would hand out the key to the very door we just locked.
3. `seller_hidden: true` tells the apps "this is hidden on purpose", so they draw
   **"Yahora student"** instead of treating a missing seller as an error.

Comments get the same treatment: the question text stays, the author becomes `user: null`,
`user_hidden: true`.

**⛔ The apps must handle `seller: null` BEFORE the API starts sending it.** Today the
website's product page reads `comment.user.avatar_url` and `product.seller.id` without a
safety check. If the new API went live first, every logged-out product page with a comment
would crash. That's why the website change (N-D) merges **before** the API change (N-C) in
§2.4.

## 1.6 Tombstones — why "delete for everyone" keeps the row

There are two ways to delete a message:

- **Hard delete:** remove the row from the table. It's gone.
- **Soft delete ("tombstone"):** keep the row, wipe its text, and stamp `deleted_at`. The apps
  draw "This message was deleted".

**Why WhatsApp — and Yahora — use a tombstone:**

1. The other person may already have seen the message. A silent gap where it was looks like a
   bug. "This message was deleted" is honest.
2. **Replies need something to point at.** If Arjun replied to a message that then vanished,
   his reply would quote nothing.
3. **Realtime can announce it.** Changing a row sends an `UPDATE` event to both people's apps,
   and both draw the tombstone at the same moment.

**But the words must really be gone.** A tombstone that kept the text "hidden" would only be
pretending. So the database function sets `content = ''`, and a **check constraint** —
a rule the database enforces on every write — makes it impossible for a deleted row to hold
text:

```sql
check (deleted_at is null or content = '')
```

**Worked example — the quote problem.** Priya sends "my number is 98765 43210". Arjun replies
to it, so his reply carries a quote: "my number is 98765…". Priya deletes hers for everyone.
If we only wiped Priya's row, her number would live on **inside Arjun's quote**. So the same
function also wipes `reply_preview` on every reply to it, in the same transaction, and those
replies then show "Original message was deleted". My test script checks exactly this.

## 1.7 "Delete for me" — a private list, not a column

"Delete for me" hides a message from **your** view only. Where should "Arjun hid message X"
be stored?

**The tempting way — a column on the message** (`hidden_for_sender`, `hidden_for_receiver`).
Simple queries. But Realtime sends every change to a message row **to both people** (the
messages table is in Realtime's publication, and both people may read the row). So when Arjun
hides a message, Priya's app receives the row with `hidden_for_receiver: true`. Her app
wouldn't show it — but anyone looking at the network traffic would learn that Arjun hid
something. "Delete for me" must not tell the other person anything.

**The chosen way — a separate table, `message_hides`:**

```
message_hides
  user_id     — who hid it
  message_id  — what they hid
  hidden_at   — when
```

It is **not** in Realtime's publication, and the public key has **no access** to it. Only the
backend reads it. So:

- the chat history leaves out messages **you** hid;
- the inbox skips them when choosing the preview, and doesn't count them as unread;
- the other person's app never hears about it.

**One consequence to know about.** Your other devices learn about the hide the next time they
load the thread (no Realtime event reaches them either). That's the price of privacy, and
it's fine.

## 1.8 Copying the quote at send time

When Arjun replies to Priya's "Is it still available?", his reply needs to show that text in
its quote. Two ways:

| Way | How the quote gets its text | Catch |
|---|---|---|
| **Look it up** | the app finds the original message in what it has loaded | If the original is old and not loaded — or the reply arrives live — the app has nothing to show |
| **Copy it** (chosen) | when the reply is saved, the database copies the original's sender and first 200 characters into the reply's own row | the copy must be wiped if the original is deleted (§1.6 does that) |

Copying a value you could look up is called **denormalisation**. It trades a little
duplicate data for simplicity and speed. Here it means the quote is always there, even in a
Realtime event, with no extra request.

**Who does the copying:** a **trigger** — a function the database runs automatically on every
`INSERT` into `messages`. It also checks that the quoted message is in the **same
conversation** (same listing, same two people) and not deleted. The backend only sends
`reply_to_id`; it can't write the quote itself. My test script tries to forge a quote and
checks that the trigger overwrites it.

## 1.9 Rules in the database, and how their errors reach the apps

Your `backend/CLAUDE.md` already says **"Business rules live in the database, not in your
controller."** 6B follows it: every rule — who may delete, the 60-minute window, who may mark
sold, who may be the buyer — lives in a SQL function.

**Why:** the website, the app, and any admin tool you build later all go through the same
function, so they can never disagree.

**How an error travels from SQL to the app — worked example.** Arjun tries to delete Priya's
message for everyone:

1. The backend calls `delete_message_for_everyone(message, Arjun)`.
2. The function sees Arjun isn't the sender and runs
   `raise exception 'NOT_MESSAGE_SENDER'`.
3. The backend's `mapDbError()` (in `utils/respond.js`) looks for known names in the error and
   finds `NOT_MESSAGE_SENDER`.
4. It answers **HTTP 403** with `{ "error": "NOT_MESSAGE_SENDER" }`.
5. The app shows a friendly message.

Block V-A adds the new names to `mapDbError()`, each with its HTTP status. The full table is
in the Appendix.

## 1.10 Unique constraints, and "a double tap is not an error"

**A unique constraint** tells the database "no two rows may share this value". 6B adds one on
`purchases.product_id`: **one buyer per listing**. Before, marking a listing sold twice
inserted two purchase rows, and both buyers saw it in their purchases. The migration keeps
the newest row for each listing, deletes the older duplicates, then adds the rule.

**Idempotent** means "doing it twice has the same effect as doing it once". People double-tap.
Phones resend on a bad network. So:

- deleting a message for everyone **twice** returns the same tombstone, not an error;
- hiding a message **twice** is fine;
- marking sold **again** just changes the buyer and keeps the original sold date.

## 1.11 Counting views honestly

**Before**, two places added 1 to `products.views`:

1. The website's product card, for every card **shown** in the feed — that's an "impression",
   not a view — once per browser tab.
2. The API, on **every** product-page request, including every "load more comments" and
   every refetch.

Plus anyone could call the function directly (finding 7). The number meant nothing.

**After**, one rule: **a view is a signed-in person opening a listing's page, counted once
per person per listing, ever.** So `views` now means "how many different people looked at
this", which is the number a seller cares about.

It needs a table to remember who has already been counted:

```
product_views (product_id, viewer_id, first_viewed_at)   — one row per person per listing
```

**Worked example.** Priya opens Rahul's cycle three times on Monday and twice on Tuesday:
**+1**. Rahul opens his own listing: **+0**. A demo account opens it: **+0** (demo accounts
are free and unlimited; they could otherwise inflate any real listing). Sneha from NIET opens
it: **+1**.

Old numbers are left as they are — they can't be reconstructed, and production's data is test
data that gets wiped before launch.

## 1.12 Deploy order — database first, apps last

In your setup, merging to `main` is what puts code live: Netlify builds the website from
`main`, and the API on Render runs `main` (V-0 checks both settings once). The database
changes only when Vishwajeet runs `supabase db push`.

**The safe order for any change is "expand, then use, then contract":**

1. **Expand the database** — add columns, tables and functions, in a way the **old** API
   still works with. All three 6B migrations are like this. I checked each one against the
   old API: new columns can be empty, the old view function still works for the backend,
   and so on.
2. **Ship the API** that uses the new columns.
3. **Ship the apps** that use the new API.
4. **Contract** — remove the old things — only later, when nothing uses them. (The old view
   function is removed in Phase 9.)

**One exception in 6B: the privacy change goes the other way round.** The API starts sending
`seller: null`, and the old website crashes on that (§1.5). So: **the website learns to handle
`seller: null` first (N-D), then the API starts sending it (N-C).** §2.4 lists the exact merge
order for each go-live.

## 1.13 Long-press, swipe, and scroll — how a gesture knows what you meant

On the phone, three things can start with the same touch on a bubble:

| Gesture | How it is recognised |
|---|---|
| **Scroll** the chat | the finger moves mostly **up or down** |
| **Swipe right to reply** | the finger moves **right** by 12 or more **before** it moves 10 up or down |
| **Long-press for the menu** | the finger stays still for **350 ms** |

`react-native-gesture-handler` (already installed) lets each gesture say when it should
**activate** and when it should **give up**. The swipe says "activate after 12 to the right;
give up after 10 vertically" (`activeOffsetX`, `failOffsetY`), so a scroll never turns into a
swipe. The long-press says "fail if the finger moves", so a swipe never opens the menu. When
two gestures could both win, `Gesture.Race` lets the first to activate win.

The bubble's movement runs with **Reanimated** on the UI thread. That means no React state
changes while the finger moves — which is what keeps it smooth on the Samsung A03s.

## 1.14 Copy needs a "secure" page

Browsers only let a page write to the clipboard with `navigator.clipboard` if the page is
**secure**: `https://…` or `http://localhost`.

| How the website is opened | Secure? | `navigator.clipboard` |
|---|---|---|
| `https://yahora.netlify.app` (production) | yes | works |
| `http://localhost:3000` on the laptop | yes | works |
| `http://192.168.1.7:3000` from a phone on the same Wi-Fi (how Neeraj tests on phones) | **no** | **missing** |

So the website needs a fallback: put the text in a hidden `<textarea>`, select it, and run
`document.execCommand('copy')`. It is old but it works everywhere. **Your website already has
exactly this** — `copyText()` in `frontend/src/utils/share.js`, written for the share sheet.
CC-N7b reuses it instead of writing a second one. Without the fallback, Copy would silently
fail on every phone test, and someone would lose an hour wondering why.

The app uses `expo-clipboard` (V-0 installs it), which works in Expo Go.

---
# PART 2 — FILES, OWNERSHIP, CALENDAR, GO-LIVES

## 2.1 Every file this phase touches, by person

**Vishwajeet**

| Area | Files |
|---|---|
| Shared backend | `backend/src/utils/viewer.js` (**new**), `backend/src/utils/respond.js` (new error names), `backend/API.md` (privacy rule + messages sections) |
| Database | three new files in `supabase/migrations/` (bodies from `docs/runbooks/phase6b/`) |
| Messages API | `backend/src/modules/messages/messages.controller.js`, `messages.routes.js` |
| Mobile — privacy | `src/components/ProductCard.tsx`, `src/components/SwipeCard.tsx`, `src/components/CommentThread.tsx`, `app/product/[id].tsx`, `app/profile/[id].tsx`, `src/hooks/usePublicProfile.ts`, `src/types/index.ts` |
| Mobile — messages | `src/lib/messageActions.ts` (**new**), `src/components/MessageActionSheet.tsx` (**new**), `src/components/AppToast.tsx` (**new**), `src/lib/messages.ts`, `src/hooks/useMessages.ts`, `src/contexts/RealtimeContext.tsx`, `app/chat/[contactId].tsx`, `app/(tabs)/messages.tsx`, `src/theme/index.ts`, `package.json` (+ `expo-clipboard`) |
| Mobile — Mark as Sold | `src/components/BuyerPickerSheet.tsx` (**new**), `src/hooks/useBuyerCandidates.ts` (**new**), `src/hooks/useDashboardActions.ts`, `app/(tabs)/profile.tsx`, `app/product/[id].tsx`, `app/profile/[id].tsx` |
| Repo root | delete `phase6-design-assets.zip`, `cache.jsx`, `temp.cpp` (V-0) |

**Neeraj**

| Area | Files |
|---|---|
| Changelog | `scripts/changelog.mjs` (adds `release`), `docs/changelog/README.md`, `docs/changelog/releases/phase-6A.md` (generated), one line in root `CLAUDE.md` |
| Design | `docs/design/MESSAGES_SPEC.md` (v3), `docs/design/MARK_SOLD_SPEC.md` and the mockups — from the package |
| Backend — **on loan** (§2.2) | `backend/src/modules/products/products.controller.js`, `products.routes.js`, `backend/src/modules/share/share.controller.js` |
| Backend — his own | `backend/src/modules/user/user.controller.js`, `user.routes.js`, and their parts of `backend/API.md` |
| Website — privacy and views | `src/components/ProductCard/ProductCard.jsx`, `src/pages/product/ProductDetail.jsx`, `src/pages/publicProfile/PublicProfile.jsx`, `netlify/edge-functions/product-preview.js` |
| Website — messages | `src/pages/messages/Messages.jsx`, `Messages.module.css`, `src/utils/messageActions.js` (**new**), `src/components/MessageMenu/` (**new**), `src/components/AppToast/` (**new**), `src/styles/global.css` |
| Website — Mark as Sold | `src/pages/dashboard/Dashboard.jsx` + `.module.css`, `src/components/BuyerPicker/` (**new**), `src/pages/product/ProductDetail.jsx`, `src/pages/publicProfile/PublicProfile.jsx` |
| Testing | all of T1–T5 |

**Nobody else's files.** The only overlap is `backend/API.md`, which both of you edit — in
different sections. Git merges edits to different parts of one file on its own. Rebase on
`main` before opening a backend PR, as `backend/CLAUDE.md` already says, and it stays clean.

## 2.2 Ownership — one loan, for this phase only

`backend/CLAUDE.md` gives the `products` and `share` modules to Vishwajeet. **For Phase 6B
they are lent to Neeraj**, from Day 2 until sign-off. Why:

- Vishwajeet's side already has the database, the messages API and **all** the mobile work.
  The mobile work alone is about 8 days.
- The privacy fix, the views fix and the Mark-as-Sold endpoints all live in
  `products.controller.js`. If both of you edited that file in the same week, you'd be back
  to conflicts. One person holds it for the whole phase.

The rules of the loan:

1. Vishwajeet does not edit `backend/src/modules/products/` or `backend/src/modules/share/`
   until sign-off.
2. Neeraj **does not change the `OWNER:` banners**. The loan is recorded in a changelog entry
   (Vishwajeet files it in V-A), and every Claude Code prompt that touches these files says so.
3. **Every backend PR is still reviewed by the other person** (`backend/CLAUDE.md`). Neeraj's
   products PRs are reviewed by Vishwajeet; Vishwajeet's messages PRs by Neeraj.
4. The modules return to Vishwajeet at sign-off. The SIGN-OFF entry says so.

`backend/CLAUDE.md` also says "one module per PR". **N-C is the one exception:** its three
modules carry one rule that has to go live at the same moment. Put them in one PR and say so
in its description.

## 2.3 The calendar

Each day is one working day of 5–6 hours. **R** = review the other person's backend PR (about
30 minutes).

| Day | Date | Vishwajeet | Neeraj |
|---|---|---|---|
| 1 | Mon 12 Oct | **V-0** setup (after Neeraj's package commit, ~10:30) · **V-A** shared backend pieces → PR by evening · design review with Neeraj (30 min, ~12:00) | **N-0** unzip + commit the package (**first thing**), "before" evidence · **N-A** changelog release, release 6A · design review · **R** V-A |
| 2 | Tue 13 Oct | **V-B** three migrations, local tests → merged by evening | **N-C** backend privacy (products, share) — write today; test tomorrow after `supabase db reset` |
| 3 | Wed 14 Oct | **Production push** of the migrations (morning) · **V-C** messages API | **N-C** backend privacy (user module) → PR |
| 4 | Thu 15 Oct | **V-C** finish → PR · **R** N-C · **V-D** mobile privacy states | **N-D** website privacy states, views → PR · **R** V-C |
| 5 | **Fri 16 Oct** | **M1 go-live** (§2.4) · **V-E** mobile message actions begins (CC-V5a) | **M1 go-live** · **T1** privacy on production · **N-E** begins |
| 6 | Sat 17 Oct | **V-E** (CC-V5a) | **N-E** Mark-as-Sold endpoints, profile data → PR |
| 7 | Sun 18 Oct | **V-E** (CC-V5b) · **R** N-E | merge N-E · **N-F** website message actions (CC-N7a) |
| 8 | Mon 19 Oct | **V-E** (CC-V5b) | **N-F** (CC-N7b) |
| 9 | Tue 20 Oct | **V-E** (CC-V5c) | **N-F** (CC-N7c) |
| 10 | Wed 21 Oct | **V-E** (CC-V5c) finish · fix bugs from T2 | **N-F** finish · **T2** message actions begins |
| 11 | **Thu 22 Oct** | **V-F** mobile Mark as Sold (CC-V6a) · fix bugs from T2 | **T2** finish · **M2 go-live** |
| 12 | Fri 23 Oct | **V-F** (CC-V6a) | **N-H** website Mark as Sold (CC-N8a) |
| 13 | Sat 24 Oct | **V-F** (CC-V6b) | **N-H** (CC-N8a) |
| 14 | Sun 25 Oct | **V-F** (CC-V6b) finish | **N-H** (CC-N8b) finish |
| 15 | Mon 26 Oct | fix bugs from T3 | **T3** Mark as Sold |
| 16 | Tue 27 Oct | fix bugs from T3/T4 | **T4** everything, all phones (regression) |
| 17 | **Wed 28 Oct** | **M3 go-live** · fixes | **M3 go-live** · **T5** production check |
| 18 | **Thu 29 Oct** | **SIGN-OFF** together · release 6B | **SIGN-OFF** together |
| — | Fri 30 Oct – Sun 1 Nov | buffer | buffer |

**How the work splits:** about 15 working days of building for Vishwajeet (database, messages
API, every mobile screen) and about 16 for Neeraj (changelog, the backend privacy and
Mark-as-Sold endpoints, every website screen, and **all** the testing on the browser and the
three phones). Even, and each of you owns the platform you know.

## 2.4 Go-lives — what reaches the real site, and in which order

⛔ **Merge in the order written. Each step assumes the one before it is live.**

**Day 3 — the database (Vishwajeet).** All three migrations are pushed together. The live
API keeps working unchanged: every change is additive, and the one thing taken away from the
public key (the view counter) still works for the backend. The website's view-counting call
starts failing quietly in the browser console — harmless, and N-D removes it (live on Day 5).

**M1 — Day 5, privacy and views.**

| Step | Who | What | Why this position |
|---|---|---|---|
| 1 | — | V-A (merged Day 1) and V-C (merged Day 4) are already live | V-A adds a helper nothing calls yet; V-C only adds things |
| 2 | Neeraj | Merge **N-D** (website). Wait for Netlify to finish. Open the live site and check a product page loads | The website must handle `seller: null` **before** the API sends it (§1.5), and `PublicProfile` must send the token before the API needs it |
| 3 | Neeraj | Merge **N-C** (API privacy + views) — Vishwajeet approved it on Day 4 | Now the API hides people from non-students |
| 4 | Neeraj | **T1** on production | Proves M1 |

**M2 — Day 11, message actions.** The API side went live with V-C on Day 4 and only *added*
things, so the old website kept working. M2 is just Neeraj merging **N-F** once T2 has passed.
The phones run Vishwajeet's build through Expo Go, so they have no go-live.

**M3 — Day 17, Mark as Sold.** The endpoints went live when N-E merged on Day 7, after
Vishwajeet's review. They accept exactly what the old website sends (`POST /sold` with
`buyer_id` or `null`), so the old Dashboard kept working. M3 is Neeraj merging **N-H** after T3
and T4 pass, then **T5**.

## 2.5 What "done" means for Phase 6B

- [ ] **Privacy:** on production, a logged-out visitor and a demo account see listings but
      never a real student's name, photo, @username, bio or course — on all 6 endpoints. A
      logged-in student sees exactly what they saw before. (T1)
- [ ] **IDOR:** `?user_id=` on `/api/user/:id/public` changes nothing. (T1)
- [ ] **Comments:** a demo account can't comment or vote on a real campus's listing. (T1)
- [ ] **Views:** the public key can't call the view function; opening a listing twice counts
      once; the seller's own visits don't count. (T1)
- [ ] **Message actions:** every T2 case passes on the website and on all three phones.
- [ ] **Mark as Sold:** every T3 case passes on the website and on all three phones.
- [ ] **Nothing else broke:** T4 passes.
- [ ] **Docs:** `backend/API.md` matches every changed route; both specs are committed;
      6A was released on Day 1 and 6B is released at sign-off; every block filed an entry.

## 2.6 Branches — one short branch per block (new in 6B)

In 6A each of you worked on one personal branch (`infiniper`, `neeraj`) with one PR at a time.
6B needs **two PRs open at once**, more than once:

- Neeraj's **N-C** (API privacy) waits, approved, until M1 on Day 5 — while **N-D** (website),
  written on Day 4, must merge **before** it (§2.4).
- Vishwajeet's **V-C** waits for Neeraj's review on Day 4 while **V-D** (mobile) is already
  being written.

**A branch can hold only one PR.** If N-D's commits sat on the same branch as N-C, merging
"N-D first" would merge N-C along with it — the exact order §2.4 forbids. So in 6B, **every
block gets its own short-lived branch**, cut from the newest `main`, merged by its own PR,
then deleted. (This is how most teams work: "feature branches".)

**Start a block** — example N-C:

```bash
git checkout main
git pull origin main
git checkout -b n-c-identity-rule        # -b = create the branch and switch to it
```

Name it after the block plus two or three words: `v-a-viewer`, `v-b-migrations`,
`v-c-messages-api`, `v-d-mobile-privacy`, `v-e-mobile-messages-1`, `n-a-changelog-release`,
`n-d-website-privacy`, `n-e-mark-sold-api`, …

**Save and share your work:**

```bash
git add -A
git commit -m "feat(products): hide seller identity from non-students"
git push -u origin n-c-identity-rule     # -u only the first time; after that just: git push
```

GitHub then shows a yellow **Compare & pull request** bar → base `main`, compare your branch →
**Create pull request**.

**After it merges:** `git checkout main && git pull origin main`, then
`git branch -d n-c-identity-rule` (GitHub's PR page also offers **Delete branch**).

**When a block needs another block that isn't merged yet** (N-D is tested against N-C's API):
don't build one branch on top of the other — its PR would then contain both. Make a
throwaway branch that has both, test on it, and delete it:

```bash
git checkout n-d-website-privacy
git checkout -b try-m1                   # never pushed
git merge --no-edit n-c-identity-rule
# … run and test …
git checkout n-d-website-privacy
git branch -D try-m1                     # -D = delete even though it was never merged
```

**Backend PRs:** `backend/CLAUDE.md` asks you to rebase on `main` first. On a block branch:

```bash
git fetch origin
git rebase origin/main
git push --force-with-lease              # only after a rebase, only on your own block branch
```

A rebase replays your commits on top of the newest `main`, so the push needs
`--force-with-lease`, which refuses if anyone else pushed to that branch meanwhile. Never use
it on `main`.

**Your personal branches** (`infiniper`, `neeraj`) aren't needed in 6B. Keep or delete them;
just don't put 6B work on them.

---
# TRACK 1 — VISHWAJEET, MANUAL STEPS

Seven blocks. V-A unblocks Neeraj's backend work on Day 1, and V-B's migrations unblock
everyone, so those two come first and must not slip.

## Block V-0 — Setup (Day 1, 1 hour)

**Wait for Neeraj's package commit** (N-0 step 1, about 10:30). Then:

```bash
cd ~/path/to/yahora
git checkout main && git pull origin main
git checkout -b v-0-setup                 # a new branch just for this block (§2.6)
```

**Remove the stray root files** (§0.1), and **add the clipboard module** to the app.
`npx expo install` (not `npm install`) picks the version that matches Expo SDK 57:

```bash
git rm phase6-design-assets.zip cache.jsx temp.cpp
cd mobile && npx expo install expo-clipboard && cd ..
git add -A
git commit -m "chore: remove stray root files; add expo-clipboard"
git push -u origin v-0-setup
```

Open a PR from `v-0-setup` into `main` and merge it (no backend code — no review needed).

**Reset your local database** to a known starting point:

```bash
supabase start
supabase db reset
```

**👁️ CHECKPOINT V-0**

1. `grep expo-clipboard mobile/package.json` shows a version starting `~57.` (or whatever
   `npx expo install` chose — it must not be `latest`).
2. `supabase db reset` finished without a red error.
3. **How do your deploys happen?** Check two settings once, and write the answers in your
   first changelog entry today:
   - **Render** dashboard → your API service → **Settings** → **Auto-Deploy**: Yes or No.
     If **No**, every API go-live in §2.4 needs one extra step after the merge: **Manual
     Deploy → Deploy latest commit**.
   - **Netlify** → your site → **Site configuration → Build & deploy → Continuous
     deployment** → **Production branch**: should say `main`.
4. Expo Go on all three phones still opens your dev build.
5. At about **12:00**, the design review with Neeraj (Block N-B). You're checking the
   **mobile** half of each picture.

## Block V-A — Shared backend pieces (Day 1, half a day)

**This unblocks Neeraj's Day 2.** Read §1.2 (who is asking) and §1.9 (how SQL errors reach
the apps) first.

Run **CC-V1**. It creates `backend/src/utils/viewer.js` — the identity rule in one place —
adds the new error names to `utils/respond.js`, documents the rule in `backend/API.md`, and
files the ownership-loan entry for Neeraj (§2.2).

**👁️ CHECKPOINT V-A**

1. `node --check backend/src/utils/viewer.js` prints nothing (that means "no syntax error").
2. `cd backend && npm run dev`, then in another terminal
   `curl -s http://localhost:5001/api/health` answers. Nothing calls the new file yet, so
   nothing should behave differently.
3. `node scripts/changelog.mjs for neeraj` lists the loan entry.
4. Commit on your `v-a-viewer` branch (§2.6), push, and open a PR into `main`. **Neeraj
   reviews it** (backend PR rule). Merge it today.

## Block V-B — The three migrations (Day 2, a full day; production push Day 3 morning)

Read §1.6 to §1.11 first. They explain every table and function you're about to add.

The migration bodies are already written and tested (§0.5). They're in
`docs/runbooks/phase6b/`. Run **CC-V2**. It creates the three migration files, pastes the
bodies in exactly, resets your local database, and runs both test scripts.

**👁️ CHECKPOINT V-B — local**

1. In the output of the two test scripts, every `NOTICE` line says **ok** — `T1 ok` to `T9 ok`
   in the first script (there is no T8 line: T8 prints two small tables instead), and
   `views ok`, `mark sold ok`, `buyer candidates ok` in the second. If **any** line says
   `ERROR`, stop and send me the output.
2. The privilege rows at the end of each script show `f` in every column, except the last
   row of script 2, which shows `t` (the backend can still use the old view counter until
   N-C ships).
3. Supabase Studio (`http://127.0.0.1:54323`) → Table Editor: `message_hides` and
   `product_views` exist; `messages` has `reply_to_id`, `reply_to_sender_id`,
   `reply_preview`, `deleted_at`; `products` has `sold_at` and no longer has `sold_to`.
4. Commit on `v-b-migrations`, PR, merge. Tell Neeraj: he needs these locally for N-C and
   N-E (he runs `supabase db reset` after pulling).

**Production push — Day 3, first thing. Only you, by hand.** ⛔ Claude Code never touches
production (root `CLAUDE.md`).

*Step 1 — look before you push.* In the Supabase dashboard → **SQL Editor**, run this. It only
reads:

```sql
-- How many purchase rows will the Mark-as-Sold migration remove?
select
  (select count(*) from public.purchases
    where buyer_id is null or product_id is null)                         as broken_rows,
  (select coalesce(sum(n - 1), 0)
     from (select count(*) as n from public.purchases
            group by product_id having count(*) > 1) d)                   as duplicate_rows;
```

Write both numbers in today's changelog entry. They're the rows the migration deletes:
purchase rows pointing at nothing, and the older duplicates of a listing marked sold twice.

*Step 2 — dry run.* In your terminal, at the repo root:

```bash
supabase db push --dry-run
```

It must list **exactly** the three 6B migrations and nothing else. If it lists anything
else, stop: local and production have drifted, and that needs its own look.

*Step 3 — push.*

```bash
supabase db push
```

*Step 4 — check it worked.* Back in the SQL Editor:

```sql
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'messages'
      and column_name in ('reply_to_id','reply_to_sender_id','reply_preview','deleted_at'))
                                                                  as message_columns,       -- expect 4
  (to_regclass('public.message_hides') is not null)               as has_message_hides,     -- expect true
  (to_regclass('public.product_views') is not null)               as has_product_views,     -- expect true
  (select count(*) from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('delete_message_for_everyone','hide_message_for_me',
                      'record_product_view','mark_product_sold','mark_product_available',
                      'remove_my_purchase','get_product_buyer_candidates'))
                                                                  as new_functions,         -- expect 7
  has_function_privilege('anon', 'public.increment_product_views(uuid)', 'execute')
                                                                  as anon_can_add_views,    -- expect false
  (select count(*) from public.products
    where status = 'sold' and sold_at is null)                    as sold_without_date,     -- expect 0
  (select count(*) from (select product_id from public.purchases
                          group by product_id having count(*) > 1) d)
                                                                  as listings_with_two_buyers; -- expect 0
```

*Step 5 — the live site still works.* Open `https://yahora.netlify.app`, browse the
marketplace, open a chat, send a message. Nothing should look different yet.

*Step 6 — tell Neeraj.*
`node scripts/changelog.mjs new vishwajeet "6B migrations pushed to production" --phase 6B --block V-B --for neeraj`
— with the two numbers from step 1 and the results from step 4.

## Block V-C — The messages API (Days 3–4)

Read §1.6 to §1.9 again if they're not fresh. Run **CC-V3**.

**👁️ CHECKPOINT V-C — with curl, against your local API**

First, get tokens for two seeded students (password `password123`). Paste this whole block
into your terminal once. It defines two small helpers, `login` and `send`, and five names:

```bash
API=http://localhost:5001/api
login() {
  curl -s -X POST "$API/auth/login-password" -H "Content-Type: application/json" \
    -d "{\"identifier\":\"$1\",\"password\":\"password123\"}" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['session']['access_token'])"
}
send() {  # send <token> <receiver_id> <content> [reply_to_id]
  python3 -c 'import json,sys; a=sys.argv[1:]; b={"receiver_id":a[0],"product_id":a[1],"content":a[2]}; b.update({"reply_to_id":a[3]} if len(a)>3 else {}); print(json.dumps(b))' "$2" "$WACOM" "$3" ${4:+"$4"} \
  | curl -s -X POST "$API/messages/send" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d @-
}
ARJUN=$(login arjun.mehta); PRIYA=$(login priya.nair)
ARJUN_ID=b0000000-0000-4000-8000-000000000001
PRIYA_ID=b0000000-0000-4000-8000-000000000002
WACOM=e0000000-0000-4000-8000-000000000004
```

Then run these one at a time. The line under each says what you should see:

```bash
# 1. Arjun replies to Priya's seeded message "Works for me…"
send $ARJUN $PRIYA_ID "See you at 5" f0000000-0000-4000-8000-000000000006
#    → "reply_to_sender_id" is Priya's id, and "reply_preview" starts "Works for me"

# 2. A reply pointing into ANOTHER conversation (that message is Priya ↔ Rahul)
send $ARJUN $PRIYA_ID "sneaky" f0000000-0000-4000-8000-000000000008
#    → {"error":"REPLY_TARGET_INVALID"}

# 3. An empty message
send $ARJUN $PRIYA_ID "   "
#    → {"error":"MISSING_FIELDS", ...}

# 4. Priya sends a fresh message; keep its id in MSG
MSG=$(send $PRIYA $ARJUN_ID "my number is 98765" | python3 -c "import sys,json; print(json.load(sys.stdin)['message']['id'])"); echo $MSG
#    → a uuid

# 5. Arjun tries to delete Priya's message for everyone
curl -s -X POST "$API/messages/$MSG/delete-for-everyone" -H "Authorization: Bearer $ARJUN"
#    → {"error":"NOT_MESSAGE_SENDER"}

# 6. Priya deletes it for everyone
curl -s -X POST "$API/messages/$MSG/delete-for-everyone" -H "Authorization: Bearer $PRIYA"
#    → the message, with "content":"" and a "deleted_at"

# 7. Priya tries the same on a message that is days old
curl -s -X POST "$API/messages/f0000000-0000-4000-8000-000000000006/delete-for-everyone" -H "Authorization: Bearer $PRIYA"
#    → {"error":"DELETE_WINDOW_EXPIRED"}

# 8. Arjun deletes one of his old messages for himself only
curl -s -X POST "$API/messages/f0000000-0000-4000-8000-000000000005/delete-for-me" -H "Authorization: Bearer $ARJUN"
#    → {"id":"f0000000-0000-4000-8000-000000000005","hidden":true}

# 9. Arjun's history no longer has it …
curl -s "$API/messages/history?userId=$ARJUN_ID&contactId=$PRIYA_ID&productId=$WACOM&limit=50" -H "Authorization: Bearer $ARJUN" | grep -c f0000000-0000-4000-8000-000000000005
#    → 0

# 10. … but Priya's still does
curl -s "$API/messages/history?userId=$ARJUN_ID&contactId=$PRIYA_ID&productId=$WACOM&limit=50" -H "Authorization: Bearer $PRIYA" | grep -c f0000000-0000-4000-8000-000000000005
#    → 1

# 11. Priya's inbox rows carry the two new fields
curl -s "$API/messages/inbox/$PRIYA_ID" -H "Authorization: Bearer $PRIYA" | python3 -m json.tool | grep -E -m2 "last_sender_id|last_message_deleted"
#    → both lines are printed
```

If a line gives something else, don't merge: copy the command and its output into a note
for me or for Claude Code.

Then open the PR. **Neeraj reviews it.** Merge on Day 4. (It is safe to go live as soon as it
merges: it only adds things — §2.4.)

## Block V-D — Mobile: the privacy states (Day 4)

Read §1.5. Run **CC-V4**.

This is built against the API contract in CC-V4, so you can write it before Neeraj's N-C is
merged. You can only **see** it work once N-C is in your local `main` (Day 5).

**👁️ CHECKPOINT V-D (Day 5, after N-C is merged and pulled)**

The app keeps a demo account on the demo campus (pick another campus and you get the **Unlock
All Campuses** box), and nobody can use the app logged out. So the only way a demo account
meets a real listing on a phone is through a **link**. You'll open one with a QR code, the
same way you open the app in Expo Go every day.

1. Start everything as usual. In the terminal running `npx expo start`, find the line
   `› Metro waiting on exp://192.168.…:8081` and copy the `exp://…:8081` part. Yours is your
   Mac's current Wi-Fi address, so it changes from day to day.
2. On the POCO: log out, press **Explore Live Demo**, and go into the marketplace. The demo
   campus's cards still show the personas' names — the demo campus is never hidden.
3. In a second terminal, make a QR code that points at Rahul's cycle (a real-campus listing
   with questions on it). Put your own address in place of `exp://192.168.1.23:8081`:

   ```bash
   npx qrcode-terminal "exp://192.168.1.23:8081/--/product/e0000000-0000-4000-8000-000000000007"
   ```

   The `/--/` is how Expo Go marks where the app's own page path starts. If npx asks to
   install `qrcode-terminal`, answer `y`.
4. On the POCO, swipe Expo Go away from the recent-apps screen, open **Expo Go** again, tap
   **Scan QR code** and scan the new code. The app opens straight on the cycle — still logged
   in as the demo account.
5. The seller section reads **A student at IIITDM Kurnool**, with
   `Verified students can see who's selling.` under it, a plain person icon instead of
   initials, no "View profile", and tapping it does nothing. Comments are by **Yahora
   student**. Nothing crashes.
6. Make another QR code, this time for Rahul's profile, and scan it the same way:
   `exp://192.168.1.23:8081/--/profile/b0000000-0000-4000-8000-000000000003` →
   **This profile isn't available.** with a back button. No spinner that never stops.
7. Log out, log in as `arjun.mehta` / `password123`, and open the cycle from the feed: name,
   photo, education line and "View profile" exactly as before.

(You won't see the card change — "Yahora student" on a card — anywhere on the phone, because a
demo account can't open a real campus's feed. It's a safety net in case the API ever sends a
hidden seller inside a list.)

## Block V-E — Mobile: message actions (Days 5–10)

The largest block of the phase. Read MESSAGES_SPEC v3 **§10** in full first — it's the
design — and look at `docs/design/message_actions.png`. Then run the three prompts **in
order**, one at a time, each only after the previous checkpoint passes:

| Prompt | Days | What |
|---|---|---|
| **CC-V5a** | 5–6 | Data: types, send-with-reply, the two delete calls, Realtime, the inbox preview (`You:`, deleted), the tombstone |
| **CC-V5b** | 7–8 | The long-press sheet, Copy and its toast, the delete dialog |
| **CC-V5c** | 9–10 | Reply: swipe, the reply bar, the quote in the bubble, jump-to-original |

**👁️ CHECKPOINT V-E5a** — two phones, `arjun.mehta` on one and `priya.nair` on the other
(the Wacom chat):

1. The inbox row for your own last message reads `You: …`.
2. Send a message. It appears on the other phone (Realtime still works).
3. In a terminal, use curl (V-C checks 4 and 6) to send a fresh message from Priya and delete
   it for everyone. Within a couple of seconds Priya's phone shows `You deleted this message`
   and Arjun's shows `This message was deleted` — no ticks on either — and both inbox
   previews update.

**👁️ CHECKPOINT V-E5b**

1. Long-press a message: the row is marked and the sheet shows **Reply · Copy · Delete**.
   Long-press a deleted message: **Delete** only.
2. **Copy**, then paste into the composer: the exact text. On the POCO (Android 11) a
   `Copied` toast shows. On the OPPO (Android 16) and the Samsung (Android 13) Android's own
   confirmation shows instead, and **no** app toast.
3. Delete your own fresh message: three choices; **Delete for everyone** → the tombstone
   `You deleted this message`, with no ticks, on both phones.
4. Delete the other person's message: only **Delete for me** → it disappears on your phone
   only.

**👁️ CHECKPOINT V-E5c**

1. Swipe a message to the right: it follows your finger, the reply icon fades in, and past
   the trigger the reply bar opens in the composer with `Replying to …`.
2. Scroll the chat up and down quickly. A scroll **never** turns into a swipe.
3. Send the reply. Both phones show the quote at the top of the bubble.
4. Tap the quote: the chat scrolls to the original and it flashes.
5. Reply to a message far up (load older pages first), go back to the bottom, tap the quote:
   older pages load and it jumps.
6. Delete the original for everyone: the quote becomes `Original message was deleted`.
7. **On the Samsung A03s:** swipe and scroll feel smooth. If swiping is jerky, write it down
   for T2 — don't change anything yet.

## Block V-F — Mobile: Mark as Sold (Days 11–14)

Read `docs/design/MARK_SOLD_SPEC.md` in full and look at `mark_sold.png`. N-E's endpoints are
merged (Day 7). Run **CC-V6a** (the picker), then **CC-V6b** (everything that shows a sale).

**👁️ CHECKPOINT V-F6a** — log in as `priya.nair`:

1. Profile → Listings → the Wacom tablet → **Mark as sold**: the sheet opens with **Arjun
   Mehta** under `Messaged you about this`.
2. Type `rah`: **Rahul Verma** under `On your campus`. Type `sne`: `No students on your campus
   match "sne".` (Sneha is at NIET.)
3. The button stays faded until you pick someone. Pick Arjun → **Mark as sold** → the sheet
   closes and the card shows `Sold to Arjun Mehta · <today>`.
4. **Change buyer** → Rahul → **Save** → the card says Rahul.

**👁️ CHECKPOINT V-F6b**

1. Log in as `rahul.verma` → Profile → **Purchases**: the Wacom, `From Priya Nair · <date>`,
   **That wasn't me** → confirm → it disappears. Priya's card now says `Sold · buyer not on
   Yahora`.
2. As anyone but Priya, open the Wacom: SOLD stamp, `This item has been sold.`, no Message
   seller, no like or save, no question box.
3. As Priya, open it: `You marked this as sold on <date>.` + `Buyer: …`.
4. Priya's public profile (open it as Arjun): a **Sold · 1** section with the Wacom.
5. As Priya, **Relist** → the dialog → the listing is back in the marketplace feed.

## Block V-G — Fixes, go-lives, sign-off (Days 15–18)

- Fix what T3 and T4 find (Neeraj logs each failure against a block and a platform).
- Day 17: be there for **M3** in case the API needs a manual deploy (V-0 step 3).
- Day 18: SIGN-OFF together.

---
# TRACK 2 — VISHWAJEET, CLAUDE CODE PROMPTS

## The session opener — paste this at the start of every Claude Code session

Same as 6A, plus the two specs. (It is the same opener for Neeraj; change the name.)

```
Phase 6B session start.

1. Read CLAUDE.md at the repo root, and the CLAUDE.md of the folder you will
   work in (backend/, mobile/ or frontend/).
2. Run:  node scripts/changelog.mjs recent 8   and open every entry it lists.
   Run:  node scripts/changelog.mjs for vishwajeet
3. The phase plan is docs/runbooks/PHASE_6B_RUNBOOK.md. Read PART 0, then the
   block I name. Do not start until I paste that block's prompt.
4. The designs are docs/design/MESSAGES_SPEC.md (v3) and
   docs/design/MARK_SOLD_SPEC.md. When a prompt says "implement the spec",
   implement it exactly and invent nothing. If the spec does not cover
   something, keep the current behaviour and tell me.
```

## CC-V1 — The identity rule, the new error names, the loan entry

```
Phase 6B, Block V-A. Shared backend infrastructure: three small changes, all
in files I own. Nothing calls the new code yet; Neeraj's Block N-C will.

1. CREATE backend/src/utils/viewer.js with EXACTLY this content (it was
   written and unit-tested outside the repo; do not "improve" it):

// backend/src/utils/viewer.js
// ══════════════════════════════════════════════
// OWNER: VISHWAJEET   —   added in Phase 6B (Block V-A)
// Neeraj: import from this file; do not edit it.
// ══════════════════════════════════════════════
//
// THE IDENTITY RULE (Phase 6B):
//
//   A real student's identity — name, photo, @username, bio and academic
//   details — is shown only to signed-in students from real campuses.
//   Everyone else (logged-out visitors and demo accounts) still sees the
//   listings, but not the person behind them.
//
// Why demo accounts count as "everyone else": POST /api/auth/demo-login hands
// a real session to anyone, in one click, with no college email. A rule that
// trusted any signed-in caller would therefore protect nothing.
//
// The demo campus's own people are fictional personas and throwaway guests, so
// they are shown to everyone — that is what lets the demo work.
//
// Every place that returns a person goes through canSeeIdentity(). If you
// return a person without asking it, that is the bug this file exists to stop.
import { supabase } from '../config/supabase.js';

/**
 * Who is asking.
 *   kind: 'anonymous' — no valid token
 *         'demo'      — signed in, account on the demo campus
 *         'student'   — signed in, account on a real campus
 * A signed-in account with no users row or no campus is 'anonymous':
 * "I could not establish who you are" fails closed.
 *
 * Needs optionalAuth or requireAuth in front of the route (they set req.user).
 */
export async function resolveViewer(req) {
  const id = req.user?.id ?? null;
  if (!id) return { id: null, universityId: null, kind: 'anonymous' };

  const { data, error } = await supabase
    .from('users')
    .select('university_id, university:universities(is_demo)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data?.university_id || !data.university) {
    return { id, universityId: null, kind: 'anonymous' };
  }

  return {
    id,
    universityId: data.university_id,
    kind: data.university.is_demo === true ? 'demo' : 'student',
  };
}

// The demo campus never changes at runtime, so its id is cached for ten
// minutes rather than looked up on every request.
const DEMO_CACHE_MS = 10 * 60 * 1000;
let demoCache = { ids: null, at: 0 };

async function demoCampusIds() {
  if (demoCache.ids && Date.now() - demoCache.at < DEMO_CACHE_MS) return demoCache.ids;
  const { data, error } = await supabase.from('universities').select('id').eq('is_demo', true);
  if (error) throw error;
  demoCache = { ids: new Set((data ?? []).map((u) => u.id)), at: Date.now() };
  return demoCache.ids;
}

/** True only for the demo campus. Unknown or null ids are NOT demo (fail closed). */
export async function isDemoCampus(universityId) {
  if (!universityId) return false;
  return (await demoCampusIds()).has(universityId);
}

/**
 * May this viewer see the identity of a person who belongs to a campus?
 * `subjectIsDemo` is that campus's isDemoCampus() answer.
 */
export function canSeeIdentity(viewer, subjectIsDemo) {
  return viewer.kind === 'student' || subjectIsDemo === true;
}

/**
 * Remove the seller from a product row, in place. `seller_id` goes too: it is
 * the key to GET /api/user/:id/public, so leaving it would undo the point.
 * `seller_hidden: true` tells clients to draw "Yahora student" rather than
 * treating the missing seller as an error.
 */
export function hideSeller(product) {
  if (!product) return product;
  delete product.seller_id;
  product.seller = null;
  product.seller_hidden = true;
  return product;
}

/** Remove the author from every comment, in place. Comment text stays. */
export function hideCommenters(comments) {
  for (const comment of comments ?? []) {
    delete comment.user_id;
    comment.user = null;
    comment.user_hidden = true;
  }
  return comments;
}

2. In backend/src/utils/respond.js, REPLACE the body of mapDbError (keep
   sendError and sendPage exactly as they are) so the raised-name list
   becomes a name → HTTP status map, with the Phase 6B names added:

   /** Names our database functions and triggers RAISE, each with its HTTP status. */
   const RAISED_STATUS = {
     USERNAME_RESERVED: 400,
     BLOCKED: 403,
     NESTED_REPLY_NOT_ALLOWED: 400,
     RATE_LIMIT_POSTS: 429,
     RATE_LIMIT_REPLIES: 429,
     POSTING_RESTRICTED: 400,
     ACCOUNT_SUSPENDED: 400,
     // Phase 6B — message actions (migration message_actions)
     MESSAGE_NOT_FOUND: 404,
     NOT_MESSAGE_SENDER: 403,
     DELETE_WINDOW_EXPIRED: 403,
     REPLY_TARGET_INVALID: 400,
     // Phase 6B — Mark as Sold (migration mark_sold)
     PRODUCT_NOT_FOUND: 404,
     NOT_PRODUCT_OWNER: 403,
     BUYER_NOT_FOUND: 404,
     BUYER_IS_SELLER: 400,
     BUYER_NOT_ON_CAMPUS: 400,
     PURCHASE_NOT_FOUND: 404,
   };

   export function mapDbError(res, error) {
     if (error.code === '23505') return sendError(res, 400, 'DUPLICATE');
     if (error.code === '23503') return sendError(res, 400, 'INVALID_REFERENCE');

     // Matched by name inside the message. No name here is part of another
     // name — keep it that way, or the wrong one can match first.
     const raised = Object.keys(RAISED_STATUS).find((name) => error.message?.includes(name));
     if (raised) return sendError(res, RAISED_STATUS[raised], raised);

     console.error('[db]', error);
     return sendError(res, 500, 'INTERNAL_ERROR');
   }

   The seven existing names keep exactly the statuses they have today
   (RATE_LIMIT_* 429, BLOCKED 403, the rest 400). Check that against the
   current code before you replace it, and tell me if anything differs.

3. backend/API.md: add a section near the top of Part 1 titled
   "The identity rule (Phase 6B)". Copy the rule from the header comment of
   viewer.js, then this table — which endpoints apply it and how (Neeraj
   implements them in Block N-C; write the table now so both clients can
   build against it):

   | Endpoint | Non-student viewer, real-campus person |
   | GET /api/products | each item: seller null, seller_id removed, seller_hidden true |
   | GET /api/products/:id | the same for the seller; every comment: user null, user_hidden true; adds university_name |
   | GET /api/products/:id/meta | seller_name removed for everyone |
   | GET /share/product/:id | "listed by a student at <campus>" for everyone |
   | GET /api/user/:userId/public | anonymous → 401 LOGIN_REQUIRED; demo → 404 USER_NOT_FOUND |
   | GET /api/users/by-username/:username | same as /public |

   Also list the new error names and statuses from step 2 in API.md's
   error-code section.

4. File the ownership-loan entry:
     node scripts/changelog.mjs new vishwajeet "Ownership loan: products + share modules to Neeraj for Phase 6B" --phase 6B --block V-A --for neeraj
   Body: Neeraj may edit backend/src/modules/products/* and
   backend/src/modules/share/* from today until Phase 6B sign-off, for
   blocks N-C and N-E. He does NOT change the OWNER banners. Vishwajeet does
   not edit those files until sign-off. Every backend PR is still reviewed by
   the other person. In "What NOT to do yet": "Nothing calls viewer.js yet —
   N-C is the first caller."

5. File the block entry:
     node scripts/changelog.mjs new vishwajeet "viewer.js + new error names" --phase 6B --block V-A --for neeraj
   Say what viewer.js exports and how to use it (resolveViewer needs
   optionalAuth or requireAuth in front of the route).

HARD CONSTRAINTS
- Touch only backend/src/utils/viewer.js (new), backend/src/utils/respond.js,
  backend/API.md and two new files in docs/changelog/.
- Do not import viewer.js anywhere yet.
- Do not change sendError or sendPage.

VERIFY AFTER — report each
1. node --check backend/src/utils/viewer.js and node --check
   backend/src/utils/respond.js both pass.
2. A before/after of the seven existing names and their statuses: identical.
3. The backend starts (npm run dev in backend/) and GET /api/health answers.
4. The two changelog file paths.
```

## CC-V2 — The three migrations

```
Phase 6B, Block V-B. Create three migrations from SQL that is already written
and tested. Do NOT change a single character of the SQL.

1. From the repo root, run `supabase migration new <name>` three times, in
   this order, so the timestamps sort in this order. After each, replace the
   new (empty) file's contents with the matching source file, byte for byte:

     message_actions  ←  docs/runbooks/phase6b/01_message_actions.sql
     product_views    ←  docs/runbooks/phase6b/02_product_views.sql
     mark_sold        ←  docs/runbooks/phase6b/03_mark_sold.sql

   Then run `cmp <new file> <source file>` for each pair and show me that
   all three are identical.

2. Run `supabase db reset`. It re-applies every migration and then
   supabase/seed.sql. It must finish without an error.

3. Run both test scripts against the LOCAL database only. Each runs inside
   a transaction and ROLLS BACK, so it leaves no data behind.
   If `psql` is installed on this Mac (`which psql`):

     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f docs/runbooks/phase6b/test_01_message_actions.sql
     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f docs/runbooks/phase6b/test_02_views_and_sold.sql

   If it isn't, use the psql inside the local database container instead
   (project_id "yahora" in supabase/config.toml → container
   supabase_db_yahora; confirm the name with `docker ps`):

     docker exec -i supabase_db_yahora psql -U postgres -d postgres < docs/runbooks/phase6b/test_01_message_actions.sql
     docker exec -i supabase_db_yahora psql -U postgres -d postgres < docs/runbooks/phase6b/test_02_views_and_sold.sql

   Show me their FULL output.

4. File the entry:
     node scripts/changelog.mjs new vishwajeet "6B migrations: message actions, product views, mark sold" --phase 6B --block V-B --for neeraj
   Fill it in from the comments at the top of each SQL file:
   - Migrations applied: the three new file names.
   - New fields: messages.reply_to_id, reply_to_sender_id, reply_preview,
     deleted_at; products.sold_at. Inbox rows: last_sender_id,
     last_message_deleted.
   - Changed (BREAKING for anything that reads it): products.sold_to is
     DROPPED; purchases now allows one row per listing.
   - New tables: message_hides, product_views (backend-only).
   - New functions: delete_message_for_everyone, hide_message_for_me,
     record_product_view, mark_product_sold, mark_product_available,
     remove_my_purchase, get_product_buyer_candidates.
   - What NOT to do yet: "Run `supabase db reset` after pulling — N-C and
     N-E need these locally. Production push is Day 3, by hand."

HARD CONSTRAINTS
- Do not edit the SQL. If any file fails to apply, STOP and show me the
  error — do not fix it yourself.
- Never run supabase db push, supabase link, or anything against
  *.supabase.co. Production is pushed by hand (runbook V-B).
- psql only against the local database (127.0.0.1:54322, or the local
  supabase_db_yahora container).
- Do not touch backend/, mobile/ or frontend/.

VERIFY AFTER — report each
1. The three new file names, and that each is identical to its source.
2. supabase db reset finished without an error.
3. Both test outputs in full. Every NOTICE line must say "ok", and no line may say ERROR.
```

## CC-V3 — The messages API: reply, delete for everyone, delete for me

```
Phase 6B, Block V-C. Messages API changes. The database side is already in
(Block V-B migration message_actions). Read MESSAGES_SPEC.md §10 and the
comments at the top of that migration first.

All changes are in backend/src/modules/messages/ (I own it) and
backend/API.md. Everything here must stay BACKWARD COMPATIBLE: the current
website and app must keep working against this API before they are updated.

1. sendMessage (messages.controller.js)
   a. Read reply_to_id from the body, next to receiver_id, product_id,
      content.
   b. Validate BEFORE the campus lookup:
      - content must be a string whose trimmed length is at least 1, else
        sendError(res, 400, 'MISSING_FIELDS', { message: 'A message cannot be empty.' })
      - content.length must be at most 2000 (the composer's limit, spec §2),
        else sendError(res, 400, 'INVALID_FORMAT', { message: 'A message can be at most 2000 characters.' })
      - if reply_to_id is present and not null, it must pass isUuid(), else
        sendError(res, 400, 'INVALID_FORMAT', { message: 'reply_to_id must be a valid UUID.' })
      Store content exactly as sent (do not trim what is stored).
   c. Add reply_to_id: reply_to_id ?? null to the insert. Do NOT send
      reply_to_sender_id or reply_preview — the trigger fills them and
      overwrites anything you send.
   d. If the insert returns an error, `return mapDbError(res, error)`
      instead of throwing (import mapDbError from utils/respond.js). That is
      how REPLY_TARGET_INVALID becomes a 400 instead of a 500.
   e. Leave the demo auto-responder exactly as it is.

2. getChatHistory
   After `const page = data || [];` and after next_cursor is computed from
   the raw page (keep that code exactly where it is), remove the messages
   this viewer hid:
     - if the page is not empty, one query:
       supabase.from('message_hides').select('message_id')
         .eq('user_id', req.user.id).in('message_id', page.map((m) => m.id))
     - drop those ids from the page, THEN reverse into items.
   next_cursor must still be computed from the UNFILTERED page, so paging
   never skips anything. A page may now hold fewer than `limit` items — that
   is fine; next_cursor stays the only end-of-list signal (it already is).

3. Two new handlers, and their routes in messages.routes.js (requireAuth on
   both, like every route in this module):

   POST /api/messages/:id/delete-for-everyone   → deleteMessageForEveryone
     - 400 INVALID_FORMAT if :id is not a uuid
     - supabase.rpc('delete_message_for_everyone',
         { p_message_id: id, p_user_id: req.user.id })
     - on error: return mapDbError(res, error)
       (MESSAGE_NOT_FOUND 404, NOT_MESSAGE_SENDER 403, DELETE_WINDOW_EXPIRED 403)
     - 200 { message: data }   — the tombstone row

   POST /api/messages/:id/delete-for-me   → deleteMessageForMe
     - 400 INVALID_FORMAT if :id is not a uuid
     - supabase.rpc('hide_message_for_me',
         { p_message_id: id, p_user_id: req.user.id })
     - on error: return mapDbError(res, error)   (MESSAGE_NOT_FOUND 404)
     - 200 { id, hidden: true }

   The actor is req.user.id, never a body field — the same rule as every
   other handler in this file.

4. getInbox: no code change. The RPC now returns two more columns
   (last_sender_id, last_message_deleted) and sendPage passes them through.
   Confirm that by reading the code, and say so.

5. backend/API.md — Part 1, Messages:
   - POST /send: the optional reply_to_id, the new 400s, REPLY_TARGET_INVALID,
     and the four new fields on a message (reply_to_id, reply_to_sender_id,
     reply_preview, deleted_at), with one line each on what they mean
     (copy the column comments from the migration).
   - GET /history: the four new fields; hidden-for-me messages are left out;
     a page can be shorter than limit.
   - GET /inbox: last_sender_id, last_message_deleted.
   - The two new routes, with every status code.

6. File the entry for Neeraj — he builds the website against this:
     node scripts/changelog.mjs new vishwajeet "Messages API: reply, delete for everyone, delete for me" --phase 6B --block V-C --for neeraj
   "New endpoints": the two routes. "Changed endpoints (BREAKING)": none are
   breaking; empty messages are now refused with 400 (both clients already
   refuse them). "New fields": the message and inbox fields. "What NOT to do
   yet": "Realtime: a delete-for-everyone arrives as an UPDATE with
   deleted_at set; the replies that quoted it arrive as UPDATEs with
   reply_preview null. A delete-for-me sends NO Realtime event at all (that
   is the point) — remove the message locally after the 200."

HARD CONSTRAINTS
- Touch only backend/src/modules/messages/* and backend/API.md (+ the
  changelog entry).
- No SQL. No change to markAsRead, markAsDelivered or getInbox code.
- Do not touch the products or share modules (they are on loan to Neeraj
  for this phase — see the loan entry).

VERIFY AFTER — report each
1. node --check on both files.
2. The route list in messages.routes.js, in order.
3. Remind me to run the eleven curl checks in runbook V-C before opening
   the PR.
```

## CC-V4 — Mobile: the privacy states

```
Phase 6B, Block V-D. The app must handle the API hiding a real student's
identity from demo accounts (runbook §1.2, §1.5). The contract — written in
backend/API.md "The identity rule (Phase 6B)" — is:

  GET /api/products  and  GET /api/products/:id, when the viewer may not
  see the seller:   seller: null, seller_id absent, seller_hidden: true
  GET /api/products/:id comments, when hidden:   user: null, user_hidden: true
  GET /api/products/:id now also carries university_name (string or null)
  GET /api/user/:id/public for a hidden person:  404 USER_NOT_FOUND
  (401 LOGIN_REQUIRED cannot happen in the app — it always sends a token —
   but treat it the same as 404.)

On the phone this only happens to a DEMO account that opens a real
campus's listing or profile from a link: the campus switcher already keeps
demo accounts on the demo campus (DemoCampusAlert), and the app can't be
used logged out (AuthGate in app/_layout.tsx). Do not change either of
those. Real students see exactly what they see today. Build it now; it can
only be seen working once Neeraj's N-C is merged.

1. src/types/index.ts: make the seller on product types nullable and add
   `seller_hidden?: boolean`; make a comment's user nullable and add
   `user_hidden?: boolean`; add `university_name?: string | null` to the
   product-detail type. Let the compiler (npx tsc --noEmit) find every
   place that now needs a null check, and fix each one.

2. Cards — src/components/ProductCard.tsx and src/components/SwipeCard.tsx
   (and the sellerName / sellerAvatarUrl props passed in app/(tabs)/index.tsx):
   when the seller is hidden, the seller row shows the text "Yahora student"
   and, instead of initials, a plain Feather "user" icon in the same circle.
   Same size, same place — nothing else on the card changes.

3. Product detail — app/product/[id].tsx:
   - Every product.seller.x becomes null-safe.
   - Seller hidden: the seller section shows
       name line:  "A student at <university_name>"  (no university_name →
                   "A Yahora student")
       below it, Inter 400 12 mutedText:
                   "Verified students can see who's selling."
     No avatar initials (use the same "user" icon), no education line, no
     "View profile" and the row is not pressable.
   - isOwnListing must be false when the seller is hidden (a hidden seller is
     never you).
   - Anything that builds a chat link from product.seller.id must not render
     when the seller is hidden (a demo account can't message a real campus
     anyway — the API refuses).

4. Comments — src/components/CommentThread.tsx: a comment whose user is null
   shows "Yahora student" with the "user" icon, is not pressable towards a
   profile, and its reply placeholder reads "Reply…" (not "Reply to <name>…").

5. Public profile — app/profile/[id].tsx and src/hooks/usePublicProfile.ts:
   - Stop sending ?user_id= (the API ignores it now; the viewer comes from
     the token — runbook §1.4).
   - On 404 or 401: a centred state "This profile isn't available." (Inter
     600 15 #1A1A1A) with a back button, using the screen's existing
     empty-state styles. No crash, no infinite spinner.

HARD CONSTRAINTS
- Use theme tokens only; no hex literals in screens.
- Do not change anything a real student sees.
- Do not touch backend/, frontend/ or supabase/.

VERIFY AFTER — report each
1. npx tsc --noEmit passes.
2. Every file you changed and, for each, the null cases you handled.
3. Remind me of checkpoint V-D (a demo account opening Rahul's cycle and
   his profile by QR-code link), which can only be done after N-C is
   merged.
```

## CC-V5a — Mobile message actions, part 1: data, Realtime, inbox, tombstone

```
Phase 6B, Block V-E, part 1 of 3. The data layer for message actions, the
inbox preview, and the deleted-message tombstone. No menus yet (part 2), no
reply UI yet (part 3).

Read first: docs/design/MESSAGES_SPEC.md §10 (all of it, especially §10.8
and §10.9) and the Block V-C changelog entry (the API contract).

1. Constants and helpers — CREATE src/lib/messageActions.ts:
   - the constants of spec §10.10, with exactly those names and values;
   - isDeleted(m)  → !!m.deleted_at
   - isReply(m)    → !!m.reply_to_sender_id
   - canDeleteForEveryone(m, myId, now = Date.now()) → m.sender_id === myId
       && !isDeleted(m) && !m.pending && !m.failed
       && now - Date.parse(m.created_at) < DELETE_FOR_EVERYONE_MINUTES * 60_000
   - firstName(fullName) → the first word, or 'Yahora student' when empty.

2. Types — src/types/index.ts:
   - Message gains OPTIONAL fields (older cached rows don't have them):
     reply_to_id?, reply_to_sender_id?, reply_preview? (string | null),
     deleted_at? (string | null).
   - InboxItem gains last_sender_id? (string | null) and
     last_message_deleted? (boolean).

3. src/lib/messages.ts: add removeMessage(list, id) next to replaceMessage,
   and a helper that sets reply_preview to null on every message whose
   reply_to_id equals a given id (used after a delete-for-everyone).

4. src/hooks/useMessages.ts:
   a. useSendMessage: SendVars gains optional replyToId, replyToSenderId,
      replyPreview. The POST body adds reply_to_id: replyToId ?? null. The
      optimistic message carries reply_to_id, reply_to_sender_id,
      reply_preview (first 200 characters) and deleted_at: null, so the
      quote can show before the server answers. A retry of a failed reply
      sends the same reply fields again (they are on the failed message).
   b. NEW useDeleteForEveryone(contactId, productId):
      POST /api/messages/:id/delete-for-everyone. On success, put the
      returned tombstone into the chat cache on whichever page holds it
      (updateEveryPage + replaceMessage), clear reply_preview on cached
      replies to it (step 3), and invalidate ['inbox', myId].
   c. NEW useDeleteForMe(contactId, productId):
      POST /api/messages/:id/delete-for-me. Optimistic: remove the message
      from every cached page at once, keeping a copy; on error put it back.
      On success invalidate ['inbox', myId]. There is NO Realtime event for
      this (on purpose — runbook §1.7), so this local removal is the only
      update the screen gets.

5. src/contexts/RealtimeContext.tsx:
   a. handleIncoming — when it freshens the inbox row, also set
      last_sender_id: msg.sender_id and last_message_deleted: false.
   b. handleUpdate — BEFORE its early return for "no chat cache", if
      msg.deleted_at is set, invalidate ['inbox', myId] (the conversation's
      preview may have been that message). Then, as today, replace the row
      in the chat cache. Replies whose reply_preview was wiped arrive as
      their own UPDATEs and need nothing extra.

6. Inbox preview — app/(tabs)/messages.tsx (spec §10.9). The preview line:
   - last_message_deleted → a Feather "slash" 12 icon, gap 4, then italic
     "You deleted this message" when last_sender_id === my id, otherwise
     italic "This message was deleted". Keep the row's read/unread weights
     and colours; add only the italic.
   - else if last_sender_id === my id → "You: " + last_message.
   - else last_message.
   - "Start the conversation ✨" only when last_message is null or undefined
     — never for '' (a deleted message's text is '').
   - The search filter keeps matching on last_message as today.

7. The tombstone — app/chat/[contactId].tsx, inside MessageBubble (spec
   §10.8): when isDeleted(message):
   - same bubble shape, side and background as a normal bubble of that side;
   - content: Feather "slash" 14 + gap 6 + label, Inter 400 italic 14/20:
     mine "You deleted this message" in colors.chatTombstoneMine,
     theirs "This message was deleted" in colors.mutedText;
   - meta row: time only, NO ticks;
   - no MessageText (no emoji sizing, no links).
   Add the v3 theme tokens from spec §3 to src/theme/index.ts now (all ten),
   so parts 2 and 3 can use them.

HARD CONSTRAINTS
- Theme tokens only, no hex in screens.
- Do not change how messages are fetched, paged or marked read.
- The marketplace and product screens must not start refetching because of
  this work. Messages are the only thing that changes here.
- Do not touch backend/, frontend/ or supabase/.

VERIFY AFTER — report each
1. npx tsc --noEmit passes.
2. Each file changed, one line each on what changed.
3. Remind me of checkpoint V-E5a.
```

## CC-V5b — Mobile message actions, part 2: the sheet, Copy, Delete

```
Phase 6B, Block V-E, part 2 of 3. The long-press sheet, Copy (with its
toast), and the delete confirmation. Part 1 is merged: the delete hooks, the
tombstone and the theme tokens exist.

Read first: MESSAGES_SPEC.md §10.1, §10.2, §10.7, §10.8.

1. CREATE src/components/AppToast.tsx — the spec §10.7 toast, reusable on
   any screen: a pill (colors.toastBg, Inter 600 12 white, radius 999,
   padding 6/12), centred horizontally, positioned by a `bottom` prop,
   fading in and out over 150 ms, shown for COPY_TOAST_MS. Export a small
   useToast() hook returning { toast, showToast(text) } so a screen renders
   <AppToast message={toast} bottom={…} /> once. No library.

2. CREATE src/components/MessageActionSheet.tsx, built the way
   src/components/AvatarSheet.tsx builds its sheet (React Native Modal,
   transparent, slide), with the values of spec §10.2: scrim, white sheet,
   radius 20 on the top corners, the handle, 52-tall items with icon 20 +
   gap 16 + label Inter 500 15, Delete in colors.errorText. Props: visible,
   onClose, and the list of actions to show (each: key, label, icon,
   danger?). Android back button closes it (onRequestClose).

3. The long-press — app/chat/[contactId].tsx:
   - Long-pressing a message bubble for LONG_PRESS_MS opens the sheet. Use
     react-native-gesture-handler (already installed, root view already in
     app/_layout.tsx): Gesture.LongPress().minDuration(LONG_PRESS_MS),
     calling runOnJS(openActions)(message.id) on start. Part 3 will add a
     Pan gesture beside it, so build the gesture where a second one can be
     composed in later.
   - Which actions (spec §10.1): normal → Reply, Copy, Delete. Tombstone →
     Delete only. Pending or failed → no sheet at all. Reply is wired in part
     3: for now it closes the sheet and does nothing else.
   - While the sheet is open, that message's row shows a full-width band in
     colors.chatRowSelected behind it (it cancels the thread's 12 side
     padding, like the unread band). Only that row re-renders: pass a
     `selected` prop to the memoised bubble.
   - Links inside a message must still open on a normal tap.

4. Copy (spec §10.7): Clipboard.setStringAsync(message.content) from
   expo-clipboard. Then the toast "Copied" — EXCEPT on Android 13 and newer
   (Platform.OS === 'android' && Number(Platform.Version) >= 33), where
   Android shows its own confirmation.
   expo-clipboard was added in Block V-0 — check that mobile/package.json
   lists it. If it doesn't, install it from mobile/ with
   `npx expo install expo-clipboard` (never plain npm install). Expo Go
   already contains its native half, so no new build is needed.

5. Delete (spec §10.8): React Native Alert.alert with title
   "Delete message?":
   - canDeleteForEveryone(message, myId) → body "Delete it for everyone in
     this chat, or only for you?" and buttons, in this order: Cancel
     (style 'cancel'), "Delete for me", "Delete for everyone" (style
     'destructive').
   - otherwise → body "It will be removed from this chat for you. <first
     name> will still see it." and buttons Cancel, "Delete for me".
   "Delete for everyone" → useDeleteForEveryone; an error whose code is
   DELETE_WINDOW_EXPIRED → toast "It's too late to delete this for
   everyone"; any other error → toast "Couldn't delete. Try again."
   "Delete for me" → useDeleteForMe; on error → toast "Couldn't delete.
   Try again."
   (Android draws Alert itself and places buttons by their role; the three
   labels are what the spec fixes.)

HARD CONSTRAINTS
- All motion on the UI thread (Reanimated / gesture-handler); no setState
  while a finger is down. No layout animations inside list rows
  (mobile/DESIGN.md).
- Theme tokens only.
- Do not change paging, unread or read-on-sight behaviour.
- Do not touch backend/, frontend/ or supabase/.

VERIFY AFTER — report each
1. npx tsc --noEmit passes.
2. The expo-clipboard version in mobile/package.json.
3. Which component owns the selected-row and toast state, and that a
   long-press re-renders only the pressed row.
4. Remind me of checkpoint V-E5b, including the Android 11 / 13 / 16 toast
   difference across the three phones.
```

## CC-V5c — Mobile message actions, part 3: Reply

```
Phase 6B, Block V-E, part 3 of 3. Reply: the swipe, the reply bar, the quote
inside the bubble, and jump-to-original. Parts 1 and 2 are merged.

Read first: MESSAGES_SPEC.md §10.3, §10.4, §10.5, §10.6, §10.10.

1. Reply state in app/chat/[contactId].tsx: `replyTo` (a message or null).
   Starting a reply — from the sheet's Reply or from a swipe — sets it and
   focuses the composer input. Sending clears it; so does the bar's close
   button; so does leaving the screen.

2. The reply bar (§10.4), inside the composer bar, above the input row:
   colors.chatQuoteTheirsBg, radius 12, a 3-wide purple accent on its left
   edge, padding 6 / 6 / 13 / 6, gap 8, 6 below.
   Line 1: "Replying to You" or "Replying to <firstName(contact name)>",
   Inter 600 12/16 purple. Line 2: the quoted text, 1 line, ellipsis, Inter
   400 12/16 mutedText (emoji at this size — no jumbo). Close: Feather "x"
   16 mutedText in a 28×28 touch target.

3. Send with a reply: handleSend passes replyToId, replyToSenderId and
   replyPreview (first 200 characters of the quoted content) to the send
   mutation from part 1, then clears replyTo.

4. The quote inside a bubble (§10.5) — in MessageBubble, above MessageText,
   when isReply(message):
   - mine: background colors.chatQuoteMineBg, accent colors.chatQuoteMineBar,
     name white, text colors.chatQuoteMineText;
   - theirs: background colors.chatQuoteTheirsBg, accent purple, name
     purple, text mutedText;
   - radius 8, padding 6 vertical and 8 after the 3-wide accent, 6 above
     the message text; name Inter 600 12/16 ("You" when
     reply_to_sender_id is my id, otherwise firstName(contact name)); text
     Inter 400 12/16, max 2 lines;
   - reply_preview null → italic "Original message was deleted", and the
     quote is not pressable;
   - a reply bubble is never narrower than REPLY_MIN_BUBBLE_WIDTH (the 78% /
     520 maximum still applies).

5. Jump to the original (§10.6): pressing a quote with a reply_to_id
   - finds that message's row in the list data; if found, scrolls to it
     with the SAME scrollToIndex call (viewPosition UNREAD_VIEW_POSITION)
     and the SAME retry handling the unread band uses — reuse that code,
     do not write a second scroller;
   - then flashes the row: a full-width band in colors.chatRowHighlight,
     held JUMP_HIGHLIGHT_HOLD_MS, fading out over JUMP_HIGHLIGHT_FADE_MS
     (Reanimated opacity; only that row re-renders);
   - if the row isn't loaded: set a "pending jump" id, and let an effect
     call fetchNextPage() — at most JUMP_MAX_EXTRA_PAGES times — checking
     after each page arrives; when it appears, jump as above; when pages
     run out or the limit is hit, toast "Couldn't find the original
     message".
   Jumping never marks anything read and never moves the unread band.

6. Swipe to reply (§10.3) — add a Pan gesture to the bubble's gesture from
   part 2 and compose the two with Gesture.Race(longPress, pan):
   - pan: activeOffsetX(12) (right only), failOffsetY([-10, 10]);
   - translateX = clamp(translationX, 0, SWIPE_REPLY_MAX) in a shared value;
   - the reply icon (Feather "corner-up-left" 18 purple in a 30 white
     circle, elevation 1, at the row's left edge, bottom-aligned) has
     opacity interpolate(translateX, [0, SWIPE_REPLY_TRIGGER], [0, 1],
     clamp);
   - on end: if translateX >= SWIPE_REPLY_TRIGGER → runOnJS(startReply)
     (message.id); then withSpring(0, { damping: 20, stiffness: 220 }).
   - Not on tombstones, pending or failed messages (don't attach the pan).
   - Everything moving runs on the UI thread. No setState during the
     gesture.

HARD CONSTRAINTS
- The inverted FlatList, paging, unread band, read-on-sight and the jump
  button keep behaving exactly as now.
- Memoised rows: a swipe or a flash re-renders one row, never the list.
- Theme tokens only. Do not touch backend/, frontend/ or supabase/.

VERIFY AFTER — report each
1. npx tsc --noEmit passes.
2. How the jump reuses the unread band's scroll code (name the function).
3. Remind me of checkpoint V-E5c, and to try swipe-vs-scroll on the Samsung.
```

## CC-V6a — Mobile Mark as Sold, part 1: the buyer picker

```
Phase 6B, Block V-F, part 1 of 2. The "Who bought it?" picker. Neeraj's
N-E endpoints are merged; read their changelog entry for the contract.

Read first: docs/design/MARK_SOLD_SPEC.md §1 (all of it) and
docs/design/mark_sold.png.

The API (all need the token, all are the seller's own listing):
  GET  /api/products/:id/buyer-candidates          → { items, next_cursor: null }
       people who messaged you about it (newest first, ≤ 20)
  GET  /api/products/:id/buyer-candidates?q=<text> → same shape, students on
       the listing's campus matching name or @username (≤ 20, never you)
       each item: { id, username, full_name, avatar_url, messaged }
  POST /api/products/:id/sold   body { buyer_id: <uuid> | null }
       null = "Someone not on Yahora". Calling it again changes the buyer.
  Errors: BUYER_NOT_ON_CAMPUS, BUYER_NOT_FOUND, PRODUCT_NOT_FOUND,
          NOT_PRODUCT_OWNER (spec §1 has the toast text for each).

1. CREATE src/hooks/useBuyerCandidates.ts: useBuyerCandidates(productId,
   query, enabled). With fewer than 2 characters (trimmed) it fetches the
   no-q list; with 2 or more it fetches ?q=, debounced 300 ms (a small
   useDebouncedValue inside this file — there is no shared one). Query key
   includes productId and the debounced q.

2. src/hooks/useDashboardActions.ts: markSold takes { id, buyerId }
   (buyerId null = off-platform) and posts { buyer_id }. On success it
   refreshes the dashboard query and any cached product or public-profile
   query for that listing. Add removePurchase: DELETE
   /api/products/:id/purchase (part 2 uses it).

3. CREATE src/components/BuyerPickerSheet.tsx — spec §1 exactly: sheet
   container and handle, title (Bree Serif 400 20), subtitle (the listing
   title), the search field, the two sections and their labels, person rows
   (36 avatar via the existing Avatar component, name, @username), the
   divider, the off-platform row (Feather "user-x" 18 in a 36 inputBg
   circle), exactly one row selected, the confirm button (gradient purple →
   bubbleMineEnd, label "Mark as sold", or "Save" when changing the buyer;
   opacity 0.4 until something is selected; spinner while saving), the
   skeleton rows, the no-match line, and the error toasts (use AppToast
   from Block V-E). Props: visible, onClose, product (id + title),
   initialBuyerId (string | null | undefined — undefined = nothing
   selected; null = off-platform selected), mode ('sell' | 'change').

4. app/(tabs)/profile.tsx: "Mark as sold" on a listing now opens the picker
   (mode 'sell') instead of the Alert. Saving closes it and the card
   updates (part 2 adds the sold line under the price).

HARD CONSTRAINTS
- Theme tokens only. The gradient's end is colors.bubbleMineEnd (#C02B7F),
  not pinkDark — white text needs it (spec §1).
- Do not touch backend/, frontend/ or supabase/.

VERIFY AFTER — report each
1. npx tsc --noEmit passes.
2. Remind me of checkpoint V-F6a.
```

## CC-V6b — Mobile Mark as Sold, part 2: everywhere a sale shows

```
Phase 6B, Block V-F, part 2 of 2. Show a sale consistently: the seller's
cards, the buyer's purchases, the product page, the public profile.

Read first: docs/design/MARK_SOLD_SPEC.md §2 to §5.

The API additions (Neeraj's N-E entry has the details):
  GET /api/user/:id/dashboard
    listings[]:  sold_at, buyer: { id, username, full_name, avatar_url } | null
    purchases[]: product: { …, status, sold_at,
                            seller: { id, username, full_name, avatar_url } }
  GET /api/user/:id/public:  sold_listings[] (≤ 12, newest sold first), sold_count
  GET /api/products/:id:     sold_at; and ONLY when you are the seller and it
                             is sold: buyer: { … } | null
  DELETE /api/products/:id/purchase  ("That wasn't me") → { removed: true }

1. Dates: add formatShortDate(iso) to src/lib/messages.ts — "3 Oct", or
   "3 Oct 2025" for an earlier year, using the fixed English month names
   already in that file.

2. Seller's cards — app/(tabs)/profile.tsx, Listings (spec §3): a sold card
   adds, under the price, "Sold to <full name> · <date>" or
   "Sold · buyer not on Yahora · <date>" (Inter 500 12 mutedText), then two
   text buttons, Inter 600 12 purple, gap 14: "Change buyer" (opens the
   picker in mode 'change' with the current buyer — or null — selected)
   and "Relist". Relist keeps its existing Alert with new wording: title
   "Relist this item?", body "“<title>” goes back on the marketplace." plus, when there
   is a buyer, " <first name> will no longer be shown as its buyer."
   Buttons Cancel, Relist.

3. Buyer's purchases — same screen, Purchases (spec §4): each card adds
   "From <seller full name> · <date>" (Inter 500 12 mutedText) and the
   text button "That wasn't me" (Inter 600 12 mutedText, underlined).
   It asks with Alert: title "Remove this purchase?", body "<seller first
   name> marked “<title>” as sold to you. If that's wrong, remove it. The
   listing stays sold; you just won't be shown as its buyer." Buttons
   Cancel, Remove (destructive). On success the card leaves the list.

4. Product page — app/product/[id].tsx (spec §2): when status is 'sold':
   - keep the existing SOLD stamp;
   - under the price, the banner: inputBg background, radius 12, padding
     10/12, gap 8, Feather "check-circle" 16 mutedText, text
     "This item has been sold." (Inter 600 13 #1A1A1A);
   - for anyone but the seller: hide Message seller, like, save and the
     question composer; existing questions stay readable;
   - for the seller: the banner reads "You marked this as sold on <date>."
     with a second line, Inter 400 12 mutedText, "Buyer: <full name>" or
     "Buyer: someone not on Yahora".

5. Public profile — app/profile/[id].tsx (spec §5): under the active
   listings, a "Sold · <sold_count>" section using the screen's existing
   header and card styles, up to 12 cards with the SOLD badge and no like
   or save. Left out when sold_count is 0.

HARD CONSTRAINTS
- Theme tokens only. Buyers are never shown on public surfaces — only to
  the seller (their cards and their product page) and to the buyer.
- Do not touch backend/, frontend/ or supabase/.

VERIFY AFTER — report each
1. npx tsc --noEmit passes.
2. Remind me of checkpoint V-F6b.
```

---
# TRACK 3 — NEERAJ, MANUAL STEPS

Nine blocks: four of building, and five of testing (T1–T5). The testing decides whether the
phase passed, and it's all yours — the website **and** the three phones.

## Block N-0 — The package, setup, and the "before" evidence (Day 1, first thing)

**Step 1 — commit the package. Everyone waits for this, so do it first.**

```bash
cd ~/path/to/yahora
git checkout main && git pull origin main
git checkout -b n-0-package                   # a new branch just for this block (§2.6)
unzip -o ~/Downloads/phase6b-package.zip      # -o: replace MESSAGES_SPEC.md (v2 → v3) without asking
git status --short
```

`git status` must show `M docs/design/MESSAGES_SPEC.md` and `??` for the new files — and
nothing outside `docs/`. Then:

```bash
git add docs/design docs/runbooks
git commit -m "docs: Phase 6B package — runbook, MESSAGES_SPEC v3, MARK_SOLD_SPEC, mockups, tested SQL"
git push -u origin n-0-package
```

Open a PR from `n-0-package` into `main` and merge it (docs only — no review needed). Tell
Vishwajeet it's in. From here on, every block starts on its own fresh branch (§2.6).

**Step 2 — setup.**

```bash
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

You'll run `supabase db reset` on Day 2, after Vishwajeet's migrations are merged.

**Step 3 — 👁️ the "before" evidence, on production.** This proves the leaks exist before
anything changes, so T1 can prove they're gone. Everything here only **reads**.

```bash
API=https://yahora-yst4.onrender.com/api

# Every campus and its id. Pick a real campus that has listings — your own is easiest.
curl -s "$API/universities" | python3 -c "import sys,json; [print(u['id'], u['name']) for u in json.load(sys.stdin)]"
UNI=<paste that campus's id>

# 1. Listings with the seller's name and photo — no login
curl -s "$API/products?university_id=$UNI&limit=2" | python3 -c "
import sys, json
for p in json.load(sys.stdin)['items']:
    print('listing', p['id'], '| seller_id', p.get('seller_id'), '| seller', p.get('seller'), '| hidden', p.get('seller_hidden'))"
```

Each printed line is one listing. Today `seller` shows a real name and photo link.
(`None` is how Python prints "empty".) Copy one listing's id into `PID` and its
`seller_id` into `SELLER`:

```bash
PID=<a listing id>
SELLER=<that listing's seller id>

# 2. The seller's profile — no login
curl -s "$API/user/$SELLER/public" | python3 -m json.tool | head -25

# 3. The listing page data — seller's qualification and year, commenters
curl -s "$API/products/$PID" | python3 -m json.tool | grep -E '"full_name"|"qualification"|"year_of_study"'

# 4. The link-preview data and the share page
curl -s "$API/products/$PID/meta" | python3 -m json.tool | grep seller_name
curl -s "https://yahora-yst4.onrender.com/share/product/$PID" | grep -o "listed by [^<]*"
```

Write down, for each of 1–4: **did a real person's name come back without logging in?** (You
expect "yes" four times.) Put it in your N-0 changelog entry:

```bash
node scripts/changelog.mjs new neeraj "6B before-evidence: identity leaks on production" --phase 6B --block N-0 --for vishwajeet
```

## Block N-A — The changelog release command (Day 1)

Read §1.1 first. Run **CC-N1**.

**👁️ CHECKPOINT N-A**

1. The dry run listed 18 files and changed nothing (`git status` was clean after it).
2. After the real run, `git status --short docs/changelog` shows **one `A`** (or `??` before
   you `git add`) and **18 `D`**.
3. Open `docs/changelog/releases/phase-6A.md` in VS Code's Markdown preview (Cmd+Shift+V):
   the table is at the top, and clicking a title jumps to that entry.
4. `node scripts/changelog.mjs recent 8` ends with the line `Released phases (older entries):
   docs/changelog/releases/phase-6A.md`.

Commit, PR, merge.

## Block N-B — The design review, with Vishwajeet (Day 1, ~12:00, 30 minutes)

Open these side by side: `docs/design/message_actions.png` and `docs/design/mark_sold.png`
(or the two `-mockup.html` files in Chrome), and the two specs.

Agree on these five things — each is a product decision, not just a look:

| # | Decision | Where |
|---|---|---|
| 1 | "Delete for everyone" works for **60 minutes** | MESSAGES_SPEC §10.8 |
| 2 | Logged-out visitors and demo accounts see **"Yahora student"** | runbook §1.5 |
| 3 | The buyer of a listing is **never shown publicly** | MARK_SOLD_SPEC §0 |
| 4 | On the website, the actions button sits **beside** the bubble | MESSAGES_SPEC §10.2 |
| 5 | No "Copied" toast on Android 13 and newer | MESSAGES_SPEC §10.7 |

**If you change anything, change the spec file first**, commit it, and only then build.
That's the one rule both specs start with.

## Block N-C — Backend: the identity rule (Days 2–3)

**Before you start:** pull `main` (Vishwajeet's V-A and V-B are in) and run
`supabase db reset`. Read §1.2–§1.5 and §1.11, and `backend/src/utils/viewer.js`.

⛔ **The products and share modules belong to Vishwajeet and are on loan to you** (§2.2). The
prompts say so. Don't change their `OWNER:` banners.

Run **CC-N2** (products and share), then **CC-N3** (your user module).

**👁️ CHECKPOINT N-C — three kinds of caller, against your local API**

Start the backend (`cd backend && npm run dev`). Then paste once:

```bash
API=http://localhost:5001/api
KURNOOL=a0000000-0000-4000-8000-000000000001
WACOM=e0000000-0000-4000-8000-000000000004     # Priya's tablet — no questions on it
CYCLE=e0000000-0000-4000-8000-000000000007     # Rahul's cycle — has questions on it
PRIYA_ID=b0000000-0000-4000-8000-000000000002
STUDENT=$(curl -s -X POST "$API/auth/login-password" -H "Content-Type: application/json" \
  -d '{"identifier":"arjun.mehta","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['access_token'])")
DEMO=$(curl -s -X POST "$API/auth/demo-login" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['access_token'])")
```

Then:

```bash
# 1. The list, three ways. Look at the first item's seller each time.
curl -s "$API/products?university_id=$KURNOOL&limit=1" | python3 -m json.tool | grep -E '"seller|seller_id'
#    → "seller": null, "seller_hidden": true, and NO seller_id line
curl -s "$API/products?university_id=$KURNOOL&limit=1" -H "Authorization: Bearer $DEMO" | python3 -m json.tool | grep -E '"seller|seller_id'
#    → the same as anonymous
curl -s "$API/products?university_id=$KURNOOL&limit=1" -H "Authorization: Bearer $STUDENT" | python3 -m json.tool | grep -A2 '"seller"'
#    → the seller with a full_name, as before

# 2. A listing with questions on it, as the demo account
curl -s "$API/products/$CYCLE" -H "Authorization: Bearer $DEMO" | python3 -m json.tool | grep -E '"seller"|seller_hidden|"user"|user_hidden|university_name'
#    → "seller": null, "seller_hidden": true, "university_name": "IIITDM Kurnool",
#      and for every question: "user": null, "user_hidden": true

# 3. The profile, three ways
curl -s "$API/user/$PRIYA_ID/public"
#    → {"error":"LOGIN_REQUIRED"}
curl -s "$API/user/$PRIYA_ID/public" -H "Authorization: Bearer $DEMO"
#    → {"error":"USER_NOT_FOUND"}
curl -s "$API/user/$PRIYA_ID/public" -H "Authorization: Bearer $STUDENT" | python3 -m json.tool | grep full_name
#    → "full_name": "Priya Nair"

# 4. By handle, as the demo account
curl -s "$API/users/by-username/priya.nair" -H "Authorization: Bearer $DEMO"
#    → {"error":"USER_NOT_FOUND"}

# 5. A demo account commenting on a real listing
curl -s -X POST "$API/products/$WACOM/comments" -H "Authorization: Bearer $DEMO" \
  -H "Content-Type: application/json" -d '{"content":"spam"}'
#    → {"error":"CROSS_CAMPUS_INTERACTION_BLOCKED", ...}

# 6. The link-preview data no longer has a name
curl -s "$API/products/$WACOM/meta" | grep -c seller_name
#    → 0
```

Then the views — in Supabase Studio's SQL editor (local, `http://127.0.0.1:54323`):
`select views from products where id = 'e0000000-0000-4000-8000-000000000004';` — note the
number. Open the Wacom twice as the student (`curl -s "$API/products/$WACOM" -H
"Authorization: Bearer $STUDENT" > /dev/null`, twice). Run the select again: **+1**, not +2.

Open **one** backend PR from `n-c-identity-rule` with both prompts' work. Say in the
description that it covers three modules on purpose (§2.2). **Vishwajeet reviews it on Day 4.
Don't merge it until M1** (§2.4).

## Block N-D — Website: the privacy states and the views (Day 4)

Read §1.5. Run **CC-N4**.

**👁️ CHECKPOINT N-D** — your local website against your local API **running N-C's code**.
N-C isn't merged yet, so make a throwaway branch that has both (§2.6):

```bash
git checkout n-d-website-privacy
git checkout -b try-m1                    # throwaway — never pushed
git merge --no-edit n-c-identity-rule
```

Start the backend and the website from this branch, then:

1. **A private/incognito window** (logged out): open
   `http://localhost:3000/product/e0000000-0000-4000-8000-000000000007` (Rahul's cycle — it
   has questions on it). The seller reads **A student at IIITDM Kurnool**, with `Log in with
   your college email to see who's selling.` and a **Log in** button. Questions are by
   **Yahora student**. Nothing crashes.
2. Same window: open `http://localhost:3000/user/b0000000-0000-4000-8000-000000000003`
   (Rahul's profile) → **Log in to see this profile**, with a **Log in** button.
3. **Demo**: in a new private window, open `http://localhost:3000`, press **Explore Live
   Demo** and finish the demo set-up. The campus switcher keeps a demo account on the demo
   campus (**Unlock All Campuses** — expected, §1.2), so type the cycle's address from step 1
   into the address bar instead. The seller section says `Verified students can see who's
   selling.` and has no Log in button. Rahul's profile address from step 2 → **This profile
   isn't available.**
4. **Student**: in a normal window, log in as `arjun.mehta` / `password123`. Names, photos and
   profiles look exactly as before. Open Rahul's profile from the cycle: it loads.
5. The browser console on the marketplace shows **no** "Failed to increment views" errors
   (the old view call is gone).

Then `git checkout n-d-website-privacy && git branch -D try-m1`. Fixes go on the branch they
belong to (`n-c-…` or `n-d-…`), never on `try-m1`.

Open the PR from `n-d-website-privacy` (website — no review needed). **Merge it first on
Day 5** (§2.4).

## M1 go-live and T1 — Day 5

**In this order:**

1. Merge **N-D**. Wait for Netlify's deploy to finish (Netlify → Deploys → "Published").
   Open `https://yahora.netlify.app`, open a product page. It loads.
2. Merge **N-C** (Vishwajeet approved it yesterday). If Render's auto-deploy is off (V-0),
   ask Vishwajeet to press **Deploy latest commit**. Wait until Render shows "Live".
3. Run **T1**.

### 👁️ T1 — Privacy and views, on production

Re-run your N-0 "before" commands (same `API`, `UNI`, `PID`, `SELLER`). Now:

| # | Command | Before | Expect now |
|---|---|---|---|
| 1 | the products list | names | every line: `seller_id None \| seller None \| hidden True` |
| 2 | `/user/$SELLER/public` | full profile | `{"error":"LOGIN_REQUIRED"}` |
| 3 | `/products/$PID` | qualification, year, commenters | seller and commenters hidden, `university_name` present |
| 4 | `/meta` and the share page | the name | no `seller_name`; the share page says `listed by a student at …` |

Then with a demo token from production:

```bash
DEMO=$(curl -s -X POST "$API/auth/demo-login" | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['access_token'])")
curl -s "$API/products?university_id=$UNI&limit=1" -H "Authorization: Bearer $DEMO" | python3 -m json.tool | grep -E '"seller|seller_id'
#    → hidden
curl -s "$API/user/$SELLER/public" -H "Authorization: Bearer $DEMO"
#    → {"error":"USER_NOT_FOUND"}
curl -s -X POST "$API/products/$PID/comments" -H "Authorization: Bearer $DEMO" -H "Content-Type: application/json" -d '{"content":"t1 check"}'
#    → {"error":"CROSS_CAMPUS_INTERACTION_BLOCKED", ...}   (it's refused, so nothing is written)
```

And in the browser:

| # | Check | Expect |
|---|---|---|
| 5 | Logged-out private window → a product page | `A student at …` + Log in |
| 6 | Logged-out → a `/user/<id>` link | `Log in to see this profile` |
| 7 | **Logged in as yourself** → marketplace, a product page, a profile | **exactly as before** — names, photos, profiles |
| 8 | Open someone else's listing you haven't opened since M1 and note its views (shown on the product page). Reload it three times | it ends exactly **1** higher than the first number — never 2 or more |

Log every failure with a screenshot. If 7 fails — a real student sees "Yahora student" —
**tell Vishwajeet at once**: it means the website isn't sending the token somewhere.

File: `node scripts/changelog.mjs new neeraj "M1 live: identity rule + views" --phase 6B --block T1 --for vishwajeet`.

## Block N-E — Backend: the Mark-as-Sold endpoints and the profile data (Days 5–6)

Read `docs/design/MARK_SOLD_SPEC.md` (all of it) and §1.10. Run **CC-N5** (products, on loan),
then **CC-N6** (your user module).

**👁️ CHECKPOINT N-E — local, as Priya (she sells the Wacom)**

```bash
PRIYA=$(curl -s -X POST "$API/auth/login-password" -H "Content-Type: application/json" \
  -d '{"identifier":"priya.nair","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['session']['access_token'])")
ARJUN_ID=b0000000-0000-4000-8000-000000000001
RAHUL_ID=b0000000-0000-4000-8000-000000000003
SNEHA_ID=b0000000-0000-4000-8000-000000000004

curl -s "$API/products/$WACOM/buyer-candidates" -H "Authorization: Bearer $PRIYA"
#    → items: Arjun, with "messaged": true
curl -s "$API/products/$WACOM/buyer-candidates?q=rah" -H "Authorization: Bearer $PRIYA"
#    → items: Rahul
curl -s "$API/products/$WACOM/buyer-candidates?q=sne" -H "Authorization: Bearer $PRIYA"
#    → items: []   (Sneha is at NIET)
curl -s "$API/products/$WACOM/buyer-candidates" -H "Authorization: Bearer $STUDENT"
#    → {"error":"NOT_PRODUCT_OWNER"}   (that token is Arjun's)
curl -s -X POST "$API/products/$WACOM/sold" -H "Authorization: Bearer $PRIYA" -H "Content-Type: application/json" -d "{\"buyer_id\":\"$SNEHA_ID\"}"
#    → {"error":"BUYER_NOT_ON_CAMPUS"}
curl -s -X POST "$API/products/$WACOM/sold" -H "Authorization: Bearer $PRIYA" -H "Content-Type: application/json" -d "{\"buyer_id\":\"$ARJUN_ID\"}" | python3 -m json.tool | grep -E '"status"|sold_at'
#    → "status": "sold" and a sold_at
curl -s -X DELETE "$API/products/$WACOM/purchase" -H "Authorization: Bearer $STUDENT"
#    → {"removed": true}    (Arjun says "that wasn't me")
curl -s -X POST "$API/products/$WACOM/available" -H "Authorization: Bearer $PRIYA" | python3 -m json.tool | grep -E '"status"|sold_at'
#    → "status": "available", "sold_at": null
```

Open the PR. **Vishwajeet reviews it (Day 7)**, then merge. It's safe live at once: the old
Dashboard sends exactly what the new endpoint accepts (§2.4). File the entry CC-N5 asks for —
Vishwajeet builds the app's screens from it.

## Block N-F — Website: message actions (Days 7–10)

Read MESSAGES_SPEC v3 **§10** in full, and look at `message_actions.png` panel E. Run the
three prompts in order, each after the previous checkpoint passes:

| Prompt | Day | What |
|---|---|---|
| **CC-N7a** | 7 | Data: send-with-reply, the two delete calls, Realtime, the inbox preview, the tombstone |
| **CC-N7b** | 8 | The actions button and menu, right-click, Copy and the toast, the delete dialog |
| **CC-N7c** | 9 | Reply: the reply bar, the quote, jump-to-original |

**👁️ CHECKPOINT N-F7a** — two browsers (one normal, one private), Priya in one, Arjun in the
other, both in the Wacom chat:

1. Inbox rows of your own last message read `You: …`.
2. In a terminal, paste the helper block from checkpoint V-C (it logs in Arjun and Priya),
   then run V-C commands 4 and 6: Priya sends a fresh message and deletes it for everyone.
   Both browsers show the tombstone within a couple of seconds, and both inboxes update.

**👁️ CHECKPOINT N-F7b**

1. Hover a bubble: the round button appears **beside** it (left of yours, right of theirs).
   Click: Reply · Copy · Delete. Right-click a bubble: the same menu. Esc closes it.
2. Tab to the button, Enter, arrow keys, Enter on Copy: works without a mouse.
3. **Copy**, paste into the composer: the exact text; the `Copied` toast shows.
4. Delete your own fresh message → three choices → **Delete for everyone** → tombstone on
   both sides. Delete the other person's → only "Delete for me".

**👁️ CHECKPOINT N-F7c**

1. Reply from the menu: the reply bar with `Replying to …`; Esc in the input closes it.
2. Send it: both browsers show the quote in the bubble.
3. Click the quote: it scrolls to the original and flashes.
4. **On your phone's browser** (the website over Wi-Fi, `http://192.168.x.x:3000`): tap a
   bubble → the button appears → Copy works (the fallback from §1.14).

## Block N-G — 👁️ T2: message actions everywhere (Days 10–11)

**Set up:** pull `main` (Vishwajeet's mobile blocks are merged), then on your Mac run
`cd mobile && npm install && npx expo start` and open the app on each phone with Expo Go. The
app finds your local API by itself (it uses the Mac that runs Expo). Your laptop's browser as
**Priya**; the **POCO** as **Arjun**; the **OPPO** and the **Samsung** as **Rahul** (he has a
chat with Priya about the cycle).

| # | Do this | Expect | Web | POCO | OPPO | Samsung |
|---|---|---|---|---|---|---|
| 1 | Open the actions (hover/tap the button on web; long-press on phones) | Reply · Copy · Delete; the row is marked | | | | |
| 2 | Actions on a deleted message | Delete only | | | | |
| 3 | Copy a message, paste it into the composer | exact text | | | | |
| 4 | Watch for the toast after Copy | web: `Copied` · POCO (Android 11): `Copied` · OPPO (16) and Samsung (13): **Android's own** confirmation, **no** app toast | | | | |
| 5 | Reply (menu on web; **swipe right** on phones) and send | quote shows on both sides; name is `You` or the first name | | | | |
| 6 | Reply `ok` to a very long message | quote shows 2 lines; the bubble is not squashed | | | | |
| 7 | Tap a quote | scrolls to the original and it flashes | | | | |
| 8 | Reply to an old message (scroll up first), go to the bottom, tap the quote | older pages load, then it jumps | | | | |
| 9 | Delete your own fresh message for everyone | tombstone on **both** sides within seconds; no ticks on it | | | | |
| 10 | …then look at a reply that quoted it | `Original message was deleted`, and tapping it does nothing | | | | |
| 11 | Delete the other person's message | only "Delete for me"; it disappears **only for you** | | | | |
| 12 | After 11, reload / reopen the chat | still gone for you; still there for them | | | | |
| 13 | Inbox | `You: …` on your last message; deleted last message in italics | | | | |
| 14 | Hide every message of one chat ("Delete for me" on each) | the chat leaves **your** inbox only | | | | |
| 15 | **Samsung:** scroll the chat fast, up and down, for 30 seconds | never turns into a swipe; no stutter | — | — | — | |
| 16 | **Samsung:** swipe-to-reply ten times | smooth; the bubble springs back | — | — | — | |
| 17 | Keyboard on web: Tab, Enter, arrows, Esc | all work | | — | — | — |
| 18 | Phone's browser (website over Wi-Fi): tap a bubble, Copy | works (fallback) | | — | — | — |
| 19 | **Regression:** send, receive live, unread band, jump-to-latest button, read ticks, scroll up for older messages, welcome sticker in an empty chat | all exactly as before | | | | |

Mark each cell ✅ or ❌. For every ❌: a screenshot or screen recording, the platform, and the
block (V-E or N-F). Vishwajeet fixes mobile ❌s on Days 10–11; you fix web ones.

**If 15 or 16 fails on the Samsung**, record it and tell Vishwajeet: the fix is in the swipe's
gesture settings, not in the design.

**M2 go-live (Day 11):** when every web cell is ✅, merge N-F. Open the live site, send a
reply, copy a message, delete one for everyone. File:
`node scripts/changelog.mjs new neeraj "M2 live: message actions on web" --phase 6B --block T2 --for vishwajeet`.

## Block N-H — Website: Mark as Sold (Days 12–14)

Read `MARK_SOLD_SPEC.md` again and look at `mark_sold.png` panel J. Run **CC-N8a** (the picker
and the Dashboard), then **CC-N8b** (product page, purchases, public profile, link preview).

**👁️ CHECKPOINT N-H** — the same steps as Vishwajeet's V-F6a and V-F6b, on the website: the
picker (people who messaged, search, the other-campus student not found, off-platform, the
faded button, Save when changing), the sold card lines, Relist with its dialog, "That wasn't
me", the product page for a non-seller and for the seller, the public profile's Sold section.

## Block N-I — 👁️ T3, T4, T5 (Days 15–17)

### T3 — Mark as Sold, everywhere (Day 15)

Local API, set up as for T2. You play the same story twice, so that every screen gets tried on
the website **and** on a phone:

| Person | Round A | Round B |
|---|---|---|
| **Priya** (the seller) | Web | OPPO |
| **Rahul** (the buyer) | OPPO | Web |
| **Arjun** (everyone else) | POCO | Samsung |

Each row is done by the person it names, on that person's device for the round.

| # | Do this | Expect | Round A | Round B |
|---|---|---|---|---|
| 1 | Priya: Mark as sold on the Wacom | the picker; Arjun under `Messaged you about this` | | |
| 2 | Priya types one letter | nothing searches yet | | |
| 3 | Priya types `rah` | Rahul under `On your campus` (after a short pause) | | |
| 4 | Priya types `sne` | `No students on your campus match "sne".` | | |
| 5 | Nothing picked yet | the button is faded and does nothing | | |
| 6 | Priya picks Arjun → Mark as sold | closes; her card: `Sold to Arjun Mehta · <date>` | | |
| 7 | Priya: Change buyer → Rahul → Save | card says Rahul; the sold date doesn't change | | |
| 8 | Rahul: Purchases | the Wacom: `From Priya Nair · <date>` | | |
| 9 | Rahul: That wasn't me → Remove | gone from his purchases; Priya's card: `Sold · buyer not on Yahora` | | |
| 10 | Arjun opens the Wacom | SOLD stamp, `This item has been sold.`; no Message, like, save or question box | | |
| 11 | Priya opens the Wacom | `You marked this as sold on <date>.` + `Buyer: someone not on Yahora` | | |
| 12 | Arjun opens Priya's profile | `Sold · 1` with the Wacom; no buyer anywhere | | |
| 13 | Arjun: the marketplace feed | the Wacom is not in it | | |
| 14 | Priya: Relist → the dialog → Relist | the Wacom is back in Arjun's feed | | |
| 15 | Priya: Mark as sold → `Someone not on Yahora` → Mark as sold | card: `Sold · buyer not on Yahora` | | |

**Between the rounds**, Priya presses **Relist** on the Wacom so Round B starts from an
available listing.

### T4 — Everything, all phones (Day 16)

T1 (the browser parts, locally), T2 and T3 again, quickly, on whichever device each row was
**not** run on before. Then the basics that must not have changed:

- log in with OTP, with username + password, and with the demo button;
- marketplace: infinite scroll, the campus switcher, filters;
- sell a listing with photos, edit it, delete it;
- like, save, ask a question **on your own campus** (works) and on another campus (refused);
- messages: send, receive live, unread band, the chat wallpaper, the welcome sticker.

### T5 — Production, after M3 (Day 17)

**M3:** merge N-H after T3 and T4 are all ✅. Wait for Netlify. Then, on
`https://yahora.netlify.app`, with your own account and one friend's test account on the same
campus:

1. Mark one of your test listings sold to your friend → it appears in their purchases.
2. They press **That wasn't me** → it leaves their purchases.
3. Relist it.
4. In a chat: reply, copy, delete for everyone.
5. Logged out: a product page shows `A student at …`.

File: `node scripts/changelog.mjs new neeraj "M3 live: Mark as Sold on web; T5 passed" --phase 6B --block T5 --for vishwajeet`.

---
# TRACK 4 — NEERAJ, CLAUDE CODE PROMPTS

Start every session with the opener from Track 2, using `for neeraj`.

## CC-N1 — The changelog release command

```
Phase 6B, Block N-A. Add the `release` command to the changelog tool, then
release Phase 6A. The new version of the tool is already written and tested
(on a copy of our real 18 entries): docs/runbooks/phase6b/changelog.mjs.

1. Compare docs/runbooks/phase6b/changelog.mjs with scripts/changelog.mjs
   and show me the diff. It must ONLY add: the RELEASES_DIR constant, the
   release command (cmdRelease, demoteHeadings, entryBody, cell), a hint at
   the end of `recent` (printReleasesHint), and usage/help text. One small
   change inside `recent` is expected too: when there are no entries it no
   longer returns early — it prints "No unreleased entries in
   docs/changelog/." and then the hint, so `recent` still says where the
   released entries went right after a release. If it changes anything
   else in new / recent / for, STOP and tell me.
2. Replace scripts/changelog.mjs with it (keep its OWNER line; it's mine).
3. docs/changelog/README.md: add a section "Releasing a phase", in the same
   plain style as the rest of the file, explaining:
   - why: industry practice (changesets, towncrier) — fragments during
     the work, one file per release; git copes with many files, people
     reading the folder don't;
   - when: only at a phase's SIGN-OFF, after both have merged everything;
   - how: `node scripts/changelog.mjs release 6B --dry-run`, then without
     --dry-run; then git add -A docs/changelog and commit;
   - what happens: docs/changelog/releases/phase-<P>.md (table on top,
     every entry in full, oldest first, each keeping its original file
     name); the small files are deleted; git history keeps them;
   - an entry tagged with an already-released phase is refused — tag it
     with the next phase.
4. In the root CLAUDE.md, in the session-start paragraph, add one sentence:
   "Older phases are released into docs/changelog/releases/ — `recent`
   names them; open one only to follow a reference."
5. Run the dry run and show me its output:
     node scripts/changelog.mjs release 6A --dry-run
   Then `git status --short` must show nothing new from it.
6. Run it for real:
     node scripts/changelog.mjs release 6A
   Then: git add -A docs/changelog && git status --short docs/changelog
   — show me: one A (releases/phase-6A.md) and 18 D.
7. node scripts/changelog.mjs recent 8 — show me its output (the last line
   names the release file).
8. File the first 6B entry:
     node scripts/changelog.mjs new neeraj "Changelog: release command; 6A released" --phase 6B --block N-A --for vishwajeet
   Body: the command, the rule "release only at sign-off", and where 6A's
   entries now live.

HARD CONSTRAINTS
- Touch only scripts/changelog.mjs, docs/changelog/ and the one sentence in
  CLAUDE.md.
- No npm dependencies.
- Do not edit the content of any 6A entry before releasing it.

VERIFY AFTER — report each
1. The diff from step 1, summarised.
2. The dry-run output, and that it changed nothing.
3. The git status from step 6.
4. The recent output from step 7.
```

## CC-N2 — Backend: the identity rule in products and share, the campus checks, the views

```
Phase 6B, Block N-C, part 1 of 2. The identity rule in the products and
share modules, the missing campus checks on comments and votes, and the new
way of counting views.

OWNERSHIP — read this first. backend/src/modules/products/* and
backend/src/modules/share/* carry "OWNER: VISHWAJEET" banners. For Phase 6B
they are ON LOAN to me (Neeraj): see the changelog entry "Ownership loan:
products + share modules to Neeraj for Phase 6B". You may edit them. Do NOT
change the OWNER banners.

Read first: backend/src/utils/viewer.js (the rule and its helpers — import
from it, never copy it), backend/API.md "The identity rule (Phase 6B)", and
runbook §1.2–§1.5 and §1.11. The migrations product_views and mark_sold are
in (run `supabase db reset` if you haven't since pulling).

1. getProducts (products.controller.js):
   - const viewer = await resolveViewer(req) at the top. Keep the existing
     viewerId = req.user?.id for the is_liked / is_saved flags.
   - After the products are fetched and flagged, and before sendPage:
       const campusIsDemo = await isDemoCampus(university_id);
       if (!canSeeIdentity(viewer, campusIsDemo)) products.forEach(hideSeller);
     (hideSeller removes seller_id and sets seller null + seller_hidden
     true. sendPage only reads created_at.)

2. getProductById:
   - resolveViewer at the top.
   - Add university:universities!university_id(name) to the product's
     select. After the fetch: product.university_name =
     product.university?.name ?? null; delete product.university.
   - After the comments are assembled and their vote flags attached, and
     BEFORE product.comments = { items, next_cursor } is set:
       const campusIsDemo = await isDemoCampus(product.university_id);
       if (!canSeeIdentity(viewer, campusIsDemo)) {
         hideSeller(product);
         hideCommenters(comments);
       }
     ⚠ hideSeller deletes product.seller_id. Anything that needs to know
     whether the viewer IS the seller must run before it. (Block N-E adds
     one such thing — leave a comment marking the spot.)
   - VIEWS: delete the `await supabase.rpc('increment_product_views', …)`
     call. Replace it with: when viewer.id is set AND this is the first page
     of comments (cursor === null):
       const { error: viewError } = await supabase.rpc('record_product_view',
         { p_product_id: id, p_viewer_id: viewer.id });
       if (viewError) console.error('[views] record_product_view failed:', viewError);
     Never fail the page because a view wasn't counted. The database decides
     what counts (once per person, never the seller, never demo↔real).
     Update the comment that explains views in this function.

3. getProductMeta: remove seller:users!seller_id(full_name) from the select
   and seller_name from the response. Keep university_name. (The website's
   Netlify edge function reads seller_name only if present — Block N-D
   removes that line.)

4. addComment: before the insert,
     if (await blockCrossCampusInteraction(req, res, product_id, 'Add Comment')) return;
   And if parent_comment_id is given, it must be a comment on the SAME
   listing: look it up with maybeSingle(); missing, or a different
   product_id → sendError(res, 400, 'INVALID_REFERENCE',
   { message: 'That comment is not on this listing.' }).

5. toggleCommentVote: look the comment up first (select product_id,
   maybeSingle). Missing → sendError(res, 404, 'NOT_FOUND',
   { message: 'That comment no longer exists.' }). Then
     if (await blockCrossCampusInteraction(req, res, comment.product_id, 'Comment Vote')) return;

6. share/share.controller.js shareProduct: remove the seller join from the
   select. The page body becomes:
     university name present → `${formatPrice(product.price)} · listed by a student at ${product.university.name} on Yahora. Taking you there…`
     otherwise               → `${formatPrice(product.price)} on Yahora. Taking you there…`
   Fix the comment above shareProduct so it no longer implies the seller's
   name is public.

7. products.routes.js: no route changes. Update the comment above the two
   optionalAuth routes: anonymous browsing stays; identities are hidden by
   the identity rule (viewer.js).

8. backend/API.md (products + share sections): seller_hidden, user_hidden,
   university_name; meta without seller_name; the share text; comments and
   votes now 403 CROSS_CAMPUS_INTERACTION_BLOCKED across campuses, 400 for a
   parent on another listing, 404 for a missing comment; how views count.

HARD CONSTRAINTS
- Import from viewer.js; never re-implement canSeeIdentity or a demo check.
- The response shape for a STUDENT viewer must be exactly what it is today
  (plus university_name on the detail).
- Do not touch the user module (that's part 2), frontend/, mobile/ or
  supabase/. No SQL.

VERIFY AFTER — report each
1. node --check on every changed file.
2. For getProducts and getProductById: the order of steps, showing that
   hiding happens after flags and before the response.
3. Remind me of the checkpoint N-C curl checks.
```

## CC-N3 — Backend: the identity rule in the user module

```
Phase 6B, Block N-C, part 2 of 2. The identity rule on the two profile
endpoints, and the ?user_id= IDOR. This is my own module.

Read first: backend/src/utils/viewer.js, runbook §1.2 and §1.4.

1. user.routes.js: router.get('/:userId/public', optionalAuth,
   getPublicProfile). The comment above it says "deliberately
   unauthenticated … Do not add auth here" — replace it: optionalAuth so
   the identity rule can tell students from everyone else (Phase 6B); the
   route still answers logged-out callers, with 401 for real students.

2. getPublicProfile:
   - const viewer = await resolveViewer(req); the visitor for the like/save
     flags is viewer.id. req.query.user_id is IGNORED in silence — both apps
     still send it. Say so in a comment (IDOR, runbook §1.4).
   - Select university_id as well, and use maybeSingle(). No row →
     sendError(res, 404, 'USER_NOT_FOUND') (today a missing user is a 500).
   - Then:
       const subjectIsDemo = await isDemoCampus(profile.university_id);
       if (!canSeeIdentity(viewer, subjectIsDemo)) {
         return viewer.kind === 'anonymous'
           ? sendError(res, 401, 'LOGIN_REQUIRED')
           : sendError(res, 404, 'USER_NOT_FOUND');
       }
     This check comes BEFORE the listings query.
   - Everything else (the response shape) stays as it is.

3. getProfileByUsername:
   - After the user is found: the same rule, using user.university?.id
     (401 for anonymous, 404 for demo).
   - The redirect branch (an old handle in username_history): before
     returning redirect_to, also select the owner's university_id and apply
     the same rule — a non-student must not learn a real student's new
     handle.

4. backend/API.md: both routes — optionalAuth, 401 LOGIN_REQUIRED, 404
   USER_NOT_FOUND, ?user_id= ignored. Add LOGIN_REQUIRED to the error-code
   list.

5. File the entry for Vishwajeet (V-D builds against it):
     node scripts/changelog.mjs new neeraj "Identity rule live in products, share, user (N-C)" --phase 6B --block N-C --for vishwajeet
   "Changed endpoints (BREAKING)": /api/user/:id/public now needs the token
   to see a real student (the website sends it from Block N-D; the app
   already does). "What NOT to do yet": "Do not merge before N-D is live —
   the old website crashes on seller: null (runbook §1.5)."

HARD CONSTRAINTS
- Import from viewer.js; never re-implement it.
- Do not touch the products or share modules here, or frontend/, mobile/,
  supabase/.

VERIFY AFTER — report each
1. node --check on both files.
2. Remind me of the checkpoint N-C curl checks 3 and 4.
```

## CC-N4 — Website: the privacy states, and the old view counter

```
Phase 6B, Block N-D. The website must handle the API hiding a real
student's identity (runbook §1.5) — and it must be merged and live BEFORE
the API change (§2.4). Contract: backend/API.md "The identity rule
(Phase 6B)".

  products (list and detail): seller null, seller_id absent, seller_hidden true
  comments: user null, user_hidden true
  product detail: university_name
  GET /api/user/:id/public: 401 LOGIN_REQUIRED (logged out), 404 USER_NOT_FOUND

1. src/components/ProductCard/ProductCard.jsx
   - DELETE the useEffect that calls supabase.rpc("increment_product_views")
     (and its sessionStorage "viewed_" logic). The API counts views now
     (runbook §1.11); the browser call is refused anyway since Day 3.
   - Seller row: when product.seller is null → the name "Yahora student"
     and, in place of the initial, a lucide <User size={12} /> in the same
     circle. Same size and place; nothing else changes.

2. src/pages/product/ProductDetail.jsx
   - Make every product.seller.x and comment.user.x null-safe. Today these
     are read with no check (around lines 814, 822, 889, 894, 1069 and
     1093–1115); a hidden seller or commenter crashes the page.
   - Seller section, when product.seller is null:
       name line: "A student at {product.university_name}"
                  (no university_name → "A Yahora student")
       below it, small and muted:
         logged out → "Log in with your college email to see who's selling."
                      and a small "Log in" button to /auth
         logged in (a demo account) → "Verified students can see who's selling."
     No initial (lucide User icon instead), no education line, no "View
     profile", not clickable.
   - "Message seller" (the link built from product.seller.id) must not
     render when the seller is hidden.
   - Comments by a hidden user: "Yahora student", the User icon, no profile
     link, and the reply placeholder "Reply…" instead of "Reply to <name>…".

3. src/pages/publicProfile/PublicProfile.jsx
   - Send the Authorization header like ProductDetail does
     (localStorage "yahora_session"). Stop appending ?user_id=.
   - 401 → a centred card: title "Log in to see this profile", text
     "Profiles on Yahora are visible only to verified students.", and a
     "Log in" button to /auth.
   - 404 → "This profile isn't available."
   Use the page's existing card / empty-state styles.

4. netlify/edge-functions/product-preview.js: delete the line that adds
   `Listed by ${product.seller_name}`. (university_name is already used.)

HARD CONSTRAINTS
- Follow frontend/CLAUDE.md: raw fetch, CSS Modules, lucide, design tokens;
  no new libraries.
- A logged-in real student must see exactly what they see today.
- Do not touch backend/ or mobile/.

VERIFY AFTER — report each
1. npm run build passes.
2. Every null case you handled, file by file.
3. Remind me of checkpoint N-D (private window, demo, student).
```

## CC-N5 — Backend: the Mark-as-Sold endpoints (products, on loan)

```
Phase 6B, Block N-E, part 1 of 2. Mark as Sold, reworked, in the products
module — ON LOAN to me for Phase 6B (see the loan entry; do not change the
OWNER banners).

Read first: docs/design/MARK_SOLD_SPEC.md, the comments at the top of the
mark_sold migration (supabase/migrations/*_mark_sold.sql), and runbook §1.10.
The database holds every rule. The controller validates the shape of the
request, calls one function, and maps its errors with mapDbError (the names
are already in utils/respond.js).

1. markProductAsSold — POST /api/products/:id/sold, body { buyer_id }:
   - 400 INVALID_FORMAT if :id is not a uuid, or if buyer_id is present,
     not null and not a uuid. A missing buyer_id means null.
   - supabase.rpc('mark_product_sold', { p_product_id: id,
       p_seller_id: req.user.id, p_buyer_id: buyerId })
   - error → return mapDbError(res, error)
     (PRODUCT_NOT_FOUND 404, NOT_PRODUCT_OWNER 403, BUYER_NOT_FOUND 404,
      BUYER_IS_SELLER 400, BUYER_NOT_ON_CAMPUS 400)
   - 200 { message: 'Product marked as sold', product: data } — the same
     shape as today, so the old website keeps working.

2. markProductAsAvailable — POST /api/products/:id/available:
   supabase.rpc('mark_product_available', { p_product_id: id,
   p_seller_id: req.user.id }); same error mapping; 200 { message:
   'Product marked as available', product: data }.

3. blockNonOwner is now unused (the functions check ownership). Delete it,
   and say so.

4. NEW getBuyerCandidates — GET /api/products/:id/buyer-candidates?q=
   (requireAuth; the seller only):
   - q = trimmed string or ''.
   - q shorter than 2 characters → supabase.rpc(
       'get_product_buyer_candidates', { p_product_id: id,
       p_seller_id: req.user.id }); error → mapDbError; items =
       data.map(u => ({ id, username, full_name, avatar_url,
       messaged: true })).
   - q of 2+ characters → first check ownership yourself: select seller_id
     from products by id (maybeSingle); none → sendError 404
     PRODUCT_NOT_FOUND; another seller → sendError 403 NOT_PRODUCT_OWNER.
     Then supabase.rpc('search_users', { p_query: q, p_viewer: req.user.id,
     p_limit: 21 }); keep rows with is_same_campus === true and id !==
     req.user.id; take the first 20; map to the same shape with
     messaged: false. (search_users already keeps demo and real accounts
     apart, and orders same-campus first; 21 then 20 covers the one
     cross-campus exact-handle match that can sort above them.)
   - res.json({ items, next_cursor: null }) — the API's list envelope; this
     list is a fixed top-20, like /api/users/search.

5. NEW removeMyPurchase — DELETE /api/products/:id/purchase (requireAuth):
   "That wasn't me" from the BUYER. supabase.rpc('remove_my_purchase',
   { p_product_id: id, p_buyer_id: req.user.id }); error → mapDbError
   (PURCHASE_NOT_FOUND 404); 200 { removed: true }.

6. getProductById, at the spot CC-N2 marked (BEFORE hideSeller): when
   viewer.id === product.seller_id and product.status === 'sold', read the
   listing's purchase with its buyer (purchases where product_id = id,
   maybeSingle, select buyer:users!buyer_id(id, username, full_name,
   avatar_url)) and set product.buyer = that buyer or null. Nobody but the
   seller ever gets a buyer field. (sold_at is already in `*`.)

7. products.routes.js: add the two routes with requireAuth, next to /sold
   and /available. Update the comment block above /sold and /available.

8. backend/API.md: all four routes in full, with every status code; the
   buyer field on the detail (seller only); sold_at.

9. File the entry Vishwajeet builds the app from:
     node scripts/changelog.mjs new neeraj "Mark as Sold endpoints (N-E)" --phase 6B --block N-E --for vishwajeet
   List every route with its request, response and errors. "What NOT to do
   yet": "The buyer is private — show it only to the seller and the buyer
   (MARK_SOLD_SPEC §0)."

HARD CONSTRAINTS
- No SQL. Never re-implement a rule the database function holds.
- Do not touch the user module (part 2), frontend/, mobile/ or supabase/.

VERIFY AFTER — report each
1. node --check on the changed files.
2. The final route list in products.routes.js, in order.
3. Remind me of the checkpoint N-E curl checks.
```

## CC-N6 — Backend: the profile and dashboard data (user module)

```
Phase 6B, Block N-E, part 2 of 2. The data the Mark-as-Sold screens show,
in my user module.

1. getDashboardData (own dashboard only, as today):
   - listings: add sold_at to the select, and the buyer of a sold listing:
       purchase:purchases(buyer:users!buyer_id(id, username, full_name, avatar_url))
     Then, for each listing, set listing.buyer = that buyer or null and
     delete listing.purchase. PostgREST may return a one-to-one embed as an
     object OR as a one-element array — handle both.
   - purchases: the product embed becomes
       product:products(id, title, price, image_urls, status, sold_at,
         seller:users!seller_id(id, username, full_name, avatar_url))

2. getPublicProfile (after the identity check CC-N3 added): add
     sold_listings — products of this seller with status 'sold', ordered
       by sold_at descending (nulls last), at most 12, selecting id, title,
       price, image_urls, condition, sold_at;
     sold_count — the total number of sold listings (use { count: 'exact' }
       on that same query).
   Both new fields go next to listings in the response. No buyer anywhere.

3. backend/API.md: the new fields on both routes.

4. Add to the N-E changelog entry (your own, still open) or file a second
   one for Vishwajeet: the dashboard fields and the public-profile fields.

HARD CONSTRAINTS
- Public responses never include a buyer.
- Do not touch the products module here, or frontend/, mobile/, supabase/.

VERIFY AFTER — report each
1. node --check passes.
2. How the one-to-one embed is normalised.
```

## CC-N7a — Website message actions, part 1: data, Realtime, inbox, tombstone

```
Phase 6B, Block N-F, part 1 of 3. The data layer for message actions on the
website, the inbox preview, and the deleted-message tombstone. No menu yet
(part 2), no reply UI yet (part 3).

Read first: docs/design/MESSAGES_SPEC.md §10 (all of it, especially §10.8,
§10.9, §10.10) and Vishwajeet's V-C changelog entry (the API contract).

1. CREATE src/utils/messageActions.js: the constants of spec §10.10 with
   exactly those names and values, and the helpers isDeleted(m),
   isReply(m), canDeleteForEveryone(m, myId, now = Date.now()),
   firstName(fullName) — the same rules as Vishwajeet's
   mobile/src/lib/messageActions.ts (read it; match it).

2. src/styles/global.css: add the ten v3 variables from spec §3 (web
   block). Reuse an existing variable only when its value is identical.

3. src/pages/messages/Messages.jsx:
   a. Send: handleSendMessage adds reply_to_id (null for now — part 3 sets
      it) to the body.
   b. Realtime INSERT handler: where it updates the inbox row's
      last_message, also set last_sender_id = newMsg.sender_id and
      last_message_deleted = false.
   c. Realtime UPDATE handler: keep replacing the message by id. When
      payload.new.deleted_at is set, refresh the inbox from the server —
      the deleted message may have been a conversation's preview. If no
      plain "reload the inbox" function exists (loadInboxAndCheckParams
      also handles URL params), factor one out of it and use it in both
      places. It must not change which chat is open.
   d. New functions deleteForEveryone(message) and deleteForMe(message):
      - POST /api/messages/:id/delete-for-everyone with the token. On 200,
        replace the message with the returned tombstone, set reply_preview
        to null on loaded messages whose reply_to_id is its id, and refresh
        the inbox. (Realtime will also deliver these; replacing by id makes
        the double arrival harmless.)
      - POST /api/messages/:id/delete-for-me. Remove the message from the
        list at once, keeping a copy; on error put it back. On 200 refresh
        the inbox. There is NO Realtime event for this (runbook §1.7).
      Both return the error code on failure, for part 2's toasts. Nothing
      calls them yet.
   e. Inbox preview (spec §10.9): last_message_deleted → lucide <Ban size={12} />,
      gap 4, then italic "You deleted this message" (last_sender_id is me)
      or "This message was deleted"; keep the row's read/unread weights.
      Else if last_sender_id is me → "You: " + text. "Start the
      conversation ✨" only when last_message is null/undefined, never for ''.
   f. The tombstone (spec §10.8), where a message bubble renders: when
      isDeleted(msg) → same bubble side and background; lucide <Ban size={14} />,
      gap 6, italic label Inter 400 14/20 — mine "You deleted this message"
      in var(--chat-tombstone-mine), theirs "This message was deleted" in
      the muted text colour; meta row: time only, no tick; no MessageText.

HARD CONSTRAINTS
- Follow frontend/CLAUDE.md (raw fetch, CSS Modules, lucide, tokens; no
  new libraries).
- Do not change how messages are fetched or paged, the unread band, read
  marking, the wallpaper or the stickers.
- Do not touch backend/ or mobile/.

VERIFY AFTER — report each
1. npm run build passes.
2. Each change, one line each.
3. Remind me of checkpoint N-F7a.
```

## CC-N7b — Website message actions, part 2: the menu, Copy, Delete

```
Phase 6B, Block N-F, part 2 of 3. The actions button and menu, right-click,
Copy with its toast, and the delete confirmation. Part 1 is merged.

Read first: MESSAGES_SPEC.md §10.1, §10.2, §10.7, §10.8, §5 items 8–10.

1. CREATE src/components/AppToast/ (AppToast.jsx + .module.css): the spec
   §10.7 pill (var(--toast-bg), Inter 600 12 white, radius 999, padding
   6/12), centred, positioned by a `bottom` prop, 150 ms fades, shown for
   COPY_TOAST_MS. A tiny useToast() hook returning { toast, showToast }.

2. CREATE src/components/MessageMenu/ (MessageMenu.jsx + .module.css): the
   spec §10.2 popover — white, radius 12, the shadow, padding 6 vertical,
   min-width 168, 40-tall items (icon 16 + gap 12 + Inter 500 14), Delete
   in var(--danger-text), hover and keyboard focus rgba(128,0,128,0.06).
   Keyboard: focus moves into the menu when
   it opens; ArrowUp/ArrowDown move; Enter chooses; Esc closes and returns
   focus to the button that opened it. Clicking outside closes it. It
   stays inside the thread's edges (flip above the button near the bottom).

3. Messages.jsx — the actions button (spec §10.2, web):
   - A 28 round button BESIDE each bubble, on its outer side (left of mine,
     right of theirs), aligned to the bubble's top, gap 6: white, 1px
     rgba(128,0,128,0.08) border, lucide <ChevronDown size={16} /> in the
     muted colour; hover on it: #FFF4F7.
   - Hidden by default; shown when the message row is hovered, or
     focus-within (keyboard), or after a tap on the bubble on touch screens
     (a tap toggles it for that one row; tapping elsewhere hides it).
     Fade 120 ms. The bubble's own size never changes.
   - Clicking it opens MessageMenu under it. Right-click on the bubble
     (onContextMenu, preventDefault) opens the same menu — on Android Chrome
     a long-press fires the same event, so this covers phone browsers too.
   - Which items (spec §10.1): normal → Reply, Copy, Delete; tombstone →
     Delete only. Reply closes the menu and does nothing yet (part 3).
   - While the menu is open, the row shows the full-width band
     var(--chat-row-selected) behind it.
   - Not on the typing bubble, the welcome card, date chips or the unread
     band.

4. Copy (spec §10.7, runbook §1.14): REUSE copyText(text) from
   src/utils/share.js — it already does navigator.clipboard with the
   hidden-<textarea> fallback for plain-http pages (written for the share
   sheet). Do not write a second copy function. It returns true or false:
   true → the "Copied" toast (always on web); false → toast "Couldn't copy".

5. Delete (spec §10.8): a confirmation modal that looks like the
   Dashboard's (copy .modalOverlay, .modalContent and .modalActions from
   src/pages/dashboard/Dashboard.module.css into Messages.module.css — CSS
   Modules can't share classes between pages). Title "Delete message?". Body and buttons (stacked, full width, in this
   order):
   - canDeleteForEveryone → body "Delete it for everyone in this chat, or
     only for you?"; buttons "Delete for everyone" (var(--danger-text)),
     "Delete for me", "Cancel".
   - otherwise → body "It will be removed from this chat for you. <first
     name> will still see it."; buttons "Delete for me", "Cancel".
   Call part 1's functions. DELETE_WINDOW_EXPIRED → toast "It's too late to
   delete this for everyone"; any other error → toast "Couldn't delete. Try
   again."

HARD CONSTRAINTS
- frontend/CLAUDE.md patterns. lucide icons. No new libraries.
- Do not change paging, the unread band or read marking.
- Do not touch backend/ or mobile/.

VERIFY AFTER — report each
1. npm run build passes.
2. How the button shows on hover, focus and touch.
3. Remind me of checkpoint N-F7b, including the phone-browser Copy test.
```

## CC-N7c — Website message actions, part 3: Reply

```
Phase 6B, Block N-F, part 3 of 3. Reply: the reply bar, the quote inside
the bubble, jump-to-original. Parts 1 and 2 are merged.

Read first: MESSAGES_SPEC.md §10.4, §10.5, §10.6.

1. Reply state in Messages.jsx: replyTo (a message or null). The menu's
   Reply sets it and focuses the composer's textarea. Sending clears it;
   so does the bar's close button, Esc in the textarea (when the emoji
   picker isn't open), and opening another chat.

2. The reply bar (§10.4), inside the composer, above the input row:
   var(--chat-quote-theirs-bg), radius 12, a 3px purple left accent,
   padding 6 6 6 13, gap 8, 6 below. Line 1 "Replying to You" /
   "Replying to <firstName(contact name)>", Inter 600 12/16 purple.
   Line 2 the quoted text, one line, ellipsis, Inter 400 12/16 muted.
   Close: lucide <X size={16} /> in a 28×28 button.

3. Send with a reply: handleSendMessage sends reply_to_id: replyTo?.id ??
   null, then clears replyTo. The API fills the quote; the message comes
   back with it.

4. The quote inside a bubble (§10.5), above MessageText, when isReply(msg):
   - mine: var(--chat-quote-mine-bg), accent var(--chat-quote-mine-bar),
     name white, text var(--chat-quote-mine-text);
   - theirs: var(--chat-quote-theirs-bg), accent purple, name purple, text
     muted;
   - radius 8; padding 6 vertical, 8 after the 3px accent; 6 above the
     text; name Inter 600 12/16 ("You" or the first name); text Inter 400
     12/16, 2 lines (line-clamp);
   - reply_preview null → italic "Original message was deleted", not
     clickable;
   - a reply bubble's min-width is REPLY_MIN_BUBBLE_WIDTH (px).

5. Jump (§10.6): clicking a quote with a reply_to_id
   - finds [data-msg-id="<id>"] in the messages container; if found,
     scrolls so it sits 35% down the container — reuse the arithmetic of
     anchorToUnreadDivider (UNREAD_ANCHOR_LEAD_RATIO); do not write a
     second scroller;
   - then flashes that row: a full-width band var(--chat-row-highlight)
     held JUMP_HIGHLIGHT_HOLD_MS, fading over JUMP_HIGHLIGHT_FADE_MS
     (a CSS class + animation; respect prefers-reduced-motion: no fade,
     just the hold);
   - not loaded → call loadOlderMessages() up to JUMP_MAX_EXTRA_PAGES
     times, checking after each; found → jump; not found → toast
     "Couldn't find the original message".
   Never marks anything read; never moves the unread band.

HARD CONSTRAINTS
- frontend/CLAUDE.md patterns. No new libraries.
- Do not touch backend/ or mobile/.

VERIFY AFTER — report each
1. npm run build passes.
2. Which existing function the jump reuses.
3. Remind me of checkpoint N-F7c.
```

## CC-N8a — Website Mark as Sold, part 1: the picker and the Dashboard

```
Phase 6B, Block N-H, part 1 of 2. The "Who bought it?" picker and the
seller's Dashboard. Read docs/design/MARK_SOLD_SPEC.md §1 and §3 (all of
it) and look at docs/design/mark_sold.png panel J. The API is in my N-E
changelog entry.

1. CREATE src/components/BuyerPicker/ (BuyerPicker.jsx + .module.css) —
   spec §1, web column: the 440-wide modal, scrim, title (Bree Serif 400
   20), subtitle (listing title), search field, the two sections and their
   labels, person rows (36 avatar with the site's existing initials
   fallback), divider, the off-platform row (lucide UserX 18 in a 36
   #F3F0EF circle), exactly one row selected, the confirm button
   (135° #800080 → #C02B7F, Inter 700 15 white, "Mark as sold" or "Save";
   opacity 0.4 until something is selected; spinner while saving), the
   skeleton rows, the no-match line, the error toasts (AppToast from
   N-F). Search: fewer than 2 characters → GET
   /api/products/:id/buyer-candidates; 2 or more → ?q=, 300 ms after
   typing stops. Esc and the scrim close it. Props: product, mode
   ('sell' | 'change'), initialBuyerId (undefined = nothing selected,
   null = off-platform selected), onClose, onSaved.

2. src/pages/dashboard/Dashboard.jsx:
   - "Mark as sold" opens BuyerPicker (mode 'sell'). DELETE the old
     soldModal, the inbox-walking buyer lookup (BUYER_LOOKUP_MAX_PAGES and
     handleMarkSoldClick's loop) and executeMarkSold — the picker and the
     candidates endpoint replace them.
   - Saving: POST /api/products/:id/sold { buyer_id } and update the card.
   - A sold listing card (spec §3): under the price, "Sold to <full name> ·
     <date>" or "Sold · buyer not on Yahora · <date>" (Inter 500 12 muted),
     then two text buttons, Inter 600 12 purple, gap 14: "Change buyer"
     (BuyerPicker mode 'change', current buyer or null selected) and
     "Relist".
   - Relist asks first, with the site's modal: title "Relist this item?",
     body "“<title>” goes back on the marketplace." plus " <first name>
     will no longer be shown as its buyer." when there is one; buttons
     Cancel, Relist.
   - <date>: "3 Oct", or "3 Oct 2025" in an earlier year, with fixed
     English month names (add a formatShortDate helper next to the site's
     existing time formatter).

HARD CONSTRAINTS
- frontend/CLAUDE.md patterns; tokens; no new libraries.
- The button gradient ends at #C02B7F, not #EB487F (white text contrast,
  spec §1).
- Do not touch backend/ or mobile/.

VERIFY AFTER — report each
1. npm run build passes.
2. What was deleted from Dashboard.jsx.
3. Remind me of the picker half of checkpoint N-H.
```

## CC-N8b — Website Mark as Sold, part 2: everywhere a sale shows

```
Phase 6B, Block N-H, part 2 of 2. The buyer's purchases, the product page,
the public profile, the card label and the link preview. Read
MARK_SOLD_SPEC.md §2, §4, §5.

1. Dashboard.jsx, Bought Items (spec §4): each card adds "From <seller
   full name> · <date>" (Inter 500 12 muted) and the text button "That
   wasn't me" (Inter 600 12 muted, underlined), which asks with the site's
   modal: title "Remove this purchase?", body "<seller first name> marked
   “<title>” as sold to you. If that's wrong, remove it. The listing stays
   sold; you just won't be shown as its buyer.", buttons Cancel, Remove
   (var(--danger-text)). DELETE /api/products/:id/purchase; on 200 the
   card leaves the list.

2. src/pages/product/ProductDetail.jsx (spec §2), when status is 'sold':
   - the SOLD stamp over the image (Bree Serif 400 22, white, 2px white
     border, radius 8, padding 2/12, rotated −8°, 16 from the top-right);
   - under the price, the banner: #F3F0EF, radius 12, padding 10/12, gap
     8, lucide CheckCircle 16 muted, "This item has been sold." (Inter 600
     13 #1A1A1A);
   - anyone but the seller: no Message seller, no like, no save, no
     question box; existing questions stay readable;
   - the seller: the banner reads "You marked this as sold on <date>."
     with a second line "Buyer: <full name>" or "Buyer: someone not on
     Yahora" (product.buyer, which only the seller receives).

3. src/pages/publicProfile/PublicProfile.jsx (spec §5): under the active
   listings, "Sold · <sold_count>" with up to 12 cards from sold_listings,
   each with the SOLD badge and no like or save. Left out when sold_count
   is 0.

4. src/components/ProductCard/ProductCard.jsx: the sold label is "SOLD",
   never "SOLD TO @…" (products.sold_to no longer exists).

5. netlify/edge-functions/product-preview.js: product:availability for a
   sold listing is "out of stock" (it says "oldout" today, a typo), and
   "in stock" otherwise.

HARD CONSTRAINTS
- The buyer appears only to the seller (their product page and Dashboard)
  and to the buyer (Bought Items). Never on public pages.
- frontend/CLAUDE.md patterns; tokens; no new libraries.
- Do not touch backend/ or mobile/.

VERIFY AFTER — report each
1. npm run build passes.
2. Remind me of checkpoint N-H and of T3.
```

---
# SIGN-OFF — both of you, Thursday 29 October

Tick a box only when you have seen it yourself, on the device named.

**Privacy (T1, production)**
- [ ] 👁️ Logged out: a shared product link opens; the seller and commenters are "Yahora student"; profiles ask to log in.
- [ ] 👁️ Demo account: the same for a real campus's listing opened by link; the demo campus still shows its personas.
- [ ] 👁️ Logged-in student: everything exactly as before.
- [ ] `?user_id=` on `/public` changes nothing; meta and the share page carry no name.
- [ ] A demo account can't comment or vote on a real listing.

**Views**
- [ ] 👁️ Opening a listing twice counts once; the seller's own visits don't count.
- [ ] The public key can't call the old view function (V-B step 4: `anon_can_add_views = false`).

**Message actions (T2, website + POCO + OPPO + Samsung)**
- [ ] 👁️ Reply, Copy, Delete for me, Delete for everyone — every T2 row ✅ on every device.
- [ ] 👁️ Tombstones appear live on both sides; quotes of a deleted message are wiped.
- [ ] 👁️ Samsung: swipe-to-reply is smooth and scrolling never turns into a swipe.

**Mark as Sold (T3, website + phones)**
- [ ] 👁️ Every T3 row ✅.
- [ ] 👁️ The buyer is never visible on a public page.

**Nothing broke (T4) and production is right (T5)**
- [ ] 👁️ T4 ✅. T5 ✅.

**Docs**
- [ ] `backend/API.md` matches every route in the Appendix table.
- [ ] Every block filed a changelog entry.

When every box is ticked:

```bash
node scripts/changelog.mjs new vishwajeet "Phase 6B complete; products + share modules back to Vishwajeet" --phase 6B --block SIGN-OFF
node scripts/changelog.mjs release 6B --dry-run    # look at the list
node scripts/changelog.mjs release 6B
git add -A docs/changelog && git commit -m "docs(changelog): release phase 6B"
```

(The sign-off entry is filed **before** the release, so it ends up inside `phase-6B.md` too.)

---

# APPENDIX

## A. Every API change in Phase 6B

| Endpoint | Change | Who |
|---|---|---|
| `GET /api/products` | Non-students on a real campus: `seller: null`, `seller_hidden: true`, no `seller_id` | Neeraj (N-C) |
| `GET /api/products/:id` | The same for the seller; comments `user: null`, `user_hidden: true`; adds `university_name`; counts a view (signed in, first page only); the seller of a sold listing also gets `buyer` | Neeraj (N-C, N-E) |
| `GET /api/products/:id/meta` | `seller_name` removed | Neeraj (N-C) |
| `GET /share/product/:id` | "listed by a student at <campus>" | Neeraj (N-C) |
| `POST /api/products/:id/comments` | 403 across campuses; 400 if the parent is on another listing | Neeraj (N-C) |
| `POST /api/products/comments/:commentId/vote` | 403 across campuses; 404 for a missing comment | Neeraj (N-C) |
| `POST /api/products/:id/sold` | Body `{ buyer_id: uuid \| null }`; the database checks everything; new error names | Neeraj (N-E) |
| `POST /api/products/:id/available` | Through the database function; clears the buyer and `sold_at` | Neeraj (N-E) |
| `GET /api/products/:id/buyer-candidates?q=` | **New** — seller only | Neeraj (N-E) |
| `DELETE /api/products/:id/purchase` | **New** — the buyer's "That wasn't me" | Neeraj (N-E) |
| `GET /api/user/:userId/public` | `optionalAuth`; 401 `LOGIN_REQUIRED` / 404 `USER_NOT_FOUND` for non-students; `?user_id=` ignored; adds `sold_listings`, `sold_count` | Neeraj (N-C, N-E) |
| `GET /api/users/by-username/:username` | The identity rule, including on the old-handle redirect | Neeraj (N-C) |
| `GET /api/user/:userId/dashboard` | Listings: `sold_at`, `buyer`. Purchases: product `status`, `sold_at`, `seller` | Neeraj (N-E) |
| `POST /api/messages/send` | Optional `reply_to_id`; empty or over-2000-character messages refused | Vishwajeet (V-C) |
| `GET /api/messages/history` | Rows gain `reply_to_id`, `reply_to_sender_id`, `reply_preview`, `deleted_at`; hidden-for-me rows left out | Vishwajeet (V-C) |
| `GET /api/messages/inbox/:userId` | Rows gain `last_sender_id`, `last_message_deleted`; hidden messages skipped | Vishwajeet (V-B) |
| `POST /api/messages/:id/delete-for-everyone` | **New** | Vishwajeet (V-C) |
| `POST /api/messages/:id/delete-for-me` | **New** | Vishwajeet (V-C) |

## B. Error names

New in `utils/respond.js` (raised by the database, mapped by `mapDbError`):

| Name | HTTP | When |
|---|---|---|
| `MESSAGE_NOT_FOUND` | 404 | no such message, or you're not one of its two people |
| `NOT_MESSAGE_SENDER` | 403 | only the sender may delete for everyone |
| `DELETE_WINDOW_EXPIRED` | 403 | more than 60 minutes since it was sent |
| `REPLY_TARGET_INVALID` | 400 | the quoted message is in another conversation, or deleted |
| `PRODUCT_NOT_FOUND` | 404 | no such listing |
| `NOT_PRODUCT_OWNER` | 403 | only the seller may do that |
| `BUYER_NOT_FOUND` | 404 | no such student |
| `BUYER_IS_SELLER` | 400 | you can't sell to yourself |
| `BUYER_NOT_ON_CAMPUS` | 400 | the buyer must be on the listing's campus |
| `PURCHASE_NOT_FOUND` | 404 | you aren't this listing's buyer |

Sent directly by controllers: `LOGIN_REQUIRED` (401, new), `USER_NOT_FOUND` (404),
`CROSS_CAMPUS_INTERACTION_BLOCKED` (403), `MISSING_FIELDS` and `INVALID_FORMAT` (400).

## C. URLs and commands you'll reuse

```
Production website   https://yahora.netlify.app
Production API       https://yahora-yst4.onrender.com/api
Local API            http://localhost:5001/api
Local website        http://localhost:3000
Local Studio         http://127.0.0.1:54323
Local database       postgresql://postgres:postgres@127.0.0.1:54322/postgres

Seeded test accounts (local only), password password123:
  arjun.mehta, priya.nair, rahul.verma   — IIITDM Kurnool
  sneha.gupta, karan.singh               — NIET Greater Noida
  The Wacom tablet (Priya sells it, Arjun messaged her): e0000000-0000-4000-8000-000000000004

node scripts/changelog.mjs recent 8
node scripts/changelog.mjs for <name>
node scripts/changelog.mjs release <phase> --dry-run
supabase db reset
cd mobile && npx tsc --noEmit
cd frontend && npm run build
```

## D. Things that cost a day if you forget them

- **⛔ Website before API for privacy (M1).** If N-C goes live before N-D, logged-out product
  pages with comments crash, and logged-in students get "Log in to see this profile" because
  the old PublicProfile sends no token (§2.4).
- **⛔ Push the migrations before merging API code that uses them** (Day 3, then V-C/N-C/N-E).
  The other order makes the live API call functions that don't exist yet.
- **`supabase db reset` after pulling a migration.** Without it, your local database is
  missing the new tables and every new endpoint answers 500.
- **Copy on a phone's browser over Wi-Fi needs the fallback** (§1.14). Without it, Copy fails
  silently and looks like a bug in the menu.
- **"Delete for me" sends no Realtime event — on purpose.** Your other device only sees it
  after reopening the chat. Don't "fix" this by adding a column (§1.7).
- **Never test "delete for everyone" on a seeded message and expect it to work.** Seeded
  messages are days old: the answer is `DELETE_WINDOW_EXPIRED`. Send a fresh one first.
- **`hideSeller` removes `seller_id`.** Any "is the viewer the seller?" check must run before
  it (CC-N2 marks the spot).
- **Release a phase only at its sign-off.** A late entry for a released phase is refused; give
  it the next phase.
- **Ideas that come up mid-phase go to the Phase 10 list,** not into 6B. That is the
  difference between 29 October and mid-November.

## E. Deliberately NOT in Phase 6B

- **Edit message, emoji reactions, forward, star, pin** — not chosen for 6B. If you want them,
  they fit a later phase, and the database pattern from 6B (rules in functions, quotes copied
  at send time) carries over.
- **Notifying the buyer** that they were tagged — needs notifications (Phase 8).
- **Rate limiting** demo login, `username-available` and search — Phase 9.
- **Removing the old `increment_product_views` function** — Phase 9 housekeeping, once nothing
  calls it.
- **A student-search screen** — Phase 8. (The buyer picker searches one campus for one
  purpose; it's not a people directory.)
- **The product price in the chat snippet** — still deferred (MESSAGES_SPEC §8).
- **iOS** — still Android and web only.
