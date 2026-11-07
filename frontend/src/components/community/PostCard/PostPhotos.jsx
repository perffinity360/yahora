// frontend/src/components/community/PostCard/PostPhotos.jsx
//
// Spec §3 "Photos": one photo at a time, like Instagram. The frame takes the
// first photo's shape (kept between 4:5 and 16:9), at most 480 × 380, and each
// photo shows whole inside it (object-fit: contain) over a soft blur of
// itself, so a photo of another shape never gets cropped or sits on bare bars.
//
//   · more than one: swipe or scroll sideways (scroll-snap), or press the
//     chevrons, or ← → once it has focus; dots show where you are;
//   · pressing a photo opens the image viewer at that photo, as before.

import React, { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./PostCard.module.css";

const MIN_RATIO = 4 / 5;
const MAX_RATIO = 16 / 9;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function PostPhotos({ urls, authorName, onOpen }) {
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);
  // The frame's shape is only known once the first photo loads; until then a
  // 4:3 box keeps the post from jumping by more than a little.
  const [ratio, setRatio] = useState(4 / 3);
  const count = urls.length;

  const go = useCallback((i) => {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.min(Math.max(i, 0), count - 1);
    track.scrollTo({ left: next * track.clientWidth, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [count]);

  const onScroll = () => {
    const track = trackRef.current;
    if (track?.clientWidth) setIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  const onKeyDown = (e) => {
    if (count < 2) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    }
  };

  return (
    <div
      className={styles.carousel}
      style={{ aspectRatio: String(ratio) }}
      role={count > 1 ? "group" : undefined}
      aria-roledescription={count > 1 ? "carousel" : undefined}
      aria-label={count > 1 ? `${count} photos` : undefined}
      onKeyDown={onKeyDown}
    >
      <div ref={trackRef} className={styles.track} onScroll={onScroll}>
        {urls.map((url, i) => (
          <button
            key={url + i}
            type="button"
            className={styles.slide}
            aria-label={count > 1 ? `Open photo ${i + 1} of ${count}` : "Open the photo"}
            onClick={() => onOpen(i)}
          >
            <img src={url} alt="" aria-hidden="true" loading="lazy" decoding="async" className={styles.slideBlur} />
            <img
              src={url}
              alt={`Photo ${i + 1} from ${authorName}`}
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              className={styles.slidePhoto}
              onLoad={
                i === 0
                  ? (e) => {
                      const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                      if (w && h) setRatio(Math.min(Math.max(w / h, MIN_RATIO), MAX_RATIO));
                    }
                  : undefined
              }
            />
          </button>
        ))}
      </div>

      {count > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              className={`${styles.chevron} ${styles.chevronPrev}`}
              aria-label="Previous photo"
              onClick={() => go(index - 1)}
            >
              <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
          {index < count - 1 && (
            <button
              type="button"
              className={`${styles.chevron} ${styles.chevronNext}`}
              aria-label="Next photo"
              onClick={() => go(index + 1)}
            >
              <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
          <div className={styles.dots} aria-hidden="true">
            {urls.map((url, i) => (
              <span key={url + i} className={`${styles.dot} ${i === index ? styles.dotOn : ""}`} />
            ))}
          </div>
          <span className={styles.srOnly} aria-live="polite">
            Photo {index + 1} of {count}
          </span>
        </>
      )}
    </div>
  );
}
