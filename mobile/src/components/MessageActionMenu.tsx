import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, View } from 'react-native';
import Reanimated, { Easing, FadeOut, Keyframe } from 'react-native-reanimated';

import { AppText } from './AppText';
import { colors, font } from '../theme';

export type MessageAction = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  /** Delete: icon and label in errorText (spec §10.2). */
  danger?: boolean;
};

/** A box in the coordinates of the menu's parent. */
export type MenuRect = { x: number; y: number; width: number; height: number };

interface MessageActionMenuProps {
  /** The long-pressed bubble. */
  anchor: MenuRect;
  /** The area the menu must stay inside: the thread, between header and composer. */
  bounds: MenuRect;
  /** Mine: the menu lines up with the bubble's right edge; theirs, its left. */
  side: 'mine' | 'theirs';
  /** In the order shown (spec §10.1). */
  actions: MessageAction[];
  onSelect: (key: string) => void;
}

const ITEM_HEIGHT = 48;
const PAD_Y = 6;
const WIDTH = 196;
/** Between the bubble and the menu. The reactions bar (community phase) goes
 *  in here, between the two, when it arrives. */
const GAP = 8;
/** Never closer than this to the thread's edges. */
const EDGE = 12;

/** Grows out of the corner nearest the bubble (transformOrigin is set per menu). */
const ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.86 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(170);
const EXIT = FadeOut.duration(110);

/**
 * WhatsApp's long-press menu: a card in the thread, next to the message it is
 * for, instead of a sheet from the bottom of the screen. Below the bubble when
 * there is room, above it otherwise, and over it only for a bubble taller than
 * the thread. No scrim: the thread stays live, so the next tap on another
 * message adds it to the selection (the screen closes this menu on any touch
 * in the thread).
 */
export function MessageActionMenu({ anchor, bounds, side, actions, onSelect }: MessageActionMenuProps) {
  const height = actions.length * ITEM_HEIGHT + PAD_Y * 2;
  const minTop = bounds.y + EDGE;
  const maxTop = bounds.y + bounds.height - EDGE - height;

  const below = anchor.y + anchor.height + GAP;
  const above = anchor.y - GAP - height;
  let top: number;
  let fromBelow = true;
  if (below <= maxTop) top = below;
  else if (above >= minTop) {
    top = above;
    fromBelow = false;
  } else top = Math.max(minTop, Math.min(maxTop, below));

  const left =
    side === 'mine'
      ? Math.min(anchor.x + anchor.width, bounds.x + bounds.width - EDGE) - WIDTH
      : Math.max(anchor.x, bounds.x + EDGE);

  return (
    <Reanimated.View
      entering={ENTER}
      exiting={EXIT}
      style={[
        styles.menu,
        {
          top,
          left: Math.max(bounds.x + EDGE, left),
          transformOrigin: `${side === 'mine' ? 'right' : 'left'} ${fromBelow ? 'top' : 'bottom'}`,
        },
      ]}
      accessibilityRole="menu"
    >
      {actions.map((action) => {
        const tint = action.danger ? colors.errorText : colors.mutedText;
        return (
          <Pressable
            key={action.key}
            onPress={() => onSelect(action.key)}
            accessibilityRole="menuitem"
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            <Feather name={action.icon} size={20} color={tint} />
            <AppText style={[styles.label, action.danger && styles.labelDanger]}>{action.label}</AppText>
          </Pressable>
        );
      })}
      <View style={styles.border} pointerEvents="none" />
    </Reanimated.View>
  );
}

export default MessageActionMenu;

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    width: WIDTH,
    paddingVertical: PAD_Y,
    borderRadius: 16,
    backgroundColor: colors.white,
    shadowColor: colors.chatMenuShadow,
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  // A hairline drawn over the card, so the white menu still has an edge where
  // it lies on a white bubble.
  border: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.messagesLine,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: ITEM_HEIGHT,
    paddingHorizontal: 16,
  },
  itemPressed: { backgroundColor: colors.inboxRowPressed },
  label: {
    fontFamily: font.family.medium,
    fontSize: 15,
    color: colors.blackSoft,
  },
  labelDanger: { color: colors.errorText },
});
