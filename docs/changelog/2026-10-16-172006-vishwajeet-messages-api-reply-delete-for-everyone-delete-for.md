---
date: 2026-10-16T17:20:06+05:30
author: vishwajeet
phase: "6B"
block: "V-C"
for: neeraj
title: "Messages API: reply, delete for everyone, delete for me"
---

# Messages API: reply, delete for everyone, delete for me

The backend half of MESSAGES_SPEC §10. The website builds its Reply and Delete against this. It
is built on the V-B migration `message_actions`, so run `supabase db reset` first if you
haven't since V-B.

Files: `backend/src/modules/messages/messages.controller.js`, `messages.routes.js`,
`backend/API.md`. Nothing else changed: not `markAsRead`, not `markAsDelivered`, not
`getInbox`, and not products or share, which are on loan to you.

Contract of record: `backend/API.md` → messages, starting at "The four message-action fields
(Phase 6B)".

## Migrations applied

None. The database side is V-B (`20261016061043_message_actions.sql`), already on production.

## New endpoints

Both use `requireAuth`, and the actor is always the token holder. Neither takes a body.

| Route | 200 | Errors |
|---|---|---|
| `POST /api/messages/:id/delete-for-everyone` | `{ "message": <tombstone row> }`: same row, `content: ""`, `deleted_at` set. Repeating it returns the same tombstone | 400 `INVALID_FORMAT` (`:id` not a uuid) · 403 `NOT_MESSAGE_SENDER` · 403 `DELETE_WINDOW_EXPIRED` (over 60 min) · 404 `MESSAGE_NOT_FOUND` (no such message, **or** you're not one of its two people) |
| `POST /api/messages/:id/delete-for-me` | `{ "id": "<the id>", "hidden": true }`. Repeating it is fine | 400 `INVALID_FORMAT` · 404 `MESSAGE_NOT_FOUND` |

Map to the spec's UI: `DELETE_WINDOW_EXPIRED` → toast "It's too late to delete this for
everyone" (§10.8).

## Changed endpoints (BREAKING)

**None are breaking for the current website.** What changed:

- **`POST /api/messages/send`:**
  - New optional `reply_to_id` (uuid or `null`). **Send only the id.** The database fills
    `reply_to_sender_id` and `reply_preview`, and overwrites anything you send for them.
  - Empty or whitespace-only `content` → 400 `MISSING_FIELDS`. The website already refuses
    these (`!newMessage.trim()` in `Messages.jsx`).
  - **`content` over 2000 characters → 400 `INVALID_FORMAT`.** This is the spec §2 limit.
    Both composers now enforce it, so a normal client never gets this error (see "I edited
    `frontend/`" below).
  - `receiver_id` or `product_id` missing or not a uuid → 400 `INVALID_FORMAT`, where it used
    to be 500. A `reply_to_id` that isn't a uuid → 400 `INVALID_FORMAT`. A reply into another
    conversation, or to a deleted-for-everyone message → 400 `REPLY_TARGET_INVALID`.
  - **The listing was deleted → 404 `NOT_FOUND`, "That listing no longer exists."** It used
    to be 500. It mirrors the existing "That student no longer exists." for a missing
    receiver.
  - **Every 500 is now `{ "error": "INTERNAL_ERROR", … }`.** The old
    `{ "error": "Failed to send message." }` body is gone. Branch on `error`.
  - **Every 4xx from `/send` is permanent**, so resending the same body gets the same answer.
    Only a 5xx or a network failure is worth retrying.

## ⚠ I edited `frontend/` (Neeraj's): `Messages.jsx`, `Messages.module.css`, `global.css`

Vishwajeet asked for these fixes on both web and app, so I made them here rather than leaving
them as a request:

1. **`MAX_MESSAGE_LENGTH = 2000`** (next to `READ_VISIBLE_RATIO`) and
   **`maxLength={MAX_MESSAGE_LENGTH}`** on the composer `<textarea>`. Spec §2 says "up to
   2000 characters", and mobile already had it. A long paste is now cut at 2000 by the
   browser, the same way the phone does it.
2. **`handleEmojiClick` won't push past the limit.** `maxLength` only limits typing and
   pasting; text set from code skips it. An emoji that wouldn't fit is refused whole, not cut
   in half. Mobile got the same guard.
3. **Optimistic send with the spec §2 failed bubble.** This is the same model as mobile's
   `useSendMessage`. Before, a refused or failed send just vanished, because the box was
   cleared and the error ignored.
   - **`handleSendMessage`** builds a placeholder (`id` = `client_tag` = `local-…`) and calls
     **`deliver()`**. The bubble shows at once with a clock.
   - **On success**, the server row replaces it (`mergeServerMessage`).
   - **Automatic retry** (`sendWithRetries`), for no answer (or none within
     `SEND_TIMEOUT_MS`, 15 s), 401, 408, 429 and 5xx: tries again after 2, 4, 8, 16 and 30 s,
     keeping the clock. While offline it waits for the `online` event and uses up no tries.
     Any other 4xx fails at once. Sends in one conversation go one at a time, in order
     (`sendQueueRef`).
   - **Only after that** is the bubble dimmed to 0.72 with a white ⓘ tick, and the pill
     "Failed to send" sits under it. The pill is a `<button>`, so it gets keyboard focus and
     `aria-label`. Tapping it calls **`handleRetry()`**: same bubble, same text, a new retry
     cycle.
   - **No double post on a lost answer:** if Realtime brings the message in while a retry
     waits, the Realtime handler removes it from `unsentRef`, and the loop stops.
   - **The Realtime INSERT handler** now goes through `mergeServerMessage`. If my own INSERT
     arrives before the HTTP response, it replaces the pending bubble instead of adding a
     second one.
   - **`unsentRef`** keeps pending and failed messages per thread. Switching chats doesn't
     lose them; `fetchHistory` adds them back unless the server already has the same text
     from me (mobile's rule).
   - `openingIdsRef` gets the server id when a placeholder is swapped, so the bubble doesn't
     slide in twice.
   - New tokens in `global.css`, twins of mobile's: `--chat-failed-tick`, `--error-bg`,
     `--error-text`. New classes: `.bubbleFailed`, `.tickFailed`, `.retryPill`, with hover,
     active, focus-visible and reduced-motion states.
   - The `restoreDraft` stopgap from earlier today is gone. The failed bubble replaces it.

`npm run build` passes. I haven't checked it in a browser; please do when you pull.

## Mobile (Vishwajeet's): automatic retry, and why "tap to retry" looked broken

- **Automatic retry, the same rules as web.** `useSendMessage` has `retry`/`retryDelay`
  (5 retries: 2, 4, 8, 16, 30 s; only for retryable errors) and `scope` (one send at a time
  per conversation). It uses `networkMode: 'online'`, with TanStack's online state wired to
  NetInfo in `app/_layout.tsx`, so an offline send waits without using up tries. Every other
  query and mutation is pinned to `networkMode: 'always'` and `refetchOnReconnect: false`,
  exactly as they behaved before.
- **Before each retry**, if the bubble is no longer waiting (Realtime swapped the real row
  in), it returns `{ message: null }` instead of posting again.
- **Each try times out after 15 s** (`SEND_TIMEOUT_MS`, an `AbortController`; `api.post`
  takes an optional `signal`). fetch has no timeout of its own, so a send on a connection
  that went quiet showed its clock indefinitely.
- **Metro logs every step:** `[send] try N failed (…); retrying in Ns`, and
  `[send] gave up (local-…): <reason>`. `onError` used to throw the error away, so a failure
  told you nothing.
- **The pill now reads "Failed to send"**, and the ⓘ tick is white (`colors.chatFailedTick`
  = `#FFFFFF`; it was `#F87171`). MESSAGES_SPEC §2 and §3 are updated to match.
- **A message still sending when the app closed now comes back as failed**, with its pill
  (`markUnsentAsFailed` in `app/_layout.tsx`, run after the saved cache is restored). It used
  to come back as a clock with nothing to tap.
- **`GET /api/messages/history`:** messages **you** hid are left out (the other person still
  gets them). `next_cursor` is still computed from the unfiltered page, so **a page can hold
  fewer than `limit` items, even zero, while `next_cursor` is set.** Keep paging until
  `next_cursor` is `null`. Never treat a short page as the end.

## New fields on existing responses

On every message row (`/send` 201, `/history` items, Realtime payloads):

| Field | Meaning |
|---|---|
| `reply_to_id` | The message this one replies to, or `null` |
| `reply_to_sender_id` | Who wrote the quoted message. **Non-null = this message is a reply** — use this, not `reply_preview`, to decide whether to draw a quote |
| `reply_preview` | The quoted message's first 200 characters. `null` on a reply means the original was deleted for everyone → draw "Original message was deleted", italic, not tappable |
| `deleted_at` | Set = tombstone (`content` is `""`). Draw "You deleted this message" / "This message was deleted", no ticks |

On inbox rows (`GET /api/messages/inbox/:userId`):

| Field | Meaning |
|---|---|
| `last_sender_id` | Who sent the last message you can see. Your own id → "You: …" (§10.9) |
| `last_message_deleted` | The last visible message is a tombstone; `last_message` is `""` |

Messages you hid are skipped by the inbox. If you hid every message in a conversation, it
leaves your inbox until a new message arrives.

## Test data

Seeded users (password `password123`): `arjun.mehta`, `priya.nair`, `rahul.verma`. The Wacom
thread is listing `e0000000-0000-4000-8000-000000000004`.

All 11 checks in runbook V-C passed against the local API on 16 Oct:

1. A reply to `f…06` → `reply_to_sender_id` = Priya, `reply_preview` "Works for me, I will
   wait at the hostel gate."
2. A reply to `f…08` (another thread) → `REPLY_TARGET_INVALID`
3. `"   "` → `MISSING_FIELDS`
4. Priya sends → a uuid
5. Arjun deletes it for everyone → `NOT_MESSAGE_SENDER`
6. Priya deletes it for everyone → `content: ""` with `deleted_at` set
7. Priya on the days-old `f…06` → `DELETE_WINDOW_EXPIRED`
8. Arjun hides `f…05` for himself → `{"id":"f…05","hidden":true}`
9. Arjun's history `grep -c f…05` → 0
10. Priya's history → 1
11. Priya's inbox has `last_sender_id` and `last_message_deleted` (`true`)

Six more checks, all as `API.md` says:
- 2001 characters → `INVALID_FORMAT`.
- `reply_to_id: "nope"` → `INVALID_FORMAT`.
- `reply_to_id: null` sends a plain message with `content` stored untrimmed.
- `:id` = `not-a-uuid` → `INVALID_FORMAT`.
- Rahul (not in the thread) on either route → `MESSAGE_NOT_FOUND`.
- No token → 401.

## What NOT to do yet

- Realtime: a delete-for-everyone arrives as an UPDATE with `deleted_at` set. The replies
  that quoted it arrive as UPDATEs with `reply_preview` null. A delete-for-me sends NO
  Realtime event at all (that is the point), so remove the message locally after the 200.
  - The website already listens for UPDATE on `messages` (`Messages.jsx:1400`), and the
    handler swaps in the whole `payload.new`. So tombstones and wiped quotes already reach
    state today. Only the rendering is missing: until §10 is built, a tombstone draws as an
    empty bubble.
- Don't decide "is it too late to delete for everyone?" from a client clock as the rule. Use
  `DELETE_FOR_EVERYONE_MINUTES` only to decide whether to show the choice, and handle
  `DELETE_WINDOW_EXPIRED` when the server says so.
- Don't send `reply_to_sender_id` or `reply_preview`. They're overwritten.
