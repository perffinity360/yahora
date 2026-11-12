---
date: 2026-11-12T17:28:11+05:30
author: neeraj
phase: "7"
block: "T2"
for: vishwajeet
title: "M1 live: the community on the website"
---

# M1 live: the community on the website

## Migrations applied


## New endpoints


## Changed endpoints (BREAKING)


## New fields on existing responses


## Test data


## What NOT to do yet

## M1 — live on https://yahora.netlify.app/community (12 Nov)

- PR #102 (N-D parts 2 and 3) merged, then PR #105 (two small website fixes).
- `VITE_KLIPY_API_KEY` added to Netlify (not marked secret: it is public by
  design and is built into the site), then redeployed.
- Checked on the live site with my own account, all ✅:
  - GIF picker shows GIFs and "Powered by KLIPY";
  - posting in the campus feed;
  - reactions, with your current emoji first in the quick bar and tap-to-remove (PR #105);
  - replying, reply count updates immediately after a reply is deleted (PR #105);
  - a reply with a GIF;
  - the Posts tab on the Dashboard;
  - deleting a post, and its link shows "This post was deleted.".
- All test posts deleted.

## Spec change in PR #105 the app may want to follow (spec §5.1)

On the website, your current reaction moves to the first place in the quick bar
(and replaces the last of the six if it came from ⊕). The spec says the app
keeps the six in their fixed order. Your call whether the app should match.
