# Messages Design Spec — v2

**Phase 6A · v2 · 11 October 2026 · the single source of truth for the inbox and the
conversation screens on BOTH platforms.**

v2 records what the mobile app actually ships at the end of Phase 6A. Every value below was
read out of `mobile/src/theme/index.ts`, `mobile/src/lib/{emoji,stickers,messages}.ts`,
`mobile/app/(tabs)/messages.tsx` and `mobile/app/chat/[contactId].tsx`. Where a value is
not given by the code or the changelog, this file says **not specified** rather than
inventing one.

> **`messages-mockup.html` and the PNGs were drawn for v1 (amber ticks, no stickers,
> full-strength wallpaper). Where they differ from this file, this file wins.**

Save as `docs/design/MESSAGES_SPEC.md`.

---

## 0. The one rule

**This file is the design. Neither platform designs anything.**

The chat wallpaper block established the principle: a pattern described in words to two
Claude Code sessions produces two different patterns. The same is true of "make the
messages screen beautiful". So every value below is exact, and both prompts say
*implement this spec, invent nothing*.

If a value needs to change: change it **here first**, then change both platforms in the
same phase. Never change one platform's code and leave this file behind.

The visual reference is `docs/design/messages-mockup.html` (open it in Chrome) and the two
images rendered from it. Where the mockup and this file disagree, **this file wins**.

**Contrast is measured, not eyeballed** — the same discipline `mobile/src/theme/index.ts`
already follows. Every pair is in §7.

---

## 0.1 What changed from v1

| Section | v1 | v2 | Why |
|---|---|---|---|
| Header | v1 · 27 September 2026 | v2 · 11 October 2026 | Phase 6A wrap-up: the spec now matches what mobile ships |
| Top of file | — | Note: the mockup and PNGs are v1 drawings; this file wins | They show amber ticks, no stickers, full-strength wallpaper |
| §1 Header | No paddings | Padding 8 top / 16 sides / 12 bottom; subtitle 2 below the title | Taken from the mockup in V-C, shipped on mobile |
| §1 Filter field | No inner padding or gap; no clear button | Inner padding 14 sides, gap 8; input text Inter 400 13 `#1A1A1A`; clear (×) button while text is present | Mockup values + current mobile |
| §1 Row | Alignment and line gaps not given | Row content vertically centred; name and time share a baseline (gap 8); preview line 3 below the name (gap 8 to the badge) | Mockup values, shipped on mobile |
| §1 Row | Online dot not mentioned | 13 dot `#4ADE80`, 2 border `#FCF8FC`, bottom-right of the avatar | Kept from mobile; now written down |
| §1 Row | `You: ` prefix on your own last message | **Deferred, §8** | The inbox response has no `last_sender_id`; neither platform can show it |
| §1 Row | Fallback texts not given | `Yahora student`, ` (You)`, `Start the conversation ✨`, `Item` | Kept from mobile |
| §1 Time format | "under 1 hour → `2m`" | Adds: under one minute shows **`0m`** | What mobile ships (the table read literally) |
| §1 Loading | "skeleton rows (avatar + two bars)" | Exact: 6 rows, 48 circle, bars 55% × 14 and 80% × 12 | Mobile's values |
| §2 Ground and wallpaper | Tile at full strength | Tile layer drawn at **opacity 0.5** (`CHAT_WALLPAPER_OPACITY`); strokes read as about 18–20% purple | At full strength the doodles ran through message and welcome text on the phone |
| §2 Header | No paddings; online dot not mentioned | Padding 8 / 12, gap 10; chevron 24; 11 online dot | Mockup values + kept mobile values |
| §2 Product snippet | Price in Bree Serif, purple | Price **deferred, §8**. Strip padding 6 / 12 / 8 with its own bottom border; chevron 13 purple; image fallback | No price field reaches either client |
| §2 Thread | No padding | 10 top/bottom, 12 sides | Mockup |
| §2 Bubbles | Avatar beside received bubbles not mentioned | 26 avatar beside the **last** received bubble of a run, gap 6; a 26 spacer beside the others | Kept from mobile |
| §2 Bubbles | Link colour not given | Sent: `#6FE1FF`, received: `#0B93D8`, both underlined | Kept from mobile |
| §2 Meta row | Did not say which bubbles | On **every** bubble | Kept from mobile (the mockup showed it on the last of a run only) |
| §2 Ticks | Read = amber `#FDE68A` | Read = **WhatsApp blue `#53BDEB`** | Amber could hardly be told from the white delivered ticks on the phone; the owner chose blue |
| §2 Failed message | Icon only | Bubble at opacity 0.72 + "Failed — tap to retry" pill | Kept from mobile |
| §2 Emoji in messages | — | **New**: inline 18; 1 / 2 / 3 emoji-only at 34 / 30 / 26 | Added in V-C after comparing with WhatsApp; tuned on a phone |
| §2 Jump to latest | — | **New** | Added in V-C |
| §2 Welcome stickers | — (👋 in the empty chat) | **New**: four stickers, one per conversation | Added in V-C; replaced the single "Bagsy"/"Mishti" drafts |
| §2 Empty chat and beginning note | — | **New**: white 0.9 card, radius 20; white 0.9 pill, radius 12 | The wallpaper ran through bare text |
| §2 Unread behaviour | §6: "V-E changes how the mobile thread opens" | **New section**: band pinned once, opens at 35%, read on sight, `upToId` | V-E shipped on both platforms |
| §2 Composer | Placeholder colour, input padding, send icon and states not given | Placeholder `#BBB6C8`; input padding 10 / 14; send icon 17; disabled 0.4; pressed 0.94; bottom 12 or the home-indicator inset | Kept from mobile |
| §2 Loading | "4–6 skeleton bubble shapes" | Exactly 5, values given | Mobile's values |
| §3 Tokens | 6 tokens + switch; `chatReadTick` amber; "remove `inboxTop/Mid/Bottom`" | Every messages token with its value, incl. the 8 that only name rgba values; `CHAT_WALLPAPER_OPACITY`, `EMOJI_SIZES`, `SENT_BUBBLE_STYLE`; remove note dropped | `chatReadTick` is blue; the `inbox*` tokens are already gone |
| §5 Allowed differences | Four | Adds **#5**: the gradient direction | expo-linear-gradient runs corner-to-corner |
| §5 Allowed differences | — | Adds **#6**: the jump-to-latest button's shadow (grey elevation on Android, purple on web). Heading now "these six and no others" | A single floating control, not a list row, so #1's frame-cost reason does not apply |
| §6 Deliberately unchanged | V-E pending | V-E shipped; points to §2 Unread behaviour | — |
| §7 Contrast | Amber read tick on `#C02B7F`, 4.33 ✅ | Blue: 2.53 on `#C02B7F` (accepted by the owner, knowingly), 4.42 on `#800080`, 3.53 on `#9B1280` | Follows the tick change |
| §8 | — | **New**: deferred on both platforms (price, `You: `) | Moved out of §1/§2 as live requirements |
| §9 | — | **New**: not specified yet (typing bubble, error states, emoji button and tray) | Each platform keeps its current look |

---

## 1. Inbox — the conversation list

### Canvas

The app canvas. The inbox stops having its own paler variant.

| | Value |
|---|---|
| Stops, top → bottom | `#FFF0F7` → `#FBE9F8` → `#F1E6FF` |
| Mobile | `<ScreenGradient variant="app" />` (tokens `appBgTop/Mid/Bottom`) |
| Web | `.inboxSidebar { background: linear-gradient(170deg, #FFF0F7 0%, #FBE9F8 50%, #F1E6FF 100%) }` |
| Glows | **None.** Remove `.inboxSidebar::before/::after` on web (mobile's `inbox` variant is already gone) |

Why: the old inbox ramp (`#FDF8FF → #F8F0FF → #FFF4F9`) is 56%/31% saturation — the eye
reads it as white. The app canvas is 100% saturation at the same lightness, and its text
contrast is already measured (mutedText never below 4.51:1). Nothing new is invented.

### Header

Padding 8 top · 16 sides · 12 bottom.

| Element | Font | Colour |
|---|---|---|
| Title "Messages" | Bree Serif 400, 20 (`headline`) | `#0B0B0B` |
| Subtitle "N unread conversations" | Inter 500, 12 (`caption`), 2 below the title | mutedText `#6B6879` |

Hide the subtitle when N = 0. Singular: "1 unread conversation". N counts conversations with
unread messages across the whole inbox, not only the rows the filter is showing.

### Filter field (already exists on both — restyle only)

Height 38 · radius 19 · background `rgba(255,255,255,0.78)` · border
`1px rgba(128,0,128,0.08)` · inner padding 14 sides · gap 8 between its parts ·
placeholder "Search conversations", Inter 400 13, mutedText · typed text Inter 400 13
`#1A1A1A` · leading search icon 15, mutedText · while there is text, a trailing clear (×)
icon 15, mutedText. Margin 10 top, 16 sides, 6 bottom.

### Row

| Property | Value |
|---|---|
| Padding | 10 vertical, 16 horizontal |
| Avatar | 48 circle, gap 12 to the text column |
| Alignment | avatar and text column vertically centred |
| Background | **none** — rows sit directly on the canvas. No cards |
| Pressed (mobile) | `rgba(128,0,128,0.06)` |
| Hover (web) | `rgba(128,0,128,0.04)` |
| Selected (web, conversation open beside it) | `rgba(128,0,128,0.08)` |
| Divider | 1px `rgba(128,0,128,0.08)`, starting at the text column (left 76), ending 16 from the right. None above the first row |
| Online dot | 13 circle, `#4ADE80`, 2 border `#FCF8FC`, at the avatar's bottom-right. Demo-campus contacts always show it |

| Line | Read | Unread |
|---|---|---|
| Name — Inter 14 (`bodyLg`), 1 line, ellipsis | 600, `#0B0B0B` | **800**, `#0B0B0B` |
| Time — Inter 11 (`micro`), right-aligned | 500, mutedText | **700, purple `#800080`** |
| Preview — Inter 13 (`body`), 1 line, ellipsis | 400, mutedText | **500, `#1A1A1A`** |

Name and time share a **baseline**, gap 8. The preview line sits **3** below the name row,
with gap 8 to the badge.

The `You: ` prefix on your own last message is **deferred** — see §8.

**Fallbacks:** no name → `Yahora student`; a conversation with yourself → the name followed
by ` (You)`; no last message → `Start the conversation ✨`; no product title → `Item`.

**Unread badge:** min 20×20 · radius 10 · horizontal padding 6 · 135° gradient `#800080 →
#EB487F` · Inter 700 11 white · shows `99+` above 99 · sits at the end of the preview line.

**Product chip** (the listing the chat is about): Inter 600 11 · colour pinkDark `#EB487F` ·
background `rgba(235,72,127,0.09)` · radius 8 · padding 2 vertical, 8 horizontal · 1 line,
ellipsis · 5 below the preview. Text only — no thumbnail.

### Time format — identical on both platforms

| Age of last message | Shows |
|---|---|
| under 1 minute | `0m` |
| under 1 hour | `2m` (whole minutes, rounded down) |
| same calendar day | `4:41 PM` |
| yesterday | `Yesterday` |
| within the last 6 days | `Mon` |
| this year | `12 Sep` |
| an earlier year | `12 Sep 2025` |

A timestamp slightly in the future (clock skew) shows `0m`, never a negative number. Day
and month names come from fixed English tables, not the browser's or phone's locale.

### Loading and empty

Initial load: **skeleton rows**, per `mobile/DESIGN.md` §6 — never a spinner. Six rows laid
out like real ones (same padding, dividers from the second row): a 48 circle, then two bars,
55% wide × 14 tall (radius 7) and 80% × 12 (radius 6), 8 apart.

Empty inbox: keep the existing empty state; restyle its text to the tokens above.

---

## 2. Conversation

### Ground and wallpaper

| | Value |
|---|---|
| Ground | `#EDE6F5` — mobile `colors.chatCanvas`; web `.messagesContainer { background-color }` |
| Wallpaper | the committed tile, **420 × 420 units, repeating, unscaled** |
| Wallpaper strength | the tile layer is drawn at **opacity 0.5** (`CHAT_WALLPAPER_OPACITY`) |
| Mobile file | `mobile/assets/chat-pattern.png` (+ `@2x`, `@3x`) |
| Web file | `frontend/public/patterns/chat-pattern.svg` |
| Behaviour | **fixed** — the messages scroll over it; it never moves |
| Glows and dot grain | **Removed** on web. Mobile's `chat` ScreenGradient variant is gone |

**Opacity 0.5, applied by the platform.** The tile's strokes are purple at about 35–40%
opacity; at full strength they ran through message and welcome text on the phone. Drawn at
0.5, the strokes read as about **18–20% purple**. The master SVG and PNGs are **not**
changed — never bake the opacity into a file (§4). On web a `background-image` has no
opacity of its own, so the tile needs a layer of its own to carry it.

Why `#EDE6F5` and not the wallpaper document's `#FDF8FF`: on a near-white ground the white
received bubbles, the date chips and the unread band dissolve into the background. See
`wallpaper_ground_options.png`. The deeper ground is what lets them lift off — which the
web CSS already notes as deliberate.

**Text never sits bare on the wallpaper.** Every piece of text in the thread area has a
backing: the bubbles, the date chip, the unread band, the empty-chat card and the beginning
note (all below).

### Header

White · bottom border 1px `rgba(128,0,128,0.07)` · padding 8 vertical, 12 sides · gap 10 ·
back chevron 24, purple · avatar 36 · name Inter 600 16 (`title`) `#0B0B0B`, 1 line ·
status line Inter 500 11 mutedText, 1 line: `<University> · online`, or `<University>`
alone when offline.

Online dot on the avatar: 11 circle, `#4ADE80`, 2 border `#FFFFFF`, bottom-right. Demo-campus
contacts always show online.

### Product snippet (below the header)

Its own white strip, directly under the header: padding 6 top, 12 sides, 8 bottom · bottom
border 1px `rgba(128,0,128,0.07)`.

Inside it, the pill: `#FFF4F7` (pinkLight), radius 12, padding 6 vertical / 8 horizontal,
gap 8 · thumbnail 30×30, radius 8, `cover` · title Inter 600 12 `#0B0B0B`, 1 line, fills
the remaining width · trailing chevron-right 13, purple. Tapping it opens the listing.

- No image: the thumbnail is an `#F3F0EF` square with an image icon 13, `#BBB6C8`.
- No title: `this item`.
- Pressed (mobile): pill turns `#F0DCE2`. Hover (web): **not specified**.

The price is **deferred** — see §8.

### Thread

Padding 10 top and bottom, 12 sides. The unread band bleeds past the side padding (below).

### Date chip

Centered · Inter 700 11, uppercase, letter-spacing 0.6 · mutedText · background
`rgba(255,255,255,0.92)` · radius 99 · padding 4/11 · margin 10 above, 6 below.
**No lines either side.** Labels: `Today`, `Yesterday`, weekday within 6 days, else
`12 Sep` / `12 Sep 2025`.

### Unread band

Full-bleed band across the thread width (it cancels the thread's 12 side padding) ·
background `rgba(255,255,255,0.88)` · Inter 700 11 purple, centered · padding 5 vertical ·
margin 8 vertical · text `1 unread message` / `N unread messages`.

When and where it appears: see **Unread behaviour** below.

### Bubbles

| Property | Value |
|---|---|
| Max width | 78% of the thread width (inside its padding), never above 520 |
| Padding | 8 top · 12 sides · 6 bottom |
| Radius | 18 |
| Tail | the **last** bubble of a run gets radius 5 on the corner nearest its sender (mine: bottom-right, theirs: bottom-left) |
| Run | consecutive messages from the same sender, same day, each within 5 minutes of the previous |
| Gap inside a run | 2 |
| Gap between runs | 8 |
| Message text | Inter 400 **14 / line-height 20** |
| Avatar (theirs only) | 26, beside the **last** bubble of a run, bottom-aligned, gap 6. Earlier bubbles of the run get a 26-wide spacer, so the run stays aligned |

| | Mine | Theirs |
|---|---|---|
| Background | 135° gradient `#800080` → **`#C02B7F`** | `#FFFFFF` |
| Border | none | 1px `rgba(128,0,128,0.08)` |
| Text | `#FFFFFF` | `#1A1A1A` |
| Links in the text | `#6FE1FF`, underlined | `#0B93D8`, underlined |
| Time + ticks | `rgba(255,255,255,0.90)` | mutedText `#6B6879` |

**Why the gradient ends at `#C02B7F` and not `#EB487F`.** `#C02B7F` is 60% of the way from
purple to pinkDark — the furthest the gradient can travel while white text and the 90%
timestamps stay readable. The old web bubble ended at `#EB487F`, where white text is 3.64:1
(fails 4.5), at exactly the corner the timestamp and ticks sit in. See
`sent_bubble_contrast.png`. (The v1 amber tick was 2.92:1 there; the blue read tick would be
1.71:1.)

**Performance guard — mobile.** The gradient must be measured on the Samsung Galaxy A03s
(Block N-F). If it costs frames, **both** platforms switch to the solid fallback
`#9B1280` (the gradient's colour at 25%; white text 7.52:1). The two platforms must never
disagree on this. Mobile ships `SENT_BUBBLE_STYLE = 'gradient'` until N-F decides.

**Failed message:** the bubble drops to opacity 0.72, and a pill sits under it, right-aligned,
3 below: background `#FEF0F0`, text "Failed — tap to retry" in Inter 600 11 `#B91C1C`, a
rotate icon 11 in the same colour, gap 4, padding 3 vertical / 8 horizontal, radius 999.
Tapping it resends the same message. Pressed (mobile): opacity 0.7.

### Meta row inside the bubble

On **every** bubble, not only the last of a run. Right-aligned · Inter 500 11 · gap 4 ·
margin-top 2 · time as `4:41 PM`.

### Ticks (mine only)

| State | Icon | Colour |
|---|---|---|
| Pending | clock, 11 | white 90% |
| Sent | single check, 14 | white 90% |
| Delivered | double check, 15 | white 90% |
| **Read** | double check, 15 | **blue `#53BDEB`** |
| Failed | alert-circle, 12 | `#F87171` |

Blue — WhatsApp's read blue — on both platforms. v1's pale amber `#FDE68A` could hardly be
told apart from the white delivered ticks beside it on the phone; the owner chose blue after
trying it on the device. It fails the 3.0 icon minimum on the bubble's pink end, and that was
**accepted knowingly** (§7).

### Shadows

Web only: mine `0 1px 2px rgba(128,0,128,0.16), 0 6px 18px rgba(128,0,128,0.14)`; theirs
`0 2px 10px rgba(42,8,42,0.05)`. Mobile: none (see §5).

### Emoji in messages

Size only: the emoji artwork is the device's own emoji font.

| Message | Emoji size | Line height |
|---|---|---|
| Emoji inside text | **18** | the paragraph keeps its 20 (web: `line-height: 1` on the emoji, so the line box does not grow) |
| Only emoji: 1 | **34** | 43 |
| Only emoji: 2 | **30** | 38 |
| Only emoji: 3 | **26** | 33 |
| Only emoji: 4 or more | 18, as inline | 20 |

Jumbo line height is `round(size × 1.25)`. "Only emoji" allows spaces between them. A jumbo
message stays inside its normal bubble, with its time and ticks.

**One regex decides what counts as an emoji**, held in two files that must stay identical:
`mobile/src/lib/emoji.ts` and `frontend/src/utils/emoji.js`. A flag (two regional
indicators), a keycap, or a pictograph in emoji presentation counts, with its skin tone and
any ZWJ-joined parts — 👨‍👩‍👧 is one emoji. ©, ® and ™ in a sentence stay text. The sizes
live in `EMOJI_SIZES` (mobile theme) and the same-named export in `emoji.js`; change both
together.

### Jump-to-latest button

| | Value |
|---|---|
| Shows when | scrolled up more than **80** from the newest message (about one message); hides once back within 80 |
| Enters / leaves | scales in over **180 ms**, out over **140 ms** |
| Button | **38** circle, `#FFFFFF`, border 1px `rgba(128,0,128,0.08)` |
| Icon | chevrons-down, 20, purple `#800080` |
| Shadow | `0 2px 6px rgba(128,0,128,0.16)` (on Android: `elevation: 3` — Android cannot colour a shadow; allowed, §5 #6) |
| Pressed | scale 0.94, background pinkLight `#FFF4F7`. Hover (web): pinkLight `#FFF4F7` |
| Position | bottom-right over the thread, 12 from the right, 12 above the bottom of the thread area. It never scrolls with the messages |
| Badge | counts the contact's messages that arrived after you scrolled up. min 20×20 · radius 10 · padding 6 horizontal · 135° `#800080 → #EB487F` · Inter 700 11 white · `99+` above 99 · top −8, right −4 |
| Tap | smooth-scrolls to the newest message. Changes nothing about read state or the unread band |

### Welcome stickers

An empty conversation shows one animated "Hi" sticker, Telegram-style, chosen **per
conversation**: the same chat always shows the same sticker, both people see the same one,
and phone and web agree.

| | Value |
|---|---|
| The four, in this order | `bear`, `blob`, `birdie`, `rabbit` |
| Key | `sort([userId, contactId]).join(":") + ":" + productId` |
| Hash | 32-bit FNV-1a over the key's UTF-16 code units (offset `0x811c9dc5`, prime `0x01000193`, result unsigned) |
| Pick | `hash % 4` into the list above |
| Fallback | any of the three ids missing → `bear` |
| Size | **120 × 120**, `contain`, at the top of the empty-chat card |
| Reduced motion | a still first frame. Mobile holds the animated file on frame one; web swaps to `<id>-still.webp` through `<picture>` under `prefers-reduced-motion: reduce` |
| Accessibility | decorative — no alt text; the card's text says everything |
| Code | `mobile/src/lib/stickers.ts` and `frontend/src/utils/stickers.js` — same ids, same order, same hash |

**Masters:** `docs/design/assets/welcome-sticker/` — `lottie/<id>.json` (LottieFiles, Lottie
Simple License; credits in `lottie/SOURCES.md`), rendered by `build_stickers.py` to
`out/<id>.webp` and `out/<id>-still.webp` (360 px). Copies: `mobile/assets/stickers/<id>.webp`
and `frontend/public/stickers/<id>.webp` + `<id>-still.webp`.

**Rule: never edit a `.webp`.** Change the source, rebuild, and copy to both platforms in
one commit. Adding or removing a sticker means changing the list in both code files in the
same commit — and it reshuffles which chat shows which sticker.

### Empty chat

A conversation with no messages shows, centred in the thread (padding 32 all round):

- **The welcome card:** background `rgba(255,255,255,0.9)` (`chatNoteSurface`) · radius
  **20** · padding 24 vertical, 16 horizontal · stretches to the available width, content
  centred. Inside it, top to bottom:
  - the welcome sticker (above);
  - title `Start the conversation about <product title>.`, Inter 700 14 `#1A1A1A`,
    centred, 16 below the sticker;
  - hint `Ask if it's still available, agree a price, and meet somewhere public on
    campus.`, Inter 400 13 / 19, mutedText, centred, 4 below, max width 300.
- **Three suggestion chips**, 24 below the card, stacked and centred, gap 8:
  `Hi! Is this still available? 😊` · `What's the condition?` · `Can we meet on campus?`.
  Each: background pinkLight `#FFF4F7`, border 1px `#E5C8E5`, radius 999, padding 8
  vertical / 16 horizontal, Inter 600 12 `#4F014F`. Tapping one puts its text in the
  composer (it does not send). Pressed (mobile): `#F0DCE2`. Hover (web): **not specified**.

### Beginning-of-conversation note

`This is the beginning of your conversation about <product title>.` — above the oldest
message, shown **only once the whole history is loaded** (`next_cursor` is null), because
until then it is not true. It does not appear in an empty chat; the welcome card does
that job.

Pill: background `rgba(255,255,255,0.9)` (`chatNoteSurface`) · radius **12** · padding 6
vertical, 16 horizontal · centred · 16 margin below. Text Inter 400 12 / 17, **mutedText**,
centred.

### Unread behaviour

The same on both platforms. Constants named per platform.

- **The band is pinned once**, when the thread opens, after the history has **settled** (no
  fetch in flight). It goes above the contact's oldest unread message and stays put while
  those messages are marked read. If the inbox's `unread_count` says there are more unread
  than the loaded rows show, the contact's newest *N* messages count. With more unread than
  one page, the band sits above the oldest **loaded** unread message and counts only loaded
  ones; no extra page is fetched.
- **The chat opens at the band**, with the band about **35%** down the thread (mobile
  `UNREAD_VIEW_POSITION = 1 − 0.35` on its inverted list; web `UNREAD_ANCHOR_LEAD_RATIO =
  0.35`). With nothing unread it opens at the newest message.
- **Read on sight.** A message counts as seen once **50%** of its row is visible (mobile
  `VIEWABILITY_CONFIG.itemVisiblePercentThreshold = 50`; web `READ_VISIBLE_RATIO = 0.5`).
  Newly seen messages are batched and, after **300 ms** of stillness (`READ_DEBOUNCE_MS` on
  both), sent as **one** `PUT /api/messages/read` with `upToId` = the newest of them.
  Messages after it stay unread and keep the inbox badge.
- **Nothing is marked read on open**, on focus, before the band is pinned, or while the
  chat is not on screen (backgrounded, offline, under another screen, or the web tab not
  watched). Mobile also waits **600 ms** after scrolling to the band (`ANCHOR_SETTLE_MS`);
  scrolls to a not-yet-measured row are retried at most 4 times (`SCROLL_RETRY_MAX`).
- **Away and back:** messages that arrive while the chat is open but not live get a band of
  their own on return, after the thread is re-read from the server.
- **Scrolled up when a message arrives:** your position holds, unless you were within **80**
  of the newest message (mobile `maintainVisibleContentPosition` threshold =
  `JUMP_SHOW_AFTER`; web `BOTTOM_STICK_THRESHOLD`). The arrival counts in the inbox badge
  and the jump button's badge until you reach it.
- **Replying clears the band** and scrolls to your new message.

### Composer

White bar · top border 1px `rgba(128,0,128,0.07)` · padding 8 top, 10 sides, 12 bottom (on
mobile, the larger of 12 and the home-indicator inset) · controls bottom-aligned, gap 8 ·
order: emoji button (§9), input, send.

- **Input pill:** min-height 40, grows to 5 lines (max height 120), radius 20, background
  `#F3F0EF` (inputBg), no border, padding 10 vertical / 14 horizontal, Inter 400 14 / 20
  `#1A1A1A`, placeholder `Message` in `#BBB6C8` (mutedPlaceholder), up to 2000 characters.
- **Send button:** 40 circle, 135° gradient `#800080 → #EB487F` (icon only — white on its
  pink end is 3.64:1, above the 3.0 needed for an icon), send icon 17 white. Disabled (empty
  draft): opacity 0.4. Pressed: scale 0.94.

### Loading

Initial thread load: **5** skeleton bubble shapes, alternating sides starting with theirs,
44 tall, radius 18, widths 62% · 48% · 70% · 40% · 55%, 16 apart, starting 24 from the top,
12 side padding. Loading older messages while scrolling up: keep the Phase 5 indicator.

---

## 3. Tokens

**Mobile — `mobile/src/theme/index.ts`** — every messages token, with the value it ships:

```ts
// The conversation ground and the backings for text on the wallpaper
chatCanvas:         '#EDE6F5',
chatDateChip:       'rgba(255,255,255,0.92)',
chatUnreadBand:     'rgba(255,255,255,0.88)',
chatNoteSurface:    'rgba(255,255,255,0.9)',   // empty-chat card + beginning note

// Bubbles and ticks
bubbleMineEnd:      '#C02B7F',                 // sent-bubble gradient end (§2)
bubbleMineSolid:    '#9B1280',                 // fallback if the gradient fails N-F
chatReadTick:       '#53BDEB',                 // read state — WhatsApp blue (§2 Ticks)
bubbleTheirsBorder: 'rgba(128,0,128,0.08)',

// §1/§2 values given names only so the screens hold no colour literals
messagesLine:       'rgba(128,0,128,0.08)',    // inbox filter border + row divider; jump-button border
messagesBarBorder:  'rgba(128,0,128,0.07)',    // chat header / snippet bottom, composer top
inboxFilterBg:      'rgba(255,255,255,0.78)',
inboxRowPressed:    'rgba(128,0,128,0.06)',
inboxProductChipBg: 'rgba(235,72,127,0.09)',
bubbleMineMeta:     'rgba(255,255,255,0.90)',  // time + ticks on a sent bubble
chatFailedTick:     '#F87171',
```

Plus three constants, so each decision lives in one place:

```ts
export const CHAT_WALLPAPER_OPACITY = 0.5;      // §2 Ground and wallpaper
export const SENT_BUBBLE_STYLE: 'gradient' | 'solid' = 'gradient';   // still 'gradient'; N-F decides
export const EMOJI_SIZES = { inline: 18, jumbo: { 1: 34, 2: 30, 3: 26 } };   // §2 Emoji
```

The messages screens also use these existing app tokens: `appBgTop/Mid/Bottom`
`#FFF0F7 / #FBE9F8 / #F1E6FF` · `inputBg #F3F0EF` · `mutedText #6B6879` ·
`mutedPlaceholder #BBB6C8` · `pinkLight #FFF4F7` · `demoCardPinkBg #F0DCE2` (pressed pills) ·
`inputBorderFocus #E5C8E5` (suggestion-chip border) · `purpleDark #4F014F` · `swipeLike
#4ADE80` (online dot) · `cardSurface #FCF8FC` (inbox online-dot ring) · `errorBg #FEF0F0` /
`errorText #B91C1C` (retry pill) · `blueLight #6FE1FF` / `blueDark #0B93D8` (links).

**Web** — add beside the existing brand variables (`--purple`, `--pink-dark`):

```css
--bubble-mine-end: #C02B7F;
--bubble-mine-solid: #9B1280;
--chat-read-tick: #53BDEB;
```

Every other value in §1 and §2 is given in full where it is used; whatever name the web
gives it, the value must match. ⚠ The web's existing `--pink-light` is `#f4e0e4`, **not**
this spec's pinkLight `#FFF4F7` — where this file says pinkLight, use `#FFF4F7`.

---

## 4. The wallpaper asset

| File | Role |
|---|---|
| `docs/design/assets/chat-pattern.svg` | **The master.** Never edited |
| `docs/design/assets/chat-pattern.png`, `@2x`, `@3x` | Master PNGs, 420 / 840 / 1260 px, rendered from the SVG |
| `docs/design/assets/make_tile_v3.py` | Generator. Seed `20260917` reproduces the master exactly |
| `docs/design/assets/export_pngs.py` | Renders the three PNGs from the SVG with Chromium |
| `frontend/public/patterns/chat-pattern.svg` | Web copy |
| `mobile/assets/chat-pattern.png`, `@2x`, `@3x` | Mobile copies |

Everything outside `docs/design/assets/` is a **copy**. Regenerating means: run the
generator, run the exporter, copy all four files to both platforms **in one commit**.
Exporting one without the others is how the two platforms silently diverge.

The files are full strength. The 0.5 opacity (§2) is applied by each platform when it draws
the layer, never written into a file.

Note: `make_tile_v3.py` writes to a hardcoded path (`/home/claude/chat-pattern.svg`). Change
that one line before running it anywhere else.

---

## 5. Allowed differences — these six and no others

1. **Bubble shadows are web-only.** Android elevation shadows render grey and cost frames
   inside list rows (`mobile/DESIGN.md` §6).
2. **Web shows the inbox and the conversation side by side** on wide screens; mobile
   shows one at a time. That is layout, not styling.
3. **Web uses the SVG, mobile uses the PNGs.** Same artwork, byte-for-byte from one master.
4. **Hover exists on web only.** Mobile has pressed states instead (`DESIGN.md` §9 forbids
   web hover logic in the app).
5. **The sent-bubble gradient's angle.** Mobile runs it corner-to-corner
   (expo-linear-gradient from `{0,0}` to `{1,1}`); CSS `135deg` keeps a true 135° on any
   bubble shape. The end colour lands in the bottom-right corner on both — where the time and
   ticks sit — so the measured contrast (§7) holds. Matching CSS exactly on mobile would mean
   measuring every bubble, which costs frames.
6. **The jump-to-latest button's shadow.** Android draws its elevation shadow in grey; web
   draws the purple shadow. Allowed because the button is a single floating control, not a
   list row, so the frame-cost reason behind #1 does not apply.

Anything else that differs between the two platforms is a bug.

---

## 6. Deliberately unchanged

Message logic, realtime, pagination (Phase 5), data fetching, the composer's behaviour, and
the product-chip data. This spec changes how things **look**. The one behaviour change of
Phase 6A — how a thread opens and when messages are marked read (Block V-E) — shipped on
both platforms and is recorded in §2 **Unread behaviour**.

---

## 7. Contrast — measured

WCAG AA: 4.5:1 for text under 18px, 3.0:1 for icons and other non-text UI.

| Pair | Ratio | Needs |
|---|---|---|
| White text on bubble end `#C02B7F` | 5.39 | 4.5 ✅ |
| Timestamp (white 90%) on `#C02B7F` | 4.64 | 4.5 ✅ |
| Blue read tick `#53BDEB` on `#C02B7F` (the corner the ticks sit in) | 2.53 | 3.0 ⚠️ **accepted by the owner, knowingly** |
| Blue read tick `#53BDEB` on bubble start `#800080` | 4.42 | 3.0 ✅ |
| Blue read tick `#53BDEB` on solid fallback `#9B1280` | 3.53 | 3.0 ✅ |
| White text on solid fallback `#9B1280` | 7.52 | 4.5 ✅ |
| Received text `#1A1A1A` on white | 17.40 | 4.5 ✅ |
| Received timestamp mutedText on white | 5.41 | 4.5 ✅ |
| Date chip mutedText on white-92% over the ground | 5.33 | 4.5 ✅ |
| Unread band purple on white-88% over the ground | 9.21 | 4.5 ✅ |
| Inbox unread time, purple, on the canvas top stop | 8.55 | 4.5 ✅ |
| Inbox preview mutedText on the canvas bottom stop | 4.51 | 4.5 ✅ |
| Send icon white on `#EB487F` | 3.64 | 3.0 ✅ |
| *Old web:* white text on `#EB487F` | *3.64* | *4.5 ❌* |
| *Old web:* amber tick on `#EB487F` | *2.92* | *3.0 ❌* |

The read tick fails on the pink end because the owner preferred WhatsApp's familiar blue to
a paler cyan. If it ever has to pass, the brand's `blueLight` `#6FE1FF` reaches **3.57:1**
on `#C02B7F`.

---

## 8. Deferred on both platforms

Neither platform shows these today. Both need a field that `GET /api/messages/inbox/:userId`
does not return, which is a backend change in a block of its own. Until then they are **not
requirements**, and neither platform may show them on its own — the two must not differ.

| Item | Where it would go | Needs |
|---|---|---|
| Product price in the snippet (Bree Serif 400 12, purple, as all prices) | §2 Product snippet | `product_price` on each inbox row |
| `You: ` prefix on your own last message | §1 Row, preview line | `last_sender_id` on each inbox row |

---

## 9. Not specified yet — each platform keeps its current look

These exist on both platforms but this spec gives no values for them. Each platform keeps
what it has until a later version specifies them:

- the typing bubble (the contact's "…" indicator);
- error states: the inbox failing to load, a thread failing to load, the conversation-with-
  yourself screen;
- the emoji button in the composer, and the emoji tray or picker it opens.
