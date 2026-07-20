import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
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

import { AuroraBackground } from '../src/components/AuroraBackground';
import { SearchablePicker } from '../src/components/SearchablePicker';
import { useAuth } from '../src/contexts/AuthContext';
import { useCourses, useSpecializations } from '../src/hooks/useAcademics';
import { useDashboard } from '../src/hooks/useDashboard';
import { api } from '../src/lib/api';
import { colors, font, radius, spacing } from '../src/theme';
import type { UserProfile } from '../src/types';

const BRAND_GRADIENT = [colors.purple, colors.pinkDark] as const;

// Same academic option lists the onboarding form uses.
const QUALIFICATIONS = [
  'PhD',
  'Post Graduation',
  'Graduation',
  'Intermediate (12th)',
  'High School (10th)',
];
const YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year'];

const toOptions = (values: string[]) => values.map((v) => ({ label: v, value: v }));

/** Editable profile fields, in the shape the PUT /profile endpoint accepts. */
interface ProfileDraft {
  full_name: string;
  qualification: string;
  year_of_study: string;
  course_id: string;
  specialization_id: string;
  bio: string | null;
}

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile: authProfile, saveProfile } = useAuth();
  const userId = authProfile?.id;

  // Prefer the dashboard payload (fresh from the server) over the cached auth
  // profile; both carry the raw course/specialization ids the pickers need.
  const { data: dash } = useDashboard(userId);
  const base = dash?.profile ?? authProfile;

  const coursesQuery = useCourses();
  const specsQuery = useSpecializations();
  const fetchingLists = coursesQuery.isLoading || specsQuery.isLoading;
  const listsError = coursesQuery.isError || specsQuery.isError;

  const courseOptions = (coursesQuery.data ?? []).map((c) => ({ label: c.name, value: c.id }));
  const specOptions = (specsQuery.data ?? []).map((s) => ({ label: s.name, value: s.id }));

  const [fullName, setFullName] = useState(base?.full_name ?? '');
  const [qualification, setQualification] = useState(base?.qualification ?? '');
  const [yearOfStudy, setYearOfStudy] = useState(base?.year_of_study ?? '');
  const [courseId, setCourseId] = useState(base?.course_id ?? '');
  const [specializationId, setSpecializationId] = useState(base?.specialization_id ?? '');
  const [bio, setBio] = useState(base?.bio ?? '');

  // Snapshot of what the profile looked like when the screen opened, so Save
  // only sends the fields that actually changed.
  const initial = useRef<ProfileDraft>({
    full_name: base?.full_name ?? '',
    qualification: base?.qualification ?? '',
    year_of_study: base?.year_of_study ?? '',
    course_id: base?.course_id ?? '',
    specialization_id: base?.specialization_id ?? '',
    bio: base?.bio ?? null,
  });

  const [nameFocused, setNameFocused] = useState(false);
  const [bioFocused, setBioFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The root layout renders a <Slot/>, which unmounts the tab navigator while
  // this screen is on top — so router.back() re-mounts the tabs at their initial
  // route (Marketplace). Edit Profile is only opened from the dashboard, so both
  // the back arrow and a completed Save should land the user back there.
  const goBack = () => router.replace('/(tabs)/profile');

  const handleSave = async () => {
    setError(null);
    if (!fullName.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!userId) {
      setError('Your session has expired. Please sign in again.');
      return;
    }

    const draft: ProfileDraft = {
      full_name: fullName.trim(),
      qualification,
      year_of_study: yearOfStudy,
      course_id: courseId,
      specialization_id: specializationId,
      bio: bio.trim() || null,
    };

    // Only ship what changed (mirrors the web dashboard's per-field saves).
    const changes: Partial<ProfileDraft> = {};
    (Object.keys(draft) as (keyof ProfileDraft)[]).forEach((k) => {
      if (draft[k] !== initial.current[k] && draft[k] !== '') {
        (changes as Record<string, unknown>)[k] = draft[k];
      }
    });
    if (draft.bio !== initial.current.bio) changes.bio = draft.bio;

    if (!Object.keys(changes).length) {
      goBack();
      return;
    }

    setSaving(true);
    try {
      const data = await api.put<{ message: string; userProfile: UserProfile }>(
        `/api/user/${userId}/profile`,
        changes,
      );
      await saveProfile(data.userProfile);
      await queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['publicProfile', userId] });
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save your changes.');
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
                <Text style={styles.title}>Edit Your Profile</Text>
                <Text style={styles.subtitle}>
                  Keep your campus identity fresh —{'\n'}changes show up everywhere instantly.
                </Text>
              </View>

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
                <Text style={styles.sectionTitle}>Identity</Text>

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

                <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
                  Academic Details
                </Text>

                <SearchablePicker
                  label="Qualification"
                  leadingIcon="award"
                  options={toOptions(QUALIFICATIONS)}
                  value={qualification}
                  onChange={setQualification}
                  placeholder="Search qualification"
                />

                <SearchablePicker
                  label="Course"
                  leadingIcon="book-open"
                  options={courseOptions}
                  value={courseId}
                  onChange={setCourseId}
                  placeholder="Search course"
                  loading={coursesQuery.isLoading}
                />

                <SearchablePicker
                  label="Year of Study"
                  leadingIcon="calendar"
                  options={toOptions(YEARS)}
                  value={yearOfStudy}
                  onChange={setYearOfStudy}
                  placeholder="Search year"
                />

                <SearchablePicker
                  label="Specialization"
                  leadingIcon="star"
                  options={specOptions}
                  value={specializationId}
                  onChange={setSpecializationId}
                  placeholder="Search specialization"
                  loading={specsQuery.isLoading}
                />

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
                onPress={handleSave}
                disabled={saving || fetchingLists}
                style={({ pressed }) => [
                  styles.submitBtn,
                  (saving || fetchingLists || pressed) && styles.submitBtnPressed,
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
                    <Text style={styles.submitText}>Save Changes</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Rendered last + raised so it stays above the form's elevated card. */}
        <Pressable
          onPress={goBack}
          disabled={saving}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <Feather name="arrow-left" size={22} color={colors.purpleDark} />
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
