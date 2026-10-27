---
date: 2026-10-27T12:04:13+05:30
author: vishwajeet
phase: "6B"
block: "V-F"
for: neeraj
title: "Mark as Sold polish: smooth picker, tap to deselect, wider name search, new sold card and Relist dialog, grid overlap fix"
---

# Mark as Sold polish: smooth picker, tap to deselect, wider name search, new sold card and Relist dialog, grid overlap fix

The owner tried V-F (`2026-10-26-135948-vishwajeet-app-mark-as-sold-everywhere-picker-sold-cards-purc.md`)
on a phone and reported seven things. Where this entry and that one disagree, this one is right.

**Two things affect you:**
1. **Your `GET /api/users/search` finds more people now.** I changed `search_users()`, which it
   shares with buyer-candidates. Shapes are unchanged. See "Changed endpoints".
2. **`MARK_SOLD_SPEC.md` is now v1.1.** Three parts change for the website (N-H): tap again to
   deselect (§1), the sold card (§3), and the Relist dialog (§3).

**Nothing in `frontend/` changed.** In `backend/`, only `API.md` changed; no code file did.

## What changed

| # | Owner's report | Cause | Fix (app) | Website |
|---|---|---|---|---|
| 1a | The picker jumps as it opens | Reanimated's `SlideInDown` can draw the sheet for a frame in its final place before it moves. The sheet's height also changed under it: 3 skeleton rows became 1 loaded row, and a bottom-pinned sheet moves its top edge when its height changes | The rise is the sheet's own animation, starting a whole screen down in the very first frame. The list's height eases to each new size (220 ms) | Centred modal. Only add the height easing if you see a jump |
| 1b | A gap between the sheet and the keyboard | A `statusBarTranslucent` Modal is its own window, starting at the top of the screen. The keyboard avoider measured it against the app's window. The gap in the owner's screenshot is 63 px, about 34 dp, which is the status bar's height: consistent with that window leaving the status bar out, so the sheet was lifted a status bar too far. That fits the numbers but is unconfirmed on the phone | `KeyboardAvoider` gets `fillsModal`: it measures against the physical screen | Not affected |
| 2 | Searching `.ver` says no student matches | `search_users()` only matched a handle **prefix**, or a trigram similarity ≥ 0.3 to the **whole** string. `similarity('rahul.verma', '.ver')` is 0.231. `ver` and `@rah` failed the same way | New migration (below) | **Free:** your picker calls the same endpoint |
| 3 | Can't untap a wrongly picked person | Spec said exactly one row is always selected | Tapping the selected row clears it, and the button disables again (§1 v1.1) | Please match |
| 4 | The sold card looks crowded; Change buyer / Relist don't look tappable | v1's caption plus two text links | New layout (§3 v1.1): no location line or footer. One tinted **buyer box** (avatar, name, `Buyer · 27 Oct`, pencil) that is the Change buyer button, and a **Relist** pill beside delete | Please match |
| 5 | Dashboard heart: 1, then 2, then back to 1, then 0 | `GET /api/user/:userId/dashboard` sends **no `is_liked`** on `listings` (`user.controller.js`, your file). So every tap was sent as "not liked yet". The server toggled the like off, the app wrote that answer back (2 → 1), then refetched (0) | The heart on your **own** dashboard cards is a count, not a button (as on Depop and Vinted) | **Same bug on the web:** `Dashboard.jsx` passes `item.is_liked`, which is always undefined. Your call: make it a count like the app, or return `is_liked`/`is_saved` from your dashboard endpoint |
| 6 | The Relist confirmation (Android `Alert`) looks raw | The phone's own dialog | A new `ConfirmDialog`: the listing's photo with a gradient relist badge, a Bree Serif title, the gradient Relist button (§3 v1.1) | Please match the look (spec has every value) |
| 7 | After relisting, the Wacom card overlapped the card below it in the Marketplace | **A FlashList 2.3.2 bug, also in 2.3.3.** The grid keeps row heights by position. The Wacom arrived at index 0, a slot whose minHeight equalled its own height, so FlashList skipped it as "tallest". It placed row 2 under the shorter cycle card, and the repaint never corrected that | Patched with `patch-package` (`mobile/patches/`). Replayed in Node: unpatched gets stuck 17 dp short (one title line); patched lands right. Shrinking and shifting rows behave as before | Not affected (web grid is CSS) |

## Migrations applied

- **`supabase/migrations/20261027062548_search_users_word_match.sql`.** It is
  `create or replace` on `search_users()`. The signature, the returned columns, the demo
  isolation and the fail-closed viewer lookup are all unchanged.
- **Applied to the local database only.** I ran it with psql inside the local container, not
  `db reset`, so local test data survived. It isn't in the local migration ledger yet. **Not on
  production.** Vishwajeet pushes it.

## New endpoints

None.

## Changed endpoints (BREAKING)

### `GET /api/users/search` (yours) and `GET /api/products/:id/buyer-candidates?q=`: wider matching

The shapes are unchanged. The **set and order of results** changed.

**Matching:**
- The term is trimmed and lower-cased, and **one leading `@` is dropped**.
- It matches when the **handle contains it anywhere** (`ver` and `.ver` find `rahul.verma`).
- It matches when the **full name, or any word of it, starts with it** (`ver` finds
  "Rahul Verma"; `erm` doesn't match by name).
- Trigram similarity ≥ 0.3 still counts, as before.
- `_` and `%` now match literally. Before, the handle-prefix match treated `_` as a wildcard.

**Order:** the exact handle comes first, then the same campus, then **a new tier**, then
similarity. The new tier ranks a match at the start of the handle or name first, then a later
word or a piece of the handle, then similar-only. Your controller doesn't re-sort, so nothing
to change.

**Corrected in `API.md`:** it said "rahl still finds rahul". It doesn't, before or after this
change. Fuzzy matching catches a typo in a whole handle or name ("rahul.vrma", "rahl verma"),
not in a short fragment.

## New fields on existing responses

None.

## Test data

**Search,** on the local database as `priya.nair` (`b0…002`):

| Term | `rahul.verma` before | After |
|---|---|---|
| `.ver` | not found | `rahul.verma` (same campus) |
| `ver` | not found (similarity 0.231) | `rahul.verma` first, then other-campus handles containing "ver" |
| `@rah` | not found | `rahul.verma` |

- `a_` returned 50 rows, and every one contains a literal `a_`.
- A null viewer returns 0 rows.

**App:**
- `npx tsc --noEmit` and `npx expo export --platform android` pass.
- **Not yet checked on a phone.** The owner checks the app.

## What NOT to do yet

- **Don't upgrade `@shopify/flash-list`** without checking the patch. 2.3.3 still has the bug.
  The upgrade steps are in `mobile/CLAUDE.md` (gotchas).
- **Don't bring the like toggle back on the owner's dashboard cards**, unless the dashboard
  endpoint starts returning `is_liked`.
- Only the Relist dialog moved off the phone's `Alert`. "That wasn't me" and "Delete listing?"
  are still Alerts on the app. They can use `ConfirmDialog` later, but the owner hasn't asked.
