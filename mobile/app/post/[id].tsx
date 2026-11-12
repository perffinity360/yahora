import Feather from '@expo/vector-icons/Feather';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { AppText } from '../../src/components/AppText';
import { BackButton } from '../../src/components/CircleButton';
import { CommunityWallpaper } from '../../src/components/community/CommunityWallpaper';
import { StatusBarGround } from '../../src/components/community/StatusBarGround';
import { ComposerDock, DOCK_HEIGHT } from '../../src/components/community/ComposerDock';
import { PostActionsProvider } from '../../src/components/community/PostActions';
import { PostCard, PostCardSkeleton } from '../../src/components/community/PostCard';
import { useAuth } from '../../src/contexts/AuthContext';
import { goneCode, useCountries, usePost, useReact, type PostGone } from '../../src/hooks/useCommunity';
import { draftFor } from '../../src/hooks/useComposer';
import { useFloatingTopInset } from '../../src/hooks/useFloatingTopInset';
import { useLeaveOnce } from '../../src/hooks/useLeaveOnce';
import { countryName } from '../../src/lib/community';
import { hrefWithFrom } from '../../src/lib/nav';
import { colors, font } from '../../src/theme';

/**
 * A post's own page — COMMUNITY_SPEC.md §4 and §3.1. The post (text 15/22, never
 * folded), then every reply, a page at a time behind "Load more replies", and
 * the reply bar pinned at the bottom, which opens the compose screen as a
 * reply. Where you can only view (another country's post), a quiet line says
 * who can reply instead.
 *
 * It wears the community's look: the zone's wallpaper and card colours,
 * campus for a campus post, the world's for a country or Global one.
 *
 * What a link answers when the post isn't there (runbook §1.7):
 *   404                     This post isn't available.
 *   410 POST_DELETED        This post was deleted.
 *   410 POST_REMOVED        This post was removed for breaking the Community Guidelines.
 *   403 POST_UNDER_REVIEW   This post was reported and is being reviewed.
 * The last never shows any of the post, and there is no way to open it.
 *
 * The runbook prompt's "text 17/26" and "replies oldest first" predate spec
 * v3 and the 11 Nov Hot order; the spec and the API win.
 */
const GONE_TEXT: Record<PostGone, string> = {
  POST_NOT_FOUND: "This post isn't available.",
  POST_DELETED: 'This post was deleted.',
  POST_REMOVED: 'This post was removed for breaking the Community Guidelines.',
  POST_UNDER_REVIEW: 'This post was reported and is being reviewed.',
};

const VIEW_ONLY_HEIGHT = 46;

export default function PostScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const floatingTop = useFloatingTopInset();
  const leaveOnce = useLeaveOnce();
  const isFocused = useIsFocused();
  const { profile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = typeof id === 'string' ? id : undefined;

  const query = usePost(postId);
  const countries = useCountries().data ?? [];
  const react = useReact();
  const [deletedHere, setDeletedHere] = useState(false);

  const post = query.data?.post;
  const canReply = query.data?.can_reply === true;
  const gone: PostGone | null = deletedHere ? 'POST_DELETED' : query.isError ? goneCode(query.error) : null;
  const zone = post && post.scope !== 'campus' ? 'world' : 'campus';
  const ground = zone === 'campus' ? colors.communityPanelCampus : colors.communityPanelWorld;
  const here = postId ? `/post/${postId}` : '/(tabs)/community';

  const goBack = () =>
    leaveOnce(() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/community' as never)));

  const openProfile = useCallback(
    (userId: string) => router.push(hrefWithFrom(`/profile/${userId}`, here) as never),
    [router, here],
  );
  const openPost = useCallback(
    (other: string) => {
      if (other !== postId) router.push(`/post/${other}` as never);
    },
    [router, postId],
  );
  const openReply = useCallback(() => {
    if (!post) return;
    const q = new URLSearchParams({ feed: post.scope, parent: post.id, to: post.author_username });
    if (post.country_code) q.set('country', post.country_code);
    router.push(`/compose?${q.toString()}` as never);
  }, [router, post]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    if (!postId) return;
    setRefreshing(true);
    try {
      await Promise.all([
        query.refetch(),
        client.invalidateQueries({ queryKey: ['community', 'replies', postId, 'page'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Spec §4: the reply bar where you can reply; the view-only line on another
  // country's post. Nothing for your own held or covered post, which can't
  // take replies yet.
  const showReplyBar = !!post && !gone && canReply;
  const showViewOnly = !!post && !gone && !canReply && post.scope === 'country' && post.moderation_status === 'active';
  const dockHeight = showReplyBar ? DOCK_HEIGHT + insets.bottom : showViewOnly ? VIEW_ONLY_HEIGHT + insets.bottom : 0;

  let body;
  if (gone) {
    body = (
      <View style={styles.note}>
        <AppText style={styles.noteText}>{GONE_TEXT[gone]}</AppText>
      </View>
    );
  } else if (query.isError && !post) {
    body = (
      <View style={styles.note}>
        <AppText style={styles.noteText}>Couldn't load this post.</AppText>
        <Pressable
          onPress={() => void query.refetch()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
        >
          <AppText style={styles.retryText}>Try again</AppText>
        </Pressable>
      </View>
    );
  } else if (!post) {
    body = <PostCardSkeleton zone={zone} />;
  } else {
    body = (
      <PostCard
        post={post}
        index={0}
        zone={zone}
        showCampus={post.scope !== 'campus'}
        canReply={canReply}
        playing={isFocused}
        animateIn={false}
        variant="page"
        onReact={react}
        onOpenProfile={openProfile}
        onOpenPost={openPost}
        onReply={openReply}
      />
    );
  }

  return (
    <PostActionsProvider
      toastBottom={dockHeight + 16}
      onRemoved={(removed, why) => {
        // Deleting the post itself leaves only the notice.
        if (why === 'deleted' && removed.id === postId) setDeletedHere(true);
      }}
    >
      <View style={styles.screen}>
        <CommunityWallpaper ground={ground} />
        <ScrollView
          contentContainerStyle={{ paddingTop: floatingTop + 50, paddingBottom: dockHeight + 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              progressViewOffset={floatingTop + 50}
              tintColor={colors.purple}
              colors={[colors.purple]}
            />
          }
        >
          {body}
        </ScrollView>

        <StatusBarGround color={ground} />
        <BackButton onPress={goBack} style={[styles.back, { top: floatingTop }]} />

        {showReplyBar && post ? (
          <ComposerDock
            zone={zone}
            reply
            hint={`Reply to @${post.author_username}…`}
            draft={isFocused ? draftFor(post.scope, post.id) : null}
            avatarName={profile?.full_name}
            avatarUri={profile?.avatar_url}
            onOpen={openReply}
            bottomInset={insets.bottom}
          />
        ) : null}
        {showViewOnly && post ? (
          <View style={[styles.viewOnly, { paddingBottom: insets.bottom + 12 }]}>
            <Feather name="eye" size={16} color={colors.purple} />
            <AppText style={styles.viewOnlyText}>
              Only students in {countryName(post.country_code ?? '', countries)} can reply.
            </AppText>
          </View>
        ) : null}
      </View>
    </PostActionsProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.communityPanelCampus },
  back: { position: 'absolute', left: 12 },
  note: {
    marginHorizontal: 16,
    marginTop: 12,
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
  viewOnly: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.communityDock,
    borderTopWidth: 1.5,
    borderTopColor: colors.communityRail,
  },
  viewOnlyText: {
    flex: 1,
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    lineHeight: 18,
    color: colors.communityMuted,
  },
});
