// frontend/src/pages/community/CommunityFeed.jsx
//
// One feed: the posts, paging, skeletons and the empty text, with the composer
// (or the view-only line) docked under them. Used for the campus feed and the
// country / Global feed, in both layouts.
//
// `inPanel` is the laptop layout: the feed scrolls inside its panel and the
// dock sits under the scroller. Without it the page scrolls and the dock floats
// at the bottom of the window, with the posts passing underneath.
//
// The parent gives it a `key` per feed + sort, so a different feed is a fresh
// mount: cursors belong to one list and one sort (runbook Appendix A), and a
// remount is the simplest way never to mix two.
//
// `patches` holds reaction answers by post id. They live above the feeds, so a
// reaction survives switching feeds and coming back (the feed remounts), and
// each feed lays them over its own copy.
//
// On a laptop the page also says which side you're writing on: `selected`
// keeps that side's composer highlighted while it isn't in use, `focusSignal`
// puts the cursor in it, and `onCanPostChange` tells the page whether this
// feed has a composer at all (another country's feed is view only).

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

/* Spec §1.1: a panel's scrollbar shows while it scrolls, then fades. */
const SCROLLBAR_LINGER_MS = 900;
import { Eye } from "lucide-react";
import Composer from "../../components/community/Composer/Composer";
import InfiniteScrollSentinel from "../../components/InfiniteScrollSentinel/InfiniteScrollSentinel";
import PostCard from "../../components/community/PostCard/PostCard";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import { samplePost, sampleFeed, sampleReplies } from "./sampleData";
import styles from "./Community.module.css";

const SkeletonPost = memo(function SkeletonPost() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skeletonHead}>
        <div className={`${styles.skeletonAvatar} ${styles.shimmer}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonLineSm} ${styles.shimmer}`} />
      </div>
      <div className={`${styles.skeletonLine} ${styles.shimmer}`} />
      <div className={`${styles.skeletonBlock} ${styles.shimmer}`} />
    </div>
  );
});

export default function CommunityFeed({
  kind,
  country = null,
  countryName = "",
  sort = "new",
  inPanel = false,
  side = null,
  viewer,
  emptyText,
  viewOnlyName,
  patches,
  onReact,
  onComposerActive,
  selected = false,
  focusSignal = 0,
  autoFocusComposer = false,
  onCanPostChange,
}) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  // The campus feed is always yours; the others say so with their first page.
  const [canPost, setCanPost] = useState(kind === "campus" ? true : null);
  const [failed, setFailed] = useState(false);
  const [scroller, setScroller] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [addedReplies, setAddedReplies] = useState({});
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    // Set on mount too: StrictMode mounts, unmounts and mounts again.
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadPage = useCallback(
    async (from) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setLoading(true);
      setFailed(false);
      try {
        // Part 2 swaps this one line for api.getFeed(kind, { country, sort, cursor }).
        const page = await sampleFeed(kind, { country, sort, cursor: from });
        if (!alive.current) return;
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
        });
        setCursor(page.next_cursor);
        setHasMore(page.next_cursor !== null);
        if (typeof page.can_post === "boolean") setCanPost(page.can_post);
      } catch {
        if (alive.current) setFailed(true);
      } finally {
        inFlight.current = false;
        if (alive.current) {
          setLoading(false);
          setFirstLoad(false);
        }
      }
    },
    [kind, country, sort],
  );

  useEffect(() => {
    loadPage(null);
  }, [loadPage]);

  // null while the first page loads: the page keeps your side selected
  // through a reload instead of flicking to the other one and back.
  useEffect(() => {
    onCanPostChange?.(canPost);
  }, [canPost, onCanPostChange]);

  // The scrollbar is see-through until the panel scrolls (Community.module.css).
  // Set on the element itself, so scrolling never re-renders the feed.
  useEffect(() => {
    if (!scroller) return undefined;
    let timer = null;
    const onScroll = () => {
      scroller.dataset.scrolling = "";
      clearTimeout(timer);
      timer = setTimeout(() => delete scroller.dataset.scrolling, SCROLLBAR_LINGER_MS);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      clearTimeout(timer);
    };
  }, [scroller]);

  const sentinelRef = useInfiniteScroll({
    hasMore: hasMore && !failed && !firstLoad,
    isLoading: loading,
    onLoadMore: () => loadPage(cursor),
    root: inPanel ? scroller : null,
  });

  const shown = useMemo(
    () => items.map((p) => (patches[p.id] ? { ...p, ...patches[p.id] } : p)),
    [items, patches],
  );

  const onPosted = useCallback((post) => {
    if (post.parent_post_id) {
      setItems((prev) =>
        prev.map((p) =>
          p.id === post.parent_post_id ? { ...p, replies_count: p.replies_count + 1 } : p,
        ),
      );
      setAddedReplies((prev) => ({
        ...prev,
        [post.parent_post_id]: [...(prev[post.parent_post_id] ?? []), post],
      }));
      setReplyTo(null);
    } else {
      setItems((prev) => [post, ...prev]);
      if (inPanel) scroller?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [inPanel, scroller]);

  // Stable, so a memoised PostCard re-renders only when its own post changes.
  const startReply = useCallback((post) => setReplyTo(post), []);
  const loadReplies = useCallback((postId, from) => sampleReplies(postId, from), []);

  const composerProps = {
    feed: kind,
    countryName,
    countryCode: country,
    viewer,
    showAvatar: !inPanel, // on a laptop the avatar is the one on the divider
    onSubmit: samplePost,
    onPosted,
    onActiveChange: onComposerActive,
    selected,
    // Both get it: the hidden one can't take the cursor, so it lands in
    // whichever is showing.
    focusSignal,
  };

  const dock =
    canPost === false ? (
      // Spec §1.4: another country's feed is view only.
      <p className={styles.viewOnly} role="note">
        <Eye size={14} aria-hidden="true" className={styles.viewOnlyIcon} />
        <span>
          Only students in {viewOnlyName} can post and reply here. You can still react and report.
        </span>
      </p>
    ) : canPost === true ? (
      <>
        {/* Stays mounted while a reply is open, so a half-written post is
            still there afterwards (spec §2.3: text is never thrown away). */}
        <div hidden={Boolean(replyTo)}>
          <Composer {...composerProps} autoFocus={autoFocusComposer} />
        </div>
        {replyTo && (
          <Composer
            {...composerProps}
            parentId={replyTo.id}
            replyToUsername={replyTo.author_username}
            autoFocus
            onCancelReply={() => setReplyTo(null)}
          />
        )}
      </>
    ) : null;

  const feed = (
    <div className={styles.feed}>
      {firstLoad ? (
        <div className={styles.list} role="status" aria-label="Loading posts">
          <SkeletonPost />
          <SkeletonPost />
          <SkeletonPost />
        </div>
      ) : shown.length === 0 && !failed ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <div className={`${styles.list} ${kind === "campus" ? styles.listCampus : styles.listWorld}`}>
          {shown.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              index={i}
              showCampus={kind !== "campus"}
              canReply={canPost === true}
              onReact={onReact}
              onReply={startReply}
              loadReplies={loadReplies}
              addedReplies={addedReplies[p.id]}
            />
          ))}
        </div>
      )}

      {failed && (
        <div className={styles.failed} role="alert">
          <span>Couldn't load posts.</span>
          <button type="button" className={styles.retry} onClick={() => loadPage(cursor)}>
            Try again
          </button>
        </div>
      )}

      {!firstLoad && hasMore && !failed && (
        <InfiniteScrollSentinel sentinelRef={sentinelRef} loading={loading} label="Loading more posts" />
      )}
    </div>
  );

  const accent = kind === "campus" ? styles.dockCampus : styles.dockWorld;

  if (!inPanel) {
    return (
      <>
        {feed}
        <div className={`${styles.dockFloat} ${accent}`}>{dock}</div>
      </>
    );
  }

  return (
    <div className={styles.feedShell}>
      <div ref={setScroller} className={styles.panelScroll}>
        {feed}
      </div>
      <div className={`${styles.dock} ${accent} ${side === "left" ? styles.dockLeft : styles.dockRight}`}>
        {dock}
      </div>
    </div>
  );
}
