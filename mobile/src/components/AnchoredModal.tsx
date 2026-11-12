import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

/** A box measured with `measureInWindow`. */
export type WindowRect = { x: number; y: number; width: number; height: number };

/*
 * WHY THERE IS A MARKER AT THE APP'S ROOT.
 *
 * On Android, `measureInWindow` reports a view one status bar higher than it
 * is drawn (it counts from below the status bar), but a `statusBarTranslucent`
 * Modal draws from the very top of the screen. Placing a menu straight from a
 * button's numbers put it ~40 dp too high on the POCO: the country dropdown and
 * the ⋯ menu covered their own buttons, and the quick bar floated far above
 * React (12 Nov).
 *
 * Measuring the Modal's own layer did NOT fix it (13 Nov): inside the Modal the
 * layer measures 0, with no offset to cancel. What does: measure a view that
 * fills the app's root, in the SAME tree as the button. It is drawn at the
 * screen's top (the app is edge to edge), so it gets the same offset as the
 * button, and `button − root` is the button's true place on screen, which is
 * where the Modal draws. On iOS both offsets are 0 and nothing changes.
 */
let rootMarker: ViewInstance | null = null;

/** Rendered once, filling the app's root (`app/_layout.tsx`). Touch-transparent. */
export function WindowOriginMarker() {
  return (
    <View
      ref={(node) => {
        rootMarker = node;
      }}
      collapsable={false}
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    />
  );
}

function measureRoot(done: (x: number, y: number) => void) {
  if (!rootMarker) done(0, 0);
  else rootMarker.measureInWindow((x, y) => done(x, y));
}

/**
 * A transparent Modal for something that hangs off a button: the quick bar, the
 * ⋯ menu, the country dropdown. A tap anywhere else closes it. `children` gets
 * the button in the Modal's own coordinates, and the Modal's size.
 *
 * Nothing renders until both are known (a frame), so the entrance animation
 * starts in the right place.
 */
export function AnchoredModal({
  anchor,
  onClose,
  closeLabel = 'Close',
  children,
}: {
  /** The button, straight from its `measureInWindow`. */
  anchor: WindowRect;
  onClose: () => void;
  closeLabel?: string;
  children: (anchor: WindowRect, layer: { width: number; height: number }) => ReactNode;
}) {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    measureRoot((x, y) => setOrigin({ x, y }));
  }, []);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={closeLabel} />
        {origin && size
          ? children(
              { x: anchor.x - origin.x, y: anchor.y - origin.y, width: anchor.width, height: anchor.height },
              size,
            )
          : null}
      </View>
    </Modal>
  );
}
