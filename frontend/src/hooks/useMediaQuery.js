// frontend/src/hooks/useMediaQuery.js
//
// Whether a CSS media query matches right now, kept live as it changes.
//
// ⚠ frontend/CLAUDE.md §18: a width query may pick a LAYOUT, never words or
// features. The Community page uses it to mount one of its two layouts
// (panels or switcher) instead of both, so the two feeds don't each load,
// page and hold state twice. Both layouts offer the same features.

import { useCallback, useSyncExternalStore } from "react";

export default function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
