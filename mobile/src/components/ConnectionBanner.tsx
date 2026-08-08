import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';

import { useRealtime } from '../contexts/RealtimeContext';
import { colors, font, spacing } from '../theme';

/**
 * A quiet strip that appears only when messages might not be arriving live —
 * the device is offline, or the realtime channel dropped and is retrying.
 * It disappears on its own once the channel resubscribes (which also triggers a
 * server resync), so the user never has to act on it.
 */
export function ConnectionBanner() {
  const { connection, isOffline } = useRealtime();
  const degraded = isOffline || connection === 'reconnecting';
  if (!degraded) return null;

  return (
    <View style={styles.banner}>
      <Feather name="wifi-off" size={12} color={colors.purpleDark} />
      <Text style={styles.text}>
        {isOffline ? 'You’re offline — messages will send when you reconnect.' : 'Connecting…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.demoCardPinkBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorderFocus,
  },
  text: {
    fontFamily: font.family.semibold,
    fontSize: 11.5,
    color: colors.purpleDark,
  },
});
