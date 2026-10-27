# Messages Design Spec — v3

**Phase 6B · v3 · 11 October 2026 · the single source of truth for the inbox and the
conversation screens on BOTH platforms.**

**v3 adds §10, message actions — Reply, Copy and Delete — and the inbox-preview changes that
come with them (Phase 6B). §0.2 lists every change from v2. Everything else is v2, unchanged.**

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

## 0.2 What changed from v2

| Section | v2 | v3 | Why |
|---|---|---|---|
| Header | v2 · Phase 6A | v3 · Phase 6B | Message actions |
| §1 Row | `You: ` prefix deferred (§8) | **Live**: your own last message starts with `You: `; deleted and hidden messages change the preview (§10.9) | The inbox now returns `last_sender_id` and `last_message_deleted` (migration `message_actions`) |
| §2 Bubbles | — | Pointer to §10 | Replies show a quote; deleted messages show a tombstone |
| §3 Tokens | — | 10 new mobile tokens, 10 new web variables | §10's colours, named so no screen holds a literal |
| §5 Allowed differences | Six | **Ten**: adds swipe (touch only — the app, and the website on a touch screen), how the actions open, the delete dialog's look, Android 13's own copy confirmation | Each is a platform convention, not a design choice |
| §7 Contrast | — | 10 new rows, including two **rejected** options | The first quote and tombstone colours failed on the pink end; the shipped ones pass |
| §8 Deferred | Price, `You: ` | Price only | `You: ` shipped in §10.9 |
| §10 | — | **New**: message actions | Phase 6B |
| §2 Bubbles | Failed message waits for a tap | A message that failed because the server couldn't be reached is **sent again by itself** once the server answers ("Sending again on its own"). A refusal still waits for a tap | Owner's call, 2026-10-18 |
| §5 Allowed differences | Ten | **Eleven**: adds when the failed-load state shows | Mobile caches a thread; the website doesn't |
| §2 Loading | Not specified for a failed load | **"Couldn't load this chat"** with Retry, on both. It reloads by itself once the server answers | Owner's call, 2026-10-18. The web used to show an empty thread, and dropped unsent messages with it |
| §2 Unread behaviour | Seen once 50% of the row is visible | …or once it fills 50% of the thread | A long message taller than twice the thread was never marked read: no blue ticks for the sender, and the badge stayed |
| §10.2, §10.10 | Long-press 350 ms; selected band 0.10 | **250 ms**; band **0.15**. On the app, focusing or typing in the composer closes the menu beside a message (the selection stays) | Owner's call, 2026-10-24: the hold felt slow, and selected rows were hard to tell apart on the wallpaper |
| §10.3 | Reply icon 30/18, bottom-aligned | **36/22, centred** on the bubble | Owner's call, 2026-10-24 |
| §10.8 | Trash icon, centred title, body text, full-width red buttons | **WhatsApp's layout**: left title, no body, text buttons stacked on the right | Owner's call, 2026-10-24 |
| §10.12 | No touch feedback on a bubble | **New: WhatsApp's pressed bubble** — an overlay in the bubble's shape after 100 ms of rest, held while the finger is down, faded on release; a quicker tap flashes once. App, and the website on a touch screen | Owner's call, 2026-10-25: a tap gave no sign it had landed |
| §10.2 | On mobile, a touch **in the thread**, a scroll, or focusing the composer closes the menu | A touch **anywhere** outside the menu (header, thread, composer), a scroll, or the keyboard opening or closing. The keyboard moves the thread, and a menu left behind floated over the wrong message | Owner's report, 2026-10-25 |
| §10.2 | The selected band appeared once the JS thread had rendered it | **The band shows the moment the hold completes** (drawn from the UI thread), with WhatsApp's long-press haptic | Owner's report, 2026-10-25: the hold sometimes felt slow |
| §10.2, §10.11 | A tap on the composer closed the menu; the selection stayed | **A tap on the composer ends the selection** (one message or several) and opens the keyboard, as in WhatsApp. Other touches outside the menu still keep it | Owner's report, 2026-10-26 |
| §2 Header | The app showed a strip above the header when offline ("You're offline — messages will send when you reconnect." / "Connecting…"), in the chat and the inbox | **No strip**, on either screen. A message waiting to send already shows its clock, as in WhatsApp. The website never had one | Owner's call, 2026-10-26: the app works offline and people open it offline knowingly; the strip also pushed the header and wallpaper down as it appeared |

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

Your own last message starts with `You: `, and a deleted or hidden last message changes the
preview — both in **§10.9**.

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

**Sending and retrying (Phase 6B, owner's call 2026-10-16).** A sent message shows at once
with the clock tick. If a try fails for a reason that can pass, the app retries **by itself**,
keeping the clock:

| | Value |
|---|---|
| Retry after | 2, 4, 8, 16, 30 s (`SEND_MAX_RETRIES = 5`, `sendRetryDelay`) |
| Retried | no answer, or no answer in 15 s (`SEND_TIMEOUT_MS`) · 401 · 408 · 429 · 5xx |
| Not retried | any other 4xx: the server refused this message, so it fails at once |
| Offline | waits for the network (mobile NetInfo, web `online`) and uses up no tries |
| Order | one send at a time per conversation, in the order typed |
| Already delivered | if Realtime brings the message in while a retry waits, the retry is dropped (no double post) |
| Already on the server | when a reloaded history holds a message from me with the same text **after** the newest message the thread had when the bubble was typed (`sent_after_id`), the bubble is that message and is dropped. One server message accounts for one bubble. Text alone is not enough: an older "ok" must not swallow a new one |

**Failed message** (only after the retries give up, or at once for a refusal): the bubble
drops to opacity 0.72, its tick becomes the alert icon, and a pill sits under it,
right-aligned, 3 below: background `#FEF0F0`, text "Failed to send" in Inter 600 11
`#B91C1C`, a rotate icon 11 in the same colour, gap 4, padding 3 vertical / 8 horizontal,
radius 999. Tapping it sends the same message again, with the full retry cycle. Pressed
(mobile): opacity 0.7. Web: hover opacity 0.85, active 0.7, focus-visible outline.

A failed message **stays** in its thread, through leaving and reopening the chat, with the
server up or down. Only sending it removes it.

**Sending again on its own (owner's call 2026-10-18).** A message that failed because the
server couldn't be reached (every retry used up on a retried reason above, or the app closed
while it was sending) is sent again **by itself** once the server answers. It goes through
the full retry cycle, so its pill turns back into the clock. A message the server **refused**
(any other 4xx) is never sent again by itself: only a tap sends it.

| | Value |
|---|---|
| How "the server answers" is known | `GET /api/health` returns 200 |
| When it asks | at once, then every 10 s (`SERVER_PROBE_MS = 10000`), while the open chat has such a message or its history failed to load. Also at once when the network comes back (mobile NetInfo, web `online`), when the app returns to the foreground, or when the tab is shown (web). One probe at a time, given up after 10 s |
| What happens | the history is reloaded first if it had failed, then those messages are sent again, in the order typed |
| Scope | the open chat only. Another chat's failed messages wait until it is opened |

**Replies, copy and delete** — the quote at the top of a reply, the deleted-message tombstone,
and how a message's actions open — are in **§10**.

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
| Failed | alert-circle, 12 | `#FFFFFF` (white, like the other ticks; owner's call 2026-10-16, was `#F87171`) |

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
- **Read on sight.** A message counts as seen once **50%** of its row is visible, **or** once
  it fills **50%** of the thread. The second case is for a row taller than twice the thread,
  such as a 2000-character message on a phone, which can never be half on screen. Mobile has
  two viewability configs, `SEEN_BY_ROW` (`itemVisiblePercentThreshold: 50`) and
  `SEEN_BY_THREAD` (`viewAreaCoveragePercentThreshold: 50`), and a row needs only one. Web uses
  `READ_VISIBLE_RATIO = 0.5` of `min(row height, thread height)`.
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

**The history failed to load** (owner's call 2026-10-18), centred in the thread:

- an icon circle 64, `pinkLight #FFF4F7`, 1 border `inputBorderFocus #E5C8E5`, wifi-off icon
  26 `#800080`, 16 below it;
- "Couldn't load this chat", Inter 700 16 `#1A1A1A`;
- "Check your connection and try again.", Inter 400 13 / 19 `mutedText #6B6879`, 4 above,
  max width 300;
- a **Retry** pill 24 below: 44 tall, padding 0 32, radius 999, the brand gradient
  `#800080` → `#EB487F`, Inter 600 13 white. Pressed (mobile): opacity 0.88. Web: hover 0.92,
  active 0.88 + scale 0.98, focus-visible outline.

Retry reloads at once. The thread also reloads **by itself** once the server answers (§2
"Sending again on its own"). The welcome note ("This is the beginning…") is hidden meanwhile,
because nobody knows that it is the beginning.

The two platforms differ only in what sits around it. **Mobile** keeps the last copy of the
thread it has, so it shows this only when it has none. **Web** holds no copy, so it shows this
every time a load fails. Any unsent or failed messages of the thread show under it, because
they exist only on this device and must never disappear.

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
chatFailedTick:     '#FFFFFF',
```

Message actions (§10), added in v3:

```ts
chatRowSelected:   'rgba(128,0,128,0.15)',     // a selected row (0.10 until 24 Oct: too faint on the wallpaper)
chatRowHighlight:  'rgba(128,0,128,0.12)',     // jump-to-original flash
chatBubblePressMine:   'rgba(255,255,255,0.22)', // pressed sent bubble (§10.12)
chatBubblePressTheirs: 'rgba(128,0,128,0.07)',   // pressed received bubble: white wouldn't show on white
chatQuoteMineBg:   'rgba(0,0,0,0.12)',         // quote inside a sent bubble
chatQuoteMineBar:  'rgba(255,255,255,0.90)',
chatQuoteMineText: 'rgba(255,255,255,0.85)',
chatQuoteTheirsBg: 'rgba(128,0,128,0.06)',     // quote inside a received bubble; also the reply bar
chatTombstoneMine: 'rgba(255,255,255,0.90)',   // "You deleted this message"
sheetHandle:       'rgba(128,0,128,0.15)',
scrim:             'rgba(11,11,11,0.32)',      // behind the sheet and dialogs
toastBg:           'rgba(26,26,26,0.88)',      // "Copied" and other toasts
```

The red for Delete is the existing `errorText #B91C1C`. The constants of §10.10 live in
`mobile/src/lib/messageActions.ts`.

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

Message actions (§10), added in v3 — reuse an existing variable only where its value is
identical:

```css
--chat-row-selected: rgba(128,0,128,0.15);
--chat-row-highlight: rgba(128,0,128,0.12);
--chat-bubble-press-mine: rgba(255,255,255,0.22);
--chat-bubble-press-theirs: rgba(128,0,128,0.07);
--chat-quote-mine-bg: rgba(0,0,0,0.12);
--chat-quote-mine-bar: rgba(255,255,255,0.90);
--chat-quote-mine-text: rgba(255,255,255,0.85);
--chat-quote-theirs-bg: rgba(128,0,128,0.06);
--chat-tombstone-mine: rgba(255,255,255,0.90);
--scrim: rgba(11,11,11,0.32);
--toast-bg: rgba(26,26,26,0.88);
--danger-text: #B91C1C;
```

The constants of §10.10 live in `frontend/src/utils/messageActions.js`.

Every other value in §1, §2 and §10 is given in full where it is used; whatever name the web
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

## 5. Allowed differences — these eleven and no others

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

7. **Swipe to reply needs a touch screen** (§10.3). The app and the website on a touch
   screen both do it, with the same constants. A swipe means nothing with a mouse or pen,
   so there the website reaches Reply through its menu only.
8. **How the actions open** (§10.2): long-press and a bottom sheet on mobile; a hover/tap
   button beside the bubble, right-click, and a popover menu on web. The three actions, their
   order, labels and icons are the same.
9. **The delete confirmation's look** (§10.8): the phone's own `Alert` on mobile, the site's
   modal on web. The title, body, choices and their order are the same.
10. **Android 13 and newer show their own copy confirmation** (§10.7), so the app shows no
   toast there. Android 11–12 and the website show the app's `Copied` toast.
11. **When "Couldn't load this chat" shows** (§2 "Loading"). Mobile keeps the last copy of a
   thread and shows the state only when it has none; the website holds no copy and shows it
   whenever a load fails, with the thread's unsent messages under it. The state itself is
   the same.

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
| Quote name, white, on black-12% over the pink end `#C02B7F` (§10.5) | 6.57 | 4.5 ✅ |
| Quote text, white 85%, on black-12% over `#C02B7F` | 5.13 | 4.5 ✅ |
| Quote text, white 85%, on black-12% over the solid fallback `#9B1280` | 6.75 | 4.5 ✅ |
| *Rejected:* quote text, white 85%, on **white**-18% over `#C02B7F` | *3.38* | *4.5 ❌* |
| Quote name, purple, on purple-6% over white (theirs; also the reply bar) | 8.42 | 4.5 ✅ |
| Quote text, mutedText, on purple-6% over white (theirs; also the reply bar) | 4.83 | 4.5 ✅ |
| Tombstone label, white 90%, on `#C02B7F` (§10.8) | 4.64 | 4.5 ✅ |
| *Rejected:* tombstone label, white **85%**, on `#C02B7F` | *4.29* | *4.5 ❌* |
| Delete label `#B91C1C` on white | 6.47 | 4.5 ✅ |
| `Copied` toast, white on `#1A1A1A` 88% over the chat ground | 12.75 | 4.5 ✅ |

The read tick fails on the pink end because the owner preferred WhatsApp's familiar blue to
a paler cyan. If it ever has to pass, the brand's `blueLight` `#6FE1FF` reaches **3.57:1**
on `#C02B7F`.

---

## 8. Deferred on both platforms

Neither platform shows this today. It needs a field that `GET /api/messages/inbox/:userId`
does not return, which is a backend change in a block of its own. Until then it is **not a
requirement**, and neither platform may show it on its own — the two must not differ.

| Item | Where it would go | Needs |
|---|---|---|
| Product price in the snippet (Bree Serif 400 12, purple, as all prices) | §2 Product snippet | `product_price` on each inbox row |

`You: ` was here in v2. It shipped in v3 (§10.9), once the inbox began returning
`last_sender_id`.

---

## 9. Not specified yet — each platform keeps its current look

These exist on both platforms but this spec gives no values for them. Each platform keeps
what it has until a later version specifies them:

- the typing bubble (the contact's "…" indicator);
- error states: the inbox failing to load, a thread failing to load, the conversation-with-
  yourself screen;
- the emoji button in the composer, and the emoji tray or picker it opens.

---

## 10. Message actions — Reply, Copy, Delete (new in v3)

Phase 6B. Picture: `docs/design/message_actions.png` (source `message-actions-mockup.html`).
Where the picture and this section disagree, this section wins.

### 10.1 Which actions a message has

| The message | Actions, in this order |
|---|---|
| A normal message (mine or theirs) | **Reply · Copy · Delete** (web menu: **Reply · Copy · Select · Delete**) |
| A deleted-for-everyone message (tombstone, §10.8) | **Delete** only (it removes the tombstone from your own view); web menu: **Select · Delete** |
| Mobile: a message still sending, or failed | **none** — the failed pill (§2) already handles it |
| The empty-chat card, the beginning note, the typing bubble, date chips, the unread band | none — they are not messages |

### 10.2 Opening the actions

*Revised 24 Oct 2026 (owner's call): the mobile bottom sheet is gone. Both platforms now follow
WhatsApp — the actions open **in the thread, beside the message**, and several messages can be
selected at once (§10.11). The space between a message and its menu is where the reactions bar
goes in the community phase.*

| | Mobile | Web |
|---|---|---|
| How | **Long-press** the message's **row**, **250 ms** (`LONG_PRESS_MS`; 350 until 24 Oct) — the bubble or the empty space beside it, the thread's full width. It **selects** the message (§10.11) and opens the menu | **Hover** the bubble → an actions button appears beside it; click it. **Right-click** anywhere on the row opens the same menu. On a touch screen (no hover) **tap** the bubble to show the button, or **long-press** anywhere on the row (250 ms) to open the menu |
| The row while open / selected | `rgba(128,0,128,0.15)` band behind the whole row, full thread width (it cancels the thread's 12 side padding) | same band |
| Container | **Menu card beside the bubble**, no scrim | **Popover menu** anchored under the actions button, kept inside the thread's edges |

**Mobile menu:** white · radius 16 · shadow `#2A082A` at 16%, radius 12, y 8 (Android elevation 8) · hairline border `rgba(128,0,128,0.08)` · width 196 · padding 6 vertical · each item 48 tall, padding 0/16, icon 20 then gap 14 then label Inter 500 15 `#1A1A1A` · icons mutedText · **Delete** in `#B91C1C`. Placed **8 below** the bubble when it fits inside the thread (12 from its edges), otherwise 8 above, otherwise over it (a bubble taller than the thread). Lined up with the bubble's right edge for mine, left edge for theirs. Grows in from the corner nearest the bubble (scale 0.86 → 1, opacity 0 → 1, 170 ms, ease-out cubic); fades out in 110 ms. **Any touch outside the menu** — in the thread, the header or the composer — a scroll, or the **keyboard opening or closing** closes it and **keeps the selection** (the header then shows the actions). **A tap on the composer is the exception: it ends the selection** and opens the keyboard (WhatsApp); the Android back button or the header's arrow ends the selection. The keyboard rule is there because the keyboard moves the thread: a menu left open would float over a different message.

**The hold (mobile):** the band appears the moment the 250 ms hold completes, drawn on the UI thread, together with the phone's long-press haptic (Android `LONG_PRESS`; iPhone light impact). Nothing waits for the JS thread, so a busy JS thread can't make the hold feel slow.

**Web actions button:** a 28 circle **beside** the bubble, on its outer side — left of mine, right of theirs — aligned with the bubble's top, gap 6 · white · border 1px `rgba(128,0,128,0.08)` · `chevron-down` 16, mutedText · fades in over 120 ms · hover on the button itself: background pinkLight `#FFF4F7`. It sits outside the bubble so it never covers the message text, and the bubble's size never changes.

**Web menu:** white · radius 12 · shadow `0 8px 24px rgba(42,8,42,0.16)` · padding 6 vertical · min-width 168 · each item 40 tall, padding 0/14, icon 16 then gap 12 then label Inter 500 14 `#1A1A1A` · icons mutedText · Delete in `#B91C1C` · hover and keyboard focus `rgba(128,0,128,0.06)`. Arrow keys move between items, Enter chooses, **Esc** closes and puts focus back on the actions button.

Icons: Reply `corner-up-left` · Copy `copy` · Delete `trash-2` (Feather on mobile, lucide on web — same shapes).

### 10.3 Swipe to reply (touch screens: the app, and the website on a touch device)

Swipe any bubble (mine or theirs) to the **right**. Mobile always; the website only for a
**touch** pointer (Pointer Events, `pointerType === 'touch'`) — a mouse or pen there changes
nothing and keeps the menu (§10.2).

| | Value |
|---|---|
| Starts | after **12** of horizontal movement; **10** of vertical movement first cancels it, so the list still scrolls |
| Follows the finger | up to **72** (`SWIPE_REPLY_MAX`), never left of its start |
| Reply icon | `corner-up-left` 22 purple in a 36 white circle (18 in 30 until 24 Oct), shadow `0 1px 3px rgba(42,8,42,0.12)` (Android: `elevation: 1`), at the row's left edge, **centred on the bubble's height** (was bottom-aligned), opacity rising 0 → 1 as the bubble travels 0 → 56 |
| Triggers | released past **56** (`SWIPE_REPLY_TRIGGER`) → reply mode for that message |
| Returns | spring back to 0 (Reanimated `withSpring`, damping 20, stiffness 220) |

Not on tombstones, pending or failed messages. All of it runs on the UI thread (Reanimated); no JS state changes while the finger moves.

**Website, on a touch screen** — the same numbers and the same look, with these web-only details:

- The row has `touch-action: pan-y`, so vertical scrolling stays the browser's own. A gesture that reaches 10 vertical (or 12 to the left) before 12 to the right is left alone for the rest of that touch.
- A touch that starts within **24** of the screen's left edge is never a swipe: that is the phone's or browser's Back gesture.
- The spring back is a **180 ms** CSS transition (`cubic-bezier(0.2, 0.8, 0.2, 1)`); with `prefers-reduced-motion` the bubble snaps back. The icon also scales 0.6 → 1 as it fades in.
- Releasing past 56 does what the menu's Reply does (reply bar, input focused) and asks for a 10 ms vibration where the browser allows it.
- No React state changes while the finger moves: the offset is written to the row as CSS variables.
- A tap still shows the actions button and a long-press still opens the menu (§10.2). A swipe that has started cancels the long-press; a long-press that has opened the menu ends the swipe; the click that follows a swipe does not count as a tap.

### 10.4 Reply mode — the reply bar in the composer

Starting a reply (from the menu, the sheet or a swipe) shows a **reply bar** inside the composer bar, above the input row, and focuses the input — **the keyboard opens** on a phone, also when the input still had focus from before but its keyboard had been put away.

| | Value |
|---|---|
| Bar | background `rgba(128,0,128,0.06)` · radius 12 · left accent 3 wide, purple `#800080`, filling the bar's height on its left edge · padding 6 top, 6 bottom, 13 left (10 after the accent), 6 right · gap 8 · margin 6 below |
| Line 1 | `Replying to You` or `Replying to <first name>` — Inter 600 12/16, purple |
| Line 2 | the quoted message, 1 line, ellipsis — Inter 400 12/16, mutedText. An emoji-only message shows its emoji at this size (no jumbo) |
| Close | `x` 16, mutedText, in a 28×28 touch target at the right. Web: **Esc** in the input also closes it |
| Clears when | you send · you press close · you open another conversation |

*First name* = the first word of the contact's name as the header shows it; with no name, `Yahora student`.

### 10.5 The quote inside a reply

A reply shows the message it answers at the **top of its own bubble**, above its text, inside the bubble's padding.

| | Mine (on the gradient) | Theirs (on white) |
|---|---|---|
| Background | `rgba(0,0,0,0.12)` | `rgba(128,0,128,0.06)` |
| Accent (left, 3 wide, full height) | `rgba(255,255,255,0.9)` | `#800080` |
| Name — Inter 600 12/16 | `#FFFFFF` | `#800080` |
| Text — Inter 400 12/16, max **2** lines, ellipsis | `rgba(255,255,255,0.85)` | mutedText `#6B6879` |
| Radius · padding · gap to the text below | 8 · 6 vertical, 8 horizontal after the accent · 6 | same |

- **Name:** `You` when the quoted message is yours, otherwise the contact's first name (§10.4).
- **Text:** the stored `reply_preview`. If it is empty because the original was deleted for everyone: `Original message was deleted`, **italic**, same colour — and the quote is not tappable.
- **Width:** the quote takes the bubble's full inner width; a reply bubble is never narrower than **180** (`REPLY_MIN_BUBBLE_WIDTH`), so `ok` answering a long message still shows a readable quote. The 78% / 520 maximum still applies.
- **Why black 12% and not a white tint on mine:** white 18% over the pink end measured 3.38:1 for the quote text. Black 12% measures 5.13 (§7).

### 10.6 Jump to the original

Tapping a quote scrolls to the original message and flashes it.

| | Value |
|---|---|
| Position | the original is placed **35%** down the thread — the same placement the unread band uses (§2 Unread behaviour), with the same function. **A message taller than the thread** (27 Oct, owner): its **start** lands **16** below the top of the thread, never its middle. The web already does this (it places the row's top edge at 35%); the app's `scrollToIndex` placement centred a tall row, so the app places a quoted row by its top whenever it is taller than the thread less 32 |
| Flash | a band `rgba(128,0,128,0.12)` behind the whole row (full thread width), held **1200 ms**, then fading out over **400 ms** |
| Not loaded yet | load older pages with the same call scrolling up uses, at most **5** extra pages (`JUMP_MAX_EXTRA_PAGES`), then jump |
| Still not found | toast `Couldn't find the original message` (§10.7 toast) |

Jumping changes nothing about read state or the unread band.

### 10.7 Copy

Copies the message's text **exactly** (`content`), then confirms with a toast:

| | Value |
|---|---|
| Toast | `Copied` · Inter 600 12 white · background `rgba(26,26,26,0.88)` · radius 999 · padding 6/12 · centred, 16 above the composer · shows **1500 ms** (`COPY_TOAST_MS`), fades in and out over 150 ms |
| Android 13 and newer | **no app toast** — Android shows its own clipboard confirmation there, and two would double up (`Platform.Version >= 33`) |
| Web | always the toast |

Clipboard: mobile `expo-clipboard` (`setStringAsync`). Web: the existing `copyText()` in `frontend/src/utils/share.js`, which uses `navigator.clipboard.writeText` where it exists (**https** and **localhost**) and falls back to a hidden `<textarea>` + `document.execCommand('copy')` where it doesn't (the site opened from a phone over the LAN, `http://192.168.x.x`). If it reports failure, the toast says `Couldn't copy`.

The toast is shared: §10.6 and §10.8 use it for their messages too.

### 10.8 Delete

Choosing **Delete** opens a confirmation:

| The message | Title | Choices, top to bottom |
|---|---|---|
| Mine, not deleted, sent **under 60 minutes ago** | `Delete message?` | **Delete for everyone** (`#B91C1C`) · **Delete for me** · **Cancel** |
| Mine and older, or theirs, or any tombstone | `Delete message?` | **Delete for me** · **Cancel** |

**No body text** (owner's call, 24 Oct 2026): the choices explain themselves. Until then a line under the title explained them.

For several selected messages (§10.11) the title is `Delete N messages?`, and "Delete for everyone" shows only when **every** one of them allows it.

**The dialog — WhatsApp's layout, the same on both platforms** (revised 24 Oct 2026, twice; mobile no longer uses the phone's `Alert`):

| | Value |
|---|---|
| Scrim | `rgba(11,11,11,0.55)` mobile (`scrim`) · `rgba(0,0,0,0.4)` web (the Dashboard modal's) |
| Card | white · radius 24 · padding 22 top and sides, 12 bottom · max width 360 · centred on screen |
| Icon | none (the trash circle was removed on 24 Oct) |
| Title | Bree Serif 400 20, `#1A1A1A`, **left-aligned** |
| Buttons | text buttons, **stacked and right-aligned**, each as wide as its label · 18 under the title, gap 4 · 44 tall, padding 0/12, radius 12 (the press/hover background), Inter 600 15 · the label's right edge lines up with the title's padding |
| Delete for everyone | `#B91C1C` text; press/hover background `#FEF0F0` (errorBg) |
| Delete for me | `#B91C1C` text; press/hover background `#FEF0F0` |
| Cancel | purple `#800080` text; press background inboxRowPressed (mobile), hover `rgba(128,0,128,0.06)` (web) |
| Motion | mobile: the scrim fades, the card scales 0.92 → 1 over 200 ms; web: the existing `modalIn` |

Tapping the scrim, Esc (web) or the Android back button is Cancel. Cancel keeps a selection; a delete ends it.

**What happens**

- **Delete for everyone** → the message becomes a **tombstone** for both people, live (Realtime UPDATE). Any reply quoting it shows `Original message was deleted` in its quote.
- **Delete for me** → the message disappears from **your** view only. The other person is not told and sees no change.
- The 60 minutes (`DELETE_FOR_EVERYONE_MINUTES`) is enforced by the database; the apps use the same number only to decide which choices to show. If the hour runs out while the dialog is open, the server answers `DELETE_WINDOW_EXPIRED` → toast `It's too late to delete this for everyone`.

**The tombstone**

| | Mine | Theirs |
|---|---|---|
| Bubble | same shape, side and background as a normal bubble of that side | same |
| Content | icon `slash` (Feather) / `Ban` (lucide) 14, then gap 6, then the label | same |
| Label — Inter 400 **italic** 14/20 | `You deleted this message` · `rgba(255,255,255,0.90)` | `This message was deleted` · mutedText |
| Meta row | time only — **no ticks** | time only |

No emoji sizing, no links, no quote, not swipeable. White 90% on the pink end measures 4.64 (§7); 85% would fail.

### 10.9 The inbox preview

| The last message you can see | Preview line |
|---|---|
| Yours | `You: ` + the text. (This un-defers §8 item 2: the inbox now returns `last_sender_id`) |
| Theirs | the text, as before |
| Deleted for everyone | `slash` 12 + gap 4 + italic `You deleted this message` / `This message was deleted` (who deleted it: `last_sender_id`). Unread rows keep their unread weights; the italic stays |
| You hid it ("delete for me") | it is skipped — the preview shows the newest message you can still see. If you hid every message, the conversation leaves **your** inbox until a new message arrives |

`You: ` is Inter of the preview's own weight and colour (§1 Row), followed by the text with no extra spacing.

### 10.10 Constants — same names, same values, both platforms

```ts
LONG_PRESS_MS               = 250    // 350 until 24 Oct
SWIPE_REPLY_TRIGGER         = 56     // touch only: the app, and the website on a touch screen
SWIPE_REPLY_MAX             = 72     // touch only
REPLY_MIN_BUBBLE_WIDTH      = 180
JUMP_HIGHLIGHT_HOLD_MS      = 1200
JUMP_HIGHLIGHT_FADE_MS      = 400
JUMP_MAX_EXTRA_PAGES        = 5
COPY_TOAST_MS               = 1500
DELETE_FOR_EVERYONE_MINUTES = 60     // the database enforces this; apps only decide what to show
PRESS_FEEDBACK_DELAY_MS     = 100    // §10.12; touch only
PRESS_FEEDBACK_IN_MS        = 60     // §10.12
PRESS_FEEDBACK_OUT_MS       = 220    // §10.12 (the web writes it in Messages.module.css)
```

Mobile keeps them in `mobile/src/lib/messageActions.ts`; web in `frontend/src/utils/messageActions.js`. Change both in the same commit, and the SQL function `delete_message_for_everyone` too if the 60 changes.

### 10.11 Selecting several messages (WhatsApp's selection mode)

| | Mobile | Web |
|---|---|---|
| Starts | a long-press on any message's row (§10.2) | **Select** in a message's menu |
| While selecting | a **tap** on a message's row picks or unpicks it (a long-press too); links, quotes and swipes rest | a **click** anywhere on a row picks or unpicks it; links, quotes, the actions button and swipes rest |
| Marked by | the selected band (§10.2) | the band, and a **tick box** at the start of every row: 22 square, radius 6, border 2 mutedText; picked → filled purple with a white `check` 14. A row that can't be picked (sending, failed) keeps the space |
| Bar | **over the header**, same box: `arrow-left` (purple) · `N selected` Inter 600 16 · then, once the menu has closed, the actions: **Reply** (one message, not a tombstone) · **Copy** (no tombstone selected) · **Delete** (`#B91C1C`) | **in place of the composer** (the draft is kept): `x` · `N selected` · **Copy** (no tombstone selected) · **Delete** (`#B91C1C`), 40 round buttons |
| Ends | the arrow, Android back, a tap on the composer, unpicking the last one, Copy, Reply, a delete, or opening another chat | `x`, Esc, unpicking the last one, Copy, a delete, or opening another chat |

- **Copy** puts the texts on the clipboard **oldest first, one per line**, and toasts `Copied` (§10.7 rules).
- **Delete** opens §10.8's dialog for all of them; each message is its own request, all sent together. Any refusal: `It's too late to delete this for everyone` / `Couldn't delete. Try again.` for one message; `Some were too old to delete for everyone` / `Couldn't delete some messages. Try again.` for several.
- A selected message that is hidden or leaves the thread leaves the selection; one deleted for everyone while selected stays selected but takes Copy and Reply away.

### 10.12 Touch feedback on a bubble (WhatsApp's pressed state)

*Added 25 Oct 2026 (owner's call): a tap on a message gave no sign it had landed.*

A finger on a bubble lights it, the way WhatsApp's bubbles do:

- **When:** after the finger has rested **100 ms** (`PRESS_FEEDBACK_DELAY_MS`, Android's tap timeout) without moving more than 10 dp/px. A finger that starts a scroll or a swipe within that time never lights it.
- **Look:** an overlay in the bubble's own shape (its corners and tail), over the text: `chatBubblePressMine` / `--chat-bubble-press-mine` (white 22%) on a sent bubble; `chatBubblePressTheirs` / `--chat-bubble-press-theirs` (purple 7%) on a received one, because white doesn't show on white.
- **Motion:** up in **60 ms**, held while the finger stays down (a long-press keeps it lit under the menu's arrival), faded in **220 ms** on release. A tap quicker than 100 ms flashes once: up in 60, then the fade. A scroll, a swipe or a cancelled touch fades it at once.
- **Where:** the bubble only. The empty part of the row still takes long-presses and selection taps (§10.2, §10.11) but shows nothing, as in WhatsApp. Only messages with actions (not sending, not failed).
- **Platforms:** the app always; the **website only for touch**. WhatsApp Web shows nothing for a mouse click, and the website already has hover.
- **Reduced motion:** the overlay switches on and off with no fade.
