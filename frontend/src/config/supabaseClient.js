import { createClient } from '@supabase/supabase-js';

/* Empty in dev, exactly like VITE_API_BASE_URL: fall back to the /supabase
   proxy on whatever origin served this page (see vite.config.js).

   The reason is that this URL is resolved in the VISITOR'S browser, not on the
   machine running the dev server. Pointing it at 127.0.0.1:54321 works only on
   that one machine; open the app from another laptop on the LAN and every
   direct browser→Supabase call — realtime chat, the presence dots, the navbar
   unread badge, storage — silently talks to that laptop's own loopback and
   fails, while everything routed through /api keeps working. Going through the
   dev server means one reachable port and no machine IP written down anywhere.

   Hosted builds set a real absolute URL and never reach the fallback. */
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || `${window.location.origin}/supabase`;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


// Dev-only console handle, so `await supabase.auth.getUser()` can be run straight
// from DevTools to confirm the client is authenticated (runbook N-A3).
// Guarded by import.meta.env.DEV — Vite strips this branch from production builds.
if (import.meta.env.DEV) {
  window.supabase = supabase;
}