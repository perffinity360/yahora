import Feather from '@expo/vector-icons/Feather';
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, font, radius, spacing } from '../theme';

/** The backend's own floor (MIN_PASSWORD_LENGTH in auth.controller.js). */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * A password input with a show/hide toggle.
 *
 * Deliberately dumb: it holds no value of its own beyond whether the characters
 * are currently visible, and it never stores, caches or logs what is typed. The
 * value lives in the calling screen's state and dies with that screen — plan
 * rule 14. Nothing here writes to AsyncStorage.
 *
 * ⚠ `contextMenuHidden` is NOT set, and must not be. Hiding the context menu
 * blocks paste, which breaks every password manager — the students most likely
 * to use a strong, unique password are exactly the ones it would lock out. The
 * threat it defends against (someone reading a clipboard) is not one we have.
 *
 * Shared by onboarding and, from Block V-D, the login screen — which is why the
 * label, autoComplete hint and keyboard return key are all props rather than
 * being hardcoded for the sign-up case.
 */
export const PasswordField = forwardRef<TextInput, {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  /** `new-password` on sign-up, `current-password` on login. */
  autoComplete?: 'new-password' | 'current-password' | 'password';
  textContentType?: 'newPassword' | 'password';
  returnKeyType?: 'next' | 'done' | 'go';
  onSubmitEditing?: () => void;
  editable?: boolean;
  /** A sentence under the field. Red — callers pass validation failures here. */
  error?: string | null;
  /** A neutral sentence under the field, shown only when `error` is absent. */
  hint?: string | null;
  accessibilityLabel?: string;
}>(function PasswordField(
  {
    value,
    onChangeText,
    placeholder = 'Enter a password',
    autoComplete = 'new-password',
    textContentType = 'newPassword',
    returnKeyType = 'next',
    onSubmitEditing,
    editable = true,
    error,
    hint,
    accessibilityLabel = 'Password',
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <Feather name="lock" size={18} color={colors.purple} style={styles.inputIcon} />
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedPlaceholder}
          style={styles.input}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          accessibilityLabel={accessibilityLabel}
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          accessibilityState={{ selected: visible }}
        >
          <Feather name={visible ? 'eye-off' : 'eye'} size={18} color={colors.mutedText} />
        </Pressable>
      </View>

      {error ? (
        <Text style={[styles.status, styles.statusError]}>{error}</Text>
      ) : hint ? (
        <Text style={styles.status}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  // Same height, radius, fill and focus border as every other input on the
  // onboarding form.
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
  inputIcon: { marginRight: 2 },
  input: {
    flex: 1,
    fontFamily: font.family.medium,
    fontSize: 15,
    color: colors.blackSoft,
    paddingVertical: 0,
    minHeight: 44,
  },
  status: {
    fontFamily: font.family.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedText,
    marginTop: spacing.xs + 2,
    marginLeft: spacing.xs,
  },
  statusError: { color: colors.errorText },
});

export default PasswordField;
