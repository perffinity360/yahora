import Feather from '@expo/vector-icons/Feather';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../src/components/AppText';
import { AppTextInput } from '../../src/components/AppTextInput';
import { CampusSwitcherModal } from '../../src/components/CampusSwitcherModal';
import { DemoCampusAlert } from '../../src/components/DemoCampusAlert';
import { FilterSheet } from '../../src/components/FilterSheet';
import { ProductCard } from '../../src/components/ProductCard';
import { ScreenGradient } from '../../src/components/ScreenGradient';
import { Skeleton } from '../../src/components/Skeleton';
import { SwipeDeck } from '../../src/components/SwipeDeck';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMarketplaceFeed } from '../../src/hooks/useMarketplace';
import { useMarketplaceFilters } from '../../src/hooks/useMarketplaceFilters';
import { useToggleLike } from '../../src/hooks/useProductActions';
import { useUniversities } from '../../src/hooks/useUniversities';
import { SORT_OPTIONS, type SortKey } from '../../src/lib/marketplace';
import { hrefWithFrom } from '../../src/lib/nav';
import { colors, font, radius, spacing } from '../../src/theme';
import type { MarketplaceProduct, University } from '../../src/types';

const BRAND = [colors.purple, colors.pinkDark] as const;
const SCREEN_PAD = spacing.lg;
/**
 * ── THE CARD GRID'S OWN SPACING ──
 *
 * Tighter than the rest of the screen, and deliberately so: at SCREEN_PAD (24)
 * either side plus a 16 gutter, a 2-up grid on a 360dp phone left each card
 * about 152dp to hold a price, a location, a two-line title and a seller. The
 * space around the cards was costing the cards. 12 / 10 buys each one ~11dp.
 *
 * The three numbers are separate because the columns and the rows want
 * different gaps — a 10dp gutter reads as "two columns of one grid" while 12dp
 * between rows keeps the rows from stacking into a wall.
 *
 * These are the same three values in profile/[id].tsx and (tabs)/profile.tsx.
 * If you change one, change all three files — the grids are meant to match.
 */
const GRID_PAD = 12;
const GRID_COL_GAP = 10;
const GRID_ROW_GAP = 12;
const SKELETON_COUNT = 6;

type ViewMode = 'grid' | 'swipe';

/**
 * The `from` breadcrumb a swipe card hands to the product detail screen.
 *
 * Back out of a detail screen and `goBack()` runs `router.replace(from)`, which
 * re-mounts this screen from scratch (the root layout is a `<Slot/>`). Plain
 * `/(tabs)` would therefore drop the user back into the GRID after they tapped
 * a card in swipe mode. The `view` param survives the round trip and restores
 * the mode they were actually in; the deck itself is restored inside SwipeDeck.
 */
const SWIPE_HREF = '/(tabs)?view=swipe';

/**
 * WHERE THE GRID WAS SCROLLED TO, remembered OUTSIDE the component tree.
 *
 * Same problem and same shape as `swipedMemo` in SwipeDeck. Tapping a card
 * opens `/product/:id`, and coming back runs `router.replace(from)` (see
 * src/lib/nav.ts) — the root layout is a `<Slot/>`, so this whole screen is
 * torn down and rebuilt. A `useRef` or a piece of state cannot survive that, so
 * a student who tapped the twentieth item was returned to the first one and had
 * to scroll past everything they had already looked at.
 *
 * ── WRITTEN IN EXACTLY ONE PLACE ──
 * `rememberGridPosition()`, called as a card is opened. That is what makes this
 * "restore only when coming back from a product". Arriving any other way — cold
 * start, the tab bar, back from /sell — finds no memo and lands at the top,
 * which is what those entries should do.
 *
 * ── AND READ EXACTLY ONCE ──
 * The restore consumes it (`gridScrollMemo = null`), so one saved position is
 * good for one return trip and can never fire again later.
 *
 * Module scope also means it dies with the app, which is the right lifetime for
 * "where I was a moment ago".
 */
let gridScrollMemo: { signature: string; offset: number } | null = null;

/**
 * The campus being browsed, for the same reason and with the same lifetime as
 * `gridScrollMemo`: the screen is rebuilt on the way back from a product, and
 * `viewedUniversityId` used to reset to the home campus — so a student browsing
 * another campus came back to their own, at the top. The website keeps the
 * same thing in sessionStorage (`yahora_last_visited_uni`).
 */
let viewedUniversityMemo: { userId: string; universityId: string } | null = null;

/**
 * The identity of the list an offset was measured against.
 *
 * An offset is POSITIONAL: 1,400dp down is only "where I was" if the same items
 * are in the same order. The filters, the search box and the sort live in
 * component state (useMarketplaceFilters), so they reset when this screen is
 * rebuilt — a student who was browsing a filtered feed comes back to the full
 * one, and restoring into that would drop them somewhere arbitrary, which is
 * worse than the top. Comparing the ordered ids makes the restore a no-op in
 * exactly those cases instead of a wrong answer.
 */
function feedSignature(items: MarketplaceProduct[]): string {
  return items.map((p) => p.id).join('|');
}

export default function MarketplaceScreen() {
  const router = useRouter();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const { profile, isDemoUser, signOut } = useAuth();
  const myUserId = profile?.id;
  const homeUniversityId = profile?.university_id ?? undefined;

  const [viewedUniversityId, setViewedUniversityId] = useState<string | undefined>(
    // Keyed to the student: sign out and in as someone else in the same app
    // session and the previous student's campus must not carry over.
    () =>
      (viewedUniversityMemo && viewedUniversityMemo.userId === myUserId
        ? viewedUniversityMemo.universityId
        : undefined) ?? homeUniversityId,
  );
  // Read once, on mount: after that the toggle owns the mode, so landing here
  // with ?view=swipe never fights a later switch back to the grid.
  const [viewMode, setViewMode] = useState<ViewMode>(view === 'swipe' ? 'swipe' : 'grid');
  const [filterOpen, setFilterOpen] = useState(false);
  const [campusOpen, setCampusOpen] = useState(false);
  const [demoAlertOpen, setDemoAlertOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Default to the home campus once the profile resolves.
  useEffect(() => {
    if (!viewedUniversityId && homeUniversityId) setViewedUniversityId(homeUniversityId);
  }, [homeUniversityId, viewedUniversityId]);

  const isForeignCampus = !!homeUniversityId && !!viewedUniversityId && viewedUniversityId !== homeUniversityId;

  const { data: universities } = useUniversities();
  const campusName = universities?.find((u) => u.id === viewedUniversityId)?.name ?? 'Your campus';

  const { data, isLoading, isError, refetch } = useMarketplaceFeed(viewedUniversityId);
  const hasData = !!data;

  const filters = useMarketplaceFilters(data?.products ?? [], myUserId);
  const { displayProducts, activeFilterCount, activeSort, setActiveSort } = filters;

  const feedKey = ['marketplace', viewedUniversityId] as const;
  const toggleLike = useToggleLike(feedKey);

  const { width } = useWindowDimensions();
  const cardWidth = (width - GRID_PAD * 2 - GRID_COL_GAP) / 2;
  const swipeCardW = Math.min(width - SCREEN_PAD * 2, 340);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleSetUniversity = (u: University) => {
    // Demo users are locked to the sandbox campus.
    if (isDemoUser && homeUniversityId && u.id !== homeUniversityId) {
      setDemoAlertOpen(true);
      return;
    }
    if (myUserId) viewedUniversityMemo = { userId: myUserId, universityId: u.id };
    setViewedUniversityId(u.id);
  };

  const handleDemoSignUp = async () => {
    setDemoAlertOpen(false);
    try {
      await signOut();
    } finally {
      router.replace('/(auth)/login');
    }
  };

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.purple}
      colors={[colors.purple]}
    />
  );

  /** The branch below that renders the FlashList grid — mirrors its conditions. */
  const showsGrid =
    !isLoading && !(isError && !hasData) && viewMode !== 'swipe' && displayProducts.length > 0;

  /** Shared by the pinned banner and the grid-header one. The first line is one
   *  line, always: the campus name is the only part allowed to give up space
   *  (long names end in "…"); "view only" is the point, so it never truncates. */
  const foreignBannerBody = (
    <>
      <Feather name="globe" size={14} color={colors.purpleDark} />
      <View style={styles.foreignBody}>
        <View style={styles.foreignLine}>
          <AppText style={[styles.foreignText, styles.foreignName]} numberOfLines={1}>
            Browsing {campusName}
          </AppText>
          <AppText style={styles.foreignText} numberOfLines={1}>
            {' — view only.'}
          </AppText>
        </View>
        <AppText style={styles.foreignText}>Buying and listing stay on your home campus.</AppText>
      </View>
    </>
  );

  /* ── Keeping your place in the feed (see `gridScrollMemo` above) ──────── */

  // Drives the grid's scroll position: to the top when the sort order changes,
  // and back to where the student was when they return from a product.
  const gridRef = useRef<FlashListRef<MarketplaceProduct>>(null);

  /** The live scroll offset. A ref, not state: this changes on every frame of
   *  every scroll and nothing on screen depends on it. */
  const gridOffset = useRef(0);
  /** The current list, readable from a STABLE callback — putting
   *  `displayProducts` in `openProduct`'s deps would rebuild `renderItem`, and
   *  with it every row, on every filter keystroke. */
  const feedRef = useRef<MarketplaceProduct[]>(displayProducts);
  feedRef.current = displayProducts;
  /** One restore per mount, whether or not there was anything to restore. */
  const restoredRef = useRef(false);

  /**
   * ── NO FLASH OF THE TOP ON THE WAY BACK ──
   * FlashList can only be scrolled once it has drawn, so a return trip used to
   * paint the first rows for a frame or two and THEN jump to the saved offset —
   * a visible flicker of the top of the feed. FlashList 2.0's
   * `initialScrollIndex` would start at the right ROW but not the right pixel.
   *
   * So when there is a position to go back to, the grid starts invisible, is
   * scrolled while nobody can see it, and fades in already in place. Every
   * other arrival starts at full opacity and never waits on this.
   */
  const [gridOpacity] = useState(
    () => new Animated.Value(gridScrollMemo && gridScrollMemo.offset > 0 ? 0 : 1),
  );
  const revealGrid = useCallback(() => {
    Animated.timing(gridOpacity, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [gridOpacity]);

  const rememberGridPosition = useCallback(() => {
    gridScrollMemo = {
      signature: feedSignature(feedRef.current),
      offset: gridOffset.current,
    };
  }, []);

  /**
   * Fired by FlashList's `onLoad`, which is the first moment the list has
   * actually drawn rows — and therefore the first moment it has a scrollable
   * height to move within. Calling `scrollToOffset` any earlier (in an effect
   * on mount) silently does nothing, because there is nowhere to scroll yet.
   */
  const restoreGridPosition = useCallback(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const memo = gridScrollMemo;
    gridScrollMemo = null;
    if (!memo || memo.offset <= 0 || memo.signature !== feedSignature(feedRef.current)) {
      revealGrid();
      return;
    }

    // Not animated: this is a restore, not a movement. The student should find
    // the feed where they left it, not watch it scroll there.
    gridRef.current?.scrollToOffset({ offset: memo.offset, animated: false });
    // Two frames: one for the scroll to land, one for FlashList to draw the
    // rows at the new offset. Revealing any sooner shows blank cells.
    requestAnimationFrame(() => requestAnimationFrame(revealGrid));
  }, [revealGrid]);

  // Belt and braces for the hidden grid: if `onLoad` never fires (it should),
  // the feed must not stay invisible. Armed only once the grid is actually on
  // screen, so a slow first load behind the skeleton cannot trip it early.
  useEffect(() => {
    if (!showsGrid) return;
    const t = setTimeout(revealGrid, 800);
    return () => clearTimeout(t);
  }, [showsGrid, revealGrid]);

  const openProduct = useCallback(
    (id: string) => {
      rememberGridPosition();
      router.push(hrefWithFrom(`/product/${id}`, '/(tabs)'));
    },
    [rememberGridPosition, router],
  );

  const renderCard = useCallback(
    ({ item }: { item: MarketplaceProduct }) => (
      <View style={styles.cell}>
        <ProductCard
          product={item}
          style={styles.cardFill}
          isLiked={item.is_liked}
          sellerName={item.seller?.full_name}
          sellerAvatarUrl={item.seller?.avatar_url}
          onPress={() => openProduct(item.id)}
          onLike={() => toggleLike.mutate({ productId: item.id })}
        />
      </View>
    ),
    [openProduct, toggleLike],
  );

  /**
   * Set when a sort chip changes the order, cleared once the REORDERED list has
   * been scrolled to the top.
   *
   * Scrolling in the chip's onPress alone was not reliable — it worked most
   * times and silently did nothing the rest, which is what a race looks like
   * from the outside. The press issues a scroll, then `setActiveSort` re-renders
   * the list with completely different `data`, and FlashList settles its own
   * scroll position for that new content *after* our call. Whichever lands last
   * wins, and that is timing, not logic.
   *
   * `displayProducts` is memoised on `activeSort` (useMarketplaceFilters), so
   * its identity changes exactly once per re-sort. Scrolling in an effect keyed
   * on it means we move AFTER the new order is committed, which is the only
   * point at which the offset is ours to set.
   */
  const pendingScrollTop = useRef(false);

  /* ── Sort dropdown ───────────────────────────────────────────────────── */
  /** Wide enough for "Lowest Price" plus its tick without wrapping. */
  const SORT_MENU_MIN_WIDTH = 168;

  const sortAnchor = useRef<View>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  /** Where to draw the menu, measured from the trigger so it opens under it. */
  const [sortMenuAt, setSortMenuAt] = useState({ top: 0, left: 0, width: 0 });

  const activeSortLabel =
    SORT_OPTIONS.find((o) => o.key === activeSort)?.label ?? SORT_OPTIONS[0].label;

  const openSortMenu = () => {
    // Measured in window coordinates, so the menu lands under the trigger
    // wherever the row happens to sit — no hardcoded offsets to drift.
    //
    // `w`/`h`, not `width`/`height`: `width` is already the window width from
    // useWindowDimensions above, and shadowing it here is how the menu ended up
    // being positioned against the wrong number in the first place.
    sortAnchor.current?.measureInWindow((x, y, w, h) => {
      const menuWidth = Math.max(w, SORT_MENU_MIN_WIDTH);

      // RIGHT-aligned to the trigger, then clamped inside the screen.
      //
      // Left-aligning it ran the menu off the right edge, because the trigger
      // sits against the right gutter and the menu is wider than it is. Lining
      // the two right edges up is also what a dropdown under a right-aligned
      // control is supposed to do.
      //
      // The clamp is not paranoia: a longer sort label, a bigger font scale or
      // a narrower phone each move the trigger, and any of them could push the
      // menu back off one edge or the other.
      const preferredLeft = x + w - menuWidth;
      const left = Math.min(
        Math.max(preferredLeft, SCREEN_PAD),
        Math.max(width - menuWidth - SCREEN_PAD, SCREEN_PAD),
      );

      setSortMenuAt({ top: y + h + 6, left, width: menuWidth });
      setSortMenuOpen(true);
    });
  };

  const chooseSort = (key: SortKey) => {
    setSortMenuOpen(false);
    // Only a genuine change reorders the list; see the effect above.
    if (key !== activeSort) pendingScrollTop.current = true;
    setActiveSort(key);
    gridRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  useEffect(() => {
    if (!pendingScrollTop.current) return;
    pendingScrollTop.current = false;
    // Not animated: the list is entirely different content now, so there is
    // nothing to animate THROUGH — and an in-flight animation is the thing that
    // was getting clobbered. An instant jump cannot be half-finished.
    gridRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [displayProducts]);

  const emptyTitle = filters.search.trim()
    ? `No results for "${filters.search.trim()}"`
    : filters.showWishlist
      ? 'Your wishlist is empty'
      : `No items listed in ${campusName} right now`;
  const emptySubtitle = filters.showWishlist
    ? 'Explore the marketplace and save items you love.'
    : filters.search.trim()
      ? 'Try a different search or clear your filters.'
      : 'Be the first to list something!';

  return (
    <View style={styles.root}>
      <ScreenGradient />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header — campus branding + switch + filters. */}
      <View style={styles.header}>
        <Pressable
          onPress={() => setCampusOpen(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Switch campus"
          style={styles.brandRow}
        >
          <AppText style={styles.brand}>Yahora</AppText>
          <AppText style={styles.brandDash}>—</AppText>
          <AppText style={styles.campus} numberOfLines={1}>
            {campusName}
          </AppText>
          <Feather name="chevron-down" size={16} color={colors.purple} />
        </Pressable>

        <Pressable
          onPress={() => setFilterOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Filters"
          style={({ pressed }) => [styles.filterBtn, pressed && styles.filterBtnPressed]}
        >
          <Feather name="sliders" size={18} color={colors.purple} />
          {activeFilterCount > 0 ? (
            <View style={styles.badge}>
              <AppText style={styles.badgeText}>{activeFilterCount}</AppText>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={18} color={colors.mutedLabel} />
        <AppTextInput
          value={filters.search}
          onChangeText={filters.setSearch}
          placeholder="Search the marketplace"
          placeholderTextColor={colors.mutedPlaceholder}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {filters.search ? (
          <Pressable onPress={() => filters.setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
            <Feather name="x" size={16} color={colors.mutedLabel} />
          </Pressable>
        ) : null}
      </View>

      {/* View toggle + sort */}
      <View style={styles.controls}>
        <View style={styles.segment}>
          {(['grid', 'swipe'] as ViewMode[]).map((mode) => {
            const active = viewMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setViewMode(mode)}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Feather
                  name={mode === 'grid' ? 'grid' : 'layers'}
                  size={14}
                  color={active ? colors.white : colors.mutedText}
                />
                <AppText style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {mode === 'grid' ? 'Grid' : 'Swipe'}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* One control instead of a strip. Three chips did not fit the row, so
            the third was always off-screen behind a scroll nobody could see —
            "Trending" existed but was effectively undiscoverable. A dropdown
            shows the CURRENT sort as its label, which the strip never did. */}
        <Pressable
          ref={sortAnchor}
          onPress={openSortMenu}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${activeSortLabel}. Change sort order`}
          style={({ pressed }) => [styles.sortTrigger, pressed && styles.sortTriggerPressed]}
        >
          <Feather name="bar-chart-2" size={13} color={colors.purple} />
          <AppText style={styles.sortTriggerText} numberOfLines={1}>
            {activeSortLabel}
          </AppText>
          <Feather name="chevron-down" size={14} color={colors.mutedText} />
        </Pressable>
      </View>

      {/* Foreign-campus banner, pinned — only where there is no grid to ride
          inside. With listings on screen it is the grid's header instead. */}
      {isForeignCampus && !showsGrid ? (
        <View style={[styles.foreignBanner, styles.foreignBannerPinned]}>{foreignBannerBody}</View>
      ) : null}

      {/* Content */}
      {isLoading ? (
        viewMode === 'swipe' ? (
          <View style={styles.swipeLoading}>
            <Skeleton width={swipeCardW} height={swipeCardW + 120} rounded={radius.lg} />
          </View>
        ) : (
          <SkeletonGrid cardWidth={cardWidth} />
        )
      ) : isError && !hasData ? (
        <ScrollView
          contentContainerStyle={styles.stateScroll}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <FeedState
            icon="wifi-off"
            title="Couldn't load the marketplace"
            subtitle="Check your connection and pull to refresh."
            actionLabel="Retry"
            actionIcon="refresh-cw"
            onAction={refetch}
          />
        </ScrollView>
      ) : viewMode === 'swipe' ? (
        <SwipeDeck
          products={displayProducts}
          onLikeProduct={(id) => toggleLike.mutate({ productId: id })}
          onOpenProduct={(id) => router.push(hrefWithFrom(`/product/${id}`, SWIPE_HREF))}
          onBackToGrid={() => setViewMode('grid')}
        />
      ) : displayProducts.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.stateScroll}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <FeedState
            icon={filters.showWishlist ? 'bookmark' : 'shopping-bag'}
            title={emptyTitle}
            subtitle={emptySubtitle}
            actionLabel={activeFilterCount > 0 ? 'Clear filters' : !isForeignCampus ? 'List an item' : undefined}
            actionIcon={activeFilterCount > 0 ? 'x' : 'plus'}
            onAction={
              activeFilterCount > 0
                ? filters.clearFilters
                : !isForeignCampus
                  ? () => router.push('/sell')
                  : undefined
            }
          />
        </ScrollView>
      ) : (
        <Animated.View style={[styles.gridWrap, { opacity: gridOpacity }]}>
        <FlashList
          ref={gridRef}
          // The foreign-campus banner rides at the top of the scroll, so it
          // slides away with the first row as soon as the student scrolls and
          // comes back when they return to the top. Pinned above the list it
          // cost ~50dp of every screenful for the whole visit.
          ListHeaderComponent={
            isForeignCampus ? (
              <View style={[styles.foreignBanner, styles.foreignBannerInList]}>{foreignBannerBody}</View>
            ) : null
          }
          // ⚠ OFF, and this is the fix for "switching sort leaves a sliver of
          // the old first row on screen".
          //
          // FlashList v2 turns maintainVisibleContentPosition ON by default: on
          // a data change it re-anchors the scroll so the item you were looking
          // at stays put. That is right for a chat, where messages arrive above
          // what you are reading. It is exactly wrong for a re-sort, where every
          // item moves on purpose — it would restore the anchor a moment after
          // our scrollToOffset, landing just short of the top.
          //
          // This list only ever gets a wholesale replacement (refetch or
          // re-sort), so there is no position worth preserving across one.
          maintainVisibleContentPosition={{ disabled: true }}
          data={displayProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={renderCard}
          // Flattened: FlashList reads its padding off a plain object.
          contentContainerStyle={StyleSheet.flatten([
            styles.listContent,
            isForeignCampus && styles.listContentBanner,
          ])}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          // Recording where the student is, so opening a card can remember it.
          // The handler only writes a ref, so a 16ms cadence costs nothing and
          // means the offset is current at the instant a card is tapped.
          onScroll={(e) => {
            gridOffset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          onLoad={restoreGridPosition}
        />
        </Animated.View>
      )}

      {/* List-an-item FAB (home campus only) */}
      {!isForeignCampus ? (
        <Pressable
          onPress={() => router.push('/sell')}
          accessibilityRole="button"
          accessibilityLabel="List an item"
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
            <Feather name="plus" size={17} color={colors.white} />
            <AppText style={styles.fabText}>List an item</AppText>
          </LinearGradient>
        </Pressable>
      ) : null}

      {/* Rendered as a Modal so it escapes the list's stacking context — an
          absolutely positioned menu inside the screen would sit under the FAB
          and under FlashList's own layers. */}
      <Modal
        visible={sortMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortMenuOpen(false)}
      >
        <Pressable style={styles.sortBackdrop} onPress={() => setSortMenuOpen(false)}>
          <View
            style={[
              styles.sortMenu,
              // `width`, not `minWidth`: the clamp above computed a box that is
              // known to fit, and minWidth would let the content grow back past
              // the edge it was just pulled inside.
              { top: sortMenuAt.top, left: sortMenuAt.left, width: sortMenuAt.width },
            ]}
          >
            {SORT_OPTIONS.map((option, index) => {
              const active = option.key === activeSort;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => chooseSort(option.key)}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.sortItem,
                    index > 0 && styles.sortItemDivided,
                    pressed && styles.sortItemPressed,
                  ]}
                >
                  <AppText style={[styles.sortItemText, active && styles.sortItemTextActive]}>
                    {option.label}
                  </AppText>
                  {active ? <Feather name="check" size={15} color={colors.purple} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} />
      <CampusSwitcherModal
        visible={campusOpen}
        onClose={() => setCampusOpen(false)}
        currentId={viewedUniversityId}
        homeId={homeUniversityId}
        onSelect={handleSetUniversity}
      />
      <DemoCampusAlert
        visible={demoAlertOpen}
        onClose={() => setDemoAlertOpen(false)}
        onSignUp={handleDemoSignUp}
      />
      </SafeAreaView>
    </View>
  );
}

/* ────────────────────────── Loading skeleton ────────────────────────── */
function SkeletonGrid({ cardWidth }: { cardWidth: number }) {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
        <View key={i} style={styles.cell}>
          <Skeleton width="100%" height={cardWidth} rounded={radius.lg} />
          <Skeleton width="60%" height={14} rounded={7} style={styles.skeletonLine} />
          <Skeleton width="85%" height={12} rounded={6} style={styles.skeletonLineSm} />
        </View>
      ))}
    </View>
  );
}

/* ────────────────────────── Empty / error state ────────────────────────── */
function FeedState({
  icon,
  title,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Feather.glyphMap;
  onAction?: () => void;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={28} color={colors.purple} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}>
          <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryGradient}>
            {actionIcon ? <Feather name={actionIcon} size={16} color={colors.white} /> : null}
            <AppText style={styles.primaryText}>{actionLabel}</AppText>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.appBgBottom,
  },
  // The root holds the gradient; the safe area sits transparently on top of it.
  safe: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: SCREEN_PAD,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexShrink: 1,
  },
  brand: {
    fontFamily: font.family.serif,
    fontSize: font.sizes.headline,
    color: colors.purple,
  },
  brandDash: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.bodyLg,
    color: colors.mutedLabel,
  },
  campus: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.blackSoft,
    flexShrink: 1,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  filterBtnPressed: {
    backgroundColor: colors.pinkLight,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.pinkDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  badgeText: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    color: colors.white,
  },

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: SCREEN_PAD,
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md + 4,
    backgroundColor: colors.inputBg,
    // Same thin purple edge as the sort pill, so the three controls read as
    // one set instead of two outlined and two floating.
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.family.medium,
    fontSize: font.sizes.bodyLg,
    color: colors.blackSoft,
    paddingVertical: 0,
  },

  /* Controls (view toggle + sort) */
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: SCREEN_PAD,
    marginTop: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 999,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
    gap: 3,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
  segmentBtnActive: {
    backgroundColor: colors.purple,
  },
  segmentText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.mutedText,
  },
  segmentTextActive: {
    color: colors.white,
  },
  sortTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    // Pushed to the right edge: the view toggle owns the left, the sort owns
    // the right, and the row reads as two controls instead of a queue.
    marginLeft: 'auto',
    marginRight: SCREEN_PAD,
    borderRadius: 999,
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  sortTriggerPressed: {
    backgroundColor: colors.pinkLight,
  },
  sortTriggerText: {
    flexShrink: 1,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.purpleDark,
  },

  sortBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  sortMenu: {
    position: 'absolute',
    borderRadius: radius.md + 4,
    paddingVertical: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
    shadowColor: colors.purple,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  sortItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  sortItemDivided: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  sortItemPressed: {
    backgroundColor: colors.pinkLight,
  },
  sortItemText: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.body,
    color: colors.mutedText,
  },
  sortItemTextActive: {
    fontFamily: font.family.bold,
    color: colors.purpleDark,
  },

  /* Foreign banner */
  foreignBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  /** Loading, empty, error and swipe: there is nothing to scroll it away with. */
  foreignBannerPinned: {
    marginHorizontal: SCREEN_PAD,
    marginTop: GRID_ROW_GAP,
  },
  /** Inside the grid. The sides: `listContent` already pads to
   *  GRID_PAD - GRID_COL_GAP / 2, so this adds only the rest of SCREEN_PAD.
   *  The spacing: GRID_ROW_GAP above (`listContentBanner`) and below — half
   *  here plus the first row's own half-gap cell padding — so the banner sits
   *  in the grid's rhythm, the same distance from its neighbours as one row of
   *  cards is from the next. */
  foreignBannerInList: {
    marginHorizontal: SCREEN_PAD - (GRID_PAD - GRID_COL_GAP / 2),
    marginBottom: GRID_ROW_GAP / 2,
  },
  foreignBody: {
    flex: 1,
    gap: 1,
  },
  foreignLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // `micro` (11), one step down from `caption` — the 11dp floor, so it cannot
  // go further. Fitting on one line is the `foreignLine` row's job.
  foreignText: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.micro,
    lineHeight: 15,
    color: colors.purpleDark,
  },
  foreignName: {
    flexShrink: 1,
  },

  /* Grid */
  gridWrap: {
    flex: 1,
  },
  listContent: {
    // Each cell carries half a column gutter on each side, so the list pads
    // only the remainder out to the screen edge.
    paddingHorizontal: GRID_PAD - GRID_COL_GAP / 2,
    // Half a row gap: the first row's cells add the other half, so the grid
    // starts GRID_ROW_GAP below the controls — the same distance as one row
    // of cards is from the next. (Was spacing.md, which made it 22.)
    paddingTop: GRID_ROW_GAP / 2,
    paddingBottom: spacing.xl * 3,
  },
  /** With the banner as the list header, the gap above it matches the gap
   *  between two rows of cards — see `foreignBannerInList`. */
  listContentBanner: {
    paddingTop: GRID_ROW_GAP,
  },
  cell: {
    flex: 1,
    paddingHorizontal: GRID_COL_GAP / 2,
    paddingVertical: GRID_ROW_GAP / 2,
  },
  /** Lets the card fill the cell, which FlashList stretches to the tallest in
   *  the row. Only safe to pass from here: `cell` is a column, so `flex: 1` is
   *  a HEIGHT. The profile grids lay their cards out in a row and must not. */
  cardFill: {
    flex: 1,
  },

  /* Skeleton */
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_PAD - GRID_COL_GAP / 2,
    // Same as `listContent`, so the grid does not jump when the feed arrives.
    paddingTop: GRID_ROW_GAP / 2,
  },
  skeletonLine: {
    marginTop: 10,
  },
  skeletonLineSm: {
    marginTop: 8,
  },
  swipeLoading: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xl,
  },

  /* Empty / error */
  stateScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  state: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  stateIcon: {
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
  stateTitle: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.title,
    color: colors.blackSoft,
    textAlign: 'center',
  },
  stateText: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  primaryBtn: {
    marginTop: spacing.lg,
    borderRadius: 999,
    overflow: 'hidden',
  },
  primaryBtnPressed: {
    opacity: 0.9,
  },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
  },
  primaryText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.white,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    right: SCREEN_PAD,
    bottom: spacing.lg,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: colors.purple,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    // Trimmed from 52/lg/14 — it was sitting over two rows of cards and reading
    // as the loudest thing on a screen whose job is the listings. 44 is still
    // over the 44dp minimum touch target, so nothing is harder to hit.
    gap: spacing.xs + 2,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
  },
  fabText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.white,
  },
});
