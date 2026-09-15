export const colors = {
  purple: '#800080',
  purpleDark: '#4f014f',
  purpleLight: '#d700d7',
  pink: '#FF78A6',
  pinkDark: '#EB487F',
  pinkLight: '#FFF4F7',
  pinkBg: '#F4E0E4',
  blue: '#2BB7FF',
  blueDark: '#0B93D8',
  blueLight: '#6FE1FF',
  black: '#0B0B0B',
  blackSoft: '#1A1A1A',
  white: '#FFFFFF',
  // Flat fallback behind the app screens. Kept because a few borders reference
  // it, and because a gradient needs a solid colour under it for the frame
  // before it paints. The screens themselves use ScreenGradient (below).
  bg: '#F8F9FB',

  // THE APP CANVAS — marketplace, messages, dashboard, chat, product, public
  // profile. A pink-to-lilac wash so the main screens sit in the same family as
  // the blush aurora instead of on flat cool white, which is what #F8F9FB alone
  // reads as.
  //
  // NOT animated: these screens scroll long FlashLists, and four drifting glow
  // images behind a feed is exactly the "never inside list rows" case in
  // DESIGN.md. One static gradient, three stops.
  //
  // ── THE THING TO UNDERSTAND BEFORE RETUNING THESE ──
  // The first attempt (#FDF8FB -> #F0EAF4) was invisible on a phone, and the
  // instinct is to fix that by making the bottom darker. That is the wrong
  // knob, and it is the one that breaks accessibility: body text is
  // mutedText #6B6879, which needs a background luminance of 0.8233 to hold
  // 4.5:1, and darkening is exactly what spends that budget.
  //
  // What was actually wrong was CHROMA. The old stops were 56% and 31%
  // saturation — near-neutral, so the eye read them as white. These are 100%
  // saturation at the same lightness (97% and 95%), which is plainly tinted
  // while costing almost no luminance. The hue also travels 332deg pink ->
  // 266deg lilac, and a hue shift is far easier to see than a lightness shift.
  //
  // Measured across the whole ramp: mutedText never drops below 4.51:1. If you
  // want more presence, push SATURATION or widen the hue travel. Do not lower
  // lightness — #ECE4FF, only four steps darker, already fails at 4.41:1.
  appBgTop: '#FFF0F7',
  appBgMid: '#FBE9F8',
  appBgBottom: '#F1E6FF',
  inputBg: '#F3F0EF',
  inputBorderFocus: '#E5C8E5',
  mutedText: '#6B6879',
  mutedLabel: '#9791A1',
  mutedPlaceholder: '#BBB6C8',
  errorBg: '#FEF0F0',
  errorText: '#B91C1C',
  successBg: '#F0FDF4',
  successText: '#15803D',
  // Swipe-deck decision stamps (bright, mirrors the web's LIKE/PASS colours).
  swipeLike: '#4ADE80',
  swipePass: '#F87171',
  hairline: '#EEE6E2',
  demoCardPurpleBg: '#E5DBF5',
  demoCardPinkBg: '#F0DCE2',

  // Aurora / glassmorphism surfaces (translucent, intentional rgba)
  //
  // THE BLUSH CANVAS. This is the app's signature background, shared by
  // onboarding, sell and edit-profile. It was briefly replaced with a cool
  // pearl (#F9F7FC -> #ECE8F5) and desaturated glows; that read as white rather
  // than as Yahora, so it is back. Do not "calm" it again — if a screen needs a
  // different mood, give it a variant in AuroraBackground instead of retuning
  // the shared one.
  auroraTop: '#FBEFF3',
  auroraBottom: '#F4E0E4',

  // THE SIGN-IN CANVAS (`<AuroraBackground variant="signin" />`, login only).
  //
  // Deeper and more saturated than the blush above: the login screen is the
  // first thing anyone sees and it is mostly empty space around one card, so it
  // can carry colour that a form-filling screen cannot.
  //
  // Three stops, and the order matters. It stays pale through the top half,
  // which is where the serif headline and the grey tagline sit — those are dark
  // text on this background and lose contrast fast if the colour arrives too
  // early. The saturation lands in the lower half, behind and below the
  // near-white card, so the card reads as lifted off a coloured ground.
  //
  // CONTRAST, measured rather than eyeballed (WCAG AA, and these are the
  // numbers to keep if you retune): the tagline #6B6879 sits about 35% down,
  // where the blend is #FBEAF7 -> 4.69:1, over the 4.5 bar for body text. The
  // headline's pink end #EB487F reads 3.16:1 there, over the 3.0 bar it needs
  // as 30px large text. The bottom stop is the deepest colour on the screen and
  // carries no small text — only the near-white card and the purple footer
  // note, which is 6.24:1. Darkening the top two stops is what breaks this.
  signinTop: '#FFF2F8',
  signinMid: '#F9E7F6',
  signinBottom: '#DCCBF6',
  // Opaque card surface. Android renders a translucent bg + elevation as a hard
  // square, so cards use this solid colour to keep their rounded corners.
  cardSurface: '#FCF8FC',
  glassBorder: 'rgba(255,255,255,0.75)',
  scrim: 'rgba(11,11,11,0.55)',
  // Fullscreen photo viewer: near-opaque backdrop + a translucent close chip.
  viewerScrim: 'rgba(11,11,11,0.92)',
  viewerCloseBg: 'rgba(255,255,255,0.18)',
} as const;

// Condition-badge palette (item-quality semantics), mirroring the web
// ProductCard's CONDITION_CONFIG. Kept here so no component hardcodes hexes.
export const conditionColors = {
  Mint: { bg: colors.blue, text: colors.white },
  'Like New': { bg: '#4ADE80', text: '#052E16' },
  Good: { bg: '#FACC15', text: '#1A1100' },
  Fair: { bg: '#FB923C', text: colors.white },
  Poor: { bg: '#F87171', text: colors.white },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
} as const;

export const font = {
  // Mirrors the website: Inter for UI/body, Bree Serif for headings + brand.
  // Each weight is a distinct loaded family (RN does not synthesize weights for
  // custom fonts), so set `family.*` rather than relying on `fontWeight`.
  family: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    extrabold: 'Inter_800ExtraBold',
    serif: 'BreeSerif_400Regular',
  },
  sizes: {
    sm: 13,
    md: 15,
    lg: 18,
    xl: 24,
    xxl: 30,
  },
} as const;

export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Font = typeof font;
