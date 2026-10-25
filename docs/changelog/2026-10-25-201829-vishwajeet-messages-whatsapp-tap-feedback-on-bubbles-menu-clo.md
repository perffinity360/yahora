---
date: 2026-10-25T20:18:29+05:30
author: vishwajeet
phase: "6B"
block: "V-E"
for: neeraj
title: "Messages: WhatsApp tap feedback on bubbles; menu closes on any touch or the keyboard; instant hold on the app"
---

# Messages: WhatsApp tap feedback on bubbles; menu closes on any touch or the keyboard; instant hold on the app

This is the third V-E entry. Read it after
`2026-10-24-154532-vishwajeet-messages-whatsapp-style-long-press-menu-select-sev.md` and
`2026-10-24-235526-vishwajeet-message-actions-polish-faster-hold-darker-selectio.md`. Where
they disagree, this one wins.

The owner tested on a phone and reported four things. The guiding rule from the owner is now:
**build what established messaging apps already do (WhatsApp first), then add our own ideas on
top**, rather than inventing a behaviour from scratch.

**⚠️ `frontend/` was edited from my session again, at the owner's request.** Files:
`src/utils/messageActions.js` (three new constants), `src/styles/global.css` (two new
variables), `src/pages/messages/Messages.jsx` + `Messages.module.css`. Nothing else in
`frontend/` changed. The spec has a new **§10.12**, and §10.2, §10.10, §3 and §0.2 (three rows)
are updated.

## What changed, item by item

| # | Owner's report | App | Website |
|---|---|---|---|
| 1 | A tap on a message gives no feedback. WhatsApp lights the bubble | New §10.12: an overlay in the bubble's shape after 100 ms of rest, held while down, faded on release. A quicker tap flashes once | **Same, for touch only** (WhatsApp Web shows nothing for a mouse click). See below |
| 2 | The hold sometimes feels slow; the app feels like it hangs | The band now appears from the UI thread the moment the hold completes, with the long-press haptic. Entering selection no longer re-renders and re-registers every visible row's gestures (the main cost). See "Why the hold was slow" | **No change.** The web's timer has no second thread to wait on |
| 3 | A thin line between two selected rows, sometimes white, sometimes purple | Fixed: the block above the thread is snapped to a whole pixel (cause below) | **No change.** Browsers place each row on whole pixels themselves |
| 4 | Long-press, then tap the composer: the menu stayed | Fixed: any touch outside the menu closes it (header, thread, composer), and so does the keyboard opening or closing. The selection stays | **No change.** The web menu already closes on any `pointerdown` outside it |

### The website change (#1), in detail

- `beginPressFeedback` / `movePressFeedback` / `releasePressFeedback` / `clearPressFeedback` sit
  next to `beginLongPress` in `Messages.jsx`. They are called from the **bubble's** existing
  pointer handlers, beside `beginSwipe` / `moveSwipe` / `endSwipe`. Only bubbles with actions get
  them (`hasActions`).
- The lit state is a **`data-pressed` attribute** on the bubble, not React state and not a
  class. State would re-render the thread twice per touch, and React rewrites `className` on
  every render, which would drop a class React didn't set.
- CSS: `.messageBubble::after` (`inset: 0; border-radius: inherit`, so it follows the tail) and
  `.messageBubble[data-pressed]::after`. Colours: `--chat-bubble-press-mine` (white 22%) and
  `--chat-bubble-press-theirs` (purple 7%, because white doesn't show on the white bubble). The
  fade is 60 ms in and 220 ms out; with `prefers-reduced-motion` there is no fade.
- Movement over `SWIPE_CANCEL_PX` (10) or a `pointercancel` (the browser taking the touch for a
  scroll) clears it. So a scroll or a swipe-to-reply never lights the bubble.

### Why the hold was slow on the app (#2)

- **Expo Go runs the development build.** React's dev checks, no minification, and every
  `console.warn` shipped to Metro with a full stack. The same code is several times faster in a
  release build. SDK 58 itself is not the cause.
- **Our own cost:** each row's three gestures depended on `selecting`. The first long-press
  therefore re-rendered every mounted row (FlatList keeps far more than the screen) and
  re-registered about three worklet gestures per row, all on the JS thread, before the band could
  appear. The gestures now read a shared value on the UI thread, and the selection tap became a
  watch-only `Gesture.Manual` (an activated `Tap` steals the touch from links and quotes, which is
  why it used to be switched on and off). The band shows from the UI thread at once.
- **Fixed console noise:** the Reanimated "Dependencies should only be used on the web" warning
  (`ListItemFab`), and the product page's back now checks `router.canGoBack()` (the "GO_BACK was
  not handled" dev warning).

### Why the line appeared on the app (#3)

Yoga rounds a row's position relative to its parent, but its height from the absolute screen
edges (`yoga/algorithm/PixelGrid.cpp`). When the list's own top falls between two physical
pixels (the header's text heights make that the usual case), two neighbouring rows come out 1px
apart (the wallpaper shows: a white line) or 1px overlapping (the band doubles: a purple line).
`WholePixelHeight` in the chat screen gives everything above the thread a height that is a whole
number of pixels. This is app-only.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None. No backend file changed.

## New fields on existing responses

None.

## Test data

- `npx tsc --noEmit` and `npx expo export --platform android` (mobile) pass, and so does
  `vite build` (frontend).
- **Not yet checked on a phone or in a browser.** The owner checks the app. Your checklist is in
  the message that comes with the merge.
- New mobile dependency: `expo-haptics ~58.0.7`, which is part of Expo Go. The app is also on
  **Expo SDK 58** now (React Native 0.88), in the same branch.

## What NOT to do yet

- Don't make the website's press feedback show for a mouse. WhatsApp Web doesn't, and hover
  already does that job.
- Don't put the bubble's lit state in React state or `className`. See the reason above.
- Reactions still go in the 8 px gap between a message and its menu, in the community phase.
