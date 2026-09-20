import Feather from '@expo/vector-icons/Feather';
import { decode } from 'base64-arraybuffer';
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../src/components/AppText';
import { AppTextInput } from '../../src/components/AppTextInput';
import { AuroraBackground } from '../../src/components/AuroraBackground';
import { KeyboardAvoider } from '../../src/components/KeyboardAvoider';
import { MIN_PASSWORD_LENGTH, PasswordField } from '../../src/components/PasswordField';
import { SearchablePicker } from '../../src/components/SearchablePicker';
import { UsernameField, type UsernameStatus } from '../../src/components/UsernameField';
import { useAuth } from '../../src/contexts/AuthContext';
import { useCourses, useSpecializations } from '../../src/hooks/useAcademics';
import { useFloatingTopInset } from '../../src/hooks/useFloatingTopInset';
import { api, type ApiError } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { colors, font, radius, spacing } from '../../src/theme';
import type { UsernameSuggestions, UserProfile } from '../../src/types';

const BRAND_GRADIENT = [colors.purple, colors.pinkDark] as const;

/** Debounce on the name field before asking for handle suggestions. */
const SUGGEST_DEBOUNCE_MS = 400;

/**
 * Readable copy for the codes POST /api/auth/onboarding can return.
 *
 * This mapping is not cosmetic. `src/lib/api.ts` puts the response's `error`
 * field into `Error.message`, and that field is a machine code — so without
 * this a student who picks a short password is shown the literal text
 * "WEAK_PASSWORD".
 *
 * USERNAME_TAKEN and USERNAME_RESERVED share a sentence on purpose: the server
 * distinguishes them, but telling a student which handles are *reserved* hands
 * anyone probing a map of the reserved list (backend/API.md).
 */
const SUBMIT_ERROR_COPY: Record<string, string> = {
  WEAK_PASSWORD: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters that is not your username.`,
  COMMON_PASSWORD: 'That password is too common. Please choose another.',
  USERNAME_TAKEN: 'That username is taken. Try another.',
  USERNAME_RESERVED: 'That username is taken. Try another.',
  INVALID_FORMAT: 'That username is not valid. Use letters, numbers, dots, dashes or underscores.',
  MISSING_FIELDS: 'Please fill in all required fields.',
  // 23503, a foreign key the database rejected — in practice a course or
  // specialization id that no longer exists. See the refetch below.
  INVALID_REFERENCE:
    'Your course or specialization is out of date. We have refreshed the lists — please pick them again.',
  DUPLICATE: 'That username is taken. Try another.',
  CONTENT_TOO_LONG: 'One of your answers is too long. Please shorten it.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
};

/** True for the codes that are about the username rather than the password. */
const USERNAME_ERRORS = new Set(['USERNAME_TAKEN', 'USERNAME_RESERVED', 'INVALID_FORMAT']);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const QUALIFICATIONS = [
  'PhD',
  'Post Graduation',
  'Graduation',
  'Intermediate (12th)',
  'High School (10th)',
];
const YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year'];

const toOptions = (values: string[]) => values.map((v) => ({ label: v, value: v }));

export default function OnboardingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, profile, isDemoUser, saveProfile, skipOnboarding, signOut } = useAuth();

  const floatingTop = useFloatingTopInset();

  const coursesQuery = useCourses();
  const specsQuery = useSpecializations();
  const fetchingLists = coursesQuery.isLoading || specsQuery.isLoading;
  const listsError = coursesQuery.isError || specsQuery.isError;

  const courseOptions = (coursesQuery.data ?? []).map((c) => ({ label: c.name, value: c.id }));
  const specOptions = (specsQuery.data ?? []).map((s) => ({ label: s.name, value: s.id }));

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [qualification, setQualification] = useState(profile?.qualification ?? '');
  const [yearOfStudy, setYearOfStudy] = useState(profile?.year_of_study ?? '');
  const [courseId, setCourseId] = useState(profile?.course_id ?? '');
  const [specializationId, setSpecializationId] = useState(profile?.specialization_id ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');

  // Username: the value lives here, the availability check lives in the field.
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [usernameServerError, setUsernameServerError] = useState<string | null>(null);
  /** Alternatives the availability check offers when a handle is unavailable. */
  const [serverSuggestions, setServerSuggestions] = useState<string[]>([]);
  /** Handles derived from the typed name, before anything is unavailable. */
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);

  // Passwords live in component state and nowhere else: never AsyncStorage,
  // never a log line, never anything that outlives this screen (plan rule 14).
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  /**
   * Whether Save has been pressed at least once. Gates the summary above the
   * button: nobody wants to be told what is missing from a form they have only
   * just opened.
   */
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [nameFocused, setNameFocused] = useState(false);
  const [bioFocused, setBioFocused] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [goingBack, setGoingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = saving || skipping;

  /**
   * Three handles derived from the name, so nobody has to invent one.
   *
   * Same 400ms debounce and same monotonic request id as the availability check
   * in UsernameField, for the same reason: a burst of keystrokes produces
   * several requests, and the slow one must not overwrite the fast one.
   */
  const suggestRequestId = useRef(0);

  useEffect(() => {
    const name = fullName.trim();
    if (name.length < 2) {
      setNameSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      const id = ++suggestRequestId.current;
      api
        .get<UsernameSuggestions>(`/api/users/username-suggestions?name=${encodeURIComponent(name)}`)
        .then((data) => {
          if (id !== suggestRequestId.current) return;
          const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
          setNameSuggestions(list.filter(Boolean).slice(0, 3));
        })
        .catch(() => {
          if (id !== suggestRequestId.current) return;
          // Suggestions are a convenience. Failing to fetch them is not an
          // error the student needs to see or act on.
          setNameSuggestions([]);
        });
    }, SUGGEST_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [fullName]);

  /**
   * Which three chips to show. The server's alternatives win when it has any,
   * because at that point the student needs a handle that is actually free —
   * not three more derived from their name that may be taken as well.
   */
  const suggestions = serverSuggestions.length > 0 ? serverSuggestions : nameSuggestions;

  /**
   * Live mismatch feedback, as the web does it: the moment there is something in
   * the confirm box that does not match, say so. Waiting for submit means being
   * told at the end of the form about a typo made at the start — and with the
   * characters hidden, that is the one field nobody can re-read to check.
   * Computed, never stored: a second copy of the password in state is a second
   * place it can leak from.
   */
  const liveMismatch =
    confirmPassword.length > 0 && password !== confirmPassword
      ? 'Both passwords must match.'
      : null;

  /**
   * The names of the fields currently showing an error.
   *
   * Every field-level message is rendered under its own input, which is right
   * — but the Save button is at the bottom of a long form, so by the time it is
   * pressed the offending field is usually off-screen. Pressing Save then looks
   * like nothing happened at all. This is what the summary just above the
   * button lists, so the student knows both THAT something failed and WHERE.
   */
  /**
   * Required fields still blank. Named rather than counted: "please fill in all
   * required fields" on a form this long is a puzzle, and the four academic
   * pickers all look filled-in-ish when they are not.
   *
   * Recomputed every render rather than captured at submit, so the list shrinks
   * as the student fills things in instead of going stale the moment they fix
   * the first one.
   */
  const missingFields = submitAttempted
    ? ([
        !fullName.trim() ? 'Full name' : null,
        !qualification ? 'Qualification' : null,
        !courseId ? 'Course' : null,
        !yearOfStudy ? 'Year of study' : null,
        !specializationId ? 'Specialization' : null,
        !username.trim() ? 'Username' : null,
        password.length < MIN_PASSWORD_LENGTH ? 'Password' : null,
      ].filter(Boolean) as string[])
    : [];

  const usernameBad =
    usernameStatus === 'invalid' || usernameStatus === 'taken' || usernameStatus === 'reserved';

  const fieldIssues = Array.from(
    new Set(
      [
        ...missingFields,
        usernameServerError || usernameBad ? 'Username' : null,
        passwordError ? 'Password' : null,
        confirmError || liveMismatch ? 'Confirm password' : null,
      ].filter(Boolean) as string[],
    ),
  );

  const applySuggestion = (handle: string) => {
    // Setting the value is enough: UsernameField's check keys off it, so this
    // re-runs availability for the chosen handle on its own.
    setUsername(handle);
    setUsernameServerError(null);
  };

  const handleBack = async () => {
    if (busy || goingBack) return;
    setError(null);
    setGoingBack(true);
    try {
      // We're authenticated mid-onboarding; the routing guard would bounce us
      // straight back here unless the session is cleared. So sign out, then
      // return to login.
      await signOut();
      router.replace('/(auth)/login');
    } catch (e) {
      setGoingBack(false);
      setError(e instanceof Error ? e.message : 'Could not go back. Please try again.');
    }
  };

  const handlePickAvatar = async () => {
    setError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Photo library access is needed to upload a photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
        setError('Image must be under 5MB.');
        return;
      }

      setUploading(true);

      // RN can't upload a File/Blob directly: read the picked file as base64,
      // convert to an ArrayBuffer, then upload to the shared `avatars` bucket.
      const base64 = await readAsStringAsync(asset.uri, { encoding: 'base64' });
      if (base64.length * 0.75 > MAX_AVATAR_BYTES) {
        setError('Image must be under 5MB.');
        return;
      }

      const arrayBuffer = decode(base64);
      const ext = (asset.uri.split('.').pop() ?? 'jpg').split('?')[0].toLowerCase();
      const contentType =
        asset.mimeType ??
        (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
      const path = `profiles/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = async () => {
    setError(null);
    setSkipping(true);
    try {
      await skipOnboarding();
      router.replace('/(tabs)');
    } catch (e) {
      setSkipping(false);
      setError(e instanceof Error ? e.message : 'Could not skip onboarding.');
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setUsernameServerError(null);
    setPasswordError(null);
    setConfirmError(null);
    setSubmitAttempted(true);

    if (!fullName.trim() || !qualification || !courseId || !yearOfStudy || !specializationId) {
      setError('Please fill in all required fields.');
      return;
    }

    // ── Username ──────────────────────────────────────────────────────────
    // Required by the backend since Phase 4; without it onboarding 400s and
    // there is no way past it inside the app.
    const handle = username.trim();
    if (!handle) {
      setUsernameServerError('Pick a username to finish signing up.');
      return;
    }
    if (usernameStatus === 'invalid' || usernameStatus === 'taken' || usernameStatus === 'reserved') {
      // Deliberately sets NO message. The field is already saying the precise
      // thing that is wrong ("At least 3 characters.", "That username is
      // taken."), and replacing that with "choose a different username" trades
      // a specific answer for a vague one. The summary above the button — which
      // reads usernameStatus directly — is what tells them where to look.
      return;
    }
    // 'checking' and 'unknown' are allowed through on purpose. The server
    // checks again and owns the answer; blocking here would strand anyone whose
    // check is slow or offline on a handle that is probably fine.

    // ── Password ──────────────────────────────────────────────────────────
    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setConfirmError('Both passwords must match.');
      return;
    }

    const userId = session?.user?.id ?? profile?.id;
    if (!userId) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    setSaving(true);
    try {
      const data = await api.post<{
        message: string;
        session?: { access_token: string; refresh_token: string };
        userProfile: UserProfile;
      }>(
        '/api/auth/onboarding',
        {
          userId,
          username: handle,
          password,
          full_name: fullName.trim(),
          avatar_url: avatarUrl || null,
          qualification,
          course_id: courseId,
          year_of_study: yearOfStudy,
          specialization_id: specializationId,
          bio: bio.trim() || null,
        },
      );
      // ── Adopt the new session BEFORE anything else. ──
      //
      // Setting a password revokes every existing GoTrue session, including the
      // one that authorised this very request — so the token this app is
      // holding is dead the instant this call returns 200, and its refresh
      // token with it. The endpoint returns a fresh session for exactly this
      // reason (the web has adopted it since Phase 3; mobile did not, which
      // left a brand-new student signed in with a revoked token: the
      // marketplace still rendered because that route is optionalAuth, but the
      // dashboard and messages would 401).
      //
      // onAuthStateChange in AuthContext picks this up and updates `session`.
      if (data.session?.access_token && data.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      // Routing guard sees is_profile_complete and moves into the tabs.
      await saveProfile(data.userProfile);
    } catch (e) {
      // NOTHING is cleared here. Every field keeps what was typed — being made
      // to retype a whole profile because one handle was taken is the worst
      // possible end to a signup, and the password fields are the ones a
      // student is least likely to retype correctly.
      const code = e instanceof Error ? e.message : '';
      const { status } = e as ApiError;
      const copy = SUBMIT_ERROR_COPY[code];

      if (status === 401 || code === 'UNAUTHORIZED') {
        // The session is gone. This is reachable after ANY onboarding failure
        // that got past the password step: the backend sets the password before
        // updating the profile, and GoTrue revokes existing sessions when a
        // password changes — so the token in hand is dead and every retry from
        // this screen is another 401.
        //
        // Sending them back to sign-in is the only exit. The password they just
        // chose IS set on the account, so signing in with it works; staying here
        // retrying does not. See docs/CHANGELOG.md.
        setError('Your session has expired. Please sign in again with your new password.');
        await signOut().catch(() => {});
        router.replace('/(auth)/login');
      } else if (code === 'INVALID_REFERENCE') {
        // The id we sent is not in the database. The lists these ids come from
        // are cached for an hour AND persisted to AsyncStorage, so the phone
        // can hold ids that no longer exist — which is exactly what a
        // `supabase db reset` produces, because courses and specializations are
        // re-created with fresh uuids every time.
        //
        // Dropping the cache turns a dead end into "pick it again": the pickers
        // reload from the server and the next attempt sends live ids. The two
        // selections are cleared because their old values cannot be shown as
        // chosen when the options behind them are gone.
        setCourseId('');
        setSpecializationId('');
        queryClient.invalidateQueries({ queryKey: ['academic'] });
        setError(copy ?? 'Please pick your course and specialization again.');
      } else if (copy && USERNAME_ERRORS.has(code)) {
        // Put it under the field it is about, not in the banner at the top.
        setUsernameServerError(copy);
      } else if (copy && (code === 'WEAK_PASSWORD' || code === 'COMMON_PASSWORD')) {
        setPasswordError(copy);
      } else {
        setError(copy ?? (e instanceof Error && e.message ? e.message : 'Failed to save profile.'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <AuroraBackground />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoider style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formWrapper}>
              <View style={styles.header}>
                <AppText style={styles.title}>Complete Your Profile</AppText>
                <AppText style={styles.subtitle}>
                  Let your campus know who you are{'\n'}before you dive in.
                </AppText>
              </View>

              {isDemoUser ? (
                <Pressable
                  onPress={handleSkip}
                  disabled={busy}
                  style={({ pressed }) => [styles.skipBtn, pressed && styles.skipBtnPressed]}
                >
                  {skipping ? (
                    <ActivityIndicator color={colors.purple} />
                  ) : (
                    <AppText style={styles.skipBtnText}>Skip for now</AppText>
                  )}
                </Pressable>
              ) : null}

              {error ? (
                <View style={styles.banner}>
                  <AppText style={styles.bannerText}>{error}</AppText>
                </View>
              ) : null}
              {listsError ? (
                <View style={styles.banner}>
                  <AppText style={styles.bannerText}>
                    Couldn&apos;t load academic options. Check your connection and try again.
                  </AppText>
                </View>
              ) : null}

              <View style={styles.card}>
                {/* Section 1: Identity */}
                <AppText style={styles.sectionTitle}>Identity</AppText>

                <View style={styles.avatarRow}>
                  <Pressable
                    onPress={handlePickAvatar}
                    disabled={uploading}
                    style={({ pressed }) => [
                      styles.avatarPreview,
                      pressed && styles.avatarPreviewPressed,
                    ]}
                  >
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
                    ) : uploading ? (
                      <ActivityIndicator color={colors.purple} />
                    ) : (
                      <Feather name="user" size={34} color={colors.mutedLabel} />
                    )}
                  </Pressable>
                  <View style={styles.avatarActions}>
                    <Pressable
                      onPress={handlePickAvatar}
                      disabled={uploading}
                      style={({ pressed }) => [
                        styles.uploadBtn,
                        pressed && styles.uploadBtnPressed,
                        uploading && styles.uploadBtnDisabled,
                      ]}
                    >
                      <Feather name="image" size={16} color={colors.purple} />
                      <AppText style={styles.uploadBtnText}>
                        {uploading ? 'Uploading…' : 'Upload Photo (Optional)'}
                      </AppText>
                    </Pressable>
                    <AppText style={styles.helperText}>A real photo builds trust.</AppText>
                  </View>
                </View>

                <View style={styles.group}>
                  <View style={styles.labelRow}>
                    <AppText style={styles.label}>FULL NAME</AppText>
                    <AppText style={styles.required}> *</AppText>
                  </View>
                  <View style={[styles.inputRow, nameFocused && styles.inputRowFocused]}>
                    <Feather name="user" size={18} color={colors.purple} style={styles.inputIcon} />
                    <AppTextInput
                      value={fullName}
                      onChangeText={setFullName}
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                      placeholder="Enter your name"
                      placeholderTextColor={colors.mutedPlaceholder}
                      style={styles.input}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>
                </View>

                {/* Username — required by POST /api/auth/onboarding. */}
                <View style={styles.group}>
                  <View style={styles.labelRow}>
                    <AppText style={styles.label}>USERNAME</AppText>
                    <AppText style={styles.required}> *</AppText>
                  </View>
                  <UsernameField
                    value={username}
                    onChangeText={(next) => {
                      setUsername(next);
                      // The server's verdict was about the PREVIOUS handle. Keep
                      // it on screen and the field contradicts itself: a green
                      // tick above a red "choose a different username", which is
                      // exactly what it did. The live check owns the message
                      // from the first keystroke onwards.
                      setUsernameServerError(null);
                    }}
                    onStatusChange={setUsernameStatus}
                    onSuggestions={setServerSuggestions}
                    serverError={usernameServerError}
                    editable={!busy}
                  />

                  {suggestions.length > 0 ? (
                    <View style={styles.suggestionRow}>
                      {suggestions.map((handle) => (
                        <Pressable
                          key={handle}
                          onPress={() => applySuggestion(handle)}
                          disabled={busy}
                          accessibilityRole="button"
                          accessibilityLabel={`Use the username ${handle}`}
                          style={({ pressed }) => [
                            styles.suggestionChip,
                            pressed && styles.suggestionChipPressed,
                          ]}
                        >
                          <AppText style={styles.suggestionText} numberOfLines={1}>
                            @{handle}
                          </AppText>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>

                {/* Password — also required since Phase 4. It is what lets a
                    student sign in later without waiting for an emailed code. */}
                <View style={styles.group}>
                  <View style={styles.labelRow}>
                    <AppText style={styles.label}>PASSWORD</AppText>
                    <AppText style={styles.required}> *</AppText>
                  </View>
                  <PasswordField
                    value={password}
                    onChangeText={(next) => {
                      setPassword(next);
                      setPasswordError(null);
                    }}
                    placeholder="At least 8 characters"
                    error={passwordError}
                    hint={`Use ${MIN_PASSWORD_LENGTH} characters or more.`}
                    editable={!busy}
                    accessibilityLabel="Password"
                  />
                </View>

                <View style={styles.group}>
                  <View style={styles.labelRow}>
                    <AppText style={styles.label}>CONFIRM PASSWORD</AppText>
                    <AppText style={styles.required}> *</AppText>
                  </View>
                  <PasswordField
                    value={confirmPassword}
                    onChangeText={(next) => {
                      setConfirmPassword(next);
                      setConfirmError(null);
                    }}
                    placeholder="Type it again"
                    error={confirmError ?? liveMismatch}
                    editable={!busy}
                    returnKeyType="done"
                    accessibilityLabel="Confirm password"
                  />
                </View>

                {/* Section 2: Academic Details */}
                <AppText style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
                  Academic Details
                </AppText>

                <SearchablePicker
                  label="Qualification"
                  required
                  leadingIcon="award"
                  options={toOptions(QUALIFICATIONS)}
                  value={qualification}
                  onChange={setQualification}
                  placeholder="Search qualification"
                />

                <SearchablePicker
                  label="Course"
                  required
                  leadingIcon="book-open"
                  options={courseOptions}
                  value={courseId}
                  onChange={setCourseId}
                  placeholder="Search course"
                  loading={coursesQuery.isLoading}
                  style={styles.courseField}
                />

                <SearchablePicker
                  label="Year of Study"
                  required
                  leadingIcon="calendar"
                  options={toOptions(YEARS)}
                  value={yearOfStudy}
                  onChange={setYearOfStudy}
                  placeholder="Search year"
                />

                <SearchablePicker
                  label="Specialization"
                  required
                  leadingIcon="star"
                  options={specOptions}
                  value={specializationId}
                  onChange={setSpecializationId}
                  placeholder="Search specialization"
                  loading={specsQuery.isLoading}
                />

                {/* Section 3: Personal Touch */}
                <AppText style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Personal Touch</AppText>

                <View style={styles.group}>
                  <View style={styles.labelRow}>
                    <AppText style={styles.label}>SHORT BIO</AppText>
                    <AppText style={styles.optional}> (Optional)</AppText>
                    <AppText style={styles.charCount}>{bio.length}/250</AppText>
                  </View>
                  <View style={[styles.textareaWrap, bioFocused && styles.inputRowFocused]}>
                    <AppTextInput
                      value={bio}
                      onChangeText={(v) => setBio(v.slice(0, 250))}
                      onFocus={() => setBioFocused(true)}
                      onBlur={() => setBioFocused(false)}
                      placeholder="e.g., CSE student, into electronics and books."
                      placeholderTextColor={colors.mutedPlaceholder}
                      style={styles.textarea}
                      multiline
                      maxLength={250}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              </View>

              {/* ABOVE the button, not below it.
                  Below, it appeared in space the student could not see without
                  scrolling further down — so pressing Save looked like it did
                  nothing at all. Above, it PUSHES the button down as it appears,
                  which lands it exactly where the eye already is. */}
              {fieldIssues.length > 0 ? (
                <View style={styles.summary}>
                  <Feather name="alert-circle" size={15} color={colors.errorText} />
                  <AppText style={styles.summaryText}>
                    {fieldIssues.length === 1
                      ? `Check the ${fieldIssues[0].toLowerCase()} field above.`
                      : `Check these fields above: ${fieldIssues.join(', ').toLowerCase()}.`}
                  </AppText>
                </View>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={busy || fetchingLists}
                style={({ pressed }) => [
                  styles.submitBtn,
                  (busy || fetchingLists || pressed) && styles.submitBtnPressed,
                ]}
              >
                <LinearGradient
                  colors={BRAND_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitGradient}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <AppText style={styles.submitText}>Save &amp; Enter Yahora</AppText>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoider>

        {/* Rendered last + raised so it stays above the form's elevated card. */}
        <Pressable
          onPress={handleBack}
          disabled={busy || goingBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to login"
          style={({ pressed }) => [styles.backBtn, { top: floatingTop }, pressed && styles.backBtnPressed]}
        >
          {goingBack ? (
            <ActivityIndicator size="small" color={colors.purpleDark} />
          ) : (
            <Feather name="arrow-left" size={22} color={colors.purpleDark} />
          )}
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.auroraBottom,
  },
  safe: { flex: 1 },
  flex: { flex: 1 },

  backBtn: {
    // `top` is applied inline from useFloatingTopInset(): an absolutely
    // positioned child ignores the padding SafeAreaView adds, so a static
    // `top` here slides under the status bar in full-screen mode.
    position: 'absolute',
    left: spacing.lg,
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.purple,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  backBtnPressed: {
    backgroundColor: colors.pinkLight,
    borderColor: colors.inputBorderFocus,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    // Clears the floating back chip (inset + spacing.sm + its 42pt height)
    // so the heading never sits under it.
    paddingTop: spacing.xl + spacing.lg,
    paddingBottom: spacing.xl,
  },
  formWrapper: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },

  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: font.family.serif,
    fontSize: font.sizes.display,
    color: colors.purpleDark,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    lineHeight: 20,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 360,
  },

  skipBtn: {
    alignSelf: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 32,
    backgroundColor: colors.purple,
  },
  skipBtnPressed: {
    backgroundColor: colors.purpleDark,
  },
  skipBtnText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.white,
  },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: colors.errorBg,
  },
  summaryText: {
    flexShrink: 1,
    fontFamily: font.family.medium,
    fontSize: font.sizes.body,
    lineHeight: 18,
    color: colors.errorText,
  },

  banner: {
    backgroundColor: colors.errorBg,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerText: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.body,
    color: colors.errorText,
    textAlign: 'center',
  },

  card: {
    backgroundColor: colors.cardSurface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.lg,
    shadowColor: colors.purple,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  sectionTitle: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.purple,
    marginBottom: spacing.md,
  },
  sectionTitleSpaced: {
    marginTop: spacing.sm,
  },
  courseField: {
    zIndex: 10,
  },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatarPreview: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.inputBorderFocus,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPreviewPressed: {
    borderColor: colors.purple,
    backgroundColor: colors.pinkLight,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarActions: {
    flex: 1,
    gap: 6,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 30,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  uploadBtnPressed: {
    backgroundColor: colors.demoCardPurpleBg,
  },
  uploadBtnDisabled: {
    opacity: 0.6,
  },
  uploadBtnText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.purpleDark,
  },
  helperText: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.caption,
    color: colors.mutedText,
  },

  group: {
    marginBottom: spacing.md,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingLeft: spacing.xs,
  },
  suggestionChip: {
    flexShrink: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 3,
    borderRadius: 999,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  suggestionChipPressed: {
    backgroundColor: colors.demoCardPinkBg,
  },
  suggestionText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.purple,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  label: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.caption,
    letterSpacing: 1,
    color: colors.mutedLabel,
    textTransform: 'uppercase',
  },
  required: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.caption,
    color: colors.pinkDark,
  },
  optional: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.caption,
    color: colors.mutedLabel,
  },
  charCount: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.caption,
    color: colors.mutedLabel,
    marginLeft: 'auto',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md + 4,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputRowFocused: {
    backgroundColor: colors.white,
    borderColor: colors.inputBorderFocus,
  },
  inputIcon: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontFamily: font.family.medium,
    fontSize: font.sizes.bodyLg,
    color: colors.blackSoft,
    paddingVertical: 0,
    minHeight: 44,
  },

  textareaWrap: {
    borderRadius: radius.md + 4,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textarea: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.bodyLg,
    lineHeight: 21,
    color: colors.blackSoft,
    minHeight: 88,
    paddingVertical: spacing.xs,
  },

  submitBtn: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: colors.purple,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  submitBtnPressed: {
    opacity: 0.9,
  },
  submitGradient: {
    paddingVertical: 14,
    paddingHorizontal: spacing.xl + spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
  },
  submitText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.bodyLg,
    color: colors.white,
  },
});
