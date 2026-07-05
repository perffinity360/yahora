import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import type { PublicProfileData } from '../types';

/**
 * Read-only profile view (how a user appears to others). The visitor's own id
 * is passed along so the backend can attach `is_liked` / `is_saved` to each
 * listing. Disabled until the route param resolves.
 */
export function usePublicProfile(profileUserId: string | null | undefined) {
  const { profile } = useAuth();
  const visitorId = profile?.id;

  return useQuery({
    queryKey: ['publicProfile', profileUserId],
    queryFn: () =>
      api.get<PublicProfileData>(
        `/api/user/${profileUserId}/public${visitorId ? `?user_id=${visitorId}` : ''}`,
      ),
    enabled: !!profileUserId,
  });
}
