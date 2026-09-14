import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Keeps its children clear of the on-screen keyboard, in both Android window
 * modes.
 *
 * Why not just `KeyboardAvoidingView`:
 *
 * Android 15 draws every app edge to edge, and an edge-to-edge window no longer
 * honours `adjustResize` — the window keeps its full height and the keyboard
 * arrives as a window *inset* instead. On a phone in full-screen / gesture mode
 * that left the login card laid out at full height with the keyboard parked on
 * top of it: the email row was hidden, and because the card fits the screen
 * exactly there was no overflow for the ScrollView to scroll, so it could not
 * be reached at all. Phones still on three-button navigation resize the window
 * as before and never showed the bug — which is why it only reproduced "in full
 * screen mode".
 *
 * `KeyboardAvoidingView` derives the overlap from the keyboard's reported
 * `screenY`, which comes from the window's *visible display frame* — the one
 * thing an edge-to-edge window does not shrink. So on Android the overlap is
 * measured here from two readings that are dependable in both modes:
 *
 *   - how tall the keyboard is, which Android takes straight off the IME inset,
 *     and
 *   - where this view's bottom edge actually is, via `measureInWindow`.
 *
 * Overlap is then just "how far the keyboard reaches past my bottom edge". If
 * the window did resize, this view has already lost that height and the answer
 * is zero, so nothing is added twice. It also means the component does not care
 * whether it sits inside or outside a `SafeAreaView` — it measures where it
 * really is rather than assuming.
 *
 * iOS never resizes the window and `KeyboardAvoidingView` is already correct
 * there (it accounts for the home indicator), so iOS keeps using it.
 */
export function KeyboardAvoider({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [overlap, setOverlap] = useState(0);

  const viewRef = useRef<View>(null);
  // Refs, not state: these are inputs to the calculation and each lands on its
  // own native event. Only the result is allowed to cause a render.
  /** How far the keyboard reaches up from the bottom of the window. */
  const keyboardInset = useRef(0);
  /** How far this view's bottom edge sits above the bottom of the window. */
  const gapBelow = useRef(0);

  const recompute = useCallback(() => {
    setOverlap(
      keyboardInset.current === 0
        ? 0
        : Math.max(keyboardInset.current - gapBelow.current, 0),
    );
  }, []);

  // Measured, not derived from onLayout: onLayout reports a frame relative to
  // the parent, and this view can be nested at any depth.
  const measure = useCallback(() => {
    const node = viewRef.current;
    if (!node) return;
    node.measureInWindow((_x, y, _w, height) => {
      if (!Number.isFinite(y) || !Number.isFinite(height)) return;
      gapBelow.current = Math.max(windowHeight - (y + height), 0);
      recompute();
    });
  }, [windowHeight, recompute]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const shown = Keyboard.addListener('keyboardDidShow', (e) => {
      // Android reports the IME height with the system-bar inset already taken
      // off; add it back so this is the distance from the window's bottom edge,
      // which is what `gapBelow` is measured against.
      keyboardInset.current = e.endCoordinates.height + insets.bottom;
      measure();
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      keyboardInset.current = 0;
      recompute();
    });
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [insets.bottom, measure, recompute]);

  if (Platform.OS !== 'android') {
    return (
      <KeyboardAvoidingView style={style} behavior="padding">
        {children}
      </KeyboardAvoidingView>
    );
  }

  return (
    // Padding is applied inside this view's own frame, so measuring again after
    // it lands returns the same edge — there is no layout feedback loop.
    <View
      ref={viewRef}
      style={[style, overlap > 0 && { paddingBottom: overlap }]}
      onLayout={measure}
    >
      {children}
    </View>
  );
}

export default KeyboardAvoider;
