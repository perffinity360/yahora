import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { colors } from '../theme';

/**
 * The pink-to-lilac wash behind the main app screens — marketplace, messages,
 * dashboard, chat, product detail, public profile.
 *
 * Those screens were flat `colors.bg` (#F8F9FB), a cool near-white that reads
 * as "no background chosen" next to the blush aurora on login, onboarding and
 * sell. This puts them in the same family without competing with the cards,
 * which are near-white themselves.
 *
 * It has to be light AND visible, and those pull in opposite directions only if
 * you reach for lightness. The stops are highly saturated pastels at ~95-97%
 * lightness: plainly tinted, but still bright enough for body text. The palette
 * note in src/theme has the measured contrast and says which knob to turn.
 *
 * WHY NOT `AuroraBackground`. The aurora animates four full-screen glow images
 * forever. Behind a login card that is the point; behind a scrolling FlashList
 * it is four large composited layers redrawing under every frame of a fling,
 * on phones DESIGN.md asks to hold 60fps. This is one static gradient: no
 * images, no timers, no state.
 *
 * Drop it as the first child of a screen's root `View`, with the root carrying
 * `backgroundColor: colors.appBgBottom` so an overscroll shows the same colour:
 *
 *   <View style={styles.root}>
 *     <ScreenGradient />
 *     <SafeAreaView …>…</SafeAreaView>
 *   </View>
 *
 * It is `pointerEvents="none"`, so it never takes a touch from the screen.
 */
export function ScreenGradient() {
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
