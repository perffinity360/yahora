import React, { useLayoutEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/navbar/navbar';
import Footer from './components/footer/footer';
import Auth from './pages/auth/Auth';
import Home from './pages/Home/Home';
import Onboarding from './pages/onboarding/onboarding'; 
import Dashboard from './pages/dashboard/Dashboard';
import Sell from './pages/sell/Sell';
import Marketplace from './pages/marketplace/Marketplace';
import ProductDetail from "./pages/product/ProductDetail";
import PublicProfile from "./pages/publicProfile/PublicProfile";
import Messages from "./pages/messages/Messages";
import OnboardingRequired from "./components/OnboardingRequired/OnboardingRequired";

// Keep logged-in users off the auth page: reaching /auth (via the back button,
// a stale link, or a typed URL) sends them on instead of showing the login
// form again. `replace` overwrites the /auth history entry rather than stacking
// on top of it, so the next back press doesn't land straight back here.
// AuthProvider gates rendering on its loading flag, so isAuthenticated is already
// resolved here — no flash of the auth form before redirecting.
//
// Anything that signs a user out must go through AuthContext's logout() (which
// flips isAuthenticated) rather than clearing localStorage by hand — otherwise
// this guard still reads "logged in" and locks them out of the login form.
//
// 🐛 WHY THIS SENDS THEM TO /onboarding OR /dashboard AND NEVER TO "/".
//
// This guard used to redirect to "/", and that is what broke first-time
// signup: a student who verified their OTP landed on the home page instead of
// the onboarding form.
//
// The reason is a render-ordering race, not a logic error in Auth.jsx.
// `login()` flips `isAuthenticated` with an urgent update, while react-router
// commits `navigate("/onboarding")` inside `React.startTransition`
// (<BrowserRouter> in react-router 7.13.1). React runs the urgent update
// first, so there is one real render where the app is authenticated but the
// location is STILL /auth. This component runs in that render, returned
// <Navigate to="/" replace />, and that redirect beat the pending transition.
// The student never saw /onboarding at all.
//
// Reordering the calls in Auth.jsx does not help — the urgent update wins
// either way. So the guard is made to agree with the login handler instead:
// both now resolve to the same destination from the same `profileComplete`
// flag, which Auth.jsx writes BEFORE calling login(). Whichever render lands
// first, the student ends up in the same place.
//
// This also fixes a second, quieter bug: a logged-in student with an
// unfinished profile who typed /auth used to be dropped on the home page with
// no route back into onboarding.
function GuestOnly({ children }) {
  const { isAuthenticated, profileComplete } = useAuth();

  if (!isAuthenticated) return children;

  return <Navigate to={profileComplete ? "/dashboard" : "/onboarding"} replace />;
}

// A demo/sandbox account is deliberately created with is_profile_complete =
// false and is offered a "Skip for now" button out of the onboarding form
// (onboarding.jsx), so the gate below must not apply to it. Read at render time
// rather than hoisted to a module constant: the flag is written during
// demo-login, after this module has already been evaluated.
const isDemoSandbox = () => localStorage.getItem("yahora_demo_user") === "true";

// 🔒 THE ONBOARDING GATE.
//
// Verifying an OTP already creates a real `users` row — with
// is_profile_complete = false and no name, username, course or password on it.
// From that moment `isAuthenticated` is true and the navbar renders its
// signed-in state, but every app route below used to be mounted bare. So a
// student who reached /onboarding and pressed Back was a logged-in user with a
// blank account, free to walk into /dashboard, /marketplace, /messages and
// /sell.
//
// Being authenticated is therefore no longer enough to see the app. Two gates:
//
//   <RequireAuth>       a session exists. Used for /onboarding itself, which is
//                       the one place a half-registered student belongs.
//   <RequireOnboarded>  a session AND a finished profile — everything else.
//                       Pass `allowGuest` on routes that stay readable while
//                       logged out (product pages, public profiles) so this
//                       only adds the profile requirement and doesn't newly
//                       lock guests out.
//
// "/" is deliberately NOT gated. A half-registered student can still browse the
// landing page and keep the full navbar; the gate only stands in front of the
// pages that need an account behind them.
//
// An unfinished profile renders <OnboardingRequired /> rather than redirecting.
// A silent bounce to /onboarding reads as a broken link — the student clicks
// Marketplace, the URL flicks back to the form they just left, and nothing ever
// says why. The screen names the page they wanted, says what is still missing,
// and gives them one button to it. Redirecting to /auth would be worse still:
// they ARE logged in, and a login form they have already passed is a dead end.
//
// ⚠️ This is enforcement of the *flow*, not authorisation. `profileComplete`
// mirrors a localStorage string a student can edit in devtools, and the guards
// here only decide which component renders — they cannot stop a hand-written
// request. The endpoints still have to reject half-registered accounts
// server-side; today `backend/src/middleware/` has requireAuth but no
// equivalent onboarding check.
function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  return children;
}

function RequireOnboarded({ children, allowGuest = false }) {
  const { isAuthenticated, profileComplete } = useAuth();

  if (!isAuthenticated) {
    return allowGuest ? children : <Navigate to="/auth" replace />;
  }

  if (!profileComplete && !isDemoSandbox()) {
    return <OnboardingRequired />;
  }

  return children;
}

function App() {
  const location = useLocation(); // Get current route
  const navigationType = useNavigationType();
  const isDemoUser = localStorage.getItem("yahora_demo_user") === "true";
  const chromeRef = useRef(null);

  // Publish the real height of the fixed app chrome (demo banner + navbar) as
  // --app-chrome so full-height pages can size themselves with
  // calc(100dvh - var(--app-chrome)) instead of guessing a number. The demo
  // banner is conditional, so a hardcoded offset overflows the viewport the
  // moment it appears and pushes the bottom of the page off-screen.
  useLayoutEffect(() => {
    const el = chromeRef.current;
    if (!el) return;

    const publish = () =>
      document.documentElement.style.setProperty(
        "--app-chrome",
        `${el.getBoundingClientRect().height}px`
      );

    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isDemoUser]);

  // Start each forward navigation at the top of the page. Skipping POP (browser
  // back/forward) leaves the restored scroll position intact, so returning to a
  // feed keeps your place. Runs before paint to avoid a scroll-position flash.
  useLayoutEffect(() => {
    if (navigationType !== "POP") window.scrollTo(0, 0);
  }, [location.pathname, navigationType]);

  return (

    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      
      {/* Demo banner + navbar are measured together as the app chrome */}
      <div ref={chromeRef}>

      {/* 🚧 GLOBAL DEMO BANNER 🚧 */}
      {isDemoUser && (
        <div style={{
          background: 'linear-gradient(90deg, #FFB347, #FF7B00)',
          color: 'white',
          textAlign: 'center',
          padding: '6px 12px',
          fontWeight: '600',
          // Shrinks on phones so the banner stays ~1-2 lines instead of eating
          // three lines of an already short mobile viewport.
          fontSize: 'clamp(0.72rem, 3vw, 0.85rem)',
          lineHeight: 1.35,
          letterSpacing: '0.02em',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ flexShrink: 0 }}>🚧</span>
          You are viewing the Yahora Interactive Demo Sandbox. This is not real student data.
        </div>
      )}
      
      <Navbar />

      </div>

      <main style={{ flex: 1, minHeight: 0 }}>
        <Routes>
          {/* Fully public. A student who has not finished onboarding is still
              welcome here — the gate starts at the pages below. */}
          <Route path= "/" element={<Home/>} />
          <Route path="/auth" element={<GuestOnly><Auth /></GuestOnly>} />

          {/* The only route a half-registered student is allowed to reach.
              Completed students may come back here to edit their profile —
              Dashboard links to it — so this checks the session only. */}
          <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

          {/* App surfaces: session + finished profile required. */}
          <Route path="/feed" element={<RequireOnboarded><div className="container mt-4"><h3>Community Feed</h3></div></RequireOnboarded>} />
          <Route path="/hot" element={<RequireOnboarded><div className="container mt-4"><h3>Hot Items on Campus</h3></div></RequireOnboarded>} />
          <Route path="/dashboard" element={<RequireOnboarded><Dashboard /></RequireOnboarded>} />
          <Route path="/sell" element={<RequireOnboarded><Sell /></RequireOnboarded>} />
          <Route path="/marketplace" element={<RequireOnboarded><Marketplace /></RequireOnboarded>} />
          <Route path="/messages" element={<RequireOnboarded><Messages /></RequireOnboarded>} />

          {/* Shareable links — these already render for logged-out visitors and
              keep doing so; only the unfinished-profile case is new. */}
          <Route path="/product/:id" element={<RequireOnboarded allowGuest><ProductDetail /></RequireOnboarded>} />
          <Route path="/user/:id" element={<RequireOnboarded allowGuest><PublicProfile /></RequireOnboarded>} />
        </Routes>
      </main>

      {/* Conditionally hide the footer ONLY on the dashboard */}
      {location.pathname !== '/dashboard' && <Footer />}
    </div>
  );
}

export default App;