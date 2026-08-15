import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';

// localStorage keys. `yahora_session` holds the ACCESS token and is what every
// `fetch` to the Express backend sends as its Bearer token — its meaning has not
// changed. `yahora_refresh_token` is new: supabase.auth.setSession() needs both
// halves of the session, and without the refresh half a returning student could
// not be re-authenticated on app boot.
const SESSION_KEY = 'yahora_session';
const REFRESH_KEY = 'yahora_refresh_token';
const USER_ID_KEY = 'yahora_user_id';
const DEMO_KEY = 'yahora_demo_user';
const UNIVERSITY_KEY = 'yahora_university_id';

// Mirror a Supabase session back into localStorage.
//
// This is not just bookkeeping: supabase-js auto-refreshes the access token in
// the background and ROTATES the refresh token when it does. If we didn't write
// the new pair back, `yahora_session` would slowly go stale while every backend
// fetch kept sending it, and the stored refresh token would be a dead one by the
// next boot.
const persistSession = (session) => {
  if (!session) return;
  if (session.access_token) localStorage.setItem(SESSION_KEY, session.access_token);
  if (session.refresh_token) localStorage.setItem(REFRESH_KEY, session.refresh_token);
};

// Create the Context
const AuthContext = createContext();

// Create a Provider Component
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // `sessionReady` = "the Supabase JS client's auth state has settled".
  //
  // setSession() is async. Any direct browser→Supabase query fired before it
  // resolves still goes out as the `anon` role with auth.uid() NULL, which under
  // migration 004 means zero rows and no error to debug. Consumers that query
  // Supabase directly must gate their first fetch on this flag.
  //
  // It is TRUE for a logged-out visitor as soon as we know there is nothing to
  // restore — "settled", not "authenticated".
  const [sessionReady, setSessionReady] = useState(false);

  const navigate = useNavigate();

  const clearStoredSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(DEMO_KEY);
    localStorage.removeItem(UNIVERSITY_KEY);
    setIsAuthenticated(false);
  }, []);

  // Check localStorage the moment the app starts or refreshes, then hand the
  // stored session to the Supabase client.
  //
  // The boot path is the one that gets missed: a student who logged in yesterday
  // never passes through `login()` today, so without this they would be anonymous
  // to Supabase on every subsequent visit.
  useEffect(() => {
    let cancelled = false;

    const token = localStorage.getItem(SESSION_KEY);
    const userId = localStorage.getItem(USER_ID_KEY);

    if (token && userId) {
      setIsAuthenticated(true);
    }
    setLoading(false); // Finished checking — unchanged, render gate opens now

    const restoreSupabaseSession = async () => {
      if (!token || !userId) {
        // Logged out. Nothing to restore, so the client is already settled.
        if (!cancelled) setSessionReady(true);
        return;
      }

      try {
        // supabase-js persists its own copy of the session and rehydrates it on
        // load. Prefer that one when it exists — after a background refresh its
        // tokens are newer than ours, and replaying our older refresh token
        // against a rotated one would fail for no good reason.
        const { data: existing } = await supabase.auth.getSession();

        if (existing?.session) {
          persistSession(existing.session);
          if (!cancelled) setSessionReady(true);
          return;
        }

        const { data, error } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: localStorage.getItem(REFRESH_KEY) || '',
        });

        if (error || !data?.session) {
          throw error || new Error('setSession returned no session');
        }

        persistSession(data.session);
        if (!cancelled) setSessionReady(true);
      } catch (err) {
        // Expired or invalid token. Half-authenticated is the worst state to sit
        // in — the app believes you are logged in while every Supabase query
        // silently returns nothing — so tear the session down and send them to
        // the login form.
        console.warn(
          '[auth] could not restore Supabase session, signing out:',
          err?.message || err,
        );

        try {
          await supabase.auth.signOut();
        } catch {
          // Already unusable; nothing left to clean up on the client.
        }

        if (cancelled) return;
        clearStoredSession();
        setSessionReady(true);
        navigate('/auth', { replace: true });
      }
    };

    restoreSupabaseSession();

    return () => {
      cancelled = true;
    };
    // Boot-only: this must run exactly once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep localStorage in step with the client's own token rotation. Without this
  // the Bearer token every backend fetch sends drifts out of date within the hour.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
        persistSession(session);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Function to call when logging in.
  //
  // Deliberately still SYNCHRONOUS from the caller's point of view: it writes
  // localStorage and flips `isAuthenticated` immediately, exactly as before, so
  // the existing `login(...); navigate(...)` call sites keep working unchanged.
  // The async setSession runs alongside and is what `sessionReady` reports on.
  // It returns a promise so a caller *may* await it, but none has to.
  const login = (token, userId, refreshToken) => {
    localStorage.setItem(SESSION_KEY, token);
    localStorage.setItem(USER_ID_KEY, userId);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    setIsAuthenticated(true);

    // Until setSession resolves, a Supabase query would still go out as anon.
    setSessionReady(false);

    return supabase.auth
      .setSession({
        access_token: token,
        refresh_token: refreshToken || '',
      })
      .then(({ data, error }) => {
        if (error) {
          // The backend just authenticated this student, so the token is good and
          // every Express call will keep working. Don't sign them out over this —
          // only direct Supabase reads are affected, which is the behaviour that
          // existed before this fix anyway.
          console.error('[auth] setSession failed after login:', error.message);
          return;
        }
        persistSession(data?.session);
      })
      .catch((err) => {
        console.error('[auth] setSession threw after login:', err?.message || err);
      })
      .finally(() => setSessionReady(true));
  };

  // Function to call when manually logging out.
  //
  // Clearing localStorage alone left the Supabase client holding a valid token in
  // memory, so a "logged out" user kept making authenticated queries until the tab
  // closed. signOut() is what actually drops it.
  const logout = () => {
    clearStoredSession();
    setSessionReady(false); // tear down gated subscriptions before the token dies

    return supabase.auth
      .signOut()
      .catch((err) => {
        console.warn('[auth] signOut failed:', err?.message || err);
      })
      .finally(() => setSessionReady(true));
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, login, logout, loading, sessionReady }}
    >
      {/* Do not render the app until we finish checking localStorage */}
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Custom hook to make it easy to use anywhere
export const useAuth = () => useContext(AuthContext);
