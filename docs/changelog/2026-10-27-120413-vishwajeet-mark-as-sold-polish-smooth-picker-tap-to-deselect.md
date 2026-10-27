---
date: 2026-10-27T12:04:13+05:30
author: vishwajeet
phase: "6B"
block: "V-F"
for: neeraj
title: "Mark as Sold polish: smooth picker, tap to deselect, wider name search, new sold card, Relist and Delete dialogs, dashboard likes fixed, grid overlap fix"
---

# Mark as Sold polish: smooth picker, tap to deselect, wider name search, new sold card, Relist and Delete dialogs, dashboard likes fixed, grid overlap fix

The owner tried V-F (`2026-10-26-135948-vishwajeet-app-mark-as-sold-everywhere-picker-sold-cards-purc.md`)
on a phone and reported seven things, then three more on the same day (#8–#10). Where this entry and that one disagree, this one is right.

**Five things affect you:**
1. **I edited your backend file `user.controller.js`** (owner's decision, 27 Oct):
   `GET /api/user/:userId/dashboard` now sends `is_liked` / `is_saved` on each listing. Additive.
   See "New fields on existing responses".
2. **I edited your `ProductCard.jsx` / `.module.css`**, and on merging main I replaced your N-H
   sold-card block (the `Sold to …` line + pills) with the v1.1 buyer box. See the ⚠ section.
3. **Your `GET /api/users/search` finds more people now.** I changed `search_users()`, which it
   shares with buyer-candidates. Shapes are unchanged. See "Changed endpoints".
4. **`MARK_SOLD_SPEC.md` is now v1.2.** For the website (N-H): tap again to deselect (§1), the
   sold card (§3, now built on the web by me), the Relist dialog (§3), and the heart on your own
   cards stays a button (§3).
5. **The app's Delete listing confirmation is now an in-app dialog** (spec §3 v1.2). The web's
   Delete modal already was one, so it is unchanged.

## ⚠ I edited yours: `backend/src/modules/user/user.controller.js` (`getDashboardData` only)

Its banner says Vishwajeet doesn't edit it. The owner chose to anyway, so the like button on
your own dashboard cards can work. I added one block after the buyer flattening: two queries on
`product_likes` / `product_saves` for the caller and the listing ids, then `is_liked` /
`is_saved` on every listing. It is a copy of what `getPublicProfile` in the same file already
does. Nothing else in the handler changed. `API.md` is updated.

## ⚠ I edited yours: `frontend/src/components/ProductCard/` (merged with your N-H)

The owner asked for the web's sold card to look like the app's. I built it, then merged main
(your N-H) into this branch. `npm run build` passes. I haven't checked any of it in a browser.

- **The sold card (spec §3 v1.1).** When `isOwner` and `status === "sold"`, the location tag and
  the time/actions row are replaced by a tinted **buyer box**: your `AvatarImg` (photo with the
  seller photo's purple ring, else initials), or `UserX` for someone not on Yahora; the name or
  `Not on Yahora`; `Buyer · <formatShortDate(sold_at)>`; a pencil. The box is the Change buyer
  button (`onChangeBuyer`). Under it are a **Relist** pill (`onMarkAvailable`, so your Relist
  dialog) and the delete button.
- **On the merge I removed your N-H `.soldInfo` block** (the `Sold to … · <date>` line and the
  Change buyer / Relist pills) and its CSS. The owner reviewed that layout on the app and replaced
  it with the buyer box (spec §3 v1.1), so the two can't both stand. I kept your `soldToViewer`
  (no like or save on someone else's sold listing), and your hover-only-on-`(hover: hover)` rule,
  now applied to the box and the pill.
- **`Dashboard.jsx` is yours as on main.** On the merge I dropped all my edits to it: your
  `BuyerPicker`, `handleBuyerSaved` and Relist dialog replace the old modal I had patched. Your
  `onChangeBuyer` / `onMarkAvailable` wiring drives the new card unchanged.
- **The like toggles in `Dashboard.jsx` are untouched.** With `is_liked` now coming from the
  server, `handleToggleGridLike` / `handleToggleGridSave` are correct as they are.

**Not changed on the web, and why:**
- **The overlay before the sheet:** your modals' overlay and card already start together.
- **The Delete confirmation:** yours is already an in-app modal.
- **Deselect (§1 v1.1) — still to do in your `BuyerPicker`:** a click on the selected row should
  clear it (and fade the button again). Today `onSelect={setSelected}` only ever sets it. I left
  your new component alone.
- **Search (#2):** the database fix covers the website.
- **Grid overlap (#7):** the web grid is CSS, not FlashList.

## What changed

| # | Owner's report | Cause | Fix (app) | Website |
|---|---|---|---|---|
| 1a | The picker jumps as it opens | Reanimated's `SlideInDown` can draw the sheet for a frame in its final place before it moves. The sheet's height also changed under it: 3 skeleton rows became 1 loaded row, and a bottom-pinned sheet moves its top edge when its height changes | The rise is the sheet's own animation, starting a whole screen down in the very first frame. The list's height eases to each new size (220 ms) | Not built yet (N-H). Centred modal: only add the height easing if a jump shows |
| 1b | A gap between the sheet and the keyboard | A `statusBarTranslucent` Modal is its own window, starting at the top of the screen. The keyboard avoider measured it against the app's window. The gap in the owner's screenshot is 63 px, about 34 dp, which is the status bar's height: consistent with that window leaving the status bar out, so the sheet was lifted a status bar too far. That fits the numbers but is unconfirmed on the phone | `KeyboardAvoider` gets `fillsModal`: it measures against the physical screen | Not affected |
| 2 | Searching `.ver` says no student matches | `search_users()` only matched a handle **prefix**, or a trigram similarity ≥ 0.3 to the **whole** string. `similarity('rahul.verma', '.ver')` is 0.231. `ver` and `@rah` failed the same way | New migration (below) | **Free:** your picker calls the same endpoint |
| 3 | Can't untap a wrongly picked person | Spec said exactly one row is always selected | Tapping the selected row clears it, and the button disables again (§1 v1.1) | Old modal has no selection step. Build to v1.1 in N-H |
| 4 | The sold card looks crowded; Change buyer / Relist don't look tappable | v1's caption plus two text links | New layout (§3 v1.1): no location line or footer. One tinted **buyer box** (avatar, name, `Buyer · 27 Oct`, pencil) that is the Change buyer button, and a **Relist** pill beside delete | **Built on the web by me** (#10) |
| 5 | Dashboard heart: 1, then 2, then back to 1, then 0 | `GET /api/user/:userId/dashboard` sent **no `is_liked`** on `listings`. So every tap was sent as "not liked yet". The server toggled the like off, the app wrote that answer back (2 → 1), then refetched (0) | The endpoint now sends `is_liked` / `is_saved`. The dashboard heart uses the shared `useToggleLike(['dashboard', id])`, which guards double taps and updates every other screen | **Same cause on the web** (after a reload every heart showed empty, and a click on a liked one removed the like). Fixed by the endpoint, with no web change |
| 6 | The Relist confirmation (Android `Alert`) looks raw | The phone's own dialog | A new `ConfirmDialog`: the listing's photo with a gradient relist badge, a Bree Serif title, the gradient Relist button (§3 v1.1) | The web has **no** Relist confirmation at all yet. Build v1.1's dialog in N-H |
| 7 | After relisting, the Wacom card overlapped the card below it in the Marketplace | **A FlashList 2.3.2 bug, also in 2.3.3.** The grid keeps row heights by position. The Wacom arrived at index 0, a slot whose minHeight equalled its own height, so FlashList skipped it as "tallest". It placed row 2 under the shorter cycle card, and the repaint never corrected that | Patched with `patch-package` (`mobile/patches/`). Replayed in Node: unpatched gets stuck 17 dp short (one title line); patched lands right. Shrinking and shifting rows behave as before | Not affected (web grid is CSS) |
| 8 | The dark overlay shows before the picker sheet | The scrim was drawn at full strength at once, while the sheet started a whole screen down | The scrim fades in on the sheet's own 320 ms, and the sheet starts its own measured height below the edge (spec §1 v1.2) | Not affected (overlay and modal already start together) |
| 9 | The Delete confirmation (Android `Alert`) looks raw | The phone's own dialog | `ConfirmDialog` gets `tone: 'danger'`: the photo with a red `trash-2` badge and a red gradient Delete button (spec §3 v1.2) | Not affected (already an in-app modal) |
| 10 | Make the web sold card look like the app's | | | **Built by me** (⚠ section above) |

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

### `GET /api/user/:userId/dashboard`: `listings[].is_liked`, `listings[].is_saved`

Booleans, on every listing: whether the caller has liked / saved their own listing. Computed the
way `/public` does it. Nothing was removed or renamed.

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
- **Don't drop `is_liked` / `is_saved` from the dashboard listings.** Both apps' like toggles
  on your own cards depend on them.
- Relist and Delete moved off the phone's `Alert`. "That wasn't me" is still an Alert on the
  app. It can use `ConfirmDialog` later, but the owner hasn't asked.
