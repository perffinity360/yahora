import { memo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View, type TextLayoutEvent } from 'react-native';

import { AppText } from '../AppText';
import { POST_FOLD_LINES, splitLinks } from '../../lib/community';
import { splitEmoji } from '../../lib/emoji';
import { colors, font } from '../../theme';

/**
 * A post's or reply's text — COMMUNITY_SPEC.md §3 "Text".
 *
 *   · folds after POST_FOLD_LINES behind `See more`, which expands it in place;
 *   · links are tappable (no previews);
 *   · emoji inside the text are a size up (1.28×): the emoji font draws many of
 *     them smaller than the letters around them.
 *
 * Whether it overflows is MEASURED, not guessed from the length: an unclamped
 * twin, invisible, reports its real line count once. React Native's own
 * onTextLayout on a clamped Text reports only the visible lines on Android, so
 * it can't say there's more. The twin is only drawn for text long enough that
 * it might need it, and goes away after one layout.
 *
 * A recycled feed cell gets a new `content`; the parent keys this by post id,
 * so the measurement and the expanded state start again for each post.
 */
const SIZES = {
  post: { fontSize: 15, lineHeight: 20, emoji: 19 },
  reply: { fontSize: 13, lineHeight: 19, emoji: 17 },
} as const;

/** Under this many characters and line breaks, six lines can't be filled on a
 *  phone (a 330 dp line holds about 40 characters of Inter 15). */
const MIGHT_FOLD_CHARS = 200;

function mightFold(text: string) {
  return text.length > MIGHT_FOLD_CHARS || (text.match(/\n/g)?.length ?? 0) >= POST_FOLD_LINES - 1;
}

function Runs({ text, emojiSize }: { text: string; emojiSize: number }) {
  return (
    <>
      {splitLinks(text).map((run, i) =>
        run.href ? (
          <AppText
            key={i}
            style={styles.link}
            onPress={() => void Linking.openURL(run.href!)}
            accessibilityRole="link"
            suppressHighlighting
          >
            {run.text}
          </AppText>
        ) : (
          splitEmoji(run.text).map((part, j) =>
            part.emoji ? (
              <AppText key={`${i}-${j}`} style={{ fontSize: emojiSize }}>
                {part.text}
              </AppText>
            ) : (
              part.text
            ),
          )
        ),
      )}
    </>
  );
}

export const PostText = memo(function PostText({
  content,
  variant = 'post',
}: {
  content: string;
  variant?: 'post' | 'reply';
}) {
  const size = SIZES[variant];
  const [expanded, setExpanded] = useState(false);
  // null: not measured yet. Short text never needs measuring.
  const [overflows, setOverflows] = useState<boolean | null>(() => (mightFold(content) ? null : false));

  const onMeasure = (e: TextLayoutEvent) => setOverflows(e.nativeEvent.lines.length > POST_FOLD_LINES);
  const textStyle = [styles.text, { fontSize: size.fontSize, lineHeight: size.lineHeight }];

  return (
    <View>
      {overflows === null ? (
        <AppText
          style={[textStyle, styles.twin]}
          onTextLayout={onMeasure}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {content}
        </AppText>
      ) : null}
      <AppText style={textStyle} numberOfLines={expanded ? undefined : POST_FOLD_LINES}>
        <Runs text={content} emojiSize={size.emoji} />
      </AppText>
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
