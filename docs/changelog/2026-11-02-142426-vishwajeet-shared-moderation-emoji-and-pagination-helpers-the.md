---
date: 2026-11-02T14:24:26+05:30
author: vishwajeet
phase: "7"
block: "V-A"
for: neeraj
title: "Shared: moderation, emoji and pagination helpers; the Phase 7 API contract"
---

# Shared: moderation, emoji and pagination helpers; the Phase 7 API contract

Three helpers to import, and the contract to build the posts and reports APIs against. Nothing
calls the helpers until your Block N-B.

**The contract:** `backend/API.md`, "posts module (Phase 7)" and "reports module (Phase 7)".

**The helpers** (please import them; don't edit them):

| File | Exports |
|---|---|
| `backend/src/utils/moderation.js` | `checkContent({ text, images })`, `isReadablePhoto(image)`, `MODERATION_THRESHOLDS` |
| `backend/src/utils/emoji.js` | `isSingleEmoji(value)`, `QUICK_REACTIONS` |
| `backend/src/utils/pagination.js` | `PAGE_LIMIT_DEFAULT`, `PAGE_LIMIT_MAX`, `parsePageLimit`, `readCursorParam`, `isUuid`, `encodeCursor`, `decodeCursor` |

`checkContent({ text, images }, { timeoutMs })` answers `{ outcome, support, categories, scores,
checked }` and never throws. `backend/scripts/try-moderation.mjs` tries it on three sample texts and
times it with three large photos. `backend/scripts/moderation-benchmark.mjs` runs the 137 labelled
samples in `moderation-samples.json`.

**New package: `sharp` is in `backend/package.json`. Run `npm install` in `backend/`.**

## Moderation rules (decided 2 Nov)

A temporary setup for Phase 7. A full moderation stack comes later. `MODERATION_THRESHOLDS` has two
groups:

| | Hold at | Nudge at |
|---|---|---|
| **Text** | `sexual/minors` 0.20, `harassment/threatening` 0.20, `hate/threatening` 0.70, `violence/graphic` 0.80, `illicit/violent` 0.70, `illicit` 0.25, `sexual` 0.25, `self-harm` 0.40, `self-harm/intent` 0.50, `self-harm/instructions` 0.50 | `illicit` 0.15, or the result says flagged |
| **Each photo** | `self-harm`, `self-harm/intent` or `self-harm/instructions` 0.50, `violence` 0.30, `sexual` 0.50 | `sexual` 0.20, or the result says flagged |

- **Photos:** one request for the text and one for each photo, at the same time. The strictest
  outcome wins. Each photo is checked on a copy (768 px at most, JPEG quality 80). The original buffer
  isn't changed, and **the original is what you store and show.**
- **Hold when unchecked:** if the key is missing, or any part fails or times out, the answer is
  `hold` with `checked: false`, and nothing becomes public.
- **`scores` changed shape:** `{ text, images: [ … ] }`.

**⚠ Follow the current CC-N2.** It was rewritten on 2 Nov: `checked: false` saves `pending` and leaves
`moderation_checked_at` empty, so the re-check job finds the post. See the table under
`POST /api/posts`.

**⚠ You need `OPENAI_API_KEY` in your `backend/.env`.** Without it, every post with text or photos is
held on your machine and answers 202. Block V-0, Step 1 shows how to make your own.

## Decisions recorded (evening of 2 Nov)

The runbook, `backend/API.md` and the spec all reflect these.

| # | The problem | Decision | What you do |
|---|---|---|---|
| 1 | The re-check job takes the 20 oldest posts, so 20 photos that can never be read would block it for good. Multer only trusts the declared type | Reject them at upload. `isReadablePhoto` confirms the real format and decodes the whole photo, because reading only the header passes a cut-off file | CC-N2 step 1c: test every photo, else `INVALID_FILE_TYPE` |
| 2 | One false `child_safety` report can hide a photo post at once | Keep the 1-report rule. The notice is now `This post was reported and is being reviewed.`, because "several students" could be false. Until Phase 9, Vishwajeet restores posts by hand (runbook §1.7) | Use the new notice wording (CC-N4c) |
| 3 | A self-harm post held later by the re-check job gave its author no helplines | New column `posts.moderation_support` and a new PostItem field. The card shows under the post on the author's Posts tab while it's held | CC-N2 step 1d saves it; CC-N4c shows the card |
| 4 | A held post's photos are already in the public bucket, under random names | Accepted for Phase 7. Only the author gets those URLs. Private storage is on the Phase 9 list | Nothing |
| 5 | `API.md` was behind the runbook | Updated, including the admin section | Nothing |

**Also decided:**
- **Reports:** one `child_safety` report covers a post with photos; a text-only post still needs 2.
  The new `report_threshold_child_safety_photo` row makes 9 rows in `community_settings`.
- **Open reports only:** the cover rules count only `open` reports, and restoring a post dismisses
  them. `report_count` still counts every distinct reporter.
- **Re-check job (V-C):** oldest first with no time window. A `nudge` publishes with
  `moderation_flagged = true`, because the author isn't there to confirm.

- **Missing photos can't block the re-check job:** new column `posts.moderation_photo_failures`
  (CC-V2). A photo that can't be fetched or read adds 1, and at 6 the job (CC-V3) skips the post,
  which stays `pending` for review. An OpenAI outage doesn't count. Not part of the PostItem, so
  nothing changes for you.

## Migrations applied

None. They come in Block V-B.

## New endpoints

None are built. The contract specifies 13 routes for your blocks, and the two message reaction
routes for Block V-C, which are marked "(Phase 7 Block V-C — not built yet)" in Part 1.

## Changed endpoints (BREAKING)

No live endpoint changed. **The Phase 0 contract for posts and reports is gone**, replaced by the
Phase 7 one. If you remember likes, the following feed or the 250-character limit, they no longer
exist. The admin section of `API.md` now matches Phase 7 too, and is marked Phase 9. The
notifications section no longer says a report trigger writes notifications, because the Phase 7
trigger doesn't. PostItem gains `moderation_support`, and the covered-post notice has new wording.

## New fields on existing responses

None yet. Block V-C adds `reactions` and `gif` to message rows and `last_message_has_gif` to inbox
rows. They're documented in Part 1, marked as not built.

## Test data

None.

## What NOT to do yet

- Don't start the posts API until Block V-B's migrations are merged.
- Don't move the messages or products modules onto `utils/pagination.js`. They keep their own
  copies for now, on purpose.
- Don't rely on the moderation thresholds staying as they are. They're starting values, and they
  may change after the V-A checkpoint. Branch on `outcome`, never on a score.

## Differences from runbook CC-V1

- **The moderation rules above replace CC-V1's,** by decision on 2 Nov: new thresholds, separate
  requests, small photo copies, and hold instead of publish when a check can't run. OpenAI also
  refuses more than one image per request (`Number of images (2) exceeds maximum of 1`).
- **A post with no text and no photos (GIF only) returns `checked: true`** without calling OpenAI,
  so the re-check job doesn't keep picking it up.
- **`decodeCursor` is stricter than `decodeMessageCursor`.** It accepts only ISO timestamps, because
  `Date.parse` also accepts text like `foo 1`, which would reach Postgres and answer 500 instead of
  400. Cursors that `encodeCursor` builds from database rows pass.
- **`decodeCursor(raw, 'number')` returns `value` as a number, and `'timestamp'` returns it as a
  string,** which keeps Postgres's microseconds. Pass the string straight to the SQL function.
