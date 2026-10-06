---
date: 2026-10-04T19:20:39+05:30
author: vishwajeet
phase: "6A"
block: "V-C"
for: neeraj
title: "Web: three chat changes to match mobile (final values)"
---

# Web: three chat changes to match mobile (final values)

## ⚠️ I edited files in your scope, `frontend/`

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

## The three changes (identical on both platforms)

### 1. Emoji size in messages

- **Inline:** an emoji inside text is drawn at **18 px**, with line-height 1 so the line
  doesn't grow.
- **Jumbo:** a message of *only* emoji is drawn at **34 px for 1, 30 for 2, 26 for 3**,
  with line height = size × 1.25. Four or more stay at 18. It stays in the bubble with
  its time and ticks.
- One regex decides which characters count, in both apps. Flags, keycaps, skin tones and
  ZWJ families each count as one emoji. ©, ® and ™ in a sentence stay text. I checked
  web and mobile against the same cases and they agree.

### 2. Jump-to-latest button

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

### 3. Welcome sticker: "Mishti"

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

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

Any conversation, on both web and phone:

- Send `👍`, then `🤔😋`, `😂😍🥺`, `😂😍🥺😭😎` and `Hi 😂🔥`. Sizes should step
  34 → 30 → 26 → 18 → 18.
- Scroll up by one message and the button should appear. Get a message while you're up
  and the badge should count it.
- Open a brand-new chat for the sticker.

## What NOT to do yet

- Don't re-implement these three. They're done on web; review them instead.
- Keep the sizes and thresholds identical to mobile. If one changes, change
  `src/utils/emoji.js` and `mobile/src/lib/emoji.ts` and the theme's `EMOJI_SIZES`
  together.
