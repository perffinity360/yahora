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
  bg: '#F8F9FB',
  inputBg: '#F3F0EF',
  inputBorderFocus: '#E5C8E5',
  mutedText: '#6B6879',
  mutedLabel: '#9791A1',
  mutedPlaceholder: '#BBB6C8',
  errorBg: '#FEF0F0',
  errorText: '#B91C1C',
  successBg: '#F0FDF4',
  successText: '#15803D',
  hairline: '#EEE6E2',
  demoCardPurpleBg: '#E5DBF5',
  demoCardPinkBg: '#F0DCE2',

  // Aurora / glassmorphism surfaces (translucent, intentional rgba)
  auroraTop: '#FBEFF3',
  auroraBottom: '#F4E0E4',
  // Opaque card surface. Android renders a translucent bg + elevation as a hard
  // square, so cards use this solid colour to keep their rounded corners.
  cardSurface: '#FCF8FC',
  glassBorder: 'rgba(255,255,255,0.75)',
  scrim: 'rgba(11,11,11,0.55)',
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
