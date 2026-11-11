import Feather from '@expo/vector-icons/Feather';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../AppText';
import { Avatar } from '../Avatar';
import { colors, font } from '../../theme';

/**
 * The closed composer — COMMUNITY_SPEC.md §2.1, on a phone: a solid dock at the
 * bottom of the feed, edge to edge (owner, 10 Nov: floating, the posts passing
 * through the gap under it looked messy). A white one-line field, 41 tall on a
 * touch screen, outlined in the feed's dark accent all the time (a narrow
 * window), with your avatar mirroring the Post pill at the other end (§2.2).
 *
 * Tapping anywhere opens the compose screen; the photo icon opens it straight
 * into the photo library. A half-written post shows its text instead of the
 * grey hint, so it's clear it is still there.
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
  onPhotos,
}: {
  zone: 'campus' | 'world';
  hint: string;
  draft: string | null;
  avatarName?: string | null;
  avatarUri?: string | null;
  onOpen: () => void;
  onPhotos: () => void;
}) {
  const outline = zone === 'campus' ? colors.purpleDark : colors.pinkDark;
  const pill = zone === 'campus' ? colors.purpleDark : colors.communityWorldStrong;
  return (
    <View style={styles.dock}>
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
        <Pressable
          onPress={onPhotos}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel="Add photos"
          style={({ pressed }) => [styles.photo, pressed && styles.pressed]}
        >
          <Feather name="image" size={18} color={pill} />
        </Pressable>
        <View style={[styles.post, { backgroundColor: pill }]} pointerEvents="none">
          <AppText style={styles.postText}>Post</AppText>
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
  // The photo icon at 65% until the composer is in use (spec §2.1).
  photo: { width: 34, height: PILL, alignItems: 'center', justifyContent: 'center', opacity: 0.65 },
  pressed: { opacity: 0.4 },
  post: {
    height: PILL,
    paddingHorizontal: 16,
    borderRadius: PILL / 2,
    justifyContent: 'center',
  },
  postText: { fontFamily: font.family.semibold, fontSize: font.sizes.body, color: colors.white },
});
