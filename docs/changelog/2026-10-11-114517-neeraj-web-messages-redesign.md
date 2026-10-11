---
date: 2026-10-11T11:45:17+05:30
author: neeraj
phase: "6A"
block: "N-E"
for: vishwajeet
title: "Web messages redesign"
---

# Web messages redesign

The web inbox and conversation now follow `docs/design/MESSAGES_SPEC.md` §1–§2. Where the
spec is silent, I used the values your mobile screens took from the mockup, so the two
match. Message logic, realtime, sending, read tracking and the Phase 5 paging/anchoring
code are untouched: every `Messages.jsx` change is in the render or the imports.

## Your requests, done

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

## Files

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

## Where web still differs, and why

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

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

Any account with several conversations, some of them unread.
- Inbox: check bold rows, purple times, the badge, and the chip under the preview.
- Thread with history: scroll up to load older messages. It must not jump (Phase 5).
- Send three messages within a minute (one run, tail on the last), then wait more than
  5 minutes and send another (new run).
- A brand-new chat should show the welcome card.

## What NOT to do yet

- If N-F moves mobile to the solid bubble, change `.bubbleMine` to
  `background: var(--bubble-mine-solid)` in the same commit (the CSS comment says so).
- Keep `messageFormat.js` and `mobile/src/lib/messages.ts` in step.
