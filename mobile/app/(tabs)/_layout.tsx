import { Tabs } from 'expo-router';

import { colors, font } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.blackSoft,
        tabBarStyle: { backgroundColor: colors.white },
        tabBarLabelStyle: { fontFamily: font.family.medium },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Marketplace' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
