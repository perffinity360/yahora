import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

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
}: {
  name?: string | null;
  uri?: string | null;
  size: number;
}) {
  const dims = { width: size, height: size, borderRadius: size / 2 };

  // An uploaded photo's URL is minted by the backend against its own
  // SUPABASE_URL, which is loopback in local dev and unreachable from a phone.
  // resolveMediaUrl points it back at this device's dev host; anything already
  // reachable passes through untouched. See src/lib/config.ts.
  const src = resolveMediaUrl(uri);

  if (src) {
    return (
      <Image source={{ uri: src }} style={[styles.avatar, dims]} contentFit="cover" transition={180} />
    );
  }
  return (
    <View style={[styles.avatar, dims, { backgroundColor: avatarHue(name) }]}>
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.38) }]}>
        {initialsOf(name) || '?'}
      </Text>
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
  initials: {
    fontFamily: font.family.bold,
    color: colors.white,
  },
});
