---
date: 2026-11-18T16:37:12+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "App: the new-posts pill without the flicker; a slimmer view-only strip; less space after the last post"
---

# App: the new-posts pill without the flicker; a slimmer view-only strip; less space after the last post

The owner's round of 18 Nov, app only, on `v-d-app-community`. `COMMUNITY_SPEC.md` is now **v3.16**. The
app's `tsc` passes. Nothing was checked on the phone. **Nothing for you to do; no `frontend/` file was
touched.**

- **Tapping `N new posts` no longer flickers** (§8). The feed glides to the top first, and the new posts go in
  only once it's there. They fade in at the top and the rest move down under them.
  - The cause: FlashList kept the old first post still when posts arrived above it. That drew the new post
    off screen and corrected a frame late, and the old code then glided up and finished with jumps.
  - That position-keeping is now off within 48 of the top, where there's nothing above to keep still.
- **The view-only line's strip is 28 tall** (was 40); the text size is unchanged (§1.4).
- **The last post ends 10 above the Post button** (was 22), and above the Reply button on a post's page
  (§2.1): `LIST_END_GAP` in `PostFab.tsx`. Your feed has a dock rather than a floating button, so this
  doesn't apply to the website.
- The owner considered putting the pill on country and Global feeds too, and decided against it. It stays
  campus only.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

None. (A local test post in India, `new-count check (Claude, local)`, was deleted straight away.)

## What NOT to do yet

- Not merged yet: uncommitted on `v-d-app-community`.
