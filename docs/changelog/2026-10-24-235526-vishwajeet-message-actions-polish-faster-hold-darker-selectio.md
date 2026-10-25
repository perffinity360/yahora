---
date: 2026-10-24T23:55:26+05:30
author: vishwajeet
phase: "6B"
block: "V-E"
for: neeraj
title: "Message actions polish: faster hold, darker selection, WhatsApp delete dialog, centred reply arrow"
---

# Message actions polish: faster hold, darker selection, WhatsApp delete dialog, centred reply arrow

The owner tried the earlier V-E entry
(`2026-10-24-154532-vishwajeet-messages-whatsapp-style-long-press-menu-select-sev.md`) on a
phone and asked for seven fixes. The app got all seven. The website got only the ones it was
also missing (1, 2, 3, 6). **Where this entry and the earlier one disagree, this one is
right.** In particular, the earlier entry's dialog description (trash icon, solid red buttons)
is now out of date.

**⚠️ `frontend/` was edited from my session again, at the owner's request.** Files:
`src/utils/messageActions.js` (one constant), `src/styles/global.css` (one variable), and
`src/pages/messages/Messages.jsx` + `Messages.module.css`. Nothing else in `frontend/`
changed. The spec is updated: `docs/design/MESSAGES_SPEC.md` §0.2 (three new rows), §3,
§10.2, §10.3, §10.4, §10.8 and §10.10.

## What changed, item by item

| # | Owner's report | App | Website |
|---|---|---|---|
| 1 | The hold to open the menu feels long | `LONG_PRESS_MS` 350 → **250** | Same constant, same value: the touch long-press timer (`beginLongPress`) |
| 2 | Selected rows are hard to tell apart on the wallpaper | `chatRowSelected` 0.10 → **0.15** | `--chat-row-selected` 0.10 → **0.15** |
| 3 | Delete dialog: options on the right, no explanation text | Rebuilt in WhatsApp's layout | Same layout (details below) |
| 4 | The menu stays up while typing | Focusing or typing in the composer closes the menu. The selection and the header's actions stay | **No change.** The web menu already closes on any pointerdown outside it, so tapping or clicking the composer closes it |
| 5 | Sending from higher up doesn't go to the bottom | Fixed (cause below) | **No change.** The web already jumps to the bottom on your own message (the `isMine` branch of the scroll layout effect) |
| 6 | The swipe-reply arrow should be centred on the message, and bigger | 36 circle / 22 glyph (was 30 / 18), centred on the bubble's height | Same: `.swipeReplyIcon` is now 36 px, centred with `top: 0; bottom: 0; margin: auto 0` (the transform was already used by the scale), `<CornerUpLeft size={22} />` |
| 7 | Reply doesn't open the keyboard | Fixed (cause below) | **No change in code.** `startReply` focuses the composer inside the click (menu) or the `pointerup` (swipe), both user gestures. Please check it on a phone anyway |

### The delete dialog (both platforms)

- The title is on the left: "Delete message?" or "Delete N messages?".
- There is **no body text** any more. The "Delete it for everyone in this chat…" and "<name>
  will still see it" lines are gone. On the web, `aria-describedby` went with the body.
- **No trash icon.**
- The choices are text buttons, **stacked and right-aligned**, each only as wide as its label:
  "Delete for everyone" (only when allowed) · "Delete for me" · "Cancel".
- Both deletes are red `#B91C1C` text, with an `--error-bg` background on hover or press.
  Cancel is purple text, with a light purple hover.
- Unchanged: which choices show, the `autoFocus` (the first delete), Esc and the scrim click
  to cancel, the animation, and one request per message.
- On the web, `.modalBtnSoft`, `.modalBtnCancel`, `.modalIcon`, `.modalText` and
  `.modalActionsStacked` are deleted. The delete dialog was the only thing on the page using
  them.

### Why 5 and 7 failed on the app (no web equivalent)

- **5:** the app scrolled to the newest message the moment Send was pressed. The new bubble
  arrives a moment later, and the list's "keep my place when something is added"
  (`maintainVisibleContentPosition`) then held the reader where they were, cancelling the
  scroll. The scroll now waits until your new bubble is the newest row.
- **7:** on Android, an input that kept its focus after its keyboard was put away ignores
  `focus()`. The app now waits one frame (for the reply bar to appear and the menu to go),
  blurs the input if the keyboard is down, then focuses it.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None. No backend file changed.

## New fields on existing responses

None.

## Test data

- `npx tsc --noEmit` (mobile) and `vite build` (frontend) pass.
- **Not yet checked on a phone or in a browser.** The owner checks the app. The website
  checklist is in the message I'm sending you with the merge.

## What NOT to do yet

- Don't bring back the dialog's explanation text or the trash icon. The owner asked for them
  to go.
- Reactions still go in the 8 px gap between a message and its menu (`GAP` in
  `mobile/src/components/MessageActionMenu.tsx`), in the community phase.
