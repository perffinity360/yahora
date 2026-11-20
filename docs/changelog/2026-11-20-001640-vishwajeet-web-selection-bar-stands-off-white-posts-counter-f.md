---
date: 2026-11-20T00:16:40+05:30
author: vishwajeet
phase: "7"
block: "TF"
for: neeraj
title: "Web selection bar stands off white posts; counter first among the composer's tools; app's Aa swaps the phone's menu for ours"
---

# Web selection bar stands off white posts; counter first among the composer's tools; app's Aa swaps the phone's menu for ours

The owner's round of 20 Nov, on `v-d-app-community`. `TEXT_FORMAT_SPEC.md` is now **2.1** and
`COMMUNITY_SPEC.md` **3.17**; each opens with a change note. `npx vite build`, the app's `tsc` and
`scripts/check-format-selection.mjs` (22 cases) pass. **Nothing was checked in a browser or on the phone.**

**⚠ I edited your `frontend/` at the owner's request.** Three files, all small:

1. **`components/FormatBar/FormatBar.module.css`: the selection bar now has a shadow.** It was white on a
   white post, with nothing to tell them apart.
   - **The cause was a bug, not a missing style.** Its `box-shadow` began with `var(--quick-bar-ring)`,
     but that token is a colour (`rgba(128,0,128,0.16)`), not a shadow. That made the whole declaration
     invalid, so the browser dropped it and the bar had no shadow at all.
   - It now uses the community quick bar's look: `var(--quick-bar-raised-shadow), 0 0 0 1px
     var(--quick-bar-ring)`, a hairline purple ring and a soft two-layer lift. No border, so the size and
     placing are unchanged. The chat's bar is the same component, so it gets this too.
2. **`components/community/Composer/Composer.jsx` and `.module.css`: the ring counter comes first among the
   tools**, to the left of Add photos (and of GIF in a reply).
   - It is in its own copy of the `extras` slide-in wrapper (`inert` while closed), so it still opens and
     closes with the tools and a closed composer shows no ring.
   - `.counterSlot`'s margins are flipped (`0 6px 0 4px`): 4 px for its shake on the left, 6 px before
     Add photos.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

None.

## What NOT to do yet

- Not merged yet: on `v-d-app-community`, uncommitted.

## What to check in the browser (1440 and 390 wide)

1. Select a word in the composer over a white post. The bar should have a thin purple ring and a soft
   shadow, and clearly stand off the post. Do the same in the chat box.
2. Click into the post composer. The ring should slide in first, left of Add photos, then GIF and ☺.
   Close the composer: no ring. Open a reply box: the ring comes before GIF.
3. Paste 1,050 characters. The counter should shake without being clipped on either side.

## The app, same round (nothing for you to do)

The text-formatting loan ended when `v-text-formatting` merged (PR #110, 19 Nov), as your 17 Nov entry
set out. **So these are mine again, and this entry records the handback.** I changed
`mobile/app/chat/[contactId].tsx` (the chat box) and comments in `mobile/src/components/FormatToolbar.tsx`.

- **Aa now swaps the phone's Cut / Copy / Paste menu for our bar.** Before, both showed at once.
  - Aa closes the phone's menu by collapsing the selection for a moment, then selecting exactly the same
    characters again 60 ms later. Expo Go can't call Android's own "hide the menu".
  - The box keeps its focus throughout, so the keyboard and the selection stay.
  - The buttons act on the selection taken before any of this, so formatting lands on the right text.
  - `contextMenuHidden` keeps the phone's menu shut while our bar is open.
- **Our bar is just above the box,** floating over the newest messages, where the phone's menu was. The
  56 px it used to add below the composer is gone.
- **Back to the phone's menu:** tap Aa again, or long-press the text (that closes our bar too).
