# Phase 6B — changelog

Released 2026-10-29 with `node scripts/changelog.mjs release 6B`. 27 entries, oldest first.

Until this release each entry below was its own file in `docs/changelog/`. Every entry keeps
its original file name here, so an old reference such as `2026-10-04-184315` still finds it:
search this file for it. The original files are also in git history.

| # | Date | Author | Block | For | Title |
|---|---|---|---|---|---|
| 1 | 2026-10-13 18:35 | vishwajeet | V-0 | neeraj | [V-0 setup done; deploy settings](#2026-10-13-183550-vishwajeet-v-0-setup-done-deploy-settings) |
| 2 | 2026-10-15 11:25 | neeraj | N-0 | vishwajeet | [6B before-evidence: identity leaks on production](#2026-10-15-112521-neeraj-6b-before-evidence-identity-leaks-on-production) |
| 3 | 2026-10-15 11:39 | vishwajeet | V-A | neeraj | [Ownership loan: products + share modules to Neeraj for Phase 6B](#2026-10-15-113922-vishwajeet-ownership-loan-products-share-modules-to-neeraj-fo) |
| 4 | 2026-10-15 11:39 | vishwajeet | V-A | neeraj | [viewer.js + new error names](#2026-10-15-113922-vishwajeet-viewer-js-new-error-names) |
| 5 | 2026-10-15 12:37 | neeraj | N-A | vishwajeet | [Changelog: release command; 6A released](#2026-10-15-123725-neeraj-changelog-release-command-6a-released) |
| 6 | 2026-10-16 11:42 | vishwajeet | V-B | neeraj | [6B migrations: message actions, product views, mark sold](#2026-10-16-114208-vishwajeet-6b-migrations-message-actions-product-views-mark-s) |
| 7 | 2026-10-16 12:45 | neeraj | N-C | vishwajeet | [Identity rule live in products, share, user (N-C)](#2026-10-16-124546-neeraj-identity-rule-live-in-products-share-user-n-c) |
| 8 | 2026-10-16 17:20 | vishwajeet | V-C | neeraj | [Messages API: reply, delete for everyone, delete for me](#2026-10-16-172006-vishwajeet-messages-api-reply-delete-for-everyone-delete-for) |
| 9 | 2026-10-17 12:49 | vishwajeet | V-D | neeraj | [Mobile privacy states: hidden seller, commenters, profile (V-D)](#2026-10-17-124921-vishwajeet-mobile-privacy-states-hidden-seller-commenters-pro) |
| 10 | 2026-10-17 15:04 | neeraj | T1 | vishwajeet | [M1 live: identity rule + views](#2026-10-17-150430-neeraj-m1-live-identity-rule-views) |
| 11 | 2026-10-18 11:55 | neeraj | N-E | vishwajeet | [Mark as Sold endpoints (N-E)](#2026-10-18-115559-neeraj-mark-as-sold-endpoints-n-e) |
| 12 | 2026-10-18 13:18 | vishwajeet | V-C | neeraj | [Web fixes in your files: calm send tick, dropdowns, avatar menu](#2026-10-18-131806-vishwajeet-web-fixes-in-your-files-calm-send-tick-dropdowns-a) |
| 13 | 2026-10-22 13:29 | vishwajeet | V-D | neeraj | [Visitor mode: no like/save on another campus; demo profile gate says log in](#2026-10-22-132907-vishwajeet-visitor-mode-no-like-save-buttons-on-another-campu) |
| 14 | 2026-10-24 01:06 | vishwajeet | V-FIX | neeraj | [sendMessage refuses messages to yourself](#2026-10-24-010617-vishwajeet-sendmessage-refuses-messages-to-yourself) |
| 15 | 2026-10-24 02:00 | vishwajeet | V-FIX | neeraj | [Photo and avatar file names no longer contain user ids](#2026-10-24-020050-vishwajeet-photo-and-avatar-file-names-no-longer-contain-user) |
| 16 | 2026-10-24 15:45 | vishwajeet | V-E | neeraj | [Messages: WhatsApp-style long-press menu, select several messages, new delete dialog, reply on mobile](#2026-10-24-154532-vishwajeet-messages-whatsapp-style-long-press-menu-select-sev) |
| 17 | 2026-10-24 23:55 | vishwajeet | V-E | neeraj | [Message actions polish: faster hold, darker selection, WhatsApp delete dialog, centred reply arrow](#2026-10-24-235526-vishwajeet-message-actions-polish-faster-hold-darker-selectio) |
| 18 | 2026-10-25 20:18 | vishwajeet | V-E | neeraj | [Messages: WhatsApp tap feedback on bubbles; menu closes on any touch or the keyboard; instant hold on the app](#2026-10-25-201829-vishwajeet-messages-whatsapp-tap-feedback-on-bubbles-menu-clo) |
| 19 | 2026-10-26 12:19 | vishwajeet | V-E | neeraj | [App: composer tap ends the selection; no offline strip; gestures back on the UI thread; one back per press](#2026-10-26-121931-vishwajeet-app-composer-tap-ends-the-selection-no-offline-str) |
| 20 | 2026-10-26 13:59 | vishwajeet | V-F | neeraj | [App: Mark as Sold everywhere (picker, sold cards, purchases, product page, public profile)](#2026-10-26-135948-vishwajeet-app-mark-as-sold-everywhere-picker-sold-cards-purc) |
| 21 | 2026-10-26 17:04 | neeraj | T2 | vishwajeet | [T2 + M2: message actions on web and app](#2026-10-26-170457-neeraj-t2-m2-message-actions-on-web-and-app) |
| 22 | 2026-10-26 19:19 | neeraj | N-H | vishwajeet | [Mark as Sold on the website (N-H) + spec changes for the app](#2026-10-26-191934-neeraj-mark-as-sold-on-the-website-n-h-spec-changes-for-t) |
| 23 | 2026-10-27 12:04 | vishwajeet | V-F | neeraj | [Mark as Sold polish: smooth picker, tap to deselect, wider name search, new sold card, Relist and Delete dialogs, dashboard likes fixed, grid overlap fix](#2026-10-27-120413-vishwajeet-mark-as-sold-polish-smooth-picker-tap-to-deselect) |
| 24 | 2026-10-27 23:06 | vishwajeet | V-F | neeraj | [Mark as Sold round 3: in-app confirm dialogs on the web, Off Yahora, sold photo overlay, level cards, live product page, long-quote jump](#2026-10-27-230656-vishwajeet-mark-as-sold-round-3-in-app-confirm-dialogs-on-the) |
| 25 | 2026-10-29 09:32 | neeraj | T5 | vishwajeet | [M3 live: Mark as Sold on web; T3, T4, T5 passed](#2026-10-29-093235-neeraj-m3-live-mark-as-sold-on-web-t3-t4-t5-passed) |
| 26 | 2026-10-29 09:32 | neeraj | N-D, N-F | vishwajeet | [Website: privacy states (N-D) and message actions (N-F, swipe add-on)](#2026-10-29-093235-neeraj-website-privacy-states-n-d-and-message-actions-n-f) |
| 27 | 2026-10-29 09:45 | neeraj | SIGN-OFF |  | [Phase 6B complete; products + share modules back to Vishwajeet](#2026-10-29-094514-neeraj-phase-6b-complete-products-share-modules-back-to-v) |

---

<a id="2026-10-13-183550-vishwajeet-v-0-setup-done-deploy-settings"></a>

## 1 · V-0 setup done; deploy settings

`2026-10-13-183550-vishwajeet-v-0-setup-done-deploy-settings.md` · 2026-10-13 18:35 · vishwajeet · block V-0 · for neeraj

### Deploy settings (V-0 checkpoint step 3)

Vishwajeet checked both dashboards on 13 Oct:

- **Render:** branch `main`, Auto-Deploy **On Commit**.
- **Netlify:** production branch `main`. Branch deploys: **Deploy only the production branch**.

What this means for the go-lives in runbook §2.4:

- **Merging to `main` is the go-live, on both.** The API redeploys by itself after a merge, so
  §2.4 needs no extra "Manual Deploy" step on Render. The website does the same on Netlify.
- **Pushing a block branch deploys nothing.** Netlify builds only `main`, so `n-d-…` and the
  other block branches never reach a URL. Test them locally (runbook §2.6, the `try-m1`
  throwaway branch).
- Deploy previews for pull requests are a separate Netlify setting. It wasn't checked.

### What V-0 changed (branch `v-0-setup`)

- Removed the three stray root files (runbook §0.1):
  - `phase6-design-assets.zip` (1.7 MB). Its contents are already in `docs/design/`. This was
    in commit `592eb56`.
  - `cache.jsx` and `temp.cpp`, both 0 bytes. These are in the follow-up commit that carries
    this entry, because `592eb56` only removed the zip.
- `mobile/`: added `expo-clipboard` `~57.0.2` with `npx expo install`, for message Copy in
  V-E. `package.json` and `package-lock.json` changed.
- `README.md` and `cache.md` stay. The runbook leaves them to the owner.

No backend, frontend or supabase file changed.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

None.

### What NOT to do yet

- Don't push straight to `main`. With these settings every push to `main` is a production
  deploy of both the API and the website.
- Keep the §2.4 merge order exactly. A merge goes live within minutes, so merging N-C before
  N-D means real visitors get `seller: null` on a website that can't handle it yet.

---

<a id="2026-10-15-112521-neeraj-6b-before-evidence-identity-leaks-on-production"></a>

## 2 · 6B before-evidence: identity leaks on production

`2026-10-15-112521-neeraj-6b-before-evidence-identity-leaks-on-production.md` · 2026-10-15 11:25 · neeraj · block N-0 · for vishwajeet

### Migrations applied

### New endpoints

### Changed endpoints (BREAKING)

### New fields on existing responses

### Test data
Run on production, 15 Oct 2026, **without logging in**. Listing `54420f2f-80e6-491b-8741-7319ccdebc2f` ("Mouse"), seller `f9c43cc9-b55b-40e8-9f5d-333cd7a80faa`.

| # | Endpoint | Real identity returned? | What leaked |
|---|---|---|---|
| 1 | `GET /api/products?university_id=` | yes | seller_id, full_name, avatar |
| 2 | `GET /api/user/:id/public` | yes | full_name, avatar, bio, qualification, year, course, specialization, university |
| 3 | `GET /api/products/:id` | yes | full_name, qualification, year_of_study |
| 4 | `GET /api/products/:id/meta` + `/share/product/:id` | yes | `seller_name`; "listed by Vishwajeet Singh" |

T1 re-runs these after M1; all four must then return no name.

### What NOT to do yet

---

<a id="2026-10-15-113922-vishwajeet-ownership-loan-products-share-modules-to-neeraj-fo"></a>

## 3 · Ownership loan: products + share modules to Neeraj for Phase 6B

`2026-10-15-113922-vishwajeet-ownership-loan-products-share-modules-to-neeraj-fo.md` · 2026-10-15 11:39 · vishwajeet · block V-A · for neeraj

This is the loan described in `docs/runbooks/PHASE_6B_RUNBOOK.md` §2.2.

- **Neeraj may edit `backend/src/modules/products/*` and `backend/src/modules/share/*`** from
  today (15 Oct) until Phase 6B sign-off, for Blocks **N-C** (privacy and views) and **N-E**
  (Mark-as-Sold endpoints).
- **Neeraj does not change the `OWNER:` banners.** They keep naming Vishwajeet. This entry is
  the record of the loan.
- **Vishwajeet does not edit those files until sign-off.** If a messages or mobile change seems
  to need one, it goes to Neeraj as a request.
- **Every backend PR is still reviewed by the other person** (`backend/CLAUDE.md`). Vishwajeet
  reviews Neeraj's products and share PRs. Neeraj reviews Vishwajeet's messages PRs.
- **N-C is the one exception to "one module per PR"** (runbook §2.2). Its modules carry one rule
  that has to go live at the same moment, so they go in one PR. Say so in its description.
- The modules return to Vishwajeet at sign-off. The SIGN-OFF entry will say so.

The calendar in runbook §2.3 starts the loan on Day 2 (13 Oct). It starts today instead,
because V-A landed late.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

None.

### What NOT to do yet

- Nothing calls viewer.js yet — N-C is the first caller.

---

<a id="2026-10-15-113922-vishwajeet-viewer-js-new-error-names"></a>

## 4 · viewer.js + new error names

`2026-10-15-113922-vishwajeet-viewer-js-new-error-names.md` · 2026-10-15 11:39 · vishwajeet · block V-A · for neeraj

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

### viewer.js: the identity rule in one place

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

### New error names (`mapDbError`)

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

### Migrations applied

None. The three Phase 6B migrations are V-B.

### New endpoints

None.

### Changed endpoints (BREAKING)

None. `mapDbError` gives the same status and body for every name it handled before. The ten
new names can't be raised until V-B's migrations are applied.

### New fields on existing responses

None yet. N-C adds `seller_hidden`, `user_hidden` and `university_name`, as listed in API.md.

### Test data

None needed: nothing calls the new code. Checked:

- `node --check` passes on both files.
- The backend boots and `GET /api/health` answers.

### What NOT to do yet

- Nothing calls viewer.js yet. N-C is the first caller.
- Don't copy the rule into a module ("is this a demo user?" written inline). Import it from
  viewer.js, so one file decides who sees whom.
- If a new RAISE name is ever added, add it to `RAISED_STATUS` in the same change. A name
  that isn't in the map comes back as 500. Ask Vishwajeet, because the file is frozen.

---

<a id="2026-10-15-123725-neeraj-changelog-release-command-6a-released"></a>

## 5 · Changelog: release command; 6A released

`2026-10-15-123725-neeraj-changelog-release-command-6a-released.md` · 2026-10-15 12:37 · neeraj · block N-A · for vishwajeet

`scripts/changelog.mjs` has a fourth command, `release`. **Phase 6A is released.** Its 18
entries no longer exist as separate files in `docs/changelog/`.

### The command

```
node scripts/changelog.mjs release <phase> --dry-run   # prints what it would write and delete; changes nothing
node scripts/changelog.mjs release <phase>
git add -A docs/changelog
git commit -m "docs(changelog): release phase <phase>"
```

It gathers every entry tagged with that phase into one file,
`docs/changelog/releases/phase-<phase>.md`. The file opens with a table of the entries, then
gives each entry in full, oldest first. Each entry keeps its original file name. Then the
small files are deleted, and git history keeps them. Entries from other phases, and untagged
ones, are left alone.

- `new` and `for` behave exactly as before.
- `recent` changed in two small ways:
  - Its last line now names the release files.
  - With no entries left it prints "No unreleased entries in docs/changelog/." instead of
    stopping.
- The script still has no dependencies. It is the tested copy from
  `docs/runbooks/phase6b/changelog.mjs`, unchanged.
- `docs/changelog/README.md` has a new "Releasing a phase" section.
- Root `CLAUDE.md` has one new sentence in the session-start paragraph.

### The rule: release only at SIGN-OFF

Run `release` only at a phase's sign-off, once both of us have merged everything for it.

A phase can be released once. If `releases/phase-<P>.md` exists, `release <P>` refuses to
run. So a late entry can't join a released phase: tag it with the next phase.

**6B is released at the 6B sign-off** (runbook calendar, Day 18). Until then, keep tagging
entries `--phase 6B`.

### Where 6A's entries are now

[`docs/changelog/releases/phase-6A.md`](releases/phase-6A.md): 18 entries, 76 KB, from
2026-10-01 (N-A) to 2026-10-11 (WRAP-UP). To follow an old reference such as
`2026-10-04-184315`, search that file for it. Each entry has an anchor named after its old
file name.

V-0 (13 Oct) and N-0 (15 Oct) are tagged 6B, so they stay in `docs/changelog/`.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

All runs were on the real entries:
- `release 6A --dry-run` listed 18 deletions plus the release file, and `git status` was the
  same before and after.
- The real run: `git status` shows 1 A (`releases/phase-6A.md`) and 18 D.
- Every non-heading line of the 18 originals appears in the release file.

### What NOT to do yet

- Don't run `release 6B` before sign-off.
- Don't add a 6A-tagged entry. 6A is closed; use 6B.
- Inside `phase-6A.md`, three relative links written for `docs/changelog/` no longer resolve
  from `releases/`. There are two links to `2026-10-04-170506-…md` (both in entry 13) and
  one to `../runbooks/phase6a-vd-production-repair.sql` (entry 15). The text was released
  unedited, as required. Fixing the links is allowed under the README rule, but hasn't been
  done.

---

<a id="2026-10-16-114208-vishwajeet-6b-migrations-message-actions-product-views-mark-s"></a>

## 6 · 6B migrations: message actions, product views, mark sold

`2026-10-16-114208-vishwajeet-6b-migrations-message-actions-product-views-mark-s.md` · 2026-10-16 11:42 · vishwajeet · block V-B · for neeraj

The three Phase 6B migrations, copied byte for byte from the tested SQL in
`docs/runbooks/phase6b/` (`cmp` shows each pair identical). They're applied locally **and on
production** (pushed 16 Oct; see Notes).

### Migrations applied

Locally and on production, in this order:

| File | Source | What it does |
|---|---|---|
| `supabase/migrations/20261016061043_message_actions.sql` | `01_message_actions.sql` | Reply (quote a message), delete for everyone (tombstone), delete for me (`message_hides`) |
| `supabase/migrations/20261016061047_product_views.sql` | `02_product_views.sql` | `products.views` = distinct students who opened the listing, through one path |
| `supabase/migrations/20261016061050_mark_sold.sql` | `03_mark_sold.sql` | Mark as Sold reworked: one buyer per listing, `sold_at`, four functions |

**New tables (backend-only).** Neither has grants for `anon` or `authenticated`, and neither
is in the Realtime publication. Only `service_role` reaches them:

- `message_hides`: who hid which message, for "delete for me". The other person can never
  learn that a message was hidden.
- `product_views`: one row per (listing, viewer).

**New functions.** Every rule lives in these, so call them and pass any error to
`mapDbError()`. Don't re-check in JavaScript.

| Function | Raises |
|---|---|
| `delete_message_for_everyone(message, caller)` | `MESSAGE_NOT_FOUND`, `NOT_MESSAGE_SENDER`, `DELETE_WINDOW_EXPIRED` |
| `hide_message_for_me(message, caller)` | `MESSAGE_NOT_FOUND` |
| `record_product_view(product, viewer)` | none. It ignores the seller, repeat views, and demo accounts viewing real listings |
| `mark_product_sold(product, seller, buyer or NULL)` | `PRODUCT_NOT_FOUND`, `NOT_PRODUCT_OWNER`, `BUYER_NOT_FOUND`, `BUYER_IS_SELLER`, `BUYER_NOT_ON_CAMPUS` |
| `mark_product_available(product, seller)` | `PRODUCT_NOT_FOUND`, `NOT_PRODUCT_OWNER` |
| `remove_my_purchase(product, buyer)` ("That wasn't me") | `PURCHASE_NOT_FOUND` |
| `get_product_buyer_candidates(product, seller)` | `PRODUCT_NOT_FOUND`, `NOT_PRODUCT_OWNER` |

The trigger function `fill_message_reply()` fills the quote and raises `REPLY_TARGET_INVALID`.
All of these names are already in `RAISED_STATUS` (V-A).

**`increment_product_views()`** can no longer be called with the public key. `service_role`
keeps it, so today's `GET /api/products/:id` still works until N-C switches to
`record_product_view()`.

### New endpoints

None. The endpoints come in V-C (messages) and N-E (Mark as Sold).

### Changed endpoints (BREAKING)

Breaking for anything that reads these columns:

- **`products.sold_to` is DROPPED.** The current endpoints select `*`, so the key simply
  disappears from product rows; no query names it. One reader is affected:
  `frontend/src/components/ProductCard/ProductCard.jsx:446` reads `product.sold_to`. It now gets
  `undefined` and shows "SOLD", which is exactly what it showed before, because nothing ever
  wrote the column. API.md still lists `sold_to` in `<products row>` and in two notes; it gets
  fixed with the next API.md edit.
- **`purchases` now allows one row per listing** (unique on `product_id`). The migration
  deletes rows pointing at nothing, and the older duplicates of a listing marked sold twice.
  Locally that cleanup ran on an empty table, because `seed.sql` loads after the migrations.
  The real counts come from production at the push (runbook V-B, step 1). Today's `POST /api/products/:id/sold`, when it names a
  buyer on a listing that already has one, gets a unique violation on the purchase insert. It
  logs it and still returns 200, so the first buyer stays. N-E replaces this handler with
  `mark_product_sold()`.

### New fields on existing responses

From the database. They appear in an API response once a handler returns them:

- `messages.reply_to_id`, `reply_to_sender_id`, `reply_preview`, `deleted_at`. `GET
  /api/messages/history` selects `*`, so they show up there now: `null` on every existing
  row. A deleted message keeps its row, with `content = ''` and `deleted_at` set.
- `products.sold_at`: stamped by a trigger whenever `status` becomes `'sold'`, and cleared
  when it stops being sold.
- Inbox rows (`get_user_inbox()`, so `GET /api/messages/inbox/:userId`): `last_sender_id`
  and `last_message_deleted`. Messages the caller hid are skipped.

### Test data

Run on 16 Oct against the local database only, through `docker exec supabase_db_yahora psql`.
Both scripts run in a transaction and roll back.

- `supabase db reset`: all 21 migrations and `seed.sql` applied with no error.
- `test_01_message_actions.sql`: `T1 ok` … `T7 ok` and `T9 ok`. T10 privileges are all `f`.
- `test_02_views_and_sold.sql`: `views ok`, `mark sold ok`, `buyer candidates ok`. The
  privileges row is all `f`. `service_old_views` is `t`, as expected.
- T8 prints two inbox tables for eyeballing. It has no assertion. The second table's label
  expects a tombstone as Priya's newest Wacom message. It shows Arjun's later reply "saved
  it" instead, which is correct: that reply was sent after the deleted message. Inside one
  transaction every insert gets the same `created_at`. So that table's order comes down to
  the uuid tie-break, and the label is wrong rather than the migration.

### What NOT to do yet

- Run `supabase db reset` after pulling. N-C and N-E need these locally. Production is
  already pushed (16 Oct, by hand; see Notes).
- Don't call `increment_product_views()` in new code. Use `record_product_view()` (N-C).
- Don't write `purchases` or `products.status` directly for Mark as Sold. Call the functions
  (N-E).

### Notes

**Production pre-push check (runbook V-B, step 1).** Vishwajeet ran this read-only query in
the Supabase dashboard SQL Editor to see how many purchase rows the Mark-as-Sold migration
will remove:

```sql
-- How many purchase rows will the Mark-as-Sold migration remove?
select
  (select count(*) from public.purchases
    where buyer_id is null or product_id is null)                         as broken_rows,
  (select coalesce(sum(n - 1), 0)
     from (select count(*) as n from public.purchases
            group by product_id having count(*) > 1) d)                   as duplicate_rows;
```

| broken_rows | duplicate_rows |
| ----------- | -------------- |
| 0           | 0              |

So on production, `mark_sold` deletes **no** purchase rows: none point at nothing, and no
listing has more than one buyer.

**The 6B migrations are pushed to production.** Vishwajeet ran `supabase db push` by hand on
16 Oct (runbook V-B, step 3). The post-push check (step 4), run in the SQL Editor, matched
every expected value:

| message_columns | has_message_hides | has_product_views | new_functions | anon_can_add_views | sold_without_date | listings_with_two_buyers |
| --------------- | ----------------- | ----------------- | ------------- | ------------------ | ----------------- | ------------------------ |
| 4               | true              | true              | 7             | false              | 0                 | 0                        |

- All four reply and delete columns are on `messages`.
- Both new tables exist.
- All seven functions exist.
- The public key can no longer add views.
- Every sold listing has a `sold_at`.
- No listing has two buyers.

---

<a id="2026-10-16-124546-neeraj-identity-rule-live-in-products-share-user-n-c"></a>

## 7 · Identity rule live in products, share, user (N-C)

`2026-10-16-124546-neeraj-identity-rule-live-in-products-share-user-n-c.md` · 2026-10-16 12:45 · neeraj · block N-C · for vishwajeet

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

### Migrations applied

None. N-C uses your V-B functions (`record_product_view`).

### New endpoints

None.

### Changed endpoints (BREAKING)

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

### New fields on existing responses

- `seller_hidden: true`: products list and detail, **only** when the seller is hidden.
- `user_hidden: true`: each comment on the detail, **only** when hidden.
- `university_name`: `GET /api/products/:id`, for **every** viewer. It is the only addition to
  a student's response.

**Client rule (API.md):** a hidden flag means "draw **Yahora student**", with no avatar and no
profile link. A `null` seller or user with the flag set is a normal response, not an error.

### Test data

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

### What NOT to do yet

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

---

<a id="2026-10-16-172006-vishwajeet-messages-api-reply-delete-for-everyone-delete-for"></a>

## 8 · Messages API: reply, delete for everyone, delete for me

`2026-10-16-172006-vishwajeet-messages-api-reply-delete-for-everyone-delete-for.md` · 2026-10-16 17:20 · vishwajeet · block V-C · for neeraj

The backend half of MESSAGES_SPEC §10. The website builds its Reply and Delete against this. It
is built on the V-B migration `message_actions`, so run `supabase db reset` first if you
haven't since V-B.

Files: `backend/src/modules/messages/messages.controller.js`, `messages.routes.js`,
`backend/API.md`. Nothing else changed: not `markAsRead`, not `markAsDelivered`, not
`getInbox`, and not products or share, which are on loan to you.

Contract of record: `backend/API.md` → messages, starting at "The four message-action fields
(Phase 6B)".

### Migrations applied

None. The database side is V-B (`20261016061043_message_actions.sql`), already on production.

### New endpoints

Both use `requireAuth`, and the actor is always the token holder. Neither takes a body.

| Route | 200 | Errors |
|---|---|---|
| `POST /api/messages/:id/delete-for-everyone` | `{ "message": <tombstone row> }`: same row, `content: ""`, `deleted_at` set. Repeating it returns the same tombstone | 400 `INVALID_FORMAT` (`:id` not a uuid) · 403 `NOT_MESSAGE_SENDER` · 403 `DELETE_WINDOW_EXPIRED` (over 60 min) · 404 `MESSAGE_NOT_FOUND` (no such message, **or** you're not one of its two people) |
| `POST /api/messages/:id/delete-for-me` | `{ "id": "<the id>", "hidden": true }`. Repeating it is fine | 400 `INVALID_FORMAT` · 404 `MESSAGE_NOT_FOUND` |

Map to the spec's UI: `DELETE_WINDOW_EXPIRED` → toast "It's too late to delete this for
everyone" (§10.8).

### Changed endpoints (BREAKING)

**None are breaking for the current website.** What changed:

- **`POST /api/messages/send`:**
  - New optional `reply_to_id` (uuid or `null`). **Send only the id.** The database fills
    `reply_to_sender_id` and `reply_preview`, and overwrites anything you send for them.
  - Empty or whitespace-only `content` → 400 `MISSING_FIELDS`. The website already refuses
    these (`!newMessage.trim()` in `Messages.jsx`).
  - **`content` over 2000 characters → 400 `INVALID_FORMAT`.** This is the spec §2 limit.
    Both composers now enforce it, so a normal client never gets this error (see "I edited
    `frontend/`" below).
  - `receiver_id` or `product_id` missing or not a uuid → 400 `INVALID_FORMAT`, where it used
    to be 500. A `reply_to_id` that isn't a uuid → 400 `INVALID_FORMAT`. A reply into another
    conversation, or to a deleted-for-everyone message → 400 `REPLY_TARGET_INVALID`.
  - **The listing was deleted → 404 `NOT_FOUND`, "That listing no longer exists."** It used
    to be 500. It mirrors the existing "That student no longer exists." for a missing
    receiver.
  - **Every 500 is now `{ "error": "INTERNAL_ERROR", … }`.** The old
    `{ "error": "Failed to send message." }` body is gone. Branch on `error`.
  - **Every 4xx from `/send` is permanent**, so resending the same body gets the same answer.
    Only a 5xx or a network failure is worth retrying.

### ⚠ I edited `frontend/` (Neeraj's): `Messages.jsx`, `Messages.module.css`, `global.css`

Vishwajeet asked for these fixes on both web and app, so I made them here rather than leaving
them as a request:

1. **`MAX_MESSAGE_LENGTH = 2000`** (next to `READ_VISIBLE_RATIO`) and
   **`maxLength={MAX_MESSAGE_LENGTH}`** on the composer `<textarea>`. Spec §2 says "up to
   2000 characters", and mobile already had it. A long paste is now cut at 2000 by the
   browser, the same way the phone does it.
2. **`handleEmojiClick` won't push past the limit.** `maxLength` only limits typing and
   pasting; text set from code skips it. An emoji that wouldn't fit is refused whole, not cut
   in half. Mobile got the same guard.
3. **Optimistic send with the spec §2 failed bubble.** This is the same model as mobile's
   `useSendMessage`. Before, a refused or failed send just vanished, because the box was
   cleared and the error ignored.
   - **`handleSendMessage`** builds a placeholder (`id` = `client_tag` = `local-…`) and calls
     **`deliver()`**. The bubble shows at once with a clock.
   - **On success**, the server row replaces it (`mergeServerMessage`).
   - **Automatic retry** (`sendWithRetries`), for no answer (or none within
     `SEND_TIMEOUT_MS`, 15 s), 401, 408, 429 and 5xx: tries again after 2, 4, 8, 16 and 30 s,
     keeping the clock. While offline it waits for the `online` event and uses up no tries.
     Any other 4xx fails at once. Sends in one conversation go one at a time, in order
     (`sendQueueRef`).
   - **Only after that** is the bubble dimmed to 0.72 with a white ⓘ tick, and the pill
     "Failed to send" sits under it. The pill is a `<button>`, so it gets keyboard focus and
     `aria-label`. Tapping it calls **`handleRetry()`**: same bubble, same text, a new retry
     cycle.
   - **No double post on a lost answer:** if Realtime brings the message in while a retry
     waits, the Realtime handler removes it from `unsentRef`, and the loop stops.
   - **The Realtime INSERT handler** now goes through `mergeServerMessage`. If my own INSERT
     arrives before the HTTP response, it replaces the pending bubble instead of adding a
     second one.
   - **`unsentRef`** keeps pending and failed messages per thread. Switching chats doesn't
     lose them; `fetchHistory` adds them back unless the server already has the same text
     from me (mobile's rule).
   - `openingIdsRef` gets the server id when a placeholder is swapped, so the bubble doesn't
     slide in twice.
   - New tokens in `global.css`, twins of mobile's: `--chat-failed-tick`, `--error-bg`,
     `--error-text`. New classes: `.bubbleFailed`, `.tickFailed`, `.retryPill`, with hover,
     active, focus-visible and reduced-motion states.
   - The `restoreDraft` stopgap from earlier today is gone. The failed bubble replaces it.

`npm run build` passes. I haven't checked it in a browser; please do when you pull.

### Mobile (Vishwajeet's): automatic retry, and why "tap to retry" looked broken

- **Automatic retry, the same rules as web.** `useSendMessage` has `retry`/`retryDelay`
  (5 retries: 2, 4, 8, 16, 30 s; only for retryable errors) and `scope` (one send at a time
  per conversation). It uses `networkMode: 'online'`, with TanStack's online state wired to
  NetInfo in `app/_layout.tsx`, so an offline send waits without using up tries. Every other
  query and mutation is pinned to `networkMode: 'always'` and `refetchOnReconnect: false`,
  exactly as they behaved before.
- **Before each retry**, if the bubble is no longer waiting (Realtime swapped the real row
  in), it returns `{ message: null }` instead of posting again.
- **Each try times out after 15 s** (`SEND_TIMEOUT_MS`, an `AbortController`; `api.post`
  takes an optional `signal`). fetch has no timeout of its own, so a send on a connection
  that went quiet showed its clock indefinitely.
- **Metro logs every step:** `[send] try N failed (…); retrying in Ns`, and
  `[send] gave up (local-…): <reason>`. `onError` used to throw the error away, so a failure
  told you nothing.
- **The pill now reads "Failed to send"**, and the ⓘ tick is white (`colors.chatFailedTick`
  = `#FFFFFF`; it was `#F87171`). MESSAGES_SPEC §2 and §3 are updated to match.
- **A message still sending when the app closed now comes back as failed**, with its pill
  (`markUnsentAsFailed` in `app/_layout.tsx`, run after the saved cache is restored). It used
  to come back as a clock with nothing to tap.
- **`GET /api/messages/history`:** messages **you** hid are left out (the other person still
  gets them). `next_cursor` is still computed from the unfiltered page, so **a page can hold
  fewer than `limit` items, even zero, while `next_cursor` is set.** Keep paging until
  `next_cursor` is `null`. Never treat a short page as the end.

### New fields on existing responses

On every message row (`/send` 201, `/history` items, Realtime payloads):

| Field | Meaning |
|---|---|
| `reply_to_id` | The message this one replies to, or `null` |
| `reply_to_sender_id` | Who wrote the quoted message. **Non-null = this message is a reply** — use this, not `reply_preview`, to decide whether to draw a quote |
| `reply_preview` | The quoted message's first 200 characters. `null` on a reply means the original was deleted for everyone → draw "Original message was deleted", italic, not tappable |
| `deleted_at` | Set = tombstone (`content` is `""`). Draw "You deleted this message" / "This message was deleted", no ticks |

On inbox rows (`GET /api/messages/inbox/:userId`):

| Field | Meaning |
|---|---|
| `last_sender_id` | Who sent the last message you can see. Your own id → "You: …" (§10.9) |
| `last_message_deleted` | The last visible message is a tombstone; `last_message` is `""` |

Messages you hid are skipped by the inbox. If you hid every message in a conversation, it
leaves your inbox until a new message arrives.

### Test data

Seeded users (password `password123`): `arjun.mehta`, `priya.nair`, `rahul.verma`. The Wacom
thread is listing `e0000000-0000-4000-8000-000000000004`.

All 11 checks in runbook V-C passed against the local API on 16 Oct:

1. A reply to `f…06` → `reply_to_sender_id` = Priya, `reply_preview` "Works for me, I will
   wait at the hostel gate."
2. A reply to `f…08` (another thread) → `REPLY_TARGET_INVALID`
3. `"   "` → `MISSING_FIELDS`
4. Priya sends → a uuid
5. Arjun deletes it for everyone → `NOT_MESSAGE_SENDER`
6. Priya deletes it for everyone → `content: ""` with `deleted_at` set
7. Priya on the days-old `f…06` → `DELETE_WINDOW_EXPIRED`
8. Arjun hides `f…05` for himself → `{"id":"f…05","hidden":true}`
9. Arjun's history `grep -c f…05` → 0
10. Priya's history → 1
11. Priya's inbox has `last_sender_id` and `last_message_deleted` (`true`)

Six more checks, all as `API.md` says:
- 2001 characters → `INVALID_FORMAT`.
- `reply_to_id: "nope"` → `INVALID_FORMAT`.
- `reply_to_id: null` sends a plain message with `content` stored untrimmed.
- `:id` = `not-a-uuid` → `INVALID_FORMAT`.
- Rahul (not in the thread) on either route → `MESSAGE_NOT_FOUND`.
- No token → 401.

### What NOT to do yet

- Realtime: a delete-for-everyone arrives as an UPDATE with `deleted_at` set. The replies
  that quoted it arrive as UPDATEs with `reply_preview` null. A delete-for-me sends NO
  Realtime event at all (that is the point), so remove the message locally after the 200.
  - The website already listens for UPDATE on `messages` (`Messages.jsx:1400`), and the
    handler swaps in the whole `payload.new`. So tombstones and wiped quotes already reach
    state today. Only the rendering is missing: until §10 is built, a tombstone draws as an
    empty bubble.
- Don't decide "is it too late to delete for everyone?" from a client clock as the rule. Use
  `DELETE_FOR_EVERYONE_MINUTES` only to decide whether to show the choice, and handle
  `DELETE_WINDOW_EXPIRED` when the server says so.
- Don't send `reply_to_sender_id` or `reply_preview`. They're overwritten.

---

<a id="2026-10-17-124921-vishwajeet-mobile-privacy-states-hidden-seller-commenters-pro"></a>

## 9 · Mobile privacy states: hidden seller, commenters, profile (V-D)

`2026-10-17-124921-vishwajeet-mobile-privacy-states-hidden-seller-commenters-pro.md` · 2026-10-17 12:49 · vishwajeet · block V-D · for neeraj

The app now handles everything your N-C hides: `seller: null` / `seller_hidden`,
`user: null` / `user_hidden`, `university_name`, and 401/404 from
`GET /api/user/:id/public`. It was built to API.md "The identity rule (Phase 6B)" and the
runbook's CC-V4. It works the same way as your N-D on the website: hidden means "Yahora student",
with no photo and no profile link.

**Only `mobile/` changed.** No backend, frontend or supabase file, and nothing in products or
share, which are still on loan to you.

On the phone, this can only happen to a **demo account that opens a real campus's listing or
profile from a link**. The campus switcher keeps demo accounts on the demo campus, and the app
can't be used logged out. Real students see exactly what they saw before.

### What the app does now

| Where | When hidden |
|---|---|
| Product card (feed, swipe deck) | Seller row reads **Yahora student**, with a person icon in the same circle instead of initials. Same size, same place. A safety net: a demo account can't open a real campus's feed. |
| Product page, seller section | **A student at <university_name>**, or **A Yahora student** when there's no `university_name`. Under it: *Verified students can see who's selling.* No education line, no "View profile", and the row can't be tapped. |
| Product page, action bar | "Your listing" is never shown for a hidden seller. No Message Seller button. A demo account on a real listing gets the existing "Home campus only" lock. |
| Comments | **Yahora student** with the person icon. The reply box reads "Reply…" instead of "Reply to <name>…". A `user: null` without the flag is drawn the same way (fail closed). |
| Public profile | 404 or 401 from our API → **This profile isn't available.** with a Go back button. Not retried, so there's no long spinner. Any other error still shows "Couldn't load" with Retry. |

Files: `src/types/index.ts`, `src/components/Avatar.tsx` (new `hidden` setting),
`src/components/ProductCard.tsx`, `src/components/CommentThread.tsx`,
`app/product/[id].tsx`, `app/profile/[id].tsx`, `src/hooks/usePublicProfile.ts`.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None. One request changed on the app side:

- **`GET /api/user/:id/public` no longer gets `?user_id=`** from the app. Your N-C ignores it,
  and the app already sends the token.
- The app still sends `?user_id=` to `GET /api/products/:id`. `products.controller.js` has
  read the viewer from the token since Phase 4, so it does nothing. I left it alone because
  CC-V4 only covered the profile request.

### New fields on existing responses

None. The app now reads `seller_hidden`, `user_hidden` and `university_name` from N-C.

### Test data

- `npx tsc --noEmit` passes.
- **Not yet tried on a phone.** Checkpoint V-D, as the runbook gives it, runs as a demo account
  using QR-code links:
  - Rahul's cycle `e0000000-0000-4000-8000-000000000007`: the hidden seller and the hidden
    commenters.
  - His profile `b0000000-0000-4000-8000-000000000003`: "This profile isn't available."
  - Then `arjun.mehta` / `password123`: everything as before.
- I'll add a follow-up entry if anything there fails.

### What NOT to do yet

- **Your open question from N-C** (commenters hidden by the listing's campus, not their own)
  is still open. V-D doesn't depend on the answer: the app draws whatever `user_hidden` says,
  so either fix on the API side works with no change to mobile.
- Don't start sending a hidden person's id anywhere for mobile's sake. The app never needs
  `seller_id` once the seller is hidden.

---

<a id="2026-10-17-150430-neeraj-m1-live-identity-rule-views"></a>

## 10 · M1 live: identity rule + views

`2026-10-17-150430-neeraj-m1-live-identity-rule-views.md` · 2026-10-17 15:04 · neeraj · block T1 · for vishwajeet

### Migrations applied

### New endpoints

### Changed endpoints (BREAKING)

### New fields on existing responses

### Test data

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

### What NOT to do yet

---

<a id="2026-10-18-115559-neeraj-mark-as-sold-endpoints-n-e"></a>

## 11 · Mark as Sold endpoints (N-E)

`2026-10-18-115559-neeraj-mark-as-sold-endpoints-n-e.md` · 2026-10-18 11:55 · neeraj · block N-E · for vishwajeet

Mark as Sold now runs through your `mark_sold` functions (V-B). This entry covers all of N-E:
- part 1 is the products routes;
- part 2 is the dashboard and public-profile data in my user module.

Build the app's Mark-as-Sold screens (V-F) from this entry and `backend/API.md`.

**⚠ Edited on loan:** `backend/src/modules/products/products.controller.js` and
`products.routes.js`. The `OWNER:` banners are unchanged.

Also changed:
- `backend/src/modules/user/user.controller.js` (mine).
- `backend/API.md`.

This is one PR across two modules (products and user), because the screens need both. It needs
your review.

How the controller works now:
- It checks only the request's **shape** (uuids).
- It calls **one** function and passes any error to `mapDbError`. No rule is re-checked in
  JavaScript.
- `blockNonOwner()` is **deleted**, because the functions check ownership themselves.

All four routes are `requireAuth`. Send `Authorization: Bearer <token>`.

### Migrations applied

None. This uses `mark_product_sold`, `mark_product_available`, `remove_my_purchase` and
`get_product_buyer_candidates` from V-B, plus `search_users`.

### New endpoints

#### `GET /api/products/:id/buyer-candidates?q=` — the seller only
The "Who bought it?" picker (MARK_SOLD_SPEC §1).

- **`q` missing or under 2 characters** (trimmed): the people who **messaged the seller about
  this listing**.
  - Only people on the listing's campus.
  - Never the seller.
  - Newest conversation first, at most 20.
  - Every item has `messaged: true`.
  - **An empty `items` means the "Messaged you about this" section is left out** (spec §1).
- **`q` of 2+ characters**: students on the seller's campus whose name or @username matches.
  - Never the seller.
  - Demo and real accounts never mix.
  - At most 20, with `messaged: false`.
  - Debounce 300 ms on the client (spec §1).
- **200:**
  ```json
  { "items": [ { "id": "uuid", "username": "arjun.mehta", "full_name": "Arjun Mehta",
                 "avatar_url": null, "messaged": true } ],
    "next_cursor": null }
  ```
  A fixed top-20: `next_cursor` is **always null**, as on `/api/users/search`.
- **Errors:**
  - `400 INVALID_FORMAT`: `:id` is not a uuid.
  - `401 UNAUTHORIZED`
  - `403 NOT_PRODUCT_OWNER`
  - `404 PRODUCT_NOT_FOUND`
  - `500 INTERNAL_ERROR`
- "Someone not on Yahora" is **not** a row in this list. The app draws that row and sends
  `buyer_id: null` to `/sold`.

#### `DELETE /api/products/:id/purchase` — the buyer only: "That wasn't me"
- No body. The purchase removed is always the caller's own.
- **200:** `{ "removed": true }`. The listing **stays sold**, with no buyer on Yahora, so the
  seller's `product.buyer` becomes `null`.
- **Errors:**
  - `400 INVALID_FORMAT`
  - `401 UNAUTHORIZED`
  - `404 PURCHASE_NOT_FOUND`: the caller isn't this listing's buyer. A second call also gets
    this, so treat it as done on a retry.
  - `500 INTERNAL_ERROR`

### Changed endpoints (BREAKING)

#### `POST /api/products/:id/sold` — the seller only
- **Body:** `{ "buyer_id": "uuid" | null }`. A missing `buyer_id` or `{}` means **null**:
  "someone not on Yahora", and no one is tagged. Your current `api.post(…/sold, {})` keeps
  working.
- **200 is unchanged:** `{ "message": "Product marked as sold", "product": <products row> }`.
  The row now has `status: "sold"` and `sold_at` set.
- **Calling it again changes the buyer** and **keeps the first `sold_at`**. That is "Change
  buyer", and a double tap is not an error.
- **Errors — the codes changed:**

  | Status | Code | When |
  |---|---|---|
  | 400 | `INVALID_FORMAT` | `:id` or `buyer_id` is not a uuid |
  | 400 | `BUYER_IS_SELLER` | `buyer_id` is the caller |
  | 400 | `BUYER_NOT_ON_CAMPUS` | the buyer's campus isn't the listing's (a demo account, too) |
  | 401 | `UNAUTHORIZED` | |
  | 403 | `NOT_PRODUCT_OWNER` | was `FORBIDDEN` |
  | 404 | `PRODUCT_NOT_FOUND` | was `NOT_FOUND` |
  | 404 | `BUYER_NOT_FOUND` | no user with that id (before 6B the endpoint returned 200 anyway) |
  | 500 | `INTERNAL_ERROR` | with `message`. The old `{ "error": "Failed to mark product as sold." }` is gone |

- Before 6B, the purchase insert was fire-and-forget, and a second call added a second buyer.
  Now a 200 means the buyer, or no buyer, is recorded. There is at most one buyer per listing.

#### `POST /api/products/:id/available` — the seller only (Relist)
- No body. **200 is unchanged:**
  `{ "message": "Product marked as available", "product": <products row> }`, with
  `status: "available"` and `sold_at: null`. The buyer is removed.
- **Errors:**
  - `400 INVALID_FORMAT`
  - `401 UNAUTHORIZED`
  - `403 NOT_PRODUCT_OWNER` (was `FORBIDDEN`)
  - `404 PRODUCT_NOT_FOUND` (was `NOT_FOUND`)
  - `500 INTERNAL_ERROR`

### New fields on existing responses

- **`GET /api/products/:id` → `product.buyer`, for the seller only.**
  - It is present only when the caller **is the seller** and the listing is **sold**.
  - Value: `{ "id", "username", "full_name", "avatar_url" }`, or `null` when sold to someone not
    on Yahora, or after "That wasn't me".
  - **For everyone else the key is absent.** That includes the buyer, other students and
    logged-out callers.
  - Use it to start the picker on the current buyer for **Change buyer**. If it is `null`, start
    on the off-platform row (spec §1).
- **`sold_at`** (timestamptz, `null` unless sold) is on every products row (`*`): in the list,
  the detail and the `/sold` / `/available` responses. Your V-B trigger sets it.

#### `GET /api/user/:userId/dashboard` — own dashboard (part 2)
- **`listings[].sold_at`**: `null` unless sold.
- **`listings[].buyer`**: on **every** listing.
  - Value: `{ "id", "username", "full_name", "avatar_url" }` for a sold listing's buyer.
  - Otherwise `null`: not sold, sold to someone not on Yahora, or "That wasn't me".
  - Use it for the sold card's buyer line, and to start **Change buyer** on the right row.
- **`purchases[].product`** gains `status`, `sold_at` and
  **`seller: { "id", "username", "full_name", "avatar_url" }`**: who the caller bought from.
  It's for the buyer's purchases list and its "That wasn't me"
  (`DELETE /api/products/:id/purchase`).

#### `GET /api/user/:userId/public` — anyone the identity rule lets in (part 2)
- **`sold_listings`**: `[{ "id", "title", "price", "image_urls", "condition", "sold_at" }]`.
  - Only this seller's sold listings, newest `sold_at` first, **at most 12**.
  - No like/save flags.
- **`sold_count`**: the total number of sold listings, which can be more than 12. Use it for a
  "Sold (N)" heading.
- **No buyer anywhere** in this response.

### Test data

Run locally against `supabase db reset` data. Priya (`priya.nair`) sells the Wacom
`e0000000-0000-4000-8000-000000000004`, and Arjun messaged her about it. The password for all of
them is `password123`.

`buyer-candidates`:
- As Priya, no `q` → Arjun, `messaged: true`.
- `q=ra` → Rahul only, `messaged: false`.
- `q=sneha` → `[]`: she is at NIET, another campus.
- As Arjun, either mode → `NOT_PRODUCT_OWNER`.
- A missing listing, either mode → `PRODUCT_NOT_FOUND`.
- No token → `UNAUTHORIZED`.

`/sold`, bad input:
- `:id` = `abc` → `INVALID_FORMAT`.
- `buyer_id: "x"` → `INVALID_FORMAT`.
- As Arjun → `NOT_PRODUCT_OWNER`.
- `buyer_id` = Priya → `BUYER_IS_SELLER`.
- An unknown uuid → `BUYER_NOT_FOUND`.
- Sneha → `BUYER_NOT_ON_CAMPUS`.
- After all of these the listing was still `available`, with 0 purchases.

`/sold`, then the buyer field:
- To Arjun → 200, `status: "sold"`, `sold_at` set.
- Priya's detail has `buyer` = Arjun.
- No `buyer` key for Arjun, Rahul or a logged-out caller.

Change buyer, then "That wasn't me":
- Changing the buyer to Rahul keeps the same `sold_at`, with 1 purchase, Rahul's.
- Arjun's `DELETE /purchase` → `PURCHASE_NOT_FOUND`.
- Rahul's → `{ "removed": true }`.
- Priya's detail: still `sold`, `buyer: null`.

Old clients, and relist:
- `/sold` with `{}` (like today's app) → 200.
- `/available` → `status: "available"`, `sold_at: null`.

Part 2, with the Wacom sold to Arjun:
- **Priya's dashboard:**
  - The Wacom has `sold_at` and `buyer` = `arjun.mehta`.
  - Every other listing has `buyer: null`.
  - No `purchase` key anywhere.
- **Arjun's dashboard:** the purchase's product has `status: "sold"`, `sold_at` and
  `seller` = `priya.nair`.
- **Priya's `/public`, as Rahul:** `sold_count: 1`, `sold_listings` = the Wacom, and no
  `buyer` anywhere in the JSON. After relisting: `sold_count: 0`, `[]`.
- **Embed shape:** local PostgREST returns `purchase` as an object, or `null`. The code also
  takes a one-element array.

Afterwards I put the Wacom back the way it was: available, with no purchase and no extra views.

### What NOT to do yet

- **The buyer is private. Show it only to the seller and the buyer (MARK_SOLD_SPEC §0).**
  Everyone else sees **SOLD**. The API only ever sends `buyer` to the seller.
- Don't write `purchases` or `products.status` directly from the app. Use these routes.

---

<a id="2026-10-18-131806-vishwajeet-web-fixes-in-your-files-calm-send-tick-dropdowns-a"></a>

## 12 · Web fixes in your files: calm send tick, dropdowns, avatar menu

`2026-10-18-131806-vishwajeet-web-fixes-in-your-files-calm-send-tick-dropdowns-a.md` · 2026-10-18 13:18 · vishwajeet · block V-C · for neeraj

### ⚠ I edited `frontend/` (yours): `Messages.jsx`, `onboarding.jsx`, `Dashboard.jsx`

Vishwajeet found these while testing and asked for them on web as well as the app. Please
review rather than re-implement. They are small diffs, and nothing else in those files changed.
`npm run build` passes. I haven't checked them in a browser.

#### 1. `Messages.jsx`: a queued send turns into ticks without its bubble moving

Repro: stop the backend, send D, E, F (they show the clock, then ⓘ), start the backend. Just
before the ticks appeared, each bubble flickered or shifted. Two causes:

- **The key changed.** Bubbles were keyed by `msg.id`, which is the `local-…` tag until the
  server row arrives. The new id remounted the bubble.
- **The time changed.** The server's `created_at` is when the backend came back, not when the
  student typed. The clock label changed, and so did `isGroupedWith` against the previous
  message. That changes `runStart`/`runEnd` (spacing and tail), so neighbours moved too.

The fix is the same as mobile's (`mobile/src/lib/messages.ts`):

- **`adoptServerRow(local, incoming)`:** when the server row takes over a bubble sent from this
  page, it keeps that bubble's `client_tag` and `created_at`. `mergeServerMessage` uses it on
  both swap paths, and so does the Realtime UPDATE handler. Without that, a read tick would
  throw them away.
- **`messageKey(msg)`** = `client_tag || id` is the React key, and also what `openingIdsRef`
  is checked against. Because the bubble no longer remounts, the two
  `openingIdsRef.current.add(<server id>)` calls are gone. They only existed to stop a remount
  from replaying the entrance.
- **The time shown on screen is the time it was typed**, as WhatsApp does. The other person,
  and this page after a reload or a chat switch, see the server's time.
- `mergeServerMessage(list, row, clientTag)`: if Realtime already inserted the row by id, the
  leftover placeholder for that tag is dropped.

#### 1b. `Messages.jsx`: a failed message no longer disappears when the chat is reopened

Repro: stop the backend, send B, and wait about 75 s until it fails. Open another chat, then
come back: B was gone. Two causes:

- **Web only.** When `GET /history` failed, the `catch` set `messages` to `[]`, so the failed
  bubble went with the rest. It now sets the thread's own unsent messages (`unsentFor(chat)`).
  They belong to this conversation, so showing them can't mix two chats.
- **Web and mobile.** When history loaded again, an unsent bubble was dropped if **any** of my
  messages in the page had the same text. A test "B" nearly always matches an older "B". Now
  each new bubble records `sent_after_id`, the newest server message when it was typed
  (`newestServerId`). `unsentStillMissing(history, unsent)` lets only a matching message
  **after** that anchor count as "already on the server", and each one accounts for at most
  one bubble. That keeps the case the check was there for (a send that got through but lost
  its answer) without the false match. `sent_after_id` is client state only. It is never sent.

#### 1c. `Messages.jsx`: failed messages resend by themselves; "Couldn't load this chat"

Vishwajeet's call on 18 Oct. **MESSAGES_SPEC §2 is updated** ("Sending again on its own" and
"Loading"), and §5 gains allowed difference #11.

- **`auto_retry`** on a failed bubble is `isRetryableSendError(error)` at give-up. True means
  the server couldn't be reached. A refusal (any other 4xx) is `false` and still needs a tap.
- **`waitingOnServer`**: while the open thread has an `auto_retry` failure, or
  `historyError`, it calls `GET /api/health`:
  - at once, then every `SERVER_PROBE_MS` (10 s);
  - again on `online` and `visibilitychange`;
  - one probe at a time, each given up after 10 s.

  On a 200, `onServerBackRef` reloads the history if it had failed, then `deliver()`s those
  messages in order. It only does this for the open thread.
- **`historyError`**: set by `handleSelectChat`'s `catch` and cleared when a chat opens. It
  draws `.historyError` (wifi-off circle, "Couldn't load this chat", Retry pill), a copy of
  mobile's `ChatState`, above the thread's unsent messages. It also hides the "beginning of
  your conversation" banner, because that isn't known while the history is missing.
- New `global.css` tokens: `--muted-text`, `--input-border-focus` (mobile's `mutedText`,
  `inputBorderFocus`).

#### 1d. `Messages.jsx`: a long message's read tick no longer wipes its text

Found on the phone: a 2000-character message crashed the chat
(`jumboEmojiCount` on `undefined`) as soon as its delivered tick arrived. Web has the same code
path and would have thrown the same way. It just hadn't received such an update yet.

- **Why.** `messages` has the default replica identity. When an UPDATE changes only
  `is_delivered`/`is_read`, Postgres leaves out of the change record any unchanged column stored
  out of line (TOAST, roughly 2 KB and up). In the local DB the three 2000-character rows are in
  `pg_toast`; the short ones aren't. So Realtime's `payload.new` arrives without `content`, and
  the handler swapped it in whole.
- **Fix.** `withLeftOutColumns(local, updated)` fills any column the update left out from the
  row on screen, then goes through `adoptServerRow` as before. Mobile has the same helper in
  `replaceMessage`. Its restored cache also drops any row that already lost its text, then marks
  the chat stale so the history load brings the row back.
- **Not chosen:** `REPLICA IDENTITY FULL` on `messages` would make Postgres send every column on
  every tick. That means a migration and more WAL for something the client can do itself.

#### 1e. `Messages.jsx`: a very long message can now be marked read

Found on the phone: in one chat the other person never got blue ticks, and the inbox badge
stayed at 2 after the chat was read. The two unread rows were 2000-character messages
(`is_read = false` in the DB, while every shorter message around them was read). A message
counted as seen once half of **it** was on screen. A bubble taller than twice the thread can
never be half on screen, so it was never read. The phone's thread is short enough for that. Your
web pane mostly isn't, but a small window would be.

- **Web:** `flushVisibleRead` now divides the shown pixels by `min(row height, thread height)`.
  A row counts once half of it is visible, or once it fills half the thread. Rows shorter than
  the thread are judged exactly as before.
- **Mobile:** two viewability configs, `SEEN_BY_ROW` (50% of the row) and `SEEN_BY_THREAD`
  (50% of the thread). A row needs only one of them.
- **MESSAGES_SPEC §2 "Unread behaviour"** is updated, with a §0.2 row.

#### 1f. `Messages.jsx`: switching chats puts the cursor in the composer

An effect on `activeChat`'s `contact_id`/`product_id` focuses `chatInputRef`
(`preventScroll`), so you can type as soon as a chat opens. It applies on `(pointer: fine)`
screens only. On touch it would raise the keyboard over the thread, which is also why the app
doesn't do it.

#### 2. `onboarding.jsx`: an Edit Profile dropdown showed only the current value on the first click

`SearchableSelect`'s `onFocus` puts the chosen label into the search box, so it can be edited
with Backspace. The same text then filtered the menu down to that one option. Clicking again
closed and reopened the menu, which cleared the text, so the full list showed. Now
`seededLabel` remembers what was put there, and `filterOption` shows every option while the box
still holds exactly that. The first keystroke or delete filters as before. Fresh onboarding
never had this, because there is no value to put in the box.

#### 3. `Dashboard.jsx`: the avatar pencil menu closes on an outside click

`Avatar` has refs on the pencil and the menu. While the menu is open, a `pointerdown` anywhere
else closes it, and so does Escape. The pencil still toggles it.

### Mobile (mine), for the record

- The same send fix, plus a real ordering bug: `useSendMessage.onSuccess` removed the
  placeholder and *appended* the server row, so D jumped below the still-queued E and F. It now
  swaps in place. The retry guard checks `id === clientTag` instead, because the adopted row
  also carries the tag.
- Edit Profile has the avatar row from onboarding, and the dashboard's Change/Remove sheet when
  a photo is already set.
- `AvatarSheet`: the dark scrim shows at once. Only the sheet slides up.

### Local seed: production's courses and specializations

`supabase/seed.sql` now seeds the **production** lists (80 courses, 348 specializations,
copied by name on 18 Oct), not the old 5 + 5 stub. The local dropdowns now behave like the
live ones: long lists, search, scrolling.

- **After your next `supabase db reset`:**
  - `B.Tech`, `M.Tech`, `B.Des`, `MBA`, `PhD` and `Design` are gone. Production has none of
    them; its names are like `B.Tech/BE (Bachelor of Technology/Bachelor of Engineering)`.
  - The seeded test users now point at that B.Tech/BE course, with Computer Science and
    Engineering as their specialization.
- **The fixed `c0…` / `d0…` ids are gone too.** Nothing referenced them. Look a row up by name.
- Seed only. Production isn't touched, and no migration changed.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None. No backend file changed.

### New fields on existing responses

None. `client_tag` on a sent row is client state only, never sent to the server.

### Test data

- `npm run build` (web) and `npx tsc --noEmit` (mobile) pass.
- I compiled mobile's `mergeMessage` / `replaceMessage` and ran the D/E/F case through it.
  D landed via HTTP. E landed via Realtime, then its HTTP response. F landed, then got a read
  tick. Order, keys and typed times were unchanged throughout, with no duplicates. The web
  helpers are line-for-line twins of these.
- Nothing was checked in a browser or on a phone.

### What NOT to do yet

- Don't key chat bubbles by `msg.id` again. Use `messageKey(msg)`.
- Don't swap `payload.new` in raw on UPDATE. Go through `withLeftOutColumns` and
  `adoptServerRow`. Without them a read tick brings the flicker back, or wipes a long message's
  text. This applies to any other table you listen to UPDATEs on: a long text column there will
  be missing too.
- When you build the §10 delete-for-everyone choice: a bubble sent from here shows its typed
  time, which can be earlier than the server's. A client-side 60-minute check on it is
  conservative, never generous, and `DELETE_WINDOW_EXPIRED` from the server still decides.

---

<a id="2026-10-22-132907-vishwajeet-visitor-mode-no-like-save-buttons-on-another-campu"></a>

## 13 · Visitor mode: no like/save on another campus; demo profile gate says log in

`2026-10-22-132907-vishwajeet-visitor-mode-no-like-save-buttons-on-another-campu.md` · 2026-10-22 13:29 · vishwajeet · block V-D · for neeraj

Found on the phone during checkpoint V-D: as a demo account on Rahul's cycle
(`e0000000-0000-4000-8000-000000000007`), tapping like or save lit the button up for a moment,
then it went out again. The API refuses both on another campus's listing
(`CROSS_CAMPUS_INTERACTION_BLOCKED`), so the optimistic flip was rolled back. The same happens to
a student browsing another campus in the Marketplace. Vishwajeet asked for the fix on web as
well as the app.

### ⚠ I edited `frontend/` (yours): `ProductDetail.jsx`, `ProductCard.jsx` (+ `.module.css`), `Marketplace.jsx`, `PublicProfile.jsx`

Please review rather than re-implement. `npm run build` passes. I haven't checked it in a browser.

- **`ProductCard`: new prop `canInteract` (default `true`).** When `false`, the photo's overlay
  heart and the footer bookmark are left out, and the footer heart is a plain count
  (`<span className={styles.statCount}>`, new class), not a button. Share stays. Every existing
  caller is unchanged.
- **`Marketplace.jsx`:** the grid and `SwipeCard` pass `canInteract={!isForeignCampus}`. In visitor
  mode a right swipe calls `handleSwipePass`, so the card moves on and no like is sent.
- **`ProductDetail.jsx`, when `isForeignCampus`:**
  - the like chip is a `<span>` (count only, no hover);
  - **Save Item** is not rendered;
  - the banner says "Liking, saving, messaging & commenting are disabled." It used to say
    "Purchasing & commenting".

- **`PublicProfile.jsx`: a demo account's 404 now shows the login gate**, not "This profile
  isn't available." Vishwajeet's point: "isn't available" reads as "this student isn't on
  Yahora". The gate's copy is unchanged ("Log in to see this profile" / "visible only to
  verified students"), and it is the same for every id, so it still doesn't say whether the
  person exists. For a demo account the button reads "Log in with college email" and calls
  `logout()` before `navigate("/auth")`, because `GuestOnly` bounces a signed-in caller home
  (same as the Marketplace demo alert). A student's 404 still says "isn't available".
- **The gate itself was restyled** on Vishwajeet's request (it was an inline-styled card in
  Bree Serif with a wrapping button). It is now a `ProfileGate` component in
  `PublicProfile.jsx`, styled by a new `PublicProfile.module.css` (gate classes only; the page
  still uses `Dashboard.module.css`). Both states use the same card: lock or user-x icon, title,
  one line of copy, and a "Go back" link (`navigate(-1)`, or `/marketplace` with no history).
  The login state adds a "Students only" eyebrow, the gradient button, and for a demo account
  "This ends your demo session." Rise-in on load, off under `prefers-reduced-motion`.

Logged-out visitors are unchanged. They still get the existing "Please log in to like items."
alert, and `isForeignCampus` is false without a home campus.

### Mobile (mine), for the record

- **Product page:** on another campus, the heart and bookmark are not in the action bar. The
  "Home campus only" pill fills the bar. The note reads "liking, saving and messaging are for
  your home campus." The likes count in the stats row stays.
- **Marketplace on another campus:** the card heart gets no `onLike`, so it's a plain count. A
  right swipe in the deck moves on without liking.
- **Profile gate:** same change as the web. A demo account's unavailable profile says "Log in to
  see this profile" with a "Log in with college email" button (signs out, then the login
  screen) and a "Go back" link.
- **Cache leak between accounts (found on the phone):** after signing in as a student and then
  as the demo account, Rahul's cycle still showed his name and the commenters' names. The API
  was right; the app's query cache is saved to the phone and was never emptied, and its keys
  don't say who asked. `AuthContext` now empties it (`cancelQueries()` then `clear()`) on every
  sign-in and on sign-out. The web has no saved cache (every page fetches on open), so it never
  had this.
- **Marketplace search:** a new search or filter now scrolls the grid to the top, as a re-sort
  already did. Before, the shorter result list kept the full feed's offset and the first card
  was cut off under the search bar. Web's page scroll doesn't have the same problem, so web is
  unchanged here.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None. No backend file changed.

### New fields on existing responses

None.

### Test data

- `npm run build` (web) and `npx tsc --noEmit` (mobile) pass.
- Nothing was checked in a browser or on a phone.

### What NOT to do yet

- **Still open: the public profile.** A student who opens another campus's seller profile still
  gets live like/save on that seller's listings, and the same flash. Neither client can tell,
  because `GET /api/user/:userId/public` strips the profile's `university_id`
  (`user.controller.js`, after the identity check). Returning it, or a `same_campus` flag, would
  let both clients pass `canInteract`. That's your module, so it's your call.
- Don't put the like/save buttons back on a foreign listing behind an alert. Hiding them is the
  choice for both clients.

---

<a id="2026-10-24-010617-vishwajeet-sendmessage-refuses-messages-to-yourself"></a>

## 14 · sendMessage refuses messages to yourself

`2026-10-24-010617-vishwajeet-sendmessage-refuses-messages-to-yourself.md` · 2026-10-24 01:06 · vishwajeet · block V-FIX · for neeraj

`POST /api/messages/send` used to accept a `receiver_id` equal to the sender. That made a
conversation with yourself whose unread badge never cleared. The website now hides the button,
but the API has to refuse it for every caller, including old clients and hand-made requests.

Files:
- `backend/src/modules/messages/messages.controller.js` (mine).
- `backend/API.md`.
- `docs/runbooks/PHASE_6B_RUNBOOK.md` Appendix B.

Nothing in products, share, `frontend/` or `mobile/` changed.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

#### `POST /api/messages/send`: new `400 CANNOT_MESSAGE_SELF`

```json
{ "error": "CANNOT_MESSAGE_SELF", "message": "You can't message yourself." }
```

- **When:** `receiver_id` is the token holder. The comparison ignores case, so an upper-case
  copy of your own id is refused too. Postgres would have treated it as the same uuid.
- **Order:** the check runs after the `MISSING_FIELDS` check and the `receiver_id` /
  `product_id` `INVALID_FORMAT` check, and before any database call. So a request with
  empty `content` and your own id still gets `MISSING_FIELDS`.
- **It's a permanent 4xx**, like every other 4xx from `/send`. The web retry loop
  (`sendWithRetries`) already fails a non-retryable 4xx at once, so a self-send would show
  the failed bubble and never retry. With the button hidden, the web shouldn't reach this.
- **Breaking only for a client that sent messages to itself.** No screen should do that.

### New fields on existing responses

None.

### Test data

Run on 24 Oct against the local API and local database, as `arjun.mehta` / `password123`, on
the Wacom listing `e0000000-0000-4000-8000-000000000004`:

- `node --check` on the controller passes.
- Arjun to Arjun (`b0…001`): `400 {"error":"CANNOT_MESSAGE_SELF","message":"You can't message yourself."}`.
- Arjun to `B0…001` (upper case): the same 400.
- Arjun to Priya (`b0…002`): `201`, with the full message row.
- In the local DB, `select count(*) from messages where sender_id = receiver_id` returns `0`.
  I deleted the test message to Priya afterwards.

### What NOT to do yet

- **This doesn't remove existing self-conversations.** Production may still have rows where
  `sender_id = receiver_id` from before this fix. Clearing them would be a database change,
  which is mine to do. Tell me if you see one in your inbox.

---

<a id="2026-10-24-020050-vishwajeet-photo-and-avatar-file-names-no-longer-contain-user"></a>

## 15 · Photo and avatar file names no longer contain user ids

`2026-10-24-020050-vishwajeet-photo-and-avatar-file-names-no-longer-contain-user.md` · 2026-10-24 02:00 · vishwajeet · block V-FIX · for neeraj

Your T1 finding (17 Oct): product photo file names started with the seller's id
(`f9c43cc9-…-1791897838329-9fjof8.jpeg`), so `image_urls` leaked `seller_id` after N-C hid it.
Avatars had the same problem (`<userId>-<Date.now()>.<ext>`). Stored files are now named
`<random uuid>.<ext>`.

### ⚠ I edited two files in your scope, as we agreed

- **`backend/src/modules/products/products.controller.js`** is on loan to you for 6B. The
  `OWNER:` banner is unchanged. What I changed:
  - the `randomUUID` import;
  - a `storageExt()` helper under the imports;
  - in `createProduct`, the two lines that built `fileName` became one line.
- **`backend/src/modules/user/user.controller.js`** is your module. The banner is unchanged.
  What I changed:
  - the same import and helper;
  - in the avatar handler, the two lines that built `newFileName` became one line.
- Nothing else in either file changed: not the bucket, not `upsert`, not the old-avatar
  deletion, not any response.

Also changed: `backend/API.md` (the two Part 1 notes that described the old names) and
`docs/PRE_LAUNCH_CHECKLIST.md` (a new section, "Wiping production before launch").

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None. `POST /api/products` and `POST /api/user/:userId/avatar` return the same shapes. Only
the file name at the end of each URL is different:

- **Before:** `…/products/<seller_id>-<ms>-<rand>.jpg` and `…/avatars/<userId>-<ms>.jpg`
- **Now:** `…/products/8ab33b2e-9df4-44f7-a763-9bd02ac9c93d.png` and
  `…/avatars/1b51bb6f-e197-42f5-8ec1-93c67ec4645e.webp`

**The extension rule (`storageExt`, the same in both files):**
1. If the original file name has a dot, take what follows the last dot. Use it, lower-cased,
   only if it matches `/^[a-z0-9]{1,5}$/i`.
2. Otherwise take it from `file.mimetype`: `image/jpeg` → `jpg`, `image/png` → `png`,
   `image/webp` → `webp`, any other `image/<x>` → `<x>`. The client sends the mimetype, so
   `<x>` must match the same pattern.
3. Otherwise `bin`.

A name with no dot never reaches the storage path. The old `split('.').pop()` returned the
whole name in that case.

Old URLs keep working. Files already in the buckets keep their old names until the
pre-launch wipe.

### New fields on existing responses

None.

### Test data

Run on 24 Oct against the local API and local Supabase, as `arjun.mehta` / `password123`:

- `node --check` passes on both controllers.
- `grep -rnE '\$\{(seller_id|userId)\}-' backend/src/` finds nothing.
- `storageExt` was run from both files on twelve names. Some results:
  - `IMG_0042.JPG` → `jpg`
  - `photo` + `image/jpeg` → `jpg`
  - `my-secret-filename` + `image/webp` → `webp`
  - `a.b.c.HEIC` → `heic`
  - `weird.toolongext` + `image/png` → `png`
  - `noext` + `image/svg+xml` → `bin`
  - `noext` + `image/../../evil` → `bin`
  - `noext` + `application/octet-stream` → `bin`
- **New listing**, with one photo uploaded as `arjun-holiday-photo` (no dot, `image/png`):
  201, and `image_urls` is `…/products/8ab33b2e-….png`.
- **Avatar, uploaded twice:**
  - The first upload (`Avatar1.PNG`) was stored as `89e2197a-….png`.
  - The second (`avatar2.webp`) was stored as `1b51bb6f-….webp`.
  - After the second, the `avatars` bucket held only the `.webp`, so the old avatar is still
    deleted.
- Afterwards I deleted the listing and both files, and set Arjun's `avatar_url` back to `null`.

### What NOT to do yet

- **Production files from before this change still have user ids in their names.** Wipe the
  `products` and `avatars` buckets, not only the tables, at the pre-launch wipe. It's in
  `docs/PRE_LAUNCH_CHECKLIST.md`.
- Don't build a storage path from a user id or the original file name again. Use
  `randomUUID()` and `storageExt()`.

---

<a id="2026-10-24-154532-vishwajeet-messages-whatsapp-style-long-press-menu-select-sev"></a>

## 16 · Messages: WhatsApp-style long-press menu, select several messages, new delete dialog, reply on mobile

`2026-10-24-154532-vishwajeet-messages-whatsapp-style-long-press-menu-select-sev.md` · 2026-10-24 15:45 · vishwajeet · block V-E · for neeraj

The owner tested V-E part 2 on the phones and asked for message actions that work the way
WhatsApp's do. The bottom sheet was in the way of reactions later, you couldn't delete several
messages at once, a long-press only worked on the bubble itself, and the native delete Alert
looked out of place. This entry also includes V-E part 3 (Reply) on mobile.

**⚠️ `frontend/` was edited from my session, at the owner's request.** These are your files, so
please read the diff. Everything is in `frontend/src/pages/messages/Messages.jsx` and
`Messages.module.css`. Nothing else in `frontend/` changed.

The spec is updated in `docs/design/MESSAGES_SPEC.md`: §10.1, §10.2 (rewritten), §10.8 (the
dialog, now one look on both platforms) and the new **§10.11 Selecting several messages**.

### Website changes (`frontend/`)

- **The menu now has "Select"** (Reply · Copy · Select · Delete; a tombstone has Select ·
  Delete). Choosing it enters selection mode with that message ticked.
- **Selection mode** works like WhatsApp Web's "Select messages":
  - every row gets a tick box at its start;
  - clicking anywhere on a row ticks or unticks it, and links, quotes, the actions button and
    swipes do nothing while selecting;
  - a bar replaces the composer: `x`, "N selected", Copy (hidden if a deleted message is
    selected) and Delete. The half-typed draft is kept underneath;
  - Esc, `x`, unticking the last message, Copy, a delete or switching chats all leave it.
- **Delete with several messages** sends one existing request per message, all at once. No
  backend change. The dialog shows "Delete N messages?", and offers "Delete for everyone" only
  if every selected message allows it.
- **The whole row is the target:**
  - right-click (and the Android Chrome long-press, which fires `contextmenu`) works on the
    empty space beside a bubble, not only on the bubble;
  - **iPhone Safari never fires `contextmenu`**, so the website had no long-press there. A
    350 ms touch timer on the row now opens the menu. It is cancelled by 10 px of movement, and
    the tap a long-press ends with is ignored.
- **The delete dialog** has a trash icon, and "Delete for everyone" is now solid red. "Delete
  for me" is the softer red when both choices show, and solid red when it is the only one. The
  app uses the same design (§10.8).

### Mobile changes (mine)

- The bottom sheet is gone. A long-press anywhere on a message's row (bubble or empty space)
  selects it and opens a menu card beside the bubble. The header becomes "N selected" with
  Reply, Copy and Delete. Taps then add or remove messages.
- The app draws its own delete dialog (`DeleteMessagesDialog`) instead of the phone's Alert.
- **Part 3, Reply:** swipe right to reply, the reply bar in the composer, the quote inside a
  reply, and pressing the quote to jump to the original (it loads up to 5 older pages, then
  shows a toast).

### Migrations applied

None.

### New endpoints

None. Deleting several messages calls the existing `POST /api/messages/:id/delete-for-everyone`
or `/delete-for-me` once per message.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

Not tested on a phone or in a browser yet. The owner checks both after this entry. Builds:
`npx tsc --noEmit` (mobile) and `vite build` (frontend) both pass, and `expo export --platform
android` bundles.

### What NOT to do yet

- Don't add reactions. The gap between a message and its menu (8, `GAP` in
  `mobile/src/components/MessageActionMenu.tsx`) is where the reactions bar will go in the
  community phase, on both platforms.
- Don't add a bulk-delete endpoint unless the per-message calls cause trouble. There is no
  rate limit on `/api/messages` today.

---

<a id="2026-10-24-235526-vishwajeet-message-actions-polish-faster-hold-darker-selectio"></a>

## 17 · Message actions polish: faster hold, darker selection, WhatsApp delete dialog, centred reply arrow

`2026-10-24-235526-vishwajeet-message-actions-polish-faster-hold-darker-selectio.md` · 2026-10-24 23:55 · vishwajeet · block V-E · for neeraj

The owner tried the earlier V-E entry
(`2026-10-24-154532-vishwajeet-messages-whatsapp-style-long-press-menu-select-sev.md`) on a
phone and asked for seven fixes. The app got all seven. The website got only the ones it was
also missing (1, 2, 3, 6). **Where this entry and the earlier one disagree, this one is
right.** In particular, the earlier entry's dialog description (trash icon, solid red buttons)
is now out of date.

**⚠️ `frontend/` was edited from my session again, at the owner's request.** Files:
`src/utils/messageActions.js` (one constant), `src/styles/global.css` (one variable), and
`src/pages/messages/Messages.jsx` + `Messages.module.css`. Nothing else in `frontend/`
changed. The spec is updated: `docs/design/MESSAGES_SPEC.md` §0.2 (three new rows), §3,
§10.2, §10.3, §10.4, §10.8 and §10.10.

### What changed, item by item

| # | Owner's report | App | Website |
|---|---|---|---|
| 1 | The hold to open the menu feels long | `LONG_PRESS_MS` 350 → **250** | Same constant, same value: the touch long-press timer (`beginLongPress`) |
| 2 | Selected rows are hard to tell apart on the wallpaper | `chatRowSelected` 0.10 → **0.15** | `--chat-row-selected` 0.10 → **0.15** |
| 3 | Delete dialog: options on the right, no explanation text | Rebuilt in WhatsApp's layout | Same layout (details below) |
| 4 | The menu stays up while typing | Focusing or typing in the composer closes the menu. The selection and the header's actions stay | **No change.** The web menu already closes on any pointerdown outside it, so tapping or clicking the composer closes it |
| 5 | Sending from higher up doesn't go to the bottom | Fixed (cause below) | **No change.** The web already jumps to the bottom on your own message (the `isMine` branch of the scroll layout effect) |
| 6 | The swipe-reply arrow should be centred on the message, and bigger | 36 circle / 22 glyph (was 30 / 18), centred on the bubble's height | Same: `.swipeReplyIcon` is now 36 px, centred with `top: 0; bottom: 0; margin: auto 0` (the transform was already used by the scale), `<CornerUpLeft size={22} />` |
| 7 | Reply doesn't open the keyboard | Fixed (cause below) | **No change in code.** `startReply` focuses the composer inside the click (menu) or the `pointerup` (swipe), both user gestures. Please check it on a phone anyway |

#### The delete dialog (both platforms)

- The title is on the left: "Delete message?" or "Delete N messages?".
- There is **no body text** any more. The "Delete it for everyone in this chat…" and "<name>
  will still see it" lines are gone. On the web, `aria-describedby` went with the body.
- **No trash icon.**
- The choices are text buttons, **stacked and right-aligned**, each only as wide as its label:
  "Delete for everyone" (only when allowed) · "Delete for me" · "Cancel".
- Both deletes are red `#B91C1C` text, with an `--error-bg` background on hover or press.
  Cancel is purple text, with a light purple hover.
- Unchanged: which choices show, the `autoFocus` (the first delete), Esc and the scrim click
  to cancel, the animation, and one request per message.
- On the web, `.modalBtnSoft`, `.modalBtnCancel`, `.modalIcon`, `.modalText` and
  `.modalActionsStacked` are deleted. The delete dialog was the only thing on the page using
  them.

#### Why 5 and 7 failed on the app (no web equivalent)

- **5:** the app scrolled to the newest message the moment Send was pressed. The new bubble
  arrives a moment later, and the list's "keep my place when something is added"
  (`maintainVisibleContentPosition`) then held the reader where they were, cancelling the
  scroll. The scroll now waits until your new bubble is the newest row.
- **7:** on Android, an input that kept its focus after its keyboard was put away ignores
  `focus()`. The app now waits one frame (for the reply bar to appear and the menu to go),
  blurs the input if the keyboard is down, then focuses it.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None. No backend file changed.

### New fields on existing responses

None.

### Test data

- `npx tsc --noEmit` (mobile) and `vite build` (frontend) pass.
- **Not yet checked on a phone or in a browser.** The owner checks the app. The website
  checklist is in the message I'm sending you with the merge.

### What NOT to do yet

- Don't bring back the dialog's explanation text or the trash icon. The owner asked for them
  to go.
- Reactions still go in the 8 px gap between a message and its menu (`GAP` in
  `mobile/src/components/MessageActionMenu.tsx`), in the community phase.

---

<a id="2026-10-25-201829-vishwajeet-messages-whatsapp-tap-feedback-on-bubbles-menu-clo"></a>

## 18 · Messages: WhatsApp tap feedback on bubbles; menu closes on any touch or the keyboard; instant hold on the app

`2026-10-25-201829-vishwajeet-messages-whatsapp-tap-feedback-on-bubbles-menu-clo.md` · 2026-10-25 20:18 · vishwajeet · block V-E · for neeraj

This is the third V-E entry. Read it after
`2026-10-24-154532-vishwajeet-messages-whatsapp-style-long-press-menu-select-sev.md` and
`2026-10-24-235526-vishwajeet-message-actions-polish-faster-hold-darker-selectio.md`. Where
they disagree, this one wins.

The owner tested on a phone and reported four things. The guiding rule from the owner is now:
**build what established messaging apps already do (WhatsApp first), then add our own ideas on
top**, rather than inventing a behaviour from scratch.

**⚠️ `frontend/` was edited from my session again, at the owner's request.** Files:
`src/utils/messageActions.js` (three new constants), `src/styles/global.css` (two new
variables), `src/pages/messages/Messages.jsx` + `Messages.module.css`. Nothing else in
`frontend/` changed. The spec has a new **§10.12**, and §10.2, §10.10, §3 and §0.2 (three rows)
are updated.

### What changed, item by item

| # | Owner's report | App | Website |
|---|---|---|---|
| 1 | A tap on a message gives no feedback. WhatsApp lights the bubble | New §10.12: an overlay in the bubble's shape after 100 ms of rest, held while down, faded on release. A quicker tap flashes once | **Same, for touch only** (WhatsApp Web shows nothing for a mouse click). See below |
| 2 | The hold sometimes feels slow; the app feels like it hangs | The band now appears from the UI thread the moment the hold completes, with the long-press haptic. Entering selection no longer re-renders and re-registers every visible row's gestures (the main cost). See "Why the hold was slow" | **No change.** The web's timer has no second thread to wait on |
| 3 | A thin line between two selected rows, sometimes white, sometimes purple | Fixed: the block above the thread is snapped to a whole pixel (cause below) | **No change.** Browsers place each row on whole pixels themselves |
| 4 | Long-press, then tap the composer: the menu stayed | Fixed: any touch outside the menu closes it (header, thread, composer), and so does the keyboard opening or closing. The selection stays | **No change.** The web menu already closes on any `pointerdown` outside it |

#### The website change (#1), in detail

- `beginPressFeedback` / `movePressFeedback` / `releasePressFeedback` / `clearPressFeedback` sit
  next to `beginLongPress` in `Messages.jsx`. They are called from the **bubble's** existing
  pointer handlers, beside `beginSwipe` / `moveSwipe` / `endSwipe`. Only bubbles with actions get
  them (`hasActions`).
- The lit state is a **`data-pressed` attribute** on the bubble, not React state and not a
  class. State would re-render the thread twice per touch, and React rewrites `className` on
  every render, which would drop a class React didn't set.
- CSS: `.messageBubble::after` (`inset: 0; border-radius: inherit`, so it follows the tail) and
  `.messageBubble[data-pressed]::after`. Colours: `--chat-bubble-press-mine` (white 22%) and
  `--chat-bubble-press-theirs` (purple 7%, because white doesn't show on the white bubble). The
  fade is 60 ms in and 220 ms out; with `prefers-reduced-motion` there is no fade.
- Movement over `SWIPE_CANCEL_PX` (10) or a `pointercancel` (the browser taking the touch for a
  scroll) clears it. So a scroll or a swipe-to-reply never lights the bubble.

#### Why the hold was slow on the app (#2)

- **Expo Go runs the development build.** React's dev checks, no minification, and every
  `console.warn` shipped to Metro with a full stack. The same code is several times faster in a
  release build. SDK 58 itself is not the cause.
- **Our own cost:** each row's three gestures depended on `selecting`. The first long-press
  therefore re-rendered every mounted row (FlatList keeps far more than the screen) and
  re-registered about three worklet gestures per row, all on the JS thread, before the band could
  appear. The gestures now read a shared value on the UI thread, and the selection tap became a
  watch-only gesture (an activated `Tap` steals the touch from links and quotes, which is why it
  used to be switched on and off). The band shows from the UI thread at once.
- **The watch-only gestures are `Gesture.Pan().manualActivation(true)`, never `Gesture.Manual`.**
  The first version used `Gesture.Manual` and ended it by hand from its touch callbacks. That closed
  the app on Android (a scroll that started on a bubble, and taps in selection mode). The library
  fails a never-activated Pan by itself. This is app-only; the website has no gesture-handler.
- **Fixed console noise:** the Reanimated "Dependencies should only be used on the web" warning
  (`ListItemFab`), and the product page's back now checks `router.canGoBack()` (the "GO_BACK was
  not handled" dev warning).

#### Why the line appeared on the app (#3)

Yoga rounds a row's position relative to its parent, but its height from the absolute screen
edges (`yoga/algorithm/PixelGrid.cpp`). When the list's own top falls between two physical
pixels (the header's text heights make that the usual case), two neighbouring rows come out 1px
apart (the wallpaper shows: a white line) or 1px overlapping (the band doubles: a purple line).
`WholePixelHeight` in the chat screen gives everything above the thread a height that is a whole
number of pixels. This is app-only.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None. No backend file changed.

### New fields on existing responses

None.

### Test data

- `npx tsc --noEmit` and `npx expo export --platform android` (mobile) pass, and so does
  `vite build` (frontend).
- **Not yet checked on a phone or in a browser.** The owner checks the app. Your checklist is in
  the message that comes with the merge.
- New mobile dependency: `expo-haptics ~58.0.7`, which is part of Expo Go. The app is also on
  **Expo SDK 58** now (React Native 0.88), in the same branch.

### What NOT to do yet

- Don't make the website's press feedback show for a mouse. WhatsApp Web doesn't, and hover
  already does that job.
- Don't put the bubble's lit state in React state or `className`. See the reason above.
- Reactions still go in the 8 px gap between a message and its menu, in the community phase.

---

<a id="2026-10-26-121931-vishwajeet-app-composer-tap-ends-the-selection-no-offline-str"></a>

## 19 · App: composer tap ends the selection; no offline strip; gestures back on the UI thread; one back per press

`2026-10-26-121931-vishwajeet-app-composer-tap-ends-the-selection-no-offline-str.md` · 2026-10-26 12:19 · vishwajeet · block V-E · for neeraj

The fourth V-E entry. Read it after
`2026-10-25-201829-vishwajeet-messages-whatsapp-tap-feedback-on-bubbles-menu-clo.md`.

**Nothing in `frontend/` or `backend/` changed.** Only the app changed, plus
`docs/design/MESSAGES_SPEC.md` (§0.2 has two new rows, and §10.2 and §10.11 are updated).
**You don't need to change anything on the website.** Each item below says why.

### What changed

| # | Owner's report | App | Website |
|---|---|---|---|
| 1 | Logs full of `None of the callbacks in the gesture are worklets` | Fixed (cause below) | Not affected: the website has no gesture-handler |
| 2 | With a message selected, a tap on the composer closed the menu, but the message stayed selected | **A tap on the composer ends the selection**, one message or several, and opens the keyboard, as in WhatsApp. Other touches outside the menu still keep the selection | Not affected: while selecting, the website's composer is replaced by the selection bar, so it can't be tapped |
| 3 | `The action 'GO_BACK' was not handled by any navigator`, and the Samsung lagged on the way back | Fixed (cause below) | Not affected |
| 4 | The offline strip above the chat pushed the header and wallpaper down, and showed every time the app opened offline | **Removed** from the chat and the inbox. `ConnectionBanner.tsx` is deleted | Not affected: the website never had one |

#### Why 1 happened

The two watch-only gestures (the selection tap and the press feedback) were built by a helper,
`watchOnlyGesture()`. The worklets Babel plugin only turns a gesture's callbacks into worklets
when the chain visibly starts with `Gesture.Pan()` (etc.). Behind the helper, the callbacks
ran on the JS thread, and gesture-handler printed a warning **for every chat row it mounted**.
In Expo Go, each warning is sent to Metro with a full stack, which is a big part of the lag.
The chain is now written out at both call sites, and all 7 touch callbacks compile to worklets.

#### Why 3 happened

`router.back()` doesn't navigate when it is called. It queues the action, and expo-router runs
the queue after the next render. A second back in that window (a double tap, or the arrow plus
the system back, which is easy on a slow phone) passed the same `canGoBack()` check and queued a
second GO_BACK. That one either popped the screen underneath too, or found nothing left and
logged the error. The chat and product screens now send their way out once
(`mobile/src/hooks/useLeaveOnce.ts`).

#### Why 4 is a removal

The owner's call: the app works offline, and people will often open it offline on purpose. A
message waiting to send already shows its clock, as in WhatsApp. `isOffline` stays in
`RealtimeContext`, because the chat's automatic resend still waits for the network.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None. No backend file changed.

### New fields on existing responses

None.

### Test data

- `npx tsc --noEmit` and `npx expo export --platform android` pass.
- The chat screen was compiled with the app's Babel preset before and after the change. Before,
  none of the `onTouches*` callbacks were worklets. After, all 7 are.
- **Not yet checked on a phone.** The owner checks the app.

### What NOT to do yet

- Don't put a gesture chain behind a helper function again. Write `Gesture.X()` at the call
  site (`mobile/CLAUDE.md`).
- Don't add an offline banner back on either platform unless the owner asks.

---

<a id="2026-10-26-135948-vishwajeet-app-mark-as-sold-everywhere-picker-sold-cards-purc"></a>

## 20 · App: Mark as Sold everywhere (picker, sold cards, purchases, product page, public profile)

`2026-10-26-135948-vishwajeet-app-mark-as-sold-everywhere-picker-sold-cards-purc.md` · 2026-10-26 13:59 · vishwajeet · block V-F · for neeraj

Block V-F is built on the app (CC-V6a and CC-V6b), against your N-E endpoints and
`MARK_SOLD_SPEC.md`. **Nothing in `backend/`, `frontend/` or `supabase/` changed.** This entry
is for N-H: where the spec leaves a choice open, here is what the app does, so the website can
match it.

### What the app does, by spec section

- **§1 picker** (`mobile/src/components/BuyerPickerSheet.tsx`):
  - **Fixed below the list:** the divider, "Someone not on Yahora" and the button. Only the
    people list scrolls, so the button is always reachable, even with the keyboard up.
  - **The "Messaged you about this" list:** it loads with no label, because there may be no one
    to label. It shows from cache at once and refreshes on every open.
  - **A search that is still waiting out its 300 ms:** it shows the skeleton rows, never the
    previous query's results.
  - **A failed load:** the toast, and the list stays empty. "Someone not on Yahora" can still be
    chosen.
  - **Saving:** the sheet waits for the server, then closes. The card under it has already
    changed. A refusal keeps the sheet open, with the spec's toast for that error code.
- **§2 product page:**
  - **Anyone but the seller:** with Message seller, like and save gone, the bottom action bar
    is not drawn at all. `canInteract` is false on the questions, so the ask box, replies and
    votes go too. Questions stay readable. Same as a foreign-campus listing.
  - **The seller:** keeps their bar ("Your listing" + like/save), the banner, and the buyer
    line. If `buyer` is absent (an old cached copy), the buyer line is left out. That is never
    read as "no buyer".
- **§3 seller's cards** (`ProductCard` props `soldLine`, `onChangeBuyer`):
  - **Under the price:** the sale line (up to 2 lines on a grid card), then Change buyer and
    Relist.
  - **The toolbar:** the sold card's round "mark available" icon is gone, because Relist is now
    a text button. Delete stays.
  - **Names:** `full_name`, else `username`, else "a Yahora student".
- **§4 purchases:** the "From <seller> · <date>" line takes the place of the old clock date.
  The date is the product's `sold_at`, or the purchase's `created_at` when that is missing. A
  repeated "That wasn't me" that gets `PURCHASE_NOT_FOUND` counts as done, and the card stays
  gone.
- **§5 public profile:**
  - **Header:** `Sold · N`, in the listings header's title style, with no count chip.
  - **Cards:** have no heart and no like count (new `ProductCard` prop `hideLikes`).
    `sold_listings` carries no `likes_count`, and a sold listing takes no likes.
  - **Footer time:** the card's footer time is the sale date (`sold_at`), because the rows have
    no `created_at`.
- **§6 marketplace:** marking sold removes the listing from every cached marketplace page at
  once. Relisting marks the feed stale, so the listing returns on the next refresh.
- **Dates:** `formatShortDate()` in `mobile/src/lib/messages.ts`: `3 Oct`, or `3 Oct 2025` in
  an earlier year.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None. The app now sends `{ buyer_id }` to `/sold` and calls `buyer-candidates` and
`DELETE /purchase`, exactly as N-E documents them.

### New fields on existing responses

None.

### Test data

- `npx tsc --noEmit` and `npx expo export --platform android` pass.
- **The shapes were checked against the local API on 26 Oct**, as `priya.nair` and
  `rahul.verma` on the Wacom (`e0000000-0000-4000-8000-000000000004`):
  - **Buyer candidates:**
    - with no `q`: Arjun, `messaged: true`;
    - `q=rah`: Rahul;
    - `q=sne`: `[]`.
  - **After Priya marked the Wacom sold to Rahul:**
    - Rahul's purchase has `product.seller`, `status` and `sold_at`;
    - Priya's listing has `sold_at` and `buyer`;
    - her public profile, seen as Rahul, has `sold_count: 1` and no `buyer` anywhere in the JSON.
  - **Afterwards:** I relisted it. It is `available` again, with no buyer, and Rahul has 0
    purchases. I didn't call `GET /api/products/:id`, so no views were added.
- **Not yet checked on a phone.** The owner checks the app.

### What NOT to do yet

- Don't show the buyer anywhere but the seller's own card and product page.

---

<a id="2026-10-26-170457-neeraj-t2-m2-message-actions-on-web-and-app"></a>

## 21 · T2 + M2: message actions on web and app

`2026-10-26-170457-neeraj-t2-m2-message-actions-on-web-and-app.md` · 2026-10-26 17:04 · neeraj · block T2 · for vishwajeet

### Migrations applied

### New endpoints

### Changed endpoints (BREAKING)

### New fields on existing responses

### Test data

T2 run by Neeraj on 26 Oct 2026, locally, on the website (desktop Chrome + Android phone browser over Wi-Fi) and the Android app via Expo Go, after V-E (#80, #81) and N-F (#76, #77) were merged.

All rows of the T2 table pass ✅ (actions menu / long-press, deleted-message actions, Copy + toast, Reply + quote, long-message quote, jump to original incl. older pages, delete for everyone + tombstone on both sides, "Original message was deleted" quote, delete for me, inbox previews, keyboard on web, phone-browser Copy fallback, regression: send/receive live, unread band, jump-to-latest, ticks, older messages, welcome sticker).

Also on the website (N-F add-on #77): swipe-to-reply on touch devices, keyboard no longer covers the composer.

M2: message actions are live on the website since N-F was merged.

No ❌.

### What NOT to do yet

---

<a id="2026-10-26-191934-neeraj-mark-as-sold-on-the-website-n-h-spec-changes-for-t"></a>

## 22 · Mark as Sold on the website (N-H) + spec changes for the app

`2026-10-26-191934-neeraj-mark-as-sold-on-the-website-n-h-spec-changes-for-t.md` · 2026-10-26 19:19 · neeraj · block N-H · for vishwajeet

The website now does Mark as Sold the way `docs/design/MARK_SOLD_SPEC.md` describes, using the
N-E endpoints. **While building it, the spec changed in three places (and one icon change is not
in the spec yet). The app has to match these — see "Spec changes the app must now match" below.**

Everything is in `frontend/` plus `docs/design/MARK_SOLD_SPEC.md`. Nothing in `backend/`,
`mobile/` or `supabase/` changed.

What's on the website:
- **"Who bought it?" picker** — new `frontend/src/components/BuyerPicker/` (spec §1): people
  who messaged about the listing, campus search from 2 characters (300 ms), "Someone not on
  Yahora", faded button until a row is picked, `Save` in Change-buyer mode, spinner, the §1
  error toasts. Replaces the Dashboard's old sold modal and its inbox-walking buyer lookup.
- **Dashboard → My Items** (§3): sold cards show `Sold to <name> · <date>` /
  `Sold · buyer not on Yahora · <date>`, then the Change buyer and Relist pills; Relist asks
  first ("Relist this item?"). The old `SOLD TO @…` label is gone.
- **Dashboard → Bought Items** (§4): `From <seller> · <date>` and the "That wasn't me" pill,
  with the "Remove this purchase?" dialog → `DELETE /api/products/:id/purchase`. These cards
  were unstyled before this branch (their CSS classes never existed); they now use the same
  card styles as My Items.
- **Product page** (§2): SOLD stamp on the photo, the sold banner (the seller's version shows
  the buyer), and the listing is closed for everyone (see (c) below).
- **Public profile** (§5): `Sold · <count>` with up to 12 sold cards, no like or save, left
  out when the count is 0. No buyer anywhere.
- **Link preview** (`frontend/netlify/edge-functions/product-preview.js`):
  `product:availability` is `out of stock` for a sold listing (it said `oldout`), `in stock`
  otherwise.
- Small shared pieces: `formatShortDate()` in `frontend/src/utils/messageFormat.js` (`3 Oct`,
  `3 Oct 2025` in an earlier year), and the initials avatar moved out of `Messages.jsx` into
  `frontend/src/components/AvatarImg/` so the picker draws people the same way.

### Migrations applied

None.

### New endpoints

None. The website uses the N-E endpoints as they are: `GET /api/products/:id/buyer-candidates`,
`POST /api/products/:id/sold`, `POST /api/products/:id/available`,
`DELETE /api/products/:id/purchase`.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None. The website reads the fields N-E added: `listings[].buyer` / `sold_at` and
`purchases[].product.seller` / `sold_at` on the dashboard, `product.buyer` (seller only) and
`sold_at` on the detail, and `sold_listings` / `sold_count` on `/public`.

### Spec changes the app must now match

All in `docs/design/MARK_SOLD_SPEC.md`. The spec header still says v1.

**(a) "That wasn't me" is a small pill with a UserX icon** — §4, which now reads:

> - 8 below it, a quiet **pill button** **`That wasn't me`**: `user-x` 14 (Feather on mobile,
>   lucide on web), gap 6, label Inter 600 12 · mutedText for both, no underline · border 1px
>   `rgba(128,0,128,0.15)` · radius 999 · padding 4 vertical, 10 horizontal · transparent
>   background · left-aligned · at least **28** tall, so it is easy to tap · pressed (mobile),
>   hover and pressed (web): background pinkLight `#FFF4F7`, label and icon purple `#800080`,
>   150 ms · web keyboard focus: 2px purple outline, offset 2. The same on every screen size.

(It was: "a text button, Inter 600 12 mutedText, underlined".)

**(b) "Change buyer" / "Relist" are purple pills with Users / RotateCcw icons** — §3, which now
reads:

> - 8 below it, two **pill buttons**, gap 8, left-aligned, wrapping onto a second line on a
>   card too narrow for both: **`Change buyer`** (`users` 14; opens §1 with the current choice
>   selected) and **`Relist`** (`rotate-ccw` 14; the existing Mark-available action, now with the
>   dialog below). Each: icon (Feather on mobile, lucide on web), gap 6, label Inter 600 12 ·
>   purple `#800080` for both · background `rgba(128,0,128,0.06)` · border 1px
>   `rgba(128,0,128,0.12)` · radius 999 · padding 4 vertical, 10 horizontal · at least **28**
>   tall · pressed (mobile), hover and pressed (web): background `rgba(128,0,128,0.12)`, 150 ms ·
>   web keyboard focus: 2px purple outline, offset 2. The same shape and size as §4's `That
>   wasn't me` pill, in a stronger purple because these are the seller's normal actions. The
>   same on every screen size.

(It was: "two text buttons, Inter 600 12 purple, gap 14".)

**(c) A sold listing is closed for EVERYONE, the seller included** — §2. Before, only
non-sellers lost like, save and the question box. Now the non-seller row hides only
**Message seller**, the seller row adds "The seller keeps their `Your listing` marker in place
of Message seller.", and under the table:

> **A sold listing is closed for everyone — the seller too, and logged-out or demo viewers.**
>
> - **No like:** the like count stays, as a plain stat like the views count; nothing happens on a tap.
> - **No save:** the Save button is gone.
> - **No new questions:** the "ask a question" composer is gone. Existing questions and answers stay
>   visible and readable. With none, the "be the first to ask" line is replaced by `Questions are
>   closed — this item has been sold.` (mutedText, centred).
> - **Kept:** the stamp, the banner, Share and the seller card.

On the website, replies and helpful votes on existing questions are still there on a sold
listing; only the new-question box is gone. Say if the app should hide those too, and the
website will follow.

**(d) Save uses a bookmark icon, not a heart** — ⚠ **not in any spec yet**, so there is nothing
to quote. On the website, the product page's `Save Item` / `Saved` button now uses lucide
`Bookmark` (outline, filled when saved) instead of `Heart`, and so does the Marketplace "My
Wishlist" filter heading. Heart now always means Like. The website's cards already used a
bookmark for save. Please use a bookmark wherever the app has a save control, and we should add
a line to the spec for it.

### Test data

Checkpoint N-H passed locally on 26 Oct 2026 as Priya (seller of the Wacom) and Arjun (buyer):
- the picker: people who messaged, search, a student on another campus not found,
  "Someone not on Yahora", the faded button until a pick, `Save` when changing the buyer;
- the sold card lines; Change buyer; the Relist dialog;
- "That wasn't me";
- the product page as the seller and as a non-seller;
- the public profile's Sold section;
- Relist.

### What NOT to do yet

- The buyer is private — only the seller and the buyer ever see it (MARK_SOLD_SPEC §0).

---

<a id="2026-10-27-120413-vishwajeet-mark-as-sold-polish-smooth-picker-tap-to-deselect"></a>

## 23 · Mark as Sold polish: smooth picker, tap to deselect, wider name search, new sold card, Relist and Delete dialogs, dashboard likes fixed, grid overlap fix

`2026-10-27-120413-vishwajeet-mark-as-sold-polish-smooth-picker-tap-to-deselect.md` · 2026-10-27 12:04 · vishwajeet · block V-F · for neeraj

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

### ⚠ I edited yours: `backend/src/modules/user/user.controller.js` (`getDashboardData` only)

Its banner says Vishwajeet doesn't edit it. The owner chose to anyway, so the like button on
your own dashboard cards can work. I added one block after the buyer flattening: two queries on
`product_likes` / `product_saves` for the caller and the listing ids, then `is_liked` /
`is_saved` on every listing. It is a copy of what `getPublicProfile` in the same file already
does. Nothing else in the handler changed. `API.md` is updated.

### ⚠ I edited yours: `frontend/src/components/ProductCard/` (merged with your N-H)

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
- **Deselect (§1 v1.1): done by me in your `BuyerPicker.jsx`** (owner's request). A click on the
  selected row clears it, and the button fades again. The three `onSelect={setSelected}` became
  `onSelect={toggle}`, and the off-platform row uses `toggleOffPlatform`. Nothing else in the
  file changed.

### ⚠ I edited yours: the purple avatar ring, everywhere (owner's request)

Every avatar now has the thin purple ring, photos and initials alike: `1.5px`, or `2px` from 40px
up, `var(--purple-emphasis)`, the inbox's and the card's ring. Website files:
- **`components/AvatarImg/AvatarImg.jsx`:** the ring is inline on both the photo and the
  initials circle, so every caller gets it (the picker, Messages, the sold card). There's a new
  named export, `avatarRing(size)`. The old `rgba(255,255,255,0.12)` border on the initials
  circle is gone.
- **`pages/product/ProductDetail.jsx`:** its local `AvatarImg` and `HiddenAvatar` use
  `avatarRing`.
- **`ProductDetail.module.css`:** `.currentUserAvatar(Sm)` gains the ring, and `.sellerAvatar`'s
  `#f0eaff` border became the ring.
- **`Home.module.css`:** `.buzzAvatar`.
- **`ProductCard.module.css`:** `.sellerAvatarFallback`.

The profile headers (Dashboard, public profile) already had their gradient ring, and the
onboarding upload preview keeps its dashed box. Both are unchanged.

The app matches: `Avatar` rings by default (photo, initials and hidden), and so does the card's
initials fallback.

### Your N-H spec changes, now on the app

- **(a) "That wasn't me" pill:** done, to §4 as you wrote it (`user-x` 14, 28 tall, pinkLight +
  purple when pressed).
- **(c) A sold listing is closed for everyone, the seller too:** done. On a sold listing the app
  shows no heart or bookmark in the action bar (the seller keeps only `Your listing`), and no
  "ask a question" box. With no questions, it says `Questions are closed — this item has been
  sold.` The app matches your web choice: the **seller** can still reply to and vote on
  existing questions. Non-sellers couldn't before and still can't, as in the app's V-F.
- **(d) Save is a bookmark:** the app's product page already used one. The "My Wishlist" filter
  switch was a heart; it's a bookmark now. I added the rule to the spec (§6).
- **Search (#2):** the database fix covers the website.
- **Grid overlap (#7):** the web grid is CSS, not FlashList.

### What changed

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

### Migrations applied

- **`supabase/migrations/20261027062548_search_users_word_match.sql`.** It is
  `create or replace` on `search_users()`. The signature, the returned columns, the demo
  isolation and the fail-closed viewer lookup are all unchanged.
- **Applied to the local database only.** I ran it with psql inside the local container, not
  `db reset`, so local test data survived. It isn't in the local migration ledger yet. **Not on
  production.** Vishwajeet pushes it.

### New endpoints

None.

### Changed endpoints (BREAKING)

#### `GET /api/users/search` (yours) and `GET /api/products/:id/buyer-candidates?q=`: wider matching

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

### New fields on existing responses

#### `GET /api/user/:userId/dashboard`: `listings[].is_liked`, `listings[].is_saved`

Booleans, on every listing: whether the caller has liked / saved their own listing. Computed the
way `/public` does it. Nothing was removed or renamed.

### Test data

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

### What NOT to do yet

- **Don't upgrade `@shopify/flash-list`** without checking the patch. 2.3.3 still has the bug.
  The upgrade steps are in `mobile/CLAUDE.md` (gotchas).
- **Don't drop `is_liked` / `is_saved` from the dashboard listings.** Both apps' like toggles
  on your own cards depend on them.
- Relist and Delete moved off the phone's `Alert`. "That wasn't me" is still an Alert on the
  app. It can use `ConfirmDialog` later, but the owner hasn't asked.

---

<a id="2026-10-27-230656-vishwajeet-mark-as-sold-round-3-in-app-confirm-dialogs-on-the"></a>

## 24 · Mark as Sold round 3: in-app confirm dialogs on the web, Off Yahora, sold photo overlay, level cards, live product page, long-quote jump

`2026-10-27-230656-vishwajeet-mark-as-sold-round-3-in-app-confirm-dialogs-on-the.md` · 2026-10-27 23:06 · vishwajeet · block V-F · for neeraj

The owner tried round 2
(`2026-10-27-120413-vishwajeet-mark-as-sold-polish-smooth-picker-tap-to-deselect.md`) and
reported eight things. Most were seen on the app. The owner's rule: fix the website only where
it has the same problem, and match the two wherever possible. Specs: `MARK_SOLD_SPEC.md` is now
**v1.3** (§2, §3, §4, §5), and `MESSAGES_SPEC.md` §10.6 has one new sentence.

### ⚠ I edited yours (owner's request): `frontend/`

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

### What changed

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

#### Why 4 happened (app)

`scrollToIndex({ viewPosition })` places a row at `viewPosition × (thread height − row
height)`. For a row taller than the thread, that number is negative, so the 35% placement put
the middle of a long message on screen. Each message row now reports its height (`onLayout`,
into a ref, so nothing re-renders). A quoted row taller than the thread minus 32 lands with its
**top 16 dp below the top of the thread**. A row that wasn't rendered yet is reached by
estimate, then placed again once it measures (within 1.5 s). The unread line is unchanged.

#### Why 8 happened (app)

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

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None. No backend file changed.

### New fields on existing responses

None.

### Test data

- `npx tsc --noEmit` and `npx expo export --platform android` (app) pass. `npm run build`
  (website) passes.
- **Nothing has been checked on a phone or in a browser yet.** The owner checks the app; your
  browser checklist is in the message that comes with this branch.

### What NOT to do yet

- **Don't move the chat's "Delete message?" dialog onto `ConfirmDialog`.** It follows
  MESSAGES_SPEC §10.8 (WhatsApp's layout: stacked text buttons, no photo) on purpose.
- **Don't drop the product page's refresh back to the 5-minute default on the app.** That
  default is the whole cause of #8.
- **The web's remaining `alert()`s are login prompts and an avatar-upload error**, not
  confirmations, so they are untouched ("Please log in to like items!" on the card and the
  product page, and "Failed to update profile photo."). The app's remaining `Alert`s are error
  messages too (a question or reply that failed to post, the demo video). Both can become
  toasts later; the owner hasn't asked.

---

<a id="2026-10-29-093235-neeraj-m3-live-mark-as-sold-on-web-t3-t4-t5-passed"></a>

## 25 · M3 live: Mark as Sold on web; T3, T4, T5 passed

`2026-10-29-093235-neeraj-m3-live-mark-as-sold-on-web-t3-t4-t5-passed.md` · 2026-10-29 09:32 · neeraj · block T5 · for vishwajeet

### Migrations applied

### New endpoints

### Changed endpoints (BREAKING)

### New fields on existing responses

### Test data

Run by Neeraj, 27–29 Oct 2026, on the website (desktop + phone browser) and the Android app via
Expo Go, after N-H (#83) and V-F (#85, #86) were merged.

**T3: Mark as Sold everywhere.** All 15 rows ✅:
- the picker;
- search;
- a student on another campus hidden;
- the faded button;
- mark sold;
- change buyer keeps the sold date;
- purchases;
- "That wasn't me";
- the product page for a non-seller and for the seller;
- the profile's `Sold · 1` with no buyer;
- the sold listing out of the feed;
- relist puts it back in the feed;
- sold to someone not on Yahora.

**T4: everything, plus the basics.** ✅:
- log in with OTP, with username + password, and with the demo button;
- marketplace: scroll, the campus switcher, filters;
- sell, edit and delete a listing with photos;
- like, save and ask a question: works on your own campus, refused on another campus;
- messages: send and receive live, the unread band, the wallpaper, the welcome sticker.

**T5: production** (yahora.netlify.app). ✅:
- mark sold to a test account → it shows in their purchases → "That wasn't me" → relist;
- reply, copy, and delete for everyone;
- a logged-out visitor's product page shows "A student at …".

No ❌.

### What NOT to do yet

- The buyer is private: only the seller and the buyer ever see it (MARK_SOLD_SPEC §0).

---

<a id="2026-10-29-093235-neeraj-website-privacy-states-n-d-and-message-actions-n-f"></a>

## 26 · Website: privacy states (N-D) and message actions (N-F, swipe add-on)

`2026-10-29-093235-neeraj-website-privacy-states-n-d-and-message-actions-n-f.md` · 2026-10-29 09:32 · neeraj · block N-D, N-F · for vishwajeet

### Migrations applied

### New endpoints

### Changed endpoints (BREAKING)

### New fields on existing responses

### Test data

These three website blocks shipped without an entry of their own; this one records them. All
of it is `frontend/` only. They were tested in T1 and T2; see those entries:
`2026-10-17-150430-neeraj-m1-live-identity-rule-views.md` (T1) and
`2026-10-26-170457-neeraj-t2-m2-message-actions-on-web-and-app.md` (T2).

**N-D: privacy states** (PR #71, commit `d83556d`)
- **Hidden seller:** when the API hides the seller (logged-out or demo viewer), the product
  page shows "A student at <campus>" with a person icon, no name and no profile link. A demo
  viewer sees "Verified students can see who's selling."; a logged-out one sees "Log in with
  your college email to see who's selling." and a Log in button. The card shows
  "Yahora student" with a person icon.
- **Hidden commenters:** questions and answers from a hidden student show as "Yahora student"
  with a person-icon avatar.
- **Public profile:** two states instead of the profile: a log-in prompt on `401
  LOGIN_REQUIRED`, and an unavailable state on `404 USER_NOT_FOUND`.
- **Messages:** requests carry the session token, so the API shows the seller and a new chat
  is not titled "User".
- **Link preview** (`frontend/netlify/edge-functions/product-preview.js`): the description no
  longer says "Listed by <seller>".
- **Views:** the client-side view counter was dropped; views are counted by the API (M1).

**N-F: message actions** (PR #76, commits `f632235`, `e078274`, `60ac958`)
- **The menu:** Reply / Copy / Delete, from the ⌄ button beside a bubble, right-click, or a tap
  (touch) on the bubble (MESSAGES_SPEC §10).
- **Copy:** copies the text, with the `Copied` toast (fallback for http on a phone).
- **Delete:** for everyone (within the hour) or for me, with a confirmation. A message deleted
  for everyone becomes a tombstone on both sides.
- **Inbox previews:** `You: ` on your own last message; deleted and hidden messages change the
  preview (§10.9).
- **Reply:** the reply bar in the composer, the quote inside the reply, and tapping the quote
  jumps to the original (loading older pages if needed).
- **`frontend/CLAUDE.md` §18:** the website shows the same words and the same features on every
  screen size. Only the layout adapts. Touch-versus-mouse behaviour is allowed when the platform
  forces it.
- **Auth pages:** the same copy on every device.

**N-F add-on** (PR #77, commit `1e7d909`)
- **Swipe to reply** on touch screens, with the same constants as the app (§10.3). A mouse
  still uses the menu.
- **No text selection** when long-pressing in the chat on a touch screen; only the composer and
  the inbox search keep it.
- **The keyboard no longer covers the composer** on a phone (`interactive-widget=resizes-content`
  in `frontend/index.html`, plus a visual-viewport fallback for iOS). The thread stays pinned to
  the newest message when the keyboard or the reply bar opens.

### What NOT to do yet

- The swipe-to-reply constants (`SWIPE_REPLY_TRIGGER` 56, `SWIPE_REPLY_MAX` 72) live in both
  `frontend/src/utils/messageActions.js` and `mobile/src/lib/messageActions.ts`. Change both in
  the same commit (MESSAGES_SPEC §10.10).

---

<a id="2026-10-29-094514-neeraj-phase-6b-complete-products-share-modules-back-to-v"></a>

## 27 · Phase 6B complete; products + share modules back to Vishwajeet

`2026-10-29-094514-neeraj-phase-6b-complete-products-share-modules-back-to-v.md` · 2026-10-29 09:45 · neeraj · block SIGN-OFF

### Migrations applied

### New endpoints

### Changed endpoints (BREAKING)

### New fields on existing responses

### Test data
Signed off by Neeraj and Vishwajeet on 29 Oct 2026: every box in the runbook's sign-off checklist ticked (T1–T5, views, message actions, Mark as Sold, docs). The loan of the products and share modules ends; they are Vishwajeet's again.

### What NOT to do yet
