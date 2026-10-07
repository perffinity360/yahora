---
date: 2026-10-07T11:09:35+05:30
author: neeraj
phase: "6A"
block: "N-C"
for: vishwajeet
title: "Seed-image catalogue: 23 titles for V-D"
---

# Seed-image catalogue: 23 titles for V-D

Follow-up to [Seed-image catalogue + checker](2026-10-04-170506-neeraj-seed-image-catalogue-checker.md).
`scripts/seed-images/catalogue.json` and `credits.json` changed. Entries were appended, plus one
removal from the earlier batch after review (see below). `review.html` also changed (see below). No seed file, SQL, backend, mobile or supabase file was touched.

All 23 requested titles were checked against `supabase/seed.sql`, `backend/scripts/seedLocal.js`
and `backend/scripts/seedDemo.js` before use as keys. Every one matches exactly, em dashes included.
**11 of the 23 now have a catalogue entry. 12 have no usable photo and are deliberately absent.**

Match levels: **A** = the named brand/model or the actual named book (for a title that names no
brand, the right object). **B** = the right kind of object with no brand name or logo visible.
**C** = nothing usable, so no entry.

| Title | Level | Photos | Source |
|---|---|---|---|
| SG Cricket Kit — bat, pads and gloves | A (SG bat only) | 1 | Commons |
| GATE CSE Made Easy Study Set (2024 edition) | C | — | — |
| Foldable Study Table with Bookshelf | C | — | — |
| Hero Sprint 26T Gear Cycle | C | — | — |
| Bajaj 1.5L Electric Kettle | B | 2 | Commons |
| Logitech MX Master 3 Wireless Mouse | A* | 2 | Commons |
| Steel Almirah — 4 shelves, lockable | C (removed after review) | — | — |
| Redmi 20000mAh Power Bank | B | 1 | Commons |
| Clamp-on LED Study Lamp | C | — | — |
| Godrej 45L Mini Fridge | C | — | — |
| DSA textbook set — Cormen, Karumanchi, Sedgewick | A (Cormen only) | 1 | Openverse |
| Dell 24-inch IPS Monitor | A | 2 | Openverse |
| Studds Full-Face Helmet — ISI marked, size M | A | 1 | Openverse |
| Aptitude and Reasoning prep set | C | — | — |
| Orient Table Fan — 400mm | B | 1 | Commons |
| Engineering Thermodynamics — P.K. Nag, 6th edition | C | — | — |
| Decathlon rain jacket — navy, size M | C | — | — |
| Hero Sprint 26T geared cycle with lock | C | — | — |
| Prestige 1.5 L electric kettle | B | 2 (same as Bajaj) | Commons |
| Cosco badminton racquets — pair, with shuttles | B | 1 | Openverse |
| DSA Made Easy — Narasimha Karumanchi (Latest Edition) | C | — | — |
| Nike Dri-FIT Oversized Hoodie — Olive Green, Size L | C | — | — |
| Philips Dry Iron + Usha Room Heater — Winter Bundle | B | 2 | Commons + Openverse |

Notes on individual picks:
- **MX Master 3 (A\*):** the photos are of the **MX Master 3S**, the externally identical successor
  ("logi" logo, same shell, no "3S" marking visible). Commons and Openverse have no usable plain
  MX Master 3 photo.
- **Dell:** one Dell U2412M (24" IPS) and one Dell 2407WFP (24"). Both show the Dell logo.
- **Philips + Usha:** the iron is a real Philips dry iron (per the uploader's description) with no
  logo in frame. The heater is an unbranded Indian quartz-rod heater. Its only text is the
  photographer's own corner watermark. No Usha photo exists.
- **Kettles:** both photos are logo-free at full size, which is why Bajaj and Prestige may share them.
- **Cosco:** the "Badminton Racket Pair with shuttles" photos show brands (a Wilson stencil, shaft
  text, a frame logo), so they were not reused. The new photo is CC0 via rawpixel. Openverse gives
  no creator, so `credits.json` says `"author": "unknown"`.
- Openverse URLs are the `url` field exactly as the API returned it. Openverse credits:
  `author` = `creator`, `page` = `foreign_landing_url`. Commons URLs are the `iiurlwidth=800`
  thumbnails, as before.

Review changes (Neeraj looked at every new photo in `review.html`):
- **Removed: Steel Almirah — 4 shelves, lockable.** The square crop left only two green door
  panels and a handle, with no visible shelves. A second search found no almirah or cupboard
  photo that fits the square crop, so the title is now C.
- **Removed: Cotton Formal Shirts — set of 3, size M** (from the [first batch](2026-10-04-170506-neeraj-seed-image-catalogue-checker.md)).
  It showed a shop rack of about 15 shirts for a set-of-3 listing. A second search found no photo
  of a few formal shirts with no brand visible, so this title is now C as well.
- Both removed URLs were used by no other title, and their `credits.json` entries were deleted too.
- `review.html` bug fix: each credit link now shows the real source site, read off the credit's `page` URL
  (Wikimedia Commons / Flickr / rawpixel). It used to say "Wikimedia Commons" for every image.
  `credits.json` is unchanged by this fix.

Totals: 60 titles, 102 images, **41 portrait (40.2%)**. Before this follow-up: 50 / 87 / 34
(39.1%). This follow-up added 11 titles / 16 images / 7 portrait and removed the shirts title (1 landscape image).

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

- `node scripts/seed-images/check.mjs catalogue` → `97/97 URLs OK · 0 dead`, exit 0
  (102 entries, 97 unique: the two kettle titles share two URLs, plus the three older shared ones).

## What NOT to do yet

- **Vishwajeet applies this in V-D, same rule as before:** for each of the 11 new titles, replace
  that product's images with the catalogue array as-is. The 12 C titles keep their current images. So does "Cotton Formal Shirts — set of 3, size M",
  which no longer has an entry.
- **The full `check.mjs` still fails after V-D** on the dead `seedDemo.js` links for
  "DSA Made Easy — Narasimha Karumanchi (Latest Edition)" and
  "Nike Dri-FIT Oversized Hoodie — Olive Green, Size L". Neither has a usable photo. The Philips/Usha
  link is now covered. Those two need a decision (a different image source or dropping the product),
  not a "close enough" photo.
- Don't use generic piles of books for the book titles. No photo of the actual GATE Made Easy,
  P.K. Nag or Karumanchi books exists on Commons or Openverse.
- Same sourcing rules as the first entry: no Pixabay (that includes Pixabay re-uploads on Commons),
  and no crime, law-enforcement, evidence, court, disaster or news-event material.
