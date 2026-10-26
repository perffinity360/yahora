import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Reanimated, { Easing, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './AppText';
import { AppTextInput } from './AppTextInput';
import { AppToast, useToast } from './AppToast';
import { Avatar } from './Avatar';
import { KeyboardAvoider } from './KeyboardAvoider';
import { Skeleton } from './Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { useBuyerCandidates } from '../hooks/useBuyerCandidates';
import { useDashboardActions } from '../hooks/useDashboardActions';
import type { ApiError } from '../lib/api';
import { colors, font } from '../theme';
import type { BuyerCandidate, SaleParty } from '../types';

/** Same entrance as AvatarSheet: only the sheet rises; the scrim is there at once. */
const SHEET_ENTER = SlideInDown.duration(280).easing(Easing.out(Easing.cubic));
const BUTTON_HEIGHT = 48;

/** MARK_SOLD_SPEC §1 "Errors from the server → toast text". */
const SAVE_ERRORS: Record<string, string> = {
  BUYER_NOT_ON_CAMPUS: "That student isn't on this listing's campus.",
  BUYER_NOT_FOUND: "That student's account no longer exists.",
  PRODUCT_NOT_FOUND: 'This listing no longer exists.',
  NOT_PRODUCT_OWNER: 'Only the seller can mark this as sold.',
};
const SAVE_FAILED = "Couldn't save. Check your connection and try again.";
const LOAD_FAILED = "Couldn't load students. Try again.";

function saveErrorText(error: unknown): string {
  const code = (error as ApiError)?.body?.error;
  return (typeof code === 'string' && SAVE_ERRORS[code]) || SAVE_FAILED;
}

/**
 * "Who bought it?" — MARK_SOLD_SPEC.md §1, mobile column.
 *
 * Opens from Mark as sold (`mode` 'sell') and from Change buyer ('change', the
 * current choice already selected). Under 2 characters it lists the people who
 * messaged you about the listing; from 2 it searches your campus. Exactly one
 * row is selected: a person, or "Someone not on Yahora" (`null`, no one is
 * tagged). Saving waits for the server, then closes; the listing card has
 * already changed underneath (useDashboardActions' optimistic patch).
 *
 * Mount it only while it is open: each open starts from `initialBuyerId` with
 * an empty search.
 */
export function BuyerPickerSheet({
  visible,
  onClose,
  product,
  initialBuyerId,
  mode,
}: {
  visible: boolean;
  onClose: () => void;
  product: { id: string; title: string };
  /** undefined = nothing selected; null = "Someone not on Yahora" selected. */
  initialBuyerId: string | null | undefined;
  mode: 'sell' | 'change';
}) {
  const { profile } = useAuth();
  const { markSold } = useDashboardActions(profile?.id);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { toast, showToast } = useToast();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null | undefined>(initialBuyerId);
  // The picked person, so the card can show their name before the server answers.
  const [selectedPerson, setSelectedPerson] = useState<SaleParty | null>(null);

  const candidates = useBuyerCandidates(product.id, query, visible);
  const { errorUpdatedAt, isError } = candidates;
  useEffect(() => {
    if (isError) showToast(LOAD_FAILED);
  }, [isError, errorUpdatedAt, showToast]);

  const saving = markSold.isPending;
  const canSave = selected !== undefined && !saving;

  const pick = (person: BuyerCandidate | null) => {
    setSelected(person ? person.id : null);
    setSelectedPerson(person);
  };

  const save = async () => {
    if (!canSave) return;
    try {
      await markSold.mutateAsync({ id: product.id, buyerId: selected, buyer: selectedPerson });
      onClose();
    } catch (e) {
      showToast(saveErrorText(e));
    }
  };

  const bottomPad = Math.max(16, insets.bottom);

  const skeleton = (
    <>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={36} height={36} rounded={18} />
          <View style={styles.skeletonText}>
            <Skeleton width="45%" height={12} />
            <Skeleton width="30%" height={10} />
          </View>
        </View>
      ))}
    </>
  );
  const rows = candidates.items.map((person) => (
    <PersonRow
      key={person.id}
      person={person}
      selected={selected === person.id}
      onPress={() => pick(person)}
    />
  ));

  // What sits above the divider (spec §1 "The list" and "States").
  let list: ReactNode = null;
  if (candidates.mode === 'messaged') {
    // No label while loading: there may turn out to be no one to label.
    if (candidates.isLoading) list = skeleton;
    else if (rows.length) {
      list = (
        <>
          <AppText style={styles.sectionLabel}>Messaged you about this</AppText>
          {rows}
        </>
      );
    }
  } else {
    list = (
      <>
        <AppText style={styles.sectionLabel}>On your campus</AppText>
        {candidates.isLoading ? (
          skeleton
        ) : rows.length ? (
          rows
        ) : candidates.isError ? null : (
          <AppText style={styles.noMatch}>
            No students on your campus match “{candidates.searchedFor}”.
          </AppText>
        )}
      </>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoider style={styles.overlay}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />

        <Reanimated.View
          entering={SHEET_ENTER}
          style={[styles.sheet, { maxHeight: windowHeight * 0.85, paddingBottom: bottomPad }]}
        >
          <View style={styles.handle} />
          <AppText style={styles.title}>Who bought it?</AppText>
          <AppText style={styles.subtitle} numberOfLines={1}>
            {product.title}
          </AppText>

          <View style={styles.search}>
            <Feather name="search" size={15} color={colors.mutedText} />
            <AppTextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or @username"
              placeholderTextColor={colors.mutedText}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search by name or @username"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
                <Feather name="x" size={15} color={colors.mutedText} />
              </Pressable>
            ) : null}
          </View>

          {list ? (
            <ScrollView
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {list}
            </ScrollView>
          ) : null}

          <View style={styles.divider} />

          <Pressable
            onPress={() => pick(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === null }}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
              selected === null && styles.rowSelected,
            ]}
          >
            <View style={styles.offPlatformIcon}>
              <Feather name="user-x" size={18} color={colors.mutedText} />
            </View>
            <View style={styles.rowText}>
              <AppText style={styles.name} numberOfLines={1}>
                Someone not on Yahora
              </AppText>
              <AppText style={styles.handleText} numberOfLines={1}>
                No one will be tagged
              </AppText>
            </View>
            {selected === null ? <Feather name="check-circle" size={20} color={colors.purple} /> : null}
          </Pressable>

          <Pressable
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave, busy: saving }}
            style={({ pressed }) => [
              styles.confirm,
              selected === undefined && styles.confirmDisabled,
              pressed && canSave && styles.confirmPressed,
            ]}
          >
            <LinearGradient
              colors={[colors.purple, colors.bubbleMineEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.confirmFill}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <AppText style={styles.confirmText}>{mode === 'change' ? 'Save' : 'Mark as sold'}</AppText>
              )}
            </LinearGradient>
          </Pressable>

          <AppToast message={toast} bottom={bottomPad + BUTTON_HEIGHT + 16} />
        </Reanimated.View>
      </KeyboardAvoider>
    </Modal>
  );
}

function PersonRow({
  person,
  selected,
  onPress,
}: {
  person: BuyerCandidate;
  selected: boolean;
  onPress: () => void;
}) {
  const name = person.full_name || person.username || 'Yahora student';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, selected && styles.rowSelected]}
    >
      <Avatar name={name} uri={person.avatar_url} size={36} />
      <View style={styles.rowText}>
        <AppText style={styles.name} numberOfLines={1}>
          {name}
        </AppText>
        {person.username ? (
          <AppText style={styles.handleText} numberOfLines={1}>
            @{person.username}
          </AppText>
        ) : null}
      </View>
      {selected ? <Feather name="check-circle" size={20} color={colors.purple} /> : null}
    </Pressable>
  );
}

export default BuyerPickerSheet;

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.sheetScrimLight },
  sheet: {
    flexShrink: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sheetHandle,
    marginBottom: 12,
  },
  title: {
    fontFamily: font.family.serif,
    fontSize: font.sizes.headline,
    color: colors.black,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: font.family.medium,
    fontSize: font.sizes.body,
    color: colors.mutedText,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    marginTop: 14,
    marginBottom: 6,
    backgroundColor: colors.inputBg,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    color: colors.blackSoft,
  },
  list: { flexShrink: 1 },
  sectionLabel: {
    marginTop: 12,
    marginBottom: 4,
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedText,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowPressed: { backgroundColor: colors.pickerRowPressed },
  rowSelected: { backgroundColor: colors.pickerRowSelected },
  rowText: { flex: 1 },
  name: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.bodyLg,
    color: colors.black,
  },
  handleText: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.caption,
    color: colors.mutedText,
  },
  skeletonText: { flex: 1, gap: 6 },
  noMatch: {
    padding: 16,
    textAlign: 'center',
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    color: colors.mutedText,
  },
  divider: {
    height: 1,
    marginVertical: 8,
    backgroundColor: colors.pickerDivider,
  },
  offPlatformIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
  },
  confirm: {
    marginTop: 12,
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    overflow: 'hidden',
  },
  confirmDisabled: { opacity: 0.4 },
  confirmPressed: { transform: [{ scale: 0.97 }] },
  confirmFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmText: {
    fontFamily: font.family.bold,
    fontSize: 15,
    color: colors.white,
  },
});
