import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, spacing } from '../../src/theme';

export default function MessagesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.heading}>Messages</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  heading: {
    fontFamily: font.family.serif,
    fontSize: font.sizes.xxl,
    color: colors.black,
  },
});
