---
date: 2026-10-26T13:59:48+05:30
author: vishwajeet
phase: "6B"
block: "V-F"
for: neeraj
title: "App: Mark as Sold everywhere (picker, sold cards, purchases, product page, public profile)"
---

# App: Mark as Sold everywhere (picker, sold cards, purchases, product page, public profile)

Block V-F is built on the app (CC-V6a and CC-V6b), against your N-E endpoints and
`MARK_SOLD_SPEC.md`. **Nothing in `backend/`, `frontend/` or `supabase/` changed.** This entry
is for N-H: where the spec leaves a choice open, here is what the app does, so the website can
match it.

## What the app does, by spec section

- **§1 picker** (`mobile/src/components/BuyerPickerSheet.tsx`):
  - **Fixed below the list:** the divider, "Someone not on Yahora" and the button. Only the
    people list scrolls, so the button is always reachable, even with the keyboard up.
  - **The "Messaged you about this" list:** it loads with no label, because there may be no one
    to label. It shows from cache at once and refreshes on every open.
  - **A search that is still waiting out its 300 ms:** it shows the skeleton rows, never the
    previous query's results.
  - **A failed load:** the toast, and the list stays empty. "Someone not on Yahora" can still be
    chosen.
  - **Saving:** the sheet waits for the server, then closes. The card under it has already
    changed. A refusal keeps the sheet open, with the spec's toast for that error code.
- **§2 product page:**
  - **Anyone but the seller:** with Message seller, like and save gone, the bottom action bar
    is not drawn at all. `canInteract` is false on the questions, so the ask box, replies and
    votes go too. Questions stay readable. Same as a foreign-campus listing.
  - **The seller:** keeps their bar ("Your listing" + like/save), the banner, and the buyer
    line. If `buyer` is absent (an old cached copy), the buyer line is left out. That is never
    read as "no buyer".
- **§3 seller's cards** (`ProductCard` props `soldLine`, `onChangeBuyer`):
  - **Under the price:** the sale line (up to 2 lines on a grid card), then Change buyer and
    Relist.
  - **The toolbar:** the sold card's round "mark available" icon is gone, because Relist is now
    a text button. Delete stays.
  - **Names:** `full_name`, else `username`, else "a Yahora student".
- **§4 purchases:** the "From <seller> · <date>" line takes the place of the old clock date.
  The date is the product's `sold_at`, or the purchase's `created_at` when that is missing. A
  repeated "That wasn't me" that gets `PURCHASE_NOT_FOUND` counts as done, and the card stays
  gone.
- **§5 public profile:**
  - **Header:** `Sold · N`, in the listings header's title style, with no count chip.
  - **Cards:** have no heart and no like count (new `ProductCard` prop `hideLikes`).
    `sold_listings` carries no `likes_count`, and a sold listing takes no likes.
  - **Footer time:** the card's footer time is the sale date (`sold_at`), because the rows have
    no `created_at`.
- **§6 marketplace:** marking sold removes the listing from every cached marketplace page at
  once. Relisting marks the feed stale, so the listing returns on the next refresh.
- **Dates:** `formatShortDate()` in `mobile/src/lib/messages.ts`: `3 Oct`, or `3 Oct 2025` in
  an earlier year.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None. The app now sends `{ buyer_id }` to `/sold` and calls `buyer-candidates` and
`DELETE /purchase`, exactly as N-E documents them.

## New fields on existing responses

None.

## Test data

- `npx tsc --noEmit` and `npx expo export --platform android` pass.
- **The shapes were checked against the local API on 26 Oct**, as `priya.nair` and
  `rahul.verma` on the Wacom (`e0000000-0000-4000-8000-000000000004`):
  - **Buyer candidates:**
    - with no `q`: Arjun, `messaged: true`;
    - `q=rah`: Rahul;
    - `q=sne`: `[]`.
  - **After Priya marked the Wacom sold to Rahul:**
    - Rahul's purchase has `product.seller`, `status` and `sold_at`;
    - Priya's listing has `sold_at` and `buyer`;
    - her public profile, seen as Rahul, has `sold_count: 1` and no `buyer` anywhere in the JSON.
  - **Afterwards:** I relisted it. It is `available` again, with no buyer, and Rahul has 0
    purchases. I didn't call `GET /api/products/:id`, so no views were added.
- **Not yet checked on a phone.** The owner checks the app.

## What NOT to do yet

- Don't show the buyer anywhere but the seller's own card and product page.
