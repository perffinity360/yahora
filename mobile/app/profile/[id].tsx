import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpandableBio } from '../../src/components/ExpandableBio';
import { ProductCard } from '../../src/components/ProductCard';
import { Skeleton } from '../../src/components/Skeleton';
import { useAuth } from '../../src/contexts/AuthContext';
import { useToggleLike, useToggleSave } from '../../src/hooks/useProductActions';
import { usePublicProfile } from '../../src/hooks/usePublicProfile';
import { hrefWithFrom } from '../../src/lib/nav';
import { colors, font, radius, spacing } from '../../src/theme';
import type { PublicListing, PublicProfile } from '../../src/types';

const BRAND = [colors.purple, colors.pinkDark] as const;
const SCREEN_PAD = spacing.lg;
const GRID_GAP = spacing.md;

function initialsOf(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function memberSince(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const profileUserId = typeof id === 'string' ? id : undefined;
  const fromParam = typeof from === 'string' ? from : undefined;

  const { profile: viewer } = useAuth();
  const isOwnProfile = !!viewer?.id && viewer.id === profileUserId;

  const { data, isLoading, isError, refetch } = usePublicProfile(profileUserId);
  const toggleLike = useToggleLike(['publicProfile', profileUserId]);
  const toggleSave = useToggleSave(['publicProfile', profileUserId]);

  const { width } = useWindowDimensions();
  const cardWidth = (width - SCREEN_PAD * 2 - GRID_GAP) / 2;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Root layout renders a <Slot/>, so router.back() re-mounts the tabs at their
  // initial route rather than where the user came from. Return precisely via the
  // `from` param each opener passes (the dashboard, or a product's seller card),
  // falling back to the dashboard.
  const goBack = () => router.replace(fromParam ?? '/(tabs)/profile');

  const handleShare = (item: PublicListing) => {
    Share.share({ message: `Check out "${item.title}" for ₹${item.price} on Yahora` }).catch(
      () => {},
    );
  };

  const profile = data?.profile;
  const listings = data?.listings ?? [];
  const firstName = (profile?.full_name || 'User').split(' ')[0];
  const showSkeleton = isLoading && !profile;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.purple}
              colors={[colors.purple]}
            />
          }
        >
          {isOwnProfile && !showSkeleton ? (
            <View style={styles.ownBanner}>
              <Feather name="eye" size={14} color={colors.purpleDark} />
              <Text style={styles.ownBannerText}>This is how others see your profile.</Text>
            </View>
          ) : null}

          {showSkeleton ? (
            <>
              <HeaderSkeleton />
              <ListingsSkeleton cardWidth={cardWidth} />
            </>
          ) : isError && !profile ? (
            <ErrorState onRetry={refetch} />
          ) : profile ? (
            <>
              <Header profile={profile} />

              <View style={styles.listingsHead}>
                <Text style={styles.listingsTitle}>
                  {isOwnProfile ? 'My active listings' : `${firstName}'s listings`}
                </Text>
                {listings.length ? (
                  <View style={styles.countChip}>
                    <Text style={styles.countChipText}>{listings.length}</Text>
                  </View>
                ) : null}
              </View>

              {listings.length ? (
                <View style={styles.grid}>
                  {listings.map((item) => (
                    <ProductCard
                      key={item.id}
                      product={item}
                      style={{ width: cardWidth }}
                      isLiked={item.is_liked}
                      isSaved={item.is_saved}
                      onPress={() =>
                        router.push(
                          hrefWithFrom(
                            `/product/${item.id}`,
                            hrefWithFrom(`/profile/${profileUserId}`, fromParam),
                          ),
                        )
                      }
                      onLike={() => toggleLike.mutate({ productId: item.id })}
                      onSave={() => toggleSave.mutate({ productId: item.id })}
                      onShare={() => handleShare(item)}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.empty}>
                  <View style={styles.emptyIcon}>
                    <Feather name="tag" size={26} color={colors.purple} />
                  </View>
                  <Text style={styles.emptyTitle}>No active listings</Text>
                  <Text style={styles.emptySubtitle}>
                    {isOwnProfile
                      ? 'Items you list will show up here for the campus to see.'
                      : `${firstName} has no active items for sale right now.`}
                  </Text>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>

        <Pressable
          onPress={goBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <Feather name="arrow-left" size={22} color={colors.purpleDark} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

/* ────────────────────────── Read-only header ────────────────────────── */
function Header({ profile }: { profile: PublicProfile }) {
  const initials = initialsOf(profile.full_name);
  const since = memberSince(profile.created_at);
  // Same order as the dashboard: row 1 = Qualification | Current Year,
  // row 2 = Course | Specialization (the 2-col grid wraps left→right).
  const academicFields: { label: string; value?: string | null }[] = [
    { label: 'Qualification', value: profile.qualification },
    { label: 'Current Year', value: profile.year_of_study },
    { label: 'Course', value: profile.courseName },
    { label: 'Specialization', value: profile.specializationName },
  ];

  return (
    <View style={styles.headerShadow}>
      <View style={styles.headerCard}>
        <LinearGradient
          colors={BRAND}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.banner}
        />

        <LinearGradient
          colors={[colors.purple, colors.pink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarRing}
        >
          <View style={styles.avatarInner}>
            {profile.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatarImg}
                contentFit="cover"
                transition={220}
              />
            ) : initials ? (
              <Text style={styles.avatarInitials}>{initials}</Text>
            ) : (
              <Feather name="user" size={38} color={colors.purple} />
            )}
          </View>
        </LinearGradient>

        <Text style={styles.name} numberOfLines={1}>
          {profile.full_name || 'Yahora student'}
        </Text>

        <View style={styles.uniRow}>
          <View style={styles.uniDot} />
          <Text style={styles.uniText} numberOfLines={1}>
            {profile.university || 'University'}
          </Text>
        </View>

        <View style={styles.academicCard}>
          {academicFields.map((field) => (
            <View key={field.label} style={styles.acadCell}>
              <Text style={styles.acadLabel}>{field.label}</Text>
              <Text style={styles.acadValue}>{field.value || '—'}</Text>
            </View>
          ))}
        </View>

        {profile.bio ? <ExpandableBio text={profile.bio} /> : null}

        {since ? (
          <View style={styles.sinceRow}>
            <Feather name="calendar" size={13} color={colors.mutedText} />
            <Text style={styles.sinceText}>Member since {since}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ────────────────────────── Error / skeletons ────────────────────────── */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorWrap}>
      <View style={styles.emptyIcon}>
        <Feather name="wifi-off" size={26} color={colors.purple} />
      </View>
      <Text style={styles.emptyTitle}>Couldn&apos;t load this profile</Text>
      <Text style={styles.emptySubtitle}>Check your connection and try again.</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnDim]}
      >
        <LinearGradient
          colors={BRAND}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.retryBtnGradient}
        >
          <Feather name="refresh-cw" size={16} color={colors.white} />
          <Text style={styles.retryBtnText}>Retry</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function HeaderSkeleton() {
  return (
    <View style={styles.headerShadow}>
      <View style={styles.headerCard}>
        <Skeleton width="100%" height={92} rounded={0} />
        <View style={styles.avatarSkeleton}>
          <Skeleton width={108} height={108} rounded={54} />
        </View>
        <View style={styles.headerSkeletonBody}>
          <Skeleton width={160} height={22} rounded={8} />
          <Skeleton width={130} height={14} rounded={7} style={{ marginTop: 12 }} />
          <Skeleton width="88%" height={64} rounded={12} style={{ marginTop: 16 }} />
          <Skeleton width={150} height={12} rounded={6} style={{ marginTop: 16 }} />
        </View>
      </View>
    </View>
  );
}

function ListingsSkeleton({ cardWidth }: { cardWidth: number }) {
  return (
    <>
      <View style={styles.listingsHead}>
        <Skeleton width={150} height={18} rounded={8} />
      </View>
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ width: cardWidth }}>
            <Skeleton width="100%" height={cardWidth} rounded={radius.lg} />
            <Skeleton width="60%" height={14} rounded={7} style={{ marginTop: 10 }} />
            <Skeleton width="85%" height={12} rounded={6} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: { flex: 1 },
  scroll: {
    paddingTop: spacing.xl + spacing.lg,
    paddingBottom: spacing.xl * 2,
  },

  backBtn: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.lg,
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: colors.purple,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  backBtnPressed: {
    backgroundColor: colors.pinkLight,
  },

  /* Own-profile banner */
  ownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  ownBannerText: {
    fontFamily: font.family.semibold,
    fontSize: 12,
    color: colors.purpleDark,
  },

  /* Header card */
  headerShadow: {
    marginHorizontal: SCREEN_PAD,
    borderRadius: 24,
    backgroundColor: colors.cardSurface,
    shadowColor: colors.purple,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  headerCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.cardSurface,
    alignItems: 'center',
    paddingBottom: spacing.lg,
  },
  banner: {
    width: '100%',
    height: 92,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    padding: 4,
    marginTop: -54,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.purple,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: colors.pinkLight,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontFamily: font.family.serif,
    fontSize: 34,
    color: colors.purple,
  },
  name: {
    fontFamily: font.family.serif,
    fontSize: 23,
    color: colors.blackSoft,
    marginTop: spacing.sm,
    maxWidth: '86%',
    textAlign: 'center',
  },
  uniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    maxWidth: '86%',
  },
  uniDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.purple,
  },
  uniText: {
    fontFamily: font.family.semibold,
    fontSize: 13,
    color: colors.purple,
    flexShrink: 1,
  },
  academicCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  acadCell: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.pinkLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  acadLabel: {
    fontFamily: font.family.bold,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.mutedLabel,
    marginBottom: 3,
  },
  acadValue: {
    fontFamily: font.family.semibold,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.blackSoft,
  },
  sinceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  sinceText: {
    fontFamily: font.family.medium,
    fontSize: 12,
    color: colors.mutedText,
  },

  /* Listings */
  listingsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: SCREEN_PAD,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  listingsTitle: {
    fontFamily: font.family.serif,
    fontSize: 19,
    color: colors.blackSoft,
  },
  countChip: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  countChipText: {
    fontFamily: font.family.bold,
    fontSize: 12,
    color: colors.purpleDark,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: SCREEN_PAD,
  },

  /* Empty / error */
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 1.5,
    paddingHorizontal: spacing.lg,
  },
  errorWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: font.family.bold,
    fontSize: 16,
    color: colors.blackSoft,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: font.family.regular,
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  retryBtn: {
    marginTop: spacing.lg,
    borderRadius: 999,
    overflow: 'hidden',
    minWidth: 160,
  },
  retryBtnDim: {
    opacity: 0.85,
  },
  retryBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 46,
    borderRadius: 999,
  },
  retryBtnText: {
    fontFamily: font.family.semibold,
    fontSize: 14,
    color: colors.white,
  },

  /* Skeleton bits */
  avatarSkeleton: {
    marginTop: -54,
    borderRadius: 54,
    borderWidth: 4,
    borderColor: colors.cardSurface,
  },
  headerSkeletonBody: {
    alignItems: 'center',
    marginTop: spacing.sm,
    width: '100%',
  },
});
