# Yahora Design System — Mobile App (DESIGN.md)

> **How this file is used:** This is the canonical design source for the Yahora mobile repo (Expo SDK 56, TypeScript, Expo Router).
> Add this line to CLAUDE.md: `Before ANY UI work, read DESIGN.md fully and follow it. Its tokens are canonical.`
> If existing code conflicts with these tokens, flag the conflict — never silently invent a third value.
> Hex values are the proposed v1 identity (shared with the web repo); once tuned by Vishwajeet/Neeraj, this file wins.

---

## 1. What Yahora is (design context)

A **verified, student-only campus marketplace with a social feed** for Indian universities (IIITDM Kurnool, NIET Greater Noida first). Users are 17–24, on mid-range Android phones and iPhones, price-sensitive, trust-driven ("everyone here is a verified student from my campus").

**Design direction (the thesis):**
> *"The hostel notice board, rebuilt for 2026."* Clean photo-first surfaces, confident ink typography with Indian type heritage, one highlighter-yellow accent used like a real highlighter. Friendly, fast, tactile. Never corporate, never a gray OLX clone.

**Avoid the three AI-default looks:** (1) warm-cream + serif + terracotta, (2) near-black + acid-green accent, (3) newspaper hairlines + zero radius. Yahora is none of these — near-white photo surfaces, condensed Indian grotesque display type, highlighter-yellow accent. If a screen drifts toward those looks, stop and correct.

**The native-feel bar:** every screen should feel like it belongs on the phone — real spring physics, haptics on meaningful actions, safe-area aware, 60fps always. If an animation ever competes with scrolling or input, the animation loses.

---

## 2. Design tokens (`src/theme/tokens.ts` — canonical)

Never hardcode a color, radius, spacing, or duration in a component. Import from the theme.

```ts
export const palette = {
  light: {
    paper:    '#FCFBF7',  // screen background — photo-friendly near-white
    surface:  '#FFFFFF',  // cards, sheets, inputs
    surface2: '#F4F1E8',  // chips, subtle fills
    ink:      '#1C1A15',  // primary text
    ink2:     '#6F6A5D',  // secondary text
    line:     '#E7E3D7',  // hairline borders
    mark:     '#FFD43B',  // THE accent — highlighter yellow
    markSoft: '#FFF3C4',
    verified: '#0E7C55',
    danger:   '#D6453D',
    warn:     '#DB8B00',
  },
  dark: {
    paper:    '#141310',
    surface:  '#1D1B16',
    surface2: '#26231B',
    ink:      '#F1EEE5',
    ink2:     '#A9A392',
    line:     '#343023',
    mark:     '#FFD84D',
    markSoft: '#3A3316',
    verified: '#35B980',
    danger:   '#EF6B5E',
    warn:     '#F0A62E',
  },
} as const;

export const radius = { r1: 6, r2: 10, r3: 16, pill: 999 } as const;

export const space = { s1: 4, s2: 8, s3: 12, s4: 16, s5: 24, s6: 32, s7: 48 } as const;

// Reanimated spring presets — the only three springs in the app
export const springs = {
  press:  { damping: 20, stiffness: 320 },  // touch feedback
  snappy: { damping: 18, stiffness: 240 },  // entrances, sheets, toggles
  gentle: { damping: 22, stiffness: 140 },  // large layout moves
} as const;

export const durations = { fast: 140, base: 240, slow: 400 } as const;
```

Theming: resolve `light`/`dark` from `useColorScheme()` through one `useTheme()` hook. Components never import `palette` directly — always via the hook. Dark elevation = 1px `line` border, not shadows.

---

## 3. Typography

| Role | Face | Weights | Load via |
|---|---|---|---|
| Display | **Khand** (Indian Type Foundry) | 500 / 600 / 700 | `@expo-google-fonts/khand` |
| Body / UI | **Instrument Sans** | 400 / 500 / 600 | `@expo-google-fonts/instrument-sans` |

- Load with `useFonts` at the root; hold the splash screen until loaded. Exactly two families.
- **Banned:** Inter, Roboto, Arial, San Francisco/system default as the visible design face (system font may remain only in OS-level UI we don't control).
- Scale (pt): display 32 · title 24 · heading 20 · body 16 · small 14 · caption 12 · price-lg 22. Line-height ≈1.15 display/title, 1.45 body.
- ALL-CAPS labels (chips, eyebrows): Instrument Sans 600, 11–12pt, letterSpacing 0.6.
- **Prices are a feature:** Khand 600, `₹`, formatted with `Intl.NumberFormat('en-IN')` → ₹1,250 · ₹1,20,000.
- Khand also covers Devanagari — keep it as the display face when Hindi UI ships.

---

## 4. Color rules

- Light is default; full dark mode required on every screen from day one.
- `mark` is a **highlighter, not paint**: primary CTA, active tab/filter, selection, the price tag, one moment per screen. **≤10% of any screen.** Text on `mark` is always `ink`.
- `verified` appears only for verification/success — it is the trust color; never decorative.
- Listing photos stay untinted; UI around them stays quiet.

---

## 5. Motion (Reanimated is the default)

- All animation runs on the UI thread via **react-native-reanimated** worklets. **Never** drive animation with `setState`, JS timers, or the Animated JS driver.
- **Press feedback (every Pressable in the app):** scale to 0.97 with `springs.press` + `expo-haptics` light impact on press-in. Build one `PressableScale` component and reuse it everywhere.
- **Screen entrances:** on first focus only — `FadeInDown` (8–12px) with `springs.snappy`, stagger 50ms, **max 6 choreographed items**; everything else appears instantly. Never re-run on tab revisits.
- **Layout changes** (filter chips, expanding cards): Reanimated layout transitions with `springs.gentle`. **Never inside FlatList rows.**
- **Gestures:** react-native-gesture-handler + Reanimated for swipe/drag (dismiss sheets, image galleries). Gestures track the finger 1:1 and release with a spring — no duration-based fake gestures.
- **The highlight sweep (signature motion):** selected tabs/filters animate a `mark` background in from the left (`scaleX`, origin left, ~140ms). Yahora's selection identity — reuse everywhere.
- **Moti** allowed only for simple one-off fade/slide. **Lottie** (`lottie-react-native`) only for hero moments: onboarding, "listing posted" success, big empty states — never on scroll-heavy screens.
- **Skia** (`@shopify/react-native-skia`) is the premium layer: celebratory moment after posting a listing, decorative header accents, subtle gradients/glows. **Never inside list rows.** `expo-blur` + `expo-linear-gradient` for lightweight glass/depth (e.g., tab bar).
- **Haptics vocabulary** (expo-haptics): light = taps/toggles · medium = destructive confirm · success notification = listing posted, verification passed. Haptics accompany meaning, not every touch move.
- Respect reduced motion: gate non-essential animation with Reanimated's `ReducedMotionConfig` / `useReducedMotion`.

---

## 6. Lists, images, performance (the marketplace lives or dies here)

- Feeds/grids: `FlatList` (or FlashList if adopted) with fixed-size items, `keyExtractor`, memoized row components. No anonymous inline renderItem closures.
- **Images: `expo-image`** with `placeholder={blurhash}` (store blurhash per listing), `transition={200}`, `contentFit="cover"`, fixed 4:5 ratio, `recyclingKey`. Zero layout shift, ever.
- **Skeletons, not spinners,** for content areas — shimmer placeholders matching the real card layout. Spinners only inside buttons.
- Target 60fps on a mid-range Android phone. If a screen stutters, cut animation before cutting content.

---

## 7. Signature elements & component recipes

**The price tag (signature #1):** tag-shaped chip — `mark` background, `ink` Khand 600 text, radius `r2`, small punched "tag hole" (5px `paper` circle, absolutely positioned left). Used everywhere a price appears.

**The verified stamp (signature #2):** compact badge — 1.5px `verified` border, `verified` check + "VERIFIED" caps 10–11pt, transparent fill. On profiles and listing cards; never restyled per screen.

**Listing card:** image (4:5, expo-image) → title (body 500, 2 lines) → price tag → seller row (20px avatar, name, verified stamp) → campus chip. Press = PressableScale.

**Feed post:** avatar + name + verified + timestamp (caption, `ink2`) → text → optional media → action row (44pt hit areas). Active reactions fill `markSoft`.

**Buttons:** Primary = `mark` bg, `ink` text, radius `r2`, height 48, Instrument Sans 600. Secondary = transparent + 1px `line`. Destructive = `danger`. All via PressableScale + haptic.

**Sheets & modals:** bottom sheets with grabber, radius `r3` top corners, spring in (`snappy`), swipe-to-dismiss via gesture. Prefer sheets over full-screen modals for filters, options, quick actions.

**Tab bar:** 5 tabs max, active tab uses the highlight sweep + `ink` icon; inactive `ink2`. Safe-area padded. Optional subtle blur (expo-blur) background.

**Empty states are invitations** (icon/illustration + one plain line + one action). Voice: campus-casual, specific, sentence case, active verbs, **never lorem ipsum**:
- Empty marketplace: "Nothing on the board yet. List something from your room — it takes a minute." → [List an item]
- Empty chat: "No messages yet. Found something you like? Say hi to the seller."
- Offline/error: "Couldn't load listings. Check your connection and try again." → [Retry]

---

## 8. Platform manners

- Safe areas everywhere (`react-native-safe-area-context`); nothing under notches or home indicators.
- Keyboard: `KeyboardAvoidingView`/equivalent on every input screen; inputs never hidden behind the keyboard.
- Pull-to-refresh on feed and marketplace. Android back button always behaves predictably with Expo Router.
- Touch targets ≥44×44pt. Text contrast ≥4.5:1 (verify `ink2` usage on tinted fills).
- Every async surface ships all four states: loading (skeleton), empty, error, success.

## 9. Anti-patterns (never)

Web hover states or cursor logic · scroll-jacking · duration-based fake gestures · layout animations inside list rows · animation driven from JS thread · autoplaying heavy Lottie/Skia on feeds · spinner-only loading · blocking touch while something animates · purple-gradient-on-white · Inter/Roboto as the design face · the three AI-default looks (§1) · more than one `mark` moment competing per screen · emoji as icons · lorem ipsum.

## 10. Pre-flight ritual (every UI task)

1. State the direction in one sentence before coding ("Building X; notice-board energy via …").
2. Build with theme tokens only; write real copy; wire all four async states.
3. Self-review: hierarchy clear? one `mark` moment? entrance choreographed (≤6, first focus only)? presses spring + haptic? 60fps-safe (UI thread only)? dark mode checked? safe areas + keyboard handled? reduced motion respected?
4. Screenshot loop: with the iOS Simulator running, capture via
   `xcrun simctl io booted screenshot /tmp/yahora-<screen>.png`,
   read the image, critique like a harsh App Store design reviewer (hierarchy, spacing, type, color, native feel — score /10), implement the top fixes, re-capture to confirm. Check light and dark.
