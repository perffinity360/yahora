---
date: 2026-11-03T17:09:17+05:30
author: neeraj
phase: "7"
block: "N-C"
for: vishwajeet
title: "Reports API (N-C)"
---

# Reports API (N-C)

`POST /api/reports`, built to `backend/API.md`, "reports module (Phase 7)". Files:
`backend/src/modules/reports/reports.routes.js` and `reports.controller.js` (my module; banners
unchanged). It checks the body, calls your `create_report()` with `p_reporter = req.user.id`, and
passes errors through `mapDbError`. Nothing counts reports or covers a post in JavaScript; your
trigger does that.

## Migrations applied

None. No SQL was written; `create_report()` from `reactions_and_reports` already had the right shape.

## New endpoints

**`POST /api/reports`** (requires the token) `{ target_type, target_id, reason, details? }`:

| Status | Body | When |
|---|---|---|
| 201 | `{ reported: true }` | always, whatever the report caused |
| 400 | `INVALID_FORMAT` `{ message: 'Only posts can be reported for now.' }` | `target_type` missing or not `post` |
| 400 | `INVALID_FORMAT` | `target_id` not a uuid, `reason` not one of the 11, `details` not a string or over 500 code points |
| 400 | `CANNOT_REPORT_OWN` | your function, the caller wrote the post |
| 400 | `DUPLICATE` | the unique key (`23505`), a second report on the same post |
| 401 | `UNAUTHORIZED` | no or bad token |
| 404 | `POST_NOT_FOUND` | your function, the caller can't see the post |

**Your attention, please:**

- **The answer never reveals the outcome** (§1.7): not the report count, not whether the post was
  covered. The rpc's result isn't read at all.
- **`details`** is trimmed, and a blank one is sent as `null`. Nothing logs it: only an error's
  `code` and `message` reach `mapDbError`, because a check violation's `details` can hold the row.
- **`API.md`** got two clarifications under `POST /api/reports`: a missing `target_type` gets the
  "Only posts" message too, and the trimming and non-string rule for `details` above.

## Changed endpoints (BREAKING)

None. `/api/reports` had no routes before.

## New fields on existing responses

None.

## Test data

None. Checkpoint N-C uses your seed and posts made during the check.

## What NOT to do yet

- Not merged yet: one backend PR from `n-c-reports-api`, for your review (day 8).

## Checkpoint N-C passed (all 7 checks), with one note

- The runbook's test post `Cover test` (Sneha, India feed) was **held** by moderation
  (`moderation_status: pending`), so nobody else could see or report it: `POST_NOT_FOUND`
  was correct. A normal text ("Looking for a study partner for DBMS") was `active`, and the
  cover test passed with that one.
- Maybe OpenAI scores very short texts oddly, or a hold threshold in `moderation.js` is
  too low. Worth a look (V-A).
- Also see my N-B entry for the zsh fixes to the curl helper.
