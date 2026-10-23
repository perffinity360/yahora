---
date: 2026-10-24T01:06:17+05:30
author: vishwajeet
phase: "6B"
block: "V-FIX"
for: neeraj
title: "sendMessage refuses messages to yourself"
---

# sendMessage refuses messages to yourself

`POST /api/messages/send` used to accept a `receiver_id` equal to the sender. That made a
conversation with yourself whose unread badge never cleared. The website now hides the button,
but the API has to refuse it for every caller, including old clients and hand-made requests.

Files:
- `backend/src/modules/messages/messages.controller.js` (mine).
- `backend/API.md`.
- `docs/runbooks/PHASE_6B_RUNBOOK.md` Appendix B.

Nothing in products, share, `frontend/` or `mobile/` changed.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

### `POST /api/messages/send`: new `400 CANNOT_MESSAGE_SELF`

```json
{ "error": "CANNOT_MESSAGE_SELF", "message": "You can't message yourself." }
```

- **When:** `receiver_id` is the token holder. The comparison ignores case, so an upper-case
  copy of your own id is refused too. Postgres would have treated it as the same uuid.
- **Order:** the check runs after the `MISSING_FIELDS` check and the `receiver_id` /
  `product_id` `INVALID_FORMAT` check, and before any database call. So a request with
  empty `content` and your own id still gets `MISSING_FIELDS`.
- **It's a permanent 4xx**, like every other 4xx from `/send`. The web retry loop
  (`sendWithRetries`) already fails a non-retryable 4xx at once, so a self-send would show
  the failed bubble and never retry. With the button hidden, the web shouldn't reach this.
- **Breaking only for a client that sent messages to itself.** No screen should do that.

## New fields on existing responses

None.

## Test data

Run on 24 Oct against the local API and local database, as `arjun.mehta` / `password123`, on
the Wacom listing `e0000000-0000-4000-8000-000000000004`:

- `node --check` on the controller passes.
- Arjun to Arjun (`b0…001`): `400 {"error":"CANNOT_MESSAGE_SELF","message":"You can't message yourself."}`.
- Arjun to `B0…001` (upper case): the same 400.
- Arjun to Priya (`b0…002`): `201`, with the full message row.
- In the local DB, `select count(*) from messages where sender_id = receiver_id` returns `0`.
  I deleted the test message to Priya afterwards.

## What NOT to do yet

- **This doesn't remove existing self-conversations.** Production may still have rows where
  `sender_id = receiver_id` from before this fix. Clearing them would be a database change,
  which is mine to do. Tell me if you see one in your inbox.
