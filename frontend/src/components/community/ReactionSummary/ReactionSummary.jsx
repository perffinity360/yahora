// frontend/src/components/community/ReactionSummary/ReactionSummary.jsx
//
// The pill under a post — docs/design/COMMUNITY_SPEC.md §5.3: the top 4 emojis
// by count, then the total. Hidden when nobody has reacted. Clicking it opens
// the breakdown (§5.4), whose ⊕ opens the full picker here.

import React, { useState } from "react";
import ReactionBreakdown from "../ReactionBreakdown/ReactionBreakdown";
import EmojiPickerPopover from "../ReactionBar/EmojiPickerPopover";
import { formatCount, topReactions } from "../../../utils/community";
import styles from "./ReactionSummary.module.css";

export default function ReactionSummary({ counts, total, mine, onReact }) {
  const [pill, setPill] = useState(null);
  const [open, setOpen] = useState(null); // null | "breakdown" | "picker"

  if (!total) return null;

  const top = topReactions(counts);

  return (
    <>
      <button
        ref={setPill}
        type="button"
        className={`${styles.pill} ${mine ? styles.pillMine : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open === "breakdown"}
        aria-label={`${total} ${total === 1 ? "reaction" : "reactions"}. Show the breakdown`}
        onClick={() => setOpen((o) => (o === "breakdown" ? null : "breakdown"))}
      >
        <span className={styles.emojis} aria-hidden="true">
          {/* Keyed by emoji: only one that has just joined the top 4 pops in. */}
          {top.map((emoji) => (
            <span key={emoji} className={styles.emoji}>
              {emoji}
            </span>
          ))}
        </span>
        {/* Keyed by the total, so a new count rolls in. */}
        <span key={total} className={styles.count} aria-hidden="true">
          {formatCount(total)}
        </span>
      </button>

      {open === "breakdown" && (
        <ReactionBreakdown
          anchorEl={pill}
          counts={counts}
          total={total}
          mine={mine}
          onAdd={() => setOpen("picker")}
          onClose={(why) => {
            setOpen(null);
            if (why === "escape") pill?.focus();
          }}
        />
      )}

      {open === "picker" && (
        <EmojiPickerPopover
          anchorEl={pill}
          onPick={(emoji) => {
            setOpen(null);
            onReact(emoji === mine ? null : emoji);
          }}
          onClose={(why) => {
            setOpen(null);
            if (why === "escape") pill?.focus();
          }}
        />
      )}
    </>
  );
}
