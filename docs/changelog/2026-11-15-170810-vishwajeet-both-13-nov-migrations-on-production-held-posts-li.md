---
date: 2026-11-15T17:08:10+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "Both 13 Nov migrations on production; held posts light up; status colours; Try again after; app dialogs and emoji panel"
---

# Both 13 Nov migrations on production; held posts light up; status colours; Try again after; app dialogs and emoji panel

This is the owner's third round on the app (15 Nov), on branch `v-d-app-community`. As before, I changed
the website only where it had the same problem. `COMMUNITY_SPEC.md` is now **v3.12**, and its change note
at the top lists everything. `npx vite build` and the app's `tsc` pass. Nothing was checked in a browser
or on the phone.

**⚠ I edited your `frontend/` at the owner's request.** Six files; please look at them when you review:

1. **Holding React on a touch screen lights the post up**, as WhatsApp does for a held message. The tint
   stays until the quick bar closes. A tap, a click or hover doesn't light it.
   - `ReactionBar.jsx` has a new `onHeldChange(held)` prop. It's true while a bar opened by the 450 ms
     long-press is showing.
   - `PostCard.jsx` keeps that in `held` and adds `.postHeld`.
   - `.postHeld` in `PostCard.module.css` is an inset shadow tinted 14% in `--zone-accent`, through
     `color-mix()`. It goes over the card's ground and under its content, with no new positioning.
     `.post`'s existing `box-shadow` transition fades it in and out.
2. **Status labels say their state by colour:** `Being checked` is amber (waiting) and `Under review` is
   orange (needs attention).
   - The colours are `--status-pending-*` (changed from the 13 Nov blue) and the new `--status-review-*`,
     in `global.css`.
   - The new `.statusReview` is in `PostCard.module.css`.
   - In `PostCard.jsx`, `STATUS_CLASSES` maps each status to its class.
   - Text is about 6:1 on its tint. `frontend/DESIGN.md` has a new short section, "Colour says the state",
     with the rule for future labels.
3. **The posting limit says "after":** `rateLimitText()` in `utils/community.js` now writes
   `…Try again after 6:19 pm (in 26 minutes).`, and `Try again after a minute.` under two minutes.

## Migrations applied

- **Production:** the owner pushed both of 13 Nov's migrations today, `20261113122231_post_rate_limit_retry_at`
  and `20261113125126_own_replies_first`. All 30 migrations are now on production.
  - **Your own replies come first after a reload, on production now.** That one needed no backend change.
  - **`next_allowed_at` is not on production yet.** The database has the retry time, but the backend
    change that sends it (`respond.js` / `posts.controller.js`, commit `7e9f48c`) is on this branch.
    Render still runs the version before it. Until this branch is merged and deployed, both clients show
    the old "Please try again in a little while".
- **No new migrations in this entry.**

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

None.

## What NOT to do yet

- Not merged yet: on `v-d-app-community`. My three 13 Nov entries said `v-text-formatting`. That was
  wrong, so I corrected them; the work has only ever been on `v-d-app-community`.

## What to check in the browser (390 wide, touch emulation on)

1. Hold React on a post for half a second. The quick bar should open, and the whole card should take a
   light purple tint on Campus and a pink one in a country or Global. Choose an emoji, or tap outside: the
   tint should fade away. A plain tap on React should open the bar with no tint.
2. On your own Posts tab, a held post's `Being checked` should be amber, and a reported one's
   `Under review` orange.

## The app, same round (nothing for you to do)

- **☺ in the compose screen opens an emoji panel in the keyboard's place**, as in WhatsApp. It used to be
  a sheet over a dimmed screen.
  - The panel is the keyboard's height, so the toolbar doesn't move, and the text stays bright.
  - ☺ turns into a keyboard key. That key, or a tap on the text or the space under it, brings the
    keyboard back, and the panel closes once the keyboard is up.
  - Back closes the panel first.
  - The panel is `EmojiPanel` (rn-emoji-keyboard's inline `EmojiKeyboard`). Reactions keep the sheet.
- **Holding a post lights it up** while the quick bar is open: a band in the zone's tint across the
  screen, with a medium haptic.
- **One size for every dialog** (Relist, Delete listing, Remove purchase, Delete post, `Post this?`):
  - the `Post this?` size: words 26 in from the card's edges, so its message runs to three lines;
  - buttons only as wide as their words, 36 tall, centred.
  - The `compact` option is gone. The chat's delete dialog keeps its WhatsApp layout.
- The same status colours and the same "Try again after" wording.
- `docs/CURRENT_STATE.md` is brought up to 15 Nov: 30 migrations, and Phase 7's blocks and what
  production runs.
