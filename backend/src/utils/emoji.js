// backend/src/utils/emoji.js
// ══════════════════════════════════════════════
// OWNER: VISHWAJEET   —   added in Phase 7 (Block V-A)
// Neeraj: please import from this file; do not edit it.
// ══════════════════════════════════════════════

/**
 * The quick reaction bar, in display order (COMMUNITY_SPEC §13). Any other
 * emoji is still allowed through the ⊕ picker, so this is not a validation list.
 */
export const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

/** The longest value worth testing. Stops a huge string reaching the regex. */
const MAX_EMOJI_UTF16_UNITS = 32;

/**
 * `RGI_Emoji` is every emoji the Unicode standard recommends, including the ones
 * built from several characters. `\p{RGI_Emoji}` matches a whole sequence as one
 * item, and only the `v` flag understands it (the older `u` flag throws).
 *
 *   accepted   ❤️   👍🏽 (skin tone)   👨‍👩‍👧 (several characters joined into one picture)
 *   rejected   hi   ❤️❤️ (two emojis)   <script>
 */
const SINGLE_EMOJI_RE = /^\p{RGI_Emoji}$/v;

/** True when `value` is a string holding exactly one emoji and nothing else. */
export function isSingleEmoji(value) {
  return (
    typeof value === 'string' &&
    value.length <= MAX_EMOJI_UTF16_UNITS &&
    SINGLE_EMOJI_RE.test(value)
  );
}
