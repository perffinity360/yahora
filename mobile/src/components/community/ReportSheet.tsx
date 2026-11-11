import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Reanimated, { ZoomIn } from 'react-native-reanimated';

import { AppText } from '../AppText';
import { AppTextInput } from '../AppTextInput';
import { KeyboardAvoider } from '../KeyboardAvoider';
import { useReportPost } from '../../hooks/useCommunity';
import type { ApiError } from '../../lib/api';
import { codePointLength, REPORT_DETAILS_MAX } from '../../lib/community';
import { colors, font, shadows } from '../../theme';
import type { PostItem } from '../../types';

/**
 * The report form — COMMUNITY_SPEC.md §7, exactly:
 *   · the 11 reasons, in the spec's order; Report stays off until one is picked;
 *   · optional details, at most 500 characters (code points);
 *   · the warning paragraph, always visible; the extra line for self-harm;
 *   · sent: the caller shows the toast and the post leaves this student's lists;
 *     already reported, or any failure: a line inside the form, choices kept.
 * The outcome of the review is never shown (runbook §1.7).
 *
 * The website's twin is frontend/src/components/community/ReportModal with
 * hooks/useReport.js: same reasons, same words.
 */
export const REPORT_REASONS: [string, string][] = [
  ['spam', 'Spam'],
  ['harassment', 'Harassment or bullying'],
  ['hate_speech', 'Hate speech'],
  ['sexual_content', 'Sexual content'],
  ['child_safety', 'Child safety'],
  ['violence', 'Violence or threats'],
  ['self_harm', 'Self-harm or suicide'],
  ['impersonation', 'Impersonation'],
  ['misinformation', 'False information'],
  ['prohibited_item', 'Prohibited item'],
  ['other', 'Something else'],
];

export const REPORT_TEXT = {
  sent: 'Thanks for letting us know. Our team will review this.',
  duplicate: "You've already reported this post.",
  error: "Couldn't send. Try again.",
  selfHarm: 'If someone is in immediate danger, contact local emergency services.',
};

/** Cut to the limit by code points, so an emoji is never split in half. */
const clip = (value: string) => {
  const chars = [...value];
  return chars.length > REPORT_DETAILS_MAX ? chars.slice(0, REPORT_DETAILS_MAX).join('') : value;
};

export function ReportSheet({ post, onClose }: { post: PostItem; onClose: (sent?: boolean) => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [result, setResult] = useState<'duplicate' | 'error' | null>(null);
  const report = useReportPost();
  const sending = report.isPending;
  const length = codePointLength(details);

  const send = () => {
    if (!reason || sending) return;
    setResult(null);
    report.mutate(
      { post, reason, details },
      {
        onSuccess: () => onClose(true),
        onError: (err) => {
          const e = err as ApiError;
          setResult(e?.fromApi && e.body?.error === 'DUPLICATE' ? 'duplicate' : 'error');
        },
      },
    );
  };

  const cancel = () => {
    if (!sending) onClose();
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={cancel}>
      <KeyboardAvoider fillsModal style={styles.root}>
        <Pressable style={styles.scrim} onPress={cancel} accessibilityLabel="Cancel" />
        <Reanimated.View entering={ZoomIn.springify().damping(18).stiffness(240)} style={styles.card} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <AppText style={styles.title} accessibilityRole="header">
              Report post
            </AppText>
            <AppText style={styles.question}>Why are you reporting this post?</AppText>

            <View accessibilityRole="radiogroup">
              {REPORT_REASONS.map(([value, label]) => {
                const on = reason === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setReason(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={({ pressed }) => [styles.reason, pressed && styles.reasonPressed]}
                  >
                    <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                    <AppText style={styles.reasonText}>{label}</AppText>
                  </Pressable>
                );
              })}
            </View>

            {reason === 'self_harm' ? <AppText style={styles.selfHarm}>{REPORT_TEXT.selfHarm}</AppText> : null}

            <AppTextInput
              value={details}
              onChangeText={(v) => setDetails(clip(v))}
              placeholder="Add details (optional) …"
              placeholderTextColor={colors.mutedLabel}
              accessibilityLabel="Add details (optional)"
              multiline
              textAlignVertical="top"
              style={styles.details}
            />
            {length > REPORT_DETAILS_MAX - 50 ? (
              <AppText style={styles.detailsCount}>
                {length} / {REPORT_DETAILS_MAX}
              </AppText>
            ) : null}

            {/* Always visible (spec §7). */}
            <AppText style={styles.warning}>
              Reports are anonymous and reviewed by the Yahora team. Please report only content that breaks our
              Community Guidelines. Deliberately false reports, or repeated misuse of reporting, may lead to
              restrictions on your account, including suspension. Honest reports are always welcome — you won't be
              penalised if we decide a post doesn't break the rules.
            </AppText>

            {result ? (
              <AppText style={styles.result} accessibilityLiveRegion="polite">
                {result === 'duplicate' ? REPORT_TEXT.duplicate : REPORT_TEXT.error}
              </AppText>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                onPress={cancel}
                disabled={sending}
                accessibilityRole="button"
                style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.pressed]}
              >
                <AppText style={styles.cancelText}>Cancel</AppText>
              </Pressable>
              <Pressable
                onPress={send}
                disabled={!reason || sending}
                accessibilityRole="button"
                accessibilityState={{ disabled: !reason || sending, busy: sending }}
                style={({ pressed }) => [
                  styles.button,
                  styles.report,
                  (!reason || sending) && styles.reportOff,
                  pressed && styles.pressed,
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <AppText style={styles.reportText}>Report</AppText>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Reanimated.View>
      </KeyboardAvoider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '88%',
    borderRadius: 12,
    backgroundColor: colors.white,
    boxShadow: shadows.quickBar,
    overflow: 'hidden',
  },
  content: { paddingVertical: 14, paddingHorizontal: 16 },
  title: { fontFamily: font.family.serif, fontSize: 17, lineHeight: 22, color: colors.blackSoft },
  question: {
    marginTop: 6,
    marginBottom: 4,
    fontFamily: font.family.medium,
    fontSize: font.sizes.body,
    color: colors.blackSoft,
  },
  // 28 to look at (spec §7), 36 to touch.
  reason: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 10 },
  reasonPressed: { opacity: 0.6 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.mutedLabel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.purple },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.purple },
  reasonText: { fontFamily: font.family.regular, fontSize: font.sizes.body, color: colors.blackSoft },
  selfHarm: {
    marginTop: 6,
    fontFamily: font.family.medium,
    fontSize: font.sizes.body,
    lineHeight: 18,
    color: colors.errorText,
  },
  details: {
    marginTop: 10,
    minHeight: 72,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    lineHeight: 18,
    color: colors.blackSoft,
  },
  detailsCount: {
    alignSelf: 'flex-end',
    marginTop: 4,
    fontFamily: font.family.regular,
    fontSize: font.sizes.micro,
    color: colors.communityMuted,
  },
  warning: {
    marginTop: 10,
    fontFamily: font.family.regular,
    fontSize: font.sizes.micro,
    lineHeight: 16,
    color: colors.communityMuted,
  },
  result: { marginTop: 10, fontFamily: font.family.medium, fontSize: font.sizes.body, color: colors.errorText },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  button: { height: 32, minWidth: 84, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: colors.inputBg },
  cancelText: { fontFamily: font.family.semibold, fontSize: font.sizes.body, color: colors.blackSoft },
  report: { backgroundColor: colors.errorText },
  reportOff: { opacity: 0.45 },
  reportText: { fontFamily: font.family.semibold, fontSize: font.sizes.body, color: colors.white },
  pressed: { transform: [{ scale: 0.97 }] },
});
