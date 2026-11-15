---
date: 2026-11-16T00:08:45+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "Product-card heart on hover; one-line composer placeholders; no GIF tag; bigger GIFs on a laptop; quieter view-only line"
---

# Product-card heart on hover; one-line composer placeholders; no GIF tag; bigger GIFs on a laptop; quieter view-only line

This is the owner's round of 16 Nov, on `v-d-app-community`. `COMMUNITY_SPEC.md` is now **v3.15**.
`npx vite build` and the app's `tsc` pass.

**What I checked in a browser** (the local site, signed in as `priya.nair`):

- The composer placeholder at 360 and 390 wide, before and after focusing.
- The product-card heart at desktop width, at rest and on hover.

Nothing else was checked in a browser, and nothing on the phone.

**⚠ I edited your `frontend/` at the owner's request.** Eleven files:

1. **The heart on a product card's photo shows only while the card is pointed at**, with a mouse, or
   while it has keyboard focus. Every product card has it: Marketplace, Home, the dashboards, profiles,
   and Sell's preview.
   - This is `@media (hover: hover) and (pointer: fine)` in `ProductCard.module.css`, with
     `.card:hover .overlayHeart` and `.overlayHeart:focus-visible`.
   - The heart and count under the photo still show whether you've liked it.
   - **Touch screens keep the photo's heart in view**, since they can't hover.
   - Checked: at desktop width every heart was at opacity 0, and the hovered card's was 1.
   - The rule is in `frontend/DESIGN.md`, "Hover-only controls".
2. **The composer placeholders never wrap.**
   - **Why it wrapped:** on a phone the text box is 222 px at 390 wide and 192 at 360. "What's
     happening on campus?" is 204 px in Inter 14, and tapping the box adds the emoji button (36 px).
     So it went to two lines and the field jumped.
   - **New words in `Composer.jsx`:** `Post to your campus` (136 px), `Post to {country}` and
     `Post to everyone`. They match the Post button. A reply's is unchanged.
   - `.textarea:placeholder-shown` now keeps an empty box's placeholder on one line, ending in "…", so a
     long country or username can't wrap it either. Typed text wraps as before.
   - Checked at 360 wide: one line (28 px), focused or not.
   - The app's full-screen compose screen keeps the longer words. The spec's table lists both.
3. **No GIF tag**, on a posted GIF or the composer's preview. That's `PostGif.jsx`, `Composer.jsx`,
   both `.gifBadge` rules, and `--gif-tag-*` in `global.css`.
4. **GIFs a fifth bigger at 1024 px and wider:** 288 × 360 on a post and 192 × 240 on a reply. Below
   1024 they stay 240 × 300 and 160 × 200. It's a media query in `PostCard.module.css`.
5. **The view-only line drops `You can still react and report.`** (`CommunityFeed.jsx`).

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

- Local only: I posted `pill check (Claude, local)` as `arjun.mehta` to check the new-posts count, then
  deleted it. Sneha's covered `Cover test 15 Nov` post from my last entry is still there.

## What NOT to do yet

- Not merged yet: on `v-d-app-community`.

## What to check in the browser

1. On a laptop, point at product cards: the heart on the photo should fade in and out. On a phone, the
   hearts should stay visible.
2. On a phone, open the India and Global feeds and check that the placeholder stays on one line.
3. At 1440, check GIFs look a little bigger than before and that a reply's GIF is still the smaller one.

## The app, same round (nothing for you to do)

- **Posts that arrive above the first one while you're at the top** (from a pull to refresh, or a
  refetch the app did by itself) **now take the feed to the top**, so the new post is whole. FlashList
  had kept the old first post in place, which left the new one half under the switcher.
- No GIF tag.
- The compose line has its hand-and-heart back.
- **The view-only line is quieter:** the smallest text size, a slim strip, no "react and report", and a
  soft fade as you scroll.
