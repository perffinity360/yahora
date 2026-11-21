---
date: 2026-11-17T14:19:23+05:30
author: neeraj
phase:
block: "TF"
for: vishwajeet
title: "Ownership loan: app text-formatting files to Neeraj"
---

# Ownership loan: app text-formatting files to Neeraj

**Agreed with Vishwajeet (owner's word, 17 Nov). Written by Neeraj's session.**

**What is lent**, to Neeraj, for the text-formatting block (TF, `docs/design/TEXT_FORMAT_SPEC.md`):

- `mobile/src/components/FormattedInput.tsx` (new)
- `mobile/src/components/FormatToolbar.tsx` (new)
- `mobile/app/chat/[contactId].tsx` (the chat box only)
- `mobile/src/lib/textFormat.ts` (the website's `frontend/src/utils/textFormat.js` twin)
- `mobile/src/components/FormattedText.tsx`
- `mobile/src/theme/index.ts`

**Added for TF-8 (21 Nov), the app's community formatting:**

- `mobile/src/components/community/PostText.tsx` (post and reply text, through FormattedText)
- `mobile/src/components/community/PostActions.tsx` (the ⋯ menu: Copy text, Copy link)
- `mobile/app/compose.tsx` (the composer and reply box: FormattedInput and the selection tools)
- `mobile/src/lib/share.ts` (a new `WEBSITE_URL` export) and `mobile/.env.example`
  (`EXPO_PUBLIC_WEBSITE_URL`, commented)

**Until:** `v-text-formatting` merges into `main`. The entry that reports that merge hands them back.

**The rules:**

1. Vishwajeet doesn't edit these files until then. If he must, he says so in his changelog entry and
   Neeraj merges.
2. Neeraj **doesn't change any `OWNER:` banner**. This entry is the record of the loan.
3. Nothing else in `mobile/`: not `app/post/[id].tsx`, `app/(tabs)/community.tsx`, nor any other file in
   `src/components/community/` than the two named above.
4. No new libraries in `mobile/package.json`.

**Already done before this entry:** `mobile/src/lib/textFormat.ts` got double symbols and
`formatSpans` in commit `88b2ea0` (TF-2), kept line for line with the website's twin. That edit came
before the loan was written down; it is covered from here on.

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

Don't edit the files above in `mobile/` until `v-text-formatting` is merged.
