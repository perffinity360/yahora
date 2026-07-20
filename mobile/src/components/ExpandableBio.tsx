import { useCallback, useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TextLayoutEventData,
  View,
} from 'react-native';

import { colors, font, spacing } from '../theme';

/** How many lines the bio is allowed to occupy before it gets truncated. */
const COLLAPSED_LINES = 2;
const OPEN_QUOTE = '“';
const CLOSE_QUOTE = '”';
const ELLIPSIS = '…';
const MORE_LABEL = 'Read more';
const LESS_LABEL = 'Read less';
// Appended after the trimmed preview; measured so we reserve room for it and the
// "Read more" link never spills onto a third line.
const TRAILING = `${ELLIPSIS} ${MORE_LABEL}`;

type Line = { text: string; width: number };

/**
 * A centered bio that never spills past two lines on its own. When the text is
 * longer, it's truncated and a "Read more" link is spliced inline at the end of
 * the second line (tap to expand in place, "Read less" to collapse). Shared by
 * the dashboard and public-profile headers so both stay in lockstep.
 */
export function ExpandableBio({ text }: { text: string }) {
  const quoted = `${OPEN_QUOTE}${text}${CLOSE_QUOTE}`;

  const [expanded, setExpanded] = useState(false);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [trailingWidth, setTrailingWidth] = useState<number | null>(null);

  // A fresh bio (e.g. after an edit + refetch) needs to be re-measured. The
  // trailing-link width doesn't depend on `text`, so it's measured just once.
  useEffect(() => {
    setExpanded(false);
    setLines(null);
  }, [text]);

  const onMeasureLines = useCallback((e: NativeSyntheticEvent<TextLayoutEventData>) => {
    setLines(e.nativeEvent.lines.map((l) => ({ text: l.text, width: l.width })));
  }, []);

  const onMeasureTrailing = useCallback((e: LayoutChangeEvent) => {
    setTrailingWidth(e.nativeEvent.layout.width);
  }, []);

  const ready = lines != null && trailingWidth != null;

  // Trim the visible two lines just enough to leave room for "… Read more" on
  // the second line. We reserve by the measured link width, converted to an
  // approximate character count via the second line's average glyph width.
  let truncated = false;
  let preview = '';
  if (lines != null && trailingWidth != null && lines.length > COLLAPSED_LINES) {
    truncated = true;
    const first = lines[0];
    const second = lines[1];
    if (first && second) {
      const twoLineChars = first.text.length + second.text.length;
      const avgChar =
        second.width > 0 && second.text.length > 0 ? second.width / second.text.length : 8;
      const removeChars = Math.ceil(trailingWidth / avgChar) + 2;
      const keep = Math.max(0, twoLineChars - removeChars);
      preview = quoted.slice(0, keep).replace(/\s+$/, '');
    }
  }

  return (
    <View style={styles.wrap}>
      {/* Off-screen twin, full width + unclamped, to learn the real line breaks. */}
      {lines == null ? (
        <Text
          style={[styles.bio, styles.measureFull]}
          onTextLayout={onMeasureLines}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {quoted}
        </Text>
      ) : null}

      {/* Off-screen twin, intrinsic width, to size the "… Read more" reservation. */}
      {trailingWidth == null ? (
        <Text
          style={[styles.toggle, styles.measureTrailing]}
          onLayout={onMeasureTrailing}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {TRAILING}
        </Text>
      ) : null}

      {expanded ? (
        <Text style={styles.bio}>
          {quoted}{' '}
          <Text style={styles.toggle} onPress={() => setExpanded(false)} suppressHighlighting>
            {LESS_LABEL}
          </Text>
        </Text>
      ) : truncated ? (
        <Text style={styles.bio} numberOfLines={COLLAPSED_LINES}>
          {preview}
          {ELLIPSIS}{' '}
          <Text style={styles.toggle} onPress={() => setExpanded(true)} suppressHighlighting>
            {MORE_LABEL}
          </Text>
        </Text>
      ) : (
        // Before measuring, clamp to two lines so a long bio never flashes full.
        <Text style={styles.bio} numberOfLines={ready ? undefined : COLLAPSED_LINES}>
          {quoted}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  bio: {
    fontFamily: font.family.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedText,
    textAlign: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.lg,
  },
  toggle: {
    fontFamily: font.family.semibold,
    fontSize: 12,
    color: colors.purple,
  },
  // Spans the full width so its wrapping matches the visible bio exactly.
  measureFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    opacity: 0,
  },
  // Intrinsic width (no left/right) so onLayout reports the link's own width.
  measureTrailing: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
  },
});
