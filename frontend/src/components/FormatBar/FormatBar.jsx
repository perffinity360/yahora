// frontend/src/components/FormatBar/FormatBar.jsx
//
// The selection bar of docs/design/TEXT_FORMAT_SPEC.md §5.3: B · I · S · code ·
// monospace, just above the selected text, doing what the shortcuts do.
// FormattedTextarea shows it (prop `formatBar`) and says where: `anchor` is a
// point in the viewport, the bar sits just above it, kept inside the screen.
//
// It goes into document.body, so no parent's overflow or transform can clip
// or move it. Its buttons never take focus, so the selection stays.

import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bold, Code, Italic, SquareCode, Strikethrough } from "lucide-react";
import { applyFormat } from "../../utils/formatSelection";
import styles from "./FormatBar.module.css";

const BUTTONS = [
  { kind: "bold", label: "Bold", Icon: Bold },
  { kind: "italic", label: "Italic", Icon: Italic },
  { kind: "strike", label: "Strikethrough", Icon: Strikethrough },
  { kind: "code", label: "Code", Icon: Code },
  { kind: "mono", label: "Monospace", Icon: SquareCode },
];

const GAP = 6;
const EDGE = 8;

export default function FormatBar({ anchor, textarea }) {
  const barRef = useRef(null);
  const [left, setLeft] = useState(anchor.x);

  // Kept inside the screen, once its width is known.
  useLayoutEffect(() => {
    const width = barRef.current?.offsetWidth ?? 0;
    const max = window.innerWidth - width - EDGE;
    setLeft(Math.max(EDGE, Math.min(anchor.x, max)));
  }, [anchor.x]);

  return createPortal(
    <div
      ref={barRef}
      className={styles.bar}
      role="toolbar"
      // Callers that close on a press elsewhere skip presses in here.
      data-format-bar=""
      aria-label="Format the selected text"
      style={{ left, top: anchor.y - GAP }}
      // Never takes focus from the text box, so the selection stays.
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
    >
      {BUTTONS.map(({ kind, label, Icon }) => (
        <button
          key={kind}
          type="button"
          className={styles.button}
          aria-label={label}
          title={label}
          tabIndex={-1}
          onClick={() => applyFormat(textarea, kind)}
        >
          <Icon size={15} strokeWidth={2.25} aria-hidden="true" />
        </button>
      ))}
    </div>,
    document.body,
  );
}
