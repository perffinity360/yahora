/**
 * ── WELCOME STICKERS (Telegram-style) ──
 *
 * An empty conversation greets you with one animated sticker, picked from this
 * set. The pick is made from the CONVERSATION — both people and the listing —
 * not at random on each open, so:
 *   - the same chat always shows the same sticker,
 *   - both people in it see the same one,
 *   - and the phone and the website agree.
 *
 * The web twin is frontend/src/utils/stickers.js: same ids, same order, same
 * hash. Change one, change both, or the two apps show different stickers.
 *
 * The files are byte-for-byte copies of docs/design/assets/welcome-sticker/out/
 * (sources and LottieFiles credits there). Never edit them here — change the
 * source, run build_stickers.py, copy to both platforms in one commit.
 */

export const WELCOME_STICKERS = [
  { id: 'bear', source: require('../../assets/stickers/bear.webp') },
  { id: 'blob', source: require('../../assets/stickers/blob.webp') },
  { id: 'birdie', source: require('../../assets/stickers/birdie.webp') },
  { id: 'rabbit', source: require('../../assets/stickers/rabbit.webp') },
] as const;

export type WelcomeSticker = (typeof WELCOME_STICKERS)[number];

/** 32-bit FNV-1a over the key's UTF-16 code units — small, fast, and simple to
 *  reproduce exactly in the web's JavaScript. */
function fnv1a(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The sticker for one conversation. The two user ids are sorted, so it does not
 * matter whose phone is asking. Anything missing falls back to the first.
 */
export function welcomeStickerFor(
  userId: string | null | undefined,
  contactId: string | null | undefined,
  productId: string | null | undefined,
): WelcomeSticker {
  if (!userId || !contactId || !productId) return WELCOME_STICKERS[0];
  const key = `${[userId, contactId].sort().join(':')}:${productId}`;
  return WELCOME_STICKERS[fnv1a(key) % WELCOME_STICKERS.length];
}
