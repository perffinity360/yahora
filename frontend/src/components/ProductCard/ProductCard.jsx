/**
 * Yahora — ProductCard Component
 * ================================
 * File: frontend/src/components/ProductCard/ProductCard.jsx
 */

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { supabase } from "../../config/supabaseClient";
import styles from "./ProductCard.module.css";

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
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
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
}) {
  const [imgIndex, setImgIndex] = useState(0);
  const [likeCount, setLikeCount] = useState(product.likes_count ?? 0);
  const [viewCount, setViewCount] = useState(product.views ?? 0);
  const [commentCount, setCommentCount] = useState(product.comments_count ?? 0);
  const [timeLabel, setTimeLabel] = useState(() => timeAgo(product.created_at));

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
      if (!currentUserId) return alert("Please log in to like items!");
      if (likeThrottle.current) return;

      likeThrottle.current = true;
      setTimeout(() => {
        likeThrottle.current = false;
      }, 600);
      if (onToggleLike) onToggleLike();
    },
    [currentUserId, onToggleLike],
  );

  const handleSave = useCallback(
    (e) => {
      e.stopPropagation();
      if (!currentUserId) return alert("Please log in to save items!");
      if (saveThrottle.current) return;

      saveThrottle.current = true;
      setTimeout(() => {
        saveThrottle.current = false;
      }, 600);
      if (onToggleSave) onToggleSave();
    },
    [currentUserId, onToggleSave],
  );

  const handleShare = useCallback(
    async (e) => {
      e.stopPropagation();
      const shareData = {
        title: product.title,
        text: `Check out "${product.title}" on Yahora for ${displayPrice}`,
        url: `${window.location.origin}/product/${product.id}`,
      };
      try {
        if (navigator.share) await navigator.share(shareData);
        else {
          await navigator.clipboard.writeText(shareData.url);
          alert("Link copied to clipboard!");
        }
      } catch {}
    },
    [product, displayPrice],
  );

  const handleCardClick = useCallback(() => {
    if (onCardClick) onCardClick(product.id);
  }, [onCardClick, product.id]);

  const sellerName = product.seller?.full_name || "Unknown Seller";
  const sellerAvatar = product.seller?.avatar_url || null;
  const sellerInitial =
    typeof sellerName === "string" ? sellerName.charAt(0).toUpperCase() : "U";

  return (
    <article
      className={styles.card}
      onClick={onCardClick ? handleCardClick : undefined}
      style={{ cursor: onCardClick ? "pointer" : "default" }}
    >
      <div className={styles.imageWrap}>
        <div
          className={styles.imageTrack}
          style={{ transform: `translateX(-${imgIndex * 100}%)` }}
        >
          {images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${product.title} ${i + 1}`}
              className={styles.image}
              loading={i === 0 ? "eager" : "lazy"}
              draggable={false}
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

            <button className={styles.statBtn} onClick={handleShare}>
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
    </article>
  );
});

export default ProductCard;
