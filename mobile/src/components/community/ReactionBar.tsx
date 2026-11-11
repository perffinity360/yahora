import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View, type ViewInstance } from 'react-native';
import Reanimated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../AppText';
import { usePostActions } from './PostActions';
import { QUICK_REACTIONS, REACTION_LONG_PRESS_MS } from '../../lib/community';
import { colors, shadows } from '../../theme';

/**
 * The React button and its quick bar — COMMUNITY_SPEC.md §5.1.
 *
 *   · tap React        — the quick bar; tapping React again closes it
 *   · long-press React — the quick bar too (the card's long-press calls `open`)
 *   · in the bar       — your current emoji sits on a reactionMineBg circle:
 *                        choosing it again removes it, another replaces it
 *   · ⊕                — the full picker (spec §5.2), opened by the screen's
 *                        PostActionsProvider once the bar has closed
 *
 * A tap never gives ❤️ by itself (owner, 10 Nov; DESIGN.md "Touch"): it always
 * offers the six, or the other five would stay hidden. The runbook's CC-V4a
 * text ("tap React toggles ❤️") predates that decision; the spec wins.
 *
 * The bar opens in a transparent Modal laid over the screen, measured from the
 * button, so it is never clipped by the card or the list. It reports only the
 * choice, through onReact(emoji | null).
 */

/** Quick-bar emoji: 26 in a 44 × 44 button on a touch screen (spec §5.1). */
const CELL = 44;
const BAR_PAD = 4;
const BAR_WIDTH = CELL * (QUICK_REACTIONS.length + 1) + BAR_PAD * 2;
const BAR_HEIGHT = CELL + BAR_PAD * 2;
const GAP = 8;
const EDGE = 8;
const STAGGER_MS = 18;
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1); // communityEase

export type ReactButtonHandle = { open: () => void };

type Anchor = { x: number; y: number; width: number; height: number };

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
  const [anchor, setAnchor] = useState<Anchor | null>(null);
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
        // The chosen emoji pops, up to 1.35 over 320 ms, with a ring going out.
        scale.value = withSequence(
          withTiming(1.35, { duration: 140, easing: EASE }),
          withSpring(1, { damping: 9, stiffness: 260 }),
        );
        ring.value = 0;
        ring.value = withTiming(1, { duration: 320, easing: EASE }, () => {
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
  anchor: Anchor;
  current: string | null;
  onChoose: (emoji: string) => void;
  onMore: () => void;
  onClose: () => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Over the button, its left end a little left of the button so the button
  // sits under the first emojis; kept on screen. Below it when there's no room
  // above (a post at the very top of the feed).
  const left = Math.min(Math.max(anchor.x - CELL / 2, EDGE), screenW - BAR_WIDTH - EDGE);
  const above = anchor.y - GAP - BAR_HEIGHT >= insets.top + EDGE;
  const top = above ? anchor.y - GAP - BAR_HEIGHT : anchor.y + anchor.height + GAP;
  // It springs from the button: scale from the point over (or under) it.
  const originX = Math.min(Math.max(anchor.x + anchor.width / 2 - left, 0), BAR_WIDTH);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close reactions" />
      <Reanimated.View
        entering={ZoomIn.springify().damping(16).stiffness(260)}
        style={[
          styles.bar,
          { left, top, transformOrigin: [originX, above ? BAR_HEIGHT : 0, 0] },
        ]}
        accessibilityRole="toolbar"
        accessibilityLabel="Reactions"
      >
        {QUICK_REACTIONS.map((emoji, i) => {
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
    </Modal>
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
    boxShadow: shadows.quickBar,
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
