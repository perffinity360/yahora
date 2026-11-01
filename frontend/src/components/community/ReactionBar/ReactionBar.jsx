// frontend/src/components/community/ReactionBar/ReactionBar.jsx
//
// The React button and its quick bar — docs/design/COMMUNITY_SPEC.md §5.1.
//
//   · click React          — ❤️ on, or your reaction off
//   · hover React 300 ms   — the quick bar (❤️ 👍 😂 😮 😢 🙏 ⊕)
//   · focus React, press ↑ — the quick bar, focus on its first emoji
//   · long-press (touch)   — the quick bar; a touch screen has no hover, and
//                            the spec's app gesture is the same (§5.1)
//   · ⊕                    — the full picker (§5.2), opened against the
//                            quick bar so its six emojis stay where they were
//
// One reaction per person: choosing your current emoji removes it, choosing
// another replaces it. The component only reports the choice through
// onReact(emoji | null); what that does to the post is the caller's business.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CirclePlus, Heart } from "lucide-react";
import Popover from "../Popover/Popover";
import { EmojiPickerPanel } from "./EmojiPickerPopover";
import {
  DEFAULT_REACTION,
  QUICK_REACTIONS,
  REACTION_HOVER_DELAY_MS,
} from "../../../utils/community";
import styles from "./ReactionBar.module.css";

/** Grace period for the pointer to travel from the button up to the bar. */
const HOVER_CLOSE_MS = 250;
const LONG_PRESS_MS = 450;
const PICKER_WIDTH = 340;
const PICKER_MAX_HEIGHT = 400;
const PICKER_MIN_HEIGHT = 260;
const EDGE = 8;

/* Where the picker hangs off the quick bar. The bar itself never moves: the
   picker opens away from the React button when that side has room, else on
   the other side, else on the roomier side, shortened to fit. */
function pickerPlacement(bar) {
  const r = bar.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const above = r.top - 2 * EDGE;
  const below = vh - r.bottom - 2 * EDGE;
  const barIsAbove = bar.closest("[data-side]")?.dataset.side !== "bottom";
  const [first, second] = barIsAbove ? ["above", "below"] : ["below", "above"];
  const room = { above, below };
  let dir;
  if (room[first] >= PICKER_MAX_HEIGHT) dir = first;
  else if (room[second] >= PICKER_MAX_HEIGHT) dir = second;
  else dir = above > below ? "above" : "below";
  const height = Math.max(PICKER_MIN_HEIGHT, Math.min(PICKER_MAX_HEIGHT, room[dir]));
  // Shift left if the picker, wider than the bar, would leave the window.
  const shift = Math.min(0, vw - EDGE - (r.left + PICKER_WIDTH));
  return { dir, height, shift };
}

export default function ReactionBar({ reaction, onReact }) {
  const [button, setButton] = useState(null);
  const [barOpen, setBarOpen] = useState(false);
  const [expanded, setExpanded] = useState(null); // null | pickerPlacement()
  const [popKey, setPopKey] = useState(0);

  const openTimer = useRef(null);
  const closeTimer = useRef(null);
  const pressTimer = useRef(null);
  const longPressed = useRef(false);
  const focusFirst = useRef(false);
  const barRef = useRef(null);

  const clearTimers = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    clearTimeout(pressTimer.current);
  };
  useEffect(() => clearTimers, []);

  const closeBar = useCallback((why) => {
    clearTimeout(closeTimer.current);
    setBarOpen(false);
    setExpanded(null);
    if (why === "escape") button?.focus();
  }, [button]);

  const choose = (emoji) => {
    const next = emoji === reaction ? null : emoji;
    if (next) setPopKey((k) => k + 1);
    onReact(next);
    setBarOpen(false);
    setExpanded(null);
  };

  // Keyboard opening: move focus into the bar once it is on screen.
  useEffect(() => {
    if (!barOpen || !focusFirst.current) return;
    focusFirst.current = false;
    requestAnimationFrame(() => barRef.current?.querySelector("button")?.focus());
  }, [barOpen]);

  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    // Once the picker is open the student is choosing; only a press outside,
    // Esc or a choice closes it — never the pointer wandering off.
    if (expanded) return;
    closeTimer.current = setTimeout(() => setBarOpen(false), HOVER_CLOSE_MS);
  };

  const onButtonEnter = (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(closeTimer.current);
    if (barOpen) return;
    openTimer.current = setTimeout(() => setBarOpen(true), REACTION_HOVER_DELAY_MS);
  };

  const onButtonLeave = (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(openTimer.current);
    if (barOpen) scheduleClose();
  };

  const onPointerDown = (e) => {
    if (e.pointerType === "mouse") return;
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setBarOpen(true);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  const onClick = () => {
    clearTimers();
    if (longPressed.current) {
      // The finger that opened the bar is lifting; that is not a tap.
      longPressed.current = false;
      return;
    }
    setBarOpen(false);
    setExpanded(null);
    choose(reaction ? reaction : DEFAULT_REACTION);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      focusFirst.current = true;
      setBarOpen(true);
    }
  };

  const onBarKeyDown = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const items = [...barRef.current.querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <>
      <button
        ref={setButton}
        type="button"
        className={`${styles.reactBtn} ${reaction ? styles.reacted : ""}`}
        aria-pressed={!!reaction}
        aria-haspopup="true"
        aria-expanded={barOpen}
        aria-label={reaction ? `Your reaction ${reaction}. Remove it` : `React with ${DEFAULT_REACTION}`}
        title="Hover or press ↑ for more reactions"
        onClick={onClick}
        onKeyDown={onKeyDown}
        onPointerEnter={onButtonEnter}
        onPointerLeave={onButtonLeave}
        onPointerDown={onPointerDown}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(e) => {
          // A long press on a phone would also open the browser's own menu.
          if (longPressed.current) e.preventDefault();
        }}
      >
        <span key={popKey} className={`${styles.reactIcon} ${popKey ? styles.pop : ""}`}>
          {reaction ? (
            <span className={styles.reactEmoji}>{reaction}</span>
          ) : (
            <Heart size={18} strokeWidth={2} aria-hidden="true" />
          )}
        </span>
        <span>React</span>
      </button>

      {barOpen && (
        <Popover
          anchorEl={button}
          placement="top"
          onClose={closeBar}
          role="toolbar"
          ariaLabel="Reactions"
          onPointerEnter={(e) => e.pointerType === "mouse" && clearTimeout(closeTimer.current)}
          onPointerLeave={(e) => e.pointerType === "mouse" && scheduleClose()}
        >
          {/* The popover is sized and placed by the bar alone; the picker
              hangs off it (absolute), so opening it never moves the bar. */}
          <div className={styles.stack}>
            <div ref={barRef} className={styles.quickBar} onKeyDown={onBarKeyDown}>
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`${styles.quickBtn} ${emoji === reaction ? styles.quickMine : ""}`}
                  aria-pressed={emoji === reaction}
                  aria-label={emoji === reaction ? `${emoji}, your reaction. Remove it` : `React with ${emoji}`}
                  onClick={() => choose(emoji)}
                >
                  <span className={styles.quickEmoji}>{emoji}</span>
                </button>
              ))}
              <button
                type="button"
                className={`${styles.quickBtn} ${styles.quickMore} ${expanded ? styles.quickMoreOpen : ""}`}
                aria-label={expanded ? "Hide more emoji" : "More emoji"}
                aria-expanded={!!expanded}
                onClick={() =>
                  setExpanded((x) => (x ? null : pickerPlacement(barRef.current)))
                }
              >
                <CirclePlus size={24} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            {expanded && (
              <div
                className={`${styles.pickerHang} ${expanded.dir === "above" ? styles.pickerAbove : styles.pickerBelow}`}
                style={{ left: expanded.shift }}
              >
                <EmojiPickerPanel onPick={choose} height={expanded.height} />
              </div>
            )}
          </div>
        </Popover>
      )}
    </>
  );
}
