import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { avatarHue, initialsOf } from '../lib/avatar';
import { resolveMediaUrl } from '../lib/config';
import { colors, font } from '../theme';

/**
 * A user's photo, or a coloured initials disc when they have none. Shared by
 * the comment thread, the inbox and the chat header so one person always looks
 * the same everywhere in the app.
 */
export function Avatar({
  name,
  uri,
  size,
  ringed = false,
}: {
  name?: string | null;
  uri?: string | null;
  size: number;
  /**
   * The purple ring the product card puts on a seller's photo (see
   * `sellerAvatar` in ProductCard.tsx). Photo only: the initials disc is
   * already a solid colour and gets no ring, on the card or here.
   */
  ringed?: boolean;
}) {
  const dims = { width: size, height: size, borderRadius: size / 2 };

  // An uploaded photo's URL is minted by the backend against its own
  // SUPABASE_URL, which is loopback in local dev and unreachable from a phone.
  // resolveMediaUrl points it back at this device's dev host; anything already
  // reachable passes through untouched. See src/lib/config.ts.
  const src = resolveMediaUrl(uri);

  if (src) {
    return (
      <Image
        source={{ uri: src }}
        style={[styles.avatar, dims, ringed && [styles.ring, { borderWidth: size >= 40 ? 2 : 1.5 }]]}
        contentFit="cover"
        transition={180}
      />
    );
  }
  return (
    <View style={[styles.avatar, dims, { backgroundColor: avatarHue(name) }]}>
      {/* 0.34 of the disc (was 0.38 — two initials crowded the edge), but never
          under the 11dp floor: the chat and comment avatars are 26–30dp, where
          the ratio lands at 9–10 and the initials read as a smudge. See
          font.sizes in src/theme. */}
      <AppText
        style={[styles.initials, { fontSize: Math.max(font.sizes.micro, Math.round(size * 0.34)) }]}
      >
        {initialsOf(name) || '?'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkLight,
    overflow: 'hidden',
  },
  ring: {
    borderColor: colors.purpleDark,
  },
  initials: {
    fontFamily: font.family.bold,
    color: colors.white,
  },
});
