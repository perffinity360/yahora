import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../AppText';
import { usePostActions } from './PostActions';
import { formatCount, topReactions } from '../../lib/community';
import { colors, font } from '../../theme';
import type { PostItem } from '../../types';

/**
 * The summary pill under a post — COMMUNITY_SPEC.md §5.3: the top 4 emojis by
 * count (REACTION_SUMMARY_COUNT), then the total. Hidden when nobody has
 * reacted; tinted once you have. Tapping it opens the breakdown (§5.4), whose
 * ⊕ opens the full picker; both live in the screen's PostActionsProvider.
 */
export const ReactionSummary = memo(function ReactionSummary({
  post,
  onReact,
}: {
  post: PostItem;
  onReact: (emoji: string | null) => void;
}) {
  const actions = usePostActions();
  const total = post.reactions_total;
  if (!total) return null;
  const mine = post.viewer_reaction;
  const top = topReactions(post.reaction_counts);
  return (
    <Pressable
      onPress={() => actions?.openBreakdown({ post, onReact })}
      hitSlop={{ top: 10, bottom: 10 }}
      accessibilityRole="button"
      accessibilityLabel={`${total} ${total === 1 ? 'reaction' : 'reactions'}: ${top.join(' ')}. Show the breakdown`}
      style={({ pressed }) => [
        styles.pill,
        mine ? styles.pillMine : null,
        pressed && (mine ? styles.pillMinePressed : styles.pillPressed),
      ]}
    >
      <View style={styles.emojis}>
        {top.map((emoji) => (
          <AppText key={emoji} style={styles.emoji} maxFontSizeMultiplier={1}>
            {emoji}
          </AppText>
        ))}
      </View>
      <AppText style={[styles.count, mine ? styles.countMine : null]}>{formatCount(total)}</AppText>
    </Pressable>
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
  pillPressed: { backgroundColor: colors.communityPillPressed, transform: [{ scale: 0.96 }] },
  pillMinePressed: { backgroundColor: colors.communityPillMinePressed, transform: [{ scale: 0.96 }] },
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
