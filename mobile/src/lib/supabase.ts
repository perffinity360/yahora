import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/**
 * Both values come from src/lib/config.ts, which resolves the Supabase origin
 * from EXPO_PUBLIC_SUPABASE_URL when it is set and otherwise from the Expo dev
 * server's host. No LAN IP is ever written down; see that file for why.
 */
if (!SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY. Set it in mobile/.env, then ' +
      'restart Metro with `npx expo start -c` (env vars are inlined at bundle time).',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
