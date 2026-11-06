# Community — design spec (Phase 7)

**Version 3.1 · 6 November 2026 · for the website and the app**

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
> **⚠ Needs an API change before it works on real data:** `top_replies` on a PostItem (§4), decided
> for Block V-C. Until then a post shows only `Show more replies`.
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

- **Background of both panels:** the chat's wallpaper, pinned while posts scroll: `chatCanvas`
  with the shared doodle tile at 50% strength (`MESSAGES_SPEC.md` §2). The rows carry a light tint:
  warm on the campus side (`communityRowCampus`), a little lighter on the other (`communityRowWorld`).
  The frame around the panels is `bg` (`#f2e5e1`).
- **Text on the wallpaper: a halo,** the way maps keep labels readable over busy ground. The author line,
  the text of each post and reply, and `Show more replies` carry `communityTextHalo`: five stacked
  shadows of `communityHalo`, 1 to 6 px, with no offset, so the letters clear the doodles from just
  around themselves and the wallpaper stays sharp everywhere else. The app has one text shadow:
  `communityHalo`, radius 4, no offset (the nearest match).
- **Hierarchy:** My campus is the main panel. Its title is Bree Serif 15 in purple-dark. The right
  title is Inter 600 14.
- **Panel header:** **36 px**, glass (`communityGlass`, blur 14), radius 8 on the panel. It floats
  over the feed, so posts pass underneath it.
- **Left panel, "My campus":** the campus feed. Its header shows an animated graduation-cap icon and
  your campus name. It shows **only campus posts**: a post appears only in the feed it was posted to,
  never in another.
- **Right panel:** the title is the dropdown (§1.3) that picks a country or Global. Next to it is a
  **Hot · New** switch made of two icons (flame, clock), with a thumb that slides between them. Hot is
  the default (ranking: runbook §1.3).
- **Icons, not emoji:** the campus icon is drawn in when it first appears, and hovering the header gives
  the cap a small hop. Flags stay emoji, because they are worked out from the code.
- **The Global globe** sits among flag emoji (the dropdown, the panel title, the badge on your avatar),
  so it is drawn in colour to match them, not as a line icon: an ocean from `blueLight` at the upper left
  into `blueDark` at the edge, `communityGlobeLand` continents (the Americas, Europe and Africa, Asia and
  Australia at the rim), a `communityGlobeShade` shadow towards the lower right, a white shine at 42%, and
  a thin `blueDark` rim at 55%. It pops in (scale 0.7 → 1, 360 ms, `communitySpring`) and, when its header
  or button is hovered, turns once: the land slides one face to the left over 900 ms.
- **The panels' scrollbar shows only while they scroll.** It's see-through at rest and keeps its room, so
  nothing moves when it appears: `communityScrollbar`, thin, then it fades 900 ms after the last scroll.
  (Website only; the app uses the phone's own indicator.)
- **The divider** (react-resizable-panels), **4 px** wide (the library still gives a mouse 10 px to grab,
  a finger 20):
  - white at rest, down to the composer bar, where it takes `communityDock` so the two bars read as one.
    The panels' corners there are square;
  - **the grip,** in the middle of its height: a white pill, 10 × 30, with a 1 px `communityGripBorder`
    outline, a `communityGripShadow`, and two grooves, 1.5 × 12, 2 px apart, in `communityGripBorder`;
  - while hovered, dragged or focused, a purple line runs its length, down to the composer bar; the grip's
    outline and grooves turn purple, a 3 px `reactionMineBg` ring comes up, the grip grows to 1.06 and the
    grooves stretch to 1.25;
  - drag it to resize; each panel is at least **320 px** wide;
  - double-click it to go back to 50 / 50;
  - keyboard: focus it with Tab, move it with the arrow keys.
- **One side is always selected:** the side you're writing on. The page opens with the **campus side**
  selected and, with a mouse, the cursor already in its composer (not on a touch screen, where it would raise
  the keyboard). Using either composer selects its side, and it **stays selected when you click away**: its
  composer keeps its highlight (§2.1) and your avatar keeps that half filled in. A collapsed panel, or a
  view-only country (§1.4), can't be selected; the other side is shown instead until it can.
- **Your avatar on the divider:** 56 px across, 4.5 px from the bottom, so it sits across the top edge of the
  composer bar with the two composers tucked in under it. Nothing runs below it. It is a child of the
  divider, so it moves with it as you resize, and it grows slightly on hover and while dragging. **Pressing it
  switches sides** (and puts the cursor in that composer), so the pointer is a hand; its tooltip says
  `Post in India` (or `Post in My campus`). A press that moves drags the divider instead, with the resize
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
│ ( (cap) [🇮🇳 India ⌄] )    ([🔥|🕐])│   ← two floating glass pills; posts pass underneath
│ post                             │
│ ──────────────────────────────── │
│ post                             │
│ ( (me) What's happening…?      ) │   ← floating composer
└──────────────────────────────────┘
```

- **The switcher floats.** The bar is transparent, sticky at the top, and only its pills take presses.
  Posts scroll underneath, which keeps the screen feeling open. It takes 50 px.
- **The pill:** a campus icon, then the selected country or Global.
- **The chevron shows only on the country / Global side,** inside the same purple as the country's
  name. It slides open as you switch, and on the campus side it takes up no room. It stays its own
  button: tapping the name selects the feed, and only the chevron opens the dropdown (§1.3).
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

Inter 400 13/18, communityMuted, with the icon in purple. No box on a laptop; on a narrow window it
floats on glass like the composer.

---

## 2. The composer

### 2.1 Closed

The composer is **always at the bottom of the feed**, separately for each panel: a 38.5 px dock in
`communityDock` with a 1.5 px `communityRail` top line, holding a white one-line field 33 px tall, 2.5 px
under the line and 1.5 px above the bottom, with a 1.5 px `communityRail` outline and Inter 400 14/20 text.
**At the end of the line:** the photo icon, faded to 65%, and the `Post` pill.

On a laptop each field ends 13 px from the divider's centre, tucked in under the shared avatar (§1.1). Its
corners are radius 20 on the outer side and 18 on the side by the avatar, and its padding keeps the text and
tools clear of the avatar. On a narrow window the composer floats over the posts, radius 20, with your avatar
(24) inside the field. Grey text depends on the feed:

| Feed | Grey text |
|---|---|
| Campus | `What's happening on campus?` |
| Your country | `Share with students in India` |
| Global | `Share with students everywhere` |

**Clicking it highlights it, and it stays one line.** The outline turns to the feed's accent with a 3 px soft
tint around it: `purpleDark` on the campus feed, `pinkDark` on a country or Global feed. Both layouts do this.
The tools come to full strength, and GIF and emoji slide in beside the photo icon over 220 ms. Pressing
elsewhere, Tab or Esc puts GIF and emoji away again. **On a narrow window** that also ends the highlight.
**On a laptop** the highlight stays on the selected side's composer (§1.1) whether or not it's in use, so
one of the two composers is always lit; the campus one when the page opens. In the app, tapping opens a
full-screen compose page (`app/compose.tsx`, opened as a modal).

### 2.2 In use

```
┌─────────────────────────────────────────────────────────┐
│ [photo][photo][photo]   or   [GIF preview]              │  ← each with an ✕
│ text…  (grows with the text)   🖼 GIF ☺ (cap) 87 ( Post ) │  ← tools stay at the end of the last line
└─────────────────────────────────────────────────────────┘
```

- **No "Posting as" line.** Your avatar and the feed you're in already say who and where.
- **Very narrow space:** if the line can't give the text at least 140 px, the tools drop to a row of their own.
  On a 390 px phone that happens when the composer comes into use.
- **Text:** up to **1,000 characters**, counted the way runbook §1.12 explains (one emoji
  is one character).
  - The counter appears only when 100 or fewer are left. It turns errorText at 0, and Post
    is disabled above 1,000.
- **Where the post goes** is shown only as an icon: a graduation cap for campus, a globe for Global, or the
  country's flag. On a laptop it's the badge on your avatar (§1.1); on a narrow window it's a small chip with
  the tools. It always matches the feed you're in, and can't be changed inside the composer.
- **Post** is a 26 px pill with the word `Post` (`Reply` for a reply), Inter 600 13 in white, on `purpleDark` on
  the campus feed and `communityWorldStrong` on the others.
- **Pasting rich text** (a Google Doc, ChatGPT, a web page) brings its bold, italic, lists … in as
  WhatsApp's symbols, on the website (`TEXT_FORMAT_SPEC.md` §4).
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

No card. A post is a flat row split from the next by a 1 px `communityPostRule`, padding 11 / 12 / 9,
with a soft tint on hover. Compact, like a code editor's panels.

```
(av) Rahul Verma @rahul.verma · IIITDM Kurnool · 2h                 ⋯
 │   Text of the post, Inter 400 14/20, black-soft. Every line starts
 │   under the name, and so does everything below it.
 │   ┌─────────────────── photos (1–3) or GIF ───────────────────┐
 │   └───────────────────────────────────────────────────────────┘
 │   ( ❤️ 😂 😮 👍 1.2K ) ( ☺ ) ( 💬 14 )     ← pills (§5.3)
 ╰─(av) replies (§4)
```

- **The avatar has a column of its own:** 28 px, then 8 px. The author line, text, photos, GIF, actions
  and replies all start at the same left edge, so on the busy wallpaper you can always see what belongs
  to which post. On a 390 px phone the text gets 330 px. (Version 3 first floated the avatar as a drop
  cap; it made the rows hard to scan.)
- **Author line: always exactly one line.** Full name in Inter 600 14; then `@username · campus · time`
  in Inter 400 13, communityMuted. When space runs out they truncate in this order: the campus first,
  then the username, then the name. The time never goes. Tapping the avatar or the name opens the
  profile. Tapping the time opens the post's page.
- **Campus name:**
  - **never in the campus feed,** where it's obvious;
  - elsewhere, only if there is room: it's hidden when the feed is 420 px wide or less;
  - the username also goes at 300 px or less (a very narrow panel only).
- **Time:** `now`, `5m`, `2h`, `3d`; then `12 Oct`, or `12 Oct 2025` for an earlier year.
  Reuse the message time formatter.
- **Text:** drawn with WhatsApp's formatting (`*bold*`, `_italic_`, `~strike~`, code, `- ` bullets,
  `1. ` numbers, `> ` quotes), exactly as in a chat bubble; the rules and the look are in
  `TEXT_FORMAT_SPEC.md`. Links are tappable, in `purple`; there are no link previews. A long post
  folds after **6 lines** behind `See more`, which expands it in place.
- **Photos** (radius 8, 2 px gaps, at most 560 px wide; tapping one opens the existing image viewer):
  - **1 photo:** full width, its own shape, but between 4:5 and 16:9 and never taller than
    420 px;
  - **2 photos:** two squares side by side;
  - **3 photos:** one large photo on the left, two stacked on the right, 16:10 overall.
- **GIF:** at most 280 px wide, on a see-through `reactionPillBorder` tint (the doodles show through a GIF's
  transparent parts; the owner preferred that to a solid backing, 6 Nov). Plays muted and on a loop while on
  screen, and pauses when it scrolls away. It carries a small `GIF` badge in the corner.
- **Links in a post say their own hover colour** (website): the name turns `purple` with a 1.5 px underline,
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

- **Top replies show by default:** the **2** most-liked (`REPLY_PREVIEW_COUNT`), oldest first when
  tied.
- **`Show more replies`** loads the next **10** (`REPLIES_PAGE_SIZE`) in place, oldest first, without
  leaving the feed, then shows again while there are more. It disappears when there are none left. The
  API's default page is 20, so the client sends `?limit=REPLIES_PAGE_SIZE`. A top reply isn't shown
  twice, so a page that includes one adds one fewer.
  - **Not for fewer than 3 replies** (`REPLIES_FOLD_MIN`): a post with 1 or 2 replies shows them all in
    its preview and never shows the button. (Until the API sends `top_replies`, see below, the button shows
    for any post with replies, because nothing else could show them.)
  - **Never for one or two left over:** if a page would leave only 1 or 2 replies unloaded, the same press
    loads them too (at most 3 pages a press).
- **`Hide replies`** (chevron up, `communityMuted`, purple on hover) appears beside `Show more replies` once
  that has been pressed, and stays alone at the end of the thread when everything is loaded. It folds the
  thread back to the preview (plus anything you just replied); the loaded replies are kept, so
  `Show more replies` unfolds them again at once, without loading. If folding leaves the end of the thread
  above the screen, the feed scrolls back to it, as little as needed.
- **The thread:** one unbroken 1.5 px `communityRail` line runs down the post's avatar column, from 3 px
  under the avatar, centred on it. Each reply's piece **peels off it as a quarter circle of radius 14**
  (`--rail-r`), starting on the line 14 px above the middle of the reply's avatar, and runs on straight to
  stop **4 px short** of the avatar, at its middle. The line itself carries straight on to the next reply.
  The last one ends in its curve, and doesn't continue. The colour is opaque, so joins never show as a
  darker patch. (Owner's reference, 6 Nov: a broad curve like a quarter of a circle, not a tight corner.)
- **Pointing at the line** (with a mouse) darkens all of that post's line to `communityRailHover` over
  140 ms. Each piece takes the pointer **3 px either side** of the line (7.5 px in all), following the
  curve; the empty corner inside a curve doesn't.
- **Each reply:** 45 px from the top of one to the top of the next when it has one line: 4 above, a
  20 px author line, a 19 px text line, 2 below. It starts at the post's text edge: a 22 px avatar in its
  own column, then 8 px, and every line of text starts directly under the username.
  `@username` in Inter 600 13; `campus · time` in Inter 400 12; text in Inter 400 13/19, with an optional
  GIF up to 180 px wide.
- **Usernames, not full names.** The campus shows only under the rule in §3.
- **Pointing at a username** turns it `purple`, and a 1.5 px underline rises into place under it (it waits
  see-through 5 px down and moves up to 2 px, over 220 ms). The author's pill (below) deepens to
  `communityAuthorHover` with `purpleDark` text.
- **The post's author is highlighted:** when they reply to their own post, their username sits on
  a `reactionMineBg` pill in purple. The pill reaches out to the left, so the name itself stays in line
  with the text below.
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

**⚠ API change needed (decided for Block V-C, not built).** `top_replies` is new. Each PostItem needs
`top_replies`: up to `REPLY_PREVIEW_COUNT` reply PostItems, most liked first. That means a change to the feed
SQL functions (Vishwajeet), `backend/API.md`, and the posts controller. Until it exists, a post with replies
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
- **The React button is an icon, with no word:** a line-drawn smiley, or your current emoji, in a 30 × 24
  pill. It tints purple on hover. Tapping it still gives ❤️.
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
( 😂 ❤️ 👍 😮 1.3K )  ( ☺ )  ( 💬 237 )
```

- The **top 4 emojis** by count (`REACTION_SUMMARY_COUNT`), spaced apart, then the total. Separate
  pills sit beside it, on the same row.
- 24 px tall, emoji 14, Inter 500 12 with tabular numbers, communityMuted, on communityPill with a
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

The text sits on a small glass note, Inter 400 14/20, communityMuted, because it's on the wallpaper.

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
| `communityRowWorld` | `--community-row-world` | `rgba(255,255,255,0.42)` | tint behind country and Global posts |
| `communityRowHover` | `--community-row-hover` | `rgba(128,0,128,0.035)` | a hovered post |
| `communityGlass` | `--community-glass` | `rgba(255,255,255,0.74)` | panel header, dock, floating pills |
| `communityPill` | `--community-pill` | `rgba(255,255,255,0.72)` | action pills |
| `communityHairline` | `--community-hairline` | `rgba(128,0,128,0.1)` | lines between posts, outlines |
| `communityPostRule` | `--community-post-rule` | `rgba(128,0,128,0.22)` | the line between posts, strong enough to see over the doodles |
| `communityRail` | `--community-rail` | `#D1AAD7` | the reply thread (opaque, so its pieces join cleanly) |
| `communityRailHover` | `--community-rail-hover` | `#9552A3` | the thread while you point at it (was `#B07FBA`, too faint) |
| `communityAuthorHover` | `--community-author-hover` | `rgba(128,0,128,0.18)` | the author's username pill under the pointer |
| `communityScrollbar` | `--community-scrollbar` | `rgba(128,0,128,0.3)` | the panels' scrollbar while they scroll (website only) |
| `communityGlobeLand` | `--community-globe-land` | `#3FB873` | the continents on the Global globe |
| `communityGlobeShade` | `--community-globe-shade` | `rgba(5,40,90,0.38)` | the globe's shadow towards the lower right |
| `communityGripShadow` | `--community-grip-shadow` | `0 1px 2px rgba(42,8,42,0.14)` | the divider's grip (website only) |
| `communityHalo` | `--community-halo` | `#F8F3F9` | the halo around text on the wallpaper |
| `communityTextHalo` | `--community-text-halo` | five `communityHalo` shadows, 1, 2, 3, 4 and 6 px, no offset | that halo (app: one shadow, radius 4) |
| `communityGripBorder` | `--community-grip-border` | `#8E8B99` | outline of the divider's grip (3.3:1 on white) |
| `communityDock` | `--community-dock` | `#F9EEF8` | the composer bar, and the divider where it crosses it |
| `communityWorldStrong` | `--community-world-strong` | `#C92C66` | Post and tools on the country / Global side (white on it is 5.2:1; `pinkDark` is too low for text) |
| `communityWorldTint` | `--community-world-tint` | `rgba(235,72,127,0.16)` | soft ring around that side's composer and the avatar |
| `communityMuted` | `--community-muted` | `#5C5969` | secondary text on the wallpaper (5.58:1 on `chatCanvas`; `mutedText` is 4.44:1, too low) |
| `communityLike` | `--community-like` | `#D81E5B` | a liked reply, the ring when a reaction pops |
| `communityFloatShadow` | `--community-float-shadow` | `0 4px 16px rgba(42,8,42,0.12)` | anything floating over the feed |
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
