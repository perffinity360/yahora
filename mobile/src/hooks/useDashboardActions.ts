import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../lib/api';
import type { DashboardData, ProductListing } from '../types';

/**
 * Owner-side listing mutations for the dashboard (like / save / mark sold /
 * mark available / delete). Each cancels in-flight dashboard fetches,
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
    onError: rollback,
    onSettled: reconcile,
  });

  // TODO: optional buyer selection (web's "who did you sell to?" picker) once
  // messaging lands on mobile — for now the sale is recorded off-platform.
  const markSold = useMutation({
    mutationFn: (vars: { id: string }) => api.post(`/api/products/${vars.id}/sold`, {}),
    onMutate: async (vars) => {
      const ctx = await begin();
      patchListing(vars.id, (p) => ({ ...p, status: 'sold' }));
      return ctx;
    },
    onError: rollback,
    onSettled: reconcile,
  });

  const markAvailable = useMutation({
    mutationFn: (vars: { id: string }) => api.post(`/api/products/${vars.id}/available`, {}),
    onMutate: async (vars) => {
      const ctx = await begin();
      patchListing(vars.id, (p) => ({ ...p, status: 'available' }));
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
    onError: rollback,
    onSettled: reconcile,
  });

  return { toggleLike, toggleSave, markSold, markAvailable, deleteProduct };
}
