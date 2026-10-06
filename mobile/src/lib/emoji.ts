/**
 * ── EMOJI IN MESSAGES (WhatsApp-style) ──
 *
 * Two rules, both size only — the artwork is the phone's own emoji font:
 *   1. Inside text, an emoji is drawn larger than the letters around it
 *      (EMOJI_SIZES.inline), so it reads as a picture, not a smudge at 14.
 *   2. A message that is ONLY emoji, one to three of them, is drawn big:
 *      the fewer, the bigger (EMOJI_SIZES.jumbo).
 *
 * The web implements the same two rules with the same numbers; see the 6A
 * changelog entry "Chat: emoji sizing, jump-to-latest, welcome sticker".
 */

/**
 * One emoji as the eye sees it: a flag (two regional indicators), a keycap, or
 * a pictograph with its skin tone, variation selector and any ZWJ-joined parts
 * (👨‍👩‍👧, 🏳️‍🌈) — so a family is enlarged as one, never split mid-sequence.
 *
 * A pictograph counts only in emoji presentation: one that is emoji by default
 * (😂 🔥), or a text-default one followed by U+FE0F (❤️). That keeps ©, ® and ™
 * in a sentence at text size, as the Unicode rules intend.
 */
const EMOJI =
  /\p{RI}\p{RI}|[#*0-9]️?⃣|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️)\p{EMod}?[\u{E0020}-\u{E007F}]*(?:‍\p{Extended_Pictographic}️?\p{EMod}?)*️?/gu;

/** Most emoji a message can hold and still be drawn jumbo. */
const JUMBO_MAX = 3;

export interface TextRun {
  text: string;
  emoji: boolean;
}

/** Split text into alternating plain and emoji runs, in order. */
export function splitEmoji(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let last = 0;
  for (const match of text.matchAll(EMOJI)) {
    const at = match.index ?? 0;
    if (at > last) runs.push({ text: text.slice(last, at), emoji: false });
    runs.push({ text: match[0], emoji: true });
    last = at + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), emoji: false });
  return runs;
}

/**
 * How many emoji a message is, if it is nothing but one to JUMBO_MAX emoji
 * (spaces allowed between them). 0 for anything else, including more than
 * JUMBO_MAX — a long row of emoji stays at the inline size.
 */
export function jumboEmojiCount(text: string): number {
  const matches = text.match(EMOJI);
  if (!matches || matches.length > JUMBO_MAX) return 0;
  return text.replace(EMOJI, '').trim() === '' ? matches.length : 0;
}
