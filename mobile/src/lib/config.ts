import Constants from 'expo-constants';

/**
 * The one place any base URL is resolved.
 *
 * Nothing in this app may hardcode a LAN IP. A hardcoded address is a DHCP
 * lease waiting to expire: when the router hands the Mac a new one, every
 * request fails with a network error that looks exactly like the server being
 * down, and the fix is an edit in a file nobody remembers.
 *
 * Instead:
 *  1. EXPO_PUBLIC_API_URL / EXPO_PUBLIC_SUPABASE_URL, when set, are used
 *     verbatim. This is how production and EAS builds work — there is no dev
 *     server for them to ask.
 *  2. Otherwise (local dev) the host is read off the Expo dev server. The
 *     machine running Metro is the same machine running the backend and
 *     Supabase, so its address is the answer for all three. Only the port
 *     differs.
 *
 * Note the env vars are read through literal `process.env.X` member access.
 * Expo's Babel transform inlines EXPO_PUBLIC_* at bundle time by rewriting
 * exactly that syntax — a dynamic `process.env[name]` lookup is NOT inlined and
 * silently reads as undefined.
 */

const API_PORT = (process.env.EXPO_PUBLIC_API_PORT ?? '5000').trim() || '5000';
const SUPABASE_PORT = '54321';

/** Trim whitespace and any trailing slashes, so callers can append `/api/...`. */
function clean(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

/**
 * Host of the machine running Metro, without its port — e.g. "10.37.66.42".
 *
 * `expoConfig.hostUri` is the modern field and is present in Expo Go and in
 * dev clients alike; `expoGoConfig.debuggerHost` is the older Expo Go field,
 * kept as a fallback. Both carry a "host:port" string whose port is Metro's
 * (8081), never the backend's, so it is always discarded.
 *
 * Empty in a production build, where there is no dev server to ask.
 */
export function getDevHost(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? '';
  return hostUri.split(':')[0]?.trim() ?? '';
}

function missingHost(envVar: string, purpose: string): never {
  throw new Error(
    `Cannot resolve the ${purpose} URL.\n\n` +
      `No ${envVar} is set, and the Expo dev server host could not be read ` +
      `from expo-constants (expoConfig.hostUri / expoGoConfig.debuggerHost ` +
      `were both empty).\n\n` +
      `Fix: set ${envVar} in mobile/.env to the full origin of the machine ` +
      `running the servers, then restart Metro with \`npx expo start -c\` ` +
      `(EXPO_PUBLIC_* values are inlined at bundle time, so a plain reload ` +
      `will not pick it up).\n\n` +
      `There is deliberately no localhost fallback: on a physical phone ` +
      `127.0.0.1 is the phone itself, which fails in a way that looks like ` +
      `the backend being down.`,
  );
}

function resolveApiUrl(): string {
  const explicit = clean(process.env.EXPO_PUBLIC_API_URL);
  if (explicit) return explicit;

  const host = getDevHost();
  if (!host) missingHost('EXPO_PUBLIC_API_URL', 'backend API');
  return `http://${host}:${API_PORT}`;
}

function resolveSupabaseUrl(): string {
  const explicit = clean(process.env.EXPO_PUBLIC_SUPABASE_URL);
  if (explicit) return explicit;

  const host = getDevHost();
  if (!host) missingHost('EXPO_PUBLIC_SUPABASE_URL', 'Supabase');
  return `http://${host}:${SUPABASE_PORT}`;
}

/** Backend origin, no trailing slash. Append `/api/...`. */
export const API_BASE_URL = resolveApiUrl();

/** Supabase origin, no trailing slash. */
export const SUPABASE_URL = resolveSupabaseUrl();

export const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
