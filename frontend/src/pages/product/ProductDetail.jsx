// frontend/src/pages/product/ProductDetail.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import styles from "./ProductDetail.module.css";
import { supabase } from "../../config/supabaseClient";
import {
  Heart,
  Share2,
  MessageSquare,
  MapPin,
  Tag,
  Clock,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Send,
  ThumbsUp,
  ThumbsDown,
  Eye,
  AlertTriangle,
  ShieldCheck,
  User,
} from "lucide-react";

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

const CONDITION_CONFIG = {
  Mint: { label: "MINT", bg: "#2BB7FF", color: "#fff" },
  "Like New": { label: "LIKE NEW", bg: "#4ade80", color: "#052e16" },
  Good: { label: "GOOD", bg: "#facc15", color: "#1a1100" },
  Fair: { label: "FAIR", bg: "#fb923c", color: "#fff" },
  Poor: { label: "POOR", bg: "#f87171", color: "#fff" },
};

/* ── Avatar helper: Initials circle when no photo ── */
function AvatarImg({ src, name, size = 36, className }) {
  const [err, setErr] = useState(false);
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";
  const hue = name
    ? [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
    : 200;

  if (!src || err) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          flexShrink: 0,
          background: `hsl(${hue},60%,55%)`,
          color: "#fff",
          fontWeight: 700,
          fontSize: size * 0.38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          userSelect: "none",
        }}
      >
        {initials}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      className={className}
      onError={() => setErr(true)}
    />
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const currentUserId = localStorage.getItem("yahora_user_id");
  const [actualHomeUniId, setActualHomeUniId] = useState(
    localStorage.getItem("yahora_university_id"),
  );

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  /* comment states */
  const [commentText, setCommentText] = useState(""); // for new top-level questions
  const [replyText, setReplyText] = useState(""); // for inline replies
  const [replyingTo, setReplyingTo] = useState(null); // commentId | null
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentInputFocused, setCommentInputFocused] = useState(false);

  /* ui feedback */
  const [likeAnim, setLikeAnim] = useState(false);
  const [savedAnim, setSavedAnim] = useState(false);

  const replyInputRef = useRef(null);

  /* ── Data Fetching ── */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = `${API_BASE_URL}/products/${id}${currentUserId ? `?user_id=${currentUserId}` : ""}`;
        const response = await fetch(url);
        const data = await response.json();
        if (response.ok) setProduct(data.product);

        if (currentUserId && !actualHomeUniId) {
          const { data: userData } = await supabase
            .from("users")
            .select("university_id")
            .eq("id", currentUserId)
            .single();
          if (userData) {
            setActualHomeUniId(userData.university_id);
            localStorage.setItem(
              "yahora_university_id",
              userData.university_id,
            );
          }
        }
      } catch (err) {
        console.error("Network error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, currentUserId]);

  /* NEW: Scroll to top on page load, unless navigating directly to comments */
  useEffect(() => {
    if (hash !== "#comments") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [hash, id]);

  /* Scroll to comments if the URL has #comments (Your existing code) */
  useEffect(() => {
    if (!loading && product && hash === "#comments") {
      setTimeout(() => {
        const element = document.getElementById("comments");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [loading, product, hash]);

  /* Scroll to comments if the URL has #comments */
  useEffect(() => {
    if (!loading && product && hash === "#comments") {
      setTimeout(() => {
        const element = document.getElementById("comments");
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [loading, product, hash]);

  /* Focus inline reply input when replyingTo changes */
  useEffect(() => {
    if (replyingTo && replyInputRef.current) {
      setTimeout(() => replyInputRef.current?.focus(), 80);
    }
  }, [replyingTo]);

  /* Reset image loaded state on index change */
  useEffect(() => {
    setImgLoaded(false);
  }, [activeImageIndex]);

  /* ── Handlers ── */
  const handleToggleLike = async () => {
    if (!currentUserId) return alert("Please log in to like items.");
    setLikeAnim(true);
    setTimeout(() => setLikeAnim(false), 500);
    setProduct((prev) => ({
      ...prev,
      is_liked: !prev.is_liked,
      likes_count: prev.is_liked
        ? Math.max(0, prev.likes_count - 1)
        : prev.likes_count + 1,
    }));
    try {
      await fetch(`${API_BASE_URL}/products/${id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUserId }),
      });
    } catch {
      /* silent */
    }
  };

  const handleToggleSave = async () => {
    if (!currentUserId) return alert("Please log in to save items.");
    setSavedAnim(true);
    setTimeout(() => setSavedAnim(false), 400);
    setProduct((prev) => ({ ...prev, is_saved: !prev.is_saved }));
    try {
      await fetch(`${API_BASE_URL}/products/${id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUserId }),
      });
    } catch {
      /* silent */
    }
  };

  /* Unified post-comment handler – takes content string + optional parentId */
  const handlePostComment = async (content, parentId = null) => {
    if (!content.trim() || !currentUserId) return;
    setIsSubmittingComment(true);
    try {
      const response = await fetch(`${API_BASE_URL}/products/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUserId,
          content,
          parent_comment_id: parentId,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setProduct((prev) => ({
          ...prev,
          comments: [
            { ...data.comment, user_vote: 0 },
            ...(prev.comments || []),
          ],
        }));
        setCommentText("");
        setReplyText("");
        setReplyingTo(null);
        setCommentInputFocused(false);
      }
    } catch {
      /* silent */
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleVote = async (commentId, voteValue) => {
    if (!currentUserId) return alert("Please log in to vote.");
    setProduct((prev) => {
      const newComments = prev.comments.map((c) => {
        if (c.id !== commentId) return c;
        let up = c.upvotes,
          down = c.downvotes,
          uv = voteValue;
        if (c.user_vote === voteValue) {
          uv = 0;
          if (voteValue === 1) up--;
          else down--;
        } else {
          if (voteValue === 1) {
            up++;
            if (c.user_vote === -1) down--;
          } else {
            down++;
            if (c.user_vote === 1) up--;
          }
        }
        return { ...c, upvotes: up, downvotes: down, user_vote: uv };
      });
      return { ...prev, comments: newComments };
    });
    try {
      await fetch(`${API_BASE_URL}/products/comments/${commentId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUserId, vote_value: voteValue }),
      });
    } catch {
      /* silent */
    }
  };

  const handleImageNav = (dir) => {
    setActiveImageIndex((prev) =>
      dir === "next"
        ? prev === product.image_urls.length - 1
          ? 0
          : prev + 1
        : prev === 0
          ? product.image_urls.length - 1
          : prev - 1,
    );
  };

  const handleShare = async () => {
    // The exact template you requested
    const shareText = `Take a look at this ${product.title} on Yahora`;
    const shareUrl = window.location.href;

    try {
      if (navigator.share) {
        // Native share sheet on mobile devices
        await navigator.share({
          title: `Yahora - ${product.title}`,
          text: shareText,
          url: shareUrl,
        });
      } else {
        // Fallback for desktop browsers
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert("Link copied to clipboard!");
      }
    } catch (err) {
      console.log("User canceled share or error occurred", err);
    }
  };

  const timeAgo = (dateString) => {
    const mins = Math.floor((new Date() - new Date(dateString)) / 60000);
    if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? "yesterday" : `${days}d ago`;
  };

  /* ── Comment tree helpers ── */
  const topLevelComments =
    product?.comments?.filter((c) => !c.parent_comment_id) || [];
  const getReplies = (parentId) =>
    product?.comments?.filter((c) => c.parent_comment_id === parentId) || [];

  /* ── Loading / Error states ── */
  if (loading)
    return (
      <div className={styles.stateScreen}>
        <div className={styles.loadingSpinner} />
        <p>Loading product…</p>
      </div>
    );
  if (!product)
    return (
      <div className={styles.stateScreen}>
        <AlertTriangle size={40} />
        <p>Product not found.</p>
      </div>
    );

  const isForeignCampus =
    actualHomeUniId && product.university_id !== actualHomeUniId;
  const condCfg =
    CONDITION_CONFIG[product.condition] ?? CONDITION_CONFIG["Good"];
  const totalComments = product.comments?.length || 0;

  return (
    <div className={styles.root}>
      {/* ── Main Grid ── */}
      <div className={styles.container}>
        {/* ════ LEFT COLUMN ════ */}
        <div className={styles.leftCol}>
          {/* Gallery Card */}
          <div className={styles.galleryCard}>
            <div className={styles.mainImageWrap}>
              {/* Condition badge overlay */}
              <span
                className={styles.conditionOverlay}
                style={{ background: condCfg.bg, color: condCfg.color }}
              >
                {condCfg.label}
              </span>

              <img
                key={activeImageIndex}
                src={product.image_urls[activeImageIndex]}
                alt={product.title}
                className={`${styles.mainImage} ${imgLoaded ? styles.imageLoaded : ""}`}
                onLoad={() => setImgLoaded(true)}
              />

              {product.image_urls.length > 1 && (
                <>
                  <button
                    className={`${styles.navBtn} ${styles.navLeft}`}
                    onClick={() => handleImageNav("prev")}
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    className={`${styles.navBtn} ${styles.navRight}`}
                    onClick={() => handleImageNav("next")}
                  >
                    <ChevronRight size={20} />
                  </button>
                  <div className={styles.imageDots}>
                    {product.image_urls.map((_, i) => (
                      <button
                        key={i}
                        className={`${styles.dot} ${i === activeImageIndex ? styles.activeDot : ""}`}
                        onClick={() => setActiveImageIndex(i)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {product.image_urls.length > 1 && (
              <div className={styles.thumbnailStrip}>
                {product.image_urls.map((img, i) => (
                  <div
                    key={i}
                    className={`${styles.thumbWrap} ${i === activeImageIndex ? styles.activeThumb : ""}`}
                    onClick={() => setActiveImageIndex(i)}
                  >
                    <img
                      src={img}
                      alt={`View ${i + 1}`}
                      className={styles.thumbnail}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Foreign Campus Banner ── */}
          {isForeignCampus && (
            <div className={styles.foreignBanner}>
              <AlertTriangle size={16} />
              <span>
                <strong>Visitor Mode:</strong> Viewing from another campus.
                Purchasing & commenting are disabled.
              </span>
            </div>
          )}

          {/* ── Product Details ── */}
          <div className={styles.detailsCard}>
            <h1 className={styles.title}>{product.title}</h1>
            <div className={styles.metaRow}>
              <span className={styles.metaChip}>
                <Tag size={12} />
                {product.category}
              </span>
              <span className={styles.metaChip}>
                <Clock size={12} />
                {timeAgo(product.created_at)}
              </span>
              <span className={styles.metaChip}>
                <MapPin size={12} />
                {product.location || "Campus"}
              </span>
            </div>
            <div className={styles.descriptionSection}>
              <h3 className={styles.descHeading}>Description</h3>
              <p className={styles.descText}>{product.description}</p>
            </div>
          </div>

          {/* ════ Q&A / COMMENTS SECTION ════ */}
          <div className={styles.qaCard} id="comments">
            <div className={styles.qaHeader}>
              <MessageSquare size={17} strokeWidth={2} />
              <h3>Questions & Answers</h3>
              {totalComments > 0 && (
                <span className={styles.commentCountBadge}>
                  {totalComments}
                </span>
              )}
            </div>

            {/* ── Main Question Input ── */}
            {isForeignCampus ? (
              <div className={styles.lockedBox}>
                <ShieldCheck size={18} />
                <span>
                  Comments are locked for visitors from other campuses.
                </span>
              </div>
            ) : (
              <div className={styles.addCommentRow}>
                <div className={styles.currentUserAvatar}>
                  <User size={16} />
                </div>
                <div
                  className={`${styles.commentInputWrap} ${commentInputFocused ? styles.commentInputActive : ""}`}
                >
                  <input
                    type="text"
                    placeholder="Ask the seller a question…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className={styles.mainCommentInput}
                    onFocus={() => {
                      setCommentInputFocused(true);
                      setReplyingTo(null);
                      setReplyText("");
                    }}
                    onBlur={() => {
                      if (!commentText) setCommentInputFocused(false);
                    }}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      commentText.trim() &&
                      handlePostComment(commentText)
                    }
                  />
                  {commentInputFocused && (
                    <div className={styles.commentFormButtons}>
                      <button
                        className={styles.cancelCommentBtn}
                        onMouseDown={() => {
                          setCommentInputFocused(false);
                          setCommentText("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className={styles.postCommentBtn}
                        disabled={!commentText.trim() || isSubmittingComment}
                        onMouseDown={() => handlePostComment(commentText)}
                      >
                        <Send size={13} /> Post
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Comment Threads ── */}
            <div className={styles.commentList}>
              {topLevelComments.length === 0 ? (
                <div className={styles.emptyComments}>
                  <MessageSquare size={28} strokeWidth={1.5} />
                  <p>No questions yet. Be the first to ask!</p>
                </div>
              ) : (
                topLevelComments.map((comment, idx) => {
                  const replies = getReplies(comment.id);
                  const isReplying = replyingTo === comment.id;

                  return (
                    <div
                      key={comment.id}
                      className={styles.commentThread}
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      {/* ── Top-level comment ── */}
                      <div className={styles.commentRow}>
                        <AvatarImg
                          src={comment.user.avatar_url}
                          name={comment.user.full_name}
                          size={34}
                          className={styles.commentAvatar}
                        />
                        <div className={styles.commentBubble}>
                          <div className={styles.commentMeta}>
                            <span className={styles.commenterName}>
                              {comment.user.full_name}
                            </span>
                            <span className={styles.commentTime}>
                              {timeAgo(comment.created_at)}
                            </span>
                          </div>
                          <p className={styles.commentText}>
                            {comment.content}
                          </p>

                          {!isForeignCampus && (
                            <div className={styles.commentActions}>
                              <button
                                className={`${styles.voteBtn} ${comment.user_vote === 1 ? styles.votedUp : ""}`}
                                onClick={() => handleVote(comment.id, 1)}
                                title="Helpful"
                              >
                                <ThumbsUp size={13} />
                                {comment.upvotes > 0 && (
                                  <span>{comment.upvotes}</span>
                                )}
                              </button>
                              <button
                                className={`${styles.voteBtn} ${comment.user_vote === -1 ? styles.votedDown : ""}`}
                                onClick={() => handleVote(comment.id, -1)}
                                title="Not helpful"
                              >
                                <ThumbsDown size={13} />
                              </button>
                              <span className={styles.actionDivider} />
                              <button
                                className={`${styles.replyBtn} ${isReplying ? styles.replyBtnActive : ""}`}
                                onClick={() => {
                                  if (isReplying) {
                                    setReplyingTo(null);
                                    setReplyText("");
                                  } else {
                                    setReplyingTo(comment.id);
                                    setReplyText("");
                                    setCommentInputFocused(false);
                                  }
                                }}
                              >
                                {isReplying ? "Cancel" : "Reply"}
                              </button>
                              {replies.length > 0 && (
                                <span className={styles.replyCount}>
                                  {replies.length}{" "}
                                  {replies.length === 1 ? "reply" : "replies"}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Inline Reply Input (appears right here!) ── */}
                      {isReplying && !isForeignCampus && (
                        <div className={styles.inlineReplyContainer}>
                          <div className={styles.replyThreadLine} />
                          <div className={styles.inlineReplyRow}>
                            <div className={styles.currentUserAvatarSm}>
                              <User size={12} />
                            </div>
                            <div className={styles.inlineReplyInputWrap}>
                              <span className={styles.replyingToLabel}>
                                Replying to{" "}
                                <strong>{comment.user.full_name}</strong>
                              </span>
                              <input
                                ref={replyInputRef}
                                type="text"
                                placeholder={`Reply to ${comment.user.full_name}…`}
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                className={styles.inlineReplyInput}
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "Enter" &&
                                    !e.shiftKey &&
                                    replyText.trim()
                                  ) {
                                    handlePostComment(replyText, comment.id);
                                  }
                                  if (e.key === "Escape") {
                                    setReplyingTo(null);
                                    setReplyText("");
                                  }
                                }}
                              />
                              <div className={styles.inlineReplyActions}>
                                <button
                                  className={styles.cancelReplyBtn}
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText("");
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  className={styles.submitReplyBtn}
                                  disabled={
                                    !replyText.trim() || isSubmittingComment
                                  }
                                  onClick={() =>
                                    handlePostComment(replyText, comment.id)
                                  }
                                >
                                  <Send size={12} /> Reply
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Nested Replies ── */}
                      {replies.length > 0 && (
                        <div className={styles.repliesGroup}>
                          <div className={styles.replyThreadLine} />
                          <div className={styles.repliesList}>
                            {replies.map((reply) => (
                              <div key={reply.id} className={styles.replyRow}>
                                <AvatarImg
                                  src={reply.user.avatar_url}
                                  name={reply.user.full_name}
                                  size={28}
                                  className={styles.replyAvatar}
                                />
                                <div className={styles.replyBubble}>
                                  <div className={styles.commentMeta}>
                                    <span className={styles.commenterName}>
                                      {reply.user.full_name}
                                    </span>
                                    <span className={styles.commentTime}>
                                      {timeAgo(reply.created_at)}
                                    </span>
                                  </div>
                                  <p className={styles.commentText}>
                                    {reply.content}
                                  </p>
                                  {!isForeignCampus && (
                                    <div className={styles.commentActions}>
                                      <button
                                        className={`${styles.voteBtn} ${reply.user_vote === 1 ? styles.votedUp : ""}`}
                                        onClick={() => handleVote(reply.id, 1)}
                                      >
                                        <ThumbsUp size={12} />
                                        {reply.upvotes > 0 && (
                                          <span>{reply.upvotes}</span>
                                        )}
                                      </button>
                                      <button
                                        className={`${styles.voteBtn} ${reply.user_vote === -1 ? styles.votedDown : ""}`}
                                        onClick={() => handleVote(reply.id, -1)}
                                      >
                                        <ThumbsDown size={12} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ════ RIGHT COLUMN — Sticky Action Card ════ */}
        <div className={styles.rightCol}>
          <div className={styles.actionCard}>
            {/* Price + Share */}
            <div className={styles.priceRow}>
              <div className={styles.priceBlock}>
                <span className={styles.currencySymbol}>₹</span>
                <span className={styles.priceValue}>
                  {product.price.toLocaleString("en-IN")}
                </span>
              </div>
              <button
                className={styles.shareBtn}
                title="Share"
                onClick={handleShare}
              >
                <Share2 size={17} />
              </button>
            </div>

            {/* Status */}
            <div className={styles.statusRow}>
              <span
                className={`${styles.statusDot} ${product.status === "Available" ? styles.dotGreen : styles.dotGray}`}
              />
              <span className={styles.statusLabel}>{product.status}</span>
            </div>

            {/* Stats */}
            <div className={styles.statsRow}>
              <span className={styles.statChip}>
                <MapPin size={12} />
                {product.location || "Campus"}
              </span>
              <span className={styles.statChip}>
                <Eye size={12} />
                {product.views || 0}
              </span>
              <button
                className={`${styles.statChip} ${styles.likeChip} ${product.is_liked ? styles.likeChipActive : ""} ${likeAnim ? styles.likeAnim : ""}`}
                onClick={handleToggleLike}
              >
                <Heart
                  size={12}
                  fill={product.is_liked ? "currentColor" : "none"}
                />
                {product.likes_count || 0}
              </button>
            </div>

            {/* Action Buttons */}
            <div className={styles.actionButtons}>
              {isForeignCampus ? (
                <button className={styles.disabledBtn} disabled>
                  Campus-exclusive listing
                </button>
              ) : (
                <button
                  className={styles.primaryBtn}
                  onClick={() =>
                    navigate(
                      `/messages?user=${product.seller.id}&product=${product.id}`,
                    )
                  }
                >
                  <MessageSquare size={16} />
                  Message Seller
                </button>
              )}

              <button
                className={`${styles.secondaryBtn} ${product.is_saved ? styles.savedActive : ""} ${savedAnim ? styles.savedAnim : ""}`}
                onClick={handleToggleSave}
              >
                <Heart
                  size={16}
                  fill={product.is_saved ? "currentColor" : "none"}
                />
                {product.is_saved ? "Saved" : "Save Item"}
              </button>
            </div>

            <div className={styles.divider} />

            {/* Seller Info */}
            <div className={styles.sellerSection}>
              <p className={styles.sellerLabel}>SELLER</p>
              <div className={styles.sellerRow}>
                <AvatarImg
                  src={product.seller.avatar_url}
                  name={product.seller.full_name}
                  size={44}
                  className={styles.sellerAvatar}
                />
                <div className={styles.sellerInfo}>
                  <p className={styles.sellerName}>
                    {product.seller.full_name}
                  </p>
                  {product.seller.qualification && (
                    <p className={styles.sellerEdu}>
                      {product.seller.qualification}
                      {product.seller.year_of_study &&
                        ` · ${product.seller.year_of_study}`}
                    </p>
                  )}
                  <button
                    className={styles.viewProfileBtn}
                    onClick={() => navigate(`/user/${product.seller.id}`)}
                  >
                    View Profile →
                  </button>
                </div>
              </div>
            </div>

            {/* Safety tip */}
            <div className={styles.safetyTip}>
              <ShieldCheck size={14} />
              <span>Always transact on campus in a public place.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
