import { forwardRef, useMemo } from 'react';
import { Platform, StyleSheet, type TextInputProps, type TextStyle } from 'react-native';

import { formatSpans, type FormatSpan } from '../lib/textFormat';
import { colors, font } from '../theme';
import { AppText } from './AppText';
import { AppTextInput } from './AppTextInput';

/**
 * ── FORMATTED INPUT (WhatsApp-style, while typing) ──
 *
 * A text box that shows the formatting as it is typed —
 * docs/design/TEXT_FORMAT_SPEC.md §5.4. It is AppTextInput (so the font-scale
 * cap, the ref, onSelectionChange and every other prop work as before), but
 * instead of `value` it draws the text as styled Text children, one per span
 * from formatSpans (src/lib/textFormat.ts). The spans joined are the text, so
 * the value is exactly what was typed: only its look changes.
 *
 *   symbols  the text colour at 45% (colors.formatSymbolInput)
 *   bold     Inter_700Bold · italic Inter_400Regular_Italic · both Inter_700Bold_Italic
 *   strike   line-through · links underlined
 *   code and monospace  font.family.mono, on colors.formatCode* (codeBackground)
 *
 * Sizes never change, so a line never grows or shrinks while typing.
 *
 * LIVE_FORMAT turns the look off on one platform (the text is then one plain
 * child) if it ever proves unreliable there; spec §5.4 must say so.
 */

const LIVE_FORMAT = Platform.select({
  ios: true,
  android: true,
  default: true,
});

type Props = TextInputProps & {
  /** Inline code's tint (colors.formatCode*). */
  codeBackground?: string;
  /** The symbols' colour: the box's text colour at 45%. */
  symbolColor?: string;
};

function familyFor(span: FormatSpan): string | undefined {
  if (span.code || span.mono) return font.family.mono;
  if (span.bold && span.italic) return font.family.boldItalic;
  if (span.bold) return font.family.bold;
  if (span.italic) return font.family.italic;
  return undefined;
}

function lookOf(span: FormatSpan, codeBackground: string, symbolColor: string): TextStyle | undefined {
  const lines = [span.strike && 'line-through', span.link && 'underline'].filter(Boolean);
  const look: TextStyle = {
    ...(familyFor(span) ? { fontFamily: familyFor(span) } : null),
    ...(lines.length ? { textDecorationLine: lines.join(' ') as TextStyle['textDecorationLine'] } : null),
    ...(span.code ? { backgroundColor: codeBackground } : null),
    ...(span.symbol ? { color: symbolColor } : null),
  };
  return Object.keys(look).length ? look : undefined;
}

export const FormattedInput = forwardRef<React.ComponentRef<typeof AppTextInput>, Props>(
  function FormattedInput(
    { value, codeBackground = colors.formatCodeTheirs, symbolColor = colors.formatSymbolInput, ...rest },
    ref,
  ) {
    const text = value ?? '';
    const spans = useMemo(() => (LIVE_FORMAT ? formatSpans(text) : null), [text]);
    // The plain run in the box's font: no look of its own.
    const base = StyleSheet.flatten(rest.style);
    const { fontFamily, fontSize, lineHeight, color, letterSpacing } = base ?? {};

    /* The styled children depend on the text and the look only, never on the
       selection: when only the selection changes (the screen re-renders on
       every onSelectionChange) the same elements go back, so React sends the
       native box nothing. */
    const children = useMemo(
      () => (
        // Always ONE child, even when empty, so clearing the box (after Send)
        // reaches the native text.
        <AppText style={{ fontFamily, fontSize, lineHeight, color, letterSpacing }}>
          {spans
            ? spans.map((span, i) => (
                <AppText key={i} style={lookOf(span, codeBackground, symbolColor)}>
                  {span.text}
                </AppText>
              ))
            : text}
        </AppText>
      ),
      [spans, text, codeBackground, symbolColor, fontFamily, fontSize, lineHeight, color, letterSpacing],
    );

    return (
      <AppTextInput ref={ref} {...rest}>
        {children}
      </AppTextInput>
    );
  },
);

export default FormattedInput;
