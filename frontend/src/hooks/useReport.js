// frontend/src/hooks/useReport.js
//
// The report form's behaviour — spec §7 — with no markup:
//   · the reason (one of REPORT_REASONS, in the spec's order) and optional
//     details, at most REPORT_DETAILS_MAX code points (runbook §1.12);
//   · canSubmit once a reason is picked;
//   · submit(onSubmit) and what the answer means.
//
// `onSubmit` is passed in from outside (the dev sandbox's sample answer now,
// POST /api/reports in CC-N4c):
//
//   onSubmit(body) → Promise<{ status, body }>
//   body = { target_type: "post", target_id, reason, details? }
//
// The answer becomes `result`:
//   "sent"       201 — the toast, and the post leaves this student's feed
//   "duplicate"  400 DUPLICATE — "You've already reported this post."
//   "error"      anything else, or no answer — "Couldn't send. Try again."
// The outcome of the review is never shown to the reporter (spec §7).

import { useCallback, useState } from "react";
import { REPORT_DETAILS_MAX, codePointLength } from "../utils/community";

/** Spec §7, in its order: the API value and the words a student sees. */
export const REPORT_REASONS = [
  ["spam", "Spam"],
  ["harassment", "Harassment or bullying"],
  ["hate_speech", "Hate speech"],
  ["sexual_content", "Sexual content"],
  ["child_safety", "Child safety"],
  ["violence", "Violence or threats"],
  ["self_harm", "Self-harm or suicide"],
  ["impersonation", "Impersonation"],
  ["misinformation", "False information"],
  ["prohibited_item", "Prohibited item"],
  ["other", "Something else"],
];

export const REPORT_TEXT = {
  sent: "Thanks for letting us know. Our team will review this.",
  duplicate: "You've already reported this post.",
  error: "Couldn't send. Try again.",
  selfHarm: "If someone is in immediate danger, contact local emergency services.",
};

/* Cut to the limit by code points, so an emoji is never split in half. */
const clip = (value) => {
  const chars = [...value];
  return chars.length > REPORT_DETAILS_MAX ? chars.slice(0, REPORT_DETAILS_MAX).join("") : value;
};

export default function useReport({ postId }) {
  const [reason, setReason] = useState(null);
  const [details, setDetailsRaw] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const setDetails = useCallback((value) => setDetailsRaw(clip(value ?? "")), []);

  const canSubmit = reason !== null && !sending;

  const submit = useCallback(
    async (onSubmit) => {
      if (reason === null || sending) return null;
      setSending(true);
      setResult(null);
      const trimmed = details.trim();
      const body = {
        target_type: "post",
        target_id: postId,
        reason,
        ...(trimmed ? { details: trimmed } : {}),
      };
      let next = "error";
      try {
        const answer = (await onSubmit(body)) ?? {};
        if (answer.status === 201) next = "sent";
        else if (answer.status === 400 && answer.body?.error === "DUPLICATE") next = "duplicate";
      } catch {
        next = "error";
      } finally {
        setSending(false);
      }
      setResult(next);
      return next;
    },
    [reason, details, sending, postId],
  );

  return {
    reason,
    setReason,
    details,
    setDetails,
    detailsLength: codePointLength(details),
    showSelfHarmLine: reason === "self_harm",
    canSubmit,
    sending,
    submit,
    result,
  };
}
