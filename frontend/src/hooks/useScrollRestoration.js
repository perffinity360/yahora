import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/* ────────── ONE PLACE THAT KEEPS YOUR SCROLL POSITION, APP-WIDE ──────────
 *
 * The bug: open a product, go to Messages, press Back, and you land on the
 * footer. Same from Marketplace → "List New Item" → Back, and anywhere else a
 * page re-fetches its content after Back.
 *
 * Why: with `history.scrollRestoration = "auto"` the browser restores the old
 * offset the instant Back fires. But every page here mounts EMPTY (a loader)
 * and fetches. A 1200px offset on a 900px-tall loading page is clamped to the
 * bottom of that page, which is the footer, and the browser never tries again
 * once the real content arrives.
 *
 * The fix: switch the browser's restoration off and do it here.
 *
 *   SAVE     Every scroll records `window.scrollY` for the history entry it
 *            happened in, keyed by React Router's per-entry key
 *            (`history.state.key`, the same value as `location.key`). Kept in
 *            sessionStorage, so it survives a reload and dies with the tab.
 *   RESTORE  On a POP (Back/Forward, or a reload) the page is held at the top,
 *            showing its loader rather than the footer. Once the page is back
 *            to (about) the height it had when the offset was saved, i.e. its
 *            real content is in, it jumps there instantly. "Tall enough to
 *            hold the offset" is NOT the test: on a phone the footer stacks
 *            tall enough that a loading screen often passes it. Restoring then
 *            puts the student inside the footer, and when the content arrives
 *            above it, the browser's scroll anchoring keeps the footer on screen.
 *            Waiting stops on the student's first wheel, touch, key or click,
 *            or after RESTORE_TIMEOUT_MS. Either way it never yanks them away
 *            from where they chose to scroll.
 *   FORWARD  A PUSH/REPLACE to a new path starts at the top, as before.
 *
 * Saving is paused from the moment Back fires until the restore settles.
 * Otherwise the scroll events from the old page still on screen, from clamping
 * while the new page loads, and from the restore itself would overwrite the
 * offset we are about to restore.
 */

const STORAGE_KEY = "yahora_scroll_positions";
const ENTRY_STATE_KEY = "yahora_history_entry_state";
const MAX_ENTRIES = 100;
const RESTORE_TIMEOUT_MS = 10_000;
/* How close to its saved height the page must be before the offset is
   restored. Saved heights wobble a little (an image not decoded yet, a
   relative timestamp that wraps differently), so not 100%. A loading screen is
   nowhere near: on a phone it is ~60% of a short product page. */
const READY_HEIGHT_RATIO = 0.9;
const ABORT_EVENTS = ["wheel", "touchstart", "keydown", "mousedown"];

let positions = loadPositions(STORAGE_KEY);
/** Per-entry UI state for useHistoryEntryState: { [entryKey]: { [name]: value } } */
let entryState = loadPositions(ENTRY_STATE_KEY);
forgetFreshEntry();
let persistTimer = null;
/** Saves are paused while this is set: { key, finish(scrollToTop), restoring }.
 *  `restoring` is false for the short hold between popstate and the restore. */
let pending = null;
/** Entry key whose restore a page has declined (see declineScrollRestore). */
let declinedKey = null;

function loadPositions(storageKey) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistPositions() {
  persistTimer = null;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
    sessionStorage.setItem(ENTRY_STATE_KEY, JSON.stringify(entryState));
  } catch {
    // Private mode / storage full. Positions still work for this page's life.
  }
}

/* The first entry of a page load has no router key (`location.key` is
   "default"), and every full load in the tab gets one. Keyed by path so a
   hard load of /marketplace can't pick up the offset saved on /product/x. */
function keyFor(routerKey, pathname) {
  return routerKey && routerKey !== "default" ? routerKey : `default:${pathname}`;
}

function entryKey() {
  return keyFor(window.history.state?.key, window.location.pathname);
}

/* A reload or a Back into the tab should come back to the same spot, but a
   fresh visit (typed URL, link from outside) starts at the top like any page. */
function forgetFreshEntry() {
  const type = performance.getEntriesByType?.("navigation")?.[0]?.type;
  if (type === "reload" || type === "back_forward") return;
  delete positions[entryKey()];
  delete entryState[entryKey()];
}

/** Re-inserts so key order is oldest-first, then trims the oldest entries. */
function putNewest(map, key, value) {
  delete map[key];
  map[key] = value;
  const keys = Object.keys(map);
  for (let i = 0; i < keys.length - MAX_ENTRIES; i++) delete map[keys[i]];
}

/** A saved entry: { y, h } (offset, and document height when it was taken). */
function record(key, y) {
  putNewest(positions, key, {
    y: Math.round(y),
    h: document.documentElement.scrollHeight,
  });
  if (!persistTimer) persistTimer = setTimeout(persistPositions, 250);
}

// `behavior: "instant"`, never the two-argument form: that one defers to CSS
// `scroll-behavior`, and Bootstrap sets it to smooth (see global.css).
function scrollToY(y) {
  window.scrollTo({ top: y, left: 0, behavior: "instant" });
}

function maxScroll() {
  return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
}

/** Abandons a restore in progress. `scrollToTop` lands the page at the top. */
export function cancelScrollRestore({ scrollToTop = false } = {}) {
  pending?.finish(scrollToTop);
}

/**
 * For a page that knows the saved offset no longer points at the same content,
 * e.g. Marketplace coming back to an unfiltered feed when the student had
 * filtered it. The page lands at the top instead of a random spot. Safe to call
 * from a child's layout effect, which runs BEFORE the restore starts in App's.
 */
export function declineScrollRestore() {
  declinedKey = entryKey();
  if (pending?.restoring) pending.finish(true);
}

function startRestore(key) {
  cancelScrollRestore();
  if (declinedKey === key) {
    declinedKey = null;
    scrollToY(0);
    return;
  }
  const saved = positions[key];
  const target = saved?.y ?? 0;
  const readyHeight = (saved?.h ?? 0) * READY_HEIGHT_RATIO;

  let observer = null;
  let timer = null;
  const finish = (toTop) => {
    if (pending !== state) return;
    pending = null;
    observer?.disconnect();
    clearTimeout(timer);
    ABORT_EVENTS.forEach((type) =>
      window.removeEventListener(type, onUserInput, true),
    );
    if (toTop) scrollToY(0);
  };
  const onUserInput = () => finish(false);
  const state = { key, finish, restoring: true };
  pending = state;

  const attempt = () => {
    const ready =
      target === 0 ||
      (target <= maxScroll() &&
        document.documentElement.scrollHeight >= readyHeight);
    if (ready) {
      scrollToY(target);
      finish(false);
      return true;
    }
    return false;
  };

  if (attempt()) return;

  // Content not in yet: show the top (the loader), not a clamped footer.
  scrollToY(0);
  observer = new ResizeObserver(attempt);
  observer.observe(document.body);
  timer = setTimeout(() => finish(false), RESTORE_TIMEOUT_MS);
  ABORT_EVENTS.forEach((type) =>
    window.addEventListener(type, onUserInput, { capture: true, passive: true }),
  );
}

export default function useScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const lastPathRef = useRef(null);

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    const onScroll = () => {
      if (!pending) record(entryKey(), window.scrollY);
    };
    // Pauses saving from the moment Back fires, so scroll events from the old
    // page (still on screen if React Router renders the change in a
    // transition) can't land on the entry we are returning to. React Router's
    // own popstate listener was registered first and can commit the new route
    // synchronously, in which case the restore below has ALREADY started for
    // this entry by the time this runs. Leave that one alone.
    const onPopState = () => {
      if (pending?.restoring && pending.key === entryKey()) return;
      cancelScrollRestore();
      const hold = {
        key: entryKey(),
        finish: () => {
          if (pending === hold) pending = null;
        },
      };
      pending = hold;
      // Safety net: if no route change follows this popstate, resume saving.
      setTimeout(hold.finish, 1000);
    };
    const onPageHide = () => {
      clearTimeout(persistTimer);
      persistPositions();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pagehide", onPageHide);
      window.history.scrollRestoration = previous;
    };
  }, []);

  // Before paint, so neither the jump to the top nor the restore flashes.
  useLayoutEffect(() => {
    const pathChanged = lastPathRef.current !== location.pathname;
    lastPathRef.current = location.pathname;

    if (navigationType === "POP") {
      startRestore(keyFor(location.key, location.pathname));
    } else {
      cancelScrollRestore();
      declinedKey = null;
      if (pathChanged) scrollToY(0);
    }
  }, [location.key, location.pathname, navigationType]);
}

/**
 * useState that comes back with its old value when the student returns to this
 * history entry (Back/Forward, reload), and starts from `initialValue` on any
 * new visit.
 *
 * Restoring the scroll offset is only half the job on pages that have more
 * than one view. Dashboard and PublicProfile switch between an intro view and
 * a listings view (and Dashboard between tabs) in component state, which
 * resets when Back remounts the page. The offset then lands in the wrong view,
 * often on the footer. Keep that state here instead and it is already right on
 * the first render, before the restore runs.
 *
 * Values must be JSON-serialisable.
 */
export function useHistoryEntryState(name, initialValue) {
  const location = useLocation();
  const key = keyFor(location.key, location.pathname);
  const [value, setValue] = useState(() =>
    entryState[key] && name in entryState[key] ? entryState[key][name] : initialValue,
  );

  useEffect(() => {
    putNewest(entryState, key, { ...entryState[key], [name]: value });
    clearTimeout(persistTimer);
    persistPositions();
  }, [key, name, value]);

  return [value, setValue];
}
