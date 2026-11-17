---
date: 2026-11-15T23:25:38+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "GIFs in their own shape everywhere, at the app's sizes; reply box as wide as the card; Post this? in three lines; N-C cover re-checked"
---

# GIFs in their own shape everywhere, at the app's sizes; reply box as wide as the card; Post this? in three lines; N-C cover re-checked

This is the owner's third round on 15 Nov, on `v-d-app-community`. `COMMUNITY_SPEC.md` is now **v3.14**, and
its change note lists everything. `npx vite build` and the app's `tsc` pass. Nothing was checked in a
browser or on the phone; the API check at the end was run for real.

**⚠ I edited your `frontend/` again, at the owner's request** ("reflect the same in the website"). Nine
files:

1. **GIFs at the app's sizes:** at most 240 × 300 on a post and 160 × 200 on a reply, always in their
   own shape. The change is `.gif` and `.replyGif .gif` in `PostCard.module.css`. This replaces my
   earlier note that asked you to check the sizes.
2. **The GIF picker is a masonry:** `GifPicker.jsx` and its CSS.
   - It's still 3 columns, but each tile now has its GIF's own `aspect-ratio`, from KLIPY's width ×
     height, inline. Before, every tile was a cropped square.
   - Each GIF goes to the shortest column (`masonry()`), so the next page never moves the ones above.
     The sentinel and infinite scroll are unchanged.
3. **The composer's GIF preview is the GIF's own shape**, 88 tall and at most 200 wide, with no crop.
   This is `.gifPreview` in `Composer.module.css`; before, it was a cropped 88 square.
4. **A post page's reply box is as wide as the post card**, where it used to take the whole window.
   - In `PostDetail.jsx` the dock gets `pageStyles.dock`, which is in `PostDetail.module.css`: 10 px in
     from each side and at most 860 + 20 px, centred.
   - The feed's dock is unchanged.
5. **`Post this?` has new words, and stays within three lines:**
   - `Composer.jsx`: `Some of this might come across as hurtful to other students. Consider revising it
     to keep the content respectful.`
   - I measured it with Inter's real widths. At 14 px it needs about 280 px of line to stay in three
     lines. Your dialog gives it 290 at 390 wide, but only 260 at 360, where it would take four lines.
   - So `ConfirmDialog.module.css` now pads `.scrim` 16 px instead of 28 under 380 px. This affects
     every dialog on a narrow phone, which just gets a slightly wider card.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

- **Local only:** one covered post by `sneha.gupta` in the India feed, `Cover test 15 Nov (Claude, N-C
  check)`, id `3b62cfcf-2257-437b-bfff-0ce36ce93375`. It's left there so the owner can see the label on
  the phone. Delete it as Sneha whenever you like, or run `supabase db reset`.

## The N-C cover check, run again (15 Nov, local API, the runbook's own steps)

Sneha posted in India, and Arjun, Priya and Rahul each reported it as `violence`:

| Check | Result |
|---|---|
| Each of the three reports | `{"reported":true}` |
| Karan opens it | `{"error":"POST_UNDER_REVIEW"}` |
| Sneha opens it | `"moderation_status":"under_review"` |
| Arjun's India, Global and Campus feeds | not there (0 in each) |
| Sneha's own Posts (`/posts/by-user/:id`, as Sneha) | there, `under_review`, so it shows `Under review` |
| Sneha's profile, as Arjun | not there |

## What NOT to do yet

- Not merged yet: on `v-d-app-community`.

## What to check in the browser (1440 and 390 wide, and 360 for the dialog)

1. Open the GIF picker. Tall, wide and square GIFs should each keep their shape, in three uneven
   columns. Scroll to load more: the ones above shouldn't move.
2. Choose a tall GIF. The preview should be 88 tall and narrow, not a square.
3. Post it. It should be at most 300 tall in the feed; a reply's GIF should be visibly smaller.
4. Open a post's page at 1440. The reply box's edges should line up with the post card's.
5. At 360 wide, trigger `Post this?`. The message should take exactly three lines.

## The app, same round (nothing for you to do)

- **GIFs in their own shape everywhere:**
  - the picker is a 2-column masonry (FlashList `masonry`);
  - the compose preview is its own shape, at most 200 × 240;
  - posts and replies were already in their own shape.
- **The post page has the feed's floating button,** reading `✏️ Reply`, in place of the reply bar. It
  folds while you scroll down (`useFabFold`). `ComposerDock` is deleted.
- **The view-only line** (another country's feed) **slides away while you scroll down** and comes back on
  the way up.
- **After the new-posts pill (or your own post) the feed really reaches the top.** FlashList's position
  corrections could cut the glide short. It now checks after the glide and finishes the way, up to five
  times, stopping if a finger touches the list.
- **`Post this?`**: the dialog is 320 wide, so the message fits three lines, and on a narrower phone it
  shrinks a little to stay in three.
- **The compose line** now reads `Make this a place where everyone feels welcome. Be kind and
  respectful.`, on one line on every phone (it shrinks to about 10.5 on a 393-wide phone).
