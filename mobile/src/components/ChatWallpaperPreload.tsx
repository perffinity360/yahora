import { Image, StyleSheet, View } from 'react-native';

/** Seamless 420×420 doodle tile; copies of docs/design/assets/. Never edit the PNGs. */
export const CHAT_PATTERN = require('../../assets/chat-pattern.png');
/** The tile's size in dp — the web tiles the same artwork at 420 px. */
export const CHAT_TILE = 420;

/**
 * Loads the chat wallpaper when the app starts, so the first chat opened
 * draws it in the same frame as its bubbles instead of waiting for the
 * picture to be read and decoded (26 Oct).
 *
 * One tile, mounted for the app's life inside a zero-size box: never seen,
 * but attached, so the image loader decodes it and keeps the bitmap in memory
 * (about 0.7 MB). It must match a real tile: same source and same 420×420 size.
 * On Android the decoded-image cache is keyed by the address, and also by the
 * view's size when the picture is a local file (an over-the-air update's
 * assets), so a tile of any other size would be a cache miss.
 */
export function ChatWallpaperPreload() {
  return (
    <View
      style={styles.box}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={CHAT_PATTERN} fadeDuration={0} style={styles.tile} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', width: 0, height: 0, overflow: 'hidden' },
  tile: { width: CHAT_TILE, height: CHAT_TILE },
});
