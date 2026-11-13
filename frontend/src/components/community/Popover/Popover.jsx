// frontend/src/components/community/Popover/Popover.jsx
//
// A small floating layer pinned to an anchor element: the reaction quick bar,
// the emoji picker and the reaction breakdown all use it.
//
// It renders into document.body with position: fixed, because on a laptop the
// community feeds scroll INSIDE their panels. Absolutely positioned inside a
// card, the quick bar over the first post was cut off by the panel's own
// overflow and hidden under its sticky header.
//
// Placement prefers `placement` ("top" or "bottom") and flips when that side
// lacks room. It follows the anchor while anything scrolls. Esc and a press
// outside both the popover and the anchor call onClose.
//
// Content that grows after it opens (the profile glimpse, once its photos
// load) passes `reserveHeight`, the tallest it can get: the side is then
// chosen once, as if it were already that tall, and kept while it is open.
// Deciding on the first, shorter size opened the glimpse below a name low on
// the screen and then flipped it above when the photos came (owner, 10 Nov).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./Popover.module.css";

const GAP = 8;
const EDGE = 8;

/* Whether any part of the anchor is still on screen: inside the window and
   inside every ancestor that clips it (a panel's scroller). */
function isAnchorVisible(anchorEl, rect) {
  if (!anchorEl.isConnected || (rect.width === 0 && rect.height === 0)) return false;
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) return false;
  for (let node = anchorEl.parentElement; node && node !== document.body; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "visible") continue;
    const box = node.getBoundingClientRect();
    if (rect.bottom <= box.top || rect.top >= box.bottom) return false;
  }
  return true;
}

export default function Popover({
  anchorEl,
  placement = "top",
  align = "start",
  onClose,
  className = "",
  children,
  onPointerEnter,
  onPointerLeave,
  role = "dialog",
  ariaLabel,
  reserveHeight = 0,
  // Between the anchor and the popover. The quick bar passes 4 (owner, 13 Nov).
  gap = GAP,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const locked = useRef(null); // with reserveHeight: { anchorEl, side }, once chosen

  // In a ref so an inline onClose from the caller doesn't rebuild `place`.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const place = useCallback(() => {
    const el = ref.current;
    if (!el || !anchorEl) return;
    const a = anchorEl.getBoundingClientRect();

    // The anchor scrolled out of sight (out of its panel, or off the page):
    // close rather than follow it. Following it pinned the emoji picker to the
    // top of the window, half under the navbar.
    if (!isAnchorVisible(anchorEl, a)) {
      onCloseRef.current?.("hidden");
      return;
    }

    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const roomAbove = a.top - gap - EDGE;
    const roomBelow = vh - a.bottom - gap - EDGE;
    const need = Math.max(h, reserveHeight);
    let side = placement;
    if (locked.current?.anchorEl === anchorEl) {
      side = locked.current.side;
    } else {
      if (side === "top" && need > roomAbove && roomBelow > roomAbove) side = "bottom";
      if (side === "bottom" && need > roomBelow && roomAbove > roomBelow) side = "top";
      if (reserveHeight) locked.current = { anchorEl, side };
    }

    // When neither side has room, it slides over the anchor rather than off
    // screen: the whole popover always stays in the window.
    let top = side === "top" ? a.top - gap - h : a.bottom + gap;
    top = Math.min(Math.max(top, EDGE), Math.max(EDGE, vh - h - EDGE));
    let left = align === "end" ? a.right - w : a.left;
    left = Math.min(Math.max(left, EDGE), Math.max(EDGE, vw - w - EDGE));
    setPos({ top, left, side });
  }, [anchorEl, placement, align, reserveHeight, gap]);

  useLayoutEffect(() => {
    place();
  }, [place]);

  useEffect(() => {
    // Content can change size after mount (the emoji picker lays itself out a
    // frame later), so keep placing while it is open.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    if (ro && ref.current) ro.observe(ref.current);
    window.addEventListener("resize", place);
    // Capture: the panels' own scrollers don't bubble scroll to window.
    window.addEventListener("scroll", place, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [place]);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchorEl?.contains(e.target)) return;
      onClose?.();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.("escape");
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchorEl, onClose]);

  if (!anchorEl) return null;

  return createPortal(
    <div
      ref={ref}
      role={role}
      aria-label={ariaLabel}
      className={`${styles.popover} ${pos ? styles.placed : ""} ${className}`}
      data-side={pos?.side ?? placement}
      style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>,
    document.body,
  );
}
