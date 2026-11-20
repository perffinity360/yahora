import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Reanimated, {
  FadeOut,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '../AppText';
import { EASE_OUT } from '../../lib/motion';
import { colors, font, shadows } from '../../theme';

/**
 * The feed's way to write a post on a phone (owner, 13 Nov): a floating pill,
 * a pencil in a white circle and "Post", in the feed's strong colour. It
 * replaced the composer dock, which took a row of the screen only to open the
 * compose screen anyway. The posts scroll on underneath it.
 *
 * It sits in the bottom right corner, the thumb's side, like the compose
 * buttons of X, Threads and Gmail, and like Gmail's it **folds to the round
 * pencil while you scroll down** and opens out again when you scroll up or
 * reach the top (`folded`, from the feed), so it covers less of the posts.
 *
 * A half-written post puts a small blue badge, ringed in white, on its top
 * right corner (owner, 13 Nov: the pink dot inside the circle clashed with the
 * pink pill). Blue is the brand's third colour and stands apart from both
 * zones' pills; the ring keeps it clear over the pill and the card behind.
 */
export const FAB_HEIGHT = 44;

/** The button stays open within this of the top, and folds or opens only after
 *  this much travel between two scroll events, so a resting finger doesn't
 *  make it flicker. */
const OPEN_NEAR_TOP = 24;
const FOLD_TRAVEL = 4;

/** Folded while scrolling down, open on the way up or near the top: hand
 *  `onScroll` to the list and `folded` to PostFab. */
export function useFabFold() {
  const [folded, setFolded] = useState(false);
  const foldedRef = useRef(false);
  const lastY = useRef(0);
  const onScroll = useCallback((y: number) => {
    const dy = y - lastY.current;
    lastY.current = y;
    let fold = foldedRef.current;
    if (y < OPEN_NEAR_TOP) fold = false;
    else if (dy > FOLD_TRAVEL) fold = true;
    else if (dy < -FOLD_TRAVEL) fold = false;
    if (fold !== foldedRef.current) {
      foldedRef.current = fold;
      setFolded(fold);
    }
  }, []);
  return { folded, onScroll };
}
/** Its distance from the screen's right edge and from the tab bar. */
export const FAB_MARGIN = 16;
/** How much of the screen's bottom the button covers, for the list's padding,
 *  the toast and anything brought into view. */
export const FAB_CLEARANCE = FAB_HEIGHT + FAB_MARGIN;
/** Below a list's last post, over whatever sits at the bottom (this button, the
 *  view-only line, the tab bar). With the card's own 6 under it, the last post
 *  ends 10 above, near the 6 between posts (owner, 18 Nov: 22 felt too large). */
export const LIST_END_GAP = 4;

const ICON = 34;
const PAD = (FAB_HEIGHT - ICON) / 2;
const LABEL_GAP = 9;
const PAD_END = 17;
/** "Post" at 15 is about this wide; the real width replaces it once measured. */
const LABEL_GUESS = 34;
const FOLD = { duration: 220, easing: EASE_OUT };

/* It rises 10 and fades in, on the app's ease-out curve, with no overshoot
   (DESIGN.md "Motion": nothing that opens bounces). */
const FAB_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.96 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: EASE_OUT },
}).duration(220);

export const PostFab = memo(function PostFab({
  zone,
  hint,
  hasDraft,
  folded,
  onPress,
  reply = false,
  bottomInset = 0,
}: {
  zone: 'campus' | 'world';
  /** On a post's own page it opens a reply, and says so (owner, 15 Nov: the
   *  feed's button there too, in place of the reply bar). */
  reply?: boolean;
  /** Where nothing sits under it (the post page has no tab bar): the phone's own bar. */
  bottomInset?: number;
  /** Where the post will go, read out by a screen reader. */
  hint: string;
  hasDraft: boolean;
  /** Just the pencil: the feed is being scrolled down. */
  folded: boolean;
  onPress: () => void;
}) {
  const fill = zone === 'campus' ? colors.purpleDark : colors.communityWorldStrong;
  const open = useSharedValue(folded ? 0 : 1);
  const labelW = useSharedValue(LABEL_GUESS);

  useEffect(() => {
    open.value = withTiming(folded ? 0 : 1, FOLD);
  }, [folded, open]);

  const pillStyle = useAnimatedStyle(() => ({ paddingRight: PAD + (PAD_END - PAD) * open.value }));
  const labelStyle = useAnimatedStyle(() => ({
    width: (LABEL_GAP + labelW.value) * open.value,
    opacity: open.value,
  }));

  return (
    <Reanimated.View
      entering={FAB_IN}
      exiting={FadeOut.duration(160)}
      style={[styles.wrap, bottomInset ? { bottom: FAB_MARGIN + bottomInset } : null]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={
          reply
            ? hasDraft
              ? `Continue your reply. ${hint}`
              : `Write a reply. ${hint}`
            : hasDraft
              ? `Continue your post. ${hint}`
              : `Write a post. ${hint}`
        }
        hitSlop={6}
      >
        {({ pressed }) => (
          <Reanimated.View style={[styles.pill, { backgroundColor: fill }, pillStyle, pressed && styles.pressed]}>
            <View style={styles.icon}>
              <Feather name="edit-3" size={17} color={fill} />
            </View>
            <Reanimated.View style={[styles.labelBox, labelStyle]}>
              <AppText
                numberOfLines={1}
                onLayout={(e) => {
                  labelW.value = e.nativeEvent.layout.width;
                }}
                style={styles.label}
              >
                {reply ? 'Reply' : 'Post'}
              </AppText>
            </Reanimated.View>
            {hasDraft ? <View style={styles.draft} /> : null}
          </Reanimated.View>
        )}
      </Pressable>
    </Reanimated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: FAB_MARGIN, bottom: FAB_MARGIN },
  pill: {
    height: FAB_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: PAD,
    borderRadius: FAB_HEIGHT / 2,
    // A hairline of white keeps its edge clear over the doodles and the cards.
    borderWidth: 1,
    borderColor: colors.postFabRing,
    boxShadow: shadows.postFab,
  },
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.94 },
  icon: {
    width: ICON - 2,
    height: ICON - 2,
    borderRadius: (ICON - 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  // Clips the word as it folds; the word keeps its own width inside.
  labelBox: { height: 20, overflow: 'hidden' },
  label: {
    position: 'absolute',
    left: LABEL_GAP,
    top: 0,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.bodyLg,
    lineHeight: 20,
    color: colors.white,
    letterSpacing: 0.2,
  },
  draft: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: colors.white,
    backgroundColor: colors.blue,
  },
});
