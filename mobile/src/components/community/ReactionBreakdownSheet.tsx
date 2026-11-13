import Feather from '@expo/vector-icons/Feather';
import { useEffect } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../AppText';
import { ModalSafeArea } from '../ModalSafeArea';
import { formatCount, sortedReactions } from '../../lib/community';
import { SHEET_RISE } from '../../lib/motion';
import { colors, font } from '../../theme';

/**
 * The breakdown — COMMUNITY_SPEC.md §5.4, a bottom sheet in the app:
 *
 *            724 reactions
 *   ( ⊕ )   ( ❤️ 373 )  ( 😮 95 )
 *   ( 👍 20 ) ( 🙏 17 ) ( 😢 13 )
 *
 * Pills of emoji + count, biggest first, three to a row, with ⊕ (add your own,
 * the full picker) first. Counts only: who reacted is never shown.
 *
 * HOW IT OPENS, WITHOUT A JUMP (owner, 13 Nov: "it jumps while doing so").
 *   · The bottom padding comes from `ModalSafeArea`, the Modal's own insets,
 *     known before the first frame. The screen's insets from outside the Modal
 *     left the pills under the POCO's three-button bar; the native SafeAreaView
 *     that fixed it added its padding a frame late, so the sheet grew mid-rise.
 *   · The rise is our own (`shown`, 0 → 1, over the sheet's measured height),
 *     not `SlideInDown`, which can draw the sheet in place for a frame first.
 *     The sheet starts a whole screen down, so it is never seen before it moves.
 *   · The scrim fades in on the same clock, so the dark never arrives first.
 */
export function ReactionBreakdownSheet(props: {
  counts: Record<string, number>;
  total: number;
  mine: string | null;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={props.onClose}>
      <ModalSafeArea>
        <Sheet {...props} />
      </ModalSafeArea>
    </Modal>
  );
}

function Sheet({
  counts,
  total,
  mine,
  onAdd,
  onClose,
}: {
  counts: Record<string, number>;
  total: number;
  mine: string | null;
  onAdd: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const rows = sortedReactions(counts);

  const shown = useSharedValue(reduceMotion ? 1 : 0);
  const sheetHeight = useSharedValue(Dimensions.get('screen').height);
  useEffect(() => {
    if (!reduceMotion) shown.value = withTiming(1, SHEET_RISE);
  }, [reduceMotion, shown]);
  const riseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - shown.value) * sheetHeight.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: shown.value }));

  return (
    <View style={styles.root}>
      <Reanimated.View style={[styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Reanimated.View>
      <Reanimated.View
        onLayout={(e) => {
          sheetHeight.value = e.nativeEvent.layout.height;
        }}
        style={[styles.sheet, { paddingBottom: insets.bottom + 16 }, riseStyle]}
      >
        <View style={styles.handle} />
        <AppText style={styles.title} accessibilityRole="header">
          {formatCount(total)} {total === 1 ? 'reaction' : 'reactions'}
        </AppText>
        <ScrollView contentContainerStyle={styles.grid}>
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="Add your own reaction"
            style={({ pressed }) => [styles.cell, styles.pill, pressed && styles.pressed]}
          >
            <Feather name="plus-circle" size={18} color={colors.purple} />
          </Pressable>
          {rows.map(([emoji, count]) => (
            <View
              key={emoji}
              style={[styles.cell, styles.pill, emoji === mine && styles.pillMine]}
              accessible
              accessibilityLabel={`${emoji} ${count}${emoji === mine ? ', yours' : ''}`}
            >
              <AppText style={styles.emoji} maxFontSizeMultiplier={1}>
                {emoji}
              </AppText>
              <AppText style={[styles.count, emoji === mine && styles.countMine]}>{formatCount(count)}</AppText>
            </View>
          ))}
        </ScrollView>
      </Reanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.sheetScrimLight },
  sheet: {
    maxHeight: '70%',
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.white,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
    backgroundColor: colors.sheetHandle,
  },
  title: {
    textAlign: 'center',
    marginBottom: 14,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.bodyLg,
    color: colors.blackSoft,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Three to a row: a third of the row, less the two gaps shared out.
  cell: { width: '31.5%' },
  pill: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.reactionPillBg,
    borderWidth: 1,
    borderColor: colors.reactionPillBorder,
  },
  pillMine: { backgroundColor: colors.reactionMineBg, borderColor: colors.reactionMineBorder },
  pressed: { backgroundColor: colors.reactionMineBg },
  emoji: { fontSize: 18, lineHeight: 24 },
  count: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.body,
    color: colors.communityMuted,
    fontVariant: ['tabular-nums'],
  },
  countMine: { color: colors.purple },
});
