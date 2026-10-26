import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api, type ApiError } from '../lib/api';
import type { DashboardData, ProductListing, SoldBuyer } from '../types';
import { syncListingEverywhere } from './useProductActions';

/**
 * Owner-side listing mutations for the dashboard (like / save / mark sold /
 * mark available / delete), plus the buyer's "That wasn't me". Each cancels in-flight dashboard fetches,
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

  const toggleLike = useMutation({
    mutationFn: (vars: { id: string; isLiked: boolean }) =>
      api.post(`/api/products/${vars.id}/like`, { user_id: userId }),
    onMutate: async (vars) => {
      const ctx = await begin();
      patchListing(vars.id, (p) => ({
        ...p,
        is_liked: !vars.isLiked,
        likes_count: Math.max(0, (p.likes_count ?? 0) + (vars.isLiked ? -1 : 1)),
      }));
      return ctx;
    },
    // The same listing may be cached by the marketplace or a detail screen;
    // see syncListingEverywhere for why they must all hear the answer.
    onSuccess: (result, vars) =>
      syncListingEverywhere(queryClient, vars.id, 'like', result as { is_liked?: boolean }),
    onError: rollback,
    onSettled: reconcile,
  });

  const toggleSave = useMutation({
    mutationFn: (vars: { id: string; isSaved: boolean }) =>
      api.post(`/api/products/${vars.id}/save`, { user_id: userId }),
    onMutate: async (vars) => {
      const ctx = await begin();
      patchListing(vars.id, (p) => ({ ...p, is_saved: !vars.isSaved }));
      return ctx;
    },
    onSuccess: (result, vars) =>
      syncListingEverywhere(queryClient, vars.id, 'save', result as { is_saved?: boolean }),
    onError: rollback,
    onSettled: reconcile,
  });

  /* A sale shows in more places than the dashboard: the product page (the
     seller's banner, MARK_SOLD_SPEC §2) and the seller's public profile (§5).
     Marked stale, they fetch again the next time they are on screen. */
  const refreshSaleEverywhere = (id: string) => {
    queryClient.invalidateQueries({ queryKey: ['product', id] });
    queryClient.invalidateQueries({ queryKey: ['publicProfile', userId] });
  };

  /* Mark as sold, and Change buyer (calling it again changes the buyer and
     keeps the first sold_at). `buyerId` null = "Someone not on Yahora".
     `buyer` is only for the card to show the name before the server answers. */
  const markSold = useMutation({
    mutationFn: (vars: { id: string; buyerId: string | null; buyer?: SoldBuyer | null }) =>
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
    onSuccess: (_result, vars) => refreshSaleEverywhere(vars.id),
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
    onSuccess: (_result, vars) => refreshSaleEverywhere(vars.id),
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

  return { toggleLike, toggleSave, markSold, markAvailable, deleteProduct, removePurchase };
}
