import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import type { DashboardData } from '../types';

/**
 * Fetches the account hub payload (profile + listings + purchases) for a user.
 * Disabled until a `userId` is known so it never fires with `undefined`.
 */
export function useDashboard(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['dashboard', userId],
    queryFn: () => api.get<DashboardData>(`/api/user/${userId}/dashboard`),
    enabled: !!userId,
  });
}
