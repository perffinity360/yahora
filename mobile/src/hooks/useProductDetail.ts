import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';

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
 * Each page is flattened back to an array before it reaches the cache, and
 * `select` joins the pages into ONE product whose `comments` is the plain array
 * CommentThread has always read. Threading is untouched: the server returns
 * every reply on the same page as its top-level comment (API.md), so the
 * joined array holds each thread whole, exactly as one big response would.
 *
 * ── INFINITE SCROLL (Phase 5 V-E) ──────────────────────────────────────────
 * `useInfiniteQuery`. Page one is the whole product plus the newest 20
 * top-level questions; `fetchNextPage()` re-requests the product with
 * `?cursor=<comments.next_cursor>` for the next 20. `next_cursor: null` is the
 * end, and the only end signal.
 *
 * ⚠ Every page is a full GET /api/products/:id, and that endpoint adds a view
 * each time — so reading older questions inflates `views`. Known, backend-side
 * (Neeraj flagged the same on the web, CHANGELOG 2026-09-20); not fixable here.
 *
 * ⚠ The cache holds `InfiniteData`, so this key can no longer be shared with a
 * plain `useQuery`. `useProduct` (the Sell edit prefill) reads its own
 * `['product', id, 'edit']` for that reason. Writers into this cache — the
 * like/save toggles (useProductActions) and the comment add/vote patches
 * (useComments) — walk `pages`.
 */
export function useProductDetail(productId: string | undefined) {
  const { profile } = useAuth();
  const visitorId = profile?.id;

  return useInfiniteQuery({
    queryKey: ['product', productId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }): Promise<ProductDetailPage> => {
      const params = new URLSearchParams();
      if (visitorId) params.append('user_id', visitorId);
      if (pageParam) params.append('cursor', pageParam);
      const query = params.toString();
      return api
        .get<{ product: ProductDetailWire }>(`/api/products/${productId}${query ? `?${query}` : ''}`)
        .then((r) => ({
          ...unwrapComments(r.product),
          commentsNextCursor: r.product.comments?.next_cursor ?? null,
        }));
    },
    getNextPageParam: (lastPage) => lastPage.commentsNextCursor ?? undefined,
    select: joinPages,
    enabled: !!productId,
  });
}

/**
 * One cached page: the product exactly as `unwrapComments` leaves it, plus the
 * cursor for the page after it. A page IS a product object on purpose — the
 * like/save patch recognises a listing by its `id`, so it works on every page
 * without knowing this hook exists.
 */
export type ProductDetailPage = ProductDetailData & { commentsNextCursor: string | null };

/**
 * The newest page's product fields (it is the one the patches keep current),
 * with every loaded page's comments, newest page first — the order a single
 * response would have had. Module scope so `select` keeps a stable identity.
 */
function joinPages(data: InfiniteData<ProductDetailPage>): ProductDetailData {
  const [first] = data.pages;
  return { ...first, comments: data.pages.flatMap((page) => page.comments) };
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
