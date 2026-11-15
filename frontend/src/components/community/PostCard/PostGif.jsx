// frontend/src/components/community/PostCard/PostGif.jsx
//
// Spec §3 "GIF": plays muted and on a loop while on screen, pauses when it
// scrolls away, and carries a small GIF badge.
//
// A GifRef's `url` is the provider's small animated rendition. A video
// rendition (.mp4 / .webm) is paused for real. An animated image can't be
// paused, so off screen it shows `preview_url`, the still frame, instead —
// the browser then stops decoding the animation.
//
// The frame takes the shape of the GIF as it actually loads, with no ground of
// its own behind it, so it never shows a strip at its edges (owner, 13 Nov).
// The provider's width × height is only the first guess: some renditions come
// back a few pixels off it, and the frame's tint used to show in the gap.

import React, { useEffect, useRef, useState } from "react";
import styles from "./PostCard.module.css";

const isVideo = (url) => /\.(mp4|webm)(\?|#|$)/i.test(url ?? "");

export default function PostGif({ gif }) {
  const ref = useRef(null);
  const [onScreen, setOnScreen] = useState(false);
  const video = isVideo(gif.url);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return undefined;
    }
    // root: null watches the viewport, which also covers a panel scroller:
    // a GIF scrolled out of its panel is out of the viewport too.
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      threshold: 0.25,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!video) return;
    const el = ref.current?.querySelector("video");
    if (!el) return;
    if (onScreen) el.play().catch(() => {});
    else el.pause();
  }, [onScreen, video]);

  const [loadedRatio, setLoadedRatio] = useState(null);
  const ratio = loadedRatio ?? (gif.width > 0 && gif.height > 0 ? gif.width / gif.height : 1);
  const still = gif.preview_url || gif.url;
  const takeShape = (w, h) => {
    if (w > 0 && h > 0) setLoadedRatio(w / h);
  };

  return (
    <div ref={ref} className={styles.gif} style={{ aspectRatio: ratio, "--gif-ratio": ratio }}>
      {video ? (
        <video
          className={styles.gifMedia}
          src={gif.url}
          poster={gif.preview_url || undefined}
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => takeShape(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
          aria-label="GIF"
        />
      ) : (
        <img
          className={styles.gifMedia}
          src={onScreen ? gif.url : still}
          alt="GIF"
          decoding="async"
          onLoad={(e) => takeShape(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
        />
      )}
      <span className={styles.gifBadge} aria-hidden="true">
        GIF
      </span>
    </div>
  );
}
