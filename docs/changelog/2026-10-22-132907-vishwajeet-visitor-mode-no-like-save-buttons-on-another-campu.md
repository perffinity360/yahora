---
date: 2026-10-22T13:29:07+05:30
author: vishwajeet
phase: "6B"
block: "V-D"
for: neeraj
title: "Visitor mode: no like/save on another campus; demo profile gate says log in"
---

# Visitor mode: no like/save on another campus; demo profile gate says log in

Found on the phone during checkpoint V-D: as a demo account on Rahul's cycle
(`e0000000-0000-4000-8000-000000000007`), tapping like or save lit the button up for a moment,
then it went out again. The API refuses both on another campus's listing
(`CROSS_CAMPUS_INTERACTION_BLOCKED`), so the optimistic flip was rolled back. The same happens to
a student browsing another campus in the Marketplace. Vishwajeet asked for the fix on web as
well as the app.

## ⚠ I edited `frontend/` (yours): `ProductDetail.jsx`, `ProductCard.jsx` (+ `.module.css`), `Marketplace.jsx`, `PublicProfile.jsx`

Please review rather than re-implement. `npm run build` passes. I haven't checked it in a browser.

- **`ProductCard`: new prop `canInteract` (default `true`).** When `false`, the photo's overlay
  heart and the footer bookmark are left out, and the footer heart is a plain count
  (`<span className={styles.statCount}>`, new class), not a button. Share stays. Every existing
  caller is unchanged.
- **`Marketplace.jsx`:** the grid and `SwipeCard` pass `canInteract={!isForeignCampus}`. In visitor
  mode a right swipe calls `handleSwipePass`, so the card moves on and no like is sent.
- **`ProductDetail.jsx`, when `isForeignCampus`:**
  - the like chip is a `<span>` (count only, no hover);
  - **Save Item** is not rendered;
  - the banner says "Liking, saving, messaging & commenting are disabled." It used to say
    "Purchasing & commenting".

- **`PublicProfile.jsx`: a demo account's 404 now shows the login gate**, not "This profile
  isn't available." Vishwajeet's point: "isn't available" reads as "this student isn't on
  Yahora". The gate's copy is unchanged ("Log in to see this profile" / "visible only to
  verified students"), and it is the same for every id, so it still doesn't say whether the
  person exists. For a demo account the button reads "Log in with college email" and calls
  `logout()` before `navigate("/auth")`, because `GuestOnly` bounces a signed-in caller home
  (same as the Marketplace demo alert). A student's 404 still says "isn't available".
- **The gate itself was restyled** on Vishwajeet's request (it was an inline-styled card in
  Bree Serif with a wrapping button). It is now a `ProfileGate` component in
  `PublicProfile.jsx`, styled by a new `PublicProfile.module.css` (gate classes only; the page
  still uses `Dashboard.module.css`). Both states use the same card: lock or user-x icon, title,
  one line of copy, and a "Go back" link (`navigate(-1)`, or `/marketplace` with no history).
  The login state adds a "Students only" eyebrow, the gradient button, and for a demo account
  "This ends your demo session." Rise-in on load, off under `prefers-reduced-motion`.

Logged-out visitors are unchanged. They still get the existing "Please log in to like items."
alert, and `isForeignCampus` is false without a home campus.

## Mobile (mine), for the record

- **Product page:** on another campus, the heart and bookmark are not in the action bar. The
  "Home campus only" pill fills the bar. The note reads "liking, saving and messaging are for
  your home campus." The likes count in the stats row stays.
- **Marketplace on another campus:** the card heart gets no `onLike`, so it's a plain count. A
  right swipe in the deck moves on without liking.
- **Profile gate:** same change as the web. A demo account's unavailable profile says "Log in to
  see this profile" with a "Log in with college email" button (signs out, then the login
  screen) and a "Go back" link.
- **Cache leak between accounts (found on the phone):** after signing in as a student and then
  as the demo account, Rahul's cycle still showed his name and the commenters' names. The API
  was right; the app's query cache is saved to the phone and was never emptied, and its keys
  don't say who asked. `AuthContext` now empties it (`cancelQueries()` then `clear()`) on every
  sign-in and on sign-out. The web has no saved cache (every page fetches on open), so it never
  had this.
- **Marketplace search:** a new search or filter now scrolls the grid to the top, as a re-sort
  already did. Before, the shorter result list kept the full feed's offset and the first card
  was cut off under the search bar. Web's page scroll doesn't have the same problem, so web is
  unchanged here.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None. No backend file changed.

## New fields on existing responses

None.

## Test data

- `npm run build` (web) and `npx tsc --noEmit` (mobile) pass.
- Nothing was checked in a browser or on a phone.

## What NOT to do yet

- **Still open: the public profile.** A student who opens another campus's seller profile still
  gets live like/save on that seller's listings, and the same flash. Neither client can tell,
  because `GET /api/user/:userId/public` strips the profile's `university_id`
  (`user.controller.js`, after the identity check). Returning it, or a `same_campus` flag, would
  let both clients pass `canInteract`. That's your module, so it's your call.
- Don't put the like/save buttons back on a foreign listing behind an alert. Hiding them is the
  choice for both clients.
