import Feather from '@expo/vector-icons/Feather';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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

import { ProductCard } from '../../src/components/ProductCard';
import { Skeleton } from '../../src/components/Skeleton';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMarketplaceFeed } from '../../src/hooks/useMarketplace';
import { useToggleLike, useToggleSave } from '../../src/hooks/useProductActions';
import { useUniversities } from '../../src/hooks/useUniversities';
import { colors, font, radius, spacing } from '../../src/theme';
import type { MarketplaceProduct } from '../../src/types';

const BRAND = [colors.purple, colors.pinkDark] as const;
const SCREEN_PAD = spacing.lg;
const GAP = spacing.md;
const HALF_GAP = GAP / 2;
const SKELETON_COUNT = 6;

export default function MarketplaceScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const universityId = profile?.university_id ?? undefined;

  const { data: universities } = useUniversities();
  const campusName = universities?.find((u) => u.id === universityId)?.name ?? 'Your campus';

  const { data, isLoading, isError, refetch } = useMarketplaceFeed(universityId);
  const hasData = !!data;

  // Same query key the feed is cached under, so like/save patch this grid.
  const feedKey = useMemo(() => ['marketplace', universityId] as const, [universityId]);
  const toggleLike = useToggleLike(feedKey);
  const toggleSave = useToggleSave(feedKey);

  const { width } = useWindowDimensions();
  const cardWidth = (width - SCREEN_PAD * 2 - GAP) / 2;

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Server returns all available items; filter title/description locally.
  const filtered = useMemo(() => {
    const all = data?.products ?? [];
    const available = all.filter((p) => p.status !== 'sold');
    const q = search.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (p) =>
        p.title.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q),
    );
  }, [data?.products, search]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleShare = (item: MarketplaceProduct) => {
    Share.share({ message: `Check out "${item.title}" for ₹${item.price} on Yahora` }).catch(
      () => {},
    );
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
          onLike={() => toggleLike.mutate({ productId: item.id })}
          onSave={() => toggleSave.mutate({ productId: item.id })}
          onShare={() => handleShare(item)}
          // onPress → product detail lands in a later phase.
        />
      </View>
    ),
    [toggleLike, toggleSave],
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {/* Header — campus branding. Space kept on the right for the campus
          switcher (4-iv) and filters (4-ii). */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>Yahora</Text>
          <Text style={styles.brandDash}>—</Text>
          <Text style={styles.campus} numberOfLines={1}>
            {campusName}
          </Text>
        </View>
        <View style={styles.filterBtn}>
          <Feather name="sliders" size={18} color={colors.purple} />
        </View>
      </View>

      {/* Search — filters the fetched grid client-side. */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={18} color={colors.mutedLabel} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search the marketplace"
          placeholderTextColor={colors.mutedPlaceholder}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {search ? (
          <Pressable
            onPress={() => setSearch('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Feather name="x" size={16} color={colors.mutedLabel} />
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <SkeletonGrid cardWidth={cardWidth} />
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
      ) : filtered.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.stateScroll}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          {search.trim() ? (
            <FeedState
              icon="search"
              title={`No results for "${search.trim()}"`}
              subtitle="Try a different search."
            />
          ) : (
            <FeedState
              icon="shopping-bag"
              title={`No items listed yet at ${campusName}`}
              subtitle="Be the first to list something!"
              actionLabel="List an item"
              actionIcon="plus"
              onAction={() => router.push('/sell')}
            />
          )}
        </ScrollView>
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={renderCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        />
      )}
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
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
        >
          <LinearGradient
            colors={BRAND}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryGradient}
          >
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
    paddingBottom: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: SCREEN_PAD,
    marginBottom: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md + 4,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  searchInput: {
    flex: 1,
    fontFamily: font.family.medium,
    fontSize: 15,
    color: colors.blackSoft,
    paddingVertical: 0,
  },

  /* Grid */
  listContent: {
    paddingHorizontal: SCREEN_PAD - HALF_GAP,
    paddingTop: HALF_GAP,
    paddingBottom: spacing.xl * 2,
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
    paddingTop: HALF_GAP,
  },
  skeletonLine: {
    marginTop: 10,
  },
  skeletonLineSm: {
    marginTop: 8,
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
});
