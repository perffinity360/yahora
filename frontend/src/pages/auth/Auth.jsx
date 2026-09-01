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
import { API_BASE_URL } from '../../config/urls';

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
  useEffect(() => {
    if (lockoutSeconds <= 0) return undefined;
    const timer = setTimeout(() => setLockoutSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [lockoutSeconds]);

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
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/request-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
      );
      const data = await response.json();
      if (response.ok) {
        sessionStorage.setItem(AUTH_STEP_KEY, "2");
        sessionStorage.setItem(AUTH_EMAIL_KEY, email);
        setStep(2);
        setMessage(`Code sent to ${email}`);
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
                    <button
                      type="submit"
                      className={`${styles.insideBtn} ${styles.brandGradient}`}
                      disabled={loading}
                    >
                      {loading ? "Sending…" : "Send Code"}
                    </button>
                  </div>

                  {message && (
                    <p className={`${styles.formMessage} ${styles.error}`}>{message}</p>
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