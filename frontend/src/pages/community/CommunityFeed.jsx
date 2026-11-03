// frontend/src/pages/community/CommunityFeed.jsx
//
// One feed: the composer row (or the view-only banner), the posts, paging,
// skeletons and the empty text. Used for the campus feed and the country /
// Global feed, in both layouts.
//
// The parent gives it a `key` per feed + sort, so a different feed is a fresh
// mount: cursors belong to one list and one sort (runbook Appendix A), and a
// remount is the simplest way never to mix two.
//
// `patches` holds reaction answers by post id. They live above the feeds, so a
// reaction survives switching feeds and coming back (the feed remounts), and
// each feed lays them over its own copy.

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AvatarImg from "../../components/AvatarImg/AvatarImg";
import InfiniteScrollSentinel from "../../components/InfiniteScrollSentinel/InfiniteScrollSentinel";
import PostCard from "../../components/community/PostCard/PostCard";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import { SAMPLE_VIEWER, sampleFeed } from "./sampleData";
import styles from "./Community.module.css";

const SkeletonPost = memo(function SkeletonPost() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={`${styles.skeletonAvatar} ${styles.shimmer}`} />
      <div className={styles.skeletonBody}>
        <div className={`${styles.skeletonLine} ${styles.skeletonLineSm} ${styles.shimmer}`} />
        <div className={`${styles.skeletonLine} ${styles.shimmer}`} />
        <div className={`${styles.skeletonBlock} ${styles.shimmer}`} />
      </div>
    </div>
  );
});

export default function CommunityFeed({
  kind,
  country = null,
  sort = "new",
  scrollRoot = null,
  composerText,
  emptyText,
  viewOnlyName,
  patches,
  onReact,
}) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [canPost, setCanPost] = useState(null);
  const [failed, setFailed] = useState(false);
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

  const sentinelRef = useInfiniteScroll({
    hasMore: hasMore && !failed && !firstLoad,
    isLoading: loading,
    onLoadMore: () => loadPage(cursor),
    root: scrollRoot,
  });

  const shown = useMemo(
    () => items.map((p) => (patches[p.id] ? { ...p, ...patches[p.id] } : p)),
    [items, patches],
  );

  return (
    <div className={styles.feed}>
      {canPost === false ? (
        // Spec §1.4: another country's feed is view only.
        <p className={styles.viewOnly} role="note">
          <span aria-hidden="true">👀</span>
          <span>
            You're viewing {viewOnlyName}. Only students at universities in {viewOnlyName} can post
            and reply here. You can still react and report.
          </span>
        </p>
      ) : canPost === true ? (
        // Spec §2.1, the closed composer. Part 2 (CC-N4b) opens it inline.
        <button type="button" className={styles.composerRow}>
          <AvatarImg
            src={SAMPLE_VIEWER.avatar}
            name={SAMPLE_VIEWER.name}
            size={32}
            className={styles.composerAvatar}
          />
          <span>{composerText}</span>
        </button>
      ) : null}

      {firstLoad ? (
        <div className={styles.list} role="status" aria-label="Loading posts">
          <SkeletonPost />
          <SkeletonPost />
          <SkeletonPost />
        </div>
      ) : shown.length === 0 && !failed ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <div className={styles.list}>
          {shown.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onReact={onReact}
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
}
