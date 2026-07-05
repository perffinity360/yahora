import Feather from '@expo/vector-icons/Feather';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, spacing } from '../theme';

interface AvatarSheetProps {
  visible: boolean;
  /** Only offer "Remove Photo" when there is a photo to remove. */
  hasAvatar: boolean;
  onChangePhoto: () => void;
  onRemovePhoto: () => void;
  onClose: () => void;
}

/** On-brand bottom sheet for managing the profile photo. */
export function AvatarSheet({
  visible,
  hasAvatar,
  onChangePhoto,
  onRemovePhoto,
  onClose,
}: AvatarSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Profile photo</Text>

          <Pressable
            onPress={onChangePhoto}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowIcon}>
              <Feather name="image" size={18} color={colors.purple} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Change Photo</Text>
              <Text style={styles.rowSub}>Pick a new one from your library</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedLabel} />
          </Pressable>

          {hasAvatar ? (
            <Pressable
              onPress={onRemovePhoto}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={[styles.rowIcon, styles.rowIconDanger]}>
                <Feather name="trash-2" size={18} color={colors.errorText} />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, styles.rowTitleDanger]}>Remove Photo</Text>
                <Text style={styles.rowSub}>Go back to the default avatar</Text>
              </View>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default AvatarSheet;

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
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.cardSurface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.mutedPlaceholder,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: font.family.serif,
    fontSize: 19,
    color: colors.blackSoft,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.cardSurface,
    marginBottom: spacing.sm,
  },
  rowPressed: {
    backgroundColor: colors.pinkLight,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  rowIconDanger: {
    backgroundColor: colors.errorBg,
    borderColor: colors.errorBg,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: font.family.semibold,
    fontSize: 14.5,
    color: colors.blackSoft,
  },
  rowTitleDanger: {
    color: colors.errorText,
  },
  rowSub: {
    fontFamily: font.family.regular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 1,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.inputBg,
    marginTop: spacing.xs,
  },
  cancelBtnPressed: {
    backgroundColor: colors.pinkBg,
  },
  cancelText: {
    fontFamily: font.family.semibold,
    fontSize: 14,
    color: colors.blackSoft,
  },
});
