import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { colors } from '../theme';

type Variant = 'app';

/**
 * The background behind every non-auth screen: marketplace, dashboard, product
 * detail, public profile and the Messages inbox. A pink-to-lilac wash.
 *
 * One variant since Phase 6A V-C. The inbox used to have its own paler ramp
 * and the conversation its own glows; MESSAGES_SPEC.md §1 moved the inbox onto
 * this canvas, and the conversation now draws its ground and wallpaper itself
 * (app/chat/[contactId].tsx). The `variant` prop stays so a call site can say
 * which canvas it means.
 *
 * ON LIGHT AND VISIBLE. Those pull against each other only if you reach for
 * lightness. The stops are highly saturated pastels at ~95-97% lightness:
 * plainly tinted, but still bright enough for body text. The palette note in
 * src/theme has the measured contrast and says which knob to turn.
 *
 * WHY NOT `AuroraBackground`. The aurora animates four full-screen glow images
 * forever. Behind a login card that is the point; behind a scrolling list it is
 * four large layers recompositing under every frame of a fling, on phones
 * DESIGN.md asks to hold 60fps. Nothing here animates.
 *
 * Drop it as the first child of a screen's root `View`, with the root carrying
 * `colors.appBgBottom` so an overscroll shows the same thing:
 *
 *   <View style={styles.root}>
 *     <ScreenGradient />
 *     <SafeAreaView …>…</SafeAreaView>
 *   </View>
 *
 * It is `pointerEvents="none"`, so it never takes a touch from the screen.
 */
export function ScreenGradient(_props: { variant?: Variant } = {}) {
  return (
    <LinearGradient
      colors={[colors.appBgTop, colors.appBgMid, colors.appBgBottom]}
      // Evenly spaced: the mid stop is the pink-to-lilac handover, and putting
      // it anywhere but the middle makes one half of the screen look flat.
      locations={[0, 0.5, 1]}
      // Slightly off-vertical, matching the blush aurora's own angle, so the
      // two canvases look like one family when you move between screens.
      start={{ x: 0, y: 0 }}
      end={{ x: 0.2, y: 1 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}

export default ScreenGradient;
