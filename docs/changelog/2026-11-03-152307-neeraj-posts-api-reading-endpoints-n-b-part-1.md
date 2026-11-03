---
date: 2026-11-03T15:23:07+05:30
author: neeraj
phase: "7"
block: "N-B"
for: vishwajeet
title: "Posts API: reading endpoints (N-B part 1)"
---

# Posts API: reading endpoints (N-B part 1)

The whole posts module, built to `backend/API.md`, "posts module (Phase 7)": the eight reading
routes (part 1) and posting, deleting and reacting (part 2, below). You can build the app's
community from that section as written. The only `API.md` edits are two clarifications to
`POST /api/posts`, listed under part 2.

Files: `backend/src/modules/posts/posts.routes.js` and `posts.controller.js`, on loan to me
(your entry "Ownership loan: posts module to Neeraj for Phase 7"). Your `OWNER:` banners are
unchanged; each file has a line under them pointing at the loan.

**How they work:**

- Every route uses `requireAuth`. The viewer is `req.user.id`, never a query parameter.
- Each route calls your SQL functions and passes the answer through. Nothing re-checks scope,
  campus, country or the demo world in JavaScript.
- Lists are `{ items, next_cursor }`. `next_cursor` is `encodeCursor(value, id)` of the **last**
  item when the page is full, otherwise `null`. It uses `hot_score|id` for `sort=hot` and
  `created_at|id` everywhere else. A cursor that doesn't decode answers `400 INVALID_FORMAT`.
- `hot_score` is removed from every item, including `GET /:id`'s `post`.
- `GET /:id` asks `post_visibility` first. `under_review` answers exactly
  `{ "error": "POST_UNDER_REVIEW" }` and nothing about the post.

## Migrations applied

None. No SQL was written; every function the contract names already existed with the right shape.

## New endpoints

### Part 1 — reading

All under `/api/posts`, all requiring the token, in the order they are registered:

| Route | SQL | Answer |
|---|---|---|
| `GET /countries` | `countries_for_viewer` | `{ items: [{ code, name, is_mine }], next_cursor: null }`: yours first, then by name (`Intl.DisplayNames`) |
| `GET /feed/campus/new-count?since=` | `count_new_campus_posts` | `{ count }`; a `since` that doesn't parse → 400 |
| `GET /feed/campus?limit&cursor` | `get_campus_feed` | page, newest first |
| `GET /feed/country/:code?sort&limit&cursor` | `get_country_feed` + `can_post_in_feed(…, 'country', code)` | page + `can_post`; code is uppercased, then must match `^[A-Z]{2}$` |
| `GET /feed/global?sort&limit&cursor` | `get_global_feed` + `can_post_in_feed(…, 'global', null)` | page + `can_post` |
| `GET /by-user/:userId?limit&cursor` | `get_user_posts` | page, newest first |
| `GET /:id/replies?limit&cursor` | `get_post_replies` | page, ⚠️ **oldest first** |
| `GET /:id` | `post_visibility` → `get_post_item` + `can_reply_to_post` | `{ post, can_reply }`, or 403 `POST_UNDER_REVIEW`, 404 `POST_NOT_FOUND`, 410 `POST_DELETED` / `POST_REMOVED` |

`sort` is `hot` (the default) or `new`; anything else → 400. `limit` defaults to 20, at most 50.

**Two small details the contract leaves open:**

- `GET /feed/campus/new-count`: `since` is read with `new Date(...)` and sent to the database as a
  normalised ISO string. Loose text that `Date.parse` accepts (`foo 1`) would otherwise fail the
  `timestamptz` cast and answer 500 instead of 400.
- `GET /:id`: if the post disappears between `post_visibility` and `get_post_item` (deleted in
  that instant), the answer is `404 POST_NOT_FOUND`.

### Part 2 — posting, deleting and reacting (added the same day)

Registered after the reading routes, so the final order is the eight above, then
`POST /`, `PUT /:id/reaction`, `DELETE /:id/reaction`, `DELETE /:id`.

**`POST /api/posts`** (multipart/form-data; `content`, `scope`, `parent_post_id`, `gif` as a JSON
string, `images` × 3, `confirm=true`):

| Status | Body | When |
|---|---|---|
| 201 | `{ post }` | published |
| 202 | `{ post, held: true, support }` | held, or not checked yet. `support` is true only for a **checked** self-harm hold |
| 400 | `CONTENT_TOO_LONG` `{ max: 1000 }` | over 1,000 code points after trimming |
| 400 | `EMPTY_POST` | no text, photo or GIF |
| 400 | `TOO_MANY_IMAGES` `{ max: 3 }` | a 4th photo |
| 400 | `MEDIA_CONFLICT` | photos with a GIF, or photos on a reply |
| 400 | `INVALID_GIF` | not `{ provider: 'klipy', id, https url, optional https preview_url, positive integer width and height }` |
| 400 | `FILE_TOO_LARGE` | a photo over 5 MB |
| 400 | `INVALID_FILE_TYPE` | declared type not JPEG/PNG/WebP, or `isReadablePhoto` says it doesn't read all the way through |
| 400 | `INVALID_FORMAT` | bad `scope` or `parent_post_id`, `content` not a single text field, a file under another field name |
| 400 | `NESTED_REPLY_NOT_ALLOWED` | replying to a reply (your trigger) |
| 401 | `UNAUTHORIZED` | no or bad token |
| 403 | `NOT_ALLOWED_HERE` | replying in a feed you can only view (your trigger) |
| 404 | `POST_NOT_FOUND` | the parent is missing, deleted or not active (your trigger) |
| 422 | `MODERATION_NUDGE` `{ categories }` | nothing saved or uploaded; re-send with `confirm=true` |
| 429 | `RATE_LIMIT_POSTS` / `RATE_LIMIT_REPLIES` | your trigger's limits |

The order is runbook §1.10's: multer (count, size, declared type) → fields → length, empty,
media → `isReadablePhoto` on every photo → `checkContent` → upload to `posts` with
`<random uuid>.<jpg|png|webp>` names → insert → on an insert error, delete the uploads first, then
`mapDbError`. What each outcome saves is exactly the table under `POST /api/posts` in `API.md`:
`checked: false` is `pending` with `moderation_checked_at` left empty, whatever the outcome says.
Nothing counts posts or checks limits in JavaScript.

**`DELETE /api/posts/:id`:** 200 `{ id, deleted: true }` (twice is fine) · 400 `INVALID_FORMAT` ·
401 · 403 `FORBIDDEN` (not your post) · 404 `POST_NOT_FOUND`. It sets `deleted_at` and leaves the
photos for your 90-day job.

**`PUT /api/posts/:id/reaction`** `{ emoji }`: 200 `{ post_id, viewer_reaction, reactions_total,
reaction_counts }` · 400 `INVALID_EMOJI` (`isSingleEmoji`) · 400 `INVALID_FORMAT` · 401 · 404
`POST_NOT_FOUND` (from `react_to_post`). **`DELETE /api/posts/:id/reaction`:** the same answer with
`viewer_reaction: null`; no `INVALID_EMOJI`.

**Your attention, please:**

- **Logging.** Post text and photos are never logged. When the insert fails, only the error's
  `code` and `message` go to `mapDbError`. A check violation's `details` holds the failing row,
  text included, and `mapDbError` logs whatever it can't map.
- **`API.md`** got two clarifications: the GIF's width and height are positive integers, only its
  six keys are stored, and the two extra `INVALID_FORMAT` cases above.
- **`npm install` in `backend/`** was needed on my machine for `sharp` (as your V-A entry said). The
  lockfile didn't change.

## Changed endpoints (BREAKING)

None. `/api/posts` had no routes before.

## New fields on existing responses

None.

## Test data

None. The routes read your seed's posts (`supabase db reset`).

## What NOT to do yet

- Not merged yet: one backend PR from `n-b-posts-api` after part 2, for your review (day 7).

## Note: the runbook's curl helper on a Mac (zsh)

Checkpoint N-B passed (all 10 checks). Two things broke in zsh, not in the API:

1. Comments: run `setopt interactivecomments` first, or zsh fails on the `# …` lines.
2. The `post()` helper's `${4:+-F "parent_post_id=$4"}` isn't split in zsh, so a reply
   is sent as a new post. Use this version instead:

    post() {
      if [ -n "$4" ]; then
        curl -s -X POST "$API/posts" -H "Authorization: Bearer $1" \
          -F "scope=$2" -F "content=$3" -F "parent_post_id=$4"
      else
        curl -s -X POST "$API/posts" -H "Authorization: Bearer $1" \
          -F "scope=$2" -F "content=$3"
      fi
    }

3. Text with `!` needs single quotes in zsh ('Smart India Hackathon!').
