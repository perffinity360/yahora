// frontend/src/utils/share.js
//
// ⚠ Added by Vishwajeet (18 Sep 2026) on request, in Neeraj's `frontend/`.
// The one place the website decides what a shared listing says. `mobile/src/
// lib/share.ts` is the same logic for the app — if you change the wording here,
// change it there too, or the same listing reads differently depending on which
// client the student shared it from.

import { API_ORIGIN } from "../config/urls";

/** ₹1,200. Matches ProductCard and ProductDetail, so a share reads like the UI. */
export function formatSharePrice(price) {
  const value = Number(price);
  if (!Number.isFinite(value)) return "";
  return `₹${value.toLocaleString("en-IN")}`;
}

/**
 * The URL that goes in the message.
 *
 * NOT `window.location.href`, and not `/product/<id>` on the website either.
 * The site is a Vite SPA: one static index.html with one static set of Open
 * Graph tags, so WhatsApp shows the same generic "Yahora" card for every
 * listing ever shared. `<api>/share/product/<id>` returns real HTML whose tags
 * describe THIS listing, then bounces the student on to the product page.
 * See backend/src/modules/share/share.controller.js.
 *
 * Falls back to the plain site URL when API_ORIGIN is empty — which is the
 * local-dev default, where requests go through the Vite proxy as relative
 * paths. A relative path cannot be pasted into WhatsApp, so an absolute
 * same-origin URL is the honest answer there (it opens, it just will not draw
 * a card, because nothing is serving the tags at that origin).
 */
export function buildShareUrl(productId) {
  // API_ORIGIN, not API_BASE_URL: the share route is mounted at `/share`, NOT
  // under `/api`, so the `/api` suffix that API_BASE_URL carries would produce
  // a 404 on every shared link.
  const base = (API_ORIGIN ?? "").trim().replace(/\/+$/, "");
  if (base) return `${base}/share/product/${productId}`;
  return `${window.location.origin}/product/${productId}`;
}

/**
 * Is this a device whose primary pointer is a finger — a phone or a tablet?
 *
 * `matchMedia` rather than a UA-string sniff: a UA string misreads
 * desktop-mode-on-a-phone and every device that does not exist yet.
 * `maxTouchPoints` is the fallback for anything without `matchMedia`.
 */
export function isTouchDevice() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia) return window.matchMedia("(pointer: coarse)").matches;
  return (navigator.maxTouchPoints ?? 0) > 0;
}

/* Same message either way — only the decoration differs. See the note on
   `buildShareText` for why a laptop gets the plain set. */
const EMOJI_ICONS = { item: "🛍️ ", price: "💰 ", place: "📍 ", point: "👇" };
const PLAIN_ICONS = { item: "", price: "", place: "", point: "↓" };

/**
 * The message body, without the URL — every share target appends the link
 * itself, and a URL baked into the text would appear twice on the ones that do.
 *
 * On a phone (and in the app):
 *
 *   🛍️ *Casio FX-991EX Calculator*
 *   💰 ₹1,200 · Like new
 *   📍 IIITDM Kurnool
 *
 *   Spotted on Yahora 👇
 *
 * On a laptop, the same message without the emoji:
 *
 *   *Casio FX-991EX Calculator*
 *   ₹1,200 · Like new
 *   IIITDM Kurnool
 *
 *   Spotted on Yahora ↓
 *
 * Every line after the title is dropped when its data is missing, so a sparse
 * listing never shares as a block of stray separators. WhatsApp renders *bold*;
 * the other targets show plain asterisks, which still reads fine.
 *
 * ⚠ WHY THE LAPTOP GETS NO EMOJI — THIS IS NOT A STYLE CHOICE.
 *
 * Shared from a laptop, every emoji arrived in WhatsApp as a single "�" while
 * "₹" and "·" came through fine. That split IS the diagnosis: "₹" and "·" are BMP
 * (at most 3 bytes of UTF-8); emoji are astral (U+1F4B0 and friends — 4 bytes,
 * a surrogate pair in JS), and the desktop path truncates to the BMP.
 *
 * It is NOT our encoding, which round-trips exactly. The share targets are
 * plain links, so on a laptop they hand the text to a `whatsapp://`-style
 * protocol handler and into the desktop app, and non-BMP characters do not
 * survive that handoff. A phone hands the same link to the mobile app, which is
 * fine — which is why this looked correct in testing and broke only on a laptop.
 *
 * Hence the default below: emoji unless we are on a desktop browser. The choice
 * is made HERE rather than at the call sites because the failure is silent — a
 * caller that forgot the flag would ship mojibake and no error.
 *
 * Do not put astral characters in PLAIN_ICONS. Safe there: "₹" "·" "↓" "▸" "★" "✓".
 */
export function buildShareText(product, { emoji = isTouchDevice() } = {}) {
  if (!product) return "";

  const icons = emoji ? EMOJI_ICONS : PLAIN_ICONS;

  const sold = String(product.status ?? "").toLowerCase() === "sold";
  const facts = [sold ? "SOLD" : formatSharePrice(product.price), product.condition]
    .filter(Boolean)
    .join(" · ");

  const campus =
    product.university?.name ??
    product.university_name ??
    product.location ??
    null;

  return [
    `${icons.item}*${product.title}*`,
    facts ? `${icons.price}${facts}` : null,
    campus ? `${icons.place}${campus}` : null,
    "",
    `Spotted on Yahora ${icons.point}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Copy without assuming a secure context. `navigator.clipboard` is undefined
 * over plain http:// — which is how the dev server is reached from a phone on
 * the LAN — so fall back to the legacy execCommand path there.
 */
export async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to the legacy path */
    }
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
