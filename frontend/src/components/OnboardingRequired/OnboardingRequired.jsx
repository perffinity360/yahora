// frontend/src/components/OnboardingRequired/OnboardingRequired.jsx
//
// The screen a signed-in student sees when they reach a page that needs a
// finished profile. Rendered by <RequireOnboarded> in App.jsx INSTEAD of a
// redirect: a silent bounce back to /onboarding looks like a broken link, and
// leaves the student with no idea why the app keeps refusing them. This says
// what is missing, why, and gives them one button that fixes it.
//
// Aesthetic direction: a warm notice pinned to the hostel door — soft paper
// card on the app's blush background, one purple→pink accent, and exactly one
// obvious way forward.
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock, ArrowRight, Check } from "lucide-react";
import styles from "./OnboardingRequired.module.css";

// Naming the page they were actually trying to open turns a generic wall into
// an answer. Prefix matches (rather than exact) so /product/:id and /user/:id
// are covered without knowing the id.
const PAGE_LABELS = [
  ["/marketplace", "the Marketplace"],
  ["/messages", "Messages"],
  ["/dashboard", "your dashboard"],
  ["/sell", "selling an item"],
  ["/hot", "Campus Hot"],
  ["/feed", "the community feed"],
  ["/product", "this listing"],
  ["/user", "student profiles"],
];

const labelFor = (pathname) => {
  const match = PAGE_LABELS.find(([prefix]) => pathname.startsWith(prefix));
  return match ? match[1] : "this page";
};

const REMAINING = [
  "Your name and photo",
  "Course, specialisation and year",
  "A username and password for next time",
];

export default function OnboardingRequired() {
  const { pathname } = useLocation();

  return (
    <section className={styles.gate}>
      {/* Decorative only — the card carries all of the meaning. */}
      <div className={`${styles.orb} ${styles.orbPurple}`} aria-hidden="true" />
      <div className={`${styles.orb} ${styles.orbPink}`} aria-hidden="true" />

      <div className={styles.card}>
        <span className={styles.badge} aria-hidden="true">
          <Lock size={20} strokeWidth={2.2} />
        </span>

        <p className={styles.eyebrow}>One step left</p>

        <h1 className={styles.title}>
          Finish your profile to unlock {labelFor(pathname)}
        </h1>

        <p className={styles.body}>
          Your campus email is verified — you're through the door. Yahora just
          needs to know who you are before you start trading, because every
          student here buys from a real, named classmate.
        </p>

        <ul className={styles.checklist}>
          {REMAINING.map((item, i) => (
            <li
              key={item}
              className={styles.checkItem}
              // Staggered entrance. Inline because the delay is per-index and
              // there is no sane way to express "nth child, times 70ms" for an
              // arbitrary-length list in a CSS Module.
              style={{ animationDelay: `${180 + i * 70}ms` }}
            >
              <span className={styles.checkDot} aria-hidden="true">
                <Check size={13} strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <Link to="/onboarding" className={styles.primaryBtn}>
            Complete my profile
            <ArrowRight size={17} strokeWidth={2.4} />
          </Link>
          <Link to="/" className={styles.secondaryBtn}>
            Back to home
          </Link>
        </div>

        <p className={styles.footnote}>Takes about a minute.</p>
      </div>
    </section>
  );
}
