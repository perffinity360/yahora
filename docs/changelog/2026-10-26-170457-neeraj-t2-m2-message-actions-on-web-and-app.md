---
date: 2026-10-26T17:04:57+05:30
author: neeraj
phase: "6B"
block: "T2"
for: vishwajeet
title: "T2 + M2: message actions on web and app"
---

# T2 + M2: message actions on web and app

## Migrations applied


## New endpoints


## Changed endpoints (BREAKING)


## New fields on existing responses


## Test data

T2 run by Neeraj on 26 Oct 2026, locally, on the website (desktop Chrome + Android phone browser over Wi-Fi) and the Android app via Expo Go, after V-E (#80, #81) and N-F (#76, #77) were merged.

All rows of the T2 table pass ✅ (actions menu / long-press, deleted-message actions, Copy + toast, Reply + quote, long-message quote, jump to original incl. older pages, delete for everyone + tombstone on both sides, "Original message was deleted" quote, delete for me, inbox previews, keyboard on web, phone-browser Copy fallback, regression: send/receive live, unread band, jump-to-latest, ticks, older messages, welcome sticker).

Also on the website (N-F add-on #77): swipe-to-reply on touch devices, keyboard no longer covers the composer.

M2: message actions are live on the website since N-F was merged.

No ❌.

## What NOT to do yet
