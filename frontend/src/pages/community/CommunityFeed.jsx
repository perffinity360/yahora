// frontend/src/pages/community/CommunityFeed.jsx
//
// One feed: the posts, paging, skeletons and the empty text, with the composer
// (or the view-only line) docked under them. Used for the campus feed and the
// country / Global feed, in both layouts.
//
// `inPanel` is the laptop layout: the feed scrolls inside its panel and the
// dock sits under the scroller. Without it the page scrolls and the same solid
// dock stays at the bottom of the window, hiding the posts that pass under it.
//
// The parent gives it a `key` per feed + sort, so a different feed is a fresh
// mount: cursors belong to one list and one sort (runbook Appendix A), and a
// remount is the simplest way never to mix two.
//
// `patches` holds reaction answers by post id. They live above the feeds, so a
// reaction survives switching feeds and coming back (the feed remounts), and
// each feed lays them over its own copy. A press passes the post as it shows
// now to onReact, which patches it at once and rolls back if the API refuses.
//
// `kind` is null while the page doesn't know which feed this is yet (the
// countries are loading): the skeletons show and nothing loads.
//
// A post reported or deleted from its ⋯ menu leaves the list at once
// (`hidden`, from PostActionsContext; see ./PostActions.jsx).
//
// The campus feed asks every NEW_POSTS_POLL_MS, while the page is visible,
// how many posts are newer than the newest one it shows (spec §8), and shows
// the "new posts" pill. Pressing it scrolls to the top and fetches the first
// page in the background; only the posts not already shown are added on top,
// sliding in, and every page loaded below stays (and the cursor with it).
// Nothing is cleared, and posts are never inserted without that press.
//
// On a laptop the page also says which side you're writing on: `selected`
// keeps that side's composer highlighted while it isn't in use, `focusSignal`
// puts the cursor in it, and `onCanPostChange` tells the page whether this
// feed has a composer at all (another country's feed is view only).

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

/* Spec §1.1: a panel's scrollbar shows while it scrolls, then fades. */
const SCROLLBAR_LINGER_MS = 900;
/* Spec §8: the "new posts" pill fades out over this long (Community.module.css). */
const NEW_POSTS_FADE_MS = 200;
/* ⚠ Not in the spec: it has no words for this. The feed's own failure line
   says "Couldn't load posts." */
const NEW_POSTS_FAILED = "Couldn't load new posts. Try again.";

/* The `since` for new-count: 1 ms after the newest post shown. The API reads
   `since` to the millisecond, and the database keeps microseconds, so
   `created_at` itself (…00.123456) would come back as …00.123 and the newest
   post shown would count as new. */
function justAfter(iso) {
  return new Date(Date.parse(iso) + 1).toISOString();
}

/* The newest `created_at` in a list (the campus feed is newest first, but
   your own post is put at the top by hand, so this doesn't trust the order). */
function newestTime(items) {
  let best = null;
  for (const p of items) {
    if (best === null || Date.parse(p.created_at) > Date.parse(best)) best = p.created_at;
  }
  return best;
}
import { ArrowUp, Eye } from "lucide-react";
import Composer from "../../components/community/Composer/Composer";
import InfiniteScrollSentinel from "../../components/InfiniteScrollSentinel/InfiniteScrollSentinel";
import PostCard from "../../components/community/PostCard/PostCard";
import { usePostActions } from "../../components/community/PostMenu/PostMenu";
import useInfiniteScroll from "../../hooks/useInfiniteScroll";
import { applyPatches } from "../../hooks/useReactionPatches";
import { NEW_POSTS_POLL_MS } from "../../utils/community";
import { createPost, getFeed, getNewCount, getReplies } from "./api";
import { useReplyCounts, withReplyCount } from "./PostActions";
import styles from "./Community.module.css";

/* ⚠ No route sends the profile glimpse's counts and photos yet (spec §4.1:
   the social module isn't built). Failing on purpose makes the card hide
   them, instead of shimmering for ever; the name, photo, username and campus
   still show, because they come with the post. */
export const loadProfile = () => Promise.reject(new Error("Not built yet"));

export const SkeletonPost = memo(function SkeletonPost() {
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
  const [newCount, setNewCount] = useState(0);
  // What the pill shows, and whether it's fading out. It stays a moment
  // after newCount drops to 0, so it can fade.
  const [pillCount, setPillCount] = useState(0);
  const [pillLeaving, setPillLeaving] = useState(false);
  // The posts the pill just brought in, by id → their place in the stagger.
  const [arrived, setArrived] = useState({});
  const fetchingNew = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const since = useRef(null);
  const checkNewRef = useRef(null);
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
        const page = await getFeed(kind, { country, sort, cursor: from });
        if (!alive.current) return;
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
        });
        // A first page (or the pill's reload) shows everything new so far.
        if (from === null) setNewCount(0);
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
    if (kind) loadPage(null);
  }, [kind, loadPage]);

  // null while the first page loads: the page keeps your side selected
  // through a reload instead of flicking to the other one and back.
  useEffect(() => {
    onCanPostChange?.(canPost);
  }, [canPost, onCanPostChange]);

  // The scrollbar is see-through until the panel scrolls (Community.module.css).
  // Set on the element itself, so scrolling never re-renders the feed. Its room
  // (0 where scrollbars overlay) is published too, so the cards' right margin
  // plus that room equals their left margin.
  useEffect(() => {
    if (!scroller) return undefined;
    scroller.style.setProperty("--scrollbar-room", `${scroller.offsetWidth - scroller.clientWidth}px`);
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

  // Spec §8: "new" is newer than the newest post shown. It moves on every load
  // and reload, and when your own post goes on top, so the pill only counts
  // posts you can't see yet. Hidden posts (reported, deleted) still count as
  // seen: `items`, not `shown`. An empty feed counts from now. When it moves,
  // ask again at once, so a count that is now too high doesn't linger.
  const newest = useMemo(() => newestTime(items), [items]);
  useEffect(() => {
    if (kind !== "campus" || firstLoad) return;
    const next = newest ? justAfter(newest) : (since.current ?? new Date().toISOString());
    if (next === since.current) return;
    since.current = next;
    checkNewRef.current?.();
  }, [kind, firstLoad, newest]);

  // Campus only, every NEW_POSTS_POLL_MS, and not while the page is hidden;
  // becoming visible again asks at once.
  useEffect(() => {
    if (kind !== "campus" || firstLoad) return undefined;
    let asked = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || !since.current) return;
      const mine = ++asked;
      try {
        const { count } = await getNewCount(since.current);
        // Only the latest question counts: an older one asked about an older `since`.
        if (alive.current && mine === asked) setNewCount(count);
      } catch {
        // Only a hint: try again next time.
      }
    };
    checkNewRef.current = check;
    const timer = setInterval(check, NEW_POSTS_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      checkNewRef.current = null;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [kind, firstLoad]);

  // newCount → what the pill shows: in at once; out after its fade.
  useEffect(() => {
    if (newCount > 0) {
      setPillLeaving(false);
      setPillCount(newCount);
      return undefined;
    }
    if (pillCount === 0) return undefined;
    setPillLeaving(true);
    const t = setTimeout(() => {
      setPillCount(0);
      setPillLeaving(false);
    }, NEW_POSTS_FADE_MS);
    return () => clearTimeout(t);
    // Driven by newCount alone; pillCount is read as it is at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newCount]);

  // Spec §8: the pill goes, the feed glides to the top, and the first page is
  // fetched in the background. Nothing on screen is cleared: the posts not
  // already shown go on top (matched by id) and slide in; the ones already
  // shown take the fresh copy in place (same key, so no remount); every page
  // loaded below stays, so the cursor and infinite scroll carry on. A failure
  // leaves the list as it is and says so in the toast.
  const actions = usePostActions();
  const showNewPosts = async () => {
    setNewCount(0);
    if (inPanel) scroller?.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
    if (fetchingNew.current) return;
    fetchingNew.current = true;
    try {
      const page = await getFeed(kind, { country, sort, cursor: null });
      if (!alive.current) return;
      const fresh = new Map(page.items.map((p) => [p.id, p]));
      const seen = new Set(itemsRef.current.map((p) => p.id));
      const added = page.items.filter((p) => !seen.has(p.id));
      setItems((prev) => {
        const known = new Set(prev.map((p) => p.id));
        return [
          ...added.filter((p) => !known.has(p.id)),
          ...prev.map((p) => (fresh.has(p.id) ? { ...p, ...fresh.get(p.id) } : p)),
        ];
      });
      // Merged, never replaced: taking the mark off a post that already slid
      // in would start its ordinary entrance again.
      setArrived((prev) => ({ ...prev, ...Object.fromEntries(added.map((p, i) => [p.id, i])) }));
    } catch {
      if (alive.current) actions?.showToast?.(NEW_POSTS_FAILED);
    } finally {
      fetchingNew.current = false;
    }
  };

  const hidden = actions?.hidden;
  const shown = useMemo(
    () => applyPatches(items, patches).filter((p) => !hidden?.has(p.id)),
    [items, patches, hidden],
  );
  const shownRef = useRef(shown);
  shownRef.current = shown;
  // Stable, so a memoised PostCard re-renders only when its own post changes.
  // A reply isn't in this list: it gets no `before` and keeps its own count.
  const react = useCallback(
    (postId, emoji) => onReact(postId, emoji, shownRef.current.find((p) => p.id === postId)),
    [onReact],
  );

  // A reply deleted from its ⋯ menu (or put back when that fails): this
  // feed's copy of the parent's 💬 count follows at once.
  useReplyCounts((parentId, delta) => setItems((prev) => withReplyCount(prev, parentId, delta)));

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
  const loadReplies = useCallback((postId, from) => getReplies(postId, from), []);

  const composerProps = {
    feed: kind,
    countryName,
    viewer,
    showAvatar: !inPanel, // on a laptop the avatar is the one on the divider
    onSubmit: createPost,
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
      {/* Takes no room: a zero-height sticky layer the pill floats in (§8). */}
      {pillCount > 0 && (
        <div className={styles.newPostsRow}>
          <button
            type="button"
            className={`${styles.newPosts} ${pillLeaving ? styles.newPostsLeaving : ""}`}
            onClick={showNewPosts}
            tabIndex={pillLeaving ? -1 : undefined}
          >
            <ArrowUp size={16} aria-hidden="true" />
            {pillCount} new {pillCount === 1 ? "post" : "posts"}
          </button>
        </div>
      )}
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
          {shown.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              index={i}
              showCampus={kind !== "campus"}
              canReply={canPost === true}
              onReact={react}
              onReply={startReply}
              loadReplies={loadReplies}
              loadProfile={loadProfile}
              addedReplies={addedReplies[p.id]}
              arriving={arrived[p.id] ?? null}
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
        <div className={`${styles.dock} ${styles.dockFloat} ${accent}`}>{dock}</div>
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
