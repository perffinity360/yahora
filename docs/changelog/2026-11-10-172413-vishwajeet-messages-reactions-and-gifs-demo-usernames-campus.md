---
date: 2026-11-10T17:24:13+05:30
author: vishwajeet
phase: "7"
block: "V-C"
for: neeraj
title: "Messages: reactions and GIFs; demo usernames; campus countries (V-C)"
---

# Messages: reactions and GIFs; demo usernames; campus countries (V-C)

The backend half of reactions and GIFs in messages, demo `demo.` usernames, and a country on every
campus. You build the website half from this in Block N-E. Everything is backward compatible:
today's website and app keep working unchanged. `backend/API.md` Part 1 has the full contract;
the "(not built yet)" marks are gone.

**One request for your module (`user/`, which isn't mine):** in `user.controller.js`,
`classifyUnavailableUsername` answers `INVALID_FORMAT` when a real student asks for `demo.x`.
Before that final return, call `rpc('username_breaks_world_rule', { p_username, p_university_id:
the viewer's campus or null })` and return `'RESERVED'` when it's true. It also covers a demo account
asking for a plain name. Don't write the rule in JavaScript. (I made the same change to the copy in
`auth.controller.js`, so onboarding already answers `USERNAME_RESERVED`.)

## Migrations applied

None. The database side is V-B's four migrations, already on production.

## New endpoints

| Route | Answer | Errors |
|---|---|---|
| `PUT /api/messages/:id/reaction`, body `{ emoji }` | 200 `{ message }` — the whole row | 400 `INVALID_FORMAT` (bad id), `INVALID_EMOJI`, `MESSAGE_DELETED` · 404 `MESSAGE_NOT_FOUND` |
| `DELETE /api/messages/:id/reaction` | 200 `{ message }` | the same, without `INVALID_EMOJI` |

- One reaction per person: a new emoji replaces the caller's; removing one you don't have is fine.
- `emoji` is exactly one emoji (`isSingleEmoji`): `👍🏽` and `👨‍👩‍👧` are one emoji each; `hi`,
  `❤️❤️` and `''` are refused.
- Someone who isn't in the chat gets `404 MESSAGE_NOT_FOUND`, the same as a message that doesn't exist.

## Changed endpoints (BREAKING)

None break an existing client. Three behave differently:

- **`POST /api/messages/send`** takes an optional `gif`: `{ provider: 'klipy', id, url (https),
  preview_url? (https), width, height }` (positive integers). It's the same rule as a GIF in a post.
  Only those six keys are stored. With a GIF, `content` may be `''` or left out. A bad GIF is `400
  INVALID_GIF`, checked before anything else. A GIF sent as a JSON string is refused: send the object.
- **The 2000-character limit on messages now counts code points** (`[...content].length`, runbook
  §1.12), so an emoji counts as one. It used to count two, so some messages the composer allowed
  were refused. Count the same way in the website's composer.
- **`POST /api/auth/onboarding`:** a demo account's `username` is ignored and no longer required.
  It keeps its generated name. A real student asking for `demo.x`, `demo-x` or `demo_x` now gets
  `USERNAME_RESERVED` instead of `INVALID_FORMAT`, and their password isn't changed.

## New fields on existing responses

- **Message rows** (send, history, the reaction routes, Realtime): `reactions` — `{ "<user id>": "❤️" }`,
  `{}` when none — and `gif` (the object above, or `null`). A tombstone has `reactions: {}` and `gif:
  null`.
- **A reply quoting a GIF-only message** has `reply_preview: "GIF"`.
- **Inbox rows:** `last_message_has_gif` (boolean). A GIF-only message has `last_message: ""`, so show
  "GIF" for it.
- **`POST /api/auth/demo-login`:** `userProfile.username` is now set, for example `demo.sunny.otter`.
- **`GET /api/universities`:** each row has `country_code` (`"IN"`).

## Test data

- **`backend/scripts/seedDemo.js` runs again.** The personas are `demo.rahul.sharma`,
  `demo.priya_verma` and so on, the same names V-B gave them on production. The demo community has
  25 posts (10 campus, 9 India, 6 Global; 3 with photos), 18 replies between personas (a few by the
  post's author, so the author highlight shows), and 202 reactions. Re-running it is safe: it clears
  the demo campus's users first, and their posts, replies and reactions go with them.
- **On production:** not run yet. Vishwajeet will tell you when it has been.

## What NOT to do yet

- **A reaction arrives as a Realtime UPDATE of the message row (its `reactions` field). Merge it by
  id, exactly as for tombstones.**
- Don't send a username from the demo onboarding screen; it's ignored. The username step can be
  skipped for demo accounts.
- Don't fetch GIFs through our backend. KLIPY searches run from the browser (runbook §1.9); the
  backend only stores the description.

## Also in this block (backend only, nothing for you to do)

- **Re-check job, every 10 minutes:** posts whose moderation check couldn't run, oldest first, 20 a
  run. Publish → public; nudge → public and flagged; hold → stays pending, with the support card if
  it's self-harm. An OpenAI outage costs a post nothing. A missing photo counts a failure, and at 6
  the job stops trying, so the post waits for review.
- **Purge job, daily at 00:30:** posts deleted more than 90 days ago. Their photos are deleted from
  the `posts` bucket first, then the rows; replies and reactions go with them.
