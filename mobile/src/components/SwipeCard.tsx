import { forwardRef, useCallback, useImperativeHandle } from 'react';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, font, radius, spacing } from '../theme';
import type { MarketplaceProduct } from '../types';
import { ProductCard } from './ProductCard';

export const SWIPE_THRESHOLD = 100;
const FLING_MS = 320;

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
}

/**
 * A single Tinder-style card. The front card (`depth === 0`) is pannable via a
 * Reanimated `Gesture.Pan`; drag past ±100px to fling it off and fire
 * like/pass, otherwise it springs back. Cards behind sit scaled + offset.
 */
export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(
  { product, depth, onLike, onPass },
  ref,
) {
  const isTop = depth === 0;
  const translateX = useSharedValue(0);
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

  const cardStyle = useAnimatedStyle(() => {
    if (!isTop) {
      const scale = depth === 1 ? 0.96 : 0.92;
      const offsetY = depth === 1 ? 15 : 30;
      return { transform: [{ translateY: offsetY }, { scale }] };
    }
    return {
      transform: [{ translateX: translateX.value }, { rotate: `${translateX.value / 20}deg` }],
    };
  });

  const likeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(translateX.value, 0) / SWIPE_THRESHOLD, 1),
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(-translateX.value, 0) / SWIPE_THRESHOLD, 1),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, { zIndex: 3 - depth }, cardStyle]}>
        {isTop ? (
          <>
            <Animated.View style={[styles.stamp, styles.likeStamp, likeStyle]} pointerEvents="none">
              <Text style={styles.likeText}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.passStamp, passStyle]} pointerEvents="none">
              <Text style={styles.passText}>PASS</Text>
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
    fontSize: 18,
    letterSpacing: 1.5,
    color: colors.white,
  },
  passText: {
    fontFamily: font.family.extrabold,
    fontSize: 18,
    letterSpacing: 1.5,
    color: colors.white,
  },
});
