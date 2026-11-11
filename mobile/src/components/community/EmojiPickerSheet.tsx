import AsyncStorage from '@react-native-async-storage/async-storage';
import EmojiPicker, { en, useRecentPicksPersistence } from 'rn-emoji-keyboard';

import { colors, font } from '../../theme';

/**
 * The full emoji picker (⊕) — COMMUNITY_SPEC.md §5.2: a search box, Frequently
 * used (remembered on this phone), then every category with category tabs.
 * The library is rn-emoji-keyboard (spec §5.2), styled with our tokens: a white
 * surface, radius 12, purple for the selected category.
 *
 * It is its own bottom-sheet Modal. Open it only after any other overlay has
 * closed (the quick bar, the breakdown): two Modals at once misbehave on Android.
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

const STYLES = {
  container: { borderRadius: 12 },
  header: { fontFamily: font.family.semibold, fontSize: font.sizes.caption },
  searchBar: { text: { fontFamily: font.family.regular, fontSize: font.sizes.bodyLg } },
};

export function EmojiPickerSheet({
  open,
  current,
  onPick,
  onClose,
}: {
  open: boolean;
  /** Your current reaction, marked in the grid. */
  current: string | null;
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
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

  return (
    <EmojiPicker
      open={open}
      onClose={onClose}
      onEmojiSelected={(e) => onPick(e.emoji)}
      enableSearchBar
      translation={WORDS}
      enableRecentlyUsed
      categoryPosition="top"
      categoryOrder={['recently_used', 'smileys_emotion', 'people_body', 'animals_nature', 'food_drink', 'travel_places', 'activities', 'objects', 'symbols', 'flags']}
      selectedEmojis={current ? [current] : false}
      theme={THEME}
      styles={STYLES}
      expandable={false}
      defaultHeight="62%"
    />
  );
}
