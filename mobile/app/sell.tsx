import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, spacing } from '../src/theme';

const BRAND = [colors.purple, colors.pinkDark] as const;

// Placeholder — the full create/edit listing form ships in a later phase.
// Wired now so the dashboard's "List New Item" and per-card "Edit" actions
// have a real destination instead of dead-ending.
export default function SellScreen() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEditing = !!edit;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/profile');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Pressable
        onPress={goBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
      >
        <Feather name="arrow-left" size={22} color={colors.purpleDark} />
      </Pressable>

      <View style={styles.center}>
        <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconWrap}>
          <Feather name={isEditing ? 'edit-3' : 'plus'} size={30} color={colors.white} />
        </LinearGradient>
        <Text style={styles.title}>{isEditing ? 'Edit your listing' : 'List a new item'}</Text>
        <Text style={styles.subtitle}>
          Selling straight from your phone is coming soon. For now you can list and manage items on
          the Yahora website.
        </Text>

        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}
        >
          <LinearGradient
            colors={BRAND}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryBtnGradient}
          >
            <Feather name="arrow-left" size={16} color={colors.white} />
            <Text style={styles.primaryBtnText}>Back to dashboard</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  backBtn: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.lg,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  backBtnPressed: {
    backgroundColor: colors.pinkLight,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.purple,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  title: {
    fontFamily: font.family.serif,
    fontSize: font.sizes.xl,
    color: colors.blackSoft,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.sm,
    lineHeight: 20,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  primaryBtn: {
    marginTop: spacing.xl,
    borderRadius: 999,
    overflow: 'hidden',
  },
  primaryBtnPressed: {
    opacity: 0.9,
  },
  primaryBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
  },
  primaryBtnText: {
    fontFamily: font.family.semibold,
    fontSize: 14,
    color: colors.white,
  },
});
