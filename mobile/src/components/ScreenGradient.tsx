import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors } from '../theme';

/** Flat RGB with a radial alpha ramp, so `tintColor` recolours it exactly. */
const GLOW = require('../../assets/glow-purple.png');

type Variant = 'app' | 'inbox' | 'chat';

/**
 * The background behind every non-auth screen. Three variants:
 *
 *   'app'   (default) — marketplace, dashboard, product detail, public profile.
 *                       A pink-to-lilac wash.
 *   'inbox'           — the Messages list. Ported from the web's
 *                       `.inboxSidebar`.
 *   'chat'            — inside a conversation. Ported from the web's
 *                       `.messagesContainer`.
 *
 * The two messages variants exist because the app and the website were drawing
 * the same screen on different grounds — the app on its generic canvas, the web
 * on a lavender one built for chat. Same product, two looks. The values come
 * from `frontend/src/pages/messages/Messages.module.css`; that file is the
 * source of truth and these follow it.
 *
 * ON LIGHT AND VISIBLE, for the 'app' variant. Those pull against each other
 * only if you reach for lightness. The stops are highly saturated pastels at
 * ~95-97% lightness: plainly tinted, but still bright enough for body text. The
 * palette note in src/theme has the measured contrast and says which knob to
 * turn.
 *
 * WHY NOT `AuroraBackground`. The aurora animates four full-screen glow images
 * forever. Behind a login card that is the point; behind a scrolling list it is
 * four large layers recompositing under every frame of a fling, on phones
 * DESIGN.md asks to hold 60fps. Nothing here animates — the glows below are
 * static images with a fixed opacity, drawn once.
 *
 * Drop it as the first child of a screen's root `View`, with the root carrying
 * the variant's own end colour so an overscroll shows the same thing:
 *
 *   <View style={styles.root}>
 *     <ScreenGradient variant="chat" />
 *     <SafeAreaView …>…</SafeAreaView>
 *   </View>
 *
 * It is `pointerEvents="none"`, so it never takes a touch from the screen.
 */
export function ScreenGradient({ variant = 'app' }: { variant?: Variant } = {}) {
  if (variant === 'inbox') return <InboxCanvas />;
  if (variant === 'chat') return <ChatCanvas />;

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

/**
 * The Messages list. Web: `.inboxSidebar` —
 * `linear-gradient(170deg, #fdf8ff, #f8f0ff 45%, #fff4f9)` plus a magenta glow
 * off the top-right corner and a pink one off the bottom-left.
 *
 * 170deg in CSS is 10deg short of straight down, which is the `end.x` below.
 */
function InboxCanvas() {
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[colors.inboxTop, colors.inboxMid, colors.inboxBottom]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.17, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Glow
        tint={colors.purpleLight}
        opacity={0.13}
        size={width * 0.75}
        position={{ top: -height * 0.06, right: -width * 0.22 }}
      />
      <Glow
        tint={colors.pinkDark}
        opacity={0.11}
        size={width * 0.62}
        position={{ bottom: -height * 0.04, left: -width * 0.18 }}
      />
    </View>
  );
}

/**
 * Inside a conversation. Web: `.messagesContainer` — a lavender ground with a
 * purple glow near the top-left and a blue one near the bottom-right.
 *
 * Deeper than every other canvas in the app on purpose: the bubbles are what
 * should read as raised, and they cannot lift off a near-white ground. The
 * header and the composer draw their own opaque surfaces over this, so what
 * shows is exactly the thread area, as on the web.
 */
function ChatCanvas() {
  const { width, height } = useWindowDimensions();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.chatCanvas }]} pointerEvents="none">
      <Glow
        tint={colors.purple}
        opacity={0.1}
        size={width * 0.95}
        position={{ top: -height * 0.05, left: -width * 0.3 }}
      />
      <Glow
        tint={colors.blue}
        opacity={0.09}
        size={width * 0.85}
        position={{ bottom: -height * 0.06, right: -width * 0.26 }}
      />
    </View>
  );
}

/** One static, non-interactive radial glow. No animation, no state. */
function Glow({
  tint,
  opacity,
  size,
  position,
}: {
  tint: string;
  opacity: number;
  size: number;
  position: Record<string, number>;
}) {
  return (
    <Image
      source={GLOW}
      tintColor={tint}
      style={[styles.glow, position, { width: size, height: size, opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
});

export default ScreenGradient;
