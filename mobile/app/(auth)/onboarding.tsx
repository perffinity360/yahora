import Feather from '@expo/vector-icons/Feather';
import { decode } from 'base64-arraybuffer';
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuroraBackground } from '../../src/components/AuroraBackground';
import { SearchablePicker } from '../../src/components/SearchablePicker';
import { useAuth } from '../../src/contexts/AuthContext';
import { useCourses, useSpecializations } from '../../src/hooks/useAcademics';
import { api } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { colors, font, radius, spacing } from '../../src/theme';
import type { UserProfile } from '../../src/types';

const BRAND_GRADIENT = [colors.purple, colors.pinkDark] as const;
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
  const { session, profile, isDemoUser, saveProfile, skipOnboarding, signOut } = useAuth();

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

  const [nameFocused, setNameFocused] = useState(false);
  const [bioFocused, setBioFocused] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [goingBack, setGoingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = saving || skipping;

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
    if (!fullName.trim() || !qualification || !courseId || !yearOfStudy || !specializationId) {
      setError('Please fill in all required fields.');
      return;
    }

    const userId = session?.user?.id ?? profile?.id;
    if (!userId) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    setSaving(true);
    try {
      const data = await api.post<{ message: string; userProfile: UserProfile }>(
        '/api/auth/onboarding',
        {
          userId,
          full_name: fullName.trim(),
          avatar_url: avatarUrl || null,
          qualification,
          course_id: courseId,
          year_of_study: yearOfStudy,
          specialization_id: specializationId,
          bio: bio.trim() || null,
        },
      );
      // Routing guard sees is_profile_complete and moves into the tabs.
      await saveProfile(data.userProfile);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <AuroraBackground />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formWrapper}>
              <View style={styles.header}>
                <Text style={styles.title}>Complete Your Profile</Text>
                <Text style={styles.subtitle}>
                  Let your campus know who you are{'\n'}before you dive in.
                </Text>
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
                    <Text style={styles.skipBtnText}>Skip for now</Text>
                  )}
                </Pressable>
              ) : null}

              {error ? (
                <View style={styles.banner}>
                  <Text style={styles.bannerText}>{error}</Text>
                </View>
              ) : null}
              {listsError ? (
                <View style={styles.banner}>
                  <Text style={styles.bannerText}>
                    Couldn&apos;t load academic options. Check your connection and try again.
                  </Text>
                </View>
              ) : null}

              <View style={styles.card}>
                {/* Section 1: Identity */}
                <Text style={styles.sectionTitle}>Identity</Text>

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
                      <Text style={styles.uploadBtnText}>
                        {uploading ? 'Uploading…' : 'Upload Photo (Optional)'}
                      </Text>
                    </Pressable>
                    <Text style={styles.helperText}>A real photo builds trust.</Text>
                  </View>
                </View>

                <View style={styles.group}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>FULL NAME</Text>
                    <Text style={styles.required}> *</Text>
                  </View>
                  <View style={[styles.inputRow, nameFocused && styles.inputRowFocused]}>
                    <Feather name="user" size={18} color={colors.purple} style={styles.inputIcon} />
                    <TextInput
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

                {/* Section 2: Academic Details */}
                <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
                  Academic Details
                </Text>

                <SearchablePicker
                  label="Qualification"
                  required
                  searchable={false}
                  leadingIcon="award"
                  options={toOptions(QUALIFICATIONS)}
                  value={qualification}
                  onChange={setQualification}
                  placeholder="Select qualification"
                />

                <SearchablePicker
                  label="Year of Study"
                  required
                  searchable={false}
                  leadingIcon="calendar"
                  options={toOptions(YEARS)}
                  value={yearOfStudy}
                  onChange={setYearOfStudy}
                  placeholder="Select year"
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
                <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Personal Touch</Text>

                <View style={styles.group}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>SHORT BIO</Text>
                    <Text style={styles.optional}> (Optional)</Text>
                    <Text style={styles.charCount}>{bio.length}/250</Text>
                  </View>
                  <View style={[styles.textareaWrap, bioFocused && styles.inputRowFocused]}>
                    <TextInput
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
                    <Text style={styles.submitText}>Save &amp; Enter Yahora</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Rendered last + raised so it stays above the form's elevated card. */}
        <Pressable
          onPress={handleBack}
          disabled={busy || goingBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to login"
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
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
    position: 'absolute',
    top: spacing.sm,
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
    paddingVertical: spacing.xl,
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
    fontSize: 28,
    color: colors.purpleDark,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: font.family.regular,
    fontSize: 14,
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
    fontSize: 13,
    color: colors.white,
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
    fontSize: 13,
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
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.purple,
    marginBottom: spacing.md,
  },
  sectionTitleSpaced: {
    marginTop: spacing.sm,
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
    fontSize: 13,
    color: colors.purpleDark,
  },
  helperText: {
    fontFamily: font.family.regular,
    fontSize: 12,
    color: colors.mutedText,
  },

  group: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  label: {
    fontFamily: font.family.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.mutedLabel,
    textTransform: 'uppercase',
  },
  required: {
    fontFamily: font.family.bold,
    fontSize: 11,
    color: colors.pinkDark,
  },
  optional: {
    fontFamily: font.family.regular,
    fontSize: 11,
    color: colors.mutedLabel,
  },
  charCount: {
    fontFamily: font.family.medium,
    fontSize: 11,
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
    fontSize: 15,
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
    fontSize: 15,
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
    fontSize: 16,
    color: colors.white,
  },
});
