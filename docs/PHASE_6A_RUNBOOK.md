# Phase 6A Runbook — Messages, Made Beautiful + Three Foundations

**Version 1.0 — 27 September 2026**
**Verified against `main` at commit `532a92a`.**

Save as `docs/PHASE_6A_RUNBOOK.md` and commit it.

---

## HOW TO READ THIS DOCUMENT

Read PART 0, PART 1 and PART 2 **together, both of you, before anyone writes code.**

Then each of you works from your own two tracks:

| Track | Who | What |
|---|---|---|
| TRACK 1 | Vishwajeet | Manual steps, in blocks, each ending in a checkpoint |
| TRACK 2 | Vishwajeet | Claude Code prompts, one per block, copy-paste them whole |
| TRACK 3 | Neeraj | Manual steps, in blocks |
| TRACK 4 | Neeraj | Claude Code prompts |

**👁️ means a human has to look at something** — a phone, a browser, Supabase Studio, a
terminal. Everything without 👁️ is Claude Code's to verify itself.

**This phase is sized at six working days.** It comes with a design package
(`phase6-design-assets.zip`): the design spec, a mockup, three rendered images, the
wallpaper tile in all four formats, and the scripts that make them. §0.10 lists where each
file goes.

---

# PART 0 — WHAT I FOUND IN THE REPO

Cloned and read `main` at `532a92a`. Everything below is verified against the code, not
carried over from a document.

## 0.1 The repo, today

- **17 migrations**, newest `20260919093440_search_users_full_name_cast.sql` (Phase 5).
- **The mobile app is on Expo SDK 57 and React Native 0.86**, not SDK 56. Every earlier
  runbook said "Expo Go 56.0.0". That note is now wrong: Expo Go on each phone must match
  **SDK 57**. Blocks V-0 and N-0 check this.
- **Branches on GitHub:** `infiniper` is 3 commits behind `main`, `neeraj` is 17 behind.
  You said you both merged locally — the numbers above are what GitHub sees, so push your
  branch after merging. It takes ten seconds and stops the other person reading stale code.

## 0.2 My Phase 5 mistake, owned

In Phase 5 I told Neeraj to test "the user search box" and put *"User search renders
results on the live website"* in the sign-off. I never checked that a search screen
existed. It does not: `/api/users/search` has **zero callers** on web and on mobile.

The web inbox does have a search bar, but it is a *local filter over your own
conversations* (`Messages.jsx`, the `filteredInbox` line) — it never calls the server.

The backend fix in Phase 5 was real. The UI half of that sign-off line was a check against
something that does not exist. From here on, before writing a test step for a screen, I
check that the screen exists in the code.

The student-search screen belongs with the social graph (**Phase 8**), built on both
platforms at once under your standing rule.

## 0.3 🚨 Search lets anyone on the internet list real students

You raised one direction of this problem: real students would see the demo accounts in
search. The other direction is worse.

**How demo login works today** (`auth.controller.js → demoLogin`):

1. It has no `requireAuth`, no captcha and no rate limit. Anyone can call it.
2. It creates a brand-new account, `guest_<time>_<random>@demo.yahora.com`, auto-confirmed.
3. It signs that account in and hands back a real session token.
4. It creates a profile in "Yahora University (Demo)".

**How search works today** (`search_users` after Phase 5):

- The route has `requireAuth`, and a comment in `user.routes.js` says that is because
  search *"enumerates other students"*.
- But the function has **no demo filter and no campus filter**. It returns matching
  students from every university, with same-campus ones ranked first.

Put those together. `requireAuth` is meant to be the lock, but demo login hands a key to
anyone who asks:

```bash
# 1. One click's worth of work: become a logged-in user. No email, no captcha.
curl -s -X POST http://localhost:5001/api/auth/demo-login
#    → the response contains a session token

# 2. List real students — names, usernames, photos, universities — on every campus
curl -s "http://localhost:5001/api/users/search?q=a" \
     -H "Authorization: Bearer <that token>"
```

Change the letter, repeat, and you have walked the whole student list.

**Why this is new.** Until Phase 5, `search_users` crashed with a type error for everyone.
That crash was protecting you by accident. Fixing it opened the door. That is not a reason
to regret the fix — it is a reason to close the door properly, now.

**The fix is Block V-A: one small migration, filtering in both directions.**

| Who is searching | Sees |
|---|---|
| A real student | Real students only. **Never** a demo account |
| A demo account | Demo accounts only. **Never** a real student |
| Someone the database cannot identify | **Nobody** (§1.4 explains why) |

The search *screen* still waits for Phase 8. The filter goes in now, because the endpoint
is reachable today whether or not a screen calls it.

## 0.4 The chat wallpaper document has drifted — five corrections

I read `PHASE6_BLOCK_CW_chat_wallpaper.md` in full. The design thinking in it is good and I
have kept all of it: one shared asset, never redrawn per platform, 420 units on both, the
four size tiers, no SVG filters. But it was written on 17 September against code that has
moved, and five of its instructions would now go wrong:

| # | The document says | The code actually has | What would happen |
|---|---|---|---|
| 1 | The conversation panel is the gradient at "roughly line 99" | Line 99 is **`.inboxSidebar`** — the inbox list. The conversation is **`.messagesContainer`**, about line 551 | The wallpaper lands on the inbox and never appears in a chat |
| 2 | `background-attachment: local` | `.messagesContainer` is the element that scrolls | `local` makes the wallpaper **scroll with** the messages — the opposite of its own verification step. §1.5 explains |
| 3 | The three PNGs are "already created and committed" | `make_tile_v3.py` writes **only** the SVG | Mobile had nothing to use |
| 4 | Put PNGs in `mobile/assets/images/` | That folder does not exist. Your images live directly in `mobile/assets/` (the `glow-*.png` files are there) | Follow the repo's own convention |
| 5 | A new near-white ground, `#FDF8FF` | Both platforms already use **`#EDE6F5`** for the chat, deliberately | White bubbles dissolve into a near-white ground — your exact complaint. §0.5 shows it |

One smaller thing: it says not to touch the "decorative blobs around lines 114 and 125".
Those are the **inbox's** glows (`.inboxSidebar::before/::after`), and the new design
removes them.

**What I made, so you are not blocked:**

- **The three mobile PNGs** — 420, 840 and 1260 pixels square, transparent. I rendered them
  with Chromium, the same engine that draws the SVG on the website, so the two platforms
  come from one renderer. Then I checked them rather than trusting them:
  - **Zero** stray-coloured pixels out of 102,847 drawn ones (the SVG uses `currentColor`
    for its dotted trails, which renders black if anything goes wrong — nothing did).
  - Tiled 2×2, they differ from your approved `preview.png` by **0.27 out of 255** on
    average — effectively identical.
  - **No seam** at the tile joins — only the doodles that deliberately cross them.
- **`export_pngs.py`** — a 40-line script that re-creates the PNGs from the SVG. I ran it
  from scratch and its output is byte-identical to the bundled PNGs.
- **Confirmed the generator reproduces your SVG exactly.** The only difference is a 7.7 KB
  block of provenance metadata (C2PA) that something added to the file along the way. It
  does not affect drawing, so I left the SVG untouched rather than editing a shared asset.

## 0.5 The design — decided by looking, then by measuring

You said the message screens look almost white, and asked for beautiful, attractive and
comfortable. "Make it beautiful" handed to two Claude Code sessions produces two different
designs — the same problem the wallpaper document solved for the pattern. So I wrote the
design down **once**, as exact values, in `docs/design/MESSAGES_SPEC.md`, and rendered it
at phone width to check it before asking you to build it.

Three decisions came out of that, and each one is backed by a picture in the package.

**The chat ground stays `#EDE6F5`.** See `wallpaper_ground_options.png`. On `#FDF8FF` the
white received bubbles, the date chips and the "unread messages" band all but disappear.
On `#EDE6F5` they lift off cleanly, and the doodles are still plainly visible.

**The inbox moves to your app canvas** — the pink-to-lilac gradient your other screens
already use (`#FFF0F7 → #FBE9F8 → #F1E6FF`). The inbox has its own paler gradient today,
and your own theme file explains why it reads as white: its colours are low-saturation. The
app canvas fixed exactly that problem, and its text contrast is already measured. Nothing
new is invented.

**Your current web sent-bubble fails contrast, and the fix makes it look better.** See
`sent_bubble_contrast.png`. The bubble fades from purple to `#EB487F`, and the timestamp
and ticks sit in the bottom-right corner — the pinkest part:

| On the pink end of the bubble | Measured | Needs |
|---|---|---|
| White message text on `#EB487F` (today) | 3.64 : 1 | 4.5 ❌ |
| Amber read-tick on `#EB487F` (today) | 2.92 : 1 | 3.0 ❌ |
| White message text on `#C02B7F` (proposed) | 5.39 : 1 | 4.5 ✅ |
| Timestamp, white at 90%, on `#C02B7F` | 4.64 : 1 | 4.5 ✅ |
| Amber read-tick on `#C02B7F` | 4.33 : 1 | 3.0 ✅ |

`#C02B7F` is 60% of the way from purple to pink — the furthest the gradient can travel while
everything on it stays readable. Side by side, it reads as a richer jewel tone, not a duller
one. §1.7 explains what these ratios mean.

**Gradient bubbles on mobile must be measured, not assumed.** `mobile/DESIGN.md` reserves
"never inside list rows" for Skia, and lists `expo-linear-gradient` as the lightweight
option — so a gradient per bubble is allowed. But the same file says *"Target 60fps on a
mid-range Android phone."* So Block N-F measures it on the Samsung A03s. If it costs frames,
**both** platforms switch to one solid colour. They must never disagree.

## 0.6 Seed images

- **Every local test product shows a placeholder.** `supabase/seed.sql` has 43 rows using
  `https://placehold.co/600x400`, and `backend/scripts/seedLocal.js` line 699 gives that same
  placeholder to **all** of its product templates. That is the "600 × 400" you are seeing.
- **The live demo has broken images right now.** I tested all 62 Unsplash links in the
  seeds. Four return 404, and all four are on products in the demo tenant: *DSA Made Easy*,
  the *Samsung 24" monitor*, the *Nike Dri-FIT hoodie* and the *Philips iron + Usha heater*
  bundle. One of those dead links is also used by a product in `seed.sql`.
- **Re-running `seedDemo.js` will not fix them.** It skips any product whose title already
  exists (it logs `↩ Already exists`). The four production rows need a targeted update —
  that is part of Block V-D.
- **Both platforms crop images to fill the card** (`contentFit="cover"` on mobile,
  `object-fit: cover` on web). Real students upload tall phone photos, not neat 600×400
  rectangles. If the test images are all landscape, you will never see what the card cuts
  off. §1.9 has the worked example.

## 0.7 The CHANGELOG

`docs/CHANGELOG.md` is **4,646 lines, 265 KB, 62 entries**, touched by 42 commits. Two
problems, not one:

1. **Conflicts.** Both of you add entries at the top of the same file, so git sees two
   edits to the same lines. §1.1 explains why that always collides.
2. **Cost.** Every Claude Code session starts by reading the whole file. At 265 KB that is
   roughly 65,000 tokens of history — a large share of what a session can hold — before it
   has looked at a line of code.

**Your idea to split it is right.** I recommend one refinement: **one file per entry**, not
one file per person. §1.2 compares the two with a worked example. In short: conflicts
become impossible, entries still read in date order across everyone, and a new teammate
needs no setup at all.

**The old file stays exactly where it is, frozen.** Twenty-eight files link to entries in
it. Moving it would break every one of those links for no benefit.

## 0.8 Your point 4 — the theme and the product card

I read the new `mobile/src/theme/index.ts`. Eight size tokens (`nano 9` through
`display 24`), with `nano` fenced off for exactly two call sites in `ProductCard.tsx` and a
written reason. That is careful work.

The messages spec uses only these tokens, and it never uses `nano` — `micro` (11) is its
floor, for every label. The product card is not part of this phase, so I did not audit its
redesign.

## 0.9 Scope — Phase 6 splits into 6A and 6B

Everything in the build plan's Phase 6, plus your additions, does not fit in one phase. I
split it along one simple line:

> **6A changes how existing things look and behave. 6B adds new abilities that need
> database changes.**

| 6A — this runbook | 6B — the next runbook |
|---|---|
| Messages design pass, both platforms | **Mark as Sold** rework (schema + both platforms) |
| Chat wallpaper, both platforms | **Delete message**, WhatsApp-style |
| Reconcile the chat visual differences | `products.views` double-counting |
| Port the web's unread-line behaviour to mobile | |
| CHANGELOG system | |
| Real seed images | |
| Demo isolation in search | |

No later phase is renumbered: Phase 7 is still the community feed, Phase 8 still the social
graph.

Your standing rule applies from here: **every messages change in 6A is made on both
platforms, in this phase** — Neeraj on web, Vishwajeet on mobile.

## 0.10 What is in the design package

Unzip `phase6-design-assets.zip` into the repo root. It creates only `docs/design/`:

| File | What it is |
|---|---|
| `docs/design/MESSAGES_SPEC.md` | **The design.** Every colour, size and spacing, for both platforms |
| `docs/design/messages-mockup.html` | The spec drawn in a browser, with the real wallpaper |
| `docs/design/messages_proposed.png` | Inbox + conversation, rendered from the mockup |
| `docs/design/wallpaper_ground_options.png` | The two ground colours, side by side |
| `docs/design/sent_bubble_contrast.png` | Today's bubble vs the proposed one |
| `docs/design/assets/chat-pattern.svg` | **The master tile.** Never edited |
| `docs/design/assets/chat-pattern.png`, `@2x`, `@3x` | Master PNGs rendered from it |
| `docs/design/assets/make_tile_v3.py` | Your generator, unchanged |
| `docs/design/assets/export_pngs.py` | Renders the three PNGs from the SVG |
| `docs/design/assets/preview.png` | Your approved preview |

Nothing lands in `mobile/` or `frontend/`. Each of you copies your own platform's file in
during your own block, so nobody drops files into the other person's folder.

---

# PART 1 — THE CONCEPTS, FROM SCRATCH

Read this even where it looks familiar. The examples use your actual files.

## 1.1 How git decides that two changes conflict

When two branches both change a file, git tries to combine the changes automatically. It
can do that when the changes touch **different lines**. It gives up and calls it a
*conflict* when both changed **the same lines**, because it cannot know which version you
want.

**Worked example — why the CHANGELOG always conflicts.** Your file starts like this:

```
# CHANGELOG
## 2026-09-20 — Phase 5 V-C (Vishwajeet)
...
```

On Monday, both of you add a new entry directly under the title, on your own branches:

```
Vishwajeet's branch                    Neeraj's branch
# CHANGELOG                            # CHANGELOG
## 2026-09-28 — demo isolation   ←→    ## 2026-09-28 — changelog system
## 2026-09-20 — Phase 5 V-C             ## 2026-09-20 — Phase 5 V-C
```

Both branches changed *the line right after the title*. Git cannot put both there at once
without asking, so the second pull request to merge reports a conflict. It is not a
mistake either of you made — it is guaranteed by the shape of the file.

**Now the same Monday with one file per entry:**

```
Vishwajeet's branch adds:  docs/changelog/2026-09-28-vishwajeet-demo-isolation.md
Neeraj's branch adds:      docs/changelog/2026-09-28-neeraj-changelog-system.md
```

Two **new** files with different names. Neither branch changed any existing line of any
existing file, so there is nothing to combine and nothing to conflict. Git just keeps both.
This is not "fewer conflicts" — it is conflicts made impossible.

## 1.2 One file per person, or one file per entry?

Both stop the conflicts. Here is how they compare on the things you actually do with a
changelog.

**Task: "What changed this week?"**

*One file per person* (`vishwajeet.md`, `neeraj.md`): open both files, read the top of each,
and interleave them by date in your head. Add a third teammate and you open three.

*One file per entry*: filenames start with the date, so `ls docs/changelog/` already lists
everything in time order, across everyone. Or run one command that prints the newest eight.

**Task: "Vishwajeet leaves a note for Neeraj."**

*Per person*: the note lives in `vishwajeet.md`. Neeraj only sees it if he remembers to read
the other person's file — and a changelog exists precisely to reach the *other* person.

*Per entry*: the entry carries a `For: Neeraj` line. Neeraj runs one command to list every
entry addressed to him.

**Task: "Start a Claude Code session."**

*Per person*: two files that each keep growing forever — 265 KB split in two is still huge.

*Per entry*: read the newest eight files. A few kilobytes, every time.

**Task: "A third person joins."**

*Per person*: create a file, then update every instruction that lists which files to read.

*Per entry*: they write entries with their own name in the filename. Nothing else changes.

That is why this runbook uses one file per entry. It is also how large projects solve this
exact problem.

## 1.3 A generated column — a fact the database keeps true by itself

Block V-A has to tell demo universities apart from real ones. There is no field for that
today; the demo tenant is recognised only by its domain, `demo.yahora.com`.

The obvious fix is a new column, `is_demo`, set to `true` on the demo row. But then someone
has to remember to set it — in the migration, in `seed.sql`, in every environment, forever.
Forget once and the demo tenant silently counts as real.

A **generated column** removes the remembering. You give PostgreSQL a rule instead of a
value:

```sql
alter table public.universities
  add column is_demo boolean
  generated always as (coalesce(domain = 'demo.yahora.com', false)) stored;
```

**Worked example.** After that one statement, the table looks like this — and you never
typed a single `true` or `false`:

| name | domain | is_demo |
|---|---|---|
| IIIT Kurnool | iiitk.ac.in | false |
| NIET | niet.co.in | false |
| Yahora University (Demo) | demo.yahora.com | **true** |

Now run `supabase db reset`. `seed.sql` inserts the demo university again, without
mentioning `is_demo` at all, and the database fills in `true` on its own. Production gets
it from the migration; local gets it from the seed. Nobody can forget.

Two small words in that statement are worth knowing:

- **`coalesce(..., false)`** — if a university somehow had no domain, `domain = '...'`
  would be *unknown* rather than false. `coalesce` turns "unknown" into `false`.
- **`stored`** — the value is calculated once when a row is written and saved, so reading
  it costs nothing.

## 1.4 "Fail closed" — what to do when you cannot tell who is asking

The new search function first looks up the person searching, to learn whether they are a
demo account. What if that lookup finds nobody — a deleted account, a half-created one, a
bug somewhere upstream?

There are two ways to fail:

- **Fail open:** "I don't know who you are, so I'll treat you as a real student." The
  unknown caller sees every real student.
- **Fail closed:** "I don't know who you are, so you see nothing."

**Worked example.** A demo guest's account is removed by the midnight cleanup while their
app is still open. Their token still works for a few more minutes. They type "a" in
search. Fail-open shows them real students. Fail-closed shows an empty list — slightly
worse for them, and completely safe for everyone else.

When the thing being protected is other people's personal information, **always fail
closed.** The prompt for V-A requires it.

## 1.5 `background-attachment` — why "local" would have moved the wallpaper

In CSS, when an element has a background image **and** its content scrolls inside it,
`background-attachment` decides what the background is glued to:

| Value | The background is glued to… | When the messages scroll, the wallpaper… |
|---|---|---|
| `scroll` (the default) | the element's own box | **stays still** ✅ |
| `local` | the element's **content** | **moves with the messages** ❌ |
| `fixed` | the browser window | stays still, but is unreliable on phones and costs repaints |

**Worked example.** `.messagesContainer` is 600 px tall and holds 2,000 px of messages, so
it scrolls (`overflow-y: auto`). The user scrolls up by 300 px.

- With `scroll`, the tile stays exactly where it was; the bubbles slide over it. That is
  WhatsApp.
- With `local`, the tile slides up 300 px along with the bubbles, as if it were printed on
  the messages.

The wallpaper document wants the first behaviour and wrote the second value. **The fix is
to not write `background-attachment` at all** — the default is already right.

On mobile the same idea is built differently: the wallpaper is a separate layer **behind**
the message list, not inside it. It has an extra reason to stay outside: your chat list is
`inverted` (flipped upside down so the newest message sits at the bottom), and anything
inside it would be flipped too.

## 1.6 `@1x`, `@2x`, `@3x` — one picture, three files

Phones pack different numbers of real pixels into the same physical size. React Native
hides this behind **dp**: you write sizes in dp, and the phone multiplies by its
*density*.

| Phone | Screen | Density (approx.) | 420 dp becomes |
|---|---|---|---|
| Samsung A03s | 720 × 1600 | 2.0 | 840 real pixels |
| POCO X2 | 1080 × 2400 | 2.75 | 1,155 real pixels |
| OPPO K14 | 1080 × 2400 | 2.75 | 1,155 real pixels |

If you shipped only the 420-pixel PNG, the POCO would have to stretch it almost three times
— blurry. So you ship three files, and React Native picks the best one for each phone:

- the Samsung (2.0) takes `chat-pattern@2x.png` (840 px) and shows it at exactly 420 dp;
- the POCO and the OPPO (2.75) take `chat-pattern@3x.png` (1,260 px) and scale it down
  slightly to 420 dp.

In code you only ever write `require('../../assets/chat-pattern.png')`. React Native finds
the `@2x` and `@3x` siblings by their names.

**The one risk worth watching.** A repeating image on Android is drawn by a different code
path from a normal image. If that path ever tiled the file at its *own* pixel size instead
of scaling it to 420 dp, the POCO and OPPO would draw 1,260-pixel tiles — about 458 dp
instead of 420, so every doodle about 9% too big — while the Samsung (840 px ÷ 2.0 = exactly
420) would look right. That precise pattern — **correct on the Samsung, too big on the
POCO and OPPO** — is what Neeraj's side-by-side check in Block N-F is designed to catch.

## 1.7 What a contrast ratio means

A contrast ratio compares how much light two colours give off. **1 : 1** means identical —
invisible. **21 : 1** is black on white, the maximum.

The accessibility standard your codebase already follows (WCAG AA) sets two bars:

- **4.5 : 1** for normal-size text — message text, timestamps, labels;
- **3 : 1** for icons and other non-text shapes — the read ticks, the send arrow.

**Worked example.** White text on your brand purple `#800080` is **9.42 : 1** — very easy
to read. White text on `#EB487F`, the pink your web bubble fades into, is **3.64 : 1** —
below the bar. Your eyes adjust and it seems fine on your screen at full brightness; in
sunlight, on a cheap panel, or for someone with weaker eyesight, the bottom-right corner of
every sent bubble — exactly where the time and ticks sit — gets hard to read.

Moving the gradient's end to `#C02B7F` raises that corner to **5.39 : 1**. It is still
clearly a purple-to-pink gradient; it just stops before it gets too light.

## 1.8 Why the design is a file, and the prompts say "invent nothing"

Suppose both of your prompts said *"make the chat screen beautiful, in our brand
colours."* Two Claude Code sessions, reading two different codebases, would each make
reasonable, attractive and **different** choices: one picks radius 16, the other 20; one
uses 14 px text, the other 15; one keeps the date lines, the other drops them.

Each result looks fine on its own. Next to each other, they look like two different
products — which fails the one requirement that matters here.

So the design lives in one file, `docs/design/MESSAGES_SPEC.md`, with exact values, and both
prompts say: *implement this, invent nothing, and if something is missing, stop and ask.*
If you later want to change a value, you change the spec first, then both platforms in the
same phase.

It is the same idea as the wallpaper tile — one asset, used unmodified by both sides —
applied to the whole screen.

## 1.9 Why the test images must include tall photos

Both platforms show product photos with *cover* cropping: the photo is scaled until it
fills the card, and whatever sticks out is cut off.

**Worked example.** A student photographs a bicycle standing upright in a hostel corridor,
phone held vertically: a tall 3:4 photo. The card is roughly square. *Cover* fills the
square using the photo's full width, so the top and bottom are cut. If the bicycle sat low
in the frame, the card now shows handlebars, a wall and half a saddle — and no wheels.

With `placehold.co/600x400` placeholders you can never see that happen, because a
placeholder has no content to lose. That is why Block N-C's image set must include tall
photos, and why Neeraj reviews every photo **cropped exactly the way the card crops it** —
the review page he generates does that for him.

**Why not keep using direct Unsplash links?** Four of your 62 already return 404 — the
photographer removed the photo, and your link died with it. So the new set comes with a
checker that visits every image link in every seed file and reports the dead ones. Run it
whenever the seeds change.

## 1.10 Marking a message as read only once it has been seen

Today the web marks messages read only when they actually appear on screen. Mobile marks a
conversation read as soon as it opens. Block V-E makes mobile match the web.

**Worked example — why it matters.** Priya sends Rahul eight messages while he is in class.
Rahul opens the chat, sees only the last three, and gets called away before scrolling up.

- *Marked read on open:* all eight turn to read ticks on Priya's screen. She thinks he
  read her question about the price. He never saw it.
- *Marked read when seen:* three ticks turn amber, five do not. When Rahul comes back,
  the chat opens at the **"5 unread messages"** band, right where he stopped.

On mobile, `FlatList` reports which rows are visible through `onViewableItemsChanged`. The
app collects the ids of newly visible, unread messages and sends them to the server in one
batch, rather than one request per message.

There is one more rule the web learned the hard way: **once the "N unread" band has been
placed, it stays put while you read.** If it moved every time a message flipped to read, the
band would jump down the screen under the user's finger. So the band's position is decided
once, when the chat opens, and read receipts do not move it.

---

# PART 2 — FILES, OWNERSHIP AND THE DAY-BY-DAY

## 2.1 Every file this phase touches

**Vishwajeet**

```
supabase/migrations/<new>_search_demo_isolation.sql         V-A
backend/API.md                                              V-A
mobile/assets/chat-pattern.png, @2x, @3x   (copied in)      V-B
mobile/app/chat/[contactId].tsx                             V-B, V-C, V-E
mobile/app/(tabs)/messages.tsx                              V-C
mobile/src/theme/index.ts                                   V-C
mobile/src/components/ScreenGradient.tsx                    V-B, V-C
supabase/seed.sql                                           V-D
backend/scripts/seedLocal.js                                V-D
backend/scripts/seedDemo.js                                 V-D
docs/changelog/<one new file per block>                     every block
```

**Neeraj**

```
docs/changelog/README.md                     (new)          N-A
scripts/changelog.mjs                        (new)          N-A
docs/CHANGELOG.md                (a banner at the top only) N-A
CLAUDE.md, backend/CLAUDE.md, docs/YAHORA_BUILD_PLAN.md     N-A  (changelog instructions only)
docs/design/                                 (unzipped)     N-B
scripts/seed-images/                         (new)          N-C
frontend/public/patterns/chat-pattern.svg    (copied in)    N-D
frontend/src/pages/messages/Messages.module.css             N-D, N-E
frontend/src/pages/messages/Messages.jsx                    N-E
docs/changelog/<one new file per block>                     every block
```

**Nobody touches, this phase or any phase:**

```
backend/src/app.js
backend/src/middleware/
backend/src/config/
backend/src/utils/respond.js
docs/design/assets/chat-pattern.svg        (the master tile)
```

## 2.2 Ownership — clean, and one new shared folder

No ownership loan is needed. Every `mobile/` file is Vishwajeet's, every `frontend/` file
is Neeraj's, and the database is Vishwajeet's.

**Two things are new:**

- **`docs/changelog/` is shared, with one rule:** anyone adds new files; nobody edits
  another person's entry, except to fix a broken link.
- **Neeraj owns two new tools in the root `scripts/` folder:** `scripts/changelog.mjs` and
  `scripts/seed-images/`. The existing `scripts/verify-baseline.sh` is untouched.

**Seed images cross the line, deliberately, in one direction.** The seed files are
Vishwajeet's (`backend/CLAUDE.md` lists `seedDemo.js` as his, with "Neeraj requests
additions"). So Neeraj builds and reviews the *catalogue* of images — a new file he owns —
and Vishwajeet's Claude Code applies it to the seed files. The human judgement is
Neeraj's; the files stay Vishwajeet's. Neeraj also never writes SQL, and this split keeps
it that way.

## 2.3 The day-by-day

| Day | Vishwajeet | Neeraj |
|---|---|---|
| **1** | V-0 setup. **Joint 20-minute design review.** **V-A** — demo isolation migration, pushed to production by evening | N-0 setup + the "before" evidence for the demo leak. **N-A** — changelog system, merged by midday. **N-B** — design package + joint review |
| **2** | **V-B** — mobile wallpaper (morning). **V-C** starts — mobile inbox | **N-C** — seed-image catalogue: collect candidates, build the review page |
| **3** | **V-C** — mobile conversation screen | **N-C** — review every photo, run the checker, merge by midday. **N-D** — web wallpaper |
| **4** | **V-C** finishes. **V-D** — apply the catalogue to the seeds, fix the four live demo images | **N-E** — web messages redesign |
| **5** | **V-E** — unread line and read-on-sight, ported to mobile | **N-E** finishes. **N-F** round 1 — isolation, images, gradient performance, mobile design |
| **6** | **V-E** finishes. Fix whatever N-F finds | **N-F** round 2 — unread behaviour, side-by-side acceptance, device matrix. **Joint sign-off** |

**Three dependencies, and nothing else waits on anything:**

1. **N-A merges before anyone writes a Phase 6A changelog entry.** Until it lands, keep your
   notes in a scratch file. This is the only reason N-A is first thing on Day 1.
2. **N-C's catalogue merges before V-D.** Neeraj on Day 3 at midday; Vishwajeet uses it on
   Day 4.
3. **The design review happens on Day 1, before V-C or N-E write a line.** If you change a
   value, you change it in `MESSAGES_SPEC.md` — never only in one platform's code.

## 2.4 What "done" means for this phase

- 👁️ A demo account searching finds **only** demo accounts; a real student **never** sees
  one — on production.
- 👁️ The chat wallpaper appears on both platforms, stays still while messages scroll, and
  reads as the same wallpaper with a laptop and a phone side by side.
- 👁️ The inbox and conversation screens match `MESSAGES_SPEC.md` on both platforms, and
  both of you agree they look **better**, not merely unbroken.
- 👁️ No placeholder images remain in local seed data, and the live demo has no broken
  images.
- 👁️ On mobile, a chat opens at the "N unread messages" band, and messages turn read only
  once they have been on screen.
- Every Phase 6A changelog entry lives in `docs/changelog/`, and two same-day entries
  merged without a conflict.

---

# TRACK 1 — VISHWAJEET, MANUAL STEPS

## Block V-0 — Setup (30 minutes, Day 1)

```bash
cd ~/path/to/yahora
git checkout main && git pull origin main
git checkout infiniper && git merge main && git push origin infiniper
cd mobile && npm install && cd ..
cd backend && npm install && cd ..
supabase start
supabase db reset
node backend/scripts/seedLocal.js
node backend/scripts/seedDemo.js
```

`supabase db reset` wipes your local database, replays all 17 migrations from the
beginning, then runs `seed.sql`. If any migration is broken, you find out here rather than
on production.

**👁️ CHECKPOINT V-0.**

1. `supabase db reset` finished without an error.
2. **Expo Go matches SDK 57** on your POCO. Open Expo Go → Settings (or Profile) → it lists
   the SDK versions it supports. If 57 is not there, update Expo Go from the Play Store.
   The app is on SDK 57 now, not 56.
3. `npx expo start` in `mobile/` runs, and the app opens on your phone.

### The joint design review (20 minutes, with Neeraj)

As soon as Neeraj has finished N-B, sit together and open these three images at full size.
Neeraj's block explains how to get them onto a phone properly.

1. `docs/design/messages_proposed.png` — does this look like the app you want?
2. `docs/design/wallpaper_ground_options.png` — do you agree that B beats A?
3. `docs/design/sent_bubble_contrast.png` — do you agree the right-hand bubble looks at
   least as good?

**If you want to change anything, change it in `docs/design/MESSAGES_SPEC.md` now,**
before either of you writes code. Changing a value after both platforms have built it
means changing it twice.

## Block V-A — Demo isolation in search (half a day, Day 1)

Read §0.3, §1.3 and §1.4 first. They explain every decision in this prompt.

**Wait for one thing before you push to production:** Neeraj's N-0 records the "before"
evidence — that a demo token can list real students on production. It takes him ten
minutes, and it proves the fix changed something rather than assuming it did.

Run prompt **CC-V1** from Track 2.

**What to read in the diff.** Claude Code checks that the migration replays; it cannot
judge whether the rule is right. Confirm by eye:

- It is **one new file** in `supabase/migrations/`. No existing migration changed.
- `is_demo` is a **generated** column — `generated always as (...) stored` — not a plain
  column that something has to set.
- The function still has `security invoker` and `set search_path = public, pg_temp`,
  still selects `u.full_name::text` (the Phase 5 fix), and still orders exact match →
  same campus → rank.
- When the viewer cannot be found, the function **returns nothing** (§1.4).

**👁️ CHECKPOINT V-A.** In Supabase Studio at `http://127.0.0.1:54323` → SQL Editor, run
the three queries Claude Code gives you. You should see:

| Searching as | Result |
|---|---|
| a real seeded student | real students only — no `@demo.yahora.com` accounts |
| a demo persona (e.g. Rahul Sharma of the demo tenant) | demo accounts only |
| `'00000000-0000-4000-8000-000000000000'` (nobody) | zero rows |

Then push, and post the entry:

```bash
supabase db push
node scripts/changelog.mjs new vishwajeet "Search: demo accounts isolated both ways" --phase 6A --block V-A --for neeraj
```

Neeraj re-runs his production check afterwards in N-F.

## Block V-B — Mobile chat wallpaper (half a day, Day 2)

Read §1.5 and §1.6 first.

Copy the three PNGs from the design package into the app's asset folder:

```bash
cp docs/design/assets/chat-pattern.png docs/design/assets/chat-pattern@2x.png \
   docs/design/assets/chat-pattern@3x.png mobile/assets/
```

**Copy, never move.** `docs/design/assets/` keeps the masters. `mobile/assets/` gets
copies.

Run prompt **CC-V2**.

**👁️ CHECKPOINT V-B.** On your POCO:

1. Open a chat. The doodles are clearly visible, and every bubble is fully solid on top of
   them.
2. Scroll hard in both directions. **The wallpaper does not move.**
3. There is no straight line anywhere in the pattern — no seam.
4. The bicycle is about **three send-buttons wide**. If it looks noticeably bigger, stop
   and tell Claude Code — that is the Android sizing risk from §1.6. Do **not** fix it by
   resizing the PNGs.

## Block V-C — Mobile messages redesign (2.5 days, Days 2–4)

**This is the block that answers "make it beautiful".** It implements
`docs/design/MESSAGES_SPEC.md` on both mobile screens. Read the spec from top to bottom
before running the prompt — you are the reviewer, and you can only review against
something you have read.

Run prompt **CC-V3**. It is long on purpose.

**What changes, in plain words:**

- The **inbox** moves onto the app's pink-to-lilac canvas; rows lose their card
  backgrounds and sit directly on it; unread rows get bold names, purple times and a
  gradient badge; each row shows the listing the chat is about.
- The **conversation** keeps its lavender ground (with the V-B wallpaper), the sent bubble
  becomes the measured purple-to-`#C02B7F` gradient, received bubbles become white with
  near-black text, read ticks turn **amber** (they are light blue on mobile today), and the
  date labels become simple centred pills.
- A single switch, `SENT_BUBBLE_STYLE`, lets the bubble change between the gradient and one
  solid colour. Neeraj's performance test in N-F decides which one ships.

**👁️ CHECKPOINT V-C.** This needs your eyes more than any other checkpoint in the phase.

1. Put your phone next to `docs/design/messages_proposed.png` on your laptop. The screens
   should read as the same design. Not pixel-identical — the same design.
2. Walk both screens at default font size. You are not hunting bugs (Neeraj does that in
   N-F). You are asking one question: **is it better?** If something looks worse, say which
   thing and why, and fix it in the spec first.
3. Flip `SENT_BUBBLE_STYLE` to `'solid'`, reload, look, then flip it back to
   `'gradient'`. Both must work, because Neeraj needs both for his measurement.

Post the entry with `--for neeraj`, and say explicitly that the mobile screens are ready for
N-F.

## Block V-D — Real seed images, and the live demo fix (half a day, Day 4)

**Prerequisite:** Neeraj's `scripts/seed-images/catalogue.json` is merged into `main`.
Pull it first.

Run prompt **CC-V4**. It does three things:

1. Replaces every `placehold.co` link in `supabase/seed.sql` with the catalogue's photos.
2. Makes `backend/scripts/seedLocal.js` read its photos from the catalogue instead of giving
   every product the same placeholder.
3. Replaces the four dead links in `backend/scripts/seedDemo.js` — and writes the SQL to
   repair the **four products already on production**, because re-running `seedDemo.js`
   will not touch rows that already exist (§0.6).

**👁️ CHECKPOINT V-D — local.**

```bash
supabase db reset
node backend/scripts/seedLocal.js
node backend/scripts/seedDemo.js
node scripts/seed-images/check.mjs
```

The checker must end with **0 dead links**. Then open the marketplace on your phone: real
photos, no "600 × 400" anywhere.

**👁️ CHECKPOINT V-D — production.** This is you, touching production, so go slowly.

1. In Supabase Studio **for production**, run the `select` Claude Code gave you **first**.
   It must return **exactly four rows**: the four demo products, with their dead links.
2. Only if it returns four, run the matching `update`.
3. Run the `select` again. Four rows, new links.
4. Open "Explore Live Demo" on the live site and look at those four products.

If step 1 returns anything other than four rows, stop. Do not run the update.

## Block V-E — Unread line and read-on-sight, ported to mobile (1.5 days, Days 5–6)

Read §1.10 first.

The web already does this properly — 13 references in `Messages.jsx` against 2 in the
mobile chat screen. This block ports the web's behaviour; it does not invent a new one.

Run prompt **CC-V5**.

**👁️ CHECKPOINT V-E.** Neeraj tests every scenario in N-F, on two phones. Yours is one
check: with a second account, send yourself six messages while your chat is closed, then
open it. It should open at a **"6 unread messages"** band, with the first unread message
just below it.

---

# TRACK 2 — VISHWAJEET, CLAUDE CODE PROMPTS

## The session opener changes this phase

**Until Neeraj's N-A is merged on Day 1**, use the old opener, but tell it the file is
frozen:

```
Before we start: read CLAUDE.md, the most recent entries at the top of
docs/CHANGELOG.md, backend/API.md, and docs/CURRENT_STATE.md. Summarise
in 5 bullets what changed most recently and what I should be careful
about. Do not add anything to docs/CHANGELOG.md — it is being frozen
today.
```

**From the moment N-A is merged, use this one for the rest of the project:**

```
Before we start: read CLAUDE.md, then run
`node scripts/changelog.mjs recent 8` and read everything it prints,
then read backend/API.md and docs/CURRENT_STATE.md. Summarise in 5
bullets what changed most recently and what I should be careful about.
```

Every prompt below ends by filing its changelog entry with `scripts/changelog.mjs`. If a
prompt runs before N-A has merged, Claude Code will find no script — the prompts tell it to
print the entry instead, and you file it after pulling.

## CC-V1 — Demo isolation in search

```
Phase 6A, Block V-A. One migration. I own the database.

THE PROBLEM
public.search_users() has no demo filter and no campus filter. POST
/api/auth/demo-login has no auth, no captcha and no rate limit, and it
returns a real session token for a brand-new account in the demo
university. So anyone on the internet can get a token in one request and
then call GET /api/users/search to list real students' names, usernames,
avatars and universities on every campus. In the other direction, real
students would see demo accounts in search.

THE RULE TO IMPLEMENT
  - a real student searching sees only real students
  - a demo account searching sees only demo accounts
  - if the viewer cannot be identified, return ZERO rows (fail closed)

The demo tenant is the university whose domain is 'demo.yahora.com'.
demoLogin in backend/src/modules/auth/auth.controller.js finds it that
way, and supabase/seed.sql inserts it that way.

WHAT TO DO
1. Run: supabase migration new search_demo_isolation

2. Add a GENERATED column to public.universities:

     alter table public.universities
       add column is_demo boolean
       generated always as (coalesce(domain = 'demo.yahora.com', false)) stored;

   It must be generated, not a plain column that something sets. That
   way seed.sql and every environment get the right value with no extra
   code, and nobody can forget to set it.

3. CREATE OR REPLACE FUNCTION public.search_users with the same
   signature and the same RETURNS TABLE as the current definition in
   20260919093440_search_users_full_name_cast.sql. Read that file first
   and preserve, exactly:
     - language plpgsql, stable
     - security invoker (do NOT change it to definer)
     - set search_path = public, pg_temp
     - the u.full_name::text cast from Phase 5
     - where u.username is not null, and the three match conditions
     - the ORDER BY: exact match, then same campus, then rank
     - limit p_limit

   Change only this:
     - Look up the viewer's university_id AND that university's is_demo
       in one query (join users to universities on the viewer's id).
     - If that lookup finds nothing, RETURN immediately with no rows.
     - Add  and un.is_demo = viewer_is_demo  to the WHERE clause.

4. Do not change the controller in backend/src/modules/user/. It already
   passes req.user.id as p_viewer, and this is a database-only fix.

5. Update backend/API.md for GET /api/users/search: results are always
   from the same world as the viewer — real students see real students,
   demo accounts see demo accounts — and an unidentifiable viewer gets an
   empty list.

AFTER WRITING IT
Run: supabase db reset
Then give me three SQL queries to paste into Studio:
  (a) search as a real seeded student -> must contain no demo accounts
  (b) search as a demo persona from seedDemo.js -> demo accounts only
  (c) search as '00000000-0000-4000-8000-000000000000' -> zero rows
Pick real UUIDs from the seed data for (a) and (b) and tell me which
people they are.

State explicitly whether anything in this migration could behave
differently on production than on an empty local database. (Adding a
stored generated column rewrites the universities table — say whether
that matters at its size.)

Do NOT run supabase db push. I run anything that touches production.

REPORT, DO NOT FIX
If you find any OTHER place where a demo account can read real students'
personal details, list it at the end. Do not change it in this block.

CHANGELOG
If scripts/changelog.mjs exists, file an entry with:
  node scripts/changelog.mjs new vishwajeet "Search: demo accounts isolated both ways" --phase 6A --block V-A --for neeraj
and fill in its sections. If the script does not exist yet, do NOT edit
docs/CHANGELOG.md (it is frozen) — print the entry at the end of your
reply and I will file it.

HARD CONSTRAINTS
- Create exactly ONE new migration file. Modify no existing migration.
- Do NOT touch backend/src/, frontend/ or mobile/.
- Do NOT add rate limiting or a captcha to demo login. That is a later
  phase.
- Do NOT add pagination or new parameters to search_users.
- Do NOT run supabase db push.
```

## CC-V2 — Mobile chat wallpaper

```
Phase 6A, Block V-B. Add the chat wallpaper to the mobile conversation
screen. Presentation only.

THE ASSET — already in place, do NOT change it
  mobile/assets/chat-pattern.png      (420 x 420)
  mobile/assets/chat-pattern@2x.png   (840 x 840)
  mobile/assets/chat-pattern@3x.png   (1260 x 1260)
One seamless doodle tile, transparent background. React Native picks the
right density file by its suffix, so reference only
require('../../assets/chat-pattern.png') and it tiles at 420 dp on every
phone. The website tiles the identical artwork at 420 px, and the two
must match. The masters live in docs/design/assets/ — never edit, resize
or regenerate any of these files.

Read docs/design/MESSAGES_SPEC.md section 2, "Ground and wallpaper",
before starting.

WHERE
mobile/app/chat/[contactId].tsx — the open conversation only. Do NOT
touch mobile/app/(tabs)/messages.tsx.

WHAT TO BUILD
1. Find what currently draws the chat background. The root style uses
   colors.chatCanvas; check whether <ScreenGradient variant="chat" /> (or
   anything else with glows) is also rendered, and tell me what you
   found.
2. The ground stays colors.chatCanvas (#EDE6F5). Remove the chat glows.
   Do not add a new ground colour.
3. Wrap the message list in a container View with position 'relative'
   and flex 1. Inside it, FIRST render the wallpaper layer:
     - React Native's own Image (or ImageBackground) from 'react-native',
       with resizeMode="repeat", style StyleSheet.absoluteFill,
       pointerEvents="none".
     - NOT expo-image. expo-image has no repeat mode. This is the one
       image in the app that deliberately does not use expo-image — say
       so in a comment, so nobody "fixes" it later.
   THEN render the FlatList on top of it.
4. The wallpaper must sit OUTSIDE the FlatList. The list is `inverted`
   (flipped so the newest message is at the bottom); anything inside it
   would be flipped too, and would scroll with the messages.
5. Give the FlatList's style AND its contentContainerStyle
   backgroundColor 'transparent'. If either paints a colour, it covers
   the wallpaper completely — this is the most common way this change
   fails, so check it first if the pattern does not appear.
6. The wallpaper covers only the thread: below the header and product
   snippet, above the composer.
7. Stop using the 'chat' variant of ScreenGradient on this screen. Leave
   ScreenGradient.tsx itself alone; Block V-C cleans it up.

HARD CONSTRAINTS
- Do NOT change bubbles, spacing, fonts or the composer. That is V-C.
- Do NOT add any npm dependency. Do NOT install react-native-svg.
- Do NOT edit, resize, recompress or regenerate the PNGs.
- Do NOT touch backend/, supabase/ or frontend/.
- Do NOT change message logic, pagination, realtime or scrolling
  behaviour.

VERIFY AFTER — report each
1. What drew the background before, and what draws it now.
2. Confirm the wallpaper is outside the inverted FlatList.
3. Confirm the FlatList and its contentContainerStyle are transparent.
4. npx tsc --noEmit in mobile/ passes.
5. You cannot see the phone, so say plainly: the tile size must be
   checked on the device. The bicycle doodle should be about three
   send-buttons wide. If it looks bigger on the POCO or OPPO than on the
   Samsung, that is the Android repeat-sizing risk — report it, do not
   work around it by resizing the images.

CHANGELOG
File with: node scripts/changelog.mjs new vishwajeet "Mobile chat wallpaper" --phase 6A --block V-B --for neeraj
(or print the entry if the script does not exist yet).
```

## CC-V3 — Mobile messages redesign

```
Phase 6A, Block V-C. Redesign the two mobile messages screens to match
the shared spec exactly. This is the largest block in the phase. Read
all of it before changing anything.

THE ONE RULE
docs/design/MESSAGES_SPEC.md is the design. Implement it. INVENT
NOTHING. The website is implementing the same file in parallel, and the
two platforms must look like one product. If the spec does not cover
something you need, keep the current behaviour and list it at the end —
do not make a design decision yourself.

Visual reference: docs/design/messages-mockup.html and
docs/design/messages_proposed.png. But we need to make it more beautiful and comfortable than it.

Also read mobile/DESIGN.md sections 6, 7 and 9 — the performance rules
and the anti-patterns (Bree Serif ships only weight 400; no emoji as
icons; no web hover logic).

SCREENS
  mobile/app/(tabs)/messages.tsx      the inbox
  mobile/app/chat/[contactId].tsx     the conversation

TOKENS — mobile/src/theme/index.ts
Add exactly the tokens in spec section 3, plus:
  export const SENT_BUBBLE_STYLE: 'gradient' | 'solid' = 'gradient';
Every colour in both screens comes from theme tokens. No hex values in
the screen files.

INBOX — spec section 1
- Canvas: <ScreenGradient variant="app" />.
- Header, filter field, rows, dividers, unread styling, the badge
  (99+ above 99), the product chip — exactly as specified.
- Rows have NO card background.
- One shared time formatter implementing the spec's time table, used by
  both the inbox and the conversation's date chips. If a formatter
  already exists, change it to match the table rather than adding a
  second one.
- Initial load shows skeleton rows, not a spinner (DESIGN.md section 6).

CONVERSATION — spec section 2
- Header, product snippet (price in Bree Serif 400, never bold), date
  chip (a pill, no lines either side), unread band styling, bubbles,
  meta row, ticks, composer — exactly as specified.
- Ticks: READ is amber (the new chatReadTick token). Today it is
  blueLight; that changes.
- Bubble runs: the spec defines a run as same sender, same day, each
  within 5 minutes of the previous. Check the current run logic; if it
  differs, change it to the spec and tell me what it was.
- No shadows on mobile bubbles (spec section 5).
- Initial load shows skeleton bubbles, not a spinner.
- Do NOT change WHEN or WHERE the unread band appears. Only its look.
  Its behaviour is ported in Block V-E.

THE SENT BUBBLE
- SENT_BUBBLE_STYLE === 'gradient': a 135-degree gradient from
  colors.purple to colors.bubbleMineEnd, using expo-linear-gradient
  (already installed). Do not use experimental style props.
- SENT_BUBBLE_STYLE === 'solid': plain colors.bubbleMineSolid.
- The row component must be memoized, and the gradient must not remount
  on every render. Neeraj measures scrolling performance on a low-end
  phone with each setting; the result decides which one ships on both
  platforms.

CLEAN-UP, AFTER BOTH SCREENS WORK
- Remove the 'inbox' and 'chat' variants from
  mobile/src/components/ScreenGradient.tsx, and the tokens inboxTop,
  inboxMid, inboxBottom — but only after grep shows nothing else uses
  them. Show me the grep.

HARD CONSTRAINTS
- Do NOT change data fetching, pagination, realtime, sending, or how
  messages are marked read.
- Do NOT change navigation.
- Do NOT add a dependency or a font.
- Keep using AppText and AppTextInput (the Phase 5 font-scale clamp).
- Do NOT touch the wallpaper layer added in Block V-B.
- Do NOT touch backend/, supabase/ or frontend/.

VERIFY AFTER — report each
1. A checklist of every item in spec sections 1 and 2, each marked
   done / not applicable / differs (and why).
2. Everything the spec did not cover that you left as it was.
3. Confirm SENT_BUBBLE_STYLE works in both settings.
4. The clean-up grep output.
5. npx tsc --noEmit in mobile/ passes.

CHANGELOG
File with: node scripts/changelog.mjs new vishwajeet "Mobile messages redesign" --phase 6A --block V-C --for neeraj
In "What NOT to do yet", tell Neeraj the screens are ready for N-F.
```

## CC-V4 — Real seed images, and the live demo repair

```
Phase 6A, Block V-D. Replace placeholder product images in the seed
data with real photos, and prepare a repair for four broken images on
production. Data only.

THE INPUT
scripts/seed-images/catalogue.json — built and reviewed by Neeraj in
Block N-C. Read its shape before starting. Each entry is keyed by a
product's exact title and holds one or more image URLs. Use ONLY
photos from this file. Never invent or search for image URLs yourself.

PART 1 — supabase/seed.sql
Every product row that uses https://placehold.co/600x400 gets the image
array from the catalogue entry with the same title. Also replace the
one dead Unsplash link (photo-1455885666463) if it appears here.
If a product's title is NOT in the catalogue, STOP and list it. Do not
fall back to a placeholder.

PART 2 — backend/scripts/seedLocal.js
Line 699 gives every product the same placeholder. Make each product
template take its images from the catalogue by title. Read the JSON with
fs.readFileSync and JSON.parse, which works on every Node version. If a
title is missing from the catalogue, throw an error naming it — a silent
placeholder is exactly the bug we are removing.

PART 3 — backend/scripts/seedDemo.js
Four image links return 404. Replace each with the catalogue's photos
for that product:
  photo-1455885666463  DSA Made Easy — Narasimha Karumanchi
  photo-1527443224154  Samsung 24" FHD IPS Monitor
  photo-1556821840     Nike Dri-FIT Oversized Hoodie
  photo-1615224143859  Philips Dry Iron + Usha Room Heater
Confirm each title against the file. Leave every other demo image alone.

PART 4 — the production repair (WRITE it, do NOT run it)
seedDemo.js skips products whose title already exists, so re-running it
will not fix those four rows on production. Write SQL for me to run in
Studio against production, in two steps:
  (a) a SELECT listing the four products — title and current image_urls
      — restricted to the university whose domain is 'demo.yahora.com'.
      It must return exactly four rows.
  (b) ONE UPDATE ... FROM (VALUES ...) statement setting image_urls for
      exactly those four products, restricted to that same university,
      with RETURNING title, image_urls so I can see what changed.
Match on exact title AND the demo university. Nothing else.

AFTER
Run, in order:
  supabase db reset
  node backend/scripts/seedLocal.js
  node backend/scripts/seedDemo.js
  node scripts/seed-images/check.mjs
Report the checker's result. It must be 0 dead links.
Then show:  grep -c "placehold.co" supabase/seed.sql backend/scripts/*.js
It must be 0 everywhere.

HARD CONSTRAINTS
- Change image URLs only. No schema, no new columns, no other product
  fields.
- Do NOT touch mobile/ or frontend/.
- Do NOT run anything against production. Do NOT run supabase db push.
- Do NOT edit scripts/seed-images/ — that is Neeraj's. If the catalogue
  is wrong or incomplete, stop and tell me.

CHANGELOG
File with: node scripts/changelog.mjs new vishwajeet "Real seed images + live demo repair" --phase 6A --block V-D --for neeraj
```

## CC-V5 — Unread line and read-on-sight, ported to mobile

```
Phase 6A, Block V-E. Port the web's unread behaviour to the mobile
conversation. This is a PORT: the web is the reference and it is
correct. Do not design a new behaviour.

STEP 1 — READ THE WEB AND SUMMARISE IT BEFORE WRITING ANYTHING
frontend/src/pages/messages/Messages.jsx implements a WhatsApp-style
unread line. Search it for unreadMarker, "unread line" and the comment
near line 581 about telling the server only what is visible. Then write
me a short summary of its rules:
  - how it decides where the "N unread messages" band goes
  - what it does when the first unread message is not loaded yet
    (more unread messages than one page)
  - exactly when it tells the server a message was read
  - why read receipts arriving do not move the band
  - what happens when a new message arrives while the user is scrolled
    up
Show me this summary first, then implement.

STEP 2 — IMPLEMENT ON MOBILE
mobile/app/chat/[contactId].tsx and the messages hook(s) it uses.
The list is an inverted FlatList: index 0 renders at the BOTTOM.

1. The band's position is decided ONCE, when the chat opens, and does
   not move afterwards — not when receipts arrive, not when pages load.
2. The chat opens scrolled so the band sits near the top of the screen,
   with the first unread message just below it. Use scrollToIndex, and
   handle onScrollToIndexFailed (rows have different heights). For the
   "first unread not loaded" case, do exactly what the web does.
3. Mark messages read only once they are on screen: onViewableItemsChanged
   with a viewabilityConfig (at least 50% visible). Collect the newly
   visible unread ids and send them in ONE batched call through the
   existing API client — never one request per message. Debounce it.
   Keep onViewableItemsChanged stable (useRef), or FlatList will throw.
4. A new message arriving while the user is at the bottom is marked read
   once visible. Arriving while the user is scrolled up: do not scroll
   them. If the web shows a "jump to latest" control, mirror it using
   spec tokens; if it does not, do not add one.
5. Opening the product from the header snippet and pressing back returns
   to the same chat, at the same place.

HARD CONSTRAINTS
- Do NOT change frontend/ — the web is the reference.
- Do NOT change backend endpoints or add new ones.
- Do NOT change the visual design from Block V-C, except to place the
  band.
- Keep the list inverted. Do not break Phase 5 pagination or realtime.
- No new dependencies.

VERIFY AFTER — report each
1. The web rules summary from step 1.
2. How each of the five behaviours is implemented, and in which file.
3. Behaviour with 0 unread, 1 unread, and more unread than one page.
4. npx tsc --noEmit passes.

CHANGELOG
File with: node scripts/changelog.mjs new vishwajeet "Mobile unread line and read-on-sight" --phase 6A --block V-E --for neeraj
```

---

# TRACK 3 — NEERAJ, MANUAL STEPS

You have six blocks. N-A builds the tool both of you use for the rest of the project, so it
comes first. N-F is the testing, and it is the largest block — nearly everything that needs
a human looking at a screen is yours.

## Block N-0 — Setup, and the "before" evidence (1 hour, Day 1)

```bash
cd ~/path/to/yahora
git checkout main && git pull origin main
git checkout neeraj && git merge main && git push origin neeraj
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

**👁️ CHECKPOINT N-0 — setup.**

1. `frontend/.env` has `VITE_API_PORT=5001` (macOS holds 5000 with AirPlay). Check with
   `grep VITE_API_PORT frontend/.env`.
2. `cd backend && npm run dev` and `cd frontend && npm run dev` both start, and
   `http://localhost:5173` loads.
3. Expo Go on your OPPO K14 supports **SDK 57**. The app moved from 56 to 57. Update Expo
   Go from the Play Store if 57 is not listed.

### 👁️ The "before" evidence for the demo leak

This proves Vishwajeet's V-A fixes a real, live problem — measured before he changes
anything. Do it against **production**.

```bash
# 1. Get a demo token from production. No login, no captcha.
curl -s -X POST https://yahora-yst4.onrender.com/api/auth/demo-login
```

Copy the token out of the response (the field the app uses for the session — if you are
unsure which, paste the whole response into a scratch file and Vishwajeet will point at it).

```bash
# 2. Search real students on production with that demo token.
curl -s "https://yahora-yst4.onrender.com/api/users/search?q=a" \
     -H "Authorization: Bearer <that token>"
```

Record in a scratch file (not the changelog yet — N-A has not merged):

| Question | Answer |
|---|---|
| Did demo-login return a usable token with no login? | |
| Did the search return real (non-demo) students? | |
| How many, and from how many different universities? | |

**If real students came back**, you have shown the leak is live. Vishwajeet's fix is then
measured against this. **If the search returned nothing or only demo accounts**, stop and
tell Vishwajeet before he pushes — production may already differ from what the code says,
and that is worth knowing first.

## Block N-A — The changelog system (half a day, Day 1, FIRST)

**Do this before anything else. Nobody can file a Phase 6A changelog entry until it is
merged**, so it blocks both of you.

Read §1.1 and §1.2 first — they explain why one-file-per-entry removes conflicts entirely,
and why it beats one-file-per-person.

Run prompt **CC-N1** from Track 4. It creates:

- `docs/changelog/` — the new folder, one Markdown file per entry.
- `docs/changelog/README.md` — how the system works, and the entry template.
- `scripts/changelog.mjs` — a small Node tool with three commands: `new` (create an entry),
  `recent N` (print the newest N), and `for <name>` (print entries addressed to someone).
- A banner at the top of the old `docs/CHANGELOG.md` saying it is frozen and pointing at the
  new folder. **The 4,646 old lines stay untouched** — 28 files link into them.

**👁️ CHECKPOINT N-A.** The tool has to work before either of you relies on it:

1. `node scripts/changelog.mjs new neeraj "Test entry" --phase 6A --block N-A` creates a
   file in `docs/changelog/` whose name starts with today's date.
2. `node scripts/changelog.mjs recent 5` prints it.
3. **The conflict test — this is the whole point.** Make two entries with different names,
   `git add` both, and confirm git shows two new files and zero modified files:
   ```bash
   node scripts/changelog.mjs new neeraj "Entry one" --phase 6A --block N-A
   node scripts/changelog.mjs new vishwajeet "Entry two" --phase 6A --block N-A
   git status --short docs/changelog/
   ```
   Every line must start with `A` (added). If any line starts with `M` (modified), the tool
   is writing to a shared index file, which reintroduces conflicts — send it back.
4. Delete the three test entries before committing.

Then update the instructions that tell people to read the old file, so future sessions use
the new tool. **CC-N1** lists them; the important ones are `CLAUDE.md`, `backend/CLAUDE.md`
and the build plan's §0.3.

## Block N-B — The design package, and the joint review (half a day, Day 1)

Unzip the package at the repo root:

```bash
unzip phase6-design-assets.zip      # creates docs/design/ only
git add docs/design && node scripts/changelog.mjs new neeraj "Add messages design package" --phase 6A --block N-B --for vishwajeet
```

### 👁️ Getting the mockup onto a phone honestly

The design is for a phone, so review it at phone size, not shrunk on a laptop.

- **Best:** open `docs/design/messages-mockup.html` in your laptop browser, then open Chrome
  DevTools (F12), click the little phone icon (device toolbar), and pick a ~360px-wide
  device. Now the mockup is at real phone width.
- **Also fine:** open the three PNGs (`messages_proposed.png`, `wallpaper_ground_options.png`,
  `sent_bubble_contrast.png`) full-screen and view them on your actual phone.

### The joint review, with Vishwajeet (20 minutes)

Go through the three questions in Vishwajeet's V-0. The decision you most need to agree on:
**the chat ground is `#EDE6F5`, not the near-white `#FDF8FF`** the old wallpaper document
named. `wallpaper_ground_options.png` shows why — on the near-white ground the bubbles and
chips vanish.

**If you change any value, change `docs/design/MESSAGES_SPEC.md` now**, before you write CSS
in N-E and before Vishwajeet writes the screens in V-C.

**👁️ CHECKPOINT N-B.** The package is committed, both of you have seen the mockup at phone
size, and the spec reflects any decision you changed.

## Block N-C — The seed-image catalogue (1.5 days, Days 2–3)

**This unblocks Vishwajeet's V-D**, so it must merge by midday on Day 3.

Read §1.9 first — it explains why the photos must include tall ones, and why direct hotlinks
rot.

Run prompt **CC-N2**. It builds:

- `scripts/seed-images/catalogue.json` — one entry per seed product, keyed by exact title,
  each with one or more image URLs.
- `scripts/seed-images/check.mjs` — visits every image URL in `seed.sql`, `seedLocal.js` and
  `seedDemo.js` and reports any that do not return a real image. This replaces hand-checking
  62 links.
- `scripts/seed-images/review.html` — a page that shows every catalogue image **cropped
  exactly the way the product card crops it** (`object-fit: cover`, the card's aspect
  ratio), so you see what students will see.

### 👁️ The review — this is the human part

Open `scripts/seed-images/review.html` and look at every image:

1. **Is it the right object?** A "Casio FX-991ES calculator" entry must show that
   calculator, not a generic calculator, and never a random stock scene.
2. **Does the crop keep the subject?** The page crops the way the card does. If the object
   is cut in half or pushed out of frame, that image is wrong — pick another.
3. **Is at least a third of them tall (portrait) photos?** Students shoot vertically. If
   every photo is a neat landscape, you are not testing the crop that real uploads will
   hit.
4. **Are they real photos, not illustrations or text-on-plain-background?**

Fix the catalogue until every image passes, then:

```bash
node scripts/seed-images/check.mjs        # must end with 0 dead links
git add scripts/seed-images && node scripts/changelog.mjs new neeraj "Seed-image catalogue + checker" --phase 6A --block N-C --for vishwajeet
```

**👁️ CHECKPOINT N-C.** Every catalogue image is the right object, survives the card crop,
the mix includes portrait photos, and the checker reports 0 dead links. Tell Vishwajeet it
is merged.

## Block N-D — Web chat wallpaper (half a day, Day 3)

Read §1.5 first — it explains why `background-attachment: local` (which the old document
asked for) would make the wallpaper scroll with the messages, and why the fix is to not set
that property at all.

Copy the master SVG into the web's public folder:

```bash
mkdir -p frontend/public/patterns
cp docs/design/assets/chat-pattern.svg frontend/public/patterns/
```

Run prompt **CC-N3**.

**👁️ CHECKPOINT N-D.** In the browser at `http://localhost:5173`, open a conversation:

1. The doodles are clearly visible; every bubble is fully solid on top.
2. Scroll the thread. **The wallpaper does not move** with the messages.
3. Zoom the browser to 200%. The pattern stays crisp — it is an SVG. If it blurs, the path
   is wrong and it is loading a raster somewhere.
4. Narrow the window to 380px. The tile stays 420px; it does not stretch.
5. No seam anywhere.

## Block N-E — Web messages redesign (1.5 days, Days 4–5)

**This is the block that makes the website match the design.** It implements
`docs/design/MESSAGES_SPEC.md` — the same file Vishwajeet builds from on mobile. Read the
spec top to bottom first.

Run prompt **CC-N4**.

**👁️ CHECKPOINT N-E.** Open the messages page:

1. Put the browser next to `docs/design/messages_proposed.png`. Same design.
2. The inbox is on the pink-to-lilac canvas; rows have no card backgrounds; unread rows
   have bold names, purple times, gradient badges, product chips.
3. The conversation has the lavender ground and the wallpaper; sent bubbles end at
   `#C02B7F`; received bubbles are white with near-black text; read ticks are **amber**;
   date labels are centred pills with no side lines.
4. **The most important functional check:** open a long chat, scroll up to load older
   messages, and confirm the view does not jump (this is the Phase 5 behaviour — the
   redesign must not have broken it).

## Block N-F — Testing (2 days, Days 5–6)

This is the block that decides whether the phase passed. It is yours, on all three phones
and the browser.

### 👁️ F1 — Demo isolation, on production (after V-A is pushed)

Repeat your N-0 "before" test against production, now that the fix is live:

```bash
curl -s -X POST https://yahora-yst4.onrender.com/api/auth/demo-login
curl -s "https://yahora-yst4.onrender.com/api/users/search?q=a" -H "Authorization: Bearer <token>"
```

| Check | Expected |
|---|---|
| Search with a demo token | returns **only** demo accounts, or nothing |
| It must NOT return any real student | confirmed |

Then log into the live site as a real account and, if any search UI existed you could
reach, confirm no demo accounts appear. (There is no student-search screen yet — Phase 8 —
so this is the API check above.)

### 👁️ F2 — Chat wallpaper, side by side

Put your laptop (a conversation open) next to a phone (the same kind of conversation open).

| Check | Expected |
|---|---|
| Same wallpaper? | doodle size, spacing and faintness read as identical |
| Bicycle size on the POCO/OPPO vs the Samsung | the same relative size on all three — NOT bigger on the higher-density phones (§1.6) |
| Scroll on each | wallpaper stays fixed, bubbles slide over it |

If the bicycle is bigger on the POCO and OPPO than on the Samsung, that is the Android
repeat-sizing bug — log it for Vishwajeet, do not try to fix the image.

### 👁️ F3 — Messages design matches the spec, both platforms

With `docs/design/MESSAGES_SPEC.md` open, walk the inbox and the conversation on the web and
on a phone. Check the spec's list item by item: canvas, header, filter, rows, unread
styling, badge, product chip, bubbles, ticks (amber), date chips, unread band, composer.
Log anything that differs from the spec against the platform it is on.

### 👁️ F4 — Sent-bubble gradient performance, on the Samsung A03s

This decides `SENT_BUBBLE_STYLE` for **both** platforms.

1. On the Samsung, open a long chat (Vishwajeet's seed has 30+ message threads). Scroll it
   fast, up and down, for a full minute with `SENT_BUBBLE_STYLE = 'gradient'`.
2. Is scrolling smooth, or does it stutter/drop frames?
3. Have Vishwajeet flip it to `'solid'`, reload, and scroll the same way.
4. Compare.

| Result | Decision |
|---|---|
| Gradient is smooth on the Samsung | keep `'gradient'` on both platforms |
| Gradient stutters | switch **both** platforms to `'solid'` |

Record the decision in the changelog — both platforms follow it.

### 👁️ F5 — Unread line and read-on-sight, both phones

On the OPPO, with a second account:

| # | Do | Expected |
|---|---|---|
| 1 | Chat closed, receive 6 messages, open it | opens at a "6 unread messages" band, first unread just below it |
| 2 | Read only the top 3 (do not scroll to the rest), leave | the sender sees read ticks on 3, not 6 |
| 3 | Receive 1 message while you are already at the bottom | it appears and turns read |
| 4 | Scroll up into history, receive a new message | you are NOT yanked to the bottom |
| 5 | Receive more messages than fit on one screen, open | still opens at the band, even though the first unread was not loaded yet |
| 6 | Open the product from the header, press back | returns to the same chat, same place |

Then repeat 1 and 2 on the POCO. Two Android versions catch layout bugs one device hides.

### 👁️ F6 — Seed images

| Check | Expected |
|---|---|
| Local marketplace, web and mobile | real photos, no "600 × 400" anywhere |
| The four repaired demo products on the live site | real photos, no broken-image icon |
| A few product cards with tall photos | the subject is still visible after the card's crop |

### 👁️ F7 — Nothing regressed

| Check | Expected |
|---|---|
| Send a message, web and mobile | delivers, appears on the other device (realtime intact) |
| Scroll up in a long chat, both platforms | older messages load, view does not jump (Phase 5 intact) |
| Marketplace, both platforms | loads, infinite scroll still works |
| OTP login and demo login | both still work |

**👁️ CHECKPOINT N-F.** Every failure logged against its block and platform, with a
screenshot. The `SENT_BUBBLE_STYLE` decision recorded.

---

# TRACK 4 — NEERAJ, CLAUDE CODE PROMPTS

## CC-N1 — The changelog system

```
Phase 6A, Block N-A. Replace our single giant CHANGELOG with a
one-file-per-entry system, so two people adding entries on the same day
can never cause a git conflict. Do this carefully — both of us depend on
it for the rest of the project.

THE PROBLEM
docs/CHANGELOG.md is 4,646 lines. We both add entries at the top, which
means we both edit the same lines, which means the second pull request
to merge always conflicts. Also, every Claude Code session reads this
whole file at startup — about 65k tokens of history before any code.

THE DESIGN — one file per entry
Each entry becomes its own file under docs/changelog/, named
  YYYY-MM-DD-HHMMSS-author-slug.md
Because every entry is a new file with a unique name, adding one never
edits an existing file, so git never has to merge and never conflicts.
Filenames start with the date, so listing the folder shows entries in
time order across everyone.

Do NOT use one file per person (vishwajeet.md, neeraj.md). That still
makes each person edit their own growing file, hides notes meant for the
other person, and needs updating whenever someone joins. One file per
entry avoids all three.

BUILD THESE

1. docs/changelog/  — the new folder.

2. scripts/changelog.mjs — a Node ESM script (our repo is Node 22, and
   uses import syntax). Three commands:

   node scripts/changelog.mjs new <author> "<title>" [--phase P] [--block B] [--for who]
     Creates docs/changelog/YYYY-MM-DD-HHMMSS-<author>-<slug>.md
     (HHMMSS so two entries from one author on one day still get
     different filenames). The file has YAML frontmatter — date, author,
     phase, block, for, title — then a "# <title>" heading, then these
     six empty sections, every entry the same:
        ## Migrations applied
        ## New endpoints
        ## Changed endpoints (BREAKING)
        ## New fields on existing responses
        ## Test data
        ## What NOT to do yet
     Print the path it created.

   node scripts/changelog.mjs recent [N]
     Prints the newest N entries (default 8) — read the date from the
     frontmatter, newest first, one line each: date, author, title, and
     the phase/block/for tags. This is what session-start will run
     instead of reading the old file.

   node scripts/changelog.mjs for <name>
     Prints every entry whose "for:" equals <name>.

   Use only node:fs, node:path, node:url. No dependencies. Parse
   frontmatter with a small regex — do not add a YAML library. Derive
   the folder from the script's own location so it runs from anywhere.

3. docs/changelog/README.md — explains the system in plain language: why
   it exists (conflicts + token cost), the filename format, the three
   commands with examples, the six-section template, and the rule
   "anyone adds files; nobody edits another person's entry except to fix
   a broken link."

4. docs/CHANGELOG.md — do NOT move or delete its 4,646 lines; 28 files
   link into them. Add a banner at the very top:
     > **FROZEN as of 2026-09-27.** New entries live in docs/changelog/,
     > one file per entry. Run `node scripts/changelog.mjs recent 8`.
     > This file stays for its history and inbound links.

5. Update the instructions that currently point at the old file, so
   future sessions use the new tool. Change the "read the changelog"
   and "update the changelog" guidance in:
     - CLAUDE.md (root) — the session-start instruction near line 23,
       and the ownership note that lists docs/CHANGELOG.md as shared
       (now docs/changelog/ is the shared, per-entry location)
     - backend/CLAUDE.md
     - docs/YAHORA_BUILD_PLAN.md — sections 0.3 and 0.5.5 if they
       describe reading or writing the changelog
   Search the repo for "CHANGELOG.md" and fix any other instruction that
   tells a human or a session to read or append the old file. Do NOT
   touch source-code comments that cite historical entries (e.g. "see
   CHANGELOG 2026-08-14") — those are correct references to frozen
   history. Show me every file you changed and the before/after.

6. Write the FIRST real entry with the new tool, announcing the system:
     node scripts/changelog.mjs new neeraj "Changelog: one file per entry" --phase 6A --block N-A --for vishwajeet
   Fill it in.

TEST BEFORE YOU FINISH — show me the output
  a) new ... creates a dated file in docs/changelog/
  b) recent 5 prints it
  c) The conflict test:
       node scripts/changelog.mjs new neeraj "T1" --phase 6A --block N-A
       node scripts/changelog.mjs new vishwajeet "T2" --phase 6A --block N-A
       git add docs/changelog && git status --short docs/changelog/
     Every line must start with A (added), none with M (modified). If any
     is M, the tool is writing a shared index file — remove that; the
     whole point is that entries never share a file.
  d) Delete the T1/T2 test entries (keep the real announcement entry).

HARD CONSTRAINTS
- Do NOT reformat, move or delete the existing docs/CHANGELOG.md content.
- Do NOT edit source-code comments that reference old entries.
- No npm dependencies; Node 22 ESM only.
- Do NOT touch mobile/, frontend/, backend/src/, or supabase/.
```

## CC-N2 — Seed-image catalogue and checker

```
Phase 6A, Block N-C. Build a catalogue of real product images for our
seed data, a checker that finds dead image links, and a review page that
shows each image cropped the way our product card crops it. This
unblocks Vishwajeet's V-D, so it needs to be mergeable by Day 3 midday.

WHY
supabase/seed.sql and backend/scripts/seedLocal.js give products
placeholder images (placehold.co/600x400), and four Unsplash links in
seedDemo.js are dead (404). Our cards crop images with object-fit:cover,
so we need real photos, including tall ones, to see what the crop does.

BUILD THESE — all under scripts/seed-images/

1. catalogue.json — an object keyed by the product's EXACT title as it
   appears in the seed files, each value an array of one or more image
   URLs:
     { "Casio FX-991ES Plus Calculator": ["https://...", "https://..."] }
   Cover every product title in seed.sql, seedLocal.js and seedDemo.js.
   First read those three files and extract the exact titles — show me
   the list you extracted before filling in URLs, so we agree it is
   complete.

   Sourcing the images: use the Pexels API (free, generous, hotlink-safe
   — I will paste a key when you ask). Prefer it over Unsplash hotlinks,
   which is what rotted. For each product, search a sensible term and
   pick photos that actually show that object. If you cannot find a good
   photo for a title, list it for me and I will choose one by hand — do
   NOT fall back to a placeholder.

   Requirements for the set as a whole:
     - at least one third of all images are portrait (taller than wide),
       because students photograph vertically and the card crop matters
       most on tall images
     - vary the count per product (some 1, some 2-3), so the gallery is
       realistic
     - every URL returns a real image (the checker enforces this)

2. check.mjs — a Node ESM script (Node 22, no dependencies) that:
     - reads seed.sql, seedLocal.js, seedDemo.js AND catalogue.json
     - extracts every image URL from each
     - requests each URL (HEAD, or GET with a Range of 0-0) and checks
       for a 2xx status and an image content-type
     - prints a table of dead or non-image URLs with the file they are
       in, and exits non-zero if any are dead, zero if all pass
   This is what both of us run after any seed change.

3. review.html — a standalone page (no build step; open the file
   directly) that reads catalogue.json and shows every image inside a
   box with the SAME aspect ratio as our product card and
   object-fit:cover, with the product title under each. Look at
   frontend's ProductCard (or the marketplace card CSS) to get the real
   aspect ratio, and tell me which value you used. The point is that I
   see each photo cropped exactly as a student will.

TEST — show me
  - the extracted title list, and confirmation catalogue.json covers all
  - node scripts/seed-images/check.mjs prints 0 dead links
  - the count of portrait vs landscape images (portrait must be >= 1/3)

HARD CONSTRAINTS
- Do NOT modify seed.sql, seedLocal.js or seedDemo.js — Vishwajeet
  applies the catalogue in V-D. You only create files under
  scripts/seed-images/.
- Do NOT write any SQL.
- No npm dependencies; Node 22 ESM.
- Do NOT touch mobile/, backend/src/, or supabase/.

CHANGELOG
node scripts/changelog.mjs new neeraj "Seed-image catalogue + checker" --phase 6A --block N-C --for vishwajeet
In "What NOT to do yet", note that Vishwajeet applies it in V-D and that
check.mjs must pass after he does.
```

## CC-N3 — Web chat wallpaper

```
Phase 6A, Block N-D. Put the chat wallpaper behind the web conversation.
CSS only.

THE ASSET — already copied in, do NOT edit
  frontend/public/patterns/chat-pattern.svg
The same seamless doodle tile the mobile app uses. Vite serves
public/ at the site root, so in CSS it is url('/patterns/chat-pattern.svg').
The master lives in docs/design/assets/chat-pattern.svg — never edit it.

Read docs/design/MESSAGES_SPEC.md section 2 first.

WHERE — read the file before editing
frontend/src/pages/messages/Messages.module.css. The conversation scroll
container is .messagesContainer (around line 551): it has overflow-y:auto,
overflow-anchor:none, background-color #ede6f5, and today TWO radial-
gradient glows plus a dot-grain data-URI background. Confirm the exact
selector before changing it. Do NOT touch .inboxSidebar — that is the
inbox, and it is Block N-E.

WHAT TO CHANGE on .messagesContainer
1. Keep background-color: #ede6f5 as the ground (matches mobile's
   chatCanvas — do not change it to a near-white).
2. Set the wallpaper as a repeating background image over that ground:
     background-image: url('/patterns/chat-pattern.svg');
     background-repeat: repeat;
     background-size: 420px 420px;
   420px so it matches the mobile tile exactly.
3. REMOVE the two radial-gradient glow layers and the dot-grain data-URI
   from this element. The doodle tile replaces them.
4. Do NOT set background-attachment. Its default (scroll) keeps the
   wallpaper fixed while messages scroll. background-attachment: local
   would make it scroll WITH the messages — the bug we are avoiding.

HARD CONSTRAINTS
- Do NOT edit the SVG.
- Do NOT touch .inboxSidebar or any bubble/spacing/font styles — that is
  N-E.
- Do NOT change any .jsx or component logic. CSS only.
- Do NOT touch mobile/, backend/ or supabase/.

VERIFY AFTER — report each
1. The exact selector you changed and its before/after.
2. Confirm background-attachment is not set anywhere on this element.
3. Confirm the two glows and the grain data-URI are gone from it.
4. Remind me to check in the browser: pattern visible, does not scroll
   with messages, stays crisp at 200% zoom, tile does not stretch when
   the window is narrowed.

CHANGELOG
node scripts/changelog.mjs new neeraj "Web chat wallpaper" --phase 6A --block N-D --for vishwajeet
```

## CC-N4 — Web messages redesign

```
Phase 6A, Block N-E. Redesign the web messages page to match the shared
spec exactly — the same file Vishwajeet is building on mobile.

THE ONE RULE
docs/design/MESSAGES_SPEC.md is the design. Implement it. INVENT
NOTHING. Mobile is implementing the same file; the two must look like
one product. If the spec does not cover something, keep the current
behaviour and list it — do not decide design yourself.

Visual reference: docs/design/messages-mockup.html and
messages_proposed.png. Where they disagree with the spec file, the spec
wins.

WHERE
frontend/src/pages/messages/Messages.module.css (most changes) and
frontend/src/pages/messages/Messages.jsx (structure only where the spec
requires it — a badge element, a product chip, the date pill). Do NOT
touch the wallpaper on .messagesContainer from N-D except where the spec
changes bubble/spacing styles around it.

ADD CSS VARIABLES
Wherever the web theme variables live (search for the existing
--color-... or --bubble-... custom properties), add exactly:
  --bubble-mine-end: #C02B7F;
  --bubble-mine-solid: #9B1280;
  --chat-read-tick: #FDE68A;
Use these variables — no raw hex in the rules you write.

INBOX — spec section 1  (.inboxSidebar and its rows)
- Canvas: the app's pink-to-lilac gradient (the spec gives the exact
  stops; it is the same one other pages use). Remove the inbox's own
  glow layers (.inboxSidebar::before / ::after).
- Rows: no card background; bottom hairline divider; unread rows have a
  bold name, a purple timestamp and a gradient unread badge (99+ over
  99); each row shows the product the conversation is about (the chip).
- Keep the existing local search/filter behaviour (filteredInbox) — it
  is a client-side filter over your own conversations. Restyle it per
  the spec; do NOT wire it to any server search.

CONVERSATION — spec section 2
- The ground and wallpaper from N-D stay.
- Sent bubble: gradient ending at var(--bubble-mine-end). Received
  bubble: white, text #1A1A1A (near-black — currently it uses a purple
  text; the spec changes that for contrast). Bubble max-width 78% capped
  at 520px.
- Timestamps inside sent bubbles: white at 90% opacity.
- Read ticks: var(--chat-read-tick) (amber). This matches mobile.
- Date separators: a centred pill, NO horizontal lines either side (the
  current .dateSeparator has lines — remove them).
- Meta row (time + ticks) and bubble radii/spacing exactly per the spec.

WEB-ONLY, ALLOWED (spec section 5)
- The subtle bubble shadow stays on web (mobile has none).
- Hover states stay on web.
These are the only sanctioned differences from mobile.

HARD CONSTRAINTS
- Do NOT change data fetching, the realtime subscription, sending, or
  the unread-tracking logic (the Phase 5 scroll-anchoring behaviour must
  keep working — verify it does).
- Do NOT wire the inbox search to the server.
- Do NOT add a dependency.
- Do NOT touch mobile/, backend/ or supabase/.

VERIFY AFTER — report each
1. A checklist of every item in spec sections 1 and 2: done / not
   applicable / differs (why).
2. Confirm the three CSS variables are defined and used (no raw hex).
3. Confirm received-bubble text is #1A1A1A and date pills have no side
   lines.
4. Remind me to verify in the browser that scrolling up to load older
   messages does not jump (Phase 5 intact).

CHANGELOG
node scripts/changelog.mjs new neeraj "Web messages redesign" --phase 6A --block N-E --for vishwajeet
```

---

# SIGN-OFF — both of you, end of Day 6

Tick each only when you have seen it with your own eyes.

**Security**
- [ ] 👁️ On production, a demo token's search returns only demo accounts (or nothing), never a real student — Neeraj's F1, measured against his N-0 "before" note.

**Wallpaper**
- [ ] 👁️ Appears on web and on all three phones.
- [ ] 👁️ Stays fixed while messages scroll, on both platforms.
- [ ] 👁️ Reads as the same wallpaper with a laptop and a phone side by side.
- [ ] 👁️ The bicycle is the same relative size on the Samsung, the POCO and the OPPO (not larger on the two higher-density phones).

**Messages design**
- [ ] 👁️ Inbox and conversation match `MESSAGES_SPEC.md` on both platforms (F3).
- [ ] 👁️ Read ticks are amber on both platforms.
- [ ] 👁️ Both of you agree the screens look **better**, not just unbroken.
- [ ] `SENT_BUBBLE_STYLE` decided by the Samsung test (F4) and set the same on both platforms.

**Unread behaviour (mobile)**
- [ ] 👁️ A chat opens at the "N unread" band (F5, cases 1 and 5).
- [ ] 👁️ Messages turn read only once seen (F5, case 2).
- [ ] 👁️ A new message while scrolled up does not yank you down (F5, case 4).

**Seed images**
- [ ] 👁️ No placeholders in local seed data, web or mobile.
- [ ] 👁️ The four repaired demo products show real images on the live site.
- [ ] `node scripts/seed-images/check.mjs` reports 0 dead links.

**Changelog**
- [ ] `docs/changelog/` holds one file per entry; the old file is frozen with its banner.
- [ ] 👁️ Two same-day entries were added with zero git conflict (the N-A conflict test).
- [ ] Every Phase 6A block filed an entry.

**Nothing regressed (F7)**
- [ ] 👁️ Realtime send works, both platforms.
- [ ] 👁️ Scroll-up paging does not jump, both platforms (Phase 5 intact).
- [ ] 👁️ Marketplace infinite scroll works, both platforms.
- [ ] 👁️ OTP login and demo login both work.

When every box is ticked:

```bash
node scripts/changelog.mjs new vishwajeet "Phase 6A complete" --phase 6A --block SIGN-OFF
```

---

# APPENDIX

## The four tracks, at a glance

| | Vishwajeet | Neeraj |
|---|---|---|
| Manual | TRACK 1 | TRACK 3 |
| Claude Code | TRACK 2 | TRACK 4 |

## Blocks and their prompts

| Block | Who | Prompt | One line |
|---|---|---|---|
| V-0 | V | — | Setup; check Expo Go is SDK 57 |
| V-A | V | CC-V1 | Demo isolation in search (migration) |
| V-B | V | CC-V2 | Mobile chat wallpaper |
| V-C | V | CC-V3 | Mobile messages redesign |
| V-D | V | CC-V4 | Real seed images + live demo repair |
| V-E | V | CC-V5 | Mobile unread line + read-on-sight |
| N-0 | N | — | Setup; record the demo-leak "before" |
| N-A | N | CC-N1 | Changelog system (do first) |
| N-B | N | — | Design package + joint review |
| N-C | N | CC-N2 | Seed-image catalogue + checker |
| N-D | N | CC-N3 | Web chat wallpaper |
| N-E | N | CC-N4 | Web messages redesign |
| N-F | N | — | All testing (F1–F7) |

## URLs and commands you will reuse

```
Production API   https://yahora-yst4.onrender.com
Web (local)      http://localhost:5173
Supabase Studio  http://127.0.0.1:54323   (local)
API base (local) http://localhost:5001/api

supabase db reset                     # replay all migrations + seed.sql
node backend/scripts/seedLocal.js     # local marketplace data
node backend/scripts/seedDemo.js      # demo-tenant data (skips existing titles)
node scripts/seed-images/check.mjs    # 0 dead image links (after N-C)
node scripts/changelog.mjs recent 8   # newest changelog entries (after N-A)
npx tsc --noEmit                      # in mobile/ — type-check
```

## Things that cost a day if you forget them

- **Expo Go must match SDK 57.** The app moved from 56 to 57. An old Expo Go fails to load it with a confusing error. Check first thing (V-0, N-0).
- **`background-attachment: local` makes the wallpaper scroll with the messages.** Do not set the property at all — the default is correct. This is the single most likely wallpaper mistake, on both platforms (§1.5).
- **`seedDemo.js` skips products whose title already exists.** Re-running it will NOT fix the four broken production images — they need the targeted UPDATE in V-D (§0.6).
- **The wallpaper PNGs must stay outside the inverted FlatList**, and the FlatList's `style` and `contentContainerStyle` must be transparent, or the wallpaper never shows (CC-V2).
- **`expo-image` has no repeat mode.** The wallpaper is the one image that uses React Native's own `Image`, on purpose (CC-V2).
- **Verify a screen exists before writing a test for it.** My Phase 5 sign-off checked a user-search screen that was never built. There is still no student-search UI — that is Phase 8 (§0.2).
- **Change a design value in `MESSAGES_SPEC.md` first, then both platforms.** Changing it in one platform's code splits the two apps.

## Deliberately NOT in Phase 6A

So nobody goes looking for these:

- **Mark as Sold** rework, **Delete message**, and the **`products.views`** double-count fix → **Phase 6B** (they need schema changes).
- **A student-search screen** → **Phase 8** (social graph), built on both platforms together. Only the search *isolation* is in 6A.
- **Rate-limiting or a captcha on demo login** → a later hardening pass (**Phase 9**). 6A closes the search leak the demo token exposes; it does not change demo login itself.
- **iOS.** Everything here is Android + web. No iOS device is in the test matrix.
- **A dark-mode wallpaper.** The tile is tuned for the light lavender ground only.

## The design decisions, and why (quick reference)

- **Chat ground `#EDE6F5`, not `#FDF8FF`.** White bubbles, chips and the unread band dissolve on near-white. `wallpaper_ground_options.png` shows it.
- **Inbox on the app canvas** (`#FFF0F7 → #FBE9F8 → #F1E6FF`). The inbox's own gradient is low-saturation and reads as white; the app canvas is already contrast-checked.
- **Sent-bubble gradient ends `#C02B7F`.** The current `#EB487F` fails contrast for white text (3.64) and the amber tick (2.92); `#C02B7F` passes both (5.39 and 4.33). `sent_bubble_contrast.png` shows it.
- **Timestamps white at 90%**, not 78% (78% fails on the pink end).
- **Read ticks amber `#FDE68A` on both platforms.** Mobile currently uses light blue; this unifies them.
- **Received bubbles white with `#1A1A1A` text**, for contrast on the lavender ground.
- **One solid fallback `#9B1280`** (7.52 : 1) if the A03s can't render per-bubble gradients smoothly — chosen so switching keeps contrast.

*End of Phase 6A runbook.*
