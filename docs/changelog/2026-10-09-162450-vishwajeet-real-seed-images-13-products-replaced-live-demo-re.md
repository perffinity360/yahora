---
date: 2026-10-09T16:24:50+05:30
author: vishwajeet
phase: "6A"
block: "V-D"
for: neeraj
title: "Real seed images, 13 products replaced, live demo repair SQL"
---

# Real seed images, 13 products replaced, live demo repair SQL

Every seeded product that had a placeholder now shows real photos from your
`scripts/seed-images/catalogue.json`. 13 branded or unphotographable products were
swapped for generic ones that do have good photos.

**Heads-up: Vishwajeet edited two files in your `scripts/seed-images/` folder.** This
happened in earlier steps of this block, not in the seed-file step:

- In `catalogue.json` I added 13 new title keys (the "new" column below) and removed one I
  had briefly added, "Lab coat — white, size M". It was the wrong category for the slot it
  replaced.
- In `credits.json` I added one credit per new URL and removed the lab coat's.
- All new photos follow your rules: Commons API, `iiurlwidth=800`, URLs exactly as
  returned, CC0 / PD / CC BY / CC BY-SA only. Each was checked for brands, faces and the 1:1
  centre crop. Nothing else in the folder changed.

## The 13 replacements (old → new)

Each row was replaced in place. Its id, seller, university, category, location, condition,
status, views, likes and dates are unchanged; only the title, description, price and photos
changed.

| File | Old title | New title |
|---|---|---|
| `supabase/seed.sql` | GATE CSE Made Easy Study Set (2024 edition) | Whiteboard — 2 x 3 ft, with markers |
| `supabase/seed.sql` | Foldable Study Table with Bookshelf | Wooden Bookshelf — 4 shelves |
| `supabase/seed.sql` | Hero Sprint 26T Gear Cycle | 26T Geared Cycle |
| `supabase/seed.sql` | Cotton Formal Shirts — set of 3, size M | White Formal Shirt — size M |
| `supabase/seed.sql` | Steel Almirah — 4 shelves, lockable | Wooden Stool |
| `supabase/seed.sql` | Clamp-on LED Study Lamp | Bean Bag — XL |
| `supabase/seed.sql` | Godrej 45L Mini Fridge | Pressure Cooker — 3 L |
| `supabase/seed.sql` | Aptitude and Reasoning prep set | Spiral Notebooks — pack of 6 |
| `backend/scripts/seedLocal.js` | Engineering Thermodynamics — P.K. Nag, 6th edition | Desk Globe — 30 cm |
| `backend/scripts/seedLocal.js` | Decathlon rain jacket — navy, size M | Denim Jacket — size M |
| `backend/scripts/seedLocal.js` | Hero Sprint 26T geared cycle with lock | Kick Scooter — foldable |
| `backend/scripts/seedDemo.js` | DSA Made Easy — Narasimha Karumanchi (Latest Edition) | DSA Handwritten Notes — Full Semester, Spiral-Bound |
| `backend/scripts/seedDemo.js` | Nike Dri-FIT Oversized Hoodie — Olive Green, Size L | Foldable Umbrella — black |

## Other seed changes

- **`supabase/seed.sql`**
  - Every `placehold.co` array now holds the catalogue photos for that exact title: 41
    rows, 0 placeholders left.
  - Three seeded texts changed because they no longer fitted the new products:
    - Comment `e1…003` now asks whether the whiteboard comes with markers and an eraser.
    - Message `f0…007` drops "Hero Sprint".
    - Message `f0…010` now says the cycle is "the white one", because the photo shows a white
      bike.
  - Two code comments that named the placeholder service were reworded.
- **`backend/scripts/seedLocal.js`**
  - `image_urls` comes from `catalogue.json` by exact title.
  - The lookup runs when the file loads, before any database write. A title with no catalogue
    entry throws an error naming that title; there is no placeholder fallback.
  - **If you rename a seedLocal listing, add a catalogue key for the new title, or the script
    will not start.**
- **`backend/scripts/seedDemo.js`**
  - Besides the two replacements, "Samsung 24" FHD IPS Monitor — HDMI + VGA" and "Philips Dry
    Iron + Usha Room Heater — Winter Bundle" kept their titles and got their catalogue photos
    in place of the two dead Unsplash links.
  - All four previously dead demo links are gone.
  - No other demo image changed.

## Production repair (written, NOT run)

[`docs/runbooks/phase6a-vd-production-repair.sql`](../runbooks/phase6a-vd-production-repair.sql)

seedDemo.js skips any title that already exists on the demo tenant, so the live demo needs a
one-off fix for 4 rows. The file has three steps:

- (a) BEFORE checks: expect 4 old rows and 0 new titles.
- (b) One `UPDATE … FROM (VALUES …)` matched on exact title plus `domain = 'demo.yahora.com'`.
- (c) AFTER check: expect 4 rows with the new links.

The values are byte-identical to the new seedDemo.js. I dry-ran it locally inside a rolled-back
transaction against a simulated pre-repair state, and the result matched a fresh seedDemo run
(0 mismatching rows). Vishwajeet runs it on production by hand.

## Migrations applied

None. No schema change.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

All of these were run locally:

- `supabase db reset` applied every migration and seeded cleanly.
- `node backend/scripts/seedLocal.js` → 696 students and 928 products across 116 universities.
- `node backend/scripts/seedDemo.js` → 40 products, 15 users.
- `node scripts/seed-images/check.mjs` → `175/175 URLs OK · 0 dead`, "All checks passed."
- `grep -c placehold.co supabase/seed.sql backend/scripts/*.js` → 0 for every file.
- check.mjs still warns about 27 seed titles with no catalogue entry: 4 Unsplash rows in
  seed.sql and 23 in seedDemo.js. They keep their current images. None of the 13 old or new
  titles is among them.

## What NOT to do yet

- Don't re-run seedDemo.js against production before the repair SQL has run there. It would
  add the two new products next to the old ones.
- Two demo listings now overlap with fallback titles. "Magnetic Whiteboard (2×1.5 ft) + 5
  Markers + Duster" sits next to seed.sql's new whiteboard, and "Wrangler Denim Jacket —
  Unisex, Size M" next to seedLocal's denim jacket. They are on different tenants, so nothing
  collides, but say if you want either changed.
