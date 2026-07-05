import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';

export interface AcademicOption {
  id: string;
  name: string;
}

// Academic lists rarely change, so cache them aggressively.
const ACADEMIC_STALE_TIME = 1000 * 60 * 60;

export function useCourses() {
  return useQuery({
    queryKey: ['academic', 'courses'],
    queryFn: () => api.get<AcademicOption[]>('/api/academic/courses'),
    staleTime: ACADEMIC_STALE_TIME,
  });
}

export function useSpecializations() {
  return useQuery({
    queryKey: ['academic', 'specializations'],
    queryFn: () => api.get<AcademicOption[]>('/api/academic/specializations'),
    staleTime: ACADEMIC_STALE_TIME,
  });
}
