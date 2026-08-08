import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { ProductDetailData } from '../types';

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
 */
export function useProductDetail(productId: string | undefined) {
  const { profile } = useAuth();
  const visitorId = profile?.id;

  return useQuery({
    queryKey: ['product', productId],
    queryFn: () => {
      const query = visitorId ? `?user_id=${visitorId}` : '';
      return api
        .get<{ product: ProductDetailData }>(`/api/products/${productId}${query}`)
        .then((r) => r.product);
    },
    enabled: !!productId,
  });
}
