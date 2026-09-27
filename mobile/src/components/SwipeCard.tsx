import { forwardRef, memo, useCallback, useImperativeHandle } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { AppText } from './AppText';
import { colors, font, radius, spacing } from '../theme';
import type { MarketplaceProduct } from '../types';
import { ProductCard } from './ProductCard';

/**
 * ── HOW A SWIPE IS DECIDED (the Tinder rules) ──
 *
 * A release commits when EITHER
 *   - the card is past DISTANCE_RATIO of the screen width (~90dp on a 360dp
 *     phone), or
 *   - the finger is moving faster than FLICK_VELOCITY in the direction the card
 *     is already leaning, and it has moved at least FLICK_MIN_TRAVEL (so a
 *     twitch on a tap cannot throw a card away).
 * And a card dragged past the line but thrown BACK towards the centre returns,
 * the same as Tinder: the last movement is the intent.
 *
 * ── THE NEXT CARD IS LIVE THE MOMENT YOU LET GO ──
 *
 * A swipe is decided on release, and the card that decided is finished with
 * right then: it is "committed". It still has a few hundred ms of flying off
 * the screen to do, but it does that as a LEAVING card — drawn on top, taking
 * no touches — while the card behind it has already become the front card.
 *
 * This used to happen the other way round. The card stayed the front card
 * until its fling animation ended, and only then did the deck re-render and
 * hand the gesture to the next one. Anyone swiping at a natural pace started
 * their next swipe inside that window, on a card whose gesture was still
 * switched off, and the swipe did nothing.
 */
const DISTANCE_RATIO = 0.25;
/** dp per second. A relaxed flick is ~800–1500; a slow deliberate drag < 300. */
const FLICK_VELOCITY = 600;
const FLICK_MIN_TRAVEL = 24;
/** The fling carries on at the finger's speed; these bound how long it takes. */
const FLING_MIN_MS = 200;
const FLING_MAX_MS = 360;
/** A button press has no finger speed; fling as if flicked at this one. */
const BUTTON_FLING_SPEED = 1800;
/** How long the cards behind take to move up one place after a commit. */
const SETTLE_MS = 240;
/** Tilt at a full screen-width of travel, in degrees. */
const MAX_TILT = 16;
/** Springy, but settles fast: the card snaps home rather than wobbling. */
const SPRING_BACK = { damping: 16, stiffness: 220, mass: 0.9 };
/** How far a finger may travel and still count as a tap, not a drag. */
const TAP_SLOP = 12;
/** The pan claims the finger after this much travel — before TAP_SLOP, so a
 *  drag is always a drag and never waits on the tap to give up. */
const PAN_START = 6;
/**
 * How much of each card behind the front one shows, in dp, below the front
 * card's bottom edge. Every card is the same box (the deck minus two edges),
 * so a card behind is covered by the one in front of it everywhere except this
 * strip, and the strip is inside the card's own bottom padding: the stack reads
 * as depth, and none of the cards behind show a word of their content.
 */
const STACK_EDGE = 6;
/** The deepest a card is ever drawn. Anything further back sits exactly under
 *  the card at this depth, fully hidden, ready to move up without popping in. */
const MAX_BACK = 2;

export interface SwipeCardHandle {
  /** Programmatically fling the card (used by the Like / Pass buttons). */
  swipe: (dir: 'like' | 'pass') => void;
}

/**
 * The deck's shared animation state. Every value here is written on the UI
 * thread by whichever card is at the front, and read by every card, so the
 * whole stack moves together without waiting on React.
 */
export interface DeckMotion {
  /**
   * The `order` of the current front card. Bumped the instant a card commits,
   * which is what makes the next card the front card on the UI thread in the
   * same frame the finger lifts.
   */
  frontOrder: SharedValue<number>;
  /** 0 → 1 as the front card is dragged towards the line. The cards behind lean
   *  forward by this much while you drag. */
  drag: SharedValue<number>;
  /**
   * How far the stack still has to travel forward after a commit, in places.
   * Set on commit to exactly where the cards were leaning, so nothing jumps,
   * then animated to 0. Separate from `drag`, so grabbing the new front card
   * before the stack has finished settling does not snap it.
   */
  settle: SharedValue<number>;
}

interface Props {
  product: MarketplaceProduct;
  /** 0 = the front card, 1, 2, … behind it. From React; used for stacking. */
  depth: number;
  /**
   * This card's place in the deck as it was dealt: 0 for the front card, 1 for
   * the one behind it, and so on. Fixed until the next deal. The card works out
   * how far back it is right now from this and `motion.frontOrder`, on the UI
   * thread, so it never waits on a render to move.
   */
  order: number;
  /** Committed and flying off. Drawn on top, takes no touches. */
  leaving: boolean;
  motion: DeckMotion;
  /** The swipe is decided. Fires on release, not when the fling ends. */
  onCommit: (id: string, liked: boolean) => void;
  /** The card has finished flying off and can be unmounted. */
  onGone: (id: string) => void;
  /** Tap the front card to open the product detail screen. */
  onOpen?: (id: string) => void;
}

/**
 * A single Tinder-style card. The front card is pannable via a Reanimated
 * `Gesture.Pan`; drag it past the line or flick it (see the notes above) to
 * fling it off, otherwise it springs back. Cards behind sit narrower and lower,
 * lean forward as you drag, and glide up one place when a card goes.
 *
 * The front card is also tappable (`onOpen`) and opens the product detail.
 * That tap is an RNGH `Gesture.Tap` raced against the pan rather than a
 * `Pressable` inside ProductCard: a pan handler and the RN touch responder
 * both claim the same finger, and the loser is decided per-platform. Racing
 * two gestures in one system makes it deterministic — a still finger lets the
 * tap win on release, any real travel activates the pan first and cancels the
 * tap, so a swipe can never also register as an open.
 *
 * Memoised: the deck re-renders on every commit, and a commit is the moment the
 * next card has to be ready, so the cards whose props did not change skip it.
 */
export const SwipeCard = memo(
  forwardRef<SwipeCardHandle, Props>(function SwipeCard(
    { product, depth, order, leaving, motion, onCommit, onGone, onOpen },
    ref,
  ) {
    const interactive = depth === 0 && !leaving;
    const { frontOrder, drag, settle } = motion;

    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    /** Where the card was when this drag began — non-zero if it was caught
     *  mid-spring, so it carries on from there instead of jumping to centre. */
    const startX = useSharedValue(0);
    const startY = useSharedValue(0);
    const pressScale = useSharedValue(1);
    /** +1 when the card was grabbed in its top half, −1 in its bottom half. */
    const grabSign = useSharedValue(1);
    const cardHeight = useSharedValue(0);
    /** Set once, on commit. A committed card can never be swiped again. */
    const committed = useSharedValue(false);

    const { width: screenW } = useWindowDimensions();
    const flingDistance = screenW * 1.5;
    const threshold = screenW * DISTANCE_RATIO;
    const id = product.id;

    /**
     * Decide the swipe and throw the card. Runs on the UI thread from the pan,
     * or on the JS thread from the Like / Pass buttons.
     *
     * The stack moves up NOW: `frontOrder` makes the next card the front card
     * and `settle` holds every card exactly where it was leaning, then glides
     * it the rest of the way. The fling carries on at the speed the card was
     * released with — a hard flick leaves fast, a slow drag past the line
     * leaves gently — along the angle it was travelling.
     */
    const commit = useCallback(
      (sign: 1 | -1, velocityX: number, velocityY: number) => {
        'worklet';
        if (committed.value) return;
        committed.value = true;

        const leaned = Math.min(Math.max(drag.value, 0), 1);
        frontOrder.value = frontOrder.value + 1;
        drag.value = 0;
        settle.value = settle.value + (1 - leaned);
        settle.value = withTiming(0, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) });

        const target = sign * flingDistance;
        const speed = Math.max(Math.abs(velocityX), 900);
        const remaining = Math.abs(target - translateX.value);
        // An ease-out starts at twice its average speed, so 2× here makes the
        // card leave the finger at about the speed the finger was going.
        const duration = Math.min(Math.max((2000 * remaining) / speed, FLING_MIN_MS), FLING_MAX_MS);
        const timing = { duration, easing: Easing.out(Easing.quad) };
        translateY.value = withTiming(translateY.value + (velocityY * duration) / 2000, timing);
        translateX.value = withTiming(target, timing, (done) => {
          // Its own directive: the Like / Pass buttons call commit from the JS
          // thread, where this callback would otherwise be a plain function.
          'worklet';
          if (done) runOnJS(onGone)(id);
        });

        runOnJS(onCommit)(id, sign > 0);
      },
      [committed, drag, flingDistance, frontOrder, id, onCommit, onGone, settle, translateX, translateY],
    );

    useImperativeHandle(
      ref,
      () => ({
        swipe: (dir) => {
          grabSign.value = 1;
          const sign = dir === 'like' ? 1 : -1;
          commit(sign, sign * BUTTON_FLING_SPEED, 0);
        },
      }),
      [commit, grabSign],
    );

    const springHome = (velocityX: number, velocityY: number) => {
      'worklet';
      translateX.value = withSpring(0, { ...SPRING_BACK, velocity: velocityX });
      translateY.value = withSpring(0, { ...SPRING_BACK, velocity: velocityY });
      drag.value = withSpring(0, SPRING_BACK);
    };

    const pan = Gesture.Pan()
      .enabled(interactive)
      .minDistance(PAN_START)
      .maxPointers(1)
      .onBegin((e) => {
        // Tinder tilts the card about where you are holding it: grab the top
        // half and the top swings outwards, grab the bottom and it swings the
        // other way. Only decided from rest — flipping it on a card caught
        // mid-spring would snap its tilt the other way.
        if (Math.abs(translateX.value) < 4) {
          grabSign.value = cardHeight.value > 0 && e.y > cardHeight.value / 2 ? -1 : 1;
        }
      })
      .onStart(() => {
        startX.value = translateX.value;
        startY.value = translateY.value;
      })
      .onUpdate((e) => {
        if (committed.value) return;
        // Both axes: the card sits under the finger instead of on a rail.
        translateX.value = startX.value + e.translationX;
        translateY.value = startY.value + e.translationY;
        drag.value = Math.min(Math.abs(translateX.value) / threshold, 1);
      })
      .onEnd((e, success) => {
        if (committed.value) return;
        // Interrupted (a system gesture, a second finger): never leave a card
        // hanging half-dragged.
        if (!success) {
          springHome(0, 0);
          return;
        }
        const x = translateX.value;
        const sign: 1 | -1 = x > 0 ? 1 : -1;
        const movingOut = Math.sign(e.velocityX) === sign;
        const flicked =
          movingOut && Math.abs(e.velocityX) > FLICK_VELOCITY && Math.abs(x) > FLICK_MIN_TRAVEL;
        const thrownBack = !movingOut && Math.abs(e.velocityX) > FLICK_VELOCITY;
        if ((Math.abs(x) >= threshold && !thrownBack) || flicked) {
          commit(sign, e.velocityX, e.velocityY);
        } else {
          springHome(e.velocityX, e.velocityY);
        }
      });

    const open = useCallback(() => {
      onOpen?.(id);
    }, [onOpen, id]);

    const tap = Gesture.Tap()
      .enabled(interactive && !!onOpen)
      .maxDistance(TAP_SLOP)
      .onBegin(() => {
        pressScale.value = withTiming(0.985, { duration: 90 });
      })
      .onEnd((_e, success) => {
        if (success && !committed.value) runOnJS(open)();
      })
      // Runs whether the tap succeeded, failed, or lost the race to the pan —
      // so the card can never be left stuck at the pressed scale mid-swipe.
      .onFinalize(() => {
        pressScale.value = withTiming(1, { duration: 120 });
      });

    const gesture = Gesture.Race(pan, tap);

    // ONE style for every card, front, behind or leaving, so a card changing
    // role never switches formula and never jumps. `back` is how many places
    // behind the front the card is drawn — a continuous number, 0 for the
    // front card and for any card already committed.
    const cardStyle = useAnimatedStyle(() => {
      const rel = order - frontOrder.value;
      const back =
        rel < 0 ? 0 : Math.min(Math.max(rel - drag.value + settle.value, 0), MAX_BACK);
      return {
        transform: [
          { translateX: translateX.value },
          // Narrower and lower, never shorter: a uniform scale shrank the
          // card's height too, and the offset needed to make up for it pushed
          // the card behind's footer out below the front card.
          { translateY: translateY.value + back * STACK_EDGE },
          { rotate: `${(translateX.value / screenW) * MAX_TILT * grabSign.value}deg` },
          { scaleX: 1 - 0.05 * back },
          { scale: pressScale.value },
        ],
      };
    });

    const likeStyle = useAnimatedStyle(() => ({
      opacity: Math.min(Math.max(translateX.value, 0) / threshold, 1),
    }));
    const passStyle = useAnimatedStyle(() => ({
      opacity: Math.min(Math.max(-translateX.value, 0) / threshold, 1),
    }));

    return (
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[styles.card, { zIndex: leaving ? 10 : 5 - depth }, cardStyle]}
          // A card flying off is still over the deck for a moment; it must not
          // take the touch meant for the card that is now in front.
          pointerEvents={leaving ? 'none' : 'auto'}
          onLayout={(e) => {
            cardHeight.value = e.nativeEvent.layout.height;
          }}
        >
          <Animated.View style={[styles.stamp, styles.likeStamp, likeStyle]} pointerEvents="none">
            <AppText style={styles.likeText}>LIKE</AppText>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.passStamp, passStyle]} pointerEvents="none">
            <AppText style={styles.passText}>PASS</AppText>
          </Animated.View>
          {/* The deck row carries its joined seller, same as the feed. */}
          <ProductCard
            product={product}
            sellerName={product.seller?.full_name}
            sellerAvatarUrl={product.seller?.avatar_url}
            style={styles.fill}
            fillPhoto
          />
        </Animated.View>
      </GestureDetector>
    );
  }),
);

const styles = StyleSheet.create({
  // Every card, front or behind, fills the deck less the two stack edges. The
  // deck's height comes from the screen's flex layout, so the card's does too.
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: STACK_EDGE * 2,
  },
  fill: {
    flex: 1,
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
