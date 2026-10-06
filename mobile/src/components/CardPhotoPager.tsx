import { useRecyclingState } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { memo, useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '../theme';

/**
 * ── SWIPING THROUGH A LISTING'S PHOTOS WITHOUT OPENING IT ──
 *
 * The photo area of a product card, for a listing with more than one photo
 * (Blinkit / Zepto style). `ProductCard` uses it everywhere except the swipe
 * deck, where a sideways drag is the like / pass gesture.
 *
 * ── WHY GESTURE HANDLER, NOT A PAGING SCROLLVIEW ──
 * The first version was a horizontal `pagingEnabled` ScrollView inside the
 * card's Pressable. On Android it barely worked: the vertical list, its
 * pull-to-refresh and the Pressable's JS responder all compete for the same
 * finger, and a horizontal ScrollView that loses the finger mid-drag gets a
 * cancel instead of a release, so it never snaps. That left two photos half on
 * screen. Here the track is an Animated.View moved by an RNGH `Pan`, and the
 * snap runs in `onEnd` whether the pan succeeded or was cancelled. A photo can
 * never be left half-swiped.
 *
 * ── TWO GESTURES, ONE FINGER ──
 * Same pattern as SwipeCard: a `Pan` raced against a `Tap`.
 *   - sideways travel past SWIPE_START activates the pan, which cancels the
 *     tap, so a swipe never opens the listing;
 *   - vertical travel past FAIL_Y fails the pan before it starts, so a thumb
 *     that lands on a photo still scrolls the feed;
 *   - a still finger lets the tap win on release, and the tap opens the listing.
 * The photo also claims the JS responder, so the card's own Pressable never
 * sees a touch that starts here and cannot open the listing a second time.
 *
 * ── DATA ──
 * Only the first photo loads with the card, as it always has. The next one is
 * mounted the moment a finger touches the photo, so it is usually ready by the
 * time the swipe lands, and each photo reached mounts the one after it. A card
 * nobody touches costs no more than it did before — the feed is built for slow
 * hostel Wi-Fi.
 *
 * ── RECYCLING ──
 * FlashList hands this same component to a different listing as the grid
 * scrolls. `useRecyclingState` resets the page and the mounted photos on a new
 * `productId` without an extra render, and the layout effect puts the track
 * back on photo one before the frame is painted — otherwise a listing would
 * appear on the third photo of whichever listing used the cell before it.
 */

/** Dot sizes: the detail page's paging pills, scaled to a half-width card. */
const DOT = 5;
const DOT_ACTIVE = 12;

/** Sideways travel (dp) before the pan takes the finger. */
const SWIPE_START = 8;
/** Vertical travel (dp) that hands the finger to the list instead. */
const FAIL_Y = 12;
/** A tap that moves further than this is not a tap. Same as SwipeCard. */
const TAP_SLOP = 12;
/** Release speed (dp/s) that turns the page even on a short drag. */
const FLICK_VELOCITY = 450;
/** How much of the finger's travel past the first / last photo shows. */
const EDGE_RESISTANCE = 0.3;
/** Settles on the page without bouncing past it. */
const SNAP = { damping: 28, stiffness: 280, overshootClamping: true } as const;

export interface CardPhotoPagerProps {
  productId: string;
  /** Already resolved through `resolveMediaUrl`. Two or more. */
  uris: string[];
  /** Opens the listing. Absent = the photo is not tappable (sell preview). */
  onPress?: () => void;
  /** Lets the card show its pressed state while the photo is held. */
  onPressedChange?: (pressed: boolean) => void;
}

function Dot({ i, progress }: { i: number; progress: SharedValue<number> }) {
  // Tracks the finger, not the settled page: the pill stretches across to the
  // next dot as the photo is dragged, the way the detail page's does.
  const style = useAnimatedStyle(() => {
    const near = interpolate(Math.abs(progress.value - i), [0, 1], [1, 0], Extrapolation.CLAMP);
    return {
      width: DOT + (DOT_ACTIVE - DOT) * near,
      opacity: 0.6 + 0.4 * near,
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

function CardPhotoPagerBase({ productId, uris, onPress, onPressedChange }: CardPhotoPagerProps) {
  const count = uris.length;

  // The pager's own width, measured. Every page is exactly this wide. It does
  // not change on recycle (every grid cell is the same width), so this
  // re-renders once per cell.
  const [width, setWidth] = useState(0);
  const pageWidth = useSharedValue(0);
  /** The track's offset: 0 on photo one, −(count − 1) × width on the last. */
  const x = useSharedValue(0);
  const startX = useSharedValue(0);
  /** The page the track is on, or heading to. */
  const page = useSharedValue(0);

  const [index, setIndex] = useRecyclingState(0, [productId]);
  /** Furthest photo that is mounted. Only the first, until a finger lands. */
  const [reach, setReach] = useRecyclingState(0, [productId]);

  useLayoutEffect(() => {
    cancelAnimation(x);
    x.value = 0;
    page.value = 0;
  }, [productId, x, page]);

  // `true` = skip FlashList's re-layout: neither changes the card's size.
  const onSettle = useCallback(
    (i: number) => {
      setIndex(i, true);
      setReach((r) => Math.max(r, i + 1), true);
    },
    [setIndex, setReach],
  );

  const prefetchNext = useCallback(() => {
    setReach((r) => Math.max(r, index + 1), true);
  }, [index, setReach]);

  const open = useCallback(() => onPress?.(), [onPress]);
  const setPressed = useCallback((p: boolean) => onPressedChange?.(p), [onPressedChange]);

  const gesture = useMemo(() => {
    const snapTo = (target: number, velocity: number) => {
      'worklet';
      page.value = target;
      x.value = withSpring(-target * pageWidth.value, { ...SNAP, velocity });
      runOnJS(onSettle)(target);
    };

    const pan = Gesture.Pan()
      .activeOffsetX([-SWIPE_START, SWIPE_START])
      .failOffsetY([-FAIL_Y, FAIL_Y])
      .maxPointers(1)
      .onBegin(() => {
        runOnJS(prefetchNext)();
      })
      .onStart(() => {
        // Caught mid-snap: carry on from where the track is, not where it
        // was heading.
        cancelAnimation(x);
        startX.value = x.value;
      })
      .onUpdate((e) => {
        const w = pageWidth.value;
        if (w <= 0) return;
        const min = -(count - 1) * w;
        const next = startX.value + e.translationX;
        x.value =
          next > 0
            ? next * EDGE_RESISTANCE
            : next < min
              ? min + (next - min) * EDGE_RESISTANCE
              : next;
      })
      // Runs for a cancelled pan too (a system gesture, the list taking over),
      // so the track always comes to rest on a photo.
      .onEnd((e, success) => {
        const w = pageWidth.value;
        if (w <= 0) return;
        const from = page.value;
        let target = Math.round(-x.value / w);
        if (success && Math.abs(e.velocityX) > FLICK_VELOCITY) {
          target = e.velocityX < 0 ? from + 1 : from - 1;
        }
        // One swipe, one photo: a hard fling never skips past the next.
        target = Math.min(Math.max(target, from - 1, 0), from + 1, count - 1);
        snapTo(target, success ? e.velocityX : 0);
      });

    const tap = Gesture.Tap()
      .enabled(!!onPress)
      .maxDistance(TAP_SLOP)
      .onBegin(() => {
        runOnJS(setPressed)(true);
      })
      .onEnd((_e, success) => {
        if (success) runOnJS(open)();
      })
      // Whether the tap won, failed or lost to the pan, the card never stays
      // pressed.
      .onFinalize(() => {
        runOnJS(setPressed)(false);
      });

    return Gesture.Race(pan, tap);
  }, [count, onPress, onSettle, prefetchNext, open, setPressed, x, startX, page, pageWidth]);

  const progress = useDerivedValue(() => (pageWidth.value > 0 ? -x.value / pageWidth.value : 0));

  const trackStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      pageWidth.value = w;
      // Keep the current photo in place if the card is ever resized.
      x.value = -page.value * w;
      setWidth(w);
    },
    [pageWidth, x, page],
  );

  const shown = Math.min(index, count - 1);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={styles.frame}
        onLayout={onLayout}
        // Claim the JS responder so the card's Pressable never handles a touch
        // that starts on the photo — the Tap above is what opens the listing.
        onStartShouldSetResponder={() => true}
        accessibilityLabel={`Photo ${shown + 1} of ${count}`}
      >
        <Animated.View style={[styles.track, { width: width * count }, trackStyle]}>
          {uris.map((uri, i) => (
            // Keyed by position, not URI: a recycled cell swaps the source on
            // the photo views it already has instead of rebuilding them.
            <View key={i} style={[styles.page, { width }]}>
              {i <= reach ? (
                <Image source={{ uri }} style={styles.image} contentFit="cover" transition={220} />
              ) : null}
            </View>
          ))}
        </Animated.View>

        {/* The dots are the only indicator — no "1/N" counter on a pager. */}
        <View style={styles.dots} pointerEvents="none">
          {uris.map((_, i) => (
            <Dot key={i} i={i} progress={progress} />
          ))}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export const CardPhotoPager = memo(CardPhotoPagerBase);

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  track: {
    flexDirection: 'row',
    height: '100%',
  },
  page: {
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dots: {
    position: 'absolute',
    bottom: 11,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.white,
    // A white pill on a white product shot would vanish; a soft shadow keeps
    // it readable on any photo without a backing plate.
    shadowColor: colors.black,
    shadowOpacity: 0.35,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
});
