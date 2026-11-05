# Yahora Design System — Web (DESIGN.md)

Generic decisions to reuse on new pages. Screen-level detail lives in that screen's spec under
`docs/design/`. The app's twin of this file is `mobile/DESIGN.md`. If a decision applies to both,
change both.

**Brand:** Inter for text. Bree Serif, regular 400 only, for headings and prices. Colours come from
the variables in `src/styles/global.css`.

## Before building any screen

1. List the scenarios: empty, loading, error, long text, big numbers, narrowest and widest size, touch
   and mouse, keyboard, reduced motion.
2. Look at how the best apps solve it, and search for current practice when it isn't obvious.
3. Decide, and write down why.
4. Build it, then add anything reusable to this file.

## Density

- **Compact by default.** Body 13/19, secondary 12, small labels 11. Panel headers 36 px, controls 24–28 px.
  Developer tools like LeetCode are the reference for how tight a working surface can be.
- Don't make things bigger to fill space. Let the content have the room.

## Surfaces

- **Avoid cards inside cards.** In a list, use flat rows split by a 1 px hairline, with a soft tint on hover.
- **Floating chrome.** Headers, switchers and composers float on glass (white at about 74%, blur 14),
  and content passes underneath. It feels more spacious than a solid bar.
- Radii stay small on working surfaces: panels 8, menus and dialogs 10–12. Pills are for small actions.
- Text on a patterned background needs a light tint or note behind it.

## Icons over words

- Our students know these icons. Use an icon for an obvious action (react, reply, sort, send), with an
  `aria-label` and a tooltip. Keep words for anything an icon can't say.
- **Emoji are not interface icons;** they look cheap. Use lucide icons, or a drawn SVG for a key moment.
  Emoji are for content: reactions, and flags where we have no other source.

## Using width well

- **An avatar is a drop cap, not a column.** Float it in the corner so only the first lines sit beside it.
  Text wraps below it, and media gets the full width.
- **A metadata line is exactly one line.** Decide what truncates first and what never goes. Drop what the
  context already says, such as a campus name in that campus's own feed.
- **Components respond to their container, not the window.** Use `@container` and `cqi`, because a panel
  can be any width. Keep window media queries for page layout.
- Folding text around a float: use `max-height` with `overflow: clip`. `-webkit-line-clamp` and
  `overflow: hidden` both make a new formatting context, so the text stops wrapping.

## Touch

- Thin to look at, 44 px to touch. Add an invisible `::after` hit area under `@media (pointer: coarse)`.
- Anything on hover needs a touch route, such as a long-press, and a keyboard route.
- Never hide an action behind a second tap on something that looks selected. Give it its own button.

## Motion

- Use `--community-ease` for movement and fades, and `--community-spring` only for small things that
  should pop. Never linear, except spinners.
- Press and hover: 120–180 ms. Small reveals: 180–280 ms. Entrances: up to 320 ms, moving 4–8 px, fading as
  they move.
- Stagger short lists by 18–28 ms, and stop after about six items.
- Animate transform and opacity. To open something to its natural height, animate `grid-template-rows` from
  `0fr` to `1fr`.
- Switch a layout transition on only for a button press. During a drag, follow the pointer exactly.
- Every animation has a `prefers-reduced-motion` way out.

## Quality floor

- Visible `:focus-visible` on every control. Inside a clipped area, use a negative outline offset.
- Text contrast at least 4.5:1 (3:1 for large text and icons). `--muted-text` is 4.44:1 on the chat
  wallpaper, so use `--community-muted` there.
- New colours become variables, never hardcoded values, and each one is listed with its app token name.
- A `position: fixed` element inside a `backdrop-filter` or `@container` parent is trapped by it, so render
  it in a portal.
