/* Message actions — Reply, Copy, Delete. docs/design/MESSAGES_SPEC.md §10.
   The constants of §10.10: same names and values as mobile's
   src/lib/messageActions.ts. Change both in the same commit, and the SQL
   function delete_message_for_everyone too if the 60 changes. */

export const LONG_PRESS_MS = 250;
// Touch feedback on a bubble (§10.12), touch only. Android's tap timeout: a
// finger that starts a scroll within it never lights the bubble. A tap
// shorter than it still flashes once, on release.
export const PRESS_FEEDBACK_DELAY_MS = 100;
export const PRESS_FEEDBACK_IN_MS = 60;
export const PRESS_FEEDBACK_OUT_MS = 220;
export const SWIPE_REPLY_TRIGGER = 56; // touch only: the app, and the website on a touch screen
export const SWIPE_REPLY_MAX = 72; // touch only
export const REPLY_MIN_BUBBLE_WIDTH = 180;
export const JUMP_HIGHLIGHT_HOLD_MS = 1200;
export const JUMP_HIGHLIGHT_FADE_MS = 400;
export const JUMP_MAX_EXTRA_PAGES = 5;
export const COPY_TOAST_MS = 1500;
// The database enforces this; the apps only use it to decide what to show.
export const DELETE_FOR_EVERYONE_MINUTES = 60;

/* Deleted for everyone: a tombstone (`content` is ""). */
export const isDeleted = (m) => !!m.deleted_at;

/* A reply draws a quote. `reply_to_sender_id`, not `reply_preview`: the
   preview goes null when the original is deleted for everyone, and the quote
   then reads "Original message was deleted". */
export const isReply = (m) => !!m.reply_to_sender_id;

/* Whether to OFFER "Delete for everyone" (§10.8). The server still decides,
   and answers DELETE_WINDOW_EXPIRED when the hour has run out. A bubble sent
   from this page shows the time it was typed, which can be earlier than the
   server's, so this check is conservative, never generous. */
export const canDeleteForEveryone = (m, myId, now = Date.now()) =>
  m.sender_id === myId &&
  !isDeleted(m) &&
  !m.pending &&
  !m.failed &&
  now - Date.parse(m.created_at) < DELETE_FOR_EVERYONE_MINUTES * 60_000;

/* "Replying to <first name>" (§10.4): the first word of the name as the
   header shows it; with no name, "Yahora student". */
export const firstName = (fullName) =>
  (fullName ?? "").trim().split(/\s+/)[0] || "Yahora student";
