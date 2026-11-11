import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../AppText';
import { formatCount, topReactions } from '../../lib/community';
import { colors, font } from '../../theme';

/**
 * The summary pill under a post — COMMUNITY_SPEC.md §5.3: the top 4 emojis by
 * count (REACTION_SUMMARY_COUNT), then the total. Hidden when nobody has
 * reacted; tinted once you have.
 *
 * Tapping it opens the breakdown (§5.4), which arrives in part 3 (CC-V4c).
 * Until then it's a plain View, so it doesn't look pressable and do nothing.
 */
export const ReactionSummary = memo(function ReactionSummary({
  counts,
  total,
  mine,
}: {
  counts: Record<string, number>;
  total: number;
  mine: string | null;
}) {
  if (!total) return null;
  const top = topReactions(counts);
  return (
    <View
      style={[styles.pill, mine ? styles.pillMine : null]}
      accessible
      accessibilityLabel={`${total} ${total === 1 ? 'reaction' : 'reactions'}: ${top.join(' ')}`}
    >
      <View style={styles.emojis}>
        {top.map((emoji) => (
          <AppText key={emoji} style={styles.emoji} maxFontSizeMultiplier={1}>
            {emoji}
          </AppText>
        ))}
      </View>
      <AppText style={[styles.count, mine ? styles.countMine : null]}>{formatCount(total)}</AppText>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 7,
    paddingRight: 9,
    borderRadius: 999,
    backgroundColor: colors.communityPill,
    borderWidth: 1,
    borderColor: colors.communityHairline,
  },
  pillMine: {
    backgroundColor: colors.reactionMineBg,
    borderColor: colors.reactionMineBorder,
  },
  emojis: { flexDirection: 'row', gap: 2 },
  emoji: { fontSize: 14, lineHeight: 18 },
  count: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.caption,
    lineHeight: 16,
    color: colors.communityMuted,
    fontVariant: ['tabular-nums'],
  },
  countMine: { color: colors.purple },
});
