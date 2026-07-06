# Yahora Design System — Web (DESIGN.md)

> **How this file is used:** This is the canonical design source for the Yahora web repo.
> Add this line to CLAUDE.md: `Before ANY UI work, read DESIGN.md fully and follow it. Its tokens are canonical.`
> If existing code conflicts with these tokens, flag the conflict in your response — never silently invent a third value.
> Hex values below are the proposed v1 identity; Vishwajeet/Neeraj may tune them. Once tuned, this file wins over everything.

---

## 1. What Yahora is (design context)

A **verified, student-only campus marketplace with a social feed**, launching for Indian universities (IIITDM Kurnool, NIET Greater Noida first). Users are 17–24, mobile-heavy, price-sensitive, and allergic to anything that feels corporate. Trust ("everyone here is a verified student from my campus") is the core promise; energy is the personality.

**Design direction (the thesis):**
> *"The hostel notice board, rebuilt for 2026."* Clean photo-first surfaces, confident ink typography with Indian type heritage, and one highlighter-yellow accent used like a real highlighter — to mark what matters. Friendly, fast, a little playful. Never corporate SaaS, never a gray clone of OLX.

**Explicitly avoid the three AI-default looks.** AI-generated design currently clusters into: (1) warm-cream background + high-contrast serif + terracotta accent, (2) near-black background + single acid-green accent, (3) broadsheet/newspaper layout with hairline rules and zero radius. Yahora is none of these. Our light theme is a near-white *photo* surface (not cream), our display face is a condensed Indian grotesque (not a serif), and our accent is highlighter yellow (not terracotta, not acid green). If a design starts drifting toward any of those three looks, stop and correct it.

---

## 2. Design tokens (CSS custom properties — canonical)

Define once in `src/styles/tokens.css`, import globally. **Never hardcode a color, radius, shadow, or duration in a CSS Module — always `var(--…)`.**

```css
:root {
  /* Surfaces & ink (light — default) */
  --y-paper:    #FCFBF7;  /* app background — near-white, photo-friendly */
  --y-surface:  #FFFFFF;  /* cards, sheets, inputs */
  --y-surface2: #F4F1E8;  /* subtle fills, chips, table stripes */
  --y-ink:      #1C1A15;  /* primary text */
  --y-ink2:     #6F6A5D;  /* secondary text, placeholders */
  --y-line:     #E7E3D7;  /* borders, dividers (1px) */

  /* Brand accent — "the highlighter" */
  --y-mark:     #FFD43B;  /* primary accent: CTAs, selection, highlights */
  --y-mark-soft:#FFF3C4;  /* highlight washes, hover fills */

  /* Semantic (semantics ONLY — never decorative) */
  --y-verified: #0E7C55;  /* verified badge, success */
  --y-danger:   #D6453D;  /* destructive, errors */
  --y-warn:     #DB8B00;  /* warnings */

  /* Shape */
  --r-1: 6px;  --r-2: 10px;  --r-3: 14px;  --r-pill: 999px;

  /* Space (8px grid; 4px only for icon-to-label gaps) */
  --s-1: 4px; --s-2: 8px; --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;

  /* Elevation (two soft layers — never one harsh drop shadow) */
  --shadow-card:  0 1px 2px rgba(28,26,21,.06), 0 8px 24px rgba(28,26,21,.08);
  --shadow-hover: 0 2px 4px rgba(28,26,21,.08), 0 16px 32px rgba(28,26,21,.12);

  /* Motion */
  --dur-1: 140ms;  /* hovers, presses, toggles */
  --dur-2: 240ms;  /* entrances, reveals, sheets */
  --dur-3: 420ms;  /* page-level or hero moments only */
  --ease-out:   cubic-bezier(.16, 1, .3, 1);   /* entrances */
  --ease-inout: cubic-bezier(.65, 0, .35, 1);  /* moves, layout shifts */
}

[data-theme="dark"] {
  --y-paper:    #141310;
  --y-surface:  #1D1B16;
  --y-surface2: #26231B;
  --y-ink:      #F1EEE5;
  --y-ink2:     #A9A392;
  --y-line:     #343023;
  --y-mark:     #FFD84D;
  --y-mark-soft:#3A3316;
  --y-verified: #35B980;
  --y-danger:   #EF6B5E;
  --y-warn:     #F0A62E;
  /* Dark elevation = borders, not shadows */
  --shadow-card:  0 0 0 1px var(--y-line);
  --shadow-hover: 0 0 0 1px var(--y-line), 0 12px 28px rgba(0,0,0,.4);
}
```

---

## 3. Typography

| Role | Face | Weights | Notes |
|---|---|---|---|
| Display | **Khand** (Indian Type Foundry, via Google Fonts) | 500 / 600 / 700 | Headings, prices, section labels, big numbers. Condensed poster energy; also covers Devanagari for future Hindi UI. |
| Body / UI | **Instrument Sans** (Google Fonts) | 400 / 500 / 600 | Everything else. Legible workhorse. |

Rules:
- Load both from Google Fonts with `display=swap`. Exactly two families — never a third.
- **Banned as the face of the design:** Inter, Roboto, Arial, Helvetica, system-ui, Space Grotesk.
- Scale (px): display 56 · h1 40 · h2 32 · h3 24 · h4 20 · body-lg 18 · body 16 · small 14 · caption 12. Line-height 1.1 for display/h1, 1.25 for h2–h4, 1.5 for body.
- Khand at ≥32px gets `letter-spacing: -0.01em`. ALL-CAPS labels (eyebrows, chips) use Instrument Sans 600, 12–13px, `letter-spacing: 0.06em`.
- **Prices are a typographic feature:** always Khand 600, `₹` included, formatted with `Intl.NumberFormat('en-IN')` (e.g., ₹1,250 · ₹1,20,000).

---

## 4. Color rules

- Light theme is default (product photos need clean neutral surfaces). Dark mode is fully supported via `[data-theme="dark"]`.
- `--y-mark` is a **highlighter, not paint**: primary CTA, active tab/filter, selection states, the price tag, one hero moment. It should cover **≤10% of any screen**. Never large background washes, never body text color.
- Text on `--y-mark` is always `--y-ink` (both themes).
- `--y-verified` appears **only** on verification/success. It is the trust color — diluting it as decoration destroys its meaning.
- Photos do the talking: no colored overlays or gradient tints on listing images. UI around images stays quiet.
- Links inside prose: `--y-ink` + underline. Interactive emphasis comes from weight and `--y-mark`, not blue.

---

## 5. Layout & space

- 8px grid. Content max-width 1200px; the feed/marketplace grid may bleed wider. Page gutters: `--s-5` desktop, `--s-4` mobile.
- Generous whitespace is the default; density is a choice made only for data-heavy surfaces (dashboard tables).
- Cards: `--r-3` radius, `--shadow-card`, 1px `--y-line` border in dark mode.
- Listing images: fixed `aspect-ratio: 4 / 5`, `object-fit: cover`, radius `--r-2`, lazy-loaded. Never let images resize the layout (no CLS).
- One deliberate asymmetric/grid-breaking moment per marketing page is encouraged; app screens stay orderly.

---

## 6. Motion

Library: **`motion`** (Framer Motion) for all React micro-interactions and entrances. Hand-rolled keyframes only for tiny one-off CSS effects (e.g., skeleton shimmer).

- **Entrances:** screens and card grids animate in once — fade + 8–12px rise, `--dur-2` `--ease-out`, stagger 50ms, **max 6 choreographed items** (the rest appear instantly). Use `whileInView` with `once: true` for below-the-fold reveals.
- **Hover (cards, listings):** `translateY(-2px)` + `--shadow-hover`, `--dur-1`. **Press:** scale 0.98.
- Every interactive element has visible hover, press, and `:focus-visible` states (2px `--y-ink` outline, 2px offset). No exceptions.
- The signature "highlight sweep": selected filters/tabs get a `--y-mark` background that animates in from the left (`scaleX`, transform-origin left, `--dur-1`). This is Yahora's motion identity — reuse it for selection everywhere.
- **Animate only `transform` and `opacity`.** Never width/height/top/left.
- **Scroll effects (GSAP + ScrollTrigger, Lenis) are allowed ONLY on public marketing/landing pages.** Never inside the app (marketplace, feed, messages, dashboard) — utility surfaces use native scroll and must feel instant.
- Wrap all non-essential motion in `@media (prefers-reduced-motion: no-preference)` or Motion's reduced-motion support.

---

## 7. Signature elements & component recipes

**The price tag (signature #1).** Prices on listing cards sit in a tag-shaped chip: `--y-mark` background, `--y-ink` Khand 600 text, radius `--r-2`, with a small punched "tag hole" (a 5px `--y-paper` circle via `::before`, left side). Instantly recognizable, reused everywhere a price appears.

**The verified stamp (signature #2).** A compact stamp-style badge: 1.5px `--y-verified` border, `--y-verified` check + "Verified" in caps (11px, +0.06em), transparent fill. Appears on profiles and listing cards. Never restyled per-screen.

**Listing card:** image (4:5) → title (body 500, 2-line clamp) → price tag → seller row (avatar 20px, name, verified stamp) → campus chip. Hover lift per §6. Loading state: shimmer skeleton in the exact same layout.

**Feed post:** avatar + name + verified + time (caption, `--y-ink2`) → text → optional media → action row (icon buttons, 44px hit area). Reactions use `--y-mark-soft` fill when active.

**Buttons:** Primary = `--y-mark` bg / `--y-ink` text / `--r-2` / Instrument Sans 600. Secondary = transparent, 1px `--y-line`, `--y-ink` text. Destructive = `--y-danger`. Text buttons underline on hover. Heights: 44px default, 36px compact.

**Skeletons, not spinners,** for any content area (cards, feed, profile). Spinners only for button-level actions. Shimmer: `--y-surface2` base with a moving highlight.

**Empty states are invitations:** small illustration or icon, one plain line, one action. Voice: campus-casual, specific, no corporate filler, sentence case, active verbs, and **never lorem ipsum — write real copy**. Examples:
- Empty marketplace: "Nothing on the board yet. List something from your room — it takes a minute." → [List an item]
- Empty chat: "No messages yet. Found something you like? Say hi to the seller."
- Error: "Couldn't load listings. Check your connection and try again." → [Retry]

---

## 8. Stack rules (this repo)

- React 19 + Vite + **CSS Modules**. **Do not introduce Tailwind** into this repo.
- Tokens live in `tokens.css`; CSS Modules consume them via `var(--…)` only.
- Micro-interactions/entrances: `motion`. Scroll storytelling: GSAP + ScrollTrigger + Lenis, landing pages only (§6).
- Pre-built animated components: **ReactBits — use its plain CSS/JS variants** (not the Tailwind ones), then restyle to our tokens and fonts before shipping. Never paste a component with its default styling.
- shadcn/ui, Aceternity UI, and Magic UI are Tailwind-based: **do not install them here.** If one of their components is wanted, re-implement the behavior in CSS Modules with our tokens.
- Watch CSS specificity: keep selectors flat (single class), avoid type selectors fighting module classes, and manage section spacing in one place (parent gap, not competing margins).

---

## 9. Quality floor (non-negotiable)

- Contrast: ≥4.5:1 body text, ≥3:1 large text/UI. `--y-ink2` on `--y-paper` passes; verify anything new.
- Hit areas ≥44×44px. Full keyboard navigation with visible `:focus-visible`.
- Responsive to 360px. Test 390px and 1440px minimum.
- Every async surface ships all four states: loading (skeleton), empty, error, success.
- `prefers-reduced-motion` respected. Images lazy + `aspect-ratio` reserved (no CLS). Keep the marketplace feeling instant.

## 10. Anti-patterns (never)

Purple-gradient-on-white · Inter/Roboto/system-ui as the design face · cream+serif+terracotta or black+acid-green default looks (§1) · more than one accent moment competing per viewport · linear easing · animating everything at once · spinner-only loading · single harsh drop shadows · emoji as icons · blue default links · lorem ipsum · gray timid palettes · centered-hero-with-one-button as a reflex.

## 11. Pre-flight ritual (every UI task)

1. State the direction in one sentence before coding ("Building X; notice-board energy via …").
2. Build with tokens only; write real copy.
3. Self-review against: hierarchy clear? exactly one `--y-mark` moment? motion choreographed and ≤6 items? all four async states present? 390px checked? focus rings visible? reduced motion respected? none of the three AI-default looks?
4. If Playwright MCP is available: open the page, screenshot at 1440px and 390px, critique like an Awwwards judge (typography, hierarchy, spacing, color, motion — score /10), implement the top fixes, re-screenshot to confirm.
