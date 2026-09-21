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
  // ── MESSAGES, ported from the web so the two clients look like one product ──
  //
  // frontend/src/pages/messages/Messages.module.css is the source of truth for
  // these four values; if it changes, change them here too.
  //
  // Inbox list = `.inboxSidebar`, a 170deg three-stop ramp with a magenta glow
  // off the top-right and a pink one off the bottom-left.
  inboxTop: '#FDF8FF',
  inboxMid: '#F8F0FF',
  inboxBottom: '#FFF4F9',
  // Chat thread = `.messagesContainer`, a lavender ground carrying a purple
  // glow at the top-left and a blue one at the bottom-right. Noticeably deeper
  // than any other canvas in the app, and deliberately so: the bubbles are what
  // should read as raised, which needs a ground dark enough to lift off.
  //
  // The web also lays a fine dot grain over this. There is no grain here — it
  // would mean shipping a tiled asset for an effect that is nearly invisible at
  // phone density, so the ground and the glows carry the look on their own.
  chatCanvas: '#EDE6F5',

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
  /**
   * THE TYPE SCALE. Phase 5 Block V-C, 2026-09-20.
   *
   * Eight sizes, and they are the only sizes. Before this block the app used
   * TWENTY distinct hardcoded fontSize values across 224 call sites (8, 8.5, 9,
   * 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 16, 17, 18, 19,
   * 22, 23, 24, 28, 30, 34, 40) while this token block sat largely unused.
   *
   * ── WHY TWENTY SIZES IS THE PROBLEM, NOT A DETAIL ──
   * When 13, 14 and 15 all appear on one screen the eye cannot rank them, so
   * nothing reads as more important than anything else. That flatness is what
   * the founders were seeing as "cluttered". Hierarchy is made of GAPS: the
   * jumps below (11 -> 12 -> 13 -> 14 -> 16 -> 20 -> 24) are each big enough to
   * be legible as a step.
   *
   * ── THE FLOOR, AND ITS ONE EXCEPTION ──
   * `micro` (11) is the floor for anything a student READS — labels, counts,
   * timestamps, helper text, every line of copy. Android's font slider goes
   * DOWN as well as up: at 0.85 an 11dp label already renders at 9.35dp. The 22
   * call sites that used to sit at 8-10dp were the strongest "cheap app" signal
   * in the product, and they are not coming back.
   *
   * `nano` (9) is the one token allowed below that floor, and as of 2026-09-21
   * it has NO call sites. It briefly carried the condition pill on ProductCard;
   * that card was reverted, and the pill is back at `micro` with it. The token
   * stays for the one shape that could ever justify 9dp — a few uppercase
   * characters, bold, in their own saturated pill, read as a colour-coded chip
   * rather than as text. Nothing else qualifies. If you are reaching for `nano`
   * for a label, a count or anything inside a sentence, the answer is `micro`.
   *
   * The scale moved DOWN at the top (40/34/30 -> 24) and UP at the bottom
   * (8/10 -> 11): airier where it was shouting, readable where it was mumbling.
   *
   * Pair with MAX_FONT_SCALE (below) — these are the sizes BEFORE the student's
   * own font setting multiplies them.
   */
  sizes: {
    /** 9 — below the floor, currently unused. Read the note above first. */
    nano: 9,
    micro: 11,
    caption: 12,
    body: 13,
    bodyLg: 14,
    title: 16,
    headline: 20,
    display: 24,
  },
} as const;

export type Colors = typeof colors;
export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type Font = typeof font;

/**
 * THE FONT-SCALE CAP. Phase 5 Block V-B, decided 2026-09-19.
 *
 * Android's Settings > Display > Font size multiplies every <Text> by up to
 * ~1.30 (iOS Dynamic Type goes further still). Our layouts start failing at
 * roughly 1.15: the product-card stats row overlaps itself and the auth
 * headline runs into the settings gear on a Galaxy A03s at DEFAULT font size.
 * 1.15 is therefore the largest multiplier the current layouts survive, not a
 * taste decision.
 *
 * ── IT IS A CAP, NOT A DISABLE ──
 * `allowFontScaling={false}` appears nowhere in this app and must not be added.
 * A student who needs larger text still gets larger text — up to 15% — and the
 * app stays usable for them. Turning scaling off entirely would make it
 * unreadable for exactly the people the setting exists for.
 *
 * ── WHY NOT THE 1.3 THAT USED TO BE IN ProductCard ──
 * `DENSE_TEXT_SCALE_CAP = 1.3` (removed in this block) clamped at the value
 * Android's own slider already tops out at, so it bound nothing on any real
 * device. It read as a fix in review and behaved as a no-op. If you ever raise
 * the number here, check it against the slider's real maximum before assuming
 * it does anything.
 *
 * Applied globally through AppText / AppTextInput, not per call site — a cap
 * that has to be remembered is a cap that gets forgotten. The exceptions are
 * deliberate and few: the auth headline and the empty-state messages stay on
 * plain <Text> because they have room to grow, and they honour the student's
 * setting in full.
 */
export const MAX_FONT_SCALE = 1.15;
