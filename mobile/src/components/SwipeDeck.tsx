import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AppText } from './AppText';
import { colors, font, spacing } from '../theme';
import type { MarketplaceProduct } from '../types';
import { SwipeCard, type SwipeCardHandle } from './SwipeCard';

const SCREEN_PAD = spacing.lg;
/** Pass, like and list-an-item: one size, so the row reads as one set. */
const ACTION_SIZE = 48;
/**
 * The most the INFO half of a card can need (two-line title, 1.15 font cap).
 * Only used to cap the deck on a tall phone so the photo stops at about square;
 * on every phone we target the deck is shorter than the cap and it never bites.
 */
const INFO_ALLOWANCE = 180;
const BRAND = [colors.purple, colors.pinkDark] as const;

/**
 * Cards already swiped away, remembered OUTSIDE the component tree.
 *
 * Tapping a card opens `/product/:id`, and coming back runs
 * `router.replace(from)` (see src/lib/nav.ts) — the root layout is a `<Slot/>`,
 * so the whole tab screen, this deck included, is torn down and re-created.
 * Without this the deck would rebuild from scratch and hand back every card the
 * user had already passed on, which makes tap-to-open feel like it lost their
 * place.
 *
 * Keyed by `idsKey` so it only ever restores into the SAME filtered feed: change
 * a filter, the campus or the sort and the key no longer matches, so the deck
 * starts fresh exactly as it did before. Module scope means it also clears on
 * app restart, which is the right lifetime for "seen this session".
 */
let swipedMemo: { idsKey: string; ids: string[] } | null = null;

interface Props {
  /** The filtered/sorted feed (from the marketplace filters). */
  products: MarketplaceProduct[];
  /** Fire the network like for a right-swiped card (reuses the like mutation). */
  onLikeProduct: (id: string) => void;
  /** Tap the front card — opens the product detail screen. */
  onOpenProduct: (id: string) => void;
  onBackToGrid: () => void;
  /** List a new item. Omitted on another campus, where listing is not allowed. */
  onListItem?: () => void;
}

/** The Tinder-style deck: top 3 cards stacked, only the front one interactive. */
export function SwipeDeck({
  products,
  onLikeProduct,
  onOpenProduct,
  onBackToGrid,
  onListItem,
}: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - SCREEN_PAD * 2, 340);
  // The deck's HEIGHT is not computed: it is whatever flex leaves after the
  // counter and the action row (see `deckArea`). This is only a ceiling.
  const deckMaxHeight = cardWidth + INFO_ALLOWANCE;

  const [deck, setDeck] = useState<MarketplaceProduct[]>([]);
  const topRef = useRef<SwipeCardHandle>(null);

  // Rebuild only when the filtered id SET changes (order-independent), so a
  // like — which flips is_liked but not the set — never re-adds swiped cards.
  const idsKey = useMemo(() => products.map((p) => p.id).slice().sort().join('|'), [products]);
  useEffect(() => {
    const stacked = [...products].reverse(); // newest ends up on top of the stack
    if (swipedMemo?.idsKey === idsKey) {
      const seen = new Set(swipedMemo.ids);
      setDeck(stacked.filter((p) => !seen.has(p.id)));
    } else {
      swipedMemo = { idsKey, ids: [] };
      setDeck(stacked);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const remove = (id: string) => {
    if (swipedMemo?.idsKey === idsKey) {
      if (!swipedMemo.ids.includes(id)) swipedMemo.ids.push(id);
    } else {
      swipedMemo = { idsKey, ids: [id] };
    }
    setDeck((prev) => prev.filter((p) => p.id !== id));
  };
  const handleLike = (id: string) => {
    remove(id);
    onLikeProduct(id);
  };
  /** "See again" — deal the whole feed back out and forget what was swiped. */
  const resetDeck = () => {
    swipedMemo = { idsKey, ids: [] };
    setDeck([...products].reverse());
  };

  /**
   * List an item, as a round + the same size as pass and like, in the right
   * slot of the action row. In the row, not floating: a flex row cannot
   * overlap its neighbours, so it can never cover the buttons, the counter or
   * the card on any screen size, and it sits where a thumb already is.
   */
  const listItemBtn = onListItem ? (
    <Pressable
      onPress={onListItem}
      accessibilityRole="button"
      accessibilityLabel="List an item"
      style={({ pressed }) => [styles.circleBtn, styles.listBtn, pressed && styles.circlePressed]}
    >
      <LinearGradient
        colors={BRAND}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.listBtnFill}
      >
        <Feather name="plus" size={22} color={colors.white} />
      </LinearGradient>
    </Pressable>
  ) : null;

  if (deck.length === 0) {
    return (
      <View style={styles.emptyOuter}>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Feather name="check-circle" size={28} color={colors.purple} />
          </View>
          <Text style={styles.emptyTitle}>You&apos;ve seen everything!</Text>
          <Text style={styles.emptyText}>Check back later for new listings, or browse the grid.</Text>
          <View style={styles.emptyActions}>
            <Pressable
              onPress={onBackToGrid}
              style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}
            >
              <Feather name="grid" size={16} color={colors.purpleDark} />
              <AppText style={styles.ghostBtnText}>Back to grid</AppText>
            </Pressable>
            {products.length > 0 ? (
              <Pressable
                onPress={resetDeck}
                style={({ pressed }) => [styles.solidBtn, pressed && styles.solidBtnPressed]}
              >
                <Feather name="rotate-ccw" size={16} color={colors.white} />
                <AppText style={styles.solidBtnText}>See again</AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
        {/* Nothing to pass or like, but listing is still one tap away, in the
            same place as when there are cards. */}
        {listItemBtn ? (
          <View style={[styles.actionRow, { width: cardWidth }]}>
            <View style={styles.actionSide} />
            <View style={[styles.actionSide, styles.actionSideEnd]}>{listItemBtn}</View>
          </View>
        ) : null}
      </View>
    );
  }

  const visible = deck.slice(-3); // last element = front card

  return (
    <View style={styles.wrap}>
      {/* Takes every dp the counter and the action row do not need, so the
          buttons below are never pushed under the tab bar. */}
      <View style={styles.deckArea}>
        <View style={[styles.deck, { width: cardWidth, maxHeight: deckMaxHeight }]}>
          {visible.map((product, i, arr) => {
            const depth = arr.length - 1 - i;
            return (
              <SwipeCard
                key={product.id}
                ref={depth === 0 ? topRef : undefined}
                product={product}
                depth={depth}
                onLike={handleLike}
                onPass={remove}
                onOpen={onOpenProduct}
              />
            );
          })}
        </View>
      </View>

      <AppText style={styles.counter} numberOfLines={1}>
        {deck.length} item{deck.length !== 1 ? 's' : ''} left
      </AppText>

      {/* Three slots: an empty one left, pass + like centred, list-an-item
          right. The two sides are equal flex, so pass and like stay centred
          whether or not the + is there (it is not on another campus). */}
      <View style={[styles.actionRow, { width: cardWidth }]}>
        <View style={styles.actionSide} />
        <View style={styles.buttons}>
          <Pressable
            onPress={() => topRef.current?.swipe('pass')}
            accessibilityRole="button"
            accessibilityLabel="Pass"
            style={({ pressed }) => [styles.circleBtn, styles.passBtn, pressed && styles.circlePressed]}
          >
            <Feather name="x" size={22} color={colors.swipePass} />
          </Pressable>
          <Pressable
            onPress={() => topRef.current?.swipe('like')}
            accessibilityRole="button"
            accessibilityLabel="Like"
            style={({ pressed }) => [styles.circleBtn, styles.likeBtn, pressed && styles.circlePressed]}
          >
            <Feather name="heart" size={20} color={colors.swipeLike} />
          </Pressable>
        </View>
        <View style={[styles.actionSide, styles.actionSideEnd]}>{listItemBtn}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.md - 4,
    paddingHorizontal: SCREEN_PAD,
    paddingBottom: spacing.md - 4,
  },
  deckArea: {
    flex: 1,
    // Without this a flex child refuses to shrink below its content, and the
    // content (the card) is exactly what has to give way on a short screen.
    minHeight: 0,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deck: {
    flex: 1,
    position: 'relative',
  },
  actionRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  actionSide: {
    flex: 1,
  },
  actionSideEnd: {
    alignItems: 'flex-end',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  // 48, down from 56: the 16dp goes to the photo. Still over the 44dp minimum
  // touch target.
  circleBtn: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    borderRadius: ACTION_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    shadowColor: colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  passBtn: {
    borderColor: colors.swipePass,
  },
  likeBtn: {
    borderColor: colors.swipeLike,
  },
  listBtn: {
    borderWidth: 0,
    overflow: 'hidden',
    shadowColor: colors.purple,
    shadowOpacity: 0.3,
  },
  listBtnFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePressed: {
    transform: [{ scale: 0.92 }],
  },
  counter: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.mutedText,
    marginTop: spacing.sm,
  },

  /* Empty */
  // The action row carries its own width, so no side padding here: the empty
  // state's text and buttons keep exactly the width they had.
  emptyOuter: {
    flex: 1,
    paddingBottom: spacing.md - 4,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.title,
    color: colors.blackSoft,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.inputBorderFocus,
    backgroundColor: colors.cardSurface,
  },
  ghostBtnPressed: {
    backgroundColor: colors.pinkLight,
  },
  ghostBtnText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.purpleDark,
  },
  solidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.purple,
  },
  solidBtnPressed: {
    backgroundColor: colors.purpleDark,
  },
  solidBtnText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.white,
  },
});
