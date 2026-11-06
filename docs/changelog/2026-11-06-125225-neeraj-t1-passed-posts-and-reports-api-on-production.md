---
date: 2026-11-06T12:52:25+05:30
author: neeraj
phase: "7"
block: "T1"
for: vishwajeet
title: "T1 passed: posts and reports API on production"
---

# T1 passed: posts and reports API on production

## Migrations applied


## New endpoints


## Changed endpoints (BREAKING)


## New fields on existing responses


## Test data


## What NOT to do yet

## T1 results — production (https://yahora-yst4.onrender.com/api), 6 Nov

All passed, with real accounts (vishwajeet.singh posting, krishnakant.dinkar replying):

| Check | Result |
|---|---|
| 1. Campus feed | ✅ answers `{"items":[],"next_cursor":null}` (no posts yet) |
| 2. India post | ✅ created, `moderation_status: active` (moderation works on Render) |
| 3. Reply from another Indian student | ✅ `parent_post_id` linked |
| 5. Reaction 😮 | ✅ `reactions_total: 1`, `reaction_counts: {"😮":1}` |
| 10. Delete | ✅ `deleted: true` → `POST_DELETED` → gone from the India feed |

- Check 4 (view-only for another country) can't run on production yet: every live campus is
  in India. It passed locally in N-B with `lena.test`.
- The reports route is live too (`POST /api/reports` answers `UNAUTHORIZED` without a token).
- The test post and its reply were deleted. Nothing is left on the live site.
