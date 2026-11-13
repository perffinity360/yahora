import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../AppText';
import { Avatar } from '../Avatar';
import { colors, font } from '../../theme';

/**
 * The post page's reply bar — COMMUNITY_SPEC.md §2.1 and §4, on a phone: a
 * solid dock at the bottom, edge to edge (owner, 10 Nov: floating, the posts
 * passing through the gap under it looked messy). A white one-line field, 41
 * tall on a touch screen, outlined in the zone's dark accent all the time,
 * with your avatar mirroring the Reply pill at the other end (§2.2).
 *
 * The feeds no longer have one: they post from a floating button (PostFab;
 * owner, 13 Nov). A reply bar stays, as under a post in WhatsApp or X.
 *
 * Tapping anywhere opens the compose screen as a reply. A half-written reply
 * shows its text instead of the grey hint, so it's clear it is still there.
 */
export const DOCK_HEIGHT = 1.5 + 2 + 41 + 2;
const FIELD = 41;
const INSET = 2.5;
const PILL = FIELD - INSET * 2;

export const ComposerDock = memo(function ComposerDock({
  zone,
  hint,
  draft,
  avatarName,
  avatarUri,
  onOpen,
  reply = false,
  bottomInset = 0,
}: {
  zone: 'campus' | 'world';
  hint: string;
  draft: string | null;
  avatarName?: string | null;
  avatarUri?: string | null;
  onOpen: () => void;
  /** `Reply` on the pill instead of `Post`. */
  reply?: boolean;
  /** Where nothing sits under the dock (a post page, no tab bar), it runs on
   *  behind the phone's own bar in the same colour (DESIGN.md "Surfaces"). */
  bottomInset?: number;
}) {
  const outline = zone === 'campus' ? colors.purpleDark : colors.pinkDark;
  const pill = zone === 'campus' ? colors.purpleDark : colors.communityWorldStrong;
  return (
    <View style={[styles.dock, bottomInset ? { height: DOCK_HEIGHT + bottomInset, paddingBottom: bottomInset } : null]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={draft ? `Continue your post: ${draft}` : hint}
        style={({ pressed }) => [styles.field, { borderColor: outline }, pressed && styles.fieldPressed]}
      >
        <Avatar name={avatarName} uri={avatarUri} size={PILL} />
        <AppText numberOfLines={1} style={[styles.hint, draft ? styles.draft : null]}>
          {draft || hint}
        </AppText>
        <View style={[styles.post, { backgroundColor: pill }]} pointerEvents="none">
          <AppText style={styles.postText}>{reply ? 'Reply' : 'Post'}</AppText>
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: DOCK_HEIGHT,
    paddingTop: 2,
    paddingHorizontal: 8,
    backgroundColor: colors.communityDock,
    borderTopWidth: 1.5,
    borderTopColor: colors.communityRail,
  },
  field: {
    height: FIELD,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: INSET - 1.5,
    borderRadius: FIELD / 2,
    borderWidth: 1.5,
    backgroundColor: colors.white,
  },
  fieldPressed: { backgroundColor: colors.pinkLight },
  hint: {
    flex: 1,
    marginLeft: 10,
    fontFamily: font.family.regular,
    fontSize: font.sizes.bodyLg,
    lineHeight: 20,
    color: colors.mutedLabel,
  },
  draft: { color: colors.blackSoft },
  post: {
    height: PILL,
    paddingHorizontal: 16,
    borderRadius: PILL / 2,
    justifyContent: 'center',
  },
  postText: { fontFamily: font.family.semibold, fontSize: font.sizes.body, color: colors.white },
});
