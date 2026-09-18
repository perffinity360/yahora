import { Platform, Share } from 'react-native';

import { API_BASE_URL } from './config';

/**
 * The one place the app decides what a shared listing says.
 *
 * `frontend/src/utils/share.js` is the same logic for the website — if you
 * change the wording here, change it there too, or the same listing reads
 * differently depending on which client the student shared it from.
 */

/**
 * Origin that serves the link-preview pages.
 *
 * Defaults to the backend, because that is what serves `/share/product/<id>` —
 * the HTML page whose Open Graph tags make WhatsApp draw a card with the
 * photo, title and price instead of a bare blue link. See
 * `backend/src/modules/share/share.controller.js` for why the website cannot
 * serve those tags itself.
 *
 * ⚠ In local dev this resolves to the Metro host's LAN address, so a link
 * shared from a dev build only opens for someone on the same Wi-Fi. That is
 * correct — a dev build has no public URL to offer — but it means "the link my
 * friend can't open" is expected on a debug build and not a bug to chase.
 * `EXPO_PUBLIC_SHARE_BASE_URL` overrides it if you want to test against the
 * deployed backend from a dev build.
 */
const SHARE_BASE_URL = (process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? API_BASE_URL)
  .trim()
  .replace(/\/+$/, '');

/** Shape shared by MarketplaceProduct, ProductListing, PublicListing and the detail payload. */
export type ShareableProduct = {
  id: string;
  title?: string | null;
  price?: number | null;
  condition?: string | null;
  status?: string | null;
  location?: string | null;
  university?: { name?: string | null } | null;
  university_name?: string | null;
};

/** ₹1,200 — matches ProductCard's formatPrice, so a share reads like the app. */
function formatSharePrice(price: number | null | undefined): string {
  const value = Number(price);
  if (!Number.isFinite(value)) return '';
  return `₹${value.toLocaleString('en-IN')}`;
}

/** The link that goes in the message. */
export function buildShareUrl(productId: string): string {
  return `${SHARE_BASE_URL}/share/product/${productId}`;
}

/**
 * The message body, without the URL — every share target appends the link
 * itself, and one baked into the text would appear twice on the ones that do.
 *
 *   🛍️ *Casio FX-991EX Calculator*
 *   💰 ₹1,200 · Like new
 *   📍 IIITDM Kurnool
 *
 *   Spotted on Yahora 👇
 *
 * WhatsApp renders *bold*; everywhere else it shows as plain asterisks, which
 * still reads fine. Lines whose data is missing are dropped, so a sparse
 * listing never shares as a block of stray separators.
 *
 * ⚠ The emoji are astral characters (above U+FFFF — 4 bytes of UTF-8, a
 * surrogate pair in JS), and they are safe HERE but not everywhere.
 *
 * This app always goes through the native share sheet, which carries them
 * fine, so this file has no reason to strip them.
 *
 * The WEBSITE'S sheet uses plain links, and on a laptop a "wa.me" link hands the
 * text to the "whatsapp://" protocol handler and into the WhatsApp desktop app,
 * which truncates to the BMP — every emoji arrived as a single "�" while "₹"
 * and "·" survived. So `frontend/src/utils/share.js` drops the emoji on a
 * desktop browser only, and keeps them on a phone. Same message, same wording,
 * decoration only where it survives the trip.
 *
 * Keep the two in step: that file carries the same text and the long version of
 * this note.
 */
export function buildShareText(product: ShareableProduct): string {
  const sold = (product.status ?? '').toLowerCase() === 'sold';
  const facts = [sold ? 'SOLD' : formatSharePrice(product.price), product.condition]
    .filter(Boolean)
    .join(' · ');

  const campus = product.university?.name ?? product.university_name ?? product.location ?? null;

  return [
    `🛍️ *${product.title ?? 'This listing'}*`,
    facts ? `💰 ${facts}` : null,
    campus ? `📍 ${campus}` : null,
    '',
    'Spotted on Yahora 👇',
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

/**
 * Open the OS share sheet for a listing — WhatsApp, Telegram, Instagram, Mail,
 * AirDrop, Copy, whatever the phone has.
 *
 * ⚠ THE URL IS HANDLED PER PLATFORM, DELIBERATELY. React Native's `url` field
 * is iOS-only: on Android it is dropped in silence, so a share that relies on
 * it posts the text with no link at all — which is exactly how this used to
 * lose the listing. Android therefore gets the link inside `message`, and iOS
 * gets it in `url`, where the share sheet can offer "Copy Link" and apps can
 * build a preview from it.
 *
 * Rejections are swallowed on purpose: dismissing the sheet rejects, and that
 * is not an error worth an alert.
 */
export function shareProduct(product: ShareableProduct): Promise<void> {
  const url = buildShareUrl(product.id);
  const text = buildShareText(product);

  return Share.share(
    Platform.OS === 'ios'
      ? { message: text, url, title: product.title ?? 'Yahora' }
      : { message: `${text}\n${url}`, title: product.title ?? 'Yahora' },
    { dialogTitle: 'Share this find' },
  )
    .then(() => undefined)
    .catch(() => undefined);
}
