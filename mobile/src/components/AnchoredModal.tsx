import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

/** A box measured with `measureInWindow`. */
export type WindowRect = { x: number; y: number; width: number; height: number };

/**
 * A transparent Modal for something that hangs off a button: the quick bar, the
 * ⋯ menu, the country dropdown. A tap anywhere else closes it.
 *
 * WHY IT MEASURES ITSELF. On Android, `measureInWindow` counts from below the
 * status bar, but a `statusBarTranslucent` Modal starts at the top of the
 * screen. Placing a menu straight from the button's numbers put it one status
 * bar too high: the dropdown and the ⋯ menu covered their own buttons, and the
 * quick bar floated far above React (POCO, 12 Nov). So the Modal's own layer is
 * measured the same way, and `children` gets the button in the layer's
 * coordinates: whatever offset the platform adds cancels out. The chat's
 * long-press menu solves the same problem the same way (`app/chat/[contactId]`).
 *
 * Nothing renders until the layer is measured (one frame), so the entrance
 * animation starts in the right place.
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
  /** `anchor` moved into the layer, and the layer's own size. */
  children: (anchor: WindowRect, layer: { width: number; height: number }) => ReactNode;
}) {
  const layerRef = useRef<ViewInstance>(null);
  const [layer, setLayer] = useState<WindowRect | null>(null);

  const measure = useCallback(() => {
    layerRef.current?.measureInWindow((x, y, width, height) => setLayer({ x, y, width, height }));
  }, []);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View ref={layerRef} collapsable={false} style={StyleSheet.absoluteFill} onLayout={measure}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={closeLabel} />
        {layer
          ? children(
              { x: anchor.x - layer.x, y: anchor.y - layer.y, width: anchor.width, height: anchor.height },
              { width: layer.width, height: layer.height },
            )
          : null}
      </View>
    </Modal>
  );
}
