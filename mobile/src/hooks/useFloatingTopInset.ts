import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme';

/**
 * Top offset for a screen's floating, absolutely-positioned controls (the back
 * chip, the share chip).
 *
 * Why this is needed even inside a `<SafeAreaView edges={['top', …]}>`:
 * `SafeAreaView` applies the inset as *padding*, and an absolutely positioned
 * child is laid out against its parent's padding box (the CSS rule, which Yoga
 * follows in RN 0.74+) — so it sits at `top` from the very edge of the parent
 * and the padding does nothing for it.
 *
 * With three-button navigation the app window starts below the status bar, so
 * `insets.top` is 0 and nobody noticed. Put the phone in full-screen / gesture
 * mode and the window goes edge to edge: `insets.top` becomes the status-bar
 * height, every laid-out child moves down, and the floating chip stays behind
 * — landing on top of the clock and the notification icons.
 *
 * Adding the inset back explicitly fixes both modes at once: it is a no-op when
 * `insets.top` is 0, and clears the status bar when it isn't.
 */
export function useFloatingTopInset(extra: number = spacing.sm) {
  const insets = useSafeAreaInsets();
  return insets.top + extra;
}
