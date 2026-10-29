---
date: 2026-10-29T09:32:35+05:30
author: neeraj
phase: "6B"
block: "N-D, N-F"
for: vishwajeet
title: "Website: privacy states (N-D) and message actions (N-F, swipe add-on)"
---

# Website: privacy states (N-D) and message actions (N-F, swipe add-on)

## Migrations applied


## New endpoints


## Changed endpoints (BREAKING)


## New fields on existing responses


## Test data

These three website blocks shipped without an entry of their own; this one records them. All
of it is `frontend/` only. They were tested in T1 and T2; see those entries:
`2026-10-17-150430-neeraj-m1-live-identity-rule-views.md` (T1) and
`2026-10-26-170457-neeraj-t2-m2-message-actions-on-web-and-app.md` (T2).

**N-D: privacy states** (PR #71, commit `d83556d`)
- **Hidden seller:** when the API hides the seller (logged-out or demo viewer), the product
  page shows "A student at <campus>" with a person icon, no name and no profile link. A demo
  viewer sees "Verified students can see who's selling."; a logged-out one sees "Log in with
  your college email to see who's selling." and a Log in button. The card shows
  "Yahora student" with a person icon.
- **Hidden commenters:** questions and answers from a hidden student show as "Yahora student"
  with a person-icon avatar.
- **Public profile:** two states instead of the profile: a log-in prompt on `401
  LOGIN_REQUIRED`, and an unavailable state on `404 USER_NOT_FOUND`.
- **Messages:** requests carry the session token, so the API shows the seller and a new chat
  is not titled "User".
- **Link preview** (`frontend/netlify/edge-functions/product-preview.js`): the description no
  longer says "Listed by <seller>".
- **Views:** the client-side view counter was dropped; views are counted by the API (M1).

**N-F: message actions** (PR #76, commits `f632235`, `e078274`, `60ac958`)
- **The menu:** Reply / Copy / Delete, from the ⌄ button beside a bubble, right-click, or a tap
  (touch) on the bubble (MESSAGES_SPEC §10).
- **Copy:** copies the text, with the `Copied` toast (fallback for http on a phone).
- **Delete:** for everyone (within the hour) or for me, with a confirmation. A message deleted
  for everyone becomes a tombstone on both sides.
- **Inbox previews:** `You: ` on your own last message; deleted and hidden messages change the
  preview (§10.9).
- **Reply:** the reply bar in the composer, the quote inside the reply, and tapping the quote
  jumps to the original (loading older pages if needed).
- **`frontend/CLAUDE.md` §18:** the website shows the same words and the same features on every
  screen size. Only the layout adapts. Touch-versus-mouse behaviour is allowed when the platform
  forces it.
- **Auth pages:** the same copy on every device.

**N-F add-on** (PR #77, commit `1e7d909`)
- **Swipe to reply** on touch screens, with the same constants as the app (§10.3). A mouse
  still uses the menu.
- **No text selection** when long-pressing in the chat on a touch screen; only the composer and
  the inbox search keep it.
- **The keyboard no longer covers the composer** on a phone (`interactive-widget=resizes-content`
  in `frontend/index.html`, plus a visual-viewport fallback for iOS). The thread stays pinned to
  the newest message when the keyboard or the reply bar opens.

## What NOT to do yet

- The swipe-to-reply constants (`SWIPE_REPLY_TRIGGER` 56, `SWIPE_REPLY_MAX` 72) live in both
  `frontend/src/utils/messageActions.js` and `mobile/src/lib/messageActions.ts`. Change both in
  the same commit (MESSAGES_SPEC §10.10).
