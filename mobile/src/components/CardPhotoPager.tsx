import { useRecyclingState } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { memo, useCallback, useLayoutEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from './AppText';
import { colors, font } from '../theme';

/**
 * ── SWIPING THROUGH A LISTING'S PHOTOS WITHOUT OPENING IT ──
 *
 * The photo area of a MARKETPLACE GRID card, for a listing with more than one
 * photo (Blinkit / Zepto style). `ProductCard` renders it only when the grid
 * asks for it (`swipePhotos`); the swipe deck, the dashboard, the public
 * profile and the sell preview keep their single still photo.
 *
 * A plain horizontal paging ScrollView inside the card's Pressable. The touch
 * system already splits the two gestures the way a student expects:
 *   - a TAP is never claimed by the ScrollView, so it reaches the card and
 *     opens the listing, exactly as before;
 *   - a SIDEWAYS drag is claimed natively by the horizontal scroller, which
 *     cancels the card's press, so swiping never opens the listing;
 *   - an UP/DOWN drag is claimed by the grid, so scrolling the feed with a
 *     thumb that lands on a photo still scrolls the feed.
 *
 * ── DATA ──
 * Only the first photo loads with the card, as it always has. The next one is
 * mounted the moment a finger touches the photo (`onTouchStart`), so it is
 * usually ready by the time the swipe lands, and each photo reached mounts the
 * one after it. A card nobody touches costs no more than it did before — the
 * feed is built for slow hostel Wi-Fi.
 *
 * ── RECYCLING ──
 * FlashList hands this same component to a different listing as the grid
 * scrolls. `useRecyclingState` resets the page and the mounted photos on a new
 * `productId` without an extra render, and the layout effect puts the scroller
 * back on photo one before the frame is painted — otherwise a listing would
 * appear on the third photo of whichever listing used the cell before it.
 */

/** Dot sizes: the detail page's paging pills, scaled to a half-width card. */
const DOT = 5;
const DOT_ACTIVE = 12;

export interface CardPhotoPagerProps {
  productId: string;
  /** Already resolved through `resolveMediaUrl`. Two or more. */
  uris: string[];
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

function CardPhotoPagerBase({ productId, uris }: CardPhotoPagerProps) {
  const count = uris.length;
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  // The pager's own width, measured. Every page is exactly this wide, so the
  // scroller's paging lands on a photo edge. It does not change on recycle
  // (every grid cell is the same width), so this re-renders once per cell.
  const [width, setWidth] = useState(0);
  const pageWidth = useSharedValue(0);
  const scrollX = useSharedValue(0);
  /** The page the scroll handler last reported, so it reports only changes. */
  const page = useSharedValue(0);

  const [index, setIndex] = useRecyclingState(0, [productId]);
  /** Furthest photo that is mounted. Only the first, until a finger lands. */
  const [reach, setReach] = useRecyclingState(0, [productId]);

  useLayoutEffect(() => {
    scrollX.value = 0;
    page.value = 0;
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [productId, scrollRef, scrollX, page]);

  // `true` = skip FlashList's re-layout: neither changes the card's size.
  const onPageChange = useCallback(
    (i: number) => {
      setIndex(i, true);
      setReach((r) => Math.max(r, i + 1), true);
    },
    [setIndex, setReach],
  );

  const onTouchStart = useCallback(() => {
    setReach((r) => Math.max(r, index + 1), true);
  }, [index, setReach]);

  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        scrollX.value = e.contentOffset.x;
        const w = pageWidth.value;
        if (w <= 0) return;
        // Past halfway counts as the next photo, so the counter and the
        // mounting of the photo after it move with the finger, not after the
        // momentum settles.
        const i = Math.min(Math.max(Math.round(e.contentOffset.x / w), 0), count - 1);
        if (i !== page.value) {
          page.value = i;
          runOnJS(onPageChange)(i);
        }
      },
    },
    [count, onPageChange],
  );

  const progress = useDerivedValue(() =>
    pageWidth.value > 0 ? scrollX.value / pageWidth.value : 0,
  );

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      pageWidth.value = w;
      setWidth(w);
    },
    [pageWidth],
  );

  const shown = Math.min(index, count - 1);

  return (
    <>
      <Animated.ScrollView
        ref={scrollRef}
        style={StyleSheet.absoluteFill}
        horizontal
        pagingEnabled
        // One flick, one photo — a hard fling does not skip past the next.
        disableIntervalMomentum
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
        onLayout={onLayout}
        onTouchStart={onTouchStart}
        onScroll={onScroll}
        scrollEventThrottle={16}
        accessibilityLabel={`Photo ${shown + 1} of ${count}`}
      >
        {uris.map((uri, i) => (
          // Keyed by position, not URI: a recycled cell swaps the source on
          // the photo views it already has instead of rebuilding them.
          <View key={i} style={[styles.page, { width }]}>
            {i <= reach ? (
              <Image source={{ uri }} style={styles.image} contentFit="cover" transition={220} />
            ) : null}
          </View>
        ))}
      </Animated.ScrollView>

      {/* Indicators never take a touch: a swipe that starts on them still
          moves the photos. */}
      <View style={styles.dots} pointerEvents="none">
        {uris.map((_, i) => (
          <Dot key={i} i={i} progress={progress} />
        ))}
      </View>
      <View style={styles.counter} pointerEvents="none">
        <AppText style={styles.counterText}>
          {shown + 1}/{count}
        </AppText>
      </View>
    </>
  );
}

export const CardPhotoPager = memo(CardPhotoPagerBase);

const styles = StyleSheet.create({
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
  // Same pill as ProductCard's still counter — see `imageCounter` there.
  counter: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(20,20,20,0.62)',
  },
  counterText: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    color: colors.white,
  },
});
