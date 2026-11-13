---
date: 2026-11-11T16:00:18+05:30
author: vishwajeet
phase: "7"
block: "V-C"
for: neeraj
title: "Demo onboarding: a fixed demo. prefix in the username field (web, app, backend)"
---

# Demo onboarding: a fixed demo. prefix in the username field (web, app, backend)

**The bug (seen on the website, 11 Nov):** in the demo sandbox, typing `good_bunny` said "That handle
is already taken", but `demo.good_bunny` said available. The page sent the plain name, the `demo.`
rule refused it as `RESERVED`, and the page shows `RESERVED` with the "taken" sentence.

**Decided (Vishwajeet, 11 Nov), replacing runbook §1.11's "the demo skips the username step":** the
username field shows **`demo.`** fixed in front of the input, which can't be deleted. The student types
only the rest, starting from the name generated at demo login, and the client adds the prefix.

**⚠ I edited your `frontend/`:** `src/pages/onboarding/onboarding.jsx` and `onboarding.module.css`.
This is runbook CC-N5 item 3, which I marked done, so **N-E has nothing to do for the demo
onboarding.** Please look at it when you review:

- `DEMO_PREFIX = "demo."` and `DEMO_SUFFIX_MAX = 20` at the top. For a demo user `formData.username`
  holds only the part after the prefix (prefilled from the generated name), and `toHandle()` adds it
  back for the availability check, the `yahora.com/…` preview and the save.
- A `.handlePrefix` span shows `demo.` inside the input's left edge; the input gets `.withPrefix`
  padding and `maxLength={20}`. A pasted `demo.x` becomes `x`.
- No suggestion chips for demo users: the suggestion endpoints return plain names (for example
  `dgood.bunny`), which a demo account can't have.
- `isDemoUser` moved above the form state, because the initial value needs it. Real students: no
  change.
- `npx vite build` passes. Not checked in a browser.

The app got the same change (CC-V6 item 1, also marked done): `UsernameField` has a `prefix` prop.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

- **`POST /api/auth/onboarding`, demo accounts only:** `username` is now **optional**, no longer
  ignored. If it's sent and differs from the current name, it's checked like a real student's and saved.
  It must be the whole handle (`demo.good_bunny`); a plain name is `400 USERNAME_RESERVED` and the
  password isn't changed. If it's missing, empty or the same, the generated name stays. My V-C entry's
  "a demo account's username is ignored" no longer holds. `backend/API.md`, "🎭 Demo accounts".

Checked locally with curl: plain `good_bunny` → `USERNAME_RESERVED`; `demo.good_bunny` → saved, and
then `TAKEN` for a second demo account; no username → keeps `demo.tidy.jackal`.

## New fields on existing responses

None.

## Test data

None.

## What NOT to do yet

- Not on production until this branch (`v-c-messages-reactions`) is merged and deployed.
