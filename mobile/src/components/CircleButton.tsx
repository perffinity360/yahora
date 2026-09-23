import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors } from '../theme';

/**
 * The round icon button that floats over a screen — back, and the product
 * screen's share. One component so every screen's back button looks and
 * presses the same, instead of six hand-copied style blocks drifting apart.
 *
 * ── WHY THE SURFACE IS OPAQUE ──
 * The product screen's button was `glassBorder` (white at 75%) with an Android
 * `elevation`. Android draws an elevation shadow as a filled, polygon-
 * approximated outline BEHIND the view, and a translucent surface lets it show
 * through — that was the white octagon inside the circle. An opaque surface
 * hides it on every device. Do not make this translucent again while it
 * carries an elevation.
 *
 * `style` positions the button (absolute `top`/`left`); it goes on the outer
 * Pressable, the look lives on the inner circle, so a screen can never
 * restyle one button out of step with the rest.
 */

const SPRING = { damping: 15, stiffness: 320, mass: 0.6 };

type Props = {
  icon: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  /** Shows a spinner in place of the icon (onboarding's back while signing out). */
  loading?: boolean;
  /**
   * `floating` (default): 42dp raised white disc, for buttons over content.
   * `plain`: 34dp, no surface until pressed, for a button sitting in a header bar.
   */
  variant?: 'floating' | 'plain';
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
};

export function CircleButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled,
  loading,
  variant = 'floating',
  iconSize = 20,
  style,
  hitSlop = 8,
}: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const floating = variant === 'floating';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.9, SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, SPRING);
      }}
      disabled={disabled || !onPress}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[floating && styles.floatingSlot, style]}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            floating ? styles.floating : styles.plain,
            pressed && (floating ? styles.floatingPressed : styles.plainPressed),
            animated,
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.purpleDark} />
          ) : (
            <Feather name={icon} size={iconSize} color={colors.purpleDark} />
          )}
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Back, everywhere. Same button, same arrow, same press. */
export function BackButton(props: Omit<Props, 'icon' | 'accessibilityLabel'> & { accessibilityLabel?: string }) {
  return <CircleButton icon="arrow-left" accessibilityLabel="Go back" {...props} />;
}

const FLOATING = 42;
const PLAIN = 34;

const styles = StyleSheet.create({
  // Stacking only. Several screens float this over an elevated form card, and
  // on Android a sibling's `elevation` beats render order — the slot needs its
  // own to stay on top. It has no background, so it casts no shadow of its own.
  floatingSlot: {
    zIndex: 20,
    elevation: 8,
  },
  floating: {
    width: FLOATING,
    height: FLOATING,
    borderRadius: FLOATING / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
    shadowColor: colors.purple,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  floatingPressed: {
    backgroundColor: colors.pinkLight,
  },
  plain: {
    width: PLAIN,
    height: PLAIN,
    borderRadius: PLAIN / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainPressed: {
    backgroundColor: colors.pinkLight,
  },
});
