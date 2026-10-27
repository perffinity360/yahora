/* Time formats and message runs — docs/design/MESSAGES_SPEC.md §1 "Time format"
   and §2 "Bubbles". The web twin of the same functions in
   mobile/src/lib/messages.ts: same rules, same strings. If one changes, change
   both in the same commit, or the two apps disagree about what "Yesterday" or
   a run means.

   Names come from fixed English tables, not Intl, because the spec's strings
   are exact (`4:41 PM`, `12 Sep`) and toLocaleString varies by browser locale. */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HOUR_MS = 60 * 60 * 1000;
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function parse(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* Whole calendar days from `d` to `now`: 0 today, 1 yesterday. Never negative. */
function daysAgo(d, now) {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.round((b - a) / (24 * HOUR_MS)));
}

/* `Yesterday` · `Mon` (2–6 days) · `12 Sep` (this year) · `12 Sep 2025`. Null for today. */
function pastDayLabel(d, now) {
  const days = daysAgo(d, now);
  if (days === 0) return null;
  if (days === 1) return "Yesterday";
  if (days <= 6) return WEEKDAYS[d.getDay()];
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? date : `${date} ${d.getFullYear()}`;
}

/* `4:41 PM` — the time inside every bubble, and the inbox time on the same day. */
export function formatClockTime(iso) {
  const d = parse(iso);
  if (!d) return "";
  const hours = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

/* A plain date: `3 Oct` this year, `3 Oct 2025` in an earlier one. The date
   forms of the table above, never `Today` or a weekday — MARK_SOLD_SPEC §2 and
   §3 use it for when a listing sold. */
export function formatShortDate(iso) {
  const d = parse(iso);
  if (!d) return "";
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? date : `${date} ${d.getFullYear()}`;
}

/* Date chip: `Today` · `Yesterday` · `Mon` · `12 Sep` · `12 Sep 2025`. */
export function formatDayLabel(iso) {
  const d = parse(iso);
  if (!d) return "";
  return pastDayLabel(d, new Date()) ?? "Today";
}

/* Inbox row time: `2m` under an hour · `4:41 PM` same day · then as the chip. */
export function formatInboxTime(iso) {
  const d = parse(iso);
  if (!d) return "";
  const now = new Date();
  const age = now.getTime() - d.getTime();
  // A clock a little ahead of ours reads as just now, never as negative.
  if (age < HOUR_MS) return `${Math.max(0, Math.floor(age / 60000))}m`;
  return pastDayLabel(d, now) ?? formatClockTime(iso);
}

function isSameDay(a, b) {
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

/* A RUN: consecutive messages from the same sender, on the same day, each
   within 5 minutes of the previous. Runs share tight spacing and only the last
   one gets the tail. */
export function isGroupedWith(previous, current) {
  if (previous.sender_id !== current.sender_id) return false;
  const prevTime = new Date(previous.created_at).getTime();
  const curTime = new Date(current.created_at).getTime();
  if (Number.isNaN(prevTime) || Number.isNaN(curTime)) return false;
  if (curTime - prevTime > GROUP_WINDOW_MS) return false;
  return isSameDay(previous.created_at, current.created_at);
}
