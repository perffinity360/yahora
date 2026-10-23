import { useQuery } from '@tanstack/react-query';

import { api, type ApiError } from '../lib/api';
import type { PublicProfileData } from '../types';

/**
 * The API won't show this person to this viewer, or there is no such person
 * (Phase 6B identity rule, backend/API.md). A demo account asking for a real
 * student gets 404 USER_NOT_FOUND; 401 LOGIN_REQUIRED can't happen here because
 * the app always sends a token, but it means the same thing. Only an answer
 * from our own API counts (`fromApi`) — a bare 404 from a proxy is a network
 * problem, not a statement about the person.
 */
export function isProfileUnavailable(error: unknown): boolean {
  const err = error as ApiError | null;
  return !!err?.fromApi && (err.status === 404 || err.status === 401);
}

/**
 * Read-only profile view (how a user appears to others). The viewer comes from
 * the token, which is also what `is_liked` / `is_saved` on each listing belong
 * to. `?user_id=` is no longer sent: the API ignores it since Phase 6B N-C,
 * because letting the caller name the viewer was an IDOR (runbook §1.4).
 * Disabled until the route param resolves.
 *
 * An unavailable profile is not retried — asking again gets the same answer,
 * and the retries would hold the skeleton on screen for seconds first.
 */
export function usePublicProfile(profileUserId: string | null | undefined) {
  return useQuery({
    queryKey: ['publicProfile', profileUserId],
    queryFn: () => api.get<PublicProfileData>(`/api/user/${profileUserId}/public`),
    enabled: !!profileUserId,
    retry: (failureCount, error) => !isProfileUnavailable(error) && failureCount < 2,
  });
}
