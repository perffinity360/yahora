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
- **If what we need doesn't exist, create our own:** animations, motion graphics, stickers, or any similar
  component.

## Density

- **Compact by default.** Body 14/20, secondary 13, small labels 12. Controls look 24–28 pt tall.
- Don't make things bigger to fill space. Let the content have the room.

## Surfaces

- **Avoid cards inside cards.** In a list, use flat rows split by a hairline.
- **Floating chrome.** Switchers and composers float, with content passing underneath. Use `expo-blur` for the
  glass. It feels more spacious than a solid bar.
- Text on a patterned background needs something behind it. On trial on the website's community page: frosted
  glass behind the text, faded at the edges. Wait for that decision before building it here.
- Lines that must join, like a reply thread: use an opaque colour and rows that touch. Alpha shows every overlap
  as a darker patch.

## Icons over words

- Our students know these icons. Use an icon for an obvious action (react, reply, sort, send), with an
  `accessibilityLabel`. Keep words for anything an icon can't say.
- **Emoji are not interface icons;** they look cheap. Emoji are for content: reactions, and flags.

## Using width well

- **A post's avatar is a drop cap, not a column.** Only the first lines sit beside it, and media gets the full
  width. React Native can't wrap text around a float, so put the avatar and author line in one row, and start
  the text below at full width. Short nested rows, like replies, are the exception: avatar in its own column,
  and every line starts in the same place.
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
