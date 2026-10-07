---
date: 2026-10-07T11:54:27+05:30
author: vishwajeet
phase: "6A"
block: "V-C"
for: neeraj
title: "Read tick colour: WhatsApp blue (final)"
---

# Read tick colour: WhatsApp blue (final)

The read tick (double check on a sent bubble) was the spec's pale amber `#FDE68A`. On the
phone it could hardly be told apart from the white delivered ticks next to it. It is now
**WhatsApp's read blue, `#53BDEB`, on both platforms**. The owner chose it after trying it
on the phone.

The filename still says "sunflower gold". That was this entry's first version, the same
day: gold `#FFD60A` was tried first, then replaced by blue.

## Contrast (WCAG method as spec §7; icons need 3.0)

| Background | Old amber `#FDE68A` | **Blue `#53BDEB`** |
|---|---|---|
| Bubble end `#C02B7F`, where the ticks sit | 4.33 | **2.53** ⚠️ |
| Bubble start `#800080` | 7.56 | 4.42 ✅ |
| Solid fallback `#9B1280` | 6.04 | 3.53 ✅ |

⚠️ The tick fails 3.0 on the bubble's pink end. **This was accepted knowingly.** The
owner preferred WhatsApp's familiar blue to a paler cyan. If it ever needs to pass, the
brand's `blueLight` `#6FE1FF` gets 3.57:1 there.

## Files

- `mobile/src/theme/index.ts`: `colors.chatReadTick = '#53BDEB'`.
- ⚠️ **I edited a file in your scope:** `frontend/src/pages/messages/Messages.module.css`.
  - `.tickRead` is now `#53bdeb`.
  - Its amber `drop-shadow` glow is removed. It existed to help the pale amber stand out,
    and mobile never had it.
  - Nothing else changed. Please review.
- `npx tsc --noEmit` and `npm run build` both pass.

## Spec

`docs/design/MESSAGES_SPEC.md` is yours, so I haven't edited it. Please update it:

- **§2 Ticks table:** Read → blue `#53BDEB`. Also replace the line "Amber, not blue, on
  both platforms" with the reason above.
- **§3 tokens:** `chatReadTick` and `--chat-read-tick` → `#53BDEB`.
- **§7:** the "Amber read tick on `#C02B7F`" row becomes "Blue read tick on `#C02B7F`",
  2.53, needs 3.0, marked accepted.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None.

## Test data

Any conversation where the other person has read your messages. Compare a read message's
ticks with a delivered one's, on the phone and on the web.

## What NOT to do yet

- Keep the two platforms on the same value. If it changes again, change
  `colors.chatReadTick` and `.tickRead` in the same commit.
