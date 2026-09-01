# Yahora Mobile — Claude Code Project Guide

## What this is
The React Native (Expo) mobile app for **Yahora**, a student-only, single-campus
marketplace with a social feed. It lives in the `mobile/` folder of the Yahora
monorepo and is an **independent client** that talks to the **same backend and
Supabase project as the web app** (`../frontend` + `../backend`).

**Never import code from `../frontend`** — React Native cannot use the DOM, CSS,
or Bootstrap. You may mirror logic patterns, but do not import web code.

## Stack
- Expo SDK 56 · React Native 0.85 · React 19.2 · **TypeScript**
- **Navigation:** Expo Router (file-based, under `app/`)
- **Server state + caching:** TanStack Query, with AsyncStorage persistence for offline use
- **Backend:** REST calls to the existing Express API (same endpoints the web app uses)
- **Realtime + auth:** `@supabase/supabase-js` (same Supabase project as web)
- **Images:** `expo-image` · **Long lists:** `@shopify/flash-list`
- **Styling:** React Native `StyleSheet` + central tokens in `src/theme`. **No hardcoded colors.**

## Target folder structure
(We build toward this incrementally — not everything exists yet.)
```
app/                      Expo Router routes (each file = one screen)
  _layout.tsx             root layout; app-wide providers (QueryClient, Auth) wrap here
  (auth)/                 login, verify, onboarding
  (tabs)/                 main app; _layout.tsx defines the tab bar
    index.tsx             Marketplace feed (home tab)
    messages.tsx
    profile.tsx
  product/[id].tsx        product detail
  sell.tsx                create listing
src/
  theme/                  colors, spacing, typography tokens
  lib/                    config.ts (resolved base URLs) · supabase.ts (client) · api.ts (fetch wrapper)
  contexts/               AuthContext.tsx (session, current user, university_id)
  hooks/                  TanStack Query hooks (useProducts, useInbox, …)
  components/             reusable UI (ProductCard, skeleton loaders, …)
  types/                  shared types (Product, User, Message, University)
```

## Conventions
- TypeScript everywhere; type all API responses in `src/types`.
- **Fetch data only through TanStack Query hooks in `src/hooks`** — never call `fetch`
  directly inside a screen or component.
- **Always read colors/spacing from `src/theme`** — never hardcode hex values.
- **Multi-tenant:** every data request is scoped to the user's `university_id`,
  mirroring the web app and Supabase Row-Level Security. A user must never see another
  campus's data.
- Components in PascalCase files; hooks named `useX`. Keep screens thin — push logic into hooks.
- Every list/feed needs a **skeleton loading state** and an **empty state**
  (slow-network UX is a core product goal).

## Backend (shared with the web app — already built)
- Base URLs come from `src/lib/config.ts`, never hardcoded — see
  "Networking: no hardcoded LAN IPs" below.
- Existing endpoints:
  - Auth: POST `/api/auth/request-otp` · `/verify-otp` · `/onboarding` · `/demo-login`
  - Products: GET `/api/products?university_id=&user_id=` · GET `/api/products/:id` ·
    POST `/api/products` · plus like / save / comment / sold routes
  - Messages: GET `/api/messages/inbox/:userId` · GET `/api/messages/history` · POST `/api/messages/send`
  - Universities: GET `/api/universities` · Academic: GET `/api/academic/courses` · `/specializations`
- Supabase is used directly (anon key) for realtime messages/presence and the auth
  session, exactly like the web app.

## Networking: no hardcoded LAN IPs, ever

A LAN IP in a config file is a DHCP lease waiting to expire. When the router hands
the Mac a new address every request fails with a network error that looks exactly
like the backend being down. It has already cost an hour once. So:

- **`src/lib/config.ts` is the only place a base URL is resolved.** Import
  `API_BASE_URL` / `SUPABASE_URL` from it. Never write a host into a screen, a
  hook, or `.env`.
- **Resolution order.** If `EXPO_PUBLIC_API_URL` (or `EXPO_PUBLIC_SUPABASE_URL`)
  is set it is used verbatim — that is how production and EAS builds work.
  Otherwise, in dev, the host is read from `Constants.expoConfig?.hostUri`,
  falling back to `Constants.expoGoConfig?.debuggerHost`; the port is stripped
  and replaced with **5000** for the API and **54321** for Supabase. The machine
  running Metro is the machine running everything else.
- **No localhost fallback.** If neither source yields a host, `config.ts` throws
  a readable error telling you to set `EXPO_PUBLIC_API_URL`. Falling back to
  `127.0.0.1` would mean *the phone itself*, which fails confusingly.
- **`mobile/.env` holds no URLs in local dev** — only the anon key. Leave both
  URL vars commented out. `EXPO_PUBLIC_*` values are inlined at bundle time, so
  after changing one restart Metro with `npx expo start -c`.
- The backend is reachable on the LAN because it binds `0.0.0.0`, and its dev
  CORS accepts any private-range origin. It prints its own LAN address on boot.

## Workflow
- After changes: run `npx tsc --noEmit` (types) and `npx expo start` (bundles/runs).
- **Do not self-verify with screenshots** — instead, report what the human should check on their phone.
- Never run `npm audit fix --force`.
- Work in **small phases**; don't commit yourself and ask the owner to commit after each working phase with a clear, conventional message.

## Monorepo file map
```
frontend/src/
  App.jsx · main.jsx · config/supabaseClient.js · contexts/AuthContext.jsx · styles/global.css
  components/ ProductCard/ · footer/ · modal/UniversityModal · navbar/   (+ each .module.css)
  pages/ Home/ · auth/Auth · dashboard/Dashboard · marketplace/Marketplace · messages/Messages
         · onboarding/onboarding · product/ProductDetail · publicProfile/PublicProfile · sell/Sell
         (+ each .module.css)
backend/src/
  app.js · server.js · config/env.js · config/supabaseClient.js · utils/cronJobs.js
  modules/ auth/(controller,routes,service) · academic/(controller,routes)
           products/(controller,routes,service) · messages/(controller,routes)
           university/(controller,routes) · user/(controller,routes)
mobile/
  app.json · package.json · tsconfig.json · .env(.example)
  (No babel.config.js — Expo's default transformer applies babel-preset-expo, which
   auto-adds the react-native-worklets plugin because worklets is installed. Adding an
   explicit babel.config.js broke the build here because babel-preset-expo is nested under
   expo/node_modules and can't be resolved from the project root. Do NOT re-add one.)
  app/                              Expo Router routes
    _layout.tsx                     root: GestureHandlerRootView + QueryClient + AuthProvider + routing guard
    (auth)/                         login (8-digit OTP + demo) · onboarding
    (tabs)/
      _layout.tsx                   tab bar (Feather icons: shopping-bag / message-square / user)
      index.tsx                     Marketplace: FlashList grid + swipe deck + filters/sort + campus switch
      messages.tsx                  Messages placeholder
      profile.tsx                   Dashboard (own profile + listings/purchases, avatar, bio)
    profile/[id].tsx                public profile (read-only)
    edit-profile.tsx                edit-profile form
    sell.tsx                        create/edit listing (multipart upload + live ProductCard preview)
  src/
    theme/index.ts                  color, spacing, radius, font tokens (+ conditionColors, swipeLike/swipePass)
    lib/
      config.ts                     THE base-URL resolver: API_BASE_URL + SUPABASE_URL
      api.ts                        fetch wrapper (base URL from config.ts)
      supabase.ts                   Supabase client (AsyncStorage session; URL from config.ts)
      upload.ts                     toUploadFile(): FormData file part with .bytes() for Winter fetch
      marketplace.ts                filter/sort constants + isWithinPostingDate + formatRupees
    contexts/AuthContext.tsx        session, profile, demo flag, onboardingSkipped
    hooks/                          useUniversities · useDashboard(+Actions) · usePublicProfile ·
                                    useProductActions (useToggleLike/Save — take a query key) ·
                                    useMarketplace (useMarketplaceFeed) · useMarketplaceFilters ·
                                    useProduct · useAcademics · useAvatarActions
    components/                     ProductCard · Skeleton · ExpandableBio · AvatarSheet ·
                                    SearchablePicker · AuroraBackground · UniversitiesModal · DemoModal ·
                                    FilterSheet · SwipeCard · SwipeDeck · CampusSwitcherModal · DemoCampusAlert
    types/index.ts                  University, UserProfile, Product, MarketplaceProduct, …
```

## Mobile gotchas (learned the hard way)
- **File uploads:** the global `fetch` is Expo SDK 56's **Winter** implementation. Its FormData
  rejects React Native's classic `{ uri, name, type }` file part ("Unsupported FormDataPart
  implementation"). Build parts with `toUploadFile()` (`src/lib/upload.ts`) — an object exposing
  `name`, `type`, and a `bytes()` reader (via expo-file-system's `File`). Applies to every
  `api.uploadForm` call (Sell images, avatar).
- **Feed list:** `@shopify/flash-list` v2 (auto-sized, no `estimatedItemSize`); it needs the New
  Architecture, which SDK 56 enables by default.
- **Gestures/animation:** reanimated v4 + `react-native-worklets` + gesture-handler are installed and
  configured. `GestureHandlerRootView` wraps the app in `app/_layout.tsx`; worklet transforms come
  from babel-preset-expo (see the no-babel.config.js note above). `SwipeCard`/`SwipeDeck` use them.
  `Skeleton` still uses core `Animated` (fine to keep).
- **Root navigation is a `<Slot/>`** which unmounts inactive screens, so `router.back()` from a
  detail screen resets the tabs to Marketplace. Navigate to a tab explicitly
  (`router.replace('/(tabs)/profile')`) instead of relying on `back()`.

When building a mobile screen, read the matching web file under
`../frontend/src/pages/...` and its `.module.css` for design + behavior parity, and the
matching `../backend/src/modules/...` controller for the API contract. Treat `../frontend`
and `../backend` as read-only reference.

## Design principles (read before ANY UI work)
Aesthetic direction for this project: warm, tactile student marketplace where every
listing feels like a keepsake — nostalgic sentiment meets modern campus energy, one
confident accent on a soft neutral canvas.

- Typography: pair one characterful display font with a clean body font.
  Never Inter, Roboto, Arial, Space Grotesk, or system-ui.
- Color: one dominant tone + one sharp accent, defined as CSS variables /
  theme tokens. No purple-gradient-on-white, no timid evenly-spread palettes.
- Motion: every screen gets entrance choreography (staggered reveals);
  every interactive element gets hover/press feedback. 150–400ms,
  custom easing curves, never linear.
- Backgrounds: atmospheric (subtle gradients, grain, glow, geometry) —
  never flat default white/gray.
- Before coding a screen, state your aesthetic direction in one sentence,
  then make every choice serve it.

## UI stack & animation rules (Expo)
Before ANY UI work, read DESIGN.md fully. Its tokens (src/theme/tokens.ts) are canonical.

- Animation default: react-native-reanimated (springs, entering/exiting, layout transitions) +
  react-native-gesture-handler for swipe/drag. All animation on the UI thread — never setState/JS timers.
- Moti: simple one-off fade/slide only. Lottie: hero moments only (onboarding, success, empty states) — never on feeds.
- Premium effects: @shopify/react-native-skia for gradients/glows/celebrations — never inside list rows.
  expo-blur + expo-linear-gradient for glass/depth.
- Every Pressable: scale to 0.97 spring + expo-haptics light impact (use the shared PressableScale).
- Lists: expo-image with blurhash placeholders and fixed 4:5 ratios; skeletons over spinners;
  no layout animations inside FlatList rows. Target 60fps on mid-range Android.
- Safe areas + keyboard handling on every screen. Respect ReducedMotionConfig.
- After building a screen: capture `xcrun simctl io booted screenshot /tmp/screen.png`,
  read it, self-critique, fix, re-capture. Check light and dark mode.