import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

/**
 * Visitor-side like/save toggles that optimistically patch a listing inside a
 * cached feed — powering both the public profile (`['publicProfile', id]`, whose
 * items live under `.listings`) and the marketplace (`['marketplace', uniId]`,
 * items under `.products`). Pass the query key to update; the flip finds the
 * right array either way. Cancel in-flight fetches → snapshot → flip in cache →
 * rollback on error → reconcile on settle, so taps feel instant on slow campus
 * networks but never drift from the backend.
 *
 * ── WHY THE SERVER'S ANSWER IS WRITTEN INTO EVERY CACHE ─────────────────────
 * `POST /like` and `POST /save` are blind TOGGLES: the server flips whatever it
 * has, whatever the button showed. The same listing lives in several caches at
 * once — the marketplace, the product detail screen, a public profile, the
 * dashboard — and a toggle used to patch only the cache of the screen it was
 * tapped on. The detail screen does not even refetch (see `invalidateOnSettle`).
 *
 * So: like a listing on its detail screen, go back, and the marketplace card —
 * still inside its 5-minute staleTime — shows the OLD state. Tap it and the
 * server flips the other way from what the heart promised; the card then snaps
 * back on refetch. That was "the like button only works after a reload".
 *
 * The response carries the state AFTER the toggle (`is_liked` / `is_saved`),
 * which is the truth. On success it is written into every cached copy of the
 * listing, so no screen is ever left holding a stale heart to toggle from.
 */

type ListingLike = { id: string; is_liked?: boolean; is_saved?: boolean; likes_count?: number };
type Patch = (item: ListingLike) => ListingLike;
type ToggleKind = 'like' | 'save';
/** The body both toggle endpoints answer with: the state after the toggle. */
type ToggleResult = { is_liked?: boolean; is_saved?: boolean } | undefined;

/**
 * Apply `patch` to the matching item wherever the cached payload keeps it.
 * Spread preserves every other field at runtime, so the concrete row shape is
 * kept. Returns `data` itself when nothing matched, so running this across
 * every cache does not re-render screens that never showed the listing.
 */
function patchCachedListing(data: unknown, productId: string, patch: Patch): unknown {
  if (!data || typeof data !== 'object') return data;
  // Product-detail cache (`['product', id]`) is a single listing object, not a
  // feed — patch it in place so a like on the detail screen updates instantly.
  const single = data as ListingLike;
  if (single.id === productId) return patch(single);
  const feed = data as { products?: ListingLike[]; listings?: ListingLike[] };
  for (const field of ['products', 'listings'] as const) {
    const list = feed[field];
    if (!Array.isArray(list)) continue;
    const i = list.findIndex((p) => p?.id === productId);
    if (i === -1) return data;
    const next = list.slice();
    next[i] = patch(list[i]);
    return { ...feed, [field]: next };
  }
  return data;
}

/** Set the like state outright (not flip it), moving the count only if it changed. */
const setLiked =
  (liked: boolean): Patch =>
  (item) =>
    item.is_liked === liked
      ? item
      : {
          ...item,
          is_liked: liked,
          likes_count: Math.max(0, (item.likes_count ?? 0) + (liked ? 1 : -1)),
        };

const setSaved =
  (saved: boolean): Patch =>
  (item) =>
    item.is_saved === saved ? item : { ...item, is_saved: saved };

/**
 * Write the server's post-toggle state into EVERY cached copy of the listing —
 * see the header. Exported for the dashboard's owner-side toggles, which keep
 * their own mutation but must leave the other screens just as consistent.
 */
export function syncListingEverywhere(
  queryClient: QueryClient,
  productId: string,
  kind: ToggleKind,
  result: ToggleResult,
) {
  const value = kind === 'like' ? result?.is_liked : result?.is_saved;
  if (typeof value !== 'boolean') return;
  const patch = kind === 'like' ? setLiked(value) : setSaved(value);
  queryClient.setQueriesData({}, (data: unknown) => patchCachedListing(data, productId, patch));
}

function useListingToggle(
  kind: ToggleKind,
  queryKey: QueryKey,
  // Feeds reconcile with the server by refetching on settle. The product-detail
  // cache opts out (`false`): its GET re-increments the view counter, so a like
  // must not trigger a refetch. `syncListingEverywhere` makes it exact anyway.
  invalidateOnSettle = true,
) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const visitorId = profile?.id;
  const mutationKey = ['listing-toggle', kind];

  const flip: Patch = (item) =>
    kind === 'like' ? setLiked(!item.is_liked)(item) : setSaved(!item.is_saved)(item);

  return useMutation({
    mutationKey,
    mutationFn: (vars: { productId: string }) => {
      if (!visitorId) return Promise.reject(new Error('Please sign in first.'));
      return api.post<ToggleResult>(`/api/products/${vars.productId}/${kind}`, {
        user_id: visitorId,
      });
    },
    onMutate: async (vars): Promise<{ prev: unknown }> => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (data) => patchCachedListing(data, vars.productId, flip));
      return { prev };
    },
    onSuccess: (result, vars) => {
      // A double tap sends two toggles. The first answer is already out of date
      // by the time it lands, and writing it would flash the heart back for a
      // moment — leave it to the LAST toggle for this listing to settle the
      // state. (This mutation is still pending while its onSuccess runs.)
      const inFlight = queryClient
        .getMutationCache()
        .findAll({ mutationKey, status: 'pending' })
        .filter((m) => (m.state.variables as { productId?: string })?.productId === vars.productId);
      if (inFlight.length > 1) return;
      syncListingEverywhere(queryClient, vars.productId, kind, result);
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(queryKey, ctx.prev);
    },
    onSettled: invalidateOnSettle
      ? () => queryClient.invalidateQueries({ queryKey })
      : undefined,
  });
}

export function useToggleLike(queryKey: QueryKey, invalidateOnSettle = true) {
  return useListingToggle('like', queryKey, invalidateOnSettle);
}

export function useToggleSave(queryKey: QueryKey, invalidateOnSettle = true) {
  return useListingToggle('save', queryKey, invalidateOnSettle);
}
