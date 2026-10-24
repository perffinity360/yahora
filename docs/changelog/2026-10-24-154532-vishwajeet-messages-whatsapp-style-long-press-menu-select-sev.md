---
date: 2026-10-24T15:45:32+05:30
author: vishwajeet
phase: "6B"
block: "V-E"
for: neeraj
title: "Messages: WhatsApp-style long-press menu, select several messages, new delete dialog, reply on mobile"
---

# Messages: WhatsApp-style long-press menu, select several messages, new delete dialog, reply on mobile

The owner tested V-E part 2 on the phones and asked for message actions that work the way
WhatsApp's do. The bottom sheet was in the way of reactions later, you couldn't delete several
messages at once, a long-press only worked on the bubble itself, and the native delete Alert
looked out of place. This entry also includes V-E part 3 (Reply) on mobile.

**⚠️ `frontend/` was edited from my session, at the owner's request.** These are your files, so
please read the diff. Everything is in `frontend/src/pages/messages/Messages.jsx` and
`Messages.module.css`. Nothing else in `frontend/` changed.

The spec is updated in `docs/design/MESSAGES_SPEC.md`: §10.1, §10.2 (rewritten), §10.8 (the
dialog, now one look on both platforms) and the new **§10.11 Selecting several messages**.

## Website changes (`frontend/`)

- **The menu now has "Select"** (Reply · Copy · Select · Delete; a tombstone has Select ·
  Delete). Choosing it enters selection mode with that message ticked.
- **Selection mode** works like WhatsApp Web's "Select messages":
  - every row gets a tick box at its start;
  - clicking anywhere on a row ticks or unticks it, and links, quotes, the actions button and
    swipes do nothing while selecting;
  - a bar replaces the composer: `x`, "N selected", Copy (hidden if a deleted message is
    selected) and Delete. The half-typed draft is kept underneath;
  - Esc, `x`, unticking the last message, Copy, a delete or switching chats all leave it.
- **Delete with several messages** sends one existing request per message, all at once. No
  backend change. The dialog shows "Delete N messages?", and offers "Delete for everyone" only
  if every selected message allows it.
- **The whole row is the target:**
  - right-click (and the Android Chrome long-press, which fires `contextmenu`) works on the
    empty space beside a bubble, not only on the bubble;
  - **iPhone Safari never fires `contextmenu`**, so the website had no long-press there. A
    350 ms touch timer on the row now opens the menu. It is cancelled by 10 px of movement, and
    the tap a long-press ends with is ignored.
- **The delete dialog** has a trash icon, and "Delete for everyone" is now solid red. "Delete
  for me" is the softer red when both choices show, and solid red when it is the only one. The
  app uses the same design (§10.8).

## Mobile changes (mine)

- The bottom sheet is gone. A long-press anywhere on a message's row (bubble or empty space)
  selects it and opens a menu card beside the bubble. The header becomes "N selected" with
  Reply, Copy and Delete. Taps then add or remove messages.
- The app draws its own delete dialog (`DeleteMessagesDialog`) instead of the phone's Alert.
- **Part 3, Reply:** swipe right to reply, the reply bar in the composer, the quote inside a
  reply, and pressing the quote to jump to the original (it loads up to 5 older pages, then
  shows a toast).

## Migrations applied

None.

## New endpoints

None. Deleting several messages calls the existing `POST /api/messages/:id/delete-for-everyone`
or `/delete-for-me` once per message.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

Not tested on a phone or in a browser yet. The owner checks both after this entry. Builds:
`npx tsc --noEmit` (mobile) and `vite build` (frontend) both pass, and `expo export --platform
android` bundles.

## What NOT to do yet

- Don't add reactions. The gap between a message and its menu (8, `GAP` in
  `mobile/src/components/MessageActionMenu.tsx`) is where the reactions bar will go in the
  community phase, on both platforms.
- Don't add a bulk-delete endpoint unless the per-message calls cause trouble. There is no
  rate limit on `/api/messages` today.
