---
date: 2026-10-04T18:43:15+05:30
author: vishwajeet
phase: "6A"
block: "V-C"
for: neeraj
title: "Chat: emoji sizing, jump-to-latest, welcome sticker"
---

# Chat: emoji sizing, jump-to-latest, welcome sticker

Three additions to the conversation screen, asked for after comparing it with WhatsApp and
Telegram. They're live on mobile now. **The web needs the same three, with the same
numbers, below.** None of them is in `MESSAGES_SPEC.md` yet. It's your file, so I haven't
edited it; please add a short §2 subsection for each so the spec stays the record.

## 1. Emoji sizing (WhatsApp-style)

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

## 2. Jump to latest

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

## 3. Welcome sticker (Telegram-style)

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

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

Any conversation. Send `👍` alone, then `🤔😋`, then `😂😂😂`, then `Emoji on 😂🔥`.
Scroll up in a long thread and have someone message you. Open a brand-new chat for the
sticker.

## What NOT to do yet

- ⚠️ **I added files under `docs/design/assets/`** (a new `welcome-sticker/` folder). I
  didn't touch any existing file there.
- Don't use a different emoji regex or different sizes on web. The two platforms would
  disagree on which messages go jumbo.
- Tapping the sticker does nothing yet. Telegram sends it as a greeting, but we have no
  sticker message type; that would be a product decision.
