// frontend/src/hooks/useInfiniteScroll.js
//
// Shared "load the next page when the bottom comes into view" hook for the web
// client. Phase 5 Block N-B — the marketplace grid and the product comment list
// both use it.
//
// The browser has no onEndReached, so the trigger is an IntersectionObserver
// watching an empty sentinel element the caller renders at the bottom of the
// list (see components/InfiniteScrollSentinel).
//
// ── THE TWO THINGS THIS HOOK EXISTS TO GET RIGHT ─────────────────────────────
//
// 1. NO DOUBLE FETCH. While a page request is in flight there is no observer at
//    all — the effect below bails before constructing one — so the callback
//    cannot fire a second time for a page that is already on its way. This is
//    the structural guard; each caller also keeps its own in-flight ref around
//    the fetch itself, because a page can be requested from somewhere other
//    than the observer.
//
// 2. IT DOES NOT STALL. IntersectionObserver reports *transitions*, not "is
//    currently visible". If a page arrives and the appended rows are not tall
//    enough to push the sentinel back out of the viewport, no transition ever
//    happens and the list dies one page in. Rebuilding the observer when
//    `isLoading` goes false fixes that: observing a target always delivers an
//    initial observation, so a sentinel that is still on screen fires again
//    immediately and the next page is requested.
//
// `rootMargin` starts the fetch a little before the sentinel is actually
// visible, so the next page is usually already in place by the time the user
// scrolls to it.

import { useCallback, useEffect, useRef, useState } from "react";

export default function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = "400px",
}) {
  // The sentinel node lives in state, not a ref: attaching it has to re-run the
  // effect below, and a ref assignment does not re-render.
  const [sentinel, setSentinel] = useState(null);

  // Held in a ref so an inline arrow function from the caller doesn't tear the
  // observer down and rebuild it on every single render.
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!sentinel) return;
    // Nothing left to fetch — see note 1 above for the isLoading bail.
    if (!hasMore || isLoading) return;
    // jsdom and very old browsers. Without the guard the page would throw on
    // mount rather than simply not auto-paging.
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMoreRef.current();
        }
      },
      { rootMargin },
    );

    observer.observe(sentinel);

    // Runs on unmount and before every rebuild, so no observer outlives the
    // element it was watching.
    return () => observer.disconnect();
  }, [sentinel, hasMore, isLoading, rootMargin]);

  // Callback ref for the caller to spread onto its sentinel element.
  return useCallback((node) => setSentinel(node ?? null), []);
}
