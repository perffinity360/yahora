# CLAUDE.md — Yahora Web Frontend

This file is the persistent project brief for the **`frontend/`** package. Claude Code loads it automatically. Keep it accurate; if a convention changes in the code, update it here.

---

## 1. What Yahora is

Yahora is a **student-exclusive, university-verified marketplace** (tagline: *"Because Every Item Has a Memory."*). It is a **multi-tenant** app: every university is an isolated "tenant" identified by `university_id`. A student joins with a verified university email (OTP, one-time per device), and is permanently bound to that campus.

**Core rule of the product:** a user can only **transact** within their own campus, but can **browse** (read-only) listings from other campuses by switching universities on the Marketplace page. Never leak cross-campus data in any way that allows *interaction* (liking, saving, messaging, buying) outside the user's own `university_id`.

This is the **web** app. There is a separate `mobile/` (React Native) app and a shared `backend/` (Express + Supabase). This package is web only.

---

## 2. Golden Rules (read first, every time)

1. **Read the real source before assuming anything.** Before wiring an endpoint, open the matching backend controller in `../backend/src/modules/<module>/`. Before touching data shapes, check `../database/schema.md`. Do not guess column names, response shapes, or field formats. (Example of why: the OTP is **8 digits**, delivered via Supabase — not 6. Assumptions like this have caused bugs.)
2. **Respect campus isolation.** Any request that reads or writes campus-scoped data must carry the correct `university_id`. Interaction endpoints must never operate across campuses.
3. **Match existing patterns.** This codebase has established conventions (raw `fetch`, CSS Modules, `AuthContext`, lucide icons). Follow them — do not introduce axios, styled-components, Redux, TanStack Query, or new state libraries on the web without being asked.
4. **Verification is the user's job.** Do not claim something works in the browser. Commit after each logical unit of work and let Vishwajeet verify in the browser.
5. **Keep it minimal.** Prefer small, surgical diffs over large rewrites. Do not refactor unrelated code.

---

## 3. Commands

Run from the `frontend/` directory:

```bash
npm install       # install dependencies
npm run dev       # start Vite dev server (default: http://localhost:5173)
npm run build     # production build -> dist/
npm run preview   # preview the production build locally
```

There is currently **no test suite and no linter script** configured. Do not invent test commands.

---

## 4. Tech Stack

- **Framework:** React **19** (`react`, `react-dom`)
- **Build tool:** **Vite** (`vite.config.js`)
- **Language:** JavaScript + JSX (`.jsx`). No TypeScript on web.
- **Routing:** `react-router-dom` **v7** (`<BrowserRouter>`, `<Routes>`, `useNavigate`, `useLocation`, `useParams`)
- **Styling:** **CSS Modules** (`*.module.css`) per component + **Bootstrap 5** / **react-bootstrap** (imported globally) + design tokens in `src/styles/global.css`
- **Icons:** `lucide-react`
- **Form controls:** `react-select` (searchable dropdowns, e.g. onboarding course/specialization)
- **Backend client:** `@supabase/supabase-js` (used for Supabase Realtime/Presence and storage); most data goes through the **Express backend via `fetch`**, not direct Supabase queries.

---

## 5. Directory Structure

```
frontend/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx                 # entry: BrowserRouter > AuthProvider > App
    ├── App.jsx                  # route table + global demo banner + Navbar/Footer
    ├── config/
    │   └── supabaseClient.js    # exports `supabase` (VITE_SUPABASE_URL / _ANON_KEY)
    ├── contexts/
    │   └── AuthContext.jsx      # useAuth() -> { isAuthenticated, login, logout, loading }
    ├── styles/
    │   └── global.css           # CSS variable design tokens + resets
    ├── components/
    │   ├── navbar/              # navbar.jsx + navbar.module.css
    │   ├── footer/
    │   ├── modal/               # UniversityModal (list of supported campuses)
    │   └── ProductCard/
    └── pages/
        ├── Home/                # landing page
        ├── auth/                # Auth.jsx — OTP request + verify + demo login
        ├── onboarding/          # profile completion (name, qualification, course, etc.)
        ├── marketplace/         # main feed + filters + campus switcher (largest page)
        ├── product/             # ProductDetail.jsx (PDP) — comments, likes, contact seller
        ├── sell/                # Sell.jsx — create/edit listing (multipart image upload)
        ├── messages/            # Messages.jsx — inbox + realtime chat
        ├── dashboard/           # Dashboard.jsx — user's own listings/purchases/saved
        └── publicProfile/       # PublicProfile.jsx — another user's public profile
```

**Component/page pattern:** each lives in its own folder containing `Name.jsx` + `Name.module.css`. Note the repo currently mixes casing (`Home/Home.jsx` vs `navbar/navbar.jsx`). **For new components, use PascalCase** (`FolderName/FolderName.jsx`), but do not rename existing folders unless asked.

---

## 6. Architecture & Data Flow

**Provider tree** (`main.jsx`): `BrowserRouter` → `AuthProvider` → `App`. Bootstrap CSS and `global.css` are imported here. `AuthProvider` blocks rendering until it has finished reading localStorage (`loading` gate).

**Auth / onboarding flow:**
1. User enters university email → `POST /api/auth/request-otp`. Backend extracts the domain, checks it against the `universities` table, rejects unknown domains, then asks Supabase to send the OTP.
2. User enters the **8-digit** OTP → `POST /api/auth/verify-otp`. Backend verifies with Supabase, creates the base `users` row on first login with `is_profile_complete: false`, and returns `{ session, userAuth, userProfile }`.
3. If `userProfile.is_profile_complete === false` → route to `/onboarding`; else route to `/dashboard` (or home).
4. Onboarding submits via `POST /api/auth/onboarding`.
5. There is also a **demo/guest** path: `POST /api/auth/demo-login` (sets the demo banner; demo users are cleaned up nightly by a backend cron).

**Data fetching:** components call the Express backend with the native **`fetch`** API. The base URL is always:

```js
const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;
// then: fetch(`${API_BASE_URL}/products?university_id=${uni}&user_id=${uid}`)
```

Some pages define `API_BASE_URL` at module top; others inline `import.meta.env.VITE_API_BASE_URL`. Prefer the module-top constant for new code.

**Realtime:** chat presence / live message updates use the Supabase client (`config/supabaseClient.js`) directly (Supabase Realtime + Presence), not the Express backend.

---

## 7. Conventions

- **Data fetching:** raw `fetch` with `async/await` inside `useEffect` / `useCallback`. No axios. Handle `res.ok`, parse JSON, set React state. No global data-cache library on web.
- **State:** local component state with hooks (`useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`, `memo`). Global auth state via `AuthContext` only. Cross-page shared data (like the active `university_id`) is read from **localStorage**, not a global store.
- **Styling:** import `styles from "./Name.module.css"` and use `className={styles.foo}`. Use Bootstrap utility classes for quick layout where the codebase already does. **Always use the CSS variables** from `global.css` for colors (see §9) — never hardcode brand hex values.
- **Icons:** import named icons from `lucide-react` (e.g. `import { Heart, Search } from "lucide-react"`).
- **Skeletons/loading:** pages use `memo`-wrapped `SkeletonCard`-style shimmer components while fetching. Follow that pattern for new loading states.
- **Routing:** navigate with `useNavigate()`; read params with `useParams()`. Route params: product = `/product/:id`, public profile = `/user/:id`.
- **Naming:** components/pages PascalCase; hooks/handlers camelCase (`handleLike`, `fetchProducts`); CSS module classes camelCase.

---

## 8. Auth & Session (localStorage keys)

`AuthContext` API: `const { isAuthenticated, login, logout, loading } = useAuth();`
- `login(token, userId)` — persists session + sets authenticated.
- `logout()` — clears all keys below.

**localStorage keys (use these exact names):**
| Key | Meaning |
|-----|---------|
| `yahora_session` | Supabase session token |
| `yahora_user_id` | current user's UUID (`users.id`) |
| `yahora_university_id` | the user's bound campus (`universities.id`) — send as `university_id` in campus-scoped requests |
| `yahora_demo_user` | `"true"` when in the demo sandbox (drives the global banner) |

When you need the current user or campus in a component, read from these keys (that is the existing pattern).

---

## 9. Design Tokens (`src/styles/global.css`)

Use these CSS variables; never hardcode the hex values:

```
Purple:  --purple #800080 | --purple-dark #4f014f | --purple-light #d700d7
Pink:    --pink #FF78A6 | --pink-dark #EB487F | --pink-light #FFF4F7 | --pink-emphasis #300B15
Blue:    --blue #2BB7FF | --blue-dark #0B93D8 | --blue-light #6FE1FF
Neutral: --black #0B0B0B | --black-soft #1A1A1A | --white #FFFFFF | --bg #F8F9FB
```

Global resets already applied: `box-sizing: border-box` on everything; base font stack `'Segoe UI', Roboto, Helvetica, Arial, sans-serif`; `body` background = `var(--bg)`.

---

## 10. Environment Variables

Defined in `frontend/.env` (Vite requires the `VITE_` prefix). **Never commit real values.**

```
VITE_API_BASE_URL   # Express backend origin, e.g. http://localhost:5000 (NO trailing /api, NO trailing space)
VITE_SUPABASE_URL   # Supabase project URL
VITE_SUPABASE_ANON_KEY
```

⚠️ A **trailing space** in a `.env` URL has bitten this project before — keep values clean.

---

## 11. Backend API Reference

Base = `${VITE_API_BASE_URL}/api`. Confirm the exact request/response shape in the corresponding controller before use.

**Auth** (`auth.controller.js`)
- `POST /auth/request-otp` — body `{ email }`
- `POST /auth/verify-otp` — body `{ email, otp }` → `{ session, userAuth, userProfile }`
- `POST /auth/onboarding` — completes profile
- `POST /auth/demo-login` — guest sandbox

**Academic** (`academic.controller.js`)
- `GET /academic/courses`
- `GET /academic/specializations`

**Universities** (`university.controller.js`)
- `GET /universities` — list of supported campuses

**User** (`user.controller.js`)
- `GET /user/:userId/dashboard`
- `PUT /user/:userId/profile`
- `POST /user/:userId/avatar` — multipart, field `avatar`
- `GET /user/:userId/public`

**Products** (`products.controller.js`)
- `GET /products?university_id=&user_id=` — feed for a campus (read is cross-campus capable; `university_id` **required**)
- `GET /products/:id`
- `POST /products` — multipart, field `images` (max 5)
- `PUT /products/:id`
- `DELETE /products/:id`
- `POST /products/:id/like` — toggle like/wishlist
- `POST /products/:id/save` — toggle save
- `POST /products/:id/comments` — add comment (supports nested via `parent_comment_id`)
- `POST /products/comments/:commentId/vote` — up/down vote (toggle)
- `POST /products/:id/sold` / `POST /products/:id/available`

**Messages** (`messages.controller.js`)
- `GET /messages/inbox/:userId`
- `GET /messages/history` — chat between two users (query params)
- `POST /messages/send`
- `PUT /messages/read` — mark read (drives read ticks)
- `PUT /messages/deliver` — mark delivered (drives delivered ticks)

---

## 12. Campus Isolation Rules (critical)

- Every campus-scoped read/write must carry `university_id` (from `yahora_university_id`).
- **Interaction is same-campus only:** like, save, comment, message, buy must target items/users in the user's own campus. When viewing another campus in read-only browse mode, hide/disable all interaction affordances.
- Never build a UI path that lets a user message or transact with a user from another domain.
- The backend filters by `university_id`; do not rely on the frontend alone for isolation, and do not build endpoints/queries that bypass it.

---

## 13. Known Gotchas

- **OTP is 8 digits** (Supabase-delivered) — size inputs/validation accordingly.
- **`.env` trailing spaces / trailing `/api`** on `VITE_API_BASE_URL` cause broken requests. The code appends `/api` itself.
- **Demo users** get a persistent orange banner (`App.jsx`) and are auto-cleaned nightly by the backend cron — don't treat demo data as real.
- **`/feed` and `/hot` routes are placeholder stubs** (community feed + "Hot at campus" not built yet). The `posts` table exists in the DB but there is no backend `posts` module yet — flag before building against it.
- **Realtime chat** relies on the Supabase client, not the Express backend — keep both in sync when touching messaging.

---

## 14. What NOT to do

- Do not add axios, Redux, Zustand, TanStack Query, styled-components/Tailwind, or TypeScript to the web app unasked.
- Do not hardcode brand colors — use the CSS variables.
- Do not bypass `university_id` scoping or enable cross-campus interaction.
- Do not rename existing folders/files or do broad refactors unless explicitly requested.
- Do not claim browser behavior is verified — commit and hand off to Vishwajeet for verification.
- Do not edit `mobile/` or `backend/` from a frontend task unless explicitly asked (this brief covers `frontend/` only).

---

## 15. Design principles (read before ANY UI work)
Aesthetic direction for this project: editorial student marketplace with sentimental
warmth — clean magazine-grade layout, one bold accent against soft neutrals, every
listing framed like a keepsake ("Because Every Item Has a Memory.").

- Typography: pair one characterful display font with a clean body font.
  Never Inter, Roboto, Arial, Space Grotesk, or system-ui.
- Color: one dominant tone + one sharp accent, defined as CSS variables /
  theme tokens. No purple-gradient-on-white, no timid evenly-spread palettes.
- Motion: every screen gets entrance choreography (staggered reveals);
  every interactive element gets hover/press feedback. 150–400ms,
  custom easing curves, never linear.
- Backgrounds: atmospheric (subtle gradients, grain, glow, geometry) —
  never flat default white/gray.
- Before coding a screen, state your aesthetic direction in one sentence,
  then make every choice serve it.

---

## 16. UI stack & animation rules
Before ANY UI work, read DESIGN.md fully. Its tokens are canonical — never hardcode colors, radii, or durations.

- Styling: CSS Modules + tokens from src/styles/tokens.css via var(--…). Do NOT introduce Tailwind.
- Micro-interactions & entrances: `motion` (Framer Motion) — hover lifts, press scale 0.98,
  staggered whileInView reveals (once). Don't hand-roll keyframes for things Motion does declaratively.
- Pre-built showpieces: ReactBits, plain-CSS variants only — restyle to our tokens/fonts before shipping.
- shadcn/ui, Aceternity UI, Magic UI are Tailwind-based: never install here. If a component from them
  is wanted, re-implement its behavior in CSS Modules with our tokens.
- GSAP + ScrollTrigger + Lenis: public landing/marketing pages ONLY. App surfaces use native scroll.
- Every interactive element: hover + press + focus-visible. Every async surface: skeleton, empty, error, success.
- Animate transform/opacity only. Respect prefers-reduced-motion.
- After building a screen: screenshot via Playwright MCP at 1440px and 390px, self-critique, fix, re-verify.
