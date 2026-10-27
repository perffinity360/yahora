---
date: 2026-10-27T23:06:56+05:30
author: vishwajeet
phase: "6B"
block: "V-F"
for: neeraj
title: "Mark as Sold round 3: in-app confirm dialogs on the web, Off Yahora, sold photo overlay, level cards, live product page, long-quote jump"
---

# Mark as Sold round 3: in-app confirm dialogs on the web, Off Yahora, sold photo overlay, level cards, live product page, long-quote jump

The owner tried round 2
(`2026-10-27-120413-vishwajeet-mark-as-sold-polish-smooth-picker-tap-to-deselect.md`) and
reported eight things. Most were seen on the app. The owner's rule: fix the website only where
it has the same problem, and match the two wherever possible. Specs: `MARK_SOLD_SPEC.md` is now
**v1.3** (§2, §3, §4, §5), and `MESSAGES_SPEC.md` §10.6 has one new sentence.

## ⚠ I edited yours (owner's request): `frontend/`

`npm run build` passes. **Nothing has been checked in a browser.**

- **New `components/ConfirmDialog/`** (`.jsx` + `.module.css`). It's the web copy of the app's
  `ConfirmDialog.tsx`: the listing's photo with a gradient badge, a Bree Serif title, the body,
  then Cancel and a gradient confirm button. Props: `title`, `message`, `confirmLabel`, `Icon`,
  `imageUrl`, `tone` (`brand` | `danger`), `busy`, `busyLabel`, `error`, `onConfirm`, `onCancel`.
  It renders in a portal, Esc and the scrim cancel (not while `busy`), and focus goes to the
  confirm button.
- **`pages/dashboard/Dashboard.jsx`:** all three dialogs use it now.
  - **Delete:** spec v1.2 words, danger tone. `itemToDelete` holds the whole listing, not just
    its id, so the dialog can show the photo and title. A failed delete shows in the dialog
    (`deleteError`) instead of `alert()`.
  - **Relist:** brand gradient, which is the "Relist doesn't have the app's gradient" report.
  - **That wasn't me:** danger tone, with a `user-x` badge.

  The unused `TrashIcon` is gone. Your handlers (`executeMarkAvailable`,
  `executeRemovePurchase`, `closeRemovePurchase`) are unchanged.
- **`Dashboard.module.css`:** I deleted the dead dialog CSS (`.modalOverlay`, `.modalContent`,
  `.modalIconWrap`, `.modalTitle`, `.modalText`, `.modalActions`, `.btnCancel`, `.btnDelete`,
  `.btnRemove`, `.modalError`, `.btnRelist`). I checked that nothing else imports these names
  from this file: Home, Auth and Messages use their own modules, and PublicProfile reads
  `.grid` / `.tab*` from this file but none of the modal classes. `.grid` is now
  `align-items: stretch` (see #6).
- **`components/ProductCard/ProductCard.module.css`:** `.card` is a flex column, `.infoWrap`
  grows, and the bottom row (`.timeAvatar`, or the sold card's `.sale`) has `margin-top: auto`.
  In a grid that stretches, every card in a row now ends level. In a grid that doesn't
  (Marketplace, `align-items: start`), cards keep their natural height as before. Home's
  "Recent Listings" grid stretches by default, so its cards are level too now.
- **`pages/product/ProductDetail.module.css`:** `.soldStamp` is now a full-photo overlay instead
  of the corner stamp (#5). No JSX change except a comment.
- **Words (#2):** in `ProductCard.jsx`, `BuyerPicker.jsx` and `ProductDetail.jsx`, "Not on
  Yahora" is now "Off Yahora", and "Someone not on Yahora" is now "Someone off Yahora".

## What changed

| # | Owner's report | App | Website |
|---|---|---|---|
| 1 | The "That wasn't me" confirmation looks raw; fix any other raw confirmation | It was the phone's `Alert`. It's now `ConfirmDialog` in the danger tone: the photo, a red `user-x` badge, a red Remove (§4 v1.3). That was the app's last confirmation `Alert` | Same dialog for all three (above). The site had no `window.confirm` anywhere |
| 2 | Say "Off Yahora", not "Not on Yahora" | The card, the picker row, the seller's banner, accessibility labels | Same set of strings |
| 3 | Public profile: the listings run straight into "Sold · 1" | A rule between them: a purple hairline fading toward both edges, with a small `tag` medallion in the middle (§5 v1.3). Then the owner asked why `Priya's listings` has a count circle and `Sold · 1` doesn't: the app's Sold header is now `Sold` plus the same circle | **Not changed.** The web Sold section already starts 40 px below the grid with its own full-width heading bar. Please look at it with the owner; if it still reads as one list, copy §5 v1.3 |
| 4 | A quoted long message: the jump lands in its middle (app only) | Fixed (cause below) | **Not affected.** The web places the row's *top* 35% down (`anchorAtLead`), so the start always shows |
| 5 | The sold product page: only a small mark at the top. Fade the photo and write SOLD across it, like the card | A full-photo scrim with SOLD centred in Bree Serif 60 (44 at first; the owner found it small); taps, pinch and swipe still reach the photo (§2 v1.3) | **Same problem** (the corner stamp). Now the card's `rgba(0,0,0,.48)` overlay with SOLD at 4rem (raised from 3rem with the app's). The condition badge, arrows and dots stay above it |
| 6 | Web: cards in a row aren't the same height once one is sold | n/a | Fixed (above) |
| 7 | Web: Relist and Delete don't show the photo like the app, and Relist lacks the gradient | n/a | Fixed: `ConfirmDialog` |
| 8 | App: a listing sold on the web still showed as available (with Message seller) on Arjun's phone; a question from Rahul took a long time to appear; after relisting, the page still said sold | Fixed (cause below) | **Not affected in the same way:** the web fetches the product fresh on every visit. It does **not** update a page that is already open (no polling); it shows the change on reload. Say if you want the same 15 s refresh on the web |

### Why 4 happened (app)

`scrollToIndex({ viewPosition })` places a row at `viewPosition × (thread height − row
height)`. For a row taller than the thread, that number is negative, so the 35% placement put
the middle of a long message on screen. Each message row now reports its height (`onLayout`,
into a ref, so nothing re-renders). A quoted row taller than the thread minus 32 lands with its
**top 16 dp below the top of the thread**. A row that wasn't rendered yet is reached by
estimate, then placed again once it measures (within 1.5 s). The unread line is unchanged.

### Why 8 happened (app)

The app caches every query for **5 minutes** (`staleTime` in `app/_layout.tsx`), and the cache
is saved on the phone. A listing opened again within those 5 minutes, or straight from the
saved cache, was drawn from the old copy and the server was never asked. The product page
(`useProductDetail`) now:
- **draws the cached copy at once, then always refetches on open;**
- refetches again when the screen comes back on top (from the chat or the seller's profile)
  and when the app returns to the foreground;
- **refetches every 15 s while it is on screen and the app is open**, paused while a like,
  vote or question is being saved, so a refetch can't wipe an optimistic change. A listing left
  under a chat doesn't poll.

This adds no views: since your N-C, the server counts one view per person per listing. I
updated the comments in `useProductDetail.ts` that still said every GET adds a view.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None. No backend file changed.

## New fields on existing responses

None.

## Test data

- `npx tsc --noEmit` and `npx expo export --platform android` (app) pass. `npm run build`
  (website) passes.
- **Nothing has been checked on a phone or in a browser yet.** The owner checks the app; your
  browser checklist is in the message that comes with this branch.

## What NOT to do yet

- **Don't move the chat's "Delete message?" dialog onto `ConfirmDialog`.** It follows
  MESSAGES_SPEC §10.8 (WhatsApp's layout: stacked text buttons, no photo) on purpose.
- **Don't drop the product page's refresh back to the 5-minute default on the app.** That
  default is the whole cause of #8.
- **The web's remaining `alert()`s are login prompts and an avatar-upload error**, not
  confirmations, so they are untouched ("Please log in to like items!" on the card and the
  product page, and "Failed to update profile photo."). The app's remaining `Alert`s are error
  messages too (a question or reply that failed to post, the demo video). Both can become
  toasts later; the owner hasn't asked.
