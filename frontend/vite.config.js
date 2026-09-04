import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/* Two developers work on this machine under separate macOS accounts, so both
   the dev server and the backend it proxies to need a per-developer port:

     VITE_DEV_PORT  this Vite dev server        (default 3000)
     VITE_API_PORT  the Express backend /api is forwarded to (default 5000)

   Both are read here in Node, never by the browser, and neither changes runtime
   URL resolution: src/config/urls.js still rewrites only the hostname, and
   relative /api URLs still reach the proxy, so no LAN IP enters any file.

   One validator for both, so the two ports cannot drift apart in how they
   behave. A bad value throws rather than falling back to the default: a silent
   fallback would put the second developer back on the first one's port, which
   is the exact collision these variables exist to prevent. This runs before the
   server boots, so it lands in the terminal of whoever made the typo. */
function resolvePort(env, name, fallback) {
  const configured = (env[name] ?? '').trim()
  if (!configured) return fallback

  const port = Number(configured)
  if (!/^\d+$/.test(configured) || port < 1 || port > 65535) {
    throw new Error(
      `${name} must be a port number between 1 and 65535, got "${configured}". ` +
        'Fix it in frontend/.env (see frontend/.env.example) and restart the dev server.'
    )
  }

  return configured
}

export default defineConfig(({ mode }) => {
  // loadEnv, because Vite reads .env for client code only after this config
  // file has already been evaluated — import.meta.env does not exist here.
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [react()],
    server: {
      // Stays true: the dev server has to listen on the LAN so a phone can open
      // it. Changing the port does not change which interfaces it binds.
      host: true,
      // strictPort stays on deliberately. With a port per developer, a clash now
      // means something is genuinely wrong (a stale server, or both accounts on
      // the same value), and silently sliding to 3001 would hand you a URL that
      // is really the other developer's app.
      port: Number(resolvePort(env, 'VITE_DEV_PORT', '3000')),
      strictPort: true,
      allowedHosts: true,
      // Forward /api/* to the Express backend so the frontend can use
      // relative URLs. This lets any device on the LAN reach the backend
      // via the dev server — no machine IP hardcoded anywhere.
      proxy: {
        '/api': `http://localhost:${resolvePort(env, 'VITE_API_PORT', '5000')}`,

        // Same trick for Supabase. The browser talks to Supabase DIRECTLY for
        // realtime, presence and storage, so `VITE_SUPABASE_URL` is evaluated on
        // whatever machine has the page open — and a value of 127.0.0.1 means
        // "this laptop", where no Supabase is running. Every device on the LAN
        // then loses realtime chat, the presence dots and the navbar unread
        // badge, while everything that goes through /api keeps working, because
        // that half is proxied and the Supabase half was not.
        //
        // ws: true is not optional — Realtime and Presence are a WebSocket at
        // /realtime/v1/websocket, and without it the upgrade is never proxied.
        '/supabase': {
          target: 'http://localhost:54321',
          ws: true,
          rewrite: (path) => path.replace(/^\/supabase/, '')
        }
      }
    }
  }
})