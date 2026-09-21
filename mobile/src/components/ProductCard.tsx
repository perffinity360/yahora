import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { resolveMediaUrl } from '../lib/config';
import { colors, conditionColors, font, MAX_FONT_SCALE, radius } from '../theme';
import type { ProductCardItem } from '../types';

const FALLBACK_CONDITION = { bg: colors.blue, text: colors.white };

/**
 * ── WHY THIS CARD RESERVES ITS TEXT BOXES (Phase 5, 2026-09-21) ──
 *
 * The grid is a 2-up: FlashList `numColumns={2}` on the marketplace, a wrapped
 * flex row on the dashboard and the public profile. In both, the cards in one
 * row are laid out side by side and NOT stretched to match, so a card whose
 * title wraps to two lines makes its neighbour's footer sit ~18dp higher. The
 * founders see that as "the grid is broken", and no amount of alignment on the
 * row fixes it, because the ragged edge is inside the card.
 *
 * So the three variable-length lines — price, location, title — render into
 * boxes of a FIXED number of line heights, always, even when the product has
 * no location. One line for the price, one for the location, two for the
 * title. Anything longer ellipsises; anything shorter leaves the box empty.
 * Every card on the screen is then exactly as tall as every other card.
 *
 * The boxes are measured in dp, so they have to follow the student's font
 * setting or the second title line gets clipped for anyone who raised it. They
 * are multiplied by the live `fontScale` (capped at MAX_FONT_SCALE, the same
 * cap AppText applies to the glyphs themselves) rather than being constants —
 * see `useWindowDimensions()` in the component.
 */
const LINE = {
  price: 30,
  location: 15,
  title: 18,
} as const;

/** ₹ with Indian digit grouping (12,34,567) — Hermes lacks reliable Intl, so
 *  we group manually instead of relying on `toLocaleString('en-IN')`. */
export function formatPrice(value: number): string {
  const n = Math.round(Number(value) || 0);
  const digits = String(Math.abs(n));
  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${last3}`;
  }
  return `${n < 0 ? '-' : ''}₹${grouped}`;
}

/** Compact relative time ("5m ago"), falling back to a date past a month. */
export function timeAgo(iso: string): string {
  if (!iso) return 'Just now';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 60) return `${Math.max(diff, 0)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / (86400 * 7))}w ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Sentence case for the location line.
 *
 * The line used to be `.toUpperCase()`. It is a student's own free text from
 * the sell form ("Hostel B, Block 3", "girls hostel gate"), and shouting it
 * made the busiest line on the card compete with the title.
 *
 * Only the FIRST character is touched. Lower-casing the rest would be the
 * literal reading of "sentence case", but it also turns "Hostel B" into
 * "Hostel b" and "Block C Mess" into "Block c mess" — these strings are mostly
 * proper nouns, so the rest is left exactly as the student typed it.
 */
export function toSentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Up to two initials for the seller disc — "Priya Rao" -> "PR". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export interface ProductCardProps {
  product: ProductCardItem;
  onPress?: () => void;
  /** Optional layout override so a parent grid can size the card. */
  style?: StyleProp<ViewStyle>;
  // ── Engagement + owner actions (dashboard/public profile/marketplace). ──
  onLike?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onChat?: () => void;
  onEdit?: () => void;
  onMarkSold?: () => void;
  onMarkAvailable?: () => void;
  onDelete?: () => void;
  isLiked?: boolean;
  isSaved?: boolean;
  /**
   * Who posted the listing, shown bottom-right on EVERY surface — including
   * the seller's own dashboard and their own public profile. A card that
   * carries the name everywhere is one card; a card that hides it on your own
   * listings is two layouts to keep in step, and the dashboard grid would sit
   * a row-height off from the marketplace grid for no reason a student can see.
   * Pass the full name; the card truncates it (see `sellerName` in styles).
   */
  sellerName?: string | null;
  sellerAvatarUrl?: string | null;
  /** When true, render the owner toolbar (chat / sold / edit / delete). */
  showManageActions?: boolean;
}

/** Compact round icon button used across the card's action toolbar. */
function IconBtn({
  icon,
  onPress,
  color = colors.mutedText,
  active = false,
  activeColor,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  color?: string;
  active?: boolean;
  activeColor?: string;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconBtn,
        active && styles.iconBtnActive,
        pressed && !!onPress && styles.iconBtnPressed,
      ]}
    >
      <Feather name={icon} size={15} color={active ? activeColor ?? colors.purple : color} />
    </Pressable>
  );
}

function ProductCardBase({
  product,
  onPress,
  style,
  onLike,
  onSave,
  onShare,
  onEdit,
  onMarkSold,
  onMarkAvailable,
  onDelete,
  isLiked,
  isSaved,
  sellerName,
  sellerAvatarUrl,
  showManageActions,
}: ProductCardProps) {
  // Listing photos are minted by the backend against its own SUPABASE_URL,
  // which is loopback in local dev and unreachable from a phone — the tile just
  // renders its grey placeholder. Same fix as avatars; see src/lib/config.ts.
  const image = resolveMediaUrl(product.image_urls?.[0]);
  const cond =
    (product.condition && conditionColors[product.condition as keyof typeof conditionColors]) ||
    FALLBACK_CONDITION;
  const condLabel = (product.condition ?? 'Good').toUpperCase();
  const sold = product.status === 'sold';
  const liked = isLiked ?? product.is_liked ?? false;
  const saved = isSaved ?? product.is_saved ?? false;
  const showEngagementOnly = !showManageActions && !!(onSave || onShare);
  const imageCount = product.image_urls?.length ?? 0;
  const posterName = sellerName?.trim() ?? '';
  const posterAvatar = resolveMediaUrl(sellerAvatarUrl);
  const locationLabel = product.location ? toSentenceCase(product.location) : '';

  // The reserved line boxes, in the student's own scale. `fontScale` is live —
  // changing the system font size re-renders every card — and is clamped to the
  // same cap AppText puts on the glyphs, so the box and its text always agree.
  const { fontScale } = useWindowDimensions();
  const textScale = Math.min(fontScale, MAX_FONT_SCALE);
  const priceLine = Math.ceil(LINE.price * textScale);
  const locationLine = Math.ceil(LINE.location * textScale);
  const titleLine = Math.ceil(LINE.title * textScale);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.shadow, style, pressed && !!onPress && styles.pressed]}
    >
      <View style={styles.inner}>
        <View style={styles.imageWrap}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={220} />
          ) : (
            <View style={styles.imageFallback}>
              <Feather name="image" size={28} color={colors.mutedPlaceholder} />
            </View>
          )}
          {sold ? (
            <View style={styles.soldOverlay}>
              <AppText style={styles.soldText}>SOLD</AppText>
            </View>
          ) : null}
          {imageCount > 1 ? (
            <View style={styles.imageCounter}>
              <AppText style={styles.imageCounterText}>1/{imageCount}</AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.info}>
          {/* ── THE CARD SHOWS ONE NUMBER, NOT FOUR (Block V-C) ──
              The view count and the comment count were removed here on
              2026-09-20. They are NOT deleted from the product detail screen or
              the seller dashboard, where a seller is actually asking "how is my
              listing doing"; on a 2-up grid tile they were decoration that
              collided with the timestamp ("1350 1 0 09h ago") at every font
              scale. Removing content is the only responsive fix that holds on
              every device — no amount of flexShrink makes four numbers fit a
              half-width card. The heart stays because it is an ACTION, not a
              stat, and it now sits on the badge's row where the row has nothing
              else to carry. Do not add a second number back. */}
          <View style={styles.metaRow}>
            <View style={[styles.conditionBadge, { backgroundColor: cond.bg }]}>
              <AppText style={[styles.conditionText, { color: cond.text }]} numberOfLines={1}>
                {condLabel}
              </AppText>
            </View>
            <Pressable
              style={styles.like}
              onPress={onLike}
              disabled={!onLike}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={liked ? 'Unlike' : 'Like'}
            >
              <Feather name="heart" size={14} color={liked ? colors.pinkDark : colors.mutedText} />
              <AppText style={[styles.likeCount, liked && styles.likeCountLiked]} numberOfLines={1}>
                {product.likes_count ?? 0}
              </AppText>
            </Pressable>
          </View>

          {/* Right-aligned and the largest thing on the card by a wide margin
              (Block V-C): on a marketplace the price is the decision. It gets
              its own full-width line so a long one (₹12,34,567) has the whole
              card to use, and `adjustsFontSizeToFit` shrinks it rather than
              ellipsising — "₹12,34,…" is a price nobody can read. */}
          <AppText
            style={[styles.price, { height: priceLine, lineHeight: priceLine }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatPrice(product.price)}
          </AppText>

          {/* Always rendered, even with no location: an empty reserved line is
              what keeps a card with a location the same height as one without. */}
          <AppText
            style={[styles.location, { height: locationLine, lineHeight: locationLine }]}
            numberOfLines={1}
          >
            {locationLabel}
          </AppText>

          <AppText
            style={[styles.title, { height: titleLine * 2, lineHeight: titleLine }]}
            numberOfLines={2}
          >
            {product.title}
          </AppText>

          {/* Footer: age on the left, whoever posted it on the right. */}
          <View style={styles.footerRow}>
            <AppText style={styles.time} numberOfLines={1}>
              {timeAgo(product.created_at)}
            </AppText>
            {posterName ? (
              <View style={styles.sellerTag}>
                {posterAvatar ? (
                  <Image
                    source={{ uri: posterAvatar }}
                    style={styles.sellerAvatar}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={styles.sellerAvatarFallback}>
                    <AppText style={styles.sellerInitial}>{initialsOf(posterName)}</AppText>
                  </View>
                )}
                <AppText style={styles.sellerName} numberOfLines={1}>
                  {posterName}
                </AppText>
              </View>
            ) : null}
          </View>

          {showManageActions ? (
            <View style={[styles.actionRow, styles.actionRowManage]}>
              <IconBtn
                icon="bookmark"
                onPress={onSave}
                active={saved}
                activeColor={colors.white}
                label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
              />
              <IconBtn icon="share-2" onPress={onShare} label="Share" />
              {sold ? (
                <IconBtn
                  icon="rotate-ccw"
                  onPress={onMarkAvailable}
                  color={colors.blueDark}
                  label="Mark available"
                />
              ) : (
                <>
                  <IconBtn
                    icon="check-circle"
                    onPress={onMarkSold}
                    color={colors.successText}
                    label="Mark sold"
                  />
                  <IconBtn icon="edit-2" onPress={onEdit} label="Edit" />
                </>
              )}
              <IconBtn icon="trash-2" onPress={onDelete} color={colors.errorText} label="Delete" />
            </View>
          ) : showEngagementOnly ? (
            <View style={styles.actionRow}>
              <IconBtn
                icon="bookmark"
                onPress={onSave}
                active={saved}
                activeColor={colors.white}
                label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
              />
              <IconBtn icon="share-2" onPress={onShare} label="Share" />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Reusable across the dashboard, public profile and (later) the marketplace. */
export const ProductCard = memo(ProductCardBase);

export default ProductCard;

const styles = StyleSheet.create({
  // Shadow lives on the outer view; the inner view clips the image. Keeping
  // them separate avoids iOS dropping the shadow when `overflow: hidden` is set.
  shadow: {
    borderRadius: radius.lg,
    backgroundColor: colors.cardSurface,
    shadowColor: colors.purple,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  inner: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  // Inset photo: the card surface shows as a thin frame on all four sides
  // rather than the photo running edge to edge into the corners.
  imageWrap: {
    margin: 5,
    borderRadius: radius.md,
    overflow: 'hidden',
    aspectRatio: 1,
    backgroundColor: colors.inputBg,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldText: {
    fontFamily: font.family.serif,
    fontSize: font.sizes.headline,
    letterSpacing: 3,
    color: colors.white,
  },
  info: {
    paddingHorizontal: 11,
    paddingTop: 6,
    paddingBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  conditionBadge: {
    flexShrink: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  // Bold at `nano` (9) — the one place in the app allowed below the 11dp floor,
  // and the reason the exception exists: a three-to-eight character uppercase
  // word on a saturated pill, where the pill and the weight carry the reading,
  // not the point size. It shares a row with the heart, so 9 is also what keeps
  // "LIKE NEW" on one line on a narrow 2-up grid. See `sizes.nano` in
  // src/theme — do not reach for nano anywhere else.
  conditionText: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.nano,
    letterSpacing: 0.5,
  },
  like: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  likeCount: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.mutedText,
  },
  likeCountLiked: {
    color: colors.pinkDark,
  },
  // Height + lineHeight are set inline from the live font scale; see LINE.
  //
  // Bree Serif, because EVERY price in the app is Bree Serif — the detail
  // screen and the dashboard's purchase rows already were, and the card was the
  // one that had drifted onto Inter. ⚠ Bree Serif ships ONE weight (400). There
  // is no bold family to pair it with and `fontWeight` would do nothing here
  // (RN does not synthesize weights for custom faces), so the size carries the
  // emphasis on its own. See §3 in mobile/DESIGN.md.
  price: {
    marginTop: 2,
    textAlign: 'right',
    fontFamily: font.family.serif,
    fontSize: font.sizes.display,
    color: colors.purple,
    includeFontPadding: false,
  },
  location: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.micro,
    letterSpacing: 0.3,
    color: colors.mutedLabel,
    includeFontPadding: false,
  },
  title: {
    marginTop: 1,
    fontFamily: font.family.bold,
    fontSize: font.sizes.bodyLg,
    color: colors.blackSoft,
    includeFontPadding: false,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  time: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.micro,
    color: colors.mutedLabel,
    // Never shrink and never wrap. The timestamp is a fixed, short string and
    // it is the thing that was being clipped before; the name to its right is
    // the element that gives. ⚠ RN defaults flex children to flexShrink: 0 —
    // the opposite of the web — so this is belt and braces, but it is also the
    // line someone will "tidy up" later, and the tidying is what breaks it.
    flexShrink: 0,
  },

  /* Seller tag (bottom-right, every surface) — as much of the name as fits.
     `flex: 1` hands it every dp the timestamp did not take, and the name
     inside truncates with … rather than pushing on the timestamp. */
  sellerTag: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  sellerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.inputBg,
  },
  sellerAvatarFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purple,
  },
  sellerInitial: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.nano,
    color: colors.white,
  },
  sellerName: {
    flexShrink: 1,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.blackSoft,
  },

  // Engagement toolbar (2 icons) — left-aligned with a gap.
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  // Owner toolbar (up to 5 icons) — must stay on a single line inside the
  // narrow 2-up dashboard card, so spread the buttons across the full width.
  actionRowManage: {
    justifyContent: 'space-between',
    gap: 0,
  },
  iconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  /**
   * Saved. Only the bookmark uses this, and it is the one state on the card
   * that has to survive being glanced at: a pale pink disc with a purple
   * outline read as "slightly different", not as "this is in your wishlist".
   * Filled brand purple with a white edge makes it the darkest thing in the
   * row, which is what tells you at a glance which cards you kept.
   */
  iconBtnActive: {
    backgroundColor: colors.purple,
    borderColor: colors.white,
  },
  iconBtnPressed: {
    backgroundColor: colors.pinkLight,
    transform: [{ scale: 0.94 }],
  },

  /* Image-count badge (bottom-right of the photo) */
  imageCounter: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(20,20,20,0.62)',
  },
  imageCounterText: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    color: colors.white,
  },
});
