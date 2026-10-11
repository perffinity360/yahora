---
date: 2026-10-11T11:24:28+05:30
author: neeraj
phase: "6A"
block: "N-D"
for: vishwajeet
title: "Web chat wallpaper"
---

# Web chat wallpaper

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

If the tile is ever regenerated, copy it to `frontend/public/patterns/` in the same commit as
the mobile PNGs (spec §4) — the web copy is now a real file that can drift.
