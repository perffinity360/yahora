// frontend/src/pages/community/UserPosts.jsx
//
// A student's posts — docs/design/COMMUNITY_SPEC.md §10: the Posts tab on
// Dashboard and the Posts section on someone's profile. GET
// /api/posts/by-user/:userId, newest first, with infinite scroll, as the same
// flat post cards the feeds use.
//
// Your own list also has your held (`Being checked`) and covered
// (`Under review`) posts, labelled by PostCard; a post held for self-harm has
// the support card (spec §2.4) under it. Nobody else is sent those posts at
// all, so nothing is filtered here.
//
// Replying happens on the post's page or in the feed, so the 💬 pill here
// opens the thread in place, as in a view-only feed.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InfiniteScrollSentinel from "../../components/InfiniteScrollSentinel/InfiniteScrollSentinel";
import PostCard from "../../components/community/PostCard/PostCard";
import SupportCard from "../../components/community/Composer/SupportCard";
import { usePostActions } from "../../components/community/PostMenu/PostMenu";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import useReactionPatches, { applyPatches } from "../../hooks/useReactionPatches";
import { getReplies, getUserPosts } from "./api";
import { SkeletonPost, loadProfile } from "./CommunityFeed";
import PostActionsProvider from "./PostActions";
import styles from "./Community.module.css";

function PostsList({ userId }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [failed, setFailed] = useState(false);
  const [closedSupport, setClosedSupport] = useState(() => new Set());
  const inFlight = useRef(false);
  const alive = useRef(true);
  const { patches, onReact } = useReactionPatches();
  const hidden = usePostActions()?.hidden;

  useEffect(() => {
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
        const page = await getUserPosts(userId, from);
        if (!alive.current) return;
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
        });
        setCursor(page.next_cursor);
        setHasMore(page.next_cursor !== null);
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
    [userId],
  );

  useEffect(() => {
    loadPage(null);
  }, [loadPage]);

  const sentinelRef = useInfiniteScroll({
    hasMore: hasMore && !failed && !firstLoad,
    isLoading: loading,
    onLoadMore: () => loadPage(cursor),
  });

  const shown = useMemo(
    () => applyPatches(items, patches).filter((p) => !hidden?.has(p.id)),
    [items, patches, hidden],
  );
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const react = useCallback(
    (postId, emoji) => onReact(postId, emoji, shownRef.current.find((p) => p.id === postId)),
    [onReact],
  );
  const loadReplies = useCallback((postId, from) => getReplies(postId, from), []);

  return (
    <div className={styles.feed}>
      {firstLoad ? (
        <div className={styles.list} role="status" aria-label="Loading posts">
          <SkeletonPost />
          <SkeletonPost />
          <SkeletonPost />
        </div>
      ) : shown.length === 0 && !failed ? (
        <p className={styles.empty}>No posts yet.</p>
      ) : (
        <div className={styles.list}>
          {shown.map((p, i) => (
            <React.Fragment key={p.id}>
              <PostCard
                post={p}
                index={i}
                onReact={react}
                loadReplies={loadReplies}
                loadProfile={loadProfile}
              />
              {p.moderation_status === "pending" && p.moderation_support && !closedSupport.has(p.id) && (
                <div className={styles.supportUnder}>
                  <SupportCard onClose={() => setClosedSupport((prev) => new Set(prev).add(p.id))} />
                </div>
              )}
            </React.Fragment>
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

export default function UserPosts({ userId }) {
  return (
    <PostActionsProvider>
      {/* A fresh list for each person. */}
      <PostsList key={userId} userId={userId} />
    </PostActionsProvider>
  );
}
