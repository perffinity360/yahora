import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '../AppText';
import { colors, font } from '../../theme';

/**
 * COMMUNITY_SPEC.md §2.4 — shown instead of the "being checked" toast when a
 * held post showed signs of self-harm. Calm, never a punishment; the number
 * and the link are tappable. Without `onClose` (a Posts tab, under the held
 * post) it has no Close button.
 */
export function SupportCard({ onClose }: { onClose?: () => void }) {
  return (
    <View style={styles.card} accessibilityRole="summary">
      <MaterialCommunityIcons name="hand-heart-outline" size={20} color={colors.purple} style={styles.icon} />
      <View style={styles.body}>
        <AppText style={styles.title} accessibilityRole="header">
          You're not alone
        </AppText>
        <AppText style={styles.text}>
          If you're going through something difficult, talking to someone can help.
        </AppText>
        <AppText style={styles.text}>
          India: Tele-MANAS — call{' '}
          <AppText
            style={styles.link}
            onPress={() => void Linking.openURL('tel:14416')}
            accessibilityRole="link"
            suppressHighlighting
          >
            14416
          </AppText>{' '}
          (free, any time)
        </AppText>
        <AppText style={styles.text}>
          Anywhere else:{' '}
          <AppText
            style={styles.link}
            onPress={() => void Linking.openURL('https://findahelpline.com')}
            accessibilityRole="link"
            suppressHighlighting
          >
            findahelpline.com
          </AppText>
        </AppText>
        {onClose ? (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
          >
            <AppText style={styles.closeText}>Close</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.pinkLight,
  },
  icon: { marginTop: 1 },
  body: { flex: 1, gap: 4 },
  title: { fontFamily: font.family.serif, fontSize: 15, lineHeight: 20, color: colors.purpleDark },
  text: { fontFamily: font.family.regular, fontSize: font.sizes.bodyLg, lineHeight: 20, color: colors.blackSoft },
  link: { fontFamily: font.family.semibold, color: colors.purple, textDecorationLine: 'underline' },
  close: {
    alignSelf: 'flex-end',
    marginTop: 6,
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.reactionMineBorder,
  },
  closePressed: { transform: [{ scale: 0.97 }] },
  closeText: { fontFamily: font.family.semibold, fontSize: font.sizes.body, color: colors.purple },
});
