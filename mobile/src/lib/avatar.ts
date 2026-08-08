/**
 * Avatar fallbacks for users without a photo.
 *
 * Mirrors the web `AvatarImg` helper (frontend ProductDetail.jsx) so the same
 * person gets the same initials and the same tint on both clients — a small
 * consistency that makes the two apps feel like one product.
 */

/** "Aditi Rao Hydari" → "AR". Empty string when there is no usable name. */
export function initialsOf(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Deterministic placeholder tint derived from the name's char codes. */
export function avatarHue(name?: string | null): string {
  const seed = name ? [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360 : 200;
  return `hsl(${seed}, 55%, 55%)`;
}
