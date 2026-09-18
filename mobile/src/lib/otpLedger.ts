import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * This install's record of the login codes it has asked for, keyed BY EMAIL:
 *
 *   { "rahul@iiitk.ac.in": { sends: [epochMs, ...], until: epochMs } }
 *
 * A port of the ledger in frontend/src/pages/auth/Auth.jsx, rule for rule, so
 * the Send Code button on a phone refuses exactly what the website refuses and
 * allows exactly what it allows. Read that file's comments for the history;
 * the load-bearing decisions are repeated here.
 *
 * ⚠ Keyed by email, because every server limit it mirrors is per email. One
 * global deadline meant sending a code to one address disabled the button for
 * a different one the server would have accepted.
 *
 * ⚠ TIMESTAMPS, never "seconds remaining". Storing "47 seconds left" and
 * reopening the app three minutes later would restore 47 and make them wait all
 * over again. A fixed point in time comes out right whenever they come back —
 * including after the app was killed.
 *
 * AsyncStorage, not memory: the server counts across app restarts, so the
 * button has to agree with it there too.
 */
const OTP_SENDS_KEY = 'yahora_otp_sends';

// ⚠ THESE THREE MIRROR THE SERVER — backend/src/modules/auth/auth.controller.js
// (OTP_EMAIL_FREE_REQUESTS, OTP_EMAIL_COOLDOWN_SECONDS, OTP_WINDOW_SECONDS) and
// the web's copies in Auth.jsx. They exist so the button can be right BEFORE a
// request is spent instead of after a 429. If they drift, the button promises
// something the server refuses — or refuses something the server would allow.
export const OTP_FREE_REQUESTS = 3;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_WINDOW_SECONDS = 24 * 60 * 60;

/**
 * Above this the countdown moves off the button and onto a message line, where
 * there is room to spell out hours. Below it the disabled button carries the
 * m:ss on its own and needs no second line saying the same thing. Same as web.
 */
export const OTP_TIMER_MAX_SECONDS = 10 * 60;

export type OtpLedger = Record<string, { sends: number[]; until: number }>;

const normaliseEmail = (email: string) => (email || '').trim().toLowerCase();

/** One email's entry, with sends that have aged out of the window dropped. */
function readEntry(ledger: OtpLedger, key: string) {
  const entry = ledger[key];
  const cutoff = Date.now() - OTP_WINDOW_SECONDS * 1000;
  return {
    sends: (Array.isArray(entry?.sends) ? entry.sends : []).filter((t) => t > cutoff),
    until: Number(entry?.until) || 0,
  };
}

/** The whole ledger. A corrupt value must never take the login screen down. */
export async function loadOtpLedger(): Promise<OtpLedger> {
  try {
    const raw = await AsyncStorage.getItem(OTP_SENDS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as OtpLedger) : {};
  } catch {
    return {};
  }
}

/** Save, dropping every address there is nothing left to remember about. */
async function saveOtpLedger(ledger: OtpLedger): Promise<OtpLedger> {
  const now = Date.now();
  const pruned: OtpLedger = {};
  for (const key of Object.keys(ledger)) {
    const { sends, until } = readEntry(ledger, key);
    // Without this the ledger grows forever on a phone shared around a hostel.
    if (sends.length || until > now) pruned[key] = { sends, until };
  }
  try {
    await AsyncStorage.setItem(OTP_SENDS_KEY, JSON.stringify(pruned));
  } catch {
    // The server is the real limiter; losing the mirror costs a nicer button,
    // not correctness.
  }
  return pruned;
}

/**
 * Seconds the Send button must stay disabled for `email`; 0 when it is free.
 *
 * Two sources, whichever runs later:
 *  - the mirror of the server's own rule, below;
 *  - a deadline the server handed back in a 429, which is authoritative. It is
 *    the only one that knows about sends this install never saw (another
 *    device, a reinstall) and about the 24-hour daily cap.
 */
export function otpCooldownSeconds(ledger: OtpLedger, email: string): number {
  const key = normaliseEmail(email);
  if (!key) return 0;

  const { sends, until } = readEntry(ledger, key);

  // THE FIRST THREE ARE FREE — the first code plus two retries for a slow mail
  // server — and only from the fourth is there a minute between them. Starting
  // the countdown on send #1 made the web button stricter than the server and
  // ate both retries; this does not repeat that.
  const localUntil =
    sends.length >= OTP_FREE_REQUESTS
      ? Math.max(...sends) + OTP_RESEND_COOLDOWN_SECONDS * 1000
      : 0;

  const deadline = Math.max(localUntil, until);
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/** Note a code that was ACTUALLY sent, so the free-request count is right. */
export async function recordOtpSend(ledger: OtpLedger, email: string): Promise<OtpLedger> {
  const key = normaliseEmail(email);
  if (!key) return ledger;
  const entry = readEntry(ledger, key);
  return saveOtpLedger({ ...ledger, [key]: { ...entry, sends: [...entry.sends, Date.now()] } });
}

/** Store a deadline the SERVER gave us, which outranks anything we counted. */
export async function recordServerCooldown(
  ledger: OtpLedger,
  email: string,
  seconds: number,
): Promise<OtpLedger> {
  const key = normaliseEmail(email);
  if (!key) return ledger;
  const wait = Math.max(0, Math.ceil(Number(seconds) || 0));
  const entry = readEntry(ledger, key);
  return saveOtpLedger({ ...ledger, [key]: { ...entry, until: Date.now() + wait * 1000 } });
}

/** m:ss — the short countdown, on the button and for the password lockout. */
export function formatWait(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * A wait a student can actually read: "23h 41m", "9m 05s", "44s".
 *
 * The daily cap is a rolling 24 hours, so m:ss alone would render it as
 * "1440:00" — a number nobody parses into "come back tomorrow". Seconds are
 * dropped above an hour on purpose: a digit flickering once a second next to
 * "23h" reads as broken, not as precise. Identical to the web's formatCountdown.
 */
export function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}
