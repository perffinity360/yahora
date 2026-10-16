---
date: 2026-10-16T12:45:46+05:30
author: neeraj
phase: "6B"
block: "N-C"
for: vishwajeet
title: "Identity rule live in products, share, user (N-C)"
---

# Identity rule live in products, share, user (N-C)

The identity rule from `backend/src/utils/viewer.js` now runs on all six endpoints in API.md
"The identity rule (Phase 6B)":
- A logged-out visitor or a demo account still sees every listing, but not the real student
  behind it.
- A student sees exactly what they saw before.

Comments and comment votes now have the campus check. `GET /api/products/:id` counts views
through `record_product_view()`.

**⚠ Products and share were edited on loan** (your V-A loan entry). The `OWNER:` banners are
unchanged. This is one PR across three modules (products, share, user), as runbook §2.2
allows. **It needs your review, and it must not merge before N-D is live (M1).**

Files:
- `backend/src/modules/products/products.controller.js`
- `backend/src/modules/products/products.routes.js` (comment only)
- `backend/src/modules/share/share.controller.js`
- `backend/src/modules/user/user.controller.js`
- `backend/src/modules/user/user.routes.js`
- `backend/API.md`

Everything is imported from `viewer.js`. Nothing in it was copied or re-implemented.

## Migrations applied

None. N-C uses your V-B functions (`record_product_view`).

## New endpoints

None.

## Changed endpoints (BREAKING)

- **`GET /api/user/:userId/public` now needs the token to see a real student.** It has
  `optionalAuth` and works like this:
  - **No token** (or a token with no campus) → `401 LOGIN_REQUIRED`.
  - **Demo account** → `404 USER_NOT_FOUND`.
  - **Student** → the same 200 as before.
  - **A demo persona** is shown to everyone.
  - **A missing user** is now `404 USER_NOT_FOUND`. It was a 500.

  The website sends the token from Block N-D. The app already does. **For V-D:** handle 401
  ("log in to see this profile") and 404.
- **`?user_id=` on `/public` is ignored in silence** (the IDOR, runbook §1.4). `is_liked` /
  `is_saved` belong to the token holder, or are absent when logged out. Keep sending it if you
  like; it does nothing.
- **`GET /api/users/by-username/:username`:** the same rule (401 / 404). It also applies to the
  `redirect_to` answer, so a non-student can't follow an old handle to a real student's new
  one. No screen calls this yet.
- **`GET /api/products`:** for a non-student viewer on a real campus, every item gets
  `seller: null`, `seller_hidden: true`, and **no `seller_id` key**.
- **`GET /api/products/:id`:**
  - For a non-student viewer on a real campus, the seller is hidden the same way.
  - Every comment gets `user: null`, `user_hidden: true`. The text stays.
  - A signed-in demo viewer still gets its own `is_liked` / `is_saved` / `user_vote`.
- **`GET /api/products/:id/meta`:** `seller_name` is **removed** (absent, not null), for
  everyone.
- **`GET /share/product/:id`:** the card line is now
  `₹<price> · listed by a student at <campus> on Yahora. Taking you there…`. Without a campus
  name it is `₹<price> on Yahora. Taking you there…`. It never names the seller.
- **`POST /api/products/:id/comments`:**
  - Another campus → `403 CROSS_CAMPUS_INTERACTION_BLOCKED`. This includes any demo account on a
    real listing.
  - A `parent_comment_id` that isn't a comment on the same listing → `400 INVALID_REFERENCE`.
  - A caller with no profile row → `404 NOT_FOUND`. It was a 500.
- **`POST /api/products/comments/:commentId/vote`:**
  - No such comment → `404 NOT_FOUND`.
  - Another campus → `403 CROSS_CAMPUS_INTERACTION_BLOCKED`.

A non-uuid parent or comment id is treated as missing: 400 for the parent, 404 for the vote.
It is not a 500.

## New fields on existing responses

- `seller_hidden: true`: products list and detail, **only** when the seller is hidden.
- `user_hidden: true`: each comment on the detail, **only** when hidden.
- `university_name`: `GET /api/products/:id`, for **every** viewer. It is the only addition to
  a student's response.

**Client rule (API.md):** a hidden flag means "draw **Yahora student**", with no avatar and no
profile link. A `null` seller or user with the flag set is a normal response, not an error.

## Test data

Run locally against `supabase db reset` data with V-B's migrations, using
`arjun.mehta`/`password123` and a fresh `demo-login`. These are the runbook's checkpoint N-C
checks:
- **1. List:**
  - Anonymous and demo get `seller: null`, `seller_hidden: true`, and no `seller_id`.
  - The student gets the seller as before.
- **2. Cycle `e0…007` as demo:**
  - The seller is hidden and `university_name` is "IIITDM Kurnool".
  - Both questions are `user: null, user_hidden: true`.
  - As the student, every name shows and there are no hidden keys.
- **3. Priya's `/public`:**
  - Anonymous → `LOGIN_REQUIRED`.
  - Demo → `USER_NOT_FOUND`.
  - Student → `"full_name": "Priya Nair"`.
- **4. `by-username/priya.nair`:**
  - Demo → `USER_NOT_FOUND`.
  - Anonymous → `LOGIN_REQUIRED`.
- **5. Demo comments on the Wacom `e0…004`** → `CROSS_CAMPUS_INTERACTION_BLOCKED`.
- **6. Wacom `/meta`:** `grep -c seller_name` → `0`.
- **Views on the Wacom:**
  - Two opens as the student → +1.
  - An anonymous open and a demo open → +0.
- **Extra checks:**
  - A demo vote on a real comment → 403.
  - A vote on a missing comment → 404.
  - A reply whose parent is on another listing → 400.
  - A valid same-campus reply and vote → OK. The test reply was deleted afterwards.
  - The demo persona `rahul.sharma` is visible to anonymous callers, on both profile routes.
  - `?user_id=` on a profile gives no flags to an anonymous caller.

**Not exercised:** the `redirect_to` branch. The local `username_history` has no live rows.

## What NOT to do yet

- **Do not merge before N-D is live. The old website crashes on `seller: null`** (runbook §1.5,
  §2.4 M1). The order is: N-D merges, Netlify finishes, a product page is checked, and only then
  N-C merges.
- Don't call `increment_product_views()` anywhere. Nothing calls it now.
- **Open question for both of us:**
  - On the product page, commenters are hidden by the **listing's** campus. `viewer.js` says a
    commenter's campus should be their **own**.
  - The two differ only for comments made across campuses before this block. A real student's
    old comment on a **demo** listing still shows to logged-out visitors, which is a small leak.
    A demo guest's old comment on a real listing is hidden, which fails closed.
  - Closing the leak means reading each comment's `university_id` and stripping it before the
    response.
  - Say if you want it, and in which block.
