import { createClient } from '@supabase/supabase-js';

import { SUPABASE_URL } from './urls';

/* The URL is resolved in ./urls.js — it handles the empty-in-dev default (the
   /supabase proxy on the serving origin) and re-points a localhost URL at the
   host serving the page. Do not read VITE_SUPABASE_URL directly.

   The anon key is read here unchanged: it is not a URL and needs no resolving. */
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, supabaseAnonKey);


// Dev-only console handle, so `await supabase.auth.getUser()` can be run straight
// from DevTools to confirm the client is authenticated (runbook N-A3).
// Guarded by import.meta.env.DEV — Vite strips this branch from production builds.
if (import.meta.env.DEV) {
  window.supabase = supabase;
}