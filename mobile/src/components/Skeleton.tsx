import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

import { colors, radius } from '../theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A single shimmering placeholder block. Compose several to sketch a loading
 * screen. Uses the native-driven `Animated` (Reanimated is unconfigured here).
 */
export function Skeleton({ width = '100%', height = 16, rounded = radius.sm, style }: SkeletonProps) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: rounded, backgroundColor: colors.hairline, opacity: pulse }, style]}
    />
  );
}
