/**
 * Back-to-origin navigation helper.
 *
 * The root layout renders a `<Slot/>`, so `router.back()` from a stacked detail
 * screen re-mounts the tab group at its initial route (Marketplace) instead of
 * where the user actually came from. To go back precisely, each screen that
 * opens a detail passes its own href as a `from` query param; the detail's back
 * button then does `router.replace(from)` to return exactly there.
 *
 * `from` is URL-encoded, so it round-trips even when it itself carries a nested
 * `from` — e.g. Marketplace → product → seller profile → back → product → back →
 * Marketplace keeps every hop.
 */
export function hrefWithFrom(path: string, from?: string | null): string {
  if (!from) return path;
  // The path may already carry a query (e.g. /chat/:id?productId=…).
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}from=${encodeURIComponent(from)}`;
}
