import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewInstance, type ViewStyle } from 'react-native';
import Reanimated from 'react-native-reanimated';

import { AnchoredModal, type WindowRect } from '../AnchoredModal';
import { AppText } from '../AppText';
import { AppToast, useToast } from '../AppToast';
import { ConfirmDialog } from '../ConfirmDialog';
import { EmojiPickerSheet } from './EmojiPickerSheet';
import { ReactionBreakdownSheet } from './ReactionBreakdownSheet';
import { REPORT_TEXT, ReportSheet } from './ReportSheet';
import { useDeletePost } from '../../hooks/useCommunity';
import { POPOVER_ENTER } from '../../lib/motion';
import { WEBSITE_URL } from '../../lib/share';
import { colors, font, shadows } from '../../theme';
import type { PostItem } from '../../types';

/**
 * Everything a post's buttons open, once per screen instead of once per card.
 * Every screen that shows posts wraps them in <PostActionsProvider> (the
 * Community tab, a post's page, the Posts tabs), and the cards reach it with
 * usePostActions(). Without a provider those buttons do nothing.
 *
 *   ⋯         a small menu under the button: Copy text (when there is text),
 *             Copy link, then Report for everyone but the author (spec §7),
 *             Delete for the author only (spec §3)
 *   Copy      the text as typed, symbols and all, or the post's website link
 *             (a reply's: its parent post's); toast `Text copied`, `Link
 *             copied` or `Couldn't copy` (TEXT_FORMAT_SPEC §6)
 *   Report    ReportSheet → POST /api/reports → the toast; the post leaves this
 *             student's lists (useReportPost)
 *   Delete    ConfirmDialog with the spec's words → DELETE /api/posts/:id → it
 *             leaves every list (useDeletePost)
 *   ⊕         the full emoji picker (§5.2), from the quick bar or the breakdown
 *   summary   the breakdown sheet (§5.4)
 *
 * Only one overlay is ever open: each opens after the one before has closed.
 * `onRemoved(post, why)` lets the screen react too (the post page shows
 * "This post was deleted." for its own post).
 */
type Anchor = WindowRect;
type PickerRequest = { current: string | null; onPick: (emoji: string | null) => void };
type BreakdownRequest = { post: PostItem; onReact: (emoji: string | null) => void };

type Actions = {
  openMenu: (post: PostItem, anchor: Anchor) => void;
  openPicker: (request: PickerRequest) => void;
  openBreakdown: (request: BreakdownRequest) => void;
  showToast: (text: string) => void;
};

const PostActionsContext = createContext<Actions | null>(null);

export function usePostActions() {
  return useContext(PostActionsContext);
}

/* Not in the spec: it has no words for a failed delete. The website's text. */
const DELETE_FAILED = "Couldn't delete. Try again.";

export function PostActionsProvider({
  children,
  toastBottom = 24,
  onRemoved,
}: {
  children: ReactNode;
  toastBottom?: number;
  onRemoved?: (post: PostItem, why: 'reported' | 'deleted') => void;
}) {
  const { toast, showToast } = useToast();
  const [menu, setMenu] = useState<{ post: PostItem; anchor: Anchor } | null>(null);
  const [reporting, setReporting] = useState<PostItem | null>(null);
  const [deleting, setDeleting] = useState<PostItem | null>(null);
  const [picker, setPicker] = useState<PickerRequest | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownRequest | null>(null);
  const deletePost = useDeletePost();
  const onRemovedRef = useRef(onRemoved);
  onRemovedRef.current = onRemoved;

  const value = useMemo<Actions>(
    () => ({
      openMenu: (post, anchor) => setMenu({ post, anchor }),
      openPicker: setPicker,
      openBreakdown: setBreakdown,
      showToast,
    }),
    [showToast],
  );

  const copy = useCallback(
    async (text: string, done: string) => {
      setMenu(null);
      let copied = false;
      try {
        copied = await Clipboard.setStringAsync(text);
      } catch {
        copied = false;
      }
      showToast(copied ? done : "Couldn't copy");
    },
    [showToast],
  );

  const confirmDelete = useCallback(() => {
    const post = deleting;
    setDeleting(null);
    if (!post) return;
    deletePost.mutate(post, {
      onSuccess: () => onRemovedRef.current?.(post, 'deleted'),
      onError: () => showToast(DELETE_FAILED),
    });
  }, [deleting, deletePost, showToast]);

  return (
    <PostActionsContext.Provider value={value}>
      {children}

      {menu ? (
        <PostMenu
          post={menu.post}
          anchor={menu.anchor}
          onClose={() => setMenu(null)}
          onCopyText={() => void copy(menu.post.content, 'Text copied')}
          onCopyLink={() => void copy(postLink(menu.post), 'Link copied')}
          onReport={() => {
            setMenu(null);
            setReporting(menu.post);
          }}
          onDelete={() => {
            setMenu(null);
            setDeleting(menu.post);
          }}
        />
      ) : null}

      {reporting ? (
        <ReportSheet
          post={reporting}
          onClose={(sent) => {
            const post = reporting;
            setReporting(null);
            if (sent) {
              showToast(REPORT_TEXT.sent);
              onRemovedRef.current?.(post, 'reported');
            }
          }}
        />
      ) : null}

      <ConfirmDialog
        content={
          deleting
            ? {
                title: 'Delete this post?',
                message: 'It will be removed for everyone.',
                confirmLabel: 'Delete',
                icon: 'trash-2',
                imageUri: deleting.image_urls?.[0] ?? null,
                tone: 'danger',
              }
            : null
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      {breakdown ? (
        <ReactionBreakdownSheet
          counts={breakdown.post.reaction_counts}
          total={breakdown.post.reactions_total}
          mine={breakdown.post.viewer_reaction}
          onClose={() => setBreakdown(null)}
          onAdd={() => {
            const { post, onReact } = breakdown;
            setBreakdown(null);
            setPicker({ current: post.viewer_reaction, onPick: onReact });
          }}
        />
      ) : null}

      {/* Mounted while open only: it is a Modal of its own. */}
      {picker ? (
        <EmojiPickerSheet
          open
          current={picker.current}
          onClose={() => setPicker(null)}
          onPick={(emoji) => {
            const { current, onPick } = picker;
            setPicker(null);
            // Your current emoji again removes it (spec §5).
            onPick(emoji === current ? null : emoji);
          }}
        />
      ) : null}

      <AppToast message={toast} bottom={toastBottom} />
    </PostActionsContext.Provider>
  );
}

/** A post's link on the website; a reply's is its parent post's. */
function postLink(post: PostItem) {
  return `${WEBSITE_URL}/post/${post.parent_post_id ?? post.id}`;
}

/** The ⋯ menu: its rows, under the button, kept on screen. */
const MENU_W = 168;
/** One row's height; the menu adds its padding (4 above and below). */
const ITEM_H = 44;
const MENU_PAD = 8;
/** From the centre of the ⋯ dots to the menu's edge. */
const MENU_GAP = 9;

function PostMenu({
  post,
  anchor,
  onClose,
  onCopyText,
  onCopyLink,
  onReport,
  onDelete,
}: {
  post: PostItem;
  anchor: Anchor;
  onClose: () => void;
  onCopyText: () => void;
  onCopyLink: () => void;
  onReport: () => void;
  onDelete: () => void;
}) {
  // Copy text only when there is text (a GIF or photos alone have none).
  const hasText = !!post.content?.trim();
  const MENU_H = (hasText ? 3 : 2) * ITEM_H + MENU_PAD;
  return (
    <AnchoredModal anchor={anchor} onClose={onClose}>
      {(button, layer) => {
        // Just under the dots, right edges lined up; just over them near the
        // bottom of the screen. Measured from the dots' centre, not the icon's
        // box: from the box the menu sat ~12 below the dots, which read as
        // detached (owner, 13 Nov). The ⋯ glyph is about 3 tall, so the menu's
        // edge lands ~6 from the dots themselves.
        const mid = button.y + button.height / 2;
        const left = Math.min(Math.max(button.x + button.width - MENU_W, 8), layer.width - MENU_W - 8);
        const above = mid + MENU_GAP + MENU_H > layer.height - 8;
        const top = above ? mid - MENU_GAP - MENU_H : mid + MENU_GAP;
        return (
          <Reanimated.View
            entering={POPOVER_ENTER}
            style={[styles.menu, { left, top, transformOrigin: above ? 'bottom right' : 'top right' }]}
            accessibilityRole="menu"
          >
            {hasText ? (
              <Pressable
                onPress={onCopyText}
                accessibilityRole="menuitem"
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <Feather name="copy" size={15} color={colors.blackSoft} />
                <AppText style={styles.itemText}>Copy text</AppText>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onCopyLink}
              accessibilityRole="menuitem"
              style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
            >
              <Feather name="link" size={15} color={colors.blackSoft} />
              <AppText style={styles.itemText}>Copy link</AppText>
            </Pressable>
            {post.is_mine ? (
              <Pressable
                onPress={onDelete}
                accessibilityRole="menuitem"
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <Feather name="trash-2" size={15} color={colors.errorText} />
                <AppText style={[styles.itemText, styles.danger]}>Delete</AppText>
              </Pressable>
            ) : (
              <Pressable
                onPress={onReport}
                accessibilityRole="menuitem"
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <Feather name="flag" size={15} color={colors.blackSoft} />
                <AppText style={styles.itemText}>Report</AppText>
              </Pressable>
            )}
          </Reanimated.View>
        );
      }}
    </AnchoredModal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    width: MENU_W,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: colors.white,
    boxShadow: shadows.quickBar,
  },
  item: { height: ITEM_H, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  itemPressed: { backgroundColor: colors.reactionMineBg },
  itemText: { fontFamily: font.family.medium, fontSize: font.sizes.bodyLg, color: colors.blackSoft },
  danger: { color: colors.errorText },
});

/** The ⋯ button on a post or reply: measures itself and opens the menu. */
export function MoreButton({
  post,
  size = 15,
  style,
}: {
  post: PostItem;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const actions = usePostActions();
  const ref = useRef<ViewInstance>(null);
  return (
    <Pressable
      ref={ref}
      onPress={() =>
        ref.current?.measureInWindow((x, y, width, height) => actions?.openMenu(post, { x, y, width, height }))
      }
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel="More options"
      style={({ pressed }) => [style, pressed && { opacity: 0.55 }]}
    >
      <Feather name="more-horizontal" size={size} color={colors.communityMuted} />
    </Pressable>
  );
}
