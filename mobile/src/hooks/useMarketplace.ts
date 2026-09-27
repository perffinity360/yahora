import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';

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
 * ── INFINITE SCROLL (Phase 5 V-E) ────────────────────────────────────────────
 * `useInfiniteQuery`: the cache holds the pages exactly as the server sent them
 * (`{ items, next_cursor }`), and `fetchNextPage()` sends the last page's
 * `next_cursor` back as `?cursor=`. `next_cursor: null` is the end of the feed
 * and the ONLY end signal — a short or empty page is not one.
 *
 * `select` flattens the pages into `{ products, nextCursor }`, so the screen and
 * the filters hook still read `data.products` exactly as before. The optimistic
 * like/save patch in useProductActions writes to the CACHE, not to this
 * flattened view, so it walks `pages[].items` — see `patchCachedListing`.
 *
 * Filters and search run on the loaded products, in the client (the endpoint
 * takes none). A filter that leaves the grid short keeps loading pages through
 * the list's own end-reached handler until it fills or the feed ends.
 */
export function useMarketplaceFeed(universityId: string | null | undefined) {
  const { profile } = useAuth();
  const visitorId = profile?.id;

  return useInfiniteQuery({
    queryKey: ['marketplace', universityId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ university_id: String(universityId) });
      if (visitorId) params.append('user_id', visitorId);
      if (pageParam) params.append('cursor', pageParam);
      return api.get<Paged<MarketplaceProduct>>(`/api/products?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage?.next_cursor ?? undefined,
    select: flattenFeed,
    enabled: !!universityId,
  });
}

/**
 * The pages, as the one feed every caller reads. `?? []` so a malformed or
 * older response yields an empty page rather than crashing the screen on
 * `undefined.length`. Module scope so `select` keeps a stable identity.
 */
function flattenFeed(data: InfiniteData<Paged<MarketplaceProduct>>) {
  return {
    products: data.pages.flatMap((page) => page?.items ?? []),
    nextCursor: data.pages[data.pages.length - 1]?.next_cursor ?? null,
  };
}
