import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../src/components/AppText';
import { BackButton } from '../../src/components/CircleButton';
import { CommunityWallpaper } from '../../src/components/community/CommunityWallpaper';
import { useLeaveOnce } from '../../src/hooks/useLeaveOnce';
import { colors, font } from '../../src/theme';

/**
 * A post's own page (COMMUNITY_SPEC.md §4) — a placeholder until Phase 7 V-D
 * part 3 (CC-V4c) builds it: the post with every reply, paged.
 *
 * The root is a Stack, so back returns to the Community tab exactly as it was.
 */
export default function PostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const leaveOnce = useLeaveOnce();

  const goBack = () =>
    leaveOnce(() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/community' as never)));

  return (
    <View style={styles.screen}>
      <CommunityWallpaper ground={colors.communityPanelCampus} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <BackButton onPress={goBack} variant="plain" />
      </View>
      <View style={styles.note}>
        <AppText style={styles.noteText}>The post's own page arrives in the next update.</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.communityPanelCampus },
  header: { paddingHorizontal: 12 },
  note: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.communityGlass,
    borderWidth: 1,
    borderColor: colors.communityHairline,
  },
  noteText: {
    textAlign: 'center',
    fontFamily: font.family.regular,
    fontSize: font.sizes.bodyLg,
    lineHeight: 20,
    color: colors.communityMuted,
  },
});
