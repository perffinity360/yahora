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
 *   bold     Inter_700Bold
 *   italic   the text colour at 70% (colors.formatItalicInput), as on the
 *            website, NOT the italic font: Android leaves out a pasted line
 *            drawn in Inter's italic font (TF-8, 21 Nov; typed was fine).
 *            Sent posts and messages keep the real italic (FormattedText).
 *   strike   line-through · links underlined
 *   code and monospace  font.family.mono, on colors.formatCode* (codeBackground)
 *
 * Sizes never change, so a line never grows or shrinks while typing.
 *
 * ON ANDROID, ONE LINE ONLY (owner's choice, 21 Nov). Once the text has a line
 * break, the Android box shows it plain, exactly as typed. A multi-line text
 * that arrived in one go (a paste) came out of Android's layout with its line
 * breaks in the wrong places once it was drawn in styled pieces, although the
 * pieces joined to exactly the right text; emptying the box first didn't help.
 * Typing one line keeps live formatting; iOS keeps it at any length. Sent
 * posts and messages are always fully formatted (FormattedText).
 *
 * LIVE_FORMAT turns the look off on one platform (the text is then one plain
 * child) if it ever proves unreliable there; spec §5.4 must say so.
 */

const LIVE_FORMAT = Platform.select({
  ios: true,
  android: true,
  default: true,
});

/** Android: no live formatting once the text has a line break (see the top). */
const PLAIN_WHEN_MULTILINE = Platform.OS === 'android';

type Props = TextInputProps & {
  /** Inline code's tint (colors.formatCode*). */
  codeBackground?: string;
  /** The symbols' colour: the box's text colour at 45%. */
  symbolColor?: string;
  /** Italic's colour: the box's text colour at 70%. */
  italicColor?: string;
};

function familyFor(span: FormatSpan): string | undefined {
  if (span.code || span.mono) return font.family.mono;
  // Italic is a colour here, never the italic font (see the top).
  if (span.bold) return font.family.bold;
  return undefined;
}

function lookOf(
  span: FormatSpan,
  codeBackground: string,
  symbolColor: string,
  italicColor: string,
): TextStyle | undefined {
  const lines = [span.strike && 'line-through', span.link && 'underline'].filter(Boolean);
  const look: TextStyle = {
    ...(familyFor(span) ? { fontFamily: familyFor(span) } : null),
    ...(lines.length ? { textDecorationLine: lines.join(' ') as TextStyle['textDecorationLine'] } : null),
    ...(span.code ? { backgroundColor: codeBackground } : null),
    // The symbols' 45% wins over italic's 70%.
    ...(span.symbol ? { color: symbolColor } : span.italic ? { color: italicColor } : null),
  };
  return Object.keys(look).length ? look : undefined;
}

export const FormattedInput = forwardRef<React.ComponentRef<typeof AppTextInput>, Props>(
  function FormattedInput(
    {
      value,
      codeBackground = colors.formatCodeTheirs,
      symbolColor = colors.formatSymbolInput,
      italicColor = colors.formatItalicInput,
      ...rest
    },
    ref,
  ) {
    const text = value ?? '';

    const live = LIVE_FORMAT && !(PLAIN_WHEN_MULTILINE && text.includes('\n'));
    const spans = useMemo(() => (live ? formatSpans(text) : null), [live, text]);
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
                <AppText key={i} style={lookOf(span, codeBackground, symbolColor, italicColor)}>
                  {span.text}
                </AppText>
              ))
            : text}
        </AppText>
      ),
      [spans, text, codeBackground, symbolColor, italicColor, fontFamily, fontSize, lineHeight, color, letterSpacing],
    );

    return (
      <AppTextInput ref={ref} {...rest}>
        {children}
      </AppTextInput>
    );
  },
);

export default FormattedInput;
