---
date: 2026-11-13T18:24:25+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "Your own replies stay first after a reload (replies only)"
---

# Your own replies stay first after a reload (replies only)

Owner, 13 Nov: keep our replies on top after a reload, as X does, and do it for replies only. Feed posts
keep their own order.

**Nothing to change on the website.** Your `addedReplies` already go first, so your screen and the
server now agree. I updated one comment at the top of `PostThread.jsx`, which said a reload brings back
Hot order. That is the only edit in `frontend/` in this entry.

## Migrations applied

- **`20261113125126_own_replies_first.sql`: local only.** Vishwajeet pushes it to production. No backend
  deploy is needed for this one.
  - `get_post_replies(p_sort => 'hot')` and `post_top_replies()` sort the viewer's own replies first,
    newest first, then everyone else's by Hot, as before.
  - The sort key is `1e12 + created_at in epoch seconds` for your own and `hot_score` for the rest. It
    goes back in the row's `hot_score`, which the controller already turns into the opaque cursor and
    strips before sending. So **no backend, API-shape or client change**.
  - Your own replies' times are rounded to hundredths of a second. A double turned into jsonb keeps only
    15 significant digits, and with microseconds the cursor never moved past the row.
  - Checked locally on a thread with replies from two people, as each of them, with the full page and
    paging one at a time:
    - **arjun.mehta** sees his four replies first, newest first, then priya.nair's.
    - **priya.nair** sees her one first, then arjun's by Hot.
    - The preview is the first 2 of each person's order.
    - Paging gives 5 pages, each reply once.

## New endpoints

None.

## Changed endpoints (BREAKING)

- **`GET /api/posts/:id/replies`**: the caller's own replies first (newest first), then Hot. The shape
  and cursor form are unchanged. A cursor issued before the migration still decodes, but its position may
  not match the new order, so start a thread again without one.
- **`top_replies` on every PostItem**: the first 2 of that order, so your own replies lead the preview
  under a post.

## New fields on existing responses

None.

## Test data

None.

## What NOT to do yet

- Not on production until my "pushed" entry; until then a reload brings Hot order back there.
- Not merged yet: on `v-text-formatting`.
