import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * A solid strip behind the phone's status bar, in the feed's own ground colour.
 * The community screens draw edge to edge, and posts used to scroll up under
 * the clock and the notification icons (POCO, 12 Nov). Instagram, X and
 * WhatsApp all keep that strip solid. Render it after the list, so it sits on
 * top: a post leaving the top of the screen now goes under the strip.
 */
export function StatusBarGround({ color }: { color: string }) {
  const insets = useSafeAreaInsets();
  if (!insets.top) return null;
  return <View pointerEvents="none" style={[styles.ground, { height: insets.top, backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  ground: { position: 'absolute', top: 0, left: 0, right: 0 },
});
