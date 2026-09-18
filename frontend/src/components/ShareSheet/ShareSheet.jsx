// frontend/src/components/ShareSheet/ShareSheet.jsx
//
// ⚠ Added by Vishwajeet (18 Sep 2026) on request, in Neeraj's `frontend/`.
// This is the share sheet that already lived inside ProductCard.jsx, lifted out
// so the product page can show the same one — the two share buttons on the site
// behaved differently, and the one on the product page did almost nothing on a
// desktop browser. ProductCard.jsx now renders <ShareSheet/> and is ~250 lines
// shorter; nothing about how it looks changed.

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./ShareSheet.module.css";
import { buildShareText, buildShareUrl, copyText, formatSharePrice } from "../../utils/share";

/* ── Icons ── */
const CopyIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const CheckIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const CloseIcon = ({ size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Brand marks, each a single filled path at 24x24.
 *
 * `href(url, text)` differs per target on purpose: WhatsApp takes ONE `text`
 * field and shows whatever is in it, so the link is appended to the message;
 * Telegram, X and Facebook take the URL separately and render their own
 * preview card from it, so appending it again would print the link twice.
 */
const BRAND_TARGETS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    tint: "#25D366",
    // wa.me on every device: the phone opens the app, the laptop hands off to
    // WhatsApp Desktop. The desktop handoff cannot carry astral characters, so
    // `buildShareText` sends a laptop the emoji-free message rather than this
    // link being routed somewhere else. See utils/share.js.
    href: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
    path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.488",
  },
  {
    id: "telegram",
    label: "Telegram",
    tint: "#229ED9",
    href: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    path: "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  },
  {
    id: "x",
    label: "X",
    tint: "#0B0B0B",
    href: (url, text) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    id: "facebook",
    label: "Facebook",
    tint: "#1877F2",
    // Facebook strips any prefilled text — it builds the card from the URL's
    // Open Graph tags alone, which is exactly what /share/product/<id> serves.
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
];

/**
 * Share sheet for a listing.
 *
 * Opens OUR OWN sheet rather than going straight to `navigator.share`: the
 * native API does not exist on desktop Chrome or Firefox, and it is unavailable
 * over plain http:// (which is how the dev server is reached from a phone on
 * the LAN). Both share buttons on the site used to fall through to a clipboard
 * write that throws in exactly those cases, inside an empty catch — so the
 * button looked dead. Native sharing is still offered, as one target among the
 * rest, wherever the browser actually has it.
 *
 * Portaled to <body> because the swipe deck puts a card inside a transformed
 * ancestor, which would otherwise become the containing block for
 * `position: fixed` and trap the overlay inside the card.
 */
export default function ShareSheet({ product, onClose }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (!product) return null;

  const url = buildShareUrl(product.id);
  const shareText = buildShareText(product);
  const price = formatSharePrice(product.price);
  const image =
    (Array.isArray(product.image_urls) ? product.image_urls[0] : null) ??
    product.image ??
    null;

  const handleCopy = async () => {
    const ok = await copyText(url);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1800);
  };

  const canShareNatively = typeof navigator !== "undefined" && !!navigator.share;

  return createPortal(
    <div
      className={styles.overlay}
      onClick={onClose}
      // The swipe deck listens for pointer events on its own ancestors; without
      // this, opening the sheet also starts a card drag behind it.
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={`Share ${product.title}`}
    >
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />

        <div className={styles.head}>
          <span className={styles.headTitle}>Share this find</span>
          <button className={styles.close} onClick={onClose} aria-label="Close share sheet">
            <CloseIcon size={16} />
          </button>
        </div>

        <div className={styles.preview}>
          {image ? <img src={image} alt="" className={styles.previewImg} /> : null}
          <div className={styles.previewText}>
            <span className={styles.previewTitle}>{product.title}</span>
            <span className={styles.previewPrice}>{price}</span>
          </div>
        </div>

        <div className={styles.targets}>
          {BRAND_TARGETS.map((t) => (
            <a
              key={t.id}
              className={styles.target}
              href={t.href(url, shareText)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
            >
              <span className={styles.targetIcon} style={{ background: t.tint }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                  <path d={t.path} />
                </svg>
              </span>
              <span className={styles.targetLabel}>{t.label}</span>
            </a>
          ))}

          <a
            className={styles.target}
            href={`mailto:?subject=${encodeURIComponent(product.title)}&body=${encodeURIComponent(`${shareText}\n${url}`)}`}
            onClick={onClose}
          >
            <span className={styles.targetIcon} style={{ background: "#64748b" }}>
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-10 6L2 7" />
              </svg>
            </span>
            <span className={styles.targetLabel}>Email</span>
          </a>

          {canShareNatively && (
            <button
              className={styles.target}
              onClick={async () => {
                try {
                  await navigator.share({ title: product.title, text: shareText, url });
                  onClose();
                } catch {
                  /* the student dismissed the OS sheet — not an error */
                }
              }}
            >
              <span
                className={styles.targetIcon}
                style={{ background: "var(--purple, #800080)" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </span>
              <span className={styles.targetLabel}>More</span>
            </button>
          )}
        </div>

        <div className={styles.linkRow}>
          <span className={styles.linkText}>{url}</span>
          <button
            className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`}
            onClick={handleCopy}
          >
            {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
