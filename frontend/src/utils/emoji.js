/**
 * ── EMOJI IN MESSAGES (WhatsApp-style) ──
 *
 * The web twin of mobile/src/lib/emoji.ts — same regex, same numbers. If one
 * changes, change both, or the two apps disagree about which messages go big.
 *
 * Two rules, both size only — the artwork is the device's own emoji font:
 *   1. Inside text, an emoji is drawn at EMOJI_SIZES.inline, larger than the
 *      14px letters around it, so it reads as a picture.
 *   2. A message that is ONLY emoji, one to three of them, is drawn at
 *      EMOJI_SIZES.jumbo: the fewer, the bigger. Four or more stay inline-sized.
 */

/** px. Tuned on a phone — keep identical to mobile's EMOJI_SIZES. */
export const EMOJI_SIZES = {
  inline: 18,
  jumbo: { 1: 34, 2: 30, 3: 26 },
};

/**
 * One emoji as the eye sees it: a flag (two regional indicators), a keycap, or
 * a pictograph in emoji presentation with its skin tone and any ZWJ-joined
 * parts (👨‍👩‍👧 counts as one). ©, ® and ™ in a sentence stay text.
 */
const EMOJI =
  /\p{RI}\p{RI}|[#*0-9]️?⃣|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️)\p{EMod}?[\u{E0020}-\u{E007F}]*(?:‍\p{Extended_Pictographic}️?\p{EMod}?)*️?/gu;

const JUMBO_MAX = 3;

/** Split text into alternating plain and emoji runs: [{ text, emoji }]. */
export function splitEmoji(text) {
  const runs = [];
  let last = 0;
  for (const match of text.matchAll(EMOJI)) {
    if (match.index > last) runs.push({ text: text.slice(last, match.index), emoji: false });
    runs.push({ text: match[0], emoji: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), emoji: false });
  return runs;
}

/** 1–3 if the message is nothing but that many emoji (spaces allowed), else 0. */
export function jumboEmojiCount(text) {
  const matches = text.match(EMOJI);
  if (!matches || matches.length > JUMBO_MAX) return 0;
  return text.replace(EMOJI, "").trim() === "" ? matches.length : 0;
}
