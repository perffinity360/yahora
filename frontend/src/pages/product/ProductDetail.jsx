// frontend/src/pages/product/ProductDetail.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import styles from "./ProductDetail.module.css";
import ImageLightbox from "../../components/ImageLightbox/ImageLightbox";
import ShareSheet from "../../components/ShareSheet/ShareSheet";
import { supabase } from "../../config/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import {
  Heart,
  Share2,
  MessageSquare,
  MessageCircle,
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
import { API_BASE_URL } from '../../config/urls';
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import InfiniteScrollSentinel from "../../components/InfiniteScrollSentinel/InfiniteScrollSentinel";


/* Appends a page of comments onto the ones already on screen, skipping any id
   already present.

   Order is load order, which is what the threading below wants: the server
   sends each page newest-first and every reply arrives on the same page as its
   top-level parent, so appending keeps top-level comments in newest-first order
   and keeps every reply behind its parent. A comment the student has just
   posted sits at the front of `prev` and stays there. */
function mergeCommentsById(prev, next) {
  if (!next.length) return prev;
  const seen = new Set(prev.map((c) => c.id));
  const fresh = next.filter((c) => !seen.has(c.id));
  return fresh.length ? [...prev, ...fresh] : prev;
}

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
  const { sessionReady } = useAuth();
  const currentUserId = localStorage.getItem("yahora_user_id");
  const [actualHomeUniId, setActualHomeUniId] = useState(
    localStorage.getItem("yahora_university_id"),
  );

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  // Full-screen zoomable view of the product photos (ImageLightbox).
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Our own share sheet — see handleShare below for why not navigator.share.
  const [shareOpen, setShareOpen] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  /* comment states */
  const [commentText, setCommentText] = useState(""); // for new top-level questions
  const [replyText, setReplyText] = useState(""); // for inline replies
  const [replyingTo, setReplyingTo] = useState(null); // commentId | null
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentInputFocused, setCommentInputFocused] = useState(false);

  /* 📄 Comment pagination (Phase 5 Block N-B). `product.comments.items` is now
     every page of comments loaded so far, appended — not one response. */
  const [commentsCursor, setCommentsCursor] = useState(null);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [loadingMoreComments, setLoadingMoreComments] = useState(false);
  /* Synchronous double-fetch guard — a state flag has not flipped yet when a
     second caller checks it in the same tick. */
  const commentsInFlightRef = useRef(false);
  /* Bumped when the listing being viewed changes, so a page of comments for
     the previous product cannot land in this one. */
  const commentsRunRef = useRef(0);
  const commentsAbortRef = useRef(null);

  /* ui feedback */
  const [likeAnim, setLikeAnim] = useState(false);
  const [savedAnim, setSavedAnim] = useState(false);

  const replyInputRef = useRef(null);

  /* ── Data Fetching ── */
  useEffect(() => {
    // This route is public, but for a signed-in student the block below reads
    // `users` directly from Supabase to resolve their home campus. Hold the whole
    // effect until the client is authenticated so that query doesn't go out as
    // `anon`; signed-out visitors skip the wait entirely.
    if (currentUserId && !sessionReady) return;

    // RESET per listing: a new :id is a different comment list, so the pages,
    // the cursor and hasMore all start again from nothing.
    commentsRunRef.current += 1;
    commentsAbortRef.current?.abort();
    commentsInFlightRef.current = false;
    setCommentsCursor(null);
    setCommentsHasMore(false);
    setLoadingMoreComments(false);

    const fetchData = async () => {
      try {
        const url = `${API_BASE_URL}/products/${id}${currentUserId ? `?user_id=${currentUserId}` : ""}`;
        // 🔒 The viewer comes from the TOKEN since Block V-A — `?user_id=` in
        // the url above is still sent but ignored server-side. Without this
        // header a signed-in student gets no `is_liked` / `is_saved` and no
        // `user_vote` on any comment, so their own votes render as unvoted.
        const token = localStorage.getItem("yahora_session");
        const response = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await response.json();
        if (response.ok) {
          setProduct(data.product);
          // 📄 Page one of the comments rides along inside the product
          // response. `next_cursor === null` is the ONLY end-of-list signal —
          // not an empty `items`, and not a page shorter than the limit.
          const cursor = data.product?.comments?.next_cursor ?? null;
          setCommentsCursor(cursor);
          setCommentsHasMore(cursor !== null);
        }

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
  }, [id, currentUserId, sessionReady]);

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
      // 🔒 /like is behind requireAuth (backend §1.6 — docs/CHANGELOG.md
      // 2026-08-23). The actor now comes from this token; the `user_id` in the
      // body is ignored by the backend and kept only to avoid churn.
      const token = localStorage.getItem("yahora_session");

      const res = await fetch(`${API_BASE_URL}/products/${id}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: currentUserId }),
      });

      if (!res.ok) throw new Error(`like ${res.status}`);
    } catch (error) {
      // Roll the optimistic update back rather than leaving a like that the
      // server rejected lit until the next reload.
      setProduct((prev) => ({
        ...prev,
        is_liked: !prev.is_liked,
        likes_count: prev.is_liked
          ? Math.max(0, prev.likes_count - 1)
          : prev.likes_count + 1,
      }));
      console.error("Failed to toggle like:", error);
    }
  };

  const handleToggleSave = async () => {
    if (!currentUserId) return alert("Please log in to save items.");
    setSavedAnim(true);
    setTimeout(() => setSavedAnim(false), 400);
    setProduct((prev) => ({ ...prev, is_saved: !prev.is_saved }));
    try {
      // 🔒 See the note on handleToggleLike above.
      const token = localStorage.getItem("yahora_session");

      const res = await fetch(`${API_BASE_URL}/products/${id}/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: currentUserId }),
      });

      if (!res.ok) throw new Error(`save ${res.status}`);
    } catch (error) {
      setProduct((prev) => ({ ...prev, is_saved: !prev.is_saved }));
      console.error("Failed to toggle save:", error);
    }
  };

  /* Unified post-comment handler – takes content string + optional parentId */
  const handlePostComment = async (content, parentId = null) => {
    if (!content.trim() || !currentUserId) return;
    setIsSubmittingComment(true);
    try {
      // 🔒 requireAuth since Phase 4 Block V-A — the actor is the token, and a
      // `user_id` in the body is ignored. Without this header: silent 401.
      const token = localStorage.getItem("yahora_session");
      const response = await fetch(`${API_BASE_URL}/products/${id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
          // Keep the `{ items, next_cursor }` envelope intact — replacing it
          // with a bare array here would break the tree helpers below on the
          // very next render.
          comments: {
            ...prev.comments,
            items: [
              { ...data.comment, user_vote: 0 },
              ...(prev.comments?.items ?? []),
            ],
          },
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
      const newComments = (prev.comments?.items ?? []).map((c) => {
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
      return { ...prev, comments: { ...prev.comments, items: newComments } };
    });
    try {
      // 🔒 requireAuth since Phase 4 Block V-A. See handlePostComment above.
      const token = localStorage.getItem("yahora_session");
      await fetch(`${API_BASE_URL}/products/comments/${commentId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: currentUserId, vote_value: voteValue }),
      });
    } catch {
      /* silent */
    }
  };

  /* ── Older comments ────────────────────────────────────────────────────────
     📄 Phase 5 Block N-B. Block N-B (Phase 4) turned `product.comments` from a
     bare array into `{ items, next_cursor }` and left the cursor unread; this
     reads it.

     There is no comments-only endpoint — the comment pages are served by
     `GET /api/products/:id`, which is why this refetches the listing to get
     them. Only `comments` is merged out of the response: `product` itself is
     left exactly as it is, because it carries optimistic like / save state that
     a wholesale replace would silently roll back.

     `limit` is not sent. The server's default of 20 is what we want and it caps
     at 50 regardless. The cursor goes back verbatim — the comment cursor is a
     compound `created_at|id` encoded base64url and Block N-B was explicit that
     the encoding is not a contract: never build one, never decode one. */
  const loadMoreComments = useCallback(async () => {
    if (!commentsHasMore || commentsCursor === null) return;

    // 🚦 DOUBLE-FETCH GUARD. The observer is also torn down for the duration of
    // a request (see hooks/useInfiniteScroll); this ref is the check that every
    // caller passes through, in the same tick the request starts.
    if (commentsInFlightRef.current) return;
    commentsInFlightRef.current = true;

    const run = commentsRunRef.current;
    const controller = new AbortController();
    commentsAbortRef.current = controller;
    setLoadingMoreComments(true);

    try {
      const params = new URLSearchParams();
      if (currentUserId) params.append("user_id", currentUserId);
      params.append("cursor", commentsCursor);

      // 🔒 The viewer comes from the TOKEN since Block V-A — `?user_id=` above
      // is still sent but ignored server-side. Without this header the older
      // comments come back with no `user_vote`, so the student's own votes on
      // page two render as unvoted.
      const token = localStorage.getItem("yahora_session");
      const response = await fetch(
        `${API_BASE_URL}/products/${id}?${params.toString()}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        },
      );
      const data = await response.json();

      // Navigated to a different listing while this was in the air.
      if (run !== commentsRunRef.current) return;

      if (response.ok) {
        const items = data.product?.comments?.items ?? [];
        const cursor = data.product?.comments?.next_cursor ?? null;

        setProduct((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            comments: {
              ...prev.comments,
              // Merge, never replace: a comment posted while this request was
              // in flight is at the front of `items` and has to survive, and
              // so does every page already loaded.
              items: mergeCommentsById(prev.comments?.items ?? [], items),
            },
          };
        });

        setCommentsCursor(cursor);
        setCommentsHasMore(cursor !== null);
      } else {
        // Stop rather than let the observer re-request, every time the sentinel
        // scrolls into view, a page the server keeps rejecting.
        setCommentsHasMore(false);
      }
    } catch (error) {
      if (error.name === "AbortError") return;
      if (run !== commentsRunRef.current) return;
      setCommentsHasMore(false);
    } finally {
      // Release the guard only if this is still the live request — an aborted
      // call for the previous listing settles after the new one has started,
      // and releasing unconditionally would unlock the guard underneath it.
      if (commentsAbortRef.current === controller) {
        commentsInFlightRef.current = false;
      }
      if (run === commentsRunRef.current) setLoadingMoreComments(false);
    }
  }, [commentsHasMore, commentsCursor, currentUserId, id]);

  const commentsSentinelRef = useInfiniteScroll({
    hasMore: commentsHasMore,
    isLoading: loadingMoreComments,
    onLoadMore: loadMoreComments,
  });

  // Leaving the page mid-request should not leave a fetch resolving into a
  // component that is gone.
  useEffect(() => () => commentsAbortRef.current?.abort(), []);

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

  /* Opens our own sheet (components/ShareSheet) rather than going straight to
     navigator.share — the same sheet the cards on the marketplace grid use.

     What was here before called navigator.share, which does not exist on
     desktop Chrome or Firefox, and fell back to navigator.clipboard, which is
     undefined over plain http:// (how the dev server is reached from a phone on
     the LAN). In both cases the throw was caught and logged, so the button
     looked dead. The sheet always works, and still offers the native one where
     the browser has it. */
  const handleShare = () => setShareOpen(true);

  const timeAgo = (dateString) => {
    const mins = Math.floor((new Date() - new Date(dateString)) / 60000);
    if (mins < 60) return mins <= 1 ? "just now" : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return days === 1 ? "yesterday" : `${days}d ago`;
  };

  /* ── Comment tree helpers ── */
  // 📄 `product.comments` became `{ items, next_cursor }` in Phase 4 Block N-B;
  // it was a bare array. The threading below is unchanged — the server still
  // sends a flat list, newest first, and every reply on the page arrives with
  // its parent, so no reply can be orphaned by pagination.
  //
  // 📄 Phase 5 Block N-B: `items` now holds every page loaded so far, appended
  // in load order, and `next_cursor` drives the sentinel at the bottom of the
  // list. The threading is untouched and needs to be — each page carries its
  // own replies, so a flat filter still reassembles every thread correctly
  // however many pages are on screen.
  const commentItems = product?.comments?.items ?? [];
  const topLevelComments = commentItems.filter((c) => !c.parent_comment_id);
  const getReplies = (parentId) =>
    commentItems.filter((c) => c.parent_comment_id === parentId);

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
  const totalComments = product.comments?.items?.length || 0;

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
                // Opens the full-screen viewer, where the photo can be zoomed.
                // role/tabIndex/onKeyDown make it reachable without a mouse.
                role="button"
                tabIndex={0}
                aria-label={`View ${product.title} full screen`}
                style={{ cursor: "zoom-in" }}
                onClick={() => setLightboxOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setLightboxOpen(true);
                  }
                }}
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

          {lightboxOpen && (
            <ImageLightbox
              images={product.image_urls}
              startIndex={activeImageIndex}
              alt={product.title}
              onClose={() => setLightboxOpen(false)}
            />
          )}

          {shareOpen && (
            <ShareSheet product={product} onClose={() => setShareOpen(false)} />
          )}

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
              <MessageCircle size={17} strokeWidth={2} />
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
                  <MessageCircle size={28} strokeWidth={1.5} />
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

              {/* 📄 Infinite scroll for older comments. Outside the
                  empty/populated branch so it works either way, and gone
                  entirely once next_cursor is null — no end-of-list message. */}
              {commentsHasMore && (
                <InfiniteScrollSentinel
                  sentinelRef={commentsSentinelRef}
                  loading={loadingMoreComments}
                  label="Loading older comments"
                />
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
