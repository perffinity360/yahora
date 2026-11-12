---
date: 2026-11-12T20:10:10+05:30
author: vishwajeet
phase: "7"
block:
for: neeraj
title: "The owner's design standard in both DESIGN.md files; How we work in CLAUDE.md"
---

# The owner's design standard in both DESIGN.md files; How we work in CLAUDE.md

**⚠ I edited your `frontend/DESIGN.md`**, at the owner's request (12 Nov). Nothing else in `frontend/`
changed. Three documentation changes, no code:

1. **`frontend/DESIGN.md` now opens with "The standard: Web UI/UX excellence, design first, always"**, the
   owner's text word for word, and a short "How we work" section after it. Everything that was in the file
   is still there, below them. `mobile/DESIGN.md` got the app's twin of the standard.
2. **The root `CLAUDE.md` has a new "How we work" section**, for everyone on Yahora, which your sessions
   load too:
   - Handle execution and small, reversible design decisions yourself. Involve the owner only in
     decisions that could fundamentally or drastically change the product experience.
   - Use every skill and method that builds the thing better. The DESIGN.md files are guidance, not a
     cage: when you go beyond or against them, say so once beforehand, and update them if it turns out
     better.
   - Ownership, the database rules and this changelog protocol still hold.
3. **One overlap to know about, not yet decided:** both standards end with "inspect the actual rendered
   interface", but `frontend/CLAUDE.md` §2 and §14 still say verification is the human's job. Until the
   owner settles it, both rules stand as written.

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

- Not merged yet: these edits ride on `v-d-app-community`. If you edit the top of `frontend/DESIGN.md`
  or the root `CLAUDE.md` on your branch before it merges, expect a small conflict there.

## Two findings from the app that may matter on the website

- **The app's springy menus wobbled** (owner: "not good UX"). The app's quick bar, ⋯ menu, country
  dropdown and report form now open without overshoot; `mobile/DESIGN.md`, "Motion", has the rule. Your
  quick bar still uses `--community-spring`, and spec §5.1 says it "springs up". Worth a look on the
  website.
- **Menus anchored to a button were one status bar too high on Android**, because of how React Native
  measures; that one is app-only (`mobile/CLAUDE.md`, "A menu that hangs off a button").
