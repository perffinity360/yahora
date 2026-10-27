// frontend/src/components/ConfirmDialog/ConfirmDialog.jsx
//
// A yes/no question in Yahora's own look: the Relist, Delete listing and
// "That wasn't me" dialogs (MARK_SOLD_SPEC §3, §4). The web copy of the app's
// mobile/src/components/ConfirmDialog.tsx, so the two read the same (owner,
// 27 Oct): the listing's photo on top with the action's icon on a gradient
// badge, the title in Bree Serif, the explanation, then Cancel and the confirm
// button side by side, the confirm one in the brand gradient (or red, for
// tone "danger").
//
// Rendered only while open; the caller mounts it conditionally. Esc and a
// click on the scrim are Cancel, except while `busy` (a request in flight),
// so its result or its error is never lost.
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import SmartImage from "../SmartImage/SmartImage";
import styles from "./ConfirmDialog.module.css";

/**
 * title, message (a node; wrap a name in <ConfirmDialog.Strong>),
 * confirmLabel, Icon (a lucide component), imageUrl (the listing's first
 * photo; none → a gradient medallion), tone ("brand" | "danger"),
 * busy + busyLabel (the confirm's text while its request runs), error.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  Icon,
  imageUrl,
  tone = "brand",
  busy = false,
  busyLabel,
  error,
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);
  const toneClass = tone === "danger" ? styles.danger : styles.brand;

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, busy]);

  // Keyboard users land on the action; Enter confirms, Esc cancels.
  useEffect(() => {
    confirmRef.current?.focus({ preventScroll: true });
  }, []);

  return createPortal(
    <div className={styles.scrim} onClick={() => !busy && onCancel()}>
      <div
        className={`${styles.card} ${toneClass}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        onClick={(e) => e.stopPropagation()}
      >
        {imageUrl ? (
          <div className={styles.thumbWrap}>
            <SmartImage src={imageUrl} alt="" className={styles.thumb} draggable={false} />
            <span className={styles.badge} aria-hidden="true">
              {Icon && <Icon size={14} strokeWidth={2.4} />}
            </span>
          </div>
        ) : (
          <span className={styles.medallion} aria-hidden="true">
            {Icon && <Icon size={24} strokeWidth={2.2} />}
          </span>
        )}

        <h3 id="confirm-dialog-title" className={styles.title}>
          {title}
        </h3>
        <p id="confirm-dialog-message" className={styles.message}>
          {message}
        </p>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.cancel}`}
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            ref={confirmRef}
            className={`${styles.button} ${styles.confirm}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && busyLabel ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** A name inside a dialog's message, in the darker semibold. */
ConfirmDialog.Strong = function Strong({ children }) {
  return <strong className={styles.strong}>{children}</strong>;
};
