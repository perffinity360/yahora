---
date: 2026-10-18T11:55:59+05:30
author: neeraj
phase: "6B"
block: "N-E"
for: vishwajeet
title: "Mark as Sold endpoints (N-E)"
---

# Mark as Sold endpoints (N-E)

Mark as Sold now runs through your `mark_sold` functions (V-B). This entry covers all of N-E:
- part 1 is the products routes;
- part 2 is the dashboard and public-profile data in my user module.

Build the app's Mark-as-Sold screens (V-F) from this entry and `backend/API.md`.

**⚠ Edited on loan:** `backend/src/modules/products/products.controller.js` and
`products.routes.js`. The `OWNER:` banners are unchanged.

Also changed:
- `backend/src/modules/user/user.controller.js` (mine).
- `backend/API.md`.

This is one PR across two modules (products and user), because the screens need both. It needs
your review.

How the controller works now:
- It checks only the request's **shape** (uuids).
- It calls **one** function and passes any error to `mapDbError`. No rule is re-checked in
  JavaScript.
- `blockNonOwner()` is **deleted**, because the functions check ownership themselves.

All four routes are `requireAuth`. Send `Authorization: Bearer <token>`.

## Migrations applied

None. This uses `mark_product_sold`, `mark_product_available`, `remove_my_purchase` and
`get_product_buyer_candidates` from V-B, plus `search_users`.

## New endpoints

### `GET /api/products/:id/buyer-candidates?q=` — the seller only
The "Who bought it?" picker (MARK_SOLD_SPEC §1).

- **`q` missing or under 2 characters** (trimmed): the people who **messaged the seller about
  this listing**.
  - Only people on the listing's campus.
  - Never the seller.
  - Newest conversation first, at most 20.
  - Every item has `messaged: true`.
  - **An empty `items` means the "Messaged you about this" section is left out** (spec §1).
- **`q` of 2+ characters**: students on the seller's campus whose name or @username matches.
  - Never the seller.
  - Demo and real accounts never mix.
  - At most 20, with `messaged: false`.
  - Debounce 300 ms on the client (spec §1).
- **200:**
  ```json
  { "items": [ { "id": "uuid", "username": "arjun.mehta", "full_name": "Arjun Mehta",
                 "avatar_url": null, "messaged": true } ],
    "next_cursor": null }
  ```
  A fixed top-20: `next_cursor` is **always null**, as on `/api/users/search`.
- **Errors:**
  - `400 INVALID_FORMAT`: `:id` is not a uuid.
  - `401 UNAUTHORIZED`
  - `403 NOT_PRODUCT_OWNER`
  - `404 PRODUCT_NOT_FOUND`
  - `500 INTERNAL_ERROR`
- "Someone not on Yahora" is **not** a row in this list. The app draws that row and sends
  `buyer_id: null` to `/sold`.

### `DELETE /api/products/:id/purchase` — the buyer only: "That wasn't me"
- No body. The purchase removed is always the caller's own.
- **200:** `{ "removed": true }`. The listing **stays sold**, with no buyer on Yahora, so the
  seller's `product.buyer` becomes `null`.
- **Errors:**
  - `400 INVALID_FORMAT`
  - `401 UNAUTHORIZED`
  - `404 PURCHASE_NOT_FOUND`: the caller isn't this listing's buyer. A second call also gets
    this, so treat it as done on a retry.
  - `500 INTERNAL_ERROR`

## Changed endpoints (BREAKING)

### `POST /api/products/:id/sold` — the seller only
- **Body:** `{ "buyer_id": "uuid" | null }`. A missing `buyer_id` or `{}` means **null**:
  "someone not on Yahora", and no one is tagged. Your current `api.post(…/sold, {})` keeps
  working.
- **200 is unchanged:** `{ "message": "Product marked as sold", "product": <products row> }`.
  The row now has `status: "sold"` and `sold_at` set.
- **Calling it again changes the buyer** and **keeps the first `sold_at`**. That is "Change
  buyer", and a double tap is not an error.
- **Errors — the codes changed:**

  | Status | Code | When |
  |---|---|---|
  | 400 | `INVALID_FORMAT` | `:id` or `buyer_id` is not a uuid |
  | 400 | `BUYER_IS_SELLER` | `buyer_id` is the caller |
  | 400 | `BUYER_NOT_ON_CAMPUS` | the buyer's campus isn't the listing's (a demo account, too) |
  | 401 | `UNAUTHORIZED` | |
  | 403 | `NOT_PRODUCT_OWNER` | was `FORBIDDEN` |
  | 404 | `PRODUCT_NOT_FOUND` | was `NOT_FOUND` |
  | 404 | `BUYER_NOT_FOUND` | no user with that id (before 6B the endpoint returned 200 anyway) |
  | 500 | `INTERNAL_ERROR` | with `message`. The old `{ "error": "Failed to mark product as sold." }` is gone |

- Before 6B, the purchase insert was fire-and-forget, and a second call added a second buyer.
  Now a 200 means the buyer, or no buyer, is recorded. There is at most one buyer per listing.

### `POST /api/products/:id/available` — the seller only (Relist)
- No body. **200 is unchanged:**
  `{ "message": "Product marked as available", "product": <products row> }`, with
  `status: "available"` and `sold_at: null`. The buyer is removed.
- **Errors:**
  - `400 INVALID_FORMAT`
  - `401 UNAUTHORIZED`
  - `403 NOT_PRODUCT_OWNER` (was `FORBIDDEN`)
  - `404 PRODUCT_NOT_FOUND` (was `NOT_FOUND`)
  - `500 INTERNAL_ERROR`

## New fields on existing responses

- **`GET /api/products/:id` → `product.buyer`, for the seller only.**
  - It is present only when the caller **is the seller** and the listing is **sold**.
  - Value: `{ "id", "username", "full_name", "avatar_url" }`, or `null` when sold to someone not
    on Yahora, or after "That wasn't me".
  - **For everyone else the key is absent.** That includes the buyer, other students and
    logged-out callers.
  - Use it to start the picker on the current buyer for **Change buyer**. If it is `null`, start
    on the off-platform row (spec §1).
- **`sold_at`** (timestamptz, `null` unless sold) is on every products row (`*`): in the list,
  the detail and the `/sold` / `/available` responses. Your V-B trigger sets it.

### `GET /api/user/:userId/dashboard` — own dashboard (part 2)
- **`listings[].sold_at`**: `null` unless sold.
- **`listings[].buyer`**: on **every** listing.
  - Value: `{ "id", "username", "full_name", "avatar_url" }` for a sold listing's buyer.
  - Otherwise `null`: not sold, sold to someone not on Yahora, or "That wasn't me".
  - Use it for the sold card's buyer line, and to start **Change buyer** on the right row.
- **`purchases[].product`** gains `status`, `sold_at` and
  **`seller: { "id", "username", "full_name", "avatar_url" }`**: who the caller bought from.
  It's for the buyer's purchases list and its "That wasn't me"
  (`DELETE /api/products/:id/purchase`).

### `GET /api/user/:userId/public` — anyone the identity rule lets in (part 2)
- **`sold_listings`**: `[{ "id", "title", "price", "image_urls", "condition", "sold_at" }]`.
  - Only this seller's sold listings, newest `sold_at` first, **at most 12**.
  - No like/save flags.
- **`sold_count`**: the total number of sold listings, which can be more than 12. Use it for a
  "Sold (N)" heading.
- **No buyer anywhere** in this response.

## Test data

Run locally against `supabase db reset` data. Priya (`priya.nair`) sells the Wacom
`e0000000-0000-4000-8000-000000000004`, and Arjun messaged her about it. The password for all of
them is `password123`.

`buyer-candidates`:
- As Priya, no `q` → Arjun, `messaged: true`.
- `q=ra` → Rahul only, `messaged: false`.
- `q=sneha` → `[]`: she is at NIET, another campus.
- As Arjun, either mode → `NOT_PRODUCT_OWNER`.
- A missing listing, either mode → `PRODUCT_NOT_FOUND`.
- No token → `UNAUTHORIZED`.

`/sold`, bad input:
- `:id` = `abc` → `INVALID_FORMAT`.
- `buyer_id: "x"` → `INVALID_FORMAT`.
- As Arjun → `NOT_PRODUCT_OWNER`.
- `buyer_id` = Priya → `BUYER_IS_SELLER`.
- An unknown uuid → `BUYER_NOT_FOUND`.
- Sneha → `BUYER_NOT_ON_CAMPUS`.
- After all of these the listing was still `available`, with 0 purchases.

`/sold`, then the buyer field:
- To Arjun → 200, `status: "sold"`, `sold_at` set.
- Priya's detail has `buyer` = Arjun.
- No `buyer` key for Arjun, Rahul or a logged-out caller.

Change buyer, then "That wasn't me":
- Changing the buyer to Rahul keeps the same `sold_at`, with 1 purchase, Rahul's.
- Arjun's `DELETE /purchase` → `PURCHASE_NOT_FOUND`.
- Rahul's → `{ "removed": true }`.
- Priya's detail: still `sold`, `buyer: null`.

Old clients, and relist:
- `/sold` with `{}` (like today's app) → 200.
- `/available` → `status: "available"`, `sold_at: null`.

Part 2, with the Wacom sold to Arjun:
- **Priya's dashboard:**
  - The Wacom has `sold_at` and `buyer` = `arjun.mehta`.
  - Every other listing has `buyer: null`.
  - No `purchase` key anywhere.
- **Arjun's dashboard:** the purchase's product has `status: "sold"`, `sold_at` and
  `seller` = `priya.nair`.
- **Priya's `/public`, as Rahul:** `sold_count: 1`, `sold_listings` = the Wacom, and no
  `buyer` anywhere in the JSON. After relisting: `sold_count: 0`, `[]`.
- **Embed shape:** local PostgREST returns `purchase` as an object, or `null`. The code also
  takes a one-element array.

Afterwards I put the Wacom back the way it was: available, with no purchase and no extra views.

## What NOT to do yet

- **The buyer is private. Show it only to the seller and the buyer (MARK_SOLD_SPEC §0).**
  Everyone else sees **SOLD**. The API only ever sends `buyer` to the seller.
- Don't write `purchases` or `products.status` directly from the app. Use these routes.
