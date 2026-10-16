---
date: 2026-10-16T11:42:08+05:30
author: vishwajeet
phase: "6B"
block: "V-B"
for: neeraj
title: "6B migrations: message actions, product views, mark sold"
---

# 6B migrations: message actions, product views, mark sold

The three Phase 6B migrations, copied byte for byte from the tested SQL in
`docs/runbooks/phase6b/` (`cmp` shows each pair identical). They're applied **locally only**.
Production isn't pushed yet.

## Migrations applied

Local only, in this order:

| File | Source | What it does |
|---|---|---|
| `supabase/migrations/20261016061043_message_actions.sql` | `01_message_actions.sql` | Reply (quote a message), delete for everyone (tombstone), delete for me (`message_hides`) |
| `supabase/migrations/20261016061047_product_views.sql` | `02_product_views.sql` | `products.views` = distinct students who opened the listing, through one path |
| `supabase/migrations/20261016061050_mark_sold.sql` | `03_mark_sold.sql` | Mark as Sold reworked: one buyer per listing, `sold_at`, four functions |

**New tables (backend-only).** Neither has grants for `anon` or `authenticated`, and neither
is in the Realtime publication. Only `service_role` reaches them:

- `message_hides`: who hid which message, for "delete for me". The other person can never
  learn that a message was hidden.
- `product_views`: one row per (listing, viewer).

**New functions.** Every rule lives in these, so call them and pass any error to
`mapDbError()`. Don't re-check in JavaScript.

| Function | Raises |
|---|---|
| `delete_message_for_everyone(message, caller)` | `MESSAGE_NOT_FOUND`, `NOT_MESSAGE_SENDER`, `DELETE_WINDOW_EXPIRED` |
| `hide_message_for_me(message, caller)` | `MESSAGE_NOT_FOUND` |
| `record_product_view(product, viewer)` | none. It ignores the seller, repeat views, and demo accounts viewing real listings |
| `mark_product_sold(product, seller, buyer or NULL)` | `PRODUCT_NOT_FOUND`, `NOT_PRODUCT_OWNER`, `BUYER_NOT_FOUND`, `BUYER_IS_SELLER`, `BUYER_NOT_ON_CAMPUS` |
| `mark_product_available(product, seller)` | `PRODUCT_NOT_FOUND`, `NOT_PRODUCT_OWNER` |
| `remove_my_purchase(product, buyer)` ("That wasn't me") | `PURCHASE_NOT_FOUND` |
| `get_product_buyer_candidates(product, seller)` | `PRODUCT_NOT_FOUND`, `NOT_PRODUCT_OWNER` |

The trigger function `fill_message_reply()` fills the quote and raises `REPLY_TARGET_INVALID`.
All of these names are already in `RAISED_STATUS` (V-A).

**`increment_product_views()`** can no longer be called with the public key. `service_role`
keeps it, so today's `GET /api/products/:id` still works until N-C switches to
`record_product_view()`.

## New endpoints

None. The endpoints come in V-C (messages) and N-E (Mark as Sold).

## Changed endpoints (BREAKING)

Breaking for anything that reads these columns:

- **`products.sold_to` is DROPPED.** The current endpoints select `*`, so the key simply
  disappears from product rows; no query names it. One reader is affected:
  `frontend/src/components/ProductCard/ProductCard.jsx:446` reads `product.sold_to`. It now gets
  `undefined` and shows "SOLD", which is exactly what it showed before, because nothing ever
  wrote the column. API.md still lists `sold_to` in `<products row>` and in two notes; it gets
  fixed with the next API.md edit.
- **`purchases` now allows one row per listing** (unique on `product_id`). The migration
  deletes rows pointing at nothing, and the older duplicates of a listing marked sold twice.
  Locally that cleanup ran on an empty table, because `seed.sql` loads after the migrations.
  The real counts come from production at the push (runbook V-B, step 1). Today's `POST /api/products/:id/sold`, when it names a
  buyer on a listing that already has one, gets a unique violation on the purchase insert. It
  logs it and still returns 200, so the first buyer stays. N-E replaces this handler with
  `mark_product_sold()`.

## New fields on existing responses

From the database. They appear in an API response once a handler returns them:

- `messages.reply_to_id`, `reply_to_sender_id`, `reply_preview`, `deleted_at`. `GET
  /api/messages/history` selects `*`, so they show up there now: `null` on every existing
  row. A deleted message keeps its row, with `content = ''` and `deleted_at` set.
- `products.sold_at`: stamped by a trigger whenever `status` becomes `'sold'`, and cleared
  when it stops being sold.
- Inbox rows (`get_user_inbox()`, so `GET /api/messages/inbox/:userId`): `last_sender_id`
  and `last_message_deleted`. Messages the caller hid are skipped.

## Test data

Run on 16 Oct against the local database only, through `docker exec supabase_db_yahora psql`.
Both scripts run in a transaction and roll back.

- `supabase db reset`: all 21 migrations and `seed.sql` applied with no error.
- `test_01_message_actions.sql`: `T1 ok` … `T7 ok` and `T9 ok`. T10 privileges are all `f`.
- `test_02_views_and_sold.sql`: `views ok`, `mark sold ok`, `buyer candidates ok`. The
  privileges row is all `f`. `service_old_views` is `t`, as expected.
- T8 prints two inbox tables for eyeballing. It has no assertion. The second table's label
  expects a tombstone as Priya's newest Wacom message. It shows Arjun's later reply "saved
  it" instead, which is correct: that reply was sent after the deleted message. Inside one
  transaction every insert gets the same `created_at`. So that table's order comes down to
  the uuid tie-break, and the label is wrong rather than the migration.

## What NOT to do yet

- Run `supabase db reset` after pulling. N-C and N-E need these locally. Production push is
  Day 3, by hand.
- Don't call `increment_product_views()` in new code. Use `record_product_view()` (N-C).
- Don't write `purchases` or `products.status` directly for Mark as Sold. Call the functions
  (N-E).
