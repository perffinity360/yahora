---
date: 2026-10-17T15:04:30+05:30
author: neeraj
phase: "6B"
block: "T1"
for: vishwajeet
title: "M1 live: identity rule + views"
---

# M1 live: identity rule + views

## Migrations applied


## New endpoints


## Changed endpoints (BREAKING)


## New fields on existing responses


## Test data

Run on production, 17 Oct 2026, after N-D (PR #71) and N-C (PR #70) were merged. Same listing and seller as the N-0 evidence: listing `54420f2f-80e6-491b-8741-7319ccdebc2f` ("Mouse"), seller `f9c43cc9-b55b-40e8-9f5d-333cd7a80faa`.

| # | Check | Before (N-0, 15 Oct) | Now | Result |
|---|---|---|---|---|
| 1 | products list (logged out + demo) | seller names | `seller: null`, `seller_hidden: true` | ✅ |
| 2 | `/user/:id/public` logged out | full profile | `LOGIN_REQUIRED` | ✅ |
| 2b | `/user/:id/public` as demo | full profile | `USER_NOT_FOUND` | ✅ |
| 3 | `/products/:id` logged out | name, year | seller hidden, `university_name` "IIITDM Kurnool" | ✅ |
| 4 | `/meta` + `/share/product/:id` | "listed by Vishwajeet Singh" | no `seller_name`; "listed by a student at IIITDM Kurnool" | ✅ |
| 4b | demo comments on a real listing | allowed | `CROSS_CAMPUS_INTERACTION_BLOCKED` | ✅ |
| 5 | browser, logged out, product page | name | "A student at IIITDM Kurnool" + Log in | ✅ |
| 6 | browser, logged out, profile link | profile | "Log in to see this profile" | ✅ |
| 7 | browser, logged in as a student | names | names, photos, profiles exactly as before | ✅ |
| 8 | views: open + 3 reloads, logged in | +1 per load | first try: no views counted at all (Mouse and Study Chair stuck at 10). After Vishwajeet's fix: both 10 → 11, reloads add nothing | ✅ after fix |

Findings for Vishwajeet:
- Views weren't recorded on production right after M1 (fixed by Vishwajeet the same day, database only, no code change).
- Low priority: product photo file names start with the seller's user id (`f9c43cc9-…-1791897838329-9fjof8.jpeg`), so the seller id is still visible inside `image_urls` even though the API hides `seller_id`. Not blocking.


## What NOT to do yet
