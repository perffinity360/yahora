import { forwardRef } from 'react';
import { Text, type TextProps } from 'react-native';

import { MAX_FONT_SCALE } from '../theme';

/**
 * <Text> with the app's font-scale cap applied by default.
 *
 * Use this everywhere instead of React Native's Text. See MAX_FONT_SCALE in
 * src/theme for why the cap exists and why it is a cap rather than a disable.
 *
 * Every Text prop is forwarded untouched — style, numberOfLines, ellipsizeMode,
 * onPress, accessibility props, children — and so is the ref, so this is a drop
 * in replacement at the type level.
 *
 * Two escape hatches, both explicit:
 *   maxFontSizeMultiplier={1.4}   raise the cap for one element
 *   maxFontSizeMultiplier={null}  no cap at all; this element scales freely
 *
 * ⚠ Never reach for allowFontScaling={false}. That is not an escape hatch, it
 * is the thing this component exists to avoid.
 */
export const AppText = forwardRef<React.ComponentRef<typeof Text>, TextProps>(
  function AppText({ maxFontSizeMultiplier = MAX_FONT_SCALE, ...rest }, ref) {
    return <Text ref={ref} maxFontSizeMultiplier={maxFontSizeMultiplier} {...rest} />;
  },
);

export default AppText;
