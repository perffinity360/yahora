import { memo, useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '../../theme';

/**
 * The Global feed's globe (COMMUNITY_SPEC.md §1.1), drawn in colour because it
 * sits among flag emoji: a blueLight → blueDark ocean, communityGlobeLand
 * continents, a grid of white lines (without it the disc reads as a ball), a
 * shade to the lower right, a shine and a thin rim. The same drawing as the
 * website's GlobeIcon (frontend/src/components/community/AnimatedIcons).
 */
const LAND = [
  // The Americas
  'M4.2 7.6C5.4 5.9 7.8 5 9.8 5.2C10.4 5.9 9.9 6.9 9.4 7.5C8.8 8.1 8.3 8.7 8.6 9.6C8.8 10.4 8.3 11.2 7.9 11.6C8.9 12.1 10.2 12.8 10.4 14.3C10.6 15.9 9.5 17.6 8.5 19.4C8.1 18.6 7.7 17.4 7.3 16.1C6.9 14.8 6.5 13.6 6.6 12.6C6.6 11.7 5.6 11.2 4.9 10.5C4.3 9.8 3.9 8.6 4.2 7.6Z',
  // Europe
  'M12.9 5.8C13.8 4.9 16 4.6 17.4 5.4C17.8 6.1 17.1 6.9 16.2 7.1C15.2 7.3 14.4 7.6 13.6 7.5C12.9 7.3 12.6 6.5 12.9 5.8Z',
  // Africa
  'M12.3 9.7C13 8.9 14.8 8.5 16.5 8.9C17.7 9.3 18.5 10.4 18 11.6C17.5 12.6 16.8 13.4 16.5 14.6C16.2 15.9 15.6 17.2 14.8 17.9C14.1 17.5 13.9 16.2 13.6 15C13.3 13.9 12.5 13.2 12.2 12.1C12 11.2 11.9 10.3 12.3 9.7Z',
  // Asia
  'M18.4 6.3C19.4 6.1 20.6 6.9 21.3 8C21.6 9 21.1 9.9 20.2 9.9C19.4 9.9 18.7 9.3 18.3 8.5C17.9 7.7 17.9 6.8 18.4 6.3Z',
  // Australia
  'M18.9 15.2C19.7 14.6 21 14.8 21.3 15.6C21.2 16.5 20.3 17.1 19.4 16.9C18.8 16.6 18.5 15.8 18.9 15.2Z',
];

export const GlobeIcon = memo(function GlobeIcon({ size = 16 }: { size?: number }) {
  // Two globes on screen at once (the pill and the dropdown) need their own ids.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const ocean = `ocean${id}`;
  const shade = `shade${id}`;
  const face = `face${id}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <RadialGradient id={ocean} cx="0.36" cy="0.32" r="0.75">
          <Stop offset="0" stopColor={colors.blueLight} />
          <Stop offset="1" stopColor={colors.blueDark} />
        </RadialGradient>
        <RadialGradient id={shade} cx="0.34" cy="0.3" r="0.8">
          <Stop offset="0.5" stopColor={colors.communityGlobeShade} stopOpacity={0} />
          <Stop offset="1" stopColor={colors.communityGlobeShade} />
        </RadialGradient>
        <ClipPath id={face}>
          <Circle cx="12" cy="12" r="10" />
        </ClipPath>
      </Defs>
      <Circle cx="12" cy="12" r="10" fill={`url(#${ocean})`} />
      <G clipPath={`url(#${face})`}>
        <G fill={colors.communityGlobeLand}>
          {LAND.map((d) => (
            <Path key={d} d={d} />
          ))}
        </G>
        <Circle cx="12" cy="12" r="10" fill={`url(#${shade})`} />
        <G fill="none" stroke={colors.white} strokeWidth={1.1} strokeOpacity={0.7}>
          <Path d="M2 12h20" />
          <Path d="M3.3 7.2h17.4M3.3 16.8h17.4" />
          <Ellipse cx="12" cy="12" rx="4.6" ry="10" />
          <Path d="M12 2v20" />
        </G>
      </G>
      <Ellipse cx="8.4" cy="7.4" rx="3.4" ry="2" fill={colors.white} opacity={0.3} transform="rotate(-30 8.4 7.4)" />
      <Circle cx="12" cy="12" r="10" fill="none" stroke={colors.blueDark} strokeOpacity={0.55} strokeWidth={0.75} />
    </Svg>
  );
});
