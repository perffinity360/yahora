import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, font, spacing } from '../theme';
import { AppText } from './AppText';

/**
 * The marketplace grid's "List an item" button, which folds down to a round +
 * once the student starts scrolling and opens back out at the top.
 *
 * Folded, it is the swipe deck's list button exactly (SwipeDeck `listBtn`):
 * a 48dp gradient disc with a 22dp plus. So the + reads as the same control in
 * both views, and the pill is just that disc with its label showing.
 *
 * ── HOW IT FOLDS ──
 * The plus is always drawn at 22 inside a 22dp box that sits (48 − 22) / 2 in
 * from the left — the disc's own inset — and is scaled down to 17 while the
 * label shows. So the icon never moves sideways: the pill's right edge (it is
 * anchored by `right`) slides in over the label while the label fades, the
 * height grows 44 → 48, and the plus grows into place.
 *
 * The open width is the label's natural width, read off an invisible copy of
 * the open pill rather than hardcoded, so a longer string or a bigger system
 * font still opens to exactly the right size.
 *
 * `collapsed` is a shared value (0 or 1) the screen flips from its scroll
 * handler only when the offset crosses the threshold. Nothing here re-renders
 * the screen; the animation runs on the UI thread.
 */
const SIZE = 48; // SwipeDeck's ACTION_SIZE
const OPEN_HEIGHT = 44;
const GLYPH = 22; // SwipeDeck's plus
const OPEN_GLYPH = 17;
const INSET = (SIZE - GLYPH) / 2;
const BRAND = [colors.purple, colors.pinkDark] as const;
const FOLD = { duration: 260, easing: Easing.bezier(0.2, 0, 0, 1) };
const PRESS_SPRING = { damping: 20, stiffness: 320 };

export function ListItemFab({
  collapsed,
  onPress,
  style,
}: {
  collapsed: SharedValue<number>;
  onPress: () => void;
  /** Position only (absolute offsets). */
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const openWidth = useSharedValue(0);
  const labelWidth = useSharedValue(0);
  const pressed = useSharedValue(0);

  useAnimatedReaction(
    () => collapsed.value,
    (target, previous) => {
      if (target === previous) return;
      progress.value = reduceMotion ? target : withTiming(target, FOLD);
    },
    [reduceMotion],
  );

  const shell = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      height: interpolate(p, [0, 1], [OPEN_HEIGHT, SIZE]),
      // Until the copy below has been measured, the pill sizes itself.
      ...(openWidth.value > 0 ? { width: interpolate(p, [0, 1], [openWidth.value, SIZE]) } : null),
      opacity: 1 - pressed.value * 0.08,
      transform: [{ scale: 1 - pressed.value * 0.03 }],
    };
  });
  const glyph = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [OPEN_GLYPH / GLYPH, 1]) }],
  }));
  // Gone by 60% of the fold, before the edge reaches the text. Held at its
  // natural width: left to the row, it would be squeezed as the pill narrows
  // and show "List an…" on the way out.
  const label = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6], [1, 0], Extrapolation.CLAMP),
    ...(labelWidth.value > 0 ? { width: labelWidth.value + 1 } : null),
  }));

  const glyphIcon = <Feather name="plus" size={GLYPH} color={colors.white} />;
  const labelText = (
    <AppText style={styles.text} numberOfLines={1}>
      List an item
    </AppText>
  );

  return (
    <>
      <View
        style={[styles.row, styles.measure]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onLayout={(e) => {
          openWidth.value = e.nativeEvent.layout.width;
        }}
      >
        <View style={[styles.glyph, { transform: [{ scale: OPEN_GLYPH / GLYPH }] }]}>{glyphIcon}</View>
        <View
          style={styles.label}
          onLayout={(e) => {
            labelWidth.value = e.nativeEvent.layout.width;
          }}
        >
          {labelText}
        </View>
      </View>

      <Animated.View style={[styles.fab, style, shell]}>
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            pressed.value = withSpring(1, PRESS_SPRING);
          }}
          onPressOut={() => {
            pressed.value = withSpring(0, PRESS_SPRING);
          }}
          accessibilityRole="button"
          accessibilityLabel="List an item"
          style={styles.press}
        >
          <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={[styles.row, styles.fill]}>
            <Animated.View style={[styles.glyph, glyph]}>{glyphIcon}</Animated.View>
            <Animated.View style={[styles.label, label]}>{labelText}</Animated.View>
          </View>
        </Pressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: colors.purple,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  press: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: INSET,
    paddingRight: spacing.md,
  },
  fill: {
    flex: 1,
  },
  /** The open pill at its natural size, for its width only. */
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: OPEN_HEIGHT,
    opacity: 0,
  },
  glyph: {
    width: GLYPH,
    height: GLYPH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginLeft: spacing.xs,
  },
  text: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.white,
  },
});
