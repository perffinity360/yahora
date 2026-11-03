// frontend/src/components/community/Composer/SupportCard.jsx
//
// Spec §2.4: shown instead of the "being checked" toast when a held post
// showed signs of self-harm. Calm, never a punishment; the number and the
// link are tappable.

import React from "react";
import styles from "./Composer.module.css";

export default function SupportCard({ onClose }) {
  return (
    <section className={styles.support} role="status" aria-labelledby="composer-support-title">
      <span className={styles.supportIcon} aria-hidden="true">💜</span>
      <div className={styles.supportBody}>
        <h3 id="composer-support-title" className={styles.supportTitle}>
          You're not alone
        </h3>
        <p>If you're going through something difficult, talking to someone can help.</p>
        <p>
          India: Tele-MANAS — call <a href="tel:14416">14416</a> (free, any time)
        </p>
        <p>
          Anywhere else:{" "}
          <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">
            findahelpline.com
          </a>
        </p>
        <div className={styles.supportActions}>
          <button type="button" className={styles.supportClose} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </section>
  );
}
