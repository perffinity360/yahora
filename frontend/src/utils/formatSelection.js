/* frontend/src/utils/formatSelection.js

   The typing tools of docs/design/TEXT_FORMAT_SPEC.md §5.2 and §5.3: wrap the
   selection in WhatsApp's symbols, or take them off again.

     applyFormat(textarea, kind)   kind "bold" | "italic" | "strike" | "code" | "mono"
     formatShortcut(event)         the kind a key press asks for, or null

   - Wraps the selection; if it is already wrapped (the symbols inside its
     edges, or just outside them), takes them off instead.
   - Spaces at the edges of the selection stay outside the symbols, and so does
     a line's marker ("- ", "1. ", "> "), which would stop being one.
   - With nothing selected, a pair goes in with the cursor between.
   - Over several lines, each line is wrapped on its own (bold and the rest
     never cross a line). Monospace may, so it wraps the whole selection once.
   - The edit goes in through the browser's own insert, as one step, so Undo
     restores the text exactly; afterwards the same words are selected, so the
     same keys take the symbols off again. */

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

export function applyFormat(el, kind) {
  const symbol = SYMBOL[kind];
  if (!el || !symbol) return;
  const value = el.value;
  const { selectionStart: start, selectionEnd: end } = el;

  if (start === end) {
    replace(el, start, end, symbol + symbol);
    el.setSelectionRange(start + symbol.length, start + symbol.length);
    return;
  }

  const segs = segmentsOf(value, start, end, kind).map((seg) => ({ ...seg, wrap: wrapping(value, seg, kind) }));
  if (!segs.length) return;
  const unwrap = segs.every((seg) => seg.wrap);

  const first = segs[0];
  const from = unwrap && first.wrap.at === "outside" ? first.s - first.wrap.n : first.s;
  let cursor = from;
  let out = "";
  let selStart = null;
  let selEnd = null;
  for (const seg of segs) {
    const { s, e, wrap } = seg;
    if (unwrap) {
      const n = wrap.n;
      const [outerS, outerE, innerS, innerE] =
        wrap.at === "inside" ? [s, e, s + n, e - n] : [s - n, e + n, s, e];
      out += value.slice(cursor, outerS);
      selStart ??= from + out.length;
      out += value.slice(innerS, innerE);
      selEnd = from + out.length;
      cursor = outerE;
    } else if (wrap) {
      // Mixed: this line is wrapped already, the others get wrapped.
      const n = wrap.n;
      const [innerS, innerE] = wrap.at === "inside" ? [s + n, e - n] : [s, e];
      out += value.slice(cursor, innerS);
      selStart ??= from + out.length;
      out += value.slice(innerS, innerE);
      selEnd = from + out.length;
      cursor = innerE;
    } else {
      out += value.slice(cursor, s) + symbol;
      selStart ??= from + out.length;
      out += value.slice(s, e);
      selEnd = from + out.length;
      out += symbol;
      cursor = e;
    }
  }

  replace(el, from, cursor, out);
  el.setSelectionRange(selStart, selEnd);
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
