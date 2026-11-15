import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { memo, useEffect } from 'react';
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
/** Its distance from the screen's right edge and from the tab bar. */
export const FAB_MARGIN = 16;
/** How much of the screen's bottom the button covers, for the list's padding,
 *  the toast and anything brought into view. */
export const FAB_CLEARANCE = FAB_HEIGHT + FAB_MARGIN;

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
}: {
  zone: 'campus' | 'world';
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
    <Reanimated.View entering={FAB_IN} exiting={FadeOut.duration(160)} style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={hasDraft ? `Continue your post. ${hint}` : `Write a post. ${hint}`}
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
                Post
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
