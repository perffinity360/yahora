---
date: 2026-11-21T06:15:40+05:30
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

- Website: WhatsApp-style formatting while typing (overlay), shortcuts
  (Cmd/Ctrl+B, I, Shift+X, Shift+M — on Mac also Ctrl+Shift+M), the selection
  bar, paste fixes (Google Docs, Yahora itself), screenshot paste in the post
  composer, Copy text / Copy link in the post menu, a rainbow-ring character
  counter, and the chat's 2,000 limit (nothing cut).
- App chat: formatting while typing, and a combined bar above the keyboard
  while text is selected: B · I · S · code · mono | Cut · Copy · Paste
  (Android's own selection menu is hidden on the chat box, because it covered
  any bar placed near the selection). Code and mono never nest.
- Round W passed on laptop Chrome; round A1 passed on the OPPO.

## For you

- V-E can start from main now.
- Please run round A1 on the POCO and the Samsung (about 10 min each).
- I filed the "Ownership loan: app text-formatting files to Neeraj" entry
  myself (17 Nov) — please confirm you agree with it.
- The app's chat counter should become the rainbow ring too (spec §5), and the
  app counter is a later follow-up if it still shows a plain number.
