import type { PendingMessage } from '../types';

/**
 * Message actions — Reply, Copy, Delete (MESSAGES_SPEC.md §10, Phase 6B).
 *
 * ── THE CONSTANTS OF §10.10 ──
 * Same names and values as the website's `frontend/src/utils/messageActions.js`.
 * Change both in the same commit, and the SQL function
 * `delete_message_for_everyone` too if DELETE_FOR_EVERYONE_MINUTES changes.
 */
export const LONG_PRESS_MS = 250;
export const SWIPE_REPLY_TRIGGER = 56; // touch only: the app, and the website on a touch screen
export const SWIPE_REPLY_MAX = 72; // touch only
export const REPLY_MIN_BUBBLE_WIDTH = 180;
export const JUMP_HIGHLIGHT_HOLD_MS = 1200;
export const JUMP_HIGHLIGHT_FADE_MS = 400;
export const JUMP_MAX_EXTRA_PAGES = 5;
export const COPY_TOAST_MS = 1500;
export const DELETE_FOR_EVERYONE_MINUTES = 60; // the database enforces this; apps only decide what to show

/** Deleted for everyone: a tombstone (§10.8). Its `content` is `''`. */
export function isDeleted(m: PendingMessage): boolean {
  return !!m.deleted_at;
}

/**
 * A reply. Decided by `reply_to_sender_id`, never by `reply_preview`: a reply
 * whose original was deleted for everyone keeps its sender and loses its
 * preview, and still draws a quote ("Original message was deleted", §10.5).
 */
export function isReply(m: PendingMessage): boolean {
  return !!m.reply_to_sender_id;
}

/**
 * Whether to OFFER "Delete for everyone" (§10.8). Only the database decides
 * whether it happens: past the hour it answers DELETE_WINDOW_EXPIRED. A bubble
 * sent from this phone shows its typed time, which can be earlier than the
 * server's, so this errs toward hiding the choice, never toward showing it. An
 * unreadable `created_at` gives NaN, and NaN < x is false: hidden.
 */
export function canDeleteForEveryone(
  m: PendingMessage,
  myId: string | undefined,
  now: number = Date.now(),
): boolean {
  return (
    m.sender_id === myId &&
    !isDeleted(m) &&
    !m.pending &&
    !m.failed &&
    now - Date.parse(m.created_at) < DELETE_FOR_EVERYONE_MINUTES * 60_000
  );
}

/** "Replying to <first name>" (§10.4): the first word of the name, or `Yahora student`. */
export function firstName(fullName: string | null | undefined): string {
  return fullName?.trim().split(/\s+/)[0] || 'Yahora student';
}
