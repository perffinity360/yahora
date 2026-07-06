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
  lib/                    supabase.ts (client) · api.ts (fetch wrapper + base URL)
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
- Base URLs come from env, never hardcoded:
  `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  (these get set up in the data-layer phase).
- Existing endpoints:
  - Auth: POST `/api/auth/request-otp` · `/verify-otp` · `/onboarding` · `/demo-login`
  - Products: GET `/api/products?university_id=&user_id=` · GET `/api/products/:id` ·
    POST `/api/products` · plus like / save / comment / sold routes
  - Messages: GET `/api/messages/inbox/:userId` · GET `/api/messages/history` · POST `/api/messages/send`
  - Universities: GET `/api/universities` · Academic: GET `/api/academic/courses` · `/specializations`
- Supabase is used directly (anon key) for realtime messages/presence and the auth
  session, exactly like the web app.

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
  app/                              Expo Router routes
    _layout.tsx                     root: QueryClient + AuthProvider + routing guard
    (auth)/
      _layout.tsx                   stack, no headers
      login.tsx                     email + 8-digit OTP + demo, mirrors web Auth.jsx
      onboarding.tsx                placeholder (Phase 3b will build the real form)
    (tabs)/
      _layout.tsx                   tab bar
      index.tsx                     Marketplace placeholder
      messages.tsx                  Messages placeholder
      profile.tsx                   Profile placeholder
  src/
    theme/index.ts                  color, spacing, radius, font tokens
    lib/
      api.ts                        fetch wrapper + base URL (trims + strips trailing slash)
      supabase.ts                   Supabase client (AsyncStorage session)
    contexts/AuthContext.tsx        session, profile, demo flag, onboardingSkipped
    hooks/useUniversities.ts        TanStack Query hook
    components/
      UniversitiesModal.tsx         RN modal listing supported campuses
      DemoModal.tsx                 RN modal: Sandbox Preview / Recorded Demo
    types/index.ts                  University, UserProfile, Product
```

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