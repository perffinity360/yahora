// frontend/src/hooks/useGifSearch.js
//
// The GIF picker's behaviour — spec §6 — with no markup, so the picker's look
// can change without touching it:
//   · trending GIFs first;
//   · a search runs GIF_SEARCH_DEBOUNCE_MS after typing stops; clearing the
//     box goes back to trending;
//   · loadMore() fetches the next page of whichever list is showing;
//   · loading and error states. Any error means the same thing to a student
//     (spec §6: "GIFs aren't available right now."), and `retry` tries again.
//
// A newer list always wins: changing the search aborts the request still on
// its way, so a slow answer for "hel" can never replace the one for "hello".

import { useCallback, useEffect, useRef, useState } from "react";
import { searchGifs, trendingGifs } from "../utils/klipy";
import { GIF_SEARCH_DEBOUNCE_MS } from "../utils/community";

export default function useGifSearch() {
  const [query, setQuery] = useState("");
  // The search actually running: `query` once typing has paused, trimmed.
  const [term, setTerm] = useState("");
  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const controller = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), GIF_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async (searchTerm, page) => {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setLoading(true);
    setError(null);
    try {
      const result = searchTerm
        ? await searchGifs({ query: searchTerm, page, signal: ac.signal })
        : await trendingGifs({ page, signal: ac.signal });
      if (ac.signal.aborted) return;
      setItems((prev) => {
        if (page === 1) return result.items;
        const seen = new Set(prev.map((g) => g.id));
        return [...prev, ...result.items.filter((g) => !seen.has(g.id))];
      });
      setNext(result.next);
    } catch (err) {
      if (err?.name === "AbortError" || ac.signal.aborted) return;
      setError(err);
    } finally {
      if (controller.current === ac) setLoading(false);
    }
  }, []);

  // A new search (or back to trending) starts again from page 1.
  useEffect(() => {
    setItems([]);
    setNext(null);
    load(term, 1);
  }, [term, load]);

  useEffect(() => () => controller.current?.abort(), []);

  const loadMore = useCallback(() => {
    if (loading || error || next === null) return;
    load(term, next);
  }, [loading, error, next, term, load]);

  const retry = useCallback(() => {
    load(term, items.length ? next ?? 1 : 1);
  }, [load, term, items.length, next]);

  return {
    query,
    setQuery,
    /** True once the list shows search results rather than trending. */
    isSearch: term !== "",
    items,
    loading,
    error,
    hasMore: next !== null,
    loadMore,
    retry,
  };
}
