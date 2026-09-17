import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import type { ProductDetailWire } from '../types';
import { unwrapComments } from './useProductDetail';

/**
 * Fetches a single listing (for the Sell screen's edit-mode prefill). Scoped by
 * the viewer's id so the backend can attach interaction state; disabled until
 * both ids are known so it never fires with `undefined` in the URL.
 *
 * Caches the *unwrapped* product under `['product', id]` so it shares one cache
 * shape with `useProductDetail` (which uses the same key). The backend always
 * returns seller + comments on this endpoint, so the detail screen can safely
 * read a cache this hook populated, and vice-versa.
 *
 * That shared key is why this reuses `unwrapComments`: the two hooks write the
 * same cache entry, so if only one of them flattened the paged `comments`
 * envelope (Block N-B), the detail screen would crash or not depending on which
 * screen you happened to open first.
 */
export function useProduct(productId: string | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: () =>
      api
        .get<{ product: ProductDetailWire }>(`/api/products/${productId}?user_id=${userId}`)
        .then((r) => unwrapComments(r.product)),
    enabled: !!productId && !!userId,
  });
}
