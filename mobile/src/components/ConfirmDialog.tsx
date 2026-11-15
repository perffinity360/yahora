import Feather from '@expo/vector-icons/Feather';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Reanimated, { Easing, Keyframe } from 'react-native-reanimated';

import { AppText } from './AppText';
import { resolveMediaUrl } from '../lib/config';
import { colors, font } from '../theme';

const CARD_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.92 }, { translateY: 12 }] },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }, { translateY: 0 }],
    easing: Easing.out(Easing.cubic),
  },
}).duration(240);

const THUMB = 60;
const BADGE = 24;
/** Buttons hug their words (owner, 15 Nov: "reduce the space around the text"), so they are
 *  36 tall with 18 either side, never stretched across the card. */
const BUTTON_HEIGHT = 36;

export interface ConfirmDialogContent {
  title: string;
  /** The explanation under the title. Nest `<ConfirmDialog.Strong>` for a bold name. */
  message: ReactNode;
  confirmLabel: string;
  /** The other button's word. 'Cancel' unless given (the nudge's `Post anyway`). */
  cancelLabel?: string;
  /** The badge on the photo (or the whole medallion when there is no photo). */
  icon: keyof typeof Feather.glyphMap;
  /** The listing's photo, so the dialog shows WHICH item it is about. */
  imageUri?: string | null;
  /** 'danger' paints the badge and the confirm button red, for what can't be undone. */
  tone?: 'brand' | 'danger';
  /** Never more lines than this: the text shrinks a little on a phone too narrow for it
   *  (the community's `Post this?`: three, owner 15 Nov). */
  messageLines?: number;
}

const GRADIENTS = {
  brand: [colors.purple, colors.bubbleMineEnd],
  danger: [colors.dangerStart, colors.errorText],
} as const;

/**
 * A yes/no question in Yahora's own look, instead of the phone's Alert: the
 * Relist dialog (MARK_SOLD_SPEC §3) first, then Delete listing. The owner asked
 * for both on 27 Oct: the Android Alert ignored the app's fonts and colours and
 * read as a system error rather than part of the app.
 *
 * Centred card, the item's photo on top with the action's icon on a gradient
 * badge, the title in Bree Serif, the explanation under it, then Cancel and
 * the confirm button side by side, the confirm one in the brand gradient (or
 * red, for `tone: 'danger'`).
 *
 * One size for every dialog, the one the community's `Post this?` was given
 * (owner, 13 and 15 Nov): a size smaller than the first version, the words well
 * in from the card's edges (about three lines for a two-sentence message), and
 * buttons only as wide as their words, centred.
 *
 * `content` may go null as the dialog closes (the screen clears what it was
 * for); the words it opened with stay on screen while it fades out.
 */
export function ConfirmDialog({
  content,
  onConfirm,
  onCancel,
  onDismiss,
}: {
  content: ConfirmDialogContent | null;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * A tap on the scrim, or the phone's back. `onCancel` unless given. The
   * nudge needs its own: there the other button is `Post anyway`, which a
   * stray tap outside the card must never do.
   */
  onDismiss?: () => void;
}) {
  const dismiss = onDismiss ?? onCancel;
  const shownRef = useRef<ConfirmDialogContent | null>(content);
  if (content) shownRef.current = content;
  const shown = shownRef.current;
  const photo = resolveMediaUrl(shown?.imageUri);
  const gradient = GRADIENTS[shown?.tone ?? 'brand'];

  const confirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onConfirm();
  };

  return (
    <Modal
      visible={!!content}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={dismiss} accessibilityLabel="Close" />
        {shown ? (
          <Reanimated.View
            entering={CARD_ENTER}
            style={styles.card}
            accessibilityViewIsModal
            accessibilityRole="alert"
          >
            {photo ? (
              <View style={styles.thumbWrap}>
                <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" transition={150} />
                <LinearGradient
                  colors={gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.badge}
                >
                  <Feather name={shown.icon} size={12} color={colors.white} />
                </LinearGradient>
              </View>
            ) : (
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.medallion}
              >
                <Feather name={shown.icon} size={20} color={colors.white} />
              </LinearGradient>
            )}

            <AppText style={styles.title}>{shown.title}</AppText>
            <AppText
              style={styles.message}
              numberOfLines={shown.messageLines}
              adjustsFontSizeToFit={!!shown.messageLines}
              minimumFontScale={0.8}
            >
              {shown.message}
            </AppText>

            <View style={styles.actions}>
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.cancelPressed]}
              >
                <AppText style={styles.cancelText}>{shown.cancelLabel ?? 'Cancel'}</AppText>
              </Pressable>
              <Pressable
                onPress={confirm}
                accessibilityRole="button"
                style={({ pressed }) => [styles.button, pressed && styles.confirmPressed]}
              >
                <LinearGradient
                  colors={gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmFill}
                >
                  <AppText style={styles.confirmText}>{shown.confirmLabel}</AppText>
                </LinearGradient>
              </Pressable>
            </View>
          </Reanimated.View>
        ) : null}
      </View>
    </Modal>
  );
}

/** A name inside a dialog's message, in the darker semibold. */
ConfirmDialog.Strong = function Strong({ children }: { children: ReactNode }) {
  return <AppText style={styles.strong}>{children}</AppText>;
};

export default ConfirmDialog;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  card: {
    width: '100%',
    // 320, so the text is 268 wide: `Post this?`'s message in three lines (owner, 15 Nov).
    maxWidth: 320,
    alignItems: 'center',
    paddingTop: 20,
    // 26 a side: the message keeps clear of the card's edges (owner, 15 Nov).
    paddingHorizontal: 26,
    paddingBottom: 18,
    borderRadius: 24,
    backgroundColor: colors.white,
    shadowColor: colors.chatMenuShadow,
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
    marginBottom: 14,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 16,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  // Sits on the photo's corner, ringed in white so it reads on any photo.
  badge: {
    position: 'absolute',
    right: -7,
    bottom: -7,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  medallion: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    textAlign: 'center',
    fontFamily: font.family.serif,
    fontSize: 19,
    lineHeight: 24,
    color: colors.blackSoft,
  },
  message: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: font.family.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedText,
  },
  strong: {
    fontFamily: font.family.semibold,
    color: colors.blackSoft,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  button: {
    minWidth: 84,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    overflow: 'hidden',
  },
  cancel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: colors.inputBg,
  },
  cancelPressed: {
    backgroundColor: colors.hairline,
    transform: [{ scale: 0.97 }],
  },
  cancelText: {
    fontFamily: font.family.semibold,
    fontSize: 14,
    color: colors.blackSoft,
  },
  confirmPressed: { transform: [{ scale: 0.97 }] },
  confirmFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  confirmText: {
    fontFamily: font.family.bold,
    fontSize: 14,
    color: colors.white,
  },
});
