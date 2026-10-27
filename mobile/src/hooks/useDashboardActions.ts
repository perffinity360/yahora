import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { api, type ApiError } from '../lib/api';
import type { DashboardData, Paged, ProductListing, SaleParty } from '../types';

/**
 * Owner-side listing mutations for the dashboard (mark sold / mark available /
 * delete), plus the buyer's "That wasn't me". Liking your own listing is not
 * here: the dashboard uses the shared `useToggleLike` (useProductActions), which
 * guards double taps and tells every other screen. Each cancels in-flight dashboard fetches,
 * optimistically patches the cached `['dashboard', userId]` payload, rolls
 * back on error, and reconciles with the server on settle — so the grid feels
 * instant on slow campus networks but never drifts from the backend.
 */

type Ctx = { prev?: DashboardData };

export function useDashboardActions(userId: string | null | undefined) {
  const queryClient = useQueryClient();
  const key = ['dashboard', userId] as const;

  const patchListing = (id: string, updater: (p: ProductListing) => ProductListing) =>
    queryClient.setQueryData<DashboardData>(key, (prev) =>
      prev ? { ...prev, listings: prev.listings.map((p) => (p.id === id ? updater(p) : p)) } : prev,
    );

  const removeListing = (id: string) =>
    queryClient.setQueryData<DashboardData>(key, (prev) =>
      prev ? { ...prev, listings: prev.listings.filter((p) => p.id !== id) } : prev,
    );

  const begin = async (): Promise<Ctx> => {
    await queryClient.cancelQueries({ queryKey: key });
    return { prev: queryClient.getQueryData<DashboardData>(key) };
  };

  const rollback = (_e: unknown, _v: unknown, ctx: Ctx | undefined) => {
    if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
  };

  const reconcile = () => queryClient.invalidateQueries({ queryKey: key });

  /* A sale shows in more places than the dashboard: the product page (the
     seller's banner, MARK_SOLD_SPEC §2) and the seller's public profile (§5).
     Marked stale, they fetch again the next time they are on screen.

     The marketplace feed holds available listings only (§6). A sold one is
     taken out of every cached page at once, with no request: refetching the
     whole loaded feed would move the grid under the student. A relisted one
     comes back with the feed's next refresh. */
  const refreshSaleEverywhere = (id: string, sold: boolean) => {
    queryClient.invalidateQueries({ queryKey: ['product', id] });
    queryClient.invalidateQueries({ queryKey: ['publicProfile', userId] });
    if (sold) {
      queryClient.setQueriesData<InfiniteData<Paged<{ id: string }>>>(
        { queryKey: ['marketplace'] },
        (data) =>
          data?.pages.some((page) => page?.items?.some((p) => p.id === id))
            ? {
                ...data,
                pages: data.pages.map((page) =>
                  page?.items ? { ...page, items: page.items.filter((p) => p.id !== id) } : page,
                ),
              }
            : data,
      );
    } else {
      queryClient.invalidateQueries({ queryKey: ['marketplace'], refetchType: 'none' });
    }
  };

  /* Mark as sold, and Change buyer (calling it again changes the buyer and
     keeps the first sold_at). `buyerId` null = "Someone off Yahora".
     `buyer` is only for the card to show the name before the server answers. */
  const markSold = useMutation({
    mutationFn: (vars: { id: string; buyerId: string | null; buyer?: SaleParty | null }) =>
      api.post(`/api/products/${vars.id}/sold`, { buyer_id: vars.buyerId }),
    onMutate: async (vars) => {
      const ctx = await begin();
      patchListing(vars.id, (p) => ({
        ...p,
        status: 'sold',
        sold_at: p.sold_at ?? new Date().toISOString(),
        buyer: vars.buyerId ? (vars.buyer ?? p.buyer ?? null) : null,
      }));
      return ctx;
    },
    onSuccess: (_result, vars) => refreshSaleEverywhere(vars.id, true),
    onError: rollback,
    onSettled: reconcile,
  });

  const markAvailable = useMutation({
    mutationFn: (vars: { id: string }) => api.post(`/api/products/${vars.id}/available`, {}),
    onMutate: async (vars) => {
      const ctx = await begin();
      patchListing(vars.id, (p) => ({ ...p, status: 'available', sold_at: null, buyer: null }));
      return ctx;
    },
    onSuccess: (_result, vars) => refreshSaleEverywhere(vars.id, false),
    onError: rollback,
    onSettled: reconcile,
  });

  /* "That wasn't me" (MARK_SOLD_SPEC §4): the buyer takes themselves off a
     listing. It stays sold; the card leaves their purchases at once. */
  const removePurchase = useMutation({
    mutationFn: (vars: { productId: string }) => api.del(`/api/products/${vars.productId}/purchase`),
    onMutate: async (vars) => {
      const ctx = await begin();
      queryClient.setQueryData<DashboardData>(key, (prev) =>
        prev
          ? { ...prev, purchases: prev.purchases.filter((p) => p.product.id !== vars.productId) }
          : prev,
      );
      return ctx;
    },
    onError: rollback,
    onSettled: reconcile,
  });

  const deleteProduct = useMutation({
    mutationFn: (vars: { id: string }) => api.del(`/api/products/${vars.id}`),
    onMutate: async (vars) => {
      const ctx = await begin();
      removeListing(vars.id);
      return ctx;
    },
    // PURCHASE_NOT_FOUND: already removed (a retry, or another device). Done, not failed.
    onError: (e, v, ctx) => {
      if ((e as ApiError)?.body?.error !== 'PURCHASE_NOT_FOUND') rollback(e, v, ctx);
    },
    onSettled: reconcile,
  });

  return { markSold, markAvailable, deleteProduct, removePurchase };
}
