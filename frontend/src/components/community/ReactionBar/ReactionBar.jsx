// frontend/src/components/community/ReactionBar/ReactionBar.jsx
//
// The React button and its quick bar — docs/design/COMMUNITY_SPEC.md §5.1.
//
// Pressing React never reacts by itself: it always offers the emojis, with a
// mouse, a keyboard or a finger alike (owner, 10 Nov; a click used to give ❤️
// straight away, which hid the other five).
//
//   · click React (mouse)  — the quick bar; a second click closes it
//   · hover React 300 ms   — the quick bar, as before
//   · Enter/Space or ↑     — the quick bar, focus on its first emoji
//   · tap React (touch)    — the quick bar, or closes it
//   · long-press (touch)   — the quick bar too
//   · ⊕                    — the full picker (§5.2), opened against the
//                            quick bar so its six emojis stay where they were
//
// Your current emoji sits marked in the bar, first in it; choosing it again
// removes it. One picked from the full picker takes the first place too, and
// the last of the six steps out, so removing it never means searching the
// picker for it again (owner, 12 Nov; website only).

// One reaction per person: choosing your current emoji removes it, choosing
// another replaces it. The component only reports the choice through
// onReact(emoji | null); what that does to the post is the caller's business.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CirclePlus, Smile } from "lucide-react";
import Popover from "../Popover/Popover";
import { EmojiPickerPanel } from "./EmojiPickerPopover";
import {
  QUICK_REACTIONS,
  REACTION_HOVER_DELAY_MS,
  REACTION_LONG_PRESS_MS,
} from "../../../utils/community";
import styles from "./ReactionBar.module.css";

/** Grace period for the pointer to travel from the button up to the bar. */
const HOVER_CLOSE_MS = 250;
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

/* The bar's six: your reaction first, then the usual ones in their order. */
function quickBar(reaction) {
  if (!reaction) return QUICK_REACTIONS;
  return [reaction, ...QUICK_REACTIONS.filter((e) => e !== reaction)].slice(0, QUICK_REACTIONS.length);
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
  const openedBy = useRef(null); // "hover" | "press": what opened the bar
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
    openTimer.current = setTimeout(() => {
      openedBy.current = "hover";
      setBarOpen(true);
    }, REACTION_HOVER_DELAY_MS);
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
      openedBy.current = "press";
      setBarOpen(true);
    }, REACTION_LONG_PRESS_MS);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  const onClick = (e) => {
    clearTimers();
    if (longPressed.current) {
      // The finger that opened the bar is lifting; that is not a tap.
      longPressed.current = false;
      return;
    }
    setExpanded(null);
    // detail is 0 for a click from the keyboard: the focus goes into the bar.
    const keyboard = e.detail === 0;
    // A mouse that rested on React has already opened the bar by hover; the
    // click that follows keeps it open rather than shutting it in its face.
    const hovered = barOpen && openedBy.current === "hover";
    const willOpen = !barOpen || hovered;
    openedBy.current = willOpen ? "press" : null;
    if (willOpen && keyboard) focusFirst.current = true;
    setBarOpen(willOpen);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      focusFirst.current = true;
      openedBy.current = "press";
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
        aria-label={reaction ? `Your reaction ${reaction}. Change or remove it` : "React"}
        title="React"
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
            <Smile size={15} strokeWidth={2} aria-hidden="true" />
          )}
        </span>
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
              {quickBar(reaction).map((emoji, i) => (
                <button
                  key={emoji}
                  type="button"
                  style={{ "--quick-i": i }}
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
                <CirclePlus size={20} strokeWidth={1.75} aria-hidden="true" />
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
