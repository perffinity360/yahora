---
date: 2026-10-17T12:49:21+05:30
author: vishwajeet
phase: "6B"
block: "V-D"
for: neeraj
title: "Mobile privacy states: hidden seller, commenters, profile (V-D)"
---

# Mobile privacy states: hidden seller, commenters, profile (V-D)

The app now handles everything your N-C hides: `seller: null` / `seller_hidden`,
`user: null` / `user_hidden`, `university_name`, and 401/404 from
`GET /api/user/:id/public`. It was built to API.md "The identity rule (Phase 6B)" and the
runbook's CC-V4. It works the same way as your N-D on the website: hidden means "Yahora student",
with no photo and no profile link.

**Only `mobile/` changed.** No backend, frontend or supabase file, and nothing in products or
share, which are still on loan to you.

On the phone, this can only happen to a **demo account that opens a real campus's listing or
profile from a link**. The campus switcher keeps demo accounts on the demo campus, and the app
can't be used logged out. Real students see exactly what they saw before.

## What the app does now

| Where | When hidden |
|---|---|
| Product card (feed, swipe deck) | Seller row reads **Yahora student**, with a person icon in the same circle instead of initials. Same size, same place. A safety net: a demo account can't open a real campus's feed. |
| Product page, seller section | **A student at <university_name>**, or **A Yahora student** when there's no `university_name`. Under it: *Verified students can see who's selling.* No education line, no "View profile", and the row can't be tapped. |
| Product page, action bar | "Your listing" is never shown for a hidden seller. No Message Seller button. A demo account on a real listing gets the existing "Home campus only" lock. |
| Comments | **Yahora student** with the person icon. The reply box reads "Reply…" instead of "Reply to <name>…". A `user: null` without the flag is drawn the same way (fail closed). |
| Public profile | 404 or 401 from our API → **This profile isn't available.** with a Go back button. Not retried, so there's no long spinner. Any other error still shows "Couldn't load" with Retry. |

Files: `src/types/index.ts`, `src/components/Avatar.tsx` (new `hidden` setting),
`src/components/ProductCard.tsx`, `src/components/CommentThread.tsx`,
`app/product/[id].tsx`, `app/profile/[id].tsx`, `src/hooks/usePublicProfile.ts`.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None. One request changed on the app side:

- **`GET /api/user/:id/public` no longer gets `?user_id=`** from the app. Your N-C ignores it,
  and the app already sends the token.
- The app still sends `?user_id=` to `GET /api/products/:id`. `products.controller.js` has
  read the viewer from the token since Phase 4, so it does nothing. I left it alone because
  CC-V4 only covered the profile request.

## New fields on existing responses

None. The app now reads `seller_hidden`, `user_hidden` and `university_name` from N-C.

## Test data

- `npx tsc --noEmit` passes.
- **Not yet tried on a phone.** Checkpoint V-D, as the runbook gives it, runs as a demo account
  using QR-code links:
  - Rahul's cycle `e0000000-0000-4000-8000-000000000007`: the hidden seller and the hidden
    commenters.
  - His profile `b0000000-0000-4000-8000-000000000003`: "This profile isn't available."
  - Then `arjun.mehta` / `password123`: everything as before.
- I'll add a follow-up entry if anything there fails.

## What NOT to do yet

- **Your open question from N-C** (commenters hidden by the listing's campus, not their own)
  is still open. V-D doesn't depend on the answer: the app draws whatever `user_hidden` says,
  so either fix on the API side works with no change to mobile.
- Don't start sending a hidden person's id anywhere for mobile's sake. The app never needs
  `seller_id` once the seller is hidden.
