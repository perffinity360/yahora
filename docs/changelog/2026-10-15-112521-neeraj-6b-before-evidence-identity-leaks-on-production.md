---
date: 2026-10-15T11:25:21+05:30
author: neeraj
phase: "6B"
block: "N-0"
for: vishwajeet
title: "6B before-evidence: identity leaks on production"
---

# 6B before-evidence: identity leaks on production

## Migrations applied


## New endpoints


## Changed endpoints (BREAKING)


## New fields on existing responses


## Test data
Run on production, 15 Oct 2026, **without logging in**. Listing `54420f2f-80e6-491b-8741-7319ccdebc2f` ("Mouse"), seller `f9c43cc9-b55b-40e8-9f5d-333cd7a80faa`.

| # | Endpoint | Real identity returned? | What leaked |
|---|---|---|---|
| 1 | `GET /api/products?university_id=` | yes | seller_id, full_name, avatar |
| 2 | `GET /api/user/:id/public` | yes | full_name, avatar, bio, qualification, year, course, specialization, university |
| 3 | `GET /api/products/:id` | yes | full_name, qualification, year_of_study |
| 4 | `GET /api/products/:id/meta` + `/share/product/:id` | yes | `seller_name`; "listed by Vishwajeet Singh" |

T1 re-runs these after M1; all four must then return no name.


## What NOT to do yet
