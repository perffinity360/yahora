import { useRef } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Reanimated, { Easing, Keyframe } from 'react-native-reanimated';

import { AppText } from './AppText';
import { colors, font } from '../theme';

interface DeleteMessagesDialogProps {
  visible: boolean;
  /** How many messages are being deleted (1 or more). */
  count: number;
  /** Offer "Delete for everyone": every one of them is mine, not deleted, under the hour (§10.8). */
  canDeleteForEveryone: boolean;
  onCancel: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
}

const CARD_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.92 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(200);

/**
 * The delete confirmation (MESSAGES_SPEC.md §10.8), drawn by the app instead of
 * the phone's Alert, so it looks the same on every phone and like the website's
 * dialog. WhatsApp's layout (owner's call, 24 Oct): the title on the left, no
 * explanation under it (the choices say it), and the choices as text buttons
 * stacked on the right, the strongest one first. The two deletes are red,
 * Cancel is purple.
 */
export function DeleteMessagesDialog({
  visible,
  count,
  canDeleteForEveryone,
  onCancel,
  onDeleteForMe,
  onDeleteForEveryone,
}: DeleteMessagesDialogProps) {
  // While it fades out the screen has already cleared what it was for; keep
  // showing the words it opened with.
  const shownRef = useRef({ count, canDeleteForEveryone });
  if (visible) shownRef.current = { count, canDeleteForEveryone };
  const shown = shownRef.current;
  const title = shown.count > 1 ? `Delete ${shown.count} messages?` : 'Delete message?';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onCancel} accessibilityLabel="Cancel" />
        <Reanimated.View
          entering={CARD_ENTER}
          style={styles.card}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <AppText style={styles.title}>{title}</AppText>

          <View style={styles.actions}>
            {shown.canDeleteForEveryone ? (
              <DialogButton label="Delete for everyone" danger onPress={onDeleteForEveryone} />
            ) : null}
            <DialogButton label="Delete for me" danger onPress={onDeleteForMe} />
            <DialogButton label="Cancel" onPress={onCancel} />
          </View>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

function DialogButton({
  label,
  danger = false,
  onPress,
}: {
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        pressed && (danger ? styles.buttonDangerPressed : styles.buttonPressed),
      ]}
    >
      <AppText style={[styles.buttonText, danger && styles.buttonTextDanger]}>{label}</AppText>
    </Pressable>
  );
}

export default DeleteMessagesDialog;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 12,
    borderRadius: 24,
    backgroundColor: colors.white,
    shadowColor: colors.chatMenuShadow,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  title: {
    fontFamily: font.family.serif,
    fontSize: 20,
    lineHeight: 26,
    color: colors.blackSoft,
  },
  // Right-aligned, each button only as wide as its label.
  actions: {
    alignItems: 'flex-end',
    gap: 4,
    marginTop: 18,
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginRight: -12, // the label, not the press area, lines up with the title's padding
    borderRadius: 12,
  },
  buttonPressed: { backgroundColor: colors.inboxRowPressed },
  buttonDangerPressed: { backgroundColor: colors.errorBg },
  buttonText: {
    fontFamily: font.family.semibold,
    fontSize: 15,
    color: colors.purple,
  },
  buttonTextDanger: { color: colors.errorText },
});
