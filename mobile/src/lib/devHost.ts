import Constants from 'expo-constants';

/**
 * Where "localhost" actually lives during local development.
 *
 * On a physical phone, `127.0.0.1` is the phone itself — not the Mac running
 * the backend and Supabase — so any loopback URL in `.env` fails with a network
 * error that looks like the server being down. The Expo dev server already
 * tells us the LAN IP of the machine running Metro, and that is the same
 * machine running everything else, so we reuse it instead of asking anyone to
 * paste a Wi-Fi IP into `.env` every time the network changes.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

/** Host part of a URL authority, minus any port. Returns '' if not a URL. */
const URL_PARTS = /^(https?:\/\/)(\[[^\]]+\]|[^/:]+)(:\d+)?(.*)$/i;

/**
 * The LAN IP (or hostname) of the machine running Metro, e.g. "192.168.1.10".
 * Empty in a production build, where there is no dev server to ask.
 */
export function getDevHost(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost ?? '';
  return hostUri.split(':')[0]?.trim() ?? '';
}

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.trim().toLowerCase());
}

/**
 * Rewrite a loopback URL onto the Metro host, preserving scheme, port and path.
 *
 *   http://127.0.0.1:54321  ->  http://192.168.1.10:54321
 *
 * Anything else is returned untouched: a real staging/production URL passes
 * through as written, and so does a loopback URL in a production build where
 * there is no dev server to detect. That is what lets one `.env` value work in
 * the simulator, on an Android emulator (where 127.0.0.1 is also wrong) and on
 * a physical device without edits.
 */
export function withDevHost(url: string): string {
  const trimmed = (url ?? '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  const parts = trimmed.match(URL_PARTS);
  if (!parts) return trimmed;

  const [, scheme, host, port = '', rest = ''] = parts;
  if (!isLoopbackHost(host)) return trimmed;

  const devHost = getDevHost();
  if (!devHost || isLoopbackHost(devHost)) return trimmed;

  return `${scheme}${devHost}${port}${rest}`;
}
