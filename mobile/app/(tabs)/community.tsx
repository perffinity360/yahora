import Feather from '@expo/vector-icons/Feather';
import { FlashList, type FlashListRef, type ViewToken } from '@shopify/flash-list';
import { useIsFocused, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, RefreshControl, StyleSheet, View, type ViewInstance } from 'react-native';
import Reanimated, {
  Easing,
  FadeOut,
  Keyframe,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../src/components/AppText';
import { AppToast, useToast } from '../../src/components/AppToast';
import { CommunitySwitcher, SWITCHER_HEIGHT, worldLabel } from '../../src/components/community/CommunitySwitcher';
import { CommunityWallpaper } from '../../src/components/community/CommunityWallpaper';
import { StatusBarGround } from '../../src/components/community/StatusBarGround';
import { FAB_CLEARANCE, PostFab } from '../../src/components/community/PostFab';
import { PostActionsProvider } from '../../src/components/community/PostActions';
import { PostCard, PostCardSkeleton } from '../../src/components/community/PostCard';
import { useAuth } from '../../src/contexts/AuthContext';
import {
  onComposeResult,
  useCountries,
  useFeed,
  useNewCampusCount,
  useReact,
  useShowNewCampusPosts,
} from '../../src/hooks/useCommunity';
import { COMPOSER_TEXT, draftFor } from '../../src/hooks/useComposer';
import { ReplyRevealContext, useRevealReply } from '../../src/hooks/useRevealReply';
import { useUniversities } from '../../src/hooks/useUniversities';
import { GLOBAL, type FeedKind, type FeedSort, type WorldFeed } from '../../src/lib/community';
import { hrefWithFrom } from '../../src/lib/nav';
import { colors, font, shadows } from '../../src/theme';
import type { Country, PostItem } from '../../src/types';

/**
 * The Community tab — COMMUNITY_SPEC.md §1.2 (a phone), §3, §8, §9. Phase 7
 * V-D (CC-V4a–c): the switcher, the three feeds, the post card with its
 * reactions and ⋯ menu (PostActionsProvider: report, delete, the full picker,
 * the breakdown), the floating Post button (PostFab), which opens the compose
 * screen (app/compose.tsx), and the "new posts" pill on the campus feed.
 *
 *   · one feed at a time: your campus (newest first), or a country / Global
 *     (Hot or New). Each feed shows only its own posts (runbook §1.1);
 *   · the floating Post button where you can post (your campus, your country,
 *     Global; owner, 13 Nov: it replaced the composer dock, and the posts
 *     scroll on under it); a view-only line in a dock takes its place in
 *     another country's feed (`can_post: false`, spec §1.4). A new post lands
 *     at the top of its feed and the list goes there; a reply you send goes
 *     first under its post and the list brings it into view
 *     (useRevealReply); a held one shows the toast (spec §2.3);
 *   · pull to refresh, more pages at the end, skeletons, the spec's empty texts.
 *
 * The chosen country and sort are kept while the app is open (module memory),
 * not across restarts: a new session opens on your campus, Hot, your country.
 */
const memory: { side: 'campus' | 'world'; world: WorldFeed | null; sort: FeedSort } = {
  side: 'campus',
  world: null,
  sort: 'hot',
};

const VIEWABILITY = { itemVisiblePercentThreshold: 25 };

/** Long enough for a post put on top to render and be measured, and for
 *  FlashList's position correction to land, before the list goes to the top. */
const INSERT_SETTLE_MS = 250;
/** The glide to the top, then the checks after it. */
const TOP_GLIDE_MS = 450;
const TOP_RETRY_MS = 200;
const TOP_SETTLE_TRIES = 5;
/** "At the top", for posts arriving above the first one: within this of it. */
const NEW_ON_TOP_NEAR = 48;

/** The Post button stays open within this of the top… */
const FAB_OPEN_NEAR_TOP = 24;
/** …and changes only after this much travel between two scroll events. */
const FAB_FOLD_TRAVEL = 4;

/* Not in the spec: it has no words for this. The website's text. */
const NEW_POSTS_FAILED = "Couldn't load new posts. Try again.";

/* Spec §8: in, it slides down 8 and fades in over 200 ms (communityEase);
   Reanimated skips it with reduced motion. */
const PILL_IN = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: -8 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
}).duration(200);
const SKELETONS = [0, 1, 2];

export default function CommunityScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { toast, showToast } = useToast();
  const listRef = useRef<FlashListRef<PostItem>>(null);
  const frameRef = useRef<ViewInstance>(null);
  const scrollY = useRef(0);

  /* The Post button folds to its pencil while you scroll down and opens out
     again when you scroll up or come back near the top (PostFab). A few
     points of travel either way before it changes, so a finger resting on
     the screen doesn't make it flicker. */
  const [fabFolded, setFabFolded] = useState(false);
  const fabFoldedRef = useRef(false);
  const onScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - scrollY.current;
    scrollY.current = y;
    let fold = fabFoldedRef.current;
    if (y < FAB_OPEN_NEAR_TOP) fold = false;
    else if (dy > FAB_FOLD_TRAVEL) fold = true;
    else if (dy < -FAB_FOLD_TRAVEL) fold = false;
    if (fold !== fabFoldedRef.current) {
      fabFoldedRef.current = fold;
      setFabFolded(fold);
    }
  }, []);

  const [side, setSideState] = useState(memory.side);
  const [chosenWorld, setChosenWorld] = useState(memory.world);
  const [sort, setSortState] = useState(memory.sort);

  const countriesQuery = useCountries();
  const countries: Country[] = countriesQuery.data ?? [];
  const myCountry = countries.find((c) => c.is_mine)?.code ?? null;
  // Your country is the default (spec §1.3); Global if you have none, or once
  // the list has failed. Null while it's still being worked out.
  const world: WorldFeed | null =
    chosenWorld ?? myCountry ?? (countriesQuery.isSuccess || countriesQuery.isError ? GLOBAL : null);

  const setSide = useCallback((next: 'campus' | 'world') => {
    memory.side = next;
    setSideState(next);
  }, []);
  const setWorld = useCallback((next: WorldFeed) => {
    memory.world = next;
    setChosenWorld(next);
  }, []);
  const setSort = useCallback((next: FeedSort) => {
    memory.sort = next;
    setSortState(next);
  }, []);

  const kind: FeedKind = side === 'campus' ? 'campus' : world === GLOBAL ? 'global' : 'country';
  const country = kind === 'country' ? world : null;
  const feed = useFeed(kind, { country, sort, enabled: side === 'campus' || world !== null });
  const posts = feed.data?.posts ?? [];
  const canPost = feed.data?.canPost ?? true;
  const zone = side === 'campus' ? 'campus' : 'world';
  const viewOnly = side === 'world' && feed.data?.canPost === false;

  const universities = useUniversities();
  const campusName =
    universities.data?.find((u) => u.id === profile?.university_id)?.name ?? 'your campus';
  const label = world ? worldLabel(world, countries) : '';

  const react = useReact();
  const isFocused = useIsFocused();
  const scope = kind;
  // Where you can post: your campus always; a country or Global once the feed
  // says so (`can_post`). Not while it's still loading, so another country's
  // feed never flashes a composer it can't use.
  const showComposer = side === 'campus' || feed.data?.canPost === true;

  const openCompose = useCallback(
    (extra: Record<string, string> = {}) => {
      const q = new URLSearchParams({ feed: scope, ...(country ? { country } : {}), ...extra });
      router.push(`/compose?${q.toString()}` as never);
    },
    [router, scope, country],
  );
  const onReply = useCallback(
    (post: PostItem) => openCompose({ parent: post.id, to: post.author_username }),
    [openCompose],
  );

  /* Going to the top once posts were put above the ones on screen (your new
     post, or the "new posts" pill's). FlashList keeps what's on screen still
     when items arrive above it (maintainVisibleContentPosition), so a scroll
     sent before the new post had rendered was undone, and the post was left
     hidden above the switcher with only its bottom showing (owner, 13 Nov).
     So it waits until the post has rendered and the list has corrected. */
  /* It still stopped short (owner, 15 Nov, after the pill: the new post's top
     under the switcher). While the new posts are measured, FlashList's own
     corrections nudge the offset, and a nudge cuts the animated scroll off
     part way. So once the glide has had time to land, it checks, and finishes
     the way with a short jump, until the list is really at the top: up to
     TOP_SETTLE_TRIES times. A finger on the list stops it at once. */
  const topTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);
  const cancelTopScroll = useCallback(() => {
    if (topTimer.current) clearTimeout(topTimer.current);
    topTimer.current = null;
  }, []);
  const scrollToTopAfterInsert = useCallback(() => {
    cancelTopScroll();
    let tries = 0;
    const step = () => {
      topTimer.current = null;
      if (dragging.current) return;
      if (tries > 0 && scrollY.current <= 1) return;
      listRef.current?.scrollToOffset({ offset: 0, animated: tries === 0 });
      tries += 1;
      if (tries < TOP_SETTLE_TRIES) topTimer.current = setTimeout(step, tries === 1 ? TOP_GLIDE_MS : TOP_RETRY_MS);
    };
    topTimer.current = setTimeout(step, INSERT_SETTLE_MS);
  }, [cancelTopScroll]);
  useEffect(() => () => {
    if (topTimer.current) clearTimeout(topTimer.current);
  }, []);

  /* Posts that arrive above the top one while you're at the top (a pull to
     refresh, or a refetch the app made on its own) are shown whole: FlashList
     keeps the old first post where it was, which left the new one half under
     the switcher (owner, 15–16 Nov). Read during render, before FlashList
     corrects the offset; acted on once the new post is on screen. While
     you're further down reading, nothing moves (spec §8). */
  const firstId = posts[0]?.id;
  const firstSeen = useRef(firstId);
  const newOnTop = useRef(false);
  if (firstSeen.current !== firstId) {
    if (firstSeen.current && firstId && scrollY.current < NEW_ON_TOP_NEAR) newOnTop.current = true;
    firstSeen.current = firstId;
  }
  useEffect(() => {
    if (!newOnTop.current) return;
    newOnTop.current = false;
    scrollToTopAfterInsert();
  }, [firstId, scrollToTopAfterInsert]);

  // What the compose screen did, once it has closed (spec §2.3).
  useEffect(
    () =>
      onComposeResult((result) => {
        if (result.kind === 'held') showToast(COMPOSER_TEXT.held);
        else if (!result.post.parent_post_id) scrollToTopAfterInsert();
      }),
    [showToast, scrollToTopAfterInsert],
  );

  // A reply you send from this feed: first under its post, and brought on
  // screen clear of the switcher and the Post button.
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const revealer = useRevealReply({
    accepts: useCallback((parentId: string) => postsRef.current.some((p) => p.id === parentId), []),
    frameRef,
    insetTop: insets.top + SWITCHER_HEIGHT,
    insetBottom: viewOnly ? VIEW_ONLY_HEIGHT : FAB_CLEARANCE,
    scrollBy: useCallback(
      (dy: number) => listRef.current?.scrollToOffset({ offset: Math.max(0, scrollY.current + dy), animated: true }),
      [],
    ),
  });

  const openProfile = useCallback(
    (userId: string) => router.push(hrefWithFrom(`/profile/${userId}`, '/(tabs)/community') as never),
    [router],
  );
  const openPost = useCallback((postId: string) => router.push(`/post/${postId}` as never), [router]);

  /* GIFs play only while on screen (spec §3 "GIF"). */
  const [visible, setVisible] = useState<ReadonlySet<string>>(() => new Set());
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<PostItem>[] }) => {
    setVisible(new Set(viewableItems.map((v) => v.item?.id).filter(Boolean) as string[]));
  }).current;

  /* Pull to refresh. A refresh that fails keeps the posts on screen and says so. */
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await feed.refetch();
      if (result.isError) showToast("Couldn't refresh. Check your connection and try again.");
    } finally {
      setRefreshing(false);
    }
  }, [feed, showToast]);

  // Tapping the Community tab while on it goes back to the top.
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as never, () => {
      if (navigation.isFocused()) listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return unsubscribe;
  }, [navigation]);

  /* ── The "new posts" pill (spec §8), the campus feed only ──
     "New" is newer than the newest post shown: it moves on every load and
     when your own post goes on top, so the pill only counts posts you can't
     see yet. `since` is 1 ms after it (the API reads milliseconds, the
     database keeps microseconds). An empty feed counts from when it loaded.
     Asked every NEW_POSTS_POLL_MS while the feed is on screen and the app is
     in the foreground; never inserts posts by itself. */
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);
  const since = useMemo(() => {
    if (kind !== 'campus' || !feed.isSuccess) return null;
    let newest = 0;
    for (const p of posts) newest = Math.max(newest, Date.parse(p.created_at) || 0);
    return new Date(newest ? newest + 1 : feed.dataUpdatedAt).toISOString();
  }, [kind, feed.isSuccess, feed.dataUpdatedAt, posts]);
  const newCount = useNewCampusCount(since, kind === 'campus' && isFocused && appActive).data ?? 0;
  const [pillTakenFor, setPillTakenFor] = useState<string | null>(null);
  const showNewPosts = useShowNewCampusPosts();
  const onNewPostsPress = useCallback(async () => {
    setPillTakenFor(since);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    const ok = await showNewPosts();
    if (!ok) showToast(NEW_POSTS_FAILED);
    // The new ones went in above what's on screen: up again, to show them.
    else scrollToTopAfterInsert();
  }, [since, showNewPosts, showToast, scrollToTopAfterInsert]);
  const pillCount = kind === 'campus' && pillTakenFor !== since ? newCount : 0;

  const onEndReached = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage && !feed.isError) void feed.fetchNextPage();
  }, [feed]);

  const renderItem = useCallback(
    ({ item, index }: { item: PostItem; index: number }) => (
      <PostCard
        post={item}
        index={index}
        zone={zone}
        showCampus={zone === 'world'}
        canReply={canPost}
        playing={visible.has(item.id)}
        animateIn
        onReact={react}
        onOpenProfile={openProfile}
        onOpenPost={openPost}
        onReply={onReply}
      />
    ),
    [zone, canPost, visible, react, openProfile, openPost, onReply],
  );

  const emptyText = useMemo(() => {
    if (kind === 'campus') return `No posts from ${campusName} yet. Be the first to say hello.`;
    if (kind === 'global') return 'Nothing here yet. Start the conversation.';
    if (world === myCountry) return `No posts from students in ${label} yet. Start the conversation.`;
    return `No posts from students in ${label} yet.`;
  }, [kind, campusName, world, myCountry, label]);

  const loading = feed.isLoading || (side === 'world' && world === null);
  const listEmpty = loading ? (
    <View>
      {SKELETONS.map((i) => (
        <PostCardSkeleton key={i} zone={zone} />
      ))}
    </View>
  ) : feed.isError ? (
    <View style={styles.note}>
      <AppText style={styles.noteText}>Couldn't load posts. Check your connection and try again.</AppText>
      <Pressable
        onPress={() => void feed.refetch()}
        accessibilityRole="button"
        style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
      >
        <AppText style={styles.retryText}>Try again</AppText>
      </Pressable>
    </View>
  ) : (
    <View style={styles.note}>
      <AppText style={styles.noteText}>{emptyText}</AppText>
    </View>
  );

  const topPad = insets.top + SWITCHER_HEIGHT;
  const ground = zone === 'campus' ? colors.communityPanelCampus : colors.communityPanelWorld;
  // What covers the bottom of the feed: the view-only dock, or the floating
  // Post button, which the last post can scroll clear of.
  const dockHeight = viewOnly ? VIEW_ONLY_HEIGHT : showComposer ? FAB_CLEARANCE : 0;
  const hint =
    kind === 'campus'
      ? "What's happening on campus?"
      : kind === 'global'
        ? 'Share with students everywhere'
        : `Share with students in ${label}`;
  const feedKeyString = `${kind}:${country ?? ''}:${kind === 'campus' ? '' : sort}`;

  return (
    <PostActionsProvider toastBottom={dockHeight + 16}>
      <ReplyRevealContext.Provider value={revealer}>
        <View ref={frameRef} collapsable={false} style={styles.screen}>
          <CommunityWallpaper ground={ground} />

          <FlashList
            // A new list per feed: each starts at its own top, and the cards'
            // entrance plays for the new feed.
            key={feedKeyString}
            ref={listRef}
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            extraData={visible}
            contentContainerStyle={{ paddingTop: topPad, paddingBottom: dockHeight + 16 }}
            scrollIndicatorInsets={{ top: topPad, bottom: dockHeight }}
            ListEmptyComponent={listEmpty}
            ListFooterComponent={
              feed.isFetchingNextPage ? <PostCardSkeleton zone={zone} /> : null
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.6}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={VIEWABILITY}
            onScroll={onScroll}
            onScrollBeginDrag={() => {
              dragging.current = true;
              cancelTopScroll();
            }}
            onScrollEndDrag={() => {
              dragging.current = false;
            }}
            scrollEventThrottle={32}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                progressViewOffset={topPad}
                tintColor={colors.purple}
                colors={[colors.purple]}
              />
            }
          />

          <StatusBarGround color={ground} />

          <CommunitySwitcher
            side={side}
            world={world}
            countries={countries}
            sort={sort}
            onSide={setSide}
            onWorld={setWorld}
            onSort={setSort}
          />

          {viewOnly ? (
            <ViewOnlyLine country={label} hidden={fabFolded} />
          ) : showComposer ? (
            <PostFab
              // A new one per side, so it changes colour with the feed's fade.
              key={zone}
              zone={zone}
              hint={hint}
              // Re-read when the tab comes back into view, after the compose screen.
              hasDraft={isFocused && !!draftFor(scope)}
              folded={fabFolded}
              onPress={() => openCompose()}
            />
          ) : null}

          {pillCount > 0 ? (
            <Reanimated.View
              entering={PILL_IN}
              exiting={FadeOut.duration(200)}
              style={[styles.pillWrap, { top: topPad + 8 }]}
              pointerEvents="box-none"
            >
              <Pressable
                onPress={() => void onNewPostsPress()}
                accessibilityRole="button"
                accessibilityLiveRegion="polite"
                style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
              >
                <Feather name="arrow-up" size={16} color={colors.white} />
                <AppText style={styles.pillText}>
                  {pillCount === 1 ? '1 new post' : `${pillCount} new posts`}
                </AppText>
              </Pressable>
            </Reanimated.View>
          ) : null}

          <AppToast message={toast} bottom={dockHeight + 16} />
        </View>
      </ReplyRevealContext.Provider>
    </PostActionsProvider>
  );
}

/**
 * Another country's feed (spec §1.4): a quiet line in the composer's dock.
 * It sits above the tab bar, which already pads for the phone's own bar.
 *
 * It slides away while you scroll down and comes back when you scroll up or
 * reach the top (owner, 15 Nov), on the same signal that folds the Post button:
 * it has said its piece once you're reading.
 */
const VIEW_ONLY_HEIGHT = 40;
/** A slow, soft fade with a short drift, so it leaves without catching the eye
 *  (owner, 16 Nov: "hide smoothly"). */
const VIEW_ONLY_FADE = { duration: 320, easing: Easing.bezier(0.33, 0, 0.2, 1) };
const VIEW_ONLY_DRIFT = 10;

function ViewOnlyLine({ country, hidden }: { country: string; hidden: boolean }) {
  const away = useSharedValue(hidden ? 1 : 0);
  useEffect(() => {
    away.value = withTiming(hidden ? 1 : 0, VIEW_ONLY_FADE);
  }, [hidden, away]);
  const slide = useAnimatedStyle(() => ({
    opacity: 1 - away.value,
    transform: [{ translateY: away.value * VIEW_ONLY_DRIFT }],
  }));
  return (
    <Reanimated.View
      style={[styles.dock, slide]}
      accessibilityRole="text"
      pointerEvents={hidden ? 'none' : 'auto'}
    >
      <Feather name="eye" size={12} color={colors.communityMuted} style={styles.dockIcon} />
      <AppText style={styles.dockText} numberOfLines={1}>
        Only students in {country} can post and reply here.
      </AppText>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.communityPanelCampus },

  pillWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.communityNewPosts,
    boxShadow: shadows.quickBar,
  },
  pillPressed: { transform: [{ scale: 0.97 }] },
  pillText: { fontFamily: font.family.semibold, fontSize: font.sizes.body, lineHeight: 16, color: colors.white },

  note: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.communityGlass,
    borderWidth: 1,
    borderColor: colors.communityHairline,
  },
  noteText: {
    textAlign: 'center',
    fontFamily: font.family.regular,
    fontSize: font.sizes.bodyLg,
    lineHeight: 20,
    color: colors.communityMuted,
  },
  retry: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: colors.purpleDark,
  },
  retryPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  retryText: { fontFamily: font.family.semibold, fontSize: font.sizes.body, color: colors.white },

  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Quiet (owner, 16 Nov: "must not catch too much attention"): a slim strip, a
    // hairline on top, the smallest text size, centred.
    minHeight: VIEW_ONLY_HEIGHT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.communityDock,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.communityHairline,
  },
  dockIcon: { flexShrink: 0 },
  dockText: {
    flexShrink: 1,
    fontFamily: font.family.regular,
    fontSize: font.sizes.micro,
    lineHeight: 15,
    color: colors.communityMuted,
  },
});
