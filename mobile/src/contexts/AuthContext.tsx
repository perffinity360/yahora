import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types';

const PROFILE_STORAGE_KEY = 'yahora_profile';
const DEMO_STORAGE_KEY = 'yahora_is_demo';
const SKIPPED_STORAGE_KEY = 'yahora_onboarding_skipped';

interface RequestOtpResponse {
  message: string;
  university: string;
}

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
  requestOtp: (email: string) => Promise<RequestOtpResponse>;
  verifyOtp: (email: string, otp: string) => Promise<UserProfile>;
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

  const requestOtp = (email: string) =>
    api.post<RequestOtpResponse>('/api/auth/request-otp', { email });

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
