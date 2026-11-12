import { Easing, Keyframe } from 'react-native-reanimated';

/**
 * Smooth entrances for things that open over the screen (DESIGN.md "Motion").
 *
 * No springs here (owner, 12 Nov): the springy ZoomIn on the quick bar, the ⋯
 * menu, the country dropdown and the report form overshot and wobbled, which
 * read as bouncing. Each now eases out on a timing curve, grows from just under
 * full size (never from zero) and fades in, the way iOS and Material menus open.
 * The origin comes from the view's own `transformOrigin`, so a popover still
 * grows out of the button that opened it.
 */

/** Decelerates hard and settles without overshoot. */
export const EASE_OUT = Easing.bezier(0.2, 0.8, 0.2, 1);

/** A popover hanging off a button: the quick bar, the ⋯ menu, the country dropdown. */
export const POPOVER_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.94 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
}).duration(180);

/** A centred card over a scrim: the report form. A shorter, gentler ConfirmDialog entrance. */
export const DIALOG_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.96 }, { translateY: 8 }] },
  100: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }], easing: EASE_OUT },
}).duration(220);

/**
 * A bottom sheet rising, with its scrim fading in on the same clock. Drive it
 * with a shared value (0 → 1) and the sheet's measured height, never with
 * `SlideInDown`: a layout animation starts a frame after the view is drawn, so
 * in a fresh Modal the sheet flashes in place before it rises (BuyerPickerSheet,
 * 27 Oct; the reaction breakdown, 13 Nov).
 */
export const SHEET_RISE = { duration: 280, easing: Easing.out(Easing.cubic) };
