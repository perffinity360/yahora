import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import type { ProductDetailWire } from '../types';
import { unwrapComments } from './useProductDetail';

/**
 * Fetches a single listing (for the Sell screen's edit-mode prefill). Scoped by
 * the viewer's id so the backend can attach interaction state; disabled until
 * both ids are known so it never fires with `undefined` in the URL.
 *
 * Caches the *unwrapped* product under `['product', id, 'edit']` — its own key.
 * It used to share `['product', id]` with `useProductDetail`, but since Phase 5
 * V-E that one is an infinite query holding pages, and a plain `useQuery` on
 * the same key would read (and write) the wrong shape. The Sell screen's
 * `invalidateQueries({ queryKey: ['product', edit] })` still reaches both,
 * because it matches by prefix.
 *
 * It reuses `unwrapComments` so a product has one shape wherever it is read.
 */
export function useProduct(productId: string | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: ['product', productId, 'edit'],
    queryFn: () =>
      api
        .get<{ product: ProductDetailWire }>(`/api/products/${productId}?user_id=${userId}`)
        .then((r) => unwrapComments(r.product)),
    enabled: !!productId && !!userId,
  });
}
