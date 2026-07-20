Now complete parts of this phase in a robust way:

Read `CLAUDE.md` first.

# Yahora Mobile — Phase 4-ii: Marketplace filters + sort (incl. "Hot at [School]" trending)

> Builds on 4-i (the feed + `useMarketplaceFeed`). ALL filtering/sorting is
> **client-side** (the backend returns every campus product), matching the web.

## FIRST — read these real files. Reference only; modify only `mobile/`.
- `../frontend/src/pages/marketplace/Marketplace.jsx` — the filter panel, sort row, `displayProducts`
  memo, `isWithinPostingDate`, `activeFilterCount`, `clearFilters`
- `../frontend/src/pages/marketplace/Marketplace.module.css` — design

## Dependencies
`npx expo install @react-native-community/slider` (price min/max sliders).

## Constants (match the web EXACTLY)
- CATEGORIES (8 labels): "Electronics & Tech", "Furniture & Decor", "Books & Study Materials",
  "Clothing & Accessories", "Vehicles & Bikes", "Appliances", "Sports & Fitness", "Miscellaneous".
- CONDITIONS: `["Mint","Like New","Good","Fair","Poor"]`.
- SORT_OPTIONS: `newest` ("Newest"), `lowest_price` ("Lowest Price"), `trending` ("Trending").
- POSTING_DATE_OPTIONS: `today`, `week`, `month`, `older`.

## Steps

### 1. Filter state (marketplace screen, or a `useMarketplaceFilters` hook)
`searchQuery` (from 4-i), `selCategories: string[]`, `priceRange: [number, number]` = `[0, 50000]`,
`selConditions: string[]`, `selPostingDate: '' | 'today' | 'week' | 'month' | 'older'`,
`showWishlist: boolean`, `showMyListings: boolean`,
`activeSort: 'newest' | 'lowest_price' | 'trending'` (default `'newest'`).

### 2. `displayProducts` memo — EXACT logic from the web
From the fetched products, in order:
- drop `status === 'sold'` (safety),
- search: `title` / `description` / `category` includes query,
- categories: `selCategories.includes(p.category)` (only if any selected),
- price: `p.price >= min` AND (`max >= 50000 ? true : p.price <= max`),
- conditions: `selConditions.includes(p.condition)` (only if any),
- posting date via `isWithinPostingDate(created_at, key)`: today `<1d`, week `<7d`, month `<30d`, older `>=30d`,
- wishlist: `p.is_saved` (if `showWishlist`),
- my listings: `p.seller?.id === myUserId` (if `showMyListings`),
then sort: `newest` → created_at desc · `lowest_price` → price asc ·
**`trending` → (likes_count + views) desc** (this is "Hot at [School]").
Feed the FlashList from `displayProducts`.

### 3. Sort row
A horizontal row of sort chips (Newest · Lowest Price · Trending) under the header; active chip highlighted.

### 4. Filter entry + bottom sheet
- A "Filters" button in the header with a badge = `activeFilterCount`
  (categories + conditions + postingDate + priceRange-changed + wishlist + myListings).
- Tapping opens an on-brand bottom-sheet/modal with:
  - **Categories** — multi-select chips (8).
  - **Price range** — two `@react-native-community/slider` (min + max, 0–50000, step ~500); labels show
    ₹min and ₹max, where the max shows "₹50,000+" at the ceiling. (Mirrors the web's two range inputs.)
  - **Condition** — multi-select chips (5).
  - **Posting date** — single-select chips (Today / This Week / This Month / Older).
  - **Toggles** — "My Wishlist" (`showWishlist`) and "My Listings" (`showMyListings`).
  - Footer: "Clear all" (reset) + "Apply" (close).

### 5. Empty state (update 4-i's)
"No results for {query}" / "Your wishlist is empty" / "No items listed in {University} right now",
plus a "Clear filters" action when `activeFilterCount > 0`.

## Styling
Match the web filter panel via `src/theme` tokens (read its CSS): chips, sliders, toggles.

## Constraints
TypeScript; theme tokens; client-side only; modify only `mobile/`; no screenshots for self-verification.

## Verify
`npx tsc --noEmit` → zero. `npx expo start` → runs.

## Finish
Report + remind me to test on my phone: category/condition/price/date filters narrow the grid; the
Wishlist & My Listings toggles work; Trending sorts by most liked+viewed; the filter badge counts
correctly; "Clear all" resets everything.


# Yahora Mobile — Phase 4-iii: Marketplace swipe mode (Tinder deck)

> Read `CLAUDE.md` first. Builds on 4-i/4-ii. Adds a grid⇄swipe toggle and a gesture-driven swipe deck.

## FIRST — read these real files. Reference only; modify only `mobile/`.
- `../frontend/src/pages/marketplace/Marketplace.jsx` — `SwipeCard`, `SWIPE_THRESHOLD`, the swipe deck
  render, `handleSwipeLike` / `handleSwipePass`, the view toggle
- `../frontend/src/pages/marketplace/Marketplace.module.css` — swipe/stamp styling

## Dependencies
`npx expo install react-native-reanimated react-native-gesture-handler`
- Add `'react-native-reanimated/plugin'` as the **LAST** entry in `babel.config.js` `plugins`
  (order matters — it must be last, or gestures silently break).
- Ensure the app root is wrapped in `GestureHandlerRootView` (in `app/_layout.tsx`).

## Steps

### 1. View toggle
A grid/swipe segmented control in the marketplace header (`viewMode: 'grid' | 'swipe'`, default `'grid'`).
Grid = the 4-i/4-ii feed; swipe = the deck below.

### 2. Swipe deck
Build the deck from `displayProducts` (respect the active filters), newest on top. Render the top **3**
cards stacked (`deck.slice(-3)`), z-indexed by position; only the TOP card is interactive. Keep a local
`deck` array so swiped cards are removed.

### 3. `src/components/SwipeCard.tsx` (Reanimated + Gesture)
- `Gesture.Pan()` → a shared `translateX`; card `rotate = translateX / 20`.
- **LIKE** (green) and **PASS** (red) stamps whose opacity ramps with `|translateX| / SWIPE_THRESHOLD`
  (threshold **100**).
- On gesture end: if `|translateX| >= 100` → animate the card off-screen that direction (~350ms), then
  call `onLike(id)` (right) or `onPass(id)` (left); else spring back to 0.
- Renders the existing `ProductCard` inside (not pannable itself while dragging).

### 4. Deck handlers
- `onLike(id)`: remove from `deck` + optimistically like it in the `['marketplace', universityId]` cache +
  POST `/api/products/:id/like` (reuse the like mutation/hook).
- `onPass(id)`: just remove from `deck` (no network).
- **Like / Pass buttons** below the deck (tap = programmatic swipe of the top card) — large and tappable.

### 5. States
- Loading: one centered skeleton card.
- Empty: "You've seen everything!" + a "Back to grid" button (→ `viewMode = 'grid'`).
- A small "{n} items left" counter under the deck.

## Styling
Match the web swipe view via `src/theme` tokens (read its CSS): the stamps, stacked-card look, buttons.

## Constraints
TypeScript; theme tokens; Reanimated for gestures (aim for 60fps); modify only `mobile/`; no screenshots
for self-verification.

## Verify
`npx tsc --noEmit` → zero. `npx expo start` → runs. (If gestures don't respond, confirm the reanimated
babel plugin is LAST and `GestureHandlerRootView` wraps the app.)

## Finish
Report + remind me to test on my phone: toggle to swipe; drag right → LIKE stamp + card flies off + it's
liked; drag left → PASS + card flies off; the Like/Pass buttons work; empty state + "Back to grid"; the
counter decrements.


# Yahora Mobile — Phase 4-iv: Campus switcher (cross-campus browsing)

> Read `CLAUDE.md` first. Builds on 4-i. Lets users browse OTHER campuses (view-only), with the demo
> restriction. Reuses `useUniversities` + the existing universities modal.

## FIRST — read these real files. Reference only; modify only `mobile/`.
- `../frontend/src/pages/marketplace/Marketplace.jsx` — `handleSetUniversity`, `isForeignCampus` /
  `isHomeCampus`, the demo alert, `UniSwitcher`, the "List an item" button
- `../frontend/src/pages/marketplace/Marketplace.module.css` — the switcher, demo alert, banner

## Steps

### 1. Campus state
- `homeUniversityId` = the user's own `profile?.university_id` (from `useAuth()`).
- `viewedUniversityId` = the campus currently shown (default = home). The feed becomes
  `useMarketplaceFeed(viewedUniversityId)`, so switching refetches automatically.
- `isForeignCampus = homeUniversityId && viewedUniversityId !== homeUniversityId`.

### 2. Campus switch entry (header)
Show the current campus name ("Yahora — {name}") with a switch affordance (chevron / "Switch"). Tapping
opens a searchable campus picker — reuse/adapt the existing universities modal (`useUniversities`).
Selecting a campus calls `handleSetUniversity(u)`.

### 3. `handleSetUniversity(u)`
- If `isDemoUser` (from `useAuth()`) AND `u.id !== homeUniversityId` → show the **demo alert** (Step 5)
  and do NOT switch.
- Else set `viewedUniversityId = u.id`.

### 4. Foreign-campus (view-only) treatment
When `isForeignCampus`:
- Show a subtle banner: "You're browsing {campus} — you can view items, but buying and listing are
  limited to your home campus."
- **Hide the "List an item" FAB** (Step 6). (Like/save still work for browsing; buy/message limits get
  enforced at product detail in a later phase.)

### 5. Demo alert modal
On-brand modal titled "Unlock All Campuses" with a short line ("Create a free account to browse every
campus."), a **Cancel** button, and a primary **"Sign up"** button → `signOut()` (clears demo) then
`router.replace('/(auth)/login')`.

### 6. "List an item" FAB
A floating "List an item" button on the marketplace (→ `/sell`), shown only on the home campus
(hidden when `isForeignCampus`).

## Styling
Match the web via `src/theme` tokens (read its CSS): the switcher, the foreign-campus banner, the demo alert, the FAB.

## Constraints
TypeScript; theme tokens; modify only `mobile/`; no screenshots for self-verification.

## Verify
`npx tsc --noEmit` → zero. `npx expo start` → runs.

## Finish
Report + remind me to test on my phone: switching campus loads that campus's items; a foreign campus
shows the browse-only banner and hides "List an item"; a real account switches freely; a demo account
hits the "Unlock All Campuses" alert when trying to leave the demo campus.

Don't commit and report everything to check. Thank you.