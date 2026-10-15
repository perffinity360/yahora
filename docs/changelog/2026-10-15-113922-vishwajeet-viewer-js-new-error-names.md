---
date: 2026-10-15T11:39:22+05:30
author: vishwajeet
phase: "6B"
block: "V-A"
for: neeraj
title: "viewer.js + new error names"
---

# viewer.js + new error names

V-A adds the shared pieces N-C builds on. **Nothing calls them yet, so no endpoint behaves
differently.**

Files:

- `backend/src/utils/viewer.js` (**new**)
- `backend/src/utils/respond.js`: only the `mapDbError` body changed. `sendError` and
  `sendPage` are byte-identical.
- `backend/API.md`:
  - the new section "The identity rule (Phase 6B)", placed after "Read this before any Part 1
    endpoint";
  - 11 new rows in the error-code table;
  - the `ACCOUNT_SUSPENDED` / `POSTING_RESTRICTED` TODO reworded to match the new code. It is
    still open.

## viewer.js: the identity rule in one place

The rule: a real student's name, photo, @username, bio and academic details are shown only to
signed-in students from real campuses. Logged-out visitors and demo accounts still see the
listings, but not the person. People on the demo campus are shown to everyone. The full
reasoning is in the file header and in API.md.

**Import from it; don't edit it.** It's under `utils/`, which is frozen shared infra.

| Export | What it does |
|---|---|
| `resolveViewer(req)` (async) | Returns `{ id, universityId, kind }`. `kind` is `'anonymous'` (no token, **or** a token with no `users` row or no campus), `'demo'` or `'student'`. It throws the Supabase error if the lookup fails. |
| `isDemoCampus(universityId)` (async) | `true` only for the demo campus. A `null` or unknown id gives `false`. The demo ids are cached for 10 minutes. |
| `canSeeIdentity(viewer, subjectIsDemo)` | `true` when `viewer.kind === 'student'` or `subjectIsDemo === true`. |
| `hideSeller(product)` | Changes the row in place: deletes `seller_id`, sets `seller = null` and `seller_hidden = true`. Returns the row. |
| `hideCommenters(comments)` | Changes each comment in place: deletes `user_id`, sets `user = null` and `user_hidden = true`. The text stays. |

**How to use it:**

1. `resolveViewer` reads `req.user`, so **the route needs `optionalAuth` or `requireAuth` in
   front of it.** Without one, `req.user` is never set and every caller comes back
   `'anonymous'`. That fails closed, but it hides everyone from everyone.
2. Resolve the viewer once per request, then ask `canSeeIdentity()` for each person you
   return:

```js
import { resolveViewer, isDemoCampus, canSeeIdentity, hideSeller } from '../../utils/viewer.js';

const viewer = await resolveViewer(req);   // inside your try, so a lookup error reaches the catch
const sellerIsDemo = await isDemoCampus(product.university_id);
if (!canSeeIdentity(viewer, sellerIsDemo)) hideSeller(product);
```

- `subjectIsDemo` is about the **person's** campus, not the viewer's. For a seller, that's the
  listing's `university_id`. For a commenter, it's the commenter's own campus.
- `isDemoCampus` is cached, so calling it once per row in a list is cheap. Only the first call
  in ten minutes hits the database.

The six endpoints and what each one hides are in the table in API.md, "The identity rule
(Phase 6B)". That table is the contract for N-C.

## New error names (`mapDbError`)

The trigger-name list in `mapDbError` is now a name → status map, `RAISED_STATUS`.

**The seven existing names keep their exact statuses.** I checked them against the old
`startsWith('RATE_LIMIT')` / `=== 'BLOCKED'` logic before replacing it:

- `USERNAME_RESERVED` 400
- `BLOCKED` 403
- `NESTED_REPLY_NOT_ALLOWED` 400
- `RATE_LIMIT_POSTS` 429
- `RATE_LIMIT_REPLIES` 429
- `POSTING_RESTRICTED` 400
- `ACCOUNT_SUSPENDED` 400

They're also still checked in the same order.

The ten new names are exactly the ones the tested SQL in `docs/runbooks/phase6b/` raises:

| Name | HTTP | Raised by |
|---|---|---|
| `MESSAGE_NOT_FOUND` | 404 | `delete_message_for_everyone()`, `hide_message_for_me()` |
| `NOT_MESSAGE_SENDER` | 403 | `delete_message_for_everyone()` |
| `DELETE_WINDOW_EXPIRED` | 403 | `delete_message_for_everyone()` |
| `REPLY_TARGET_INVALID` | 400 | `fill_message_reply()` trigger |
| `PRODUCT_NOT_FOUND` | 404 | `mark_product_sold()`, `mark_product_available()`, `get_product_buyer_candidates()` |
| `NOT_PRODUCT_OWNER` | 403 | the same three |
| `BUYER_NOT_FOUND` | 404 | `mark_product_sold()` |
| `BUYER_IS_SELLER` | 400 | `mark_product_sold()` |
| `BUYER_NOT_ON_CAMPUS` | 400 | `mark_product_sold()` |
| `PURCHASE_NOT_FOUND` | 404 | `remove_my_purchase()` |

**For N-E:** call the Mark-as-Sold RPCs and pass any error straight to `mapDbError(res,
error)`. Don't re-check the owner, the buyer or the campus in JavaScript first. The function
already decides, and two copies of a rule drift apart.

`LOGIN_REQUIRED` (401) isn't a database name, so it isn't in the map. N-C sends it with
`sendError(res, 401, 'LOGIN_REQUIRED')`. It's in API.md's error table.

## Migrations applied

None. The three Phase 6B migrations are V-B.

## New endpoints

None.

## Changed endpoints (BREAKING)

None. `mapDbError` gives the same status and body for every name it handled before. The ten
new names can't be raised until V-B's migrations are applied.

## New fields on existing responses

None yet. N-C adds `seller_hidden`, `user_hidden` and `university_name`, as listed in API.md.

## Test data

None needed: nothing calls the new code. Checked:

- `node --check` passes on both files.
- The backend boots and `GET /api/health` answers.

## What NOT to do yet

- Nothing calls viewer.js yet. N-C is the first caller.
- Don't copy the rule into a module ("is this a demo user?" written inline). Import it from
  viewer.js, so one file decides who sees whom.
- If a new RAISE name is ever added, add it to `RAISED_STATUS` in the same change. A name
  that isn't in the map comes back as 500. Ask Vishwajeet, because the file is frozen.
