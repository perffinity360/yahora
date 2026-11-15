import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import EMOJI_DATA from '../assets/emojis.json';

/**
 * Everything the app's emoji picker knows (COMMUNITY_SPEC.md §5.2), for
 * `EmojiGrid`: the emoji by category, search, skin tones, and Frequently used.
 *
 * The data is rn-emoji-keyboard 1.7.0's `emojis.json` (MIT, © 2020 The Widlarz
 * Group), the same 1,640 emoji the app showed before, cut down to what we use.
 * We stopped using the library itself on 15 Nov: its categories sat side by
 * side, one page each, so scrolling down never reached the next one, and the
 * owner wanted the website's picker (emoji-picker-react), where every category
 * follows the last in one list.
 */

export type Emoji = { emoji: string; name: string; keywords: string[]; toneEnabled?: boolean };

export type EmojiCategoryKey =
  | 'recently_used'
  | 'smileys_emotion'
  | 'people_body'
  | 'animals_nature'
  | 'food_drink'
  | 'travel_places'
  | 'activities'
  | 'objects'
  | 'symbols'
  | 'flags';

/** The tabs, in order, with their titles and MaterialCommunityIcons glyphs. */
export const EMOJI_CATEGORIES = [
  { key: 'recently_used', title: 'Frequently used', icon: 'clock-outline' },
  { key: 'smileys_emotion', title: 'Smileys & Emotion', icon: 'emoticon-happy-outline' },
  { key: 'people_body', title: 'People & Body', icon: 'account-multiple-outline' },
  { key: 'animals_nature', title: 'Animals & Nature', icon: 'paw-outline' },
  { key: 'food_drink', title: 'Food & Drink', icon: 'food-apple-outline' },
  { key: 'travel_places', title: 'Travel & Places', icon: 'airplane' },
  { key: 'activities', title: 'Activities', icon: 'soccer' },
  { key: 'objects', title: 'Objects', icon: 'lightbulb-outline' },
  { key: 'symbols', title: 'Symbols', icon: 'heart-outline' },
  { key: 'flags', title: 'Flags', icon: 'flag-outline' },
] as const satisfies readonly { key: EmojiCategoryKey; title: string; icon: string }[];

/** Every emoji, by category (not Frequently used, which is per phone). */
export const EMOJI_BY_CATEGORY = EMOJI_DATA as { title: Exclude<EmojiCategoryKey, 'recently_used'>; data: Emoji[] }[];

const ALL: Emoji[] = EMOJI_BY_CATEGORY.flatMap((c) => c.data);

/** Search by name and keyword, like the website's picker: every word typed must match. */
export function searchEmoji(query: string): Emoji[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return ALL.filter((e) =>
    words.every((w) => e.name.includes(w) || e.keywords.some((k) => k.toLowerCase().includes(w))),
  );
}

/** Light to dark, after the yellow default. */
export const SKIN_TONES = ['\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'] as const;

const ZWJ = '‍';
const VS16 = '️';

/** The emoji in a skin tone: the modifier goes before a joiner or a variation
 *  selector if there is one, else at the end (rn-emoji-keyboard's rule). */
export function withTone(emoji: string, tone: string): string {
  const chars = emoji.split('');
  const at = chars.findIndex((c) => c === ZWJ);
  const vs = chars.findIndex((c) => c === VS16);
  const i = at > 0 ? at : vs > 0 ? vs : -1;
  if (i < 0) return emoji + tone;
  return [...chars.slice(0, i), tone, ...chars.slice(i)].join('');
}

/* ── Frequently used ──────────────────────────────────────────────────────
   Kept on this phone under the key the old picker used, in its shape (newest
   first; it stored whole emoji objects), so nobody loses theirs. */
const RECENT_KEY = 'yahora.emoji.recent';
const RECENT_MAX = 24;

let recents: Emoji[] = [];
let loaded = false;
const onLoad = new Set<() => void>();

void AsyncStorage.getItem(RECENT_KEY)
  .then((raw) => {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    if (Array.isArray(parsed)) {
      recents = parsed
        .filter((e): e is Emoji => !!e && typeof e.emoji === 'string')
        .map((e) => ({ emoji: e.emoji, name: e.name ?? '', keywords: [], toneEnabled: e.toneEnabled }))
        .slice(0, RECENT_MAX);
    }
  })
  .catch(() => {})
  .finally(() => {
    loaded = true;
    onLoad.forEach((f) => f());
    onLoad.clear();
  });

/** Put an emoji first in Frequently used. Shown the next time a picker opens,
 *  so the grid never shifts under a finger that's adding several. */
export function rememberEmoji(e: Emoji) {
  recents = [e, ...recents.filter((r) => r.emoji !== e.emoji)].slice(0, RECENT_MAX);
  void AsyncStorage.setItem(RECENT_KEY, JSON.stringify(recents)).catch(() => {});
}

/** Frequently used as it was when the picker opened. */
export function useRecentEmoji(): Emoji[] {
  const [snapshot, setSnapshot] = useState<Emoji[]>(() => recents);
  useEffect(() => {
    if (loaded) return;
    const f = () => setSnapshot(recents);
    onLoad.add(f);
    return () => {
      onLoad.delete(f);
    };
  }, []);
  return snapshot;
}
