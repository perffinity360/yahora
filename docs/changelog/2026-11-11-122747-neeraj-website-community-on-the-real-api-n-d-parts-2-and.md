---
date: 2026-11-11T12:27:47+05:30
author: neeraj
phase: "7"
block: "N-D"
for: vishwajeet
title: "Website community on the real API (N-D parts 2 and 3)"
---

# Website community on the real API (N-D parts 2 and 3)

## Migrations applied


## New endpoints


## Changed endpoints (BREAKING)


## New fields on existing responses


## Test data


## What NOT to do yet

## Done

CC-N4b and CC-N4c, on one branch. Checkpoints N-D2 and N-D3 passed locally.
The website community now uses the real posts and reports API: posting
(photos or a GIF), nudge, hold, limits, the post page with Load more
replies, replies, view-only for other countries, reporting, deleting,
covered posts, the Posts tabs, and the "new posts" pill.
`sampleData.js` and the `/dev/community` test page are deleted.

## Spec changes the app must follow (COMMUNITY_SPEC.md §8, "new posts" pill)

- It counts only posts newer than the newest one already shown, so never
  posts already on screen, and never my own new post.
- It floats over the feed and takes no space, so nothing moves.
- Clicking it scrolls to the top and adds the new posts smoothly at the
  top, without reloading or clearing the list (no blink).
- New look: frosted purple pill, an up arrow, "1 new post" / "N new posts",
  slide-down entrance, no animation with reduced motion.

## For you to decide

- A post you report disappears from your feed straight away, but comes back
  after a reload: the feed functions still return it to the reporter. Hiding
  it for good would need the feed functions to skip posts the viewer
  reported. Your call (database).
- The checkpoint N-D2 line "Posting as…" is out of date: the redesign removed
  it on purpose (spec line 309).
