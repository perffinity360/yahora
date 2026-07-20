import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import type { Product } from '../types';

/**
 * Fetches a single listing (for the Sell screen's edit-mode prefill). Scoped by
 * the viewer's id so the backend can attach interaction state; disabled until
 * both ids are known so it never fires with `undefined` in the URL.
 */
export function useProduct(productId: string | undefined, userId: string | null | undefined) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: () =>
      api.get<{ product: Product }>(`/api/products/${productId}?user_id=${userId}`),
    enabled: !!productId && !!userId,
    select: (data) => data.product,
  });
}
