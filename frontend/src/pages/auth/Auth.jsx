import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Rocket,
  MonitorPlay,
  X,
  Eye,
  EyeOff,
  GraduationCap,
} from "lucide-react";
import UniversityModal from "../../components/modal/UniversityModal";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Auth.module.css";
import { Turnstile } from "@marsidev/react-turnstile";
import { API_BASE_URL, getTurnstileSiteKey } from '../../config/urls';
import { getDeviceId } from '../../config/deviceId';

// Persisted across in-tab reloads so that opening the mail app on mobile to
// fetch the OTP — which can drop the page from memory and reload it on return —
// doesn't reset the user back to the email screen mid-verification. sessionStorage
// is intentional: it survives reload/app-switch but clears when the tab is closed.
const AUTH_STEP_KEY = "yahora_auth_step";
const AUTH_EMAIL_KEY = "yahora_auth_email";

// Which login method the student used last. localStorage, not sessionStorage:
// the point is that a returning student lands on their method next visit, not
// just after a reload.
const AUTH_TAB_KEY = "yahora_auth_tab";
const TAB_OTP = "otp";
const TAB_PASSWORD = "password";

// The typed identifier survives a reload, the same way the OTP email does.
// sessionStorage, so it dies with the tab.
//
// ⚠ There is deliberately NO key for the password. It lives in component state
// and nowhere else — not localStorage, not sessionStorage, not a log line.
const AUTH_IDENTIFIER_KEY = "yahora_auth_identifier";

// ⚠ THE ONLY error string the password form can ever show for a failed login.
//
// The API returns 400 INVALID_CREDENTIALS for all four of: wrong password,
// unknown username, unknown email, and an account that has no password. They
// are byte-identical on purpose. If the UI said "no such account" for one and
// "wrong password" for another, anyone could test identifiers and learn which
// are real — user enumeration — and on a campus app that also means checking
// whether a specific classmate is on Yahora, which is a harassment precursor.
//
// There is nothing to branch on here, and that is the design. Do not add a
// second string, and do not try to be more helpful. New-user guidance is
// permanent helper text under the form, shown BEFORE an attempt is wasted.
const INVALID_CREDENTIALS_MESSAGE =
  "Incorrect username or password. Please try again.";

/** mm:ss for the lockout countdown. */
const formatWait = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

/**
 * A wait a student can actually read: "23h 41m", "9m 05s", "0:44".
 *
 * The daily cap is a rolling 24 hours, so `formatWait` alone would render it
 * as "1440:00" — a number nobody can parse into "come back tomorrow". A flat
 * "try again later" was the other extreme: honest, but it leaves them with no
 * idea whether to wait a minute or a day, and no reason to believe the account
 * still exists.
 */
const formatCountdown = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Seconds are dropped above an hour on purpose: a digit flickering once a
  // second next to "23h" reads as broken, not as precise.
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
};

// This browser's record of the codes it has sent, keyed BY EMAIL:
//   { "[email protected]": { sends: [epochMs, ...], until: epochMs } }
//
// ⚠ Keyed by email because every server limit it mirrors is per email. A single
// global deadline meant sending a code to one address disabled the button for a
// different one, which the server would happily have allowed.
//
// ⚠ TIMESTAMPS, never "seconds remaining". If we stored "47 seconds left" and
// the student came back three minutes later we would restore 47 and make them
// wait all over again. A fixed point in time comes out right whenever they
// return, including after a reload.
//
// localStorage, not sessionStorage: the server counts across tabs and across a
// closed tab too, so the button has to agree with it there as well.
const OTP_SENDS_KEY = "yahora_otp_sends";

// ⚠ THESE THREE MIRROR THE SERVER — backend/src/modules/auth/auth.controller.js
// (OTP_EMAIL_FREE_REQUESTS, OTP_EMAIL_COOLDOWN_SECONDS, OTP_WINDOW_SECONDS).
// They exist so the button can be right BEFORE a request is spent instead of
// after a 429. If they drift, the button promises something the server refuses
// — or, as happened here, refuses something the server would have allowed.
const OTP_FREE_REQUESTS = 3;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_WINDOW_SECONDS = 24 * 60 * 60;

// Above this the countdown moves to the message line, where there is room to
// spell out hours and minutes. Below it, the disabled button carries the
// mm:ss on its own and needs no second line saying the same thing.
const OTP_TIMER_MAX_SECONDS = 10 * 60;

// Resolved ONCE, at module scope, and never inside render.
//
// getTurnstileSiteKey() throws when VITE_TURNSTILE_SITE_KEY is missing — see
// config/urls.js for why it refuses to fall back to a hardcoded default.
// Catching it here turns "somebody forgot a line in .env" into one explained
// message on one form, instead of an exception thrown on every render of the
// login page. The key is public by design; the SECRET half lives in Supabase
// and must never appear in this package.
let TURNSTILE_SITE_KEY = "";
try {
  TURNSTILE_SITE_KEY = getTurnstileSiteKey();
} catch (err) {
  console.error(err);
}

const normaliseEmail = (email) => (email || "").trim().toLowerCase();

/** The whole ledger. A corrupt value must never take the login page down. */
const readLedger = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(OTP_SENDS_KEY));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

/** One email's entry, with sends that have aged out of the window dropped. */
const readEntry = (ledger, key) => {
  const entry = ledger[key] || {};
  const cutoff = Date.now() - OTP_WINDOW_SECONDS * 1000;
  return {
    sends: (Array.isArray(entry.sends) ? entry.sends : []).filter(
      (t) => t > cutoff,
    ),
    until: Number(entry.until) || 0,
  };
};

/** Save, dropping every address there is nothing left to remember about. */
const writeLedger = (ledger) => {
  const now = Date.now();
  const cutoff = now - OTP_WINDOW_SECONDS * 1000;
  const pruned = {};

  for (const [key, entry] of Object.entries(ledger)) {
    const sends = (Array.isArray(entry.sends) ? entry.sends : []).filter(
      (t) => t > cutoff,
    );
    const until = Number(entry.until) || 0;
    // Without this the ledger grows forever on a shared campus laptop.
    if (sends.length || until > now) pruned[key] = { sends, until };
  }

  try {
    localStorage.setItem(OTP_SENDS_KEY, JSON.stringify(pruned));
  } catch {
    // Private mode, or quota. The server is the real limiter; losing the
    // mirror costs a nicer button, not correctness.
  }
};

/**
 * Seconds the Send button must stay disabled for `email`; 0 when it is free.
 *
 * Two sources, whichever runs later:
 *  - our mirror of the server's own rule, below;
 *  - a deadline the server handed us in a 429, which is authoritative. It is
 *    the only one that knows about sends this browser never saw (another
 *    device, cleared storage) and about the 24-hour daily cap.
 */
const readOtpCooldown = (email) => {
  const key = normaliseEmail(email);
  if (!key) return 0;

  const { sends, until } = readEntry(readLedger(), key);

  // THE FIRST THREE ARE FREE — the first code plus two retries for a slow mail
  // server — and only from the fourth is there a minute between them. Starting
  // the countdown on send #1 made the button stricter than the server and ate
  // both of those retries: the student came back from "wrong email?" to a
  // button already counting down for no reason.
  const localUntil =
    sends.length >= OTP_FREE_REQUESTS
      ? Math.max(...sends) + OTP_RESEND_COOLDOWN_SECONDS * 1000
      : 0;

  const deadline = Math.max(localUntil, until);
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
};

/** Note a code that was ACTUALLY sent, so the free-request count is right. */
const recordOtpSend = (email) => {
  const key = normaliseEmail(email);
  if (!key) return;
  const ledger = readLedger();
  const entry = readEntry(ledger, key);
  ledger[key] = { ...entry, sends: [...entry.sends, Date.now()] };
  writeLedger(ledger);
};

/** Store a deadline the SERVER gave us, which outranks anything we counted. */
const recordServerCooldown = (email, seconds) => {
  const key = normaliseEmail(email);
  if (!key) return;
  const wait = Math.max(0, Math.ceil(Number(seconds) || 0));
  const ledger = readLedger();
  const entry = readEntry(ledger, key);
  ledger[key] = { ...entry, until: Date.now() + wait * 1000 };
  writeLedger(ledger);
};

const Auth = () => {
  const navigate = useNavigate();
  const { login, setProfileComplete } = useAuth();
  const [email, setEmail] = useState(
    () => sessionStorage.getItem(AUTH_EMAIL_KEY) || "",
  );
  // Only restore the OTP step if we also have the email it was sent to,
  // otherwise the "code sent to <email>" screen would render blank.
  const [step, setStep] = useState(() =>
    sessionStorage.getItem(AUTH_STEP_KEY) === "2" &&
    sessionStorage.getItem(AUTH_EMAIL_KEY)
      ? 2
      : 1,
  ); // 1: Email, 2: OTP
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Default is College Email & OTP. It is the only path that works for a
  // brand-new student, and a first-time visitor has no stored preference.
  const [tab, setTab] = useState(() =>
    localStorage.getItem(AUTH_TAB_KEY) === TAB_PASSWORD ? TAB_PASSWORD : TAB_OTP,
  );

  const [identifier, setIdentifier] = useState(
    () => sessionStorage.getItem(AUTH_IDENTIFIER_KEY) || "",
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  // Lazy initialiser, so a reload mid-countdown resumes on the right number
  // instead of showing a clickable button the server would still refuse.
  const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(() =>
    readOtpCooldown(email),
  );
  // The Turnstile token for the NEXT request-otp. request-otp is minted on
  // Supabase's ANON client (backend/src/config/supabase.js), because GoTrue
  // exempts service-role callers from captcha entirely — so a tokenless
  // request is refused outright with 400 CAPTCHA_FAILED.
  const [captchaToken, setCaptchaToken] = useState("");
  // Only for the explanatory line below the widget. The button is gated on the
  // TOKEN, never on this — an error means there is no token, which is already
  // the thing that disables it.
  const [captchaError, setCaptchaError] = useState(!TURNSTILE_SITE_KEY);
  const turnstileRef = useRef(null);
  const videoRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDemoOptions, setShowDemoOptions] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.65;
    }
  }, []);

  // TOO_MANY_ATTEMPTS lockout, ticking down so the student can see it moving
  // rather than reading a static number and guessing whether it is stale.
  //
  // The OTP cooldown rides the SAME tick. Two timers doing one job in one file
  // is how a small bug quietly becomes two. The only difference is that the
  // cooldown re-reads its stored deadline each second rather than subtracting
  // one: a backgrounded tab has its timers throttled, and re-reading means it
  // comes back showing the truth instead of however far it drifted.
  useEffect(() => {
    if (lockoutSeconds <= 0 && otpCooldownSeconds <= 0) return undefined;
    const timer = setTimeout(() => {
      setLockoutSeconds((s) => (s > 0 ? s - 1 : 0));
      setOtpCooldownSeconds((s) => (s > 0 ? readOtpCooldown(email) : 0));
    }, 1000);
    return () => clearTimeout(timer);
  }, [lockoutSeconds, otpCooldownSeconds, email]);

  // The cooldown belongs to an ADDRESS, not to the page, so editing the field
  // has to re-answer the question. Without this, typing a second address left
  // the first one's countdown on screen — the button refusing a send the
  // server would have accepted.
  useEffect(() => {
    setOtpCooldownSeconds(readOtpCooldown(email));
  }, [email]);

  // Every place the ledger changes goes through here, so the stored deadline
  // and the number on screen can never disagree.
  const syncOtpCooldown = () => setOtpCooldownSeconds(readOtpCooldown(email));

  const switchTab = (next) => {
    setTab(next);
    localStorage.setItem(AUTH_TAB_KEY, next);
    // Don't carry a message from one method across to the other — an OTP error
    // sitting above the password form reads as a password error.
    setMessage("");
    setPasswordMessage("");
  };

  // The single post-authentication path, shared by verify-otp and
  // login-password. Both endpoints return the SAME shape
  // ({ message, session, userAuth, userProfile }), so there is exactly one
  // place that stores a session and decides where the student lands. A second
  // copy is how the two methods drift into storing subtly different things.
  const completeSignIn = (data) => {
    // Verified — clear the persisted OTP step so a later visit to /auth
    // (e.g. after logout) starts fresh on the email screen.
    sessionStorage.removeItem(AUTH_STEP_KEY);
    sessionStorage.removeItem(AUTH_EMAIL_KEY);
    sessionStorage.removeItem(AUTH_IDENTIFIER_KEY);
    localStorage.removeItem("yahora_demo_user");

    if (data.userProfile?.university_id) {
      localStorage.setItem(
        "yahora_university_id",
        data.userProfile.university_id,
      );
    }

    const userId = data.userProfile?.id || data.userAuth?.id || data.user?.id;

    // MUST come before login(). login() flips `isAuthenticated` with an urgent
    // update while navigate() below commits inside a transition, so <GuestOnly>
    // gets a render where the student is authenticated but the location is
    // still /auth. It decides where to send them from this flag; if the flag is
    // not already correct it redirects to the wrong page and wins the race
    // against the navigate() below. See App.jsx.
    setProfileComplete(Boolean(data.userProfile?.is_profile_complete));

    if (userId) {
      // The refresh token is what lets AuthContext re-authenticate the
      // Supabase client on a later visit, when this handler never runs.
      login(data.session.access_token, userId, data.session.refresh_token);
    }

    // `replace` drops /auth out of the history stack entirely, so pressing
    // back from here returns to whatever came before the login form instead
    // of re-entering it (where GuestOnly would just bounce you forward
    // again, making the back button look frozen).
    if (data.userProfile && data.userProfile.is_profile_complete) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/onboarding", { replace: true });
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    // The button is disabled while counting; this is the belt to that braces
    // (a submit can still arrive from Enter in the email field).
    if (otpCooldownSeconds > 0) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/request-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Opts this browser into its own per-device quota. Omitting it is
            // never an error server-side, but then a shared campus laptop has
            // no quota of its own to spend. See config/deviceId.js.
            "X-Device-Id": getDeviceId(),
          },
          // Forwarded verbatim to Supabase, which is the only party that can
          // judge it. Empty is not an error on our backend — it passes
          // `undefined` on — but GoTrue rejects it whenever captcha
          // protection is on for the project, which is why the widget
          // gates the submit button below.
          body: JSON.stringify({ email, captchaToken }),
        },
      );
      const data = await response.json();

      // Turnstile tokens are strictly single-use, and this one is now spent
      // whatever the server said. Clearing it before any branch below means
      // no path can ever re-send it — a replayed token fails as surely as a
      // missing one, and it would fail on the RESEND, making the widget look
      // like the thing that was broken.
      setCaptchaToken("");
      turnstileRef.current?.reset();

      if (response.ok) {
        // Record the send and let readOtpCooldown decide. It mirrors the
        // server: sends 1-3 leave the button live, and only the fourth starts
        // a gap. Unconditionally starting one here is what put a 60-second
        // countdown on the very first code.
        recordOtpSend(email);
        syncOtpCooldown();
        sessionStorage.setItem(AUTH_STEP_KEY, "2");
        sessionStorage.setItem(AUTH_EMAIL_KEY, email);
        setStep(2);
        setMessage(`Code sent to ${email}`);
      } else if (data.error === "RATE_LIMITED") {
        // One code covers all of the server's OTP limits — the per-email
        // cooldown, the daily email cap, the daily device cap and Supabase's
        // own gap. Deliberately so: the student gets one countdown and never
        // has to care which fired. The disabled button carries the whole
        // message, so no error line as well.
        recordServerCooldown(
          email,
          Number(data.retry_after_seconds) || OTP_RESEND_COOLDOWN_SECONDS,
        );
        syncOtpCooldown();
        setMessage("");
      } else if (data.error === "CAPTCHA_FAILED") {
        // Retryable AT ONCE — no cooldown. The widget above has already been
        // reset, so by the time they read this a fresh token is usually
        // waiting and the button is live again.
        setMessage(
          "We could not verify that you are a real visitor. Please try again.",
        );
      } else if (data.error === "SERVICE_BUSY") {
        // The platform-wide circuit breaker. Not this student's doing and not
        // something they can wait out on a timer we could name, so no
        // countdown and nothing that reads as their fault.
        setMessage(
          "We're having trouble sending codes right now. Please try again in a few minutes.",
        );
      } else {
        setMessage(data.error || data.message || "Something went wrong");
      }
    } catch (error) {
      setMessage("Failed to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp }),
        },
      );
      const data = await response.json();

      if (response.ok) {
        completeSignIn(data);
      } else {
        setMessage(data.message || "Invalid verification code.");
      }
    } catch (error) {
      setMessage("Failed to verify code.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWithPassword = async (e) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/login-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        },
      );
      const data = await response.json();

      if (response.ok) {
        // Identical response shape to verify-otp, so identical handling.
        completeSignIn(data);
        return;
      }

      if (data.error === "TOO_MANY_ATTEMPTS") {
        setLockoutSeconds(Number(data.retry_after_seconds) || 0);
        setPasswordMessage("");
        return;
      }

      // Everything else is INVALID_CREDENTIALS, and it is the same string
      // whichever of the four causes it was. See the constant's comment.
      setPasswordMessage(INVALID_CREDENTIALS_MESSAGE);
    } catch (error) {
      // A transport failure is not a credential failure, and saying
      // "incorrect password" when the server is unreachable sends the student
      // off resetting a password that was never wrong.
      setPasswordMessage("Failed to connect to server.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/demo-login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("yahora_demo_user", "true");
        if (data.userProfile?.university_id) {
          localStorage.setItem(
            "yahora_university_id",
            data.userProfile.university_id,
          );
        }

        const userId = data.userProfile?.id || data.userAuth?.id;

        // demo-login always creates the profile with is_profile_complete false
        // so the sandbox user still sees onboarding. Set it from the response
        // anyway rather than hardcoding false — if that ever changes server
        // side this keeps agreeing with it. Before login(), same reason as in
        // completeSignIn above.
        setProfileComplete(Boolean(data.userProfile?.is_profile_complete));

        if (userId)
          login(data.session.access_token, userId, data.session.refresh_token);

        // Same as the OTP path: leave no /auth entry behind to go back to.
        navigate("/onboarding", { replace: true });
      } else {
        setMessage(data.error || "Failed to launch demo environment.");
      }
    } catch (error) {
      setMessage("Failed to connect to server.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <>
      <div className={styles.authContainer}>
        {/* ── Left Side: Form ── */}
        <div className={styles.authLeft}>
          <div className="glow-orb purple-orb"></div>
          <div className="glow-orb pink-orb"></div>

          <div className={styles.authFormWrapper}>
            {/* Marketing copy is for the OTP (signup) tab only. The
                Username & Password tab is a returning-user surface, so it
                shows the card alone and authLeft's align-items:center
                recenters it. */}
            {tab === TAB_OTP && (
              <>
                <div className={styles.marketingBadge}>
                  <span className={styles.dot}></span>
                  Keep the Story Going...
                </div>

                <h1 className={styles.gradientHeading}>
                  Buy &amp; Sell on Your Campus.
                </h1>
              </>
            )}

            {/* Glass Form Card */}
            <div className={styles.formCard}>
              <div className={styles.floatingIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  width="28"
                  height="28"
                >
                  <path d="M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L21 10.09V17H23V9L12 3ZM18.82 9L12 12.72L5.18 9L12 5.28L18.82 9ZM17 15.99L12 18.72L7 15.99V12.27L12 15L17 12.27V15.99Z" />
                </svg>
              </div>

              <h2>Join Yahora</h2>

              {/* Segmented control. Labels are fixed copy from runbook §0.6 —
                  "College Email & OTP", not just "Email": students think of it
                  as their college ID. Both labels are nowrap and the control
                  is sized to hold them side by side at 375px. */}
              <div className={styles.tabSwitcher} role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === TAB_OTP}
                  className={`${styles.tabBtn} ${
                    tab === TAB_OTP ? styles.tabBtnActive : ""
                  }`}
                  onClick={() => switchTab(TAB_OTP)}
                >
                  College Email &amp; OTP
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === TAB_PASSWORD}
                  className={`${styles.tabBtn} ${
                    tab === TAB_PASSWORD ? styles.tabBtnActive : ""
                  }`}
                  onClick={() => switchTab(TAB_PASSWORD)}
                >
                  Username &amp; Password
                </button>
              </div>

              {tab === TAB_PASSWORD ? (
                <>
                  {/* No onPaste handler on either field: blocking paste breaks
                      password managers. */}
                  <form onSubmit={handleLoginWithPassword}>
                    <p className={styles.subtitle}>
                      Enter the username and password you chose at signup
                    </p>

                    <label className={styles.inputLabel} htmlFor="identifier">
                      USERNAME OR EMAIL
                    </label>
                    <div className={styles.pillField}>
                      <input
                        id="identifier"
                        type="text"
                        name="identifier"
                        placeholder="rahul.sharma"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value);
                          sessionStorage.setItem(
                            AUTH_IDENTIFIER_KEY,
                            e.target.value,
                          );
                        }}
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        required
                      />
                    </div>

                    <label className={styles.inputLabel} htmlFor="password">
                      PASSWORD
                    </label>
                    <div className={styles.pillField}>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Your password"
                        value={password}
                        // State only. Never written to storage, never logged.
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        className={styles.eyeBtn}
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    <div className={styles.forgotRow}>
                      <button
                        type="button"
                        className={styles.inlineLink}
                        onClick={() => switchTab(TAB_OTP)}
                      >
                        Forgot your password? Sign in with email OTP instead.
                      </button>
                    </div>

                    {/* The lockout takes priority: while it is running, the
                        credential message is irrelevant — no attempt is being
                        accepted either way. */}
                    {lockoutSeconds > 0 ? (
                      <p className={`${styles.formMessage} ${styles.error}`}>
                        Too many attempts. Try again in{" "}
                        {formatWait(lockoutSeconds)}.
                      </p>
                    ) : (
                      passwordMessage && (
                        <p className={`${styles.formMessage} ${styles.error}`}>
                          {passwordMessage}
                        </p>
                      )
                    )}

                    <button
                      type="submit"
                      className={`${styles.signInBtn} ${styles.brandGradient}`}
                      disabled={passwordLoading || lockoutSeconds > 0}
                    >
                      {passwordLoading ? "Signing in…" : "Sign in"}
                    </button>
                  </form>

                  {/* Permanent, not an error state. A new student sees how to
                      sign up BEFORE wasting a login attempt — which is also the
                      only place this guidance can live, since the failure
                      message is deliberately identical for every cause. */}
                  <div className={styles.newUserNote}>
                    <button
                      type="button"
                      className={`${styles.inlineLink} ${styles.newUserLink}`}
                      onClick={() => switchTab(TAB_OTP)}
                    >
                      <GraduationCap size={18} className={styles.newUserIcon} />
                      <span>
                        New to Yahora? Create your account with your college
                        email and OTP →
                      </span>
                    </button>
                  </div>
                </>
              ) : step === 1 ? (
                <form onSubmit={handleRequestOtp}>
                  <p className={styles.subtitle}>
                    Enter your university email to get started
                  </p>

                  <label className={styles.inputLabel}>UNIVERSITY EMAIL ADDRESS</label>
                  <div className={styles.modernInputGroup}>
                    <input
                      type="email"
                      placeholder="yourUniID@university.domain"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    {/* No token, no send. request-otp is minted on Supabase's
                        anon client, so GoTrue polices the captcha and a
                        tokenless request is refused outright — letting the
                        click through would spend an attempt to earn a
                        guaranteed 400. This also closes the race where a fast
                        student submits before the widget has finished.
                        Runbook N-Block C, C4.3. */}
                    <button
                      type="submit"
                      className={`${styles.insideBtn} ${styles.brandGradient}`}
                      disabled={
                        loading || otpCooldownSeconds > 0 || !captchaToken
                      }
                    >
                      {loading
                        ? "Sending…"
                        : otpCooldownSeconds > OTP_TIMER_MAX_SECONDS
                        ? // A disabled button still reading "Send Code" looks
                          // like the page is broken. The message below carries
                          // the detail; this just has to stop being a lie.
                          "Locked"
                        : otpCooldownSeconds > 0
                        ? `Send in ${formatWait(otpCooldownSeconds)}`
                        : "Send Code"}
                    </button>
                  </div>

                  {/* OTP FORM ONLY — deliberately not on the Username &
                      Password tab above. The attack this stops is fake account
                      creation, which can only happen through OTP; on the
                      password form it would be friction for every returning
                      student and defend nothing. Runbook N-Block C, C4.4.

                      In Managed mode this usually draws NOTHING. It sits inside
                      step 1 on purpose: coming back from step 2 remounts it,
                      which is exactly the fresh token a second send needs. */}
                  {TURNSTILE_SITE_KEY && (
                    <div className={styles.turnstile}>
                      <Turnstile
                        ref={turnstileRef}
                        siteKey={TURNSTILE_SITE_KEY}
                        onSuccess={(token) => {
                          setCaptchaToken(token);
                          setCaptchaError(false);
                        }}
                        // ~5-minute lifetime. A student who opened the page,
                        // went to find their student email and came back would
                        // otherwise submit a dead token and be told the captcha
                        // failed, with nothing on screen to explain it.
                        onExpire={() => setCaptchaToken("")}
                        onError={() => {
                          setCaptchaToken("");
                          setCaptchaError(true);
                        }}
                        options={{
                          theme: "light",
                          action: "request-otp",
                          // Draws only when Cloudflare actually wants an
                          // interaction, which is what keeps the form from
                          // carrying a permanent empty box.
                          appearance: "interaction-only",
                        }}
                      />
                    </div>
                  )}

                  {captchaError && (
                    <p className={`${styles.formMessage} ${styles.hint}`}>
                      Something went wrong. Please reload or try again after
                      some time. If you use an ad blocker or VPN, allow
                      challenges.cloudflare.com.
                    </p>
                  )}

                  {/* Long waits get the countdown here rather than on the
                      button, which has no room for hours. The daily cap is a
                      rolling 24 hours, so this is the difference between "come
                      back tomorrow morning" and a dead end that reads like the
                      account is gone. Under ten minutes the disabled button is
                      already counting and explains itself, so nothing extra is
                      said. */}
                  {otpCooldownSeconds > OTP_TIMER_MAX_SECONDS ? (
                    <p className={`${styles.formMessage} ${styles.error}`}>
                      Too many codes requested for this email. You can try
                      again in{" "}
                      <strong className={styles.countdown}>
                        {formatCountdown(otpCooldownSeconds)}
                      </strong>{"."}
                    </p>
                  ) : (
                    message && (
                      <p className={`${styles.formMessage} ${styles.error}`}>{message}</p>
                    )
                  )}

                  <div
                    className={`${styles.textCenter} ${styles.mt2}`}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      alignItems: "center",
                    }}
                  >
                    <div className={styles.uniDemo}>
                      <button
                        type="button"
                        className={styles.cuteBtn}
                        onClick={() => setIsModalOpen(true)}
                      >
                        See Supported Universities
                      </button>

                      <button
                        type="button"
                        className={styles.textBtn}
                        onClick={() => setShowDemoOptions(true)}
                      >
                        <Sparkles size={16} /> Explore Live Demo
                      </button>
                    </div>
                  </div>
                  <UniversityModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                  />
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp}>
                  <p className={styles.subtitle}>
                    Enter the 8-digit code sent to{" "}
                    <strong style={{ color: "var(--purple-dark)" }}>
                      {email}
                    </strong>
                  </p>

                  <label className={styles.inputLabel}>8-DIGIT VERIFICATION CODE</label>
                  <div className={styles.modernInputGroup}>
                    <input
                      type="text"
                      placeholder="• • • • • • • •"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      maxLength={8}
                      className={styles.otpInput}
                    />
                    <button
                      type="submit"
                      className={`${styles.insideBtn} ${styles.brandGradient}`}
                      disabled={loading}
                    >
                      {loading ? "Verifying…" : "Verify"}
                    </button>
                  </div>

                  {message && (
                    <p
                      className={`${styles.formMessage} ${
                        message.includes("sent") ? styles.success : styles.error
                      }`}
                    >
                      {message}
                    </p>
                  )}

                  <button
                    type="button"
                    className={`${styles.textBtn} ${styles.mt2}`}
                    onClick={() => {
                      sessionStorage.removeItem(AUTH_STEP_KEY);
                      sessionStorage.removeItem(AUTH_EMAIL_KEY);
                      setStep(1);
                    }}
                  >
                    ← Wrong email? Go back
                  </button>
                </form>
              )}
            </div>

            {/* App Download Buttons */}
            <div className={styles.appDownloads}>
              <button className={`${styles.appBtn} ${styles.androidBtn}`}>
                <img src="/playstore.svg" alt="playstore" />
                Android App
                <span className={styles.comingSoon}>Soon</span>
              </button>
              <button className={`${styles.appBtn} ${styles.iosBtn}`}>
                <img src="/apple.svg" alt="apple" />
                iOS App
                <span className={styles.comingSoon}>Soon</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Right Side: Video ── */}
        <div className={styles.authRight}>
          <div className={styles.videoContainer}>
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              className={styles.featureVideo}
              src="https://iwhtzhejyhaqctoqsolz.supabase.co/storage/v1/object/public/yahora%20videos/yahora_login_page_girl.mp4"
            >
              Your browser does not support the video tag.
            </video>
            <div className={styles.videoOverlay}>
              <h3>Keep the Story Going</h3>
              <p>Because Every Item Has a Memory.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Demo Options Modal ── */}
      {showDemoOptions && (
        <div 
          className={styles.modalOverlay} 
          onClick={() => setShowDemoOptions(false)}
        >
          <div 
            className={styles.modalContent} 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className={styles.closeModalBtn} 
              onClick={() => setShowDemoOptions(false)}
            >
              <X size={20} />
            </button>
            
            <h3 className={styles.modalTitle}>Choose Demo Experience</h3>
            
            <button
              type="button"
              className={styles.demoPopupBtn}
              onClick={handleDemoLogin}
              disabled={demoLoading}
            >
              <div className={styles.popupBtnTitle}>
                <Rocket size={18} /> 
                {demoLoading ? "Creating Sandbox..." : "Sandbox Preview"}
              </div>
              <span className={styles.popupBtnSubtext}>
                Limited Access • Live Environment
              </span>
            </button>
            
            <a
              href="https://www.youtube.com/watch?v=YOUR_YOUTUBE_LINK"
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.demoPopupBtn} ${styles.videoBtn}`}
            >
              <div className={styles.popupBtnTitle}>
                <MonitorPlay size={18} /> Recorded Demo
              </div>
              <span className={styles.popupBtnSubtext}>
                Full Walkthrough • Actual Recording
              </span>
            </a>
          </div>
        </div>
      )}
    </>
  );
};

export default Auth;