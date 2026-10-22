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
 * The server's copy of a message taking over the cached one.
 *
 * A bubble I sent from this phone keeps two things from its optimistic copy:
 * - its `client_tag`, which is the row's list key (`chatRowKey`). The row is
 *   updated where it is, never unmounted and rebuilt.
 * - the time it was typed. A send that waited for the network gets a server
 *   `created_at` from when the network came back, and drawing that would move
 *   its clock and regroup it with its neighbours (margins, tails) at the very
 *   moment it lands.
 * So the only change on screen is the clock (or ⓘ) turning into ticks. The
 * other person, and this phone after a cold reload, see the server's time.
 */
export function adoptServerRow(local: PendingMessage, incoming: Message): PendingMessage {
  if (!local.client_tag) return { ...incoming };
  return { ...incoming, client_tag: local.client_tag, created_at: local.created_at };
}

/** A message's list key: its `client_tag` if it was sent from here, so it stays put. */
export function chatRowKey(message: PendingMessage): string {
  return message.client_tag ?? message.id;
}

/**
 * Fold a server message into a cached thread.
 *
 * 1. Already present by `id` → refresh it in place (never append a second copy).
 *    If this is the send's own response (`clientTag`) and Realtime got there
 *    first, any leftover placeholder for it is dropped.
 * 2. Otherwise, if an optimistic message is waiting on this exact send — matched
 *    by `client_tag` when we know it, else by same sender + product + identical
 *    content — the real one takes over its slot (`adoptServerRow`).
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
    next[byId] = adoptServerRow(current[byId], incoming);
    return clientTag
      ? next.filter((m) => m.id === incoming.id || m.client_tag !== clientTag)
      : next;
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
    next[pendingIdx] = adoptServerRow(current[pendingIdx], incoming);
    return next;
  }

  return [...current, { ...incoming }];
}

/** The newest server message in a list: the anchor a new bubble records. */
export function newestServerId(list: PendingMessage[]): string | null {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].id !== list[i].client_tag) return list[i].id;
  }
  return null;
}

/**
 * The unsent bubbles (pending or failed) a fresh history page does NOT hold yet.
 *
 * A bubble counts as already on the server only when the page has a message
 * from the same sender with the same text AFTER the bubble's `sent_after_id`.
 * That is the case this exists for: a send that reached the server while its
 * answer was lost. Matching the text anywhere in the page made a failed "ok"
 * vanish because some older "ok" was in the thread. Each server row accounts
 * for one bubble at most. An anchor missing from the page (older than it)
 * leaves the whole page eligible.
 */
export function unsentStillMissing(
  history: Message[],
  unsent: PendingMessage[],
): PendingMessage[] {
  const claimed = new Set<string>();
  return unsent.filter((u) => {
    const from = u.sent_after_id ? history.findIndex((s) => s.id === u.sent_after_id) : -1;
    const at = history.findIndex(
      (s, i) =>
        i > from && !claimed.has(s.id) && s.sender_id === u.sender_id && s.content === u.content,
    );
    if (at === -1) return true;
    claimed.add(history[at].id);
    return false;
  });
}

/**
 * A Realtime UPDATE row, with the columns it left out taken from the cached copy.
 *
 * Postgres leaves an unchanged column out of an UPDATE's change record when its
 * value is stored out of line (TOAST, roughly 2 KB and up), and `messages` has
 * the default replica identity. A long message's `content` is such a value, so
 * its delivered and read ticks arrive with no text. Swapping that row in drew a
 * bubble with `content: undefined` and crashed the chat (jumboEmojiCount).
 */
export function withLeftOutColumns(cached: PendingMessage, updated: Message): PendingMessage {
  const sent = Object.fromEntries(Object.entries(updated).filter(([, v]) => v !== undefined));
  return { ...cached, ...sent };
}

/** Replace a message after an UPDATE (the read/delivered ticks). */
export function replaceMessage(list: PendingMessage[], updated: Message): PendingMessage[] {
  return list.map((m) =>
    m.id === updated.id ? adoptServerRow(m, withLeftOutColumns(m, updated)) : m,
  );
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
