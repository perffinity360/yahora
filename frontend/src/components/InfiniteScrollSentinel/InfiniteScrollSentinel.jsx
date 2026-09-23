// frontend/src/components/InfiniteScrollSentinel/InfiniteScrollSentinel.jsx
//
// The end-of-list element that useInfiniteScroll watches, plus the small
// spinner shown while the next page is on its way.
//
// Render it only while there are more pages. Once `next_cursor` comes back null
// the caller stops rendering this entirely — there is deliberately no
// "end of list" message on any surface.
//
// Phase 5 Block N-C added `reserveSpace`, for a list that pages UPWARDS.
// Everything below the spinner moves when the spinner mounts; in a downward
// list that is off-screen under the fold and nobody sees it, but in the chat
// thread it is the entire conversation, and it jumps the moment the fetch
// starts. With `reserveSpace` the row is always in the layout and only its
// contents appear, so starting a fetch changes no heights at all.

import React from "react";
import styles from "./InfiniteScrollSentinel.module.css";

export default function InfiniteScrollSentinel({
  sentinelRef,
  loading = false,
  label = "Loading more",
  reserveSpace = false,
}) {
  return (
    <>
      {/* Kept empty and separate from the spinner: the observer's target must
          not change size when the spinner mounts, or attaching the spinner
          could itself scroll the sentinel out of view mid-fetch. */}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      {(loading || reserveSpace) && (
        <div
          className={`${styles.spinnerRow} ${reserveSpace ? styles.spinnerRowReserved : ""}`}
          role="status"
          aria-label={loading ? label : undefined}
        >
          {loading && <span className={styles.spinner} />}
        </div>
      )}
    </>
  );
}
