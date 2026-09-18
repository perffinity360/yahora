import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';

export interface AcademicOption {
  id: string;
  name: string;
}

// Academic lists rarely change, so cache them aggressively.
const ACADEMIC_STALE_TIME = 1000 * 60 * 60;

/**
 * ...but always revalidate when a screen that SUBMITS these ids mounts.
 *
 * The values here are not display text, they are foreign keys: onboarding and
 * edit-profile post `course_id` / `specialization_id` straight into
 * public.users. The query cache is persisted to AsyncStorage, so a phone can
 * hold an id across restarts long after the row behind it is gone — and a
 * `supabase db reset` regenerates every course and specialization with fresh
 * uuids, because the fixed ids in seed.sql lose a conflict to rows an earlier
 * migration already inserted. Submitting one of those stale ids is a 23503,
 * which reaches the student as INVALID_REFERENCE.
 *
 * Both lists are a handful of rows and each screen mounts once, so revalidating
 * costs one small request and removes a whole class of "everything was correct
 * and it still failed". The cached copy still renders instantly; this only
 * refreshes it underneath.
 */
const ACADEMIC_QUERY_OPTIONS = {
  staleTime: ACADEMIC_STALE_TIME,
  refetchOnMount: 'always',
} as const;

export function useCourses() {
  return useQuery({
    queryKey: ['academic', 'courses'],
    queryFn: () => api.get<AcademicOption[]>('/api/academic/courses'),
    ...ACADEMIC_QUERY_OPTIONS,
  });
}

export function useSpecializations() {
  return useQuery({
    queryKey: ['academic', 'specializations'],
    queryFn: () => api.get<AcademicOption[]>('/api/academic/specializations'),
    ...ACADEMIC_QUERY_OPTIONS,
  });
}
