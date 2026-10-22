---
date: 2026-10-18T13:18:06+05:30
author: vishwajeet
phase: "6B"
block: "V-C"
for: neeraj
title: "Web fixes in your files: calm send tick, dropdowns, avatar menu"
---

# Web fixes in your files: calm send tick, dropdowns, avatar menu

## ⚠ I edited `frontend/` (yours): `Messages.jsx`, `onboarding.jsx`, `Dashboard.jsx`

Vishwajeet found these while testing and asked for them on web as well as the app. Please
review rather than re-implement. They are small diffs, and nothing else in those files changed.
`npm run build` passes. I haven't checked them in a browser.

### 1. `Messages.jsx`: a queued send turns into ticks without its bubble moving

Repro: stop the backend, send D, E, F (they show the clock, then ⓘ), start the backend. Just
before the ticks appeared, each bubble flickered or shifted. Two causes:

- **The key changed.** Bubbles were keyed by `msg.id`, which is the `local-…` tag until the
  server row arrives. The new id remounted the bubble.
- **The time changed.** The server's `created_at` is when the backend came back, not when the
  student typed. The clock label changed, and so did `isGroupedWith` against the previous
  message. That changes `runStart`/`runEnd` (spacing and tail), so neighbours moved too.

The fix is the same as mobile's (`mobile/src/lib/messages.ts`):

- **`adoptServerRow(local, incoming)`:** when the server row takes over a bubble sent from this
  page, it keeps that bubble's `client_tag` and `created_at`. `mergeServerMessage` uses it on
  both swap paths, and so does the Realtime UPDATE handler. Without that, a read tick would
  throw them away.
- **`messageKey(msg)`** = `client_tag || id` is the React key, and also what `openingIdsRef`
  is checked against. Because the bubble no longer remounts, the two
  `openingIdsRef.current.add(<server id>)` calls are gone. They only existed to stop a remount
  from replaying the entrance.
- **The time shown on screen is the time it was typed**, as WhatsApp does. The other person,
  and this page after a reload or a chat switch, see the server's time.
- `mergeServerMessage(list, row, clientTag)`: if Realtime already inserted the row by id, the
  leftover placeholder for that tag is dropped.

### 1b. `Messages.jsx`: a failed message no longer disappears when the chat is reopened

Repro: stop the backend, send B, and wait about 75 s until it fails. Open another chat, then
come back: B was gone. Two causes:

- **Web only.** When `GET /history` failed, the `catch` set `messages` to `[]`, so the failed
  bubble went with the rest. It now sets the thread's own unsent messages (`unsentFor(chat)`).
  They belong to this conversation, so showing them can't mix two chats.
- **Web and mobile.** When history loaded again, an unsent bubble was dropped if **any** of my
  messages in the page had the same text. A test "B" nearly always matches an older "B". Now
  each new bubble records `sent_after_id`, the newest server message when it was typed
  (`newestServerId`). `unsentStillMissing(history, unsent)` lets only a matching message
  **after** that anchor count as "already on the server", and each one accounts for at most
  one bubble. That keeps the case the check was there for (a send that got through but lost
  its answer) without the false match. `sent_after_id` is client state only. It is never sent.

### 1c. `Messages.jsx`: failed messages resend by themselves; "Couldn't load this chat"

Vishwajeet's call on 18 Oct. **MESSAGES_SPEC §2 is updated** ("Sending again on its own" and
"Loading"), and §5 gains allowed difference #11.

- **`auto_retry`** on a failed bubble is `isRetryableSendError(error)` at give-up. True means
  the server couldn't be reached. A refusal (any other 4xx) is `false` and still needs a tap.
- **`waitingOnServer`**: while the open thread has an `auto_retry` failure, or
  `historyError`, it calls `GET /api/health`:
  - at once, then every `SERVER_PROBE_MS` (10 s);
  - again on `online` and `visibilitychange`;
  - one probe at a time, each given up after 10 s.

  On a 200, `onServerBackRef` reloads the history if it had failed, then `deliver()`s those
  messages in order. It only does this for the open thread.
- **`historyError`**: set by `handleSelectChat`'s `catch` and cleared when a chat opens. It
  draws `.historyError` (wifi-off circle, "Couldn't load this chat", Retry pill), a copy of
  mobile's `ChatState`, above the thread's unsent messages. It also hides the "beginning of
  your conversation" banner, because that isn't known while the history is missing.
- New `global.css` tokens: `--muted-text`, `--input-border-focus` (mobile's `mutedText`,
  `inputBorderFocus`).

### 1d. `Messages.jsx`: a long message's read tick no longer wipes its text

Found on the phone: a 2000-character message crashed the chat
(`jumboEmojiCount` on `undefined`) as soon as its delivered tick arrived. Web has the same code
path and would have thrown the same way. It just hadn't received such an update yet.

- **Why.** `messages` has the default replica identity. When an UPDATE changes only
  `is_delivered`/`is_read`, Postgres leaves out of the change record any unchanged column stored
  out of line (TOAST, roughly 2 KB and up). In the local DB the three 2000-character rows are in
  `pg_toast`; the short ones aren't. So Realtime's `payload.new` arrives without `content`, and
  the handler swapped it in whole.
- **Fix.** `withLeftOutColumns(local, updated)` fills any column the update left out from the
  row on screen, then goes through `adoptServerRow` as before. Mobile has the same helper in
  `replaceMessage`. Its restored cache also drops any row that already lost its text, then marks
  the chat stale so the history load brings the row back.
- **Not chosen:** `REPLICA IDENTITY FULL` on `messages` would make Postgres send every column on
  every tick. That means a migration and more WAL for something the client can do itself.

### 1e. `Messages.jsx`: a very long message can now be marked read

Found on the phone: in one chat the other person never got blue ticks, and the inbox badge
stayed at 2 after the chat was read. The two unread rows were 2000-character messages
(`is_read = false` in the DB, while every shorter message around them was read). A message
counted as seen once half of **it** was on screen. A bubble taller than twice the thread can
never be half on screen, so it was never read. The phone's thread is short enough for that. Your
web pane mostly isn't, but a small window would be.

- **Web:** `flushVisibleRead` now divides the shown pixels by `min(row height, thread height)`.
  A row counts once half of it is visible, or once it fills half the thread. Rows shorter than
  the thread are judged exactly as before.
- **Mobile:** two viewability configs, `SEEN_BY_ROW` (50% of the row) and `SEEN_BY_THREAD`
  (50% of the thread). A row needs only one of them.
- **MESSAGES_SPEC §2 "Unread behaviour"** is updated, with a §0.2 row.

### 1f. `Messages.jsx`: switching chats puts the cursor in the composer

An effect on `activeChat`'s `contact_id`/`product_id` focuses `chatInputRef`
(`preventScroll`), so you can type as soon as a chat opens. It applies on `(pointer: fine)`
screens only. On touch it would raise the keyboard over the thread, which is also why the app
doesn't do it.

### 2. `onboarding.jsx`: an Edit Profile dropdown showed only the current value on the first click

`SearchableSelect`'s `onFocus` puts the chosen label into the search box, so it can be edited
with Backspace. The same text then filtered the menu down to that one option. Clicking again
closed and reopened the menu, which cleared the text, so the full list showed. Now
`seededLabel` remembers what was put there, and `filterOption` shows every option while the box
still holds exactly that. The first keystroke or delete filters as before. Fresh onboarding
never had this, because there is no value to put in the box.

### 3. `Dashboard.jsx`: the avatar pencil menu closes on an outside click

`Avatar` has refs on the pencil and the menu. While the menu is open, a `pointerdown` anywhere
else closes it, and so does Escape. The pencil still toggles it.

## Mobile (mine), for the record

- The same send fix, plus a real ordering bug: `useSendMessage.onSuccess` removed the
  placeholder and *appended* the server row, so D jumped below the still-queued E and F. It now
  swaps in place. The retry guard checks `id === clientTag` instead, because the adopted row
  also carries the tag.
- Edit Profile has the avatar row from onboarding, and the dashboard's Change/Remove sheet when
  a photo is already set.
- `AvatarSheet`: the dark scrim shows at once. Only the sheet slides up.

## Local seed: production's courses and specializations

`supabase/seed.sql` now seeds the **production** lists (80 courses, 348 specializations,
copied by name on 18 Oct), not the old 5 + 5 stub. The local dropdowns now behave like the
live ones: long lists, search, scrolling.

- **After your next `supabase db reset`:**
  - `B.Tech`, `M.Tech`, `B.Des`, `MBA`, `PhD` and `Design` are gone. Production has none of
    them; its names are like `B.Tech/BE (Bachelor of Technology/Bachelor of Engineering)`.
  - The seeded test users now point at that B.Tech/BE course, with Computer Science and
    Engineering as their specialization.
- **The fixed `c0…` / `d0…` ids are gone too.** Nothing referenced them. Look a row up by name.
- Seed only. Production isn't touched, and no migration changed.

## Migrations applied

None.

## New endpoints

None.

## Changed endpoints (BREAKING)

None. No backend file changed.

## New fields on existing responses

None. `client_tag` on a sent row is client state only, never sent to the server.

## Test data

- `npm run build` (web) and `npx tsc --noEmit` (mobile) pass.
- I compiled mobile's `mergeMessage` / `replaceMessage` and ran the D/E/F case through it.
  D landed via HTTP. E landed via Realtime, then its HTTP response. F landed, then got a read
  tick. Order, keys and typed times were unchanged throughout, with no duplicates. The web
  helpers are line-for-line twins of these.
- Nothing was checked in a browser or on a phone.

## What NOT to do yet

- Don't key chat bubbles by `msg.id` again. Use `messageKey(msg)`.
- Don't swap `payload.new` in raw on UPDATE. Go through `withLeftOutColumns` and
  `adoptServerRow`. Without them a read tick brings the flicker back, or wipes a long message's
  text. This applies to any other table you listen to UPDATEs on: a long text column there will
  be missing too.
- When you build the §10 delete-for-everyone choice: a bubble sent from here shows its typed
  time, which can be earlier than the server's. A client-side 60-minute check on it is
  conservative, never generous, and `DELETE_WINDOW_EXPIRED` from the server still decides.
