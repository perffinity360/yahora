import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { MarketplaceProduct } from '../types';

/**
 * The campus marketplace feed — every `available` listing for `universityId`,
 * newest first (the server returns them all; FlashList virtualizes). The
 * viewer's id rides along so the backend can attach `is_liked` / `is_saved`.
 * Disabled until a university is known. Campus switching (4-iv) just passes a
 * different `universityId`, which re-keys the cache.
 */
export function useMarketplaceFeed(universityId: string | null | undefined) {
  const { profile } = useAuth();
  const visitorId = profile?.id;

  return useQuery({
    queryKey: ['marketplace', universityId],
    queryFn: () => {
      const params = new URLSearchParams({ university_id: String(universityId) });
      if (visitorId) params.append('user_id', visitorId);
      return api.get<{ products: MarketplaceProduct[] }>(`/api/products?${params.toString()}`);
    },
    enabled: !!universityId,
  });
}
