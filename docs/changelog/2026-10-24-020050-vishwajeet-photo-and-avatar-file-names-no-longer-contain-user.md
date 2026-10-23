---
date: 2026-10-24T02:00:50+05:30
author: vishwajeet
phase: "6B"
block: "V-FIX"
for: neeraj
title: "Photo and avatar file names no longer contain user ids"
---

# Photo and avatar file names no longer contain user ids

Your T1 finding (17 Oct): product photo file names started with the seller's id
(`f9c43cc9-…-1791897838329-9fjof8.jpeg`), so `image_urls` leaked `seller_id` after N-C hid it.
Avatars had the same problem (`<userId>-<Date.now()>.<ext>`). Stored files are now named
`<random uuid>.<ext>`.

## ⚠ I edited two files in your scope, as we agreed

- **`backend/src/modules/products/products.controller.js`** is on loan to you for 6B. The
  `OWNER:` banner is unchanged. What I changed:
  - the `randomUUID` import;
  - a `storageExt()` helper under the imports;
  - in `createProduct`, the two lines that built `fileName` became one line.
- **`backend/src/modules/user/user.controller.js`** is your module. The banner is unchanged.
  What I changed:
  - the same import and helper;
  - in the avatar handler, the two lines that built `newFileName` became one line.
- Nothing else in either file changed: not the bucket, not `upsert`, not the old-avatar
  deletion, not any response.

Also changed: `backend/API.md` (the two Part 1 notes that described the old names) and
`docs/PRE_LAUNCH_CHECKLIST.md` (a new section, "Wiping production before launch").

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None. `POST /api/products` and `POST /api/user/:userId/avatar` return the same shapes. Only
the file name at the end of each URL is different:

- **Before:** `…/products/<seller_id>-<ms>-<rand>.jpg` and `…/avatars/<userId>-<ms>.jpg`
- **Now:** `…/products/8ab33b2e-9df4-44f7-a763-9bd02ac9c93d.png` and
  `…/avatars/1b51bb6f-e197-42f5-8ec1-93c67ec4645e.webp`

**The extension rule (`storageExt`, the same in both files):**
1. If the original file name has a dot, take what follows the last dot. Use it, lower-cased,
   only if it matches `/^[a-z0-9]{1,5}$/i`.
2. Otherwise take it from `file.mimetype`: `image/jpeg` → `jpg`, `image/png` → `png`,
   `image/webp` → `webp`, any other `image/<x>` → `<x>`. The client sends the mimetype, so
   `<x>` must match the same pattern.
3. Otherwise `bin`.

A name with no dot never reaches the storage path. The old `split('.').pop()` returned the
whole name in that case.

Old URLs keep working. Files already in the buckets keep their old names until the
pre-launch wipe.

## New fields on existing responses

None.

## Test data

Run on 24 Oct against the local API and local Supabase, as `arjun.mehta` / `password123`:

- `node --check` passes on both controllers.
- `grep -rnE '\$\{(seller_id|userId)\}-' backend/src/` finds nothing.
- `storageExt` was run from both files on twelve names. Some results:
  - `IMG_0042.JPG` → `jpg`
  - `photo` + `image/jpeg` → `jpg`
  - `my-secret-filename` + `image/webp` → `webp`
  - `a.b.c.HEIC` → `heic`
  - `weird.toolongext` + `image/png` → `png`
  - `noext` + `image/svg+xml` → `bin`
  - `noext` + `image/../../evil` → `bin`
  - `noext` + `application/octet-stream` → `bin`
- **New listing**, with one photo uploaded as `arjun-holiday-photo` (no dot, `image/png`):
  201, and `image_urls` is `…/products/8ab33b2e-….png`.
- **Avatar, uploaded twice:**
  - The first upload (`Avatar1.PNG`) was stored as `89e2197a-….png`.
  - The second (`avatar2.webp`) was stored as `1b51bb6f-….webp`.
  - After the second, the `avatars` bucket held only the `.webp`, so the old avatar is still
    deleted.
- Afterwards I deleted the listing and both files, and set Arjun's `avatar_url` back to `null`.

## What NOT to do yet

- **Production files from before this change still have user ids in their names.** Wipe the
  `products` and `avatars` buckets, not only the tables, at the pre-launch wipe. It's in
  `docs/PRE_LAUNCH_CHECKLIST.md`.
- Don't build a storage path from a user id or the original file name again. Use
  `randomUUID()` and `storageExt()`.
