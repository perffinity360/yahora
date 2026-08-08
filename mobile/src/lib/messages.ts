import type { Message, PendingMessage } from '../types';

/**
 * Shared message-cache rules.
 *
 * Every path that can add a message to a chat — the realtime INSERT, the send
 * response, the history refetch — goes through here, so the dedupe logic exists
 * exactly once. Getting this wrong is what produces double bubbles.
 */

/** Chronological order. Realtime can deliver out of order after a reconnect. */
export function sortByTime(list: PendingMessage[]): PendingMessage[] {
  return [...list].sort((a, b) => {
    const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    // Equal timestamps (bulk inserts) — fall back to id so the order is stable.
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

/**
 * Fold a server message into a cached thread.
 *
 * 1. Already present by `id` → refresh it in place (never append a second copy).
 * 2. Otherwise, if an optimistic message is waiting on this exact send — matched
 *    by `client_tag` when we know it, else by same sender + product + identical
 *    content — swap the real one in and drop the placeholder.
 * 3. Otherwise it is genuinely new: append and re-sort.
 */
export function mergeMessage(
  list: PendingMessage[] | undefined,
  incoming: Message,
  clientTag?: string,
): PendingMessage[] {
  const current = list ?? [];

  const byId = current.findIndex((m) => m.id === incoming.id);
  if (byId > -1) {
    const next = [...current];
    next[byId] = { ...incoming };
    return next;
  }

  const pendingIdx = current.findIndex((m) =>
    clientTag
      ? m.client_tag === clientTag
      : !!m.pending &&
        m.sender_id === incoming.sender_id &&
        m.product_id === incoming.product_id &&
        m.content === incoming.content,
  );
  if (pendingIdx > -1) {
    const next = [...current];
    next[pendingIdx] = { ...incoming };
    return sortByTime(next);
  }

  return sortByTime([...current, { ...incoming }]);
}

/** Replace a message after an UPDATE (the read/delivered ticks). */
export function replaceMessage(
  list: PendingMessage[] | undefined,
  updated: Message,
): PendingMessage[] | undefined {
  if (!list) return list;
  return list.map((m) => (m.id === updated.id ? { ...updated } : m));
}

/** Who the other party is, from my point of view. */
export function contactIdOf(message: Message, myId: string): string {
  return message.sender_id === myId ? message.receiver_id : message.sender_id;
}

/** "14:32" — the timestamp under each bubble and beside each inbox row. */
export function formatClockTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** "Today" / "Yesterday" / "Mon, 4 Aug" — the chat day separators. */
export function formatDayLabel(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Inbox timestamps: clock today, "Yesterday", else a short date. */
export function formatInboxTime(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const today = new Date();
  if (d.toDateString() === today.toDateString()) return formatClockTime(iso);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Messages within this gap from the same sender render as one visual group. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function isGroupedWith(previous: PendingMessage, current: PendingMessage): boolean {
  if (previous.sender_id !== current.sender_id) return false;
  const prevTime = new Date(previous.created_at).getTime();
  const curTime = new Date(current.created_at).getTime();
  if (Number.isNaN(prevTime) || Number.isNaN(curTime)) return false;
  if (curTime - prevTime > GROUP_WINDOW_MS) return false;
  return formatDayLabel(previous.created_at) === formatDayLabel(current.created_at);
}
