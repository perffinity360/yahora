import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * Safe-area insets measured INSIDE a Modal, ready before the first frame.
 *
 * A Modal is its own window on Android. `useSafeAreaInsets()` there returns
 * the screen's insets from outside it, which left the reaction breakdown's
 * pills under the POCO's three-button bar (13 Nov). Padding with the native
 * `SafeAreaView` fixed that, but its padding arrives a frame after the first
 * layout, so the sheet changed height while it rose: a jump.
 *
 * This provider measures the Modal's own window. The `null` around it hides the
 * outer insets, so it doesn't start from them and correct itself a frame later:
 * it renders its children only once the real insets are known. Inside it,
 * `useSafeAreaInsets()` is right from the first render.
 */
export function ModalSafeArea({ children }: { children: ReactNode }) {
  return (
    <SafeAreaInsetsContext.Provider value={null}>
      <SafeAreaProvider style={StyleSheet.absoluteFill}>{children}</SafeAreaProvider>
    </SafeAreaInsetsContext.Provider>
  );
}
