import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import { withDevHost } from './devHost';

/**
 * EXPO_PUBLIC_SUPABASE_URL stays as http://127.0.0.1:54321 for local work.
 * withDevHost() swaps the loopback host for the Metro machine's LAN IP at
 * runtime, so the same value works in the simulator and on a physical phone
 * with no .env edits when the Wi-Fi address changes. A hosted Supabase URL is
 * passed through untouched.
 */
const supabaseUrl = withDevHost(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env, then restart Metro with ' +
      '`npx expo start -c` (env vars are inlined at bundle time).',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
