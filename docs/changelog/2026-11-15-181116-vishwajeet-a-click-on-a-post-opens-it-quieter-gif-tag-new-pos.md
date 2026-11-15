---
date: 2026-11-15T18:11:16+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "A click on a post opens it; quieter GIF tag; new Post this? words; the app's own emoji picker"
---

# A click on a post opens it; quieter GIF tag; new Post this? words; the app's own emoji picker

This is the owner's second round on 15 Nov, on `v-d-app-community`. As before, I changed the website only
where it had the same thing. `COMMUNITY_SPEC.md` is now **v3.13**, and its change note lists it all.
`npx vite build`, the app's `tsc` and an Android export pass. Nothing was checked in a browser or on the
phone.

**⚠ I edited your `frontend/` again, at the owner's request.** Five files:

1. **A click on a post opens its page**, not only a click on its time (X does the same). This is in
   `PostCard.jsx`, as `openPost` on the `<article>`.
   - It skips anything with a job of its own: links, buttons, inputs, `video`, and `[role=button|menu|dialog]`.
   - It skips clicks from a portal (a menu or picker drawn elsewhere, whose clicks still bubble through
     React). It checks `e.currentTarget.contains(e.target)`.
   - A click that ends a text selection doesn't navigate.
   - Ctrl or Cmd opens the page in a new tab.
   - Nothing changes on the post's own page.
   - `PostCard.module.css` gives a feed's posts `cursor: pointer`. The time link stays as the keyboard's
     way in.
2. **The GIF tag is quieter:**
   - `.gifBadge` in `PostCard.module.css` now uses the new `--gif-tag-bg` (0.38, was the toast's 0.88)
     and `--gif-tag-text`, set in `global.css`, at weight 600.
   - The composer's preview tag is unchanged.
3. **`Post this?` has new words.** In `Composer.jsx` the message is now `Some of this might come across
   as hurtful to other students. Consider editing it to keep things respectful.`

**Not changed on the website:**

- **GIF sizes.** The app's GIFs are a size smaller: a post's is at most 240 × 300, a reply's 160 × 200.
  Yours are still 280 × 360 (180 on a reply). **Please check** at 390 wide whether they look too big
  next to the text; if so, the app's numbers are there to copy.
- **The emoji picker.** The owner asked the app to follow the website's, which already scrolls through
  every category in one list.
- **The compose note** ("Be kind and respectful…"). It's for the app's full-screen compose screen; your
  composer is a dock.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

None.

## What NOT to do yet

- Not merged yet: on `v-d-app-community`.

## What to check in the browser (1440 and 390 wide)

1. In a feed, click a post's text. Its page should open. Clicking the avatar, the name, a photo, React,
   💬, ⋯ or a link should each do only their own thing.
2. Select a few words of a post by dragging. Its page should not open. Ctrl or Cmd + click should open it
   in a new tab.
3. Open the quick bar or the ⋯ menu and choose from it. Its page should not open.
4. A posted GIF's tag should be lighter and less noticeable.

## The app, same round (nothing for you to do)

- **A tap on a post opens its page**, with a slightly deeper ground while pressed.
- **Our own emoji picker** (`EmojiGrid`), used by compose's ☺ panel and the reaction ⊕ sheet. It behaves
  like yours:
  - one scrolling list, with the lit tab following the scroll and each tab jumping to its category;
  - search behind 🔍 in the tab row;
  - holding an emoji offers its skin tones.
  - The panel always shows at least four rows.
  - `rn-emoji-keyboard` and its patch are gone. Its emoji list was copied into
    `mobile/src/assets/emojis.json` (MIT).
- **GIFs a size smaller**, with the same quieter tag.
- **The compose screen has a quiet line above its tools:** `Be kind and respectful. Real students read
  every post.`
