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

## Tools and our own assets

- **Installing or adding a design skill or package is allowed and encouraged.** We want the best possible
  design: modern, premium, attractive and beautiful. Don't settle for less to avoid adding a dependency.
- **Look for something pre-built first. If we can't add one from somewhere, create it ourselves:** animations,
  motion graphics, stickers, or any other web or app component.
- The stack rules in `frontend/CLAUDE.md` §16 still apply, so a Tailwind-based library gets re-implemented in
  CSS Modules rather than installed.

## Density

- **Compact by default.** Body 14/20, secondary 13, small labels 12. Panel headers 36 px, controls 24–28 px.
  Developer tools like LeetCode are the reference for how tight a working surface can be.
- Don't make things bigger to fill space. Let the content have the room.

## Surfaces

- **Avoid cards inside cards.** A list on a plain ground uses flat rows split by a 1 px hairline, with a soft
  tint on hover. **A list on a patterned ground uses slim frosted cards** (the community, owner 7 Nov): white
  at about 94%, radius 16, padding about 12 / 14, 12 apart, so the text always sits on a clean surface and the
  pattern shows only between them. Keep the pattern itself faint there (about 5%).
- **Floating chrome.** Headers and switchers float on glass (white at about 74%, blur 14), and content
  passes underneath. It feels more spacious than a solid bar. **A composer at the bottom is the exception:
  a solid dock, edge to edge** (owner, 10 Nov). Floating, it left a gap below it, and the posts passing
  through that gap and around its ends looked messy and confusing. **The strip behind a phone's navigation buttons must match the dock.**
  Chrome on Android paints it in the page's background colour, so a page with a bottom dock sets the
  page's background to the dock's colour while it's open (our `--bg` is a beige that didn't match).
- Radii stay small on working surfaces: panels 8, menus and dialogs 10–12. Pills are for small actions.
- **Never put text straight on a pattern.** A text halo (stacked `text-shadow`s) was tried in the community
  and still read as messy; the owner removed it on 7 Nov in favour of the frosted cards above.
- Give side-by-side areas their own identity: a slightly different ground each and a small badge in the
  header saying what the area is (`CAMPUS`, `ALL CAMPUSES`).
- Keep one left edge for everything in a row.

## Icons over words

- Our students know these icons. Use an icon for an obvious action (react, reply, sort, send), with an
  `aria-label` and a tooltip. Keep words for anything an icon can't say.
- **Emoji are not interface icons;** they look cheap. Use lucide icons, or a drawn SVG for a key moment.
  Emoji are for content: reactions, and flags where we have no other source.

## Using width well

- **An avatar gets a column of its own.** Everything in the row, text, media, actions and nested replies,
  starts at one left edge. We tried a drop cap (text wrapping under the avatar); it saved width but made
  rows hard to scan.
- **Centre an avatar on the middle of the name's lowercase letters,** not on its line box: the eye
  centres on the lowercase letters, which sit about 1 px below a line's middle (owner, 10 Nov). Use the
  font's own measurements, never a pixel nudge, since each screen draws text a little differently: on the
  web, trim the name to `text-box: trim-both ex alphabetic`, pad it back to the line's height
  (`calc((20px - 1ex) / 2)` each side, less a 1 px lift above), and centre the avatar on the line.
  **Every other piece of text on that line gets the same treatment** (the campus, time, a like count), so
  their lowercase middles and baselines line up whatever their size.
- **Thin lines people can point at** get a hit area wider than the line, and respond on hover. Keep it
  to about 3 px either side, and make it follow the line: a curve is an SVG path with a wide transparent
  copy (`pointer-events: stroke`), not a box, so the empty corner inside the curve doesn't react.
- **Scrollbars on a working panel stay see-through until it scrolls,** then fade about a second after the
  last scroll. Keep their room the whole time (`scrollbar-color: transparent`), so nothing shifts.
- **A metadata line never wraps on its own.** Decide what truncates first and what never goes. Drop what the
  context already says, such as a campus name in that campus's own feed. Anything else **truncates with
  `…` rather than disappearing** on a narrow screen (the campus in a world feed was hidden on phones
  until 10 Nov). **Where the secondary part would be mostly `…` on a phone (a reply's campus,
  squeezed by its like), give it a line of its own,** close under the name like Quora's credential line:
  name and actions on the first line, `campus · time` tucked right under it (owner, 10 Nov). **It sits
  plainly nearer the name than the text below sits to it** (the community: about 7 px from the tails of j
  and p to the campus, 11 from the campus to the text), or it reads as part of the text. If the name can
  sit on a highlight pill, check the pill's edge clears that line, and keep the pill centred on the letters
  wherever they move. A wrapping flex row's `gap` opens a row gap too, and a `gap` declared later
  overrides an earlier `row-gap`: check the rule actually applies. Where there's
  room (a post's author line), stay on one line.
- **People are shown by `@username`, never by full name** (owner, 10 Nov). The full name only picks an
  avatar's initials and colour, so the same person looks the same everywhere.
- **Components respond to their container, not the window.** Use `@container` and `cqi`, because a panel
  can be any width. Keep window media queries for page layout.
- Folding text around a float: use `max-height` with `overflow: clip`. `-webkit-line-clamp` and
  `overflow: hidden` both make a new formatting context, so the text stops wrapping.

## Touch

- Thin to look at, 44 px to touch. Add an invisible `::after` hit area under `@media (pointer: coarse)`.
- Anything on hover needs a touch route and a keyboard route. If the hover offers a choice (the React
  button's quick bar), **pressing the button opens the choice, with a click, a tap or Enter alike**; it
  never picks a default for you, and a long-press alone is too hidden (owner, 10 Nov: a press that only
  gave ❤️ hid the other emojis).
- **A popover whose content loads** (a profile card's counts and photos) starts loading when the pointer
  arrives and **opens once it's ready, images decoded, at its final size.** Opening early and growing
  flickers and can make it jump sides. If it must open before then, it picks its side for its full height
  and stays there.
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
- Anything that fades (`opacity`, `filter`, `mask`) cuts the `backdrop-filter` inside it off from what's
  behind, so it blurs nothing and pops in late. Fade the glass's contents and move its parent with `transform`.
- Lines that must join, like a reply thread: use an opaque colour and rows that touch. Alpha shows every
  overlap as a darker patch.
- A bare element selector in a `.module.css` file isn't scoped; it leaks to the whole site. Use a class.
  `footer.module.css` already leaks `a { transition: all }`, `a:hover { color: var(--pink-light) }`, `ul`
  and `li`, so **every link in a new component sets its own `:hover` colour**, or it turns near-white.
- A `position: fixed` element inside a `backdrop-filter` or `@container` parent is trapped by it, so render
  it in a portal.
