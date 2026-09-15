import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors } from '../theme';

const GLOW_PURPLE = require('../../assets/glow-purple.png');
const GLOW_VIOLET = require('../../assets/glow-violet.png');
const GLOW_PINK = require('../../assets/glow-pink.png');
const GLOW_BLUE = require('../../assets/glow-blue.png');

type Variant = 'blush' | 'signin';

/**
 * Full-screen animated aurora: a soft base gradient with four drifting,
 * breathing colour glows. Native-driven and non-interactive, so drop it behind
 * any screen's content.
 *
 * TWO VARIANTS, because one background was being asked to do two jobs:
 *
 *   'blush'  (default) — the shared canvas behind onboarding, sell and
 *            edit-profile. Unchanged from the original: four saturated glows on
 *            a warm blush base.
 *
 *   'signin' — login only. The same four glows, larger and stronger, on a
 *            deeper three-stop base. A sign-in screen is one card in a lot of
 *            empty space, so it can carry colour that a screen full of form
 *            fields cannot.
 *
 * ⚠ These were briefly collapsed into a single desaturated "calm" version —
 * a cool near-white base with four low-opacity analogous tints. It made every
 * screen look unfinished rather than calm. If a screen needs a different mood,
 * add a variant here; do not retune the shared one.
 */
export function AuroraBackground({ variant = 'blush' }: { variant?: Variant } = {}) {
  return variant === 'signin' ? <SigninAurora /> : <BlushAurora />;
}

/** The shared canvas: onboarding, sell, edit-profile. */
function BlushAurora() {
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[colors.auroraTop, colors.auroraBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.2, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <AuroraBlob
        source={GLOW_PURPLE}
        size={width * 1.05}
        baseOpacity={0.6}
        position={{ top: -height * 0.1, left: -width * 0.32 }}
        amplitude={26}
        duration={12000}
      />
      <AuroraBlob
        source={GLOW_PINK}
        size={width * 0.95}
        baseOpacity={0.55}
        position={{ top: height * 0.02, right: -width * 0.34 }}
        amplitude={30}
        duration={10500}
        delay={400}
      />
      <AuroraBlob
        source={GLOW_VIOLET}
        size={width * 0.85}
        baseOpacity={0.42}
        position={{ top: height * 0.4, left: -width * 0.34 }}
        amplitude={22}
        duration={13500}
        delay={900}
      />
      <AuroraBlob
        source={GLOW_BLUE}
        size={width * 1.1}
        baseOpacity={0.5}
        position={{ bottom: -height * 0.12, right: -width * 0.28 }}
        amplitude={28}
        duration={11500}
        delay={200}
      />
    </View>
  );
}

/**
 * Login only.
 *
 * The composition is built around the card, which sits in the middle of the
 * screen: pink and purple crown it from the top corners, violet pools under it,
 * and a cool blue keeps the bottom from going muddy where two warm hues meet.
 * Everything is bigger and further off-screen than in the blush variant, so
 * what shows is the soft middle of each glow rather than its edge.
 */
function SigninAurora() {
  const { width, height } = useWindowDimensions();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[colors.signinTop, colors.signinMid, colors.signinBottom]}
        // Pale through the top half — see the palette note in src/theme: the
        // headline and tagline are dark text and need the light half, and the
        // contrast numbers there assume this stop position.
        locations={[0, 0.5, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <AuroraBlob
        source={GLOW_PINK}
        size={width * 1.25}
        baseOpacity={0.62}
        position={{ top: -height * 0.16, left: -width * 0.42 }}
        amplitude={28}
        duration={12500}
      />
      <AuroraBlob
        source={GLOW_PURPLE}
        size={width * 1.15}
        baseOpacity={0.5}
        position={{ top: -height * 0.06, right: -width * 0.4 }}
        amplitude={32}
        duration={11000}
        delay={400}
      />
      <AuroraBlob
        source={GLOW_VIOLET}
        size={width * 1.3}
        baseOpacity={0.55}
        position={{ bottom: -height * 0.18, left: -width * 0.36 }}
        amplitude={24}
        duration={14000}
        delay={900}
      />
      <AuroraBlob
        source={GLOW_BLUE}
        size={width * 1.0}
        baseOpacity={0.38}
        position={{ bottom: -height * 0.08, right: -width * 0.34 }}
        amplitude={30}
        duration={12000}
        delay={200}
      />
    </View>
  );
}

function AuroraBlob({
  source,
  size,
  position,
  baseOpacity,
  amplitude = 24,
  duration = 11000,
  delay = 0,
}: {
  source: number;
  size: number;
  position: Record<string, number>;
  baseOpacity: number;
  amplitude?: number;
  duration?: number;
  delay?: number;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration, delay]);

  return (
    <Animated.Image
      source={source}
      style={[
        styles.blob,
        position,
        {
          width: size,
          height: size,
          opacity: t.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [baseOpacity * 0.78, baseOpacity, baseOpacity * 0.78],
          }),
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-amplitude, amplitude] }) },
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [amplitude * 0.6, -amplitude * 0.6] }) },
            { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
  },
});
