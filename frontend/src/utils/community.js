/* Community — docs/design/COMMUNITY_SPEC.md. The web twin of
   mobile/src/lib/community.ts: same constant names, same values, same rules.
   If one changes, change both in the same commit (spec §13). */

import { formatShortDate } from "./messageFormat";

// ── Spec §13 constants ──────────────────────────────────────────────────────
export const POST_MAX_CHARS = 1000;
export const POST_FOLD_LINES = 6;
export const POST_MAX_PHOTOS = 3;
export const POST_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const FEED_PAGE_SIZE = 20;
export const REPLIES_PAGE_SIZE = 10;
export const NEW_POSTS_POLL_MS = 30000;
export const QUICK_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];
export const DEFAULT_REACTION = "❤️";
export const REACTION_HOVER_DELAY_MS = 300;
export const REACTION_LONG_PRESS_MS = 450;
export const GIF_SEARCH_DEBOUNCE_MS = 300;
/* The narrowest a panel's CONTENT lays itself out. The panel itself can be
   dragged narrower, down to its 36 px bar, with no snap: past this its content
   just stops adjusting and is cut off at the divider, as on LeetCode (owner,
   8 Nov). Community.module.css repeats it on .panelInner. */
export const LAYOUT_MIN_PANEL_PX = 320;
export const LAYOUT_COLLAPSED_PX = 36;
export const LAYOUT_BREAKPOINT_PX = 1024;
export const REPORT_DETAILS_MAX = 500;
export const REPLY_PREVIEW_COUNT = 2;
/* "Show more replies" needs at least this many replies on the post, and is
   never left standing for fewer than this many unloaded ones (spec §4). */
export const REPLIES_FOLD_MIN = 3;
export const REACTION_SUMMARY_COUNT = 4;

/* Runbook §1.12: count code points, the way Postgres char_length() does, so
   the counter and the database agree about emoji. */
export function codePointLength(text) {
  return [...(text ?? "")].length;
}

/* Spec §3 "Counts": 999 · 1.2K · 12K · 1.2M. Truncated, never rounded up, so
   999,999 reads 999K rather than a misleading 1000K. */
export function formatCount(n) {
  const value = Math.max(0, Math.floor(Number(n) || 0));
  if (value < 1000) return String(value);
  const scaled = (divisor, suffix) => {
    const x = value / divisor;
    if (x >= 10) return `${Math.floor(x)}${suffix}`;
    const oneDecimal = Math.floor(x * 10) / 10;
    return `${oneDecimal % 1 === 0 ? oneDecimal.toFixed(0) : oneDecimal.toFixed(1)}${suffix}`;
  };
  if (value < 1_000_000) return scaled(1000, "K");
  return scaled(1_000_000, "M");
}

/* Spec §1.3: flags are worked out from the two-letter code, never stored.
   `IN` → 🇮🇳. Anything that is not two letters gives an empty string. */
export function flagEmoji(code) {
  if (typeof code !== "string" || !/^[A-Za-z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/* The country's English name. The countries list from the API wins; the
   browser's own table is only a fallback for a code the list doesn't carry. */
export function countryName(code, countries = []) {
  const found = countries.find((c) => c.code === code);
  if (found) return found.name;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/* Every emoji with its count, biggest first. Ties keep the quick bar's order,
   then code point order, so the same counts always draw the same way. */
export function sortedReactions(counts) {
  const rank = (emoji) => {
    const i = QUICK_REACTIONS.indexOf(emoji);
    return i === -1 ? QUICK_REACTIONS.length : i;
  };
  return Object.entries(counts ?? {})
    .filter(([, count]) => count > 0)
    .sort(
      ([a, x], [b, y]) => y - x || rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0),
    );
}

/* Spec §5.3: the top emojis by count, for the summary pill. */
export function topReactions(counts, n = REACTION_SUMMARY_COUNT) {
  return sortedReactions(counts)
    .slice(0, n)
    .map(([emoji]) => emoji);
}

/* Spec §3 "Time": now · 5m · 2h · 3d, then 12 Oct, or 12 Oct 2025 in an
   earlier year. The date forms are the message formatter's. */
export function formatPostTime(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  // A clock a little ahead of ours reads as now, never as negative.
  const minutes = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return formatShortDate(iso);
}

/* Spec §3 "Text": links are tappable, with no previews. Splits text into
   [{ text, href }] runs; href is null for plain text. Trailing punctuation
   stays out of the link, so "see example.com." links "example.com". */
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING = /[.,!?;:)\]'"]+$/;

export function splitLinks(text) {
  const runs = [];
  let last = 0;
  for (const match of (text ?? "").matchAll(LINK)) {
    let url = match[0];
    const trail = url.match(TRAILING)?.[0] ?? "";
    if (trail) url = url.slice(0, -trail.length);
    if (match.index > last) runs.push({ text: text.slice(last, match.index), href: null });
    runs.push({ text: url, href: url.startsWith("www.") ? `https://${url}` : url });
    last = match.index + url.length;
  }
  if (last < (text ?? "").length) runs.push({ text: text.slice(last), href: null });
  return runs;
}
