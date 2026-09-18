import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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

/** The brand sweep used by the website's home ring and badge (Marketplace.module.css). */
const HOME_RING = [colors.pink, colors.purpleLight, colors.purple] as const;
const HOME_BADGE = [colors.pinkDark, colors.purple] as const;

/**
 * One campus row. Shared by the pinned entry and the list entries so the two
 * cannot drift apart visually — the pin is the same row in a different place,
 * not a second design.
 *
 * Mirrors the website's switcher (UniSwitcher in Marketplace.jsx) state for
 * state, because a student who uses both should recognise their own campus
 * instantly on either:
 *
 *   home   — white card inside a pink→violet→purple gradient ring, a soft pink
 *            glow, a pink dot, and a gradient "HOME CAMPUS" badge. It keeps
 *            this look WHICHEVER campus is being viewed: it answers "which one
 *            is mine", which is a different question from "which one am I on".
 *   active — tinted card with a purple spine down the left edge, a haloed
 *            purple dot, purple name, and a filled check.
 *   both   — home's ring and badge, active's tint, spine and check.
 */
function CampusRow({
  university,
  active,
  home = false,
  onPress,
}: {
  university: University;
  active: boolean;
  home?: boolean;
  onPress: () => void;
}) {
  // The badge settles in once, just after the sheet opens — a cue that this row
  // is special, not a loop competing with the list for attention.
  const badgeIn = useRef(new Animated.Value(home ? 0 : 1)).current;
  useEffect(() => {
    if (!home) return;
    Animated.timing(badgeIn, {
      toValue: 1,
      duration: 360,
      delay: 80,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [home, badgeIn]);

  const body = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${university.name}${home ? ', your home campus' : ''}${active ? ', currently viewing' : ''}`}
      style={({ pressed }) => [
        styles.row,
        home && styles.rowHome,
        active && styles.rowActive,
        pressed && styles.rowPressed,
      ]}
    >
      {/* Spine: the website's ::before bar, the "you are here" marker. */}
      {active ? (
        <LinearGradient
          colors={[colors.purpleLight, colors.purple]}
          style={styles.spine}
          pointerEvents="none"
        />
      ) : null}

      <View
        style={[
          styles.dot,
          home && styles.dotHome,
          active && styles.dotActive,
        ]}
      />

      <View style={styles.rowText}>
        <Text style={[styles.rowName, active && styles.rowNameActive]} numberOfLines={2}>
          {university.name}
        </Text>
        <Text style={styles.rowDomain} numberOfLines={1}>
          @{university.domain}
        </Text>

        {home ? (
          <Animated.View
            style={[
              styles.badgeWrap,
              {
                opacity: badgeIn,
                transform: [
                  { translateY: badgeIn.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) },
                  { scale: badgeIn.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={HOME_BADGE}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badge}
            >
              <Feather name="home" size={10} color={colors.white} />
              <Text style={styles.badgeText}>HOME CAMPUS</Text>
            </LinearGradient>
          </Animated.View>
        ) : null}
      </View>

      {active ? (
        <View style={styles.check}>
          <Feather name="check" size={13} color={colors.white} />
        </View>
      ) : null}
    </Pressable>
  );

  if (!home) return body;

  // The ring: a gradient 1.5 points wider than the card on every side. A
  // bordered View cannot carry a gradient, so the card sits inside one and the
  // gradient shows only around its edge — the same effect as the website's
  // masked ::after, without the mask.
  return (
    <LinearGradient
      colors={HOME_RING}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.55, 1]}
      style={[styles.ring, active ? styles.ringActiveShadow : styles.ringShadow]}
    >
      {body}
    </LinearGradient>
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
              <Text style={[styles.sectionLabel, styles.sectionLabelPinned]}>YOUR CAMPUS</Text>
              <CampusRow
                university={homeUniversity}
                home
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
  sectionLabelPinned: {
    color: colors.purple,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md + 2,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  // Inside the ring: the ring IS the border, so the card drops its own, and its
  // radius steps in by the ring's width so the curve stays concentric.
  rowHome: {
    borderWidth: 0,
    marginBottom: 0,
    borderRadius: radius.md + 0.5,
  },
  rowActive: {
    backgroundColor: colors.pinkLight,
    borderColor: colors.inputBorderFocus,
  },
  rowPressed: {
    transform: [{ scale: 0.98 }],
  },

  ring: {
    padding: 1.5,
    borderRadius: radius.md + 2,
    marginBottom: spacing.sm,
  },
  ringShadow: {
    shadowColor: colors.pinkDark,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  ringActiveShadow: {
    shadowColor: colors.purple,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },

  spine: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.mutedPlaceholder,
  },
  dotHome: {
    backgroundColor: colors.pink,
  },
  // A halo rather than a bigger dot, so the row's alignment does not shift
  // when the active campus changes.
  dotActive: {
    backgroundColor: colors.purple,
    borderWidth: 3,
    borderColor: colors.pinkBg,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginHorizontal: -3,
  },

  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.md,
    color: colors.blackSoft,
  },
  rowNameActive: {
    color: colors.purpleDark,
  },
  rowDomain: {
    marginTop: 1,
    fontFamily: font.family.regular,
    fontSize: 12,
    color: colors.mutedLabel,
  },

  badgeWrap: {
    alignSelf: 'flex-start',
    marginTop: 6,
    shadowColor: colors.pinkDark,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: font.family.bold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: colors.white,
  },

  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purple,
    shadowColor: colors.purple,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
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
