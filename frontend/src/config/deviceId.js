// A name the browser gives itself, sent as X-Device-Id on request-otp so the
// backend can apply its "20 codes per machine per day" limit without counting
// by IP address — campus Wi-Fi NATs a whole college behind one address, so an
// IP limit would lock out every student after the first twenty each morning.
// See docs/PHASE_2_RUNBOOK.md §2.2 and N-Block B.
//
// ⚠ Three things about this value:
//   1. It is NOT a security feature. Anyone can clear localStorage and get a
//      fresh id in a second. It stops accidental loops and lazy scripts; the
//      real defence against a determined attacker is the Turnstile widget.
//   2. It contains nothing personal — a random number made on the device,
//      never linked to a name or an email.
//   3. It MUST survive logging out. AuthContext.logout() removes named keys
//      only and deliberately leaves this one alone. If it reset on every
//      logout the limit it feeds would do nothing at all.
const DEVICE_ID_KEY = "yahora_device_id";

// crypto.randomUUID() is gated behind a secure context, so it is undefined
// when the dev server is opened from a phone over the LAN (http://192.168.x.x)
// — exactly how this project is tested. getRandomValues() has no such gate, so
// fall back to it and shape the bytes into the same v4 UUID. The id only has to
// be unique and match the backend's /^[A-Za-z0-9-]{1,64}$/, not be unguessable.
const randomId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

/** The id for this browser, created on first use and reused forever after. */
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
