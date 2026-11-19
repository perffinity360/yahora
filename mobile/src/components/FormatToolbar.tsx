import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { formatSpans } from '../lib/textFormat';
import { colors, radius, shadows } from '../theme';

/**
 * ── FORMAT TOOLBAR (spec §5.5) ──
 *
 * The app's selection tools: a bar of B · I · S · code · monospace that the
 * chat shows at the top of the conversation, just under the header, while
 * text is selected in the box, doing what the website's selection bar and
 * shortcuts do. The screen shows it (it knows the selection, from
 * onSelectionChange) and applies the result of applyFormat.
 *
 * Not near the box: the phone's own Cut / Copy / Paste menu floats next to the
 * selection and covered the bar there. Hiding that menu took away Android's
 * selection handles too (one word only), so the menu stays and the bar moved.
 *
 * Its buttons act on finger-down (onPressIn) and never take the focus from the
 * box or put the keyboard away (Pressables don't take focus). The screen keeps
 * the selection the buttons act on, since Android collapses the box's own
 * selection when the row is touched (TEXT_FORMAT_SPEC §5.5).
 */

// BEGIN format rules (tested by scripts/check-format-selection.mjs, run there
// without React Native; twin of frontend/src/utils/formatSelection.js)
export type FormatKind = 'bold' | 'italic' | 'strike' | 'code' | 'mono';

export interface Selection {
  start: number;
  end: number;
}

/* ── applyFormat: the website's rules (planFormat in
   frontend/src/utils/formatSelection.js), line for line. Keep the two in step. ──
   - Wraps the selection; if it is already wrapped (the symbols inside its
     edges, or just outside them), takes them off instead.
   - Spaces at the edges of the selection stay outside the symbols, and so does
     a line's marker ("- ", "1. ", "> "), which would stop being one.
   - With nothing selected, a pair goes in with the cursor between.
   - Over several lines, each line is wrapped on its own (bold and the rest
     never cross a line). Monospace may, so it wraps the whole selection once.
   - Code and monospace are protected: bold, italic and strike go around them
     (~`exam`~), never inside; code and monospace switch markers (` ↔ ```)
     instead of nesting; the active one again removes it.
   - Afterwards the same words are selected, so the same button takes the
     symbols off again. */

const SYMBOL: Record<FormatKind, string> = { bold: '*', italic: '_', strike: '~', code: '`', mono: '```' };
const RUNS: Record<FormatKind, number[]> = { bold: [1, 2], italic: [1, 2], strike: [1, 2], code: [1], mono: [3] };
const LINE_MARKER = /^(?:[-*] |> |\d{1,3}\. )/u;

interface Segment {
  s: number;
  e: number;
}
interface Wrap {
  at: 'inside' | 'outside';
  n: number;
}
interface Range {
  start: number;
  end: number;
  size: number;
  kind: FormatKind;
}
interface Piece {
  rs: number;
  re: number;
  innerS: number;
  innerE: number;
  os: number;
  oe: number;
  before: string;
  after: string;
  content?: string;
  exact?: boolean;
}
export interface FormatPlan {
  from: number;
  to: number;
  text: string;
  selStart: number;
  selEnd: number;
}

function run(text: string, i: number, step: number, ch: string, min: number, max: number): number {
  let n = 0;
  for (let j = i; j >= min && j < max && text[j] === ch; j += step) n += 1;
  return n;
}

function segmentsOf(value: string, start: number, end: number, kind: FormatKind): Segment[] {
  const parts: Segment[] = [];
  const pushTrimmed = (s: number, e: number) => {
    while (s < e && /\s/u.test(value[s])) s += 1;
    while (e > s && /\s/u.test(value[e - 1])) e -= 1;
    if (e > s) parts.push({ s, e });
  };
  if (kind === 'mono') {
    pushTrimmed(start, end);
    return parts;
  }
  let s = start;
  for (let i = start; i <= end; i += 1) {
    if (i < end && value[i] !== '\n') continue;
    let from = s;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    if (from === lineStart) {
      const marker = LINE_MARKER.exec(value.slice(lineStart, i));
      if (marker) from = lineStart + marker[0].length;
    }
    pushTrimmed(from, i);
    s = i + 1;
  }
  return parts;
}

function wrapping(value: string, seg: Segment, kind: FormatKind): Wrap | null {
  const ch = SYMBOL[kind][0];
  const { s, e } = seg;
  const inA = run(value, s, 1, ch, s, e);
  const inB = run(value, e - 1, -1, ch, s, e);
  if (inA === inB && RUNS[kind].includes(inA) && 2 * inA < e - s) return { at: 'inside', n: inA };
  const outA = run(value, s - 1, -1, ch, 0, value.length);
  const outB = run(value, e, 1, ch, 0, value.length);
  if (outA === outB && RUNS[kind].includes(outA)) return { at: 'outside', n: outA };
  return null;
}

/* Code and monospace in the text, exactly as the parser reads them
   (formatSpans): [{ start, end, size, kind }], `end` past the closing marker.
   Nothing inside them is formatted (TEXT_FORMAT_SPEC §2), so the tools work
   around them. Two markers can share a span ("`a``b`"), so they're counted
   one by one. */
function protectedRanges(value: string): Range[] {
  const ranges: Range[] = [];
  let at = 0;
  let open: { start: number; kind: FormatKind } | null = null;
  for (const span of formatSpans(value)) {
    const kind: FormatKind | null = span.mono ? 'mono' : span.code ? 'code' : null;
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
function around(ranges: Range[], s: number, e: number): Segment {
  for (const r of ranges) {
    if (s > r.start && s < r.end) s = r.start;
    if (e > r.start && e < r.end) e = r.end;
  }
  return { s, e };
}

/* [s, e) without the markers of the code and monospace inside it. */
function stripMarkers(value: string, ranges: Range[], s: number, e: number): string {
  let text = '';
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
   nothing to do. */
export function planFormat(value: string, start: number, end: number, kind: FormatKind): FormatPlan | null {
  const symbol = SYMBOL[kind];
  if (!symbol) return null;
  if (start === end) {
    const at = start + symbol.length;
    return { from: start, to: end, text: symbol + symbol, selStart: at, selEnd: at };
  }

  const ranges = protectedRanges(value);
  const marks = kind === 'code' || kind === 'mono';
  const segs: (Segment & { os: number; oe: number; box: Range | null; wrap: Wrap | null; done: boolean })[] = [];
  for (const seg of segmentsOf(value, start, end, kind)) {
    const { s, e } = around(ranges, seg.s, seg.e);
    // Only monospace may cross a line.
    if (kind !== 'mono' && value.slice(s, e).includes('\n')) continue;
    const box = ranges.find((r) => r.start === s && r.end === e) ?? null;
    const wrap = marks ? null : wrapping(value, { s, e }, kind);
    segs.push({ s, e, os: seg.s, oe: seg.e, box, wrap, done: marks ? box?.kind === kind : !!wrap });
  }
  if (!segs.length) return null;
  const unwrap = segs.every((seg) => seg.done);

  /* Each piece: replace [rs, re) with before + content + after, where content
     is [innerS, innerE) (exact) or that with inner markers dropped. */
  const pieces: Piece[] = segs.map(({ s, e, os, oe, box, wrap, done }) => {
    if (marks && box) {
      const innerS = box.start + box.size;
      const innerE = box.end - box.size;
      if (done && !unwrap) return { rs: innerS, re: innerE, innerS, innerE, os, oe, before: '', after: '' };
      if (done) return { rs: box.start, re: box.end, innerS, innerE, os, oe, before: '', after: '' };
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
      const [rs, re, innerS, innerE] = wrap.at === 'inside' ? [s, e, s + n, e - n] : [s - n, e + n, s, e];
      if (!unwrap) return { rs: innerS, re: innerE, innerS, innerE, os, oe, before: '', after: '' };
      return { rs, re, innerS, innerE, os, oe, before: '', after: '' };
    }
    return { rs: s, re: e, innerS: s, innerE: e, os, oe, before: symbol, after: symbol };
  });

  const from = pieces[0].rs;
  let cursor = from;
  let text = '';
  let selStart: number | null = null;
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
  return { from, to: cursor, text, selStart: selStart ?? from, selEnd };
}

/** The text and the selection after formatting `selection` as `kind`. */
export function applyFormat(
  value: string,
  selection: Selection,
  kind: FormatKind,
): { value: string; selection: Selection } {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  const plan = planFormat(value, start, end, kind);
  if (!plan) return { value, selection: { start, end } };
  const next = value.slice(0, plan.from) + plan.text + value.slice(plan.to);
  return { value: next, selection: { start: plan.selStart, end: plan.selEnd } };
}
// END format rules

/* ── The row ── */

/** The bar's whole height: 44 px buttons and 2 px above and below. */
export const FORMAT_ROW_HEIGHT = 48;
const BUTTON = 44;

type Icon = keyof typeof MaterialCommunityIcons.glyphMap;

const BUTTONS: { kind: FormatKind; label: string; icon: Icon }[] = [
  { kind: 'bold', label: 'Bold', icon: 'format-bold' },
  { kind: 'italic', label: 'Italic', icon: 'format-italic' },
  { kind: 'strike', label: 'Strikethrough', icon: 'format-strikethrough-variant' },
  { kind: 'code', label: 'Code', icon: 'code-tags' },
  { kind: 'mono', label: 'Monospace', icon: 'code-braces-box' },
];

interface Props {
  /** Called with the pressed button's own kind. */
  onFormat: (kind: FormatKind) => void;
}

/* Acts on finger-down, not finger-up: the moment the button is touched. */
function tap(run: () => void) {
  return () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    run();
  };
}

function ToolButton({ name, label, icon, onPress }: { name: string; label: string; icon: Icon; onPress: () => void }) {
  return (
    <Pressable
      onPressIn={tap(onPress)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      {({ pressed }) => (
        <MaterialCommunityIcons name={icon} size={20} color={pressed ? colors.purple : colors.blackSoft} />
      )}
    </Pressable>
  );
}

/** B · I · S · code · mono (TEXT_FORMAT_SPEC §5.5). Cut / Copy / Paste are the
 *  phone's own menu's. */
export function FormatToolbar({ onFormat }: Props) {
  return (
    <Reanimated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(120)}
      style={styles.row}
      accessibilityRole="toolbar"
      accessibilityLabel="Format the selected text"
    >
      {BUTTONS.map(({ kind, label, icon }) => (
        <Fragment key={kind}>
          {/* Text looks │ code looks. */}
          {kind === 'code' ? <View style={styles.divider} /> : null}
          {/* Each button wraps with its OWN kind. */}
          <ToolButton name={kind} label={label} icon={icon} onPress={() => onFormat(kind)} />
        </Fragment>
      ))}
    </Reanimated.View>
  );
}

/* A small white pill floating under the header, like the website's selection
   bar (FormatBar) and the community's quick bar: the quick bar's raised shadow
   (a hairline ring and a soft lift), plain icons that tint on a press. */
const styles = StyleSheet.create({
  row: {
    height: FORMAT_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 2,
    borderRadius: radius.md + 2,
    backgroundColor: colors.white,
    boxShadow: shadows.quickBarRaised,
  },
  /* 44 × 44: the smallest comfortable touch target; no fill until pressed. */
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.pinkBg,
    transform: [{ scale: 0.94 }],
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 2,
    backgroundColor: colors.messagesBarBorder,
  },
});

export default FormatToolbar;
