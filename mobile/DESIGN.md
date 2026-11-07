# Yahora Design System — Mobile App (DESIGN.md)

Generic decisions to reuse on new screens. Screen-level detail lives in that screen's spec under
`docs/design/`. The website's twin of this file is `frontend/DESIGN.md`. If a decision applies to both,
change both.

**Brand:** Inter for text. Bree Serif, regular 400 only, for headings and prices. Colours come from
`src/theme`.

## Before building any screen

1. List the scenarios: empty, loading, error, long text, big numbers, small and large phones, keyboard open,
   reduced motion.
2. Look at how the best apps solve it, and search for current practice when it isn't obvious.
3. Decide, and write down why.
4. Build it, then add anything reusable to this file.

## Tools and our own assets

- **Installing or adding a design skill or package is allowed and encouraged.** We want the best possible
  design: modern, premium, attractive and beautiful. Don't settle for less to avoid adding a dependency.
- **Look for something pre-built first. If we can't add one from somewhere, create it ourselves:** animations,
  motion graphics, stickers, or any other web or app component.

## Density

- **Compact by default.** Body 14/20, secondary 13, small labels 12. Controls look 24–28 pt tall.
- Don't make things bigger to fill space. Let the content have the room.

## Text people write

- **Messages and posts are drawn with WhatsApp's formatting** (`*bold*`, `_italic_`, lists, quotes, links)
  through `src/components/FormattedText.tsx`, and stored exactly as typed. Previews on one line use
  `plainText()` from `src/lib/textFormat.ts`. Bold and italic are real font files (`font.family.bold`,
  `italic`, `boldItalic`), never `fontWeight` / `fontStyle`. See `docs/design/TEXT_FORMAT_SPEC.md`.

## Surfaces

- **Avoid cards inside cards.** In a list, use flat rows split by a hairline.
- **Floating chrome.** Switchers and composers float, with content passing underneath. Use `expo-blur` for the
  glass. It feels more spacious than a solid bar.
- **Text on a patterned background gets a halo,** the way maps keep labels readable: a `textShadow` with no
  offset, radius about 4, in the ground's own light colour. The website tried frosted glass first; it still
  looked busy.
- Lines that must join, like a reply thread: use an opaque colour and rows that touch. Alpha shows every overlap
  as a darker patch.

## Icons over words

- Our students know these icons. Use an icon for an obvious action (react, reply, sort, send), with an
  `accessibilityLabel`. Keep words for anything an icon can't say.
- **Emoji are not interface icons;** they look cheap. Emoji are for content: reactions, and flags.

## Using width well

- **An avatar gets a column of its own.** Everything in the row, text, media, actions and nested replies,
  starts at one left edge. A drop cap was tried on the website; it made rows hard to scan.
- **A metadata line is exactly one line.** Decide what truncates first and what never goes. Drop what the
  context already says, such as a campus name in that campus's own feed.

## Touch

- Thin to look at, 44 pt to touch. Use `hitSlop` to reach it.
- Long-press is the route to anything the website does on hover.
- Never hide an action behind a second tap on something that looks selected. Give it its own button.

## Motion

- Reanimated on the UI thread. Use a spring for small things that should pop.
- Press: scale with a light haptic (`PressableScale`). Small reveals: 180–280 ms. Entrances: up to 320 ms, moving
  4–8 pt, fading as they move.
- Stagger short lists by 18–28 ms, and stop after about six items.
- Respect `ReducedMotionConfig`.

## Quality floor

- Text contrast at least 4.5:1 (3:1 for large text and icons). `mutedText` is 4.44:1 on `chatCanvas`, so use
  `communityMuted` there.
- New colours become theme tokens, never hardcoded values, and each one is listed with its web variable name.
