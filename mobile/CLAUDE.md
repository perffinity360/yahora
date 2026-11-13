# Yahora Mobile — Claude Code Project Guide

## What this is
The React Native (Expo) mobile app for **Yahora**, a student-only, single-campus
marketplace with a social feed. It lives in the `mobile/` folder of the Yahora
monorepo and is an **independent client** that talks to the **same backend and
Supabase project as the web app** (`../frontend` + `../backend`).

**Never import code from `../frontend`** — React Native cannot use the DOM, CSS,
or Bootstrap. You may mirror logic patterns, but do not import web code.

## Stack
- Expo SDK 58 · React Native 0.88 · React 19.3 · **TypeScript**
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
  - **The full, current contract is `backend/API.md`** (posts, reports, usernames, message actions …);
    this list is only the oldest routes.
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
  and replaced with **5001** for the API and **54321** for Supabase. The machine
  running Metro is the machine running everything else.
- **The API port is 5001, never 5000.** macOS binds port 5000 to the AirPlay
  Receiver (Control Center), which holds it from boot and answers every request
  with a bodiless `403 Forbidden`. That is a real HTTP response, not a
  connection failure, so it surfaces as an application error — it once showed up
  as "Yahora is not yet available at your university" for a live campus and
  "Request failed (403)" on the demo button, and looked like a database problem
  for as long as it took to `curl` the port. If an auth call fails with a 403
  that the backend log never recorded, check the port first.
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
- **Testing:** follow the root `CLAUDE.md`, "How we work" (owner, 13 Nov): test yourself only when it's quick and
  reliable, and otherwise report exactly what the human should check on the phone, and how. This Mac has no
  `adb`, Android emulator or iOS simulator today, so on-device checks go to the human.
- Never run `npm audit fix --force`.
- Work in **small phases**; don't commit yourself and ask the owner to commit after each working phase with a clear, conventional message.

## Monorepo file map
```
frontend/src/
  App.jsx · main.jsx · config/(urls, supabaseClient).js · contexts/AuthContext.jsx · styles/global.css
  components/ ProductCard/ · footer/ · modal/UniversityModal · navbar/ · community/ · FormattedText/ · …
  pages/ Home/ · auth/Auth · dashboard/Dashboard · marketplace/Marketplace · messages/Messages
         · onboarding/onboarding · product/ProductDetail · publicProfile/PublicProfile · sell/Sell
         · community/ (Phase 7) · dev/CommunitySandbox (development only)   (+ each .module.css)
  hooks/ · utils/   (emoji.js, textFormat.js … are the twins of mobile/src/lib)
backend/src/
  app.js · server.js · config/(env, supabase).js
  utils/ respond · notify · cronJobs · pagination · moderation · emoji · viewer
  modules/ auth · academic · university · user · products · share · messages · posts · reports
           · social · notifications · admin   (ownership: backend/CLAUDE.md)
mobile/
  app.json · package.json · tsconfig.json · .env(.example)
  (No babel.config.js — Expo's default transformer applies babel-preset-expo, which
   auto-adds the react-native-worklets plugin because worklets is installed. Adding an
   explicit babel.config.js broke the build here because babel-preset-expo is nested under
   expo/node_modules and can't be resolved from the project root. Do NOT re-add one.)
  app/                              Expo Router routes
    _layout.tsx                     root: GestureHandlerRootView + QueryClient + AuthProvider + routing guard
    (auth)/                         login (6-digit OTP + demo) · onboarding
    (tabs)/
      _layout.tsx                   tab bar (Feather icons: shopping-bag / users / message-square / user)
      index.tsx                     Marketplace: FlashList grid + swipe deck + filters/sort + campus switch
      community.tsx                 Community (Phase 7): floating switcher, campus / country / Global feeds
      messages.tsx                  Inbox: conversations, search, unread badges, previews
      profile.tsx                   Dashboard (own profile + listings/purchases, avatar, bio)
    chat/[contactId].tsx            a conversation: realtime, replies, reactions, delete, formatting
    product/[id].tsx                product detail (comments, like/save, Mark as Sold)
    profile/[id].tsx                public profile (read-only)
    post/[id].tsx                   a post's own page: the post, every reply paged, the reply bar
    compose.tsx                     write a post or reply (modal): photos / GIF, every result of posting
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
      emoji.ts · stickers.ts        emoji sizing in messages · welcome stickers (twins of the web's)
      messages.ts · messageActions.ts  inbox time format · reply/copy/delete rules
      textFormat.ts                 WhatsApp-style formatting rules (twin of the web's textFormat.js)
      nav.ts · share.ts · avatar.ts · deviceId.ts · otpLedger.ts
      community.ts                  COMMUNITY_SPEC §13 constants (same names as the web's utils/community.js),
                                    formatCount, flagEmoji, formatPostTime, the optimistic reaction math
      klipy.ts                      THE only file that calls KLIPY (GIFs); reads EXPO_PUBLIC_KLIPY_API_KEY
      motion.ts                     POPOVER_ENTER / DIALOG_ENTER / SHEET_RISE: smooth, non-bouncing entrances (DESIGN.md "Motion")
    contexts/AuthContext.tsx        session, profile, demo flag, onboardingSkipped
    hooks/                          useUniversities · useDashboard(+Actions) · usePublicProfile ·
                                    useProductActions (useToggleLike/Save — take a query key) ·
                                    useMarketplace (useMarketplaceFeed) · useMarketplaceFilters ·
                                    useProduct · useAcademics · useAvatarActions · useMessages ·
                                    useComments · useProductDetail · useBuyerCandidates ·
                                    useLeaveOnce · useFloatingTopInset ·
                                    useCommunity (feeds, threads, the post page, profiles' Posts,
                                    reactions, posting, delete, report, the new-posts count — and the
                                    cache helpers that keep every list in step) · useComposer · useGifs
    components/                     AnchoredModal (menus that hang off a button) · ModalSafeArea (insets inside
                                    a Modal) · ProductCard · Skeleton ·
                                    ExpandableBio · AvatarSheet ·
                                    SearchablePicker · AuroraBackground · UniversitiesModal · DemoModal ·
                                    FilterSheet · SwipeCard · SwipeDeck · CampusSwitcherModal · DemoCampusAlert ·
                                    AppText · AppTextInput · Avatar · FormattedText · MessageActionMenu ·
                                    DeleteMessagesDialog · CommentThread · ConfirmDialog · AppToast · …
                                    community/ (PostCard, PostThread, PostText, PostMedia, ReactionBar,
                                    ReactionSummary, CommunitySwitcher, CommunityWallpaper, GlobeIcon,
                                    ComposerDock, GifPicker, SupportCard, StatusBarGround, PostActions (the ⋯ menu,
                                    report, delete, ⊕ and the breakdown, once per screen), ReportSheet,
                                    ReactionBreakdownSheet, EmojiPickerSheet (rn-emoji-keyboard),
                                    UserPostsList)
    types/index.ts                  University, UserProfile, Product, MarketplaceProduct, …
```

## Mobile gotchas (learned the hard way)
- **File uploads:** the global `fetch` is Expo SDK 58's **Winter** implementation. Its FormData
  rejects React Native's classic `{ uri, name, type }` file part ("Unsupported FormDataPart
  implementation"). Build parts with `toUploadFile()` (`src/lib/upload.ts`) — an object exposing
  `name`, `type`, and a `bytes()` reader (via expo-file-system's `File`). Applies to every
  `api.uploadForm` call (Sell images, avatar).
- **Feed list:** `@shopify/flash-list` v2 (auto-sized, no `estimatedItemSize`); it needs the New
  Architecture, which SDK 58 enables by default.
- **FlashList is patched** (`patches/@shopify+flash-list+2.3.2.patch`, applied by `patch-package`
  on `postinstall`). In a 2-column grid, after a data change (a relisted item arriving at the
  top), a card that inherited its slot's old row height was skipped as "tallest", so the next row
  was placed under its shorter neighbour and overlapped it (27 Oct). Unfixed upstream as of
  2.3.3. **When upgrading flash-list, re-check `processAndReturnTallestItemInRow` in
  `GridLayoutManager` and regenerate or drop the patch** (`npx patch-package @shopify/flash-list`).
- **rn-emoji-keyboard is patched too** (`patches/rn-emoji-keyboard+1.7.0.patch`), in `src/` and both `lib/`
  builds (Metro reads `src/`). Two fixes, 12 Nov: (1) `EmojiCategory` called
  `InteractionManager.runAfterInteractions`, and **opening ⊕ crashed the app**; it now defers with a
  `setTimeout` in an effect. (2) `ModalWithBackdrop` opened on a default `Animated.spring`, which bounced;
  it now eases (280 ms out, 200 ms in). It still uses React Native's deprecated `SafeAreaView` (the
  "SafeAreaView has been deprecated" warning in the log); when RN removes it, the picker breaks again.
  Re-check all three when upgrading the library.
- **React Native 0.88 removed `InteractionManager`: touching it throws** ("has been removed from
  react-native core"). A library that still uses it passes `tsc` and `expo export` and crashes only when
  that code runs, which is how ⊕ shipped broken. **After adding or upgrading a library, and before
  handing a block over**, export the Android bundle and scan it:
  `npx expo export --platform android --output-dir <scratch> && strings <scratch>/_expo/static/js/android/*.hbc | grep -c runAfterInteractions`
  must print 0. Then open every new screen and overlay path on the phone, not only the main one.
- **A menu that hangs off a button goes in `AnchoredModal`** (`src/components/AnchoredModal.tsx`), never
  a bare `<Modal>` placed from `measureInWindow`. On Android `measureInWindow` counts from below the
  status bar, but a `statusBarTranslucent` Modal starts at the top of the screen, so menus landed a
  status bar too high and covered their own buttons (country dropdown, ⋯ menu, quick bar; POCO, 12 Nov).
  `AnchoredModal` subtracts the position of `WindowOriginMarker` (a view filling the app's root, mounted
  in `app/_layout.tsx`), measured the same way, so the offset cancels out on any phone. Measuring the
  Modal's own layer does NOT work: inside the Modal it reads 0 (tried 12 Nov, still wrong on the POCO).
- **A bottom sheet in a Modal: `ModalSafeArea` for its insets, `SHEET_RISE` for its entrance.** Inside a
  Modal, `useSafeAreaInsets()` returns the screen's insets from outside it, which left the reaction
  breakdown's pills under the POCO's three-button bar. The native `SafeAreaView` fixed that but padded a
  frame late, so the sheet grew mid-rise and jumped. Wrap the Modal's content in `ModalSafeArea`
  (`src/components/ModalSafeArea.tsx`): its insets are the Modal's own, known before the first frame. And
  rise on your own clock (a shared value 0 → 1 times the measured height, `SHEET_RISE` in
  `src/lib/motion.ts`), never `SlideInDown`, which can draw the sheet in place for a frame first.
  `ReactionBreakdownSheet`, `GifPicker` and `BuyerPickerSheet` are the examples.
- **Edge-to-edge screens keep the status bar solid.** A screen that draws under the status bar (the
  community feed, the post page) renders `StatusBarGround` after its list, in its own background colour,
  so content never scrolls under the clock.
- **Keyboard inside a Modal:** wrap the Modal's content in `<KeyboardAvoider fillsModal>`, as its
  root. A `statusBarTranslucent` Modal is its own window starting at the screen's top, so the
  plain avoider (measured against the app window) lifted the buyer picker a status bar too far
  and left a gap above the keyboard.
- **RN 0.88 strict types (SDK 58):** a ref is typed by its *instance*, not the component:
  `useRef<ViewInstance>`, `ScrollViewInstance`, `TextInputInstance` (type imports from
  `react-native`), never `useRef<View>`. List tokens are `ListViewToken` (not generic). Deep imports
  from `react-native/Libraries/*` are type errors.
- **Gestures/animation:** reanimated v4 + `react-native-worklets` + gesture-handler are installed and
  configured. `GestureHandlerRootView` wraps the app in `app/_layout.tsx`; worklet transforms come
  from babel-preset-expo (see the no-babel.config.js note above). `SwipeCard`/`SwipeDeck` use them.
  `Skeleton` still uses core `Animated` (fine to keep). Gesture-handler is v3: the `Gesture.Pan()`-style builder
  still works but is deprecated in favour of hooks (`usePanGesture`, …). New code may use either;
  migrating the existing gestures is its own task.
- **A gesture that only watches touches is `Gesture.Pan().manualActivation(true)`, never
  `Gesture.Manual()`.** Ending a Manual gesture with its state manager (`manager.fail()`/`end()`)
  from inside `onTouches*` closed the app on Android (chat screen, 25 Oct). A never-activated Pan
  is failed by gesture-handler itself on finger up and cancelled by a scroll. See WATCH-ONLY
  GESTURES in `app/chat/[contactId].tsx`.
- **Every gesture chain starts with `Gesture.X()` written out at the call site, never a helper
  that returns one.** The worklets Babel plugin only turns the callbacks into worklets when it
  can see `Gesture.Pan()` (etc.) at the head of the chain. Behind `watchOnlyGesture()` they ran
  on the JS thread, and gesture-handler logged "None of the callbacks in the gesture are
  worklets" once per mounted chat row, which made the phone lag (26 Oct).
- **Leave a screen through `useLeaveOnce()`** (`src/hooks/useLeaveOnce.ts`) when its back calls
  `router.back()` / `dismiss()`. Those calls are queued, so a second back before the first
  runs passes `canGoBack()` and sends a second GO_BACK ("not handled by any navigator", or it
  pops the screen underneath).
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

- Typography: Inter for UI and body text; Bree Serif (Regular 400 only) for
  headings, brand, the SOLD stamp and all prices. Same on web and app.
  Never apply a bold weight to Bree Serif.
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
Before ANY UI work, read DESIGN.md fully. Its tokens (`src/theme/index.ts`) are canonical.

- Animation default: react-native-reanimated (timing curves, entering/exiting, layout transitions; no
  bouncing entrances, see DESIGN.md "Motion") +
  react-native-gesture-handler for swipe/drag. All animation on the UI thread — never setState/JS timers.
- Moti: simple one-off fade/slide only. Lottie: hero moments only (onboarding, success, empty states) — never on feeds.
- Premium effects: @shopify/react-native-skia for gradients/glows/celebrations — never inside list rows.
  expo-blur + expo-linear-gradient for glass/depth.
- **Installed today:** reanimated, gesture-handler, expo-linear-gradient, expo-haptics. Moti, Lottie,
  Skia and expo-blur are not installed yet; add one (`npx expo install …`) when a screen first needs it.
- Every Pressable: press feedback (a 0.97 scale, or the pressed style the screen already uses) and an
  expo-haptics light impact where it fits. There is no shared `PressableScale` component yet.
- Lists: expo-image with blurhash placeholders and fixed 4:5 ratios; skeletons over spinners;
  no layout animations inside FlatList rows. Target 60fps on mid-range Android.
- Safe areas + keyboard handling on every screen. Respect ReducedMotionConfig.
- After building a screen: **don't verify it with screenshots** (see Workflow). Run `npx tsc --noEmit`,
  then list what the owner should check on the phone, light and dark mode included.