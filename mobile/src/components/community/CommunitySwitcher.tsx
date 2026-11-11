import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import Reanimated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../AppText';
import { GlobeIcon } from './GlobeIcon';
import { countryName, flagEmoji, GLOBAL, type FeedSort, type WorldFeed } from '../../lib/community';
import { colors, font, shadows } from '../../theme';
import type { Country } from '../../types';

/**
 * The floating switcher — COMMUNITY_SPEC.md §1.2: transparent and sticky at the
 * top, only its pills take touches, and the posts pass underneath.
 *
 *   ( (cap) [🇮🇳 India ⌄] )                     ( [🔥|🕐] )
 *
 *   · the cap selects your campus feed;
 *   · the country / Global segment: off it, a tap selects it; on it, a tap on
 *     the name opens the dropdown too, like the chevron (owner, 8 Nov: the
 *     chevron alone was too small a target on a phone);
 *   · Hot · New sits at the right end, on the country / Global side only.
 *
 * The website's brand pill isn't here: the app has its tab bar.
 */
export const SWITCHER_HEIGHT = 50;
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);

export function worldLabel(world: WorldFeed, countries: Country[]) {
  return world === GLOBAL ? 'Global' : countryName(world, countries);
}

export function WorldGlyph({ world, size }: { world: WorldFeed; size: number }) {
  if (world === GLOBAL) return <GlobeIcon size={size} />;
  return (
    <AppText style={{ fontSize: size - 1, lineHeight: size + 3 }} maxFontSizeMultiplier={1}>
      {flagEmoji(world)}
    </AppText>
  );
}

export const CommunitySwitcher = memo(function CommunitySwitcher({
  side,
  world,
  countries,
  sort,
  onSide,
  onWorld,
  onSort,
}: {
  side: 'campus' | 'world';
  /** null while your country is still being worked out. */
  world: WorldFeed | null;
  countries: Country[];
  sort: FeedSort;
  onSide: (side: 'campus' | 'world') => void;
  onWorld: (world: WorldFeed) => void;
  onSort: (sort: FeedSort) => void;
}) {
  const insets = useSafeAreaInsets();
  const worldRef = useRef<ViewInstance>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; width: number } | null>(null);
  const onWorldSide = side === 'world';

  const openMenu = () => {
    worldRef.current?.measureInWindow((x, y, width, height) => setMenu({ x, y: y + height, width }));
  };

  const onWorldPress = () => {
    if (!onWorldSide) onSide('world');
    else if (menu) setMenu(null);
    else openMenu();
  };

  return (
    <View style={[styles.bar, { top: insets.top }]} pointerEvents="box-none">
      <View style={styles.segments}>
        <Pressable
          onPress={() => onSide('campus')}
          hitSlop={{ top: 8, bottom: 8, left: 6 }}
          accessibilityRole="button"
          accessibilityLabel="My campus"
          accessibilityState={{ selected: !onWorldSide }}
          style={({ pressed }) => [
            styles.segment,
            styles.segmentIcon,
            !onWorldSide && styles.segmentActive,
            pressed && styles.segmentPressed,
          ]}
        >
          <Ionicons name="school" size={17} color={onWorldSide ? colors.communityMuted : colors.white} />
        </Pressable>

        <View ref={worldRef} collapsable={false} style={[styles.worldSegment, onWorldSide && styles.segmentActive]}>
          <Pressable
            onPress={onWorldPress}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityLabel={world ? worldLabel(world, countries) : 'Country'}
            accessibilityHint={onWorldSide ? 'Choose a feed' : undefined}
            accessibilityState={{ selected: onWorldSide, expanded: onWorldSide ? !!menu : undefined }}
            style={({ pressed }) => [styles.segment, styles.worldButton, pressed && styles.segmentPressed]}
          >
            {world ? <WorldGlyph world={world} size={15} /> : null}
            <AppText
              numberOfLines={1}
              style={[styles.segmentName, onWorldSide && styles.segmentNameActive]}
            >
              {world ? worldLabel(world, countries) : '…'}
            </AppText>
          </Pressable>
          {/* Its own button, inside the purple, only once you're on this feed. */}
          {onWorldSide ? (
            <Reanimated.View entering={FadeIn.duration(160)}>
              <Pressable
                onPress={() => (menu ? setMenu(null) : openMenu())}
                hitSlop={{ top: 8, bottom: 8, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Choose a feed"
                accessibilityState={{ expanded: !!menu }}
                style={styles.chevron}
              >
                <Feather name={menu ? 'chevron-up' : 'chevron-down'} size={14} color={colors.white} />
              </Pressable>
            </Reanimated.View>
          ) : null}
        </View>
      </View>

      {onWorldSide ? <SortSwitch sort={sort} onSort={onSort} /> : null}

      {menu ? (
        <CountryMenu
          anchor={menu}
          countries={countries}
          selected={world}
          onPick={(next) => {
            setMenu(null);
            onWorld(next);
          }}
          onClose={() => setMenu(null)}
        />
      ) : null}
    </View>
  );
});

/** Hot · New: two icons with a thumb that slides between them (spec §1.1). */
const SORT_CELL = 24;

function SortSwitch({ sort, onSort }: { sort: FeedSort; onSort: (sort: FeedSort) => void }) {
  const x = useSharedValue(sort === 'new' ? SORT_CELL : 0);
  useEffect(() => {
    x.value = withTiming(sort === 'new' ? SORT_CELL : 0, { duration: 220, easing: EASE });
  }, [sort, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Reanimated.View entering={FadeIn.duration(180)} style={styles.sortPill} accessibilityRole="radiogroup" accessibilityLabel="Sort posts">
      <Reanimated.View style={[styles.sortThumb, thumb]} />
      {(['hot', 'new'] as const).map((value) => {
        const on = sort === value;
        return (
          <Pressable
            key={value}
            onPress={() => onSort(value)}
            hitSlop={{ top: 11, bottom: 11, left: value === 'hot' ? 6 : 2, right: value === 'new' ? 6 : 2 }}
            accessibilityRole="radio"
            accessibilityLabel={value === 'hot' ? 'Hot' : 'New'}
            accessibilityState={{ checked: on }}
            style={styles.sortCell}
          >
            <Ionicons
              name={value === 'hot' ? (on ? 'flame' : 'flame-outline') : on ? 'time' : 'time-outline'}
              size={14}
              color={on ? colors.purple : colors.communityMuted}
            />
          </Pressable>
        );
      })}
    </Reanimated.View>
  );
}

/**
 * The country dropdown — spec §1.3: your country first, Global second, then the
 * other countries A–Z, the selected one ticked. It hangs from the purple pill.
 */
function CountryMenu({
  anchor,
  countries,
  selected,
  onPick,
  onClose,
}: {
  anchor: { x: number; y: number; width: number };
  countries: Country[];
  selected: WorldFeed | null;
  onPick: (world: WorldFeed) => void;
  onClose: () => void;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const mine = countries.find((c) => c.is_mine);
  const others = countries.filter((c) => !c.is_mine).sort((a, b) => a.name.localeCompare(b.name));
  const width = Math.min(260, screenW - 16);
  const left = Math.min(Math.max(anchor.x, 8), screenW - width - 8);
  const top = anchor.y + 6;

  const row = (value: WorldFeed, label: string, note?: string) => {
    const on = value === selected;
    return (
      <Pressable
        key={value}
        onPress={() => onPick(value)}
        accessibilityRole="menuitem"
        accessibilityState={{ selected: on }}
        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
      >
        <WorldGlyph world={value} size={16} />
        <AppText numberOfLines={1} style={[styles.optionText, on && styles.optionTextOn]}>
          {label}
          {note ? <AppText style={styles.optionNote}>{` ${note}`}</AppText> : null}
        </AppText>
        {on ? <Feather name="check" size={15} color={colors.purple} /> : null}
      </Pressable>
    );
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <Reanimated.View
        entering={ZoomIn.springify().damping(18).stiffness(280)}
        style={[
          styles.menu,
          { left, top, width, maxHeight: screenH - top - insets.bottom - 80, transformOrigin: 'top left' },
        ]}
        accessibilityRole="menu"
      >
        <ScrollView bounces={false}>
          {mine ? row(mine.code, mine.name, '(your country)') : null}
          {row(GLOBAL, 'Global')}
          {others.length ? <View style={styles.menuRule} /> : null}
          {others.map((c) => row(c.code, c.name))}
        </ScrollView>
      </Reanimated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SWITCHER_HEIGHT,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  segments: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 999,
    backgroundColor: colors.communityGlass,
    borderWidth: 1,
    borderColor: colors.communityHairline,
    boxShadow: shadows.communityFloat,
  },
  segment: {
    height: 28,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentIcon: { width: 34, justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.purple },
  segmentPressed: { transform: [{ scale: 0.96 }] },
  worldSegment: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
  },
  worldButton: { flexShrink: 1, minWidth: 0, gap: 5, paddingHorizontal: 10 },
  segmentName: {
    flexShrink: 1,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    lineHeight: 16,
    color: colors.communityMuted,
  },
  segmentNameActive: { color: colors.white },
  chevron: { width: 22, height: 28, marginLeft: -6, marginRight: 4, alignItems: 'center', justifyContent: 'center' },

  sortPill: {
    flexDirection: 'row',
    padding: 5,
    borderRadius: 999,
    backgroundColor: colors.communityGlass,
    borderWidth: 1,
    borderColor: colors.communityHairline,
    boxShadow: shadows.communityFloat,
  },
  sortThumb: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: SORT_CELL,
    height: 22,
    borderRadius: 999,
    backgroundColor: colors.reactionMineBg,
  },
  sortCell: { width: SORT_CELL, height: 22, alignItems: 'center', justifyContent: 'center' },

  menu: {
    position: 'absolute',
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.white,
    boxShadow: shadows.quickBar,
    overflow: 'hidden',
  },
  option: {
    minHeight: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionPressed: { backgroundColor: colors.reactionMineBg },
  optionText: {
    flex: 1,
    fontFamily: font.family.medium,
    fontSize: font.sizes.body,
    lineHeight: 18,
    color: colors.blackSoft,
  },
  optionTextOn: { color: colors.purple },
  optionNote: { fontFamily: font.family.regular, color: colors.communityMuted },
  menuRule: { height: 1, marginVertical: 4, backgroundColor: colors.communityHairline },
});
