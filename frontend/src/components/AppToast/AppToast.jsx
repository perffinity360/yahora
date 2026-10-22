// frontend/src/components/AppToast/AppToast.jsx
//
// The small dark pill of MESSAGES_SPEC §10.7: "Copied", and the other short
// messages of §10.6 and §10.8. Centred in its positioned parent, `bottom` px
// above that parent's bottom edge. Shows for COPY_TOAST_MS, fading in and out
// over 150 ms. Always mounted, so it can fade out as well as in.

import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./AppToast.module.css";
import { COPY_TOAST_MS } from "../../utils/messageActions";

/* const { toast, showToast } = useToast(); showToast("Copied");
   A second call while one shows replaces its text and restarts the clock. */
export function useToast() {
  const [toast, setToast] = useState({ text: "", visible: false });
  const timerRef = useRef(null);

  const showToast = useCallback((text) => {
    clearTimeout(timerRef.current);
    setToast({ text, visible: true });
    timerRef.current = setTimeout(
      () => setToast((t) => ({ ...t, visible: false })),
      COPY_TOAST_MS,
    );
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { toast, showToast };
}

export default function AppToast({ toast, bottom = 16 }) {
  return (
    <div
      className={`${styles.toast} ${toast.visible ? styles.visible : ""}`}
      style={{ bottom }}
      role="status"
      aria-live="polite"
    >
      {toast.text}
    </div>
  );
}
