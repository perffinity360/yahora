import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { ProductDetailData, ProductDetailWire } from '../types';

/**
 * Full product detail (GET /api/products/:id): product + seller + comment thread
 * + the viewer's like/save state. The visitor id (from `useAuth`) is what lets
 * the backend attach `is_liked`/`is_saved`; it's appended only when known so the
 * URL never carries a literal `user_id=undefined`.
 *
 * Shares the `['product', id]` cache key with `useProduct` (Sell edit prefill)
 * and with the like/save mutations in `useProductActions`, which optimistically
 * flip this same cached object. Note: this endpoint increments the server-side
 * view counter, so callers should avoid needless refetches (the detail like/save
 * toggles pass `invalidateOnSettle: false` for exactly this reason).
 *
 * ── COMMENTS ARE UNWRAPPED HERE ─────────────────────────────────────────────
 * Phase 4 Block N-B turned `product.comments` from an array into a paged
 * envelope (`{ items, next_cursor }`). CommentThread and the detail screen call
 * `.filter()` / `.map()` straight on it, so left alone that is a crash on open,
 * not an empty list.
 *
 * It is flattened back to an array before it reaches the cache, which keeps one
 * cache shape shared with `useProduct` and keeps the optimistic vote patches in
 * `useComments` working unchanged. Phase 5 reads `next_cursor` here for "load
 * earlier comments".
 */
export function useProductDetail(productId: string | undefined) {
  const { profile } = useAuth();
  const visitorId = profile?.id;

  return useQuery({
    queryKey: ['product', productId],
    queryFn: () => {
      const query = visitorId ? `?user_id=${visitorId}` : '';
      return api
        .get<{ product: ProductDetailWire }>(`/api/products/${productId}${query}`)
        .then((r) => unwrapComments(r.product));
    },
    enabled: !!productId,
  });
}

/**
 * Flatten the paged `comments` envelope into the plain array the rest of the
 * app expects. Tolerates all three shapes it could meet: the envelope, a bare
 * array (an older backend), and absent.
 */
export function unwrapComments(product: ProductDetailWire): ProductDetailData {
  const raw = product.comments;
  const comments = Array.isArray(raw) ? raw : (raw?.items ?? []);
  return { ...product, comments };
}
