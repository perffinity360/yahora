/* Resolved base URLs for the two services this app talks to.
   Import from here — never read import.meta.env.VITE_API_BASE_URL or
   VITE_SUPABASE_URL directly, and never write a host into a component.

   The problem this solves: both URLs are resolved in the VISITOR'S browser, so
   a `localhost` or `127.0.0.1` in .env means "the device holding the page".
   Open the site from a phone or a second laptop and every request goes to that
   device's own loopback, where nothing is running. A LAN IP instead of loopback
   just trades one broken case for a value that dies with the next DHCP lease.

   So in development, and only there, a URL that points at the dev machine is
   re-pointed at whatever host actually served this page. A page opened from
   http://10.37.66.42:3000 turns http://localhost:5000 into
   http://10.37.66.42:5000 by itself, with no file to edit when the IP changes.

   Production is never rewritten: the guard is import.meta.env.DEV, and hosted
   URLs (*.supabase.co, the Render backend) fail the private-host test anyway. */

const PRIVATE_IPV4 =
  /^(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/;

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

/** True when a hostname names the dev machine rather than a real server. */
function isDevMachineHost(hostname) {
  // .hostname keeps IPv6 literals bracketed ("[::1]"); strip to match the set.
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return LOOPBACK_HOSTNAMES.has(host) || PRIVATE_IPV4.test(host);
}

/**
 * Re-point a configured URL at the host serving this page, when — and only
 * when — it is a development URL aimed at the dev machine.
 *
 * Returns the input untouched for: an empty value (which is the dev default and
 * yields relative URLs the Vite proxy forwards), a production build, a URL
 * naming a real host, and anything that does not parse as absolute.
 */
function resolveDevHost(configured) {
  const value = (configured ?? '').trim().replace(/\/+$/, '');

  // Empty is deliberate in dev: callers then build relative "/api/..." URLs and
  // the Vite proxy forwards them. Parsing "" would throw, so leave early.
  if (!value) return '';

  if (!import.meta.env.DEV) return value;
  if (typeof window === 'undefined') return value;

  let url;
  try {
    url = new URL(value);
  } catch {
    return value; // Relative or malformed — not ours to rewrite.
  }

  if (!isDevMachineHost(url.hostname)) return value;

  // Hostname only. Protocol, port and path are the developer's choice and are
  // preserved: http://localhost:5000 -> http://<serving-host>:5000.
  url.hostname = window.location.hostname;
  return url.toString().replace(/\/+$/, '');
}

/** Backend origin, no trailing slash. Empty in dev -> relative, via the proxy. */
export const API_ORIGIN = resolveDevHost(import.meta.env.VITE_API_BASE_URL);

/** What call sites actually want: the origin plus the /api prefix. */
export const API_BASE_URL = `${API_ORIGIN}/api`;

/* Hosted builds set a real absolute URL. Empty falls back to the /supabase
   proxy on whatever origin served this page (see vite.config.js), which keeps
   realtime, presence and storage working for every device on the LAN. */
export const SUPABASE_URL =
  resolveDevHost(import.meta.env.VITE_SUPABASE_URL) ||
  `${window.location.origin}/supabase`;
