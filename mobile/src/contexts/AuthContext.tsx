import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { api, type ApiError } from '../lib/api';
import { API_BASE_URL } from '../lib/config';
import { getDeviceId } from '../lib/deviceId';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types';

const PROFILE_STORAGE_KEY = 'yahora_profile';
const DEMO_STORAGE_KEY = 'yahora_is_demo';
const SKIPPED_STORAGE_KEY = 'yahora_onboarding_skipped';

interface RequestOtpResponse {
  message: string;
  university: string;
}

/**
 * What `loginWithPassword` throws. Everything `ApiError` carries, plus the
 * lockout's remaining seconds — the one field this endpoint returns that the
 * shared wrapper cannot pass on.
 */
export type PasswordLoginError = ApiError & { retryAfterSeconds?: number };

interface AuthPayload {
  message: string;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  };
  userAuth: unknown;
  userProfile: UserProfile;
}

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isDemoUser: boolean;
  onboardingSkipped: boolean;
  requestOtp: (email: string, captchaToken?: string) => Promise<RequestOtpResponse>;
  verifyOtp: (email: string, otp: string) => Promise<UserProfile>;
  loginWithPassword: (identifier: string, password: string) => Promise<UserProfile>;
  demoLogin: () => Promise<UserProfile>;
  saveProfile: (profile: UserProfile) => Promise<void>;
  skipOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoUser, setIsDemoUser] = useState(false);
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      const [{ data }, cachedProfile, demoFlag, skippedFlag] = await Promise.all([
        supabase.auth.getSession(),
        AsyncStorage.getItem(PROFILE_STORAGE_KEY),
        AsyncStorage.getItem(DEMO_STORAGE_KEY),
        AsyncStorage.getItem(SKIPPED_STORAGE_KEY),
      ]);
      if (!active) return;

      setSession(data.session ?? null);
      setIsDemoUser(demoFlag === 'true');
      setOnboardingSkipped(skippedFlag === 'true');

      if (data.session && cachedProfile) {
        try {
          setProfile(JSON.parse(cachedProfile) as UserProfile);
        } catch {
          await AsyncStorage.removeItem(PROFILE_STORAGE_KEY);
        }
      }

      if (active) setLoading(false);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const saveProfile = async (p: UserProfile) => {
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(p));
    setProfile(p);
  };

  const setDemoFlag = async (value: boolean) => {
    if (value) await AsyncStorage.setItem(DEMO_STORAGE_KEY, 'true');
    else await AsyncStorage.removeItem(DEMO_STORAGE_KEY);
    setIsDemoUser(value);
  };

  const setSkippedFlag = async (value: boolean) => {
    if (value) await AsyncStorage.setItem(SKIPPED_STORAGE_KEY, 'true');
    else await AsyncStorage.removeItem(SKIPPED_STORAGE_KEY);
    setOnboardingSkipped(value);
  };

  // captchaToken is the Turnstile token from TurnstileWebView. The backend
  // forwards it to Supabase untouched (backend/API.md, request-otp); an
  // undefined token is dropped by JSON.stringify, exactly as before.
  const requestOtp = async (email: string, captchaToken?: string) =>
    api.post<RequestOtpResponse>(
      '/api/auth/request-otp',
      { email, captchaToken },
      // Opts this install into its own per-device daily quota (20 codes). The
      // header is optional server-side — without it the device cap is simply
      // skipped, which is what every phone got until now. Same as the web.
      { 'X-Device-Id': await getDeviceId() },
    );

  /**
   * Username-or-email + password sign-in (Block V-D).
   *
   * Everything after the request is IDENTICAL to verifyOtp below, and that is by
   * design rather than by coincidence: backend/API.md specifies this endpoint's
   * 200 as byte-identical to verify-otp's precisely so both share one storage
   * path. If one of them ever changes, change both.
   *
   * ── WHY THIS DOES NOT USE `api.post` ──────────────────────────────────────
   * A 429 here carries `retry_after_seconds`, computed per-identifier — a
   * student 40 seconds from unlocking is told 40, not the 900 cap. `api.ts`
   * keeps only `error`, `status` and `fromApi` from a failed response and
   * discards the rest of the body, so going through it would mean showing
   * everybody the worst case.
   *
   * This is the one endpoint where doing the fetch here costs nothing else:
   * it is how a caller GETS a token, so the auth header `api.ts` exists to
   * attach would be empty anyway. The error shaping below mirrors `api.ts`
   * exactly — same `status`, same `fromApi` rule — so callers can branch on
   * them the same way.
   */
  const loginWithPassword = async (identifier: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      // The password is in this body and nowhere else — never stored, never
      // logged, not even on the failure path below (plan rule 14).
      body: JSON.stringify({ identifier, password }),
    });

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    const body = (parsed ?? {}) as Record<string, unknown>;

    if (!response.ok) {
      // `fromApi` false means something BETWEEN us and the backend answered — a
      // proxy, a captive portal, the macOS AirPlay Receiver on the API port —
      // and its status says nothing about this student's credentials.
      const code = (body.error as string) || (body.message as string) || null;
      const err = new Error(
        code || `Request failed (${response.status})`,
      ) as PasswordLoginError;
      err.status = response.status;
      err.fromApi = Boolean(code);

      const retry = Number(body.retry_after_seconds);
      if (Number.isFinite(retry) && retry > 0) err.retryAfterSeconds = Math.ceil(retry);
      throw err;
    }

    const data = body as unknown as AuthPayload;
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    await saveProfile(data.userProfile);
    await setDemoFlag(false);
    await setSkippedFlag(false);
    return data.userProfile;
  };

  const verifyOtp = async (email: string, otp: string) => {
    const data = await api.post<AuthPayload>('/api/auth/verify-otp', { email, otp });
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    await saveProfile(data.userProfile);
    await setDemoFlag(false);
    await setSkippedFlag(false);
    return data.userProfile;
  };

  const demoLogin = async () => {
    const data = await api.post<AuthPayload>('/api/auth/demo-login', {});
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    await saveProfile(data.userProfile);
    await setDemoFlag(true);
    return data.userProfile;
  };

  const skipOnboarding = () => setSkippedFlag(true);

  const signOut = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.multiRemove([
      PROFILE_STORAGE_KEY,
      DEMO_STORAGE_KEY,
      SKIPPED_STORAGE_KEY,
    ]);
    setProfile(null);
    setIsDemoUser(false);
    setOnboardingSkipped(false);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      isDemoUser,
      onboardingSkipped,
      requestOtp,
      verifyOtp,
      loginWithPassword,
      demoLogin,
      saveProfile,
      skipOnboarding,
      signOut,
    }),
    [session, profile, loading, isDemoUser, onboardingSkipped],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
