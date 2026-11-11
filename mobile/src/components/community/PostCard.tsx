import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Reanimated, { Easing, Keyframe } from 'react-native-reanimated';

import { AppText } from '../AppText';
import { Avatar } from '../Avatar';
import { Skeleton } from '../Skeleton';
import { ZoomableImageViewer } from '../ZoomableImageViewer';
import { PostGif, PostPhotos } from './PostMedia';
import { PostText } from './PostText';
import { MoreButton } from './PostActions';
import { SupportCard } from './SupportCard';
import { LINE_W, LINE_X, PostPageThread, PostThread } from './PostThread';
import { ReactButton, type ReactButtonHandle } from './ReactionBar';
import { ReactionSummary } from './ReactionSummary';
import { formatCount, formatPostTime, REACTION_LONG_PRESS_MS } from '../../lib/community';
import { resolveMediaUrl } from '../../lib/config';
import { colors, font, shadows } from '../../theme';
import type { PostItem } from '../../types';

/**
 * One post in a feed — COMMUNITY_SPEC.md §3. Takes a PostItem exactly as the
 * API sends it and reports reactions through onReact(post, emoji | null); it
 * never changes the post itself.
 *
 * A frosted card on the wallpaper, a 3 dp accent down its left edge in the
 * zone's colour, the avatar in a column of its own, and the thread's line
 * running down from under the avatar into the replies.
 *
 *   · `zone`: 'campus' (purple) or 'world' (pink; a country or Global);
 *   · `showCampus`: never in the campus feed, always in the others, as a
 *     college pill on the author line (runbook §1.1: each feed shows only its
 *     own posts, so there is no scope chip);
 *   · `playing`: the card is on screen (FlashList viewability), so its GIFs play;
 *   · `canReply`: false in another country's feed, where 💬 shows the replies
 *     instead of opening the reply composer (spec §3 "Actions"). A pending or
 *     covered post can't take replies either (`can_reply` on its page); the
 *     server answers POST_NOT_FOUND for those, shown as the posting error.
 *
 * Memoised: a card re-renders only when its own post or flags change. A
 * reaction replaces the post object in the cache, so only that card redraws.
 */
const STAGGER_MS = 28;
const STAGGER_MAX = 6;
const AVATAR = 28;

/* Spec §3.1: only the author ever receives these. */
const STATUS_LABELS: Partial<Record<PostItem['moderation_status'], string>> = {
  pending: 'Being checked',
  under_review: 'Under review',
};

/** Posts fade and rise 4 dp over 320 ms (spec §3 "Entrance"). Only the first
 *  six of a feed's first page get it; recycled cells never replay it. */
function entrance(index: number) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 4 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
  })
    .duration(320)
    .delay(index * STAGGER_MS);
}

export const PostCard = memo(function PostCard({
  post,
  index,
  zone,
  showCampus,
  canReply,
  playing,
  animateIn,
  onReact,
  onOpenProfile,
  onOpenPost,
  onReply,
  variant = 'feed',
  showSupport = false,
}: {
  post: PostItem;
  index: number;
  zone: 'campus' | 'world';
  showCampus: boolean;
  canReply: boolean;
  playing: boolean;
  animateIn: boolean;
  onReact: (post: PostItem, emoji: string | null) => void;
  onOpenProfile: (userId: string) => void;
  onOpenPost: (postId: string) => void;
  /** Where you can reply: 💬 opens the compose screen as a reply (spec §3). */
  onReply: (post: PostItem) => void;
  /** 'page': the post's own page (spec §4) — text at 15/22, never folded, and
   *  every reply, paged, instead of the feed's preview. */
  variant?: 'feed' | 'page';
  /** Your own Posts tab: a post held for self-harm carries the support card
   *  under it, without Close (spec §2.4, `moderation_support`). */
  showSupport?: boolean;
}) {
  const onPage = variant === 'page';
  const reactRef = useRef<ReactButtonHandle>(null);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [moreRequest, setMoreRequest] = useState(0);
  const time = formatPostTime(post.created_at);
  const status = STATUS_LABELS[post.moderation_status];
  const count = post.replies_count;
  const accent = zone === 'campus' ? colors.purpleDark : colors.pinkDark;
  const rail = zone === 'campus' ? colors.communityRailCampus : colors.communityRailWorld;

  const react = useCallback((emoji: string | null) => onReact(post, emoji), [onReact, post]);
  const openProfile = () => onOpenProfile(post.author_id);

  const onReplyPress = () => {
    // Where you can reply, 💬 opens the compose screen as a reply. Where you
    // can only view, it shows more of the thread instead (spec §3 "Actions").
    if (canReply) onReply(post);
    else setMoreRequest((n) => n + 1);
  };

  const replyWords = `${count} ${count === 1 ? 'reply' : 'replies'}`;

  return (
    <Reanimated.View
      entering={animateIn && index < STAGGER_MAX ? entrance(index) : undefined}
      style={styles.cardWrap}
    >
      {/* Long-pressing the post opens the quick bar too (spec §5.1). */}
      <Pressable
        onLongPress={() => reactRef.current?.open()}
        delayLongPress={REACTION_LONG_PRESS_MS}
        style={[styles.card, { borderLeftColor: accent }]}
        accessibilityLabel={`Post by @${post.author_username}`}
      >
        <View style={styles.postRow}>
          {/* Every card has its trunk: from under the avatar to the end of the
              post, and on into the replies. */}
          <View pointerEvents="none" style={[styles.trunk, { backgroundColor: rail }]} />
          <Pressable
            onPress={openProfile}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={`@${post.author_username}'s profile`}
            style={styles.avatar}
          >
            <Avatar name={post.author_name} uri={post.author_avatar} size={AVATAR} />
          </Pressable>

          <View style={styles.body}>
            {/* Always exactly one line. The campus truncates first, then the
                username; neither disappears, and the time never goes. */}
            <View style={styles.header}>
              <AppText
                numberOfLines={1}
                onPress={openProfile}
                suppressHighlighting
                style={styles.username}
              >
                @{post.author_username}
              </AppText>
              {showCampus ? (
                <View style={styles.college}>
                  <Ionicons name="school" size={11} color={colors.communityCollegeText} />
                  <AppText numberOfLines={1} style={styles.collegeText}>
                    {post.author_university}
                  </AppText>
                </View>
              ) : null}
              {time ? (
                <AppText
                  onPress={() => onOpenPost(post.id)}
                  suppressHighlighting
                  numberOfLines={1}
                  style={styles.time}
                >
                  {' · '}
                  {time}
                </AppText>
              ) : null}
              {status ? <AppText style={styles.status}>{status}</AppText> : null}
              <View style={styles.headerSpacer} />
              {/* ⋯ — Report, or Delete on your own (PostActionsProvider). */}
              <MoreButton post={post} style={styles.more} />
            </View>

            {post.content ? (
              <View style={styles.text}>
                <PostText key={post.id} content={post.content} variant={onPage ? 'page' : 'post'} />
              </View>
            ) : null}

            {post.image_urls?.length ? (
              <PostPhotos
                key={post.id}
                urls={post.image_urls}
                author={`@${post.author_username}`}
                onOpen={setViewerAt}
              />
            ) : null}

            {post.gif ? <PostGif gif={post.gif} playing={playing} /> : null}

            <View style={styles.actions}>
              <ReactionSummary post={post} onReact={react} />
              <ReactButton ref={reactRef} reaction={post.viewer_reaction} onReact={react} />
              <Pressable
                onPress={onReplyPress}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel={canReply ? `${replyWords}. Write a reply` : `${replyWords}. Show them`}
                style={({ pressed }) => [styles.replyPill, pressed && styles.pillPressed]}
              >
                <Feather name="message-circle" size={14} color={colors.communityMuted} />
                {count > 0 ? <AppText style={styles.replyCount}>{formatCount(count)}</AppText> : null}
              </Pressable>
            </View>
          </View>
        </View>

        {onPage ? (
          <PostPageThread
            post={post}
            showCampus={showCampus}
            zone={zone}
            playing={playing}
            onReact={onReact}
            onOpenProfile={onOpenProfile}
          />
        ) : (
          <PostThread
            key={post.id}
            post={post}
            showCampus={showCampus}
            zone={zone}
            playing={playing}
            moreRequest={moreRequest}
            onReact={onReact}
            onOpenProfile={onOpenProfile}
          />
        )}
        {showSupport && post.moderation_support ? (
          <View style={styles.support}>
            <SupportCard />
          </View>
        ) : null}
      </Pressable>

      {viewerAt !== null ? (
        <ZoomableImageViewer
          visible
          uris={post.image_urls.map((u) => resolveMediaUrl(u) ?? u)}
          initialIndex={viewerAt}
          shape="fill"
          accessibilityLabel={`Photo from @${post.author_username}`}
          onClose={() => setViewerAt(null)}
        />
      ) : null}
    </Reanimated.View>
  );
});

/** The skeleton: the same card and shape as a post (spec §9). */
export function PostCardSkeleton({ zone }: { zone: 'campus' | 'world' }) {
  return (
    <View style={styles.cardWrap}>
      <View
        style={[styles.card, { borderLeftColor: zone === 'campus' ? colors.purpleDark : colors.pinkDark }]}
      >
        <View style={styles.postRow}>
          <Skeleton width={AVATAR} height={AVATAR} rounded={AVATAR / 2} style={styles.avatar} />
          <View style={styles.body}>
            <Skeleton width="45%" height={10} rounded={5} style={{ marginTop: 9 }} />
            <Skeleton width="92%" height={10} rounded={5} style={{ marginTop: 10 }} />
            <Skeleton width="70%" height={10} rounded={5} style={{ marginTop: 8 }} />
            <Skeleton height={64} style={styles.skeletonBlock} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Cards 6 apart, 10 in from each side (spec §3), at most 860 wide. */
  cardWrap: { paddingHorizontal: 10, paddingBottom: 6, alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 860,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderColor: colors.communityCardBorder,
    backgroundColor: colors.communityCard,
    boxShadow: shadows.communityCard,
  },
  postRow: { flexDirection: 'row' },
  trunk: {
    position: 'absolute',
    left: LINE_X - LINE_W / 2,
    top: AVATAR + 3,
    bottom: 0,
    width: LINE_W,
  },
  avatar: { width: AVATAR, height: AVATAR, marginRight: 8 },
  body: { flex: 1, minWidth: 0 },
  // 28 tall, so the 20 dp author line sits on the avatar's middle.
  header: { height: AVATAR, flexDirection: 'row', alignItems: 'center' },
  username: {
    flexShrink: 1,
    minWidth: 40,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    lineHeight: 20,
    color: colors.blackSoft,
  },
  college: {
    flexShrink: 2,
    minWidth: 48,
    marginLeft: 6,
    height: 18,
    paddingHorizontal: 7,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.communityCollegeBg,
  },
  collegeText: {
    flexShrink: 1,
    fontFamily: font.family.medium,
    fontSize: font.sizes.micro,
    lineHeight: 14,
    color: colors.communityCollegeText,
  },
  time: {
    flexShrink: 0,
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    lineHeight: 20,
    color: colors.communityMuted,
  },
  status: {
    flexShrink: 0,
    marginLeft: 6,
    paddingHorizontal: 6,
    borderRadius: 999,
    overflow: 'hidden',
    fontFamily: font.family.medium,
    fontSize: font.sizes.micro,
    lineHeight: 16,
    color: colors.communityMuted,
    backgroundColor: colors.inputBg,
  },
  headerSpacer: { flexGrow: 1, flexShrink: 0, minWidth: 4 },
  more: { height: AVATAR, justifyContent: 'center', paddingLeft: 4 },
  support: { marginTop: 10 },
  text: { marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  replyPill: {
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: colors.communityPill,
    borderWidth: 1,
    borderColor: colors.communityHairline,
  },
  pillPressed: { backgroundColor: colors.communityPillPressed, transform: [{ scale: 0.96 }] },
  replyCount: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.caption,
    lineHeight: 16,
    color: colors.communityMuted,
    fontVariant: ['tabular-nums'],
  },

  // The tinted block of spec §9.
  skeletonBlock: { marginTop: 12, backgroundColor: colors.reactionMineBg },
});
