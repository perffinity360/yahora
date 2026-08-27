import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    // Forward /api/* to the Express backend so the frontend can use
    // relative URLs. This lets any device on the LAN reach the backend
    // via the dev server — no machine IP hardcoded anywhere.
    proxy: {
      '/api': 'http://localhost:5000',

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
})