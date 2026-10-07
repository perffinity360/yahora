---
date: 2026-10-07T11:02:39+05:30
author: vishwajeet
phase: "6A"
block: "V-E"
for: neeraj
title: "Mobile unread line and read-on-sight"
---

# Mobile unread line and read-on-sight (+ the web)

This is a port of the web's unread behaviour to the mobile conversation screen, plus one
**additive** backend change: `PUT /api/messages/read` accepts an optional `upToId`. The web
now uses it too; see the warning below.

Files:
- `mobile/app/chat/[contactId].tsx`, `mobile/src/contexts/RealtimeContext.tsx`,
  `mobile/src/hooks/useMessages.ts` (`useMarkRead`)
- `backend/src/modules/messages/messages.controller.js` (`markAsRead`), `backend/API.md`
  (commit `a29c59a`)
- `frontend/src/pages/messages/Messages.jsx`

⚠️ Backend PR: **this needs your review before merge.** It's the messages module only.

## ⚠️ I edited a file in your scope, `frontend/`

The owner asked for this on the web in my session, so both platforms mark messages read
the same way. **Please review the diff.** Only `Messages.jsx` changed, and only its
read-marking. The anchoring, the band, jump-to-latest, pagination and the look are
untouched.

- **Three whole-thread `PUT /messages/read` calls are gone:**
  - on open, in `handleSelectChat`;
  - on a realtime arrival while watching;
  - on returning to the tab, in `flushAwayUnread`.
- **They're replaced by one read-on-sight path,** `scheduleRead()` → `flushVisibleRead()`:
  - Any scroll, `messages` change, `showInboxOnMobile` change, or return to the tab
    restarts a 300 ms timer (`READ_DEBOUNCE_MS`).
  - When the timer fires, it measures the rows by their `data-msg-id` rect. It finds the
    newest unread message from the contact that is at least 50% inside the thread's
    viewport (`READ_VISIBLE_RATIO`).
  - It sends that as `upToId`, then sets the inbox badge to the unread messages after it.
  - Nothing is sent while the tab isn't watched, or while the chat pane has no layout
    (the phone inbox view).
  - `lastReadIdRef` stops the same position being sent twice. It's reset on chat switch
    and on error.
- **Why measure when the timer fires instead of using an IntersectionObserver:** the
  measurement always reflects the viewport after the layout effect has anchored on the
  line. A position taken before the anchor would mark the whole run read.
- **Inbox badge:** an arrival in the open chat now skips the badge only if you're
  watching, at the live end (`isAtBottomRef`), *and* the pane is on screen. Otherwise it
  counts until you reach it.
- `npm run build` passes. I haven't seen it in a browser.

## What mobile does now

- **Band placement matches the web.**
  - The band is pinned once, after the history has *settled*, meaning no fetch is in
    flight. The cache is persisted, so before this the band could be pinned on a stale
    copy of the thread.
  - It uses the web's inbox-count fallback: if `unread_count` says there are more unread
    than the rows show, it takes that many of the contact's newest messages.
  - With more unread than one page, the band goes above the oldest *loaded* unread
    message and counts only the loaded ones. That's the same as the web; no extra page
    is fetched.
- **The chat opens at the band.** `scrollToIndex` puts the band about 35% down the screen,
  the web's `UNREAD_ANCHOR_LEAD_RATIO`. Rows that aren't measured yet go through
  `onScrollToIndexFailed`, which jumps to an estimate and retries, at most 4 times. The
  away-from-chat band now lands at the same position. It used to go to the very top.
- **Read on sight.**
  - A message counts as seen once 50% of its row is visible (`onViewableItemsChanged`).
  - Newly seen unread ids are batched and debounced by 300 ms. Then **one**
    `PUT /api/messages/read` goes out, with `upToId` set to the newest message in the batch.
  - Messages up to that one turn read. Later ones stay unread, keep the inbox badge, and
    get the band next time.
  - Nothing is marked read on open or on focus any more. Nothing is marked read before
    the band is pinned, while the chat is under another screen, or while the app is
    backgrounded or offline.
  - Nothing is marked read until about 600 ms after the scroll to the band
    (`ANCHOR_SETTLE_MS`). Before then the screen is still showing the newest messages,
    and a read position taken there would mark the whole run read.
- **`RealtimeContext` no longer marks the open chat read when a message arrives.** It
  only sends deliver. The chat counts as the realtime "active chat", which keeps new
  messages out of the inbox badge, only while you're at the newest message. Messages that
  arrive while you're scrolled up are counted in the badge until you scroll down to them.
- **Scrolled up and a message arrives:** your position holds
  (`maintainVisibleContentPosition`, with an 80 dp auto-follow threshold, the web's
  `BOTTOM_STICK_THRESHOLD`). Before this, each arrival pushed the view along by one
  message.
- **Sending your own message** scrolls to the newest message, as the web does.

## Runbook §1.10 was wrong about the old web, and is true now

- §1.10 said the web "marks messages read only when they actually appear on screen." It
  didn't: it marked the whole thread read as soon as the thread opened. **It does now,
  on both platforms**, and F5 row 2 should pass with the reader on either one.
- "Up to" means a position, not a list. Older messages above the reader's view are
  marked too. That's Telegram's model. It means nothing gets stranded as unread forever,
  which a list of ids would have done once unread messages ran past one page.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None breaking. One additive change:

- `PUT /api/messages/read`: new **optional** body field `upToId` (uuid).
  - **When present:** only the caller's unread messages from `contactId` on `productId`
    with `created_at <=` that message's are marked.
  - **New errors, only when it's present:**
    - 400 `INVALID_FORMAT`: not a uuid.
    - 404 `NOT_FOUND`: not a message from `contactId` to the caller in that thread.
  - **When absent:** unchanged, the whole thread is marked.
  - `backend/API.md` is updated.
  - Checked on local: a bad uuid → 400, a message from the wrong thread → 404, and
    neither changes a row. `upToId` = the 2nd of 3 → `[read, read, unread]`. Without it
    → all three read.

## New fields on existing responses

None.

## Test data

F5, on two accounts:

- 0 unread: the chat opens at the newest message with no band.
- 1 unread: same, with a "1 unread message" band just above it.
- 6 unread: the band sits about a third of the way down, with the first unread just
  below it.
- More than 20 unread: the band sits above the oldest loaded unread message, with
  "20 unread messages".

Then check F5 row 2: read only the first 3 under the band, then leave. The sender should
see 3 read and 3 unread, and your inbox badge should show 3. **Do it on both the web and
the phone**, because the web read path is new too.

Also check:

- Scroll up and receive a message: you shouldn't move, and the jump button's badge
  should count it.
- Open the product from the header, then press back: you should be in the same chat, at
  the same place.

## What NOT to do yet

- Don't add any new whole-thread `PUT /messages/read` calls on either platform. Every
  read goes through read-on-sight with `upToId`. The no-`upToId` path stays in the
  backend for old clients only.
- `maintainVisibleContentPosition` on an inverted list hasn't been checked on a device
  yet. If arrivals at the bottom stop showing up, that's the first suspect.
