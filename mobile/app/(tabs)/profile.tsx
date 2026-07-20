import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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

import { AvatarSheet } from '../../src/components/AvatarSheet';
import { ExpandableBio } from '../../src/components/ExpandableBio';
import { formatPrice, ProductCard } from '../../src/components/ProductCard';
import { Skeleton } from '../../src/components/Skeleton';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAvatarActions } from '../../src/hooks/useAvatarActions';
import { useDashboard } from '../../src/hooks/useDashboard';
import { useDashboardActions } from '../../src/hooks/useDashboardActions';
import { colors, font, radius, spacing } from '../../src/theme';
import type { DashboardProfile, ProductListing, Purchase } from '../../src/types';

const BRAND = [colors.purple, colors.pinkDark] as const;
const SCREEN_PAD = spacing.lg;
const GRID_GAP = spacing.md;

type TabKey = 'listings' | 'purchases' | 'watchlist';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'listings', label: 'Listings' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'watchlist', label: 'Watchlist' },
];

function initialsOf(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function ProfileScreen() {
  const { profile: authProfile, signOut, isDemoUser } = useAuth();
  const userId = authProfile?.id;
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { data, isLoading, isError, refetch } = useDashboard(userId);
  const actions = useDashboardActions(userId);
  const { uploadAvatar, removeAvatar } = useAvatarActions(userId);

  const [tab, setTab] = useState<TabKey>('listings');
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarBusy = uploadAvatar.isPending || removeAvatar.isPending;

  const cardWidth = (width - SCREEN_PAD * 2 - GRID_GAP) / 2;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleSignOut = useCallback(async () => {
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
    } catch (e) {
      setSignOutError(e instanceof Error ? e.message : 'Could not sign out.');
      setSigningOut(false);
    }
  }, [signOut]);

  const handleChangePhoto = useCallback(async () => {
    setAvatarSheetOpen(false);
    setAvatarError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setAvatarError('Photo library access is needed to change your photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      await uploadAvatar.mutateAsync({
        uri: asset.uri,
        mimeType: asset.mimeType ?? undefined,
        fileName: asset.fileName ?? undefined,
      });
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : 'Could not update your photo.');
    }
  }, [uploadAvatar]);

  const handleRemovePhoto = useCallback(async () => {
    setAvatarSheetOpen(false);
    setAvatarError(null);
    try {
      await removeAvatar.mutateAsync();
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : 'Could not remove your photo.');
    }
  }, [removeAvatar]);

  const handleShare = (item: ProductListing) => {
    Share.share({ message: `Check out "${item.title}" for ₹${item.price} on Yahora` }).catch(
      () => {},
    );
  };

  const confirmSold = (item: ProductListing) =>
    Alert.alert('Mark as sold?', `"${item.title}" will move to your sold items.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark sold', onPress: () => actions.markSold.mutate({ id: item.id }) },
    ]);

  const confirmAvailable = (item: ProductListing) =>
    Alert.alert('Relist item?', `"${item.title}" will be available on the marketplace again.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Relist', onPress: () => actions.markAvailable.mutate({ id: item.id }) },
    ]);

  const confirmDelete = (item: ProductListing) =>
    Alert.alert('Delete listing?', `"${item.title}" will be removed permanently.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => actions.deleteProduct.mutate({ id: item.id }),
      },
    ]);

  const profile = data?.profile;
  const listings = data?.listings ?? [];
  const purchases = data?.purchases ?? [];
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
          {showSkeleton ? (
            <>
              <HeaderSkeleton />
              <ListingsSkeleton cardWidth={cardWidth} />
            </>
          ) : isError && !profile ? (
            <ErrorState onRetry={refetch} onSignOut={handleSignOut} signingOut={signingOut} />
          ) : (
            <>
              <ProfileHeader
                profile={profile}
                isDemoUser={isDemoUser}
                onViewPublic={() => userId && router.push(`/profile/${userId}`)}
                onEditProfile={() => router.push('/edit-profile')}
                canViewPublic={!!userId}
                onViewPhoto={() => setImageViewerOpen(true)}
                onEditPhoto={() => setAvatarSheetOpen(true)}
                avatarBusy={avatarBusy}
              />
              {avatarError ? <Text style={styles.avatarErrorText}>{avatarError}</Text> : null}

              <ListNewItemCard onPress={() => router.push('/sell')} />

              <View style={styles.segmentBar}>
                {TABS.map((t) => {
                  const active = tab === t.key;
                  return (
                    <Pressable
                      key={t.key}
                      onPress={() => setTab(t.key)}
                      style={styles.segment}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      {active ? (
                        <LinearGradient
                          colors={BRAND}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                      ) : null}
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.content}>
                {tab === 'listings' ? (
                  listings.length ? (
                    <View style={styles.grid}>
                      {listings.map((item) => (
                        <ProductCard
                          key={item.id}
                          product={item}
                          style={{ width: cardWidth }}
                          showManageActions
                          isLiked={item.is_liked}
                          isSaved={item.is_saved}
                          onLike={() =>
                            actions.toggleLike.mutate({ id: item.id, isLiked: !!item.is_liked })
                          }
                          onSave={() =>
                            actions.toggleSave.mutate({ id: item.id, isSaved: !!item.is_saved })
                          }
                          onShare={() => handleShare(item)}
                          onEdit={() => router.push(`/sell?edit=${item.id}`)}
                          onMarkSold={() => confirmSold(item)}
                          onMarkAvailable={() => confirmAvailable(item)}
                          onDelete={() => confirmDelete(item)}
                        />
                      ))}
                    </View>
                  ) : (
                    <EmptyState
                      icon="tag"
                      title="You haven't listed anything yet"
                      subtitle="Items you put up for sale will show up here."
                    />
                  )
                ) : null}

                {tab === 'purchases' ? (
                  purchases.length ? (
                    <View style={styles.grid}>
                      {purchases.map((item) => (
                        <PurchaseCard key={item.id} purchase={item} width={cardWidth} />
                      ))}
                    </View>
                  ) : (
                    <EmptyState
                      icon="shopping-bag"
                      title="You haven't bought anything yet"
                      subtitle="Go explore the marketplace!"
                    />
                  )
                ) : null}

                {/* TODO: wire to a saved-items endpoint once the marketplace/swipe lands. */}
                {tab === 'watchlist' ? (
                  <EmptyState
                    icon="bookmark"
                    title="Your wishlist is empty"
                    subtitle="Swipe right on items you love!"
                  />
                ) : null}
              </View>

              <Pressable
                onPress={handleSignOut}
                disabled={signingOut}
                style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
              >
                {signingOut ? (
                  <ActivityIndicator color={colors.pinkDark} />
                ) : (
                  <>
                    <Feather name="log-out" size={16} color={colors.pinkDark} />
                    <Text style={styles.signOutText}>Sign out</Text>
                  </>
                )}
              </Pressable>
              {signOutError ? <Text style={styles.signOutError}>{signOutError}</Text> : null}
            </>
          )}
        </ScrollView>

        <AvatarSheet
          visible={avatarSheetOpen}
          hasAvatar={!!profile?.avatar_url}
          onChangePhoto={handleChangePhoto}
          onRemovePhoto={handleRemovePhoto}
          onClose={() => setAvatarSheetOpen(false)}
        />

        <Modal
          visible={imageViewerOpen && !!profile?.avatar_url}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setImageViewerOpen(false)}
        >
          <Pressable
            style={styles.viewerOverlay}
            onPress={() => setImageViewerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.viewerImage}
                contentFit="contain"
                transition={180}
              />
            ) : null}
            <View style={styles.viewerClose}>
              <Feather name="x" size={22} color={colors.white} />
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

/* ────────────────────────── Profile header ────────────────────────── */
function ProfileHeader({
  profile,
  isDemoUser,
  onViewPublic,
  onEditProfile,
  canViewPublic,
  onViewPhoto,
  onEditPhoto,
  avatarBusy,
}: {
  profile: DashboardProfile | undefined;
  isDemoUser: boolean;
  onViewPublic: () => void;
  onEditProfile: () => void;
  canViewPublic: boolean;
  onViewPhoto: () => void;
  onEditPhoto: () => void;
  avatarBusy: boolean;
}) {
  const avatar = profile?.avatar_url;
  const initials = initialsOf(profile?.full_name);
  // 2-column grid (wraps left→right): row 1 = Qualification | Current Year,
  // row 2 = Course | Specialization.
  const academicFields: { label: string; value?: string | null }[] = [
    { label: 'Qualification', value: profile?.qualification },
    { label: 'Current Year', value: profile?.year_of_study },
    { label: 'Course', value: profile?.courseName },
    { label: 'Specialization', value: profile?.specializationName },
  ];

  return (
    <View style={styles.headerShadow}>
      <View style={styles.headerCard}>
        <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
          <Text style={styles.bannerEyebrow}>STUDENT DASHBOARD</Text>
        </LinearGradient>

        <LinearGradient
          colors={[colors.purple, colors.pink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarRing}
        >
          <Pressable
            onPress={avatar ? onViewPhoto : onEditPhoto}
            disabled={avatarBusy}
            accessibilityRole="button"
            accessibilityLabel={avatar ? 'View profile photo' : 'Add profile photo'}
            style={({ pressed }) => [styles.avatarInner, pressed && styles.avatarInnerPressed]}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} contentFit="cover" transition={220} />
            ) : initials ? (
              <Text style={styles.avatarInitials}>{initials}</Text>
            ) : (
              <Feather name="user" size={38} color={colors.purple} />
            )}
            {avatarBusy ? (
              <View style={styles.avatarBusyOverlay}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : null}
          </Pressable>
          <Pressable
            onPress={onEditPhoto}
            disabled={avatarBusy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={({ pressed }) => [styles.avatarEditBadge, pressed && styles.avatarInnerPressed]}
          >
            <Feather name="camera" size={12} color={colors.white} />
          </Pressable>
        </LinearGradient>

        <Text style={styles.name} numberOfLines={1}>
          {profile?.full_name || 'Your name'}
        </Text>

        {isDemoUser ? (
          <View style={styles.demoChip}>
            <Text style={styles.demoChipText}>DEMO ACCOUNT</Text>
          </View>
        ) : null}

        <View style={styles.uniRow}>
          <View style={styles.uniDot} />
          <Text style={styles.uniText} numberOfLines={1}>
            {profile?.university || 'Your University'}
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

        {profile?.bio ? <ExpandableBio text={profile.bio} /> : null}

        <Pressable
          onPress={onViewPublic}
          disabled={!canViewPublic}
          style={({ pressed }) => [
            styles.publicBtn,
            (pressed || !canViewPublic) && styles.publicBtnDim,
          ]}
        >
          <LinearGradient
            colors={BRAND}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.publicBtnGradient}
          >
            <Feather name="external-link" size={16} color={colors.white} />
            <Text style={styles.publicBtnText}>View Your Public Profile</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={onEditProfile}
          style={({ pressed }) => [styles.editBtn, pressed && styles.editBtnPressed]}
        >
          <Feather name="edit-2" size={15} color={colors.purpleDark} />
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ────────────────────────── List new item card ────────────────────────── */
function ListNewItemCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.listNewShadow, pressed && styles.listNewPressed]}
    >
      <View style={styles.listNewCard}>
        <LinearGradient
          colors={BRAND}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.listNewIcon}
        >
          <Feather name="plus" size={22} color={colors.white} />
        </LinearGradient>
        <View style={styles.listNewText}>
          <Text style={styles.listNewTitle}>List a New Item</Text>
          <Text style={styles.listNewSub}>Earn some campus cash</Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.mutedLabel} />
      </View>
    </Pressable>
  );
}

/* ────────────────────────── Purchase card ────────────────────────── */
function PurchaseCard({ purchase, width }: { purchase: Purchase; width: number }) {
  const p = purchase.product;
  const image = p?.image_urls?.[0];
  const boughtOn = new Date(purchase.created_at);
  const dateLabel = Number.isNaN(boughtOn.getTime())
    ? ''
    : boughtOn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={[styles.purchaseShadow, { width }]}>
      <View style={styles.purchaseInner}>
        <View style={styles.purchaseImageWrap}>
          {image ? (
            <Image source={{ uri: image }} style={styles.purchaseImage} contentFit="cover" transition={220} />
          ) : (
            <View style={styles.purchaseImageFallback}>
              <Feather name="image" size={26} color={colors.mutedPlaceholder} />
            </View>
          )}
          <View style={styles.boughtBadge}>
            <Text style={styles.boughtBadgeText}>BOUGHT</Text>
          </View>
        </View>
        <View style={styles.purchaseInfo}>
          <Text style={styles.purchaseTitle} numberOfLines={1}>
            {p?.title ?? 'Item'}
          </Text>
          <Text style={styles.purchasePrice} numberOfLines={1}>
            {formatPrice(p?.price ?? 0)}
          </Text>
          {dateLabel ? (
            <View style={styles.purchaseDateRow}>
              <Feather name="clock" size={12} color={colors.mutedText} />
              <Text style={styles.purchaseDate} numberOfLines={1}>
                {dateLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/* ────────────────────────── Empty / error / skeletons ────────────────────────── */
function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={26} color={colors.purple} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

function ErrorState({
  onRetry,
  onSignOut,
  signingOut,
}: {
  onRetry: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  return (
    <View style={styles.errorWrap}>
      <View style={styles.emptyIcon}>
        <Feather name="wifi-off" size={26} color={colors.purple} />
      </View>
      <Text style={styles.emptyTitle}>Couldn&apos;t load your dashboard</Text>
      <Text style={styles.emptySubtitle}>Check your connection and try again.</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.retryBtn, pressed && styles.publicBtnDim]}
      >
        <LinearGradient
          colors={BRAND}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.publicBtnGradient}
        >
          <Feather name="refresh-cw" size={16} color={colors.white} />
          <Text style={styles.publicBtnText}>Retry</Text>
        </LinearGradient>
      </Pressable>
      <Pressable
        onPress={onSignOut}
        disabled={signingOut}
        style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
      >
        {signingOut ? (
          <ActivityIndicator color={colors.pinkDark} />
        ) : (
          <>
            <Feather name="log-out" size={16} color={colors.pinkDark} />
            <Text style={styles.signOutText}>Sign out</Text>
          </>
        )}
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
          <Skeleton width={220} height={12} rounded={6} style={{ marginTop: 12 }} />
          <Skeleton width="88%" height={44} rounded={999} style={{ marginTop: 20 }} />
        </View>
      </View>
    </View>
  );
}

function ListingsSkeleton({ cardWidth }: { cardWidth: number }) {
  return (
    <>
      <View style={styles.segmentBar}>
        <Skeleton width="100%" height={40} rounded={999} />
      </View>
      <View style={styles.content}>
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ width: cardWidth }}>
              <Skeleton width="100%" height={cardWidth} rounded={radius.lg} />
              <Skeleton width="60%" height={14} rounded={7} style={{ marginTop: 10 }} />
              <Skeleton width="85%" height={12} rounded={6} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.xl * 2,
  },

  /* Header */
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
  bannerEyebrow: {
    fontFamily: font.family.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.white,
    opacity: 0.85,
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
  avatarInnerPressed: {
    opacity: 0.85,
  },
  avatarBusyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.purple,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarErrorText: {
    fontFamily: font.family.regular,
    fontSize: 12,
    color: colors.errorText,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginHorizontal: SCREEN_PAD,
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
  demoChip: {
    marginTop: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  demoChipText: {
    fontFamily: font.family.bold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.purpleDark,
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
  publicBtn: {
    marginTop: spacing.lg,
    borderRadius: 999,
    overflow: 'hidden',
    width: '88%',
  },
  publicBtnDim: {
    opacity: 0.85,
  },
  publicBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 46,
    borderRadius: 999,
  },
  publicBtnText: {
    fontFamily: font.family.semibold,
    fontSize: 14,
    color: colors.white,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    width: '88%',
    height: 44,
    marginTop: spacing.sm,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.inputBorderFocus,
    backgroundColor: colors.cardSurface,
  },
  editBtnPressed: {
    backgroundColor: colors.pinkLight,
  },
  editBtnText: {
    fontFamily: font.family.semibold,
    fontSize: 14,
    color: colors.purpleDark,
  },

  /* List new item card */
  listNewShadow: {
    marginHorizontal: SCREEN_PAD,
    marginTop: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.cardSurface,
    shadowColor: colors.purple,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  listNewPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.99 }],
  },
  listNewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.cardSurface,
  },
  listNewIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.purple,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  listNewText: {
    flex: 1,
  },
  listNewTitle: {
    fontFamily: font.family.bold,
    fontSize: 15,
    color: colors.blackSoft,
  },
  listNewSub: {
    fontFamily: font.family.regular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 2,
  },

  /* Segmented tabs */
  segmentBar: {
    flexDirection: 'row',
    marginHorizontal: SCREEN_PAD,
    marginTop: spacing.lg,
    padding: 4,
    borderRadius: 999,
    backgroundColor: colors.inputBg,
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontFamily: font.family.semibold,
    fontSize: 13,
    color: colors.mutedText,
  },
  segmentTextActive: {
    color: colors.white,
  },

  /* Content */
  content: {
    paddingHorizontal: SCREEN_PAD,
    marginTop: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },

  /* Purchase card */
  purchaseShadow: {
    borderRadius: radius.lg,
    backgroundColor: colors.cardSurface,
    shadowColor: colors.purple,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  purchaseInner: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  purchaseImageWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.inputBg,
  },
  purchaseImage: {
    width: '100%',
    height: '100%',
  },
  purchaseImageFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boughtBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.blue,
  },
  boughtBadgeText: {
    fontFamily: font.family.extrabold,
    fontSize: 8.5,
    letterSpacing: 0.5,
    color: colors.white,
  },
  purchaseInfo: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 4,
  },
  purchaseTitle: {
    fontFamily: font.family.bold,
    fontSize: 13.5,
    color: colors.blackSoft,
  },
  purchasePrice: {
    fontFamily: font.family.serif,
    fontSize: 16,
    color: colors.blueDark,
  },
  purchaseDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  purchaseDate: {
    fontFamily: font.family.regular,
    fontSize: 11,
    color: colors.mutedText,
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

  /* Sign out */
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    marginTop: spacing.xl,
    height: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.inputBorderFocus,
    backgroundColor: colors.cardSurface,
  },
  signOutBtnPressed: {
    backgroundColor: colors.pinkLight,
  },
  signOutText: {
    fontFamily: font.family.semibold,
    fontSize: 14,
    color: colors.pinkDark,
  },
  signOutError: {
    fontFamily: font.family.regular,
    fontSize: 12,
    color: colors.errorText,
    textAlign: 'center',
    marginTop: spacing.sm,
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

  /* Enlarged photo viewer */
  viewerOverlay: {
    flex: 1,
    backgroundColor: colors.viewerScrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  viewerImage: {
    width: '90%',
    aspectRatio: 1,
    maxHeight: '80%',
    borderRadius: 24,
  },
  viewerClose: {
    position: 'absolute',
    top: spacing.xl * 1.5,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.viewerCloseBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
