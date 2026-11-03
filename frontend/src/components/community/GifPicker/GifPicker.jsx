// frontend/src/components/community/GifPicker/GifPicker.jsx
//
// The GIF picker — docs/design/COMMUNITY_SPEC.md §6: a search box, trending
// first, 3 columns, more as you scroll, and the required "Powered by KLIPY".
// All behaviour is in hooks/useGifSearch.js; this file is only the look.
//
// It draws the picker's card. Where it floats is the caller's choice: the
// composer pins it to its GIF button with the community Popover, the dev
// sandbox shows it inline.

import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import InfiniteScrollSentinel from "../../InfiniteScrollSentinel/InfiniteScrollSentinel";
import useGifSearch from "../../../hooks/useGifSearch";
import useInfiniteScroll from "../../../hooks/useInfiniteScroll";
import styles from "./GifPicker.module.css";

export default function GifPicker({ onPick, onClose }) {
  const { query, setQuery, isSearch, items, loading, error, hasMore, loadMore, retry } =
    useGifSearch();
  const inputRef = useRef(null);
  const [scroller, setScroller] = useState(null);

  const sentinelRef = useInfiniteScroll({
    hasMore: hasMore && !error,
    isLoading: loading,
    onLoadMore: loadMore,
    root: scroller,
    rootMargin: "200px",
  });

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className={styles.picker}
      role="dialog"
      aria-label="Choose a GIF"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose?.();
        }
      }}
    >
      <div className={styles.searchRow}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIFs"
            aria-label="Search GIFs"
            className={styles.searchInput}
          />
        </label>
        {onClose && (
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <div ref={setScroller} className={styles.results}>
        {error ? (
          <div className={styles.message} role="alert">
            <p>GIFs aren't available right now.</p>
            <button type="button" className={styles.retry} onClick={retry}>
              Try again
            </button>
          </div>
        ) : items.length === 0 && loading ? (
          <div className={styles.grid} aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={styles.tileSkeleton} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className={styles.message}>{isSearch ? "No GIFs found." : ""}</p>
        ) : (
          <div className={styles.grid}>
            {items.map((gif) => (
              <button
                key={gif.id}
                type="button"
                className={styles.tile}
                onClick={() => onPick(gif)}
                aria-label="Choose this GIF"
              >
                <img src={gif.preview_url} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}

        {!error && items.length > 0 && hasMore && (
          <InfiniteScrollSentinel sentinelRef={sentinelRef} loading={loading} label="Loading more GIFs" />
        )}
      </div>

      {/* Required by KLIPY's terms (runbook §1.9). Never remove it. */}
      <p className={styles.credit}>Powered by KLIPY</p>
    </div>
  );
}
