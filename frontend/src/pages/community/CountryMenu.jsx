// frontend/src/pages/community/CountryMenu.jsx
//
// The country dropdown's list — docs/design/COMMUNITY_SPEC.md §1.3:
//
//   🇮🇳 India (your country)   ✓
//   (globe) Global
//   ──────────────
//   🇩🇪 Germany …              (the other countries, A–Z)
//
// Only the list: the caller draws the trigger, because on a laptop it is the
// panel's title and on a narrow window it is the switcher's chevron.

import React, { useEffect, useMemo, useRef } from "react";
import { Check } from "lucide-react";
import { GlobeIcon } from "../../components/community/AnimatedIcons/AnimatedIcons";
import Popover from "../../components/community/Popover/Popover";
import { flagEmoji } from "../../utils/community";
import styles from "./Community.module.css";

export const GLOBAL = "GLOBAL";

/** `Global` or `India` — the name of the right-hand feed. */
export function worldLabel(value, countries) {
  if (value === GLOBAL) return "Global";
  return countries.find((x) => x.code === value)?.name ?? value;
}

/** The globe icon, or the country's flag (worked out from its code). */
export function WorldGlyph({ value, size = 16 }) {
  if (value === GLOBAL) return <GlobeIcon size={size} className={styles.worldIcon} />;
  return (
    <span className={styles.flag} aria-hidden="true">
      {flagEmoji(value)}
    </span>
  );
}

export default function CountryMenu({ anchorEl, value, countries, onChange, onClose }) {
  const listRef = useRef(null);

  const { mine, others } = useMemo(() => {
    const own = countries.find((c) => c.is_mine) ?? null;
    const rest = countries
      .filter((c) => c !== own)
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    return { mine: own, others: rest };
  }, [countries]);

  // Open with the current choice focused, like a native select.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const current = list.querySelector('[aria-selected="true"]') ?? list.querySelector("[role=option]");
    current?.focus();
  }, []);

  const onKeyDown = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const items = [...listRef.current.querySelectorAll("[role=option]")];
    const i = items.indexOf(document.activeElement);
    let next = i;
    if (e.key === "ArrowDown") next = Math.min(items.length - 1, i + 1);
    if (e.key === "ArrowUp") next = Math.max(0, i - 1);
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;
    items[next]?.focus();
  };

  const option = (code, name, extra = null) => (
    <button
      key={code}
      type="button"
      role="option"
      aria-selected={value === code}
      className={`${styles.menuOption} ${value === code ? styles.menuOptionActive : ""}`}
      onClick={() => {
        onChange(code);
        onClose();
      }}
    >
      <span className={styles.menuLabel}>
        <WorldGlyph value={code} />
        <span>
          {name}
          {extra && <span className={styles.menuHint}> {extra}</span>}
        </span>
      </span>
      {value === code && <Check size={14} aria-hidden="true" className={styles.menuCheck} />}
    </button>
  );

  return (
    <Popover
      anchorEl={anchorEl}
      placement="bottom"
      onClose={(why) => {
        onClose();
        // The anchor can be a pill holding buttons (the phone switcher):
        // focus goes back to its first one.
        if (why === "escape") (anchorEl?.matches("button") ? anchorEl : anchorEl?.querySelector("button"))?.focus();
      }}
      role="presentation"
    >
      <div ref={listRef} role="listbox" aria-label="Choose a feed" className={styles.menu} onKeyDown={onKeyDown}>
        {mine && option(mine.code, mine.name, "(your country)")}
        {option(GLOBAL, "Global")}
        {others.length > 0 && <div className={styles.menuDivider} role="separator" />}
        {others.map((c) => option(c.code, c.name))}
      </div>
    </Popover>
  );
}
