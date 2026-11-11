import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../AppText';
import { Avatar } from '../Avatar';
import { PostGif } from './PostMedia';
import { PostText } from './PostText';
import { useThreadReplies } from '../../hooks/useCommunity';
import {
  DEFAULT_REACTION,
  distinctById,
  formatCount,
  formatPostTime,
  REPLIES_FOLD_MIN,
} from '../../lib/community';
import { colors, font } from '../../theme';
import type { PostItem } from '../../types';

/**
 * The replies under a post in a feed — COMMUNITY_SPEC.md §4.
 *
 *   · the post's `top_replies` (its 2 hottest) show by default;
 *   · `Show more replies` loads the next REPLIES_PAGE_SIZE in place, in the
 *     same Hot order, and shows again while there are more. Never for fewer
 *     than REPLIES_FOLD_MIN replies, and never left standing for one or two:
 *     a press that would leave 1–2 unloaded brings them too (at most 3 pages);
 *   · once pressed, `Hide replies` folds back to the preview; the loaded
 *     replies are kept, so `Show more replies` unfolds them again at once;
 *   · a reply can only be liked (❤️, DEFAULT_REACTION), never given any emoji;
 *   · the post's own author gets a highlighted username, and nothing more.
 *
 * One opaque line runs down the post's avatar column and curves into each
 * reply's avatar as a quarter circle (radius 14), stopping 4 short of it. The
 * last piece ends in its curve. Each piece is a View with a left and a bottom
 * border and a rounded corner, so the line and its curve land on the same
 * pixels (the website draws it with borders for the same reason).
 *
 * Layout from the spec, in dp: the post's avatar column is 28 wide plus 8, so
 * every reply's avatar (22) starts at 36, the post's text edge, and the line's
 * centre is at 14.
 */
export const LINE_X = 14;
export const LINE_W = 1.5;
const TEXT_EDGE = 36;
const RAIL_R = 14;
const RAIL_GAP = 4;
const REPLY_AVATAR = 22;
/** Each reply row's top room; the first gets 6 more (`--thread-lead`). */
const ROW_TOP = 4;
const THREAD_LEAD = 6;
/** The author line's letters are raised 2.2 so the middle of their lowercase
 *  letters sits 1 above the 20 line's middle (spec §4 `--name-rise`): Inter's
 *  x-height middle falls about 1.2 below the line's middle on its own. The
 *  text under it moves up with it, so the gap between them is unchanged. */
const NAME_RISE = 2.2;
const NAME_LINE = 20;
/** Where the avatar's middle sits in a row, below the row's top room. */
const AVATAR_MID = NAME_LINE / 2 - 1;
const MAX_PAGES_PER_PRESS = 3;

type Zone = 'campus' | 'world';

const railColor = (zone: Zone) => (zone === 'campus' ? colors.communityRailCampus : colors.communityRailWorld);

/** One row's piece of the line, and its curve into the avatar. */
function Rail({ zone, top, last }: { zone: Zone; top: number; last: boolean }) {
  const mid = top + AVATAR_MID;
  const color = railColor(zone);
  const left = LINE_X - LINE_W / 2;
  return (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.railLine,
          { left, backgroundColor: color },
          // The last piece stops where its curve begins; the curve carries on.
          last ? { height: mid - RAIL_R + 1 } : { bottom: 0 },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.railCurve,
          {
            left,
            top: mid - RAIL_R - LINE_W / 2,
            width: TEXT_EDGE - RAIL_GAP - left,
            height: RAIL_R + LINE_W,
            borderBottomLeftRadius: RAIL_R + LINE_W / 2,
            borderColor: color,
          },
        ]}
      />
    </>
  );
}

const ReplyRow = memo(function ReplyRow({
  reply,
  isAuthor,
  showCampus,
  zone,
  first,
  last,
  playing,
  onReact,
  onOpenProfile,
}: {
  reply: PostItem;
  isAuthor: boolean;
  showCampus: boolean;
  zone: Zone;
  first: boolean;
  last: boolean;
  playing: boolean;
  onReact: (post: PostItem, emoji: string | null) => void;
  onOpenProfile: (userId: string) => void;
}) {
  const top = ROW_TOP + (first ? THREAD_LEAD : 0);
  const mine = !!reply.viewer_reaction;
  const time = formatPostTime(reply.created_at);
  const total = reply.reactions_total;

  const like = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onReact(reply, mine ? null : DEFAULT_REACTION);
  };

  return (
    <View style={[styles.reply, { paddingTop: top }]}>
      <Rail zone={zone} top={top} last={last} />
      <Pressable
        onPress={() => onOpenProfile(reply.author_id)}
        accessibilityRole="button"
        accessibilityLabel={`@${reply.author_username}'s profile`}
        hitSlop={4}
        style={[styles.replyAvatar, { top: top + AVATAR_MID - REPLY_AVATAR / 2 }]}
      >
        <Avatar name={reply.author_name} uri={reply.author_avatar} size={REPLY_AVATAR} />
      </Pressable>

      <View style={styles.replyBody}>
        <View style={styles.replyHead}>
          <View style={styles.replyWho}>
            <AppText
              numberOfLines={1}
              onPress={() => onOpenProfile(reply.author_id)}
              suppressHighlighting
              style={[styles.replyName, isAuthor && styles.replyNameAuthor]}
            >
              @{reply.author_username}
            </AppText>
            {/* A phone is always a narrow feed (≤ 520), so where the campus
                shows it takes a line of its own (spec §4); the time goes there
                with it. In the campus feed the time stays on this line. */}
            {!showCampus && time ? (
              <AppText numberOfLines={1} style={styles.replyMeta}>
                {' · '}
                {time}
              </AppText>
            ) : null}
          </View>
          <Pressable
            onPress={like}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={`${total} ${total === 1 ? 'like' : 'likes'}. ${mine ? 'Remove your like' : 'Like this reply'}`}
            accessibilityState={{ selected: mine }}
            style={({ pressed }) => [styles.like, pressed && styles.pressed]}
          >
            <Ionicons
              name={mine ? 'heart' : 'heart-outline'}
              size={14}
              color={mine ? colors.communityLike : colors.communityMuted}
            />
            {total > 0 ? (
              <AppText style={[styles.likeCount, mine && styles.likeCountMine]}>{formatCount(total)}</AppText>
            ) : null}
          </Pressable>
          {/* ⋯ — Report and Delete arrive in part 3 (CC-V4c). */}
          <Pressable
            onPress={() => {}}
            hitSlop={{ top: 12, bottom: 12, left: 4, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="More"
            style={({ pressed }) => [styles.replyMore, pressed && styles.pressed]}
          >
            <Feather name="more-horizontal" size={14} color={colors.communityMuted} />
          </Pressable>
        </View>
        {showCampus ? (
          <AppText numberOfLines={1} style={styles.replyByline}>
            {reply.author_university}
            {time ? ` · ${time}` : ''}
          </AppText>
        ) : null}
        {reply.content ? (
          <View style={showCampus ? styles.replyTextAfterByline : null}>
            <PostText key={reply.id} content={reply.content} variant="reply" />
          </View>
        ) : null}
        {reply.gif ? <PostGif gif={reply.gif} playing={playing} maxWidth={180} /> : null}
      </View>
    </View>
  );
});

export const PostThread = memo(function PostThread({
  post,
  showCampus,
  zone,
  playing,
  moreRequest,
  onReact,
  onOpenProfile,
}: {
  post: PostItem;
  showCampus: boolean;
  zone: Zone;
  playing: boolean;
  /** Goes up when the post's 💬 asks the thread for more (a view-only feed). */
  moreRequest: number;
  onReact: (post: PostItem, emoji: string | null) => void;
  onOpenProfile: (userId: string) => void;
}) {
  const [wanted, setWanted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const extraRounds = useRef(0);
  const thread = useThreadReplies(post.id, wanted);

  const preview = post.top_replies ?? [];
  const loaded = useMemo(() => thread.data?.pages.flatMap((p) => p?.items ?? []) ?? [], [thread.data]);
  const unfolded = useMemo(() => distinctById([...preview, ...loaded]), [preview, loaded]);
  const replies = expanded ? unfolded : preview;

  const total = Math.max(post.replies_count ?? 0, unfolded.length);
  const exhausted = thread.data ? !thread.hasNextPage : false;
  const canLoad = !exhausted && total > unfolded.length;
  const hasUnshownLoaded = unfolded.length > preview.length;
  const showMore = total >= REPLIES_FOLD_MIN && (expanded ? canLoad : hasUnshownLoaded || canLoad);
  const showHide = expanded && hasUnshownLoaded;
  const busy = thread.isFetching;

  const onShowMore = () => {
    if (busy) return;
    // Folded with replies already here: unfold them first.
    if (!expanded && hasUnshownLoaded) {
      setExpanded(true);
      return;
    }
    if (!canLoad) return;
    setExpanded(true);
    extraRounds.current = MAX_PAGES_PER_PRESS - 1;
    if (!wanted) setWanted(true); // the first page loads by itself
    else void thread.fetchNextPage();
  };

  // One or two left over come in with the same press, not behind the button.
  useEffect(() => {
    if (thread.isFetching || !thread.hasNextPage || extraRounds.current <= 0) return;
    const left = total - unfolded.length;
    if (left > 0 && left < REPLIES_FOLD_MIN) {
      extraRounds.current -= 1;
      void thread.fetchNextPage();
    } else {
      extraRounds.current = 0;
    }
  }, [thread.isFetching, thread.hasNextPage, thread, total, unfolded.length]);

  const lastRequest = useRef(moreRequest);
  useEffect(() => {
    if (moreRequest === lastRequest.current) return;
    lastRequest.current = moreRequest;
    onShowMore();
    // Only a new request counts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moreRequest]);

  const failed = thread.isError && !busy;
  if (replies.length === 0 && !showMore) return null;

  const buttonRow = showMore || showHide;
  return (
    <View accessibilityLabel="Replies">
      {replies.map((reply, i) => (
        <ReplyRow
          key={reply.id}
          reply={reply}
          isAuthor={reply.author_id === post.author_id}
          showCampus={showCampus}
          zone={zone}
          first={i === 0}
          last={!buttonRow && i === replies.length - 1}
          playing={playing}
          onReact={onReact}
          onOpenProfile={onOpenProfile}
        />
      ))}
      {buttonRow ? (
        <View style={[styles.reply, { paddingTop: replies.length === 0 ? ROW_TOP + THREAD_LEAD : ROW_TOP }]}>
          <Rail zone={zone} top={replies.length === 0 ? ROW_TOP + THREAD_LEAD : ROW_TOP} last />
          <View style={styles.threadButtons}>
            {showMore ? (
              <Pressable
                onPress={onShowMore}
                disabled={busy}
                hitSlop={{ top: 12, bottom: 12 }}
                accessibilityRole="button"
                accessibilityState={{ expanded, busy }}
                style={({ pressed }) => [styles.threadButton, pressed && styles.pressed]}
              >
                {busy ? (
                  <ActivityIndicator size={12} color={colors.communityMuted} />
                ) : (
                  <Feather name="chevron-down" size={13} color={colors.communityMuted} />
                )}
                <AppText style={styles.threadButtonText}>
                  {failed ? "Couldn't load replies. Try again" : 'Show more replies'}
                </AppText>
              </Pressable>
            ) : null}
            {showHide ? (
              <Pressable
                onPress={() => setExpanded(false)}
                hitSlop={{ top: 12, bottom: 12 }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.threadButton, pressed && styles.pressed]}
              >
                <Feather name="chevron-up" size={13} color={colors.communityMuted} />
                <AppText style={styles.threadButtonText}>Hide replies</AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  reply: {
    paddingLeft: TEXT_EDGE + REPLY_AVATAR + 8,
    paddingBottom: 2,
  },
  railLine: { position: 'absolute', top: 0, width: LINE_W },
  railCurve: {
    position: 'absolute',
    borderLeftWidth: LINE_W,
    borderBottomWidth: LINE_W,
  },
  replyAvatar: { position: 'absolute', left: TEXT_EDGE },
  replyBody: { marginTop: -NAME_RISE },
  replyHead: { height: NAME_LINE, flexDirection: 'row', alignItems: 'center' },
  replyWho: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  replyName: {
    flexShrink: 1,
    minWidth: 40,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    lineHeight: NAME_LINE,
    color: colors.blackSoft,
  },
  // The post's own author: the username on a reactionMineBg pill, reaching out
  // to the left so the name itself stays in line with the text below.
  replyNameAuthor: {
    color: colors.purple,
    backgroundColor: colors.reactionMineBg,
    borderRadius: 9,
    lineHeight: 18,
    paddingHorizontal: 5,
    marginLeft: -5,
    overflow: 'hidden',
  },
  replyMeta: {
    flexShrink: 0,
    fontFamily: font.family.regular,
    fontSize: font.sizes.caption,
    lineHeight: NAME_LINE,
    color: colors.communityMuted,
  },
  // The campus's own line (spec §4): 1 below the username's line, 3 above the text.
  replyByline: {
    marginTop: 1,
    fontFamily: font.family.regular,
    fontSize: font.sizes.caption,
    lineHeight: 14,
    color: colors.communityMuted,
  },
  replyTextAfterByline: { marginTop: 3 },
  like: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: NAME_LINE,
    paddingHorizontal: 4,
  },
  likeCount: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.caption,
    lineHeight: 16,
    color: colors.communityMuted,
    fontVariant: ['tabular-nums'],
  },
  likeCountMine: { color: colors.communityLike },
  replyMore: { height: NAME_LINE, paddingLeft: 6, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  threadButtons: { height: NAME_LINE, flexDirection: 'row', alignItems: 'center', gap: 14, marginLeft: -(REPLY_AVATAR + 8) + 2 },
  threadButton: { flexDirection: 'row', alignItems: 'center', gap: 4, height: NAME_LINE },
  threadButtonText: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.caption,
    lineHeight: 16,
    color: colors.communityMuted,
  },
});
