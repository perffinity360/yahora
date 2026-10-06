---
date: 2026-10-04T17:20:10+05:30
author: vishwajeet
phase: "6A"
block: "V-C"
for: neeraj
title: "Mobile messages redesign"
---

# Mobile messages redesign

Both mobile messages screens now implement `docs/design/MESSAGES_SPEC.md` §1 and §2. This
is presentation only: data fetching, pagination, realtime, sending, mark-read and
navigation are unchanged. Where the spec is silent, I used the mockup's layout values
(`messages-mockup.html`), and where the mockup is silent too, I kept the current
behaviour. The full list is below so web can match it.

## What changed on mobile

- **Inbox** (`mobile/app/(tabs)/messages.tsx`):
  - App canvas, header with title and "N unread conversation(s)" subtitle, filter field
    restyled.
  - Rows have no card. The divider starts at the text column (left 76). Unread rows use
    weight 800/700/500 plus a gradient badge (99+).
  - The product chip is the spec's text chip, 5 below the preview. The thumbnail is gone.
  - Skeleton rows on load (avatar plus two bars). The row is memoized.
- **Conversation** (`mobile/app/chat/[contactId].tsx`):
  - White header: purple chevron, 36 avatar, name in Inter 600 16, and a status line
    reading `<University> · online`.
  - The product snippet sits on its own white strip: pinkLight pill, 30×30 thumbnail.
  - Bubbles per spec: 78% of the thread width, capped at 520. Gaps are 2 inside a run and
    8 between runs. Text is 14/20. Received bubbles are white with a hairline border.
  - Meta row: Inter 500 11, white 90% on sent bubbles.
  - Ticks: read is **amber** `chatReadTick`; failed is `#F87171`.
  - Composer: white bar, `inputBg` pill with no border, placeholder `Message`, 40 send
    button.
- **Sent bubble:** `SENT_BUBBLE_STYLE` in `mobile/src/theme`. `'gradient'` = purple →
  `bubbleMineEnd` via expo-linear-gradient. `'solid'` = `bubbleMineSolid`. The bubble row
  is memoized, and the gradient's props are module constants, so it never remounts. Both
  settings type-check and bundle. **It ships as `'gradient'`.**
- **Time formatting:** one set of calendar rules in `mobile/src/lib/messages.ts` drives
  both the inbox time (the §1 table) and the date-chip labels. The bubble time is now
  `4:41 PM` (it was `16:41`). Weekday and month names are fixed English tables, not
  `Intl`.
- **Runs:** the existing logic already matched the spec (same sender, same day, ≤ 5 min).
  It is unchanged except that it compares calendar days directly.
- **Tokens added:** spec §3's `bubbleMineEnd`, `bubbleMineSolid`, `chatReadTick` and
  `bubbleTheirsBorder` (`chatDateChip` and `chatUnreadBand` landed in V-B). Also seven
  tokens that only give names to rgba values §1/§2 already spell out: `messagesLine`,
  `messagesBarBorder`, `inboxFilterBg`, `inboxRowPressed`, `inboxProductChipBg`,
  `bubbleMineMeta`, `chatFailedTick`. No new values.
- **Removed:** the `inbox` and `chat` variants of `ScreenGradient`, and `inboxTop`,
  `inboxMid`, `inboxBottom`. Nothing else referenced them.

## Values the spec doesn't give (please match on web, or tell me to change)

- **Taken from the mockup:**
  - Inbox header padding is 8/16/12, with 2 above the subtitle.
  - Filter field: inner padding 14, gap 8.
  - Rows are vertically centred. Name and time share a baseline. The preview line sits 3
    below the name.
  - Chat header padding is 8/12 with a gap of 10.
  - The snippet strip has 6/12/8 padding and its own bottom border.
  - The thread has 10/12 padding.
  - Composer controls have a gap of 8.
- **Kept as they were:**
  - The online dot on avatars, in the inbox and the chat header.
  - The avatar beside the last received bubble of a run.
  - A meta row on **every** bubble. The mockup shows it only on the last bubble of a run,
    and the spec doesn't say.
  - Link colours inside bubbles. The failed-bubble opacity and the "tap to retry" pill.
  - The emoji button and tray.
  - The chevron on the snippet.
  - The placeholder colour (`mutedPlaceholder`).
  - The typing bubble.
  - Error states.
  - The "Start the conversation ✨" preview fallback, and "Item" when there's no title.
- **Under one minute the inbox shows `0m`.** That's the table read literally; say if you'd
  rather spec something else.

## Spec items mobile could not do (data, not design)

- **Product price in the snippet.** Neither the inbox rows nor the chat params carry a
  price. Omitted for now; it needs `product_price` added to the inbox response, which is a
  backend change and outside this block.
- **The `You: ` prefix.** The inbox rows don't say who sent the last message. This needs
  `last_sender_id` in the same response. Also omitted.
- **The 135° gradient is corner-to-corner** (expo-linear-gradient `{0,0}` → `{1,1}`). CSS
  `135deg` keeps a true 45° on a wide bubble. Matching that exactly would mean measuring
  every bubble, which costs frames — the thing N-F is about to measure. The end colour
  still lands in the bottom-right corner where the time and ticks sit, so the measured
  contrast holds.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None.

## New fields on existing responses

None. The price and `You:` items above would add two later, in a block of their own.

## Test data

Any account with a few conversations; the demo campus works. Check an unread row, a
conversation over 99 unread if you have one, and a thread spanning several days.

## What NOT to do yet

- **The mobile screens are ready for N-F.** Measure scrolling on the Samsung Galaxy A03s
  with `SENT_BUBBLE_STYLE = 'gradient'`, then `'solid'`. It's one line in
  `mobile/src/theme/index.ts`. Whichever wins ships on both platforms.
- Don't add the price or `You:` on web yet. Mobile can't show them until the inbox
  response carries the fields, and the two platforms mustn't differ.
- The unread band's timing is unchanged (only its look). The behaviour port is V-E.
