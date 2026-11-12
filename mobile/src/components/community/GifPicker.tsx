import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Reanimated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../AppText';
import { AppTextInput } from '../AppTextInput';
import { KeyboardAvoider } from '../KeyboardAvoider';
import { ModalSafeArea } from '../ModalSafeArea';
import { useGifs } from '../../hooks/useGifs';
import { SHEET_RISE } from '../../lib/motion';
import { colors, font } from '../../theme';
import type { GifRef } from '../../types';

/**
 * The GIF picker — COMMUNITY_SPEC.md §6, as a bottom sheet. It opens like the
 * reaction breakdown (13 Nov): its insets from `ModalSafeArea` (the Modal's own,
 * so the last row and the KLIPY line clear Android's navigation buttons), and
 * its own rise over SHEET_RISE with the scrim fading in on the same clock,
 * never `SlideInDown`, which can draw the sheet in place for a frame first.
 *
 *   · a search box; trending GIFs first; 2 columns; more as you scroll;
 *   · "Powered by KLIPY" at the bottom, always: KLIPY's terms require it;
 *   · tapping a GIF hands back its GifRef and closes;
 *   · any failure, a missing key included: "GIFs aren't available right now."
 *
 * All behaviour is in useGifs; this file is only the look. Its root is the
 * KeyboardAvoider (fillsModal), so the keyboard never covers the results.
 */
const GAP = 4;
const PAD = 12;

export function GifPicker({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  onPick: (gif: GifRef) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {visible ? (
        <ModalSafeArea>
          <Sheet onPick={onPick} onClose={onClose} />
        </ModalSafeArea>
      ) : null}
    </Modal>
  );
}

function Sheet({ onPick, onClose }: { onPick: (gif: GifRef) => void; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const gifs = useGifs();
  const tile = Math.floor((Math.min(width, 560) - PAD * 2 - GAP) / 2);
  const sheetHeight = Math.round(height * 0.72);

  // Starts a whole sheet below the edge, so it is never seen before it moves.
  const shown = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) shown.value = withTiming(1, SHEET_RISE);
  }, [reduceMotion, shown]);
  const riseStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - shown.value) * sheetHeight }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: shown.value }));

  const renderItem = useCallback(
    ({ item }: { item: GifRef }) => (
      <Pressable
        onPress={() => onPick(item)}
        accessibilityRole="imagebutton"
        accessibilityLabel="Choose this GIF"
        style={({ pressed }) => [styles.tile, { width: tile, height: tile * 0.75 }, pressed && styles.tilePressed]}
      >
        <Image source={{ uri: item.preview_url ?? item.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Pressable>
    ),
    [onPick, tile],
  );

  return (
    <KeyboardAvoider fillsModal style={styles.root}>
      <Reanimated.View style={[styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Reanimated.View>
      <Reanimated.View
        style={[styles.sheet, { height: sheetHeight, paddingBottom: insets.bottom + 6 }, riseStyle]}
        accessibilityViewIsModal
      >
        <View style={styles.handle} />
        <View style={styles.searchRow}>
          <View style={styles.search}>
            <Feather name="search" size={16} color={colors.communityMuted} />
            <AppTextInput
              value={gifs.query}
              onChangeText={gifs.setQuery}
              placeholder="Search GIFs"
              placeholderTextColor={colors.mutedPlaceholder}
              accessibilityLabel="Search GIFs"
              returnKeyType="search"
              autoCorrect={false}
              style={styles.searchInput}
            />
          </View>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
            <Feather name="x" size={20} color={colors.blackSoft} />
          </Pressable>
        </View>

        {gifs.failed ? (
          <View style={styles.message}>
            <AppText style={styles.messageText}>GIFs aren't available right now.</AppText>
            <Pressable
              onPress={gifs.retry}
              accessibilityRole="button"
              style={({ pressed }) => [styles.retry, pressed && styles.tilePressed]}
            >
              <AppText style={styles.retryText}>Try again</AppText>
            </Pressable>
          </View>
        ) : gifs.loading ? (
          <View style={styles.grid}>
            {Array.from({ length: 8 }, (_, i) => (
              <View key={i} style={[styles.tile, styles.tileSkeleton, { width: tile, height: tile * 0.75 }]} />
            ))}
          </View>
        ) : gifs.items.length === 0 ? (
          <View style={styles.message}>
            <AppText style={styles.messageText}>{gifs.isSearch ? 'No GIFs found.' : ''}</AppText>
          </View>
        ) : (
          <FlatList
            data={gifs.items}
            keyExtractor={(g) => g.id}
            renderItem={renderItem}
            numColumns={2}
            columnWrapperStyle={{ gap: GAP }}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onEndReached={gifs.loadMore}
            onEndReachedThreshold={0.8}
            ListFooterComponent={
              gifs.loadingMore ? <ActivityIndicator style={styles.more} color={colors.purple} /> : undefined
            }
          />
        )}

        {/* Required by KLIPY's terms (runbook §1.9). Never remove it. */}
        <AppText style={styles.credit}>Powered by KLIPY</AppText>
      </Reanimated.View>
    </KeyboardAvoider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.sheetScrimLight },
  sheet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    paddingTop: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.white,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
    backgroundColor: colors.sheetHandle,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: PAD, marginBottom: 10 },
  search: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.inputBg,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    fontFamily: font.family.regular,
    fontSize: font.sizes.bodyLg,
    color: colors.blackSoft,
  },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: PAD, gap: GAP, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: PAD },
  tile: { borderRadius: 8, overflow: 'hidden', backgroundColor: colors.reactionMineBg },
  tileSkeleton: { opacity: 0.7 },
  tilePressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  more: { marginVertical: 12 },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  messageText: {
    textAlign: 'center',
    fontFamily: font.family.regular,
    fontSize: font.sizes.bodyLg,
    lineHeight: 20,
    color: colors.communityMuted,
  },
  retry: {
    height: 32,
    paddingHorizontal: 16,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: colors.purpleDark,
  },
  retryText: { fontFamily: font.family.semibold, fontSize: font.sizes.body, color: colors.white },
  credit: {
    alignSelf: 'flex-end',
    paddingHorizontal: PAD,
    paddingTop: 6,
    fontFamily: font.family.medium,
    fontSize: font.sizes.micro,
    lineHeight: 14,
    color: colors.communityMuted,
  },
});
