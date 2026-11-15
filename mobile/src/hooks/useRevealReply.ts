import { createContext, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { ViewInstance } from 'react-native';

import { onComposeResult } from './useCommunity';

/**
 * After a student sends a reply, it shows first under its post and the screen
 * takes them to it (owner, 13 Nov). The order is the cache's
 * (useCreatePost puts it first); this brings it on screen.
 *
 * The screen holding the list calls `useRevealReply` and wraps its list in
 * `ReplyRevealContext`. The thread's ReplyRow for that reply hands its view to
 * `reveal`, which measures it against the screen's frame and scrolls only as
 * far as needed to clear the floating chrome above (`insetTop`) and below
 * (`insetBottom`). Both are measured with measureInWindow, so the Android
 * status-bar offset is in both and cancels out.
 *
 * Only for the author: it follows their own compose result.
 */
export type ReplyReveal = { id: string | null; reveal: (node: ViewInstance | null) => void };
export const ReplyRevealContext = createContext<ReplyReveal | null>(null);

/** Room left between the reply and the chrome around it. */
const MARGIN = 12;
/** Lets the list lay the new row out, and the compose screen start to close. */
const SETTLE_MS = 250;

export function useRevealReply({
  accepts,
  frameRef,
  insetTop,
  insetBottom,
  scrollBy,
}: {
  /** Whether this screen shows the post with this id. */
  accepts: (parentId: string) => boolean;
  /** The screen's own frame: the visible area the list scrolls in. */
  frameRef: RefObject<ViewInstance | null>;
  insetTop: number;
  insetBottom: number;
  /** Scroll the list by `dy` (positive: further down the list). */
  scrollBy: (dy: number) => void;
}): ReplyReveal {
  const [id, setId] = useState<string | null>(null);
  const latest = useRef({ accepts, insetTop, insetBottom, scrollBy });
  latest.current = { accepts, insetTop, insetBottom, scrollBy };

  useEffect(
    () =>
      onComposeResult((result) => {
        if (result.kind !== 'posted') return;
        const parentId = result.post.parent_post_id;
        if (parentId && latest.current.accepts(parentId)) setId(result.post.id);
      }),
    [],
  );

  const reveal = useCallback(
    (node: ViewInstance | null) => {
      setId(null); // once
      if (!node) return;
      setTimeout(() => {
        node.measureInWindow((_x, y, _w, h) => {
          frameRef.current?.measureInWindow((_fx, fy, _fw, fh) => {
            const { insetTop: top, insetBottom: bottom, scrollBy: by } = latest.current;
            const visTop = fy + top + MARGIN;
            const visBottom = fy + fh - bottom - MARGIN;
            let dy = 0;
            if (y < visTop) dy = y - visTop;
            // Too low: up until its bottom clears, but never past its top.
            else if (y + h > visBottom) dy = Math.min(y + h - visBottom, y - visTop);
            if (Math.abs(dy) > 1) by(dy);
          });
        });
      }, SETTLE_MS);
    },
    [frameRef],
  );

  return useMemo(() => ({ id, reveal }), [id, reveal]);
}
