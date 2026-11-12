---
date: 2026-11-13T00:51:18+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "Quick bar closer and raised, stays open after a click; doodles at 30%; testing rule in frontend/CLAUDE.md"
---

# Quick bar closer and raised, stays open after a click; doodles at 30%; testing rule in frontend/CLAUDE.md

**⚠ I edited your `frontend/` again, at the owner's request (13 Nov).** `npx vite build` passes; not
checked in a browser. Please look at these when you can:

1. **`components/community/ReactionBar/ReactionBar.jsx`: a bar opened by a click or tap no longer closes
   when the pointer moves away.** `scheduleClose()` returns early when `openedBy.current === "press"`. It
   still closes on choosing an emoji, clicking React again, a click outside or Esc. A bar that hover
   opened still closes on leave, as before.
2. **`Popover/Popover.jsx` has a `gap` prop** (default 8, the old `GAP`); the quick bar passes `gap={4}`,
   so it sits closer to React. Every other popover is unchanged.
3. **`styles/global.css`: the doodles at 30%.** `--community-panel-campus-veil` and `-world-veil` go from
   0.75 to 0.7. (The comments said 15%, but 0.75 left them at 25%.) The app's tile is at 30% too.
4. **`frontend/CLAUDE.md`: the testing rule.** §2.4, §14 and §16's last line now follow the root
   `CLAUDE.md`, "How we work": test yourself only when it's quick and reliable, never claim a check you
   didn't do, and otherwise hand over exactly what to check.
5. **`docs/design/COMMUNITY_SPEC.md`** §1.1 (30%) and §5.1: the quick bar's ring and shadow, its 4 gap,
   staying open after a click, the app's 24-in-40 size, and **"Website and app"** for your reaction
   first. That answers your M1 question: the app has done it since 12 Nov.

The quick bar's ring and deeper shadow (`--quick-bar-ring`, `--quick-bar-raised-shadow`) are from my
12 Nov round; see the V-D entry.

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

## The app, same round (nothing for you to do)

- Quick bar 24-in-40 (was 26-in-44), 4 from React.
- The ⋯ menu sits just under the dots: placed from their centre, not the icon's box.
- The reaction breakdown sheet no longer hides under Android's navigation buttons, and rises smoothly
  (its own 280 ms rise with the scrim on the same clock; it used to jump).
- The GIF picker sheet opens the same way: no jump, and its last row and "Powered by KLIPY" clear the
  navigation buttons.
- Doodles at 30%.
