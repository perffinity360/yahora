/* frontend/src/utils/pasteFormat.js

   Pasting formatted text keeps its formatting, the way WhatsApp and Telegram
   do — docs/design/TEXT_FORMAT_SPEC.md §4. What was copied as rich text
   (a Google Doc, ChatGPT, a web page, Telegram Web, another post here) comes
   in as WhatsApp's symbols:

     bold → *bold*   italic → _italic_   strikethrough → ~gone~
     inline code → `code`   a code block → ```block```
     list items → "- " or "1. "   a blockquote → "> "

   Website only: a phone's text box is never handed the rich copy, so the app
   pastes plain text (and WhatsApp's own symbols, which are plain text, work
   there as everywhere).

   It follows the copied page's structure, and keeps a pair of symbols only
   where src/utils/textFormat.js would read them back as formatting: "*bold*"
   in the middle of a word would just show its asterisks, so that word comes in
   plain instead. If nothing in the paste is formatted, the browser pastes as
   usual.

   Usage, on a <textarea>:  onPaste={pasteFormatted} */

const WORD = /[\p{L}\p{M}\p{N}]/u;
const SPACE = /\s/u;
const isWord = (ch) => ch !== undefined && WORD.test(ch);
const isSpace = (ch) => ch !== undefined && SPACE.test(ch);

/* Bigger than any sensible post; past it, the browser pastes plain text. */
const MAX_HTML_CHARS = 400_000;

const KINDS = ["bold", "italic", "strike", "code"];
const SYMBOL = { bold: "*", italic: "_", strike: "~", code: "`" };
const BOLD_TAGS = new Set(["B", "STRONG", "H1", "H2", "H3", "H4", "H5", "H6", "TH"]);
const ITALIC_TAGS = new Set(["I", "EM", "CITE", "VAR", "DFN"]);
const STRIKE_TAGS = new Set(["S", "STRIKE", "DEL"]);
const CODE_TAGS = new Set(["CODE", "KBD", "SAMP", "TT"]);
const MONO_FONT = /monospace|courier|consolas|menlo|monaco|sf mono/i;
const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION",
  "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV",
  "OL", "P", "SECTION", "TABLE", "TR", "UL",
]);
const SKIP_TAGS = new Set([
  "AUDIO", "BUTTON", "CANVAS", "HEAD", "IFRAME", "IMG", "INPUT", "META", "NOSCRIPT", "OBJECT",
  "SCRIPT", "SELECT", "STYLE", "SVG", "TEMPLATE", "TEXTAREA", "TITLE", "VIDEO",
]);

/* Writes the text line by line. Each formatting pair is placed against its
   first and last visible character, so spaces stay outside the symbols, and
   is closed at the end of a line and opened again on the next, because the
   symbols never reach across a line. */
class Writer {
  constructor() {
    this.lines = [];
    this.pieces = [];
    this.hasContent = false;
    this.listPrefix = null;
    this.quoteDepth = 0;
    this.active = [];
    this.pairs = [];
    this.structured = false;
  }

  newPair(kind) {
    const pair = { kind, open: null, close: null, dropped: false };
    this.pairs.push(pair);
    return pair;
  }

  marker(pair, side) {
    return { pair, side, symbol: SYMBOL[pair.kind] };
  }

  open(kind) {
    this.active.push(this.newPair(kind));
  }

  close(kind) {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      if (this.active[i].kind !== kind) continue;
      const [pair] = this.active.splice(i, 1);
      if (pair.open) this.placeClose(pair);
      return;
    }
  }

  /* Before any spaces at the end of the line, so they stay outside. */
  placeClose(pair) {
    const marker = this.marker(pair, "close");
    pair.close = marker;
    for (let i = this.pieces.length - 1; i >= 0; i -= 1) {
      const piece = this.pieces[i];
      if (typeof piece !== "string") {
        this.pieces.splice(i + 1, 0, marker);
        return;
      }
      const kept = piece.replace(/\s+$/u, "");
      if (kept) {
        this.pieces.splice(i, 1, kept, marker, piece.slice(kept.length));
        return;
      }
    }
    this.pieces.push(marker);
  }

  startContent() {
    if (this.hasContent) return;
    this.hasContent = true;
    const lead = `${this.quoteDepth > 0 ? "> " : ""}${this.listPrefix ?? ""}`;
    if (lead) {
      this.pieces.push(lead);
      this.structured = true;
    }
    this.listPrefix = null;
  }

  text(raw) {
    let s = raw;
    if (!this.hasContent) s = s.replace(/^\s+/u, "");
    if (!s) return;
    const first = s.search(/\S/u);
    if (first === -1) {
      this.pieces.push(s);
      return;
    }
    this.startContent();
    if (first > 0) this.pieces.push(s.slice(0, first));
    for (const pair of this.active) {
      if (!pair.open) {
        pair.open = this.marker(pair, "open");
        this.pieces.push(pair.open);
      }
    }
    const rest = s.slice(first);
    // A backtick inside code can't be written with backticks around it.
    if (rest.includes("`")) {
      for (const pair of this.active) if (pair.kind === "code") pair.dropped = true;
    }
    this.pieces.push(rest);
  }

  /* hard: a <br>, which always ends a line, even an empty one. Otherwise the
     edge of a block, which never makes an empty line. */
  endLine(hard) {
    if (!this.hasContent && !hard) return;
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const pair = this.active[i];
      if (!pair.open) continue;
      this.placeClose(pair);
      this.active[i] = this.newPair(pair.kind);
    }
    this.lines.push(this.pieces);
    this.pieces = [];
    this.hasContent = false;
  }

  prefix(lead) {
    this.listPrefix = lead;
  }

  /* A code block, kept exactly as it was, between ``` fences. */
  mono(raw) {
    this.endLine(false);
    const body = raw.replace(/\n+$/u, "");
    if (!body.trim()) return;
    if (body.includes("```")) {
      for (const line of body.split("\n")) {
        this.text(line);
        this.endLine(true);
      }
      return;
    }
    this.pieces.push(`\`\`\`${body}\`\`\``);
    this.hasContent = true;
    this.structured = true;
    this.endLine(false);
  }

  /* Drops every pair textFormat.js wouldn't read as formatting, until none is
     left to drop (dropping one can change what its neighbours touch). */
  settle() {
    for (const pair of this.pairs) {
      if (!pair.open || !pair.close) pair.dropped = true;
    }
    for (let changed = true; changed; ) {
      changed = false;
      for (const pieces of this.lines) {
        const units = [];
        for (const piece of pieces) {
          if (typeof piece === "string") for (const ch of piece) units.push({ ch });
          else if (!piece.pair.dropped) units.push({ ch: piece.symbol, marker: piece });
        }
        units.forEach((unit, i) => {
          const pair = unit.marker?.pair;
          if (!pair || pair.dropped) return;
          const before = units[i - 1]?.ch;
          const after = units[i + 1]?.ch;
          const ok =
            unit.marker.side === "open"
              ? !isWord(before) && after !== undefined && !isSpace(after)
              : before !== undefined && !isSpace(before) && !isWord(after);
          if (!ok) {
            pair.dropped = true;
            changed = true;
          }
        });
      }
    }
  }

  finish() {
    this.endLine(false);
    this.settle();
    const text = this.lines
      .map((pieces) =>
        pieces
          .map((p) => (typeof p === "string" ? p : p.pair.dropped ? "" : p.symbol))
          .join("")
          .replace(/[ \t]+$/u, ""),
      )
      .join("\n")
      .replace(/\n{3,}/gu, "\n\n")
      .trim();
    const formatted = this.structured || this.pairs.some((p) => !p.dropped);
    return { text, formatted };
  }
}

/* The formatting this element turns on, given what its parents already did. */
function stylesOf(el, state) {
  const style = el.style;
  const weight = style?.fontWeight ?? "";
  const fontStyle = style?.fontStyle ?? "";
  const decoration = `${style?.textDecorationLine ?? ""} ${style?.textDecoration ?? ""}`;
  return {
    bold:
      state.bold ||
      (weight ? weight === "bold" || weight === "bolder" || Number(weight) >= 600 : BOLD_TAGS.has(el.tagName)),
    italic: state.italic || (fontStyle ? /italic|oblique/u.test(fontStyle) : ITALIC_TAGS.has(el.tagName)),
    strike: state.strike || decoration.includes("line-through") || STRIKE_TAGS.has(el.tagName),
    code: state.code || CODE_TAGS.has(el.tagName) || MONO_FONT.test(style?.fontFamily ?? ""),
  };
}

function walk(node, state, w) {
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      w.text(child.data.replace(/[\s ]+/gu, " "));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = child.tagName;
    if (SKIP_TAGS.has(tag)) continue;
    if (tag === "BR") {
      w.endLine(true);
      continue;
    }
    if (tag === "PRE" || /^pre/u.test(child.style?.whiteSpace ?? "")) {
      w.mono(child.textContent ?? "");
      continue;
    }

    const block = BLOCK_TAGS.has(tag);
    if (block) w.endLine(false);
    if (tag === "BLOCKQUOTE") w.quoteDepth += 1;

    let list = state.list;
    if (tag === "UL" || tag === "OL") {
      list = { ordered: tag === "OL", next: Number(child.getAttribute("start")) || 1 };
    } else if (tag === "LI") {
      const own = state.list ?? { ordered: false, next: 1 };
      w.prefix(own.ordered ? `${own.next}. ` : "- ");
      own.next += 1;
    }

    const next = stylesOf(child, state);
    // Nothing is formatted inside code.
    const opened = KINDS.filter((k) => next[k] && !state[k] && !(state.code && k !== "code"));
    opened.forEach((k) => w.open(k));
    walk(child, { ...next, list }, w);
    opened.reverse().forEach((k) => w.close(k));
    // A table row comes in as one line, its cells a space apart.
    if (tag === "TD" || tag === "TH") w.text(" ");

    if (tag === "BLOCKQUOTE") w.quoteDepth -= 1;
    if (block) w.endLine(false);
  }
}

/** The copied HTML as text with WhatsApp's symbols: { text, formatted }. */
export function htmlToFormatted(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const w = new Writer();
  walk(doc.body, { bold: false, italic: false, strike: false, code: false, list: null }, w);
  return w.finish();
}

/* Into the textarea at the cursor, as if typed: execCommand keeps the
   browser's undo, and fires the input event that React's onChange reads. */
function insertAtCursor(el, text) {
  el.focus();
  if (document.execCommand?.("insertText", false, text)) return;
  el.setRangeText(text, el.selectionStart, el.selectionEnd, "end");
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** onPaste for a textarea. Returns true when it pasted the formatted text. */
export function pasteFormatted(event) {
  const html = event.clipboardData?.getData("text/html");
  if (!html || html.length > MAX_HTML_CHARS) return false;
  let result;
  try {
    result = htmlToFormatted(html);
  } catch {
    return false;
  }
  if (!result.formatted || !result.text) return false;
  event.preventDefault();
  insertAtCursor(event.currentTarget, result.text);
  return true;
}
