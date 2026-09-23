import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../src/components/AppText';
import { AppTextInput } from '../../src/components/AppTextInput';
import { Avatar } from '../../src/components/Avatar';
import { CommentSection, MAX_COMMENT_LENGTH } from '../../src/components/CommentThread';
import { KeyboardAvoider } from '../../src/components/KeyboardAvoider';
import { formatPrice } from '../../src/components/ProductCard';
import { resolveMediaUrl } from '../../src/lib/config';
import { ScreenGradient } from '../../src/components/ScreenGradient';
import { ZoomableImageViewer } from '../../src/components/ZoomableImageViewer';
import { PinchLiftOverlay, PinchToZoom, usePinchLift, type PinchLift } from '../../src/components/PinchToZoom';
import { Skeleton } from '../../src/components/Skeleton';
import { useAuth } from '../../src/contexts/AuthContext';
import { useAddComment } from '../../src/hooks/useComments';
import { useProductDetail } from '../../src/hooks/useProductDetail';
import { useToggleLike, useToggleSave } from '../../src/hooks/useProductActions';
import { hrefWithFrom } from '../../src/lib/nav';
import { colors, conditionColors, font, radius, spacing } from '../../src/theme';
import type { ProductDetailData } from '../../src/types';
import { shareProduct } from '../../src/lib/share';

const BRAND = [colors.purple, colors.pinkDark] as const;
const FALLBACK_CONDITION = { bg: colors.blue, text: colors.white };

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ProductDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const floatingTop = insets.top + spacing.sm;
  const { width } = useWindowDimensions();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const productId = typeof id === 'string' ? id : undefined;
  const fromParam = typeof from === 'string' ? from : undefined;

  const { profile } = useAuth();
  const myUserId = profile?.id;
  const myUniversityId = profile?.university_id;

  const { data: product, isLoading, isError, refetch } = useProductDetail(productId);

  // Bind the like/save toggles to this product's cache; `false` skips the
  // on-settle refetch — a GET here would re-increment the server view counter.
  const productKey = ['product', productId];
  const toggleLike = useToggleLike(productKey, false);
  const toggleSave = useToggleSave(productKey, false);

  const [activeIndex, setActiveIndex] = useState(0);

  // Pinch-to-zoom on the gallery photo where it sits, without the page moving.
  //
  // The hook lives HERE, not in Content: its overlay positions the photo in
  // window coordinates, so it has to be mounted in the root full-screen View —
  // inside the SafeAreaView it would be offset by the status-bar inset and the
  // copy would land below the original.
  //
  // Nothing below reads it during a render. It carries shared values and a ref,
  // and the overlay owns its own state, so a pinch re-renders neither this
  // screen nor the carousel. Do not derive a prop from it (a `scrollEnabled`
  // that did exactly that is what made the gesture so hard to catch) — see the
  // notes at the top of components/PinchToZoom.tsx.
  const lift = usePinchLift();

  // Root layout is a <Slot/>, so back() re-mounts the tabs at their initial
  // route. Prefer the explicit `from` origin each opener passes; else fall back
  // to history, then home.
  const goBack = () => {
    if (fromParam) router.replace(fromParam);
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  // See src/lib/share.ts. What was here shared the bare title with no price,
  // no campus and — the part that mattered — no link, so nobody who received it
  // could open the listing.
  const handleShare = () => {
    if (product) shareProduct(product);
  };

  const showSkeleton = isLoading && !product;

  return (
    <View style={styles.root}>
      <ScreenGradient />
      {/* Wraps the SafeAreaView, not the other way round, so the comment
          composer docked at its bottom edge clears the keyboard. KeyboardAvoider
          measures its own bottom edge, so nesting it here needs no offset. */}
      <KeyboardAvoider style={styles.flex}>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          {showSkeleton ? (
            <DetailSkeleton galleryHeight={Math.min(width, 460)} />
          ) : isError && !product ? (
            <ErrorState onRetry={refetch} onBack={goBack} />
          ) : product ? (
            <Content
              product={product}
              lift={lift}
              width={width}
              bottomInset={insets.bottom}
              activeIndex={activeIndex}
              onIndexChange={setActiveIndex}
              myUserId={myUserId}
              myUniversityId={myUniversityId}
              viewerName={profile?.full_name}
              viewerAvatarUrl={profile?.avatar_url}
              onLike={() => productId && toggleLike.mutate({ productId })}
              onSave={() => productId && toggleSave.mutate({ productId })}
              onOpenSeller={() =>
                router.push(
                  hrefWithFrom(
                    `/profile/${product.seller.id}`,
                    hrefWithFrom(`/product/${product.id}`, fromParam),
                  ),
                )
              }
              onOpenChat={(href) =>
                router.push(hrefWithFrom(href, hrefWithFrom(`/product/${product.id}`, fromParam)))
              }
            />
          ) : null}

          {/* Floating top controls — always reachable over the hero. */}
          <Pressable
            onPress={goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.topBtn, styles.topBtnLeft, { top: floatingTop }, pressed && styles.topBtnPressed]}
          >
            <Feather name="arrow-left" size={22} color={colors.purpleDark} />
          </Pressable>
          {product ? (
            <Pressable
              onPress={handleShare}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share this item"
              style={({ pressed }) => [styles.topBtn, styles.topBtnRight, { top: floatingTop }, pressed && styles.topBtnPressed]}
            >
              <Feather name="share-2" size={19} color={colors.purpleDark} />
            </Pressable>
          ) : null}
        </SafeAreaView>
      </KeyboardAvoider>

      {/* Last child of the root View on purpose — it must cover the floating
          back/share buttons too, and it measures in window coordinates. */}
      <PinchLiftOverlay lift={lift} />
    </View>
  );
}

/* ────────────────────────── Content ────────────────────────── */
function Content({
  product,
  lift,
  width,
  bottomInset,
  activeIndex,
  onIndexChange,
  myUserId,
  myUniversityId,
  viewerName,
  viewerAvatarUrl,
  onLike,
  onSave,
  onOpenSeller,
  onOpenChat,
}: {
  product: ProductDetailData;
  lift: PinchLift;
  width: number;
  bottomInset: number;
  activeIndex: number;
  onIndexChange: (i: number) => void;
  myUserId?: string;
  myUniversityId?: string | null;
  viewerName?: string | null;
  viewerAvatarUrl?: string | null;
  onLike: () => void;
  onSave: () => void;
  onOpenSeller: () => void;
  onOpenChat: (href: string) => void;
}) {
  const galleryHeight = Math.min(width, 460);

  // Full-screen zoom. Resolved once so the carousel and the viewer are showing
  // the same URLs (loopback-safe in local dev — see src/lib/config.ts).
  const photoUrls = (product.image_urls ?? []).map((u) => resolveMediaUrl(u) ?? u);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const cond =
    (product.condition && conditionColors[product.condition as keyof typeof conditionColors]) ||
    FALLBACK_CONDITION;
  const condLabel = (product.condition ?? 'Good').toUpperCase();
  const sold = product.status === 'sold';
  const liked = product.is_liked ?? false;
  const saved = product.is_saved ?? false;
  const postedOn = formatDate(product.created_at);

  const isOwnListing = !!myUserId && product.seller.id === myUserId;
  const isForeignCampus = !!myUniversityId && product.university_id !== myUniversityId;

  const eduLine = [product.seller.qualification, product.seller.year_of_study]
    .filter(Boolean)
    .join(' · ');

  // Seller name / product details ride along as params so the chat header is
  // populated on the very first frame, before the inbox row exists at all.
  const handleMessageSeller = () => {
    const query = Object.entries({
      productId: product.id,
      contactName: product.seller.full_name ?? '',
      contactAvatar: product.seller.avatar_url ?? '',
      productTitle: product.title ?? '',
      productImage: product.image_urls?.[0] ?? '',
    })
      .filter(([, value]) => !!value)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    onOpenChat(`/chat/${product.seller.id}?${query}`);
  };

  /* ── Q&A composer ──
     One dock at the bottom of the screen serves three states: the normal action
     bar, the "ask a question" composer, and nothing at all while an inline reply
     composer is open (that one owns the space above the keyboard instead). */
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const addComment = useAddComment(product.id);

  const closeComposer = () => {
    setComposerOpen(false);
    setDraft('');
    Keyboard.dismiss();
  };

  const submitQuestion = () => {
    const content = draft.trim();
    if (!content || addComment.isPending) return;
    addComment.mutate(
      { content },
      {
        onSuccess: closeComposer,
        onError: (err) => Alert.alert("Couldn't post your question", err.message),
      },
    );
  };

  const canComment = !isForeignCampus;
  const canSend = !!draft.trim() && !addComment.isPending;

  return (
    <>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          scrollOffset.current = e.nativeEvent.contentOffset.y;
        }}
        contentContainerStyle={{ paddingBottom: 104 + bottomInset }}
      >
        {/* ── Gallery ── */}
        <ZoomableImageViewer
          visible={viewerOpen}
          uris={photoUrls}
          initialIndex={viewerIndex}
          shape="fill"
          onClose={() => setViewerOpen(false)}
          accessibilityLabel={product.title}
        />

        <View style={[styles.gallery, { height: galleryHeight }]}>
          {product.image_urls?.length ? (
            <FlatList
              data={product.image_urls}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(uri, i) => `${uri}-${i}`}
              onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
                onIndexChange(Math.round(e.nativeEvent.contentOffset.x / width))
              }
              renderItem={({ item, index }) => (
                // TWO ways in, deliberately.
                //
                // Tap opens the full-screen viewer, where a zoom persists and
                // the whole photo is visible (the carousel crops to fill).
                //
                // Pinch zooms the photo in place, without leaving the page —
                // the reflex gesture on a photo, which used to do nothing here.
                // PinchToZoom lifts it into an overlay so only the photo scales
                // and no other content on the screen is touched.
                <PinchToZoom
                  lift={lift}
                  id={`${item}-${index}`}
                  uri={photoUrls[index] ?? item}
                  width={width}
                  height={galleryHeight}
                  contentFit="cover"
                >
                  <Pressable
                    onPress={() => {
                      setViewerIndex(index);
                      setViewerOpen(true);
                    }}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={`Photo ${index + 1} of ${product.image_urls?.length ?? 1}. Opens full screen, or pinch to zoom in place`}
                  >
                    <Image
                      // Loopback-safe in local dev; see src/lib/config.ts.
                      source={{ uri: resolveMediaUrl(item) ?? item }}
                      style={{ width, height: galleryHeight }}
                      contentFit="cover"
                      transition={220}
                    />
                  </Pressable>
                </PinchToZoom>
              )}
            />
          ) : (
            <View style={[styles.galleryFallback, { height: galleryHeight }]}>
              <Feather name="image" size={40} color={colors.mutedPlaceholder} />
            </View>
          )}

          {/* Condition badge */}
          <View style={[styles.condBadge, { backgroundColor: cond.bg }]}>
            <AppText style={[styles.condText, { color: cond.text }]}>{condLabel}</AppText>
          </View>

          {/* Sold badge */}
          {sold ? (
            <View style={styles.soldBadge}>
              <AppText style={styles.soldText}>SOLD</AppText>
            </View>
          ) : null}

          {/* Paging dots */}
          {product.image_urls?.length > 1 ? (
            <View style={styles.dots}>
              {product.image_urls.map((_, i) => (
                <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Info ── */}
        <View style={styles.body}>
          <View style={styles.card}>
            <AppText style={styles.title}>{product.title}</AppText>
            <AppText style={styles.price}>{formatPrice(product.price)}</AppText>

            <View style={styles.metaRow}>
              {product.category ? <MetaChip icon="tag" label={product.category} /> : null}
              <MetaChip icon="map-pin" label={product.location || 'Campus'} />
              {postedOn ? <MetaChip icon="calendar" label={postedOn} /> : null}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Feather name="eye" size={15} color={colors.mutedText} />
                <AppText style={styles.statText}>{product.views ?? 0} views</AppText>
              </View>
              <View style={styles.stat}>
                <MaterialCommunityIcons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={15}
                  color={liked ? colors.pinkDark : colors.mutedText}
                />
                <AppText style={[styles.statText, liked && styles.statTextActive]}>
                  {product.likes_count ?? 0} likes
                </AppText>
              </View>
            </View>
          </View>

          {/* ── Description ── */}
          <View style={styles.card}>
            <AppText style={styles.sectionLabel}>DESCRIPTION</AppText>
            <AppText style={styles.description}>
              {product.description?.trim() || 'No description provided.'}
            </AppText>
          </View>

          {/* ── Seller ── */}
          <View style={styles.card}>
            <AppText style={styles.sectionLabel}>SELLER</AppText>
            <Pressable
              onPress={onOpenSeller}
              accessibilityRole="button"
              accessibilityLabel={`View ${product.seller.full_name ?? 'seller'}'s profile`}
              style={({ pressed }) => [styles.sellerRow, pressed && styles.sellerRowPressed]}
            >
              <Avatar name={product.seller.full_name} uri={product.seller.avatar_url} size={48} ringed />
              <View style={styles.sellerInfo}>
                <AppText style={styles.sellerName} numberOfLines={1}>
                  {product.seller.full_name || 'Yahora student'}
                </AppText>
                {eduLine ? (
                  <AppText style={styles.sellerEdu} numberOfLines={1}>
                    {eduLine}
                  </AppText>
                ) : null}
                <AppText style={styles.sellerLink}>View profile →</AppText>
              </View>
              <Feather name="chevron-right" size={20} color={colors.mutedLabel} />
            </Pressable>
          </View>

          {/* ── Questions & Answers ── */}
          <CommentSection
            style={styles.card}
            productId={product.id}
            comments={product.comments ?? []}
            viewerName={viewerName}
            viewerAvatarUrl={viewerAvatarUrl}
            canInteract={canComment}
            onAskQuestion={() => setComposerOpen(true)}
            onReplyingChange={(commentId) => {
              setReplyingTo(commentId);
              // Only one composer at a time — the reply owns the keyboard now.
              // The question draft is kept, so reopening restores it.
              if (commentId) setComposerOpen(false);
            }}
            scrollRef={scrollRef}
            scrollOffsetRef={scrollOffset}
          />
        </View>
      </ScrollView>

      {/* ── Bottom dock: question composer, or the action bar ──
           Hidden entirely while an inline reply composer is open so the two
           never fight for the strip above the keyboard. */}
      {replyingTo ? null : composerOpen ? (
        // The keyboard is up whenever this is mounted (the input autofocuses),
        // so it already covers the home indicator — no bottom inset needed.
        <View style={[styles.actionWrap, { paddingBottom: spacing.md }]}>
          <View style={styles.composerHead}>
            <AppText style={styles.composerTitle}>Ask the seller</AppText>
            <Pressable
              onPress={closeComposer}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cancel question"
              style={({ pressed }) => [styles.composerCancel, pressed && styles.composerCancelPressed]}
            >
              <AppText style={styles.composerCancelText}>Cancel</AppText>
            </Pressable>
          </View>
          <View style={styles.composerRow}>
            <Avatar name={viewerName} uri={viewerAvatarUrl} size={34} />
            <AppTextInput
              value={draft}
              onChangeText={setDraft}
              autoFocus
              multiline
              maxLength={MAX_COMMENT_LENGTH}
              placeholder="Is it still available? Any scratches?"
              placeholderTextColor={colors.mutedPlaceholder}
              style={styles.composerInput}
              accessibilityLabel="Your question"
            />
            <Pressable
              onPress={submitQuestion}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Post question"
              accessibilityState={{ disabled: !canSend }}
              style={({ pressed }) => [
                styles.sendBtn,
                !canSend && styles.sendBtnDisabled,
                pressed && canSend && styles.sendBtnPressed,
              ]}
            >
              <LinearGradient
                colors={BRAND}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendGradient}
              >
                {addComment.isPending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Feather name="send" size={17} color={colors.white} />
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      ) : (
      <View style={[styles.actionWrap, { paddingBottom: bottomInset + spacing.sm }]}>
        {isForeignCampus && !isOwnListing ? (
          <AppText style={styles.foreignNote}>
            Viewing another campus — messaging is limited to your home campus.
          </AppText>
        ) : null}
        <View style={styles.actionBar}>
          <Pressable
            onPress={onLike}
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Unlike' : 'Like'}
            style={({ pressed }) => [styles.circleBtn, liked && styles.circleBtnLike, pressed && styles.circlePressed]}
          >
            {/* Filled when liked, same as the product card's heart — see the
                note beside it in src/components/ProductCard.tsx. Feather has
                no solid heart (or bookmark), so the two hearts and the
                bookmark below are the only MCI glyphs on this screen. */}
            <MaterialCommunityIcons
              name={liked ? 'heart' : 'heart-outline'}
              size={22}
              color={liked ? colors.pinkDark : colors.mutedText}
            />
          </Pressable>
          <Pressable
            onPress={onSave}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from wishlist' : 'Save to wishlist'}
            style={({ pressed }) => [styles.circleBtn, saved && styles.circleBtnSave, pressed && styles.circlePressed]}
          >
            {/* Filled when saved, for the same reason the heart is: a colour
                change alone is too weak a signal. MCI, one family for both
                faces, so the silhouette does not jump on tap. */}
            <MaterialCommunityIcons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={saved ? colors.purple : colors.mutedText}
            />
          </Pressable>

          {isOwnListing ? (
            <View style={[styles.msgBtn, styles.ownPill]}>
              <Feather name="user-check" size={16} color={colors.purpleDark} />
              <AppText style={styles.ownPillText}>Your listing</AppText>
            </View>
          ) : isForeignCampus ? (
            <View style={[styles.msgBtn, styles.msgDisabled]}>
              <Feather name="lock" size={16} color={colors.mutedLabel} />
              <AppText style={styles.msgDisabledText}>Home campus only</AppText>
            </View>
          ) : (
            <Pressable
              onPress={handleMessageSeller}
              accessibilityRole="button"
              accessibilityLabel="Message the seller"
              style={({ pressed }) => [styles.msgBtn, pressed && styles.msgBtnPressed]}
            >
              <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.msgGradient}>
                <Feather name="message-square" size={17} color={colors.white} />
                <AppText style={styles.msgText}>Message Seller</AppText>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </View>
      )}
    </>
  );
}

/* ────────────────────────── Small pieces ────────────────────────── */
function MetaChip({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  return (
    <View style={styles.metaChip}>
      <Feather name={icon} size={12} color={colors.mutedText} />
      <AppText style={styles.metaChipText} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

function DetailSkeleton({ galleryHeight }: { galleryHeight: number }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={false}>
      <Skeleton width="100%" height={galleryHeight} rounded={0} />
      <View style={styles.body}>
        <View style={styles.card}>
          <Skeleton width="80%" height={24} rounded={8} />
          <Skeleton width={120} height={28} rounded={8} style={{ marginTop: 12 }} />
          <Skeleton width="100%" height={30} rounded={999} style={{ marginTop: 16 }} />
        </View>
        <View style={styles.card}>
          <Skeleton width={110} height={12} rounded={6} />
          <Skeleton width="100%" height={14} rounded={7} style={{ marginTop: 12 }} />
          <Skeleton width="92%" height={14} rounded={7} style={{ marginTop: 8 }} />
          <Skeleton width="70%" height={14} rounded={7} style={{ marginTop: 8 }} />
        </View>
        <View style={styles.card}>
          <Skeleton width={70} height={12} rounded={6} />
          <View style={styles.sellerRow}>
            <Skeleton width={48} height={48} rounded={24} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Skeleton width="60%" height={16} rounded={8} />
              <Skeleton width="40%" height={12} rounded={6} style={{ marginTop: 8 }} />
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function ErrorState({ onRetry, onBack }: { onRetry: () => void; onBack: () => void }) {
  return (
    <View style={styles.errorWrap}>
      <View style={styles.errorIcon}>
        <Feather name="alert-triangle" size={28} color={colors.purple} />
      </View>
      <Text style={styles.errorTitle}>Couldn&apos;t load this item</Text>
      <Text style={styles.errorText}>It may have been removed, or your connection dropped.</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnDim]}>
        <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.retryGradient}>
          <Feather name="refresh-cw" size={16} color={colors.white} />
          <AppText style={styles.retryText}>Retry</AppText>
        </LinearGradient>
      </Pressable>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backLink}>
        <AppText style={styles.backLinkText}>Go back</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBgBottom },
  flex: { flex: 1 },
  safe: { flex: 1 },

  /* Floating top controls */
  topBtn: {
    // `top` is applied inline from the safe-area inset: an absolutely
    // positioned child ignores the padding SafeAreaView adds, so a static
    // `top` here slides under the status bar in full-screen mode.
    position: 'absolute',
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassBorder,
    borderWidth: 1,
    borderColor: colors.hairline,
    shadowColor: colors.black,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  topBtnLeft: { left: spacing.lg },
  topBtnRight: { right: spacing.lg },
  topBtnPressed: { backgroundColor: colors.pinkLight },

  /* Gallery */
  gallery: {
    width: '100%',
    backgroundColor: colors.inputBg,
  },
  galleryFallback: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  condBadge: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    shadowColor: colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  // Same badge as the card's, so the same weight and size. See
  // `conditionText` in src/components/ProductCard.tsx.
  condText: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    letterSpacing: 0.6,
  },
  soldBadge: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.swipePass,
    shadowColor: colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  soldText: {
    fontFamily: font.family.extrabold,
    fontSize: font.sizes.body,
    letterSpacing: 2,
    color: colors.white,
  },
  dots: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: colors.white,
  },

  /* Body */
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.cardSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    shadowColor: colors.purple,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  // ── THE HERO BLOCK, STEPPED DOWN ONE RUNG (Block V-C) ──
  // Title was 24 and price 30, which put a two-line serif headline and a
  // 30dp number above the fold and pushed the seller row — the thing you came
  // here to act on — off the bottom of a POCO X2 (see
  // docs/screenshots/post-VB/poco-04-product-detail.jpg). `title` and
  // `headline` say the same thing in half the vertical space.
  //
  // The price stays the bigger of the two, as it is on the card: on a
  // marketplace the price is the decision. Hierarchy is the RATIO (22 against
  // 18), not the absolute size.
  title: {
    fontFamily: font.family.serif,
    fontSize: font.sizes.title,
    // Tracks the font, ~1.35x. It was 30 for a 24dp title; left at 30 it would
    // have opened a gap the smaller type does not need.
    lineHeight: 24,
    color: colors.blackSoft,
  },
  price: {
    fontFamily: font.family.serif,
    fontSize: font.sizes.headline,
    color: colors.purple,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  metaChipText: {
    flexShrink: 1,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.mutedText,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.mutedText,
  },
  statTextActive: {
    color: colors.pinkDark,
  },

  sectionLabel: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.caption,
    letterSpacing: 1,
    color: colors.mutedLabel,
    marginBottom: spacing.sm,
  },
  description: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    lineHeight: 22,
    color: colors.blackSoft,
  },

  /* Seller */
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sellerRowPressed: {
    opacity: 0.7,
  },
  sellerInfo: {
    flex: 1,
    minWidth: 0,
  },
  sellerName: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.bodyLg,
    color: colors.blackSoft,
  },
  sellerEdu: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.caption,
    color: colors.mutedText,
    marginTop: 2,
  },
  sellerLink: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.blueDark,
    marginTop: 4,
  },

  /* Question composer (docked) */
  composerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  composerTitle: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.body,
    color: colors.blackSoft,
  },
  composerCancel: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  composerCancelPressed: {
    backgroundColor: colors.pinkLight,
  },
  composerCancelText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.mutedText,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.inputBorderFocus,
    backgroundColor: colors.white,
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    lineHeight: 19,
    color: colors.blackSoft,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPressed: {
    transform: [{ scale: 0.94 }],
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },

  /* Action bar */
  actionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.cardSurface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.black,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  foreignNote: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.caption,
    lineHeight: 15,
    color: colors.purpleDark,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  circleBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSurface,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
  circleBtnLike: {
    backgroundColor: colors.pinkLight,
    borderColor: colors.pinkDark,
  },
  circleBtnSave: {
    backgroundColor: colors.pinkLight,
    borderColor: colors.purple,
  },
  circlePressed: {
    transform: [{ scale: 0.92 }],
  },
  msgBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  msgBtnPressed: {
    opacity: 0.92,
  },
  msgGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  msgText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.bodyLg,
    color: colors.white,
  },
  msgDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  msgDisabledText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.mutedLabel,
  },
  ownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  ownPillText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.purpleDark,
  },

  /* Error */
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorIcon: {
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
  errorTitle: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.title,
    color: colors.blackSoft,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  retryBtn: {
    marginTop: spacing.lg,
    borderRadius: 999,
    overflow: 'hidden',
    minWidth: 160,
  },
  retryBtnDim: { opacity: 0.85 },
  retryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
  },
  retryText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.white,
  },
  backLink: {
    marginTop: spacing.md,
    padding: spacing.sm,
  },
  backLinkText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.purpleDark,
  },
});
