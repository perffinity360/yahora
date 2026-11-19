// frontend/src/components/community/PostMenu/PostMenu.jsx
//
// The ⋯ menu on a post or a reply (spec §3, §4): Copy text (only when there is
// text), Copy link (a reply's is its post's), then Report for everyone but the
// author (§7), Delete for the author only. The menu is only the list; what
// each item does lives in PostActionsProvider (pages/community/PostActions.jsx),
// which the screen wraps around its posts and reaches here through
// PostActionsContext. Without a provider the button does nothing.
//
// `className` is the button's own look (the post's or the reply's ⋯).

import React, { createContext, useContext, useState } from "react";
import { Copy, Ellipsis, Flag, Link, Trash2 } from "lucide-react";
import Popover from "../Popover/Popover";
import styles from "./PostMenu.module.css";

/** { hidden: Set<postId>, openReport(post), openDelete(post), copyText(post),
      copyLink(post), showToast(text) } */
export const PostActionsContext = createContext(null);

export function usePostActions() {
  return useContext(PostActionsContext);
}

export default function PostMenu({ post, className = "", size = 15 }) {
  const actions = usePostActions();
  const [anchor, setAnchor] = useState(null);
  const [open, setOpen] = useState(false);
  const hasText = Boolean(post.content?.trim());

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
            {hasText && (
              <button
                type="button"
                role="menuitem"
                autoFocus
                className={styles.item}
                onClick={() => pick(actions.copyText)}
              >
                <Copy size={14} aria-hidden="true" />
                Copy text
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              autoFocus={!hasText}
              className={styles.item}
              onClick={() => pick(actions.copyLink)}
            >
              <Link size={14} aria-hidden="true" />
              Copy link
            </button>
            {post.is_mine ? (
              <button
                type="button"
                role="menuitem"
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
