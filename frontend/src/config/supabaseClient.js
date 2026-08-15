import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


// Dev-only console handle, so `await supabase.auth.getUser()` can be run straight
// from DevTools to confirm the client is authenticated (runbook N-A3).
// Guarded by import.meta.env.DEV — Vite strips this branch from production builds.
if (import.meta.env.DEV) {
  window.supabase = supabase;
}