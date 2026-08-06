/**
 * Shared marketplace filter/sort constants. These mirror the web
 * (`frontend/src/pages/marketplace/Marketplace.jsx`) exactly so both clients
 * filter and sort identically. All filtering/sorting is client-side.
 */

export const MARKETPLACE_CATEGORIES = [
  'Electronics & Tech',
  'Furniture & Decor',
  'Books & Study Materials',
  'Clothing & Accessories',
  'Vehicles & Bikes',
  'Appliances',
  'Sports & Fitness',
  'Miscellaneous',
] as const;

export const MARKETPLACE_CONDITIONS = ['Mint', 'Like New', 'Good', 'Fair', 'Poor'] as const;

export type SortKey = 'newest' | 'lowest_price' | 'trending';
export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'lowest_price', label: 'Lowest Price' },
  { key: 'trending', label: 'Trending' },
];

export type PostingDateKey = '' | 'today' | 'week' | 'month' | 'older';
export const POSTING_DATE_OPTIONS: { key: Exclude<PostingDateKey, ''>; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'older', label: 'Older' },
];

/** Price slider bounds (₹). At the ceiling the max reads "₹50,000+" (no cap). */
export const PRICE_MIN = 0;
export const PRICE_MAX = 50000;
export const PRICE_STEP = 500;

const DAY_MS = 86_400_000;

/** Matches the web's `isWithinPostingDate`: today <1d, week <7d, month <30d, older ≥30d. */
export function isWithinPostingDate(isoDate: string, key: PostingDateKey): boolean {
  if (!key) return true;
  const diff = Date.now() - new Date(isoDate).getTime();
  if (key === 'today') return diff < DAY_MS;
  if (key === 'week') return diff < DAY_MS * 7;
  if (key === 'month') return diff < DAY_MS * 30;
  if (key === 'older') return diff >= DAY_MS * 30;
  return true;
}

/** ₹ with Indian digit grouping, matching ProductCard's formatter (no Intl in Hermes). */
export function formatRupees(value: number): string {
  const n = Math.round(Number(value) || 0);
  const digits = String(Math.abs(n));
  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${last3}`;
  }
  return `₹${grouped}`;
}
