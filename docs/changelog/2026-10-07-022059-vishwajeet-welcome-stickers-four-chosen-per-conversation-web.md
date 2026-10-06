---
date: 2026-10-07T02:20:59+05:30
author: vishwajeet
phase: "6A"
block: "V-C"
for: neeraj
title: "Welcome stickers: four, chosen per conversation (web + mobile)"
---

# Welcome stickers: four, chosen per conversation (web + mobile)

**This replaces the single "Mishti" sticker** from `2026-10-04-192039`. An empty chat now
shows one of four animated "Hi" stickers. Telegram-style, but the pick comes from the
conversation rather than being random on each open:

- The same chat always shows the same sticker.
- Both people in it see the same one.
- The phone and the website always agree.

The four were chosen from a preview of twelve: **Bear, Kawaii blob, Birdie, Blue rabbit.**
They're from LottieFiles, under the Lottie Simple License: free for commercial use,
modification allowed, no attribution required. Creators and links are in
`docs/design/assets/welcome-sticker/lottie/SOURCES.md`.

## ⚠️ I edited files in your scope, `frontend/`

The owner asked for this on both platforms in my session. Please review.

- **New** `frontend/src/utils/stickers.js`: the sticker list and the per-chat pick. It's
  the twin of `mobile/src/lib/stickers.ts`, with the same ids, the same order and the
  same hash.
- `frontend/src/pages/messages/Messages.jsx`:
  - The two `STICKER_*` constants are gone.
  - A `welcomeSticker` memo is keyed on the current user, `contact_id` and `product_id`.
  - The empty-chat `<picture>` reads from it.
- `frontend/public/stickers/`: `welcome-sticker*.webp` removed, and `{bear,blob,birdie,
  rabbit}.webp` plus `-still.webp` added. The still frames are used under
  `prefers-reduced-motion`.

`npm run build` passes. I haven't seen it in a browser.

## How the pick works (identical on both platforms)

- `key = sort([userId, contactId]).join(":") + ":" + productId`, then 32-bit FNV-1a,
  modulo 4, into `["bear", "blob", "birdie", "rabbit"]`. If any id is missing, it shows
  `bear`.
- **Checked** on 2,000 random conversations: phone and web always pick the same
  sticker, swapping the two users never changes it, and each sticker comes up about a
  quarter of the time.
- **To add or remove a sticker,** change the list in both files in the same commit. Note
  that changing the list reshuffles which chat shows which sticker.

## The sticker sources (`docs/design/assets/welcome-sticker/`)

- `lottie/<id>.json` are the LottieFiles animations. The bear was edited: its full-frame
  white background and a stray "GN" text layer were removed, which is why a white square
  showed behind it.
- `drawn/` holds Bagsy and Mishti, kept but not shipped.
- `build_stickers.py` renders any of them to `out/<id>.webp` plus a still frame (360 px,
  20 fps). It needs Chrome only.
- Ship the chosen ones by copying from `out/` to `mobile/assets/stickers/` and
  `frontend/public/stickers/`. Never edit a .webp by hand.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

Open several brand-new chats. Different chats should show different stickers, and
reopening one shows the same sticker again. The person on the other side, and the same
chat on the phone, should show the same one.

## What NOT to do yet

- Don't pick the sticker with `Math.random()` on web. It has to match the phone.
- The other eight candidates aren't shipped. Their sources stay in `lottie/` in case we
  want to add more later.
