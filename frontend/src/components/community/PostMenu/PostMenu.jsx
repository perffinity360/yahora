// frontend/src/components/community/PostMenu/PostMenu.jsx
//
// The ⋯ menu on a post or a reply (spec §3, §4): Report for everyone but the
// author (§7), Delete for the author only. The menu is only the list; what
// each item does lives in PostActionsProvider (pages/community/PostActions.jsx),
// which the screen wraps around its posts and reaches here through
// PostActionsContext. Without a provider the button does nothing.
//
// `className` is the button's own look (the post's or the reply's ⋯).

import React, { createContext, useContext, useState } from "react";
import { Ellipsis, Flag, Trash2 } from "lucide-react";
import Popover from "../Popover/Popover";
import styles from "./PostMenu.module.css";

/** { hidden: Set<postId>, openReport(post), openDelete(post), showToast(text) } */
export const PostActionsContext = createContext(null);

export function usePostActions() {
  return useContext(PostActionsContext);
}

export default function PostMenu({ post, className = "", size = 15 }) {
  const actions = usePostActions();
  const [anchor, setAnchor] = useState(null);
  const [open, setOpen] = useState(false);

  const pick = (fn) => {
    setOpen(false);
    fn(post);
  };

  return (
    <>
      <button
        ref={setAnchor}
        type="button"
        className={className}
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => actions && setOpen((o) => !o)}
      >
        <Ellipsis size={size} aria-hidden="true" />
      </button>
      {open && (
        <Popover
          anchorEl={anchor}
          placement="bottom"
          align="end"
          onClose={(why) => {
            setOpen(false);
            if (why === "escape") anchor?.focus();
          }}
          role="presentation"
        >
          <div role="menu" className={styles.menu}>
            {post.is_mine ? (
              <button
                type="button"
                role="menuitem"
                autoFocus
                className={`${styles.item} ${styles.danger}`}
                onClick={() => pick(actions.openDelete)}
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete
              </button>
            ) : (
              <button
                type="button"
                role="menuitem"
                autoFocus
                className={styles.item}
                onClick={() => pick(actions.openReport)}
              >
                <Flag size={14} aria-hidden="true" />
                Report
              </button>
            )}
          </div>
        </Popover>
      )}
    </>
  );
}
