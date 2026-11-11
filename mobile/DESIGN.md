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

## Surfaces

- **Avoid cards inside cards.** A list on a plain ground uses flat rows split by a hairline. **A list on a
  patterned ground uses slim frosted cards** (the website's community, owner 7 Nov): white at about 94%,
  radius 16, padding about 12 / 14, 12 apart, with the pattern itself faint (about 5%).
- **Floating chrome.** Switchers float, with content passing underneath. Use `expo-blur` for the glass.
  It feels more spacious than a solid bar. **A composer at the bottom is the exception: a solid dock, edge
  to edge** (owner, 10 Nov). Floating, it left a gap below it, and the posts passing through that gap and
  around its ends looked messy and confusing.
  **The dock's colour runs on behind the home indicator / navigation bar:** pad it by the bottom safe-area
  inset instead of stopping above it, so that strip is never a different colour.
- **Never put text straight on a pattern.** The website's text halo still read as messy and was removed
  (owner, 7 Nov) in favour of the frosted cards above.
- Lines that must join, like a reply thread: use an opaque colour and rows that touch. Alpha shows every overlap
  as a darker patch.

## Icons over words

- Our students know these icons. Use an icon for an obvious action (react, reply, sort, send), with an
  `accessibilityLabel`. Keep words for anything an icon can't say.
- **Emoji are not interface icons;** they look cheap. Emoji are for content: reactions, and flags.

## Using width well

- **An avatar gets a column of its own.** Everything in the row, text, media, actions and nested replies,
  starts at one left edge. A drop cap was tried on the website; it made rows hard to scan.
- **Centre an avatar on the middle of the name's lowercase letters,** not on its line box: the eye
  centres on the lowercase letters, which sit about 1 pt below a line's middle (owner, 10 Nov). Work it out
  from the font's x-height and baseline, never a pixel nudge, since each screen draws text a little
  differently; then lift it 1 pt (owner, 10 Nov). Every other piece of text on that line (campus, time,
  like count) is placed the same way, so they line up.
- **A metadata line never wraps on its own.** Decide what truncates first and what never goes. Drop what the
  context already says, such as a campus name in that campus's own feed. Anything else **truncates with
  `…` rather than disappearing** on a narrow screen (the campus in a world feed was hidden on phones
  until 10 Nov). **Where the secondary part would be mostly `…` on a phone (a reply's campus,
  squeezed by its like), give it a line of its own,** close under the name like Quora's credential line:
  name and actions on the first line, `campus · time` tucked right under it (owner, 10 Nov). **It sits
  plainly nearer the name than the text below sits to it** (the website's community: about 7 from the
  tails of j and p to the campus, 11 from the campus to the text), or it reads as part of the text. If the
  name can sit on a highlight pill, check the pill's edge clears that line, and keep the pill centred on the
  letters wherever they move. Where there's
  room (a post's author line), stay on one line.
- **People are shown by `@username`, never by full name** (owner, 10 Nov). The full name only picks an
  avatar's initials and colour, so the same person looks the same everywhere.

## Touch

- Thin to look at, 44 pt to touch. Use `hitSlop` to reach it.
- Long-press is the route to anything the website does on hover. But if a button's hover offers a
  choice (the React button's quick bar), **a tap on the button opens the choice**; it never picks a
  default for you (owner, 10 Nov).
- Never hide an action behind a second tap on something that looks selected. Give it its own button.

## Shadows and overlays

- **Shadows are `boxShadow` strings** from `shadows` in `src/theme` (RN 0.76+), the same values as the
  website's CSS variables, so a card or a menu floats the same on both.
- **A small choice that hangs off a button** (the quick bar, the country dropdown) opens in a transparent
  `Modal`, placed from the button's `measureInWindow`, so a card or a list never clips it. A press outside
  closes it; it never moves the content under it.

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
