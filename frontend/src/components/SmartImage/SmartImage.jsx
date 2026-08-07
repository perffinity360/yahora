import React, { useEffect, useRef, useState } from "react";

/**
 * A drop-in <img> replacement that survives the short window right after a
 * fresh upload where a Supabase Storage URL isn't yet servable from the CDN.
 *
 * Without this, a just-uploaded avatar renders as a broken image and only
 * appears after a manual page refresh (by which point the CDN has caught up).
 * Here, a load error schedules a retry of the same URL with a short backoff,
 * cache-busting each attempt so the browser re-requests instead of replaying a
 * cached error — the picture "hot reloads" into place on its own.
 *
 * The cache-bust param is display-only: `src` (what callers store or submit)
 * is never mutated. Any extra props (style, className, width, …) pass straight
 * through to the underlying <img>.
 */
const MAX_RETRIES = 6;
const RETRY_BASE_MS = 500;

const SmartImage = ({ src, alt = "", retryOnError = true, onError, ...rest }) => {
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef(null);

  // A new src is a brand-new image — cancel any pending retry and start over.
  useEffect(() => {
    setAttempt(0);
    return () => clearTimeout(timerRef.current);
  }, [src]);

  if (!src) return null;

  // blob:/data: sources are already on-device: a cache-bust query would corrupt
  // the URL and retrying can't recover a revoked blob, so leave them untouched.
  const local = src.startsWith("blob:") || src.startsWith("data:");

  // First paint uses the clean URL; retries append a cache-buster so the
  // browser re-requests instead of serving the cached error response.
  const displaySrc =
    attempt === 0 || local
      ? src
      : `${src}${src.includes("?") ? "&" : "?"}cb=${attempt}`;

  const handleError = (e) => {
    if (retryOnError && !local && attempt < MAX_RETRIES) {
      timerRef.current = setTimeout(
        () => setAttempt((a) => a + 1),
        RETRY_BASE_MS * (attempt + 1),
      );
    } else if (onError) {
      onError(e);
    }
  };

  return <img {...rest} src={displaySrc} alt={alt} onError={handleError} />;
};

export default SmartImage;
