---
date: 2026-10-26T19:19:34+05:30
author: neeraj
phase: "6B"
block: "N-H"
for: vishwajeet
title: "Mark as Sold on the website (N-H) + spec changes for the app"
---

# Mark as Sold on the website (N-H) + spec changes for the app

The website now does Mark as Sold the way `docs/design/MARK_SOLD_SPEC.md` describes, using the
N-E endpoints. **While building it, the spec changed in three places (and one icon change is not
in the spec yet). The app has to match these — see "Spec changes the app must now match" below.**

Everything is in `frontend/` plus `docs/design/MARK_SOLD_SPEC.md`. Nothing in `backend/`,
`mobile/` or `supabase/` changed.

What's on the website:
- **"Who bought it?" picker** — new `frontend/src/components/BuyerPicker/` (spec §1): people
  who messaged about the listing, campus search from 2 characters (300 ms), "Someone not on
  Yahora", faded button until a row is picked, `Save` in Change-buyer mode, spinner, the §1
  error toasts. Replaces the Dashboard's old sold modal and its inbox-walking buyer lookup.
- **Dashboard → My Items** (§3): sold cards show `Sold to <name> · <date>` /
  `Sold · buyer not on Yahora · <date>`, then the Change buyer and Relist pills; Relist asks
  first ("Relist this item?"). The old `SOLD TO @…` label is gone.
- **Dashboard → Bought Items** (§4): `From <seller> · <date>` and the "That wasn't me" pill,
  with the "Remove this purchase?" dialog → `DELETE /api/products/:id/purchase`. These cards
  were unstyled before this branch (their CSS classes never existed); they now use the same
  card styles as My Items.
- **Product page** (§2): SOLD stamp on the photo, the sold banner (the seller's version shows
  the buyer), and the listing is closed for everyone (see (c) below).
- **Public profile** (§5): `Sold · <count>` with up to 12 sold cards, no like or save, left
  out when the count is 0. No buyer anywhere.
- **Link preview** (`frontend/netlify/edge-functions/product-preview.js`):
  `product:availability` is `out of stock` for a sold listing (it said `oldout`), `in stock`
  otherwise.
- Small shared pieces: `formatShortDate()` in `frontend/src/utils/messageFormat.js` (`3 Oct`,
  `3 Oct 2025` in an earlier year), and the initials avatar moved out of `Messages.jsx` into
  `frontend/src/components/AvatarImg/` so the picker draws people the same way.

## Migrations applied

None.

## New endpoints

None. The website uses the N-E endpoints as they are: `GET /api/products/:id/buyer-candidates`,
`POST /api/products/:id/sold`, `POST /api/products/:id/available`,
`DELETE /api/products/:id/purchase`.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None. The website reads the fields N-E added: `listings[].buyer` / `sold_at` and
`purchases[].product.seller` / `sold_at` on the dashboard, `product.buyer` (seller only) and
`sold_at` on the detail, and `sold_listings` / `sold_count` on `/public`.

## Spec changes the app must now match

All in `docs/design/MARK_SOLD_SPEC.md`. The spec header still says v1.

**(a) "That wasn't me" is a small pill with a UserX icon** — §4, which now reads:

> - 8 below it, a quiet **pill button** **`That wasn't me`**: `user-x` 14 (Feather on mobile,
>   lucide on web), gap 6, label Inter 600 12 · mutedText for both, no underline · border 1px
>   `rgba(128,0,128,0.15)` · radius 999 · padding 4 vertical, 10 horizontal · transparent
>   background · left-aligned · at least **28** tall, so it is easy to tap · pressed (mobile),
>   hover and pressed (web): background pinkLight `#FFF4F7`, label and icon purple `#800080`,
>   150 ms · web keyboard focus: 2px purple outline, offset 2. The same on every screen size.

(It was: "a text button, Inter 600 12 mutedText, underlined".)

**(b) "Change buyer" / "Relist" are purple pills with Users / RotateCcw icons** — §3, which now
reads:

> - 8 below it, two **pill buttons**, gap 8, left-aligned, wrapping onto a second line on a
>   card too narrow for both: **`Change buyer`** (`users` 14; opens §1 with the current choice
>   selected) and **`Relist`** (`rotate-ccw` 14; the existing Mark-available action, now with the
>   dialog below). Each: icon (Feather on mobile, lucide on web), gap 6, label Inter 600 12 ·
>   purple `#800080` for both · background `rgba(128,0,128,0.06)` · border 1px
>   `rgba(128,0,128,0.12)` · radius 999 · padding 4 vertical, 10 horizontal · at least **28**
>   tall · pressed (mobile), hover and pressed (web): background `rgba(128,0,128,0.12)`, 150 ms ·
>   web keyboard focus: 2px purple outline, offset 2. The same shape and size as §4's `That
>   wasn't me` pill, in a stronger purple because these are the seller's normal actions. The
>   same on every screen size.

(It was: "two text buttons, Inter 600 12 purple, gap 14".)

**(c) A sold listing is closed for EVERYONE, the seller included** — §2. Before, only
non-sellers lost like, save and the question box. Now the non-seller row hides only
**Message seller**, the seller row adds "The seller keeps their `Your listing` marker in place
of Message seller.", and under the table:

> **A sold listing is closed for everyone — the seller too, and logged-out or demo viewers.**
>
> - **No like:** the like count stays, as a plain stat like the views count; nothing happens on a tap.
> - **No save:** the Save button is gone.
> - **No new questions:** the "ask a question" composer is gone. Existing questions and answers stay
>   visible and readable. With none, the "be the first to ask" line is replaced by `Questions are
>   closed — this item has been sold.` (mutedText, centred).
> - **Kept:** the stamp, the banner, Share and the seller card.

On the website, replies and helpful votes on existing questions are still there on a sold
listing; only the new-question box is gone. Say if the app should hide those too, and the
website will follow.

**(d) Save uses a bookmark icon, not a heart** — ⚠ **not in any spec yet**, so there is nothing
to quote. On the website, the product page's `Save Item` / `Saved` button now uses lucide
`Bookmark` (outline, filled when saved) instead of `Heart`, and so does the Marketplace "My
Wishlist" filter heading. Heart now always means Like. The website's cards already used a
bookmark for save. Please use a bookmark wherever the app has a save control, and we should add
a line to the spec for it.

## Test data

Checkpoint N-H passed locally on 26 Oct 2026 as Priya (seller of the Wacom) and Arjun (buyer):
- the picker: people who messaged, search, a student on another campus not found,
  "Someone not on Yahora", the faded button until a pick, `Save` when changing the buyer;
- the sold card lines; Change buyer; the Relist dialog;
- "That wasn't me";
- the product page as the seller and as a non-seller;
- the public profile's Sold section;
- Relist.

## What NOT to do yet

- The buyer is private — only the seller and the buyer ever see it (MARK_SOLD_SPEC §0).
