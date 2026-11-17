---
date: 2026-11-13T17:57:44+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "Posting limit says when; toasts readable; Being checked in blue; new post no longer hidden (app)"
---

# Posting limit says when; toasts readable; Being checked in blue; new post no longer hidden (app)

The owner's second round on the app (13 Nov), on branch `v-d-app-community`. The owner said to fix the
website **only where the same problem exists there**. Three did, and I fixed those on the website too.
`COMMUNITY_SPEC.md` v3.11's change note lists them all. `npx vite build` and the app's `tsc` pass. Nothing
was checked in a browser.

**⚠ I edited your `frontend/` again, and one line of `posts.controller.js`** (on loan to you):

1. **The posting limit says when to try again.** The inline text now reads
   `You've reached the posting limit for now. Try again at 6:19 pm, in 26 minutes.` (`reply limit` for
   replies).
   - The new `rateLimitText(code, next_allowed_at)` in `utils/community.js` (twin of the app's) writes it.
   - `useComposer.js` puts it in `message` on a 429, and `Composer.jsx` shows `c.message` there.
   - Without `next_allowed_at`, it falls back to the old sentence.
2. **Toasts last long enough to read, and wrap.** `components/AppToast/`:
   - Duration is `toastDuration(text)`, new in `utils/messageActions.js`: 1 s plus 70 ms a character,
     at least `COPY_TOAST_MS` and at most 8 s. "Copied" is unchanged; the held toast now stays about 6 s.
   - The CSS drops `nowrap` and the ellipsis. The toast is `width: max-content`, text centred, radius 16.
   - Your held toast was cut with "…" on a phone; that's what this fixes. **This changes every toast on
     the website**, including the Messages ones, which keep their "Copied" timing.
3. **`Being checked` is blue.** `.statusPending` in `PostCard.module.css`, and `--status-pending-text`
   and `-bg` in `global.css`. `Under review` stays grey.
4. **`posts.controller.js`, `createPost`:** the failed insert now passes `hint` to `mapDbError` as well.
   Still never `details`.

Not done on the website, because they're app-only or I couldn't tell whether the website has them:

- **The Post button** (smaller, folds while scrolling, blue draft badge): app only. The website has no
  such button.
- **"Post this?" a size smaller:** app only. The owner judged the app's dialog; yours wasn't looked at.
- **A new post hidden above the top of the feed:** an app bug. FlashList keeps what's on screen still
  when an item arrives above it, which undid the scroll to the top.
  - Your `onPosted` scrolls in the same tick as `setItems`. Chrome's scroll anchoring can do something
    similar while a smooth scroll is running.
  - I didn't change it. **Please check:** at 390 wide, scroll down, post, and the new post should end up
    whole at the top. If only its bottom shows, run the scroll in a `requestAnimationFrame` after the
    insert.

## Migrations applied

- **`20261113122231_post_rate_limit_retry_at.sql`: local only.** Vishwajeet pushes it to production, then
  deploys the backend.
  - It's `prepare_post()` exactly as before, except that `RATE_LIMIT_POSTS` and `RATE_LIMIT_REPLIES` now
    carry the time the window has room again, as their `HINT`.
  - That time is an hour after the post whose leaving brings the count under the limit.
  - Checked locally in a rolled-back transaction: with the limit lowered to 2 and 15 posts in the hour,
    the hint was the 14th oldest post's time plus an hour, as intended.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

- **`POST /api/posts` 429: `next_allowed_at`** (ISO 8601, UTC) on `RATE_LIMIT_POSTS` and
  `RATE_LIMIT_REPLIES`. `mapDbError()` in `utils/respond.js` reads it from the hint.
  - It's left out where the database doesn't have the migration yet, so the client falls back to the
    old sentence.
  - See `backend/API.md`.

## Test data

None.

## What NOT to do yet

- Don't expect `next_allowed_at` on production until my "pushed" entry; until then you'll see the old
  sentence there.
- Not merged yet: on `v-d-app-community`.

## The app, same round (nothing for you to do)

- **New post hidden above the top:** fixed. The scroll to the top now waits 250 ms for the post to render
  and FlashList to correct its position. The "new posts" pill does the same after its posts arrive.
- **Post button:**
  - 44 tall (was 48).
  - It folds to the round pencil while scrolling down, and opens again on scrolling up or near the top.
  - The draft dot is now a blue badge ringed in white on its corner; the pink dot clashed with the pink
    pill.
- **"Post this?":** `ConfirmDialog` has a `compact` size (about a tenth smaller), used only for the nudge.
- **Toasts:** the same duration rule as the website, and they wrap 16 in from the screen's edges.
- **☺ in the compose screen**, after GIF, like your composer's: `EmojiPickerSheet` (`multiple`) stays open
  to add several, each at the cursor, and the cursor comes back after the last.
