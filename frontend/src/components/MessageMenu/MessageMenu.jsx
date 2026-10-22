// frontend/src/components/MessageMenu/MessageMenu.jsx
//
// The web popover of MESSAGES_SPEC §10.2: the actions of one message, under
// the round button beside its bubble. Fixed-positioned in a portal, so the
// thread's scroll container can't clip it, and kept inside `boundsEl` (the
// thread): it flips above the button when there is no room below.
//
// Keyboard: focus moves to the first item on open; ArrowUp/ArrowDown (and
// Home/End) move; Enter or Space chooses (they are buttons); Esc or Tab closes
// and puts focus back on the button that opened it. A pointer press outside
// closes it without moving focus.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./MessageMenu.module.css";

const GAP = 4; // between the button and the menu
const EDGE = 8; // kept clear of the thread's edges

/**
 * items:    [{ key, label, Icon, danger?, onSelect }]
 * anchorEl: the actions button it hangs from
 * boundsEl: the element it must stay inside (the thread)
 * align:    "end" lines up the menu's right edge with the button's (mine,
 *           whose button sits left of the bubble), "start" its left edge.
 * onClose(returnFocus)
 */
export default function MessageMenu({ items, anchorEl, boundsEl, align = "start", onClose }) {
  const menuRef = useRef(null);
  const itemRefs = useRef([]);
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const menu = menuRef.current;
    if (!menu || !anchorEl?.isConnected) return onClose(false);
    const a = anchorEl.getBoundingClientRect();
    const b = (boundsEl ?? document.documentElement).getBoundingClientRect();

    // The message scrolled out of the thread: nothing left to point at.
    if (a.bottom < b.top || a.top > b.bottom) return onClose(false);

    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    let top = a.bottom + GAP;
    if (top + h > b.bottom - EDGE) top = a.top - GAP - h; // flip above
    top = Math.max(b.top + EDGE, Math.min(top, b.bottom - EDGE - h));

    let left = align === "end" ? a.right - w : a.left;
    left = Math.max(b.left + EDGE, Math.min(left, b.right - EDGE - w));

    setPos({ top, left });
  }, [anchorEl, boundsEl, align, onClose]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  // Follow the button while the thread scrolls (a new message, paging) or
  // the window resizes. Capture: scroll doesn't bubble.
  useEffect(() => {
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [place]);

  useEffect(() => {
    itemRefs.current[0]?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      // The button toggles the menu itself.
      if (anchorEl?.contains(e.target)) return;
      onClose(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [anchorEl, onClose]);

  const onKeyDown = (e) => {
    const list = itemRefs.current.filter(Boolean);
    const at = list.indexOf(document.activeElement);
    const move = (i) => list[(i + list.length) % list.length]?.focus();
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(at + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(at - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(list.length - 1);
        break;
      case "Escape":
      case "Tab":
        e.preventDefault();
        e.stopPropagation();
        onClose(true);
        break;
      default:
    }
  };

  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      role="menu"
      aria-label="Message actions"
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      // Measured hidden on the first frame, then placed.
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: "hidden" }}
    >
      {items.map(({ key, label, Icon, danger, onSelect }, i) => (
        <button
          key={key}
          ref={(el) => (itemRefs.current[i] = el)}
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={`${styles.item} ${danger ? styles.danger : ""}`}
          onClick={onSelect}
        >
          <Icon size={16} aria-hidden="true" className={styles.icon} />
          {label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
