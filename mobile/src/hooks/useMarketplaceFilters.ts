import { useCallback, useMemo, useState } from 'react';

import {
  isWithinPostingDate,
  PRICE_MAX,
  PRICE_MIN,
  type PostingDateKey,
  type SortKey,
} from '../lib/marketplace';
import type { MarketplaceProduct } from '../types';

export interface MarketplaceFilters {
  search: string;
  setSearch: (v: string) => void;
  selCategories: string[];
  toggleCategory: (label: string) => void;
  priceRange: [number, number];
  setPriceRange: (r: [number, number]) => void;
  selConditions: string[];
  toggleCondition: (c: string) => void;
  selPostingDate: PostingDateKey;
  setSelPostingDate: (k: PostingDateKey) => void;
  showWishlist: boolean;
  setShowWishlist: (v: boolean) => void;
  showMyListings: boolean;
  setShowMyListings: (v: boolean) => void;
  activeSort: SortKey;
  setActiveSort: (k: SortKey) => void;
  activeFilterCount: number;
  clearFilters: () => void;
  displayProducts: MarketplaceProduct[];
}

/**
 * All client-side marketplace filtering + sorting, mirroring the web's
 * `displayProducts` memo exactly. The backend returns every campus product; this
 * narrows and orders them. Shared by the grid feed and the swipe deck.
 */
export function useMarketplaceFilters(
  products: MarketplaceProduct[],
  myUserId: string | null | undefined,
): MarketplaceFilters {
  const [search, setSearch] = useState('');
  const [selCategories, setSelCategories] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([PRICE_MIN, PRICE_MAX]);
  const [selConditions, setSelConditions] = useState<string[]>([]);
  const [selPostingDate, setSelPostingDate] = useState<PostingDateKey>('');
  const [showWishlist, setShowWishlist] = useState(false);
  const [showMyListings, setShowMyListings] = useState(false);
  const [activeSort, setActiveSort] = useState<SortKey>('newest');

  const toggleCategory = useCallback(
    (label: string) =>
      setSelCategories((prev) =>
        prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
      ),
    [],
  );

  const toggleCondition = useCallback(
    (c: string) =>
      setSelConditions((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])),
    [],
  );

  const clearFilters = useCallback(() => {
    setSelCategories([]);
    setPriceRange([PRICE_MIN, PRICE_MAX]);
    setSelConditions([]);
    setSelPostingDate('');
    setShowWishlist(false);
    setShowMyListings(false);
  }, []);

  // Search + sort are intentionally excluded (matches the web's badge count).
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (selCategories.length) n++;
    if (selConditions.length) n++;
    if (selPostingDate) n++;
    if (priceRange[0] > PRICE_MIN || priceRange[1] < PRICE_MAX) n++;
    if (showWishlist) n++;
    if (showMyListings) n++;
    return n;
  }, [selCategories, selConditions, selPostingDate, priceRange, showWishlist, showMyListings]);

  const displayProducts = useMemo(() => {
    let list = products.filter((p) => p.status !== 'sold');

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }

    if (selCategories.length) list = list.filter((p) => selCategories.includes(p.category));

    list = list.filter((p) => {
      const meetsMin = p.price >= priceRange[0];
      // At the ceiling, treat max as unbounded (mirrors the web).
      const meetsMax = priceRange[1] >= PRICE_MAX ? true : p.price <= priceRange[1];
      return meetsMin && meetsMax;
    });

    if (selConditions.length)
      list = list.filter((p) => !!p.condition && selConditions.includes(p.condition));

    if (selPostingDate) list = list.filter((p) => isWithinPostingDate(p.created_at, selPostingDate));

    if (showWishlist) list = list.filter((p) => p.is_saved);
    if (showMyListings) list = list.filter((p) => p.seller?.id === myUserId);

    const sorted = [...list];
    if (activeSort === 'newest')
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (activeSort === 'lowest_price') sorted.sort((a, b) => a.price - b.price);
    // "Trending" = Hot at [School]: most (likes + views) first.
    else if (activeSort === 'trending')
      sorted.sort((a, b) => b.likes_count + b.views - (a.likes_count + a.views));

    return sorted;
  }, [
    products,
    search,
    selCategories,
    priceRange,
    selConditions,
    selPostingDate,
    showWishlist,
    showMyListings,
    activeSort,
    myUserId,
  ]);

  return {
    search,
    setSearch,
    selCategories,
    toggleCategory,
    priceRange,
    setPriceRange,
    selConditions,
    toggleCondition,
    selPostingDate,
    setSelPostingDate,
    showWishlist,
    setShowWishlist,
    showMyListings,
    setShowMyListings,
    activeSort,
    setActiveSort,
    activeFilterCount,
    clearFilters,
    displayProducts,
  };
}
