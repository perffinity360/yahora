import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, spacing } from '../theme';

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
/** Below this the photo springs back to fit — it reads as "let go to reset". */
const MIN_SCALE = 1;

/**
 * Full-screen photo viewer with pinch-to-zoom, pan and double-tap.
 *
 * Gestures:
 *   · pinch        — zoom, clamped to 1x..4x
 *   · drag         — pan, only meaningful once zoomed in; bounded so the photo
 *                    cannot be flung off screen and lost
 *   · double tap   — toggle between fit and 2.5x
 *   · single tap   — close, but ONLY at fit. While zoomed a stray tap resets to
 *                    fit instead of dismissing, because closing the viewer
 *                    someone is inspecting is the more annoying mistake.
 *   · × button     — always closes, at any zoom
 *
 * ⚠ `GestureHandlerRootView` INSIDE the Modal is load-bearing, not belt and
 * braces. A React Native Modal is a separate native view hierarchy on Android,
 * so the root provider in app/_layout.tsx does not reach inside it and every
 * gesture here would be silently dead — the exact "I can't pinch" symptom,
 * with no error to go on.
 *
 * Scale is anchored to the centre rather than to the pinch focal point. It is a
 * square avatar on a dark ground, so centre-anchored reads the same and avoids
 * the focal-point drift that needs constant re-derivation of the offset.
 */
export function ZoomableImageViewer({
  visible,
  uri,
  onClose,
  accessibilityLabel = 'Profile photo',
}: {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
  accessibilityLabel?: string;
}) {
  const { width, height } = useWindowDimensions();
  const [box, setBox] = useState({ w: width, h: height });

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const reset = useCallback(() => {
    'worklet';
    scale.value = withTiming(1, { duration: 180 });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(0, { duration: 180 });
    savedX.value = 0;
    savedY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedX, savedY]);

  // Reset before handing control back, so reopening always starts at fit.
  const close = useCallback(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedX.value = 0;
    savedY.value = 0;
    onClose();
  }, [onClose, scale, savedScale, translateX, translateY, savedX, savedY]);

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
      translateX.value = withTiming(Math.min(Math.max(translateX.value, -bx), bx), { duration: 140 });
      translateY.value = withTiming(Math.min(Math.max(translateY.value, -by), by), { duration: 140 });
      savedX.value = Math.min(Math.max(translateX.value, -bx), bx);
      savedY.value = Math.min(Math.max(translateY.value, -by), by);
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      const bx = maxOffset('x', scale.value);
      const by = maxOffset('y', scale.value);
      translateX.value = Math.min(Math.max(savedX.value + e.translationX, -bx), bx);
      translateY.value = Math.min(Math.max(savedY.value + e.translationY, -by), by);
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
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
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal
      visible={visible && !!uri}
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
              {uri ? (
                <Animated.View style={[styles.imageWrap, imageStyle]}>
                  <Image
                    source={{ uri }}
                    style={styles.image}
                    contentFit="contain"
                    transition={180}
                    accessibilityLabel={accessibilityLabel}
                  />
                </Animated.View>
              ) : null}
            </Animated.View>
          </GestureDetector>

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
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
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
});

export default ZoomableImageViewer;
