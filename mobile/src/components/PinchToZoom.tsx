import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const MAX_SCALE = 4;
/** How dark the page behind the photo goes at full zoom. */
const MAX_SCRIM = 0.82;
const RETURN_DURATION = 220;

/**
 * Pinch a photo where it sits on the page, without disturbing the page.
 *
 * WHAT THIS IS FOR. The product gallery already opened a full-screen viewer on
 * tap, and that stays. But the reflex on a photo is to pinch it, and pinching
 * an ordinary <Image> inside a ScrollView does nothing — or, worse, gets read
 * as a scroll. This makes the pinch itself work, in place.
 *
 * ⚠ THE PHOTO IS NOT SCALED WHERE IT SITS. Scaling it inside the carousel would
 * be clipped to the gallery frame on Android (a parent View clips children), so
 * the photo would grow into a crop of itself, and anything the gallery overlays
 * — the condition badge, the SOLD badge, the paging dots — would ride along and
 * distort with it.
 *
 * Instead the photo is LIFTED: the moment a pinch starts, the cell measures
 * itself in window coordinates and a copy is drawn at those exact coordinates
 * in a screen-wide overlay above the whole page, while the original hides
 * underneath. Only the copy scales. Nothing is laid out again, so nothing else
 * on the screen moves, reflows or stretches. On release the copy animates back
 * to exactly the rect it came from and the overlay clears.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * THREE THINGS HERE EXIST TO MAKE THE GESTURE CATCH RELIABLY. The first cut of
 * this component was described as working "very hardly, from a very specific
 * point" — it was losing the race against the two scroll views it sits inside.
 * Do not undo any of these without reproducing that.
 *
 * 1. `manualActivation` + activate on the second finger. Left to itself, a
 *    Pinch gesture inside a vertical ScrollView that also contains a horizontal
 *    paging FlatList has to out-argue both of them: the native scroll
 *    recognisers claim the touch as soon as it travels, so the pinch only ever
 *    won when two fingers landed and spread almost perfectly still and
 *    symmetrically. Activating explicitly the instant a second finger touches
 *    down takes the stream before either scroller can, and RNGH then cancels
 *    them for us. Single-finger touches never activate it, so scrolling and
 *    tapping are untouched.
 *
 * 2. NOTHING sets React state while the gesture runs. `setState` here re-renders
 *    the screen, the ScrollView and every FlatList cell mid-pinch. The earlier
 *    version also flipped `scrollEnabled` on both scrollers from that render —
 *    and toggling `scrollEnabled` during a touch cancels the touch outright on
 *    iOS, killing the very gesture it was meant to protect. So the lifted state
 *    lives in TWO places that cost nothing: a shared value (`liftedKey`) that
 *    hides the original on the UI thread, and state owned by the overlay alone,
 *    set through a ref so no parent re-renders. `scrollEnabled` is not touched
 *    at all — an activated gesture already stops the scrollers.
 *
 * 3. No `Modal`. On Android a transparent Modal is a separate native window and
 *    swallows the touches the still-running pinch needs. The overlay is a plain
 *    absolutely-positioned sibling at the screen root, `pointerEvents="none"`,
 *    so every touch goes on reaching the cell underneath.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Usage — the hook and the overlay live at the SCREEN root, the wrapper goes
 * around each photo:
 *
 *   const lift = usePinchLift();
 *   …
 *   <View style={styles.root}>
 *     …page…
 *     <PinchLiftOverlay lift={lift} />
 *   </View>
 *
 * The overlay must be the LAST child of a root-level, full-screen View: it
 * positions itself in window coordinates, so anything that insets it (a
 * SafeAreaView, a padded container) shifts the copy away from the original.
 */

type LiftSource = {
  /** Identifies which wrapped photo is currently lifted. */
  key: string;
  uri: string;
  /** Window coordinates of the original, so the copy lands exactly on it. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Matches the original's contentFit, or the copy re-crops on swap. */
  contentFit: 'cover' | 'contain';
  borderRadius: number;
};

type OverlayController = {
  show: (source: LiftSource) => void;
  hide: () => void;
};

export type PinchLift = ReturnType<typeof usePinchLift>;

export function usePinchLift() {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  /** The pinch's start focal point, relative to the photo's centre. */
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);
  /** Where the focal point began, in cell coordinates, for two-finger panning. */
  const startFocalX = useSharedValue(0);
  const startFocalY = useSharedValue(0);
  /**
   * Which photo is lifted, as a shared value rather than React state, so the
   * original can be hidden on the UI thread without re-rendering the list the
   * gesture is running inside. See note 2 above.
   */
  const liftedKey = useSharedValue<string | null>(null);

  // The overlay registers itself here. Showing the copy therefore re-renders
  // the overlay and nothing else — not this screen, not the carousel.
  const controller = useRef<OverlayController | null>(null);

  const show = useCallback((source: LiftSource) => controller.current?.show(source), []);
  const hide = useCallback(() => controller.current?.hide(), []);

  return {
    controller,
    show,
    hide,
    scale,
    translateX,
    translateY,
    originX,
    originY,
    startFocalX,
    startFocalY,
    liftedKey,
  };
}

/**
 * Wraps one photo. `children` renders normally and is hidden only while this
 * photo is the lifted one.
 */
export function PinchToZoom({
  lift,
  id,
  uri,
  width,
  height,
  contentFit = 'cover',
  borderRadius = 0,
  enabled = true,
  children,
}: {
  lift: PinchLift;
  /** Stable per photo — the uri alone repeats when a listing reuses an image. */
  id: string;
  uri: string;
  width: number;
  height: number;
  contentFit?: 'cover' | 'contain';
  borderRadius?: number;
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<View>(null);
  const {
    show,
    hide,
    scale,
    translateX,
    translateY,
    originX,
    originY,
    startFocalX,
    startFocalY,
    liftedKey,
  } = lift;

  // Measured on the JS thread because measureInWindow is not a worklet. The
  // pinch has already started by the time this lands, which is fine: the copy
  // appears at scale 1 on the original's exact rect, so the first frame is
  // identical to what was already on screen.
  const measureAndLift = useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => {
      if (!w || !h) return; // Detached or not laid out yet — nothing to lift.
      // A quick pinch can finish before this callback runs. Showing the copy
      // then would flash an overlay for a photo nobody is holding any more.
      if (liftedKey.value !== id) return;
      show({ key: id, uri, x, y, width: w, height: h, contentFit, borderRadius });
    });
  }, [borderRadius, contentFit, id, liftedKey, show, uri]);

  const settle = useCallback(() => {
    liftedKey.value = null;
    hide();
  }, [hide, liftedKey]);

  const pinch = Gesture.Pinch()
    .enabled(enabled)
    // See note 1: claim the touch stream on the second finger, before the
    // ScrollView or the paging FlatList can read it as a scroll.
    .manualActivation(true)
    .onTouchesDown((e, manager) => {
      if (e.numberOfTouches >= 2) manager.activate();
    })
    .onStart((e) => {
      liftedKey.value = id;
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      originX.value = e.focalX - width / 2;
      originY.value = e.focalY - height / 2;
      startFocalX.value = e.focalX;
      startFocalY.value = e.focalY;
      runOnJS(measureAndLift)();
    })
    .onUpdate((e) => {
      const s = Math.min(Math.max(e.scale, 1), MAX_SCALE);
      scale.value = s;
      // Keep whatever is under the fingers under the fingers. A point p (from
      // the centre) lands at translate + p·s, so holding the start focal point
      // still means translate = origin·(1 − s); the second term is the fingers
      // moving together, which pans.
      translateX.value = originX.value * (1 - s) + (e.focalX - startFocalX.value);
      translateY.value = originY.value * (1 - s) + (e.focalY - startFocalY.value);
    })
    // onFinalize, not onEnd: it runs on a cancelled gesture too. With onEnd
    // alone, an interrupted pinch left the original hidden and the copy stuck
    // on screen, with no way back short of leaving the page.
    .onFinalize(() => {
      if (liftedKey.value !== id) return; // Never activated — a tap or a scroll.
      // Springs back rather than staying zoomed: this is a "look closer"
      // gesture, not a mode. The full-screen viewer (a tap away) is where a
      // zoom is meant to persist.
      scale.value = withTiming(1, { duration: RETURN_DURATION });
      translateX.value = withTiming(0, { duration: RETURN_DURATION });
      translateY.value = withTiming(0, { duration: RETURN_DURATION }, (finished) => {
        if (finished) runOnJS(settle)();
      });
    });

  // Hiding the original on the UI thread — no re-render, so the carousel the
  // gesture lives in is never rebuilt mid-pinch.
  const originalStyle = useAnimatedStyle(() => ({
    opacity: liftedKey.value === id ? 0 : 1,
  }));

  return (
    <GestureDetector gesture={pinch}>
      {/* collapsable={false} keeps this View a real native view on Android —
          without it the platform can flatten it away and measureInWindow
          reports the wrong rect, which lands the copy somewhere else. */}
      <View ref={ref} collapsable={false} style={{ width, height }}>
        <Animated.View style={[styles.fill, originalStyle]}>{children}</Animated.View>
      </View>
    </GestureDetector>
  );
}

/** The screen-wide overlay the lifted photo is drawn in. */
export function PinchLiftOverlay({ lift }: { lift: PinchLift }) {
  const { controller, scale, translateX, translateY } = lift;
  const [source, setSource] = useState<LiftSource | null>(null);

  // The overlay owns this state and registers the only way to change it, so a
  // lift re-renders this component alone — see note 2 at the top of the file.
  useEffect(() => {
    controller.current = { show: setSource, hide: () => setSource(null) };
    return () => {
      controller.current = null;
    };
  }, [controller]);

  const scrimStyle = useAnimatedStyle(() => ({
    // Fades in with the zoom, so the page recedes instead of cutting to black.
    opacity: Math.min((scale.value - 1) / 1.5, 1) * MAX_SCRIM,
  }));

  const photoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!source) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: source.x,
            top: source.y,
            width: source.width,
            height: source.height,
            borderRadius: source.borderRadius,
          },
          styles.clip,
          photoStyle,
        ]}
      >
        <Image
          source={{ uri: source.uri }}
          style={styles.fill}
          contentFit={source.contentFit}
          // Already decoded and in cache — this is the photo on screen. No
          // transition: a fade-in here reads as a flicker at the moment of the
          // pinch, which is the one moment it would be noticed.
          transition={0}
          cachePolicy="memory-disk"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  scrim: { backgroundColor: '#000' },
  clip: { overflow: 'hidden' },
});

export default PinchToZoom;
