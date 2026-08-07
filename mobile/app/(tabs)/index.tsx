import Feather from '@expo/vector-icons/Feather';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CampusSwitcherModal } from '../../src/components/CampusSwitcherModal';
import { DemoCampusAlert } from '../../src/components/DemoCampusAlert';
import { FilterSheet } from '../../src/components/FilterSheet';
import { ProductCard } from '../../src/components/ProductCard';
import { Skeleton } from '../../src/components/Skeleton';
import { SwipeDeck } from '../../src/components/SwipeDeck';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMarketplaceFeed } from '../../src/hooks/useMarketplace';
import { useMarketplaceFilters } from '../../src/hooks/useMarketplaceFilters';
import { useToggleLike, useToggleSave } from '../../src/hooks/useProductActions';
import { useUniversities } from '../../src/hooks/useUniversities';
import { SORT_OPTIONS } from '../../src/lib/marketplace';
import { hrefWithFrom } from '../../src/lib/nav';
import { colors, font, radius, spacing } from '../../src/theme';
import type { MarketplaceProduct, University } from '../../src/types';

const BRAND = [colors.purple, colors.pinkDark] as const;
const SCREEN_PAD = spacing.lg;
const GAP = spacing.md;
const HALF_GAP = GAP / 2;
const SKELETON_COUNT = 6;

type ViewMode = 'grid' | 'swipe';

export default function MarketplaceScreen() {
  const router = useRouter();
  const { profile, isDemoUser, signOut } = useAuth();
  const myUserId = profile?.id;
  const homeUniversityId = profile?.university_id ?? undefined;

  const [viewedUniversityId, setViewedUniversityId] = useState<string | undefined>(homeUniversityId);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
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

  const handleShare = (item: MarketplaceProduct) => {
    Share.share({ message: `Check out "${item.title}" for ₹${item.price} on Yahora` }).catch(() => {});
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
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* Header — campus branding + switch + filters. */}
      <View style={styles.header}>
        <Pressable
          onPress={() => setCampusOpen(true)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Switch campus"
          style={styles.brandRow}
        >
          <Text style={styles.brand}>Yahora</Text>
          <Text style={styles.brandDash}>—</Text>
          <Text style={styles.campus} numberOfLines={1}>
            {campusName}
          </Text>
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
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={18} color={colors.mutedLabel} />
        <TextInput
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
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {mode === 'grid' ? 'Grid' : 'Swipe'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.sortScroll}
          contentContainerStyle={styles.sortRow}
        >
          {SORT_OPTIONS.map((s) => {
            const active = activeSort === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setActiveSort(s.key)}
                style={[styles.sortChip, active && styles.sortChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Foreign-campus (view-only) banner */}
      {isForeignCampus ? (
        <View style={styles.foreignBanner}>
          <Feather name="globe" size={14} color={colors.purpleDark} />
          <Text style={styles.foreignText}>
            Browsing {campusName} — view only. Buying and listing stay on your home campus.
          </Text>
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
            <Feather name="plus" size={20} color={colors.white} />
            <Text style={styles.fabText}>List an item</Text>
          </LinearGradient>
        </Pressable>
      ) : null}

      <FilterSheet visible={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} />
      <CampusSwitcherModal
        visible={campusOpen}
        onClose={() => setCampusOpen(false)}
        currentId={viewedUniversityId}
        onSelect={handleSetUniversity}
      />
      <DemoCampusAlert
        visible={demoAlertOpen}
        onClose={() => setDemoAlertOpen(false)}
        onSignUp={handleDemoSignUp}
      />
    </SafeAreaView>
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
            <Text style={styles.primaryText}>{actionLabel}</Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },

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
    fontSize: 24,
    color: colors.purple,
  },
  brandDash: {
    fontFamily: font.family.regular,
    fontSize: 16,
    color: colors.mutedLabel,
  },
  campus: {
    fontFamily: font.family.semibold,
    fontSize: 14,
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
    fontSize: 10,
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
    fontSize: 15,
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
    fontSize: 12.5,
    color: colors.mutedText,
  },
  segmentTextActive: {
    color: colors.white,
  },
  sortScroll: {
    flex: 1,
  },
  sortRow: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: SCREEN_PAD,
  },
  sortChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  sortChipActive: {
    backgroundColor: colors.pinkLight,
    borderColor: colors.inputBorderFocus,
  },
  sortChipText: {
    fontFamily: font.family.semibold,
    fontSize: 12.5,
    color: colors.mutedText,
  },
  sortChipTextActive: {
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
    fontSize: 12,
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
    fontSize: 17,
    color: colors.blackSoft,
    textAlign: 'center',
  },
  stateText: {
    fontFamily: font.family.regular,
    fontSize: 13,
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
    fontSize: 14,
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
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
  },
  fabText: {
    fontFamily: font.family.semibold,
    fontSize: 14,
    color: colors.white,
  },
});
