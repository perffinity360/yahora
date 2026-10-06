---
date: 2026-10-04T12:29:55+05:30
author: vishwajeet
phase: "6A"
block: "V-B"
for: neeraj
title: "Mobile chat wallpaper"
---

# Mobile chat wallpaper

The open conversation on mobile (`mobile/app/chat/[contactId].tsx`) now draws the doodle
wallpaper from `docs/design/MESSAGES_SPEC.md` §2. This is a presentation change only. No
message logic, pagination, realtime or scrolling behaviour changed.

- **Before:** the root `View` painted `colors.chatCanvas` (`#EDE6F5`), and on top of it
  `<ScreenGradient variant="chat" />` drew the same lavender again plus two static glows
  (purple at the top left, blue at the bottom right).
- **Now:** the root still paints `colors.chatCanvas`, and the glows are gone. The screen no
  longer renders `ScreenGradient`. The thread area (below the header and product snippet,
  above the emoji tray and composer) is wrapped in a `flex: 1` container. Its first child is
  React Native's own `Image` with `resizeMode="repeat"` showing
  `mobile/assets/chat-pattern.png` (420 dp tile; RN picks `@2x`/`@3x` by suffix).
- The wallpaper sits **outside** the inverted `FlatList`, so it stays still while messages
  scroll over it, the same "fixed" behaviour the web has. The FlatList's `style` and its
  `contentContainerStyle` are both `backgroundColor: 'transparent'`.
- It deliberately uses RN `Image`, not `expo-image`, because expo-image has no repeat mode.
  A comment in the code says so.
- No PNGs were changed and no dependency was added. `ScreenGradient.tsx` is untouched; its
  `chat` variant now has no caller, and V-C removes it.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

None. Open any conversation on the phone. The tile size has **not been checked on a
device yet.** The bicycle doodle should be about three send-buttons wide, and the same size
on every phone.

## What NOT to do yet

- The web half is yours: spec §2 puts the same artwork at 420 px from
  `frontend/public/patterns/chat-pattern.svg`. That file is **not on `main` as of this
  entry**, so I couldn't compare the two. Mobile's three PNGs are byte-identical to the
  masters in `docs/design/assets/`. If you ever re-export the tile, copy all four files to
  both platforms in one commit (spec §4).
- Bubbles, spacing, fonts and the composer are unchanged on mobile. That is V-C, so don't
  match web against the current mobile bubbles yet.
