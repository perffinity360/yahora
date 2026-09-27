import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { PixelRatio, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '../theme';

/**
 * The back-to-top button, matched to the web marketplace's
 * (`.backToTop` in frontend/src/pages/marketplace/Marketplace.module.css):
 *
 *   - a near-white disc inside a thin purple → pink gradient ring,
 *   - the same drawn arrow — a round-capped chevron over a TAPERED tail, wide
 *     under the head and narrowing to a rounded point (ArrowUpGlyph there),
 *   - a soft purple shadow,
 *   - a constant gentle drift upwards while it is showing (9dp, 1.1s,
 *     ease-in-out both ways, so the turn and the loop are both seamless),
 *   - entering with a little overshoot, and filling with the gradient (arrow
 *     going white) under the finger — the web does that on hover.
 *
 * Always mounted and faded rather than mounted on demand, so showing it is a
 * UI-thread change and never a layout pass in the middle of a scroll. Hidden,
 * it takes no touches.
 */
const SIZE = 42;
const RING = 1.5;
const GLYPH = 20;
const DRIFT = 9;
const DRIFT_HALF_MS = 550;
const BRAND = [colors.purple, colors.pinkDark] as const;
const FILL = [colors.white, colors.nearWhite] as const;
/** cubic-bezier(0.34, 1.56, 0.64, 1): the web's enter curve, with overshoot. */
const OVERSHOOT = Easing.bezier(0.34, 1.56, 0.64, 1);

export function BackToTop({
  visible,
  onPress,
  style,
}: {
  visible: boolean;
  onPress: () => void;
  /** Position only (absolute offsets). */
  style?: StyleProp<ViewStyle>;
}) {
  const shown = useSharedValue(visible ? 1 : 0);
  const drift = useSharedValue(0);

  useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 240 : 180,
      easing: visible ? OVERSHOOT : Easing.out(Easing.cubic),
    });
    if (visible) {
      drift.value = withRepeat(
        withSequence(
          withTiming(-DRIFT, { duration: DRIFT_HALF_MS, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: DRIFT_HALF_MS, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      );
    } else {
      cancelAnimation(drift);
      drift.value = withTiming(0, { duration: 180 });
    }
  }, [visible, shown, drift]);

  const animated = useAnimatedStyle(() => ({
    // Opacity clamped: the overshoot curve runs `shown` a little past 1.
    opacity: Math.min(shown.value, 1),
    transform: [{ translateY: (1 - shown.value) * 12 + drift.value }],
  }));

  return (
    <Animated.View
      style={[styles.slot, style, animated]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back to top"
        style={({ pressed }) => [styles.disc, pressed && styles.discPressed]}
      >
        {({ pressed }) => (
          <>
            <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring} />
            <LinearGradient
              colors={pressed ? BRAND : FILL}
              start={pressed ? { x: 0, y: 0 } : { x: 0.5, y: 0 }}
              end={pressed ? { x: 1, y: 1 } : { x: 0.5, y: 1 }}
              style={styles.fill}
            />
            <ArrowUpGlyph size={GLYPH} color={pressed ? colors.white : colors.purple} />
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/**
 * The web's ArrowUpGlyph, drawn with Views (no SVG in this app), on the same
 * 24-unit grid and scaled to `size`:
 *   head — round-capped strokes from (5.6, 9.6) and (18.4, 9.6) to the apex at
 *          (12, 3.3), 2.2 wide;
 *   tail — 2.7 wide at y 4.3, narrowing to 1.2 at y 21.3, with a round end.
 *
 * THE TAIL IS TWO BARS, not one shape. Each is a round-ended bar as wide as the
 * tail's tip; both start at the tip, (12, 21.3), and lean apart by the few
 * degrees that put their tops 2.7 apart at y 4.3. Together they make exactly
 * the web's taper. It was a single trapezoid built from transparent side
 * borders, and Android draws sub-dp mixed-colour borders badly: the tail came
 * out faint and rounded a pixel off centre. Two mirrored bars are centred by
 * construction, and every edge here is snapped to a whole device pixel.
 */
function ArrowUpGlyph({ size, color }: { size: number; color: string }) {
  const s = size / 24;
  const px = PixelRatio.roundToNearestPixel;

  // Head: two round-capped strokes meeting at the apex.
  const stroke = px(2.2 * s);
  const arm = Math.hypot(6.4, 6.3) * s;
  const armAngle = (Math.atan2(6.3, 6.4) * 180) / Math.PI;
  const armStyle = (midX: number, deg: number): ViewStyle => ({
    position: 'absolute',
    left: px(midX * s - (arm + stroke) / 2),
    top: px(6.45 * s - stroke / 2),
    width: px(arm + stroke),
    height: stroke,
    borderRadius: stroke / 2,
    backgroundColor: color,
    transform: [{ rotate: `${deg}deg` }],
  });

  // Tail: two bars from the tip, leaning apart.
  const tipW = Math.max(px(1.2 * s), 1);
  const rise = 21.3 - 4.3;
  const spread = (2.7 - 1.2) / 2; // how far each top edge moves out, in units
  const lean = (Math.atan2(spread, rise) * 180) / Math.PI;
  const barLen = Math.hypot(rise, spread) * s + tipW; // + tipW: the round ends
  const barStyle = (dir: -1 | 1): ViewStyle => ({
    position: 'absolute',
    // Centred on the midpoint of its own centre line; RN rotates about there.
    left: px((12 + (dir * spread) / 2) * s - tipW / 2),
    top: px(((21.3 + 4.3) / 2) * s - barLen / 2),
    width: tipW,
    height: px(barLen),
    borderRadius: tipW / 2,
    backgroundColor: color,
    // A top leaning left is an anticlockwise (negative) turn.
    transform: [{ rotate: `${dir * lean}deg` }],
  });

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <View style={barStyle(-1)} />
      <View style={barStyle(1)} />
      <View style={armStyle(8.8, -armAngle)} />
      <View style={armStyle(15.2, armAngle)} />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    zIndex: 20,
    elevation: 8,
  },
  disc: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Solid, so Android has a surface to cast the elevation shadow from.
    backgroundColor: colors.white,
    shadowColor: colors.purple,
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  discPressed: {
    transform: [{ scale: 0.94 }],
    shadowOpacity: 0.3,
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: SIZE / 2,
  },
  fill: {
    position: 'absolute',
    top: RING,
    left: RING,
    right: RING,
    bottom: RING,
    borderRadius: SIZE / 2 - RING,
  },
});
