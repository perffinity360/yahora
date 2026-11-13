/**
 * Community — docs/design/COMMUNITY_SPEC.md. The app twin of the website's
 * frontend/src/utils/community.js: same constant names, same values, same rules.
 * If one changes, change both in the same commit (spec §13).
 */

import type { PostItem, ReactionResult } from '../types';
import { formatShortDate } from './messages';

// ── Spec §13 constants ─────────────────────────────────────────────────────
export const POST_MAX_CHARS = 1000;
export const POST_FOLD_LINES = 6;
export const POST_MAX_PHOTOS = 3;
export const POST_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const FEED_PAGE_SIZE = 20;
export const REPLIES_PAGE_SIZE = 10;
export const NEW_POSTS_POLL_MS = 30000;
export const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'] as const;
export const DEFAULT_REACTION = '❤️';
export const REACTION_SUMMARY_COUNT = 4;
export const REACTION_HOVER_DELAY_MS = 300;
export const REACTION_LONG_PRESS_MS = 450;
export const REPLY_PREVIEW_COUNT = 2;
export const REPLIES_FOLD_MIN = 3;
export const GIF_SEARCH_DEBOUNCE_MS = 300;
export const LAYOUT_MIN_PANEL_PX = 320;
export const LAYOUT_COLLAPSED_PX = 36;
export const LAYOUT_BREAKPOINT_PX = 1024;
export const REPORT_DETAILS_MAX = 500;

/** Which feed: your campus, a country by its code, or Global. */
export type FeedKind = 'campus' | 'country' | 'global';
export type FeedSort = 'hot' | 'new';
/** The right-hand side of the switcher: a two-letter country code or 'global'. */
export type WorldFeed = string;
export const GLOBAL = 'global';

/** Runbook §1.12: count code points, the way Postgres char_length() does. */
export function codePointLength(text: string | null | undefined): number {
  return [...(text ?? '')].length;
}

/** Spec §3 "Counts": 999 · 1.2K · 12K · 1.2M. Truncated, never rounded up,
 *  so 999,999 reads 999K rather than a misleading 1000K. */
export function formatCount(n: number | null | undefined): string {
  const value = Math.max(0, Math.floor(Number(n) || 0));
  if (value < 1000) return String(value);
  const scaled = (divisor: number, suffix: string) => {
    const x = value / divisor;
    if (x >= 10) return `${Math.floor(x)}${suffix}`;
    const oneDecimal = Math.floor(x * 10) / 10;
    return `${oneDecimal % 1 === 0 ? oneDecimal.toFixed(0) : oneDecimal.toFixed(1)}${suffix}`;
  };
  if (value < 1_000_000) return scaled(1000, 'K');
  return scaled(1_000_000, 'M');
}

/** Spec §1.3: `IN` → 🇮🇳, worked out from the code, never stored. '' for
 *  anything that isn't two letters. */
export function flagEmoji(code: string | null | undefined): string {
  if (typeof code !== 'string' || !/^[A-Za-z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split('')
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/** The country's English name: the API's list wins, the code is the fallback. */
export function countryName(code: string, countries: { code: string; name: string }[] = []): string {
  return countries.find((c) => c.code === code)?.name ?? code;
}

/** Every emoji with its count, biggest first. Ties keep the quick bar's
 *  order, then code-point order, so the same counts always draw the same way. */
export function sortedReactions(counts: Record<string, number> | null | undefined): [string, number][] {
  const rank = (emoji: string) => {
    const i = (QUICK_REACTIONS as readonly string[]).indexOf(emoji);
    return i === -1 ? QUICK_REACTIONS.length : i;
  };
  return Object.entries(counts ?? {})
    .filter(([, count]) => count > 0)
    .sort(([a, x], [b, y]) => y - x || rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
}

/** Spec §5.3: the top emojis by count, for the summary pill. */
export function topReactions(counts: Record<string, number> | null | undefined, n = REACTION_SUMMARY_COUNT) {
  return sortedReactions(counts)
    .slice(0, n)
    .map(([emoji]) => emoji);
}

/** Spec §3 "Time": now · 5m · 2h · 3d, then 12 Oct, or 12 Oct 2025 in an
 *  earlier year (the message formatter's date forms). */
export function formatPostTime(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  // A clock a little ahead of ours reads as now, never as negative.
  const minutes = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return formatShortDate(iso);
}

/** Spec §3 "Text": links are tappable, with no previews. Splits text into
 *  runs; `href` is null for plain text. Trailing punctuation stays out of the
 *  link, so "see example.com." links "example.com". */
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
const TRAILING = /[.,!?;:)\]'"]+$/;

export function splitLinks(text: string): { text: string; href: string | null }[] {
  const runs: { text: string; href: string | null }[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    let url = match[0];
    const at = match.index ?? 0;
    const trail = url.match(TRAILING)?.[0] ?? '';
    if (trail) url = url.slice(0, -trail.length);
    if (at > last) runs.push({ text: text.slice(last, at), href: null });
    runs.push({ text: url, href: url.startsWith('www.') ? `https://${url}` : url });
    last = at + url.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), href: null });
  return runs;
}

/**
 * What a reaction does to a post's numbers, worked out before the server
 * answers (the optimistic half of useReactToPost). One reaction per person:
 * `emoji` replaces the viewer's own, `null` removes it.
 */
export function applyReaction(post: PostItem, emoji: string | null): ReactionResult {
  const counts = { ...(post.reaction_counts ?? {}) };
  let total = post.reactions_total ?? 0;
  const before = post.viewer_reaction;
  if (before) {
    counts[before] = Math.max(0, (counts[before] ?? 0) - 1);
    if (counts[before] === 0) delete counts[before];
    total = Math.max(0, total - 1);
  }
  if (emoji) {
    counts[emoji] = (counts[emoji] ?? 0) + 1;
    total += 1;
  }
  return { post_id: post.id, viewer_reaction: emoji, reactions_total: total, reaction_counts: counts };
}

/** A post (or a reply inside its `top_replies`) with a reaction result laid over it. */
export function withReaction(post: PostItem, result: ReactionResult): PostItem {
  if (post.id === result.post_id) {
    return {
      ...post,
      viewer_reaction: result.viewer_reaction,
      reactions_total: result.reactions_total,
      reaction_counts: result.reaction_counts,
    };
  }
  if (post.top_replies?.some((r) => r.id === result.post_id)) {
    return { ...post, top_replies: post.top_replies.map((r) => withReaction(r, result)) };
  }
  return post;
}

/** Each id once, first one wins. Hot-ranked replies can move between pages
 *  while a thread is open (backend/API.md, GET /:id/replies). */
export function distinctById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
