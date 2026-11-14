// frontend/src/components/CharCounter/CharCounter.jsx
//
// Characters left, the same in every text box that has a limit: the chat box
// (MESSAGES_SPEC.md §2 Composer) and the post and reply composer
// (COMMUNITY_SPEC.md §2.2). The design is TEXT_FORMAT_SPEC.md §5.6.
//
//   length  the text's length, in code points (utils/community.js
//           codePointLength: one emoji is one), as the server counts
//   max     the limit
//
// A progress ring that fills by length / max:
//   more than 100 left   20 px, no number; a "rainbow" ring whose colour
//                        follows how full it is (RAINBOW, below)
//   100 to 1 left        the same rainbow colour (by then yellow → orange),
//                        26 px, the number left inside it in the text colour
//   0 and below          red and full, the number ("-500") just to its left,
//                        and one small shake the moment it goes over
//
// It always takes the same width (the 26 px ring and room for the number
// beside it), so nothing around it moves. It only shows the count: the box
// never cuts text, and its owner turns Send / Post off above the max.

import React, { useLayoutEffect, useRef, useState } from "react";
import styles from "./CharCounter.module.css";

export const COUNTER_WARN_FROM = 100;

/* The ring is drawn in a 26 × 26 box; at 20 px it is scaled down, with a
   thicker stroke so it still looks 2.5 px. */
const BOX = 26;
const RADIUS = 11.4;

/* The ring's colour by how full it is: [fill %, hue, saturation %, lightness %],
   interpolated in HSL between stops. Red is never on the way; it only means
   "over the limit". Purple is the brand's #800080; the rest are deep enough to
   read as a ring on white and on the community's pinks. */
const RAINBOW = [
  [0, 300, 100, 25], // purple #800080
  [20, 221, 83, 53], // blue #2563EB
  [40, 175, 84, 32], // teal #0D9488
  [60, 142, 76, 36], // green #16A34A
  [80, 41, 96, 40], // yellow #CA8A04
  [95, 21, 90, 48], // orange #EA580C
];

function rainbowAt(fill) {
  const last = RAINBOW[RAINBOW.length - 1];
  if (fill >= last[0]) return `hsl(${last[1]} ${last[2]}% ${last[3]}%)`;
  let i = 1;
  while (RAINBOW[i][0] < fill) i += 1;
  const [f0, h0, s0, l0] = RAINBOW[i - 1];
  const [f1, h1, s1, l1] = RAINBOW[i];
  const t = (fill - f0) / (f1 - f0);
  const mix = (a, b) => (a + (b - a) * t).toFixed(1);
  return `hsl(${mix(h0, h1)} ${mix(s0, s1)}% ${mix(l0, l1)}%)`;
}

export default function CharCounter({ length, max }) {
  const left = max - length;
  const state = left <= 0 ? "over" : left <= COUNTER_WARN_FROM ? "warn" : "calm";
  const filled = Math.min(Math.max(length / max, 0), 1) * 100;

  // One shake each time it goes from within the limit to over it.
  const [shake, setShake] = useState(0);
  const wasOver = useRef(left < 0);
  useLayoutEffect(() => {
    const over = left < 0;
    if (over && !wasOver.current) setShake((n) => n + 1);
    wasOver.current = over;
  }, [left]);

  const label = left < 0 ? `${-left} characters over the limit` : `${left} characters left`;

  return (
    <span
      className={`${styles.counter} ${styles[state]}`}
      role="status"
      aria-live="polite"
      aria-label={label}
      // Room for the minus and every digit of the max ("-2000").
      style={{
        "--counter-digits": String(max).length + 1,
        // Over the limit the ring is red (the CSS), never a rainbow colour.
        ...(state === "over" ? null : { "--ring-colour": rainbowAt(filled) }),
      }}
    >
      <span key={shake} className={`${styles.body} ${shake ? styles.shake : ""}`} aria-hidden="true">
        {state === "over" && <span className={styles.outside}>{String(left)}</span>}
        <span className={styles.ringBox}>
          <svg className={styles.ring} viewBox={`0 0 ${BOX} ${BOX}`} width={BOX} height={BOX} focusable="false">
            <circle className={styles.track} cx={BOX / 2} cy={BOX / 2} r={RADIUS} />
            <circle
              className={styles.progress}
              cx={BOX / 2}
              cy={BOX / 2}
              r={RADIUS}
              pathLength="100"
              strokeDasharray={`${filled} 100`}
            />
          </svg>
          {state === "warn" && <span className={styles.inside}>{left}</span>}
        </span>
      </span>
    </span>
  );
}
