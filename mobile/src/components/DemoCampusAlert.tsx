import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, spacing } from '../theme';

const BRAND = [colors.purple, colors.pinkDark] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSignUp: () => void;
}

/** Shown when a demo user tries to leave the sandbox campus (4-iv). */
export function DemoCampusAlert({ visible, onClose, onSignUp }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.card}>
          <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconWrap}>
            <Feather name="globe" size={26} color={colors.white} />
          </LinearGradient>
          <Text style={styles.title}>Unlock All Campuses</Text>
          <Text style={styles.text}>Create a free account to browse every campus on Yahora.</Text>
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.cancelBtn, pressed && styles.cancelBtnPressed]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onSignUp} style={({ pressed }) => [styles.signUpBtn, pressed && styles.signUpBtnPressed]}>
              <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.signUpGradient}>
                <Text style={styles.signUpText}>Sign up</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.cardSurface,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: font.family.serif,
    fontSize: 22,
    color: colors.purpleDark,
    textAlign: 'center',
  },
  text: {
    fontFamily: font.family.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.inputBorderFocus,
    backgroundColor: colors.cardSurface,
  },
  cancelBtnPressed: {
    backgroundColor: colors.pinkLight,
  },
  cancelText: {
    fontFamily: font.family.semibold,
    fontSize: 15,
    color: colors.purpleDark,
  },
  signUpBtn: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  signUpBtnPressed: {
    opacity: 0.9,
  },
  signUpGradient: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpText: {
    fontFamily: font.family.semibold,
    fontSize: 15,
    color: colors.white,
  },
});
