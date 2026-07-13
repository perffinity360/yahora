import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

import { colors, font, radius, spacing } from '../theme';

// Extra horizontal room a row needs beyond its label text: side padding plus
// the trailing check icon. Used to size the list wide enough to read in full.
const ROW_H_EXTRA = spacing.md * 3 + spacing.sm + 24;

export interface PickerOption {
  label: string;
  value: string;
}

interface Props {
  label: string;
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Show a search box at the top of the modal (default true). */
  searchable?: boolean;
  leadingIcon?: keyof typeof Feather.glyphMap;
  /** Extra style for the outer wrapper — e.g. a raised zIndex so this field's
   * field/modal stacks above a sibling field lower on the page. */
  style?: StyleProp<ViewStyle>;
}

/**
 * A labelled field that opens a modal with a (optionally searchable) list of
 * options (the mobile equivalent of the web's searchable react-select).
 */
export function SearchablePicker({
  label,
  options,
  value,
  onChange,
  placeholder,
  loading,
  disabled,
  required,
  searchable = true,
  leadingIcon,
  style,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [viewportW, setViewportW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const { height: winH } = useWindowDimensions();

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  // The few longest options drive how wide the list must be (measured below).
  const widestProbe = useMemo(
    () => [...filtered].sort((a, b) => b.label.length - a.label.length).slice(0, 6),
    [filtered],
  );

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  const select = (v: string) => {
    onChange(v);
    close();
  };

  const isDisabled = disabled || loading;

  return (
    <View style={[styles.group, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {required ? <Text style={styles.required}> *</Text> : null}
      </View>

      <Pressable
        onPress={() => setOpen(true)}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.field,
          pressed && !isDisabled && styles.fieldPressed,
          isDisabled && styles.fieldDisabled,
        ]}
      >
        {leadingIcon ? (
          <Feather name={leadingIcon} size={18} color={colors.purple} style={styles.leadingIcon} />
        ) : null}
        <Text style={[styles.fieldText, !selected && styles.fieldPlaceholder]} numberOfLines={1}>
          {loading ? 'Loading…' : selected ? selected.label : placeholder}
        </Text>
        {selected && !isDisabled ? (
          // Clears the value without opening the modal first, so the user can
          // start a fresh search instead of hunting for the current pick.
          <Pressable
            onPress={() => onChange('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label.toLowerCase()}`}
            style={({ pressed }) => [styles.clearBtn, pressed && styles.clearBtnPressed]}
          >
            <Feather name="x" size={14} color={colors.mutedLabel} />
          </Pressable>
        ) : null}
        <Feather name="chevron-down" size={18} color={colors.mutedLabel} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />

          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.cardTitle}>{label}</Text>
              <Pressable
                onPress={close}
                hitSlop={8}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              >
                <Feather name="x" size={20} color={colors.mutedText} />
              </Pressable>
            </View>

            {searchable ? (
              <View style={styles.searchWrap}>
                <Feather name="search" size={16} color={colors.mutedLabel} style={styles.searchIcon} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={`Search ${label.toLowerCase()}…`}
                  placeholderTextColor={colors.mutedPlaceholder}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
              </View>
            ) : null}

            {filtered.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {search.trim() ? `No matches for "${search.trim()}".` : 'Nothing to show yet.'}
                </Text>
              </View>
            ) : (
              <View
                style={[styles.listArea, { maxHeight: winH * 0.5 }]}
                onLayout={(e) => {
                  const w = e?.nativeEvent?.layout?.width;
                  if (w) setViewportW(w);
                }}
              >
                {/* Off-screen probe: a flex-start column is exactly as wide as its
                    widest child, so one onLayout on the wrapper gives the widest
                    option's width — enough to size the list so the whole thing
                    scrolls sideways to read long names (no per-row scrollers).
                    (onLayout on <Text> can fire with a null event, so measure the
                    wrapping View instead.) */}
                <View
                  pointerEvents="none"
                  style={styles.measure}
                  onLayout={(e) => {
                    const w = e?.nativeEvent?.layout?.width;
                    if (w) setContentW(w);
                  }}
                >
                  {widestProbe.map((o) => (
                    <Text key={o.value} style={styles.measureText}>
                      {o.label}
                    </Text>
                  ))}
                </View>

                {/* One horizontal scroller moves the whole list; the native
                    indicator (kept visible on Android) signals it's swipeable. */}
                {viewportW > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator
                    persistentScrollbar
                    directionalLockEnabled
                    style={styles.hScroll}
                    contentContainerStyle={styles.hScrollContent}
                    keyboardShouldPersistTaps="handled"
                  >
                    <FlatList
                      data={filtered}
                      keyExtractor={(o) => o.value}
                      style={[styles.list, { width: Math.max(viewportW, contentW + ROW_H_EXTRA) }]}
                      contentContainerStyle={styles.listContent}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                      renderItem={({ item }) => {
                        const active = item.value === value;
                        return (
                          <Pressable
                            onPress={() => select(item.value)}
                            style={({ pressed }) => [
                              styles.row,
                              active && styles.rowActive,
                              pressed && !active && styles.rowPressed,
                            ]}
                          >
                            <Text
                              style={[styles.rowText, active && styles.rowTextActive]}
                              numberOfLines={1}
                            >
                              {item.label}
                            </Text>
                            {active ? (
                              <Feather
                                name="check"
                                size={18}
                                color={colors.white}
                                style={styles.rowCheck}
                              />
                            ) : null}
                          </Pressable>
                        );
                      }}
                    />
                  </ScrollView>
                ) : null}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  label: {
    fontFamily: font.family.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.mutedLabel,
    textTransform: 'uppercase',
  },
  required: {
    fontFamily: font.family.bold,
    fontSize: 11,
    color: colors.pinkDark,
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md + 4,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  fieldPressed: {
    borderColor: colors.inputBorderFocus,
    backgroundColor: colors.white,
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  leadingIcon: {
    marginRight: 2,
  },
  fieldText: {
    flex: 1,
    fontFamily: font.family.medium,
    fontSize: 15,
    color: colors.blackSoft,
  },
  fieldPlaceholder: {
    fontFamily: font.family.regular,
    color: colors.mutedPlaceholder,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkLight,
  },
  clearBtnPressed: {
    backgroundColor: colors.demoCardPurpleBg,
  },

  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '72%',
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: spacing.lg,
    shadowColor: colors.black,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  cardTitle: {
    flex: 1,
    fontFamily: font.family.serif,
    fontSize: font.sizes.lg + 1,
    color: colors.black,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    backgroundColor: colors.pinkLight,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.inputBg,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    marginRight: 2,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.family.regular,
    fontSize: font.sizes.md,
    color: colors.black,
    padding: 0,
  },
  listArea: {
    flexShrink: 1,
  },
  // Off-screen probe used only to measure the widest option's width.
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
    zIndex: -1,
    alignItems: 'flex-start',
  },
  measureText: {
    // Measure at the heaviest weight a row can use so real rows never clip.
    fontFamily: font.family.semibold,
    fontSize: font.sizes.md,
  },
  hScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  hScrollContent: {
    // Fill the modal width when names are short; grow with the list otherwise.
    flexGrow: 1,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.pinkLight,
    marginBottom: spacing.sm,
  },
  rowActive: {
    backgroundColor: colors.purple,
  },
  rowPressed: {
    backgroundColor: colors.demoCardPurpleBg,
  },
  rowCheck: {
    marginLeft: spacing.sm,
  },
  rowText: {
    flexShrink: 1,
    fontFamily: font.family.medium,
    fontSize: font.sizes.md,
    color: colors.blackSoft,
  },
  rowTextActive: {
    fontFamily: font.family.semibold,
    color: colors.white,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.md,
    color: colors.mutedText,
    textAlign: 'center',
  },
});
