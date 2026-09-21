// frontend/src/components/InfiniteScrollSentinel/InfiniteScrollSentinel.jsx
//
// The bottom-of-list element that useInfiniteScroll watches, plus the small
// spinner shown while the next page is on its way.
//
// Render it only while there are more pages. Once `next_cursor` comes back null
// the caller stops rendering this entirely — there is deliberately no
// "end of list" message on either surface.

import React from "react";
import styles from "./InfiniteScrollSentinel.module.css";

export default function InfiniteScrollSentinel({
  sentinelRef,
  loading = false,
  label = "Loading more",
}) {
  return (
    <>
      {/* Kept empty and separate from the spinner: the observer's target must
          not change size when the spinner mounts, or attaching the spinner
          could itself scroll the sentinel out of view mid-fetch. */}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
      {loading && (
        <div className={styles.spinnerRow} role="status" aria-label={label}>
          <span className={styles.spinner} />
        </div>
      )}
    </>
  );
}
