import Feather from '@expo/vector-icons/Feather';
import Slider from '@react-native-community/slider';
import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import type { MarketplaceFilters } from '../hooks/useMarketplaceFilters';
import {
  formatRupees,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_CONDITIONS,
  POSTING_DATE_OPTIONS,
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
} from '../lib/marketplace';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: MarketplaceFilters;
}

/** Bottom-sheet filter panel: categories, price, condition, posting date, toggles. */
export function FilterSheet({ visible, onClose, filters }: Props) {
  const {
    selCategories,
    toggleCategory,
    priceRange,
    setPriceRange,
    selConditions,
    toggleCondition,
    selPostingDate,
    setSelPostingDate,
    showWishlist,
    setShowWishlist,
    showMyListings,
    setShowMyListings,
    activeFilterCount,
    clearFilters,
  } = filters;

  const [min, max] = priceRange;
  const maxLabel = max >= PRICE_MAX ? `${formatRupees(PRICE_MAX)}+` : formatRupees(max);

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close filters" />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}>
              <Feather name="x" size={20} color={colors.mutedText} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Categories */}
            <Section icon="tag" title="Categories">
              <View style={styles.chipWrap}>
                {MARKETPLACE_CATEGORIES.map((c) => (
                  <Chip key={c} label={c} active={selCategories.includes(c)} onPress={() => toggleCategory(c)} />
                ))}
              </View>
            </Section>

            {/* Price */}
            <Section icon="dollar-sign" title="Price range">
              <View style={styles.priceLabels}>
                <Text style={styles.priceValue}>{formatRupees(min)}</Text>
                <Text style={styles.priceValue}>{maxLabel}</Text>
              </View>
              <Text style={styles.sliderCaption}>Minimum</Text>
              <Slider
                minimumValue={PRICE_MIN}
                maximumValue={PRICE_MAX}
                step={PRICE_STEP}
                value={min}
                onValueChange={(v) => setPriceRange([Math.min(v, max), max])}
                minimumTrackTintColor={colors.purple}
                maximumTrackTintColor={colors.hairline}
                thumbTintColor={colors.purple}
              />
              <Text style={styles.sliderCaption}>Maximum</Text>
              <Slider
                minimumValue={PRICE_MIN}
                maximumValue={PRICE_MAX}
                step={PRICE_STEP}
                value={max}
                onValueChange={(v) => setPriceRange([min, Math.max(v, min)])}
                minimumTrackTintColor={colors.purple}
                maximumTrackTintColor={colors.hairline}
                thumbTintColor={colors.purple}
              />
            </Section>

            {/* Condition */}
            <Section icon="star" title="Item condition">
              <View style={styles.chipWrap}>
                {MARKETPLACE_CONDITIONS.map((c) => (
                  <Chip key={c} label={c} active={selConditions.includes(c)} onPress={() => toggleCondition(c)} />
                ))}
              </View>
            </Section>

            {/* Posting date */}
            <Section icon="calendar" title="Posting date">
              <View style={styles.chipWrap}>
                {POSTING_DATE_OPTIONS.map((d) => (
                  <Chip
                    key={d.key}
                    label={d.label}
                    active={selPostingDate === d.key}
                    onPress={() => setSelPostingDate(selPostingDate === d.key ? '' : d.key)}
                  />
                ))}
              </View>
            </Section>

            {/* Toggles */}
            <Section icon="sliders" title="Quick filters">
              <ToggleRow
                icon="heart"
                label="My Wishlist"
                sub="Only items you've saved"
                value={showWishlist}
                onValueChange={setShowWishlist}
              />
              <ToggleRow
                icon="list"
                label="My Listings"
                sub="Only items you've posted"
                value={showMyListings}
                onValueChange={setShowMyListings}
              />
            </Section>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={clearFilters}
              disabled={activeFilterCount === 0}
              style={({ pressed }) => [
                styles.clearBtn,
                pressed && styles.clearBtnPressed,
                activeFilterCount === 0 && styles.clearBtnDisabled,
              ]}
            >
              <Feather name="x" size={15} color={colors.pinkDark} />
              <Text style={styles.clearText}>Clear all{activeFilterCount ? ` (${activeFilterCount})` : ''}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.applyBtn, pressed && styles.applyBtnPressed]}>
              <Text style={styles.applyText}>Apply</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ────────────────────────── Bits ────────────────────────── */
function Section({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Feather name={icon} size={15} color={colors.purple} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.chipPressed]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  sub,
  value,
  onValueChange,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  sub: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleIcon}>
        <Feather name={icon} size={16} color={value ? colors.purple : colors.mutedLabel} />
      </View>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.purple, false: colors.hairline }}
        thumbColor={colors.white}
        ios_backgroundColor={colors.hairline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.cardSurface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: font.family.serif,
    fontSize: font.sizes.xl,
    color: colors.blackSoft,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    backgroundColor: colors.pinkLight,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },

  section: {
    marginTop: spacing.lg,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: font.family.bold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.blackSoft,
  },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  chipPressed: {
    borderColor: colors.inputBorderFocus,
  },
  chipText: {
    fontFamily: font.family.semibold,
    fontSize: 13,
    color: colors.blackSoft,
  },
  chipTextActive: {
    color: colors.white,
  },

  priceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  priceValue: {
    fontFamily: font.family.bold,
    fontSize: 15,
    color: colors.purpleDark,
  },
  sliderCaption: {
    fontFamily: font.family.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedLabel,
    marginTop: spacing.xs,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  toggleText: {
    flex: 1,
  },
  toggleLabel: {
    fontFamily: font.family.semibold,
    fontSize: 14,
    color: colors.blackSoft,
  },
  toggleSub: {
    fontFamily: font.family.regular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 1,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.inputBorderFocus,
    backgroundColor: colors.cardSurface,
  },
  clearBtnPressed: {
    backgroundColor: colors.pinkLight,
  },
  clearBtnDisabled: {
    opacity: 0.5,
  },
  clearText: {
    fontFamily: font.family.semibold,
    fontSize: 14,
    color: colors.pinkDark,
  },
  applyBtn: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purple,
  },
  applyBtnPressed: {
    backgroundColor: colors.purpleDark,
  },
  applyText: {
    fontFamily: font.family.semibold,
    fontSize: 15,
    color: colors.white,
  },
});
