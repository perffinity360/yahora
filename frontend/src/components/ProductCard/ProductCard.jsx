/**
 * Yahora — ProductCard Component
 * ================================
 * File: frontend/src/components/ProductCard/ProductCard.jsx
 */

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../config/supabaseClient";
import styles from "./ProductCard.module.css";
import SmartImage from "../SmartImage/SmartImage";

/**
 * Copy text without assuming a secure context. navigator.clipboard is undefined
 * over plain http:// (which is how the dev server is reached from a phone on
 * the LAN), so fall back to the legacy execCommand path there.
 */
async function copyText(text) {
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

const CONDITION_CONFIG = {
  Mint: { label: "MINT CONDITION", bg: "#2BB7FF", color: "#fff" },
  "Like New": { label: "LIKE NEW", bg: "#4ade80", color: "#052e16" },
  Good: { label: "GOOD", bg: "#facc15", color: "#1a1100" },
  Fair: { label: "FAIR", bg: "#fb923c", color: "#fff" },
  Poor: { label: "POOR", bg: "#f87171", color: "#fff" },
};

function timeAgo(isoString) {
  if (!isoString) return "Just now";
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / (86400 * 7))}w ago`;
  return new Date(isoString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/* ── Icons ── */
const HeartIcon = ({ filled, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);
const EyeIcon = ({ size = 16 }) => (
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
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const CommentIcon = ({ size = 16 }) => (
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
    {/* Round chat bubble (MessageCircle) */}
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </svg>
);
const BookmarkIcon = ({ filled, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);
const ShareIcon = ({ size = 18 }) => (
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
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const ChevronIcon = ({ dir = "left", size = 18 }) => (
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
    {dir === "left" ? (
      <polyline points="15 18 9 12 15 6" />
    ) : (
      <polyline points="9 18 15 12 9 6" />
    )}
  </svg>
);
const PenIcon = ({ size = 16 }) => (
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
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const ChatIcon = ({ size = 16 }) => (
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
    {/* Square bubble (MessageSquare) — distinct from the round CommentIcon */}
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const TrashIcon = ({ size = 18 }) => (
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
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

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

/* Brand marks are single filled paths at 24x24. */
const BRAND_TARGETS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    tint: "#25D366",
    href: (url, text) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
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
];

/**
 * Share sheet. Portaled to <body> because the swipe deck puts the card inside a
 * transformed ancestor, which would otherwise become the containing block for
 * position: fixed and trap the overlay inside the card.
 */
function ShareSheet({ product, image, price, url, shareText, onClose }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const handleCopy = async () => {
    const ok = await copyText(url);
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1800);
  };

  return createPortal(
    <div
      className={styles.shareOverlay}
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={`Share ${product.title}`}
    >
      <div
        className={styles.shareSheet}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.shareHandle} />

        <div className={styles.shareHead}>
          <span className={styles.shareHeadTitle}>Share this find</span>
          <button
            className={styles.shareClose}
            onClick={onClose}
            aria-label="Close share sheet"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        <div className={styles.sharePreview}>
          <img src={image} alt="" className={styles.sharePreviewImg} />
          <div className={styles.sharePreviewText}>
            <span className={styles.sharePreviewTitle}>{product.title}</span>
            <span className={styles.sharePreviewPrice}>{price}</span>
          </div>
        </div>

        <div className={styles.shareTargets}>
          {BRAND_TARGETS.map((t) => (
            <a
              key={t.id}
              className={styles.shareTarget}
              href={t.href(url, shareText)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
            >
              <span
                className={styles.shareTargetIcon}
                style={{ background: t.tint }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                  <path d={t.path} />
                </svg>
              </span>
              <span className={styles.shareTargetLabel}>{t.label}</span>
            </a>
          ))}

          {typeof navigator !== "undefined" && navigator.share && (
            <button
              className={styles.shareTarget}
              onClick={async () => {
                try {
                  await navigator.share({
                    title: product.title,
                    text: shareText,
                    url,
                  });
                  onClose();
                } catch {
                  /* user dismissed the OS sheet */
                }
              }}
            >
              <span
                className={styles.shareTargetIcon}
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
              <span className={styles.shareTargetLabel}>More</span>
            </button>
          )}
        </div>

        <div className={styles.shareLinkRow}>
          <span className={styles.shareLinkText}>{url}</span>
          <button
            className={`${styles.shareCopyBtn} ${copied ? styles.shareCopyBtnDone : ""}`}
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

const ProductCard = memo(function ProductCard({
  product,
  currentUserId = null,
  isOwner = false,
  onCardClick = null,
  onEdit = null,
  onChat = null,
  onDelete = null,
  onMarkSold = null,
  onMarkAvailable = null,
  onToggleLike = null,
  onToggleSave = null,
  /* Live preview (Sell page): renders exactly like a real card and the photo
     carousel works, but nothing else does anything — there's no listing to
     like, save or share yet. */
  preview = false,
}) {
  const [imgIndex, setImgIndex] = useState(0);
  const [likeCount, setLikeCount] = useState(product.likes_count ?? 0);
  const [viewCount, setViewCount] = useState(product.views ?? 0);
  const [commentCount, setCommentCount] = useState(product.comments_count ?? 0);
  const [timeLabel, setTimeLabel] = useState(() => timeAgo(product.created_at));
  const [shareOpen, setShareOpen] = useState(false);

  const likeThrottle = useRef(false);
  const saveThrottle = useRef(false);

  useEffect(() => {
    setLikeCount(product.likes_count ?? 0);
    setCommentCount(product.comments_count ?? 0);
  }, [product.likes_count, product.comments_count]);

  const images = product.image_urls?.length
    ? product.image_urls
    : product.image
      ? [product.image]
      : ["https://via.placeholder.com/600x400?text=No+Image"];

  const totalImages = images.length;
  const condCfg =
    CONDITION_CONFIG[product.condition] ?? CONDITION_CONFIG["Good"];
  const displayPrice =
    typeof product.price === "string" && product.price.includes("₹")
      ? product.price
      : `₹${Number(product.price).toLocaleString("en-IN")}`;

  useEffect(() => {
    const id = setInterval(
      () => setTimeLabel(timeAgo(product.created_at)),
      30_000,
    );
    return () => clearInterval(id);
  }, [product.created_at]);

  useEffect(() => {
    if (!supabase || !product.id) return;
    const channel = supabase
      .channel(`product:${product.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "products",
          filter: `id=eq.${product.id}`,
        },
        (payload) => {
          const row = payload.new;
          if (row.views !== undefined) setViewCount(row.views);
          if (row.likes_count !== undefined) setLikeCount(row.likes_count);
          if (row.comments_count !== undefined)
            setCommentCount(row.comments_count);
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [product.id]);

  // FIX: Sent p_id instead of product_id to resolve the 400 Bad Request error
  useEffect(() => {
    if (!supabase || !product.id) return;
    if (currentUserId && currentUserId === product.seller?.id) return;
    const key = `viewed_${product.id}`;
    if (sessionStorage.getItem(key)) return;

    sessionStorage.setItem(key, "1");
    const incrementView = async () => {
      const { error } = await supabase.rpc("increment_product_views", {
        product_id: product.id,
      });
      if (error) console.error("Failed to increment views", error);
    };
    incrementView();
  }, [product.id, currentUserId, product.seller?.id]);

  const prevImage = useCallback(
    (e) => {
      e.stopPropagation();
      setImgIndex((i) => (i - 1 + totalImages) % totalImages);
    },
    [totalImages],
  );

  const nextImage = useCallback(
    (e) => {
      e.stopPropagation();
      setImgIndex((i) => (i + 1) % totalImages);
    },
    [totalImages],
  );

  const handleLike = useCallback(
    (e) => {
      e.stopPropagation();
      if (preview) return;
      if (!currentUserId) return alert("Please log in to like items!");
      if (likeThrottle.current) return;

      likeThrottle.current = true;
      setTimeout(() => {
        likeThrottle.current = false;
      }, 600);
      if (onToggleLike) onToggleLike();
    },
    [currentUserId, onToggleLike, preview],
  );

  const handleSave = useCallback(
    (e) => {
      e.stopPropagation();
      if (preview) return;
      if (!currentUserId) return alert("Please log in to save items!");
      if (saveThrottle.current) return;

      saveThrottle.current = true;
      setTimeout(() => {
        saveThrottle.current = false;
      }, 600);
      if (onToggleSave) onToggleSave();
    },
    [currentUserId, onToggleSave, preview],
  );

  /* Opens our own sheet rather than going straight to navigator.share: the
     native API is unavailable on desktop and over plain http:// (LAN dev), and
     the previous clipboard fallback threw in exactly those cases and was
     swallowed by an empty catch, so the button appeared dead. */
  const handleShare = useCallback(
    (e) => {
      e.stopPropagation();
      if (preview) return;
      setShareOpen(true);
    },
    [preview],
  );

  const handleCardClick = useCallback(() => {
    if (preview) return;
    if (onCardClick) onCardClick(product.id);
  }, [onCardClick, product.id, preview]);

  const sellerName = product.seller?.full_name || "Unknown Seller";
  const sellerAvatar = product.seller?.avatar_url || null;
  const sellerInitial =
    typeof sellerName === "string" ? sellerName.charAt(0).toUpperCase() : "U";

  return (
    <article
      className={`${styles.card} ${preview ? styles.cardPreview : ""}`}
      onClick={onCardClick ? handleCardClick : undefined}
      style={{ cursor: onCardClick && !preview ? "pointer" : "default" }}
    >
      <div className={styles.imageWrap}>
        <div
          className={styles.imageTrack}
          style={{ transform: `translateX(-${imgIndex * 100}%)` }}
        >
          {images.map((url, i) => (
            <SmartImage
              key={i}
              src={url}
              alt={`${product.title} ${i + 1}`}
              className={styles.image}
              loading={i === 0 ? "eager" : "lazy"}
              draggable={false}
              onError={(e) => {
                // Only reached once SmartImage's retries are exhausted (a
                // freshly-uploaded image that's still propagating gets caught
                // by the retry first). Genuinely broken: hide it so the grey
                // placeholder shows through instead of sprawling alt text.
                e.currentTarget.style.visibility = "hidden";
              }}
            />
          ))}
        </div>
        {totalImages > 1 && (
          <>
            <button
              className={`${styles.carouselBtn} ${styles.carouselBtnLeft}`}
              onClick={prevImage}
            >
              <ChevronIcon dir="left" size={14} />
            </button>
            <button
              className={`${styles.carouselBtn} ${styles.carouselBtnRight}`}
              onClick={nextImage}
            >
              <ChevronIcon dir="right" size={14} />
            </button>
            <div className={styles.imageCounter}>
              {imgIndex + 1}/{totalImages}
            </div>
          </>
        )}

        <button
          className={`${styles.overlayHeart} ${product.is_liked ? styles.overlayHeartLiked : ""}`}
          onClick={handleLike}
        >
          <HeartIcon filled={product.is_liked} size={18} />
        </button>

        {product.status === "sold" && (
          <div className={styles.soldBanner}>SOLD</div>
        )}
      </div>

      <div className={styles.infoWrap}>
        <div className={styles.metaRow}>
          <div className={styles.metaLeft}>
            <span
              className={styles.conditionBadge}
              style={{ background: condCfg.bg, color: condCfg.color }}
            >
              {condCfg.label}
            </span>
          </div>
          <span className={styles.price}>{displayPrice}</span>
        </div>
        {product.location && (
          <span className={styles.locationTag}>
            {product.location.toUpperCase()}
          </span>
        )}
        <h3 className={styles.title}>{product.title}</h3>

        <div className={styles.footerRow}>
          <div className={styles.stats}>
            <span className={styles.stat}>
              <EyeIcon />
              <span>{viewCount}</span>
            </span>

            <button
              className={`${styles.statBtn} ${product.is_liked ? styles.statBtnLiked : ""}`}
              onClick={handleLike}
            >
              <HeartIcon filled={product.is_liked} size={16} />
              <span>{likeCount}</span>
            </button>

            <button
              className={styles.statBtn}
              onClick={(e) => {
                e.stopPropagation();
                if (onCardClick) onCardClick(`${product.id}#comments`);
              }}
            >
              <CommentIcon size={16} />
              <span>{commentCount}</span>
            </button>

            <button
              className={`${styles.statBtn} ${product.is_saved ? styles.statBtnSaved : ""}`}
              onClick={handleSave}
            >
              <BookmarkIcon filled={product.is_saved} size={16} />
            </button>

            <button
              className={styles.statBtn}
              onClick={handleShare}
              title="Share"
              aria-label="Share this listing"
            >
              <ShareIcon size={16} />
            </button>
          </div>
        </div>

        <div className={styles.timeAvatar}>
          <p className={styles.timeAgo}>{timeLabel}</p>

          {isOwner ? (
            <div className={styles.ownerActions}>
              {product.status === "sold" ? (
                <>
                  <span
                    className={styles.cardSoldTo}
                    style={{
                      marginRight: "auto",
                      fontWeight: "bold",
                      color: "#f87171",
                    }}
                  >
                    {product.sold_to ? `SOLD TO @${product.sold_to}` : "SOLD"}
                  </span>

                  {onMarkAvailable && (
                    <button
                      className={styles.cardBtn}
                      title="Mark as Available"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkAvailable();
                      }}
                      style={{ color: "#2BB7FF" }}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                        <polyline points="3 3 3 8 8 8"></polyline>
                      </svg>
                    </button>
                  )}

                  <button
                    className={`${styles.cardBtn} ${styles.cardBtnDelete}`}
                    title="Delete listing"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.();
                    }}
                    style={{ color: "#f87171" }}
                  >
                    <TrashIcon size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={`${styles.cardBtn} ${styles.cardBtnChat}`}
                    title="Messages"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChat?.();
                    }}
                  >
                    <ChatIcon size={14} />
                  </button>

                  {onMarkSold && (
                    <button
                      className={styles.cardBtn}
                      title="Mark as Sold"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkSold();
                      }}
                      style={{ color: "#4ade80" }}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                    </button>
                  )}

                  <button
                    className={`${styles.cardBtn} ${styles.cardBtnEdit}`}
                    title="Edit listing"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.();
                    }}
                  >
                    <PenIcon size={13} />
                  </button>
                  <button
                    className={`${styles.cardBtn} ${styles.cardBtnDelete}`}
                    title="Delete listing"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.();
                    }}
                    style={{ color: "#f87171" }}
                  >
                    <TrashIcon size={14} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className={styles.seller}>
              {sellerAvatar ? (
                <img
                  src={sellerAvatar}
                  alt={sellerName}
                  className={styles.sellerAvatar}
                />
              ) : (
                <div className={styles.sellerAvatarFallback}>
                  {sellerInitial}
                </div>
              )}
              <span className={styles.sellerName}>by {sellerName}</span>
            </div>
          )}
        </div>
      </div>

      {shareOpen && (
        <ShareSheet
          product={product}
          image={images[0]}
          price={displayPrice}
          url={`${window.location.origin}/product/${product.id}`}
          shareText={`Check out "${product.title}" on Yahora for ${displayPrice}`}
          onClose={() => setShareOpen(false)}
        />
      )}
    </article>
  );
});

export default ProductCard;
