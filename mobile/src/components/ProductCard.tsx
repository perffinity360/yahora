import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
 * ── KEEPING THE TWO COLUMNS IN STEP ──
 *
 * Every tile in a grid row has to be the same height, with the dividers and
 * the footers lined up across the two columns.
 *
 * The TITLE is not given reserved room. It takes one line or two, as it needs,
 * and the row does the equalising: all three grids stretch every card in a row
 * to the tallest one (FlashList v2 normalises row heights; the profile grids
 * are wrapping flex rows, which stretch by default), and the footer's
 * `marginTop: 'auto'` pins it to the bottom of the stretched card. So a row
 * where one title wraps lines up exactly as before, and a row where BOTH
 * titles fit on one line no longer carries an empty line under each of them.
 *
 * The LOCATION still gets one reserved line, always rendered even when empty,
 * so a listing with no location does not sit a line shorter than its
 * neighbour inside a row. Its height is `lineHeight x fontScale`: React Native
 * multiplies lineHeight by the student's font setting, so a box measured at
 * scale 1.0 is short at 1.15. Paired with the same cap AppText applies
 * (MAX_FONT_SCALE) — scaling past the cap cannot happen, so reserving for it
 * would only waste space on every card.
 */
const LOCATION_LINE_HEIGHT = 14;
const TITLE_LINE_HEIGHT = 17;
const TITLE_LINES = 2;
/**
 * The seller avatar, and therefore the height of the footer row. It is a fixed
 * dp circle, so it does not grow with the font scale — and the footer row is
 * floored at it so a listing whose seller has no name (the group is not
 * rendered at all) still lines its divider and timestamp up with the card
 * beside it.
 */
const SELLER_AVATAR = 20;

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
 * The location EXACTLY as the seller typed it, with one concession: a leading
 * lowercase letter is capitalised. Uppercasing the whole string (what this card
 * used to do) turned "CSE Department" into shouting and lost the distinction
 * between a building code and a sentence.
 *
 * Comparing against `toUpperCase()` rather than matching /^[a-z]/ so that an
 * accented first letter is handled too, and so a digit or a script without
 * cases ("4th block", Devanagari) is left exactly as it was.
 */
function sentenceCase(value: string): string {
  const first = value.charAt(0);
  const upper = first.toUpperCase();
  return upper === first ? value : upper + value.slice(1);
}

/** "Priya Sharma" -> "PS"; "Priya" -> "P"; nothing usable -> "". */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export interface ProductCardProps {
  product: ProductCardItem;
  onPress?: () => void;
  /** Optional layout override so a parent grid can size the card. */
  style?: StyleProp<ViewStyle>;
  onLike?: () => void;
  isLiked?: boolean;
  // ── Owner actions (dashboard only). ──
  onEdit?: () => void;
  onMarkSold?: () => void;
  onMarkAvailable?: () => void;
  onDelete?: () => void;
  /**
   * The seller, shown on EVERY card including the owner's own listings. When a
   * screen does not pass one, the card falls back to `product.seller`, which
   * marketplace feed rows carry.
   */
  sellerName?: string | null;
  sellerAvatarUrl?: string | null;
  /** When true, render the owner toolbar (sold / available / edit / delete). */
  showManageActions?: boolean;
}

/** Compact round icon button, used only by the owner toolbar. */
function IconBtn({
  icon,
  onPress,
  color = colors.mutedText,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  onPress?: () => void;
  color?: string;
  label?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, pressed && !!onPress && styles.iconBtnPressed]}
    >
      <Feather name={icon} size={15} color={color} />
    </Pressable>
  );
}

function ProductCardBase({
  product,
  onPress,
  style,
  onLike,
  isLiked,
  onEdit,
  onMarkSold,
  onMarkAvailable,
  onDelete,
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
  const imageCount = product.image_urls?.length ?? 0;

  const location = product.location?.trim();
  const locationLabel = location ? sentenceCase(location) : '';

  const seller = (sellerName ?? product.seller?.full_name ?? '').trim();
  const sellerAvatar = resolveMediaUrl(sellerAvatarUrl ?? product.seller?.avatar_url);
  const sellerInitials = initialsOf(seller);

  // The location's reserved line. `fontScale` is the student's system font
  // setting; the cap is AppText's, so the text can never outgrow the box.
  const { fontScale } = useWindowDimensions();
  const locationBox = LOCATION_LINE_HEIGHT * Math.min(fontScale, MAX_FONT_SCALE);

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
          {/* Row 1 — condition badge left, like button right. */}
          <View style={styles.topRow}>
            <View style={[styles.conditionBadge, { backgroundColor: cond.bg }]}>
              <AppText style={[styles.conditionText, { color: cond.text }]} numberOfLines={1}>
                {condLabel}
              </AppText>
            </View>
            <Pressable
              onPress={onLike}
              disabled={!onLike}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={liked ? 'Unlike' : 'Like'}
              style={styles.like}
            >
              {/* MaterialCommunityIcons, not Feather, and only here: Feather
                  ships outline glyphs only, so a liked heart could never be
                  more than a colour change — and colour alone is the weakest
                  signal on a tile you are scanning, doubly so for the ~8% of
                  men with a red-green deficiency. MCI carries both faces of
                  the same heart, so liking it FILLS it. Both states come from
                  one family so the silhouette does not jump on tap. */}
              <MaterialCommunityIcons
                name={liked ? 'heart' : 'heart-outline'}
                size={16}
                color={liked ? colors.pinkDark : colors.mutedText}
              />
              <AppText style={[styles.likeCount, liked && styles.likeCountLiked]} numberOfLines={1}>
                {product.likes_count ?? 0}
              </AppText>
            </Pressable>
          </View>

          {/* Row 2 — the price owns its own row and is the largest element on
              the tile. Bree Serif, like every price in the app and on the
              website; it ships one weight, so never pair it with a bold family
              or a fontWeight. See §3 in DESIGN.md. */}
          <AppText style={styles.price} numberOfLines={1}>
            {formatPrice(product.price)}
          </AppText>

          {/* Row 3 — location. Always rendered, even when empty: the blank line
              is what keeps a listing with no location the same height as one
              with it, so the dividers line up across the two columns. */}
          <AppText
            style={[styles.location, { minHeight: locationBox }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {locationLabel}
          </AppText>

          {/* Row 4 — title, one line or two as it needs. The grid row, not
              this box, keeps the footers level — see the note at the top. */}
          <AppText
            style={styles.title}
            numberOfLines={TITLE_LINES}
            ellipsizeMode="tail"
          >
            {product.title}
          </AppText>

          {/* Row 5 — timestamp left, seller right. `marginTop: 'auto'` is belt
              and braces on top of the reserved boxes above: if anything in a
              row does end up taller, the footers still sit on one line. */}
          <View style={styles.footer}>
            <View style={styles.divider} />
            <View style={styles.footerRow}>
              <AppText style={styles.time} numberOfLines={1}>
                {timeAgo(product.created_at)}
              </AppText>
              {seller ? (
                <View style={styles.seller}>
                  {sellerAvatar ? (
                    <Image
                      source={{ uri: sellerAvatar }}
                      style={styles.sellerAvatar}
                      contentFit="cover"
                      transition={200}
                    />
                  ) : (
                    <View style={styles.sellerAvatarFallback}>
                      <AppText style={styles.sellerInitials}>{sellerInitials}</AppText>
                    </View>
                  )}
                  <AppText style={styles.sellerName} numberOfLines={1} ellipsizeMode="tail">
                    {seller}
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── THE OWNER TOOLBAR IS NOT PART OF THE FOUNDERS' CARD, AND STAYS ──
              Mark sold / mark available / edit / delete exist nowhere else in
              the app — the product detail screen has no way to do any of them,
              so removing this row would leave an owner unable to manage a
              listing at all. Dashboard only (`showManageActions`), below the
              footer, and without the bookmark and share buttons it used to
              carry: those two ARE on the detail screen. */}
          {showManageActions ? (
            <View style={styles.manageRow}>
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
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Reusable across the marketplace, the dashboard, the public profile, the
 *  swipe deck and the sell screen's live preview. */
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
    // Fills the card when a grid row stretches it — see `info`'s flex and the
    // footer's `marginTop: 'auto'`. In a parent with no height of its own (the
    // sell preview, the swipe deck) flex-basis falls back to content, so this
    // is inert there rather than collapsing to zero.
    flex: 1,
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
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 10,
    gap: 4,
  },

  /* Row 1 — badge + like */
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  conditionBadge: {
    flexShrink: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  // `nano` (9) — the ONE place in the app allowed below the 11dp floor, and the
  // only call site of the token. A few uppercase characters in ExtraBold on a
  // saturated pill read as a colour-coded chip rather than as text, which is
  // why the floor does not apply. Nothing else qualifies; see the note beside
  // `nano` in src/theme/index.ts before reaching for it.
  conditionText: {
    fontFamily: font.family.extrabold,
    fontSize: font.sizes.nano,
    letterSpacing: 0.4,
  },
  like: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  // `body` (13) with a 16dp heart: the one number left on the tile reads a
  // step above the timestamp and seller name in the footer, which are `micro`.
  likeCount: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.mutedText,
  },
  likeCountLiked: {
    color: colors.pinkDark,
  },

  /* Row 2 — price */
  price: {
    // Pulled 2dp towards the like row: Bree Serif's tall line box left the
    // price floating further below the heart than the `info` gap intends.
    marginTop: -2,
    textAlign: 'right',
    fontFamily: font.family.serif,
    fontSize: font.sizes.headline,
    color: colors.purple,
  },

  /* Row 3 — location (one reserved line) */
  location: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.micro,
    lineHeight: LOCATION_LINE_HEIGHT,
    color: colors.mutedText,
  },

  /* Row 4 — title (two reserved lines) */
  title: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.body,
    lineHeight: TITLE_LINE_HEIGHT,
    color: colors.blackSoft,
  },

  /* Row 5 — divider + timestamp + seller */
  footer: {
    marginTop: 'auto',
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.hairline,
    marginTop: 6,
    marginBottom: 7,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: SELLER_AVATAR,
  },
  time: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.micro,
    color: colors.mutedLabel,
    // ⚠ React Native defaults flex children to flexShrink: 0, but say it out
    // loud here: the timestamp is short, fixed and the thing that was being
    // clipped before. The seller group beside it is what gives up space.
    flexShrink: 0,
  },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
    // The name yields first — `minWidth: 0` is what actually lets this group
    // shrink below its content width, which is where a long full name would
    // otherwise push the timestamp off the tile.
    flexShrink: 1,
    minWidth: 0,
  },
  sellerAvatar: {
    width: SELLER_AVATAR,
    height: SELLER_AVATAR,
    borderRadius: SELLER_AVATAR / 2,
    backgroundColor: colors.inputBg,
    // The purple ring the website's card already puts on a seller photo
    // (`.sellerAvatar` in frontend/.../ProductCard.module.css: 1.5px solid
    // --purple-emphasis). It is what stops a light or washed-out photo from
    // dissolving into the card surface at 20dp. The initials fallback below
    // does NOT get one — it is already a solid purple disc, and the web
    // fallback has no border either.
    borderWidth: 1.5,
    borderColor: colors.purpleDark,
  },
  sellerAvatarFallback: {
    width: SELLER_AVATAR,
    height: SELLER_AVATAR,
    borderRadius: SELLER_AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purple,
  },
  sellerInitials: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    color: colors.white,
  },
  sellerName: {
    flexShrink: 1,
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    color: colors.mutedText,
  },

  /* Owner toolbar (dashboard only) — must stay on one line inside a narrow
     2-up card, so the buttons spread across the full width. */
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
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
