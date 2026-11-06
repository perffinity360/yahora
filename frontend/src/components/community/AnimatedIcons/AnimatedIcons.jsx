// frontend/src/components/community/AnimatedIcons/AnimatedIcons.jsx
//
// The two feed icons, in place of the 🏫 and 🌍 emoji (spec §1.1).
//
//   CampusIcon  lucide's GraduationCap paths, drawn in when it first appears;
//               hovering the panel header gives the cap a small hop.
//   GlobeIcon   the Global feed: a small drawn globe in colour, because it sits
//               in a list of flag emoji (the dropdown, the header, the badge on
//               your avatar) and a line icon looked out of place there. It pops
//               in when it first appears, and hovering its header or button
//               turns it once.
//
// With reduced motion they simply sit still.

import React, { useId } from "react";
import styles from "./AnimatedIcons.module.css";

/* The land, drawn once over the globe's face (x 2–22). It is drawn a second
   time 20 to the right, so sliding the whole group 20 to the left turns the
   globe by exactly one face and the loop never shows a seam. */
const LAND = [
  // The Americas
  "M4.2 7.6C5.4 5.9 7.8 5 9.8 5.2C10.4 5.9 9.9 6.9 9.4 7.5C8.8 8.1 8.3 8.7 8.6 9.6C8.8 10.4 8.3 11.2 7.9 11.6C8.9 12.1 10.2 12.8 10.4 14.3C10.6 15.9 9.5 17.6 8.5 19.4C8.1 18.6 7.7 17.4 7.3 16.1C6.9 14.8 6.5 13.6 6.6 12.6C6.6 11.7 5.6 11.2 4.9 10.5C4.3 9.8 3.9 8.6 4.2 7.6Z",
  // Europe
  "M12.9 5.8C13.8 4.9 16 4.6 17.4 5.4C17.8 6.1 17.1 6.9 16.2 7.1C15.2 7.3 14.4 7.6 13.6 7.5C12.9 7.3 12.6 6.5 12.9 5.8Z",
  // Africa
  "M12.3 9.7C13 8.9 14.8 8.5 16.5 8.9C17.7 9.3 18.5 10.4 18 11.6C17.5 12.6 16.8 13.4 16.5 14.6C16.2 15.9 15.6 17.2 14.8 17.9C14.1 17.5 13.9 16.2 13.6 15C13.3 13.9 12.5 13.2 12.2 12.1C12 11.2 11.9 10.3 12.3 9.7Z",
  // Asia
  "M18.4 6.3C19.4 6.1 20.6 6.9 21.3 8C21.6 9 21.1 9.9 20.2 9.9C19.4 9.9 18.7 9.3 18.3 8.5C17.9 7.7 17.9 6.8 18.4 6.3Z",
  // Australia
  "M18.9 15.2C19.7 14.6 21 14.8 21.3 15.6C21.2 16.5 20.3 17.1 19.4 16.9C18.8 16.6 18.5 15.8 18.9 15.2Z",
];

/* useId gives ":r1:" or "«r1»"; an id used inside url(#…) keeps to plain
   characters. */
function svgId(raw) {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "");
}

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

/* From the back: the ocean (light at the upper left, deeper at the edge), the
   land, a shadow over both towards the lower right, a soft shine, and a thin
   rim so it holds its edge on white, pink and purple alike. */
export function GlobeIcon({ size = 16, className }) {
  const id = svgId(useId());
  const ocean = `globe-ocean-${id}`;
  const shade = `globe-shade-${id}`;
  const face = `globe-face-${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`${styles.icon} ${styles.globe} ${className ?? ""}`}
    >
      <defs>
        <radialGradient id={ocean} cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" style={{ stopColor: "var(--blue-light)" }} />
          <stop offset="1" style={{ stopColor: "var(--blue-dark)" }} />
        </radialGradient>
        <radialGradient id={shade} cx="0.34" cy="0.3" r="0.8">
          <stop offset="0.5" style={{ stopColor: "var(--community-globe-shade)", stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: "var(--community-globe-shade)" }} />
        </radialGradient>
        <clipPath id={face}>
          <circle cx="12" cy="12" r="10" />
        </clipPath>
      </defs>
      <circle cx="12" cy="12" r="10" fill={`url(#${ocean})`} />
      <g clipPath={`url(#${face})`}>
        <g className={styles.globeLand}>
          {LAND.map((d) => (
            <path key={d} d={d} />
          ))}
          <g transform="translate(20 0)">
            {LAND.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </g>
        <circle cx="12" cy="12" r="10" fill={`url(#${shade})`} />
      </g>
      <ellipse className={styles.globeShine} cx="8.4" cy="7.4" rx="3.4" ry="2" transform="rotate(-30 8.4 7.4)" />
      <circle className={styles.globeRim} cx="12" cy="12" r="10" />
    </svg>
  );
}
