# Mark as Sold — Design Spec v1.3

**Phase 6B · v1 · 11 October 2026 · v1.1 / v1.2 / v1.3 · 27 October 2026 · the single source of truth for marking a listing sold,
on BOTH platforms.**

Picture: `docs/design/mark_sold.png` (source `mark-sold-mockup.html`). Where the picture and
this file disagree, **this file wins**. Same rule as `MESSAGES_SPEC.md` §0: neither platform
designs anything; a value changes here first, then on both platforms in the same phase.

Save as `docs/design/MARK_SOLD_SPEC.md`.

---

## 0. What problem this solves

The old flow assumed the buyer had messaged the seller on Yahora. Often they had not: a
classmate sees the listing, finds the seller in class or on WhatsApp, and the sale happens
offline. So:

- marking sold works with **no conversation** ever having existed;
- the seller finds the buyer by **searching their campus**, or picks from the people who
  messaged them about it;
- **"Someone off Yahora"** is a normal answer — no one is tagged;
- a student tagged by mistake can say **"That wasn't me"**;
- the seller can **change the buyer** or **relist**;
- a sold listing looks the same everywhere: the product page, the seller's listings, the
  public profile, and the buyer's purchases.

**Who is never shown publicly:** the buyer. Only the seller (on their own listing) and the
buyer (in their own purchases) ever see who bought something. Everyone else sees **SOLD**.

---

## 1. The buyer picker — "Who bought it?"

Opens from **Mark as sold** on your own listing (web: Dashboard listing card; mobile: Profile
tab → Listings card) and from **Change buyer** on a sold listing (§3).

| | Mobile | Web |
|---|---|---|
| Container | bottom sheet, white, radius 20 on the top corners, max height 85% of the screen, padding 8 top / 16 sides / 16 bottom (on mobile, the larger of 16 and the home-indicator inset) | modal, white, **440** wide, radius 20, padding 20, centred |
| Scrim | `rgba(11,11,11,0.32)`; tapping it closes | same; Esc also closes |
| Handle | 36×4, radius 2, `rgba(128,0,128,0.15)`, centred, 12 above the title | none |

Inside, top to bottom:

1. **Title** `Who bought it?` — Bree Serif 400 20, `#0B0B0B`.
2. **Subtitle** — the listing's title, Inter 500 13, mutedText `#6B6879`, 1 line, ellipsis,
   2 below the title.
3. **Search field** — height 38 · radius 19 · background `#F3F0EF` (inputBg) · padding 0/14 ·
   gap 8 · leading `search` 15 mutedText · placeholder `Search by name or @username`, Inter
   400 13 mutedText · typed text Inter 400 13 `#1A1A1A` · while there is text, a trailing
   clear `x` 15 · margin 14 above, 6 below.
4. **The list** (scrolls if long):
   - With **fewer than 2 characters** typed: section **`Messaged you about this`** — the
     people who messaged you about this listing, newest conversation first, at most 20. The
     section is left out entirely when there are none.
   - With **2 or more characters**: section **`On your campus`** — students on the listing's
     campus whose name or @username matches, at most 20, never you. Searching starts **300 ms**
     after typing stops.
5. A **divider** — 1px `rgba(128,0,128,0.08)`, margin 8 vertical.
6. The **off-platform row**: `Someone off Yahora` / `No one will be tagged`.
7. The **confirm button**.

**Section label:** Inter 700 11, uppercase, letter-spacing 0.6, mutedText, margin 12 above,
4 below.

**Person row:** padding 10 vertical / 8 horizontal · radius 12 · gap 12 · avatar 36 (the
app's avatar with initials fallback) · name Inter 600 14 `#0B0B0B`, 1 line · `@username`
Inter 400 12 mutedText, 1 line. **Selected:** background `rgba(128,0,128,0.08)` and a
`check-circle` 20 purple at the right. Pressed (mobile) / hover (web): `rgba(128,0,128,0.05)`.

**Off-platform row:** the same row, with a 36 circle `#F3F0EF` holding `user-x` 18 mutedText
in place of the avatar · title `Someone off Yahora` Inter 600 14 · subtitle `No one will
be tagged` Inter 400 12 mutedText.

At most **one** row is selected at a time. **Tapping the selected row again clears it** (v1.1,
27 Oct, owner's request: a wrong tap is taken back without closing the picker), and the
button is disabled again. When the picker opens for **Change buyer**, the current buyer's row
(or the off-platform row) starts selected.

**Motion (mobile, v1.1).** The sheet rises from below the screen over 320 ms (ease-out cubic);
its first frame is already off-screen, so it never shows in place first. **v1.2:** the scrim
fades in on the same 320 ms, and the sheet starts just its own height below the edge, so the
two arrive together (v1.1 showed the full scrim first, with no sheet on it yet). When the list's
content changes size (rows arriving, search results changing), the list's height eases to the
new size over 220 ms, so the sheet's top edge glides instead of jumping. Web: the modal is
centred, so only the second rule applies, and only if the jump shows there.

**Search (v1.1).** `On your campus` finds a student when the term is any piece of their
@username (`ver`, `.ver`), or the start of any word of their name (`ver` → Rahul Verma). A
leading `@` is ignored. This is the server's rule (`search_users()`), so both platforms get it
with no client change.

**Confirm button:** full width · height 48 · radius 24 · 135° gradient `#800080 → #C02B7F` ·
label `Mark as sold` (Change buyer: `Save`) Inter 700 15 white · margin 12 above · **disabled
at opacity 0.4 until a row is selected** · pressed (mobile): scale 0.97 · hover (web):
`filter: brightness(1.05)`. The gradient ends at `#C02B7F`, not `#EB487F`, because white text
needs 4.5:1 (5.39 at that end; 3.64 at `#EB487F`).

**States**

| State | Shows |
|---|---|
| Loading the "messaged you" list | 3 skeleton rows: a 36 circle, then bars 45% × 12 and 30% × 10, 6 apart |
| Searching | the same 3 skeleton rows under `On your campus` |
| Search found nothing | `No students on your campus match “<query>”.` — Inter 400 13 mutedText, centred, padding 16 |
| Request failed | toast `Couldn't load students. Try again.` (the messages toast, MESSAGES_SPEC §10.7) |
| Saving | the button shows a spinner 18 white and ignores taps |
| Saved | the picker closes; the listing card updates at once (§3) |

**Errors from the server → toast text**

| Error | Toast |
|---|---|
| `BUYER_NOT_ON_CAMPUS` | `That student isn't on this listing's campus.` |
| `BUYER_NOT_FOUND` | `That student's account no longer exists.` |
| `PRODUCT_NOT_FOUND` | `This listing no longer exists.` |
| `NOT_PRODUCT_OWNER` | `Only the seller can mark this as sold.` |
| anything else / offline | `Couldn't save. Check your connection and try again.` |

---

## 2. A sold listing on the product page

| Who is looking | What changes |
|---|---|
| **Anyone except the seller** | The SOLD overlay (see **v1.3** below the table). Under the price, a **banner**: background `#F3F0EF`, radius 12, padding 10/12, gap 8, `check-circle` 16 mutedText, text `This item has been sold.` Inter 600 13 `#1A1A1A`. **Hidden:** Message seller. |
| **The seller** | The same overlay and banner, but the banner reads `You marked this as sold on <date>.` with a second line, Inter 400 12 mutedText: `Buyer: <full name>` or `Buyer: someone off Yahora`. The seller keeps their `Your listing` marker in place of Message seller. |

**A sold listing is closed for everyone — the seller too, and logged-out or demo viewers.**

- **No like:** the like count stays, as a plain stat like the views count; nothing happens on a tap.
- **No save:** the Save button is gone.
- **No new questions:** the "ask a question" composer is gone. Existing questions and answers stay
  visible and readable. With none, the "be the first to ask" line is replaced by `Questions are
  closed — this item has been sold.` (mutedText, centred).
- **Kept:** the stamp, the banner, Share and the seller card.

**The SOLD overlay (v1.3, owner, 27 Oct).** v1's stamp in the photo's corner (a pill on the
app) was easy to miss. The photo is now drawn the way a sold **card** draws it, for everyone,
the seller too: a scrim over the whole photo (app `colors.scrim`, 0.55; web
`rgba(0,0,0,0.48)`, the card's values on each platform), and `SOLD` centred across it in Bree
Serif 400 white, page-sized (44 on the app with tracking 6, 3rem on the web with 0.12em). It
takes no touch or click: tapping the photo still opens the full-screen viewer, and pinch and
swipe still reach it. The condition badge, the arrows and the dots sit above it, undimmed.

`<date>` uses the MESSAGES_SPEC §1 time-format table's date forms: `3 Oct`, or `3 Oct 2025` in
an earlier year. It is the listing's `sold_at`.

---

## 3. The seller's own listing cards

Web: Dashboard → listings. Mobile: Profile tab → Listings.

**v1.1 (27 Oct, owner's review on the phone).** v1 put a caption (`Sold to <name> · <date>`)
and two purple text links (`Change buyer`, `Relist`) under the price, above the location (a
later revision made the links pills). On a two-column card that was crowded, and the links
didn't read as buttons. A sold card on the seller's own dashboard is now:

1. the photo with the SOLD stamp, the condition badge and like count, the price and the
   title, as on every card;
2. **no location line and no time/seller footer** (they say nothing once it is sold);
3. pinned to the bottom, the **buyer box**, which is also the Change buyer button:
   - background `rgba(128,0,128,0.08)`, radius 12, padding 7 (9 on the right), gap 8;
     pressed `rgba(128,0,128,0.14)` and scale 0.98;
   - the buyer's avatar, 26 (initials fallback). A photo gets the thin purple ring every
     seller photo has (v1.2; app `Avatar ringed`, web `1.5px solid var(--purple-emphasis)`).
     For a buyer off Yahora, a 26 circle
     `#F3F0EF` holding `user-x` 13 mutedText;
   - line 1: the buyer's full name (else @username, else `a Yahora student`), or `Off
     Yahora`, in Inter 600 12 `#1A1A1A`, 1 line;
   - line 2: `Buyer · <date>`, in Inter 500 11 mutedText (`<date>` = `sold_at`, §2's format);
   - at the right, an `edit-2` 13 purple pencil;
   - tapping it opens §1 with the current choice selected;
4. the toolbar: a **`Relist`** pill (flex 1, height 26, radius 13, 1px `rgba(128,0,128,0.28)`
   border, `rotate-ccw` 13 + `Relist` Inter 600 12 purple, gap 5; pressed: background
   `rgba(128,0,128,0.08)`, scale 0.97), then the round delete button, gap 8. No divider
   line above it: the box does that job.

**Likes on your own listings (v1.2).** The heart on the seller's own cards **is a button**, as
on every other card. `GET /api/user/:userId/dashboard` sends `is_liked` / `is_saved` on each
listing since 27 Oct. Without them a toggle sent every tap as a new like (owner's report: 1,
2, then back to 1, then 0); v1.1 made the heart a plain count, and the owner wanted it back.

**Relist dialog** — title `Relist this item?` · body `<title> goes back on the marketplace.`
and, when there is a buyer, ` <first name> will no longer be shown as its buyer.` · buttons
`Cancel` · `Relist`.

**v1.1:** both platforms draw their own dialog, not the phone's `Alert` (the owner found the
Android one out of place):
- the card is white, radius 28, max width 340, padding 26 top / 22 sides / 20 bottom, on the
  0.55 scrim. Everything in it is centred;
- the listing's first photo, 72 × 72, radius 20, 1px hairline border. On its bottom-right
  corner (offset −8, −8) sits a 28 badge with a 2.5px white ring, filled with the 135°
  gradient `#800080 → #C02B7F` and holding `rotate-ccw` 14 white. With no photo, a 60
  gradient circle holding `rotate-ccw` 24;
- the title, Bree Serif 21 `#1A1A1A`, 16 below the photo;
- the body, Inter 400 14/20 mutedText, 8 below the title. The listing's title is in Inter
  600 `#1A1A1A`, with no quote marks;
- two buttons side by side, 22 below the body, gap 10, each flex 1, height 46, radius 23:
  - `Cancel`: `#F3F0EF`, Inter 600 15 `#1A1A1A`;
  - `Relist`: the same gradient, Inter 700 15 white;
  - both scale 0.97 when pressed;
- entrance: the scrim fades in, and the card goes from 0.92 scale, 12 lower and transparent to
  its place in 240 ms (ease-out cubic). A tap on the scrim, or back, is Cancel.

**Delete dialog (v1.2)** — the Relist dialog's layout in a **danger tone**: title `Delete this
listing?` · body `<title> will be removed for good. This can't be undone.` · buttons `Cancel` ·
`Delete`. The badge (or the medallion) holds `trash-2`, and both it and the Delete button use
the 135° gradient `#DC2626 → #B91C1C` instead of the brand one.

**v1.3:** the web draws the Relist, Delete and That wasn't me dialogs with the same component
as the app (`frontend/src/components/ConfirmDialog/`, the copy of
`mobile/src/components/ConfirmDialog.tsx`): the listing's photo and badge, the gradient confirm
button. Its old Delete modal (trash icon, `Delete Listing`, `Are you sure…`) is gone. While a
request runs, the web's confirm reads `Deleting…` / `Removing…` and Esc and the scrim do
nothing; a failure shows in the dialog, under the body, in `#B91C1C` 13.

The web card's old label `SOLD TO @<name>` goes away: it read a column (`sold_to`) that nothing
ever wrote, and the buyer is never shown on public cards. Every sold card says **`SOLD`**.

---

## 4. The buyer's purchases

Web: Dashboard → **Bought Items**. Mobile: Profile tab → **Purchases**. Each card adds, under
the price:

- one line, Inter 500 12 mutedText: `From <seller full name> · <date>` (`<date>` = when it was
  marked sold);
- 8 below it, a quiet **pill button** **`That wasn't me`**: `user-x` 14 (Feather on mobile,
  lucide on web), gap 6, label Inter 600 12 · mutedText for both, no underline · border 1px
  `rgba(128,0,128,0.15)` · radius 999 · padding 4 vertical, 10 horizontal · transparent
  background · left-aligned · at least **28** tall, so it is easy to tap · pressed (mobile),
  hover and pressed (web): background pinkLight `#FFF4F7`, label and icon purple `#800080`,
  150 ms · web keyboard focus: 2px purple outline, offset 2. The same on every screen size.

**That wasn't me dialog** — title `Remove this purchase?` · body `<seller first name> marked
“<title>” as sold to you. If that's wrong, remove it. The listing stays sold; you just won't be
shown as its buyer.` · buttons `Cancel` · `Remove`. On success the card disappears from the
list.

**v1.3:** drawn as the Relist dialog (§3) in its **danger** tone, on both platforms, not the
phone's `Alert`: the listing's photo with a red `user-x` badge, the listing's title in Inter
600 `#1A1A1A` with no quote marks, and the red gradient Remove button.

---

## 5. The public profile — "Sold" section

Under the active listings, on web and mobile:

- header `Sold · <count>` — same style as the existing listings header on each platform;
- up to **12** sold listings, newest sold first, as the same cards the profile already uses,
  each with the SOLD badge; no like or save on them;
- the section is left out when the count is 0;
- it is never a list of buyers — only the listings.
- **v1.3 (owner, 27 Oct: the two sections read as one list):** on the app, a rule closes the
  listings before the Sold header: a 1dp purple hairline (`rgba(128,0,128,0.22)`) fading to
  transparent toward both screen edges, broken in the middle by a 26 circle (pinkLight, 1px
  `rgba(128,0,128,0.15)` border) holding `tag` 12 purple. 28 above it, 24 below it to the
  `Sold · N` header. The web already opens the section with its own full-width heading bar
  (the listings' tab style) 40 below the grid, so it has no rule.

This is the social proof the plan asked for: a seller's history of finished sales.

---

## 6. What does not change

- The marketplace feed shows **available** listings only, as today.
- Likes and saves on a listing are kept when it sells (there is no watchlist screen yet).
- **Icons (v1.2):** Save is always a **bookmark** (outline, filled when saved) and a **heart**
  always means Like, on both platforms: the product page's save button, the cards, and the
  "My Wishlist" filter.
- Nothing notifies the buyer (notifications are Phase 8). They find the purchase in their
  purchases list.
- Payments stay off-platform (UPI or cash in person).

---

## 7. Contrast — measured

| Pair | Ratio | Needs |
|---|---|---|
| White label on the button's end `#C02B7F` | 5.39 | 4.5 ✅ |
| White label on the button's start `#800080` | 9.42 | 4.5 ✅ |
| Banner text `#1A1A1A` on `#F3F0EF` | 15.35 | 4.5 ✅ |
| mutedText on `#F3F0EF` (banner second line) | 4.77 | 4.5 ✅ |
| Purple text buttons on white | 9.42 | 4.5 ✅ |
| `#B91C1C` "Remove" on white | 6.47 | 4.5 ✅ |
| mutedText (`@username`, the lines under prices) on white | 5.41 | 4.5 ✅ |
