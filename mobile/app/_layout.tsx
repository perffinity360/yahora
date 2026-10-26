import { BreeSerif_400Regular } from '@expo-google-fonts/bree-serif/400Regular';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_400Regular_Italic } from '@expo-google-fonts/inter/400Regular_Italic';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_500Medium_Italic } from '@expo-google-fonts/inter/500Medium_Italic';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChatWallpaperPreload } from '../src/components/ChatWallpaperPreload';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { RealtimeProvider } from '../src/contexts/RealtimeContext';
import { updateEveryPage, type ChatCache } from '../src/lib/messages';
import { colors } from '../src/theme';

const CACHE_MAX_AGE = 1000 * 60 * 60 * 24;

/**
 * TanStack's idea of "online" comes from NetInfo (it has no source of its own in
 * React Native). Only the message send uses it (`networkMode: 'online'` in
 * useSendMessage): offline, a send waits with its clock, without using up a
 * retry, and goes the moment the phone is back. Everything else keeps
 * `networkMode: 'always'` and no refetch-on-reconnect, exactly as before this
 * was wired. A reconnect refetch would also re-run GET /products/:id and add a
 * view. If NetInfo isn't linked, TanStack just stays "online", as before.
 */
try {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );
} catch {
  // NetInfo missing from this runtime: keep TanStack's default.
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: CACHE_MAX_AGE,
      retry: 2,
      networkMode: 'always',
      refetchOnReconnect: false,
    },
    mutations: {
      networkMode: 'always',
    },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage });

/**
 * A send can't outlive the app. A message still sending when the cache was
 * saved has no request behind it after a restart. Left as it was, it showed a
 * clock forever, with no pill to tap. It comes back as failed instead, with
 * "Failed to send" (MESSAGES_SPEC §2); tapping it sends it again.
 */
function markUnsentAsFailed() {
  for (const [key, data] of queryClient.getQueriesData<ChatCache>({ queryKey: ['chat'] })) {
    if (!data?.pages.some((page) => page.items.some((m) => m.pending))) continue;
    queryClient.setQueryData<ChatCache>(key, (prev) =>
      updateEveryPage(prev, (items) =>
        // Interrupted, never refused: sent again by itself once the server answers.
        items.map((m) => (m.pending ? { ...m, pending: false, failed: true, auto_retry: true } : m)),
      ),
    );
  }
}

/**
 * A cache saved before withLeftOutColumns (src/lib/messages.ts) can hold a long
 * message whose read tick wiped its text, and drawing it crashes the chat
 * before the history refetch can fix it. Only server rows were ever hit, so
 * dropping them loses nothing: that refetch brings them back. Marked stale so
 * it runs as soon as the chat opens, even inside the 5-minute staleTime.
 */
function dropMessagesWithoutText() {
  for (const [key, data] of queryClient.getQueriesData<ChatCache>({ queryKey: ['chat'] })) {
    if (!data?.pages.some((page) => page.items.some((m) => typeof m.content !== 'string'))) continue;
    queryClient.setQueryData<ChatCache>(key, (prev) =>
      updateEveryPage(prev, (items) => items.filter((m) => typeof m.content === 'string')),
    );
    queryClient.invalidateQueries({ queryKey: key, exact: true, refetchType: 'none' });
  }
}

function onCacheRestored() {
  dropMessagesWithoutText();
  markUnsentAsFailed();
}

function AuthGate() {
  const { session, profile, loading, onboardingSkipped } = useAuth();
  const router = useRouter();
  const segments = useSegments() as string[];

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onOnboarding = inAuthGroup && segments[1] === 'onboarding';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login');
      return;
    }

    if (profile && !profile.is_profile_complete && !onboardingSkipped) {
      if (!onOnboarding) router.replace('/(auth)/onboarding');
      return;
    }

    if ((profile?.is_profile_complete || onboardingSkipped) && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, profile, loading, onboardingSkipped, segments, router]);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.purple} />
      </View>
    );
  }

  // A STACK, not a <Slot/>. The Slot was a stack too, but it rendered only
  // its top route, so pushing /product unmounted the whole (tabs) navigator —
  // and React Navigation throws away a navigator's state when it unmounts. Back
  // then re-created the tabs at their first route, which is why a product
  // opened from the Dashboard came back to the Marketplace. A Stack keeps the
  // screens underneath mounted, so back returns to the tab, and the scroll
  // position, exactly as they were.
  //
  // No header (every screen draws its own) and no transition animation: the
  // Slot switched screens instantly, and this changes navigation, not looks.
  return <Stack screenOptions={{ headerShown: false, animation: 'none' }} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_400Regular_Italic,
    Inter_500Medium,
    Inter_500Medium_Italic,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    BreeSerif_400Regular,
  });

  // Hold the app until brand fonts are ready so the system font never flashes.
  // Fall through if loading errors so we never hang on the splash forever.
  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.purple} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          // `buster`: bump it whenever a cached query CHANGES SHAPE, and the
          // restored cache is thrown away once instead of being handed to code
          // that cannot read it. Phase 5 V-E turned the marketplace, product and
          // chat caches into infinite queries (`{ pages, pageParams }`); a phone
          // restoring the old flat shapes would crash on `data.pages`.
          persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: 'v5e-infinite' }}
          onSuccess={onCacheRestored}
        >
          <AuthProvider>
            {/* Owns the app's only realtime channel. It must sit above the
                router so navigation can never unmount and re-subscribe it. */}
            <RealtimeProvider>
              <AuthGate />
            </RealtimeProvider>
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
      {/* The chat wallpaper, decoded before any chat opens. */}
      <ChatWallpaperPreload />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.auroraBottom,
  },
});
