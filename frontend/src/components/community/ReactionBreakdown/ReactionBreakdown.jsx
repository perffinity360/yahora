// frontend/src/components/community/ReactionBreakdown/ReactionBreakdown.jsx
//
// The breakdown popover — docs/design/COMMUNITY_SPEC.md §5.4. A grid of pills
// (emoji + count), biggest first, three per row; the first cell is ⊕ to add
// your own. Counts only: who reacted is never shown.

import React from "react";
import { CirclePlus } from "lucide-react";
import Popover from "../Popover/Popover";
import { formatCount, sortedReactions } from "../../../utils/community";
import styles from "./ReactionBreakdown.module.css";

export default function ReactionBreakdown({ anchorEl, counts, total, mine, onAdd, onClose }) {
  const rows = sortedReactions(counts);

  return (
    <Popover anchorEl={anchorEl} placement="bottom" onClose={onClose} ariaLabel="Reactions">
      <div className={styles.card}>
        <p className={styles.title}>
          {formatCount(total)} {total === 1 ? "reaction" : "reactions"}
        </p>
        <ul className={styles.grid}>
          <li>
            <button
              type="button"
              className={`${styles.pill} ${styles.add}`}
              aria-label="Add your reaction"
              onClick={onAdd}
            >
              <CirclePlus size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </li>
          {rows.map(([emoji, count]) => (
            <li key={emoji}>
              <span
                className={`${styles.pill} ${emoji === mine ? styles.mine : ""}`}
                aria-label={`${emoji} ${count}${emoji === mine ? ", including yours" : ""}`}
              >
                <span className={styles.emoji} aria-hidden="true">{emoji}</span>
                <span aria-hidden="true">{formatCount(count)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Popover>
  );
}
