import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { MAX_FONT_SCALE } from '../theme';

/**
 * <TextInput> with the app's font-scale cap applied by default.
 *
 * Inputs scale with the OS setting exactly like Text does, and several of ours
 * sit in fixed-height pills (the marketplace search bar, the chat composer, the
 * modal search rows) — so an uncapped multiplier clips the caret and the
 * placeholder rather than growing the field. Same cap, same reasoning, same
 * escape hatches as AppText; see MAX_FONT_SCALE in src/theme.
 *
 * The ref is forwarded to the underlying TextInput, so .focus(), .blur() and
 * .clear() work as they always did.
 */
export const AppTextInput = forwardRef<React.ComponentRef<typeof TextInput>, TextInputProps>(
  function AppTextInput({ maxFontSizeMultiplier = MAX_FONT_SCALE, ...rest }, ref) {
    return <TextInput ref={ref} maxFontSizeMultiplier={maxFontSizeMultiplier} {...rest} />;
  },
);

export default AppTextInput;
