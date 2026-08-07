import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';

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
 */

type ListingLike = { id: string; is_liked?: boolean; is_saved?: boolean; likes_count?: number };
type Flip = (item: ListingLike) => ListingLike;

/** Flip the matching item wherever the cached feed keeps its array. Spread
 *  preserves every other field at runtime, so the concrete row shape is kept. */
function patchCachedListing(data: unknown, productId: string, flip: Flip): unknown {
  if (!data || typeof data !== 'object') return data;
  // Product-detail cache (`['product', id]`) is a single listing object, not a
  // feed — flip it in place so a like on the detail screen updates instantly.
  const single = data as ListingLike;
  if (single.id === productId) return flip(single);
  const feed = data as { products?: ListingLike[]; listings?: ListingLike[] };
  if (Array.isArray(feed.products)) {
    return { ...feed, products: feed.products.map((p) => (p.id === productId ? flip(p) : p)) };
  }
  if (Array.isArray(feed.listings)) {
    return { ...feed, listings: feed.listings.map((l) => (l.id === productId ? flip(l) : l)) };
  }
  return data;
}

function useListingToggle(
  queryKey: QueryKey,
  makeRequest: (productId: string, visitorId: string) => Promise<unknown>,
  flip: Flip,
  // Feeds reconcile with the server by refetching on settle. The product-detail
  // cache opts out (`false`): its GET re-increments the view counter, so a like
  // must not trigger a refetch. The optimistic flip mirrors the server exactly.
  invalidateOnSettle = true,
) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const visitorId = profile?.id;

  return useMutation({
    mutationFn: (vars: { productId: string }) => {
      if (!visitorId) return Promise.reject(new Error('Please sign in first.'));
      return makeRequest(vars.productId, visitorId);
    },
    onMutate: async (vars): Promise<{ prev: unknown }> => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (data) => patchCachedListing(data, vars.productId, flip));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(queryKey, ctx.prev);
    },
    onSettled: invalidateOnSettle
      ? () => queryClient.invalidateQueries({ queryKey })
      : undefined,
  });
}

const flipLike: Flip = (item) => ({
  ...item,
  is_liked: !item.is_liked,
  likes_count: Math.max(0, (item.likes_count ?? 0) + (item.is_liked ? -1 : 1)),
});

const flipSave: Flip = (item) => ({ ...item, is_saved: !item.is_saved });

export function useToggleLike(queryKey: QueryKey, invalidateOnSettle = true) {
  return useListingToggle(
    queryKey,
    (productId, visitorId) => api.post(`/api/products/${productId}/like`, { user_id: visitorId }),
    flipLike,
    invalidateOnSettle,
  );
}

export function useToggleSave(queryKey: QueryKey, invalidateOnSettle = true) {
  return useListingToggle(
    queryKey,
    (productId, visitorId) => api.post(`/api/products/${productId}/save`, { user_id: visitorId }),
    flipSave,
    invalidateOnSettle,
  );
}
