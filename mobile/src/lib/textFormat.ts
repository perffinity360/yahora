/**
 * ── TEXT FORMATTING (WhatsApp-style) ──
 *
 * For chat messages and community posts — docs/design/TEXT_FORMAT_SPEC.md.
 *
 * The app twin of frontend/src/utils/textFormat.js: the same rules, line for
 * line. If one changes, change both in the same commit, then run
 * `node scripts/check-text-format.mjs`, which runs both against the same cases.
 * (So this file imports nothing: Node runs it as it is.)
 *
 * Text is stored exactly as it was typed, symbols and all, the way WhatsApp
 * stores it. Only the screen draws it formatted, so copying a message copies
 * the symbols, and an older client simply shows them.
 *
 *   *bold*   _italic_   ~strikethrough~   `inline code`      within one line
 *   ```monospace```                                          may span lines
 *   - item   * item   1. item   > quote                      at a line's start
 *
 * A symbol formats only at the edge of a word. The opening one comes after a
 * space, punctuation or the start of the line, and is followed by something
 * that isn't a space; the closing one follows something that isn't a space,
 * and comes before a space, punctuation or the end. So snake_case_name, 2*3*4
 * and a lone * stay as typed. Code, monospace and links are found first, and
 * nothing inside them is formatted: an underscore in a URL never makes it
 * italic.
 *
 * plainText(text) is the same text without the symbols, for one-line previews
 * (the inbox, a reply's quote).
 */

export type FormatNode =
  | { type: 'text'; text: string }
  | { type: 'bold' | 'italic' | 'strike'; children: FormatNode[] }
  | { type: 'mono' | 'code'; text: string }
  | { type: 'link'; text: string; href: string };

export interface FormatLine {
  kind: 'text' | 'bullet' | 'number' | 'quote';
  /** The number as typed ("12."), for kind "number". */
  marker: string | null;
  nodes: FormatNode[];
}

interface Range {
  start: number;
  end: number;
  node: FormatNode;
}

/* Letters, the marks that combine with them (Devanagari's vowel signs) and
   digits: a symbol next to one of these is inside a word. */
const WORD = /[\p{L}\p{M}\p{N}]/u;
const SPACE = /\s/u;
const LINK = /(?<![\p{L}\p{M}\p{N}])(?:https?:\/\/|www\.)[^\s<>"]+/giu;
const LINK_HEAD = /^(?:https?:\/\/|www\.)./iu;
const LINK_PUNCTUATION = ".,!?;:]'\"";
const NUMBERED = /^(\d{1,3})\. /u;
const FENCE = '```';
const INLINE: Record<string, 'bold' | 'italic' | 'strike'> = { '*': 'bold', _: 'italic', '~': 'strike' };
const SYMBOLS = '*_~';

const isWord = (ch: string | undefined) => ch !== undefined && WORD.test(ch);
const isSpace = (ch: string | undefined) => ch !== undefined && SPACE.test(ch);
const count = (text: string, ch: string) => text.split(ch).length - 1;

/* Where a link found at `start` really ends. Punctuation after it isn't part
   of it ("see example.com." links example.com); a ")" is, while the link's
   own brackets need it (a Wikipedia page); and symbols that close formatting
   opened just before it aren't ("*https://x.com*" is a bold link), matched
   from the outside in, so a link of its own ending in "_" keeps it. */
function trimLink(text: string, start: number, raw: string): string {
  let url = raw;
  for (;;) {
    const last = url[url.length - 1] ?? '\0';
    if (LINK_PUNCTUATION.includes(last) || (last === ')' && count(url, '(') < count(url, ')'))) {
      url = url.slice(0, -1);
      continue;
    }
    let opened = 0;
    while (SYMBOLS.includes(text[start - 1 - opened] ?? '\0')) opened += 1;
    let closed = 0;
    while (
      closed < opened &&
      closed < url.length &&
      url[url.length - 1 - closed] === text[start - opened + closed]
    ) {
      closed += 1;
    }
    if (closed === 0) return url;
    url = url.slice(0, -closed);
  }
}

/* The symbol of `size` characters at i may open: not after a letter or digit,
   and not followed by a space or the end. */
function canOpen(text: string, i: number, size: number): boolean {
  const next = text[i + size];
  return !isWord(text[i - 1]) && next !== undefined && !isSpace(next);
}

/* The symbol at j may close: after something that isn't a space, and not
   before a letter or digit. */
function canClose(text: string, j: number, size: number): boolean {
  const prev = text[j - 1];
  return prev !== undefined && !isSpace(prev) && !isWord(text[j + size]);
}

/* Monospace, inline code and links: the parts nothing else may format. Sorted
   by start, never overlapping. */
function protectedRanges(text: string): Range[] {
  const ranges: Range[] = [];
  const taken = (start: number, end: number) => ranges.some((r) => start < r.end && end > r.start);

  // ```monospace```, across lines too. Only its edges follow the word rule;
  // inside, anything goes, as long as it isn't all space.
  for (let i = text.indexOf(FENCE); i !== -1; ) {
    let end = -1;
    if (!isWord(text[i - 1])) {
      for (let j = text.indexOf(FENCE, i + 3); j !== -1; j = text.indexOf(FENCE, j + 1)) {
        if (!isWord(text[j + 3]) && text.slice(i + 3, j).trim() !== '') {
          end = j;
          break;
        }
      }
    }
    if (end === -1) {
      i = text.indexOf(FENCE, i + 1);
      continue;
    }
    ranges.push({ start: i, end: end + 3, node: { type: 'mono', text: text.slice(i + 3, end) } });
    i = text.indexOf(FENCE, end + 3);
  }

  // `inline code`, within one line, never touching another backtick. The
  // first backtick after the opening one decides: it closes, or there's no
  // code here.
  for (let i = text.indexOf('`'); i !== -1; ) {
    let end = -1;
    if (text[i - 1] !== '`' && text[i + 1] !== '`' && !taken(i, i + 1) && canOpen(text, i, 1)) {
      for (let j = i + 2; j < text.length && text[j] !== '\n'; j += 1) {
        if (text[j] !== '`') continue;
        if (text[j + 1] !== '`' && !taken(j, j + 1) && canClose(text, j, 1)) end = j;
        break;
      }
    }
    if (end === -1) {
      i = text.indexOf('`', i + 1);
      continue;
    }
    ranges.push({ start: i, end: end + 1, node: { type: 'code', text: text.slice(i + 1, end) } });
    i = text.indexOf('`', end + 1);
  }

  for (const match of text.matchAll(LINK)) {
    const start = match.index ?? 0;
    const url = trimLink(text, start, match[0]);
    const end = start + url.length;
    if (!LINK_HEAD.test(url) || taken(start, end)) continue;
    const href = /^www\./iu.test(url) ? `https://${url}` : url;
    ranges.push({ start, end, node: { type: 'link', text: url, href } });
  }

  return ranges.sort((a, b) => a.start - b.start);
}

/* Where the symbol at i (bold, italic or strike) closes, before `to`, or -1.
   Protected parts are skipped whole; the content can't be empty. */
function findClose(text: string, i: number, to: number, startsAt: Map<number, Range>): number {
  for (let j = i + 1; j < to; j += 1) {
    const range = startsAt.get(j);
    if (range) {
      j = range.end - 1;
      continue;
    }
    if (j > i + 1 && text[j] === text[i] && canClose(text, j, 1)) return j;
  }
  return -1;
}

function parseInline(text: string, from: number, to: number, startsAt: Map<number, Range>): FormatNode[] {
  const nodes: FormatNode[] = [];
  let plain = '';
  const flush = () => {
    if (plain) nodes.push({ type: 'text', text: plain });
    plain = '';
  };
  for (let i = from; i < to; ) {
    const range = startsAt.get(i);
    if (range) {
      flush();
      nodes.push(range.node);
      i = range.end;
      continue;
    }
    const type = INLINE[text[i]];
    if (type && canOpen(text, i, 1)) {
      const close = findClose(text, i, to, startsAt);
      if (close !== -1) {
        flush();
        nodes.push({ type, children: parseInline(text, i + 1, close, startsAt) });
        i = close + 1;
        continue;
      }
    }
    plain += text[i];
    i += 1;
  }
  flush();
  return nodes;
}

/* A line's kind comes from how it starts: "- " or "* " (a bullet), "1. "
   (a numbered item), "> " (a quote). */
function parseLine(text: string, from: number, to: number, startsAt: Map<number, Range>): FormatLine {
  let kind: FormatLine['kind'] = 'text';
  let marker: string | null = null;
  let at = from;
  const head = text.slice(from, Math.min(to, from + 5));
  if (head.startsWith('- ') || head.startsWith('* ')) {
    kind = 'bullet';
    at = from + 2;
  } else if (head.startsWith('> ')) {
    kind = 'quote';
    at = from + 2;
  } else {
    const number = NUMBERED.exec(head);
    if (number) {
      kind = 'number';
      marker = `${number[1]}.`;
      at = from + number[0].length;
    }
  }
  // A marker with nothing after it is just what was typed.
  if (at >= to) {
    kind = 'text';
    marker = null;
    at = from;
  }
  return { kind, marker, nodes: parseInline(text, at, to, startsAt) };
}

export function parseFormatted(text: string | null | undefined): FormatLine[] {
  const source = text ?? '';
  const ranges = protectedRanges(source);
  const startsAt = new Map(ranges.map((r) => [r.start, r]));
  const insideRange = (i: number) => ranges.some((r) => i > r.start && i < r.end);

  // Lines end at a line break, except one inside monospace, which keeps its
  // lines together.
  const lines: FormatLine[] = [];
  let from = 0;
  for (let i = 0; i <= source.length; i += 1) {
    if (i < source.length && (source[i] !== '\n' || insideRange(i))) continue;
    lines.push(parseLine(source, from, i, startsAt));
    from = i + 1;
  }
  // A break at the very end shows no empty line after it.
  if (lines.length > 1 && source.endsWith('\n')) lines.pop();
  return lines;
}

function flatten(nodes: FormatNode[]): string {
  return nodes.map((n) => ('children' in n ? flatten(n.children) : n.text)).join('');
}

export function plainText(text: string | null | undefined): string {
  return parseFormatted(text)
    .map((line) => {
      const lead = line.kind === 'bullet' ? '• ' : line.kind === 'number' ? `${line.marker} ` : '';
      return lead + flatten(line.nodes);
    })
    .join('\n');
}
