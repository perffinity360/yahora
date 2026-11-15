import AsyncStorage from '@react-native-async-storage/async-storage';
import { View } from 'react-native';
import EmojiPicker, { EmojiKeyboard, en, useRecentPicksPersistence } from 'rn-emoji-keyboard';

import { colors, font } from '../../theme';

/**
 * The full emoji picker (⊕) — COMMUNITY_SPEC.md §5.2: a search box, Frequently
 * used (remembered on this phone), then every category with category tabs.
 * The library is rn-emoji-keyboard (spec §5.2), styled with our tokens: a white
 * surface, radius 12, purple for the selected category.
 *
 * It is its own bottom-sheet Modal, for reactions. Open it only after any other
 * overlay has closed (the quick bar, the breakdown): two Modals at once
 * misbehave on Android. Writing uses `EmojiPanel` below instead.
 */
const RECENT_KEY = 'yahora.emoji.recent';

/** The library's English words, with the spec's own two. */
const WORDS = { ...en, search: 'Search emoji', recently_used: 'Frequently used' };

const THEME = {
  backdrop: colors.sheetScrimLight,
  knob: colors.sheetHandle,
  container: colors.white,
  header: colors.communityMuted,
  skinTonesContainer: colors.inputBg,
  category: {
    icon: colors.communityMuted,
    iconActive: colors.purple,
    container: colors.white,
    containerActive: colors.reactionMineBg,
  },
  search: {
    background: colors.inputBg,
    text: colors.blackSoft,
    placeholder: colors.mutedLabel,
    icon: colors.communityMuted,
  },
  emoji: { selected: colors.reactionMineBg },
};

const CATEGORY_ORDER: NonNullable<Parameters<typeof EmojiKeyboard>[0]['categoryOrder']> = [
  'recently_used',
  'smileys_emotion',
  'people_body',
  'animals_nature',
  'food_drink',
  'travel_places',
  'activities',
  'objects',
  'symbols',
  'flags',
];

const STYLES = {
  container: { borderRadius: 12 },
  header: { fontFamily: font.family.semibold, fontSize: font.sizes.caption },
  searchBar: { text: { fontFamily: font.family.regular, fontSize: font.sizes.bodyLg } },
};

/** Frequently used, kept on this phone. Both the sheet and the panel call it. */
function useEmojiRecents() {
  useRecentPicksPersistence({
    initialization: async () => {
      try {
        return JSON.parse((await AsyncStorage.getItem(RECENT_KEY)) ?? '[]');
      } catch {
        return [];
      }
    },
    onStateChange: (next) => {
      void AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
    },
  });
}

/** The panel's own surface: flat under the compose toolbar, no card corners or shadow. */
const PANEL_STYLES = { ...STYLES, container: { borderRadius: 0, shadowOpacity: 0, elevation: 0 } };

/**
 * The same picker laid in the screen where the keyboard was, for writing: the
 * compose screen's ☺ (owner, 15 Nov, "as the emoji picker behaves in
 * WhatsApp"). No backdrop, so the text stays bright and can be tapped to bring
 * the keyboard back. `height` is the keyboard's, so swapping one for the other
 * doesn't move the toolbar; `bottomInset` keeps the search box clear of the
 * navigation bar.
 */
export function EmojiPanel({
  height,
  bottomInset,
  onPick,
}: {
  height: number;
  bottomInset: number;
  onPick: (emoji: string) => void;
}) {
  useEmojiRecents();
  return (
    <View style={{ height, paddingBottom: bottomInset, backgroundColor: THEME.container }}>
      <EmojiKeyboard
        onEmojiSelected={(e) => onPick(e.emoji)}
        enableSearchBar
        translation={WORDS}
        enableRecentlyUsed
        categoryPosition="top"
        categoryOrder={CATEGORY_ORDER}
        theme={THEME}
        styles={PANEL_STYLES}
        disableSafeArea
      />
    </View>
  );
}

export function EmojiPickerSheet({
  open,
  current,
  onPick,
  onClose,
  multiple = false,
}: {
  open: boolean;
  /** Your current reaction, marked in the grid. */
  current: string | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
  /** Stays open after a pick, to add several. A reaction closes on its one pick. */
  multiple?: boolean;
}) {
  useEmojiRecents();

  return (
    <EmojiPicker
      open={open}
      onClose={onClose}
      onEmojiSelected={(e) => onPick(e.emoji)}
      enableSearchBar
      translation={WORDS}
      enableRecentlyUsed
      categoryPosition="top"
      categoryOrder={CATEGORY_ORDER}
      allowMultipleSelections={multiple}
      selectedEmojis={current ? [current] : false}
      theme={THEME}
      styles={STYLES}
      expandable={false}
      defaultHeight="62%"
    />
  );
}
