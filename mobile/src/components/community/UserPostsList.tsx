import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../AppText';
import { PostCard, PostCardSkeleton } from './PostCard';
import { useReact } from '../../hooks/useCommunity';
import { hrefWithFrom } from '../../lib/nav';
import { colors, font } from '../../theme';
import type { PostItem } from '../../types';

/**
 * A profile's posts — COMMUNITY_SPEC.md §10, from GET /api/posts/by-user/:userId.
 * The same cards as the feeds (§3), all scopes mixed (a profile isn't a feed),
 * each in its own zone's colours, with the college pill on country and Global
 * posts. Your own list also carries your `Being checked` and `Under review`
 * posts with their labels (the API sends them only to you), and the support
 * card under a post held for self-harm, without Close (§2.4).
 *
 * The screen owns the scrolling (both profiles are one ScrollView) and asks
 * for the next page near the bottom; this draws what has loaded. It must sit
 * inside a PostActionsProvider for ⋯, ⊕ and the breakdown.
 *
 * 💬 opens the post's page here: whether you can reply depends on the post's
 * feed, and the page knows (`can_reply`).
 */
export function UserPostsList({
  posts,
  loading,
  failed,
  loadingMore,
  own,
  from,
  onRetry,
}: {
  posts: PostItem[];
  loading: boolean;
  failed: boolean;
  loadingMore: boolean;
  own: boolean;
  /** This screen's href, so the profile opened from a post can come back. */
  from: string;
  onRetry: () => void;
}) {
  const router = useRouter();
  const react = useReact();
  const openProfile = useCallback(
    (userId: string) => router.push(hrefWithFrom(`/profile/${userId}`, from) as never),
    [router, from],
  );
  const openPost = useCallback((postId: string) => router.push(`/post/${postId}` as never), [router]);
  const openPostOf = useCallback((post: PostItem) => openPost(post.id), [openPost]);

  if (loading) {
    return (
      <View>
        <PostCardSkeleton zone="campus" />
        <PostCardSkeleton zone="world" />
      </View>
    );
  }
  if (failed && posts.length === 0) {
    return (
      <View style={styles.note}>
        <AppText style={styles.noteText}>Couldn't load posts.</AppText>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
        >
          <AppText style={styles.retryText}>Try again</AppText>
        </Pressable>
      </View>
    );
  }
  if (posts.length === 0) {
    return (
      <View style={styles.note}>
        <AppText style={styles.noteText}>No posts yet.</AppText>
      </View>
    );
  }
  return (
    <View>
      {posts.map((post, i) => {
        const zone = post.scope === 'campus' ? 'campus' : 'world';
        return (
          <PostCard
            key={post.id}
            post={post}
            index={i}
            zone={zone}
            showCampus={zone === 'world'}
            canReply
            playing
            animateIn={false}
            showSupport={own}
            onReact={react}
            onOpenProfile={openProfile}
            onOpenPost={openPost}
            onReply={openPostOf}
          />
        );
      })}
      {loadingMore ? <PostCardSkeleton zone="campus" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { alignItems: 'center', gap: 10, paddingVertical: 24, paddingHorizontal: 16 },
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
});
