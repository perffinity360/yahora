import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import type { University } from '../types';

export function useUniversities() {
  return useQuery({
    queryKey: ['universities'],
    queryFn: () => api.get<University[]>('/api/universities'),
  });
}
