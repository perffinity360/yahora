import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A name the app gives itself, sent as `X-Device-Id` on request-otp so the
 * backend can apply its "20 codes per device per day" limit without counting by
 * IP address — campus Wi-Fi NATs a whole hostel behind one address, so an IP
 * limit would lock out every student after the first twenty each morning.
 *
 * Mirrors frontend/src/config/deviceId.js. Until this existed the app sent no
 * header at all, so the backend skipped the per-device cap for every phone
 * (auth.controller.js says so in as many words).
 *
 * ⚠ Three things about this value, same as on the web:
 *   1. It is NOT a security feature. Reinstalling the app gets a new one. It
 *      stops accidental loops and lazy scripts; Turnstile is the real defence.
 *   2. It contains nothing personal — a random value made on the device, never
 *      linked to a name or an email.
 *   3. It MUST survive signing out. AuthContext.signOut() removes named keys
 *      only and leaves this one alone. If it reset on every sign-out, the limit
 *      it feeds would do nothing.
 */
const DEVICE_ID_KEY = 'yahora_device_id';

/** Must match the backend's DEVICE_ID_PATTERN, /^[A-Za-z0-9-]{1,64}$/. */
const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/**
 * A v4-shaped UUID from Math.random. Hermes has no crypto.randomUUID without a
 * polyfill, and none is needed: the id only has to be unique per install and
 * match the pattern above, not be unguessable (see point 1).
 */
function randomId(): string {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const block = (n: number) => Array.from({ length: n }, hex).join('');
  const variant = ((Math.floor(Math.random() * 4) + 8) & 0xf).toString(16);
  return `${block(8)}-${block(4)}-4${block(3)}-${variant}${block(3)}-${block(12)}`;
}

let cached: string | null = null;

/** This install's id, created on first use and reused forever after. */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored && DEVICE_ID_PATTERN.test(stored)) {
      cached = stored;
      return stored;
    }
    const fresh = randomId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
    cached = fresh;
    return fresh;
  } catch {
    // Storage unavailable. A per-session id still counts this session's sends;
    // the server treats a missing header as "no device cap", never an error.
    cached = cached ?? randomId();
    return cached;
  }
}
