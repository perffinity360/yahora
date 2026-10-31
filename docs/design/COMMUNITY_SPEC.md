# Community — design spec (Phase 7)

**Version 1 · 29 October 2026 · for the website and the app**

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
│ 🏫 IIITDM Kurnool          [‹] [⤢]  ││ [🇮🇳 India ▾]   Hot · New    [⤢] [›] │
│──────────────────────────────────────││──────────────────────────────────────│
│ (avatar) What's happening on campus? ││ (avatar) Share with students in India│
│──────────────────────────────────────││──────────────────────────────────────│
│ ↑ 3 new posts                        ││ post card                            │
│ post card                            ││ post card                            │
│ post card                            ││ post card                            │
│ …                                    ││ …                                    │
└──────────────────────────────────────┴┴──────────────────────────────────────┘
        left: My campus                 ↑ divider        right: country or Global
```

- **Left panel, "My campus":** the campus feed. Its header shows your campus name.
- **Right panel:** a dropdown (§1.3) picks a country or 🌍 Global. Next to it is a
  **Hot · New** switch. Hot is the default (ranking: runbook §1.3).
- **The divider** (react-resizable-panels):
  - drag it to resize; each panel is at least **320 px** wide;
  - double-click it to go back to 50 / 50;
  - keyboard: focus it with Tab, move it with the arrow keys.
- **Panel buttons:**
  - **‹** or **›** collapses that panel to a **44 px** bar. The bar shows the panel's name
    written vertically and an expand button.
  - **⤢** opens that panel full width (the other one collapses). Pressing it again
    restores both.
- **The browser remembers the layout** (localStorage key `yahora.community.layout`), so
  the panels are where you left them next time.

### 1.2 Narrow website (under 1024 px) and the app: a switcher

```
┌──────────────────────────────────┐
│  [  Campus  ] [ 🇮🇳 India ▾ ]     │   ← segmented switcher, sticky under the header
│  Hot · New                       │   ← only on the country / Global side
│  (avatar) What's happening…?     │
│  post card                       │
└──────────────────────────────────┘
```

- When the second segment is already selected, tapping it again opens the dropdown.
- **App:** a new **Community** tab. The tabs are Marketplace, Community, Messages, Profile.
  The icon is Feather `users`. The app still opens on Marketplace.

### 1.3 The country dropdown

```
🇮🇳 India (your country)   ✓
🌍 Global
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

### 1.4 Another country's feed: view only

The post box is replaced by a quiet banner:

```
👀  You're viewing Germany. Only students at universities in Germany can post and reply
    here. You can still react and report.
```

Inter 400 13, mutedText, on inputBg, radius 12, padding 12 / 14.

---

## 2. The composer

### 2.1 Closed

One line: your avatar (32) and grey text that depends on the feed:

| Feed | Grey text |
|---|---|
| Campus | `What's happening on campus?` |
| Your country | `Share with students in India` |
| Global | `Share with students everywhere` |

Clicking it opens the composer: inline on the website, a full-screen compose page in the app
(`app/compose.tsx`, opened as a modal).

### 2.2 Open

```
┌────────────────────────────────────────────────────┐
│ Posting as @rahul.verma · IIITDM Kurnool           │  ← always visible
│ ┌────────────────────────────────────────────────┐ │
│ │ text…                                          │ │  ← grows with the text
│ └────────────────────────────────────────────────┘ │
│ [photo][photo][photo]   or   [GIF preview]         │  ← each with an ✕
│ (📷) (GIF) (😊 web only)        Campus     87  [Post]│
└────────────────────────────────────────────────────┘
```

- **"Posting as @username · Campus name"** is always shown, in Inter 500 12, mutedText.
  Seeing your own name is the cheapest moderation there is.
- **Text:** up to **1,000 characters**, counted the way runbook §1.12 explains (one emoji
  is one character).
  - The counter appears only when 100 or fewer are left. It turns errorText at 0, and Post
    is disabled above 1,000.
- **Where the post goes** is shown as a small chip (`Campus`, `India` or `Global`). It always
  matches the feed you opened the composer from, and can't be changed inside the composer.
- **Photos:** up to **3**; JPEG, PNG or WebP; at most 5 MB each.
  - Previews are 72 × 72 with radius 10 and an ✕ to remove.
  - Too big: `That photo is bigger than 5 MB.`
- **GIF:** one GIF, from the GIF picker (§6).
  - A post has **either** photos **or** a GIF. While one is attached, the other button is
    disabled and its tooltip (web) or press hint (app) says
    `Remove the photos to add a GIF` (or the other way round).
- **Emoji:** on the website, the 😊 button opens the full emoji picker (§5.4). The app relies
  on the phone keyboard's emoji.
- **Post is enabled** when there is text, a photo or a GIF. It shows a spinner while posting.
- **Replies** use the same composer with text and a GIF, but no photos (§4).

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
💜  You're not alone
    If you're going through something difficult, talking to someone can help.
    India: Tele-MANAS — call 14416 (free, any time)
    Anywhere else: findahelpline.com
                                                    [Close]
```

Inter 400 14/20 on pinkLight, radius 16, padding 16. The phone number and the link are
tappable. Nothing on this card may sound like a punishment.

---

## 3. The post card

```
(avatar 40)  Rahul Verma  @rahul.verma · IIITDM Kurnool · 2h        ⋯
             [🌍 Global]                       ← scope chip, campus feed only
             Text of the post, Inter 400 15/22, black-soft. Long posts fold after 6
             lines with "See more"…
             ┌───────────── photos (1–3) or GIF ─────────────┐
             └────────────────────────────────────────────────┘
             (❤️😂😮 1.2K)                      ← reaction summary (§5.3)
             [♡ React]   [💬 14]
```

- **Author line:** full name in Inter 600 14; `@username · campus · time` in Inter 400 13,
  mutedText. Tapping the avatar or the name opens the profile.
- **Time:** `now`, `5m`, `2h`, `3d`; then `12 Oct`, or `12 Oct 2025` for an earlier year.
  Reuse the message time formatter.
- **Scope chip:** only in the campus feed, on posts that went to a country or to Global:
  `🇮🇳 India` or `🌍 Global`. Inter 500 11, on inputBg, radius 999, padding 2 / 8.
- **Text:** links are tappable; there are no link previews. A long post folds after
  **6 lines** behind `See more`, which expands it in place.
- **Photos** (radius 12, 2 px gaps; tapping one opens the existing image viewer):
  - **1 photo:** full width, its own shape, but between 4:5 and 16:9 and never taller than
    480 px;
  - **2 photos:** two squares side by side;
  - **3 photos:** one large photo on the left, two stacked on the right.
- **GIF:** plays muted and on a loop while on screen, and pauses when it scrolls away. It
  carries a small `GIF` badge in the corner.
- **Actions:**
  - **React:** your current emoji, or ♡ if you haven't reacted (§5).
  - **💬 count:** opens the post's page.
  - **⋯ menu:** Report (§7); Delete for your own posts, with confirm text
    `Delete this post? It will be removed for everyone.`
- **Counts:** `999`, `1.2K`, `12K`, `1.2M`.

### 3.1 States

| State | Who sees what |
|---|---|
| `Being checked` (held) | Only the author, on their Posts tab, with a grey label. |
| **Under review** (reported) | It's taken out of every feed. On the profile or a direct link, others see a cover: `This post was reported by several students and is being reviewed.` plus a **View anyway** button. The author sees the post with the label `Under review`. |
| Deleted | It disappears everywhere. A direct link shows `This post was deleted.` |
| Removed by Yahora (Phase 9) | A direct link shows `This post was removed for breaking the Community Guidelines.` |

---

## 4. A post's page and its replies

- **Routes:** website `/post/:id`, app `app/post/[id].tsx`.
- **The post** sits at the top, slightly larger: text 17/26.
- **Replies:**
  - shown oldest first, 20 at a time, with a **Load more replies** button (not infinite
    scroll);
  - each reply has a 32 avatar, the same author line, text with an optional GIF, a React
    button and a ⋯ menu;
  - there are **no replies to replies**: one level only.
- **Reply box,** pinned at the bottom:
  - grey text `Reply to @username…`, up to 1,000 characters, with a GIF button;
  - in a feed where you can only view, it's replaced by `Only students in India can reply.`

---

## 5. Reactions — on posts, replies and messages

One reaction per person per post (or message). Picking a different emoji replaces your
reaction; picking your current one again removes it.

### 5.1 The quick bar

```
 ( ❤️  👍  😂  😮  😢  🙏  ⊕ )
```

- **The six, in this order:** ❤️ 👍 😂 😮 😢 🙏. Then **⊕**, which opens the full emoji picker.
- **Look:** a white pill with radius 999 and a soft shadow. Each emoji is 26 in a 44 × 44
  touch target. Your current reaction sits on a `reactionMineBg` circle.
- **How to open it:**
  - **App:** tap React = ❤️ on or off. Long-press React (or long-press the post) = the
    quick bar.
  - **Website:** click React = ❤️ on or off. Hover React for **300 ms** = the quick bar. It
    also opens from the keyboard: focus React and press ↑.
- **Animation:** the chosen emoji pops (scale 1 → 1.25 → 1 over 200 ms). With reduced motion
  turned on, there's no pop.

### 5.2 The full picker (⊕)

- A search box: `Search emoji`.
- **Frequently used**, remembered on that device.
- Then every category, with category tabs.
- **Libraries:** website `emoji-picker-react`, app `rn-emoji-keyboard`. Style them with your
  tokens: white surface, radius 16, purple for the selected category.

### 5.3 The summary under a post

```
( ❤️😂😮 1.2K )
```

- The **top 3 emojis** by count, then the total.
- Inter 500 12, mutedText, on reactionPillBg with a reactionPillBorder outline, radius 999,
  padding 4 / 10.
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
- **The pill under a bubble:**
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
│ 🔍 Search GIFs                    │
│ ┌─────┐┌─────┐┌─────┐             │   trending first, then search results
│ │ gif ││ gif ││ gif │   …         │   app: 2 columns · website: 3 columns
│ └─────┘└─────┘└─────┘             │
│                  Powered by KLIPY │   ← required credit
└───────────────────────────────────┘
```

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

- **Report** stays disabled until a reason is picked.
- **The warning paragraph** is always visible, in Inter 400 12/18, mutedText.
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
| Campus | `No posts from IIITDM Kurnool yet. Be the first to say hello 👋` |
| Your country | `No posts from students in India yet. Start the conversation.` |
| Another country | `No posts from students in Germany yet.` |
| Global | `Nothing here yet. Start the conversation 🌍` |
| A profile's Posts tab | `No posts yet.` |

While loading, show 3 skeleton cards (avatar circle, two text lines, a grey block). Use the
existing Skeleton components.

## 10. Profile → Posts tab

A **Posts** tab sits next to the existing tabs:

| Where | Tabs after Phase 7 |
|---|---|
| Your own profile, website (Dashboard) | My Items, Bought Items, Watchlist, **Posts** |
| Your own profile, app | Listings, Purchases, Watchlist, **Posts** |
| Someone else's profile (website and app) | Listings and Sold as today, plus a **Posts** section |

- It uses the same post cards.
- Your own Posts tab also shows your `Being checked` and `Under review` posts, with their
  labels. Nobody else sees those there.

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

Everything else uses existing tokens: purple, mutedText, inputBg, errorText, pinkLight,
blackSoft, hairline, toastBg and scrim.

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
REACTION_HOVER_DELAY_MS   = 300
GIF_SEARCH_DEBOUNCE_MS    = 300
LAYOUT_MIN_PANEL_PX       = 320
LAYOUT_COLLAPSED_PX       = 44
LAYOUT_BREAKPOINT_PX      = 1024
REPORT_DETAILS_MAX        = 500
```

The website keeps them in `src/utils/community.js`, the app in `src/lib/community.ts`.
