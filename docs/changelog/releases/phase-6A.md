# Phase 6A — changelog

Released 2026-10-15 with `node scripts/changelog.mjs release 6A`. 18 entries, oldest first.

Until this release each entry below was its own file in `docs/changelog/`. Every entry keeps
its original file name here, so an old reference such as `2026-10-04-184315` still finds it:
search this file for it. The original files are also in git history.

| # | Date | Author | Block | For | Title |
|---|---|---|---|---|---|
| 1 | 2026-10-01 18:44 | neeraj | N-A | vishwajeet | [Changelog: one file per entry](#2026-10-01-184400-neeraj-changelog-one-file-per-entry) |
| 2 | 2026-10-03 11:43 | neeraj | N-B | vishwajeet | [Add messages design package](#2026-10-03-114316-neeraj-add-messages-design-package) |
| 3 | 2026-10-03 16:14 | neeraj | N-B | vishwajeet | [Add messages design package](#2026-10-03-161401-neeraj-add-messages-design-package) |
| 4 | 2026-10-03 16:21 | vishwajeet | V-A | neeraj | [Search: demo accounts isolated both ways](#2026-10-03-162152-vishwajeet-search-demo-accounts-isolated-both-ways) |
| 5 | 2026-10-04 12:29 | vishwajeet | V-B | neeraj | [Mobile chat wallpaper](#2026-10-04-122955-vishwajeet-mobile-chat-wallpaper) |
| 6 | 2026-10-04 14:26 | vishwajeet | V-B | neeraj | [Mobile chat: wallpaper fixes; card photo swipe everywhere](#2026-10-04-142615-vishwajeet-mobile-chat-wallpaper-fixes-card-photo-swipe-every) |
| 7 | 2026-10-04 17:05 | neeraj | N-C | vishwajeet | [Seed-image catalogue + checker](#2026-10-04-170506-neeraj-seed-image-catalogue-checker) |
| 8 | 2026-10-04 17:20 | vishwajeet | V-C | neeraj | [Mobile messages redesign](#2026-10-04-172010-vishwajeet-mobile-messages-redesign) |
| 9 | 2026-10-04 18:43 | vishwajeet | V-C | neeraj | [Chat: emoji sizing, jump-to-latest, welcome sticker](#2026-10-04-184315-vishwajeet-chat-emoji-sizing-jump-to-latest-welcome-sticker) |
| 10 | 2026-10-04 19:20 | vishwajeet | V-C | neeraj | [Web: three chat changes to match mobile (final values)](#2026-10-04-192039-vishwajeet-web-three-chat-changes-to-match-mobile-final-value) |
| 11 | 2026-10-07 02:20 | vishwajeet | V-C | neeraj | [Welcome stickers: four, chosen per conversation (web + mobile)](#2026-10-07-022059-vishwajeet-welcome-stickers-four-chosen-per-conversation-web) |
| 12 | 2026-10-07 11:02 | vishwajeet | V-E | neeraj | [Mobile unread line and read-on-sight](#2026-10-07-110239-vishwajeet-mobile-unread-line-and-read-on-sight) |
| 13 | 2026-10-07 11:09 | neeraj | N-C | vishwajeet | [Seed-image catalogue: 23 titles for V-D](#2026-10-07-110935-neeraj-seed-image-catalogue-23-titles-for-v-d) |
| 14 | 2026-10-07 11:54 | vishwajeet | V-C | neeraj | [Read tick colour: WhatsApp blue (final)](#2026-10-07-115427-vishwajeet-read-tick-colour-sunflower-gold) |
| 15 | 2026-10-09 16:24 | vishwajeet | V-D | neeraj | [Real seed images, 13 products replaced, live demo repair SQL](#2026-10-09-162450-vishwajeet-real-seed-images-13-products-replaced-live-demo-re) |
| 16 | 2026-10-11 11:24 | neeraj | N-D | vishwajeet | [Web chat wallpaper](#2026-10-11-112428-neeraj-web-chat-wallpaper) |
| 17 | 2026-10-11 11:45 | neeraj | N-E | vishwajeet | [Web messages redesign](#2026-10-11-114517-neeraj-web-messages-redesign) |
| 18 | 2026-10-11 12:14 | vishwajeet | WRAP-UP | neeraj | [MESSAGES_SPEC v2: matches what mobile ships](#2026-10-11-121400-vishwajeet-messages-spec-v2-matches-what-mobile-ships) |

---

<a id="2026-10-01-184400-neeraj-changelog-one-file-per-entry"></a>

## 1 · Changelog: one file per entry

`2026-10-01-184400-neeraj-changelog-one-file-per-entry.md` · 2026-10-01 18:44 · neeraj · block N-A · for vishwajeet

`docs/CHANGELOG.md` is frozen. From now on every changelog entry is its own file in
`docs/changelog/`, created by `scripts/changelog.mjs`. Adding an entry only ever creates a new
file, so our two branches can no longer conflict on the changelog. The full explanation is in
`docs/changelog/README.md`.

**What you do differently, starting now:**

- **Session start:** run `node scripts/changelog.mjs recent 8` and open the entries it lists,
  instead of reading `docs/CHANGELOG.md`. The new opener is in build plan §2.4 and in the 6A
  runbook ("From the moment N-A is merged").
- **Filing an entry:**
  `node scripts/changelog.mjs new vishwajeet "<title>" --phase 6A --block V-A --for neeraj`
  — it prints the path; open the file and fill in the six sections.
- **Notes addressed to you:** `node scripts/changelog.mjs for vishwajeet`.
- **Migration requests** are now entries too: I file `new neeraj "Migration request: …"
  --for vishwajeet`, and you answer with your own entry naming the migration file. The
  `## MIGRATION REQUESTS` section of the old file had nothing open, so nothing needs moving.
- **The rule:** anyone adds files; nobody edits another person's entry, except to fix a
  broken link. To correct something, add a new entry.

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

- **Do not append to `docs/CHANGELOG.md`** — not even a one-liner. It has a FROZEN banner
  at the top. It stays in place (28 files link into it); read it only to follow a link.
- **Do not add an index, "latest" or per-person file** to `docs/changelog/`. The moment two
  entries share a file, the conflicts come back.
- **Do not create entry files by hand** — the script gets the name, date and template
  right every time.

**⚠️ I edited files in your scope**, all instruction text only, as the 6A runbook (§2.2,
N-A file list) sets out — no code:

- `backend/CLAUDE.md` — the ownership table row, the "BREAKING" rule, the migration request
  protocol (steps 1–2), and the "post a handoff entry" line now point at the new tool.
- `backend/API.md` line ~2078 — one TODO note that said a rename "needs a BREAKING entry in
  docs/CHANGELOG.md" now points at `docs/changelog/`.
- `docs/YAHORA_BUILD_PLAN.md` — §1.5 repo layout, §2.4 (shared memory list and the session
  opener) and §2.5 (the handoff format).

Historical citations ("see docs/CHANGELOG.md 2026-08-12", in `backend/scripts/`,
`backend/API.md`, `docs/CURRENT_STATE.md` and so on) are untouched — they correctly point at
frozen history. The Phase 0–5 runbooks still say "append to docs/CHANGELOG.md" inside their
old prompts; those phases are finished, so I left them as a record.

---

<a id="2026-10-03-114316-neeraj-add-messages-design-package"></a>

## 2 · Add messages design package

`2026-10-03-114316-neeraj-add-messages-design-package.md` · 2026-10-03 11:43 · neeraj · block N-B · for vishwajeet

### Migrations applied

### New endpoints

### Changed endpoints (BREAKING)

### New fields on existing responses

### Test data

### What NOT to do yet

---

<a id="2026-10-03-161401-neeraj-add-messages-design-package"></a>

## 3 · Add messages design package

`2026-10-03-161401-neeraj-add-messages-design-package.md` · 2026-10-03 16:14 · neeraj · block N-B · for vishwajeet

### Migrations applied

### New endpoints

### Changed endpoints (BREAKING)

### New fields on existing responses

### Test data

### What NOT to do yet

---

<a id="2026-10-03-162152-vishwajeet-search-demo-accounts-isolated-both-ways"></a>

## 4 · Search: demo accounts isolated both ways

`2026-10-03-162152-vishwajeet-search-demo-accounts-isolated-both-ways.md` · 2026-10-03 16:21 · vishwajeet · block V-A · for neeraj

### Migrations applied

- `20261001122844_search_demo_isolation.sql` (018). **Applied to production on 2026-10-03.**
  - `public.universities` gains `is_demo boolean`, a STORED generated column:
    `coalesce(domain = 'demo.yahora.com', false)`. Nothing can write it. Every existing
    insert lists its columns, so `seed.sql` and `seedDemo.js` are unaffected.
  - `public.search_users()` was replaced with the same signature, return columns, ordering,
    `security invoker` and `search_path`. One lookup now fetches the viewer's campus and
    `is_demo` together. If the lookup finds nothing, the function returns no rows. A new filter
    `and un.is_demo = viewer_is_demo` keeps results in the viewer's world.

### New endpoints

None.

### Changed endpoints (BREAKING)

None in shape. `GET /api/users/search` returns the same `{ items, next_cursor: null }`.
Behaviour change only:

- A real student sees only real students, still on every campus.
- A demo account sees only demo accounts.
- A viewer with no `users` row, or with `university_id` null, gets an empty list (200).
- `backend/API.md` updated under `GET /api/users/search`.

### New fields on existing responses

None. `is_demo` is a database column. No endpoint selects it: `GET /api/universities` lists
`id, name, domain` explicitly.

### Test data

After `supabase db reset` plus `node backend/scripts/seedDemo.js`:

- Arjun Mehta (real, Kurnool) searching "rahul" gets rahul.verma, not rahul.sharma (demo).
- Rahul Sharma (demo) searching "arjun" gets arjun.singh, not arjun.mehta (real).
- An unknown or null viewer gets 0 rows.
- A real student on another campus still shows up: Arjun searching "sneha" finds
  sneha.gupta at NIET.

### What NOT to do yet

- Your controller in `backend/src/modules/user/` is unchanged and needs no change. Keep
  `p_viewer: req.user.id`. Never take the viewer from the query string, because that now
  decides which world a caller searches.
- If the web search UI shows "no results" for a logged-in user, check that the account has a
  `university_id` before suspecting the UI.
- Demo-login rate limiting and captcha are a later phase. Don't build against them yet.

---

<a id="2026-10-04-122955-vishwajeet-mobile-chat-wallpaper"></a>

## 5 · Mobile chat wallpaper

`2026-10-04-122955-vishwajeet-mobile-chat-wallpaper.md` · 2026-10-04 12:29 · vishwajeet · block V-B · for neeraj

The open conversation on mobile (`mobile/app/chat/[contactId].tsx`) now draws the doodle
wallpaper from `docs/design/MESSAGES_SPEC.md` §2. This is a presentation change only. No
message logic, pagination, realtime or scrolling behaviour changed.

- **Before:** the root `View` painted `colors.chatCanvas` (`#EDE6F5`), and on top of it
  `<ScreenGradient variant="chat" />` drew the same lavender again plus two static glows
  (purple at the top left, blue at the bottom right).
- **Now:** the root still paints `colors.chatCanvas`, and the glows are gone. The screen no
  longer renders `ScreenGradient`. The thread area (below the header and product snippet,
  above the emoji tray and composer) is wrapped in a `flex: 1` container. Its first child is
  React Native's own `Image` with `resizeMode="repeat"` showing
  `mobile/assets/chat-pattern.png` (420 dp tile; RN picks `@2x`/`@3x` by suffix).
- The wallpaper sits **outside** the inverted `FlatList`, so it stays still while messages
  scroll over it, the same "fixed" behaviour the web has. The FlatList's `style` and its
  `contentContainerStyle` are both `backgroundColor: 'transparent'`.
- It deliberately uses RN `Image`, not `expo-image`, because expo-image has no repeat mode.
  A comment in the code says so.
- No PNGs were changed and no dependency was added. `ScreenGradient.tsx` is untouched; its
  `chat` variant now has no caller, and V-C removes it.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

None. Open any conversation on the phone. The tile size has **not been checked on a
device yet.** The bicycle doodle should be about three send-buttons wide, and the same size
on every phone.

### What NOT to do yet

- The web half is yours: spec §2 puts the same artwork at 420 px from
  `frontend/public/patterns/chat-pattern.svg`. That file is **not on `main` as of this
  entry**, so I couldn't compare the two. Mobile's three PNGs are byte-identical to the
  masters in `docs/design/assets/`. If you ever re-export the tile, copy all four files to
  both platforms in one commit (spec §4).
- Bubbles, spacing, fonts and the composer are unchanged on mobile. That is V-C, so don't
  match web against the current mobile bubbles yet.

---

<a id="2026-10-04-142615-vishwajeet-mobile-chat-wallpaper-fixes-card-photo-swipe-every"></a>

## 6 · Mobile chat: wallpaper fixes; card photo swipe everywhere

`2026-10-04-142615-vishwajeet-mobile-chat-wallpaper-fixes-card-photo-swipe-every.md` · 2026-10-04 14:26 · vishwajeet · block V-B · for neeraj

Follow-up to this morning's "Mobile chat wallpaper" entry, after the first device test.
Mobile only. **Two of these change what the web has to match**; see "What NOT to do yet".

### Chat wallpaper (`mobile/app/chat/[contactId].tsx`)

- **It covered only the top ~420 dp of the thread.** On Android, `resizeMode="repeat"` is a
  Fresco post-process, and on the device it drew one tile and stopped. The tiles are now
  laid out by hand: the thread is measured, and each 420 × 420 dp tile is its own image.
  The tile size was right on the device, so the PNGs and the 420 size are unchanged.
- **The doodles are lighter.** The tile layer is drawn at opacity **0.5**
  (`CHAT_WALLPAPER_OPACITY` in `mobile/src/theme`). The strokes go from about 35–40%
  purple to about 18–20%. The PNGs themselves are unchanged.
- **Text that sat straight on the wallpaper now has a backing**, because the doodles ran
  through it:
  - The day separator is now the spec's **date chip** (§2: white 0.92, pill, Inter 700 11
    uppercase mutedText, 10 above / 6 below, no lines).
  - The unread divider is now the spec's **unread band** (§2: full-bleed white 0.88,
    Inter 700 11 purple, centered).
  - The empty-chat welcome (👋, title, hint) sits on a white 0.9 card, radius 20. This is
    new and not in the spec. The suggestion pills are unchanged.
  - "This is the beginning of your conversation about …" sits on a white 0.9 pill,
    radius 12, and its text moved from mutedLabel to mutedText. Also new and not in the
    spec.
  - New theme tokens: `chatDateChip`, `chatUnreadBand` (both from spec §3) and
    `chatNoteSurface`.

### Product card photo swipe (`CardPhotoPager.tsx`, `ProductCard.tsx`)

- Swiping between a card's photos barely worked on Android and could stop with two photos
  half on screen. The horizontal paging ScrollView was replaced with a gesture-handler
  Pan raced against a Tap, the same pattern `SwipeCard` uses. The pager always comes to
  rest on a photo, even when the swipe is cancelled.
- It is now **on for every product card**: marketplace grid, dashboard, public profile and
  the sell preview. The swipe deck opts out (`swipePhotos={false}`), because a sideways
  drag there means like or pass.
- The **"1/N" counter is gone** from swipeable cards; the dots are the indicator. The
  swipe-deck card still shows "1/N", because it has no dots.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

Any listing with 2+ photos. Any conversation; a brand-new one shows the welcome card.

### What NOT to do yet

- **The web needs two matching changes, or the platforms diverge** (spec §5 allows no
  difference here):
  1. Draw the wallpaper layer at **opacity 0.5**.
  2. Back the empty-chat welcome and the "beginning of your conversation" line with
     `rgba(255,255,255,0.9)`.
  `docs/design/MESSAGES_SPEC.md` is yours, so I have **not** edited it. If you agree,
  please add both to §2/§3. If you'd rather use a different opacity, tell me and I'll match
  it; it's one constant.
- The date chip and unread band are the spec's own §2 values, so they need nothing extra
  on web beyond what V-C already planned.
- Bubbles, fonts and the composer are still unchanged on mobile (V-C).

---

<a id="2026-10-04-170506-neeraj-seed-image-catalogue-checker"></a>

## 7 · Seed-image catalogue + checker

`2026-10-04-170506-neeraj-seed-image-catalogue-checker.md` · 2026-10-04 17:05 · neeraj · block N-C · for vishwajeet

New files, all under `scripts/seed-images/`. No seed file, SQL, backend, mobile or supabase
file was touched.

- `catalogue.json`: `{ "<exact product title>": ["<image url>", ...] }`. It covers 50 of the
  100 unique seed titles with 87 images (1 to 3 per product). 34 are portrait (39%).
  Keys are copied byte-for-byte from `supabase/seed.sql`, `backend/scripts/seedLocal.js` and
  `backend/scripts/seedDemo.js`, em dashes included. "Bajaj 1.5L Electric Kettle" appears
  twice in `seed.sql` (sold and available rows), and its single key covers both.
- `credits.json`: keyed by image URL, `{ author, license, page }`. Every image is
  CC0, public domain, CC BY or CC BY-SA from Wikimedia Commons. CC BY / BY-SA require the credit
  to travel with the image wherever we show it publicly.
- `check.mjs`: Node 22, no dependencies. Pulls every URL out of the three seed files and
  `catalogue.json` and requests each one. It fails unless the answer is 2xx with `image/*`. 429/503
  are retried with backoff. Seed titles with no catalogue entry are printed as a warning only.
  - `node scripts/seed-images/check.mjs`: all four sources
  - `node scripts/seed-images/check.mjs catalogue`: catalogue only
- `review.html`: every catalogue image in a 1:1 `object-fit: cover` box, the same crop as
  `frontend/src/components/ProductCard/ProductCard.module.css` `.imageWrap`. The title and
  credit are shown under each image. Serve the folder over http, or open the file and pick
  both JSON files.

Image URLs are exactly what the Commons API returned for `iiurlwidth=800`. Thumbnails come
back on `thumb.wikimedia.org` (960px bucket, `utm_*` query included). Files narrower than 800px
come back as originals on `upload.wikimedia.org`. Do not rewrite or trim these URLs.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

- `node scripts/seed-images/check.mjs catalogue` → `84/84 URLs OK · 0 dead`, exit 0
  (87 entries, 84 unique: three images are shared between near-identical titles).
- `node scripts/seed-images/check.mjs` today → `143/147 URLs OK · 4 dead`, exit 1. All 4 are
  the known dead Unsplash links in `seedDemo.js`.

### What NOT to do yet

- **Vishwajeet applies this in V-D. Neeraj does not edit the seed files.** For each title in
  `catalogue.json`, replace that product's `image_urls` / `imgs` with the catalogue array as-is.
  Titles not in the catalogue keep their current images. `check.mjs` lists them as a warning.
- **`node scripts/seed-images/check.mjs` must pass (exit 0) after V-D.** Heads-up: of the 4
  dead `seedDemo.js` links, only the Samsung monitor has a catalogue entry. The other three
  have no photo yet, so the full check will still fail on them until Neeraj picks images by hand:
  - DSA Made Easy — Narasimha Karumanchi (Latest Edition)
  - Nike Dri-FIT Oversized Hoodie — Olive Green, Size L
  - Philips Dry Iron + Usha Room Heater — Winter Bundle
- Don't add placeholder or "close enough" photos for the 50 uncovered titles. Each needs a
  photo of the actual product, chosen by hand.
- Don't source seed images from crime-evidence, law-enforcement or news-event material, even
  when it is public domain. That means no `EFTA…` files, no FBI/police authors, and no file
  whose Commons categories are about a crime, raid, evidence, court case, disaster or news event.
  Check the file page's categories before adding an image.
- Don't hotlink Pixabay: its terms forbid hotlinking and its URLs expire in 24h.

---

<a id="2026-10-04-172010-vishwajeet-mobile-messages-redesign"></a>

## 8 · Mobile messages redesign

`2026-10-04-172010-vishwajeet-mobile-messages-redesign.md` · 2026-10-04 17:20 · vishwajeet · block V-C · for neeraj

Both mobile messages screens now implement `docs/design/MESSAGES_SPEC.md` §1 and §2. This
is presentation only: data fetching, pagination, realtime, sending, mark-read and
navigation are unchanged. Where the spec is silent, I used the mockup's layout values
(`messages-mockup.html`), and where the mockup is silent too, I kept the current
behaviour. The full list is below so web can match it.

### What changed on mobile

- **Inbox** (`mobile/app/(tabs)/messages.tsx`):
  - App canvas, header with title and "N unread conversation(s)" subtitle, filter field
    restyled.
  - Rows have no card. The divider starts at the text column (left 76). Unread rows use
    weight 800/700/500 plus a gradient badge (99+).
  - The product chip is the spec's text chip, 5 below the preview. The thumbnail is gone.
  - Skeleton rows on load (avatar plus two bars). The row is memoized.
- **Conversation** (`mobile/app/chat/[contactId].tsx`):
  - White header: purple chevron, 36 avatar, name in Inter 600 16, and a status line
    reading `<University> · online`.
  - The product snippet sits on its own white strip: pinkLight pill, 30×30 thumbnail.
  - Bubbles per spec: 78% of the thread width, capped at 520. Gaps are 2 inside a run and
    8 between runs. Text is 14/20. Received bubbles are white with a hairline border.
  - Meta row: Inter 500 11, white 90% on sent bubbles.
  - Ticks: read is **amber** `chatReadTick`; failed is `#F87171`.
  - Composer: white bar, `inputBg` pill with no border, placeholder `Message`, 40 send
    button.
- **Sent bubble:** `SENT_BUBBLE_STYLE` in `mobile/src/theme`. `'gradient'` = purple →
  `bubbleMineEnd` via expo-linear-gradient. `'solid'` = `bubbleMineSolid`. The bubble row
  is memoized, and the gradient's props are module constants, so it never remounts. Both
  settings type-check and bundle. **It ships as `'gradient'`.**
- **Time formatting:** one set of calendar rules in `mobile/src/lib/messages.ts` drives
  both the inbox time (the §1 table) and the date-chip labels. The bubble time is now
  `4:41 PM` (it was `16:41`). Weekday and month names are fixed English tables, not
  `Intl`.
- **Runs:** the existing logic already matched the spec (same sender, same day, ≤ 5 min).
  It is unchanged except that it compares calendar days directly.
- **Tokens added:** spec §3's `bubbleMineEnd`, `bubbleMineSolid`, `chatReadTick` and
  `bubbleTheirsBorder` (`chatDateChip` and `chatUnreadBand` landed in V-B). Also seven
  tokens that only give names to rgba values §1/§2 already spell out: `messagesLine`,
  `messagesBarBorder`, `inboxFilterBg`, `inboxRowPressed`, `inboxProductChipBg`,
  `bubbleMineMeta`, `chatFailedTick`. No new values.
- **Removed:** the `inbox` and `chat` variants of `ScreenGradient`, and `inboxTop`,
  `inboxMid`, `inboxBottom`. Nothing else referenced them.

### Values the spec doesn't give (please match on web, or tell me to change)

- **Taken from the mockup:**
  - Inbox header padding is 8/16/12, with 2 above the subtitle.
  - Filter field: inner padding 14, gap 8.
  - Rows are vertically centred. Name and time share a baseline. The preview line sits 3
    below the name.
  - Chat header padding is 8/12 with a gap of 10.
  - The snippet strip has 6/12/8 padding and its own bottom border.
  - The thread has 10/12 padding.
  - Composer controls have a gap of 8.
- **Kept as they were:**
  - The online dot on avatars, in the inbox and the chat header.
  - The avatar beside the last received bubble of a run.
  - A meta row on **every** bubble. The mockup shows it only on the last bubble of a run,
    and the spec doesn't say.
  - Link colours inside bubbles. The failed-bubble opacity and the "tap to retry" pill.
  - The emoji button and tray.
  - The chevron on the snippet.
  - The placeholder colour (`mutedPlaceholder`).
  - The typing bubble.
  - Error states.
  - The "Start the conversation ✨" preview fallback, and "Item" when there's no title.
- **Under one minute the inbox shows `0m`.** That's the table read literally; say if you'd
  rather spec something else.

### Spec items mobile could not do (data, not design)

- **Product price in the snippet.** Neither the inbox rows nor the chat params carry a
  price. Omitted for now; it needs `product_price` added to the inbox response, which is a
  backend change and outside this block.
- **The `You: ` prefix.** The inbox rows don't say who sent the last message. This needs
  `last_sender_id` in the same response. Also omitted.
- **The 135° gradient is corner-to-corner** (expo-linear-gradient `{0,0}` → `{1,1}`). CSS
  `135deg` keeps a true 45° on a wide bubble. Matching that exactly would mean measuring
  every bubble, which costs frames — the thing N-F is about to measure. The end colour
  still lands in the bottom-right corner where the time and ticks sit, so the measured
  contrast holds.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None. The price and `You:` items above would add two later, in a block of their own.

### Test data

Any account with a few conversations; the demo campus works. Check an unread row, a
conversation over 99 unread if you have one, and a thread spanning several days.

### What NOT to do yet

- **The mobile screens are ready for N-F.** Measure scrolling on the Samsung Galaxy A03s
  with `SENT_BUBBLE_STYLE = 'gradient'`, then `'solid'`. It's one line in
  `mobile/src/theme/index.ts`. Whichever wins ships on both platforms.
- Don't add the price or `You:` on web yet. Mobile can't show them until the inbox
  response carries the fields, and the two platforms mustn't differ.
- The unread band's timing is unchanged (only its look). The behaviour port is V-E.

---

<a id="2026-10-04-184315-vishwajeet-chat-emoji-sizing-jump-to-latest-welcome-sticker"></a>

## 9 · Chat: emoji sizing, jump-to-latest, welcome sticker

`2026-10-04-184315-vishwajeet-chat-emoji-sizing-jump-to-latest-welcome-sticker.md` · 2026-10-04 18:43 · vishwajeet · block V-C · for neeraj

Three additions to the conversation screen, asked for after comparing it with WhatsApp and
Telegram. They're live on mobile now. **The web needs the same three, with the same
numbers, below.** None of them is in `MESSAGES_SPEC.md` yet. It's your file, so I haven't
edited it; please add a short §2 subsection for each so the spec stays the record.

### 1. Emoji sizing (WhatsApp-style)

Size only: the emoji artwork stays the device's own font. WhatsApp's art is proprietary
and we can't ship it.

- **Which characters count:** a flag (two regional indicators), a keycap, or a
  pictograph in *emoji presentation*. That means emoji by default (😂), or a
  text-default character followed by U+FE0F (❤️). A pictograph includes its skin tone
  and ZWJ parts, so 👨‍👩‍👧 counts as one emoji. ©, ® and ™ in a sentence stay text.
  The regex is in `mobile/src/lib/emoji.ts`; it's plain JS, so web can copy it as is.
- **Inline:** an emoji inside text is drawn at **18 px**. The text is 14 and the
  paragraph's line height stays 20.
- **Jumbo:** a message that is *only* emoji (spaces allowed) is drawn at **48 px for 1
  emoji, 40 for 2, 32 for 3**, with line height ×1.25. From 4 emoji on, it uses the
  inline size. It stays inside the normal bubble with its time and ticks, as WhatsApp
  does.

### 2. Jump to latest

- **Shows when** you've scrolled up more than **320 px** from the newest message, and
  hides once you're back within that. It enters scaling up over 180 ms and leaves
  scaling down over 140 ms.
- **The button:** a **38** circle, white, 1px border `rgba(128,0,128,0.08)`, Feather
  `chevrons-down` 20 in purple. Shadow: purple, opacity 0.16, blur 6, y 2. Pressed:
  scale 0.94 on pinkLight.
- **Position:** bottom-right of the thread, 12 from the right edge and 12 above the
  composer. It never scrolls with the messages.
- **Badge:** counts the contact's messages that arrived after you scrolled away. It's
  the inbox badge exactly: 20 min, radius 10, 135° `#800080 → #EB487F`, Inter 700 11
  white, `99+`. It sits top −8, right −4.
- **Tap:** smooth-scrolls to the newest message. It changes nothing about mark-read or
  the unread band.

### 3. Welcome sticker (Telegram-style)

- **What it is:** "Bagsy", an original little Yahora shopping bag that hops, waves and
  blinks on a 2.4 s loop. It replaces the 👋 at the top of the empty-chat welcome card,
  shown at **120 × 120**.
- **One master for both platforms**, new in this entry:
  `docs/design/assets/welcome-sticker/`.
  - `sticker.html` is the source drawing. Open it in Chrome to watch it.
  - `build_sticker.py` renders it in Chrome and writes `welcome-sticker.webp`: animated,
    transparent, 360 px, 48 frames, 314 KB. It needs Chrome only.
- **Mobile** ships a byte-identical copy at `mobile/assets/welcome-sticker.webp`.
- **Web:** copy the same file to `frontend/public/stickers/welcome-sticker.webp`. Show it
  with a plain `<img width="120" height="120" alt="">`; browsers play animated WebP
  natively. Add `loading="lazy"`, since it's 314 KB and only an empty chat needs it.
- **Reduced motion:** mobile holds the first frame. On web, under
  `prefers-reduced-motion: reduce`, please show a still frame too.
- **Rule:** never edit the .webp. Change `draw()` in `sticker.html`, rebuild, and copy to
  both platforms in one commit, the same rule as the wallpaper (spec §4).

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

Any conversation. Send `👍` alone, then `🤔😋`, then `😂😂😂`, then `Emoji on 😂🔥`.
Scroll up in a long thread and have someone message you. Open a brand-new chat for the
sticker.

### What NOT to do yet

- ⚠️ **I added files under `docs/design/assets/`** (a new `welcome-sticker/` folder). I
  didn't touch any existing file there.
- Don't use a different emoji regex or different sizes on web. The two platforms would
  disagree on which messages go jumbo.
- Tapping the sticker does nothing yet. Telegram sends it as a greeting, but we have no
  sticker message type; that would be a product decision.

---

<a id="2026-10-04-192039-vishwajeet-web-three-chat-changes-to-match-mobile-final-value"></a>

## 10 · Web: three chat changes to match mobile (final values)

`2026-10-04-192039-vishwajeet-web-three-chat-changes-to-match-mobile-final-value.md` · 2026-10-04 19:20 · vishwajeet · block V-C · for neeraj

### ⚠️ I edited files in your scope, `frontend/`

You asked me to make these three changes on the web in my session, so you don't need to
build them. **Please review the diff.** Nothing else on the web messages page was
changed, and the V-C redesign is still yours to do.

**This entry replaces `2026-10-04-184315`** ("Chat: emoji sizing, jump-to-latest, welcome
sticker"). Its jumbo sizes and jump threshold were changed after testing on a phone, and
its sticker was replaced.

Files touched:

- `frontend/src/utils/emoji.js` (**new**): the web twin of `mobile/src/lib/emoji.ts`.
  Same regex, same sizes.
- `frontend/src/pages/messages/Messages.jsx`:
  - A memoized `MessageText` replaces the bare `<p>{msg.content}</p>`.
  - Jump-to-latest: state, a `newBelow` count, and the button.
  - `handleMessagesScroll` now also flips the button when it crosses 80 px. The existing
    `isAtBottomRef` calculation is unchanged.
  - The scroll container is wrapped in a new `.threadWrap`. All the scroll-anchor math
    is rect-based, so it doesn't depend on the wrapper.
  - The 👋 in `.emptyChat` is now the sticker.
- `frontend/src/pages/messages/Messages.module.css`: `.threadWrap`, `.emojiInline`,
  `.welcomeSticker` (replaces `.emptyChatEmoji`, which is removed, including from the
  reduced-motion list), and `.jump*`.
- `frontend/public/stickers/welcome-sticker.webp` and `welcome-sticker-still.webp`
  (**new**): byte-identical copies of the masters.

`npm run build` passes. I haven't seen it in a browser; please check it there.

### The three changes (identical on both platforms)

#### 1. Emoji size in messages

- **Inline:** an emoji inside text is drawn at **18 px**, with line-height 1 so the line
  doesn't grow.
- **Jumbo:** a message of *only* emoji is drawn at **34 px for 1, 30 for 2, 26 for 3**,
  with line height = size × 1.25. Four or more stay at 18. It stays in the bubble with
  its time and ticks.
- One regex decides which characters count, in both apps. Flags, keycaps, skin tones and
  ZWJ families each count as one emoji. ©, ® and ™ in a sentence stay text. I checked
  web and mobile against the same cases and they agree.

#### 2. Jump-to-latest button

- **Shows** once you're more than **80 px** up from the newest message (about one
  message). It scales in over 180 ms and out over 140 ms.
- **The button:** a 38 px white circle with a 1px `rgba(128,0,128,0.08)` border and a
  purple `ChevronsDown` icon at 20. Shadow `0 2px 6px rgba(128,0,128,0.16)`. Hover or
  press turns it pinkLight; press also scales it to 0.94.
- **Position:** bottom-right of the thread, 12 px from the right and 12 px above the
  composer.
- **Badge:** counts the other person's messages that arrived after you scrolled up. It's
  the inbox badge style: 20 min, radius 10, 135° purple → pinkDark, 700 11 white, `99+`.
- **Click:** smooth-scrolls to the newest message. Read receipts and the unread line are
  untouched.

#### 3. Welcome sticker: "Mishti"

- An original chubby orange kitten who waves and pops a big purple-pink "Hi!". It's on a
  2.4 s loop at **120 × 120**, replacing the 👋 in the empty chat.
- **Master:** `docs/design/assets/welcome-sticker/`.
  - `sticker.html` is the drawing. Open it in Chrome to watch.
  - `build_sticker.py` writes `welcome-sticker.webp` (animated, 600 KB) and
    `welcome-sticker-still.webp` (frame one, 14 KB). It needs Chrome only.
- **Web** loads it lazily and swaps to the still frame under
  `prefers-reduced-motion: reduce`, through `<picture>`. Mobile holds frame one itself.
- **Never edit the .webp files.** Change `draw()`, rebuild, and copy to both platforms in
  one commit.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

Any conversation, on both web and phone:

- Send `👍`, then `🤔😋`, `😂😍🥺`, `😂😍🥺😭😎` and `Hi 😂🔥`. Sizes should step
  34 → 30 → 26 → 18 → 18.
- Scroll up by one message and the button should appear. Get a message while you're up
  and the badge should count it.
- Open a brand-new chat for the sticker.

### What NOT to do yet

- Don't re-implement these three. They're done on web; review them instead.
- Keep the sizes and thresholds identical to mobile. If one changes, change
  `src/utils/emoji.js` and `mobile/src/lib/emoji.ts` and the theme's `EMOJI_SIZES`
  together.

---

<a id="2026-10-07-022059-vishwajeet-welcome-stickers-four-chosen-per-conversation-web"></a>

## 11 · Welcome stickers: four, chosen per conversation (web + mobile)

`2026-10-07-022059-vishwajeet-welcome-stickers-four-chosen-per-conversation-web.md` · 2026-10-07 02:20 · vishwajeet · block V-C · for neeraj

**This replaces the single "Mishti" sticker** from `2026-10-04-192039`. An empty chat now
shows one of four animated "Hi" stickers. Telegram-style, but the pick comes from the
conversation rather than being random on each open:

- The same chat always shows the same sticker.
- Both people in it see the same one.
- The phone and the website always agree.

The four were chosen from a preview of twelve: **Bear, Kawaii blob, Birdie, Blue rabbit.**
They're from LottieFiles, under the Lottie Simple License: free for commercial use,
modification allowed, no attribution required. Creators and links are in
`docs/design/assets/welcome-sticker/lottie/SOURCES.md`.

### ⚠️ I edited files in your scope, `frontend/`

The owner asked for this on both platforms in my session. Please review.

- **New** `frontend/src/utils/stickers.js`: the sticker list and the per-chat pick. It's
  the twin of `mobile/src/lib/stickers.ts`, with the same ids, the same order and the
  same hash.
- `frontend/src/pages/messages/Messages.jsx`:
  - The two `STICKER_*` constants are gone.
  - A `welcomeSticker` memo is keyed on the current user, `contact_id` and `product_id`.
  - The empty-chat `<picture>` reads from it.
- `frontend/public/stickers/`: `welcome-sticker*.webp` removed, and `{bear,blob,birdie,
  rabbit}.webp` plus `-still.webp` added. The still frames are used under
  `prefers-reduced-motion`.

`npm run build` passes. I haven't seen it in a browser.

### How the pick works (identical on both platforms)

- `key = sort([userId, contactId]).join(":") + ":" + productId`, then 32-bit FNV-1a,
  modulo 4, into `["bear", "blob", "birdie", "rabbit"]`. If any id is missing, it shows
  `bear`.
- **Checked** on 2,000 random conversations: phone and web always pick the same
  sticker, swapping the two users never changes it, and each sticker comes up about a
  quarter of the time.
- **To add or remove a sticker,** change the list in both files in the same commit. Note
  that changing the list reshuffles which chat shows which sticker.

### The sticker sources (`docs/design/assets/welcome-sticker/`)

- `lottie/<id>.json` are the LottieFiles animations. The bear was edited: its full-frame
  white background and a stray "GN" text layer were removed, which is why a white square
  showed behind it.
- `drawn/` holds Bagsy and Mishti, kept but not shipped.
- `build_stickers.py` renders any of them to `out/<id>.webp` plus a still frame (360 px,
  20 fps). It needs Chrome only.
- Ship the chosen ones by copying from `out/` to `mobile/assets/stickers/` and
  `frontend/public/stickers/`. Never edit a .webp by hand.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

Open several brand-new chats. Different chats should show different stickers, and
reopening one shows the same sticker again. The person on the other side, and the same
chat on the phone, should show the same one.

### What NOT to do yet

- Don't pick the sticker with `Math.random()` on web. It has to match the phone.
- The other eight candidates aren't shipped. Their sources stay in `lottie/` in case we
  want to add more later.

---

<a id="2026-10-07-110239-vishwajeet-mobile-unread-line-and-read-on-sight"></a>

## 12 · Mobile unread line and read-on-sight

`2026-10-07-110239-vishwajeet-mobile-unread-line-and-read-on-sight.md` · 2026-10-07 11:02 · vishwajeet · block V-E · for neeraj

This is a port of the web's unread behaviour to the mobile conversation screen, plus one
**additive** backend change: `PUT /api/messages/read` accepts an optional `upToId`. The web
now uses it too; see the warning below.

Files:
- `mobile/app/chat/[contactId].tsx`, `mobile/src/contexts/RealtimeContext.tsx`,
  `mobile/src/hooks/useMessages.ts` (`useMarkRead`)
- `backend/src/modules/messages/messages.controller.js` (`markAsRead`), `backend/API.md`
  (commit `a29c59a`)
- `frontend/src/pages/messages/Messages.jsx`

⚠️ Backend PR: **this needs your review before merge.** It's the messages module only.

### ⚠️ I edited a file in your scope, `frontend/`

The owner asked for this on the web in my session, so both platforms mark messages read
the same way. **Please review the diff.** Only `Messages.jsx` changed, and only its
read-marking. The anchoring, the band, jump-to-latest, pagination and the look are
untouched.

- **Three whole-thread `PUT /messages/read` calls are gone:**
  - on open, in `handleSelectChat`;
  - on a realtime arrival while watching;
  - on returning to the tab, in `flushAwayUnread`.
- **They're replaced by one read-on-sight path,** `scheduleRead()` → `flushVisibleRead()`:
  - Any scroll, `messages` change, `showInboxOnMobile` change, or return to the tab
    restarts a 300 ms timer (`READ_DEBOUNCE_MS`).
  - When the timer fires, it measures the rows by their `data-msg-id` rect. It finds the
    newest unread message from the contact that is at least 50% inside the thread's
    viewport (`READ_VISIBLE_RATIO`).
  - It sends that as `upToId`, then sets the inbox badge to the unread messages after it.
  - Nothing is sent while the tab isn't watched, or while the chat pane has no layout
    (the phone inbox view).
  - `lastReadIdRef` stops the same position being sent twice. It's reset on chat switch
    and on error.
- **Why measure when the timer fires instead of using an IntersectionObserver:** the
  measurement always reflects the viewport after the layout effect has anchored on the
  line. A position taken before the anchor would mark the whole run read.
- **Inbox badge:** an arrival in the open chat now skips the badge only if you're
  watching, at the live end (`isAtBottomRef`), *and* the pane is on screen. Otherwise it
  counts until you reach it.
- `npm run build` passes. I haven't seen it in a browser.

### What mobile does now

- **Band placement matches the web.**
  - The band is pinned once, after the history has *settled*, meaning no fetch is in
    flight. The cache is persisted, so before this the band could be pinned on a stale
    copy of the thread.
  - It uses the web's inbox-count fallback: if `unread_count` says there are more unread
    than the rows show, it takes that many of the contact's newest messages.
  - With more unread than one page, the band goes above the oldest *loaded* unread
    message and counts only the loaded ones. That's the same as the web; no extra page
    is fetched.
- **The chat opens at the band.** `scrollToIndex` puts the band about 35% down the screen,
  the web's `UNREAD_ANCHOR_LEAD_RATIO`. Rows that aren't measured yet go through
  `onScrollToIndexFailed`, which jumps to an estimate and retries, at most 4 times. The
  away-from-chat band now lands at the same position. It used to go to the very top.
- **Read on sight.**
  - A message counts as seen once 50% of its row is visible (`onViewableItemsChanged`).
  - Newly seen unread ids are batched and debounced by 300 ms. Then **one**
    `PUT /api/messages/read` goes out, with `upToId` set to the newest message in the batch.
  - Messages up to that one turn read. Later ones stay unread, keep the inbox badge, and
    get the band next time.
  - Nothing is marked read on open or on focus any more. Nothing is marked read before
    the band is pinned, while the chat is under another screen, or while the app is
    backgrounded or offline.
  - Nothing is marked read until about 600 ms after the scroll to the band
    (`ANCHOR_SETTLE_MS`). Before then the screen is still showing the newest messages,
    and a read position taken there would mark the whole run read.
- **`RealtimeContext` no longer marks the open chat read when a message arrives.** It
  only sends deliver. The chat counts as the realtime "active chat", which keeps new
  messages out of the inbox badge, only while you're at the newest message. Messages that
  arrive while you're scrolled up are counted in the badge until you scroll down to them.
- **Scrolled up and a message arrives:** your position holds
  (`maintainVisibleContentPosition`, with an 80 dp auto-follow threshold, the web's
  `BOTTOM_STICK_THRESHOLD`). Before this, each arrival pushed the view along by one
  message.
- **Sending your own message** scrolls to the newest message, as the web does.

### Runbook §1.10 was wrong about the old web, and is true now

- §1.10 said the web "marks messages read only when they actually appear on screen." It
  didn't: it marked the whole thread read as soon as the thread opened. **It does now,
  on both platforms**, and F5 row 2 should pass with the reader on either one.
- "Up to" means a position, not a list. Older messages above the reader's view are
  marked too. That's Telegram's model. It means nothing gets stranded as unread forever,
  which a list of ids would have done once unread messages ran past one page.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None breaking. One additive change:

- `PUT /api/messages/read`: new **optional** body field `upToId` (uuid).
  - **When present:** only the caller's unread messages from `contactId` on `productId`
    with `created_at <=` that message's are marked.
  - **New errors, only when it's present:**
    - 400 `INVALID_FORMAT`: not a uuid.
    - 404 `NOT_FOUND`: not a message from `contactId` to the caller in that thread.
  - **When absent:** unchanged, the whole thread is marked.
  - `backend/API.md` is updated.
  - Checked on local: a bad uuid → 400, a message from the wrong thread → 404, and
    neither changes a row. `upToId` = the 2nd of 3 → `[read, read, unread]`. Without it
    → all three read.

### New fields on existing responses

None.

### Test data

F5, on two accounts:

- 0 unread: the chat opens at the newest message with no band.
- 1 unread: same, with a "1 unread message" band just above it.
- 6 unread: the band sits about a third of the way down, with the first unread just
  below it.
- More than 20 unread: the band sits above the oldest loaded unread message, with
  "20 unread messages".

Then check F5 row 2: read only the first 3 under the band, then leave. The sender should
see 3 read and 3 unread, and your inbox badge should show 3. **Do it on both the web and
the phone**, because the web read path is new too.

Also check:

- Scroll up and receive a message: you shouldn't move, and the jump button's badge
  should count it.
- Open the product from the header, then press back: you should be in the same chat, at
  the same place.

### What NOT to do yet

- Don't add any new whole-thread `PUT /messages/read` calls on either platform. Every
  read goes through read-on-sight with `upToId`. The no-`upToId` path stays in the
  backend for old clients only.
- `maintainVisibleContentPosition` on an inverted list hasn't been checked on a device
  yet. If arrivals at the bottom stop showing up, that's the first suspect.

---

<a id="2026-10-07-110935-neeraj-seed-image-catalogue-23-titles-for-v-d"></a>

## 13 · Seed-image catalogue: 23 titles for V-D

`2026-10-07-110935-neeraj-seed-image-catalogue-23-titles-for-v-d.md` · 2026-10-07 11:09 · neeraj · block N-C · for vishwajeet

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

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

- `node scripts/seed-images/check.mjs catalogue` → `97/97 URLs OK · 0 dead`, exit 0
  (102 entries, 97 unique: the two kettle titles share two URLs, plus the three older shared ones).

### What NOT to do yet

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

---

<a id="2026-10-07-115427-vishwajeet-read-tick-colour-sunflower-gold"></a>

## 14 · Read tick colour: WhatsApp blue (final)

`2026-10-07-115427-vishwajeet-read-tick-colour-sunflower-gold.md` · 2026-10-07 11:54 · vishwajeet · block V-C · for neeraj

The read tick (double check on a sent bubble) was the spec's pale amber `#FDE68A`. On the
phone it could hardly be told apart from the white delivered ticks next to it. It is now
**WhatsApp's read blue, `#53BDEB`, on both platforms**. The owner chose it after trying it
on the phone.

The filename still says "sunflower gold". That was this entry's first version, the same
day: gold `#FFD60A` was tried first, then replaced by blue.

### Contrast (WCAG method as spec §7; icons need 3.0)

| Background | Old amber `#FDE68A` | **Blue `#53BDEB`** |
|---|---|---|
| Bubble end `#C02B7F`, where the ticks sit | 4.33 | **2.53** ⚠️ |
| Bubble start `#800080` | 7.56 | 4.42 ✅ |
| Solid fallback `#9B1280` | 6.04 | 3.53 ✅ |

⚠️ The tick fails 3.0 on the bubble's pink end. **This was accepted knowingly.** The
owner preferred WhatsApp's familiar blue to a paler cyan. If it ever needs to pass, the
brand's `blueLight` `#6FE1FF` gets 3.57:1 there.

### Files

- `mobile/src/theme/index.ts`: `colors.chatReadTick = '#53BDEB'`.
- ⚠️ **I edited a file in your scope:** `frontend/src/pages/messages/Messages.module.css`.
  - `.tickRead` is now `#53bdeb`.
  - Its amber `drop-shadow` glow is removed. It existed to help the pale amber stand out,
    and mobile never had it.
  - Nothing else changed. Please review.
- `npx tsc --noEmit` and `npm run build` both pass.

### Spec

`docs/design/MESSAGES_SPEC.md` is yours, so I haven't edited it. Please update it:

- **§2 Ticks table:** Read → blue `#53BDEB`. Also replace the line "Amber, not blue, on
  both platforms" with the reason above.
- **§3 tokens:** `chatReadTick` and `--chat-read-tick` → `#53BDEB`.
- **§7:** the "Amber read tick on `#C02B7F`" row becomes "Blue read tick on `#C02B7F`",
  2.53, needs 3.0, marked accepted.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

Any conversation where the other person has read your messages. Compare a read message's
ticks with a delivered one's, on the phone and on the web.

### What NOT to do yet

- Keep the two platforms on the same value. If it changes again, change
  `colors.chatReadTick` and `.tickRead` in the same commit.

---

<a id="2026-10-09-162450-vishwajeet-real-seed-images-13-products-replaced-live-demo-re"></a>

## 15 · Real seed images, 13 products replaced, live demo repair SQL

`2026-10-09-162450-vishwajeet-real-seed-images-13-products-replaced-live-demo-re.md` · 2026-10-09 16:24 · vishwajeet · block V-D · for neeraj

Every seeded product that had a placeholder now shows real photos from your
`scripts/seed-images/catalogue.json`. 13 branded or unphotographable products were
swapped for generic ones that do have good photos.

**Heads-up: Vishwajeet edited two files in your `scripts/seed-images/` folder.** This
happened in earlier steps of this block, not in the seed-file step:

- In `catalogue.json` I added 13 new title keys (the "new" column below) and removed one I
  had briefly added, "Lab coat — white, size M". It was the wrong category for the slot it
  replaced.
- In `credits.json` I added one credit per new URL and removed the lab coat's.
- All new photos follow your rules: Commons API, `iiurlwidth=800`, URLs exactly as
  returned, CC0 / PD / CC BY / CC BY-SA only. Each was checked for brands, faces and the 1:1
  centre crop. Nothing else in the folder changed.

### The 13 replacements (old → new)

Each row was replaced in place. Its id, seller, university, category, location, condition,
status, views, likes and dates are unchanged; only the title, description, price and photos
changed.

| File | Old title | New title |
|---|---|---|
| `supabase/seed.sql` | GATE CSE Made Easy Study Set (2024 edition) | Whiteboard — 2 x 3 ft, with markers |
| `supabase/seed.sql` | Foldable Study Table with Bookshelf | Wooden Bookshelf — 4 shelves |
| `supabase/seed.sql` | Hero Sprint 26T Gear Cycle | 26T Geared Cycle |
| `supabase/seed.sql` | Cotton Formal Shirts — set of 3, size M | White Formal Shirt — size M |
| `supabase/seed.sql` | Steel Almirah — 4 shelves, lockable | Wooden Stool |
| `supabase/seed.sql` | Clamp-on LED Study Lamp | Bean Bag — XL |
| `supabase/seed.sql` | Godrej 45L Mini Fridge | Pressure Cooker — 3 L |
| `supabase/seed.sql` | Aptitude and Reasoning prep set | Spiral Notebooks — pack of 6 |
| `backend/scripts/seedLocal.js` | Engineering Thermodynamics — P.K. Nag, 6th edition | Desk Globe — 30 cm |
| `backend/scripts/seedLocal.js` | Decathlon rain jacket — navy, size M | Denim Jacket — size M |
| `backend/scripts/seedLocal.js` | Hero Sprint 26T geared cycle with lock | Kick Scooter — foldable |
| `backend/scripts/seedDemo.js` | DSA Made Easy — Narasimha Karumanchi (Latest Edition) | DSA Handwritten Notes — Full Semester, Spiral-Bound |
| `backend/scripts/seedDemo.js` | Nike Dri-FIT Oversized Hoodie — Olive Green, Size L | Foldable Umbrella — black |

### Other seed changes

- **`supabase/seed.sql`**
  - Every `placehold.co` array now holds the catalogue photos for that exact title: 41
    rows, 0 placeholders left.
  - Three seeded texts changed because they no longer fitted the new products:
    - Comment `e1…003` now asks whether the whiteboard comes with markers and an eraser.
    - Message `f0…007` drops "Hero Sprint".
    - Message `f0…010` now says the cycle is "the white one", because the photo shows a white
      bike.
  - Two code comments that named the placeholder service were reworded.
- **`backend/scripts/seedLocal.js`**
  - `image_urls` comes from `catalogue.json` by exact title.
  - The lookup runs when the file loads, before any database write. A title with no catalogue
    entry throws an error naming that title; there is no placeholder fallback.
  - **If you rename a seedLocal listing, add a catalogue key for the new title, or the script
    will not start.**
- **`backend/scripts/seedDemo.js`**
  - Besides the two replacements, "Samsung 24" FHD IPS Monitor — HDMI + VGA" and "Philips Dry
    Iron + Usha Room Heater — Winter Bundle" kept their titles and got their catalogue photos
    in place of the two dead Unsplash links.
  - All four previously dead demo links are gone.
  - No other demo image changed.

### Production repair (written, NOT run)

[`docs/runbooks/phase6a-vd-production-repair.sql`](../runbooks/phase6a-vd-production-repair.sql)

seedDemo.js skips any title that already exists on the demo tenant, so the live demo needs a
one-off fix for 4 rows. The file has three steps:

- (a) BEFORE checks: expect 4 old rows and 0 new titles.
- (b) One `UPDATE … FROM (VALUES …)` matched on exact title plus `domain = 'demo.yahora.com'`.
- (c) AFTER check: expect 4 rows with the new links.

The values are byte-identical to the new seedDemo.js. I dry-ran it locally inside a rolled-back
transaction against a simulated pre-repair state, and the result matched a fresh seedDemo run
(0 mismatching rows). Vishwajeet runs it on production by hand.

### Migrations applied

None. No schema change.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

All of these were run locally:

- `supabase db reset` applied every migration and seeded cleanly.
- `node backend/scripts/seedLocal.js` → 696 students and 928 products across 116 universities.
- `node backend/scripts/seedDemo.js` → 40 products, 15 users.
- `node scripts/seed-images/check.mjs` → `175/175 URLs OK · 0 dead`, "All checks passed."
- `grep -c placehold.co supabase/seed.sql backend/scripts/*.js` → 0 for every file.
- check.mjs still warns about 27 seed titles with no catalogue entry: 4 Unsplash rows in
  seed.sql and 23 in seedDemo.js. They keep their current images. None of the 13 old or new
  titles is among them.

### What NOT to do yet

- Don't re-run seedDemo.js against production before the repair SQL has run there. It would
  add the two new products next to the old ones.
- Two demo listings now overlap with fallback titles. "Magnetic Whiteboard (2×1.5 ft) + 5
  Markers + Duster" sits next to seed.sql's new whiteboard, and "Wrangler Denim Jacket —
  Unisex, Size M" next to seedLocal's denim jacket. They are on different tenants, so nothing
  collides, but say if you want either changed.

---

<a id="2026-10-11-112428-neeraj-web-chat-wallpaper"></a>

## 16 · Web chat wallpaper

`2026-10-11-112428-neeraj-web-chat-wallpaper.md` · 2026-10-11 11:24 · neeraj · block N-D · for vishwajeet

The web conversation now sits on the same doodle wallpaper as mobile
(`docs/design/MESSAGES_SPEC.md` §2). CSS only — no `.jsx` changes.

- `frontend/src/pages/messages/Messages.module.css` → `.messagesContainer`: ground stays
  `#ede6f5`; the two radial-gradient glows and the dot-grain data-URI are gone, replaced by
  `url('/patterns/chat-pattern.svg')`, `repeat`, `420px 420px`. `background-attachment` is
  left at its default (`scroll`), so the tile stays put while messages scroll over it.
- **Added `frontend/public/patterns/chat-pattern.svg`.** The handoff said it was already
  copied in; it was not in the repo. Copied byte-for-byte from the master
  `docs/design/assets/chat-pattern.svg` (sha1 `c455edf2…`, identical). Master untouched.

`.inboxSidebar`, bubbles, spacing and fonts are untouched — that is N-E.

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

If the tile is ever regenerated, copy it to `frontend/public/patterns/` in the same commit as
the mobile PNGs (spec §4) — the web copy is now a real file that can drift.

---

<a id="2026-10-11-114517-neeraj-web-messages-redesign"></a>

## 17 · Web messages redesign

`2026-10-11-114517-neeraj-web-messages-redesign.md` · 2026-10-11 11:45 · neeraj · block N-E · for vishwajeet

The web inbox and conversation now follow `docs/design/MESSAGES_SPEC.md` §1–§2. Where the
spec is silent, I used the values your mobile screens took from the mockup, so the two
match. Message logic, realtime, sending, read tracking and the Phase 5 paging/anchoring
code are untouched: every `Messages.jsx` change is in the render or the imports.

### Your requests, done

- **Read tick blue `#53BDEB`** (your 2026-10-07 entry). It's now `--chat-read-tick` in
  `global.css`. I updated the spec as you asked: §2 Ticks table and its note, §3 tokens,
  §7 row (2.53, accepted).
- **Wallpaper at 0.5** (your 2026-10-04 V-B entry). CSS can't set opacity on a single
  background layer, so `.messagesContainer` puts the ground colour at 50% over the tile.
  That gives exactly the same result as tile × 0.5 over the ground. It stays pinned and
  doesn't scroll.
- **White 0.9 backings** on the "beginning of your conversation" banner and on an
  empty-chat card (radius 20, padding 24/16).
- The spec now records both: §2 Ground row, and a new "Text on the wallpaper" subsection.

### Files

- `frontend/src/styles/global.css`: `--bubble-mine-end #C02B7F`, `--bubble-mine-solid
  #9B1280`, `--chat-read-tick #53BDEB`.
- `frontend/src/utils/messageFormat.js` (**new**): the web twin of `formatClockTime`,
  `formatDayLabel`, `formatInboxTime` and `isGroupedWith` from `mobile/src/lib/messages.ts`.
  The rules and strings are the same. **If you change one, change both.**
- `frontend/src/pages/messages/Messages.jsx`, render only:
  - Inbox: subtitle "N unread conversation(s)"; the chip moved below the preview as text
    only, like mobile; badge shows `99+`; spec time format; skeleton rows replace the
    spinner.
  - Header: chevron back, avatar 36, Inter name, `online` status line. The product
    snippet is now its own bar below the header.
  - Thread: the date chip is a pill (side lines removed). The unread band is full-bleed
    and keeps `unreadDividerRef`. Runs use the 5-minute rule. Ticks are 14/15. The
    composer placeholder is "Message".
- `frontend/src/pages/messages/Messages.module.css`: spec values throughout. Colours with
  no global token are custom properties on `.root` (`--msg-muted`, `--msg-pink-light`,
  …). Note the web's global `--pink-light` is `#f4e0e4`, not the spec's `#FFF4F7`.
- `docs/design/MESSAGES_SPEC.md`: the updates above.

### Where web still differs, and why

- **No `You:` prefix.** `get_user_inbox` returns no last-sender column, which is why
  mobile has none either. It needs a new RPC column, which would be a migration, so it's
  yours to decide.
- **Header shows `online` only, with no university name.** Mobile reads the viewer's
  campus name from the universities list. The web only has `yahora_university_id`, so it
  would need a new `/universities` fetch, and this block isn't allowed to change data
  fetching.
- **No price in the product snippet.** The chat row has no price on either platform.
- **Composer input doesn't grow to 5 lines.** It's an `<input>`. A growing `<textarea>`
  changes how Enter sends, so I left it for a separate block.
- **No thread skeleton** for the initial history load. It needs a loading flag inside
  `handleSelectChat`, which is the Phase 5 open path, so I left it out on purpose.
  "Loading older" keeps the Phase 5 indicator.
- **No pending or failed ticks.** The web sends with no optimistic copy, so those states
  never exist.
- **Unchanged because the spec doesn't cover them:** the emoji toggle, the send button's
  disabled look, the green online dots, and the no-active-chat welcome panel.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None.

### Test data

Any account with several conversations, some of them unread.
- Inbox: check bold rows, purple times, the badge, and the chip under the preview.
- Thread with history: scroll up to load older messages. It must not jump (Phase 5).
- Send three messages within a minute (one run, tail on the last), then wait more than
  5 minutes and send another (new run).
- A brand-new chat should show the welcome card.

### What NOT to do yet

- If N-F moves mobile to the solid bubble, change `.bubbleMine` to
  `background: var(--bubble-mine-solid)` in the same commit (the CSS comment says so).
- Keep `messageFormat.js` and `mobile/src/lib/messages.ts` in step.

---

<a id="2026-10-11-121400-vishwajeet-messages-spec-v2-matches-what-mobile-ships"></a>

## 18 · MESSAGES_SPEC v2: matches what mobile ships

`2026-10-11-121400-vishwajeet-messages-spec-v2-matches-what-mobile-ships.md` · 2026-10-11 12:14 · vishwajeet · block WRAP-UP · for neeraj

`docs/design/MESSAGES_SPEC.md` is now **v2 · 11 October 2026**. It describes what the
mobile app actually ships at the end of Phase 6A. **It is the input for N-D (web wallpaper)
and N-E (web messages redesign).** Implement v2, not v1, and invent nothing.

### ⚠️ Vishwajeet edited `docs/design/`

`MESSAGES_SPEC.md` is your file. The owner asked for this update in my session, before you
build N-E from it. I only edited that one file; nothing else in `docs/design/` changed. The
mockup and the PNGs were **not** regenerated. A note at the top of the spec says they are v1
drawings and that the spec wins. Please review the diff.

Docs only: no code changed in `mobile/`, `frontend/`, `backend/` or `supabase/`, and no
design value was changed. v2 records what ships.

### What changed

The full diff is in the spec's new **§0.1 "What changed from v1"** table. The main points:

- **Read tick is blue `#53BDEB`** on both platforms (§2 Ticks, §3, §7). The contrast on the
  pink end is 2.53, against the 3.0 needed. The owner accepted that knowingly.
- **The wallpaper is drawn at opacity 0.5** (`CHAT_WALLPAPER_OPACITY`). The strokes read as
  about 18–20% purple. The master files are unchanged; each platform applies the opacity
  itself.
- **New §2 sections:** Emoji in messages, Jump-to-latest button, Welcome stickers, Empty
  chat, Beginning-of-conversation note, Unread behaviour.
- **Values v1 didn't give are now written down:**
  - the paddings, gaps and alignment taken from the mockup;
  - the mobile values that were "kept as they were" (online dots, the avatar beside the last
    received bubble, a meta row on every bubble, link colours, the failed-message pill,
    composer details, fallback texts);
  - inbox `0m` under one minute.
- **New §8 "Deferred on both platforms":** the price in the snippet and the `You: ` prefix.
  These are no longer live requirements in §1/§2, because they need `product_price` and
  `last_sender_id`, which the inbox response doesn't carry.
- **New §9 "Not specified yet":** the typing bubble, error states, and the emoji button and
  tray. Each platform keeps its current look.
- **§5 now allows five differences.** The new one is the gradient direction: corner to
  corner on mobile, a true 135° in CSS.
- **§3 lists every messages token with its value.** The `inboxTop/Mid/Bottom` removal note
  is dropped, because those tokens are already gone.

### Where the changelog and the code disagreed (the code won)

- **Jumbo emoji line height.** The 6A entries say "size × 1.25". Both platforms actually use
  `round(size × 1.25)`, which gives **43 / 38 / 33** for 34 / 30 / 26 (not 42.5 / 37.5 /
  32.5). The spec gives the rounded values.
- **Jump-button shadow on Android.** The entry gives `0 2px 6px rgba(128,0,128,0.16)`. Mobile
  sets that, plus `elevation: 3`. Android ignores the coloured shadow and draws elevation as
  system grey. The spec records both. This is arguably a sixth platform difference that §5
  doesn't list. The owner should decide whether to accept it.
- **Jump-button position.** The entry says "12 above the composer". In the code it is 12
  above the bottom of the thread area, which is the top of the emoji tray when the tray is
  open. The spec says "12 above the bottom of the thread area".
- **Superseded entries match the code once you follow them to the latest one:**
  - `2026-10-04-184315` (48/40/32 emoji, 320 px threshold, "Bagsy") was replaced by
    `192039`.
  - The amber tick in `172010` was replaced by the read-tick entry.
  - The 👋 in the wallpaper-fixes entry was replaced by the stickers.
- **Stale comments in mobile code, recorded here only (I didn't touch the code):**
  - `[contactId].tsx:1274` still says "✓✓ in amber when read".
  - `emoji.ts`'s header points to the superseded `184315` entry.

### Not specified (marked in the spec)

- Web hover for the product snippet.
- Web hover for the empty-chat suggestion chips.
- Everything in §9: typing bubble, error states, emoji button and tray.

### N-E checklist: what the web does today that contradicts v2

Read from `frontend/src/pages/messages/` only; I didn't edit anything there. ✅ means it
already matches.

**Inbox**

1. **Canvas:** still the old `#fdf8ff → #f8f0ff → #fff4f9` ramp, with `::before/::after`
   glows. The spec wants the app canvas and no glows.
2. **Header:**
   - Web: padding 18/16/14, a translucent blurred bar with a bottom border, and a count pill.
   - Spec: padding 8/16/12, no bar, and an "N unread conversations" subtitle (hidden at 0).
3. **Search:**
   - Web: radius 12, 1.5px border at 0.12, padding 8/12, placeholder
     `Search conversations…` in `#b8a8c8`.
   - Spec: height 38, radius 19, white 0.78, 1px border at 0.08, inner padding 14,
     `Search conversations` in mutedText.
4. **Row:**
   - Web: padding 13/16, gap 11, a 46 avatar with a 2px border, and a full-width bottom
     border at 0.06. The active row has a gradient and a 3px pink left border.
   - Spec: padding 10/16, gap 12, a 48 avatar with no border, and a divider from left 76
     to 16 from the right. Selected is `rgba(128,0,128,0.08)`.
5. **Online indicator:**
   - Web: a dot next to the name, `#34d399`, pulsing.
   - Spec: a 13 dot on the avatar, `#4ADE80`, with a 2 ring in `#FCF8FC`.
6. **Unread weights:**
   - Web: only the preview changes (`#5a3878`, 600). The name is 700 always and the time is
     `#b0a0c0` always.
   - Spec: name 800, time 700 purple, preview 500 `#1A1A1A`. Read rows: 600 / 500 mutedText /
     400 mutedText.
7. **Time:** web always shows a clock time via `toLocaleTimeString`. The spec's table is
   `0m` · `2m` · `4:41 PM` · `Yesterday` · `Mon` · `12 Sep` · `12 Sep 2025`, with fixed
   English names.
8. **Product chip:**
   - Web: above the preview, with a thumbnail, a border and radius 5.
   - Spec: text only, 5 below the preview, radius 8, no border, background 0.09.
9. **Badge:**
   - Web: 18 min, weight 800, no `99+` cap.
   - Spec: 20 min, weight 700, `99+`.
10. **Fallback name:** web `Unknown`; spec `Yahora student`.
11. **Loading:** web shows a full-page spinner; the spec wants skeleton rows.

**Conversation**

12. **Header:**
    - Web: padding 12/20, a 42 avatar with a border, the name in Bree Serif 0.95rem
      `#1a0a2e`, and a green "Online" label.
    - Spec: padding 8/12, gap 10, a 36 avatar, the name in Inter 600 16 `#0B0B0B`, and a
      status line `<University> · online` in mutedText.
13. **Snippet:**
    - Web: inside the header's text column, `#f8f4ff` with a border, a 22 thumbnail, and a
      `→` character.
    - Spec: its own white strip below the header, a pinkLight pill, a 30 thumbnail, and a
      chevron 13.
14. **Ground (N-D):** the glows and dot grain are still there. There is no wallpaper:
    `frontend/public/patterns/` doesn't exist. Draw the tile at **opacity 0.5**.
15. **Thread padding:** web 16/20, spec 10/12.
16. **Date separator:**
    - Web: hairlines either side, white 0.7 with a border, `rgba(90,48,128,0.55)`, labels
      like `Mon, Sep 12`.
    - Spec: a chip with no lines, white 0.92, mutedText, labels `Mon` / `12 Sep` /
      `12 Sep 2025`.
17. **Unread divider:**
    - Web: a pink uppercase pill with fading lines.
    - Spec: a full-bleed white 0.88 band, Inter 700 11 purple, not uppercase.
18. **Bubble geometry:**

    | | Web today | Spec |
    |---|---|---|
    | Max width | 68% (80% / 88% on small screens), no cap | 78%, capped at 520 |
    | Padding | 9/13/7 | 8/12/6 |
    | Tail radius | 6 | 5 |
    | Text | 0.88rem / 1.45 | 14 / 20 |
    | Gap inside a run | 4 | 2 |
    | Gap between runs | ~13 | 8 |
    | Run rule | sender only | same sender, same day, within 5 min |

19. **Sent bubble:**
    - Web: ends at `#EB487F`, with no solid fallback and no `SENT_BUBBLE_STYLE` switch. The
      second shadow layer is 0.16.
    - Spec: ends at `#C02B7F`, and the second shadow layer is 0.14.
20. **Received bubble:**
    - Web: text `#2a082a`, border 0.07, avatar 28 with gap 8.
    - Spec: text `#1A1A1A`, border 0.08, avatar 26 with gap 6.
21. **Meta row:**
    - Web: time 0.67rem; white 0.82 on sent bubbles, `rgba(42,8,42,0.62)` on received ones.
      The format comes from the locale (`04:41 PM`, or 24-hour).
    - Spec: Inter 500 11; white 0.90 / mutedText; `4:41 PM`.
22. **Ticks:**
    - Web: sent at white 0.5 and delivered at 0.75, all 13 px. There are no pending or failed
      states. Delivered also shows whenever the contact is online, even when the message
      isn't delivered.
    - Spec: white 0.90, sizes 11/14/15/15/12, with pending and failed states.
    - ✅ Read `#53bdeb` already matches, but it's hard-coded; spec §3 names it
      `--chat-read-tick`.
23. **Links:** web renders message text as plain text. The spec wants `#6FE1FF` on sent
    bubbles and `#0B93D8` on received ones, underlined and tappable.
24. **Failed message:** nothing on web. The spec wants opacity 0.72 plus the "Failed — tap to
    retry" pill.
25. **Empty chat:**
    - Web: no card; the text is "Say hello to <name>!"; the chips sit on one wrapping row on
      white 0.8.
    - Spec: a white 0.9 card at radius 20 holding the sticker, the title
      `Start the conversation about <product>.` and the hint. Below it, three stacked chips
      in pinkLight with a `#E5C8E5` border, Inter 600 12 `#4F014F`.
    - ✅ The sticker already matches.
26. **Beginning note:**
    - Web: a banner with a Users icon and different text ("…with <name> about <product>. Be
      respectful…🎓"), white 0.72, radius 14. It also shows above an empty chat.
    - Spec: a white 0.9 pill, radius 12, Inter 400 12/17 mutedText, the text
      `This is the beginning of your conversation about <product>.`, and only in a thread
      that has messages.
27. **Composer:**

    | | Web today | Spec |
    |---|---|---|
    | Padding | 12/16 | 8/10/12 |
    | Input | single-line `<input>` | grows to 5 lines |
    | Input style | `#f8f4ff`, 1.5px border, radius 99 | `#F3F0EF`, no border, radius 20 |
    | Placeholder | `Type a message…` `#9878b8` | `Message` `#BBB6C8` |
    | Inactive send | pale outlined button | the gradient at opacity 0.4 |

28. **Jump button:** ✅ matches, except that hover and press use `var(--pink-light)`. On the
    web that variable is **`#f4e0e4`**, not pinkLight `#FFF4F7`. The same trap applies
    anywhere else the spec says pinkLight.
29. ✅ **Already matching:**
    - emoji sizes, the regex and the jumbo rounding;
    - welcome-sticker pick and the reduced-motion still;
    - unread constants (0.35, 0.5, 300 ms, 80);
    - jump threshold, size, badge and timings.

### Migrations applied

None.

### New endpoints

None.

### Changed endpoints (BREAKING)

None.

### New fields on existing responses

None. §8 of the spec records the two fields (`product_price`, `last_sender_id`) that the
price and `You:` would need later.

### Test data

None. This is a docs change.

### What NOT to do yet

- Don't build the snippet price or the `You: ` prefix on web (spec §8). Mobile can't show
  them either.
- Don't regenerate `messages-mockup.html` or the PNGs to "fix" them. The spec wins where they
  differ.
- Don't apply the 0.5 wallpaper opacity to the SVG file. Apply it to the layer that draws it
  (spec §2, §4).
- If you disagree with any v2 value, say so in an entry. Don't change one platform alone
  (spec §0).
