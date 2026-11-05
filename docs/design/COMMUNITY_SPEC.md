# Community — design spec (Phase 7)

**Version 3 · 4 November 2026 · for the website and the app**

> **Changed in version 3 (the redesign, runbook Block V-P):** flat posts on the chat's wallpaper,
> thin and compact everywhere, the avatar as a drop cap, a composer docked at the bottom of each
> feed with your avatar on the divider, replies shown under each post with a curved thread, a
> reply can only be liked, icons instead of words, and no emoji in the interface itself.
> Generic rules from this redesign are in `frontend/DESIGN.md` and `mobile/DESIGN.md`.
>
> **⚠ Needs an API change before it works on real data:** `top_replies` on a PostItem (§4). Until
> then a post shows only `Show more replies`.
>
> **Changed in version 2:** each feed shows only its own posts, so the scope chip is gone
> (§1.1, §3), and a covered post shows only a notice, with no "View anyway" (§3.1).

The website and the app are built from this one file, so they look and behave the same. The
runbook's Claude Code prompts point here for every size, word and state.

**One rule:** if you want to change something, change it **here first**, commit it, then build.
A change made only in code is a change the other platform will never hear about.

Colours and fonts come from the tokens you already have (`mobile/src/theme/index.ts`,
`frontend/src/styles/global.css`). Fonts stay as decided: **Inter** for text, **Bree Serif**
(regular 400 only) for headings. The few new tokens are listed in §12.

---

## 1. The Community screen

### 1.1 Website on a laptop (1024 px wide or more): two panels

```
┌──────────────────────────────────────┬┬──────────────────────────────────────┐
│ (cap) IIITDM Kurnool        [‹] [⤢] ││ 🇮🇳 India ▾  [🔥|🕐]         [⤢] [›] │ ← 36, glass
│ post                                 ││ post                                 │
│ ──────────────────────────────────── ││ ──────────────────────────────────── │
│ post                                 ││ post                                 │
│ …  (posts pass under header and dock)││ …                                    │
│ ─────────────────────────────────── ╭──╮ ─────────────────────────────────── │
│ What's happening on campus?         │me│  Share with students in India       │ ← 42
└─────────────────────────────────────╰──╯─────────────────────────────────────┘
        left: My campus          avatar on the divider     right: country or Global
```

- **Background of both panels:** the chat's wallpaper, pinned while posts scroll: `chatCanvas`
  with the shared doodle tile at 50% strength (`MESSAGES_SPEC.md` §2). The rows carry a light tint
  so text stays readable: warm on the campus side (`communityRowCampus`), quieter on the other
  (`communityRowWorld`).
- **Hierarchy:** My campus is the main panel. Its title is Bree Serif 15 in purple-dark. The right
  title is Inter 600 13.
- **Panel header:** **36 px**, glass (`communityGlass`, blur 14), radius 8 on the panel. It floats
  over the feed, so posts pass underneath it.
- **Left panel, "My campus":** the campus feed. Its header shows an animated graduation-cap icon and
  your campus name. It shows **only campus posts**: a post appears only in the feed it was posted to,
  never in another.
- **Right panel:** the title is the dropdown (§1.3) that picks a country or Global. Next to it is a
  **Hot · New** switch made of two icons (flame, clock), with a thumb that slides between them. Hot is
  the default (ranking: runbook §1.3).
- **Icons, not emoji:** the panel icons are drawn in when they first appear. Hovering the header gives
  the cap a small hop and turns the globe. Flags stay emoji, because they are worked out from the code.
- **The divider** (react-resizable-panels), **6 px** wide:
  - a 1 px line running down into your avatar, with a small grip in the middle;
  - drag it to resize; each panel is at least **320 px** wide;
  - double-click it to go back to 50 / 50;
  - keyboard: focus it with Tab, move it with the arrow keys.
- **Your avatar on the divider:** 36 px, 3 px from the bottom, with a white ring. It is a child of the
  divider, so it moves with it as you resize, and it grows slightly on hover and while dragging. It
  isn't a button: pressing it drags the divider.
- **Panel buttons (26 × 26):**
  - **‹** or **›** collapses that panel to a **36 px** bar. The bar shows the panel's name
    written vertically and an expand button. The panels glide over 280 ms when a button moves them,
    never during a drag.
  - **⤢** opens that panel full width (the other one collapses). Pressing it again
    restores both.
- **Posts follow the panel's width,** not the window's. Rows always run edge to edge; their content
  stops at 860 px, centred, so a panel opened full width still has readable lines.
- **The browser remembers the layout** (localStorage key `yahora.community.layout`), so
  the panels are where you left them next time.

### 1.2 Narrow website (under 1024 px) and the app: a floating switcher

```
┌──────────────────────────────────┐
│ ( (cap) | 🇮🇳 India | ⌄ )  ([🔥|🕐])│   ← two floating glass pills; posts pass underneath
│ post                             │
│ ──────────────────────────────── │
│ post                             │
│ ( (me) What's happening…?      ) │   ← floating composer
└──────────────────────────────────┘
```

- **The switcher floats.** The bar is transparent, sticky at the top, and only its pills take presses.
  Posts scroll underneath, which keeps the screen feeling open. It takes 50 px.
- **The pill:** a campus icon, the selected country or Global, and a separate chevron.
- **The chevron always opens the dropdown.** Tapping the country only selects that feed, so nothing
  is hidden behind a second tap.
- **Hot · New** is the second pill, only on the country / Global side.
- **The look stays thin; a finger still gets 44 px.** On a touch screen each control has an invisible
  hit area reaching 44 px tall. In the app, use `hitSlop`.
- **App:** a new **Community** tab. The tabs are Marketplace, Community, Messages, Profile.
  The icon is Feather `users`. The app still opens on Marketplace.

### 1.3 The country dropdown

```
🇮🇳 India (your country)   ✓
(globe icon) Global
──────────────
🇩🇪 Germany
🇦🇪 United Arab Emirates
…  (other countries with campuses, A–Z)
```

- Your own country comes first and is the default. Global comes second, then the other
  countries from A to Z.
- The list comes from `GET /api/posts/countries`. A country appears only when it has at
  least one live campus.
- Flags are worked out from the two-letter code (`IN` → 🇮🇳). They are never stored.
- Options are 32 px, Inter 500 13, in a white menu with radius 10.

### 1.4 Another country's feed: view only

A quiet line takes the composer's place in the dock:

```
(eye icon)  Only students in Germany can post and reply here. You can still react and report.
```

Inter 400 12/16, communityMuted, with the icon in purple. No box on a laptop; on a narrow window it
floats on glass like the composer.

---

## 2. The composer

### 2.1 Closed

The composer is **always at the bottom of the feed**, separately for each panel: a dock of 42 px
with a white one-line field, radius 16, Inter 400 13/18. On a laptop the shared avatar sits on the
divider between the two docks (§1.1). On a narrow window the composer floats over the posts, with
your avatar (24) inside the field. Grey text depends on the feed:

| Feed | Grey text |
|---|---|
| Campus | `What's happening on campus?` |
| Your country | `Share with students in India` |
| Global | `Share with students everywhere` |

Clicking it opens the composer upward, in place, over 220 ms: inline on the website, a full-screen
compose page in the app (`app/compose.tsx`, opened as a modal). The feed shrinks to make room.
Pressing elsewhere, or Esc, folds an **empty** composer back to its line. Anything written keeps it
open.

### 2.2 Open

```
┌────────────────────────────────────────────────────┐
│ Posting as @rahul.verma · IIITDM Kurnool           │  ← always visible
│ text…                                              │  ← grows with the text
│ [photo][photo][photo]   or   [GIF preview]         │  ← each with an ✕
│ (image) (GIF) (smile, web only)   (cap)   87   (↑) │
└────────────────────────────────────────────────────┘
```

- **"Posting as @username · Campus name"** is always shown, in Inter 500 11, communityMuted.
  Seeing your own name is the cheapest moderation there is.
- **Text:** up to **1,000 characters**, counted the way runbook §1.12 explains (one emoji
  is one character).
  - The counter appears only when 100 or fewer are left. It turns errorText at 0, and Post
    is disabled above 1,000.
- **Where the post goes** is a small chip: a graduation-cap icon for campus, a globe icon for Global,
  or the country's name. It always matches the feed you opened the composer from, and can't be
  changed inside the composer.
- **Post** is a 28 px purple circle with an up arrow. On the website, Ctrl or Cmd + Enter also posts.
- **Photos:** up to **3**; JPEG, PNG or WebP; at most 5 MB each.
  - Previews are 56 × 56 with radius 8 and an ✕ to remove.
  - Too big: `That photo is bigger than 5 MB.`
- **GIF:** one GIF, from the GIF picker (§6).
  - A post has **either** photos **or** a GIF. While one is attached, the other button is
    disabled and its tooltip (web) or press hint (app) says
    `Remove the photos to add a GIF` (or the other way round).
- **Emoji:** on the website, the smile button opens the full emoji picker (§5.2). The app relies
  on the phone keyboard's emoji.
- **Post is enabled** when there is text, a photo or a GIF. It shows a spinner while posting.
- **Replies** use the same composer with text and a GIF, but no photos (§4). Its top line adds a
  `Replying to @username ✕` chip.

### 2.3 What can happen after pressing Post

| Result | What the student sees |
|---|---|
| Posted | The composer clears and closes. The new post appears at the top of the feed. |
| **Nudge** (API `MODERATION_NUDGE`) | A dialog: title `Post this?` · body `Some of this might come across as hurtful to other students. You can edit it, or post it as it is.` · buttons **Edit** (primary, keeps the text) and **Post anyway**. |
| **Held for review** | Toast: `Thanks — your post is being checked and will appear once it's approved.` The composer clears. The post shows only on the author's own Posts tab, labelled `Being checked`. |
| **Held, and self-harm was detected** | Instead of the toast, a calm card (§2.4). |
| Rate limit (`RATE_LIMIT_POSTS` / `RATE_LIMIT_REPLIES`) | Inline, above Post: `You've reached the posting limit for now. Please try again in a little while.` The text is kept. |
| `NOT_ALLOWED_HERE` | `You can't post in this feed.` (This should never happen, because the UI hides the composer.) |
| Too long / bad file | The messages in §2.2. The text is kept. |
| Network or server error | Toast: `Couldn't post. Check your connection and try again.` The text is kept. |

**The text is never thrown away** unless the post succeeded or was held.

### 2.4 The support card (self-harm held)

```
(hands icon)  You're not alone
    If you're going through something difficult, talking to someone can help.
    India: Tele-MANAS — call 14416 (free, any time)
    Anywhere else: findahelpline.com
                                                    [Close]
```

Inter 400 13/19 on pinkLight, radius 12, padding 12, with a purple `HeartHandshake` icon and the title
in Bree Serif 15. It takes the composer's place in the dock. The phone number and the link are
tappable. Nothing on this card may sound like a punishment.

**The same card, later.** A post can be held for self-harm after it was sent, if the check had to
wait. While that post is held, the author's Posts tab shows this card directly under it, without
**Close** (API field `moderation_support`).

---

## 3. The post

No card. A post is a flat row split from the next by a 1 px `communityHairline`, padding 9 / 12 / 8,
with a soft tint on hover. Compact, like a code editor's panels.

```
(av) Rahul Verma @rahul.verma · IIITDM Kurnool · 2h                 ⋯
Text of the post, Inter 400 13/19, black-soft. The avatar is a drop cap: only
the first lines sit beside it, and everything below runs the post's full width.
┌───────────────────── photos (1–3) or GIF ─────────────────────┐
└───────────────────────────────────────────────────────────────┘
( ❤️ 😂 😮 👍 1.2K ) ( ♡ ) ( 💬 14 )     ← pills (§5.3), then the thread (§4)
```

- **The avatar is a drop cap:** 28 px, floated in the corner, with 8 px after it. Text wraps under it,
  and photos, GIFs, actions and the thread all start below it at full width. On a 390 px phone the
  text gets 366 px.
- **Author line: always exactly one line.** Full name in Inter 600 13; then `@username · campus · time`
  in Inter 400 12, communityMuted. When space runs out they truncate in this order: the campus first,
  then the username, then the name. The time never goes. Tapping the avatar or the name opens the
  profile. Tapping the time opens the post's page.
- **Campus name:**
  - **never in the campus feed,** where it's obvious;
  - elsewhere, only if there is room: it's hidden when the feed is 420 px wide or less;
  - the username also goes at 300 px or less (a very narrow panel only).
- **Time:** `now`, `5m`, `2h`, `3d`; then `12 Oct`, or `12 Oct 2025` for an earlier year.
  Reuse the message time formatter.
- **Text:** links are tappable; there are no link previews. A long post folds after
  **6 lines** behind `See more`, which expands it in place.
- **Photos** (radius 8, 2 px gaps, at most 560 px wide; tapping one opens the existing image viewer):
  - **1 photo:** full width, its own shape, but between 4:5 and 16:9 and never taller than
    420 px;
  - **2 photos:** two squares side by side;
  - **3 photos:** one large photo on the left, two stacked on the right, 16:10 overall.
- **GIF:** at most 280 px wide. Plays muted and on a loop while on screen, and pauses when it scrolls
  away. It carries a small `GIF` badge in the corner.
- **Actions: icons in pills, no words,** 24 px tall, with 4 px between them:
  - **The reaction summary** (§5.3), when there are reactions.
  - **React:** your current emoji, or ♡ if you haven't reacted (§5).
  - **💬 count:** where you can reply, it opens the composer in reply mode (§4). In a view-only feed
    it loads more replies.
  - **⋯ menu:** Report (§7); Delete for your own posts, with confirm text
    `Delete this post? It will be removed for everyone.`
- **Counts:** `999`, `1.2K`, `12K`, `1.2M`.
- **Entrance:** posts fade and rise 4 px over 320 ms, staggered by 28 ms, stopping after the sixth.

### 3.1 States

| State | Who sees what |
|---|---|
| `Being checked` (held) | Only the author, on their Posts tab, with a grey label. If it was held for self-harm, the support card (§2.4) sits under it. |
| **Under review** (reported) | It's taken out of every feed and off the author's profile for everyone else. A direct link shows only `This post was reported and is being reviewed.` — no text, no photos, no button to view it. A covered reply disappears from its thread. The author still sees the post, labelled `Under review`. |
| Deleted | It disappears everywhere. A direct link shows `This post was deleted.` |
| Removed by Yahora (Phase 9) | A direct link shows `This post was removed for breaking the Community Guidelines.` |

---

## 4. Replies, and a post's page

Replies now show **under each post in the feed,** as well as on the post's page.

```
( ❤️ 😂 1.2K ) ( ♡ ) ( 💬 14 )
 │
 ╰─ (av) @priya.nair · IIITDM Kurnool · 2h                  ♡ 12  ⋯
 │  Reply text, Inter 400 12.5/18. It also wraps under its avatar.
 ╰─ (av) [@rahul.verma] · 1h                                ♥ 3   ⋯
 │  The highlighted name is the post's own author.
 ╰─ ⌄ Show more replies
```

- **Top replies show by default:** the **2** most-liked (`REPLY_PREVIEW_COUNT`), oldest first when
  tied.
- **`Show more replies`** loads the rest in place, 20 at a time, oldest first, without leaving the
  feed. It disappears when there are no more.
- **The thread:** one 1.5 px `communityRail` line runs down under the post's avatar. Each reply curves
  off it into its own avatar (radius 10). The last one ends in its curve, and doesn't continue. The
  line starts below the post's action row, because the drop-cap avatar has text under it.
- **Each reply:** a 22 px drop-cap avatar; `@username` in Inter 600 12; `campus · time` in Inter 400 12;
  text in Inter 400 12.5/18, with an optional GIF up to 180 px wide.
- **Usernames, not full names.** The campus shows only under the rule in §3.
- **The post's author is highlighted:** when they reply to their own post, their username sits on
  a `reactionMineBg` pill in purple.
- **A reply can only be liked.** A heart at the right of its line, with the count; it stores
  `DEFAULT_REACTION`, ❤️. No quick bar and no picker. Filled in `communityLike` when it's yours. The ⋯
  menu sits next to it, shown on hover with a mouse and always on touch.
- There are **no replies to replies**: one level only.
- **Writing a reply:** the post's 💬 pill switches that panel's docked composer to reply mode, with the
  cursor in it: grey text `Reply to @username…`, up to 1,000 characters, a GIF button, and a
  `Replying to @username ✕` chip. A half-written post is kept and comes back afterwards. An empty
  reply closes when you press elsewhere.
- **In a feed where you can only view,** the view-only line stays (§1.4), and the 💬 pill loads more
  replies instead.
- **A post's page:** website `/post/:id`, app `app/post/[id].tsx` (CC-N4c). The same post and thread
  with all replies paged, and text at 15/22.

**⚠ API change needed (not built).** `top_replies` is new. Each PostItem needs `top_replies`: up to
`REPLY_PREVIEW_COUNT` reply PostItems, most liked first. That means a change to the feed SQL
functions (Vishwajeet), `backend/API.md`, and the posts routes. Until it exists, a post with replies
shows only `Show more replies`, which already works from `GET /api/posts/:id/replies`. `sampleData.js`
already sends the field, so the screens are ready.

---

## 5. Reactions — on posts and messages

One reaction per person per post (or message). Picking a different emoji replaces your
reaction; picking your current one again removes it. Replies have only a like (§4).

### 5.1 The quick bar

```
 ( ❤️  👍  😂  😮  😢  🙏  ⊕ )
```

- **The six, in this order:** ❤️ 👍 😂 😮 😢 🙏. Then **⊕**, which opens the full emoji picker.
- **The React button is an icon, with no word:** a heart, or your current emoji, in a 30 × 24 pill.
- **Look:** a white pill with radius 999 and a soft shadow. With a mouse, each emoji is 22 in a
  34 × 34 button. On a touch screen, 26 in 44 × 44. Your current reaction sits on a `reactionMineBg`
  circle.
- **How to open it:**
  - **App:** tap React = ❤️ on or off. Long-press React (or long-press the post) = the
    quick bar.
  - **Website, with a mouse:** click React = ❤️ on or off. Hover React for **300 ms** = the quick bar.
    It also opens from the keyboard: focus React and press ↑.
  - **Website, on a touch screen:** tap React = ❤️ on or off. Long-press React for **450 ms**
    (`REACTION_LONG_PRESS_MS`) = the quick bar, the same gesture as the app. A touch screen has no
    hover.
- **Animation:** the bar springs up from the button and its emoji arrive left to right, 18 ms apart.
  Hovered emoji lift and grow. The chosen emoji pops (up to 1.35 over 320 ms) with a ring going out
  behind it. With reduced motion turned on, none of this moves.

### 5.2 The full picker (⊕)

- A search box: `Search emoji`.
- **Frequently used**, remembered on that device.
- Then every category, with category tabs.
- **Libraries:** website `emoji-picker-react`, app `rn-emoji-keyboard`. Style them with your
  tokens: white surface, radius 12, purple for the selected category.

### 5.3 The summary under a post

```
( 😂 ❤️ 👍 😮 1.3K )  ( ♡ )  ( 💬 237 )
```

- The **top 4 emojis** by count (`REACTION_SUMMARY_COUNT`), spaced apart, then the total. Separate
  pills sit beside it, on the same row.
- 24 px tall, emoji 13, Inter 500 11 with tabular numbers, communityMuted, on communityPill with a
  communityHairline outline, radius 999, padding 0 / 9 / 0 / 7.
- **Once you've reacted,** the pill is tinted: `reactionMineBg`, `reactionMineBorder`, purple text.
- A new emoji springs in, and a new total rolls up.
- Hidden when there are no reactions.
- Tapping it opens the breakdown.

### 5.4 The breakdown (posts)

Website: a popover. App: a bottom sheet.

```
        724 reactions
 ( ⊕ )   ( ❤️ 373 )  ( 😮 95 )
 ( 👍 20 ) ( 🙏 17 ) ( 😢 13 )
 …
```

- A grid of pills (emoji + count), biggest first, three per row. The first cell is ⊕ (add
  your own).
- **Counts only — no names.** Who reacted is not shown.

### 5.5 Messages

- **Opening the quick bar:**
  - **App:** long-pressing a bubble shows the quick bar **above** the action menu, in the
    space `MessageActionMenu` already keeps for it.
  - **Website:** hovering a bubble shows a small 😊 button beside the existing ⌄ actions
    button. Clicking it opens the quick bar.
- **The pill under a bubble** looks like the summary in §5.3 (not built yet: Blocks N-E and V-E):
  - it shows the reactions, at most 2 because a chat has two people, e.g. `❤️ 😂`, or
    `❤️ 2` when you both chose the same emoji;
  - it overlaps the bubble's bottom edge by 8 px, on the bubble's inner side.
  - **Tapping the pill** opens a small list: `You  ❤️  · Tap to remove` and `Priya  😂`.
- **The inbox preview** doesn't change for reactions.
- Deleted messages (tombstones) can't be reacted to.

---

## 6. The GIF picker (KLIPY)

```
┌───────────────────────────────────┐
│ (search) Search GIFs              │
│ ┌─────┐┌─────┐┌─────┐             │   trending first, then search results
│ │ gif ││ gif ││ gif │   …         │   app: 2 columns · website: 3 columns
│ └─────┘└─────┘└─────┘             │
│                  Powered by KLIPY │   ← required credit
└───────────────────────────────────┘
```

- **Website size:** 320 × 380, radius 12, search field 30 px tall, 3 px between GIFs.

- **Where it opens:** from the composer's GIF button, the reply box, and the chat composer.
  Website: a popover. App: a bottom sheet.
- **Results:** trending GIFs first; search runs 300 ms after typing stops. Scrolling to the
  bottom loads more.
- **Choosing a GIF** attaches it as a preview with an ✕.
- **In a bubble or post:** use the provider's small animated rendition (WebP or GIF), never
  the full-size one. The app shows it with `expo-image`.
- **Errors:** `GIFs aren't available right now.` in the picker. Posting still works.
- **The credit line `Powered by KLIPY` is required.** Never remove it.

---

## 7. Reporting a post

```
Report post
Why are you reporting this post?
( ) Spam
( ) Harassment or bullying
( ) Hate speech
( ) Sexual content
( ) Child safety
( ) Violence or threats
( ) Self-harm or suicide
( ) Impersonation
( ) False information
( ) Prohibited item
( ) Something else
[ Add details (optional) …                          ]  ← up to 500 characters

Reports are anonymous and reviewed by the Yahora team. Please report only content that
breaks our Community Guidelines. Deliberately false reports, or repeated misuse of
reporting, may lead to restrictions on your account, including suspension. Honest reports
are always welcome — you won't be penalised if we decide a post doesn't break the rules.

                                          [Cancel]  [Report]
```

- **Size:** 400 px wide at most, radius 12, padding 14 / 16, title in Bree Serif 17, reasons in
  Inter 400 13 with 28 px rows, buttons 32 px tall. It springs in over a blurred scrim.
- **Report** stays disabled until a reason is picked.
- **The warning paragraph** is always visible, in Inter 400 11/16, communityMuted.
- Picking **Self-harm or suicide** adds one line in errorText: `If someone is in immediate
  danger, contact local emergency services.`
- **Who can report:** anyone who can see the post, in any feed or country, except the post's
  own author.
- **After sending:** toast `Thanks for letting us know. Our team will review this.` The post
  disappears from **your** feed straight away.
- **Already reported:** `You've already reported this post.`
- **The outcome is never shown to the reporter.**

API reason values, in the same order: `spam`, `harassment`, `hate_speech`, `sexual_content`,
`child_safety`, `violence`, `self_harm`, `impersonation`, `misinformation`, `prohibited_item`,
`other`.

---

## 8. "New posts" pill (campus feed only)

- `↑ 3 new posts`: purple background, white Inter 600 13, radius 999, padding 6 / 14. It
  floats 8 px under the top of the campus feed.
- **Checking:** every **30 seconds** while the feed is on screen, using
  `GET /api/posts/feed/campus/new-count?since=…`. It stops while the tab or page is hidden.
- **Tapping it** scrolls to the top and reloads. New posts are **never** inserted while
  someone is reading.

## 9. Empty and loading states

| Feed | Empty text |
|---|---|
| Campus | `No posts from IIITDM Kurnool yet. Be the first to say hello.` |
| Your country | `No posts from students in India yet. Start the conversation.` |
| Another country | `No posts from students in Germany yet.` |
| Global | `Nothing here yet. Start the conversation.` |
| A profile's Posts tab | `No posts yet.` |

The text sits on a small glass note, Inter 400 13/19, communityMuted, because it's on the wallpaper.

While loading, show 3 flat skeleton rows, the same shape as a post (avatar circle, two text lines, a
tinted block), split by hairlines.

## 10. Profile → Posts tab

A **Posts** tab sits next to the existing tabs:

| Where | Tabs after Phase 7 |
|---|---|
| Your own profile, website (Dashboard) | My Items, Bought Items, Watchlist, **Posts** |
| Your own profile, app | Listings, Purchases, Watchlist, **Posts** |
| Someone else's profile (website and app) | Listings and Sold as today, plus a **Posts** section |

- It uses the same flat posts (§3).
- Your own Posts tab also shows your `Being checked` and `Under review` posts, with their
  labels. Nobody else sees those posts anywhere.

## 11. The demo

- Demo accounts get a username like `@demo.sunny.otter` when they log in. The onboarding
  screen shows it read-only, with the line `Demo accounts get a name automatically.`
- They see only the demo community, filled with the demo personas' posts. Real students
  never see demo posts, and demo accounts never see real ones.

## 12. New tokens

| Token (app) | CSS variable (website) | Value | Used for |
|---|---|---|---|
| `reactionPillBg` | `--reaction-pill-bg` | `#FFFFFF` | summary pill, breakdown pills |
| `reactionPillBorder` | `--reaction-pill-border` | `rgba(128,0,128,0.12)` | outline of those pills |
| `reactionMineBg` | `--reaction-mine-bg` | `rgba(128,0,128,0.10)` | your own reaction |
| `reactionMineBorder` | `--reaction-mine-border` | `rgba(128,0,128,0.35)` | outline of your own reaction pill |
| `quickBarShadow` | `--quick-bar-shadow` | `0 6px 20px rgba(11,11,11,0.16)` | the quick bar |
| `inputBg` (exists) | `--input-bg` | `#F3F0EF` | sort switch, chips, search fields |
| `chatCanvas` (exists) | `--community-canvas` | `#EDE6F5` | the panels' ground, same as the chat |
| `communityCanvasVeil` | `--community-canvas-veil` | `rgba(237,230,245,0.5)` | holds the tile at 50%, same as the chat |
| `communityRowCampus` | `--community-row-campus` | `rgba(255,250,246,0.5)` | tint behind campus posts |
| `communityRowWorld` | `--community-row-world` | `rgba(255,255,255,0.24)` | tint behind country and Global posts |
| `communityRowHover` | `--community-row-hover` | `rgba(128,0,128,0.035)` | a hovered post |
| `communityGlass` | `--community-glass` | `rgba(255,255,255,0.74)` | panel header, dock, floating pills |
| `communityPill` | `--community-pill` | `rgba(255,255,255,0.72)` | action pills |
| `communityHairline` | `--community-hairline` | `rgba(128,0,128,0.1)` | lines between posts, outlines |
| `communityRail` | `--community-rail` | `rgba(128,0,128,0.26)` | the reply thread, the divider's line |
| `communityMuted` | `--community-muted` | `#5C5969` | secondary text on the wallpaper (5.58:1 on `chatCanvas`; `mutedText` is 4.44:1, too low) |
| `communityLike` | `--community-like` | `#D81E5B` | a liked reply, hover on React |
| `communityFloatShadow` | `--community-float-shadow` | `0 4px 16px rgba(42,8,42,0.12)` | anything floating over the feed |
| `communityEase` | `--community-ease` | `cubic-bezier(0.2,0.8,0.2,1)` | movement and fades |
| `communitySpring` | `--community-spring` | `cubic-bezier(0.34,1.56,0.64,1)` | small things that pop (the app uses a real spring) |

Everything else uses existing tokens: purple, purpleDark, errorText, pinkLight, blackSoft, toastBg and
scrim.

## 13. Constants (same names and values on both platforms)

```
POST_MAX_CHARS            = 1000
POST_FOLD_LINES           = 6
POST_MAX_PHOTOS           = 3
POST_PHOTO_MAX_BYTES      = 5 * 1024 * 1024
FEED_PAGE_SIZE            = 20
REPLIES_PAGE_SIZE         = 20
NEW_POSTS_POLL_MS         = 30000
QUICK_REACTIONS           = ['❤️', '👍', '😂', '😮', '😢', '🙏']
DEFAULT_REACTION          = '❤️'
REACTION_SUMMARY_COUNT    = 4
REACTION_HOVER_DELAY_MS   = 300
REACTION_LONG_PRESS_MS    = 450
REPLY_PREVIEW_COUNT       = 2
GIF_SEARCH_DEBOUNCE_MS    = 300
LAYOUT_MIN_PANEL_PX       = 320
LAYOUT_COLLAPSED_PX       = 36
LAYOUT_BREAKPOINT_PX      = 1024
REPORT_DETAILS_MAX        = 500
```

The website keeps them in `src/utils/community.js`, the app in `src/lib/community.ts`.
