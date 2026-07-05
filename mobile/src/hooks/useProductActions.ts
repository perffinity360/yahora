import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { PublicProfileData } from '../types';

/**
 * Visitor-side like/save toggles for a public profile's listings, with
 * optimistic cache updates so taps feel instant on slow campus networks:
 * cancel in-flight fetches → snapshot → flip in cache → rollback on error →
 * reconcile with the server on settle.
 */

type Ctx = { prev?: PublicProfileData };

function usePublicListingToggle(
  profileUserId: string | null | undefined,
  makeRequest: (productId: string, visitorId: string) => Promise<unknown>,
  applyFlip: (
    listing: PublicProfileData['listings'][number],
  ) => PublicProfileData['listings'][number],
) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const visitorId = profile?.id;
  const key = ['publicProfile', profileUserId] as const;

  return useMutation({
    mutationFn: (vars: { productId: string }) => {
      if (!visitorId) return Promise.reject(new Error('Please sign in first.'));
      return makeRequest(vars.productId, visitorId);
    },
    onMutate: async (vars): Promise<Ctx> => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<PublicProfileData>(key);
      queryClient.setQueryData<PublicProfileData>(key, (data) =>
        data
          ? {
              ...data,
              listings: data.listings.map((l) => (l.id === vars.productId ? applyFlip(l) : l)),
            }
          : data,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useToggleLike(profileUserId: string | null | undefined) {
  return usePublicListingToggle(
    profileUserId,
    (productId, visitorId) => api.post(`/api/products/${productId}/like`, { user_id: visitorId }),
    (l) => ({
      ...l,
      is_liked: !l.is_liked,
      likes_count: Math.max(0, (l.likes_count ?? 0) + (l.is_liked ? -1 : 1)),
    }),
  );
}

export function useToggleSave(profileUserId: string | null | undefined) {
  return usePublicListingToggle(
    profileUserId,
    (productId, visitorId) => api.post(`/api/products/${productId}/save`, { user_id: visitorId }),
    (l) => ({ ...l, is_saved: !l.is_saved }),
  );
}
