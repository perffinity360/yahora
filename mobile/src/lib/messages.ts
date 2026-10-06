import type { InfiniteData } from '@tanstack/react-query';

import type { Message, PendingMessage } from '../types';

/**
 * Shared message-cache rules.
 *
 * Every path that can add a message to a chat — the realtime INSERT, the send
 * response, the history refetch — goes through here, so the dedupe logic exists
 * exactly once. Getting this wrong is what produces double bubbles.
 *
 * ── NOTHING HERE SORTS (Phase 5 V-E) ──
 * The order on screen is the order the server sent: each history page arrives
 * oldest-first, pages are stacked newest page first, and a new message is
 * appended to the end of the newest page. If a thread ever renders out of
 * order, the backend sent it out of order — fix it there, not here.
 */

/** One page of `GET /api/messages/history`, as cached. Items oldest-first. */
export interface ChatPage {
  items: PendingMessage[];
  next_cursor: string | null;
}

/**
 * The `['chat', contactId, productId]` cache: a `useInfiniteQuery` result.
 * `pages[0]` is the NEWEST page (the one a thread opens on); each later page is
 * the stretch of conversation immediately before the one above it in the array.
 */
export type ChatCache = InfiniteData<ChatPage>;

/**
 * Rewrite the newest page — where a new message, sent or received, always lands.
 * With no cache yet (a send before the first page has arrived) it starts one.
 */
export function updateNewestPage(
  data: ChatCache | undefined,
  update: (items: PendingMessage[]) => PendingMessage[],
): ChatCache {
  if (!data || data.pages.length === 0) {
    return { pages: [{ items: update([]), next_cursor: null }], pageParams: [undefined] };
  }
  const [newest, ...older] = data.pages;
  return { ...data, pages: [{ ...newest, items: update(newest.items) }, ...older] };
}

/** Rewrite every loaded page — for changes to a message that may be anywhere. */
export function updateEveryPage(
  data: ChatCache | undefined,
  update: (items: PendingMessage[]) => PendingMessage[],
): ChatCache | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map((page) => ({ ...page, items: update(page.items) })) };
}

/** The whole loaded thread, oldest first: the older pages, then the newer. */
export function flattenThread(data: ChatCache | undefined): PendingMessage[] {
  if (!data) return [];
  return [...data.pages].reverse().flatMap((page) => page.items);
}

/**
 * Fold a server message into a cached thread.
 *
 * 1. Already present by `id` → refresh it in place (never append a second copy).
 * 2. Otherwise, if an optimistic message is waiting on this exact send — matched
 *    by `client_tag` when we know it, else by same sender + product + identical
 *    content — swap the real one in and drop the placeholder.
 * 3. Otherwise it is genuinely new: append it, at the bottom of the thread.
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
    return next;
  }

  return [...current, { ...incoming }];
}

/** Replace a message after an UPDATE (the read/delivered ticks). */
export function replaceMessage(list: PendingMessage[], updated: Message): PendingMessage[] {
  return list.map((m) => (m.id === updated.id ? { ...updated } : m));
}

/** Who the other party is, from my point of view. */
export function contactIdOf(message: Message, myId: string): string {
  return message.sender_id === myId ? message.receiver_id : message.sender_id;
}

/* ── TIME FORMATS — MESSAGES_SPEC.md §1 "Time format", identical on web ──
 *
 * One set of calendar rules serves both the inbox (`formatInboxTime`) and the
 * conversation's date chips (`formatDayLabel`), so the two can never disagree
 * about what "Yesterday" or "Mon" means. Names come from fixed English tables,
 * not Intl: Hermes builds differ in what `toLocaleDateString` returns, and the
 * spec's strings are exact. */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOUR_MS = 60 * 60 * 1000;

function parse(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole calendar days from `d` to `now`: 0 today, 1 yesterday. Never negative. */
function daysAgo(d: Date, now: Date): number {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((b - a) / (24 * HOUR_MS)));
}

/** `Yesterday` · `Mon` (2–6 days) · `12 Sep` (this year) · `12 Sep 2025`. Null for today. */
function pastDayLabel(d: Date, now: Date): string | null {
  const days = daysAgo(d, now);
  if (days === 0) return null;
  if (days === 1) return 'Yesterday';
  if (days <= 6) return WEEKDAYS[d.getDay()];
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? date : `${date} ${d.getFullYear()}`;
}

/** `4:41 PM` — the time inside every bubble, and the inbox time on the same day. */
export function formatClockTime(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return '';
  const hours = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** Date chip: `Today` · `Yesterday` · `Mon` · `12 Sep` · `12 Sep 2025`. */
export function formatDayLabel(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return '';
  return pastDayLabel(d, new Date()) ?? 'Today';
}

/** Inbox row time: `2m` under an hour · `4:41 PM` same day · then as the chip. */
export function formatInboxTime(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return '';
  const now = new Date();
  const age = now.getTime() - d.getTime();
  // A clock a little ahead of ours reads as just now, never as negative.
  if (age < HOUR_MS) return `${Math.max(0, Math.floor(age / 60000))}m`;
  return pastDayLabel(d, now) ?? formatClockTime(iso);
}

/** Same calendar day — the run and the date-chip boundary. */
export function isSameDay(a?: string | null, b?: string | null): boolean {
  const x = parse(a);
  const y = parse(b);
  return (
    !!x &&
    !!y &&
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

/**
 * A RUN (MESSAGES_SPEC.md §2): consecutive messages from the same sender, on the
 * same day, each within 5 minutes of the previous. Runs share tight spacing and
 * only the last one gets the tail.
 */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function isGroupedWith(previous: PendingMessage, current: PendingMessage): boolean {
  if (previous.sender_id !== current.sender_id) return false;
  const prevTime = new Date(previous.created_at).getTime();
  const curTime = new Date(current.created_at).getTime();
  if (Number.isNaN(prevTime) || Number.isNaN(curTime)) return false;
  if (curTime - prevTime > GROUP_WINDOW_MS) return false;
  return isSameDay(previous.created_at, current.created_at);
}
