# Yahora Design System — Mobile App (DESIGN.md)

Generic decisions to reuse on new screens. Screen-level detail lives in that screen's spec under
`docs/design/`. The website's twin of this file is `frontend/DESIGN.md`. If a decision applies to both,
change both.

**Brand:** Inter for text. Bree Serif, regular 400 only, for headings and prices. Colours come from
`src/theme`.

## The standard: Mobile app UI/UX excellence, design first, always (owner, 12 Nov)

Written by the owner for everyone who works on Yahora. Every section below this one serves it; when a
narrower rule in this file stands in the way of a better result, see "How we work" just after it.

Build exceptionally beautiful, modern, intuitive, fluid, and production-quality mobile applications. Think
like a world-class Mobile Product Designer, UX Researcher, Interaction Designer, and Senior Mobile Engineer.

The goal is to create applications that feel natural, responsive, delightful, and effortless to use. Every
interaction should feel intentionally designed for mobile.

### 1. Mobile-First Design Excellence
- Create premium, distinctive, visually cohesive interfaces.
- Prioritize typography, spacing, visual hierarchy, color, contrast, and balanced layouts.
- Design specifically for mobile screens rather than shrinking web interfaces.
- Maintain consistency across screens, navigation, components, and design tokens.
- Avoid generic templates, clutter, and unnecessary visual decoration.

### 2. Research & Platform Conventions
- Study exceptional mobile applications and established interaction patterns before designing.
- Draw inspiration from Apple, Airbnb, Instagram, Linear, Notion, and other relevant products.
- Follow Apple Human Interface Guidelines and Android Material Design 3 principles where applicable.
- Respect platform-specific navigation, gestures, dialogs, permissions, controls, and user expectations.
- Use established patterns for familiarity while introducing thoughtful product-specific innovations.

### 3. Exceptional Mobile UX
- Make every important action easy to discover and execute.
- Minimize taps, unnecessary navigation, cognitive load, and repetitive input.
- Design intuitive onboarding, authentication, search, discovery, forms, and core user journeys.
- Use progressive disclosure to prevent overwhelming users.
- Provide immediate and understandable feedback.
- Prioritize one-handed usability and comfortable interaction.
- Handle interruptions, offline conditions, and session restoration gracefully.

### 4. Native-Feeling Interactions & Animations
- Implement fluid navigation, gestures, transitions, micro-interactions, and natural motion.
- Use appropriate physics, subtle haptics, animated state changes, and gesture feedback.
- Make bottom sheets, modals, tab navigation, drawers, lists, and cards feel polished.
- Use native capabilities and platform conventions where appropriate.
- Respect reduced-motion settings.
- Never introduce distracting animations or unnecessary interaction complexity.

### 5. Mobile-Specific Design Considerations
- Account for safe areas, notches, dynamic islands, status bars, and system navigation.
- Support different screen sizes, densities, orientations, and device capabilities.
- Use appropriately sized touch targets and comfortable spacing.
- Consider keyboards, focus behavior, scrolling, and input ergonomics.
- Design adaptive layouts for small phones, large phones, and tablets.
- Ensure dialogs, sheets, and navigation behave naturally on each platform.

### 6. Complete UI States
Design every relevant state:
- Loading, skeleton, and progress indicators.
- Empty states and first-time experiences.
- Errors, validation, and recovery.
- Success feedback and notifications.
- Focused, pressed, selected, disabled, and active states.
- Offline, slow network, and interrupted operations.
- Permission denied, unavailable device features, and expired sessions.

### 7. Performance, Accessibility & Reliability
- Maintain smooth scrolling, responsive gestures, and fluid animations.
- Optimize rendering, image loading, memory usage, and network requests.
- Avoid unnecessary re-renders, dropped frames, and excessive resource consumption.
- Support screen readers, dynamic text sizing, sufficient contrast, and accessible controls.
- Respect system preferences, including dark mode and reduced motion.
- Handle app lifecycle events, backgrounding, reconnection, and state restoration.
- Ensure reliable behavior across supported devices and OS versions.

### 8. Proactive Product Thinking
- Study the existing application, architecture, navigation, and user journeys before making changes.
- Identify missing features, usability problems, friction points, and opportunities independently.
- Suggest better workflows, interactions, and product improvements.
- Explore creative solutions instead of blindly following existing implementation patterns.
- Preserve existing functionality and business logic.
- Take initiative on small, reversible design decisions.
- Consult me before major decisions involving product direction, branding, navigation architecture, core user journeys, or significant feature changes.

### 9. Quality Assurance
Before completing any feature, test the actual application:
- Different device sizes and screen densities.
- Navigation, gestures, touch targets, and keyboard behavior.
- Animation smoothness and scrolling performance.
- Safe areas and system UI integration.
- Loading, empty, error, offline, and success states.
- Accessibility and screen-reader behavior.
- Real-world user journeys and lifecycle interruptions.
- Platform-specific behavior on supported iOS and Android versions.

Never settle for an interface that merely works. Refine the details until the application feels polished,
natural, and production-ready.

**Core principle: Build mobile experiences that feel native, look exceptional, respond instantly, and make
every interaction a pleasure.**

## How we work (owner, 12 Nov)

The full text is in the root `CLAUDE.md`, "How we work", and applies to everyone on Yahora. In short:

- **Decide and do the small things yourself.** Execution and small, reversible design decisions don't need
  the owner. Decisions that could fundamentally or drastically change the product experience do: product
  direction, branding, navigation architecture, core user journeys, significant feature changes.
- **This file is guidance, not a cage.** Use every skill, tool and method that builds the thing better. When
  that means going beyond or against a rule here, say so once, before doing it. If the result is better,
  update the rule.

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
- **What a row opens lives once per screen, not once per row.** Menus, sheets and pickers that a list item
  opens (the community's ⋯ menu, report form, emoji picker, breakdown) sit in one provider around the
  screen (`PostActionsProvider`), which the rows reach through context. One per row meant dozens of hidden
  Modals. Only one overlay is open at a time: each opens after the one before has closed.

## Motion

- Reanimated on the UI thread.
- **Nothing that opens bounces** (owner, 12 Nov). Menus, popovers, the quick bar, dialogs and sheets settle
  without overshoot. The springy `ZoomIn` on the community's quick bar, ⋯ menu, country dropdown and report
  form wobbled and read as bouncing. Use `src/lib/motion.ts`: `POPOVER_ENTER` (fade + scale 0.94 → 1,
  180 ms, grown from the button through `transformOrigin`) for what hangs off a button, `DIALOG_ENTER`
  (220 ms) for a centred card. Sheets slide up 280 ms, ease-out cubic (`SHEET_RISE`), on their own clock with
  the scrim fading in on the same one, and never change height while rising. Never grow from scale 0.
- **Physics is welcome where it doesn't wobble** (the standard's §4, "appropriate physics": springs, momentum,
  friction, decay). Use it where a finger drives the motion (a swipe, a drag, a fling, a pager settling, a
  thumb released) and for state changes, with damping high enough, or `overshootClamping`, that nothing
  visibly overshoots. An over-bouncy spring (Reanimated's `springify()` defaults, `damping` under about 15)
  is the thing to avoid.
- Press: scale with a light haptic (`PressableScale`). Small reveals: 180–280 ms. Entrances: up to 320 ms, moving
  4–8 pt, fading as they move.
- Stagger short lists by 18–28 ms, and stop after about six items.
- Respect `ReducedMotionConfig`.

## Quality floor

- Text contrast at least 4.5:1 (3:1 for large text and icons). `mutedText` is 4.44:1 on `chatCanvas`, so use
  `communityMuted` there.
- New colours become theme tokens, never hardcoded values, and each one is listed with its web variable name.
