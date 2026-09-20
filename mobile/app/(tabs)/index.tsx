import Feather from '@expo/vector-icons/Feather';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { useToggleLike, useToggleSave } from '../../src/hooks/useProductActions';
import { useUniversities } from '../../src/hooks/useUniversities';
import { SORT_OPTIONS, type SortKey } from '../../src/lib/marketplace';
import { hrefWithFrom } from '../../src/lib/nav';
import { colors, font, radius, spacing } from '../../src/theme';
import type { MarketplaceProduct, University } from '../../src/types';
import { shareProduct } from '../../src/lib/share';

const BRAND = [colors.purple, colors.pinkDark] as const;
const SCREEN_PAD = spacing.lg;
const GAP = spacing.md;
const HALF_GAP = GAP / 2;
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

export default function MarketplaceScreen() {
  const router = useRouter();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const { profile, isDemoUser, signOut } = useAuth();
  const myUserId = profile?.id;
  const homeUniversityId = profile?.university_id ?? undefined;

  const [viewedUniversityId, setViewedUniversityId] = useState<string | undefined>(homeUniversityId);
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
  const toggleSave = useToggleSave(feedKey);

  const { width } = useWindowDimensions();
  const cardWidth = (width - SCREEN_PAD * 2 - GAP) / 2;
  const swipeCardW = Math.min(width - SCREEN_PAD * 2, 340);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Text, link and platform handling all live in src/lib/share.ts — the app and
  // the website share the same wording, and the link unfurls as a card.
  const handleShare = (item: MarketplaceProduct) => {
    shareProduct(item);
  };

  const handleSetUniversity = (u: University) => {
    // Demo users are locked to the sandbox campus.
    if (isDemoUser && homeUniversityId && u.id !== homeUniversityId) {
      setDemoAlertOpen(true);
      return;
    }
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

  const renderCard = useCallback(
    ({ item }: { item: MarketplaceProduct }) => (
      <View style={styles.cell}>
        <ProductCard
          product={item}
          isLiked={item.is_liked}
          isSaved={item.is_saved}
          sellerName={item.seller?.full_name}
          sellerAvatarUrl={item.seller?.avatar_url}
          onPress={() => router.push(hrefWithFrom(`/product/${item.id}`, '/(tabs)'))}
          onLike={() => toggleLike.mutate({ productId: item.id })}
          onSave={() => toggleSave.mutate({ productId: item.id })}
          onShare={() => handleShare(item)}
        />
      </View>
    ),
    [router, toggleLike, toggleSave],
  );

  // Drives the grid's scroll position when the sort order changes.
  const gridRef = useRef<FlashListRef<MarketplaceProduct>>(null);

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

      {/* Foreign-campus (view-only) banner */}
      {isForeignCampus ? (
        <View style={styles.foreignBanner}>
          <Feather name="globe" size={14} color={colors.purpleDark} />
          <AppText style={styles.foreignText}>
            Browsing {campusName} — view only. Buying and listing stay on your home campus.
          </AppText>
        </View>
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
        <FlashList
          ref={gridRef}
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
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        />
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
    marginHorizontal: SCREEN_PAD,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  foreignText: {
    flex: 1,
    fontFamily: font.family.medium,
    fontSize: font.sizes.caption,
    lineHeight: 16,
    color: colors.purpleDark,
  },

  /* Grid */
  listContent: {
    paddingHorizontal: SCREEN_PAD - HALF_GAP,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl * 3,
  },
  cell: {
    flex: 1,
    padding: HALF_GAP,
  },

  /* Skeleton */
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SCREEN_PAD - HALF_GAP,
    paddingTop: spacing.md,
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
