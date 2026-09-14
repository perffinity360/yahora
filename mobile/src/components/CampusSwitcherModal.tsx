import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useUniversities } from '../hooks/useUniversities';
import { colors, font, radius, spacing } from '../theme';
import type { University } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentId: string | null | undefined;
  /**
   * The student's OWN university (profile.university_id), pinned above the
   * search box and removed from the list below. Null/undefined — or an id the
   * campus list does not carry — renders no pinned section. Never an error:
   * a profile without a university_id must still be able to browse.
   */
  homeId: string | null | undefined;
  onSelect: (u: University) => void;
}

/**
 * One campus row. Shared by the pinned entry and the list entries so the two
 * cannot drift apart visually — the pin is the same row in a different place,
 * not a second design.
 */
function CampusRow({
  university,
  active,
  onPress,
}: {
  university: University;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && !active && styles.rowPressed]}
    >
      <View style={[styles.pin, active && styles.pinActive]} />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, active && styles.rowNameActive]}>{university.name}</Text>
        <Text style={styles.rowDomain}>@{university.domain}</Text>
      </View>
      {active ? <Feather name="check" size={18} color={colors.purple} /> : null}
    </Pressable>
  );
}

/** Searchable campus picker for cross-campus browsing (4-iv). */
export function CampusSwitcherModal({ visible, onClose, currentId, homeId, onSelect }: Props) {
  const { data, isLoading, error, refetch, isFetching } = useUniversities();
  const [search, setSearch] = useState('');

  // Looked up rather than assumed present. A demo user's own campus IS the demo
  // university, so it pins like any other with no special case; a null
  // university_id, or an id the active list no longer carries, yields null and
  // the pinned section simply does not render.
  const homeUniversity = useMemo<University | null>(
    () => (homeId ? (data ?? []).find((u) => u.id === homeId) ?? null : null),
    [data, homeId],
  );

  // The home campus is dropped from this list: it lives above the search box
  // instead. Two reasons — typing must never filter away the one entry the
  // student most wants, and seeing your own campus twice reads as a bug.
  const filtered = useMemo<University[]>(() => {
    const q = search.trim().toLowerCase();
    const list = (data ?? []).filter((u) => u.id !== homeUniversity?.id);
    if (!q) return list;
    return list.filter(
      (u) => u.name.toLowerCase().includes(q) || u.domain.toLowerCase().includes(q),
    );
  }, [data, search, homeUniversity]);

  // Unchanged from the inline handler this replaces: select, then close. The
  // demo restriction lives in the parent's onSelect and still fires first.
  const handleSelect = (u: University) => {
    onSelect(u);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />

        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Switch Campus</Text>
            <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}>
              <Feather name="x" size={20} color={colors.mutedText} />
            </Pressable>
          </View>

          {homeUniversity ? (
            <>
              <Text style={styles.sectionLabel}>YOUR CAMPUS</Text>
              <CampusRow
                university={homeUniversity}
                active={homeUniversity.id === currentId}
                onPress={() => handleSelect(homeUniversity)}
              />
              <View style={styles.divider} />
            </>
          ) : null}

          <View style={styles.searchWrap}>
            <Feather name="search" size={16} color={colors.mutedLabel} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search universities…"
              placeholderTextColor={colors.mutedPlaceholder}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {isLoading ? (
            <View style={styles.statusBox}>
              <ActivityIndicator color={colors.purple} />
              <Text style={styles.statusText}>Loading campuses…</Text>
            </View>
          ) : error ? (
            <View style={styles.statusBox}>
              <Text style={styles.errorText}>Failed to load campuses.</Text>
              <Pressable onPress={() => refetch()} style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}>
                <Text style={styles.retryBtnText}>{isFetching ? 'Retrying…' : 'Retry'}</Text>
              </Pressable>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>
                {search.trim()
                  ? `No campuses match "${search.trim()}".`
                  : homeUniversity
                    ? 'No other campuses yet.'
                    : 'No campuses available yet.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              ListHeaderComponent={
                homeUniversity ? <Text style={styles.sectionLabel}>ALL CAMPUSES</Text> : null
              }
              keyExtractor={(u) => u.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <CampusRow
                  university={item}
                  active={item.id === currentId}
                  onPress={() => handleSelect(item)}
                />
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxWidth: 500,
    maxHeight: '82%',
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
  title: {
    fontFamily: font.family.serif,
    fontSize: font.sizes.xl,
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
  // Matches the uppercase field labels on the login screen.
  sectionLabel: {
    fontFamily: font.family.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.mutedLabel,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginBottom: spacing.md,
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
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.family.regular,
    fontSize: font.sizes.md,
    color: colors.black,
    padding: 0,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  listContent: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  rowActive: {
    borderColor: colors.inputBorderFocus,
    backgroundColor: colors.demoCardPurpleBg,
  },
  rowPressed: {
    backgroundColor: colors.pinkBg,
  },
  pin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.mutedPlaceholder,
    marginRight: spacing.md,
  },
  pinActive: {
    backgroundColor: colors.purple,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.md,
    color: colors.blackSoft,
  },
  rowNameActive: {
    color: colors.purpleDark,
  },
  rowDomain: {
    marginTop: 2,
    fontFamily: font.family.regular,
    fontSize: font.sizes.sm,
    color: colors.mutedText,
  },
  statusBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  statusText: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.md,
    color: colors.mutedText,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.md,
    color: colors.errorText,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnPressed: {
    backgroundColor: colors.purpleDark,
  },
  retryBtnText: {
    fontFamily: font.family.semibold,
    color: colors.white,
  },
});
