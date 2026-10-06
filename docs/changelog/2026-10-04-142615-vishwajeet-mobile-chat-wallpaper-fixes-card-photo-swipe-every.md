---
date: 2026-10-04T14:26:15+05:30
author: vishwajeet
phase: "6A"
block: "V-B"
for: neeraj
title: "Mobile chat: wallpaper fixes; card photo swipe everywhere"
---

# Mobile chat: wallpaper fixes; card photo swipe everywhere

Follow-up to this morning's "Mobile chat wallpaper" entry, after the first device test.
Mobile only. **Two of these change what the web has to match**; see "What NOT to do yet".

## Chat wallpaper (`mobile/app/chat/[contactId].tsx`)

- **It covered only the top ~420 dp of the thread.** On Android, `resizeMode="repeat"` is a
  Fresco post-process, and on the device it drew one tile and stopped. The tiles are now
  laid out by hand: the thread is measured, and each 420 × 420 dp tile is its own image.
  The tile size was right on the device, so the PNGs and the 420 size are unchanged.
- **The doodles are lighter.** The tile layer is drawn at opacity **0.5**
  (`CHAT_WALLPAPER_OPACITY` in `mobile/src/theme`). The strokes go from about 35–40%
  purple to about 18–20%. The PNGs themselves are unchanged.
- **Text that sat straight on the wallpaper now has a backing**, because the doodles ran
  through it:
  - The day separator is now the spec's **date chip** (§2: white 0.92, pill, Inter 700 11
    uppercase mutedText, 10 above / 6 below, no lines).
  - The unread divider is now the spec's **unread band** (§2: full-bleed white 0.88,
    Inter 700 11 purple, centered).
  - The empty-chat welcome (👋, title, hint) sits on a white 0.9 card, radius 20. This is
    new and not in the spec. The suggestion pills are unchanged.
  - "This is the beginning of your conversation about …" sits on a white 0.9 pill,
    radius 12, and its text moved from mutedLabel to mutedText. Also new and not in the
    spec.
  - New theme tokens: `chatDateChip`, `chatUnreadBand` (both from spec §3) and
    `chatNoteSurface`.

## Product card photo swipe (`CardPhotoPager.tsx`, `ProductCard.tsx`)

- Swiping between a card's photos barely worked on Android and could stop with two photos
  half on screen. The horizontal paging ScrollView was replaced with a gesture-handler
  Pan raced against a Tap, the same pattern `SwipeCard` uses. The pager always comes to
  rest on a photo, even when the swipe is cancelled.
- It is now **on for every product card**: marketplace grid, dashboard, public profile and
  the sell preview. The swipe deck opts out (`swipePhotos={false}`), because a sideways
  drag there means like or pass.
- The **"1/N" counter is gone** from swipeable cards; the dots are the indicator. The
  swipe-deck card still shows "1/N", because it has no dots.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

Any listing with 2+ photos. Any conversation; a brand-new one shows the welcome card.

## What NOT to do yet

- **The web needs two matching changes, or the platforms diverge** (spec §5 allows no
  difference here):
  1. Draw the wallpaper layer at **opacity 0.5**.
  2. Back the empty-chat welcome and the "beginning of your conversation" line with
     `rgba(255,255,255,0.9)`.
  `docs/design/MESSAGES_SPEC.md` is yours, so I have **not** edited it. If you agree,
  please add both to §2/§3. If you'd rather use a different opacity, tell me and I'll match
  it; it's one constant.
- The date chip and unread band are the spec's own §2 values, so they need nothing extra
  on web beyond what V-C already planned.
- Bubbles, fonts and the composer are still unchanged on mobile (V-C).
