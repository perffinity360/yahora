import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, font, spacing } from '../theme';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
/** Below this the photo springs back to fit — it reads as "let go to reset". */
const MIN_SCALE = 1;

/** How far a swipe at fit must travel, or how fast, before it changes photo. */
const SWIPE_DISTANCE = 70;
const SWIPE_VELOCITY = 600;
/** Drag past the first or last photo moves this fraction of the finger. */
const EDGE_RESISTANCE = 0.3;

/**
 * Full-screen photo viewer with pinch-to-zoom, pan, double-tap, and — when
 * given several photos — swiping between them.
 *
 * Gestures:
 *   · pinch        — zoom, clamped to 1x..4x
 *   · drag         — ZOOMED IN: pan around the photo, bounded so it cannot be
 *                    flung off screen and lost.
 *                    AT FIT, with more than one photo: swipe to the next or
 *                    previous one. The two never compete — which one a drag
 *                    means is decided by whether the photo is zoomed.
 *   · double tap   — toggle between fit and 2.5x
 *   · single tap   — close, but ONLY at fit. While zoomed a stray tap resets to
 *                    fit instead of dismissing, because closing the viewer
 *                    someone is inspecting is the more annoying mistake.
 *   · × button     — always closes, at any zoom
 *   · ‹ › buttons  — change photo; for anyone who does not discover the swipe
 *
 * Two shapes, because an avatar and a listing photo want different framing:
 *
 *   'square' — the avatar: a rounded square in the middle of the screen.
 *   'fill'   — a listing photo: as large as the screen allows at its own
 *              aspect ratio, no rounding. Cropping a product photo to a square
 *              would hide exactly the edge someone opened the viewer to see.
 *
 * ⚠ `GestureHandlerRootView` INSIDE the Modal is load-bearing, not belt and
 * braces. A React Native Modal is a separate native view hierarchy on Android,
 * so the root provider in app/_layout.tsx does not reach inside it and every
 * gesture here would be silently dead — the exact "I can't pinch" symptom,
 * with no error to go on.
 *
 * Scale is anchored to the centre rather than to the pinch focal point: it
 * reads the same on a photo, and avoids the focal-point drift that needs
 * constant re-derivation of the offset.
 */
export function ZoomableImageViewer({
  visible,
  uri,
  uris,
  initialIndex = 0,
  onClose,
  shape = 'square',
  accessibilityLabel = 'Profile photo',
}: {
  visible: boolean;
  /** A single photo. Kept so the avatar viewer did not have to change. */
  uri?: string | null;
  /** Several photos, swipeable. Takes precedence over `uri`. */
  uris?: string[];
  /** Which of `uris` to open on. */
  initialIndex?: number;
  onClose: () => void;
  shape?: 'square' | 'fill';
  accessibilityLabel?: string;
}) {
  const photos = useMemo(
    () => (uris && uris.length > 0 ? uris : uri ? [uri] : []).filter(Boolean),
    [uris, uri],
  );
  const count = photos.length;

  const { width, height } = useWindowDimensions();
  const [box, setBox] = useState({ w: width, h: height });
  const [index, setIndex] = useState(initialIndex);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  /** Horizontal drag at fit, before it has decided whether to change photo. */
  const swipeX = useSharedValue(0);

  const snapToFit = useCallback(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
    swipeX.value = 0;
  }, [scale, savedScale, translateX, translateY, savedX, savedY, swipeX]);

  // Every open starts on the photo that was tapped, at fit.
  useEffect(() => {
    if (!visible) return;
    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(count - 1, 0)));
    snapToFit();
  }, [visible, initialIndex, count, snapToFit]);

  const reset = useCallback(() => {
    'worklet';
    scale.value = withTiming(1, { duration: 180 });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(0, { duration: 180 });
    savedX.value = 0;
    savedY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedX, savedY]);

  const close = useCallback(() => {
    snapToFit();
    onClose();
  }, [onClose, snapToFit]);

  /** Change photo. A new photo always opens at fit — zoom does not carry over. */
  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= count) return;
      snapToFit();
      setIndex(next);
    },
    [count, snapToFit],
  );

  /**
   * How far the photo may be dragged at the current zoom: the overhang on each
   * side, which is zero at fit. Without this a pan can put the photo entirely
   * off screen with no way back except closing.
   */
  const maxOffset = useCallback(
    (axis: 'x' | 'y', atScale: number) => {
      'worklet';
      const size = axis === 'x' ? box.w : box.h;
      return Math.max((size * atScale - size) / 2, 0);
    },
    [box.w, box.h],
  );

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.5), MAX_SCALE);
    })
    .onEnd(() => {
      if (scale.value <= MIN_SCALE) {
        reset();
        return;
      }
      savedScale.value = scale.value;
      // A zoom-out can leave the photo outside its new, smaller bounds.
      const bx = maxOffset('x', scale.value);
      const by = maxOffset('y', scale.value);
      const cx = Math.min(Math.max(translateX.value, -bx), bx);
      const cy = Math.min(Math.max(translateY.value, -by), by);
      translateX.value = withTiming(cx, { duration: 140 });
      translateY.value = withTiming(cy, { duration: 140 });
      savedX.value = cx;
      savedY.value = cy;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value > MIN_SCALE) {
        const bx = maxOffset('x', scale.value);
        const by = maxOffset('y', scale.value);
        translateX.value = Math.min(Math.max(savedX.value + e.translationX, -bx), bx);
        translateY.value = Math.min(Math.max(savedY.value + e.translationY, -by), by);
        return;
      }
      if (count < 2) return;
      // At fit: the drag previews a photo change. Past either end it resists,
      // so the edge is felt rather than simply ignored.
      const atStart = index === 0 && e.translationX > 0;
      const atEnd = index === count - 1 && e.translationX < 0;
      swipeX.value = atStart || atEnd ? e.translationX * EDGE_RESISTANCE : e.translationX;
    })
    .onEnd((e) => {
      if (savedScale.value > MIN_SCALE) {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
        return;
      }
      if (count < 2) return;
      const farEnough = Math.abs(e.translationX) > SWIPE_DISTANCE;
      const fastEnough = Math.abs(e.velocityX) > SWIPE_VELOCITY;
      if (farEnough || fastEnough) {
        const next = e.translationX < 0 ? index + 1 : index - 1;
        if (next >= 0 && next < count) {
          runOnJS(goTo)(next);
          return;
        }
      }
      swipeX.value = withTiming(0, { duration: 180 });
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE, { duration: 200 });
        savedScale.value = DOUBLE_TAP_SCALE;
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(280)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
      } else {
        runOnJS(close)();
      }
    });

  // Race, not Simultaneous: a pinch or a drag must win over the taps, and the
  // two taps resolve against each other first so a double tap is never read as
  // two singles (which would zoom and then immediately close).
  const gesture = Gesture.Race(
    Gesture.Simultaneous(pinch, pan),
    Gesture.Exclusive(doubleTap, singleTap),
  );

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value + swipeX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const current = photos[index] ?? null;
  const fill = shape === 'fill';

  return (
    <Modal
      visible={visible && count > 0}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.flex}>
        <View
          style={styles.overlay}
          onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          <GestureDetector gesture={gesture}>
            {/* Fills the screen so the gestures work anywhere, not only on the
                photo itself — pinching just outside a zoomed image is normal. */}
            <Animated.View style={styles.gestureArea}>
              {current ? (
                <Animated.View style={[fill ? styles.imageWrapFill : styles.imageWrap, imageStyle]}>
                  <Image
                    // Keyed so a photo change swaps the image rather than
                    // cross-fading the previous one's pixels into the next.
                    key={current}
                    source={{ uri: current }}
                    style={[styles.image, fill && styles.imageFill]}
                    contentFit="contain"
                    transition={180}
                    accessibilityLabel={
                      count > 1 ? `${accessibilityLabel}, ${index + 1} of ${count}` : accessibilityLabel
                    }
                  />
                </Animated.View>
              ) : null}
            </Animated.View>
          </GestureDetector>

          {count > 1 ? (
            <>
              <View style={styles.counter} pointerEvents="none">
                <Text style={styles.counterText}>
                  {index + 1} / {count}
                </Text>
              </View>

              {index > 0 ? (
                <Pressable
                  onPress={() => goTo(index - 1)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Previous photo"
                  style={[styles.navBtn, styles.navPrev]}
                >
                  <Feather name="chevron-left" size={24} color={colors.white} />
                </Pressable>
              ) : null}
              {index < count - 1 ? (
                <Pressable
                  onPress={() => goTo(index + 1)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Next photo"
                  style={[styles.navBtn, styles.navNext]}
                >
                  <Feather name="chevron-right" size={24} color={colors.white} />
                </Pressable>
              ) : null}

              <View style={styles.dots} pointerEvents="none">
                {photos.map((p, i) => (
                  <View key={`${p}-${i}`} style={[styles.dot, i === index && styles.dotActive]} />
                ))}
              </View>
            </>
          ) : null}

          <Pressable
            onPress={close}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            style={styles.close}
          >
            <Feather name="x" size={22} color={colors.white} />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: colors.viewerScrim,
  },
  gestureArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    width: '90%',
    aspectRatio: 1,
    maxHeight: '80%',
  },
  imageWrapFill: {
    width: '100%',
    height: '78%',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  imageFill: {
    borderRadius: 0,
  },
  close: {
    position: 'absolute',
    top: spacing.xl * 1.5,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.viewerCloseBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    top: spacing.xl * 1.5,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    backgroundColor: colors.viewerCloseBg,
  },
  counterText: {
    fontFamily: font.family.semibold,
    fontSize: 13,
    color: colors.white,
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.viewerCloseBg,
  },
  navPrev: { left: spacing.md },
  navNext: { right: spacing.md },
  dots: {
    position: 'absolute',
    bottom: spacing.xl * 1.5,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.viewerCloseBg,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.white,
  },
});

export default ZoomableImageViewer;
