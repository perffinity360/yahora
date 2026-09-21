import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { resolveMediaUrl } from '../lib/config';
import { colors, conditionColors, font, radius, spacing } from '../theme';
import type { ProductCardItem } from '../types';

const FALLBACK_CONDITION = { bg: colors.blue, text: colors.white };

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
  /** Seller shown on the marketplace feed only (compact first-name tag). */
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
  const firstName = sellerName ? sellerName.trim().split(/\s+/)[0] : '';
  const sellerInitial = firstName ? firstName.charAt(0).toUpperCase() : '?';

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
          <View style={styles.metaRow}>
            <View style={[styles.conditionBadge, { backgroundColor: cond.bg }]}>
              <AppText style={[styles.conditionText, { color: cond.text }]} numberOfLines={1}>
                {condLabel}
              </AppText>
            </View>
            <AppText style={styles.price} numberOfLines={1}>
              {formatPrice(product.price)}
            </AppText>
          </View>

          {product.location ? (
            <AppText style={styles.location} numberOfLines={1}>
              {product.location.toUpperCase()}
            </AppText>
          ) : null}

          <AppText style={styles.title} numberOfLines={1}>
            {product.title}
          </AppText>

          {/* ── THE CARD SHOWS TWO NUMBERS, NOT FOUR (Block V-C) ──
              The view count and the comment count were removed here on
              2026-09-20. They are NOT deleted from the product detail screen or
              the seller dashboard, where a seller is actually asking "how is my
              listing doing"; on a 2-up grid tile they were decoration that
              collided with the timestamp ("1350 1 0 09h ago") at every font
              scale. Removing content is the only responsive fix that holds on
              every device — no amount of flexShrink makes four numbers fit a
              half-width card. The heart stays because it is an ACTION, not a
              stat. Do not add a third number back. */}
          <View style={styles.statsRow}>
            <Pressable
              style={styles.stat}
              onPress={onLike}
              disabled={!onLike}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={liked ? 'Unlike' : 'Like'}
            >
              <Feather name="heart" size={13} color={liked ? colors.pinkDark : colors.mutedText} />
              <AppText style={[styles.statText, liked && styles.statTextLiked]}>
                {product.likes_count ?? 0}
              </AppText>
            </Pressable>
            <AppText style={styles.time} numberOfLines={1}>
              {timeAgo(product.created_at)}
            </AppText>
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
              {firstName ? (
                <View style={styles.sellerTag}>
                  {sellerAvatarUrl ? (
                    <Image
                      source={{ uri: sellerAvatarUrl }}
                      style={styles.sellerAvatar}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={styles.sellerAvatarFallback}>
                      <AppText style={styles.sellerInitial}>{sellerInitial}</AppText>
                    </View>
                  )}
                  <AppText style={styles.sellerName} numberOfLines={1}>
                    {firstName}
                  </AppText>
                </View>
              ) : null}
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
  imageWrap: {
    width: '100%',
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
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 5,
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
  // Bold at `micro` (11) — the floor, which is where a short uppercase label on
  // a saturated pill belongs. The weight, not the size, is what makes it the
  // second thing the eye finds on a tile after the price. It shares a row with
  // the price, so keeping it at 11 is also what keeps "LIKE NEW" from
  // truncating on a narrow 2-up grid.
  conditionText: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    letterSpacing: 0.5,
  },
  // THE LARGEST THING ON THE CARD, deliberately (Block V-C). A tile where the
  // title, the price and the location were all within 2dp of each other gave
  // the eye nothing to land on, which is what read as clutter. On a
  // marketplace the price is the decision, so it is the one element allowed to
  // dominate — `title` (18) against the product title's `body` (13).
  // Bree Serif, like every other price in the app and on the website. It ships
  // one weight (400), so the size carries the emphasis — never pair it with a
  // bold family. See §3 in mobile/DESIGN.md.
  price: {
    flexShrink: 0,
    fontFamily: font.family.serif,
    fontSize: font.sizes.title,
    color: colors.purple,
  },
  location: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    letterSpacing: 0.5,
    color: colors.mutedText,
    marginTop: -2,
  },
  title: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.body,
    color: colors.blackSoft,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // 8, not 10. This dated from when the row carried four items plus three
    // gaps on a card whose width varies by device (the same 2-column grid is
    // ~10dp narrower per card on an OPPO K14 than on a POCO X2, which was
    // enough to push the timestamp off the edge). The row now carries two
    // items and has room to spare; the value is left alone because spacing is
    // Block V-D's to change, not V-C's.
    gap: 8,
    marginTop: 2,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    // ⚠ React Native defaults flex children to flexShrink: 0 — the opposite of
    // the web. Without this the row simply overflows the card and whatever sits
    // last (the timestamp) is clipped, with no ellipsis and no warning. The
    // counts are short, so shrinking these three costs nothing in practice; it
    // just gives the row somewhere to give.
    flexShrink: 1,
    minWidth: 0,
  },
  statText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.mutedText,
  },
  statTextLiked: {
    color: colors.pinkDark,
  },
  time: {
    marginLeft: 'auto',
    fontFamily: font.family.regular,
    fontSize: font.sizes.micro,
    color: colors.mutedLabel,
    // Never shrink and never wrap: this is the element that was being cut off.
    // It keeps its measured width and the stats to its left yield instead.
    flexShrink: 0,
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

  /* Seller tag (marketplace feed only) — first name, truncates with … */
  sellerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
    flexShrink: 1,
    maxWidth: '58%',
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
    fontSize: font.sizes.micro,
    color: colors.white,
  },
  sellerName: {
    flexShrink: 1,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.mutedText,
  },
});
