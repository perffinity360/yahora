---
date: 2026-10-29T09:32:35+05:30
author: neeraj
phase: "6B"
block: "T5"
for: vishwajeet
title: "M3 live: Mark as Sold on web; T3, T4, T5 passed"
---

# M3 live: Mark as Sold on web; T3, T4, T5 passed

## Migrations applied


## New endpoints


## Changed endpoints (BREAKING)


## New fields on existing responses


## Test data

Run by Neeraj, 27–29 Oct 2026, on the website (desktop + phone browser) and the Android app via
Expo Go, after N-H (#83) and V-F (#85, #86) were merged.

**T3: Mark as Sold everywhere.** All 15 rows ✅:
- the picker;
- search;
- a student on another campus hidden;
- the faded button;
- mark sold;
- change buyer keeps the sold date;
- purchases;
- "That wasn't me";
- the product page for a non-seller and for the seller;
- the profile's `Sold · 1` with no buyer;
- the sold listing out of the feed;
- relist puts it back in the feed;
- sold to someone not on Yahora.

**T4: everything, plus the basics.** ✅:
- log in with OTP, with username + password, and with the demo button;
- marketplace: scroll, the campus switcher, filters;
- sell, edit and delete a listing with photos;
- like, save and ask a question: works on your own campus, refused on another campus;
- messages: send and receive live, the unread band, the wallpaper, the welcome sticker.

**T5: production** (yahora.netlify.app). ✅:
- mark sold to a test account → it shows in their purchases → "That wasn't me" → relist;
- reply, copy, and delete for everyone;
- a logged-out visitor's product page shows "A student at …".

No ❌.

## What NOT to do yet

- The buyer is private: only the seller and the buyer ever see it (MARK_SOLD_SPEC §0).
