import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/** Long enough for a busy JS thread to drain the routing queue. */
const LEAVE_GUARD_MS = 2000;

/**
 * Runs a screen's way out at most once.
 *
 * `router.back()`, `dismiss()` and `replace()` don't navigate when called: they
 * queue the action, and expo-router runs the queue in an effect after the next
 * render. Until then `router.canGoBack()` still answers for the old history. So
 * a second back in that window (a double tap on the arrow, the arrow and the
 * system back together, or any back on a phone whose JS thread is busy) passes
 * the same check and queues a second GO_BACK. That one pops the screen
 * underneath too, or finds nothing left and logs "The action 'GO_BACK' was not
 * handled by any navigator" (26 Oct, Samsung).
 *
 * The guard lifts when the screen is focused again, and after LEAVE_GUARD_MS
 * in case the leave never happened, so the back button can't go dead.
 */
export function useLeaveOnce() {
  const leaving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      leaving.current = false;
    }, []),
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback((leave: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      leaving.current = false;
    }, LEAVE_GUARD_MS);
    leave();
  }, []);
}
