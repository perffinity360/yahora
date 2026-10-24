import Feather from '@expo/vector-icons/Feather';
import { useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Reanimated, { Easing, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './AppText';
import { colors, font } from '../theme';

export type MessageAction = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  /** Delete: icon and label in errorText (spec §10.2). */
  danger?: boolean;
};

interface MessageActionSheetProps {
  visible: boolean;
  /** In the order shown (spec §10.1). */
  actions: MessageAction[];
  onClose: () => void;
  /**
   * Called with the chosen key once the sheet has gone. The sheet closes itself
   * (through onClose) first: an Alert opened while an iOS modal is still
   * dismissing never shows.
   */
  onSelect: (key: string) => void;
}

/** As AvatarSheet: the Modal shows at once and only the sheet rises; the scrim does not move. */
const SHEET_ENTER = SlideInDown.duration(280).easing(Easing.out(Easing.cubic));

/** Spec §10.2: padding 12 at the bottom, or the home-indicator inset if larger. */
const SHEET_BOTTOM = 12;

/**
 * MESSAGES_SPEC.md §10.2 "Mobile sheet": Reply · Copy · Delete for a long-pressed
 * message. Tapping the scrim or the Android back button closes it.
 */
export function MessageActionSheet({ visible, actions, onClose, onSelect }: MessageActionSheetProps) {
  const insets = useSafeAreaInsets();
  const chosenRef = useRef<string | null>(null);

  const fireChosen = () => {
    const key = chosenRef.current;
    chosenRef.current = null;
    if (key) onSelect(key);
  };

  const choose = (key: string) => {
    chosenRef.current = key;
    onClose();
    // Modal's onDismiss exists on iOS only. Android's Alert opens over a
    // closing Modal without trouble, so it goes now.
    if (Platform.OS !== 'ios') fireChosen();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onDismiss={fireChosen}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />

        <Reanimated.View
          entering={SHEET_ENTER}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SHEET_BOTTOM) }]}
        >
          <View style={styles.handle} />
          {actions.map((action) => {
            const tint = action.danger ? colors.errorText : colors.mutedText;
            return (
              <Pressable
                key={action.key}
                onPress={() => choose(action.key)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <Feather name={action.icon} size={20} color={tint} />
                <AppText style={[styles.label, action.danger && styles.labelDanger]}>
                  {action.label}
                </AppText>
              </Pressable>
            );
          })}
        </Reanimated.View>
      </View>
    </Modal>
  );
}

export default MessageActionSheet;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.chatScrim,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sheetHandle,
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 52,
    paddingHorizontal: 20,
  },
  itemPressed: { backgroundColor: colors.inboxRowPressed },
  label: {
    fontFamily: font.family.medium,
    fontSize: 15,
    color: colors.blackSoft,
  },
  labelDanger: { color: colors.errorText },
});
