// frontend/src/components/community/AnimatedIcons/AnimatedIcons.jsx
//
// The two feed icons, in place of the 🏫 and 🌍 emoji (spec §1.1): the same
// paths as lucide's GraduationCap and Globe, drawn in when they first appear.
// Hovering the panel header gives the cap a small hop and turns the globe.
// With reduced motion they simply sit still.

import React from "react";
import styles from "./AnimatedIcons.module.css";

function Svg({ size, className, children }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${styles.icon} ${className ?? ""}`}
    >
      {children}
    </svg>
  );
}

export function CampusIcon({ size = 18, className }) {
  return (
    <Svg size={size} className={`${styles.campus} ${className ?? ""}`}>
      <path
        pathLength="1"
        className={styles.draw}
        d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"
      />
      <path pathLength="1" className={styles.drawLate} d="M22 10v6" />
      <path pathLength="1" className={styles.drawLate} d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </Svg>
  );
}

export function GlobeIcon({ size = 16, className }) {
  return (
    <Svg size={size} className={className}>
      <circle pathLength="1" className={styles.draw} cx="12" cy="12" r="10" />
      <path
        pathLength="1"
        className={`${styles.drawLate} ${styles.meridian}`}
        d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"
      />
      <path pathLength="1" className={styles.drawLate} d="M2 12h20" />
    </Svg>
  );
}
