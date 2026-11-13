import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { GIF_SEARCH_DEBOUNCE_MS } from '../lib/community';
import { fetchGifs, hasKlipyKey } from '../lib/klipy';

/**
 * The GIF picker's behaviour (COMMUNITY_SPEC.md §6), with no markup:
 *   · trending GIFs first;
 *   · a search runs GIF_SEARCH_DEBOUNCE_MS after typing stops; clearing the
 *     box goes back to trending;
 *   · more pages as the list nears its end;
 *   · one error state for everything ("GIFs aren't available right now."),
 *     including a missing key.
 *
 * Each term is its own query, so a slow answer for "hel" can never replace the
 * one for "hello": TanStack drops the old query's result for the new key, and
 * aborts it (`signal`).
 *
 * KLIPY's links are shown, never kept: these queries leave the cache a minute
 * after the picker closes, so the app's saved cache doesn't carry them.
 */
export function useGifs() {
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), GIF_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const keyMissing = !hasKlipyKey();
  const result = useInfiniteQuery({
    queryKey: ['klipy', term],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchGifs({ query: term, page: pageParam, signal }),
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: !keyMissing,
    gcTime: 60 * 1000,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    return (result.data?.pages ?? [])
      .flatMap((p) => p.items)
      .filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
  }, [result.data]);

  return {
    query,
    setQuery,
    isSearch: term !== '',
    items,
    loading: result.isLoading || (result.isFetching && items.length === 0),
    loadingMore: result.isFetchingNextPage,
    failed: keyMissing || (result.isError && items.length === 0),
    hasMore: !!result.hasNextPage,
    loadMore: () => {
      if (result.hasNextPage && !result.isFetchingNextPage && !result.isError) void result.fetchNextPage();
    },
    retry: () => void result.refetch(),
  };
}
