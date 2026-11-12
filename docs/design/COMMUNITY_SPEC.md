# Community — design spec (Phase 7)

**Version 3.10 · 10 November 2026 · for the website and the app**

> **Changed in version 3.10 (owner, 10 Nov):** **on a phone the composer sits in a solid dock, as on a
> laptop,** instead of floating: posts showed through the gap under it. The page's background is the dock's colour
> while it's open, so the strip behind a phone's navigation buttons matches it (§1.2, §2.1). **Only a reply's
> campus takes a second line** in a narrow feed, closer under the username than the text is under it, like
> Quora's; a post keeps its one line (§3, §4). The profile glimpse opens from the avatar as well as the
> username, and waits until its counts and photos are ready, so it opens once at its full size instead of
> growing and flickering (§4.1). A reply's username is centred on its avatar by the middle of its lowercase letters, using the font's
> own measurements (§4).

> **Changed in version 3.9 (owner, 10 Nov):** **pressing React always opens the quick bar,** with a mouse, the
> keyboard or a finger, on the website and in the app; nothing gives ❤️ by itself any more, and hover still
> opens the bar too (§5.1). **In a narrow feed the campus gets a line of its own** under the username, like
> Quora's, on posts and replies in the country and Global feeds (§3, §4). The profile glimpse picks above or
> below once, at its full height, instead of opening below and jumping above when its photos load (§4.1).
> On a phone the composer's outline is always the feed's dark accent (§2.1). Post text is Inter 400 15/20
> (§3; was 14/20).

> **Changed in version 3.8 (owner, 10 Nov):** **no full names anywhere,** only `@username` and the campus:
> on a post, in the profile glimpse and in the brand menu (§1.1, §3, §4.1); the campus no longer disappears
> in a narrow feed, so a phone shows it on posts and replies in the country and Global feeds (§3, §4); no
> `(AUTHOR)` tag, the highlighted username is enough (§4); the first reply sits as far below the post as the
> replies sit from each other (§4); no tooltip on your avatar on the divider (§1.1); on a touch screen,
> tapping React opens the quick bar instead of giving ❤️ (§5.1).

> **Changed in version 3.7 (owner, 8 Nov):** each reply's curve leaves the thread from inside the line
> (it started a fraction of a pixel to its left); pointed at, the thread takes the card's left-edge colour
> and goes to 2 px, not 2.5 (§4); equal room above and below the laptop composer (§2.1); the Post pill sits
> concentric in the composer's rounded end, your avatar mirrors it at the other end, and on a phone the text
> line sits on its middle (§2.2); on a phone the site navbar is hidden too, and the brand
> pill sits at the right end of the switcher, 14 px in from the screen's edge, and the floating composer 14 px
> in from both (§1.2, §2.1); no cap or flag chip in the phone composer (§2.2); Settings in the brand menu,
> marked `Soon` (§1.1); no strip of bare page
> under a short feed on a phone (§1.2); on a phone, tapping the selected country's name opens the dropdown
> (§1.2); the two unused campus badge tokens are gone (§12).

> **Changed in version 3.6 (owner, 8 Nov):** the doodles at 15%; the divider moves freely with no snap, a
> panel's content stops adjusting at 320 px and is cut off (as on LeetCode); darker, thicker threads on
> hover; equal space either side of the cards; the logo cropped to fill the pill; `(AUTHOR)`; a gallery grid
> and a Follow button in the profile glimpse.

> **Changed in version 3.5 (owner, 8 Nov):** a more purple campus ground and a pinker world one, the doodles
> at 8%, and a gradient on each header; the divider snaps a panel shut, or open, after 48 px instead of 142;
> darker threads on hover; cards 10 px in on the left and 3 on the right; a bigger logo in the same pill; a
> quicker Hot / New tooltip; a hover on every action pill.

> **Changed in version 3.4 (owner, 7 Nov, evening):** no frame around the panels, and the page clips at its
> edges; a smaller brand pill inside the headers; Hot · New on the right; the thread and a card's left edge
> in the zone's colour, with a trunk on every card; slimmer gaps around the cards; every action pill pinkish.

> **Changed in version 3.3 (owner's redesign brief, 7 Nov):** on a laptop the site navbar gives way to a
> **centre brand pill** at the top of the divider, with a menu (§1.1); a **glow-bar grip** (§1.1); **two
> zones** on one wallpaper, the doodles at 5%, with `CAMPUS` / `ALL CAMPUSES` badges in the headers (§1.1);
> **posts on frosted cards** (§3) with the author's college as a pill in the world feeds; the text halo is
> gone.

> **Changed in version 3.2 (owner's review, 7 Nov):** photos show one at a time, whole, in a smaller
> frame, with swipe and chevrons (§3); a grid of lines on the Global globe (§1.1); an `AUTHOR` tag on the
> author's replies and a profile glimpse on names instead of an underline (§4, §4.1); the hand cursor
> covers the whole avatar (§1.1); no footer and no frame under the panels (§1.1); emoji in post text a
> size up (§3); one or two replies never show `Show more replies`, whatever the API sends (§4).

> **Changed in version 3.1 (owner's review of the redesign, 6 Nov):** one side is always selected on a
> laptop, the campus side by default, with the cursor waiting in it (§1.1, §2.1); pressing your avatar
> switches sides; a thinner divider with a new grip (§1.1); the panels' scrollbar shows only while they
> scroll (§1.1); a drawn colour globe for Global (§1.1); the thread curves like a quarter circle and
> darkens more on hover (§4); `Hide replies`, and no `Show more replies` for fewer than 3 replies (§4);
> Enter posts (§2.2); usernames get a hover of their own (§3, §4); GIFs are back on a see-through tint
> (§3); a tighter composer bar (§2.1).
>
> **Changed in version 3 (the redesign, runbook Block V-P):** flat posts on the chat's wallpaper,
> thin and compact everywhere, the avatar in a column of its own with a text halo over the doodles,
> a composer docked at the bottom of each feed with your avatar on the divider, replies shown under
> each post with a curved thread, a reply can only be liked, icons instead of words, and no emoji
> in the interface itself.
> Generic rules from this redesign are in `frontend/DESIGN.md` and `mobile/DESIGN.md`.
>
> **`top_replies` on a PostItem (§4)** is built (Block V-C, migration `feed_top_replies`, 11 Nov). It
> reaches production when that migration is pushed; until then a post shows only `Show more replies`.
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
│ …  (posts pass under the header)     ││ …                                    │
│                                     ╭▀▀╮                                     │
│ ───────────────────────────────────(│me│)─────────────────────────────────── │
│ ( What's happening…    🖼 ( Post ) )╰──╯( Share with students…  🖼 ( Post ) ) │ ← 42
└──────────────────────────────────────┴┴──────────────────────────────────────┘
        left: My campus          avatar on the divider     right: country or Global
```

- **Two zones, one wallpaper:** both panels keep the chat's doodle tile (`MESSAGES_SPEC.md` §2), pinned
  while posts scroll, at **30%** on both the website and the app (owner, 13 Nov; it was 15%). Each panel
  has its own ground: `communityPanelCampus` (purple tint) on the left, `communityPanelWorld` (pink tint) on
  the right. (The website's veil over the tile is that ground at 70%: `communityPanelCampusVeil`,
  `communityPanelWorldVeil`; the app draws the tile at 30%, `COMMUNITY_WALLPAPER_OPACITY`.) A narrow window takes
  the ground of the feed it shows. Posts sit on frosted cards (§3).
- **No frame around the panels** (owner, 7 Nov): they run to the window's edges, with square corners, and
  the composer bar sits on its bottom edge. The page clips anything at its edges (`overflow: clip`): with
  the divider at the right edge, the avatar's badge sits at the window's edge, and letting it reach past
  could bring a page scrollbar in and out, which shakes the divider. **The site
  footer isn't shown** on the Community page (nor on Messages).
- **No text halo any more** (owner, 7 Nov): the cards give the text its ground instead.
- **The site navbar is hidden on the Community page** at every width (on a narrow window since 8 Nov, §1.2),
  so the panels reach the top of the window. It stays mounted, out of sight, because it keeps presence,
  delivery ticks and the unread count running.
- **The centre brand pill** sits where the two headers meet, at the top of the divider, and moves with it
  (`--split-pct`, measured from the divider; kept 64 px from the window's edges when a panel is collapsed).
  **It stays inside the 36 px headers it joins:** top 4, 28 tall, padding 0 9 0 8, radius 999, white, a
  1.5 px `communityPillBorder` outline (`purple` on hover and while open), `communityPillShadow` plus a 2 px
  `communityPillRing`. Inside, 5 apart, padding 0 8 0 6: the Yahora logo (bag and wordmark), **cropped to its
  artwork and 20 tall** (the image's artwork fills only its middle half, so at 23 tall it showed 11), a 1 × 14
  `communityPillDivider`, a 14 × 10 ☰ that turns into ✕ while open, and the unread count on a 16 px
  `pinkDark` pill. It lifts 1 px on hover and presses to 0.97.
- **Its menu** opens under it (top 40, 250 wide), glass (`communityMenuGlass`, blur 18) with radius 16
  and `communityMenuShadow`, springing from the pill while its rows arrive 22 ms apart: **Home**,
  **Marketplace**, **Community** (current, white on `purpleDark`), **Messages** with the unread count,
  **Saved / Cart** (to the dashboard, where the Watchlist is), **Notifications** and **Settings** (both marked
  `Soon`; there is nothing to open yet, and the site has no settings page), then **you**: photo, `@username` (never the full name), `Your profile` (to the dashboard) and a log-out button.
  Rows are 36 tall, Inter 500 14, `reactionMineBg` on hover. Esc or a press elsewhere closes it; Esc gives
  the focus back to the pill.
- **Header clearance:** each header keeps clear of the pill, so ⤢ never slides under it: 72 px at 50 / 50,
  and more when the divider is near a window edge, where the pill stops 72 px short while the divider goes on
  (`Community.jsx` measures how far the pill reaches over each header, plus 8 px).
- **Zone badge:** `ALL CAMPUSES` after the country or Global on the right (`communityBadgeWorldBg`,
  `communityBadgeWorldText`, `communityBadgeWorldBorder`): Inter 700 10, capitals, padding 2 / 8, radius
  999. A header narrower than 430 px drops it first. The campus header has none (owner, 7 Nov: the campus
  name says it already).
- **Hierarchy:** My campus is the main panel. Its title is Bree Serif 15 in purple-dark. The right
  title is Inter 600 14.
- **Panel header:** **36 px**, glass (blur 14) in a soft gradient: from the zone's tint at the outer edge to
  white where the two headers meet under the brand pill (`communityHeaderCampus`, `communityHeaderWorld`;
  owner's mockup, 8 Nov). It floats over the feed, so posts pass underneath it.
- **Left panel, "My campus":** the campus feed. Its header shows an animated graduation-cap icon and
  your campus name. It shows **only campus posts**: a post appears only in the feed it was posted to,
  never in another.
- **Right panel:** the title is the dropdown (§1.3) that picks a country or Global. **At the header's right
  end, beside ⤢,** is a **Hot · New** switch made of two icons (flame, clock), with a thumb that slides
  between them (owner, 7 Nov; it used to sit next to the title). Hot is
  the default (ranking: runbook §1.3). Resting the mouse on one for **350 ms** shows `Hot` or `New` in a
  small `toastBg` tip under it (the browser's own tooltip took over a second); it doesn't show again after
  a press until the pointer leaves.
- **Icons, not emoji:** the campus icon is drawn in when it first appears, and hovering the header gives
  the cap a small hop. Flags stay emoji, because they are worked out from the code.
- **The Global globe** sits among flag emoji (the dropdown, the panel title, the badge on your avatar),
  so it is drawn in colour to match them, not as a line icon: an ocean from `blueLight` at the upper left
  into `blueDark` at the edge, `communityGlobeLand` continents (the Americas, Europe and Africa, Asia and
  Australia at the rim), **a grid of white lines at 70%, 1.1 wide** (the equator, two parallels, one
  meridian ellipse and the axis, the 🌐 sign everyone knows; without it the disc read as a ball), a
  `communityGlobeShade` shadow towards the lower right, a white shine at 30%, and a thin `blueDark` rim at 55%. It pops in (scale 0.7 → 1, 360 ms, `communitySpring`) and, when its header
  or button is hovered, turns once: the land slides one face to the left over 900 ms.
- **The panels' scrollbar shows only while they scroll.** It's see-through at rest and keeps its room, so
  nothing moves when it appears: `communityScrollbar`, thin, then it fades 900 ms after the last scroll.
  (Website only; the app uses the phone's own indicator.)
- **The divider** (react-resizable-panels), **4 px** wide (the library still gives a mouse 10 px to grab,
  a finger 20):
  - white at rest, down to the composer bar, where it takes `communityDock` so the two bars read as one.
    The panels' corners there are square;
  - **the glow-bar grip,** in the middle of its height: a white capsule, 12 × 46, with a 1.5 px
    `communityGripGlowBorder` outline and `communityGripGlowShadow`, holding a 4 × 26 bar that runs
    `purpleDark` → `purpleLight` → `pinkDark`, glowing (`communityGripGlow`, 8 px);
  - while hovered, dragged or focused, a purple line runs its length, down to the composer bar, and the
    grip grows to 1.08 with a `purple` outline and `communityGripGlowShadowHover`;
  - **drag it freely, with no snap** (owner, 8 Nov), from one edge to the other: a panel can be dragged all
    the way into its 36 px bar and back out. Its **content stops adjusting at 320 px**
    (`LAYOUT_MIN_PANEL_PX`) and is cut off at the divider beyond that, as on LeetCode. (The library's
    collapse snap, at 142 px and then 48 px past a 320 px minimum, felt like a wall.) Restoring a panel that
    was dragged into its bar opens it to half the width; one closed with ⤢ goes back to its old width;
  - double-click it to go back to 50 / 50;
  - keyboard: focus it with Tab, move it with the arrow keys.
- **One side is always selected:** the side you're writing on. The page opens with the **campus side**
  selected and, with a mouse, the cursor already in its composer (not on a touch screen, where it would raise
  the keyboard). Using either composer selects its side, and it **stays selected when you click away**: its
  composer keeps its highlight (§2.1) and your avatar keeps that half filled in. A collapsed panel, or a
  view-only country (§1.4), can't be selected; the other side is shown instead until it can.
- **Your avatar on the divider:** 56 px across, 5 px from the bottom, so it sits across the top edge of the
  composer bar with the two composers tucked in under it. Nothing runs below it. It is a child of the
  divider, so it moves with it as you resize, and it grows slightly on hover and while dragging. **Pressing it
  switches sides** (and puts the cursor in that composer), so the pointer is a hand **on every part of it**
  (the library's own resize cursor near the divider's line is overridden there). It has **no tooltip**
  (owner, 10 Nov; it said `Post in India` / `Post in My campus`). A press that moves drags the divider instead, with the resize
  cursor. From the outside in:
  - **a 2.5 px ring:** `purpleDark` while the left side is selected, `pinkDark` for the right;
    `communityRail` only when neither side has a composer;
  - **a 2.5 px band, split down the middle:** `chatCanvas` at rest. The half on the selected side fills
    in over 200 ms: solid `purple` on the left; on the right, `pinkDark` at the top and bottom running to `purple`
    at its outer edge (a conic gradient). The other half stays `chatCanvas`;
  - **a 2.5 px white gap,** then the **photo, 41 px,** with a 1 px `communityGripBorder` edge instead of the
    usual avatar ring;
  - **a `purpleDark` cap** on top, 11 × 10, rounded at the top, sitting over the ring;
  - **a soft glow** in the side's tint (`reactionMineBg` or `communityWorldTint`).
  - **A badge springs out on that side,** 30 × 20, over the ring's upper corner, 20 px from the centre: a white
    graduation cap on `purpleDark` on the left; on the right, the flag (or the globe for Global) on `pinkDark`.
    **Icons only, no words.** It's hidden from screen readers, because the composer's own label says where the
    post goes. Tab reaches both composers, so pressing the avatar is only a shortcut for a mouse.
- **Panel button (26 × 26): ⤢ only.** It opens that panel full width: the other one collapses to a
  **36 px** bar showing its name written vertically and an expand button. Pressing ⤢ again (it shows as
  restore), or the bar, brings both back. The panels glide over 280 ms when a button moves them, never during
  a drag. (The separate ‹ / › collapse buttons were removed on 7 Nov: ⤢ on the other panel does the same.)
- **Posts follow the panel's width,** not the window's. Rows always run edge to edge; their content
  stops at 860 px, centred, so a panel opened full width still has readable lines.
- **The browser remembers the layout** (localStorage key `yahora.community.layout`), so
  the panels are where you left them next time.

### 1.2 Narrow website (under 1024 px) and the app: a floating switcher

```
┌──────────────────────────────────┐
│ ( (cap) [🇮🇳 India ⌄] ) ([🔥|🕐]) (≡Y)│   ← floating pills: feeds, Hot · New, brand
│ post                             │
│ ──────────────────────────────── │
│ post                             │
│▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔│
│ ( (me) What's happening…?      ) │   ← the composer's dock, solid
└──────────────────────────────────┘
```

- **The switcher floats.** The bar is transparent, sticky at the top, and only its pills take presses.
  Posts scroll underneath, which keeps the screen feeling open. It takes 50 px.
- **The pill:** a campus icon, then the selected country or Global.
- **The chevron shows only on the country / Global side,** inside the same purple as the country's
  name. It slides open as you switch, and on the campus side it takes up no room. From the campus side,
  tapping the name selects the country / Global feed; **once you're on it, tapping the name opens the
  dropdown too**, like the chevron (§1.3; owner, 8 Nov: the chevron alone was too small a target on a
  phone). The dropdown hangs from the whole purple pill.
- **Hot · New** is the last pill, only on the country / Global side.
- **The brand pill (website, owner 8 Nov):** the site navbar is hidden here on a phone too, so the brand
  pill (§1.1) sits in the switcher, **always at its right end**, with Hot · New just before it on the country /
  Global side, **14 px from the screen's edge** (the bar's other pills keep 8): with its 2 px ring and shadow
  it sat on the very edge, where a curved or rounded screen cuts it. It is 34 tall here, like the pills
  beside it, with the same logo, ☰ and unread count. Its menu (§1.1) opens under it, lined up with the pill's
  right edge, so it never runs off a 360 px screen. If the feeds pill runs out of room, the country's name shortens with `…`.
- **The page is exactly the visible screen** (`100dvh`) when its feed is short, so there is nothing to
  scroll into under the composer's dock or the view-only line. At `100vh` a phone browser with its address
  bar showing let a short feed scroll into a strip of bare page (owner, 8 Nov).
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

Inter 400 13/18, communityMuted, with the icon in purple, in the composer's dock (§2.1) on every
width.

---

## 2. The composer

### 2.1 Closed

The composer is **always at the bottom of the feed**, separately for each panel: a 38.5 px dock in
`communityDock` with a 1.5 px `communityRail` top line, holding a white one-line field 33 px tall, 2 px
under the line and 2 px above the bottom (the same room either side, owner 8 Nov; was 2.5 and 1.5), with a 1.5 px `communityRail` outline and Inter 400 14/20 text.
**At the end of the line:** the photo icon, faded to 65%, and the `Post` pill.

On a laptop each field ends 13 px from the divider's centre, tucked in under the shared avatar (§1.1). Its
corners are radius 20 on the outer side and 18 on the side by the avatar, and its padding keeps the text and
tools clear of the avatar. **On a narrow window, and in the app, it's the same solid dock** (owner,
10 Nov), full width and held at the bottom of the screen, padded by `safe-area-inset-bottom` where a phone
reports one. **The strip behind a phone's navigation buttons is the dock's colour too.** Chrome on Android
paints that strip in the page's background colour (Quora's dark page gets a dark strip), and ours was the
site's `--bg`, a beige that didn't match the dock above it. While the Community is open the page's
background is `communityDock`; leaving puts `--bg` back. It used to float 14 px in from each side with a gap under it, and
the posts scrolling past showed through the gap and around its ends, which looked messy and confused
people. The field is 8 px in from each side, radius 20, with your avatar (26, or 36 on a touch screen,
§2.2) inside it. Grey text depends on the feed:

| Feed | Grey text |
|---|---|
| Campus | `What's happening on campus?` |
| Your country | `Share with students in India` |
| Global | `Share with students everywhere` |

**Clicking it highlights it, and it stays one line.** The outline turns to the feed's accent with a 3 px soft
tint around it: `purpleDark` on the campus feed, `pinkDark` on a country or Global feed. Both layouts do this.
**On a narrow window the outline is that dark accent all the time** (owner, 10 Nov). Clicking it adds only
the tint.
The tools come to full strength, and GIF and emoji slide in beside the photo icon over 220 ms. Pressing
elsewhere, Tab or Esc puts GIF and emoji away again. **On a narrow window** that also ends the highlight.
**On a laptop** the highlight stays on the selected side's composer (§1.1) whether or not it's in use, so
one of the two composers is always lit; the campus one when the page opens. In the app, tapping opens a
full-screen compose page (`app/compose.tsx`, opened as a modal).

### 2.2 In use

```
┌─────────────────────────────────────────────────────────┐
│ [photo][photo][photo]   or   [GIF preview]              │  ← each with an ✕
│ text…  (grows with the text)   🖼 GIF ☺ 87 ( Post )       │  ← tools stay at the end of the last line
└─────────────────────────────────────────────────────────┘
```

- **No "Posting as" line.** Your avatar and the feed you're in already say who and where.
- **Very narrow space:** if the line can't give the text at least 140 px, the tools drop to a row of their own.
  On a 390 px phone that happens when the composer comes into use.
- **Text:** up to **1,000 characters**, counted the way runbook §1.12 explains (one emoji
  is one character).
  - The counter appears only when 100 or fewer are left. It turns errorText at 0, and Post
    is disabled above 1,000.
- **Where the post goes** always matches the feed you're in, and can't be changed inside the composer. On a
  laptop the badge on your avatar shows it (§1.1); on a narrow window the grey text and the switcher say it,
  and there's no chip in the composer (owner, 8 Nov: the cap or flag beside the tools is gone).
- **Post** is a 26 px pill with the word `Post` (`Reply` for a reply), Inter 600 13 in white, on `purpleDark` on
  the campus feed and `communityWorldStrong` on the others.
- **It sits concentric in the field's rounded end** (owner, 8 Nov): the same gap above, below and after it,
  and its radius is the field's end radius minus that gap, so the two curves run parallel. With a mouse the
  field is 33 tall (end radius 16.5) and the pill sits 3.5 px in (radius 13); on a touch screen it's 41 tall
  (radius 20), the pill 36 tall and 2.5 px in, radius 17.5. Only the left laptop composer, whose end is tucked
  under your avatar, keeps its 26 px end padding.
- **Your avatar mirrors the Post pill at the other end** (narrow window and app, owner 8 Nov): as tall as the
  pill (26 with a mouse, 36 on a touch screen) and the same gap below and before it (3.5 / 2.5 px), so it sits
  concentric in the field's left end. The reply chip and the previews keep the field's 12 px start padding.
- **The text line sits on the Post pill's middle.** On a touch screen, where the tools are 36 tall, the text
  box sits 4 px up from the row's bottom, so its line doesn't sit 4 px low. As the text grows, its last line
  stays level with the pill.
- **Enter posts, Shift + Enter starts a new line,** on the website, the same as the chat (MESSAGES_SPEC §2
  "Composer"). On a touch keyboard Enter is a new line and the Post pill posts; Ctrl or Cmd + Enter still
  posts there. Nothing is sent while an input method is still composing, and Enter on an empty composer
  does nothing.
  - **With a mouse, once there's something to post,** pointing at it slides the word up and out and an arrow
    (lucide `ArrowUp`, 15) up into its place, over 200 ms. The pill keeps its size and its label. Touch screens
    and a disabled pill keep the word.
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
- **Replies** use the same composer with text and a GIF, but no photos (§4). A top line shows only the
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

Inter 400 14/20 on pinkLight, radius 12, padding 12, with a purple `HeartHandshake` icon and the title
in Bree Serif 15. It takes the composer's place in the dock. The phone number and the link are
tappable. Nothing on this card may sound like a punishment.

**The same card, later.** A post can be held for self-harm after it was sent, if the check had to
wait. While that post is held, the author's Posts tab shows this card directly under it, without
**Close** (API field `moderation_support`).

---

## 3. The post

**A frosted card** (owner, 7 Nov; was a flat row): each post and its thread sit on `communityCard`
(white at 94%, blur 8), a 1 px `communityCardBorder` (`communityCardBorderHover` on hover) with **a 3 px
accent down the left edge in the zone's colour** (`purpleDark` on campus, `pinkDark` on a country or Global),
radius 14, `communityCardShadow`. **Slim:** padding 10 / 12 / 8, cards **6 apart, with the same space either
side:** 10 px, or the scrollbar's room if that is wider (the right side counts the scrollbar's room, which
`scrollbar-gutter: stable` keeps constant), so the doodles show only around them. At most 860 wide, centred. Skeletons use the same card.
**Every card has its trunk:** the thread's line runs down from under the avatar to the end of the post, and on
into the replies when there are any.

```
(av) @rahul.verma (cap IIITDM Kurnool) · 2h                          ⋯
 │   Text of the post, Inter 400 15/20, black-soft. Every line starts
 │   under the username, and so does everything below it.
 │   ┌─────────────────── photos (1–3) or GIF ───────────────────┐
 │   └───────────────────────────────────────────────────────────┘
 │   ( ❤️ 😂 😮 👍 1.2K ) ( ☺ ) ( 💬 14 )     ← pills (§5.3)
 ╰─(av) replies (§4)
```

- **The avatar has a column of its own:** 28 px, then 8 px. The author line, text, photos, GIF, actions
  and replies all start at the same left edge, so on the busy wallpaper you can always see what belongs
  to which post. On a 390 px phone the text gets 330 px. (Version 3 first floated the avatar as a drop
  cap; it made the rows hard to scan.)
- **Author line: always exactly one line,** at every width (owner, 10 Nov: a post has the room; only a
  reply's campus takes a second line, §4). **No full name, anywhere** (owner, 10 Nov): `@username` in
  Inter 600 13, black-soft (like a reply's), then the campus and `· time` in Inter 400 13, communityMuted.
  When space runs out they truncate with `…` in this order: the campus first, then the username. Neither
  disappears: the username keeps at least 40 px and the campus 48. The time never goes. Tapping the
  avatar or the username opens the profile. Tapping the time opens the post's page.
- **Campus name:**
  - **never in the campus feed,** where it's obvious;
  - **always in the country and Global feeds,** at every width, on posts and on replies (owner, 10 Nov; it
    used to be hidden in a feed 420 px wide or less, so a phone never showed it). When the line is short it
    truncates with `…`; a reply's campus moves to a line of its own instead (§4). On a post it's a compact pill: a graduation cap and the college, Inter 500
    11, `communityCollegeText` on `communityCollegeBg`, padding 0 7, radius 999 (replies keep the plain
    `· campus` text).
- **Time:** `now`, `5m`, `2h`, `3d`; then `12 Oct`, or `12 Oct 2025` for an earlier year.
  Reuse the message time formatter.
- **Text:** Inter 400 15/20, black-soft (owner, 10 Nov; was 14/20). Links are tappable; there are no link previews. A long post folds after
  **6 lines** behind `See more`, which expands it in place.
- **Photos: one at a time, like Instagram** (owner, 7 Nov; was a grid):
  - **The frame** takes the first photo's shape, kept between 4:5 and 16:9, full width but at most
    **480 × 380** (was 560 × 420), radius 8.
  - **Each photo shows whole** (`object-fit: contain`) over a blur of itself (18 px, 55%), so a photo of
    another shape is never cropped and never sits on bare bars.
  - **More than one:** swipe or scroll sideways (snapping to each photo), or press the chevrons: 26 px
    glass circles at the sides, only where there's somewhere to go, shown on hover with a mouse and always on
    touch (44 px to tap). ← → work once it has focus. Dots sit at the bottom, 5 px, on a `toastBg` pill;
    the current one is white, the others at 45%.
  - **Pressing a photo** opens the existing image viewer at that photo, with its zoom.
- **GIF:** at most 280 px wide, on a see-through `reactionPillBorder` tint (the doodles show through a GIF's
  transparent parts; the owner preferred that to a solid backing, 6 Nov). Plays muted and on a loop while on
  screen, and pauses when it scrolls away. It carries a small `GIF` badge in the corner.
- **Emoji inside the text are a size up,** 1.28 em (the chat's 18 on 14), line height 1: the emoji font
  draws many of them smaller than the letters around them.
- **Links in a post say their own hover colour** (website): the name and the @username turn `purple`, with
  no underline, and resting on them opens the profile glimpse (§4.1);
  the time turns `purple` and underlines, a link in the text turns `purpleDark`. `footer.module.css` has a bare
  `a:hover` that turns every link on the site `pinkLight`, which nearly vanishes on the wallpaper.
- **Actions: icons in pills, no words,** 24 px tall, with 4 px between them:
  - **The reaction summary** (§5.3), when there are reactions.
  - **React:** your current emoji, or a line-drawn smiley icon (lucide `Smile`, Feather `smile` in the app)
    if you haven't reacted (§5).
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
(av) Post author …
 │   ( ❤️ 😂 1.2K ) ( ☺ ) ( 💬 14 )
 ╰───(av) @priya.nair · IIITDM Kurnool · 2h                 ♡ 12  ⋯
 │        Reply text, Inter 400 13/19. Every line starts under the username.
 ╰───(av) [@rahul.verma] · 1h                               ♥ 3   ⋯
 │        The highlighted name is the post's own author.
 ╰─── ⌄ Show more replies  ⌃ Hide replies   ← Hide only once Show more was pressed
```

- **Top replies show by default:** the **2** hottest (`REPLY_PREVIEW_COUNT`): replies are ranked by
  the Hot formula, `(likes + 1) ÷ (hours + 2)^1.5` (owner, 11 Nov; was "most liked").
- **`Show more replies`** loads the next **10** (`REPLIES_PAGE_SIZE`) in place, in the same Hot order, without
  leaving the feed, then shows again while there are more. It disappears when there are none left. The
  API's default page is 20, so the client sends `?limit=REPLIES_PAGE_SIZE`. A top reply isn't shown
  twice, so a page that includes one adds one fewer.
  - **Not for fewer than 3 replies** (`REPLIES_FOLD_MIN`): a post with 1 or 2 replies shows them all in
    its preview and never shows the button. Without `top_replies` (an API from before
    migration `feed_top_replies`, see below) such a post loads its replies by itself and shows them as its preview.
  - **Never for one or two left over:** if a page would leave only 1 or 2 replies unloaded, the same press
    loads them too (at most 3 pages a press).
- **`Hide replies`** (chevron up, `communityMuted`, purple on hover) appears beside `Show more replies` once
  that has been pressed, and stays alone at the end of the thread when everything is loaded. It folds the
  thread back to the preview (plus anything you just replied); the loaded replies are kept, so
  `Show more replies` unfolds them again at once, without loading. If folding leaves the end of the thread
  above the screen, the feed scrolls back to it, as little as needed.
- **The thread:** one unbroken 1.5 px line in the zone's colour (`communityRailCampus` on the left,
  `communityRailWorld` on the right; `communityRail` where there is no zone) runs down the post's avatar column, from 3 px
  under the avatar, centred on it. Each reply's piece **peels off it as a quarter circle of radius 14**
  (`--rail-r`), starting on the line 14 px above the middle of the reply's avatar, and runs on straight to
  stop **4 px short** of the avatar, at its middle. The line itself carries straight on to the next reply.
  The last one ends in its curve, and doesn't continue. The colour is opaque, so joins never show as a
  darker patch. (Owner's reference, 6 Nov: a broad curve like a quarter of a circle, not a tight corner.)
  **On the website the curve is drawn by the same border painter as the line** (a box with a left and a
  bottom border and a rounded corner, on the same element and at the same offset), so the two land on the
  same screen pixels. As an SVG stroke it was anti-aliased at the exact position while the line snapped,
  and the curve started a fraction of a pixel left of the line (owner, 8 Nov).
- **Pointing at the line** (with a mouse) turns all of that post's line **the colour of the card's left
  edge** (`purpleDark` on campus, `pinkDark` elsewhere; `communityRailHover` where there is no zone) **and
  thickens it a little, from 1.5 to 2 px** (owner, 8 Nov; was a darker hover colour at 2.5 px), over
  140 ms. Each piece takes the pointer **3 px either side** of the line (7.5 px in all), following the
  curve; the empty corner inside a curve doesn't.
- **Each reply:** about 42.8 px from the top of one to the top of the next when it has one line: 4 above,
  a 20 px author line, a 19 px text line, 2 below, less the 2.2 px the author line's letters have risen
  (`--name-rise`, below): the text moves up with them, so the gap from the username to the text is
  what it was before the lift (owner, 10 Nov).
- **The first reply sits as far below the post as the replies sit from each other** (owner, 10 Nov): its
  row gets **6 px more on top** (`--thread-lead`), 10 instead of 4. Between two replies the eye also counts
  the text's own line spacing, about 16 px from one reply's text to the next username; under the post
  there's a hard pill edge instead, which left about 10. The line runs on unbroken through the extra room. It starts at the post's text edge: a 22 px avatar in its
  own column, then 8 px, and every line of text starts directly under the username. **The avatar's middle is level
  with the middle of the username's lowercase letters,** which is what the eye centres on (owner, 10 Nov:
  centred on the 20 px line box, those letters sat about 1.2 px below it on a Mac). It's done by the font's
  own measurements, not nudged by eye: the username is trimmed to its lowercase letters (CSS `text-box:
  trim-both ex alphabetic`, x-height to baseline) and padded back out to 20 px, so their middle sits at a
  fixed height whatever the screen, and the avatar is centred on the line. **The letters' middle is 1 px
  above the line's middle** (`--name-lift`, owner, 10 Nov; tried at 0.3 and 1.5). **Everything else on that line follows the same
  rule:** the campus and time beside the username on a wide feed, and the like count, each trimmed the same
  way, so their lowercase letters' middles all sit at that same height and their baselines line up. (On its
  own line in a narrow feed the campus keeps its plain 14 px line, and that line and the space under it
  move up with the username, so the gaps above and below the campus stay as set.) A browser without `text-box` keeps the
  plain line boxes, with the avatar 1 px lower to match and the text lifted 0.3 px. The app does the same
  with the font's x-height.
  `@username` in Inter 600 13; `campus · time` in Inter 400 12; text in Inter 400 13/19, with an optional
  GIF up to 180 px wide.
- **Usernames, not full names.** The campus follows the rule in §3: never in the campus feed, always in
  the country and Global feeds. **In a feed 520 px wide or less** (every phone, or a narrow panel on a
  laptop) **it takes a line of its own,** like Quora's credential line (owner, 10 Nov: beside the like it
  was mostly `…`): `@username` with the like and `⋯` on the first line, then `campus · time` in Inter 400
  12 on a 14 px line starting 1 px below the username's line (and up with it by `--name-rise`), then
  3 px more before the text. **It sits closer to the username than the text sits to it:** measured on a
  phone, about 7 px from the bottom of a j or p in the username to the campus's capitals, and about 11 from
  the campus to the text's capitals (owner approved, 10 Nov). The campus line moves with the username, so
  those gaps hold at any lift. If even
  that line is short the campus truncates; the time never goes.

  ```
  ╰─(av) @arjun.mehta                         ♡ 12  ⋯
         IIITDM Kurnool · 7h
         Seconded. Worth doing before exams start.
  ```
- **Pointing at a username** turns it `purple`, with **no underline**, and resting on it opens the profile
  glimpse (§4.1). The author's pill (below) deepens to `communityAuthorHover` with `purpleDark` text.
- **The post's author is highlighted:** when they reply to their own post, their username sits on
  a `reactionMineBg` pill in purple, and that's all: **no `(AUTHOR)` tag** (owner, 10 Nov; the
  highlight says it). The pill reaches out to the left, so the username itself stays in line with the text below.
  It's **18 px tall, centred on the lifted letters** (moved up with them), so it never sits low around the
  name. **On a narrow feed its bottom edge ends about 3.5 px above the campus's capitals,** at any lift,
  so the pill never runs over the campus (owner, 10 Nov).
- **A reply can only be liked.** A heart (not the post's smiley, because it is a like, not a choice of
  emoji) at the right of its line, with the count; it stores
  `DEFAULT_REACTION`, ❤️. No quick bar and no picker. Filled in `communityLike` when it's yours. The ⋯
  menu sits next to it, shown on hover with a mouse and always on touch.
- There are **no replies to replies**: one level only.
- **Writing a reply:** the post's 💬 pill switches that panel's docked composer to reply mode, with the
  cursor in it: grey text `Reply to @username…`, up to 1,000 characters, a GIF button, and a
  `Replying to @username ✕` chip. A half-written post is kept and comes back afterwards. An empty
  reply closes when you press elsewhere. On a laptop, the right-hand composer starts its chip 16 px
  further in, past the flag badge on your avatar (§1.1), which springs out over that corner.
- **In a feed where you can only view,** the view-only line stays (§1.4), and the 💬 pill loads more
  replies instead.
- **A post's page:** website `/post/:id`, app `app/post/[id].tsx` (CC-N4c). The same post and thread
  with all replies paged, and text at 15/22.

**`top_replies` (built in Block V-C, migration `feed_top_replies`, 11 Nov).** Each PostItem carries
`top_replies`: the first `REPLY_PREVIEW_COUNT` (2) replies of the thread, which is in Hot order (migration
`reply_hot_order_hide_reported`, 11 Nov), so only replies the viewer could see in the thread itself. A reply's
own `top_replies` is always `[]`. Contract: `backend/API.md`, "The PostItem" and `GET /api/posts/:id/replies`.

---

### 4.1 The profile glimpse (website, with a mouse)

Resting the mouse on an @username **or its avatar**, in a post or a reply, for **450 ms** opens a small
card under it, after Instagram's (owner, 10 Nov: the avatar too). Moving onto the card keeps it open (it closes 180 ms after the mouse leaves both); Esc, a
press elsewhere or scrolling the username away closes it. On a touch screen there's no hover: a tap on the
username opens the profile, as before.

**It opens once, at its full size** (owner, 10 Nov). The counts and photos start loading the moment the
mouse arrives on the username or avatar, and the card waits for them, photos decoded and ready to paint, before it
appears; seen again within a minute it opens at once. Opening first and growing as the photos came in
made it flicker, and a username low on the screen got the card below and then saw it jump above. If they
take more than **700 ms** past the 450 it opens anyway, with the counts shimmering; then it picks its side
for the full card (340 px) and stays there as it grows. It opens below the username when there's room,
otherwise above.

```
 ╭──────────────────────────────╮
 │ ((av))  @priya.nair           │   52 px photo in a purple → pinkDark ring
 │         (cap) IIITDM Kurnool  │
 │ ──────────────────────────── │
 │    12        1.2K      402    │   posts · followers · following
 │   posts   followers following │
 │ [photo][photo][photo]         │   the latest photos they posted, if any
 │ (        View profile       ) │
 ╰──────────────────────────────╯
```

- 288 wide, padding 14, radius 14, white, `quickBarShadow` and a `communityHairline` edge.
- `@username` Inter 600 14, black-soft (no full name, owner, 10 Nov); campus 500 12 `purple` with a
  graduation cap.
- Counts Inter 700 15 over 400 12 `communityMuted` labels, between two hairlines; they shimmer while they load.
- **Photos like a phone's gallery:** up to 8 small square tiles, four across, 2 px apart, rounded (6) only at
  the grid's outer corners.
- **Two buttons, 32 px, side by side:** **Follow** (`purpleDark`, `purple` on hover; not on your own card) and
  **View profile** (white with a `reactionMineBorder` outline), to `/user/:id`. ⚠ Follows aren't built yet:
  until then Follow says `Coming soon` for a moment when pressed.
- **⚠ Needs an API before it works on real data:** posts, followers and following counts and the latest
  photos, for one person. Nothing sends that yet; the social module (follows) isn't built. Until then
  `sampleData.js` makes it up (`sampleProfile`). The photo, username and campus come with the post.

## 5. Reactions — on posts and messages

One reaction per person per post (or message). Picking a different emoji replaces your
reaction; picking your current one again removes it. Replies have only a like (§4).

### 5.1 The quick bar

```
 ( ❤️  👍  😂  😮  😢  🙏  ⊕ )
```

- **The six, in this order:** ❤️ 👍 😂 😮 😢 🙏. Then **⊕**, which opens the full emoji picker.
- **The React button is an icon, with no word:** a line-drawn smiley, or your current emoji, in a 30 × 24
  pill. It tints purple on hover. **Pressing it always opens the quick bar, never ❤️ by itself** (owner,
  10 Nov), whatever you press it with, on the website and in the app: a press that gave ❤️ hid the other
  five emojis.
- **Look:** a white pill with radius 999, a 1 px purple ring and a deeper two-layer shadow, so it stands
  off the white cards (owner, 13 Nov: `--quick-bar-ring` + `--quick-bar-raised-shadow`; the app's
  `shadows.quickBarRaised`). With a mouse, each emoji is 22 in a 34 × 34 button. On a touch screen, 26 in
  44 × 44; the app, 24 in 40 × 40 (owner, 13 Nov: a touch smaller). Your current reaction sits on a
  `reactionMineBg` circle.
- **Where:** its left end on the React button's, **4** above it (below it when there's no room above).
  It was 8 (owner, 13 Nov: closer).
- **How to open it:**
  - **App:** tap React = the quick bar; tapping React again closes it. Long-press React (or long-press
    the post) opens it too.
  - **Website, with a mouse:** click React = the quick bar; a second click closes it. Opened by a click,
    it **stays open when the pointer moves away**, until you choose an emoji, click React again, click
    outside or press Esc (owner, 13 Nov). Hovering React for **300 ms** still opens it as well, and that
    one closes when the pointer leaves; a click after the hover keeps it open rather than shutting it.
  - **Website, from the keyboard:** Enter, Space or ↑ on React opens it with the focus on its first
    emoji; ← → move along it and Esc closes it.
  - **Website, on a touch screen:** tap React = the quick bar; tapping React again closes it. A
    long-press for **450 ms** (`REACTION_LONG_PRESS_MS`) opens it too.
  - **Everywhere,** your current reaction sits on its `reactionMineBg` circle: choosing it again removes
    it, choosing another replaces it. `DEFAULT_REACTION` (❤️) is now only a reply's like (§4).
  - **Website and app:** your current reaction also moves to the **first place** in the bar. If it isn't
    one of the six (you chose it from ⊕), it takes the first place and the last of the six steps out, so
    you can remove it from the bar without finding it in the picker again (owner, 12 Nov; the app since
    12 Nov too).
- **Animation:** the bar grows out of the button and its emoji arrive left to right, 18 ms apart.
  Hovered emoji lift and grow. The chosen emoji pops with a ring going out behind it. With reduced motion
  turned on, none of this moves. **The app opens it without any bounce** (owner, 12 Nov: fade + scale
  0.94 → 1 on an ease-out curve, and a 1.2 swell for the chosen emoji; `mobile/DESIGN.md`, "Motion"); the
  website still uses `--community-spring` (up to 1.35 over 320 ms).

### 5.2 The full picker (⊕)

- A search box: `Search emoji`.
- **Frequently used**, remembered on that device.
- Then every category, with category tabs.
- **Libraries:** website `emoji-picker-react`, app `rn-emoji-keyboard`. Style them with your
  tokens: white surface, radius 12, purple for the selected category.

### 5.3 The summary under a post

```
( 😂 ❤️ 👍 😮 1.3K )  ( ☺ )  ( 💬 237 )
```

- The **top 4 emojis** by count (`REACTION_SUMMARY_COUNT`), spaced apart, then the total. Separate
  pills sit beside it, on the same row.
- 24 px tall, emoji 14, Inter 500 12 with tabular numbers, communityMuted, on communityPill with a
  communityHairline outline, radius 999, padding 0 / 9 / 0 / 7.
- **Once you've reacted,** the pill is tinted: `reactionMineBg`, `reactionMineBorder`, purple text.
- **Every action pill answers the pointer** (the summary, React and 💬): `communityPillHover`, a
  `reactionMineBorder` outline, a 1 px lift with `communityPillLift`, over 160 ms; one you've reacted with
  deepens to `communityPillMineHover`. Pressing still shrinks it.
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
  disappears from **your** feed straight away, and stays gone: the API leaves out everything you
  reported, in every feed, a profile's Posts tab, a thread and its preview (owner, 11 Nov). Only a direct
  link to it still opens it.
- **Already reported:** `You've already reported this post.`
- **The outcome is never shown to the reporter.**

API reason values, in the same order: `spam`, `harassment`, `hate_speech`, `sexual_content`,
`child_safety`, `violence`, `self_harm`, `impersonation`, `misinformation`, `prohibited_item`,
`other`.

---

## 8. "New posts" pill (campus feed only)

- **Look (owner, 11 Nov):** a frosted pill, centred: lucide `ArrowUp` 16, then `1 new post` /
  `N new posts` in Inter 600 13, white. Radius 999, padding 8 / 16. Background
  `communityNewPosts` (the brand purple, slightly see-through) with a 12 px backdrop blur, and the
  `quickBarShadow`. Hover: `communityNewPostsHover`, a little brighter. Keyboard focus: the usual
  2 px `purple` ring, 2 px out.
- **Where:** 8 px under the campus panel's header (on a narrow window, under the floating
  switcher), centred, and it stays there while the feed scrolls (sticky inside the panel). It
  floats over the feed and takes no space, so nothing moves: the campus feed starts exactly where
  the other panel's does, and the pill coming or going never shifts a post. It may sit over the
  top of the first post for a moment; pressing it takes it away.
- **Motion:** in, it slides down 8 px and fades in over 200 ms (`communityEase`); out, it fades
  over 200 ms. No movement with reduced motion.
- **What counts:** posts newer than the **newest post shown in the campus feed**. That moves on
  every load and reload, and when your own new post appears at the top, so the pill only ever
  counts posts you can't see yet, and never your own. (`created_at` is sent 1 ms later than the
  post's own: the API reads `since` to the millisecond, and the database keeps microseconds, so
  the newest post shown would otherwise count as new.)
- **Checking:** every **30 seconds** while the feed is on screen, using
  `GET /api/posts/feed/campus/new-count?since=…`. It stops while the tab or page is hidden.
- **Tapping it** scrolls to the top and adds the new posts smoothly at the top, without reloading
  the list: the posts already shown stay on screen the whole time (no skeletons, no blink), only
  posts not already shown are added, each fading and sliding down into place (about 200 ms,
  slightly staggered; none with reduced motion), and every page loaded below stays. If that fails,
  the list stays as it is and a toast says so. New posts are **never** inserted while someone is
  reading, only when the pill is tapped.

## 9. Empty and loading states

| Feed | Empty text |
|---|---|
| Campus | `No posts from IIITDM Kurnool yet. Be the first to say hello.` |
| Your country | `No posts from students in India yet. Start the conversation.` |
| Another country | `No posts from students in Germany yet.` |
| Global | `Nothing here yet. Start the conversation.` |
| A profile's Posts tab | `No posts yet.` |

The text sits on a small glass note, Inter 400 14/20, communityMuted, because it's on the wallpaper.

While loading, show 3 skeleton cards, the same shape and card as a post (avatar circle, two text lines, a
tinted block).

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

- Demo accounts get a username like `@demo.sunny.otter` when they log in. On the onboarding
  screen (owner, 11 Nov) the username field shows **`demo.`** fixed in front of the input, in
  purple, which can't be deleted; the student edits only the rest (prefilled `sunny.otter`,
  placeholder `good_bunny`, at most 20 characters) and the availability check and the save use
  `demo.` + it. A pasted `demo.x` becomes `x`. No suggestion chips for demo accounts.
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
| `communityGlass` | `--community-glass` | `rgba(255,255,255,0.74)` | panel header, dock, floating pills |
| `communityPill` | `--community-pill` | `#F8ECF5` | every action pill under a post: pinkish, all alike (was `rgba(255,255,255,0.72)`, owner 7 Nov) |
| `communityHairline` | `--community-hairline` | `rgba(128,0,128,0.1)` | lines between posts, outlines |
| `communityRail` | `--community-rail` | `#D1AAD7` | the reply thread (opaque, so its pieces join cleanly) |
| `communityRailHover` | `--community-rail-hover` | `#9552A3` | the thread while you point at it (was `#B07FBA`, too faint) |
| `communityRailCampus` | `--community-rail-campus` | `#A86BBB` | the thread in the campus panel |
| `communityRailWorld` | `--community-rail-world` | `#D27AA3` | the thread in the country / Global panel |
| `communityPanelCampus` | `--community-panel-campus` | `#F0E5F7` | the campus panel's ground, a purple tint |
| `communityPanelCampusVeil` | `--community-panel-campus-veil` | `rgba(240,229,247,0.85)` | over the doodle tile, leaving it at 15% |
| `communityPanelWorld` | `--community-panel-world` | `#FCE9F1` | the country / Global panel's ground, a pink tint |
| `communityPanelWorldVeil` | `--community-panel-world-veil` | `rgba(252,233,241,0.85)` | the same, on that side |
| `communityHeaderCampus` | `--community-header-campus` | `linear-gradient(90deg, rgba(232,212,244,0.95), rgba(255,255,255,0.88))` | the campus header |
| `communityHeaderWorld` | `--community-header-world` | `linear-gradient(90deg, rgba(255,255,255,0.88), rgba(252,220,234,0.95))` | the country / Global header |
| `communityPillHover` | `--community-pill-hover` | `#EFD8EA` | an action pill under the pointer |
| `communityPillMineHover` | `--community-pill-mine-hover` | `rgba(128,0,128,0.17)` | one you've reacted with, under the pointer |
| `communityPillLift` | `--community-pill-lift` | `0 2px 6px rgba(79,1,79,0.14)` | the shadow of that 1 px lift |
| `communityBadgeWorldBg` | `--community-badge-world-bg` | `#FCE4EE` | the `ALL CAMPUSES` badge |
| `communityBadgeWorldText` | `--community-badge-world-text` | `#C82863` | its text |
| `communityBadgeWorldBorder` | `--community-badge-world-border` | `rgba(235,72,127,0.22)` | its outline |
| `communityCollegeBg` | `--community-college-bg` | `#FAF0F9` | a post's college pill |
| `communityCollegeText` | `--community-college-text` | `#6E2270` | its text |
| `communityCard` | `--community-card` | `rgba(255,255,255,0.94)` | the frosted post card |
| `communityCardBorder` | `--community-card-border` | `rgba(128,0,128,0.11)` | its outline |
| `communityCardBorderHover` | `--community-card-border-hover` | `rgba(128,0,128,0.2)` | its outline under the pointer |
| `communityCardShadow` | `--community-card-shadow` | `0 2px 10px rgba(79,1,79,0.04)` | its shadow |
| `communityPillBorder` | `--community-pill-border` | `rgba(128,0,128,0.22)` | the brand pill's outline (website only) |
| `communityPillShadow` | `--community-pill-shadow` | `0 4px 14px rgba(79,1,79,0.12)` | its shadow |
| `communityPillRing` | `--community-pill-ring` | `#F7EBF5` | the 4 px ring around it |
| `communityPillDivider` | `--community-pill-divider` | `rgba(128,0,128,0.16)` | the line between logo and ☰ |
| `communityMenuGlass` | `--community-menu-glass` | `rgba(255,255,255,0.88)` | its menu |
| `communityMenuShadow` | `--community-menu-shadow` | `0 12px 32px rgba(79,1,79,0.18)` | the menu's shadow |
| `communityGripGlowBorder` | `--community-grip-glow-border` | `rgba(128,0,128,0.28)` | the glow-bar grip's outline (website only) |
| `communityGripGlowShadow` | `--community-grip-glow-shadow` | `0 3px 12px rgba(79,1,79,0.12)` | its shadow |
| `communityGripGlowShadowHover` | `--community-grip-glow-shadow-hover` | `0 4px 16px rgba(128,0,128,0.24)` | its shadow in use |
| `communityGripGlow` | `--community-grip-glow` | `rgba(215,0,215,0.55)` | the glow around its bar |
| `communityAuthorHover` | `--community-author-hover` | `rgba(128,0,128,0.18)` | the author's username pill under the pointer |
| `communityScrollbar` | `--community-scrollbar` | `rgba(128,0,128,0.3)` | the panels' scrollbar while they scroll (website only) |
| `communityGlobeLand` | `--community-globe-land` | `#2E9E5E` | the continents on the Global globe (was `#3FB873`, too light under the grid) |
| `communityGlobeShade` | `--community-globe-shade` | `rgba(5,40,90,0.38)` | the globe's shadow towards the lower right |
| `communityGripBorder` | `--community-grip-border` | `#8E8B99` | outline of the divider's grip (3.3:1 on white) |
| `communityDock` | `--community-dock` | `#F9EEF8` | the composer bar, and the divider where it crosses it |
| `communityWorldStrong` | `--community-world-strong` | `#C92C66` | Post and tools on the country / Global side (white on it is 5.2:1; `pinkDark` is too low for text) |
| `communityWorldTint` | `--community-world-tint` | `rgba(235,72,127,0.16)` | soft ring around that side's composer and the avatar |
| `communityMuted` | `--community-muted` | `#5C5969` | secondary text on the wallpaper (5.58:1 on `chatCanvas`; `mutedText` is 4.44:1, too low) |
| `communityLike` | `--community-like` | `#D81E5B` | a liked reply, the ring when a reaction pops |
| `communityFloatShadow` | `--community-float-shadow` | `0 4px 16px rgba(42,8,42,0.12)` | anything floating over the feed |
| `communityNewPosts` | `--community-new-posts` | `rgba(128,0,128,0.86)` | the "new posts" pill (§8): the brand purple, frosted |
| `communityNewPostsHover` | `--community-new-posts-hover` | `rgba(150,16,150,0.92)` | that pill on hover, a little brighter |
| `communityEase` | `--community-ease` | `cubic-bezier(0.2,0.8,0.2,1)` | movement and fades |
| `communitySpring` | `--community-spring` | `cubic-bezier(0.34,1.56,0.64,1)` | small things that pop (the app uses a real spring) |

Everything else uses existing tokens: purple, purpleDark, errorText, pinkLight, blackSoft, toastBg,
scrim, and blueLight and blueDark for the globe's ocean.

## 13. Constants (same names and values on both platforms)

```
POST_MAX_CHARS            = 1000
POST_FOLD_LINES           = 6
POST_MAX_PHOTOS           = 3
POST_PHOTO_MAX_BYTES      = 5 * 1024 * 1024
FEED_PAGE_SIZE            = 20
REPLIES_PAGE_SIZE         = 10
NEW_POSTS_POLL_MS         = 30000
QUICK_REACTIONS           = ['❤️', '👍', '😂', '😮', '😢', '🙏']
DEFAULT_REACTION          = '❤️'
REACTION_SUMMARY_COUNT    = 4
REACTION_HOVER_DELAY_MS   = 300
REACTION_LONG_PRESS_MS    = 450
REPLY_PREVIEW_COUNT       = 2
REPLIES_FOLD_MIN          = 3
GIF_SEARCH_DEBOUNCE_MS    = 300
LAYOUT_MIN_PANEL_PX       = 320
LAYOUT_COLLAPSED_PX       = 36
LAYOUT_BREAKPOINT_PX      = 1024
REPORT_DETAILS_MAX        = 500
```

The website keeps them in `src/utils/community.js`, the app in `src/lib/community.ts`.
