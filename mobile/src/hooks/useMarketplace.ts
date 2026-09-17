import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { MarketplaceProduct, Paged } from '../types';

/**
 * The campus marketplace feed for `universityId`, newest first. The viewer's id
 * rides along so the backend can attach `is_liked` / `is_saved`. Disabled until
 * a university is known. Campus switching (4-iv) just passes a different
 * `universityId`, which re-keys the cache.
 *
 * ── THE ENVELOPE, AND WHY THIS HOOK UNWRAPS IT ──────────────────────────────
 * Phase 4 Block N-B (Neeraj, 2026-09-15) made this endpoint cursor-paginated,
 * and the response key changed with it:
 *
 *     before   { products: [ ... ] }
 *     now      { items: [ ... ], next_cursor: "..." }
 *
 * Reading `.products` off that returns `undefined`, which is not an error — it
 * is an empty marketplace on a campus that has listings, with nothing in the
 * logs. That is exactly what happened locally on 2026-09-15.
 *
 * The unwrap happens HERE, not in the screen, so this file stays the only place
 * in the app that knows the wire shape. Everything downstream — the screen, the
 * filters hook, the optimistic like/save patches in useProductActions — keeps
 * reading `data.products`, which is also why this returns that name rather than
 * `items`: it is a feed of products, `items` is just the envelope's word for it.
 *
 * ⚠ ONE PAGE ONLY. The server now returns at most 20 (max 50) and this hook
 * ignores `next_cursor`. On a campus with more than 20 listings the rest are
 * not reachable until infinite scroll lands in Phase 5 — which plugs in here,
 * by switching this to `useInfiniteQuery` and feeding `next_cursor` back as
 * `?cursor=`. `nextCursor` is returned already so the caller can tell whether
 * there is more behind it.
 */
export function useMarketplaceFeed(universityId: string | null | undefined) {
  const { profile } = useAuth();
  const visitorId = profile?.id;

  return useQuery({
    queryKey: ['marketplace', universityId],
    queryFn: () => {
      const params = new URLSearchParams({ university_id: String(universityId) });
      if (visitorId) params.append('user_id', visitorId);
      return api
        .get<Paged<MarketplaceProduct>>(`/api/products?${params.toString()}`)
        .then((page) => ({
          // `?? []` so a malformed or older response yields an empty feed
          // rather than crashing the screen on `undefined.length`.
          products: page?.items ?? [],
          nextCursor: page?.next_cursor ?? null,
        }));
    },
    enabled: !!universityId,
  });
}
