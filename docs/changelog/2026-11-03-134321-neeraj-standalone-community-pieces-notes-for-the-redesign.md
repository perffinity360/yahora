---
date: 2026-11-03T13:43:21+05:30
author: neeraj
phase: "7"
block: "N-S"
for: vishwajeet
title: "Standalone community pieces + notes for the redesign (N-S)"
---

# Standalone community pieces + notes for the redesign (N-S)

Merged in PR #94. Checkpoint N-S passed (all 6 checks).

## What was built (website only)

- **Composer** (`components/community/Composer/`, logic in `hooks/useComposer.js`):
  "Posting as", counter, 3 photos or 1 GIF, destination chip, reply mode, every result of
  spec §2.3 (nudge dialog, held toast, support card, limit message, network toast).
- **GIF picker** (`components/community/GifPicker/`, logic in `hooks/useGifSearch.js`,
  every KLIPY call in `utils/klipy.js`): trending, search, load more, "Powered by KLIPY".
- **Report form** (`components/community/ReportModal/`, logic in `hooks/useReport.js`):
  11 reasons, warning paragraph, self-harm line, details up to 500.
- **Test page** `/dev/community` (`pages/dev/CommunitySandbox.jsx`): development only,
  not in the production build. Use it to try every result during the redesign.
- **Decision of 2 Nov applied:** the campus feed shows only campus posts; the scope chip
  is removed from PostCard.

## Fixed during the checks

- The composer's chip and grey text didn't follow the test page's feed switch. Fixed:
  they now come straight from the props.
- The nudge dialog showed "Cancel". Now "Edit" (primary) and "Post anyway", as the spec
  says. `ConfirmDialog` got new **optional** props for this; every other use is unchanged.

## Notes for the redesign

1. Reacting on a phone browser: the spec opens the website's quick bar only by hover or
   keyboard, but T2 row 10 tests it on "Web phone", where there is no hover. Please decide a
   touch rule (for example long-press, like the app) and add it to spec §5.1.
2. Spec typo: §2.2 says the 😊 button opens "the full emoji picker (§5.4)". It should be §5.2
   (§5.4 is the breakdown).
3. The runbook's N-S testing prep mentions Expo Go for SDK 57. If the app is still on
   SDK 56, that line should say 56.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

- `backend/scripts/seedDemo.js` now fails with `USERNAME_RESERVED` (P0001) after V-B: the
  demo personas need `demo.` usernames. That's part of V-C. (Seen on my local database only.)

## What NOT to do yet

- Don't put the composer or the report form into `/community`. That's CC-N4b and CC-N4c,
  after V-P is merged.
- Keep `/dev/community` until CC-N4c deletes it.
