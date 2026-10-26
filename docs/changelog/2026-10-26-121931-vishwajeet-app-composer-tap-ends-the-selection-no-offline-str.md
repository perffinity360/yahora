---
date: 2026-10-26T12:19:31+05:30
author: vishwajeet
phase: "6B"
block: "V-E"
for: neeraj
title: "App: composer tap ends the selection; no offline strip; gestures back on the UI thread; one back per press"
---

# App: composer tap ends the selection; no offline strip; gestures back on the UI thread; one back per press

The fourth V-E entry. Read it after
`2026-10-25-201829-vishwajeet-messages-whatsapp-tap-feedback-on-bubbles-menu-clo.md`.

**Nothing in `frontend/` or `backend/` changed.** Only the app changed, plus
`docs/design/MESSAGES_SPEC.md` (§0.2 has two new rows, and §10.2 and §10.11 are updated).
**You don't need to change anything on the website.** Each item below says why.

## What changed

| # | Owner's report | App | Website |
|---|---|---|---|
| 1 | Logs full of `None of the callbacks in the gesture are worklets` | Fixed (cause below) | Not affected: the website has no gesture-handler |
| 2 | With a message selected, a tap on the composer closed the menu, but the message stayed selected | **A tap on the composer ends the selection**, one message or several, and opens the keyboard, as in WhatsApp. Other touches outside the menu still keep the selection | Not affected: while selecting, the website's composer is replaced by the selection bar, so it can't be tapped |
| 3 | `The action 'GO_BACK' was not handled by any navigator`, and the Samsung lagged on the way back | Fixed (cause below) | Not affected |
| 4 | The offline strip above the chat pushed the header and wallpaper down, and showed every time the app opened offline | **Removed** from the chat and the inbox. `ConnectionBanner.tsx` is deleted | Not affected: the website never had one |

### Why 1 happened

The two watch-only gestures (the selection tap and the press feedback) were built by a helper,
`watchOnlyGesture()`. The worklets Babel plugin only turns a gesture's callbacks into worklets
when the chain visibly starts with `Gesture.Pan()` (etc.). Behind the helper, the callbacks
ran on the JS thread, and gesture-handler printed a warning **for every chat row it mounted**.
In Expo Go, each warning is sent to Metro with a full stack, which is a big part of the lag.
The chain is now written out at both call sites, and all 7 touch callbacks compile to worklets.

### Why 3 happened

`router.back()` doesn't navigate when it is called. It queues the action, and expo-router runs
the queue after the next render. A second back in that window (a double tap, or the arrow plus
the system back, which is easy on a slow phone) passed the same `canGoBack()` check and queued a
second GO_BACK. That one either popped the screen underneath too, or found nothing left and
logged the error. The chat and product screens now send their way out once
(`mobile/src/hooks/useLeaveOnce.ts`).

### Why 4 is a removal

The owner's call: the app works offline, and people will often open it offline on purpose. A
message waiting to send already shows its clock, as in WhatsApp. `isOffline` stays in
`RealtimeContext`, because the chat's automatic resend still waits for the network.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None. No backend file changed.

## New fields on existing responses

None.

## Test data

- `npx tsc --noEmit` and `npx expo export --platform android` pass.
- The chat screen was compiled with the app's Babel preset before and after the change. Before,
  none of the `onTouches*` callbacks were worklets. After, all 7 are.
- **Not yet checked on a phone.** The owner checks the app.

## What NOT to do yet

- Don't put a gesture chain behind a helper function again. Write `Gesture.X()` at the call
  site (`mobile/CLAUDE.md`).
- Don't add an offline banner back on either platform unless the owner asks.
