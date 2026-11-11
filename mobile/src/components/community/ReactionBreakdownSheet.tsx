import Feather from '@expo/vector-icons/Feather';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Reanimated, { Easing, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../AppText';
import { formatCount, sortedReactions } from '../../lib/community';
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
 */
const SHEET_ENTER = SlideInDown.duration(280).easing(Easing.out(Easing.cubic));

export function ReactionBreakdownSheet({
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
  const rows = sortedReactions(counts);
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
        <Reanimated.View entering={SHEET_ENTER} style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
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
    </Modal>
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
