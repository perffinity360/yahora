# Messages Design Spec — v1

**Phase 6A · 27 September 2026 · the single source of truth for the inbox and the
conversation screens on BOTH platforms.**

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

## 1. Inbox — the conversation list

### Canvas

The app canvas. The inbox stops having its own paler variant.

| | Value |
|---|---|
| Stops, top → bottom | `#FFF0F7` → `#FBE9F8` → `#F1E6FF` |
| Mobile | `<ScreenGradient variant="app" />` (tokens `appBgTop/Mid/Bottom`) |
| Web | `.inboxSidebar { background: linear-gradient(170deg, #FFF0F7 0%, #FBE9F8 50%, #F1E6FF 100%) }` |
| Glows | **None.** Remove `.inboxSidebar::before/::after` on web and the `inbox` variant on mobile |

Why: the old inbox ramp (`#FDF8FF → #F8F0FF → #FFF4F9`) is 56%/31% saturation — the eye
reads it as white. The app canvas is 100% saturation at the same lightness, and its text
contrast is already measured (mutedText never below 4.51:1). Nothing new is invented.

### Header

| Element | Font | Colour |
|---|---|---|
| Title "Messages" | Bree Serif 400, 20 (`headline`) | `#0B0B0B` |
| Subtitle "N unread conversations" | Inter 500, 12 (`caption`) | mutedText `#6B6879` |

Hide the subtitle when N = 0. Singular: "1 unread conversation".

### Filter field (already exists on both — restyle only)

Height 38 · radius 19 · background `rgba(255,255,255,0.78)` · border
`1px rgba(128,0,128,0.08)` · placeholder "Search conversations", Inter 400 13, mutedText ·
leading search icon 15, mutedText. Margin 10 top, 16 sides, 6 bottom.

### Row

| Property | Value |
|---|---|
| Padding | 10 vertical, 16 horizontal |
| Avatar | 48 circle, gap 12 to the text column |
| Background | **none** — rows sit directly on the canvas. No cards |
| Pressed (mobile) | `rgba(128,0,128,0.06)` |
| Hover (web) | `rgba(128,0,128,0.04)` |
| Selected (web, conversation open beside it) | `rgba(128,0,128,0.08)` |
| Divider | 1px `rgba(128,0,128,0.08)`, starting at the text column (left 76), ending 16 from the right. None above the first row |

| Line | Read | Unread |
|---|---|---|
| Name — Inter 14 (`bodyLg`), 1 line, ellipsis | 600, `#0B0B0B` | **800**, `#0B0B0B` |
| Time — Inter 11 (`micro`), right-aligned | 500, mutedText | **700, purple `#800080`** |
| Preview — Inter 13 (`body`), 1 line, ellipsis | 400, mutedText | **500, `#1A1A1A`** |

Your own last message is prefixed `You: `.

**Unread badge:** min 20×20 · radius 10 · horizontal padding 6 · 135° gradient `#800080 →
#EB487F` · Inter 700 11 white · shows `99+` above 99 · sits at the end of the preview line.

**Product chip** (the listing the chat is about): Inter 600 11 · colour pinkDark `#EB487F` ·
background `rgba(235,72,127,0.09)` · radius 8 · padding 2 vertical, 8 horizontal · 1 line,
ellipsis · 5 below the preview.

### Time format — identical on both platforms

| Age of last message | Shows |
|---|---|
| under 1 hour | `2m` |
| same calendar day | `4:41 PM` |
| yesterday | `Yesterday` |
| within the last 6 days | `Mon` |
| this year | `12 Sep` |
| an earlier year | `12 Sep 2025` |

### Loading and empty

Initial load: **skeleton rows** (avatar circle + two bars), per `mobile/DESIGN.md` §6 —
never a spinner. Empty inbox: keep the existing empty state; restyle its text to the
tokens above.

---

## 2. Conversation

### Ground and wallpaper

| | Value |
|---|---|
| Ground | `#EDE6F5` — mobile `colors.chatCanvas`; web `.messagesContainer { background-color }` |
| Wallpaper | the committed tile, **420 × 420 units, repeating, unscaled** |
| Mobile file | `mobile/assets/chat-pattern.png` (+ `@2x`, `@3x`) |
| Web file | `frontend/public/patterns/chat-pattern.svg` |
| Behaviour | **fixed** — the messages scroll over it; it never moves |
| Glows and dot grain | **Removed** on web. Mobile's `chat` ScreenGradient variant is replaced |

Why `#EDE6F5` and not the wallpaper document's `#FDF8FF`: on a near-white ground the white
received bubbles, the date chips and the unread band dissolve into the background. See
`wallpaper_ground_options.png`. The deeper ground is what lets them lift off — which the
web CSS already notes as deliberate.

### Header

White · bottom border 1px `rgba(128,0,128,0.07)` · back chevron purple · avatar 36 ·
name Inter 600 16 (`title`) `#0B0B0B` · status line Inter 500 11 mutedText:
`<University> · online`, or `<University>` alone when offline.

### Product snippet (below the header)

On the white header surface · inner pill `#FFF4F7` (pinkLight), radius 12, padding 6/8 ·
thumbnail 30×30, radius 8, `cover` · title Inter 600 12 `#0B0B0B`, 1 line · price
**Bree Serif 400 12, purple** (all prices are Bree Serif — Phase 5 decision).

### Date chip

Centered · Inter 700 11, uppercase, letter-spacing 0.6 · mutedText · background
`rgba(255,255,255,0.92)` · radius 99 · padding 4/11 · margin 10 above, 6 below.
**No lines either side.** Labels: `Today`, `Yesterday`, weekday within 6 days, else
`12 Sep` / `12 Sep 2025`.

### Unread band

Full-bleed band across the thread width · background `rgba(255,255,255,0.88)` ·
Inter 700 11 purple, centered · padding 5 vertical · margin 8 vertical ·
text `1 unread message` / `N unread messages`.

### Bubbles

| Property | Value |
|---|---|
| Max width | 78% of the thread width, never above 520 |
| Padding | 8 top · 12 sides · 6 bottom |
| Radius | 18 |
| Tail | the **last** bubble of a run gets radius 5 on the corner nearest its sender (mine: bottom-right, theirs: bottom-left) |
| Run | consecutive messages from the same sender, same day, each within 5 minutes of the previous |
| Gap inside a run | 2 |
| Gap between runs | 8 |
| Message text | Inter 400 **14 / line-height 20** |

| | Mine | Theirs |
|---|---|---|
| Background | 135° gradient `#800080` → **`#C02B7F`** | `#FFFFFF` |
| Border | none | 1px `rgba(128,0,128,0.08)` |
| Text | `#FFFFFF` | `#1A1A1A` |
| Time + ticks | `rgba(255,255,255,0.90)` | mutedText `#6B6879` |

**Why the gradient ends at `#C02B7F` and not `#EB487F`.** `#C02B7F` is 60% of the way from
purple to pinkDark — the furthest the gradient can travel while white text, the 90%
timestamps and the read tick all stay readable. The current web bubble ends at `#EB487F`,
where white text is 3.64:1 and the amber tick is 2.92:1: both fail, at exactly the corner
the timestamp and ticks sit in. See `sent_bubble_contrast.png`.

**Performance guard — mobile.** The gradient must be measured on the Samsung Galaxy A03s
(Block N-F). If it costs frames, **both** platforms switch to the solid fallback
`#9B1280` (the gradient's colour at 25%; white text 7.52:1). The two platforms must never
disagree on this.

### Meta row inside the bubble

Right-aligned · Inter 500 11 · gap 4 · margin-top 2 · time as `4:41 PM`.

### Ticks (mine only)

| State | Icon | Colour |
|---|---|---|
| Pending | clock, 11 | white 90% |
| Sent | single check, 14 | white 90% |
| Delivered | double check, 15 | white 90% |
| **Read** | double check, 15 | **amber `#FDE68A`** |
| Failed | alert-circle, 12 | `#F87171` |

Amber, not blue, on both platforms. The web chose amber deliberately; mobile currently uses
`blueLight` and changes.

### Shadows

Web only: mine `0 1px 2px rgba(128,0,128,0.16), 0 6px 18px rgba(128,0,128,0.14)`; theirs
`0 2px 10px rgba(42,8,42,0.05)`. Mobile: none (see §5).

### Composer

White bar · top border 1px `rgba(128,0,128,0.07)` · padding 8 top, 10 sides, 12 bottom ·
input pill min-height 40, grows to 5 lines, radius 20, background `#F3F0EF` (inputBg),
Inter 400 14, placeholder `Message` · send button 40 circle, 135° gradient
`#800080 → #EB487F` (icon only — white on its pink end is 3.64:1, above the 3.0 needed
for an icon).

### Loading

Initial thread load: 4–6 skeleton bubble shapes alternating sides. Loading older messages
while scrolling up: keep the Phase 5 indicator.

---

## 3. New and changed tokens

**Mobile — `mobile/src/theme/index.ts`**

```ts
bubbleMineEnd:      '#C02B7F',                // sent-bubble gradient end (§2)
bubbleMineSolid:    '#9B1280',                // fallback if the gradient fails N-F
chatReadTick:       '#FDE68A',                // replaces blueLight for the read state
bubbleTheirsBorder: 'rgba(128,0,128,0.08)',
chatDateChip:       'rgba(255,255,255,0.92)',
chatUnreadBand:     'rgba(255,255,255,0.88)',
```

Plus one switch, so the performance decision lives in one place:

```ts
export const SENT_BUBBLE_STYLE: 'gradient' | 'solid' = 'gradient';
```

**Remove** `inboxTop`, `inboxMid`, `inboxBottom` and the `inbox` variant of ScreenGradient
once nothing uses them.

**Web** — add beside the existing brand variables (`--purple`, `--pink-dark`):

```css
--bubble-mine-end: #C02B7F;
--bubble-mine-solid: #9B1280;
--chat-read-tick: #FDE68A;
```

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

Note: `make_tile_v3.py` writes to a hardcoded path (`/home/claude/chat-pattern.svg`). Change
that one line before running it anywhere else.

---

## 5. Allowed differences — these four and no others

1. **Bubble shadows are web-only.** Android elevation shadows render grey and cost frames
   inside list rows (`mobile/DESIGN.md` §6).
2. **Web shows the inbox and the conversation side by side** on wide screens; mobile
   shows one at a time. That is layout, not styling.
3. **Web uses the SVG, mobile uses the PNGs.** Same artwork, byte-for-byte from one master.
4. **Hover exists on web only.** Mobile has pressed states instead (`DESIGN.md` §9 forbids
   web hover logic in the app).

Anything else that differs between the two platforms is a bug.

---

## 6. Deliberately unchanged

Message logic, realtime, pagination (Phase 5), data fetching, the composer's behaviour, and
the product-chip data. This spec changes how things **look**. Block V-E changes how the
mobile thread **opens** (the unread anchor); nothing else changes behaviour.

---

## 7. Contrast — measured

WCAG AA: 4.5:1 for text under 18px, 3.0:1 for icons and other non-text UI.

| Pair | Ratio | Needs |
|---|---|---|
| White text on bubble end `#C02B7F` | 5.39 | 4.5 ✅ |
| Timestamp (white 90%) on `#C02B7F` | 4.64 | 4.5 ✅ |
| Amber read tick on `#C02B7F` | 4.33 | 3.0 ✅ |
| White text on solid fallback `#9B1280` | 7.52 | 4.5 ✅ |
| Received text `#1A1A1A` on white | 17.40 | 4.5 ✅ |
| Received timestamp mutedText on white | 5.41 | 4.5 ✅ |
| Date chip mutedText on white-92% over the ground | 5.33 | 4.5 ✅ |
| Unread band purple on white-88% over the ground | 9.21 | 4.5 ✅ |
| Inbox unread time, purple, on the canvas top stop | 8.55 | 4.5 ✅ |
| Inbox preview mutedText on the canvas bottom stop | 4.51 | 4.5 ✅ |
| Send icon white on `#EB487F` | 3.64 | 3.0 ✅ |
| *Current web:* white text on `#EB487F` | *3.64* | *4.5 ❌* |
| *Current web:* amber tick on `#EB487F` | *2.92* | *3.0 ❌* |
