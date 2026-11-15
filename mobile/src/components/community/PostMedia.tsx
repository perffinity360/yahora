import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';

import { AppText } from '../AppText';
import { resolveMediaUrl } from '../../lib/config';
import { colors, font } from '../../theme';
import type { GifRef } from '../../types';

/* ───────────────────────────── Photos ───────────────────────────── */

/**
 * COMMUNITY_SPEC.md §3 "Photos": one photo at a time, like Instagram.
 *
 *   · the frame takes the first photo's shape, kept between 4:5 and 16:9, full
 *     width but at most 480 × 380, radius 8;
 *   · each photo shows whole (contain) over a blur of itself, so a photo of
 *     another shape is never cropped and never sits on bare bars;
 *   · more than one: swipe sideways (paging), or tap the chevrons, which are
 *     always shown on a touch screen; dots show where you are;
 *   · tapping a photo opens the image viewer at that photo (onOpen).
 */
const MIN_RATIO = 4 / 5;
const MAX_RATIO = 16 / 9;
const MAX_W = 480;
const MAX_H = 380;

export const PostPhotos = memo(function PostPhotos({
  urls,
  author,
  onOpen,
}: {
  urls: string[];
  author: string;
  onOpen: (index: number) => void;
}) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [boxW, setBoxW] = useState(0);
  const [index, setIndex] = useState(0);
  // The shape is known once the first photo loads; until then 4:3 keeps the
  // card from jumping by more than a little.
  const [ratio, setRatio] = useState(4 / 3);
  const count = urls.length;

  const width = Math.min(boxW, MAX_W, MAX_H * ratio);
  const height = width / ratio;

  const go = useCallback(
    (i: number) => {
      const next = Math.min(Math.max(i, 0), count - 1);
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    },
    [count, width],
  );

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={styles.photosBox} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <View style={[styles.frame, { width, height }]}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEnabled={count > 1}
            onMomentumScrollEnd={onScrollEnd}
            // A swipe on the photos stays with the photos, not the feed.
            nestedScrollEnabled
          >
            {urls.map((url, i) => {
              const src = resolveMediaUrl(url) ?? url;
              return (
                <Pressable
                  key={url + i}
                  onPress={() => onOpen(i)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel={count > 1 ? `Photo ${i + 1} of ${count} from ${author}. Open it` : `Photo from ${author}. Open it`}
                  style={{ width, height }}
                >
                  <Image source={{ uri: src }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={18} />
                  <View style={styles.blurVeil} />
                  <Image
                    source={{ uri: src }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    transition={160}
                    onLoad={
                      i === 0
                        ? (e) => {
                            const { width: w, height: h } = e.source;
                            if (w && h) setRatio(Math.min(Math.max(w / h, MIN_RATIO), MAX_RATIO));
                          }
                        : undefined
                    }
                  />
                </Pressable>
              );
            })}
          </ScrollView>

          {count > 1 ? (
            <>
              {index > 0 ? (
                <Chevron side="left" onPress={() => go(index - 1)} />
              ) : null}
              {index < count - 1 ? (
                <Chevron side="right" onPress={() => go(index + 1)} />
              ) : null}
              <View style={styles.dots} pointerEvents="none">
                {urls.map((url, i) => (
                  <View key={url + i} style={[styles.dot, i === index && styles.dotOn]} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : (
        <View style={{ height: 160 }} />
      )}
    </View>
  );
});

function Chevron({ side, onPress }: { side: 'left' | 'right'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={9}
      accessibilityRole="button"
      accessibilityLabel={side === 'left' ? 'Previous photo' : 'Next photo'}
      style={({ pressed }) => [
        styles.chevron,
        side === 'left' ? styles.chevronLeft : styles.chevronRight,
        pressed && styles.chevronPressed,
      ]}
    >
      <Feather name={side === 'left' ? 'chevron-left' : 'chevron-right'} size={16} color={colors.blackSoft} />
    </Pressable>
  );
}

/* ───────────────────────────── GIF ───────────────────────────── */

/**
 * COMMUNITY_SPEC.md §3 "GIF": at most `maxWidth` wide and `maxHeight` tall
 * (240 × 300 on a post, 160 × 200 on a reply: a size down on 15 Nov, the
 * reply's still smaller at every shape, so the thread keeps its order). No GIF
 * tag on it (owner, 16 Nov): the GIF speaks for itself. It plays while on screen and pauses when it
 * scrolls away: the feed tells it with `playing`, from FlashList's viewability.
 *
 * The frame takes the shape of the GIF as it actually loads and has no ground
 * of its own, so nothing shows round it but its rounded corners (owner, 13 Nov).
 * KLIPY's width × height is only the first guess: some renditions come back a
 * few pixels off it, and the old tint showed as a strip in the gap.
 */
/** A post's GIF and a reply's, at most (width × height). */
export const GIF_POST = { width: 240, height: 300 } as const;
export const GIF_REPLY = { width: 160, height: 200 } as const;

export const PostGif = memo(function PostGif({
  gif,
  playing,
  maxWidth = GIF_POST.width,
  maxHeight = GIF_POST.height,
}: {
  gif: GifRef;
  playing: boolean;
  maxWidth?: number;
  maxHeight?: number;
}) {
  const imageRef = useRef<Image>(null);
  const [loadedRatio, setLoadedRatio] = useState<number | null>(null);
  const ratio = loadedRatio ?? (gif.width > 0 && gif.height > 0 ? gif.width / gif.height : 1);

  useEffect(() => {
    if (playing) void imageRef.current?.startAnimating();
    else void imageRef.current?.stopAnimating();
  }, [playing]);

  return (
    <View style={[styles.gif, { maxWidth: Math.min(maxWidth, maxHeight * ratio), aspectRatio: ratio }]}>
      <Image
        ref={imageRef}
        source={{ uri: gif.url }}
        placeholder={gif.preview_url ? { uri: gif.preview_url } : undefined}
        style={StyleSheet.absoluteFill}
        // The frame is the image's own shape once loaded, so cover crops
        // nothing; before that it hides a guess that's a pixel or two off.
        contentFit="cover"
        autoplay={playing}
        onLoad={(e) => {
          const { width: w, height: h } = e.source;
          if (w > 0 && h > 0) setLoadedRatio(w / h);
          if (!playing) void imageRef.current?.stopAnimating();
        }}
        accessibilityLabel="GIF"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  photosBox: { alignSelf: 'stretch', marginTop: 8 },
  frame: { borderRadius: 8, overflow: 'hidden', backgroundColor: colors.chatCanvas },
  // The blur is the photo's own colours, softened to 55% (spec: "18 px, 55%").
  blurVeil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.white, opacity: 0.45 },
  chevron: {
    position: 'absolute',
    top: '50%',
    marginTop: -13,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.communityGlass,
  },
  chevronLeft: { left: 8 },
  chevronRight: { right: 8 },
  chevronPressed: { transform: [{ scale: 0.92 }] },
  dots: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.toastBg,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.white, opacity: 0.45 },
  dotOn: { opacity: 1 },

  gif: {
    width: '100%',
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
