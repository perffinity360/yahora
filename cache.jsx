# Yahora Mobile — List a New Item (Sell) screen

> Read `CLAUDE.md` first. Replaces the current `app/sell.tsx` placeholder with the real
> create + edit listing form, adapting the web `Sell.jsx`. Needed to seed test listings before
> the marketplace feed.

## FIRST — read these real files. Reference only; modify only `mobile/`.
- `../frontend/src/pages/sell/Sell.jsx` + `Sell.module.css` — full form, chip grid, preview, design
- `../backend/src/modules/products/products.controller.js` — `createProduct` + `updateProduct`

## Dependencies
`expo-image-picker` is already installed (used for avatars). Reuse it.

## Backend contracts
- **Create** — POST `/api/products` — **multipart/form-data**:
  - files: field name `images` (up to **5**)
  - body: `seller_id`, `title`, `description`, `price`, `category`, `location`, `condition`
  - → 201 `{ message, product }`. Required: ≥1 image, title, price, category.
- **Edit** — PUT `/api/products/:id` — JSON body: `title`, `description`, `price`, `category`,
  `location`, `condition` (NOT images — the web keeps image editing out for now) → `{ message, product }`.
  (Read `updateProduct` to confirm the exact fields.)

## Fixed option sets (match the web EXACTLY)
- **Categories** (single-select chip grid, 8) — with an `@expo/vector-icons` icon each:
  "Electronics & Tech", "Furniture & Decor", "Books & Study Materials", "Clothing & Accessories",
  "Vehicles & Bikes", "Appliances", "Sports & Fitness", "Miscellaneous".
- **Conditions** (picker, 5; store the short value; default **"Good"**):
  "Mint" (Like Brand New) · "Like New" (Barely Used) · "Good" (Normal Wear) ·
  "Fair" (Noticeable Wear) · "Poor" (Needs Repair).

## Steps

### 1. Replace `app/sell.tsx`
Read the `edit` route param (`useLocalSearchParams`). If present → **edit mode**: fetch
`GET /api/products/:id?user_id=<me>` to pre-fill the fields. Wrap in `SafeAreaView` +
`KeyboardAvoidingView` + `ScrollView`; top bar with a back button.

### 2. Images (create mode)
- Multi-pick: `ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5, quality: 0.7 })` (request permission).
- Preview grid of thumbnails (`expo-image`) each with a remove (✕) button; a "Add Photos" /
  "Add More" tile while `< 5`. Enforce max 5 with an inline message.
- **Edit mode**: show existing `image_urls` read-only (no add/remove — mirrors the web).

### 3. Fields
Title (required) · Price (required, numeric keypad, ₹) · Category (required, chip grid) ·
Condition (picker, default Good) · Description (multiline, optional) · Location (optional).
Optionally a small live preview card (like the web) — nice-to-have, not required.

### 4. Submit
- Validate: ≥1 image (create), title, price, category → else inline error.
- **Create**: build `FormData` — `seller_id` (from `useAuth()`), the text fields, and each image as
  `{ uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' } as any` under
  key `images` → `api.uploadForm('/api/products', formData)`.
- **Edit**: `api.put(\`/api/products/${id}\`, { title, description, price, category, location, condition })`.
- On success: invalidate `['dashboard', userId]` and navigate to `/(tabs)/profile` (the new/edited
  item appears in Listings). Show a submitting spinner; disable the button while submitting.

## Styling
Match the web Sell page via `src/theme` tokens (read `Sell.module.css`): the chip grid, image grid,
rounded inputs. Polished and on-brand.

## Constraints
TypeScript; theme tokens; `SafeAreaView`+`KeyboardAvoidingView`+`ScrollView`; inline errors;
`api.uploadForm` for the multipart create (never `post` — it forces JSON); modify only `mobile/`;
no screenshots for self-verification.

## Verify
`npx tsc --noEmit` → zero errors. `npx expo start` → runs.

## Finish
Don't Commit
Report files changed and remind me to test on my phone:
1. Pick 1–5 photos → fill title/price/category/condition → List → lands on the dashboard with the new item in Listings.
2. Max-5 enforcement and the required-field validation both work.
3. Editing an existing listing pre-fills and saves its text fields.