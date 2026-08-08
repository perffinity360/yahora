import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';

import { useUnreadTotal } from '../../src/hooks/useMessages';
import { colors, font } from '../../src/theme';

export default function TabsLayout() {
  // Derived from the inbox cache, so realtime arrivals move the badge instantly.
  const unread = useUnreadTotal();

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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Marketplace',
          tabBarIcon: ({ color, size }) => <Feather name="shopping-bag" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <Feather name="message-square" size={size} color={color} />,
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.pinkDark,
            color: colors.white,
            fontFamily: font.family.bold,
            fontSize: 10,
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
