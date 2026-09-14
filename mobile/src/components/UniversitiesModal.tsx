import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
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
  /**
   * The signed-in student's own university, pinned above the search box and
   * removed from the list below — same treatment as the campus switcher.
   *
   * This list is informational (rows do not select anything), so the pin is a
   * "this one is yours" marker, not a control.
   *
   * Null when nobody is signed in, which on mobile is the only state this modal
   * is currently reachable in: it opens from the login screen, and the router
   * guard in app/_layout.tsx sends anyone holding a session to (tabs). The prop
   * is honoured anyway so the modal is already correct if it is ever surfaced
   * to a signed-in student.
   */
  homeId?: string | null;
}

export function UniversitiesModal({ visible, onClose, homeId }: Props) {
  const { data, isLoading, error, refetch, isFetching } = useUniversities();
  const [search, setSearch] = useState('');

  // Looked up, never assumed: no session, a null university_id, or an id the
  // active list does not carry all yield null and render no pinned section.
  const homeUniversity = useMemo<University | null>(
    () => (homeId ? (data ?? []).find((u) => u.id === homeId) ?? null : null),
    [data, homeId],
  );

  // Dropped from the list below — it sits above the search box, where typing
  // cannot filter it away and it cannot appear twice.
  const filtered = useMemo<University[]>(() => {
    const q = search.trim().toLowerCase();
    const list = (data ?? []).filter((u) => u.id !== homeUniversity?.id);
    if (!q) return list;
    return list.filter(
      (u) => u.name.toLowerCase().includes(q) || u.domain.toLowerCase().includes(q),
    );
  }, [data, search, homeUniversity]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop sits behind the card so taps outside dismiss, while the card's
            FlatList keeps its own scroll gesture (no wrapping Pressable). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Supported Campuses</Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
            >
              <Text style={styles.closeBtnText}>×</Text>
            </Pressable>
          </View>

          {homeUniversity ? (
            <>
              <Text style={styles.sectionLabel}>YOUR CAMPUS</Text>
              <View style={[styles.row, styles.rowHome]}>
                <View style={styles.pin} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, styles.rowNameHome]}>{homeUniversity.name}</Text>
                  <Text style={styles.rowDomain}>@{homeUniversity.domain}</Text>
                </View>
                <Feather name="check" size={18} color={colors.purple} />
              </View>
              <View style={styles.divider} />
            </>
          ) : null}

          <View style={styles.searchWrap}>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search your university or domain..."
              placeholderTextColor={colors.mutedPlaceholder}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.divider} />

          {isLoading ? (
            <View style={styles.statusBox}>
              <ActivityIndicator color={colors.purple} />
              <Text style={styles.statusText}>Loading campuses…</Text>
            </View>
          ) : error ? (
            <View style={styles.statusBox}>
              <Text style={styles.errorText}>Failed to load campuses.</Text>
              <Pressable
                onPress={() => refetch()}
                style={({ pressed }) => [styles.retryBtn, pressed && styles.retryBtnPressed]}
              >
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
                <View style={styles.row}>
                  <View style={styles.pin} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowDomain}>@{item.domain}</Text>
                  </View>
                </View>
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
  closeBtnText: {
    fontSize: 24,
    lineHeight: Platform.OS === 'ios' ? 26 : 28,
    color: colors.mutedText,
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
  searchWrap: {
    marginBottom: spacing.md,
  },
  searchInput: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.md,
    fontFamily: font.family.regular,
    fontSize: font.sizes.md,
    color: colors.black,
    backgroundColor: colors.inputBg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  listContent: {
    paddingVertical: spacing.sm,
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
  rowHome: {
    borderColor: colors.inputBorderFocus,
    backgroundColor: colors.demoCardPurpleBg,
  },
  rowNameHome: {
    color: colors.purpleDark,
  },
  pin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.purple,
    marginRight: spacing.md,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.md,
    color: colors.blackSoft,
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
