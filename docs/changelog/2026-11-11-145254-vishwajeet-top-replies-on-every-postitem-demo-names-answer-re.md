---
date: 2026-11-11T14:52:54+05:30
author: vishwajeet
phase: "7"
block: "V-C"
for: neeraj
title: "top_replies; replies by Hot; what you reported stays hidden; demo. names answer RESERVED"
---

# top_replies; replies by Hot; what you reported stays hidden; demo. names answer RESERVED

The last pieces of Block V-C, on branch `v-c-messages-reactions`. Three decisions of 11 Nov
(Vishwajeet): replies are ranked by Hot, in the preview **and** the whole thread; a post you reported
stays hidden from you (your N-D question); and I fix `user/` myself instead of asking you.

**⚠ I edited two files that are yours right now.** Please look at both in the PR:

1. **`backend/src/modules/user/user.controller.js`** (your module):
   - `classifyUnavailableUsername(username, viewerId, universityId)` gained a third argument. After
     the three lookups it asks `username_breaks_world_rule()` and answers `'RESERVED'` when that's true.
     The rule isn't written in JavaScript.
   - `GET /api/users/username-available` finds the viewer's campus once and gives it to both the
     classifier and `fetchSuggestions`.
   - `PATCH /api/users/me/username` reads `university_id` with the current username and passes it on.
2. **`backend/src/modules/posts/posts.controller.js`** (on loan to you): only `getPostReplies`. It
   now sends `p_sort: 'hot'` with a number cursor (`hot_score|id`), like the Hot feeds, and builds
   `next_cursor` from `hot_score`. `readTimePageParams` is unchanged; the campus feed and `/by-user`
   still use it. Nothing else in the file changed; `toPostItem` already passes `top_replies` on.

## Migrations applied

- `20261111092200_feed_top_replies.sql`: **on production** (Vishwajeet pushed it, 11 Nov). Every
  PostItem gains `top_replies`; new internal `post_top_replies()`; `post_items_by_ids()` fills it.
- `20261111095654_reply_hot_order_hide_reported.sql`: **local only so far.** Production push and
  backend deploy to come, in that order; I'll say so in a new entry.
  - Replies get a Hot score, `(likes + 1) ÷ (hours + 2)^1.5`: at birth (new trigger
    `trg_score_new_reply`), every 5 minutes for 7 days (`refresh_hot_scores()`), and once for every
    existing active reply.
  - `get_post_replies()` takes `p_sort` (`'hot'` or `'oldest'`) and `p_cursor_score`. `'oldest'` is
    the default only so the backend already deployed keeps working until the new one is.
  - `top_replies` is the first 2 of that Hot thread.
  - The three feeds, `get_user_posts`, the thread, the preview and `count_new_campus_posts` skip
    posts and replies the viewer reported.

Checked locally, after `supabase db reset`, through the API: `top_replies` matches the first page
of `/replies`, paging by `next_cursor` one at a time ends correctly, a bad cursor is `400`, a new
reply starts at the birth score, the old call shape still answers oldest first, and a reported post
leaves only the reporter's feed (the author still sees it, and it stays `active`).

## New endpoints

None.

## Changed endpoints (BREAKING)

- **`GET /api/posts/:id/replies` is in Hot order, not oldest first.** A cursor from the old order
  answers `400 INVALID_FORMAT`; start again without one. Scores refresh every 5 minutes, so a
  reply can move between pages: keep de-duplicating by `id` (your `distinct()` already does). The
  website's comments that say "oldest first" (`PostThread.jsx` line 24 and its spec note) are now
  out of date.
- `GET /api/users/username-available`: `reason: "RESERVED"` (was `"INVALID_FORMAT"`) for a name
  that breaks the `demo.` rule: `demo.x`, `demo-x`, `demo_x` for a real student or a signed-out
  caller, a name without `demo.` for a demo account. Your website already shows `RESERVED` with
  the same sentence as `TAKEN`.
- `PATCH /api/users/me/username`: `USERNAME_RESERVED` (was `INVALID_FORMAT`) in the same cases.
- **What you reported is left out** of the feeds, `/by-user`, `/:id/replies`, `top_replies` and
  `/feed/campus/new-count`. `GET /api/posts/:id` still opens it by direct link. Your website's
  "hide it straight away" can stay as it is.

## New fields on existing responses

- **Every PostItem: `top_replies`.** The first 2 replies of `GET /api/posts/:id/replies`. `[]` when
  none, and always `[]` on a reply. On the three feeds, `GET /:id`, `/:id/replies` and
  `/by-user/:userId`. `backend/API.md`, "The PostItem". `PostThread.jsx` already reads it.

## Test data

None new. `seedDemo.js`'s 18 replies give the demo feeds top replies to look at.

## What NOT to do yet

- Don't count on Hot replies or the reported-post hiding on production until my "pushed" entry.
- `COMMUNITY_SPEC.md` §4 and the report section now say Hot order and "stays gone"; `backend/API.md`
  has the contract.
