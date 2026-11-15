import { useEffect } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAvoider } from '../KeyboardAvoider';
import { ModalSafeArea } from '../ModalSafeArea';
import { EmojiGrid } from './EmojiGrid';
import { SHEET_RISE } from '../../lib/motion';
import { colors } from '../../theme';

/**
 * The full emoji picker (⊕) — COMMUNITY_SPEC.md §5.2, in two forms, both the
 * same `EmojiGrid` (one scrolling list, the website's behaviour):
 *
 *   · `EmojiPanel`: laid in the screen where the keyboard was, for writing.
 *     The compose screen's ☺ (owner, 15 Nov, "as the emoji picker behaves in
 *     WhatsApp"): no backdrop, so the text stays bright and can be tapped to
 *     bring the keyboard back.
 *   · `EmojiPickerSheet`: a bottom sheet over a light scrim, for a reaction.
 *     Open it only after any other overlay has closed (the quick bar, the
 *     breakdown): two Modals at once misbehave on Android.
 */

/**
 * `height` is the keyboard's (the caller makes sure it fits four rows), so
 * swapping one for the other doesn't move the toolbar; `bottomInset` keeps
 * the grid clear of the navigation bar.
 */
export function EmojiPanel({
  height,
  bottomInset,
  onPick,
}: {
  height: number;
  bottomInset: number;
  onPick: (emoji: string) => void;
}) {
  return (
    <View style={[styles.panel, { height, paddingBottom: bottomInset }]}>
      <EmojiGrid onPick={onPick} />
    </View>
  );
}

export function EmojiPickerSheet({
  open,
  current,
  onPick,
  onClose,
}: {
  open: boolean;
  /** Your current reaction, marked in the grid. */
  current: string | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <ModalSafeArea>
        {/* The search box raises the keyboard: the sheet rides up on it. */}
        <KeyboardAvoider style={styles.root} fillsModal>
          <Sheet current={current} onPick={onPick} onClose={onClose} />
        </KeyboardAvoider>
      </ModalSafeArea>
    </Modal>
  );
}

/** Rises on its own clock with the scrim (DESIGN.md "Motion", SHEET_RISE). */
function Sheet({
  current,
  onPick,
  onClose,
}: {
  current: string | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(reduceMotion ? 1 : 0);
  const sheetHeight = useSharedValue(Dimensions.get('screen').height);
  useEffect(() => {
    if (!reduceMotion) shown.value = withTiming(1, SHEET_RISE);
  }, [reduceMotion, shown]);
  const riseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - shown.value) * sheetHeight.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: shown.value }));

  return (
    <>
      <Reanimated.View style={[styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Reanimated.View>
      <Reanimated.View
        onLayout={(e) => {
          sheetHeight.value = e.nativeEvent.layout.height;
        }}
        style={[
          styles.sheet,
          { height: Math.round(windowHeight * 0.6), paddingBottom: insets.bottom },
          riseStyle,
        ]}
      >
        <View style={styles.handle} />
        <EmojiGrid onPick={onPick} current={current} />
      </Reanimated.View>
    </>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: colors.white },
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.sheetScrimLight },
  sheet: {
    paddingTop: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
    backgroundColor: colors.sheetHandle,
  },
});
