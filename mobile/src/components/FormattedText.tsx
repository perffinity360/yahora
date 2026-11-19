import { Fragment, type ReactNode, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { parseFormatted, type FormatNode } from '../lib/textFormat';
import { font } from '../theme';
import { AppText } from './AppText';

/**
 * ── FORMATTED TEXT (WhatsApp-style) ──
 *
 * Draws *bold*, _italic_, ~strike~, `code`, ```monospace```, bullets,
 * numbered items and quotes, with tappable links —
 * docs/design/TEXT_FORMAT_SPEC.md. The rules live in src/lib/textFormat.ts;
 * this file is only the look. The web twin is
 * frontend/src/components/FormattedText/FormattedText.jsx.
 *
 * Text with no bullets, numbers or quotes stays ONE Text, as it always was, so
 * nothing about how a message wraps, selects or takes a tap changes. Bullets,
 * numbers and quotes need a row each (a marker column, a bar), so a message
 * with one of them is drawn as a column of lines.
 *
 * Bold and italic are real font files (font.family.*): React Native doesn't
 * make a custom font bold or slanted on its own.
 */

interface Props {
  content: string;
  /** The text's own look: font, size, line height, colour. */
  style: StyleProp<TextStyle>;
  /** A link's colour; the underline is added here. */
  linkStyle?: StyleProp<TextStyle>;
  onOpenLink?: (url: string) => void;
  /** Plain runs only; the chat draws emoji larger with it. Not used inside code. */
  renderText?: (text: string) => ReactNode;
  /** Inline code's tint: the text's colour at 12% (colors.formatCode*). */
  codeBackground: string;
  /** A quote's bar: the text's colour at 45% (colors.formatQuoteBar*). */
  quoteBar: string;
}

interface Marks {
  bold: boolean;
  italic: boolean;
  strike: boolean;
}

interface Context {
  renderText: (text: string) => ReactNode;
  linkStyle?: StyleProp<TextStyle>;
  onOpenLink?: (url: string) => void;
  code: TextStyle;
  mono: TextStyle;
}

const NO_MARKS: Marks = { bold: false, italic: false, strike: false };
const asIs = (text: string): ReactNode => text;

function familyFor(marks: Marks): string | undefined {
  if (marks.bold && marks.italic) return font.family.boldItalic;
  if (marks.bold) return font.family.bold;
  if (marks.italic) return font.family.italic;
  return undefined;
}

function renderNodes(nodes: FormatNode[], marks: Marks, ctx: Context, key: string): ReactNode[] {
  return nodes.map((node, i) => {
    const k = `${key}${i}`;
    switch (node.type) {
      case 'text':
        return <Fragment key={k}>{ctx.renderText(node.text)}</Fragment>;
      case 'link':
        return (
          <AppText
            key={k}
            accessibilityRole="link"
            style={[ctx.linkStyle, marks.strike ? styles.linkStruck : styles.link]}
            onPress={() => ctx.onOpenLink?.(node.href)}
          >
            {ctx.renderText(node.text)}
          </AppText>
        );
      case 'mono':
        return (
          <AppText key={k} style={ctx.mono}>
            {node.text}
          </AppText>
        );
      case 'code':
        return (
          <AppText key={k} style={ctx.code}>
            {node.text}
          </AppText>
        );
      default: {
        const next = { ...marks, [node.type]: true };
        return (
          <AppText key={k} style={[{ fontFamily: familyFor(next) }, next.strike && styles.strike]}>
            {renderNodes(node.children, next, ctx, `${k}.`)}
          </AppText>
        );
      }
    }
  });
}

export function FormattedText({
  content,
  style,
  linkStyle,
  onOpenLink,
  renderText = asIs,
  codeBackground,
  quoteBar,
}: Props) {
  const lines = useMemo(() => parseFormatted(content), [content]);
  // Code is a size smaller than the text around it, as on the web (0.9em).
  const baseSize = StyleSheet.flatten(style)?.fontSize;
  const monoSize = baseSize ? Math.round(baseSize * 0.9) : undefined;
  const ctx: Context = {
    renderText,
    linkStyle,
    onOpenLink,
    mono: { fontFamily: font.family.mono, fontSize: monoSize },
    code: { fontFamily: font.family.mono, fontSize: monoSize, backgroundColor: codeBackground },
  };

  if (lines.every((line) => line.kind === 'text')) {
    return (
      <AppText style={style}>
        {lines.map((line, i) => (
          <Fragment key={i}>
            {i > 0 ? '\n' : null}
            {renderNodes(line.nodes, NO_MARKS, ctx, `${i}.`)}
          </Fragment>
        ))}
      </AppText>
    );
  }

  return (
    <View>
      {lines.map((line, i) => {
        // An empty line still takes a line's height.
        const body = line.nodes.length ? renderNodes(line.nodes, NO_MARKS, ctx, `${i}.`) : ' ';
        if (line.kind === 'bullet' || line.kind === 'number') {
          return (
            <View key={i} style={styles.item}>
              <AppText style={[style, styles.marker]}>{line.kind === 'bullet' ? '•' : line.marker}</AppText>
              <AppText style={[style, styles.itemText]}>{body}</AppText>
            </View>
          );
        }
        if (line.kind === 'quote') {
          return (
            <View key={i} style={[styles.quote, { borderLeftColor: quoteBar }]}>
              <AppText style={style}>{body}</AppText>
            </View>
          );
        }
        return (
          <AppText key={i} style={style}>
            {body}
          </AppText>
        );
      })}
    </View>
  );
}

/* The web's numbers (FormattedText.module.css): a 3 px bar and 10 px to the
   text; a marker column about 10 px wide, then 6. */
const styles = StyleSheet.create({
  link: { textDecorationLine: 'underline' },
  linkStruck: { textDecorationLine: 'underline line-through' },
  strike: { textDecorationLine: 'line-through' },
  item: { flexDirection: 'row' },
  marker: { minWidth: 10, marginRight: 6, textAlign: 'center' },
  itemText: { flexShrink: 1 },
  quote: { borderLeftWidth: 3, borderRadius: 2, paddingLeft: 7 },
});
