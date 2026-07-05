Now this a very big task, so do it patiently and ensure the app is beautiful, modern and convenient. All the things and functionality that are in website should be in the app as well. Don't miss anything. And report everything at the end for both 4b and 4c together. Thank you for helping claude code.

# Yahora Mobile — Phase 4b: Public Profile screen ("view my profile" / others), Yahora Mobile — Phase 4c (part 1): Listing management + Purchases/Watchlist tabs and Yahora Mobile — Phase 4c (part 2): Edit Profile + Avatar management

=============================================================================================================

# Yahora Mobile — Phase 4b: Public Profile screen ("view my profile" / others)
> Read `CLAUDE.md` first. **Requires 4a merged** — this uses the `ProductCard` component and
> replaces the `app/profile/[id].tsx` placeholder. It's the read-only profile view (how you and
> others appear), with like/save on the person's listings.

## FIRST — read these real files. Reference only; modify only `mobile/`.
- `../frontend/src/pages/publicProfile/PublicProfile.jsx` — layout + behavior (reuses Dashboard.module.css)
- `../frontend/src/pages/dashboard/Dashboard.module.css` — the shared styling
- `../backend/src/modules/user/user.controller.js` — `getPublicProfile` shape
- `../backend/src/modules/products/products.controller.js` — `toggleLikeProduct` / `toggleSaveProduct`

## Backend contracts
- GET `/api/user/:userId/public?user_id=:visitorId` →
  ```
  {
    profile: { id, full_name, avatar_url, bio, qualification, year_of_study, created_at,
               courseName, specializationName, university },
    listings: [{ id, title, price, image_urls, created_at, views, likes_count, condition,
                 status, is_liked?, is_saved? }]   // only 'available'; is_liked/is_saved set when visitor passed
  }
  ```
- POST `/api/products/:id/like` — body `{ user_id: visitorId }` → `{ message, is_liked }` (toggles)
- POST `/api/products/:id/save` — body `{ user_id: visitorId }` → `{ message, is_saved }` (toggles)

## Steps

### 1. Types — `src/types/index.ts`
- `PublicProfile { id; full_name; avatar_url; bio; qualification; year_of_study; created_at; courseName?; specializationName?; university? }`
- `PublicListing` = the listing fields above, with optional `is_liked`, `is_saved`.
- `PublicProfileData { profile: PublicProfile; listings: PublicListing[] }`

### 2. `src/hooks/usePublicProfile.ts`
`usePublicProfile(profileUserId)` — visitor id from `useAuth()` (`profile?.id`):
`useQuery({ queryKey: ['publicProfile', profileUserId], queryFn: () =>
api.get<PublicProfileData>(\`/api/user/${profileUserId}/public?user_id=${visitorId}\`),
enabled: !!profileUserId })`.

### 3. `src/hooks/useProductActions.ts` — like/save with OPTIMISTIC updates (the robust bit)
Two mutations that keep the UI instant on slow networks:
- `useToggleLike(profileUserId)` → `api.post(\`/api/products/${productId}/like\`, { user_id: visitorId })`.
  - `onMutate`: cancel the `['publicProfile', profileUserId]` query, snapshot it, and optimistically
    flip that product's `is_liked` and adjust `likes_count` by ±1 in the cache.
  - `onError`: roll back to the snapshot.
  - `onSettled`: invalidate `['publicProfile', profileUserId]` to reconcile with the server.
- `useToggleSave(profileUserId)`: same pattern, flipping `is_saved`.

### 4. Replace `app/profile/[id].tsx` with the real screen
Owner id from the route (`useLocalSearchParams`). `SafeAreaView`; `ScrollView` + `RefreshControl`.
- **Top bar**: a custom back button (chevron → `router.back()`), on-brand; optional first-name title.
- **Profile header (READ-ONLY — no edit/sign-out)**: avatar (`expo-image`, fallback icon/initials),
  full name, university, an academic line (qualification · courseName · year · specializationName),
  bio, and "Member since {Mon YYYY}" from `created_at`.
  - If `profileUserId === visitorId` (your own), show a subtle banner:
    "This is how others see your profile."
- **Listings**: a heading ("{FirstName}'s listings" / "Available listings"), then the person's
  listings via `ProductCard` (2-col grid or list). Wire `ProductCard`'s `onLike` / `onSave` /
  `isLiked` / `isSaved` to the Step-3 mutations. `onPress` → placeholder for now (product detail
  is a later phase).
  - Empty state: "No active listings."

### 5. States (robustness — never a blank screen)
- **Loading**: skeletons for the header + a few card placeholders.
- **Error**: a friendly "Couldn't load this profile." with a **Retry** button (refetch).
- **Empty**: the no-listings state above.

## Styling
Match the web (PublicProfile reuses Dashboard.module.css) via `src/theme` tokens. Polished,
read-only, on-brand.

## Constraints
TypeScript; theme tokens; `SafeAreaView`; `expo-image`; inline errors; modify only `mobile/`;
no screenshots for self-verification.

## Verify
`npx tsc --noEmit` → zero errors. `npx expo start` → runs.

## Finish
Don't Commit
Report files changed and remind me to test on my phone:
1. From the Dashboard, "View my public profile" opens my profile read-only (correct name,
   university, academics, bio, member-since) with the "how others see you" banner.
2. My available listings show; tapping like/save toggles **instantly** and survives a refresh.
3. The back button returns to the dashboard.
4. Loading skeleton, error-retry, and empty states all behave.

=============================================================================================================

# Yahora Mobile — Phase 4c (part 1): Listing management + Purchases/Watchlist tabs

> Read `CLAUDE.md` first. **Requires 4a merged** (Dashboard + `ProductCard` with action props).
> Completes the Dashboard's listing actions and the remaining two tabs.

## FIRST — read these real files. Reference only; modify only `mobile/`.
- `../frontend/src/pages/dashboard/Dashboard.jsx` — sold/available/delete handlers + purchases/watchlist tabs
- `../backend/src/modules/products/products.controller.js` — `markProductAsSold` / `markProductAsAvailable` / `deleteProduct`

## Backend contracts
- POST `/api/products/:id/sold` — body `{ buyer_id? }` (optional) → `{ message, product }`
  (send NO buyer_id for now — buyer selection needs messaging, added later).
- POST `/api/products/:id/available` — no body → `{ message, product }`.
- DELETE `/api/products/:id` → `{ message }`.

## Steps

### 0. Add a `delete` method to `src/lib/api.ts` if it's missing
`delete<T>(path)` — same auth-header handling as the other methods.

### 1. `src/hooks/useListingActions.ts` — optimistic mutations on the `['dashboard', userId]` cache
- `useMarkSold(userId)` → `api.post(\`/api/products/${productId}/sold\`, {})`.
  `onMutate`: cancel + snapshot `['dashboard', userId]`, optimistically set that listing's
  `status` to `'sold'`. `onError`: rollback. `onSettled`: invalidate `['dashboard', userId]`.
- `useMarkAvailable(userId)` → `api.post(\`/api/products/${productId}/available\`, {})`;
  optimistically set `status` to `'available'`.
- `useDeleteListing(userId)` → `api.delete(\`/api/products/${productId}\`)`.
  `onMutate`: optimistically REMOVE the listing from the cache. `onError`: rollback.
  `onSettled`: invalidate.

### 2. Wire actions into the Dashboard Listings tab (via `ProductCard`'s manage props)
Set `showManageActions` on the dashboard's own cards. Per status:
- `available` → "Mark as Sold" + "Delete".
- `sold` → "Mark as Available" (relist) + "Delete".
- **Delete** → a confirmation modal ("Delete this listing? This can't be undone.") before firing.
- **Mark as Sold** → a confirmation ("Mark this item as sold?"). Leave a `// TODO`: optional
  buyer selection when messaging exists.

### 3. Purchases tab (real data — from the dashboard `purchases` array)
Render each purchase: product image (`expo-image`), title, price (₹), purchase date. Empty state:
"You haven't bought anything yet.\nGo explore the marketplace!"

### 4. Watchlist tab (placeholder — matches the web; no backend endpoint yet)
Empty-state placeholder: "Your wishlist is empty.\nSwipe right on items you love!"
Leave a `// TODO`: wire to a saved-items endpoint when the marketplace/swipe lands.

## Styling
Match the web dashboard via `src/theme` tokens; confirmation modals on-brand.

## Constraints
TypeScript; theme tokens; inline errors; modify only `mobile/`; no screenshots for self-verification.

## Verify
`npx tsc --noEmit` → zero errors. `npx expo start` → runs.

## Finish
Don't Commit
Report files changed and remind me to test on my phone:
1. Mark an available listing as Sold → badge flips to SOLD instantly.
2. Mark it Available again (relist) → badge clears.
3. Delete a listing → confirm modal → it disappears.
4. Purchases tab shows bought items (or the empty state).
5. Watchlist shows the placeholder.
=============================================================================================================

# Yahora Mobile — Phase 4c (part 2): Edit Profile + Avatar management

> Read `CLAUDE.md` first. **Requires 4a** (Dashboard) and **3b** (onboarding form components:
> `SearchablePicker` + the qualification/year pickers) merged.

## FIRST — read these real files. Reference only; modify only `mobile/`.
- `../frontend/src/pages/dashboard/Dashboard.jsx` — avatar `FormData` upload, edit-field save, remove-avatar
- `../backend/src/modules/user/user.controller.js` — `updateProfile` (PUT) + `updateAvatar` (POST multipart)

## Backend contracts
- PUT `/api/user/:userId/profile` — body `{ ...anyFields }` → `{ message, userProfile }`.
- POST `/api/user/:userId/avatar` — **multipart/form-data**, field name `avatar` →
  `{ message, avatar_url }`. (Backend uploads to the `avatars` bucket AND deletes the old file.)

## Steps

### 1. Add methods to `src/lib/api.ts`
- `put<T>(path, body)` — JSON PUT (same auth handling as `post`), if missing.
- `uploadForm<T>(path, formData)` — attaches the Supabase auth header BUT **does NOT set
  `Content-Type`** (let `fetch` set the multipart boundary). The JSON `post` forces
  `application/json`, which would corrupt a multipart upload — so avatar uploads MUST use this.

### 2. Edit Profile screen — `app/edit-profile.tsx` (pushed screen, top bar with back)
Add an "Edit Profile" button on the Dashboard that navigates here. REUSE the onboarding form
components (`SearchablePicker` for course + specialization; simple pickers for qualification +
year; text inputs for full_name + bio with the 250 counter). **Pre-fill every field** from the
current profile (`useAuth()` profile + dashboard data for `course_id` / `specialization_id`).
- On **Save**: `api.put(\`/api/user/${userId}/profile\`, changedFields)` → on success,
  `saveProfile(data.userProfile)` (from `useAuth()`) AND invalidate `['dashboard', userId]` so the
  dashboard reflects the changes. Inline errors; saving spinner; disable while academic lists load.

### 3. Avatar management (on the Dashboard profile header)
Tapping the avatar opens a small on-brand bottom-sheet modal:
- **Change Photo** → `expo-image-picker`
  (`launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })`, request permission) →
  build `FormData` with the picked file as
  `{ uri, name: 'avatar.jpg', type: 'image/jpeg' } as any` under key `avatar` →
  `api.uploadForm(\`/api/user/${userId}/avatar\`, formData)`. On success: update `avatar_url` in the
  AuthContext profile + invalidate `['dashboard', userId]`. Show a spinner over the avatar while uploading.
- **Remove Photo** → `api.put(\`/api/user/${userId}/profile\`, { avatar_url: null })` → update profile + invalidate.
- **Cancel**.

## Styling
Match the web via `src/theme` tokens. The edit screen mirrors the onboarding layout; the avatar
modal is on-brand.

## Constraints
TypeScript; theme tokens; inline errors; modify only `mobile/`; do NOT set `Content-Type` on the
avatar upload; no screenshots for self-verification.

## Verify
`npx tsc --noEmit` → zero errors. `npx expo start` → runs.

## Finish
Don't Commit
Report files changed and remind me to test on my phone:
1. Edit Profile → change name/bio/academics → Save → the dashboard + profile update immediately.
2. Reopen the app → the changes persist.
3. Tap avatar → Change Photo → the new photo appears on the dashboard.
4. Tap avatar → Remove Photo → reverts to the default avatar.




