import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Reanimated from 'react-native-reanimated';

import { AppText } from '../AppText';
import { AppTextInput } from '../AppTextInput';
import {
  EMOJI_BY_CATEGORY,
  EMOJI_CATEGORIES,
  rememberEmoji,
  searchEmoji,
  SKIN_TONES,
  useRecentEmoji,
  withTone,
  type Emoji,
  type EmojiCategoryKey,
} from '../../lib/emojiPicker';
import { POPOVER_ENTER } from '../../lib/motion';
import { colors, font, shadows } from '../../theme';

/**
 * The app's emoji picker, COMMUNITY_SPEC.md §5.2, built to behave like the
 * website's (emoji-picker-react; owner, 15 Nov):
 *
 *   [🔍][🕘][☺][👥][🐾][🍎][✈][⚽][💡][♡][⚑]   ← tabs; the one you're in is lit
 *   Frequently used
 *   😀 😂 ❤️ …
 *   Smileys & Emotion                            ← one list: scrolling down runs
 *   😀 😃 😄 …                                       from each category into the next
 *
 *   · the tabs follow the scroll, and a tab jumps to its category;
 *   · 🔍 turns the tab row into a search box (← to leave it), so the grid keeps
 *     its height: four rows show even in a keyboard-sized panel (owner, 15 Nov);
 *   · Frequently used comes first, once this phone has some;
 *   · holding an emoji that has skin tones offers the five, as the old picker did.
 *
 * Every row has a fixed height, so the list knows where each category starts
 * without measuring, and the tab under the scroll is exact.
 *
 * Used by `EmojiPanel` (compose's ☺, in the keyboard's place) and
 * `EmojiPickerSheet` (a reaction's ⊕).
 */

const TAB_H = 40;
const HEADER_H = 28;
const ROW_H = 44;
const PAD_X = 6;
/** Narrowest cell before a column is dropped: 8 across a 393-wide phone. */
const MIN_CELL = 46;
const TONE_CELL = 40;

/** The height that shows the tabs, a category title and `rows` rows. */
export function emojiGridHeight(rows: number) {
  return TAB_H + HEADER_H + ROW_H * rows;
}

type Item =
  | { kind: 'header'; key: string; title: string; category: EmojiCategoryKey | 'search' }
  | { kind: 'row'; key: string; emojis: Emoji[]; category: EmojiCategoryKey | 'search' }
  | { kind: 'empty'; key: string };

export const EmojiGrid = memo(function EmojiGrid({
  onPick,
  current = null,
}: {
  onPick: (emoji: string) => void;
  /** Your current reaction, marked in the grid. */
  current?: string | null;
}) {
  const recents = useRecentEmoji();
  const [width, setWidth] = useState(0);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<EmojiCategoryKey>(recents.length ? 'recently_used' : 'smileys_emotion');
  const [tones, setTones] = useState<{ emoji: Emoji; x: number; y: number } | null>(null);
  const listRef = useRef<FlatList<Item>>(null);
  const scrollY = useRef(0);

  const cols = Math.max(6, Math.floor((width - PAD_X * 2) / MIN_CELL));
  const cellW = width > 0 ? (width - PAD_X * 2) / cols : MIN_CELL;

  const tabs = useMemo(
    () => EMOJI_CATEGORIES.filter((c) => c.key !== 'recently_used' || recents.length > 0),
    [recents.length],
  );

  // The list, and where each item and each category starts.
  const { items, offsets, starts } = useMemo(() => {
    const out: Item[] = [];
    const push = (category: EmojiCategoryKey | 'search', title: string, list: Emoji[]) => {
      out.push({ kind: 'header', key: `h-${category}`, title, category });
      for (let i = 0; i < list.length; i += cols) {
        out.push({ kind: 'row', key: `${category}-${i}`, emojis: list.slice(i, i + cols), category });
      }
    };
    if (searching && query.trim()) {
      const found = searchEmoji(query);
      if (found.length) push('search', 'Search results', found);
      else out.push({ kind: 'empty', key: 'empty' });
    } else if (!searching) {
      if (recents.length) push('recently_used', 'Frequently used', recents);
      for (const c of EMOJI_BY_CATEGORY) {
        push(c.title, EMOJI_CATEGORIES.find((t) => t.key === c.title)?.title ?? c.title, c.data);
      }
    }
    const offs: number[] = [];
    const st: { category: EmojiCategoryKey; offset: number }[] = [];
    let y = 0;
    for (const it of out) {
      offs.push(y);
      if (it.kind === 'header' && it.category !== 'search') st.push({ category: it.category, offset: y });
      y += it.kind === 'row' ? ROW_H : it.kind === 'header' ? HEADER_H : ROW_H * 2;
    }
    offs.push(y);
    return { items: out, offsets: offs, starts: st };
  }, [cols, recents, searching, query]);

  // Frequently used can arrive a moment after opening: while nothing has been
  // scrolled, the lit tab is whatever is at the top.
  useEffect(() => {
    if (!searching && scrollY.current < 1 && starts[0]) setActive(starts[0].category);
  }, [starts, searching]);

  const getItemLayout = useCallback(
    (_: ArrayLike<Item> | null | undefined, index: number) => ({
      length: offsets[index + 1] - offsets[index],
      offset: offsets[index],
      index,
    }),
    [offsets],
  );

  // The lit tab is the category whose title has scrolled to (or past) the top.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollY.current = y;
    if (tones) setTones(null);
    if (searching) return;
    let found = starts[0]?.category;
    for (const s of starts) {
      if (s.offset <= y + 1) found = s.category;
      else break;
    }
    if (found && found !== active) setActive(found);
  };

  const jumpTo = (category: EmojiCategoryKey) => {
    const start = starts.find((s) => s.category === category);
    if (!start) return;
    setActive(category);
    listRef.current?.scrollToOffset({ offset: start.offset, animated: false });
  };

  const choose = (e: Emoji, emoji = e.emoji) => {
    setTones(null);
    rememberEmoji({ ...e, emoji });
    onPick(emoji);
  };

  const openSearch = () => {
    setTones(null);
    setSearching(true);
    setQuery('');
  };
  const closeSearch = () => {
    setSearching(false);
    setQuery('');
    setActive(starts[0]?.category ?? 'smileys_emotion');
  };

  const renderItem = ({ item, index }: { item: Item; index: number }) => {
    if (item.kind === 'header') {
      return (
        <AppText style={styles.header} accessibilityRole="header">
          {item.title}
        </AppText>
      );
    }
    if (item.kind === 'empty') {
      return <AppText style={styles.empty}>No emoji found</AppText>;
    }
    return (
      <View style={styles.row}>
        {item.emojis.map((e, col) => {
          const mine = e.emoji === current;
          return (
            <Pressable
              key={e.emoji}
              onPress={() => choose(e)}
              onLongPress={
                e.toneEnabled
                  ? () =>
                      setTones({
                        emoji: e,
                        x: PAD_X + col * cellW + cellW / 2,
                        y: TAB_H + offsets[index] - scrollY.current,
                      })
                  : undefined
              }
              delayLongPress={350}
              accessibilityRole="button"
              accessibilityLabel={e.name}
              accessibilityState={{ selected: mine }}
              style={({ pressed }) => [styles.cell, { width: cellW }, pressed && styles.cellPressed]}
            >
              <View style={[styles.cellInner, mine && styles.cellMine]}>
                <AppText style={styles.emoji} maxFontSizeMultiplier={1}>
                  {e.emoji}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.root} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.tabs}>
        {searching ? (
          <>
            <Pressable
              onPress={closeSearch}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Back to categories"
              style={styles.tab}
            >
              <Feather name="arrow-left" size={19} color={colors.communityMuted} />
            </Pressable>
            <AppTextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search emoji"
              placeholderTextColor={colors.mutedLabel}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search emoji"
              style={styles.search}
            />
            {query ? (
              <Pressable
                onPress={() => setQuery('')}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Clear the search"
                style={styles.tab}
              >
                <Feather name="x" size={18} color={colors.communityMuted} />
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Pressable
              onPress={openSearch}
              accessibilityRole="button"
              accessibilityLabel="Search emoji"
              style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            >
              <Feather name="search" size={18} color={colors.communityMuted} />
            </Pressable>
            {tabs.map((t) => {
              const on = t.key === active;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => jumpTo(t.key)}
                  accessibilityRole="tab"
                  accessibilityLabel={t.title}
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
                >
                  <View style={[styles.tabInner, on && styles.tabOn]}>
                    <MaterialCommunityIcons
                      name={t.icon}
                      size={19}
                      color={on ? colors.purple : colors.communityMuted}
                    />
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </View>

      {width > 0 ? (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(it) => it.key}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={styles.listContent}
        />
      ) : null}

      {tones ? (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTones(null)} accessibilityLabel="Close skin tones" />
          <TonePicker emoji={tones.emoji} x={tones.x} y={tones.y} width={width} onChoose={choose} />
        </>
      ) : null}
    </View>
  );
});

/** The six versions of a held emoji, over it (under it near the top). */
function TonePicker({
  emoji,
  x,
  y,
  width,
  onChoose,
}: {
  emoji: Emoji;
  x: number;
  y: number;
  width: number;
  onChoose: (e: Emoji, emoji: string) => void;
}) {
  const options = [emoji.emoji, ...SKIN_TONES.map((t) => withTone(emoji.emoji, t))];
  const w = TONE_CELL * options.length + 8;
  const left = Math.min(Math.max(x - w / 2, 6), width - w - 6);
  const above = y - (TONE_CELL + 8) - 4 >= 0;
  const top = above ? y - (TONE_CELL + 8) - 4 : y + ROW_H + 4;
  return (
    <Reanimated.View entering={POPOVER_ENTER} style={[styles.tones, { left, top, width: w }]}>
      {options.map((o) => (
        <Pressable
          key={o}
          onPress={() => onChoose(emoji, o)}
          accessibilityRole="button"
          accessibilityLabel={`${emoji.name}${o === emoji.emoji ? '' : ', skin tone'}`}
          style={({ pressed }) => [styles.toneCell, pressed && styles.cellPressed]}
        >
          <AppText style={styles.emoji} maxFontSizeMultiplier={1}>
            {o}
          </AppText>
        </Pressable>
      ))}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  tabs: {
    height: TAB_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.communityHairline,
  },
  tab: { flex: 1, height: TAB_H, alignItems: 'center', justifyContent: 'center' },
  tabPressed: { opacity: 0.6 },
  tabInner: { width: 32, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.reactionMineBg },
  search: {
    flex: 8,
    height: 32,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: 16,
    backgroundColor: colors.inputBg,
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    color: colors.blackSoft,
  },
  listContent: { paddingHorizontal: PAD_X, paddingBottom: 8 },
  header: {
    height: HEADER_H,
    paddingTop: 9,
    paddingHorizontal: 6,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    lineHeight: 16,
    color: colors.communityMuted,
  },
  empty: {
    height: ROW_H * 2,
    paddingTop: 28,
    textAlign: 'center',
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    color: colors.communityMuted,
  },
  row: { height: ROW_H, flexDirection: 'row' },
  cell: { height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  cellPressed: { transform: [{ scale: 1.15 }] },
  cellInner: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cellMine: { backgroundColor: colors.reactionMineBg },
  emoji: { fontSize: 27, lineHeight: 34 },
  tones: {
    position: 'absolute',
    height: TONE_CELL + 8,
    padding: 4,
    flexDirection: 'row',
    borderRadius: 999,
    backgroundColor: colors.white,
    boxShadow: shadows.quickBarRaised,
  },
  toneCell: { width: TONE_CELL, height: TONE_CELL, alignItems: 'center', justifyContent: 'center' },
});
