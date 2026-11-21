import { memo, useCallback, useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View, type LayoutChangeEvent, type TextLayoutEvent } from 'react-native';

import { AppText } from '../AppText';
import { FormattedText } from '../FormattedText';
import { POST_FOLD_LINES } from '../../lib/community';
import { splitEmoji } from '../../lib/emoji';
import { parseFormatted } from '../../lib/textFormat';
import { colors, font } from '../../theme';

/**
 * A post's or reply's text — COMMUNITY_SPEC.md §3 "Text". Every post and reply
 * text in the app is drawn here (PostCard, PostThread: the feeds, top replies,
 * the post page, profiles' Posts).
 *
 *   · drawn with WhatsApp's formatting through FormattedText
 *     (TEXT_FORMAT_SPEC.md), exactly as in a chat bubble; links tappable, in
 *     the spec's purple (no previews);
 *   · emoji inside the text are a size up (1.28×): the emoji font draws many of
 *     them smaller than the letters around them;
 *   · folds after POST_FOLD_LINES behind `See more`, which expands it in place.
 *
 * Folding, two ways, because FormattedText draws two ways:
 *   · no bullets, numbers or quotes: ONE Text, clamped to POST_FOLD_LINES.
 *     Whether it overflows is MEASURED, not guessed from the length: an
 *     unclamped twin, invisible, reports its real line count once. React
 *     Native's onTextLayout on a clamped Text reports only the visible lines
 *     on Android, so it can't say there's more. The twin is only drawn for
 *     text long enough that it might need it, and goes away after one layout.
 *   · with them: a column of rows, which no Text can clamp. Folded by height
 *     (line height × POST_FOLD_LINES, overflow hidden); the column's full
 *     height, measured with onLayout, says whether there's more.
 *
 * A recycled feed cell gets a new `content`; the parent keys this by post id,
 * so the measurement and the expanded state start again for each post.
 */
const SIZES = {
  post: { fontSize: 15, lineHeight: 20, emoji: 19 },
  // A post's own page (spec §4): 15/22, never folded.
  page: { fontSize: 15, lineHeight: 22, emoji: 19 },
  reply: { fontSize: 13, lineHeight: 19, emoji: 17 },
} as const;

/** Under this many characters and line breaks, six lines can't be filled on a
 *  phone (a 330 dp line holds about 40 characters of Inter 15). */
const MIGHT_FOLD_CHARS = 200;

function mightFold(text: string) {
  return text.length > MIGHT_FOLD_CHARS || (text.match(/\n/g)?.length ?? 0) >= POST_FOLD_LINES - 1;
}

const openLink = (url: string) => void Linking.openURL(url);

export const PostText = memo(function PostText({
  content,
  variant = 'post',
}: {
  content: string;
  variant?: 'post' | 'page' | 'reply';
}) {
  const size = SIZES[variant];
  const oneText = useMemo(() => parseFormatted(content).every((line) => line.kind === 'text'), [content]);
  const foldHeight = size.lineHeight * POST_FOLD_LINES;
  const [expanded, setExpanded] = useState(variant === 'page');
  // null: not measured yet. Short one-Text text never needs measuring; a
  // column is always measured (its onLayout costs nothing extra).
  const [overflows, setOverflows] = useState<boolean | null>(() =>
    variant === 'page' ? false : !oneText || mightFold(content) ? null : false,
  );

  const onMeasureLines = (e: TextLayoutEvent) => setOverflows(e.nativeEvent.lines.length > POST_FOLD_LINES);
  // A pixel of slack: rounding can put a column a hair over the fold.
  const onMeasureColumn = (e: LayoutChangeEvent) => setOverflows(e.nativeEvent.layout.height > foldHeight + 1);

  const textStyle = [styles.text, { fontSize: size.fontSize, lineHeight: size.lineHeight }];
  // Plain runs only: emoji a size up. FormattedText never passes code here.
  const renderText = useCallback(
    (text: string): ReactNode =>
      splitEmoji(text).map((part, j) =>
        part.emoji ? (
          <AppText key={j} style={{ fontSize: size.emoji }}>
            {part.text}
          </AppText>
        ) : (
          part.text
        ),
      ),
    [size.emoji],
  );
  const drawn = (more?: { numberOfLines?: number; onTextLayout?: (e: TextLayoutEvent) => void }) => (
    <FormattedText
      content={content}
      style={textStyle}
      linkStyle={styles.link}
      onOpenLink={openLink}
      renderText={renderText}
      codeBackground={colors.formatCodeTheirs}
      quoteBar={colors.formatQuoteBarTheirs}
      {...more}
    />
  );

  return (
    <View>
      {oneText ? (
        <>
          {overflows === null ? (
            <View style={styles.twin} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {drawn({ onTextLayout: onMeasureLines })}
            </View>
          ) : null}
          {drawn({ numberOfLines: expanded ? undefined : POST_FOLD_LINES })}
        </>
      ) : (
        <View style={expanded ? null : { maxHeight: foldHeight, overflow: 'hidden' }}>
          <View onLayout={variant === 'page' ? undefined : onMeasureColumn}>{drawn()}</View>
        </View>
      )}
      {overflows && !expanded ? (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 4, right: 20 }}
          style={styles.seeMoreBox}
        >
          <AppText style={styles.seeMore}>See more</AppText>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  text: {
    fontFamily: font.family.regular,
    color: colors.blackSoft,
  },
  // Same width as the real text, out of sight and out of the way.
  twin: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  link: { color: colors.purple },
  seeMoreBox: { alignSelf: 'flex-start', marginTop: 2 },
  seeMore: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    lineHeight: 18,
    color: colors.purple,
  },
});
