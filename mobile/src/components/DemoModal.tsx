import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { colors, font, radius, spacing } from '../theme';

// TODO: replace with the real recorded-demo video URL when available.
const DEMO_VIDEO_URL = 'https://www.youtube.com/watch?v=YOUR_YOUTUBE_LINK';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSandboxPreview: () => Promise<void> | void;
}

export function DemoModal({ visible, onClose, onSandboxPreview }: Props) {
  const [sandboxBusy, setSandboxBusy] = useState(false);

  const handleSandbox = async () => {
    setSandboxBusy(true);
    try {
      await onSandboxPreview();
    } finally {
      setSandboxBusy(false);
    }
  };

  const handleRecorded = async () => {
    try {
      const can = await Linking.canOpenURL(DEMO_VIDEO_URL);
      if (!can) throw new Error('cannot open');
      await Linking.openURL(DEMO_VIDEO_URL);
    } catch {
      Alert.alert('Could not open video', 'Please try again later.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
          >
            <Text style={styles.closeBtnText}>×</Text>
          </Pressable>

          <Text style={styles.title}>Choose Demo Experience</Text>

          <Pressable
            onPress={handleSandbox}
            disabled={sandboxBusy}
            style={({ pressed }) => [
              styles.option,
              styles.optionPurple,
              pressed && styles.optionPurplePressed,
            ]}
          >
            <View style={styles.optionTitleRow}>
              <View style={[styles.iconDot, styles.iconDotPurple]} />
              <Text style={[styles.optionTitle, styles.optionTitlePurple]}>
                {sandboxBusy ? 'Creating Sandbox…' : 'Sandbox Preview'}
              </Text>
              {sandboxBusy ? (
                <ActivityIndicator
                  color={colors.purpleDark}
                  style={styles.optionSpinner}
                />
              ) : null}
            </View>
            <Text style={styles.optionSubtext}>Limited Access · Live Environment</Text>
          </Pressable>

          <Pressable
            onPress={handleRecorded}
            style={({ pressed }) => [
              styles.option,
              styles.optionPink,
              pressed && styles.optionPinkPressed,
            ]}
          >
            <View style={styles.optionTitleRow}>
              <View style={[styles.iconDot, styles.iconDotPink]} />
              <Text style={[styles.optionTitle, styles.optionTitlePink]}>
                Recorded Demo
              </Text>
            </View>
            <Text style={styles.optionSubtext}>Full Walkthrough · Actual Recording</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacing.xl,
    gap: spacing.sm,
    shadowColor: colors.black,
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    backgroundColor: colors.pinkLight,
  },
  closeBtnText: {
    fontSize: 22,
    lineHeight: Platform.OS === 'ios' ? 24 : 26,
    color: colors.mutedText,
  },
  title: {
    fontFamily: font.family.serif,
    fontSize: font.sizes.lg + 2,
    color: colors.black,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  option: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  optionPurple: {
    backgroundColor: colors.demoCardPurpleBg,
    borderColor: 'rgba(128, 0, 128, 0.1)',
  },
  optionPurplePressed: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  optionPink: {
    backgroundColor: colors.demoCardPinkBg,
    borderColor: 'rgba(255, 120, 166, 0.1)',
  },
  optionPinkPressed: {
    backgroundColor: colors.pinkDark,
    borderColor: colors.pinkDark,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconDot: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  iconDotPurple: {
    backgroundColor: colors.purple,
  },
  iconDotPink: {
    backgroundColor: colors.pinkDark,
  },
  optionTitle: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.md,
  },
  optionTitlePurple: {
    color: colors.purpleDark,
  },
  optionTitlePink: {
    color: colors.pinkDark,
  },
  optionSpinner: {
    marginLeft: 'auto',
  },
  optionSubtext: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.sm,
    color: colors.mutedText,
  },
});
