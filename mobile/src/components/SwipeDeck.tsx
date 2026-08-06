import Feather from '@expo/vector-icons/Feather';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors, font, spacing } from '../theme';
import type { MarketplaceProduct } from '../types';
import { SwipeCard, type SwipeCardHandle } from './SwipeCard';

const SCREEN_PAD = spacing.lg;

interface Props {
  /** The filtered/sorted feed (from the marketplace filters). */
  products: MarketplaceProduct[];
  /** Fire the network like for a right-swiped card (reuses the like mutation). */
  onLikeProduct: (id: string) => void;
  onBackToGrid: () => void;
}

/** The Tinder-style deck: top 3 cards stacked, only the front one interactive. */
export function SwipeDeck({ products, onLikeProduct, onBackToGrid }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - SCREEN_PAD * 2, 340);
  const deckHeight = cardWidth + 150;

  const [deck, setDeck] = useState<MarketplaceProduct[]>([]);
  const topRef = useRef<SwipeCardHandle>(null);

  // Rebuild only when the filtered id SET changes (order-independent), so a
  // like — which flips is_liked but not the set — never re-adds swiped cards.
  const idsKey = useMemo(() => products.map((p) => p.id).slice().sort().join('|'), [products]);
  useEffect(() => {
    setDeck([...products].reverse()); // newest ends up on top of the stack
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const remove = (id: string) => setDeck((prev) => prev.filter((p) => p.id !== id));
  const handleLike = (id: string) => {
    remove(id);
    onLikeProduct(id);
  };

  if (deck.length === 0) {
    return (
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
            <Text style={styles.ghostBtnText}>Back to grid</Text>
          </Pressable>
          {products.length > 0 ? (
            <Pressable
              onPress={() => setDeck([...products].reverse())}
              style={({ pressed }) => [styles.solidBtn, pressed && styles.solidBtnPressed]}
            >
              <Feather name="rotate-ccw" size={16} color={colors.white} />
              <Text style={styles.solidBtnText}>See again</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const visible = deck.slice(-3); // last element = front card

  return (
    <View style={styles.wrap}>
      <View style={[styles.deck, { width: cardWidth, height: deckHeight }]}>
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
            />
          );
        })}
      </View>

      <View style={styles.buttons}>
        <Pressable
          onPress={() => topRef.current?.swipe('pass')}
          accessibilityRole="button"
          accessibilityLabel="Pass"
          style={({ pressed }) => [styles.circleBtn, styles.passBtn, pressed && styles.circlePressed]}
        >
          <Feather name="x" size={30} color={colors.swipePass} />
        </Pressable>
        <Pressable
          onPress={() => topRef.current?.swipe('like')}
          accessibilityRole="button"
          accessibilityLabel="Like"
          style={({ pressed }) => [styles.circleBtn, styles.likeBtn, pressed && styles.circlePressed]}
        >
          <Feather name="heart" size={27} color={colors.swipeLike} />
        </Pressable>
      </View>

      <Text style={styles.counter}>
        {deck.length} item{deck.length !== 1 ? 's' : ''} left
      </Text>
      <Text style={styles.hint}>Swipe right to like · left to pass</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  deck: {
    alignSelf: 'center',
    position: 'relative',
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.xl + spacing.md,
  },
  circleBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
  circlePressed: {
    transform: [{ scale: 0.92 }],
  },
  counter: {
    fontFamily: font.family.semibold,
    fontSize: 13,
    color: colors.mutedText,
    marginTop: spacing.lg,
  },
  hint: {
    fontFamily: font.family.regular,
    fontSize: 12,
    color: colors.mutedLabel,
    marginTop: spacing.xs,
  },

  /* Empty */
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
    fontSize: 17,
    color: colors.blackSoft,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: font.family.regular,
    fontSize: 13,
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
    fontSize: 14,
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
    fontSize: 14,
    color: colors.white,
  },
});
