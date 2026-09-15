import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors } from '../theme';

// One asset, four tints. The glow PNGs are a flat RGB with a radial alpha
// ramp, so `tintColor` recolours them exactly — which means the palette lives
// in `src/theme`, not in four separate image files.
const GLOW = require('../../assets/glow-purple.png');

/**
 * Full-screen animated aurora: a soft base gradient with four drifting,
 * breathing colour glows. Native-driven and non-interactive, so drop it behind
 * any screen's content. Shared by the login and onboarding screens.
 *
 * The tints are ONE analogous band (violet -> lilac -> periwinkle -> soft sky)
 * at low opacity. The earlier version put saturated purple, pink, violet and
 * blue on a blush base; four unrelated hues at full strength read as a festival
 * backdrop rather than as weather, which is not the tone the sign-in wants.
 */
export function AuroraBackground() {
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
        tint={colors.auroraGlowLilac}
        size={width * 1.15}
        baseOpacity={0.34}
        position={{ top: -height * 0.12, left: -width * 0.34 }}
        amplitude={26}
        duration={12000}
      />
      <AuroraBlob
        tint={colors.auroraGlowPeriwinkle}
        size={width * 1.0}
        baseOpacity={0.28}
        position={{ top: height * 0.04, right: -width * 0.36 }}
        amplitude={30}
        duration={10500}
        delay={400}
      />
      <AuroraBlob
        tint={colors.auroraGlowViolet}
        size={width * 0.9}
        baseOpacity={0.22}
        position={{ top: height * 0.42, left: -width * 0.36 }}
        amplitude={22}
        duration={13500}
        delay={900}
      />
      <AuroraBlob
        tint={colors.auroraGlowSky}
        size={width * 1.2}
        baseOpacity={0.26}
        position={{ bottom: -height * 0.14, right: -width * 0.3 }}
        amplitude={28}
        duration={11500}
        delay={200}
      />
    </View>
  );
}

function AuroraBlob({
  tint,
  size,
  position,
  baseOpacity,
  amplitude = 24,
  duration = 11000,
  delay = 0,
}: {
  tint: string;
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
      source={GLOW}
      // tintColor is a paint-only prop, so it never invalidates the native
      // driver's hold on opacity/transform below.
      tintColor={tint}
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
