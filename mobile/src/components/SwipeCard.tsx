import { forwardRef, useCallback, useImperativeHandle } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from './AppText';
import { colors, font, radius, spacing } from '../theme';
import type { MarketplaceProduct } from '../types';
import { ProductCard } from './ProductCard';

export const SWIPE_THRESHOLD = 100;
const FLING_MS = 320;
/** How far a finger may travel and still count as a tap, not a drag. */
const TAP_SLOP = 12;

export interface SwipeCardHandle {
  /** Programmatically fling the card (used by the Like / Pass buttons). */
  swipe: (dir: 'like' | 'pass') => void;
}

interface Props {
  product: MarketplaceProduct;
  /** 0 = front/interactive, 1 and 2 = stacked behind. */
  depth: number;
  onLike: (id: string) => void;
  onPass: (id: string) => void;
  /** Tap the front card to open the product detail screen. */
  onOpen?: (id: string) => void;
}

/**
 * A single Tinder-style card. The front card (`depth === 0`) is pannable via a
 * Reanimated `Gesture.Pan`; drag past ±100px to fling it off and fire
 * like/pass, otherwise it springs back. Cards behind sit scaled + offset.
 *
 * The front card is also tappable (`onOpen`) and opens the product detail.
 * That tap is an RNGH `Gesture.Tap` raced against the pan rather than a
 * `Pressable` inside ProductCard: a pan handler and the RN touch responder
 * both claim the same finger, and the loser is decided per-platform. Racing
 * two gestures in one system makes it deterministic — a still finger lets the
 * tap win on release, any real travel activates the pan first and cancels the
 * tap, so a swipe can never also register as an open.
 */
export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { product, depth, onLike, onPass, onOpen },
  ref,
) {
  const isTop = depth === 0;
  const translateX = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const { width: screenW } = useWindowDimensions();
  const flingDistance = screenW * 1.5;

  const finish = useCallback(
    (liked: boolean) => {
      if (liked) onLike(product.id);
      else onPass(product.id);
    },
    [onLike, onPass, product.id],
  );

  useImperativeHandle(
    ref,
    () => ({
      swipe: (dir) => {
        const sign = dir === 'like' ? 1 : -1;
        translateX.value = withTiming(sign * flingDistance, { duration: FLING_MS }, (done) => {
          'worklet';
          if (done) runOnJS(finish)(sign > 0);
        });
      },
    }),
    [finish, flingDistance, translateX],
  );

  const pan = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd(() => {
      if (Math.abs(translateX.value) >= SWIPE_THRESHOLD) {
        const sign = translateX.value > 0 ? 1 : -1;
        translateX.value = withTiming(sign * flingDistance, { duration: FLING_MS }, (done) => {
          if (done) runOnJS(finish)(sign > 0);
        });
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 180 });
      }
    });

  const open = useCallback(() => {
    onOpen?.(product.id);
  }, [onOpen, product.id]);

  const tap = Gesture.Tap()
    .enabled(isTop && !!onOpen)
    .maxDistance(TAP_SLOP)
    .onBegin(() => {
      pressScale.value = withTiming(0.985, { duration: 90 });
    })
    .onEnd((_e, success) => {
      if (success) runOnJS(open)();
    })
    // Runs whether the tap succeeded, failed, or lost the race to the pan —
    // so the card can never be left stuck at the pressed scale mid-swipe.
    .onFinalize(() => {
      pressScale.value = withTiming(1, { duration: 120 });
    });

  const gesture = Gesture.Race(pan, tap);

  const cardStyle = useAnimatedStyle(() => {
    if (!isTop) {
      const scale = depth === 1 ? 0.96 : 0.92;
      const offsetY = depth === 1 ? 15 : 30;
      return { transform: [{ translateY: offsetY }, { scale }] };
    }
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${translateX.value / 20}deg` },
        { scale: pressScale.value },
      ],
    };
  });

  const likeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(translateX.value, 0) / SWIPE_THRESHOLD, 1),
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(-translateX.value, 0) / SWIPE_THRESHOLD, 1),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, { zIndex: 3 - depth }, cardStyle]}>
        {isTop ? (
          <>
            <Animated.View style={[styles.stamp, styles.likeStamp, likeStyle]} pointerEvents="none">
              <AppText style={styles.likeText}>LIKE</AppText>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.passStamp, passStyle]} pointerEvents="none">
              <AppText style={styles.passText}>PASS</AppText>
            </Animated.View>
          </>
        ) : null}
        <ProductCard product={product} />
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  stamp: {
    position: 'absolute',
    top: 18,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  likeStamp: {
    left: spacing.md,
    backgroundColor: colors.swipeLike,
    transform: [{ rotate: '-8deg' }],
  },
  passStamp: {
    right: spacing.md,
    backgroundColor: colors.swipePass,
    transform: [{ rotate: '8deg' }],
  },
  likeText: {
    fontFamily: font.family.extrabold,
    fontSize: font.sizes.title,
    letterSpacing: 1.5,
    color: colors.white,
  },
  passText: {
    fontFamily: font.family.extrabold,
    fontSize: font.sizes.title,
    letterSpacing: 1.5,
    color: colors.white,
  },
});
