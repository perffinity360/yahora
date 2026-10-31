# Yahora — Phase 7 Runbook: the Community

**Version 1 · written 29 October 2026 · for Vishwajeet and Neeraj**

Phase 7 builds the community on both the website and the app, in the same phase (your rule):

- a **campus feed**, a **country feed** and a **Global feed**;
- posts with photos or a GIF, and one level of replies;
- **emoji reactions** on posts and on messages;
- **GIFs** in posts, replies and messages;
- automatic **moderation**, **reports**, and **demo usernames** that start with `demo.`.

---

## HOW TO READ THIS DOCUMENT

| Part | What it is | Who reads it |
|---|---|---|
| **PART 0** | What I found in the code, every decision we made, the deadline | both, first |
| **PART 1** | The ideas behind this phase, explained with examples | both, before starting |
| **PART 2** | Files, who owns what, the calendar, the go-lives | both |
| **TRACK 1** | Vishwajeet's manual steps, with checkpoints | Vishwajeet |
| **TRACK 2** | Vishwajeet's Claude Code prompts | Vishwajeet |
| **TRACK 3** | Neeraj's manual steps, checkpoints and all the testing | Neeraj |
| **TRACK 4** | Neeraj's Claude Code prompts | Neeraj |
| **SIGN-OFF** | The final checklist, done together | both |
| **APPENDIX** | Every API change, error names, commands, mistakes to avoid | both, as reference |

**Signs used:**
- 👁️ means a human has to look; Claude Code can't check it for you.
- ⛔ means a rule that must not be broken.
- **CC-V…** and **CC-N…** are Claude Code prompts: copy everything inside the box, exactly.

The design itself (sizes, words on buttons, states) lives in **`docs/design/COMMUNITY_SPEC.md`**.
This runbook says *how to build it*; the spec says *what it looks like*.

---

## 0.1 The repo, today

I read `main` at **`b0c315d`** ("release phase 6B").

| What | State | What it means for Phase 7 |
|---|---|---|
| Migrations | 22, newest `20261027062548_search_users_word_match.sql` | Phase 7 adds 4 more (Block V-B) |
| `posts` table | Exists since the very first schema: `content varchar(250)`, one `image_url`, no scope, no replies, no reactions | Reworked in V-B. **No code uses it yet**, so it can change freely |
| `backend/src/modules/posts/` | A 26-line stub, already mounted at `/api/posts` | Built in Block N-B |
| `backend/src/modules/reports/` | Mounted at `/api/reports`, empty | Built in Block N-C |
| `backend/API.md` Part 2 | Has a posts contract written in **Phase 0**. It assumed follows, blocks and notifications already existed, and a 250-character limit | Rewritten in Block V-A to match this phase |
| Website | `/feed` and `/hot` are placeholder pages; the navbar links to `/hot` | Replaced by `/community` |
| App | Three tabs: Marketplace, Messages, Profile | A fourth tab, Community |
| App messages | `MessageActionMenu.tsx` already keeps space for "the reactions bar (community phase)" | The quick reaction bar goes there |
| Website messages | A hand-made emoji picker (`EMOJI_ROWS`) in the chat composer | Kept as it is; reactions use a full picker library |
| Backend Node version | 24 (`.nvmrc`) | Supports the emoji check we need (§1.4) |
| Reserved usernames | Already include `community`, `post`, `posts`, `report`, `reactions`, `campus`, `demo` | New routes `/community` and `/post/:id` are safe |
| Login | Matches exactly **one** email domain per campus | Fine for now. "Several domains per campus" is a Phase 9 launch item |

---

## 0.2 Every decision, in one place

You made these over the last few conversations. This table is the final list. If anything
here is wrong, fix it in this table first, then in the block it affects.

| # | Topic | Decision |
|---|---|---|
| 1 | Feeds | Two panels on a laptop (website); a switcher on narrow screens and in the app |
| 2 | Left panel | **My campus** — only your campus sees campus posts |
| 3 | Right panel | A dropdown: your **country** (the default), any other country, or **Global** |
| 4 | Your country | The country of **your university**, not where your phone is |
| 5 | Posting | Campus feed: your campus. Country feed: **only your own country**. Global: everyone |
| 6 | Another country's feed | **View only**: you can't post or reply. You **can** react, open profiles and report |
| 7 | Replies | One level only; anyone allowed to post in that feed can reply |
| 8 | Global posts | Students from any campus and any country can reply and react |
| 9 | Post length | **1,000 characters**, folded after 6 lines with "See more" |
| 10 | Media | A post has up to 3 photos **or** one GIF. A reply can have a GIF, but no photos |
| 11 | Reactions | **Replace likes.** Tap = ❤️. Hold (app) or hover (website) = 6 quick emojis + ⊕ for any emoji. One reaction per person. Counts per emoji, like your screenshots |
| 12 | Reactions on messages | Yes, the same quick bar and full picker |
| 13 | GIFs | From **KLIPY** (Google shut Tenor down on 30 June 2026). In posts, replies and messages |
| 14 | Stickers | Your own Yahora sticker packs are **Phase 10**, with the logo work |
| 15 | Moderation | **No word list.** Every post, reply and photo is checked by **OpenAI's free moderation service**: clear violations are held for review, borderline ones get a "Post this?" nudge |
| 16 | Reports | **Anyone** who can see a post can report it. The form warns that deliberately false reports can lead to restrictions or suspension |
| 17 | Hiding after reports | Not at 3 for everything. **3** for sexual content, violence or self-harm; **2** for child safety; **5** on campus and **10** on country or Global feeds for everything else. Hidden posts are **covered, never deleted** |
| 18 | Rate limits | 10 posts an hour on your campus feed; 5 an hour across your country feed and Global together; 30 replies an hour; half during an account's first 24 hours |
| 19 | Deleting your own post | It disappears at once. The row is kept for **90 days** for moderation, then removed for good |
| 20 | Editing posts | Not in Phase 7 |
| 21 | Demo usernames | Made automatically at demo login, starting with **`demo.`** (example: `demo.sunny.otter`). The demo skips the username step. Real accounts can never start with `demo.`, `demo-` or `demo_` |
| 22 | The demo community | Separate: demo accounts see only demo posts, real students never see them |
| 23 | Countries on campuses | Every campus gets a country code. Currency, several email domains per campus and the campus admin page are **Phase 9** |
| 24 | Who builds the posts backend | **Neeraj** — the posts module is **lent** to him for Phase 7 (§2.2) |
| 25 | App's first tab | Still Marketplace; decide again after launch |
| 26 | Launch | The community launches with the product (no pilot) |
| 27 | Not in Phase 7 | Following feed, blocks, private accounts and notifications (Phase 8); the admin review screen (Phase 9) |

---

## 0.3 What changed from the original plan, and why

1. **Three scopes instead of two.** The Phase 0 plan had campus and global. You added
   country feeds so a single feed never moves too fast (§1.1 explains why that's about
   people, not servers).
2. **Reactions instead of likes.** One system instead of two, and it is what you asked for.
3. **No word list.** You're launching across countries and languages, where word lists miss
   too much and block innocent words. An AI check works in many languages.
4. **The Phase 0 posts contract is replaced.** It was written before any of these decisions.
   Block V-A rewrites it in `backend/API.md` so both of you build against the same thing.

---

## 0.4 Students aged 16 and 17

You told me some students will be 16 or 17. Two laws treat them differently from adults:

- **India's DPDP Act** calls anyone under 18 a *child*. Their personal data needs
  **verifiable consent from a parent**, and "tracking or behavioural monitoring" of
  children is not allowed. The detailed rules are being brought in step by step.
- Other countries have their own versions of these rules.

**What this means for Phase 7:** nothing extra to build. The community does not track
behaviour or show personalised recommendations, and messaging stays within one campus.
**What it means before launch (Phase 9):** ask for the date of birth at sign-up, add a
parent-consent step for under-18s, and give younger students safer defaults. I'm not a
lawyer, so please have someone check this before launch.

---

## 0.5 The deadline

**22 working days: Friday 30 October → Friday 20 November 2026.**
**Hard stop: Monday 23 November** (3 days of buffer).

This is based on how Phase 6B went. You planned 18 days and finished on day 18. Phase 7 is
bigger, because it's a whole new part of the product on two platforms, plus reactions and
GIFs in messages. At 5–6 hours a day:

| Milestone | Day | Date | What goes live |
|---|---|---|---|
| Database | 5 | Tue 3 Nov | The four migrations, pushed to production |
| **M1** | 13 | **Wed 11 Nov** | The community on the website (the posts and reports API went live on days 7–8) |
| **M2** | 18 | **Mon 16 Nov** | Reactions and GIFs in messages on the website, and demo usernames |
| Sign-off | 22 | **Fri 20 Nov** | Everything tested; 7 released |

The app has no go-live of its own: you run it through Expo Go, so it is "live" as soon as its
work is merged.

**The cut line.** If on **day 12** you are more than two days behind, move these to Phase 8,
in this order: (1) GIFs in messages, (2) the Hot / New switch (keep Hot only),
(3) the "new posts" pill. Everything else is the phase.

---

## 0.6 The package

`phase7-package.zip` unzips at the **repo root** and adds two files:

```
docs/runbooks/PHASE_7_RUNBOOK.md     ← this document
docs/design/COMMUNITY_SPEC.md        ← the design spec
```

Neeraj commits it first thing on day 1 (Block N-0). This time there is **no pre-written
SQL**: Claude Code writes the migrations from the descriptions in CC-V2, and the checkpoints
tell you how to check them.

---
# PART 1 — THE IDEAS BEHIND THIS PHASE

Read this before you start. Every Claude Code prompt in Tracks 2 and 4 refers back to these
sections, so when a prompt says "§1.4", this is where to look.

## 1.1 Three feeds, three scopes

Every post has a **scope** that decides who sees it: `campus`, `country` or `global`. The
author doesn't pick the scope from a menu: **the feed you post from is the scope.** Posting
from the left panel makes a campus post; posting from the right panel while it shows India
makes a country post for India.

**Who can do what:**

| | Campus post | Country post (e.g. India) | Global post |
|---|---|---|---|
| Who can **see** it | Students of that campus | **Everyone** | Everyone |
| Who can **post or reply** | That campus | Students at universities **in India** | Everyone |
| Who can **react** | That campus | Everyone | Everyone |
| Who can **report** | That campus | Everyone | Everyone |

**Worked example.** Three students:
- **Rahul** studies at IIITDM Kurnool (India);
- **Sneha** studies at NIET Greater Noida (India);
- **Lena** studies at TU Munich (Germany).

1. Rahul posts in his campus feed: "Lost my calculator near Block C." Only IIITDM Kurnool
   students see it. Sneha and Lena never do.
2. Rahul posts in the India feed: "Any good hackathons in November?" Sneha sees it and
   replies. Lena can open the India feed and read it, react with 😮 and report it if it
   breaks the rules, but she **can't reply**: her university is in Germany.
3. Lena posts in Global: "Exchange students — what's your favourite Indian dish?" Rahul and
   Sneha can both reply.

**The campus feed shows more than campus posts.** It shows **everything posted by students of
your campus**, whatever the scope. So when Rahul posts in Global, his campus friends also see
it in their campus feed, with a small `🌍 Global` chip. This keeps the campus feed lively.

**"We split by country to spread the load" — what the split really does.** Country feeds help
**people** much more than **servers**:

- To show the 20 newest India posts, the database jumps straight to them through an
  **index** (a sorted list it keeps, like the index at the back of a book). That takes a few
  milliseconds, whether there are ten thousand posts or ten million.
- What a single world-wide feed really breaks is **pace**. With 50,000 students posting
  into one feed, every post scrolls away within seconds, like a YouTube live chat with
  100,000 viewers. Country feeds keep each conversation slow enough to follow.

So the design is right; it just helps for a different reason. Server load is handled by
indexes, loading in pages, and the stored hot score (§1.3).

## 1.2 One table for posts and replies

A reply is just a post with a **parent**:

```
posts
  id                 abc…            ← a post
  parent_post_id     (empty)
  content            "Any good hackathons in November?"

  id                 def…            ← a reply to it
  parent_post_id     abc…
  content            "Smart India Hackathon is on the 14th!"
```

**Why one table instead of two:**
- **One rate limit, one moderation check, one report form and one delete rule** cover posts and
  replies alike;
- reactions work the same on both;
- the database can enforce "**one level only**": if the parent already has a parent, the
  insert is refused with `NESTED_REPLY_NOT_ALLOWED`. The apps never have to draw nested
  threads.

A reply **inherits** its parent's scope, so a reply under an India post is an India reply. The
"who can reply" row of the table in §1.1 is checked by the database when the reply is saved.

## 1.3 Ranking: New and Hot, and how pages are loaded

**New** is simple: newest first. The campus feed is always New.

**Hot** (the default for the country and Global feeds) mixes **how much activity** a post has
with **how old** it is:

```
hot score = (reactions + 2 × replies + 1) ÷ (hours since posting + 2) ^ 1.5
```

**Worked example:**

| Post | Reactions | Replies | Age | Score |
|---|---|---|---|---|
| A | 30 | 5 | 10 hours | (30 + 10 + 1) ÷ 12^1.5 = 41 ÷ 41.6 = **0.99** |
| B | 6 | 2 | 1 hour | (6 + 4 + 1) ÷ 3^1.5 = 11 ÷ 5.2 = **2.12** |

B ranks above A: fresh activity beats old activity. A day later, if nothing new happens, B's
score has fallen to 11 ÷ 26^1.5 = **0.08** and it sinks. Replies count double because writing
a reply takes more effort than tapping an emoji.

**Why the score is stored and refreshed, not worked out on every request.** The score changes
every second (the age keeps growing), so the database can't keep a sorted index of it. So:

- each post has a `hot_score` column, set when it's posted;
- the database recalculates the score for posts from the **last 7 days**, **every 5 minutes**,
  using **pg_cron** (a timer built into Postgres);
- older posts keep their last score and sink naturally.

A score that is up to 5 minutes old is invisible to a human.

> **Why pg_cron and not the backend's timer?** Your backend already runs a timer
> (`utils/cronJobs.js`, using node-cron) for the nightly demo clean-up. But a server on
> Render can go to **sleep** when nobody is using it, and a sleeping server's timer doesn't
> fire. pg_cron runs inside the database, which never sleeps.

**Loading in pages (a recap of "keyset pagination").** A feed never loads everything at once.
It asks for 20 posts, then "the 20 after the last one I have". The "last one I have" is the
**cursor**:

- for New, it's the last post's time plus its id;
- for Hot, it's the last post's score plus its id.

The id is there to break ties: two posts posted in the same second still have a fixed order.
The backend packs the cursor into one opaque string, and **the apps never read or build
cursors; they send back exactly what they received.** (The Phase 0 contract had three
different cursor types; this replaces all of them with one rule.)

## 1.4 Reactions

**One reaction per person.** Rahul can react ❤️ **or** 😂 to a post, not both:
- choosing 😂 after ❤️ **replaces** his reaction;
- choosing ❤️ again **removes** it.

The database enforces this with a primary key on (post, person).

**Counts are stored on the post.** A post with 724 reactions has 724 rows in
`post_reactions`, one per person. A feed showing 20 posts would have to count up to
20 × 724 rows on every scroll. So the post row also keeps the totals:

```
posts.reactions_total  = 724
posts.reaction_counts  = {"❤️": 373, "😮": 95, "👍": 20, …}
```

A database trigger updates these two whenever a reaction is added, changed or removed. Your
code never touches them (the same rule as `likes_count` and `views` before).

**Messages are different, because a chat has exactly two people.** Instead of a new table,
each message gets a small `reactions` field:

```
messages.reactions = {"<Arjun's id>": "❤️", "<Priya's id>": "😂"}
```

When Arjun reacts, the message row is **updated**. Your apps already listen for message
updates through Realtime (Phase 6B uses them for "deleted for everyone"), so Priya's screen
shows the reaction within a second, with no new subscription.

**Any emoji, but only an emoji.** With ⊕ people can pick any emoji. The backend checks that
the value is exactly **one** emoji with a single regular expression:

```js
/^\p{RGI_Emoji}$/v.test(value)
```

| Value | Accepted? |
|---|---|
| `❤️` | yes |
| `👍🏽` (with a skin tone) | yes |
| `👨‍👩‍👧` (a family, several characters joined into one picture) | yes |
| `hi` | no |
| `❤️❤️` | no (two emojis) |
| `<script>` | no |

`RGI_Emoji` means "every emoji the Unicode standard recommends". The `v` at the end turns on
the newer regular-expression mode that understands it. Node 24, which your backend uses,
supports it.

## 1.5 Rate limits, kept by the database

A **rate limit** caps how often one person can do something. Ours:

| Action | Limit per hour | In an account's first 24 hours |
|---|---|---|
| Posts in your campus feed | 10 | 5 |
| Posts in your country feed **and** Global, counted together | 5 | 2 |
| Replies, anywhere | 30 | 15 |

**Worked example.** Rahul posts 10 times in his campus feed between 2:00 and 2:50.
- At 2:55 the 11th post is refused with `RATE_LIMIT_POSTS`.
- At 3:01, his 2:00 post is more than an hour old, so there are only 9 in the last hour: the
  next post goes through.

This is called a **sliding window**: it always looks at the last 60 minutes, not at "the
current clock hour".

**Why in the database?** For the same reason as every rule since Phase 1:
- a check in JavaScript can be skipped by another code path;
- a trigger runs on every insert, whichever code inserted the row.

**Deleted posts still count**, so deleting and re-posting doesn't get around the limit.

## 1.6 Automatic moderation (OpenAI's free moderation service)

Every post and reply, **with its photos**, is checked **before** it's saved. The check returns
a score from 0 to 1 for each category: harassment, hate, sexual content, violence, self-harm,
and so on. There are three outcomes:

| Outcome | When (starting values) | What happens |
|---|---|---|
| **Hold** | something clearly serious: a threat (harassment/threatening or hate/threatening ≥ 0.70), graphic violence (≥ 0.80), anything sexual involving minors (≥ 0.20), self-harm intent or instructions (≥ 0.50), explicit sexual content (≥ 0.85) | The post is saved as **pending**: only its author sees it, labelled `Being checked`. You review it in Phase 9's admin screen. |
| **Nudge** | not held, but the service still flags it (for example, insulting language) | Nothing is saved yet. The app asks `Post this?` with **Edit** and **Post anyway**. If the student posts anyway, it's published and marked so you look at it first later. |
| **Publish** | everything else | Published straight away |

**Worked examples:**
- "You're such an idiot, nobody likes your posts" → probably a **nudge**. Many people edit
  when asked; that's why Instagram and YouTube ask.
- "I'll hurt you after class tomorrow" → **hold**: a threat.
- A post that shows the author may want to hurt themselves → **hold**, and instead of a
  plain message the author sees the support card with helplines (spec §2.4). The aim is help,
  not punishment.

**The numbers are starting values.** They live in one place, `backend/src/utils/moderation.js`,
so you can tune them after launch without touching anything else.

**If the service is down, the post still goes through.** We wait at most 3 seconds. If there
is no answer:
- the post is published and marked "not checked yet";
- a small job checks unchecked posts every 10 minutes and holds any that should have been
  held.

A free outside service must never stop students posting. This is called **failing open**.
The cost is small: during an outage, a bad post can be visible for up to 10 minutes before
the re-check holds it, and reports still work during that time.

**Privacy:** posts and photos are sent to OpenAI to be checked. That needs one line in your
privacy policy, for example: "Posts and photos are automatically checked for harmful content
by a third-party moderation service."

**Not Google's Perspective API:** Google shuts it down on 31 December 2026.

## 1.7 Reports

**Anyone who can see a post can report it**, including students viewing another country's
feed. The only exception is the author.

**Reports don't delete anything. At a threshold, they cover the post:** it leaves every feed,
and on a profile or a direct link it shows behind
`This post was reported by several students and is being reviewed. [View anyway]`.

| Reason | Reports needed to cover the post |
|---|---|
| Child safety | **2** |
| Sexual content, violence or threats, self-harm | **3** |
| Everything else (spam, harassment, hate speech, impersonation, false information, prohibited item, something else) | **5** on a campus post · **10** on a country or Global post |

**Only reports from the post's own audience count for the "everything else" reasons.**
Worked example: a post in the **India** feed gets reported as *spam* by 12 students in Germany
and by 2 students in India.
- For spam, only the 2 Indian reports count toward the 10. The post stays up, and all 14
  reports wait in the review queue.
- If the reason had been *violence*, all 14 would count. Serious reasons count from everyone,
  because a threat is a threat wherever you read it.

This stops a group in one country from hiding another country's posts just because they
dislike them. On Global posts, everyone is the audience, so every report counts.

**False reports.** The report form says (spec §7):

> Reports are anonymous and reviewed by the Yahora team. Please report only content that
> breaks our Community Guidelines. Deliberately false reports, or repeated misuse of
> reporting, may lead to restrictions on your account, including suspension. Honest reports
> are always welcome — you won't be penalised if we decide a post doesn't break the rules.

The last sentence matters: you want honest people to keep reporting. To back the warning up,
every report gets a **status**: `open`, then `upheld` or `dismissed` once you review it in
Phase 9. Phase 9 can then act on people with many dismissed reports — for example, pause
their reporting for a week after 5 dismissed reports in 30 days. Phase 7 just keeps the
records.

**The reporter is never told the outcome**, or how many others reported. Knowing that would
let people organise false reports.

## 1.8 Deleting a post: gone at once, kept 90 days, then removed

When an author deletes their post, it disappears from every feed and profile **immediately**.
Behind the scenes:

1. The row gets a `deleted_at` time instead of being removed. Its replies disappear with it.
2. After **90 days**, a daily job in the backend removes it for good: first its photos from
   storage, then the row, with its replies and reactions. (This job runs in the backend, not
   in pg_cron, because SQL can't delete files from Supabase Storage.)

**Why keep it for 90 days?** Picture someone who posts something cruel and deletes it a
minute later, before anyone can report it. The person it hurt may still come to you. Keeping
the row lets you see what was posted. Your privacy policy needs one line about this too.

## 1.9 GIFs from KLIPY

Google shut down the Tenor GIF service on 30 June 2026; WhatsApp, Discord and others moved
to GIPHY or KLIPY. We use **KLIPY**, which offers a free test key and an unlimited production
key on application.

**KLIPY's rules (they are part of the terms):**
- searches run **from the student's app or browser**, not from your server;
- show the credit **"Powered by KLIPY"** in the picker;
- show the GIFs from KLIPY's own links, and don't copy them to your storage;
- don't re-order or filter the search results yourself. The content filter is a setting in
  KLIPY's panel: set it to the safest level that still feels fun (PG-13 or lower).

**What we store with a post or message** is a small description of the GIF, not the GIF
itself:

```json
{ "provider": "klipy", "id": "…", "url": "https://…", "preview_url": "https://…", "width": 320, "height": 240 }
```

**Keys:** the test key allows 100 searches an hour, which is plenty for building and testing.
**Apply for the production key before launch** (it's on the Phase 9 list).

## 1.10 Photos in a post: the order of steps

Posting with photos happens in this order, and the order matters:

1. check the text length, photo count, types and sizes;
2. run the moderation check (§1.6) on the text **and** the photos;
3. **only then** upload the photos to the `posts` storage bucket, with random file names;
4. insert the post row;
5. if step 4 fails, delete the files uploaded in step 3.

**Worked example of the wrong order:** upload first, then moderate. A held or nudged post has
already left 3 files in storage that nothing points to; they are paid for forever and nobody
will ever clean them up. (`POST /api/products` had exactly this bug, noted in the Phase 0
contract.)

## 1.11 The demo world, and `demo.` usernames

**Two worlds, never mixed.** Each post records whether its author is a demo account (copied
from their campus when it's saved). Every feed shows only posts from the viewer's own world:

| Viewer | Campus feed | Country and Global feeds |
|---|---|---|
| Real student | their campus | real students only |
| Demo account | the demo campus | demo accounts only, plus the personas' seeded posts |

So a demo account that posts "hello" in Global is seen only by other demo accounts. This is
the same separation you built for search in Phase 6A.

**Demo usernames.** Today a demo account picks a username, which blocks that name for up to
7 days. From Phase 7:

- **At demo login**, the database gives the account a name like `demo.sunny.otter`. The demo
  skips the username step.
- **A rule in the database**, both ways:
  - a demo-campus account's username **must** start with `demo.`;
  - a real account's username **must not** start with `demo.`, `demo-` or `demo_`, so no real
    student ever looks like a demo.
- **Why `demo.` with a dot, and not just `demo`?** Banning the plain prefix `demo` would also
  block real names like `democrat`, `demon` or `demolition`.

## 1.12 Counting characters

"1,000 characters" sounds obvious until emoji arrive. Take the text `Hi 👋🏽` (a waving hand
with a skin tone):

| Way of counting | Result |
|---|---|
| JavaScript `"Hi 👋🏽".length` | **7**. It counts storage units, and each emoji takes two of them |
| JavaScript `[..."Hi 👋🏽"].length` | **5**. It counts characters ("code points") |
| Postgres `char_length('Hi 👋🏽')` | **5** — code points |

If the app counts one way and the database another, a student sees "3 left" and still gets
`CONTENT_TOO_LONG`. **Rule: count code points everywhere** — `[...text].length` in JavaScript
and TypeScript, `char_length()` in SQL. The spec's counter uses the same rule.

## 1.13 The adjustable layout (website, laptop only)

The two panels work like LeetCode's or VS Code's: drag the divider, collapse a panel, open one
full width. We use a small, well-known library, **react-resizable-panels**, instead of writing
the dragging code ourselves. It already handles mouse, touch and keyboard, minimum sizes,
collapsing, and **remembering the layout** in the browser. Below 1,024 px wide, the page shows
the switcher instead, exactly like the app.

## 1.14 The order things go live

The same safe order as 6B: **expand the database, then use it, then contract.**

1. **Day 5 — the database.** All four migrations are additive:
   - the `posts` table is reworked, but no code uses it yet;
   - messages get two new optional fields;
   - demo usernames get a rule.

   The live website keeps working unchanged.
2. **Days 6–8 — the backend.** First the messages, auth and universities changes (V-C), then
   the posts and reports API (N-B, N-C). Each only adds routes or fields.
3. **Day 13 — M1, the website community.**
4. **Day 18 — M2, reactions and GIFs in messages on the website, and the demo onboarding.**

One small in-between state: from day 6, demo accounts already get `demo.` names, but the old
onboarding screen still shows an editable username field until M2. If a demo user changes the
name, the database refuses. Demo users can press **Skip for now**, as they can today. This is
pre-launch, so it harms nobody.

## 1.15 Branches: one short branch per block (recap from 6B)

Each block gets its own branch, cut from the newest `main`, merged by its own pull request,
then deleted:

```
main  ──●────────●──────────●────────────●──────────▶
         \      / \        /  \          /
          ●──●─●   ●──●──●     ●──●──●──●
          v-a-shared   v-b-migrations   n-b-posts-api
```

Each `●` on a side branch is a commit. Each place a side branch joins `main` is a merged PR.

**The commands you'll use every block:**

```bash
git checkout main && git pull origin main      # start from the newest main
git checkout -b v-b-migrations                 # a new branch for this block
# … work, then save:
git add -A && git commit -m "feat(db): community posts schema"
git push -u origin v-b-migrations              # -u only the first time
```

Then open the PR on GitHub. After it merges:

```bash
git checkout main && git pull origin main
git branch -d v-b-migrations                   # delete your local copy
```

**When one block needs another that isn't merged yet** (for example, Neeraj testing the website
against posts-API code still in review), make a throwaway branch with both, test on it, and
delete it — exactly as in 6B:

```bash
git checkout n-d-web-community
git checkout -b try-both
git merge --no-edit n-b-posts-api
# … test …
git checkout n-d-web-community && git branch -D try-both
```

**Backend PRs need a rebase first** (`backend/CLAUDE.md`). A rebase replays your commits on top
of the newest `main`, as if you had started your branch today:

```
before:   main ──A──B──C          your branch ──A──X──Y   (started before B and C)
after:    main ──A──B──C──X'──Y'                          (same changes, newer base)
```

```bash
git fetch origin
git rebase origin/main
git push --force-with-lease     # only after a rebase, only on your own block branch
```

**If a rebase stops with a conflict**, git tells you which file. Open it, keep the right lines
(remove the `<<<<<<<`, `=======` and `>>>>>>>` markers), then run `git add <file>` and
`git rebase --continue`. If you're lost, `git rebase --abort` puts everything back exactly as
it was before you started. Nothing is lost.

## 1.16 Keys and secrets

Phase 7 needs two outside services. Their keys must **never** be committed:

| Key | Where it lives locally | Where it lives in production | Who creates it |
|---|---|---|---|
| `OPENAI_API_KEY` | `backend/.env` | Render → your API service → **Environment** | Vishwajeet (Block V-0) |
| `VITE_KLIPY_API_KEY` | `frontend/.env` | Netlify → Site configuration → **Environment variables** | Vishwajeet creates the KLIPY account; Neeraj adds it to Netlify |
| `EXPO_PUBLIC_KLIPY_API_KEY` | `mobile/.env` | not needed: the app runs through Expo Go from your machine | Vishwajeet |

**The KLIPY key is visible to anyone who inspects your app or website.** That's normal for a
key that must be used from the browser. If KLIPY's panel lets you limit the key to your
domains, do it. The OpenAI key is different: it stays on the server and must never reach a
browser.

Share keys with each other through a direct message you then delete, or a password manager,
**never** in a commit, a changelog entry or a screenshot.

---
# PART 2 — FILES, OWNERSHIP, CALENDAR, GO-LIVES

## 2.1 Every file this phase touches, by person

**Vishwajeet**

| Area | Files |
|---|---|
| Shared backend | `backend/src/utils/moderation.js`, `emoji.js`, `pagination.js` (all **new**), `backend/src/utils/respond.js` (new error names), `backend/src/utils/cronJobs.js` (two jobs: re-check, 90-day clean-up), `backend/API.md` (the new contract for posts, reports, reactions, GIFs) |
| Database | four new files in `supabase/migrations/`, plus test scripts in `supabase/tests/phase7/` (**new folder**) |
| Messages API | `backend/src/modules/messages/messages.controller.js`, `messages.routes.js` |
| Auth and universities | `backend/src/modules/auth/auth.controller.js` (demo usernames), `backend/src/modules/university/university.controller.js` (country) |
| Demo data | `backend/scripts/seedDemo.js` (persona posts) and `supabase/seed.sql` (local test posts) |
| App — community | `app/(tabs)/_layout.tsx`, `app/(tabs)/community.tsx` (**new**), `app/post/[id].tsx` (**new**), `app/compose.tsx` (**new**), `src/components/community/*` (**new**), `src/hooks/useCommunity*.ts` (**new**), `src/lib/community.ts` (**new**), `src/types/index.ts`, `src/theme/index.ts`, `app/(tabs)/profile.tsx`, `app/profile/[id].tsx` |
| App — messages | `app/chat/[contactId].tsx`, `src/components/MessageActionMenu.tsx`, `src/hooks/useMessages.ts`, `src/contexts/RealtimeContext.tsx`, `app/(tabs)/messages.tsx`, `src/lib/messages.ts` |
| App — demo | `app/(auth)/onboarding.tsx` |
| App libraries | `rn-emoji-keyboard` |

**Neeraj**

| Area | Files |
|---|---|
| Backend — **on loan** (§2.2) | `backend/src/modules/posts/posts.routes.js`, `posts.controller.js` |
| Backend — his own | `backend/src/modules/reports/reports.routes.js`, `reports.controller.js` |
| Website — community | `src/pages/community/*` (**new**), `src/pages/post/*` (**new**), `src/components/community/*` (**new**), `src/utils/community.js` (**new**), `src/App.jsx` (routes), `src/components/navbar/navbar.jsx`, `src/styles/global.css`, `src/pages/publicProfile/PublicProfile.jsx`, `src/pages/dashboard/Dashboard.jsx` |
| Website — messages | `src/pages/messages/Messages.jsx`, `Messages.module.css`, `src/components/MessageMenu/*` |
| Website — demo | `src/pages/onboarding/onboarding.jsx` |
| Website libraries | `react-resizable-panels`, `emoji-picker-react` |
| Testing | all of T1–T5 |

**Shared files.** `backend/API.md`: Vishwajeet writes the new contract in V-A; after that, each
of you updates only your own module's section. Git merges edits to different parts of one
file on its own.

## 2.2 Ownership — one loan, for this phase only

`backend/CLAUDE.md` gives the `posts` module to Vishwajeet. **For Phase 7 it is lent to
Neeraj**, from day 1 until sign-off. Why:

- without the loan, Vishwajeet would have the database, the messages API, the auth change
  **and** every app screen: about 5 days more than Neeraj;
- the posts API is what Neeraj's website calls first, so he is the one who notices
  straight away if something is off.

**The rules of the loan** (the same as 6B):

1. Vishwajeet doesn't edit `backend/src/modules/posts/` until sign-off.
2. Neeraj **doesn't change the `OWNER:` banner** in those files. The loan is recorded in a
   changelog entry (Vishwajeet files it in V-A), and every prompt that touches the files
   says so.
3. **Every backend PR is still reviewed by the other person.** Neeraj's posts and reports PRs
   are reviewed by Vishwajeet; Vishwajeet's shared, messages and auth PRs by Neeraj.
4. The module goes back to Vishwajeet at sign-off. The SIGN-OFF entry says so.

The database stays entirely Vishwajeet's: **Neeraj never writes SQL**. If the posts API needs
something from the database that isn't there, Neeraj files a "Migration request" entry
(`backend/CLAUDE.md` explains how).

## 2.3 The calendar

Each day is one working day of 5–6 hours. **R** = review the other person's backend PR (about
30 minutes). **Mock data** means building the screens with sample posts shaped exactly like
the API's answers, so the website work isn't blocked while the API is being written.

| Day | Date | Vishwajeet | Neeraj |
|---|---|---|---|
| 1 | Fri 30 Oct | **V-0** setup, accounts and keys · **V-A** shared backend · design review (30 min, ~12:00) | **N-0** commit the package (**first thing**) · design review · **N-D** page shell and adjustable layout |
| 2 | Sat 31 Oct | **V-A** → PR · **V-B** migrations begin | **R** V-A · **N-D** post card and composer with mock data |
| 3 | Sun 1 Nov | **V-B** migrations and local tests | **N-D** reactions UI (quick bar, picker, summary, breakdown) with mock data |
| 4 | Mon 2 Nov | **V-B** finish → merged | `supabase db reset` · **N-B** posts API (CC-N1: reading) |
| 5 | Tue 3 Nov | **Production push** of the migrations (morning) · **V-C** messages, auth, universities | **N-B** (CC-N2: posting, deleting, reacting) |
| 6 | Wed 4 Nov | **V-C** → PR · **V-D** app community begins (CC-V4a) | **R** V-C · **N-B** → PR · **N-C** reports API |
| 7 | Thu 5 Nov | **R** N-B · **V-D** (CC-V4a) | merge N-B · **N-C** → PR · **T1** API checks |
| 8 | Fri 6 Nov | **R** N-C · **V-D** (CC-V4a) | merge N-C · **N-D** connect the website to the real API (CC-N4a) |
| 9 | Sat 7 Nov | **V-D** (CC-V4b: composer) | **N-D** (CC-N4b: composer) |
| 10 | Sun 8 Nov | **V-D** (CC-V4b) | **N-D** (CC-N4b) |
| 11 | Mon 9 Nov | **V-D** (CC-V4c: post page, reactions, report, profile) | **N-D** (CC-N4c: post page, report, profile, navbar) |
| 12 | Tue 10 Nov | **V-D** (CC-V4c) · *cut-line check* | **N-D** finish → PR · *cut-line check* |
| 13 | **Wed 11 Nov** | **V-D** finish → merged | **M1**: merge N-D · **T2** community begins |
| 14 | Thu 12 Nov | **V-E** app message reactions and GIFs (CC-V5) · fixes from T2 | **T2** continues |
| 15 | Fri 13 Nov | **V-E** | **N-E** website message reactions, GIFs, demo onboarding (CC-N5) |
| 16 | Sat 14 Nov | **V-E** finish · **V-F** app demo onboarding (CC-V6) | **N-E** |
| 17 | Sun 15 Nov | fixes | **N-E** → PR · **T3** messages begins |
| 18 | **Mon 16 Nov** | fixes from T3 | **M2**: merge N-E · **T3** finish |
| 19 | Tue 17 Nov | fixes | **T4** everything, all phones |
| 20 | Wed 18 Nov | fixes from T4 | **T4** finish |
| 21 | Thu 19 Nov | stand by for T5 | **T5** production check |
| 22 | **Fri 20 Nov** | **SIGN-OFF** together · release 7 | **SIGN-OFF** together |
| — | Sat 21 – Mon 23 Nov | buffer | buffer |

**How the work splits:** about 21 days each.
- **Vishwajeet:** the shared backend, the database, the messages and auth API, and every app
  screen.
- **Neeraj:** the posts and reports API, every website screen, and **all** the hands-on
  testing on the website and the phones.

**Phones, now that you work from your own places.** Neeraj tests the app by running
`npx expo start` on his own laptop from `main` (§T2 explains). Rows in the test tables that
name a phone Neeraj doesn't have are run by whoever has that phone. They take about 10 minutes
each.

## 2.4 Go-lives — what reaches the real site, and in which order

⛔ **Merge in the order written.**

| When | Who | What | Why it's safe at that moment |
|---|---|---|---|
| Day 5 | Vishwajeet | Push the 4 migrations (V-B, by hand) | Only adds things; no code uses `posts` yet |
| Day 5 | Vishwajeet | Add `OPENAI_API_KEY` to Render | N-B (day 7) needs it the moment it merges |
| Day 6–7 | Vishwajeet | Merge V-C | Adds routes and fields; old clients ignore them |
| Day 7 | Neeraj | Merge N-B (posts API) | New routes, nothing calls them yet |
| Day 8 | Neeraj | Merge N-C (reports API) | Same |
| Day 12 | Neeraj | Add `VITE_KLIPY_API_KEY` to Netlify | M1's GIF picker needs it |
| **Day 13** | Neeraj | **M1:** merge N-D (website community) | The API it calls has been live since day 7 |
| **Day 18** | Neeraj | **M2:** merge N-E (messages reactions, GIFs, demo onboarding) | V-B and V-C have been live since days 5–7 |

After each merge, check Render shows "Live" (and press **Manual Deploy → Deploy latest commit**
if auto-deploy is off, as in 6B), and that Netlify shows "Published".

## 2.5 What "done" means for Phase 7

- [ ] **Feeds:** campus, country and Global work on the website (two panels and the switcher)
      and in the app (switcher). The view-only rules in §1.1 hold. (T2)
- [ ] **Posts:** 1,000 characters with "See more"; 3 photos or 1 GIF; one level of replies;
      delete your own. (T2)
- [ ] **Reactions:** tap ❤️, the quick bar, the ⊕ picker, change and remove, the summary and the
      breakdown — on posts, replies and messages; live on both sides in a chat. (T2, T3)
- [ ] **GIFs:** in posts, replies and messages, with the KLIPY credit. (T2, T3)
- [ ] **Moderation:** nudge, hold and the support card all work; posting still works when
      the service is down. (T1, T2)
- [ ] **Reports:** anyone who can see a post can report it; the warning shows; the thresholds
      cover posts as in §1.7. (T1, T2)
- [ ] **Limits:** the rate limits refuse the 11th campus post in an hour. (T1)
- [ ] **Demo:** demo accounts get `demo.` names and their own community; real users can't
      take `demo.` names. (T2)
- [ ] **Nothing else broke:** marketplace, messages, Mark as Sold and privacy, on all phones.
      (T4)
- [ ] **Docs:** `backend/API.md` matches every route; the spec is committed; every block filed
      a changelog entry; 7 is released at sign-off.

---
# TRACK 1 — VISHWAJEET, MANUAL STEPS

Seven blocks. V-A and V-B unblock Neeraj's backend work, so they come first and must not slip.

## Block V-0 — Setup, accounts and keys (Day 1, about 1½ hours)

**Wait for Neeraj's package commit** (N-0, about 10:30). Then:

```bash
cd ~/path/to/yahora
git checkout main && git pull origin main
supabase start
supabase db reset
```

### Step 1 — the OpenAI key (for moderation)

1. Go to **platform.openai.com** and sign in (or create an account).
2. Create a project called **Yahora** (the project menu is at the top left).
3. Open **API keys** → **Create new secret key**. Name it `yahora-moderation`. If it offers
   **Restricted** permissions, give it access to **Moderations** only.
4. Copy the key straight away: it's shown only once. It starts with `sk-`.
5. Open `backend/.env` and add a line:

   ```
   OPENAI_API_KEY=sk-…your key…
   ```

6. The moderation service itself is free. If OpenAI asks for a payment method before the key
   works, add one, then set a **low monthly budget limit** in the project's billing or limits
   settings, so nothing else can ever cost money by accident.
7. Test it from the terminal (this sends the words "hello world" to be checked):

   ```bash
   source backend/.env 2>/dev/null; curl -s https://api.openai.com/v1/moderations \
     -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" \
     -d '{"model":"omni-moderation-latest","input":"hello world"}' | grep -m1 flagged
   ```

   You should see `"flagged": false`.

### Step 2 — the KLIPY key (for GIFs)

1. Go to **klipy.com**, open the section for developers (the API or Partner Panel), and sign up.
2. Create an app called **Yahora** and copy its **test key**.
3. In the panel, set the **content filter** to the safest level that still feels fun (PG-13 or
   lower).
4. Add the key to the app's settings file, `mobile/.env`:

   ```
   EXPO_PUBLIC_KLIPY_API_KEY=…the test key…
   ```

5. Send the same key to Neeraj privately (§1.16). He puts it in `frontend/.env` as
   `VITE_KLIPY_API_KEY`.
6. Write **"Apply for the KLIPY production key"** on the Phase 9 list. The test key allows
   100 searches an hour, which is enough until launch.

### Step 3 — make sure keys can never be committed

```bash
git check-ignore -v backend/.env frontend/.env mobile/.env
```

Each of the three lines must print a rule (for example `.gitignore:3:.env`). If a file
prints nothing, **stop** and add `.env` to that folder's `.gitignore` before anything else.

**👁️ CHECKPOINT V-0**
1. The OpenAI test printed `"flagged": false`.
2. `git check-ignore` printed a rule for all three files.
3. `supabase db reset` finished without a red error.
4. Expo Go opens the app on your POCO.
5. At about **12:00**, the design review with Neeraj (Block N-A): you check the **app** half
   of the spec.

## Block V-A — Shared backend pieces (Days 1–2)

**This unblocks Neeraj.** Read §1.4 (emoji check), §1.6 (moderation) and §1.3 (cursors)
first.

```bash
git checkout main && git pull origin main
git checkout -b v-a-shared
```

Run **CC-V1**. It creates three small helpers (`moderation.js`, `emoji.js`, `pagination.js`),
adds the new error names, writes the **new contract** for posts, reports, reactions and GIFs
into `backend/API.md`, and files the loan entry.

**👁️ CHECKPOINT V-A**

1. `node --check` on the three new files prints nothing (nothing printed means no syntax
   error).
2. In `backend/`, run the little try-out script CC-V1 writes:

   ```bash
   cd backend && node scripts/try-moderation.mjs && cd ..
   ```

   You should see three lines, roughly:

   ```
   "Good morning, campus!"                       → publish
   "You are such an idiot, nobody likes you"     → nudge
   "I will hurt you after class tomorrow"        → hold
   ```

   If the second one says `publish`, that's fine: the service decides, and the threshold
   numbers can be tuned later. If the **third** one says `publish`, tell me before you merge.
3. Open `backend/API.md` and find **"posts module (Phase 7)"**. The endpoints match the
   runbook's Appendix A.
4. `node scripts/changelog.mjs for neeraj` lists the loan entry.
5. Commit, push, open the PR. **Neeraj reviews it** (backend PR rule). Merge it on day 2.

## Block V-B — The four migrations (Days 2–4; production push Day 5)

Read §1.1 to §1.8 and §1.11 first: they describe every table and rule you're about to add.

```bash
git checkout main && git pull origin main
git checkout -b v-b-migrations
```

Run **CC-V2**. This is the biggest prompt in the phase. Claude Code writes four migrations,
a test script for each, and sample posts for your local database. Let it take its time, and
**read its summary of each migration** before you accept it.

**👁️ CHECKPOINT V-B — local**

1. `supabase db reset` finishes without an error. It re-applies everything, including the
   new seed posts.
2. Run the four test scripts:

   ```bash
   for f in supabase/tests/phase7/*.sql; do
     echo "== $f"
     psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f "$f" 2>&1 | grep -E "NOTICE|ERROR"
   done
   ```

   (No `psql` on your Mac? Use the container's, as in 6B:
   `docker exec -i supabase_db_yahora psql -U postgres -d postgres < file`.)

   Every line must say `NOTICE: … ok`. **Any `ERROR` means stop**: paste it to Claude Code
   and ask it to fix the migration, then reset and test again.
3. Supabase Studio (`http://127.0.0.1:54323`) → **Table Editor**:
   - `posts` has `scope`, `country_code`, `parent_post_id`, `image_urls`, `gif`,
     `reactions_total`, `reaction_counts`, `hot_score`, `moderation_status` and
     `deleted_at`;
   - `post_reactions` and `reports` exist;
   - `messages` has `reactions` and `gif`;
   - `universities` has `country_code`.
4. Studio → **SQL Editor** (local), run:

   ```sql
   select jobname, schedule from cron.job order by jobname;
   ```

   You should see one job: `refresh-hot-scores`, with schedule `*/5 * * * *` (meaning every
   5 minutes).
5. Commit, push, PR, merge (database-only PRs follow your usual rule: merge after your own
   checks). **Tell Neeraj:** he runs `supabase db reset` after pulling, before N-B.

**Production push — Day 5, first thing. Only you, by hand.** ⛔ Claude Code never touches
production (root `CLAUDE.md`).

*Step 1 — look before you push.* Supabase dashboard → **SQL Editor** (production). This only
reads:

```sql
select
  (select count(*) from public.posts)                                         as posts_rows,
  (select count(*) from public.users u join public.universities n on n.id = u.university_id
    where n.is_demo and u.username is not null and u.username not like 'demo.%') as demo_users_to_rename;
```

Write both numbers in today's changelog entry. `posts_rows` is very likely 0. Any rows that
exist are kept and converted by the migration.

*Step 2 — dry run.* In your terminal, at the repo root:

```bash
supabase db push --dry-run
```

It must list **exactly** the four Phase 7 migrations. Anything else means production and local
have drifted, so stop and look first.

*Step 3 — push.*

```bash
supabase db push
```

*Step 4 — check it worked.* Back in the production SQL Editor:

```sql
select
  (select count(*) from information_schema.columns where table_schema='public' and table_name='posts'
     and column_name in ('scope','country_code','parent_post_id','image_urls','gif','hot_score','moderation_status','deleted_at'))
                                                                           as post_columns,      -- expect 8
  (to_regclass('public.post_reactions') is not null)                       as has_reactions,     -- expect true
  (to_regclass('public.reports') is not null)                              as has_reports,       -- expect true
  (select count(*) from information_schema.columns where table_schema='public' and table_name='messages'
     and column_name in ('reactions','gif'))                               as message_columns,   -- expect 2
  (select count(*) from cron.job where jobname = 'refresh-hot-scores')    as cron_jobs,         -- expect 1
  (select count(*) from public.users u join public.universities n on n.id = u.university_id
    where n.is_demo and u.username is not null and u.username not like 'demo.%')
                                                                           as demo_left;         -- expect 0
```

*Step 5 — the live site still works.* Open `https://yahora.netlify.app`, browse the marketplace,
open a chat and send a message.

*Step 6 — the OpenAI key in production.* Render → your API service → **Environment** → **Add
Environment Variable**: `OPENAI_API_KEY` = your key → **Save changes**. Render restarts the
service by itself. Wait until it shows **Live**.

*Step 7 — tell Neeraj:*
`node scripts/changelog.mjs new vishwajeet "Phase 7 migrations pushed to production" --phase 7 --block V-B --for neeraj`
— with the two numbers from step 1 and the results from step 4.

## Block V-C — Messages: reactions and GIFs; demo usernames; countries (Days 5–6)

Read §1.4 (reactions on messages) and §1.11 (demo usernames).

```bash
git checkout main && git pull origin main
git checkout -b v-c-messages-reactions
```

Run **CC-V3**.

**👁️ CHECKPOINT V-C — with curl, against your local API**

Paste this once. It's the same set of helpers as 6B:

```bash
API=http://localhost:5001/api
login() {
  curl -s -X POST "$API/auth/login-password" -H "Content-Type: application/json" \
    -d "{\"identifier\":\"$1\",\"password\":\"password123\"}" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['session']['access_token'])"
}
ARJUN=$(login arjun.mehta); PRIYA=$(login priya.nair)
MSG=f0000000-0000-4000-8000-000000000006      # Priya's seeded message to Arjun about the Wacom
```

Then, one at a time:

```bash
# 1. Arjun reacts ❤️ to Priya's message
curl -s -X PUT "$API/messages/$MSG/reaction" -H "Authorization: Bearer $ARJUN" \
  -H "Content-Type: application/json" -d '{"emoji":"❤️"}' | python3 -m json.tool | grep -A2 '"reactions"'
#    → "reactions": { "b0000000-…-000000000001": "❤️" }

# 2. Something that isn't one emoji
curl -s -X PUT "$API/messages/$MSG/reaction" -H "Authorization: Bearer $ARJUN" \
  -H "Content-Type: application/json" -d '{"emoji":"hello"}'
#    → {"error":"INVALID_EMOJI"}

# 3. Arjun removes his reaction
curl -s -X DELETE "$API/messages/$MSG/reaction" -H "Authorization: Bearer $ARJUN" | grep -o '"reactions":{[^}]*}'
#    → "reactions":{}

# 4. A demo login now comes with a demo. username
curl -s -X POST "$API/auth/demo-login" | python3 -c "import sys,json; print(json.load(sys.stdin)['userProfile']['username'])"
#    → something like demo.sunny.otter

# 5. Campuses now carry a country
curl -s "$API/universities" | python3 -c "import sys,json; print(json.load(sys.stdin)[0].get('country_code'))"
#    → IN
```

👁️ And in the app: send a message from the POCO to Neeraj's test account. Nothing looks
different yet; that's correct.

Open the PR. **Neeraj reviews it.** Merge on day 6 or 7. (It's safe live straight away: it only
adds things — §1.14.)

## Block V-D — The app community (Days 6–13)

The largest block of the phase. Read **all** of `docs/design/COMMUNITY_SPEC.md` first. Then run
the three prompts **in order**, one at a time, each only after the previous checkpoint passes:

| Prompt | Days | What |
|---|---|---|
| **CC-V4a** | 6–8 | The Community tab, the switcher and countries, the three feeds, the post card, reactions on the card |
| **CC-V4b** | 9–10 | The compose screen: text, photos, GIF, and every result of posting |
| **CC-V4c** | 11–13 | The post page and replies, the full emoji picker, the breakdown, reporting, deleting, the Posts tabs, the "new posts" pill |

Each prompt is its own branch: `v-d-app-community-a`, `-b`, `-c` (§1.15). Merge each one
after its checkpoint, so the next starts from `main`.

> **Before Neeraj's posts API is merged (day 7),** CC-V4a builds against the contract in
> `backend/API.md`. To see real data on day 6, run your local backend from a throwaway branch
> that also has his `n-b-posts-api` branch merged in (§1.15, "When one block needs another").

**👁️ CHECKPOINT V-D4a** — the POCO, logged in as `arjun.mehta`:
1. Four tabs: Marketplace, Community, Messages, Profile. The app still opens on Marketplace.
2. Community → **Campus**: the seeded IIITDM Kurnool posts, newest first. Long posts fold
   with **See more**.
3. Tap the second segment: **🇮🇳 India** is selected. Tap it again: the dropdown shows India
   (your country) first, then Global, then Germany (the local test campus CC-V2 adds).
4. Switch to **Global**, then flip **Hot · New**: the order changes.
5. Tap **♡** on a post: it becomes ❤️ and the summary count goes up by 1. Tap again: back to ♡.
6. Long-press ♡: the quick bar (❤️ 👍 😂 😮 😢 🙏 ⊕) appears. Pick 😂: the button shows 😂.
7. Turn on airplane mode and pull to refresh: a friendly error, no crash. Turn it off again.

**👁️ CHECKPOINT V-D4b**
1. Tap the composer in **Campus**: the compose screen shows
   `Posting as @arjun.mehta · IIITDM Kurnool` and the chip **Campus**.
2. Type a long text: the counter appears at 100 left, and at 1,001 Post is disabled.
3. Add 3 photos, then try GIF: the GIF button says to remove the photos first.
4. Remove the photos, add a GIF, post: it appears at the top of Campus with the GIF playing.
5. Type `You are such an idiot, nobody likes you` and post: the **Post this?** dialog. Tap
   **Edit**: your text is still there.
6. Type `I will hurt you after class tomorrow` and post: the "being checked" message. It's
   not in the feed, but it is on your Profile → **Posts** with the label `Being checked`
   (that tab arrives in CC-V4c; check this step again then).
7. Post 10 times quickly in Campus. The 11th shows the posting-limit message, and your text
   is kept.

**👁️ CHECKPOINT V-D4c**
1. Tap a post's 💬: the post page, with replies oldest first, and **Load more replies** when
   there are more than 20.
2. Reply with text and a GIF: it appears at the bottom.
3. Open the India feed while logged in as a seeded **NIET** student (`sneha.gupta`): you can
   reply, because NIET is in India too. *(A view-only test needs a campus in another country:
   CC-V2's seed adds a test campus in Germany with one student, `lena.test`. Log in as her
   and open India: there's no composer, just the view-only banner, but you can still react.)*
4. Long-press a post → ⊕: the full emoji picker with search. Search `fire` → 🔥 → it
   becomes your reaction.
5. Tap the reaction summary: the breakdown sheet, with a grid of emoji and counts and ⊕ first.
6. ⋯ → **Report**: the reasons, the warning paragraph, and Report disabled until a reason is
   picked. Report once: the thank-you toast, and the post leaves your feed. Report the same
   post again from its link: `You've already reported this post.`
7. ⋯ on your own post → **Delete** → confirm: gone from every feed.
8. Profile → **Posts**: your posts, including the `Being checked` one from V-D4b.
9. **"New posts" pill:** keep Campus open on the POCO. From Neeraj's account on the same
   campus (or the website), post something. Within 30 seconds the pill `↑ 1 new post`
   appears; tap it and the post is at the top.

## Block V-E — The app: reactions and GIFs in messages (Days 14–16)

Read spec §5.5 and §6. Run **CC-V5** on a new branch `v-e-app-message-reactions`.

**👁️ CHECKPOINT V-E** — the POCO as `arjun.mehta`, and Neeraj's laptop (or a second phone) as
`priya.nair`, both in the Wacom chat:
1. Long-press one of Priya's messages: the quick bar sits **above** the action menu. Pick ❤️.
   A small pill `❤️` hangs under the bubble, and on Priya's screen within about a second.
2. Long-press again → ⊕ → search `cat` → 😺: your reaction changes, on both screens.
3. Tap the pill: `You 😺 · Tap to remove` and Priya's reaction, if she has one. Tap yours:
   it's removed.
4. Tap the GIF button in the composer, search `hello`, pick one: the GIF is sent and plays on
   both sides. The inbox row for this chat reads `GIF`.
5. Swipe to reply to the GIF message: the quote reads `GIF`.
6. Long-press a deleted message (tombstone): **no** quick bar.

## Block V-F — The app: demo onboarding (Day 16)

Run **CC-V6** on a new branch `v-f-app-demo-onboarding`.

**👁️ CHECKPOINT V-F**
1. Log out → **Explore Live Demo**. The onboarding screen shows your name, like
   `@demo.sunny.otter`, read-only, with `Demo accounts get a name automatically.`
2. Community: you see only the demo personas' posts, never Arjun's or Priya's.
3. Log out, and as a brand-new real user (or in the username field of the edit-profile
   screen), try `demo.test`: it is refused.

## Block V-G — Fixes, go-lives, sign-off (Days 17–22)

- Fix what T2, T3 and T4 find. Neeraj logs each failure with a block and a platform.
- Be around on day 21 for T5, in case the API needs a manual deploy.
- Day 22: SIGN-OFF together.

---
# TRACK 2 — VISHWAJEET, CLAUDE CODE PROMPTS

## The session opener — paste this at the start of every Claude Code session

It's the same for Neeraj; he changes the name.

```
Phase 7 session start.

1. Read CLAUDE.md at the repo root, and the CLAUDE.md of the folder you will
   work in (backend/, mobile/ or frontend/).
2. Run:  node scripts/changelog.mjs recent 8   and open every entry it lists.
   Run:  node scripts/changelog.mjs for vishwajeet
3. The phase plan is docs/runbooks/PHASE_7_RUNBOOK.md. Read PART 0, then the
   block I name. Do not start until I paste that block's prompt.
4. The design is docs/design/COMMUNITY_SPEC.md. When a prompt says "the
   spec", implement it exactly and invent nothing. If the spec does not cover
   something, choose the simplest option and tell me what you chose.
```

## CC-V1 — Shared helpers and the Phase 7 contract

```
Phase 7, Block V-A. Shared backend pieces for the community, all in files I
own. Nothing calls the new code until Neeraj's Block N-B.

Read first: runbook §1.3, §1.4, §1.6, §1.16, Appendix A and Appendix B.

1. CREATE backend/src/utils/emoji.js (OWNER banner: VISHWAJEET — added in
   Phase 7, Block V-A; Neeraj imports, never edits):
   - export function isSingleEmoji(value): a string of at most 32 UTF-16
     units that matches /^\p{RGI_Emoji}$/v.
   - A comment explaining RGI_Emoji and the v flag, with runbook §1.4's
     accepted / rejected examples.
   - export const QUICK_REACTIONS = ['❤️','👍','😂','😮','😢','🙏'] (spec §13).

2. CREATE backend/src/utils/pagination.js. The messages and products modules
   each keep a private copy of the paging helpers, and their comment says a
   third module is the signal to share them. The posts module is that third
   module. Export:
   - PAGE_LIMIT_DEFAULT = 20, PAGE_LIMIT_MAX = 50, parsePageLimit(raw),
     readCursorParam(raw), isUuid(value) — same behaviour as the copies in
     messages.controller.js;
   - encodeCursor(value, id) → base64url of `${value}|${id}`;
   - decodeCursor(raw, kind), kind 'timestamp' | 'number' → { value, id } or
     null for anything malformed (two parts; the value parses as the kind;
     the id is a uuid). Same checks as decodeMessageCursor.
   Do NOT change messages or products to use it in this block.

3. CREATE backend/src/utils/moderation.js — the check of runbook §1.6:
   - export async function checkContent({ text, images }) — images is an
     array of Multer files ({ buffer, mimetype }), possibly empty.
   - POST https://api.openai.com/v1/moderations with model
     'omni-moderation-latest'. The input holds the text, plus one image entry
     per photo as a base64 data URL. Read OpenAI's moderation docs for the
     exact request shape and confirm data URLs are accepted. If they are
     not, STOP and tell me — don't switch approach on your own.
     Use the global fetch with a 3000 ms AbortController timeout. The key is
     process.env.OPENAI_API_KEY.
   - Return { outcome: 'publish' | 'nudge' | 'hold', support: boolean,
     categories: string[], scores: object | null, checked: boolean }.
   - The thresholds live in ONE exported object, MODERATION_THRESHOLDS:
       hold when ANY of: sexual/minors ≥ 0.20; harassment/threatening ≥ 0.70;
       hate/threatening ≥ 0.70; violence/graphic ≥ 0.80;
       illicit/violent ≥ 0.70; self-harm/intent ≥ 0.50;
       self-harm/instructions ≥ 0.50; sexual ≥ 0.85.
     support = true when a self-harm category caused the hold.
     nudge when not held and the result says flagged.
     Otherwise publish.
     categories = the category names that caused the hold or nudge.
   - If the key is missing, the call fails, times out or returns non-200:
     log ONE line "[moderation] check skipped: <reason>" and return
     { outcome: 'publish', support: false, categories: [], scores: null,
       checked: false }. Never throw. Never log the key or the post text.

4. CREATE backend/scripts/try-moderation.mjs: loads backend/.env the way
   seedDemo.js does, runs checkContent on these three texts and prints
   `"<text>"  → <outcome>` for each:
     "Good morning, campus!"
     "You are such an idiot, nobody likes you"
     "I will hurt you after class tomorrow"

5. utils/respond.js — add to RAISED_STATUS (names the database raises):
     POST_NOT_FOUND: 404, NOT_ALLOWED_HERE: 403, CANNOT_REPORT_OWN: 400,
     MESSAGE_DELETED: 400
   mapDbError matches names with includes(), so no name may be part of
   another. Check every new name against every existing one and tell me.

6. backend/API.md:
   a. Part 2 "posts module": REPLACE the whole Phase 0 section with the
      Phase 7 contract in runbook Appendix A — endpoints, the PostItem
      shape, the cursor rule and every error. Owner line: Neeraj (on loan
      from Vishwajeet for Phase 7).
   b. Part 2 "reports module": replace it with Appendix A's reports section.
   c. Part 1 messages: add Appendix A's two reaction routes and the gif /
      reactions fields, each marked "(Phase 7 Block V-C — not built yet)".
   d. The error-codes list: every name in Appendix B.
   e. "Gaps between Part 1 and Part 2": update the posts row, which still
      names the Phase 0 migrations 007/009.

7. File two entries:
   node scripts/changelog.mjs new vishwajeet "Ownership loan: posts module to Neeraj for Phase 7" --phase 7 --block V-A --for neeraj
     (what is lent: backend/src/modules/posts/*; until Phase 7 sign-off;
      the rules in runbook §2.2: banner unchanged, reviews still required,
      the database stays Vishwajeet's)
   node scripts/changelog.mjs new vishwajeet "Shared: moderation, emoji and pagination helpers; the Phase 7 API contract" --phase 7 --block V-A --for neeraj

HARD CONSTRAINTS
- Touch only backend/src/utils/*, backend/scripts/try-moderation.mjs,
  backend/API.md and the two changelog entries.
- No new npm packages.

VERIFY AFTER — report each
1. node --check on the three new utils.
2. The output of: cd backend && node scripts/try-moderation.mjs
3. The new RAISED_STATUS names and your substring check.
4. Remind me of checkpoint V-A.
```

## CC-V2 — The four migrations

```
Phase 7, Block V-B. Four migrations for the community, with a test script
for each. Read first: runbook §1.1–§1.8, §1.11, §1.12, Appendix A (the API
the database must serve) and Appendix B (error names).

Follow the style of the 6B migrations in supabase/migrations/:
- one transaction per file;
- a comment on every table, column and function;
- `set search_path = public, pg_temp` on every function;
- the business rules live in the database;
- errors are raised as `raise exception 'NAME' using errcode = 'P0001'`.

Rules for all four files:
- Create each with `supabase migration new <name>`, in this order:
  community_posts, reactions_and_reports, message_reactions_gifs,
  demo_usernames.
- New functions: security invoker unless they truly need definer (say
  why). Revoke execute from public, anon and authenticated; grant to
  service_role. The backend is the only caller, as in 6B.
- New tables: RLS on, revoke all from anon and authenticated, grant what
  the backend needs to service_role.
- Count characters with char_length (code points — runbook §1.12).

════ MIGRATION 1 — community_posts ════
1. universities.country_code char(2) not null default 'IN', check
   ^[A-Z]{2}$, with a comment. (Every existing campus is in India,
   including the demo campus.)
2. Rework public.posts. No code uses it yet; keep and convert any rows.
   - content → text not null default '', check char_length(content) <= 1000.
   - image_urls text[] not null default '{}'; copy the old image_url into
     it where present, then drop image_url.
   - New columns, each commented:
       scope (campus | country | global, default campus), country_code char(2),
       parent_post_id uuid references posts(id) on delete cascade,
       gif jsonb, is_demo boolean not null default false,
       reactions_total int not null default 0,
       reaction_counts jsonb not null default '{}',
       replies_count int not null default 0,
       hot_score double precision not null default 0,
       moderation_status text not null default 'active'
         check in (active, pending, under_review, removed),
       moderation_flagged boolean not null default false,
       moderation_scores jsonb, moderation_checked_at timestamptz,
       report_count int not null default 0, deleted_at timestamptz.
   - author_id and university_id not null, with foreign keys to users
     (on delete cascade) and universities if missing; created_at not null
     default now().
   - Checks:
       at most 3 photos;
       photos OR a GIF, never both;
       replies have no photos;
       a post has text, photos or a GIF;
       gif, when present, is an object with string provider, id and url.
   - An index for every feed query below, partial where it helps
     (top-level only, active, not deleted). Clear names.
3. BEFORE INSERT trigger on posts (one function):
   - Load the author's university_id, that campus's country_code and
     is_demo, and the author's created_at. Set new.university_id and
     new.is_demo from them, ignoring whatever the caller sent.
   - Top-level post: country_code = the author's country (so a country
     post can only go to your own country — §1.1). Keep scope as sent.
   - Reply (parent_post_id set): load the parent.
     · Missing, deleted, or not active → POST_NOT_FOUND.
     · The parent is itself a reply → NESTED_REPLY_NOT_ALLOWED.
     · The reply inherits scope and country_code from the parent.
     · Permission: campus parent → same university as the parent; country
       parent → the author's country = the parent's country_code; global →
       anyone. And the author's is_demo must equal the parent's.
       Otherwise → NOT_ALLOWED_HERE.
   - Rate limits (§1.5). Count the author's rows in the last hour,
     INCLUDING deleted ones:
       top-level campus ≥ 10, or top-level country + global together ≥ 5
         → RATE_LIMIT_POSTS;
       replies ≥ 30 → RATE_LIMIT_REPLIES.
     If the account is under 24 hours old, the limits are 5, 2 and 15.
     Keep the numbers as named constants at the top of the function.
   - Set the first hot_score of a top-level post with the §1.3 formula
     (no reactions, no replies, age 0), so new posts enter Hot at once.
4. Triggers that keep the parent's replies_count equal to its visible
   replies (active and not deleted): after insert, after update of
   deleted_at or moderation_status, after delete. Never below 0.
5. post_visibility(p_viewer uuid, p_post_id uuid) returns text, one of:
     'visible' | 'not_found' | 'deleted' | 'removed'.
   - deleted_at set → 'deleted'; moderation_status 'removed' → 'removed';
   - pending → 'visible' only to the author, otherwise 'not_found';
   - the viewer's world (is_demo) must equal the post's, else 'not_found';
   - campus scope → the viewer's university must equal the post's, else
     'not_found';
   - country and global scope → 'visible';
   - under_review → 'visible' (the apps show a cover).
   Also add two yes/no helpers that use exactly the same rules as the
   insert trigger, so the API never re-implements them in JavaScript:
   - can_reply_to_post(p_viewer, p_post_id) returns boolean — false for
     pending and under_review posts;
   - can_post_in_feed(p_viewer, p_scope, p_country) returns boolean —
     campus and global: true; country: only the viewer's own country.
6. Read functions. They ALL return the same flat columns: Appendix A's
   PostItem, plus hot_score for building cursors. viewer_reaction comes
   from post_reactions; is_mine compares the author to the viewer; author
   fields come from users and universities.
   - get_campus_feed(p_viewer, p_limit, p_cursor_time, p_cursor_id): top-level
     posts whose author's campus is the viewer's campus (ANY scope), active,
     not deleted, same world; newest first (created_at desc, id desc); the
     cursor means "strictly after (created_at, id)".
   - get_country_feed(p_viewer, p_country, p_sort, p_limit, p_cursor_score,
     p_cursor_time, p_cursor_id): scope 'country', that country_code, active,
     not deleted, same world. p_sort 'hot' → (hot_score desc, id desc);
     'new' → (created_at desc, id desc). Keyset on the matching pair.
   - get_global_feed(p_viewer, p_sort, p_limit, …same cursor params): scope
     'global', same rules.
   - get_post_item(p_viewer, p_post_id): one row when post_visibility says
     'visible', otherwise none.
   - get_post_replies(p_viewer, p_post_id, p_limit, p_cursor_time,
     p_cursor_id): active, not-deleted replies, oldest first (created_at asc,
     id asc), plus the viewer's own pending replies.
   - get_user_posts(p_viewer, p_author, p_limit, p_cursor_time, p_cursor_id):
     the author's top-level posts that the viewer may see (post_visibility
     'visible'), newest first; when the viewer IS the author, also pending
     and under_review.
   - count_new_campus_posts(p_viewer, p_since): how many posts
     get_campus_feed would show newer than p_since, excluding the viewer's
     own.
   - countries_for_viewer(p_viewer): rows (country_code, is_mine) — the
     country codes of active campuses in the viewer's world (real viewers:
     active non-demo campuses; demo viewers: the demo campus only).
7. refresh_hot_scores(): for active, not-deleted, top-level country and
   global posts from the last 7 days, set hot_score with the §1.3 formula.
   Schedule it with pg_cron as 'refresh-hot-scores', '*/5 * * * *'. Enable
   pg_cron the way Supabase's docs say (create extension …); it must work
   the same locally and in production. Make the scheduling safe to run twice
   (unschedule a job of the same name first).
   (Removing deleted posts after 90 days is NOT done here: their photos live
   in Storage, which SQL can't delete. The backend does it — CC-V3.)
8. supabase/seed.sql (LOCAL only):
   - a test campus "TU Munich (test)", country_code 'DE', is_active true,
     with one student lena.test / password123 (use the existing seed_user
     helper);
   - about 15 posts with fixed ids, using a uuid prefix not already used in
     seed.sql:
       · campus posts at IIITDM Kurnool and NIET by the seeded students —
         one longer than 6 lines, one with 3 photo URLs (reuse seeded product
         image URLs), one with a GIF object (any https URL);
       · 4 India-country posts;
       · 4 Global posts, one by lena.test;
       · 5 one-level replies.
   - Spread created_at over the last 3 days.

════ MIGRATION 2 — reactions_and_reports ════
1. post_reactions: post_id (→ posts, on delete cascade), user_id (→ users,
   on delete cascade), emoji text not null check char_length between 1 and
   16, created_at, updated_at; primary key (post_id, user_id).
2. A trigger keeps posts.reactions_total and posts.reaction_counts right on
   insert, on update of emoji, and on delete: add to or subtract from that
   emoji's key, remove keys that reach 0, never go below 0.
3. react_to_post(p_post_id, p_user_id, p_emoji text) returns
   (reactions_total, reaction_counts, viewer_reaction):
   - post_visibility must be 'visible', and the post must not be pending,
     else POST_NOT_FOUND;
   - p_emoji null → delete the caller's row; otherwise insert … on conflict
     (post_id, user_id) do update the emoji and updated_at.
   (The backend checks the emoji is real with isSingleEmoji; the length
   check is the backstop.)
4. reports:
     id uuid pk default gen_random_uuid(),
     reporter_id (→ users, on delete cascade),
     target_type text check in (post, user, product, comment, message),
     target_id uuid not null,
     reason text check in the 11 values of spec §7,
     details text check char_length <= 500,
     reporter_in_audience boolean not null,
     status text not null default 'open' check in (open, upheld, dismissed),
     created_at, reviewed_at,
     unique (reporter_id, target_type, target_id).
   Comment that status is set by the Phase 9 admin screen and is how false
   reports are tracked (§1.7).
5. create_report(p_reporter, p_target_type, p_target_id, p_reason,
   p_details): Phase 7 handles target_type 'post' only.
   - The post must be 'visible' to the reporter, else POST_NOT_FOUND.
   - The reporter must not be the author, else CANNOT_REPORT_OWN.
   - reporter_in_audience: campus post → same campus; country post → the
     reporter's country = the post's country_code; global → true.
   - Insert the row. A duplicate raises unique_violation, which the
     backend maps to DUPLICATE.
6. AFTER INSERT trigger on reports (target_type 'post'):
   - recount the post's distinct reporters into posts.report_count;
   - then apply the cover rules (§1.7). Each rule counts its own reports:
       child_safety, counting everyone ≥ 2;
       sexual_content + violence + self_harm, counting everyone ≥ 3;
       all other reasons, counting only reporter_in_audience: ≥ 5 on a
         campus post, ≥ 10 on a country or global post.
   - If any rule is met and the post is 'active', set it to 'under_review'.

════ MIGRATION 3 — message_reactions_gifs ════
1. messages.reactions jsonb not null default '{}' (keys: user ids; values:
   one emoji each; at most the two people in the chat) and messages.gif
   jsonb (the same shape as posts.gif). Comments.
2. Replace 6B's check messages_deleted_has_no_content with:
   deleted_at is null or (content = '' and gif is null and reactions = '{}').
   Add: content <> '' or gif is not null or deleted_at is not null.
3. react_to_message(p_message_id, p_user_id, p_emoji text) returns
   public.messages:
   - the caller must be the sender or the receiver, else MESSAGE_NOT_FOUND;
   - a deleted message → MESSAGE_DELETED;
   - null removes the caller's key, anything else sets it.
   ONE update, so Realtime delivers it (runbook §1.4).
4. Replace delete_message_for_everyone (6B) so the tombstone also clears
   gif and reactions. Nothing else changes.
5. Replace fill_message_reply (6B) so reply_preview = 'GIF' when the quoted
   message has no text but has a GIF.
6. Replace get_user_inbox (6B) so it also returns last_message_has_gif
   boolean after the existing 11 columns. Nothing else changes. Drop,
   recreate and re-grant it as 6B did.

════ MIGRATION 4 — demo_usernames ════
1. Rename every demo-campus user whose username is set and doesn't start
   with 'demo.' to 'demo.' || substr(md5(id::text), 1, 8). Delete the
   username_history rows of demo-campus users (frees their old names).
2. A trigger BEFORE INSERT OR UPDATE OF username, university_id ON users,
   when username is not null:
   - demo campus → the name must start with 'demo.', else USERNAME_RESERVED;
   - real campus → the name must not match '^demo[._-]' (ignoring case),
     else USERNAME_RESERVED.
   Look at how the existing username triggers are declared (some run when
   GoTrue inserts users, which needs SECURITY DEFINER — a lesson from
   Phase 2) and declare this one the same way. Say where it runs relative
   to them.
3. Update is_username_available() so names matching '^demo[._-]' are
   unavailable to real users, mirroring the trigger. Show me the diff.
4. generate_demo_username() returns text:
   - 'demo.' + an adjective + '.' + an animal, from two small lists of
     about 40 short lowercase words each, always ≤ 25 characters;
   - if the name is taken, add a dot and two digits; try until it's free;
   - it obeys every existing username rule. Grant to service_role only.

════ TESTS — supabase/tests/phase7/01_…sql to 04_…sql ════
One file per migration, each inside begin … rollback, using the seeded
users. Every check either raises a NOTICE ending in "ok" or fails an
assert. At least:
- 01:
  · posting fills university, country and is_demo;
  · a country post goes to the author's country;
  · a reply inherits its parent's scope;
  · a nested reply is refused;
  · a NIET student can reply to an India post; lena.test can SEE it but
    gets NOT_ALLOWED_HERE when replying; a demo user can't reply to a real
    post;
  · the 11th campus post in an hour is refused;
  · a 1,001-character post is refused; photos + GIF together are refused;
  · replies_count follows inserts and soft deletes;
  · the campus feed shows its campus's posts of every scope and never demo
    posts;
  · New and Hot both page with the cursor with no repeats and no gaps;
  · after refresh_hot_scores, a newer active post outranks an older quiet
    one.
- 02:
  · one reaction per person; changing and removing keep reaction_counts
    right;
  · reacting to an invisible post → POST_NOT_FOUND;
  · reporting your own post → CANNOT_REPORT_OWN; reporting twice →
    unique_violation;
  · 2 child_safety reports cover a post; 3 violence reports do too;
  · 4 spam reports on a campus post don't, the 5th does;
  · spam reports from lena.test on an India post don't count toward 10.
- 03:
  · react_to_message by a participant sets and removes; by an outsider →
    MESSAGE_NOT_FOUND; on a tombstone → MESSAGE_DELETED;
  · delete_message_for_everyone clears gif and reactions;
  · a reply to a GIF message gets reply_preview 'GIF';
  · get_user_inbox returns last_message_has_gif.
- 04:
  · generate_demo_username returns 'demo.…';
  · a real user can't take demo.x, demo-x or demo_x;
  · a demo user can't take a name without 'demo.';
  · 'democrat' is still fine for a real user.
- End every file with privilege checks: anon and authenticated can't run
  the new functions or read the new tables.

HARD CONSTRAINTS
- Never run supabase db push, supabase link, or anything against
  *.supabase.co. Production is pushed by hand (runbook V-B).
- psql only against the local database.
- Do not touch backend/, frontend/ or mobile/.
- If a migration fails to apply, show me the error and your fix BEFORE you
  apply the fix.

VERIFY AFTER — report each
1. The four migration file names, with one paragraph each on what it does.
2. supabase db reset finished without an error.
3. The NOTICE and ERROR lines from all four test files.
4. The result of: select jobname, schedule from cron.job;  (one job)
5. Anything you decided that this prompt didn't specify.
```

## CC-V3 — Messages: reactions and GIFs; demo usernames; campus countries

```
Phase 7, Block V-C. Backend changes in my modules. The database side is in
(V-B). Read runbook §1.4 and §1.11, Appendix A (messages, auth,
universities), and backend/src/modules/messages/ as 6B left it.

Everything stays BACKWARD COMPATIBLE: today's website and app must keep
working before they are updated.

1. messages — reactions (requireAuth, in messages.routes.js):
   PUT /api/messages/:id/reaction, body { emoji }
   - 400 INVALID_FORMAT if :id isn't a uuid;
   - 400 INVALID_EMOJI unless isSingleEmoji(emoji) (utils/emoji.js);
   - supabase.rpc('react_to_message', { p_message_id, p_user_id: req.user.id,
     p_emoji }); on error → mapDbError (MESSAGE_NOT_FOUND 404,
     MESSAGE_DELETED 400);
   - 200 { message: data }.
   DELETE /api/messages/:id/reaction — the same, with p_emoji null.

2. messages — a GIF in sendMessage:
   - Accept an optional gif: an object with string provider ('klipy'), id,
     url (https), and optional preview_url (https), width and height
     (positive integers). Anything else → 400 INVALID_GIF. Store only those
     keys.
   - content may be empty WHEN a gif is present. Without a gif, today's
     empty-message rule stays. The 2000 limit stays, counted with
     [...content].length (runbook §1.12).
   - The demo auto-responder answers a GIF-only message the same way it
     answers text.

3. getChatHistory and getInbox: no change expected. Rows now carry
   reactions and gif, and inbox rows carry last_message_has_gif. Confirm by
   reading the code, and say so.

4. auth:
   - demoLogin: set the new user's username from
     supabase.rpc('generate_demo_username'), in the same upsert that creates
     the users row. Change nothing else in the flow.
   - completeOnboarding: for demo users, ignore a username in the body
     (keep the generated one) instead of failing.

5. university: GET /api/universities also returns country_code.

6. backend/scripts/seedDemo.js. Its 25 community posts were written for the
   old posts table. Update them to the Phase 7 shape:
   - a mix of campus, country and global scope;
   - image_urls instead of image_url;
   - don't send university, country or is_demo — the trigger fills them;
   - add some replies and reactions between personas so the demo community
     looks alive.
   Make re-running safe (fixed ids and on conflict do nothing, or
   delete-then-insert of demo-tenant posts only). Then tell me whether it is
   safe to run against production with the SEED_ALLOW_REMOTE opt-in, and
   give me the exact command.

7. Two background jobs, in utils/cronJobs.js (mine), next to the demo
   clean-up:
   - every 10 minutes — re-check posts the moderation service couldn't check
     (runbook §1.6). Add recheckUncheckedPosts() to utils/moderation.js:
     take up to 20 posts from the last 24 hours with moderation_checked_at
     null and status 'active'; fetch their photos from their public URLs as
     buffers; run checkContent; save moderation_checked_at and
     moderation_scores; set status 'pending' when the outcome is 'hold'. If
     the service is still down, leave them for the next run.
   - once a day — remove posts deleted more than 90 days ago (runbook
     §1.8): first delete their photos from the 'posts' storage bucket
     through the Storage API, then delete the rows (replies and reactions
     go with them, by cascade).
   Both log one line each run and never crash the server.

8. backend/API.md Part 1: the two reaction routes, the gif field on send,
   history and inbox, reactions on message rows, last_message_has_gif,
   country_code on universities, and the username demo-login now returns.
   Remove the "(not built yet)" marks that V-A added.

9. File the entry Neeraj builds the website from:
   node scripts/changelog.mjs new vishwajeet "Messages: reactions and GIFs; demo usernames; campus countries (V-C)" --phase 7 --block V-C --for neeraj
   Under "What NOT to do yet", write: "A reaction arrives as a Realtime UPDATE
   of the message row (its reactions field). Merge it by id, exactly as for
   tombstones."

HARD CONSTRAINTS
- Touch only backend/src/modules/messages/*,
  backend/src/modules/auth/auth.controller.js,
  backend/src/modules/university/*, backend/src/utils/cronJobs.js,
  backend/src/utils/moderation.js, backend/scripts/seedDemo.js,
  backend/API.md and the changelog.
- Do not touch backend/src/modules/posts/* (on loan to Neeraj) or reports/*.
- No SQL.

VERIFY AFTER — report each
1. node --check on every changed file.
2. The route list in messages.routes.js, in order.
3. Remind me of the curl checks in checkpoint V-C.
```

## CC-V4a — The app community, part 1: the tab, the feeds, the post card

```
Phase 7, Block V-D, part 1 of 3. The Community tab: the switcher and
countries, the three feeds, the post card and reactions on the card. No
composer (part 2) and no post page (part 3) yet.

Read first: docs/design/COMMUNITY_SPEC.md §1, §3, §5.1, §5.3, §9, §12, §13;
backend/API.md "posts module (Phase 7)"; runbook §1.1, §1.3, §1.4, §1.12.

1. src/lib/community.ts (new):
   - spec §13's constants, with the same names and values;
   - codePointLength(text) = [...text].length;
   - formatCount(n) → 999, 1.2K, 12K, 1.2M;
   - flagEmoji(code) from the two letters;
   - topReactions(counts, n = 3).
2. src/types/index.ts: PostItem exactly as Appendix A; FeedPage
   { items, next_cursor, can_post? }; Country { code, name, is_mine };
   GifRef.
3. src/theme/index.ts: the five tokens of spec §12.
4. Hooks (TanStack Query, following the useMarketplace pattern; every call
   goes through src/lib/api.ts):
   - useCountries() → GET /api/posts/countries.
   - useFeed(kind: 'campus' | 'country' | 'global', { country, sort }) →
     useInfiniteQuery on the matching endpoint. pageParam = next_cursor,
     echoed back exactly as received, never parsed (§1.3). The query key
     includes kind, country and sort.
   - useReactToPost() → PUT / DELETE /api/posts/:id/reaction, optimistic:
     update viewer_reaction, reactions_total and reaction_counts on every
     cached page that holds the post; roll back on error; then apply the
     server's numbers.
5. app/(tabs)/_layout.tsx: add the Community tab between Marketplace and
   Messages, with the Feather "users" icon. Marketplace stays first and is
   still where the app opens.
6. app/(tabs)/community.tsx:
   - the switcher (spec §1.2): [Campus] [flag + country ▾]. The second
     segment opens the country sheet (spec §1.3: your country first, Global
     second, then A–Z, the selected one ticked);
   - the Hot · New switch on the country / Global side (default Hot);
   - the feed: a FlashList with pull to refresh, infinite loading,
     skeletons while loading, spec §9's empty texts, and the view-only
     banner (spec §1.4) at the top when can_post is false;
   - remember the chosen country and sort while the app is open (not
     across restarts).
7. src/components/community/PostCard.tsx — memoised, so a card re-renders
   only when its own data changes. Exactly spec §3:
   - the author line (tap → app/profile/[id]);
   - the scope chip in the campus feed;
   - text with the 6-line fold and "See more" (expands in place), links
     tappable;
   - photos in the 1 / 2 / 3 layouts, opening the existing
     ZoomableImageViewer;
   - a GIF via expo-image: plays while visible, paused off screen (use
     FlashList viewability);
   - the React button; the 💬 count (tap → router.push('/post/<id>'), a
     placeholder screen until part 3); the ⋯ button (part 3 fills its menu).
8. src/components/community/ReactionBar.tsx — spec §5.1's quick bar, with
   the six emojis and ⊕ (⊕ does nothing until part 3):
   - tap React toggles ❤️ (DEFAULT_REACTION);
   - long-press React opens the bar (gesture-handler LongPress, with the
     chat's LONG_PRESS_MS);
   - choosing your current emoji removes it; another emoji replaces it;
   - the pop animation with Reanimated, skipped when reduced motion is on.
9. src/components/community/ReactionSummary.tsx — spec §5.3: the top 3 plus
   the total, hidden at 0. Tapping it does nothing until part 3.

HARD CONSTRAINTS
- Theme tokens only, no hex in screens. Fetch only through hooks.
- Don't change how Marketplace, Messages or Profile behave.
- Do not touch backend/, frontend/ or supabase/.

VERIFY AFTER — report each
1. npx tsc --noEmit passes.
2. Every file created or changed.
3. Remind me of checkpoint V-D4a.
```

## CC-V4b — The app community, part 2: composing

```
Phase 7, Block V-D, part 2 of 3. The compose screen and every result of
posting. Read: spec §2 (all) and §6; runbook §1.6, §1.9, §1.10, §1.12;
Appendix A "POST /api/posts".

1. app/compose.tsx, opened as a modal route:
   router.push('/compose?feed=campus|country|global&country=IN&parent=<id>').
   It shows spec §2.2:
   - "Posting as @username · campus", from the profile;
   - a growing text input: the limit is 1,000 by codePointLength; the
     counter shows at 100 or fewer left; Post is disabled over the limit or
     when there is nothing to post;
   - the destination chip;
   - the photo button: expo-image-picker, several at once, at most 3,
     JPEG / PNG / WebP, each ≤ 5 MB. Build the multipart parts with
     toUploadFile from src/lib/upload.ts;
   - the GIF button;
   - previews, each with an ✕, and the photos-or-GIF rule with the spec's
     hint text.
   With parent set it is a reply: no photo button, and the grey text
   "Reply to @username…".
2. src/components/community/GifPicker.tsx (spec §6): a bottom sheet (React
   Native Modal, the AvatarSheet pattern) with:
   - a search box, trending GIFs first, 2 columns, infinite loading, a
     300 ms debounce, and "Powered by KLIPY" at the bottom;
   - tapping a GIF returns a GifRef { provider: 'klipy', id, url,
     preview_url, width, height }.
   It calls KLIPY directly from the app with
   process.env.EXPO_PUBLIC_KLIPY_API_KEY (client-side, by KLIPY's rules —
   runbook §1.9). Read KLIPY's API docs for the search and trending
   endpoints and pick a small animated WebP or GIF rendition for expo-image
   (not MP4). Keep every KLIPY call in one file, src/lib/klipy.ts. With no
   key, the picker shows "GIFs aren't available right now."
3. useCreatePost(): a multipart POST /api/posts with content, scope,
   parent_post_id, gif (as a JSON string), images[], and confirm=true when
   re-sending after a nudge. Handle every result in spec §2.3:
   - 201 → close; put the post at the top of the matching feed's cache (and
     into the parent's replies for a reply); add 1 to the parent's
     replies_count;
   - 422 MODERATION_NUDGE → the "Post this?" dialog (the existing
     ConfirmDialog). Edit keeps everything; Post anyway re-sends with
     confirm=true;
   - 202 held → close with the toast (AppToast), or show the support card
     (spec §2.4) when support is true: tel:14416 and
     https://findahelpline.com, via Linking;
   - 429 / 403 / 400 → the inline messages in spec §2.3; a network error →
     the toast.
   Never clear the text unless the result is 201 or 202.
4. community.tsx: the closed composer row (spec §2.1) at the top of each
   feed where you can post (campus always; your own country; Global).

HARD CONSTRAINTS
- Theme tokens only; fetch through hooks.
- Do not touch backend/, frontend/ or supabase/.

VERIFY AFTER — report each
1. npx tsc --noEmit passes.
2. Which KLIPY endpoints and rendition you used, and why.
3. Remind me of checkpoint V-D4b.
```

## CC-V4c — The app community, part 3: the post page and everything around it

```
Phase 7, Block V-D, part 3 of 3. The post page and replies, the full emoji
picker, the breakdown, reporting, deleting, the Posts tabs and the "new
posts" pill. Read: spec §3.1, §4, §5.2, §5.4, §7, §8, §10; runbook §1.7,
§1.8.

1. From mobile/, install the emoji picker: npx expo install rn-emoji-keyboard
   If it doesn't install cleanly on SDK 57, STOP and tell me. Don't choose
   another library on your own.
2. ⊕ in ReactionBar opens the full picker (search, frequently used,
   categories), styled as spec §5.2. The chosen emoji becomes the reaction.
3. ReactionBreakdownSheet.tsx (spec §5.4): the title "N reactions"; a grid
   of emoji + count pills, 3 per row, biggest first, ⊕ first; counts only.
   Tapping ReactionSummary opens it.
4. app/post/[id].tsx:
   - data: usePost → GET /api/posts/:id; usePostReplies → GET
     /api/posts/:id/replies (useInfiniteQuery, oldest first, with a "Load
     more replies" button, not infinite scroll);
   - the parent card is larger (text 17/26); replies use a compact
     PostCard (32 avatar);
   - the pinned reply bar opens compose with parent=<id>. When can_reply is
     false, it reads "Only students in <country> can reply.";
   - 404 → "This post isn't available."; 410 POST_DELETED → "This post was
     deleted."; 410 POST_REMOVED → spec §3.1's text; under review → the
     cover with "View anyway".
5. The ⋯ menu: Report (everyone except the author) and Delete (the author
   only). Delete → ConfirmDialog with the spec's text → DELETE
   /api/posts/:id → remove the post from every cached feed and page.
6. ReportSheet.tsx — exactly spec §7:
   - the 11 reasons in order; optional details (500); the warning paragraph
     always visible; the self-harm line; Report disabled until a reason is
     picked;
   - POST /api/reports;
   - 201 → the toast, and hide the post from this user's cached feeds;
     400 DUPLICATE → "You've already reported this post."; anything else →
     "Couldn't send. Try again."
7. Posts tabs (spec §10), both from GET /api/posts/by-user/:userId with
   infinite loading:
   - app/(tabs)/profile.tsx: a Posts tab after Watchlist;
   - app/profile/[id].tsx: a Posts section.
   Your own tab shows the "Being checked" and "Under review" labels.
8. The "new posts" pill (spec §8) on the campus feed:
   - poll GET /api/posts/feed/campus/new-count?since=<the newest created_at
     shown> every NEW_POSTS_POLL_MS, only while the Community tab is focused
     and the app is in the foreground (AppState);
   - tap → scroll to the top and refetch;
   - never insert posts on its own.

HARD CONSTRAINTS
- Theme tokens only; fetch through hooks.
- Do not touch backend/, frontend/ or supabase/.

VERIFY AFTER — report each
1. npx tsc --noEmit passes.
2. The rn-emoji-keyboard version installed.
3. Remind me of checkpoint V-D4c.
```

## CC-V5 — The app: reactions and GIFs in messages

```
Phase 7, Block V-E. Reactions and GIFs in the app's chat. Read spec §5.5
and §6, runbook §1.4, and the V-C changelog entry.

1. Types: Message gains reactions?: Record<string, string> and
   gif?: GifRef | null. InboxItem gains last_message_has_gif?: boolean.
2. useReactToMessage(contactId, productId): PUT / DELETE
   /api/messages/:id/reaction, with an optimistic update of the message in
   the chat cache (updateEveryPage + replaceMessage), rolled back on error.
3. RealtimeContext's handleUpdate already replaces the row. Confirm that
   reactions and gif arrive with it. If nothing needs changing, say so.
4. app/chat/[contactId].tsx: a long-pressed bubble also shows the quick bar
   (the community ReactionBar, compact) ABOVE MessageActionMenu, in the
   space that menu already keeps for it (read its comment).
   - Choosing an emoji reacts and closes both.
   - ⊕ opens rn-emoji-keyboard.
   - Never on tombstones, pending or failed messages, or in multi-select
     mode.
5. The pill under the bubble (spec §5.5):
   - it overlaps the bubble's bottom edge by 8, on the inner side;
   - it shows ❤️ 😂, or ❤️ 2 when both chose the same emoji;
   - tapping it opens a small sheet: "You  <emoji>  · Tap to remove" and
     "<first name>  <emoji>".
6. GIFs:
   - a GIF button in the chat composer opens the community GifPicker;
     picking one sends it AT ONCE as its own message: { receiver_id,
     product_id, content: '', gif }. Any typed text stays in the box;
   - the GIF bubble: expo-image, at most 240 wide, keeping its aspect
     ratio, rounded like the bubble, with the time and ticks under it;
   - the inbox preview reads "GIF" when last_message_has_gif is true and
     the text is empty;
   - a reply quoting a GIF message reads "GIF" (the server sends
     reply_preview 'GIF').
7. Change nothing about paging, unread, read-on-sight, the jump button or
   multi-select.

HARD CONSTRAINTS
- Theme tokens only. Do not touch backend/, frontend/ or supabase/.

VERIFY AFTER — report each
1. npx tsc --noEmit passes.
2. How the quick bar is positioned relative to MessageActionMenu.
3. Remind me of checkpoint V-E.
```

## CC-V6 — The app: demo onboarding

```
Phase 7, Block V-F. The demo account's onboarding. Read spec §11 and
runbook §1.11.

1. app/(auth)/onboarding.tsx, for demo users (isDemoUser):
   - hide the username input; show the generated handle read-only, with
     the line "Demo accounts get a name automatically.";
   - saving onboarding doesn't send a username;
   - "Skip for now" stays.
2. Wherever a real user picks or changes a username (UsernameField), a
   "demo." name must show as not available. That comes from the server's
   availability check after V-B, so try it first: if it already works,
   change nothing and say so.

HARD CONSTRAINTS
- Do not touch backend/, frontend/ or supabase/.

VERIFY AFTER — report each
1. npx tsc --noEmit passes.
2. Remind me of checkpoint V-F.
```

---
# TRACK 3 — NEERAJ, MANUAL STEPS

Five building blocks and five rounds of testing (T1–T5). The testing decides whether the
phase passed, and it's yours: the website **and** the phones.

## Block N-0 — The package and setup (Day 1, first thing)

**Step 1 — commit the package. Vishwajeet waits for this, so do it first.**

```bash
cd ~/path/to/yahora
git checkout main && git pull origin main
git checkout -b n-0-package
unzip -o ~/Downloads/phase7-package.zip
git status --short
```

`git status` must show exactly two new files, and nothing else:

```
?? docs/design/COMMUNITY_SPEC.md
?? docs/runbooks/PHASE_7_RUNBOOK.md
```

Then:

```bash
git add docs/design docs/runbooks
git commit -m "docs: Phase 7 package — runbook and community spec"
git push -u origin n-0-package
```

Open a PR from `n-0-package` into `main` and merge it (docs only — no review needed). Tell
Vishwajeet it's in.

**Step 2 — setup.**

```bash
git checkout main && git pull origin main
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd mobile && npm install && cd ..
```

When Vishwajeet sends you the KLIPY key (V-0), add it to `frontend/.env`:

```
VITE_KLIPY_API_KEY=…the key…
```

Then restart the website (`npm run dev` in `frontend/`). Vite only reads `.env` when it
starts.

## Block N-A — The design review, with Vishwajeet (Day 1, ~12:00, 30 minutes)

Open `docs/design/COMMUNITY_SPEC.md` together. Agree on these five, because each one is a
product decision and not just a look:

| # | Decision | Where |
|---|---|---|
| 1 | The six quick reactions, and their order (❤️ 👍 😂 😮 😢 🙏) | spec §5.1 |
| 2 | The warning paragraph in the report form | spec §7 |
| 3 | The support card's wording and helplines | spec §2.4 |
| 4 | The view-only banner's wording | spec §1.4 |
| 5 | The grey text in each composer | spec §2.1 |

**If you change anything, change the spec file first**, commit it, and only then build. Every
prompt builds from the spec.

## Block N-D, part 1 — The website community, with sample data (Days 1–3)

The posts API only exists from day 7, so you start with **sample data**: a file of made-up
posts shaped exactly like the API's answers. When the API is ready (part 2), you swap the file
for real requests and the screens don't change.

```bash
git checkout main && git pull origin main
git checkout -b n-d-web-community-1
```

Read §1.1, §1.12 and §1.13, then the spec §1, §3 and §5. Run **CC-N4a**.

**👁️ CHECKPOINT N-D1** — `http://localhost:3000/community`, logged in as `arjun.mehta`:
1. The navbar shows **Community** where **Hot** was. Opening `/feed` or `/hot` lands on
   `/community`.
2. On a laptop-sized window: two panels. Drag the divider: both resize, and neither gets
   narrower than about 320 px. Double-click the divider: back to half and half.
3. **‹** collapses the left panel to a thin bar. Expand it again. **⤢** opens the right panel
   full width; press it again to restore.
4. Reload the page: the layout is how you left it.
5. Make the window narrow (under 1024 px): the switcher replaces the panels.
6. Click ♡ on a sample post: it becomes ❤️. Hover ♡ for a moment: the quick bar. **⊕**: the
   full picker; search `fire` and pick 🔥.
7. Click a reaction summary: the breakdown popover with its grid of counts.
8. Pick **Germany** in the dropdown: the view-only banner shows in place of the composer.

Commit and merge it (website — no review needed). The sample data stays until part 2.

## Block N-B — The posts API (Days 4–6)

⛔ **The posts module belongs to Vishwajeet and is on loan to you** (§2.2). The prompts say so.
Don't change its `OWNER:` banner.

**Before you start:** pull `main` (V-A and V-B are in) and reset your local database:

```bash
git checkout main && git pull origin main
supabase db reset
git checkout -b n-b-posts-api
```

Read §1.1–§1.6 and §1.10, the posts section of `backend/API.md`, and `backend/src/utils/`
(the three new helpers). Run **CC-N1** (reading), then **CC-N2** (posting, deleting, reacting).

**👁️ CHECKPOINT N-B — with curl, against your local API**

Start the backend (`cd backend && npm run dev`). Paste once:

```bash
API=http://localhost:5001/api
login() {
  curl -s -X POST "$API/auth/login-password" -H "Content-Type: application/json" \
    -d "{\"identifier\":\"$1\",\"password\":\"password123\"}" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['session']['access_token'])"
}
ARJUN=$(login arjun.mehta); SNEHA=$(login sneha.gupta); LENA=$(login lena.test)
post() {  # post <token> <scope> <text> [parent_id]
  curl -s -X POST "$API/posts" -H "Authorization: Bearer $1" \
    -F "scope=$2" -F "content=$3" ${4:+-F "parent_post_id=$4"}
}
```

`-F` sends a form field, just like a form with a photo would. The API accepts it the same way.

Then, one at a time:

```bash
# 1. The campus feed: seeded posts, newest first
curl -s "$API/posts/feed/campus" -H "Authorization: Bearer $ARJUN" | python3 -m json.tool | grep -m3 '"content"'

# 2. Arjun posts in the India feed, and keeps the new post's id
PID=$(post $ARJUN country "Any hackathons in November?" | python3 -c "import sys,json; print(json.load(sys.stdin)['post']['id'])"); echo $PID
#    → a uuid

# 3. Sneha (NIET, also in India) replies
post $SNEHA country "Smart India Hackathon!" $PID | python3 -m json.tool | grep -m1 '"parent_post_id"'
#    → the PID

# 4. Lena (Germany) tries to reply to the India post
post $LENA country "Hello from Munich" $PID
#    → {"error":"NOT_ALLOWED_HERE"}

# 5. … but she can react to it
curl -s -X PUT "$API/posts/$PID/reaction" -H "Authorization: Bearer $LENA" \
  -H "Content-Type: application/json" -d '{"emoji":"😮"}'
#    → "viewer_reaction":"😮" and "reactions_total":1

# 6. A nudge: nothing is saved
post $ARJUN campus "You are such an idiot, nobody likes you"
#    → {"error":"MODERATION_NUDGE", "categories":[…]}   (if it posts instead, see note below)

# 7. A hold
post $ARJUN campus "I will hurt you after class tomorrow" | python3 -m json.tool | grep -E '"held"|"moderation_status"'
#    → "held": true and "moderation_status": "pending"

# 8. Too long
post $ARJUN campus "$(python3 -c 'print("a"*1001)')"
#    → {"error":"CONTENT_TOO_LONG", "max":1000}

# 9. The rate limit: 10 campus posts in an hour, then refused
for i in $(seq 1 11); do post $ARJUN campus "Test post $i" | grep -o '"error":"[A-Z_]*"'; done
#    → the first lines print nothing (posted); the last prints "error":"RATE_LIMIT_POSTS"
#      (the earlier posts in this checkpoint count too, so it may refuse sooner)

# 10. Arjun deletes his India post; opening it now says deleted
curl -s -X DELETE "$API/posts/$PID" -H "Authorization: Bearer $ARJUN"
curl -s "$API/posts/$PID" -H "Authorization: Bearer $SNEHA"
#    → {"id":…,"deleted":true}   then   {"error":"POST_DELETED"}
```

> **About 6 and 7.** The moderation service makes the decision, not us. If 6 posts instead of
> nudging, that's acceptable: the numbers can be tuned. If 7 publishes, tell Vishwajeet before
> you merge — either the key isn't set in `backend/.env`, or the thresholds need a look.

Run `supabase db reset` afterwards. It puts the database back exactly as the seed made it, and
undoes the rate-limit test.

Open **one** backend PR from `n-b-posts-api`. **Vishwajeet reviews it (day 7)**, then merge.
File the entry CC-N1 and CC-N2 ask for: Vishwajeet builds the app from it.

## Block N-C — The reports API (Days 6–7)

On a new branch, `n-c-reports-api`, run **CC-N3**.

**👁️ CHECKPOINT N-C**

```bash
SEEDED=$(curl -s "$API/posts/feed/campus" -H "Authorization: Bearer $ARJUN" | python3 -c "import sys,json; print(json.load(sys.stdin)['items'][0]['id'])")
report() { curl -s -X POST "$API/reports" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d "{\"target_type\":\"post\",\"target_id\":\"$2\",\"reason\":\"$3\"}"; }

report $ARJUN $SEEDED spam        # → {"reported":true}   (unless the post is Arjun's own: then CANNOT_REPORT_OWN)
report $ARJUN $SEEDED spam        # → {"error":"DUPLICATE"}
report $ARJUN $SEEDED rude        # → {"error":"INVALID_FORMAT", …}
```

PR → **Vishwajeet reviews (day 8)** → merge.

## T1 — The API on production (Day 8)

Once N-B and N-C are merged and Render shows **Live**, run checks 1, 2, 3 and 5 from checkpoint
N-B against **production**:
- set `API=https://yahora-yst4.onrender.com/api`;
- log in as your own test accounts (the seeded ones exist only locally);
- use a campus-mate's account for the reply in check 3.

Then delete your test post (check 10). Write the results in your T1 changelog entry.

## Block N-D, parts 2 and 3 — The real website community (Days 8–12)

| Prompt | Days | What |
|---|---|---|
| **CC-N4b** | 8–10 | The real API instead of sample data, the composer, the GIF picker, every result of posting |
| **CC-N4c** | 11–12 | The post page and replies, reporting, deleting, the Posts tabs, the "new posts" pill |

Use one branch per prompt (`n-d-web-community-2`, `-3`).

**👁️ CHECKPOINT N-D2** — the same steps as Vishwajeet's V-D4b (Track 1), on the website:
- "Posting as…"; the counter; 3 photos or a GIF, never both;
- the nudge with **Edit** keeping the text;
- the hold message;
- the 11th post refused, with the text kept;
- the GIF picker shows **Powered by KLIPY**.

**👁️ CHECKPOINT N-D3** — the same steps as V-D4c, on the website:
- the post page with **Load more replies**;
- replying, including the view-only case as `lena.test`;
- reporting: the warning, the toast, "already reported";
- deleting your own post;
- the Posts tab on Dashboard and on a profile;
- the "new posts" pill appearing within 30 seconds when someone else posts.

### M1 go-live — Day 13

1. Make sure Netlify has `VITE_KLIPY_API_KEY`: Netlify → your site → **Site configuration →
   Environment variables**. Add it if it's missing. A Netlify build only reads variables that
   existed when it started.
2. Merge the last N-D branch. Wait for Netlify to show **Published**.
3. On `https://yahora.netlify.app/community`, logged in as yourself: post, react, reply, and
   open the GIF picker.
4. File: `node scripts/changelog.mjs new neeraj "M1 live: the community on the website" --phase 7 --block T2 --for vishwajeet`

## T2 — The community, everywhere (Days 13–14)

**Set up:** pull `main` (Vishwajeet's app blocks are merged). On your laptop run
`cd mobile && npm install && npx expo start`, and open the app on each phone with Expo Go. It
uses your local API by itself. Use the local website on your laptop, and on your phone's
browser use the Network address Vite prints.

Mark each cell ✅ or ❌. A phone you don't have is run by whoever has it (§2.3).

| # | Do this | Expect | Web laptop | Web phone | POCO | OPPO | Samsung |
|---|---|---|---|---|---|---|---|
| 1 | Open Community | laptop: two panels · otherwise: the switcher · app: 4 tabs, still opens on Marketplace | | | | | |
| 2 | Country dropdown, Global, Hot · New | your country first, then Global; the order changes with the switch | | | | | |
| 3 | Post a long text in Campus | appears at the top; folds after 6 lines with See more; the counter appears at 100 left | | | | | |
| 4 | Post 3 photos | the 3-photo layout; tapping one opens the viewer | | | | | |
| 5 | Post a GIF | it plays; the picker shows Powered by KLIPY | | | | | |
| 6 | Post `You are such an idiot, nobody likes you` | the "Post this?" dialog; Edit keeps the text | | | | | |
| 7 | Post `I will hurt you after class tomorrow` | the "being checked" message; the post shows only on your Posts tab, as Being checked | | | | | |
| 8 | Post `I don't want to be alive anymore` *(a test of the support card only)* | the support card with Tele-MANAS 14416 and findahelpline.com, not a plain message | | | | | |
| 9 | Tap / click ♡ | ❤️; the count goes up by 1; tap again: back | | | | | |
| 10 | Long-press (app) or hover (web) ♡ → 😂, then ⊕ → search `fire` → 🔥 | your reaction changes each time; counts stay right | | | | | |
| 11 | Tap the reaction summary | the breakdown grid, biggest first, ⊕ first, no names | | | | | |
| 12 | Reply with text and a GIF; open a post with 20+ replies | the reply appears; **Load more replies** loads more | | | | | |
| 13 | As `lena.test`, open India | no composer, the view-only banner; no reply box on a post; react works; Report works | | | | | |
| 14 | Report a post | the reasons; the warning; Report disabled until a reason; the toast; the post leaves your feed | | | | | |
| 15 | Report the same post again (from its link) | `You've already reported this post.` | | | | | |
| 16 | Delete your own post; open its link | gone from feeds; the link says `This post was deleted.` | | | | | |
| 17 | 11 campus posts in a row | the 11th is refused with the limit message; the text is kept | | | | | |
| 18 | Someone else on your campus posts while you watch | `↑ 1 new post` within 30 s; nothing jumps on its own | | | | | |
| 19 | Profile → Posts (yours and someone else's) | your Being checked post appears only on yours | | | | | |
| 20 | **Explore Live Demo**, then Community | a name like `@demo.sunny.otter`; only the demo personas' posts | | | | | |
| 21 | **Laptop only:** drag, double-click, collapse, ⤢, reload | everything works and the layout is remembered | | — | — | — | — |
| 22 | **Samsung:** scroll a feed with GIFs for 30 s | smooth; GIFs pause when scrolled away | — | — | — | — | |
| 23 | Airplane mode, pull to refresh, then back online | a friendly error, no crash; it recovers | | | | | |

**For every ❌:** a screenshot or a screen recording, the platform, and the block (V-D or N-D).
Vishwajeet fixes the app ones; you fix the website ones.

## Block N-E — Website: reactions and GIFs in messages; the demo onboarding (Days 15–17)

On a new branch, `n-e-web-message-reactions`, run **CC-N5**.

**👁️ CHECKPOINT N-E** — two browsers (one normal, one private): Priya in one, Arjun in the
other, both in the Wacom chat.
1. Hover a bubble: the 😊 button appears beside the ⌄ button. Click it: the quick bar. Pick ❤️.
   The pill appears under the bubble, in **both** browsers.
2. ⊕ → search → pick an emoji: it replaces your reaction in both browsers.
3. Click the pill: `You … · Tap to remove`. Remove it.
4. The GIF button in the composer: pick a GIF. It's sent and plays on both sides; the inbox
   row reads `GIF`.
5. Reply to the GIF: the quote reads `GIF`.
6. A deleted message has no 😊 button.
7. **Explore Live Demo**: the onboarding page shows your generated name, read-only.

## T3 — Reactions and GIFs in messages, everywhere (Days 17–18)

Use the same set-up as T2. Website as **Priya**; phones as **Arjun** (POCO), and as **Rahul**
(OPPO and Samsung, with Rahul's chat with Priya about the cycle).

| # | Do this | Expect | Web | POCO | OPPO | Samsung |
|---|---|---|---|---|---|---|
| 1 | Open the quick bar on a message (hover 😊 on web; long-press on phones) | ❤️ 👍 😂 😮 😢 🙏 ⊕; on phones it's above the action menu | | | | |
| 2 | Pick ❤️ | the pill appears under the bubble, on both sides within about a second | | | | |
| 3 | ⊕ → search → another emoji | it replaces yours, on both sides | | | | |
| 4 | Both people pick the same emoji | the pill reads `❤️ 2` | | | | |
| 5 | Tap the pill → remove yours | it's gone on both sides | | | | |
| 6 | Send a GIF | it plays on both sides; the inbox row reads `GIF` | | | | |
| 7 | Reply to the GIF | the quote reads `GIF` | | | | |
| 8 | A tombstone (deleted message) | no reactions possible | | | | |
| 9 | Phones: multi-select mode | no quick bar while selecting | — | | | |
| 10 | **Regression:** send, receive live, reply, copy, delete for everyone, unread band, jump button, older pages | all exactly as before | | | | |

### M2 go-live — Day 18

When every web cell in T3 is ✅:
1. Merge N-E and wait for Netlify.
2. On the live site, react to a message, send a GIF, and try **Explore Live Demo**.
3. File: `node scripts/changelog.mjs new neeraj "M2 live: reactions and GIFs in messages; demo onboarding" --phase 7 --block T3 --for vishwajeet`

## T4 — Nothing else broke (Days 19–20)

Run T2 and T3 again quickly, each row on a device it **wasn't** run on before. Then the basics:

- log in with OTP, with username and password, and with **Explore Live Demo**;
- marketplace: infinite scroll, the campus switcher, filters, the swipe deck (app);
- sell a listing with photos, edit it, Mark as Sold to a buyer, Relist, delete;
- like, save, ask a question on your own campus (works) and on another campus (refused);
- logged out, open a product link: `A student at …` (6B privacy still holds);
- messages: send, receive live, reply, copy, delete for everyone, the chat wallpaper, the welcome
  sticker.

## T5 — Production (Day 21)

On `https://yahora.netlify.app`, with your own account and a campus-mate's test account:

1. Post in Campus, in your country and in Global: each appears in the right feed.
2. React, reply with a GIF, open the breakdown.
3. The campus-mate reports one of your test posts: it stays visible to everyone else (one
   report is far below every threshold).
4. In a chat: react to a message and send a GIF.
5. **Explore Live Demo:** a `demo.` name, and only demo posts.
6. Ask Vishwajeet to check the Render logs for `[moderation] check skipped`. There should be
   none, or a reason you understand.
7. Delete your test posts.

File: `node scripts/changelog.mjs new neeraj "T5 passed on production" --phase 7 --block T5 --for vishwajeet`.

---
# TRACK 4 — NEERAJ, CLAUDE CODE PROMPTS

Start every session with the opener from Track 2, using `for neeraj`.

## CC-N1 — The posts API, part 1: reading

```
Phase 7, Block N-B, part 1 of 2. The posts module's reading endpoints.

OWNERSHIP — read this first. backend/src/modules/posts/* carry
"OWNER: VISHWAJEET" banners. For Phase 7 they are ON LOAN to me (Neeraj):
see the changelog entry "Ownership loan: posts module to Neeraj for
Phase 7". You may edit them. Do NOT change the OWNER banners.

Read first: backend/API.md "posts module (Phase 7)" — the contract;
implement it exactly. Then runbook §1.1, §1.3 and §1.11,
backend/src/utils/pagination.js, and backend/CLAUDE.md (the security
checklist).

Rules for every route:
- requireAuth. The viewer is req.user.id, never a query parameter.
- The database decides who may see what. Call the SQL functions named
  below; never re-check scope, campus, country or demo-world rules in
  JavaScript (backend/CLAUDE.md: business rules live in the database).
- Lists return { items, next_cursor } — the same envelope sendPage
  produces. Build it yourself, because the cursor is compound, as
  getChatHistory does in messages.controller.js:
  next_cursor = encodeCursor(value, id) of the LAST item when the page is
  full, otherwise null. An undecodable cursor → 400 INVALID_FORMAT.
- Remove hot_score from every item before responding.

Routes (in posts.routes.js; register the fixed paths BEFORE '/:id'):
1. GET /countries → rpc countries_for_viewer(p_viewer). Name each code with
   new Intl.DisplayNames(['en'], { type: 'region' }).of(code). Sort: is_mine
   first, then by name. → { items: [{ code, name, is_mine }], next_cursor: null }
2. GET /feed/campus?limit&cursor → rpc get_campus_feed; cursor kind
   'timestamp' (created_at|id).
3. GET /feed/country/:code?sort&limit&cursor:
   - uppercase :code; it must match ^[A-Z]{2}$, else 400 INVALID_FORMAT;
   - sort 'hot' (the default) or 'new', else 400;
   - cursor kind 'number' (hot_score|id) for hot, 'timestamp' for new;
   - rpc get_country_feed;
   - the response adds can_post from rpc can_post_in_feed(viewer,
     'country', code).
4. GET /feed/global?sort&limit&cursor → rpc get_global_feed, the same
   cursor rules, can_post from can_post_in_feed(viewer, 'global', null).
5. GET /feed/campus/new-count?since=<ISO time> → since must parse, else 400;
   rpc count_new_campus_posts → { count }.
6. GET /:id (a uuid, else 400) → rpc post_visibility first:
   - 'not_found' → 404 POST_NOT_FOUND;
   - 'deleted' → 410 POST_DELETED;
   - 'removed' → 410 POST_REMOVED;
   - 'visible' → rpc get_post_item →
     { post, can_reply } (can_reply from rpc can_reply_to_post).
7. GET /:id/replies?limit&cursor → rpc get_post_replies (oldest first;
   cursor kind 'timestamp').
8. GET /by-user/:userId?limit&cursor → rpc get_user_posts.

Then:
- backend/API.md: correct anything in the posts section that turned out
  different (nothing should).
- File the entry Vishwajeet builds the app from:
  node scripts/changelog.mjs new neeraj "Posts API: reading endpoints (N-B part 1)" --phase 7 --block N-B --for vishwajeet

HARD CONSTRAINTS
- Touch only backend/src/modules/posts/*, backend/API.md and the changelog.
- No SQL. If a function you need is missing or returns the wrong shape,
  STOP and write a "Migration request" entry for Vishwajeet
  (backend/CLAUDE.md explains how).

VERIFY AFTER — report each
1. node --check on both files.
2. The route list, in order.
3. Remind me of checkpoint N-B checks 1–5.
```

## CC-N2 — The posts API, part 2: posting, deleting, reacting

```
Phase 7, Block N-B, part 2 of 2. Posting, deleting and reacting, in the
posts module (ON LOAN to me — do not change the OWNER banners).

Read first: runbook §1.4, §1.6, §1.10 and §1.12; the posts section of
backend/API.md; backend/src/utils/moderation.js and emoji.js.

1. POST / (multipart, requireAuth). Follow runbook §1.10's ORDER exactly:
   a. Multer with memory storage (follow how the products module sets it
      up): field 'images', at most 3 files, at most 5 MB each, mimetype
      image/jpeg, image/png or image/webp. Too many → TOO_MANY_IMAGES
      { max: 3 }; too big → FILE_TOO_LARGE; wrong type → INVALID_FILE_TYPE.
   b. Fields:
      - content: a string, default '';
      - scope: campus | country | global, default campus; ignored for
        replies;
      - parent_post_id: a uuid when present;
      - gif: a JSON string; parse it and validate it with the same rule
        V-C uses for messages (provider 'klipy', id, an https url, optional
        https preview_url, positive width and height) → else INVALID_GIF;
      - confirm: 'true' or absent.
   c. Rules, checked in this order:
      - content trimmed; codePointLength ≤ 1000, else CONTENT_TOO_LONG
        { max: 1000 } (count with [...text].length — §1.12);
      - there must be text, a photo or a GIF, else EMPTY_POST;
      - photos and a GIF together, or photos on a reply → MEDIA_CONFLICT.
   d. const result = await checkContent({ text: content, images: files })
      - outcome 'nudge' and confirm isn't 'true' → 422
        { error: 'MODERATION_NUDGE', categories: result.categories }.
        Nothing saved, nothing uploaded.
      - 'hold' → moderation_status 'pending', moderation_scores =
        result.scores, moderation_checked_at = now.
      - 'nudge' with confirm → 'active', moderation_flagged true, scores
        saved, checked now.
      - result.checked false → 'active', moderation_checked_at left empty
        (Vishwajeet's job re-checks it).
      - otherwise → 'active', scores saved, checked now.
   e. Upload the photos to the 'posts' storage bucket with random file
      names, never containing user ids (6B's rule — see how products names
      its files now).
   f. Insert the row with the service client: author_id = req.user.id,
      scope, content, image_urls, gif, parent_post_id and the moderation
      fields. The trigger fills the rest and enforces the rules. On error:
      FIRST delete the photos uploaded in e, THEN return
      mapDbError(res, error) (POST_NOT_FOUND, NESTED_REPLY_NOT_ALLOWED,
      NOT_ALLOWED_HERE, RATE_LIMIT_POSTS, RATE_LIMIT_REPLIES).
   g. Read the post back with rpc get_post_item (viewer = the author).
      Return 201 { post }, or for a hold
      202 { post, held: true, support: result.support }.
2. DELETE /:id → a uuid, else 400.
   - Read author_id and deleted_at. Not found → 404 POST_NOT_FOUND. Not the
     author → 403 FORBIDDEN.
   - Set deleted_at = now() if it isn't set (deleting twice is fine) →
     200 { id, deleted: true }.
   - Don't touch the photos: Vishwajeet's daily job removes them after
     90 days (§1.8).
3. PUT /:id/reaction, body { emoji }:
   - a uuid, else 400;
   - isSingleEmoji(emoji), else 400 INVALID_EMOJI;
   - rpc react_to_post(p_post_id, p_user_id: req.user.id, p_emoji);
     errors via mapDbError;
   - 200 { post_id, viewer_reaction, reactions_total, reaction_counts }.
   DELETE /:id/reaction → the same, with p_emoji null.
4. backend/API.md: correct anything that differs.
5. Add to your N-B changelog entry (or file a second one for Vishwajeet):
   the write endpoints, with every status code.

HARD CONSTRAINTS
- Touch only backend/src/modules/posts/*, backend/API.md and the changelog.
- No SQL. Never count posts or check limits in JavaScript: the trigger
  does it.
- Never log post text or photos.

VERIFY AFTER — report each
1. node --check on both files.
2. The final route list, in order.
3. Remind me of checkpoint N-B checks 6–10.
```

## CC-N3 — The reports API

```
Phase 7, Block N-C. The reports endpoint, in my own module
(backend/src/modules/reports/).

Read: runbook §1.7, spec §7, backend/API.md "reports module".

POST /api/reports (requireAuth), body
{ target_type, target_id, reason, details? }:
- target_type must be 'post' in Phase 7, else 400 INVALID_FORMAT
  { message: 'Only posts can be reported for now.' };
- target_id a uuid; reason one of the 11 values in Appendix A; details an
  optional string of at most 500 characters (code points) → else 400
  INVALID_FORMAT;
- rpc create_report(p_reporter: req.user.id, p_target_type, p_target_id,
  p_reason, p_details); errors via mapDbError (POST_NOT_FOUND 404,
  CANNOT_REPORT_OWN 400, DUPLICATE 400);
- 201 { reported: true }.
The response must NEVER reveal how many reports a post has or whether it
was covered (§1.7).

Then update backend/API.md and file:
node scripts/changelog.mjs new neeraj "Reports API (N-C)" --phase 7 --block N-C --for vishwajeet

HARD CONSTRAINTS
- Touch only backend/src/modules/reports/*, backend/API.md and the
  changelog. No SQL.

VERIFY AFTER — report each
1. node --check.
2. Remind me of checkpoint N-C.
```

## CC-N4a — The website community, part 1: the page, the layout and the post card (sample data)

```
Phase 7, Block N-D, part 1 of 3. The Community page, the adjustable layout,
the post card and reactions on the card — built with SAMPLE DATA, because
the posts API is written later (N-B). Part 2 swaps in the real API.

Read: spec §1, §3, §5.1–§5.4, §9, §12 and §13; runbook §1.1, §1.12 and
§1.13; frontend/CLAUDE.md.

1. In frontend/: npm install react-resizable-panels emoji-picker-react
   These two libraries are approved for this phase.
2. src/utils/community.js:
   - spec §13's constants;
   - codePointLength(text) = [...text].length; formatCount (999, 1.2K, 12K,
     1.2M); flagEmoji(code); topReactions(counts, n = 3);
   - formatPostTime — reuse src/utils/messageFormat.js where it fits.
3. src/styles/global.css: spec §12's five variables.
4. src/pages/community/sampleData.js: 12 posts shaped EXACTLY like
   runbook Appendix A's PostItem — campus, India and Global posts; one long
   text; 1, 2 and 3 photos (use image URLs the site already shows); one GIF
   object; varied reactions. Also a sample countries list with Germany set
   view-only. This file is deleted in part 2.
5. App.jsx and the navbar:
   - /community → RequireOnboarded + the Community page;
   - /feed and /hot → <Navigate to="/community" replace />;
   - in the navbar, the "Hot" link becomes "Community" → /community.
6. src/pages/community/Community.jsx + .module.css:
   - 1024 px wide or more: two panels with react-resizable-panels
     (spec §1.1) — at least 320 px each; collapsible to 44 px bars with a
     vertical label and an expand button; ⤢ maximise and restore;
     double-click the handle for 50 / 50; keyboard on the handle; the
     layout saved under 'yahora.community.layout'. Check the installed
     version's README for the component names.
   - Under 1024 px: the switcher (spec §1.2). Use a matchMedia hook so only
     one layout is mounted.
   - Left: the campus header and feed. Right: the country dropdown
     (spec §1.3), Hot · New, and the feed.
   - The view-only banner (spec §1.4) in place of the composer when
     can_post is false.
   - Infinite scroll with the existing InfiniteScrollSentinel; skeletons;
     spec §9's empty texts.
7. src/components/community/PostCard/ — exactly spec §3:
   - the author line (→ /user/:id); the scope chip; the 6-line fold with
     See more; links;
   - photos in the 1 / 2 / 3 layouts, opening the existing ImageLightbox;
   - a GIF that plays muted on a loop and pauses off screen
     (IntersectionObserver);
   - the React button; the 💬 count (→ /post/:id); a ⋯ button (part 3 fills
     its menu).
8. src/components/community/ReactionBar/ — spec §5.1:
   - click React toggles ❤️; hovering 300 ms or pressing ↑ opens the quick
     bar;
   - ⊕ opens emoji-picker-react, styled per spec §5.2 (search, frequently
     used, categories);
   - choosing your current emoji removes it; another replaces it;
   - a CSS pop animation, turned off by prefers-reduced-motion.
9. ReactionSummary and ReactionBreakdown (a popover): spec §5.3 and §5.4.
In part 1, reacting only changes the sample data in memory.

HARD CONSTRAINTS
- frontend/CLAUDE.md patterns: raw fetch, CSS Modules, lucide icons,
  design tokens. No libraries beyond the two above.
- Don't change any other page.
- Do not touch backend/ or mobile/.

VERIFY AFTER — report each
1. npm run build passes.
2. The versions of the two libraries installed.
3. Remind me of checkpoint N-D1.
```

## CC-N4b — The website community, part 2: real data and composing

```
Phase 7, Block N-D, part 2 of 3. Swap the sample data for the real API,
and build the composer and the GIF picker. Read: spec §2 and §6; runbook
§1.3, §1.6, §1.9, §1.10 and §1.12; backend/API.md "posts module (Phase 7)".

1. src/pages/community/api.js — raw fetch with the token, the way
   ProductDetail does it, and API_BASE_URL from src/config/urls.js:
   getCountries, getFeed(kind, { country, sort, cursor }),
   getNewCount(since), getPost(id), getReplies(id, cursor),
   getUserPosts(userId, cursor), createPost(formData), deletePost(id),
   react(id, emoji), unreact(id), report(body). Cursors are echoed back
   exactly as received, never parsed (§1.3).
2. Use it everywhere sample data was used, then DELETE sampleData.js.
   Reactions are optimistic and roll back on error.
3. The composer (spec §2):
   - the closed row; the open inline composer with "Posting as @username ·
     campus", the textarea, the counter (codePointLength, shown at 100
     left), the destination chip;
   - photos: at most 3, JPEG / PNG / WebP, 5 MB each, with previews and ✕;
   - the GIF button and the 😊 button (emoji-picker-react, inserting at the
     cursor); the photos-or-GIF rule with the spec's hint text;
   - Post: multipart POST /api/posts.
   Handle every result in spec §2.3:
   - 201 → clear and close, put the post at the top of that feed;
   - 422 MODERATION_NUDGE → the existing ConfirmDialog ("Post this?").
     Edit keeps everything; Post anyway re-sends with confirm=true;
   - 202 held → the AppToast message, or the support card (spec §2.4) when
     support is true;
   - 429 / 403 / 400 → the inline messages; a network error → the toast.
   Never clear the text unless the result is 201 or 202.
4. src/components/community/GifPicker/ (spec §6): a popover with a search
   box, trending first, 3 columns, infinite loading, a 300 ms debounce,
   and "Powered by KLIPY". It calls KLIPY from the browser with
   import.meta.env.VITE_KLIPY_API_KEY, read in ONE file,
   src/utils/klipy.js. That's the only exception to "don't read
   import.meta.env in components", and it's in a util, not a component.
   Read KLIPY's API docs for the search and trending endpoints, and use a
   small rendition. It returns a GifRef
   { provider: 'klipy', id, url, preview_url, width, height }. With no key:
   "GIFs aren't available right now."

HARD CONSTRAINTS
- frontend/CLAUDE.md patterns. No new libraries.
- Do not touch backend/ or mobile/.

VERIFY AFTER — report each
1. npm run build passes.
2. Which KLIPY endpoints and rendition you used.
3. Remind me of checkpoint N-D2.
```

## CC-N4c — The website community, part 3: the post page and everything around it

```
Phase 7, Block N-D, part 3 of 3. The post page and replies, reporting,
deleting, the Posts tabs and the "new posts" pill. Read: spec §3.1, §4, §7,
§8 and §10; runbook §1.7 and §1.8.

1. src/pages/post/PostDetail.jsx at /post/:id (RequireOnboarded):
   - the parent post larger (text 17/26);
   - replies oldest first, with a "Load more replies" button (not infinite
     scroll); compact PostCards with a 32 avatar;
   - the reply box pinned at the bottom (text with a GIF, no photos). When
     can_reply is false: "Only students in <country> can reply.";
   - 404 → "This post isn't available."; 410 POST_DELETED → "This post was
     deleted."; 410 POST_REMOVED → spec §3.1's text; under review → the
     cover with "View anyway".
2. The ⋯ menu on posts and replies: Report (everyone except the author) and
   Delete (the author only). Delete → ConfirmDialog with the spec's text →
   remove the post from the page and from any loaded feed.
3. src/components/community/ReportModal/ — exactly spec §7:
   - the 11 reasons in order; optional details (500); the warning paragraph
     always visible; the self-harm line; Report disabled until a reason is
     picked;
   - 201 → the toast, and hide the post from this user's loaded feeds;
     400 DUPLICATE → "You've already reported this post."; anything else →
     "Couldn't send. Try again."
4. The Posts tabs (spec §10):
   - Dashboard: a fourth tab, "Posts", after Watchlist (keep the tab in
     useHistoryEntryState, as the other tabs are — frontend/CLAUDE.md);
   - PublicProfile: a Posts section.
   Both from GET /api/posts/by-user/:userId with infinite scroll. Your own
   shows the "Being checked" and "Under review" labels.
5. The "new posts" pill (spec §8) on the campus feed:
   - poll new-count every NEW_POSTS_POLL_MS while the page is visible
     (document.visibilityState);
   - click → scroll to the top and reload;
   - never insert posts on its own.

HARD CONSTRAINTS
- frontend/CLAUDE.md patterns. No new libraries.
- Do not touch backend/ or mobile/.

VERIFY AFTER — report each
1. npm run build passes.
2. Remind me of checkpoint N-D3 and of T2.
```

## CC-N5 — Website: reactions and GIFs in messages; the demo onboarding

```
Phase 7, Block N-E. Read spec §5.5, §6 and §11; runbook §1.4 and §1.11;
Vishwajeet's V-C changelog entry (the API).

1. src/pages/messages/Messages.jsx — reactions:
   - Hovering a bubble shows a small 😊 button beside the existing ⌄
     actions button, with the same show and hide rules. Clicking it opens
     the community ReactionBar (compact). ⊕ opens emoji-picker-react.
   - Choosing an emoji: PUT /api/messages/:id/reaction, optimistic, rolled
     back on error. Choosing your current emoji: DELETE.
   - The pill under the bubble (spec §5.5): it overlaps the bubble's bottom
     edge by 8 px on the inner side; it shows ❤️ 😂, or ❤️ 2 when both chose
     the same; clicking it opens a small popover: "You <emoji> · Tap to
     remove" and "<first name> <emoji>".
   - The Realtime UPDATE handler already replaces the row by id. Confirm
     reactions arrive with it; change nothing if they do.
   - No 😊 button on tombstones, pending or failed messages, the typing
     bubble, the welcome card, or date chips.
2. GIFs in messages:
   - a GIF button in the composer opens the community GifPicker; picking
     one sends it AT ONCE as its own message (content '', gif). Typed text
     stays in the box;
   - a GIF bubble: at most 240 px wide, keeping its aspect ratio, rounded
     like the bubble, with the time and ticks under it;
   - the inbox preview reads "GIF" when last_message_has_gif is true and
     the text is empty;
   - a reply quoting a GIF reads "GIF" (the server already sends
     reply_preview 'GIF').
3. src/pages/onboarding/onboarding.jsx — for demo users (localStorage
   yahora_demo_user): hide the username field and show the generated
   handle read-only, with "Demo accounts get a name automatically." Don't
   send a username when saving. "Skip for now" stays.

HARD CONSTRAINTS
- Don't change paging, the unread band, read marking, the wallpaper or
  the stickers.
- frontend/CLAUDE.md patterns. No new libraries.
- Do not touch backend/ or mobile/.

VERIFY AFTER — report each
1. npm run build passes.
2. Remind me of checkpoint N-E and of T3.
```

---
# SIGN-OFF — both of you, Friday 20 November

Tick a box only when you have seen it yourself, on the device named.

**Feeds and posts (T2)**
- [ ] 👁️ Campus, country and Global work on the website (panels and switcher) and on all three
      phones.
- [ ] 👁️ The view-only rules hold: in another country's feed you can react and report, but not
      post or reply.
- [ ] 👁️ 1,000 characters with See more; 3 photos or 1 GIF; replies one level deep; deleting
      your own post.

**Reactions and GIFs (T2, T3)**
- [ ] 👁️ Tap ❤️, the quick bar, ⊕ with search, change, remove, the summary and the breakdown —
      on posts, replies and messages.
- [ ] 👁️ Message reactions appear on the other side within about a second.
- [ ] 👁️ GIFs in posts, replies and messages; "Powered by KLIPY" in every picker.

**Safety (T1, T2)**
- [ ] 👁️ Nudge, hold and the support card all work.
- [ ] Posting still works when moderation is unavailable (try once with `OPENAI_API_KEY`
      removed from `backend/.env` locally, then put it back).
- [ ] 👁️ Reporting: the warning shows, "already reported" works, and the thresholds cover
      posts (the V-B tests prove the numbers).
- [ ] The 11th campus post in an hour is refused.

**Demo (T2)**
- [ ] 👁️ Demo accounts get `demo.` names and see only the demo community; real users can't take
      a `demo.` name.

**Nothing broke (T4) and production is right (T5)**
- [ ] 👁️ T4 ✅. T5 ✅.

**Docs and housekeeping**
- [ ] `backend/API.md` matches every route in Appendix A.
- [ ] Every block filed a changelog entry.
- [ ] Two lines added to the Privacy Policy page (Neeraj): posts and photos are checked by an
      automated moderation service (§1.6); deleted posts are kept for 90 days for safety
      reviews, then removed (§1.8).
- [ ] "Apply for the KLIPY production key" and the Phase 9 items in Appendix E are on the
      Phase 9 list.

When every box is ticked:

```bash
node scripts/changelog.mjs new vishwajeet "Phase 7 complete; posts module back to Vishwajeet" --phase 7 --block SIGN-OFF
node scripts/changelog.mjs release 7 --dry-run    # look at the list
node scripts/changelog.mjs release 7
git add -A docs/changelog && git commit -m "docs(changelog): release phase 7"
```

The sign-off entry is filed **before** the release, so it ends up inside `phase-7.md` too.

---

# APPENDIX

## A. The Phase 7 API

Every route here needs the token (requireAuth). `limit` defaults to 20, and is at most 50.

**The cursor rule (all lists):**
- every list returns `{ items, next_cursor }`;
- `next_cursor` is an **opaque** string, or `null` at the end of the list;
- send it back as `?cursor=` exactly as you received it, and never build or read one;
- a cursor belongs to one list and one sort, so changing `sort` starts again from page one.

### The PostItem — one shape for every feed, reply and profile list

Flat: there is no nested `author` object.

```json
{
  "id": "uuid",
  "parent_post_id": null,
  "scope": "campus",
  "country_code": "IN",
  "content": "Lost my calculator near Block C",
  "image_urls": ["https://…"],
  "gif": null,
  "created_at": "2026-11-02T10:15:00Z",
  "reactions_total": 4,
  "reaction_counts": { "❤️": 3, "😂": 1 },
  "replies_count": 2,
  "viewer_reaction": "❤️",
  "moderation_status": "active",
  "author_id": "uuid",
  "author_username": "rahul.verma",
  "author_name": "Rahul Verma",
  "author_avatar": "https://… or null",
  "author_university": "IIITDM Kurnool",
  "is_mine": false
}
```

The fields:
- `content`: at most 1,000 code points. It can be empty when there is a photo or a GIF.
- `gif`: `{ "provider": "klipy", "id", "url", "preview_url", "width", "height" }` or `null`.
- `viewer_reaction`: your own reaction, or `null`.
- `moderation_status`: `active` for everyone. The author alone also sees `pending` and
  `under_review` on their own posts; other viewers see `under_review` posts behind a cover.

### posts module — Neeraj, on loan from Vishwajeet for Phase 7

| # | Route | Answer | Errors |
|---|---|---|---|
| 1 | `GET /api/posts/countries` | `{ items: [{ code, name, is_mine }], next_cursor: null }`, your country first | — |
| 2 | `GET /api/posts/feed/campus` | the campus feed: posts by students of your campus, any scope, newest first | 400 INVALID_FORMAT (bad cursor) |
| 3 | `GET /api/posts/feed/country/:code?sort=hot\|new` | that country's feed, plus `can_post` | 400 INVALID_FORMAT |
| 4 | `GET /api/posts/feed/global?sort=hot\|new` | the Global feed, plus `can_post: true` | 400 INVALID_FORMAT |
| 5 | `GET /api/posts/feed/campus/new-count?since=<ISO>` | `{ count }` | 400 INVALID_FORMAT |
| 6 | `GET /api/posts/:id` | `{ post, can_reply }` | 404 POST_NOT_FOUND · 410 POST_DELETED · 410 POST_REMOVED |
| 7 | `GET /api/posts/:id/replies` | replies, **oldest first** | 400 INVALID_FORMAT |
| 8 | `GET /api/posts/by-user/:userId` | that person's posts that you may see; your own include pending and under-review | 400 INVALID_FORMAT |
| 9 | `POST /api/posts` (multipart) | 201 `{ post }` · 202 `{ post, held: true, support }` | 422 MODERATION_NUDGE `{ categories }` · 400 CONTENT_TOO_LONG `{ max }`, EMPTY_POST, TOO_MANY_IMAGES `{ max }`, MEDIA_CONFLICT, INVALID_GIF, FILE_TOO_LARGE, INVALID_FILE_TYPE, INVALID_FORMAT, NESTED_REPLY_NOT_ALLOWED · 403 NOT_ALLOWED_HERE · 404 POST_NOT_FOUND (parent) · 429 RATE_LIMIT_POSTS, RATE_LIMIT_REPLIES |
| 10 | `DELETE /api/posts/:id` | `{ id, deleted: true }` (it's fine to delete twice) | 403 FORBIDDEN · 404 POST_NOT_FOUND |
| 11 | `PUT /api/posts/:id/reaction` body `{ emoji }` | `{ post_id, viewer_reaction, reactions_total, reaction_counts }` | 400 INVALID_EMOJI · 404 POST_NOT_FOUND |
| 12 | `DELETE /api/posts/:id/reaction` | the same answer, with `viewer_reaction: null` | 404 POST_NOT_FOUND |

**`POST /api/posts` fields** (`multipart/form-data`):

| Field | Meaning |
|---|---|
| `content` | text, may be empty if there is media |
| `scope` | `campus` · `country` · `global`; ignored for replies |
| `parent_post_id` | makes it a reply |
| `gif` | a JSON string with the GIF object |
| `images` | up to 3 files, JPEG / PNG / WebP, 5 MB each; not allowed with a GIF or on a reply |
| `confirm` | `true` when re-sending after a nudge |

### reports module — Neeraj

`POST /api/reports`, body `{ target_type: "post", target_id, reason, details? }`

- **reason** is one of `spam`, `harassment`, `hate_speech`, `sexual_content`, `child_safety`,
  `violence`, `self_harm`, `impersonation`, `misinformation`, `prohibited_item`, `other`.
  `details` is at most 500 characters.
- **201** `{ reported: true }`.
- **Errors:** 400 INVALID_FORMAT (anything not a post, a bad reason, details too long) · 400
  CANNOT_REPORT_OWN · 400 DUPLICATE · 404 POST_NOT_FOUND.
- The answer **never** says how many reports a post has, or whether it was covered.

### messages module — Vishwajeet (V-C)

| Route | Answer | Errors |
|---|---|---|
| `PUT /api/messages/:id/reaction` body `{ emoji }` | `{ message }` | 400 INVALID_FORMAT, INVALID_EMOJI, MESSAGE_DELETED · 404 MESSAGE_NOT_FOUND |
| `DELETE /api/messages/:id/reaction` | `{ message }` | the same |
| `POST /api/messages/send` | optional `gif`; `content` may be `''` when a GIF is present | 400 INVALID_GIF (plus the existing errors) |

**New fields:**
- message rows (send, history, Realtime) gain `reactions` (`{ "<user id>": "❤️" }`) and `gif`;
- inbox rows gain `last_message_has_gif`.

### auth and universities — Vishwajeet (V-C)

- `POST /api/auth/demo-login`: `userProfile.username` is now set, for example
  `demo.sunny.otter`.
- `POST /api/auth/onboarding`: a demo user's `username` is ignored.
- `GET /api/universities`: each row gains `country_code`.

## B. Error names

**New, raised by the database** (added to `RAISED_STATUS` in `utils/respond.js`):

| Name | HTTP | When |
|---|---|---|
| `POST_NOT_FOUND` | 404 | no such post, or you're not allowed to see it |
| `NOT_ALLOWED_HERE` | 403 | posting or replying in a feed you can only view |
| `CANNOT_REPORT_OWN` | 400 | reporting your own post |
| `MESSAGE_DELETED` | 400 | reacting to a deleted message |

**Raised by the database and already mapped:** `NESTED_REPLY_NOT_ALLOWED` (400),
`RATE_LIMIT_POSTS` (429), `RATE_LIMIT_REPLIES` (429), `USERNAME_RESERVED` (400, now also for
`demo.` names), `MESSAGE_NOT_FOUND` (404). A duplicate report is a unique violation, which
`mapDbError` already turns into `DUPLICATE` (400).

**Sent directly by controllers:** `MODERATION_NUDGE` (422), `CONTENT_TOO_LONG`, `EMPTY_POST`,
`TOO_MANY_IMAGES`, `MEDIA_CONFLICT`, `INVALID_GIF`, `INVALID_EMOJI`, `FILE_TOO_LARGE`,
`INVALID_FILE_TYPE` (400), `POST_DELETED` and `POST_REMOVED` (410).

## C. URLs, accounts and commands you'll reuse

```
Production website   https://yahora.netlify.app
Production API       https://yahora-yst4.onrender.com/api
Local API            http://localhost:5001/api
Local website        http://localhost:3000
Local Studio         http://127.0.0.1:54323
Local database       postgresql://postgres:postgres@127.0.0.1:54322/postgres

Seeded test accounts (local only), password password123:
  arjun.mehta, priya.nair, rahul.verma   — IIITDM Kurnool (India)
  sneha.gupta, karan.singh               — NIET Greater Noida (India)
  lena.test                              — TU Munich (test) (Germany) — for view-only tests

Keys (never commit them — §1.16):
  backend/.env    OPENAI_API_KEY
  frontend/.env   VITE_KLIPY_API_KEY
  mobile/.env     EXPO_PUBLIC_KLIPY_API_KEY

node scripts/changelog.mjs recent 8
node scripts/changelog.mjs for <name>
supabase db reset
cd mobile && npx tsc --noEmit
cd mobile && npx expo start -c        # -c clears the cache; use it after changing mobile/.env
cd frontend && npm run build
```

## D. Things that cost a day if you forget them

- **⛔ The keys must be in production before the code that needs them.**
  - `OPENAI_API_KEY` goes on Render on day 5. Without it, every post is published unchecked.
  - `VITE_KLIPY_API_KEY` goes on Netlify before M1. Without it, there are no GIFs on the live
    site.
- **Restart after changing a `.env` file.**
  - Vite reads `frontend/.env` only when it starts.
  - Expo bakes `EXPO_PUBLIC_…` values into the app; restart it with `npx expo start -c`.
- **`supabase db reset` after pulling a migration.** Without it, your local database is
  missing the new tables, and every new endpoint answers 500.
- **Cursors are opaque.** Never build one or read one; send back exactly what you got.
- **Count characters as code points** (§1.12), or the counter and the server disagree.
- **Express route order:** `/feed/...`, `/countries` and `/by-user/...` must come before
  `/:id`, or "feed" gets treated as a post id.
- **No error name may sit inside another** (`mapDbError` matches with `includes()`).
- **The rate-limit test leaves posts behind.** Run `supabase db reset` after testing it.
- **GIFs stay on KLIPY.** Never download them or store them yourself, and never remove the
  credit.
- **The posts module is on loan:** its `OWNER:` banner stays as it is.
- **Ideas that come up mid-phase go to the Phase 10 list,** not into Phase 7.

## E. Deliberately NOT in Phase 7

| Item | Phase |
|---|---|
| Following feed, blocks, private accounts, notifications for reactions and replies | 8 |
| The admin review screen: approving held posts, restoring or removing covered ones, acting on false reports | 9 |
| Several email domains per campus, currencies, the campus admin page | 9 |
| Students under 18: date of birth at sign-up, parental consent, safer defaults (§0.4) | 9 |
| The KLIPY production key | 9 |
| Your own Yahora sticker packs, the logo | 10 |
| Editing posts, @mentions, hashtags, link previews | later, if wanted |
| Recommendations (see the 6B notes on activity and recommendations) | after launch |
| Anonymous posting | not in v1 |
