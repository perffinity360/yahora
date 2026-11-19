/* frontend/src/utils/formatSelection.js

   The typing tools of docs/design/TEXT_FORMAT_SPEC.md §5.2 and §5.3: wrap the
   selection in WhatsApp's symbols, or take them off again.

     applyFormat(textarea, kind)   kind "bold" | "italic" | "strike" | "code" | "mono"
     formatShortcut(event)         the kind a key press asks for, or null

   - Wraps the selection; if it is already wrapped (the symbols inside its
     edges, or just outside them), takes them off instead.
   - Code and monospace are protected: bold, italic and strike go around them
     (~`exam`~), never inside; code and monospace switch markers (` ↔ ```)
     instead of nesting. The rules are in planFormat (pure, shared with the
     app line for line and tested by scripts/check-format-selection.mjs).
   - Spaces at the edges of the selection stay outside the symbols, and so does
     a line's marker ("- ", "1. ", "> "), which would stop being one.
   - With nothing selected, a pair goes in with the cursor between.
   - Over several lines, each line is wrapped on its own (bold and the rest
     never cross a line). Monospace may, so it wraps the whole selection once.
   - The edit goes in through the browser's own insert, as one step, so Undo
     restores the text exactly; afterwards the same words are selected, so the
     same keys take the symbols off again. */

import { formatSpans } from "./textFormat.js";

const SYMBOL = { bold: "*", italic: "_", strike: "~", code: "`", mono: "```" };
/* How many symbols in a row count as this kind already being there: a single
   or a pair for bold, italic and strike (TEXT_FORMAT_SPEC §2). */
const RUNS = { bold: [1, 2], italic: [1, 2], strike: [1, 2], code: [1], mono: [3] };
const LINE_MARKER = /^(?:[-*] |> |\d{1,3}\. )/u;

/* How many `ch` in a row from i, going forward (+1) or back (-1), within
   [min, max). */
function run(text, i, step, ch, min, max) {
  let n = 0;
  for (let j = i; j >= min && j < max && text[j] === ch; j += step) n += 1;
  return n;
}

/* The pieces of [start, end) to wrap: per line (or all of it, for monospace),
   without the spaces at their edges or a line's marker. */
function segmentsOf(value, start, end, kind) {
  const parts = [];
  const pushTrimmed = (s, e) => {
    while (s < e && /\s/u.test(value[s])) s += 1;
    while (e > s && /\s/u.test(value[e - 1])) e -= 1;
    if (e > s) parts.push({ s, e });
  };
  if (kind === "mono") {
    pushTrimmed(start, end);
    return parts;
  }
  let s = start;
  for (let i = start; i <= end; i += 1) {
    if (i < end && value[i] !== "\n") continue;
    let from = s;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    if (from === lineStart) {
      const marker = LINE_MARKER.exec(value.slice(lineStart, i));
      if (marker) from = lineStart + marker[0].length;
    }
    pushTrimmed(from, i);
    s = i + 1;
  }
  return parts;
}

/* Whether this piece is already wrapped: "inside" (the symbols are the
   piece's own edges) or "outside" (they're just past them), and how many. */
function wrapping(value, seg, kind) {
  const ch = SYMBOL[kind][0];
  const { s, e } = seg;
  const inA = run(value, s, 1, ch, s, e);
  const inB = run(value, e - 1, -1, ch, s, e);
  if (inA === inB && RUNS[kind].includes(inA) && 2 * inA < e - s) return { at: "inside", n: inA };
  const outA = run(value, s - 1, -1, ch, 0, value.length);
  const outB = run(value, e, 1, ch, 0, value.length);
  if (outA === outB && RUNS[kind].includes(outA)) return { at: "outside", n: outA };
  return null;
}

/* Replaces [from, to) as if typed: the browser's insert keeps Undo and fires
   the input event React's onChange reads. The fallback is pasteFormat.js's. */
function replace(el, from, to, text) {
  el.focus();
  el.setSelectionRange(from, to);
  if (document.execCommand?.("insertText", false, text)) return;
  el.setRangeText(text, from, to, "end");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/* Code and monospace in the text, exactly as the parser reads them
   (formatSpans): [{ start, end, size, kind }], `end` past the closing marker.
   Nothing inside them is formatted (TEXT_FORMAT_SPEC §2), so the tools work
   around them. Two markers can share a span ("`a``b`"), so they're counted
   one by one. */
function protectedRanges(value) {
  const ranges = [];
  let at = 0;
  let open = null;
  for (const span of formatSpans(value)) {
    const kind = span.mono ? "mono" : span.code ? "code" : null;
    if (span.symbol && kind) {
      const size = SYMBOL[kind].length;
      for (let k = 0; k + size <= span.text.length; k += size) {
        if (open && open.kind === kind) {
          ranges.push({ start: open.start, end: at + k + size, size, kind });
          open = null;
        } else {
          open = { start: at + k, kind };
        }
      }
    }
    at += span.text.length;
  }
  return ranges;
}

/* A selection edge inside code or monospace moves out to its marker, so the
   whole of it is taken: bold goes around the backticks, never inside. */
function around(ranges, s, e) {
  for (const r of ranges) {
    if (s > r.start && s < r.end) s = r.start;
    if (e > r.start && e < r.end) e = r.end;
  }
  return { s, e };
}

/* [s, e) without the markers of the code and monospace inside it. */
function stripMarkers(value, ranges, s, e) {
  let text = "";
  let cursor = s;
  for (const r of ranges) {
    if (r.start < s || r.end > e) continue;
    text += value.slice(cursor, r.start) + value.slice(r.start + r.size, r.end - r.size);
    cursor = r.end;
  }
  return text + value.slice(cursor, e);
}

/* What formatting [start, end) as `kind` does to `value`, as a plan: replace
   [from, to) with `text`, then select [selStart, selEnd). null when there is
   nothing to do. Twin of the app's mobile/src/components/FormatToolbar.tsx.
   - Bold, italic, strike: wrap; if already wrapped, unwrap. Inside code or
     monospace they go around it (~`exam`~), never inside, and never across
     a line.
   - Code and monospace: wrap; the same one again removes it; the other one
     switches the markers (` ↔ ```) instead of nesting them. Wrapping text
     that has code inside drops those inner markers.
   - Afterwards the same words are selected, so the same button undoes it. */
export function planFormat(value, start, end, kind) {
  const symbol = SYMBOL[kind];
  if (!symbol) return null;
  if (start === end) {
    const at = start + symbol.length;
    return { from: start, to: end, text: symbol + symbol, selStart: at, selEnd: at };
  }

  const ranges = protectedRanges(value);
  const marks = kind === "code" || kind === "mono";
  const segs = [];
  for (const seg of segmentsOf(value, start, end, kind)) {
    const { s, e } = around(ranges, seg.s, seg.e);
    // Only monospace may cross a line.
    if (kind !== "mono" && value.slice(s, e).includes("\n")) continue;
    const box = ranges.find((r) => r.start === s && r.end === e) ?? null;
    const wrap = marks ? null : wrapping(value, { s, e }, kind);
    segs.push({ s, e, os: seg.s, oe: seg.e, box, wrap, done: marks ? box?.kind === kind : !!wrap });
  }
  if (!segs.length) return null;
  const unwrap = segs.every((seg) => seg.done);

  /* Each piece: replace [rs, re) with before + content + after, where content
     is [innerS, innerE) (exact) or that with inner markers dropped. */
  const pieces = segs.map(({ s, e, os, oe, box, wrap, done }) => {
    if (marks && box) {
      const innerS = box.start + box.size;
      const innerE = box.end - box.size;
      if (done && !unwrap) return { rs: innerS, re: innerE, innerS, innerE, os, oe, before: "", after: "" };
      if (done) return { rs: box.start, re: box.end, innerS, innerE, os, oe, before: "", after: "" };
      // The other one: switch the markers.
      return { rs: box.start, re: box.end, innerS, innerE, os, oe, before: symbol, after: symbol };
    }
    if (marks) {
      const content = stripMarkers(value, ranges, s, e);
      const exact = content.length === e - s;
      return { rs: s, re: e, innerS: s, innerE: e, os, oe, before: symbol, after: symbol, content, exact };
    }
    if (wrap) {
      const n = wrap.n;
      const [rs, re, innerS, innerE] = wrap.at === "inside" ? [s, e, s + n, e - n] : [s - n, e + n, s, e];
      if (!unwrap) return { rs: innerS, re: innerE, innerS, innerE, os, oe, before: "", after: "" };
      return { rs, re, innerS, innerE, os, oe, before: "", after: "" };
    }
    return { rs: s, re: e, innerS: s, innerE: e, os, oe, before: symbol, after: symbol };
  });

  const from = pieces[0].rs;
  let cursor = from;
  let text = "";
  let selStart = null;
  let selEnd = from;
  for (const piece of pieces) {
    const content = piece.content ?? value.slice(piece.innerS, piece.innerE);
    const exact = piece.content == null || piece.exact;
    text += value.slice(cursor, piece.rs) + piece.before;
    const at = from + text.length;
    // The words that were selected, wherever they are now.
    const lead = exact ? Math.min(Math.max(piece.os - piece.innerS, 0), content.length) : 0;
    const trail = exact ? Math.min(Math.max(piece.innerE - piece.oe, 0), content.length - lead) : 0;
    selStart ??= at + lead;
    text += content;
    selEnd = from + text.length - trail;
    text += piece.after;
    cursor = piece.re;
  }
  return { from, to: cursor, text, selStart, selEnd };
}

export function applyFormat(el, kind) {
  if (!el || !SYMBOL[kind]) return;
  const plan = planFormat(el.value, el.selectionStart, el.selectionEnd, kind);
  if (!plan) return;
  replace(el, plan.from, plan.to, plan.text);
  el.setSelectionRange(plan.selStart, plan.selEnd);
}

/* Ctrl/Cmd + B, I, Shift+X, Shift+M (TEXT_FORMAT_SPEC §5.2). The letter is
   read from the key, or from the physical key on a non-Latin layout (a Hindi
   keyboard), so the shortcuts work there too. */
export function formatShortcut(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.nativeEvent?.isComposing || e.isComposing) return null;
  const key = /^[a-z]$/iu.test(e.key) ? e.key.toLowerCase() : (e.code ?? "").replace(/^Key/u, "").toLowerCase();
  if (!e.shiftKey && key === "b") return "bold";
  if (!e.shiftKey && key === "i") return "italic";
  if (e.shiftKey && key === "x") return "strike";
  if (e.shiftKey && key === "m") return "mono";
  return null;
}

/* For a textarea's onKeyDown: applies a shortcut and returns true, or leaves
   the key alone and returns false. */
export function handleFormatKey(e) {
  const kind = formatShortcut(e);
  if (!kind) return false;
  e.preventDefault();
  applyFormat(e.currentTarget, kind);
  return true;
}
