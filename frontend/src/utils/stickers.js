/**
 * ── WELCOME STICKERS (Telegram-style) ──
 *
 * The web twin of mobile/src/lib/stickers.ts — same ids, same order, same hash.
 * Change one, change both, or the two apps show different stickers.
 *
 * An empty conversation greets you with one animated sticker, picked from the
 * CONVERSATION (both people and the listing) rather than at random on each
 * open: the same chat always shows the same sticker, both people see the same
 * one, and the phone and the website agree.
 *
 * Files: /public/stickers/<id>.webp and <id>-still.webp (shown under
 * prefers-reduced-motion). Byte-for-byte copies of
 * docs/design/assets/welcome-sticker/out/ — never edit them here.
 */

export const WELCOME_STICKERS = ["bear", "blob", "birdie", "rabbit"];

/** 32-bit FNV-1a over the key's UTF-16 code units. Identical to mobile's. */
function fnv1a(key) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** { id, animated, still } for one conversation. Missing ids → the first. */
export function welcomeStickerFor(userId, contactId, productId) {
  let id = WELCOME_STICKERS[0];
  if (userId && contactId && productId) {
    const key = `${[userId, contactId].sort().join(":")}:${productId}`;
    id = WELCOME_STICKERS[fnv1a(key) % WELCOME_STICKERS.length];
  }
  return { id, animated: `/stickers/${id}.webp`, still: `/stickers/${id}-still.webp` };
}
