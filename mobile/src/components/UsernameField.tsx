import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';
import { AppTextInput } from './AppTextInput';
import { api } from '../lib/api';
import { colors, font, radius, spacing } from '../theme';
import type { UsernameAvailability } from '../types';

/**
 * What the field currently knows about the handle in it.
 *
 * `reserved` is kept separate from `taken` because the server distinguishes
 * them, but both render the SAME sentence — see the note on STATUS_COPY.
 */
export type UsernameStatus =
  | 'idle'
  | 'invalid'
  | 'checking'
  | 'available'
  | 'taken'
  | 'reserved'
  | 'unknown';

/** Debounce before asking the server. Matches the web's onboarding page. */
const CHECK_DEBOUNCE_MS = 400;

const MIN_LENGTH = 3;
const MAX_LENGTH = 25;

/**
 * The charset rule, mirroring the database's own CHECK constraint (migration
 * 005 §3) so the field refuses locally what Postgres would refuse anyway.
 */
const SHAPE = /^[a-z][a-z0-9._-]*$/;
/** Two separators in a row — migration 009. `a..b` and `a._b` are both out. */
const DOUBLE_SEPARATOR = /[._-]{2}/;

/**
 * Local validation, run before a request is ever sent.
 *
 * Returns null when the handle is worth asking the server about, or a sentence
 * saying what to change. The messages name the specific rule broken rather than
 * restating all of them: "3 to 25 characters" is not useful feedback to someone
 * who typed a capital letter.
 */
export function validateUsernameShape(handle: string): string | null {
  if (handle.length < MIN_LENGTH) return `At least ${MIN_LENGTH} characters.`;
  if (handle.length > MAX_LENGTH) return `At most ${MAX_LENGTH} characters.`;
  if (!/^[a-z]/.test(handle)) return 'Must start with a letter.';
  if (!SHAPE.test(handle)) return 'Letters, numbers, dots, dashes and underscores only.';
  if (DOUBLE_SEPARATOR.test(handle)) return 'No two dots, dashes or underscores in a row.';
  return null;
}

/**
 * The sentence shown under the field for each status.
 *
 * `taken` and `reserved` deliberately share their copy. The server tells them
 * apart, and API.md settles that the CLIENT must not: rendering "that handle is
 * reserved" hands anyone probing a map of the reserved list. Same sentence, no
 * signal.
 */
const STATUS_COPY: Record<Exclude<UsernameStatus, 'idle' | 'invalid'>, string> = {
  checking: 'Checking availability…',
  available: 'That username is available.',
  taken: 'That username is taken. Try another.',
  reserved: 'That username is taken. Try another.',
  unknown: "Couldn't check right now — you can still continue.",
};

/**
 * The username input: folds to lowercase as you type, validates locally, then
 * asks the server whether the handle is free.
 *
 * The value is owned by the parent (controlled) but the CHECK lives here, so a
 * screen only has to render the field and watch `onStatusChange`. Setting the
 * value from outside — tapping a suggestion, for instance — re-runs the check
 * on its own, because the effect below keys off the value.
 */
export function UsernameField({
  value,
  onChangeText,
  onStatusChange,
  onSuggestions,
  serverError,
  editable = true,
}: {
  value: string;
  onChangeText: (next: string) => void;
  /** Lets the screen block submit until the handle is known to be good. */
  onStatusChange?: (status: UsernameStatus) => void;
  /** Alternatives the server offers when the handle is unavailable. */
  onSuggestions?: (suggestions: string[]) => void;
  /** A username error from the SUBMIT response, which outranks the live check. */
  serverError?: string | null;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const [localError, setLocalError] = useState<string | null>(null);

  /**
   * Monotonic request id.
   *
   * The debounce collapses a burst of keystrokes; it does NOT order the
   * responses that do go out. Type, pause, type again and two checks are in
   * flight — if the first is slower, its answer lands last and overwrites the
   * newer one, telling the student a handle is free when it is not. Every
   * response is checked against this before it is allowed to set state.
   */
  const requestId = useRef(0);

  // Report status upward without making the parent a dependency of the effect
  // that sets it — a parent that re-creates the callback each render would
  // otherwise re-trigger the check on every keystroke.
  const statusCb = useRef(onStatusChange);
  const suggestionsCb = useRef(onSuggestions);
  statusCb.current = onStatusChange;
  suggestionsCb.current = onSuggestions;

  const apply = (next: UsernameStatus) => {
    setStatus(next);
    statusCb.current?.(next);
  };

  useEffect(() => {
    const handle = value.trim();

    if (!handle) {
      setLocalError(null);
      apply('idle');
      suggestionsCb.current?.([]);
      return;
    }

    // Local rules first: a handle that cannot be valid is not worth a round
    // trip, and answering instantly is better feedback than a spinner.
    const shapeError = validateUsernameShape(handle);
    if (shapeError) {
      setLocalError(shapeError);
      apply('invalid');
      suggestionsCb.current?.([]);
      // Bump the id so a check already in flight for an older, valid handle
      // cannot land after this and claim the field is fine.
      requestId.current += 1;
      return;
    }

    setLocalError(null);
    apply('checking');

    const timer = setTimeout(() => {
      const id = ++requestId.current;

      api
        .get<UsernameAvailability>(
          `/api/users/username-available?username=${encodeURIComponent(handle)}`,
        )
        .then((data) => {
          if (id !== requestId.current) return; // a newer keystroke won
          if (data?.available) {
            apply('available');
            suggestionsCb.current?.([]);
            return;
          }
          const reason = data?.reason;
          apply(reason === 'RESERVED' ? 'reserved' : reason === 'INVALID_FORMAT' ? 'invalid' : 'taken');
          if (reason === 'INVALID_FORMAT') setLocalError('That username is not allowed.');
          suggestionsCb.current?.(
            Array.isArray(data?.suggestions) ? data.suggestions.filter(Boolean).slice(0, 3) : [],
          );
        })
        .catch(() => {
          if (id !== requestId.current) return;
          // Offline or the server is unhappy. Not the student's problem and not
          // a reason to block them — the backend checks again on submit.
          apply('unknown');
          suggestionsCb.current?.([]);
        });
    }, CHECK_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value]);

  // Submit-time errors outrank the live check: the handle can be taken in the
  // gap between the check passing and the student pressing the button.
  // 'idle' and 'invalid' have no canned copy: idle says nothing, and invalid
  // always carries a specific reason in `localError`, which is more useful than
  // a generic line would be.
  const message =
    serverError ??
    localError ??
    (status === 'idle' || status === 'invalid' ? null : STATUS_COPY[status]);
  const tone =
    serverError || status === 'invalid' || status === 'taken' || status === 'reserved'
      ? 'error'
      : status === 'available'
        ? 'ok'
        : 'muted';

  return (
    <View>
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        <Feather name="at-sign" size={18} color={colors.purple} style={styles.inputIcon} />
        <AppTextInput
          value={value}
          // Folded, not rejected. Someone typing a capital is not making a
          // mistake worth an error message — the handle is simply lowercase, so
          // make it lowercase and let them carry on.
          onChangeText={(next) => onChangeText(next.toLowerCase().trim())}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="your.handle"
          placeholderTextColor={colors.mutedPlaceholder}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username-new"
          textContentType="username"
          editable={editable}
          returnKeyType="next"
          maxLength={MAX_LENGTH}
        />
        {status === 'checking' ? (
          <ActivityIndicator size="small" color={colors.purple} />
        ) : status === 'available' ? (
          <Feather name="check-circle" size={18} color={colors.successText} />
        ) : tone === 'error' ? (
          <Feather name="alert-circle" size={18} color={colors.errorText} />
        ) : null}
      </View>

      {message ? (
        <AppText
          style={[
            styles.status,
            tone === 'ok' && styles.statusOk,
            tone === 'error' && styles.statusError,
          ]}
        >
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches the screen's other inputs exactly — same height, radius, fill and
  // focus border — so this does not read as a component bolted on later.
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
    fontSize: font.sizes.bodyLg,
    color: colors.blackSoft,
    paddingVertical: 0,
    minHeight: 44,
  },
  status: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.caption,
    lineHeight: 17,
    color: colors.mutedText,
    marginTop: spacing.xs + 2,
    marginLeft: spacing.xs,
  },
  statusOk: { color: colors.successText },
  statusError: { color: colors.errorText },
});

export default UsernameField;
