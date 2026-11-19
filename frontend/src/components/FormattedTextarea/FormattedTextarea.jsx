// frontend/src/components/FormattedTextarea/FormattedTextarea.jsx
//
// A <textarea> that shows WhatsApp's formatting while you type —
// docs/design/TEXT_FORMAT_SPEC.md §5.1. The textarea does all the work (typing,
// the caret, selection, paste, undo, input methods); its glyphs are only made
// invisible. A mirror layer, aria-hidden and click-through, draws the same
// text over it, formatted with looks that never change a character's width,
// so every character stays exactly where the textarea put it:
//
//   symbols 45% · bold a thin text stroke · strike line-through
//   italic 70% (true italic is wider) · code and monospace a 12% tint, no
//   padding · links underlined
//
// The mirror sits ABOVE the textarea, not under it: the chat box paints its
// own background, which would hide anything beneath. The textarea's selection
// highlight still shows through the mirror's transparent background, and its
// caret between the mirror's glyphs.
//
// Props: every prop and the ref go to the <textarea> unchanged, except
//   wrapperClassName  the layout the textarea had in its parent (flex …): the
//                     wrapper takes its place there.
//   formatBar         show the selection bar (§5.3, components/FormatBar) when
//                     text is selected: just above the selection's start,
//                     found by a marker span in the mirror; on a touch screen
//                     just above the box, since the phone's own copy / paste
//                     bubble covers the selection. Hidden on Esc (which then
//                     does nothing else), blur, scroll or an empty selection;
//                     Esc keeps it hidden until the selection changes.
//
// The mirror never writes to the textarea: not its value, not its selection.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatSpans } from "../../utils/textFormat";
import FormatBar from "../FormatBar/FormatBar";
import styles from "./FormattedTextarea.module.css";

/* What the mirror copies from the textarea, so its text wraps the same way. */
const COPIED = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontStretch",
  "fontFeatureSettings",
  "fontVariationSettings",
  "fontKerning",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textTransform",
  "textIndent",
  "tabSize",
  "direction",
  "boxSizing",
  "paddingTop",
  "paddingLeft",
  "paddingBottom",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
  "color",
];

function decoration(span) {
  const lines = [];
  if (span.strike) lines.push("line-through");
  if (span.link) lines.push("underline");
  return lines.length ? lines.join(" ") : undefined;
}

function spanClass(span) {
  let name = "";
  if (span.symbol) name += ` ${styles.symbol}`;
  if (span.bold) name += ` ${styles.bold}`;
  if (span.italic) name += ` ${styles.italic}`;
  if (span.code || span.mono) name += ` ${styles.code}`;
  return name.trim() || undefined;
}

/* The spans, with an empty marker span at character `at` (or none). */
function withMarker(spans, at) {
  if (at == null) return spans.map((span) => ({ span }));
  const out = [];
  let offset = 0;
  let placed = false;
  for (const span of spans) {
    const end = offset + span.text.length;
    if (!placed && at >= offset && at < end) {
      if (at > offset) out.push({ span: { ...span, text: span.text.slice(0, at - offset) } });
      out.push({ marker: true });
      out.push({ span: { ...span, text: span.text.slice(at - offset) } });
      placed = true;
    } else {
      out.push({ span });
    }
    offset = end;
  }
  if (!placed) out.push({ marker: true });
  return out;
}

export default function FormattedTextarea({ ref, wrapperClassName, formatBar = false, ...props }) {
  const fieldRef = useRef(null);
  const mirrorRef = useRef(null);
  const text = props.value ?? "";
  const spans = useMemo(() => formatSpans(String(text)), [text]);

  // The selection the bar is for, and where the bar goes.
  const [selection, setSelection] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const dismissed = useRef(null);
  const dragging = useRef(false);

  const setRef = useCallback(
    (el) => {
      fieldRef.current = el;
      if (typeof ref === "function") return ref(el);
      if (ref) ref.current = el;
      return undefined;
    },
    [ref],
  );

  /* Puts the mirror exactly over the textarea, with its type and box. */
  const sync = useCallback(() => {
    const field = fieldRef.current;
    const mirror = mirrorRef.current;
    if (!field || !mirror) return;
    const cs = getComputedStyle(field);
    for (const key of COPIED) mirror.style[key] = cs[key];
    // A classic (non-overlay) scrollbar takes width from the text; the mirror
    // has none, so it gives the same width up as padding.
    const scrollbar =
      field.offsetWidth - field.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    mirror.style.paddingRight = `${parseFloat(cs.paddingRight) + Math.max(0, scrollbar)}px`;
    mirror.style.top = `${field.offsetTop}px`;
    mirror.style.left = `${field.offsetLeft}px`;
    mirror.style.width = `${field.offsetWidth}px`;
    mirror.style.height = `${field.offsetHeight}px`;
    mirror.scrollTop = field.scrollTop;
  }, []);

  // After every change of text; the textarea may have scrolled to the caret.
  useLayoutEffect(sync, [sync, spans]);

  // When the textarea grows (its parent sets the height after this renders),
  // is resized, or scrolls.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return undefined;
    const follow = () => {
      if (mirrorRef.current) mirrorRef.current.scrollTop = field.scrollTop;
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(sync) : null;
    observer?.observe(field);
    field.addEventListener("scroll", follow, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      observer?.disconnect();
      field.removeEventListener("scroll", follow);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  /* Reads the textarea's selection: the bar shows for a non-empty one, while
     the box has focus, not mid-drag, and not one Esc dismissed. */
  const readSelection = useCallback(() => {
    const field = fieldRef.current;
    if (!formatBar || !field || document.activeElement !== field || dragging.current) {
      setSelection(null);
      return;
    }
    const { selectionStart: start, selectionEnd: end } = field;
    const gone = dismissed.current;
    if (start === end || (gone && gone.start === start && gone.end === end)) {
      if (start === end) dismissed.current = null;
      setSelection(null);
      return;
    }
    dismissed.current = null;
    setSelection((prev) => (prev && prev.start === start && prev.end === end ? prev : { start, end }));
  }, [formatBar]);

  /* Esc, a scroll: hidden until the selection changes. */
  const dismiss = useCallback(() => {
    const field = fieldRef.current;
    if (field) dismissed.current = { start: field.selectionStart, end: field.selectionEnd };
    setSelection(null);
  }, []);

  useEffect(() => {
    const field = fieldRef.current;
    if (!formatBar || !field) return undefined;
    const onDown = () => {
      dragging.current = true;
      setSelection(null);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      readSelection();
    };
    const onBlur = () => {
      dragging.current = false;
      setSelection(null);
    };
    // Any scroll but the mirror's own, which only follows the textarea.
    const onScroll = (e) => {
      if (e.target !== mirrorRef.current) dismiss();
    };
    document.addEventListener("selectionchange", readSelection);
    field.addEventListener("select", readSelection);
    field.addEventListener("keyup", readSelection);
    field.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    field.addEventListener("blur", onBlur);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("selectionchange", readSelection);
      field.removeEventListener("select", readSelection);
      field.removeEventListener("keyup", readSelection);
      field.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      field.removeEventListener("blur", onBlur);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [formatBar, readSelection, dismiss]);

  // Where the bar goes: above the marker at the selection's start (kept
  // within the box when the start is scrolled out of it), or, on a touch
  // screen, above the box.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!selection || !field) {
      setAnchor(null);
      return;
    }
    const box = field.getBoundingClientRect();
    const marker = mirrorRef.current?.querySelector("[data-selection-start]");
    if (window.matchMedia("(pointer: coarse)").matches || !marker) {
      setAnchor({ x: box.left, y: box.top });
      return;
    }
    const at = marker.getBoundingClientRect();
    setAnchor({ x: at.left, y: Math.min(Math.max(at.top, box.top), box.bottom) });
  }, [selection, spans]);

  const onKeyDown = (e) => {
    if (selection && e.key === "Escape") {
      e.preventDefault();
      dismiss();
      return;
    }
    props.onKeyDown?.(e);
  };

  const pieces = useMemo(() => withMarker(spans, selection?.start), [spans, selection?.start]);

  return (
    <div className={`${styles.wrap} ${wrapperClassName ?? ""}`}>
      <textarea
        {...props}
        ref={setRef}
        className={`${props.className ?? ""} ${styles.field}`}
        onKeyDown={formatBar ? onKeyDown : props.onKeyDown}
      />
      <div ref={mirrorRef} className={styles.mirror} aria-hidden="true">
        {pieces.map(({ span, marker }, i) =>
          marker ? (
            <span key={i} data-selection-start="" />
          ) : (
            <span key={i} className={spanClass(span)} style={{ textDecorationLine: decoration(span) }}>
              {span.text}
            </span>
          ),
        )}
        {/* A last empty line still takes a line, as it does in the textarea. */}
        {String(text).endsWith("\n") ? "\u200b" : null}
      </div>
      {selection && anchor && <FormatBar anchor={anchor} textarea={fieldRef.current} />}
    </div>
  );
}
