// frontend/src/components/ImageLightbox/ImageLightbox.jsx
//
// ⚠ Added by Vishwajeet (17 Sep 2026) on request, in Neeraj's `frontend/`.
// The product page had no way to look closely at a photo — only prev/next and
// thumbnails — while the mobile app got pinch-to-zoom the same day. This keeps
// the two clients level. Self-contained on purpose: ProductDetail.jsx only
// gained a click handler and one render line, so the change there is small
// enough to review at a glance.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import styles from "./ImageLightbox.module.css";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const CLICK_ZOOM_SCALE = 2.5;
const WHEEL_STEP = 0.0015;
const BUTTON_STEP = 0.5;
/** A swipe at fit must travel this far (px) before it changes photo. */
const SWIPE_DISTANCE = 60;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * Full-screen photo viewer with zoom and pan.
 *
 *   · wheel / trackpad pinch — zoom toward the pointer
 *   · two-finger pinch       — zoom (touch screens)
 *   · click the photo        — toggle fit ↔ 2.5x, centred on where you clicked
 *   · drag                   — pan when zoomed; at fit, swipe to change photo
 *   · + / − / reset buttons  — for anyone without a wheel or a trackpad
 *   · ← / → keys, ‹ › buttons — change photo
 *   · Esc, ×, click outside  — close (outside only closes at fit, so a missed
 *                              drag while inspecting does not dismiss it)
 *
 * ⚠ THERE IS DELIBERATELY NO DOUBLE-CLICK, and clicks are hit-tested by
 * COORDINATES rather than by `e.target`.
 *
 * `onPointerDown` calls `setPointerCapture` on the stage, and browsers do not
 * agree on what that does to the compatibility mouse events: the click may be
 * retargeted to the capture element (the stage) instead of the <img> under the
 * cursor. Either way the old double-click never fired — retargeted, the first
 * click matched `e.target === e.currentTarget` and closed the viewer before a
 * second one could land; not retargeted, `dblclick` on the stage was competing
 * with a capture that had already claimed the sequence.
 *
 * So the handler below does not ask WHICH element was clicked. It asks whether
 * the click landed inside the photo's bounding box, which is true in both
 * browsers and stays true while zoomed, since the box grows with the scale.
 * Inside the photo → zoom; outside it, at fit → close.
 *
 * Do not add `onDoubleClick` back: with click-zoom live, a double click would
 * zoom in and then straight back out.
 *
 * Pan is clamped to the photo's overhang at the current zoom, so it can never
 * be dragged off screen and lost. Every photo change and every open starts at
 * fit — a zoom level belongs to the photo it was set on.
 */
export default function ImageLightbox({ images, startIndex = 0, alt = "", onClose }) {
  const count = images?.length ?? 0;
  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const stageRef = useRef(null);
  const imgRef = useRef(null);
  // Active pointers, for pinch. Keyed by pointerId.
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  /** Whether the pointer sequence that just ended travelled — see onClick. */
  const lastGestureMoved = useRef(false);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const goTo = useCallback(
    (next) => {
      if (count < 2) return;
      setIndex((next + count) % count);
      resetView();
    },
    [count, resetView],
  );

  /** The largest pan that still keeps the photo covering its own frame. */
  const clampOffset = useCallback((x, y, s) => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const maxX = Math.max((img.offsetWidth * s - img.offsetWidth) / 2, 0);
    const maxY = Math.max((img.offsetHeight * s - img.offsetHeight) / 2, 0);
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }, []);

  const zoomTo = useCallback(
    (nextScale, focus) => {
      const s = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      if (s === MIN_SCALE) {
        resetView();
        return;
      }
      // Computed from the current values and set once each. Not nested state
      // updaters: React StrictMode runs updaters twice in development, and an
      // offset updater inside a scale updater applied the zoom ratio twice —
      // the photo lurched past the cursor on every wheel tick.
      let next = { x: offset.x, y: offset.y };
      if (focus && stageRef.current) {
        // Zoom toward the focus point (the cursor), so what is under it stays
        // under it — the thing people expect from a wheel zoom.
        const rect = stageRef.current.getBoundingClientRect();
        const fx = focus.x - (rect.left + rect.width / 2);
        const fy = focus.y - (rect.top + rect.height / 2);
        const ratio = s / scale;
        next = { x: fx - (fx - offset.x) * ratio, y: fy - (fy - offset.y) * ratio };
      }
      setScale(s);
      setOffset(clampOffset(next.x, next.y, s));
    },
    [clampOffset, offset.x, offset.y, resetView, scale],
  );

  // Keyboard, and lock the page behind the overlay so wheel-zoom does not also
  // scroll the product page underneath.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goTo(index - 1);
      else if (e.key === "ArrowRight") goTo(index + 1);
      else if (e.key === "+" || e.key === "=") zoomTo(scale + BUTTON_STEP);
      else if (e.key === "-") zoomTo(scale - BUTTON_STEP);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [goTo, index, onClose, scale, zoomTo]);

  // A non-passive wheel listener: React's onWheel is passive, so it cannot
  // preventDefault, and without that the browser zooms the whole page on a
  // trackpad pinch instead of the photo.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      zoomTo(scale * (1 - e.deltaY * WHEEL_STEP * (e.ctrlKey ? 4 : 1)), {
        x: e.clientX,
        y: e.clientY,
      });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [scale, zoomTo]);

  const onPointerDown = (e) => {
    stageRef.current?.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: "pinch",
        startDistance: Math.hypot(a.x - b.x, a.y - b.y),
        startScale: scale,
      };
    } else if (pointers.current.size === 1) {
      gesture.current = {
        kind: "drag",
        startX: e.clientX,
        startY: e.clientY,
        startOffset: offset,
      };
      setDragging(true);
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;

    if (g.kind === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo(g.startScale * (distance / g.startDistance), {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      });
      return;
    }

    if (g.kind === "drag" && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 4) {
      g.moved = true;
    }

    if (g.kind === "drag" && scale > MIN_SCALE) {
      setOffset(
        clampOffset(
          g.startOffset.x + (e.clientX - g.startX),
          g.startOffset.y + (e.clientY - g.startY),
          scale,
        ),
      );
    }
  };

  const onPointerUp = (e) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);

    // At fit, a horizontal drag is a swipe between photos.
    if (g?.kind === "drag" && scale === MIN_SCALE) {
      const dx = e.clientX - g.startX;
      if (Math.abs(dx) > SWIPE_DISTANCE) goTo(dx < 0 ? index + 1 : index - 1);
    }

    if (pointers.current.size === 0) {
      lastGestureMoved.current = Boolean(g?.moved) || g?.kind === "pinch";
      gesture.current = null;
      setDragging(false);
    }
  };

  if (count === 0) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={alt ? `${alt} — photo viewer` : "Photo viewer"}
      // Closing on the backdrop only at fit: while zoomed, a click that lands
      // outside the photo is almost always the end of a pan, not a dismissal.
      onClick={(e) => {
        if (e.target === e.currentTarget && scale === MIN_SCALE) onClose();
      }}
    >
      <div className={styles.topBar}>
        {count > 1 && (
          <span className={styles.counter}>
            {index + 1} / {count}
          </span>
        )}
        <div className={styles.tools}>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => zoomTo(scale - BUTTON_STEP)}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
          >
            <ZoomOut size={18} />
          </button>
          <span className={styles.zoomLevel} aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={() => zoomTo(scale + BUTTON_STEP)}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
          >
            <ZoomIn size={18} />
          </button>
          <button
            type="button"
            className={styles.toolBtn}
            onClick={resetView}
            disabled={scale === MIN_SCALE}
            aria-label="Reset zoom"
          >
            <RotateCcw size={16} />
          </button>
          <button type="button" className={styles.toolBtn} onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className={`${styles.stage} ${scale > MIN_SCALE ? styles.zoomed : ""} ${dragging ? styles.dragging : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          // A click that ended a pan or a pinch is not a click — without this
          // guard, letting go of a drag collapses the zoom being used.
          if (lastGestureMoved.current) return;

          const rect = imgRef.current?.getBoundingClientRect();
          const onPhoto =
            !!rect &&
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom;

          if (onPhoto) {
            // Click the photo to zoom in on that spot; click again to fit.
            if (scale > MIN_SCALE) resetView();
            else zoomTo(CLICK_ZOOM_SCALE, { x: e.clientX, y: e.clientY });
          } else if (scale === MIN_SCALE) {
            // Empty space beside the photo, at fit: a request to close. While
            // zoomed it is almost always the end of a pan, so it is ignored.
            onClose();
          }
        }}
      >
        <img
          ref={imgRef}
          key={images[index]}
          src={images[index]}
          alt={count > 1 ? `${alt} — photo ${index + 1} of ${count}` : alt}
          className={styles.image}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        />
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navPrev}`}
            onClick={() => goTo(index - 1)}
            aria-label="Previous photo"
          >
            <ChevronLeft size={26} />
          </button>
          <button
            type="button"
            className={`${styles.navBtn} ${styles.navNext}`}
            onClick={() => goTo(index + 1)}
            aria-label="Next photo"
          >
            <ChevronRight size={26} />
          </button>
        </>
      )}

      <p className={styles.hint}>
        {scale > MIN_SCALE
          ? "Drag to look around · click the photo to fit"
          : "Click the photo, scroll or pinch to zoom"}
      </p>
    </div>
  );
}
