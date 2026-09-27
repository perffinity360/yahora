import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../src/components/AppText';
import { useUnreadTotal } from '../../src/hooks/useMessages';
import { colors, font, MAX_FONT_SCALE } from '../../src/theme';

/**
 * ── WHY THE TAB BAR HAS ITS OWN LABEL AND ITS OWN HEIGHT ──
 *
 * The labels were React Navigation's own <Text>, which scales with the phone's
 * font size with NO cap — every other label in the app goes through AppText
 * and stops at MAX_FONT_SCALE. The bar is a fixed 49dp: 5 padding + a 28dp
 * icon slot + 5 padding leaves the label 11dp, and Inter's line box at the
 * default 10dp label is ~12dp. So the descenders were clipped by a hair even at
 * font size 1.0 (POCO), and at Samsung's largest font size the label outgrew
 * its slot and "Marketplace" was cut on both axes.
 *
 * Now the label is AppText (capped, one line, a theme size), and the bar is
 * tall enough for that label at the cap: item padding + icon + the label's
 * line height × MAX_FONT_SCALE, plus the system bar inset the tab bar pads
 * itself by. At the cap nothing clips; below it there is a little air.
 */
const ITEM_PADDING = 5; // BottomTabItem's `tabVerticalUiKit` padding, each side
const ICON_SLOT = 28; // TabBarIcon's ICON_SIZE_TALL
const LABEL_LINE = 14;
const BAR_CONTENT = ITEM_PADDING * 2 + ICON_SLOT + Math.ceil(LABEL_LINE * MAX_FONT_SCALE) + 1;

export default function TabsLayout() {
  // Derived from the inbox cache, so realtime arrivals move the badge instantly.
  const unread = useUnreadTotal();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.purple,
        tabBarInactiveTintColor: colors.blackSoft,
        // `height` is the whole bar: the tab bar pads its own bottom by the
        // inset, so a height that left it out would squeeze the tabs.
        tabBarStyle: { backgroundColor: colors.white, height: BAR_CONTENT + insets.bottom },
        tabBarLabel: ({ color, children }) => (
          <AppText numberOfLines={1} style={[styles.label, { color }]}>
            {children}
          </AppText>
        ),
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
            fontSize: font.sizes.micro,
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

const styles = StyleSheet.create({
  label: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.micro,
    lineHeight: LABEL_LINE,
    textAlign: 'center',
  },
});
