import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../lib/api';
import type { BuyerCandidate, Paged } from '../types';

/** MARK_SOLD_SPEC §1: searching starts 300 ms after typing stops. */
const SEARCH_DEBOUNCE_MS = 300;
/** Fewer characters than this (trimmed) shows the "Messaged you about this" list. */
export const BUYER_SEARCH_MIN = 2;

/** `value`, once it has stopped changing for `ms`. */
function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * The "Who bought it?" picker's list (MARK_SOLD_SPEC §1,
 * GET /api/products/:id/buyer-candidates).
 *
 * - Under 2 characters: the people who messaged the seller about this listing.
 *   No debounce: it is the list the picker opens on, and it is cached.
 * - 2 or more: students on the listing's campus, fetched 300 ms after typing
 *   stops. Until then `isLoading` is true, so the picker shows the searching
 *   skeleton rather than the results for what was typed before.
 *
 * `mode` says which list `items` is. `searchedFor` is the text the current
 * results answer, for the "no match" line.
 */
export function useBuyerCandidates(productId: string | null | undefined, query: string, enabled: boolean) {
  const typed = query.trim();
  const searching = typed.length >= BUYER_SEARCH_MIN;
  const debounced = useDebouncedValue(typed, SEARCH_DEBOUNCE_MS);
  // The text to ask the server for: '' = the messaged list. While a search is
  // still settling (debounced behind what is typed) there is nothing to ask yet.
  const q = !searching ? '' : debounced === typed ? typed : null;

  const result = useQuery({
    queryKey: ['buyerCandidates', productId, q],
    queryFn: ({ signal }) =>
      api.get<Paged<BuyerCandidate>>(
        `/api/products/${productId}/buyer-candidates${q ? `?q=${encodeURIComponent(q)}` : ''}`,
        signal,
      ),
    enabled: enabled && !!productId && q !== null,
    // The seller's own short-lived lookup: refreshed on every open, never kept for long.
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
    retry: 1,
  });

  return {
    mode: searching ? ('search' as const) : ('messaged' as const),
    items: q === null ? [] : (result.data?.items ?? []),
    isLoading: q === null || result.isLoading,
    isError: result.isError,
    /** Changes with every failure, so each one can raise its own toast. */
    errorUpdatedAt: result.errorUpdatedAt,
    searchedFor: q ?? '',
  };
}
