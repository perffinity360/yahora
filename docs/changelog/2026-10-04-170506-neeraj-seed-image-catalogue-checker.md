---
date: 2026-10-04T17:05:06+05:30
author: neeraj
phase: "6A"
block: "N-C"
for: vishwajeet
title: "Seed-image catalogue + checker"
---

# Seed-image catalogue + checker

New files, all under `scripts/seed-images/`. No seed file, SQL, backend, mobile or supabase
file was touched.

- `catalogue.json`: `{ "<exact product title>": ["<image url>", ...] }`. It covers 50 of the
  100 unique seed titles with 87 images (1 to 3 per product). 34 are portrait (39%).
  Keys are copied byte-for-byte from `supabase/seed.sql`, `backend/scripts/seedLocal.js` and
  `backend/scripts/seedDemo.js`, em dashes included. "Bajaj 1.5L Electric Kettle" appears
  twice in `seed.sql` (sold and available rows), and its single key covers both.
- `credits.json`: keyed by image URL, `{ author, license, page }`. Every image is
  CC0, public domain, CC BY or CC BY-SA from Wikimedia Commons. CC BY / BY-SA require the credit
  to travel with the image wherever we show it publicly.
- `check.mjs`: Node 22, no dependencies. Pulls every URL out of the three seed files and
  `catalogue.json` and requests each one. It fails unless the answer is 2xx with `image/*`. 429/503
  are retried with backoff. Seed titles with no catalogue entry are printed as a warning only.
  - `node scripts/seed-images/check.mjs`: all four sources
  - `node scripts/seed-images/check.mjs catalogue`: catalogue only
- `review.html`: every catalogue image in a 1:1 `object-fit: cover` box, the same crop as
  `frontend/src/components/ProductCard/ProductCard.module.css` `.imageWrap`. The title and
  credit are shown under each image. Serve the folder over http, or open the file and pick
  both JSON files.

Image URLs are exactly what the Commons API returned for `iiurlwidth=800`. Thumbnails come
back on `thumb.wikimedia.org` (960px bucket, `utm_*` query included). Files narrower than 800px
come back as originals on `upload.wikimedia.org`. Do not rewrite or trim these URLs.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

- `node scripts/seed-images/check.mjs catalogue` → `84/84 URLs OK · 0 dead`, exit 0
  (87 entries, 84 unique: three images are shared between near-identical titles).
- `node scripts/seed-images/check.mjs` today → `143/147 URLs OK · 4 dead`, exit 1. All 4 are
  the known dead Unsplash links in `seedDemo.js`.

## What NOT to do yet

- **Vishwajeet applies this in V-D. Neeraj does not edit the seed files.** For each title in
  `catalogue.json`, replace that product's `image_urls` / `imgs` with the catalogue array as-is.
  Titles not in the catalogue keep their current images. `check.mjs` lists them as a warning.
- **`node scripts/seed-images/check.mjs` must pass (exit 0) after V-D.** Heads-up: of the 4
  dead `seedDemo.js` links, only the Samsung monitor has a catalogue entry. The other three
  have no photo yet, so the full check will still fail on them until Neeraj picks images by hand:
  - DSA Made Easy — Narasimha Karumanchi (Latest Edition)
  - Nike Dri-FIT Oversized Hoodie — Olive Green, Size L
  - Philips Dry Iron + Usha Room Heater — Winter Bundle
- Don't add placeholder or "close enough" photos for the 50 uncovered titles. Each needs a
  photo of the actual product, chosen by hand.
- Don't source seed images from crime-evidence, law-enforcement or news-event material, even
  when it is public domain. That means no `EFTA…` files, no FBI/police authors, and no file
  whose Commons categories are about a crime, raid, evidence, court case, disaster or news event.
  Check the file page's categories before adding an image.
- Don't hotlink Pixabay: its terms forbid hotlinking and its URLs expire in 24h.
