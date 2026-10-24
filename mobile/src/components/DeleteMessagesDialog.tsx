import Feather from '@expo/vector-icons/Feather';
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
  /** The contact's first name, for "<name> will still see it". */
  contactName: string;
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
 * dialog: title in Bree Serif, the choices stacked full width, the strongest
 * one first. "Delete for everyone" is solid red; "Delete for me" is solid red
 * when it is the only choice, and the softer red otherwise.
 */
export function DeleteMessagesDialog({
  visible,
  count,
  canDeleteForEveryone,
  contactName,
  onCancel,
  onDeleteForMe,
  onDeleteForEveryone,
}: DeleteMessagesDialogProps) {
  // While it fades out the screen has already cleared what it was for; keep
  // showing the words it opened with.
  const shownRef = useRef({ count, canDeleteForEveryone });
  if (visible) shownRef.current = { count, canDeleteForEveryone };
  const shown = shownRef.current;
  const many = shown.count > 1;
  const title = many ? `Delete ${shown.count} messages?` : 'Delete message?';
  const body = shown.canDeleteForEveryone
    ? `Delete ${many ? 'them' : 'it'} for everyone in this chat, or only for you?`
    : many
      ? `They will be removed from this chat for you. ${contactName} will still see them.`
      : `It will be removed from this chat for you. ${contactName} will still see it.`;

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
          <View style={styles.iconCircle}>
            <Feather name="trash-2" size={22} color={colors.errorText} />
          </View>
          <AppText style={styles.title}>{title}</AppText>
          <AppText style={styles.body}>{body}</AppText>

          <View style={styles.actions}>
            {shown.canDeleteForEveryone ? (
              <DialogButton label="Delete for everyone" tone="solid" onPress={onDeleteForEveryone} />
            ) : null}
            <DialogButton
              label="Delete for me"
              tone={shown.canDeleteForEveryone ? 'soft' : 'solid'}
              onPress={onDeleteForMe}
            />
            <DialogButton label="Cancel" tone="plain" onPress={onCancel} />
          </View>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

function DialogButton({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: 'solid' | 'soft' | 'plain';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        tone === 'solid' && styles.buttonSolid,
        tone === 'soft' && styles.buttonSoft,
        pressed && (tone === 'plain' ? styles.buttonPlainPressed : styles.buttonPressed),
      ]}
    >
      <AppText
        style={[
          styles.buttonText,
          tone === 'solid' && styles.buttonTextSolid,
          tone === 'soft' && styles.buttonTextSoft,
        ]}
      >
        {label}
      </AppText>
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
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderRadius: 24,
    backgroundColor: colors.white,
    shadowColor: colors.chatMenuShadow,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorBg,
  },
  title: {
    marginTop: 14,
    fontFamily: font.family.serif,
    fontSize: 20,
    lineHeight: 26,
    color: colors.blackSoft,
    textAlign: 'center',
  },
  body: {
    marginTop: 6,
    fontFamily: font.family.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedText,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 20,
  },
  button: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonSolid: { backgroundColor: colors.errorText },
  buttonSoft: { backgroundColor: colors.errorBg },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  buttonPlainPressed: { backgroundColor: colors.inboxRowPressed },
  buttonText: {
    fontFamily: font.family.semibold,
    fontSize: 15,
    color: colors.mutedText,
  },
  buttonTextSolid: { color: colors.white },
  buttonTextSoft: { color: colors.errorText },
});
