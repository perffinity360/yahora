import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AppText } from './AppText';
import { COPY_TOAST_MS } from '../lib/messageActions';
import { colors, font } from '../theme';

/** One toast on screen. `id` changes per call, so the same text twice in a row fades in again. */
export type Toast = { id: number; text: string };

const FADE_MS = 150;

/**
 * MESSAGES_SPEC.md §10.7 toast: "Copied", and the messages of §10.6 and §10.8.
 * A screen calls useToast() once and renders <AppToast message={toast} /> once.
 * A new toast replaces the one on screen and restarts its time.
 */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextIdRef = useRef(0);

  const showToast = useCallback((text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    nextIdRef.current += 1;
    setToast({ id: nextIdRef.current, text });
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setToast(null);
    }, COPY_TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { toast, showToast };
}

/**
 * A pill, centred, `bottom` above the bottom of its parent. Absolutely
 * positioned, so the parent must be the area it floats over. Never takes a
 * touch: whatever is under it stays tappable.
 */
export function AppToast({ message, bottom }: { message: Toast | null; bottom: number }) {
  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="none">
      {message ? (
        <Reanimated.View
          key={message.id}
          entering={FadeIn.duration(FADE_MS)}
          exiting={FadeOut.duration(FADE_MS)}
          style={styles.pill}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <AppText style={styles.text}>{message.text}</AppText>
        </Reanimated.View>
      ) : null}
    </View>
  );
}

export default AppToast;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.toastBg,
  },
  text: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.white,
  },
});
