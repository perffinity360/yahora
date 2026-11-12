import Feather from '@expo/vector-icons/Feather';
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
import { colors, font, shadows } from '../../theme';
import type { PostItem } from '../../types';

/**
 * Everything a post's buttons open, once per screen instead of once per card.
 * Every screen that shows posts wraps them in <PostActionsProvider> (the
 * Community tab, a post's page, the Posts tabs), and the cards reach it with
 * usePostActions(). Without a provider those buttons do nothing.
 *
 *   ⋯         a small menu under the button: Report for everyone but the
 *             author (spec §7), Delete for the author only (spec §3)
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

/** The ⋯ menu: one row, under the button, kept on screen. */
const MENU_W = 168;
/** One 44-tall item and the menu's padding. */
const MENU_H = 52;

function PostMenu({
  post,
  anchor,
  onClose,
  onReport,
  onDelete,
}: {
  post: PostItem;
  anchor: Anchor;
  onClose: () => void;
  onReport: () => void;
  onDelete: () => void;
}) {
  return (
    <AnchoredModal anchor={anchor} onClose={onClose}>
      {(button, layer) => {
        // Under the ⋯ button, right edges lined up; above it near the bottom.
        const left = Math.min(Math.max(button.x + button.width - MENU_W, 8), layer.width - MENU_W - 8);
        const below = button.y + button.height + 4;
        const above = below + MENU_H > layer.height - 8;
        const top = above ? button.y - 4 - MENU_H : below;
        return (
          <Reanimated.View
            entering={POPOVER_ENTER}
            style={[styles.menu, { left, top, transformOrigin: above ? 'bottom right' : 'top right' }]}
            accessibilityRole="menu"
          >
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
  item: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
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
