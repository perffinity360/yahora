---
date: 2026-11-18T15:47:23+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "Last stale port 5000 defaults and OTP-length note corrected"
---

# Last stale port 5000 defaults and OTP-length note corrected

A housekeeping pass at the owner's request (18 Nov): the last places that still gave the API port as 5000,
or the OTP as 8 digits, as if that were true today. The port is **5001** (macOS AirPlay holds 5000 and answers
with a bodiless 403), and the OTP is **6 digits** (`otp_length = 6`). No behaviour changes for anyone whose
`.env` already sets `VITE_API_PORT=5001`.

**⚠ I edited two of your `frontend/` files.** Both are one-liners:

1. **`frontend/vite.config.js`:** the `/api` proxy's fallback when `VITE_API_PORT` is unset is now `'5001'`
   (was `'5000'`), and the header comment says so. Before, a fresh checkout without that line in `.env`
   proxied to AirPlay.
2. **`frontend/src/config/urls.js`:** comments only. The example URLs say `:5001`.

Mine, in the same pass:

- `backend/API.md` (Part 1, Base URL): `PORT` defaults to `5001`, as `server.js` has done since Phase 3.
- `backend/src/server.js`: one comment said "reach port 5000".
- `backend/scripts/diagnose-token.mjs` and `verify-block-f.mjs`: they called `localhost:5000`, so they hit
  AirPlay. Now 5001.
- `docs/YAHORA_BUILD_PLAN.md`: the local services table lists the backend at `localhost:5001`.
- `docs/PRE_LAUNCH_CHECKLIST.md`: the "OTP length (8)" line now says 8 was the value at the time of that
  check, and 6 since Phase 3.

Left alone on purpose: the finished phase runbooks (0–5) and the frozen `docs/CHANGELOG.md`. They record
what was true when they were written.

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

- Not merged yet: uncommitted on `v-d-app-community`.
