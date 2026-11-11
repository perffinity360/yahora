import { memo } from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CHAT_PATTERN, CHAT_TILE } from '../ChatWallpaperPreload';
import { COMMUNITY_WALLPAPER_OPACITY } from '../../theme';

/**
 * The community's ground (COMMUNITY_SPEC.md §1.1): the zone's tint, with the
 * chat's doodle tile over it at 15%, pinned while the posts scroll.
 *
 * Tiled by hand, one 420 × 420 Image per tile, for the reason the chat gives
 * (app/chat/[contactId].tsx, "Wallpaper"): Android's resizeMode="repeat" drew
 * a single tile and left the rest bare. The tile is the one the chat preloads,
 * so it is already decoded.
 */
export const CommunityWallpaper = memo(function CommunityWallpaper({ ground }: { ground: string }) {
  const { width, height } = useWindowDimensions();
  const cols = Math.ceil(width / CHAT_TILE);
  const rows = Math.ceil(height / CHAT_TILE);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: ground }]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { opacity: COMMUNITY_WALLPAPER_OPACITY }]}>
        {Array.from({ length: rows * cols }, (_, i) => (
          <Image
            key={i}
            source={CHAT_PATTERN}
            fadeDuration={0}
            style={[styles.tile, { left: (i % cols) * CHAT_TILE, top: Math.floor(i / cols) * CHAT_TILE }]}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  tile: { position: 'absolute', width: CHAT_TILE, height: CHAT_TILE },
});
