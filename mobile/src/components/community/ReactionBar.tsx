import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Reanimated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnchoredModal, type WindowRect } from '../AnchoredModal';
import { AppText } from '../AppText';
import { usePostActions } from './PostActions';
import { QUICK_REACTIONS, REACTION_LONG_PRESS_MS } from '../../lib/community';
import { EASE_OUT, POPOVER_ENTER } from '../../lib/motion';
import { colors, shadows } from '../../theme';

/**
 * The React button and its quick bar — COMMUNITY_SPEC.md §5.1.
 *
 *   · tap React        — the quick bar; tapping React again closes it
 *   · long-press React — the quick bar too (the card's long-press calls `open`)
 *   · in the bar       — your current emoji sits first, on a reactionMineBg
 *                        circle: choosing it again removes it, another
 *                        replaces it. One picked from ⊕ takes the first place
 *                        too and the last of the six steps out, so removing
 *                        it never means finding it in the picker again
 *                        (owner, 12 Nov; the website's quickBar() does the same)
 *   · ⊕                — the full picker (spec §5.2), opened by the screen's
 *                        PostActionsProvider once the bar has closed
 *
 * A tap never gives ❤️ by itself (owner, 10 Nov; DESIGN.md "Touch"): it always
 * offers the six, or the other five would stay hidden. The runbook's CC-V4a
 * text ("tap React toggles ❤️") predates that decision; the spec wins.
 *
 * The bar opens in an AnchoredModal laid over the screen, measured from the
 * button, so it is never clipped by the card or the list. Like the website's
 * Popover (and Facebook's and LinkedIn's bars), its left end lines up with the
 * button's and it sits 8 above it; below it only when there's no room above.
 * It reports only the choice, through onReact(emoji | null).
 */

/** Quick-bar emoji: 26 in a 44 × 44 button on a touch screen (spec §5.1). */
const CELL = 44;
const BAR_PAD = 4;
const BAR_WIDTH = CELL * (QUICK_REACTIONS.length + 1) + BAR_PAD * 2;
const BAR_HEIGHT = CELL + BAR_PAD * 2;
const GAP = 8;
const EDGE = 8;
const STAGGER_MS = 18;

/** The bar's six: your reaction first, then the usual ones in their order. */
function quickBar(reaction: string | null): readonly string[] {
  if (!reaction) return QUICK_REACTIONS;
  return [reaction, ...QUICK_REACTIONS.filter((e) => e !== reaction)].slice(0, QUICK_REACTIONS.length);
}

export type ReactButtonHandle = { open: () => void };


export const ReactButton = memo(function ReactButton({
  reaction,
  onReact,
  ref,
}: {
  reaction: string | null;
  onReact: (emoji: string | null) => void;
  ref?: Ref<ReactButtonHandle>;
}) {
  const buttonRef = useRef<ViewInstance>(null);
  const [anchor, setAnchor] = useState<WindowRect | null>(null);
  const reduceMotion = useReducedMotion();
  const actions = usePostActions();

  const scale = useSharedValue(1);
  const ring = useSharedValue(0);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 1 - ring.value,
    transform: [{ scale: 0.6 + ring.value }],
  }));

  const open = useCallback(() => {
    buttonRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  }, []);
  useImperativeHandle(ref, () => ({ open }), [open]);

  const close = useCallback(() => setAnchor(null), []);

  const pick = useCallback(
    (next: string | null) => {
      onReact(next);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (next && !reduceMotion) {
        // The chosen emoji swells a little and settles, with a ring going out.
        // Timing curves only, no spring: the old spring wobbled (owner, 12 Nov).
        scale.value = withSequence(
          withTiming(1.2, { duration: 120, easing: EASE_OUT }),
          withTiming(1, { duration: 200, easing: Easing.inOut(Easing.cubic) }),
        );
        ring.value = 0;
        ring.value = withTiming(1, { duration: 320, easing: EASE_OUT }, () => {
          ring.value = 0;
        });
      }
    },
    [onReact, reduceMotion, scale, ring],
  );

  const choose = useCallback(
    (emoji: string) => {
      setAnchor(null);
      pick(emoji === reaction ? null : emoji);
    },
    [reaction, pick],
  );

  const more = useCallback(() => {
    setAnchor(null);
    // The picker toggles your current emoji off itself.
    actions?.openPicker({ current: reaction, onPick: pick });
  }, [actions, reaction, pick]);

  return (
    <>
      <Pressable
        ref={buttonRef}
        onPress={() => (anchor ? close() : open())}
        onLongPress={open}
        delayLongPress={REACTION_LONG_PRESS_MS}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={reaction ? `Your reaction ${reaction}. Change or remove it` : 'React'}
        accessibilityState={{ expanded: !!anchor }}
        style={({ pressed }) => [
          styles.reactPill,
          reaction ? styles.reactPillMine : null,
          pressed && (reaction ? styles.pillMinePressed : styles.pillPressed),
        ]}
      >
        <Reanimated.View pointerEvents="none" style={[styles.popRing, ringStyle]} />
        <Reanimated.View style={iconStyle}>
          {reaction ? (
            <AppText style={styles.reactEmoji} maxFontSizeMultiplier={1}>
              {reaction}
            </AppText>
          ) : (
            <Feather name="smile" size={15} color={colors.communityMuted} />
          )}
        </Reanimated.View>
      </Pressable>

      {anchor ? <QuickBar anchor={anchor} current={reaction} onChoose={choose} onMore={more} onClose={close} /> : null}
    </>
  );
});

function QuickBar({
  anchor,
  current,
  onChoose,
  onMore,
  onClose,
}: {
  anchor: WindowRect;
  current: string | null;
  onChoose: (emoji: string) => void;
  onMore: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <AnchoredModal anchor={anchor} onClose={onClose} closeLabel="Close reactions">
      {(button, layer) => {
        // The bar's left end on the button's, kept on screen; 8 above the
        // button, or 8 below it for a post at the very top of the feed.
        const left = Math.min(Math.max(button.x, EDGE), layer.width - BAR_WIDTH - EDGE);
        const above = button.y - GAP - BAR_HEIGHT >= insets.top + EDGE;
        const top = above ? button.y - GAP - BAR_HEIGHT : button.y + button.height + GAP;
        // It grows out of the button: scale from the point over (or under) it.
        const originX = Math.min(Math.max(button.x + button.width / 2 - left, 0), BAR_WIDTH);
        return (
          <Reanimated.View
            entering={POPOVER_ENTER}
            style={[styles.bar, { left, top, transformOrigin: [originX, above ? BAR_HEIGHT : 0, 0] }]}
            accessibilityRole="toolbar"
            accessibilityLabel="Reactions"
          >
            {quickBar(current).map((emoji, i) => {
              const mine = emoji === current;
              return (
                <Reanimated.View key={emoji} entering={FadeIn.delay(i * STAGGER_MS).duration(180)}>
                  <Pressable
                    onPress={() => onChoose(emoji)}
                    accessibilityRole="button"
                    accessibilityLabel={mine ? `${emoji}, your reaction. Remove it` : `React with ${emoji}`}
                    accessibilityState={{ selected: mine }}
                    style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
                  >
                    <View style={[styles.cellInner, mine && styles.cellMine]}>
                      <AppText style={styles.quickEmoji} maxFontSizeMultiplier={1}>
                        {emoji}
                      </AppText>
                    </View>
                  </Pressable>
                </Reanimated.View>
              );
            })}
            <Reanimated.View entering={FadeIn.delay(QUICK_REACTIONS.length * STAGGER_MS).duration(180)}>
              {/* ⊕ — the full emoji picker (spec §5.2). */}
              <Pressable
                onPress={onMore}
                accessibilityRole="button"
                accessibilityLabel="More emoji"
                style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
              >
                <Feather name="plus-circle" size={21} color={colors.communityMuted} />
              </Pressable>
            </Reanimated.View>
          </Reanimated.View>
        );
      }}
    </AnchoredModal>
  );
}

const styles = StyleSheet.create({
  /* The React pill (spec §3 "Actions", §5.1): 30 × 24, icons only. */
  reactPill: {
    width: 30,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.communityPill,
    borderWidth: 1,
    borderColor: colors.communityHairline,
  },
  reactPillMine: {
    backgroundColor: colors.reactionMineBg,
    borderColor: colors.reactionMineBorder,
  },
  pillPressed: { backgroundColor: colors.communityPillPressed, transform: [{ scale: 0.96 }] },
  pillMinePressed: { backgroundColor: colors.communityPillMinePressed, transform: [{ scale: 0.96 }] },
  reactEmoji: { fontSize: 14, lineHeight: 18 },
  popRing: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.communityLike,
  },

  bar: {
    position: 'absolute',
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    padding: BAR_PAD,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: colors.white,
    boxShadow: shadows.quickBarRaised,
  },
  cell: {
    width: CELL,
    height: CELL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CELL / 2,
  },
  cellPressed: { transform: [{ scale: 1.18 }, { translateY: -3 }] },
  cellInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellMine: { backgroundColor: colors.reactionMineBg },
  quickEmoji: { fontSize: 26, lineHeight: 32 },
});
