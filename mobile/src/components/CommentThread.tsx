import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useAddComment, useVoteComment } from '../hooks/useComments';
import { avatarHue, initialsOf } from '../lib/avatar';
import { colors, font, radius, spacing } from '../theme';
import type { ProductComment } from '../types';
import { timeAgo } from './ProductCard';

/**
 * The product detail Q&A thread: questions with one level of nested replies,
 * up/down vote pills, and an inline reply composer — the mobile counterpart of
 * the web ProductDetail comment section.
 *
 * The section owns the reply flow (`replyingTo` + its composer + the vote
 * mutation); the screen owns the pinned bottom composer for a new top-level
 * question and opens it via `onAskQuestion`.
 */

const UP_TINT = colors.blueDark;
const DOWN_TINT = colors.pinkDark;

/** Shared by both composers (this one and the screen's docked question box). */
export const MAX_COMMENT_LENGTH = 500;

export interface CommentSectionProps {
  productId: string;
  comments: ProductComment[];
  /** Signed-in viewer, shown on the "ask a question" prompt. */
  viewerName?: string | null;
  viewerAvatarUrl?: string | null;
  /** False when browsing another campus — read-only, mirroring the web lock. */
  canInteract: boolean;
  /** Opens the screen's pinned composer for a new top-level question. */
  onAskQuestion: () => void;
  /** Lets the screen hide its action dock while an inline reply is open. */
  onReplyingChange?: (commentId: string | null) => void;
  /** The screen's scroll view + its live offset, used to lift an opening reply
   *  composer above the keyboard. */
  scrollRef?: React.RefObject<ScrollView | null>;
  scrollOffsetRef?: React.RefObject<number>;
  style?: StyleProp<ViewStyle>;
}

export function CommentSection({
  productId,
  comments,
  viewerName,
  viewerAvatarUrl,
  canInteract,
  onAskQuestion,
  onReplyingChange,
  scrollRef,
  scrollOffsetRef,
  style,
}: CommentSectionProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');

  const addReply = useAddComment(productId);
  const voteComment = useVoteComment(productId);

  // The backend returns the whole thread newest-first; split it into roots and
  // their replies exactly like the web does.
  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesOf = (parentId: string) =>
    comments.filter((c) => c.parent_comment_id === parentId);

  const setReplyTarget = (commentId: string | null) => {
    setReplyingTo(commentId);
    setReplyDraft('');
    onReplyingChange?.(commentId);
  };

  const submitReply = (parentId: string) => {
    const content = replyDraft.trim();
    if (!content || addReply.isPending) return;
    addReply.mutate(
      { content, parentCommentId: parentId },
      {
        onSuccess: () => {
          setReplyTarget(null);
          Keyboard.dismiss();
        },
        onError: (err) => Alert.alert("Couldn't post your reply", err.message),
      },
    );
  };

  // Votes fail silently: the optimistic pill rolls back, which is the feedback.
  const handleVote = (commentId: string, voteValue: 1 | -1) => {
    if (!canInteract) return;
    voteComment.mutate({ commentId, voteValue });
  };

  return (
    <View style={style}>
      <View style={styles.header}>
        <Feather name="message-circle" size={17} color={colors.purple} />
        <Text style={styles.headerTitle}>Questions &amp; Answers</Text>
        {comments.length > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{comments.length}</Text>
          </View>
        ) : null}
      </View>

      {canInteract ? (
        <Pressable
          onPress={onAskQuestion}
          accessibilityRole="button"
          accessibilityLabel="Ask the seller a question"
          style={({ pressed }) => [styles.prompt, pressed && styles.promptPressed]}
        >
          <CommentAvatar name={viewerName} uri={viewerAvatarUrl} size={30} />
          <Text style={styles.promptText} numberOfLines={1}>
            Ask the seller a question…
          </Text>
          <Feather name="edit-3" size={15} color={colors.purple} />
        </Pressable>
      ) : (
        <View style={styles.locked}>
          <Feather name="lock" size={15} color={colors.mutedLabel} />
          <Text style={styles.lockedText}>
            Questions are locked for visitors from other campuses.
          </Text>
        </View>
      )}

      {topLevel.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Feather name="message-circle" size={22} color={colors.purple} />
          </View>
          <Text style={styles.emptyText}>No questions yet — ask the seller something!</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {topLevel.map((comment) => {
            const replies = repliesOf(comment.id);
            const isReplying = replyingTo === comment.id;

            return (
              <View key={comment.id} style={styles.thread}>
                <CommentCard
                  comment={comment}
                  canInteract={canInteract}
                  onVote={(value) => handleVote(comment.id, value)}
                  footer={
                    canInteract ? (
                      <>
                        <View style={styles.actionDivider} />
                        <Pressable
                          onPress={() => setReplyTarget(isReplying ? null : comment.id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={
                            isReplying ? 'Cancel reply' : `Reply to ${comment.user.full_name ?? 'this question'}`
                          }
                          style={({ pressed }) => [styles.replyBtn, pressed && styles.replyBtnPressed]}
                        >
                          <Text
                            style={[styles.replyBtnText, isReplying && styles.replyBtnTextActive]}
                          >
                            {isReplying ? 'Cancel' : 'Reply'}
                          </Text>
                        </Pressable>
                        {replies.length > 0 ? (
                          <Text style={styles.replyCount}>
                            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                          </Text>
                        ) : null}
                      </>
                    ) : null
                  }
                />

                {isReplying && canInteract ? (
                  <ReplyComposer
                    parentName={comment.user.full_name}
                    value={replyDraft}
                    onChangeText={setReplyDraft}
                    onCancel={() => setReplyTarget(null)}
                    onSubmit={() => submitReply(comment.id)}
                    submitting={addReply.isPending}
                    scrollRef={scrollRef}
                    scrollOffsetRef={scrollOffsetRef}
                  />
                ) : null}

                {replies.length > 0 ? (
                  <View style={styles.repliesGroup}>
                    <View style={styles.rail} />
                    <View style={styles.repliesList}>
                      {replies.map((reply) => (
                        <CommentCard
                          key={reply.id}
                          comment={reply}
                          compact
                          canInteract={canInteract}
                          onVote={(value) => handleVote(reply.id, value)}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ────────────────────────── Comment ────────────────────────── */
function CommentCard({
  comment,
  compact = false,
  canInteract,
  onVote,
  footer,
}: {
  comment: ProductComment;
  compact?: boolean;
  canInteract: boolean;
  onVote: (voteValue: 1 | -1) => void;
  footer?: React.ReactNode;
}) {
  const upActive = comment.user_vote === 1;
  const downActive = comment.user_vote === -1;

  return (
    <View style={styles.commentRow}>
      <CommentAvatar
        name={comment.user.full_name}
        uri={comment.user.avatar_url}
        size={compact ? 28 : 34}
      />
      <View style={styles.commentBody}>
        <View style={[styles.bubble, compact && styles.bubbleCompact]}>
          <View style={styles.metaRow}>
            <Text style={styles.commenterName} numberOfLines={1}>
              {comment.user.full_name || 'Yahora student'}
            </Text>
            <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
          </View>
          <Text style={[styles.commentText, compact && styles.commentTextCompact]}>
            {comment.content}
          </Text>
        </View>

        {canInteract ? (
          <View style={styles.actions}>
            <VotePill
              icon="thumbs-up"
              count={comment.upvotes}
              active={upActive}
              tint={UP_TINT}
              label={upActive ? 'Remove helpful vote' : 'Mark as helpful'}
              onPress={() => onVote(1)}
            />
            <VotePill
              icon="thumbs-down"
              count={comment.downvotes}
              active={downActive}
              tint={DOWN_TINT}
              label={downActive ? 'Remove not-helpful vote' : 'Mark as not helpful'}
              onPress={() => onVote(-1)}
            />
            {footer}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function VotePill({
  icon,
  count,
  active,
  tint,
  label,
  onPress,
}: {
  icon: 'thumbs-up' | 'thumbs-down';
  count: number;
  active: boolean;
  tint: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.pill,
        active && { borderColor: tint, backgroundColor: colors.white },
        pressed && styles.pillPressed,
      ]}
    >
      <Feather name={icon} size={13} color={active ? tint : colors.mutedLabel} />
      <Text style={[styles.pillCount, active && { color: tint }]}>{count}</Text>
    </Pressable>
  );
}

/* ────────────────────────── Inline reply composer ────────────────────────── */
function ReplyComposer({
  parentName,
  value,
  onChangeText,
  onCancel,
  onSubmit,
  submitting,
  scrollRef,
  scrollOffsetRef,
}: {
  parentName?: string | null;
  value: string;
  onChangeText: (text: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
  scrollRef?: React.RefObject<ScrollView | null>;
  scrollOffsetRef?: React.RefObject<number>;
}) {
  const viewRef = useRef<View>(null);
  const keyboardHeight = useRef(Keyboard.metrics()?.height ?? 0);
  const firstName = (parentName ?? '').trim().split(/\s+/)[0] || 'the seller';
  const canSend = !!value.trim() && !submitting;

  // The composer opens mid-scroll, so nudge the list until it clears the
  // keyboard. Measuring against the window keeps this independent of how deep
  // the composer sits inside the card/thread hierarchy.
  const reveal = useCallback(() => {
    const scroller = scrollRef?.current;
    const node = viewRef.current;
    if (!scroller || !node) return;
    node.measureInWindow((_x, y, _width, height) => {
      const visibleBottom =
        Dimensions.get('window').height - keyboardHeight.current - spacing.md;
      const overflow = y + height - visibleBottom;
      if (overflow > 4) {
        scroller.scrollTo({ y: (scrollOffsetRef?.current ?? 0) + overflow, animated: true });
      }
    });
  }, [scrollRef, scrollOffsetRef]);

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardHeight.current = event.endCoordinates.height;
      reveal();
    });
    // The keyboard may already be up (switching from one reply to another), in
    // which case no show event fires — check once after the layout settles.
    const timer = setTimeout(reveal, 140);
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [reveal]);

  return (
    <View ref={viewRef} style={styles.replyComposerWrap}>
      <View style={styles.rail} />
      <View style={styles.replyComposer}>
        <Text style={styles.replyingLabel} numberOfLines={1}>
          Replying to <Text style={styles.replyingName}>{parentName || 'this question'}</Text>
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          autoFocus
          multiline
          maxLength={MAX_COMMENT_LENGTH}
          placeholder={`Reply to ${firstName}…`}
          placeholderTextColor={colors.mutedPlaceholder}
          style={styles.replyInput}
          accessibilityLabel={`Reply to ${firstName}`}
        />
        <View style={styles.replyActions}>
          <Pressable
            onPress={onCancel}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
            style={({ pressed }) => [styles.ghostBtn, pressed && styles.ghostBtnPressed]}
          >
            <Text style={styles.ghostBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={onSubmit}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Post reply"
            accessibilityState={{ disabled: !canSend }}
            style={({ pressed }) => [
              styles.sendReplyBtn,
              !canSend && styles.sendReplyBtnDisabled,
              pressed && canSend && styles.sendReplyBtnPressed,
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Feather name="send" size={13} color={colors.white} />
                <Text style={styles.sendReplyText}>Reply</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ────────────────────────── Avatar ────────────────────────── */
export function CommentAvatar({
  name,
  uri,
  size,
}: {
  name?: string | null;
  uri?: string | null;
  size: number;
}) {
  const dims = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image source={{ uri }} style={[styles.avatar, dims]} contentFit="cover" transition={180} />
    );
  }
  return (
    <View style={[styles.avatar, dims, { backgroundColor: avatarHue(name) }]}>
      <Text style={[styles.avatarInitials, { fontSize: Math.round(size * 0.38) }]}>
        {initialsOf(name) || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontFamily: font.family.bold,
    fontSize: 15,
    color: colors.blackSoft,
  },
  countBadge: {
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: colors.demoCardPurpleBg,
  },
  countBadgeText: {
    fontFamily: font.family.bold,
    fontSize: 11,
    color: colors.purpleDark,
  },

  /* "Ask a question" prompt */
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: 999,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  promptPressed: {
    backgroundColor: colors.inputBg,
    borderColor: colors.inputBorderFocus,
  },
  promptText: {
    flex: 1,
    fontFamily: font.family.regular,
    fontSize: 13.5,
    color: colors.mutedLabel,
  },

  /* Foreign-campus lock */
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.inputBorderFocus,
    backgroundColor: colors.inputBg,
  },
  lockedText: {
    flex: 1,
    fontFamily: font.family.medium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.mutedText,
  },

  /* Empty state */
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  emptyText: {
    fontFamily: font.family.medium,
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
  },

  /* Threads */
  list: {
    marginTop: spacing.md,
  },
  thread: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
  },
  bubble: {
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  bubbleCompact: {
    padding: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  commenterName: {
    flexShrink: 1,
    fontFamily: font.family.bold,
    fontSize: 13,
    color: colors.blackSoft,
  },
  commentTime: {
    fontFamily: font.family.regular,
    fontSize: 11,
    color: colors.mutedLabel,
  },
  commentText: {
    fontFamily: font.family.regular,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.blackSoft,
  },
  commentTextCompact: {
    fontSize: 13,
    lineHeight: 19,
  },

  /* Vote + reply actions */
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
  pillPressed: {
    transform: [{ scale: 0.94 }],
  },
  pillCount: {
    fontFamily: font.family.semibold,
    fontSize: 12,
    color: colors.mutedLabel,
  },
  actionDivider: {
    width: 1,
    height: 14,
    marginHorizontal: 2,
    backgroundColor: colors.hairline,
  },
  replyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  replyBtnPressed: {
    backgroundColor: colors.pinkLight,
  },
  replyBtnText: {
    fontFamily: font.family.bold,
    fontSize: 12,
    color: colors.purple,
  },
  replyBtnTextActive: {
    color: colors.pinkDark,
  },
  replyCount: {
    fontFamily: font.family.medium,
    fontSize: 11.5,
    color: colors.mutedLabel,
  },

  /* Replies + the rail that ties them to their question */
  repliesGroup: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginLeft: spacing.lg,
  },
  repliesList: {
    flex: 1,
    gap: spacing.md,
  },
  rail: {
    width: 2,
    borderRadius: 1,
    marginRight: spacing.md,
    backgroundColor: colors.inputBorderFocus,
  },

  /* Inline reply composer */
  replyComposerWrap: {
    flexDirection: 'row',
    marginTop: spacing.md,
    marginLeft: spacing.lg,
  },
  replyComposer: {
    flex: 1,
  },
  replyingLabel: {
    fontFamily: font.family.regular,
    fontSize: 11.5,
    color: colors.mutedLabel,
    marginBottom: 6,
  },
  replyingName: {
    fontFamily: font.family.bold,
    color: colors.purple,
  },
  replyInput: {
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.inputBorderFocus,
    backgroundColor: colors.white,
    fontFamily: font.family.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.blackSoft,
    textAlignVertical: 'top',
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  ghostBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  ghostBtnPressed: {
    backgroundColor: colors.pinkLight,
  },
  ghostBtnText: {
    fontFamily: font.family.semibold,
    fontSize: 12.5,
    color: colors.mutedText,
  },
  sendReplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 86,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.purple,
  },
  sendReplyBtnPressed: {
    backgroundColor: colors.purpleDark,
  },
  sendReplyBtnDisabled: {
    opacity: 0.4,
  },
  sendReplyText: {
    fontFamily: font.family.bold,
    fontSize: 12.5,
    color: colors.white,
  },

  /* Avatar */
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkLight,
    overflow: 'hidden',
  },
  avatarInitials: {
    fontFamily: font.family.bold,
    color: colors.white,
  },
});
