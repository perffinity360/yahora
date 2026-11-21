---
date: 2026-11-21T10:50:13+05:30
author: neeraj
phase: "7"
block: "TF"
for: vishwajeet
title: "Text formatting: website and app chat (TF)"
---

# Text formatting: website and app chat (TF)

## Migrations applied


## New endpoints


## Changed endpoints (BREAKING)


## New fields on existing responses


## Test data


## What NOT to do yet

## Live

- Website: formatting while typing (overlay), shortcuts (Cmd/Ctrl+B, I,
  Shift+X, Shift+M; on Mac also Ctrl+Shift+M), the selection bar, paste fixes
  (Google Docs, Yahora itself), screenshot paste in the post composer, Copy
  text / Copy link in the post menu, a rainbow-ring counter, and the chat's
  2,000 limit (nothing cut).
- App chat: formatting while typing; while text is selected, one combined bar
  above the keyboard: B · I · S · code · mono | Cut · Copy · Paste. Android's
  own selection menu is hidden on these inputs, because it covered any bar
  placed near the selection. Code and mono never nest.
- Round W passed on laptop Chrome; round A1 passed on the OPPO.

## For you

- V-E can start from main.
- Please run round A1 on the POCO and the Samsung (about 10 minutes each).
- When you next merge main into a branch, keep the newer version of
  docs/runbooks/PHASE_7_RUNBOOK.md and frontend/CLAUDE.md, and keep both
  sides' lines in mobile/CLAUDE.md.
