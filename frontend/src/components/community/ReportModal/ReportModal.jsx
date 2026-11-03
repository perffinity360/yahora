// frontend/src/components/community/ReportModal/ReportModal.jsx
//
// The report form — docs/design/COMMUNITY_SPEC.md §7. All rules live in
// hooks/useReport.js; this file is only the look.
//
// Props
//   postId    the post being reported
//   onSubmit  (body) → Promise<{ status, body }>
//   onClose   (result?) — "sent" after a successful report, so the caller can
//             show spec §7's toast and take the post out of this student's
//             feed; nothing when the student cancels.
//
// "Already reported" and errors stay inside the form, with its choices kept.

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import useReport, { REPORT_REASONS, REPORT_TEXT } from "../../../hooks/useReport";
import { REPORT_DETAILS_MAX } from "../../../utils/community";
import styles from "./ReportModal.module.css";

export default function ReportModal({ postId, onSubmit, onClose }) {
  const r = useReport({ postId });
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !r.sending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, r.sending]);

  const send = async () => {
    const result = await r.submit(onSubmit);
    if (result === "sent") onClose("sent");
  };

  return createPortal(
    <div className={styles.scrim} onClick={() => !r.sending && onClose()}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="report-title" className={styles.title}>
          Report post
        </h2>

        <fieldset className={styles.reasons}>
          <legend className={styles.question}>Why are you reporting this post?</legend>
          {REPORT_REASONS.map(([value, label], i) => (
            <label key={value} className={styles.reason}>
              <input
                ref={i === 0 ? firstRef : undefined}
                type="radio"
                name="report-reason"
                value={value}
                checked={r.reason === value}
                onChange={() => r.setReason(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        {r.showSelfHarmLine && <p className={styles.selfHarm}>{REPORT_TEXT.selfHarm}</p>}

        <textarea
          className={styles.details}
          value={r.details}
          onChange={(e) => r.setDetails(e.target.value)}
          placeholder="Add details (optional) …"
          aria-label="Add details (optional)"
          rows={3}
        />
        {r.detailsLength > REPORT_DETAILS_MAX - 50 && (
          <p className={styles.detailsCount} aria-live="polite">
            {r.detailsLength} / {REPORT_DETAILS_MAX}
          </p>
        )}

        {/* Always visible (spec §7). */}
        <p className={styles.warning}>
          Reports are anonymous and reviewed by the Yahora team. Please report only content that
          breaks our Community Guidelines. Deliberately false reports, or repeated misuse of
          reporting, may lead to restrictions on your account, including suspension. Honest reports
          are always welcome — you won't be penalised if we decide a post doesn't break the rules.
        </p>

        {(r.result === "duplicate" || r.result === "error") && (
          <p className={styles.result} role="alert">
            {r.result === "duplicate" ? REPORT_TEXT.duplicate : REPORT_TEXT.error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            onClick={() => onClose()}
            disabled={r.sending}
          >
            Cancel
          </button>
          <button type="button" className={styles.report} onClick={send} disabled={!r.canSubmit}>
            {r.sending ? "Reporting…" : "Report"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
