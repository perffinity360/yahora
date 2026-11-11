import Feather from '@expo/vector-icons/Feather';
import { FlashList, type FlashListRef, type ViewToken } from '@shopify/flash-list';
import { useIsFocused, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../src/components/AppText';
import { AppToast, useToast } from '../../src/components/AppToast';
import { CommunitySwitcher, SWITCHER_HEIGHT, worldLabel } from '../../src/components/community/CommunitySwitcher';
import { CommunityWallpaper } from '../../src/components/community/CommunityWallpaper';
import { ComposerDock, DOCK_HEIGHT } from '../../src/components/community/ComposerDock';
import { PostCard, PostCardSkeleton } from '../../src/components/community/PostCard';
import { useAuth } from '../../src/contexts/AuthContext';
import { onComposeResult, useCountries, useFeed, useReact } from '../../src/hooks/useCommunity';
import { COMPOSER_TEXT, draftFor } from '../../src/hooks/useComposer';
import { useUniversities } from '../../src/hooks/useUniversities';
import { GLOBAL, type FeedKind, type FeedSort, type WorldFeed } from '../../src/lib/community';
import { hrefWithFrom } from '../../src/lib/nav';
import { colors, font } from '../../src/theme';
import type { Country, PostItem } from '../../src/types';

/**
 * The Community tab — COMMUNITY_SPEC.md §1.2 (a phone), §3, §9. Phase 7 V-D,
 * parts 1 and 2 (CC-V4a, CC-V4b): the switcher, the three feeds, the post
 * card and reactions on it, and the closed composer in its dock, which opens
 * the compose screen (app/compose.tsx). The post page, ⊕, the breakdown,
 * report and delete (part 3) come next.
 *
 *   · one feed at a time: your campus (newest first), or a country / Global
 *     (Hot or New). Each feed shows only its own posts (runbook §1.1);
 *   · the composer's dock at the bottom where you can post (your campus, your
 *     country, Global); a view-only line takes its place in another country's
 *     feed (`can_post: false`, spec §1.4). A new post lands at the top of its
 *     feed and the list goes there; a held one shows the toast (spec §2.3);
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
const SKELETONS = [0, 1, 2];

export default function CommunityScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { toast, showToast } = useToast();
  const listRef = useRef<FlashListRef<PostItem>>(null);

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

  // What the compose screen did, once it has closed (spec §2.3).
  useEffect(
    () =>
      onComposeResult((result) => {
        if (result.kind === 'held') showToast(COMPOSER_TEXT.held);
        else if (!result.post.parent_post_id) listRef.current?.scrollToOffset({ offset: 0, animated: true });
      }),
    [showToast],
  );

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
  const dockHeight = viewOnly ? VIEW_ONLY_HEIGHT : showComposer ? DOCK_HEIGHT : 0;
  const hint =
    kind === 'campus'
      ? "What's happening on campus?"
      : kind === 'global'
        ? 'Share with students everywhere'
        : `Share with students in ${label}`;
  const feedKeyString = `${kind}:${country ?? ''}:${kind === 'campus' ? '' : sort}`;

  return (
    <View style={styles.screen}>
      <CommunityWallpaper ground={zone === 'campus' ? colors.communityPanelCampus : colors.communityPanelWorld} />

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
        <ViewOnlyLine country={label} />
      ) : showComposer ? (
        <ComposerDock
          zone={zone}
          hint={hint}
          // Re-read when the tab comes back into view, after the compose screen.
          draft={isFocused ? draftFor(scope) : null}
          avatarName={profile?.full_name}
          avatarUri={profile?.avatar_url}
          onOpen={() => openCompose()}
          onPhotos={() => openCompose({ pick: 'photos' })}
        />
      ) : null}

      <AppToast message={toast} bottom={dockHeight + 16} />
    </View>
  );
}

/**
 * Another country's feed (spec §1.4): a quiet line in the composer's dock.
 * It sits above the tab bar, which already pads for the phone's own bar.
 */
const VIEW_ONLY_HEIGHT = 58;

function ViewOnlyLine({ country }: { country: string }) {
  return (
    <View style={styles.dock} accessibilityRole="text">
      <Feather name="eye" size={16} color={colors.purple} style={styles.dockIcon} />
      <AppText style={styles.dockText}>
        Only students in {country} can post and reply here. You can still react and report.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.communityPanelCampus },

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
    minHeight: VIEW_ONLY_HEIGHT,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.communityDock,
    borderTopWidth: 1.5,
    borderTopColor: colors.communityRail,
  },
  dockIcon: { flexShrink: 0 },
  dockText: {
    flex: 1,
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    lineHeight: 18,
    color: colors.communityMuted,
  },
});
