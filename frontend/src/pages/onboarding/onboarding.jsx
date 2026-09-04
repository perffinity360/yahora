// frontend/src/pages/onboarding/Onboarding.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Select from "react-select";
import {
 User,
 BookOpen,
 Calendar,
 ImagePlus,
 Sparkles,
 GraduationCap,
 Award,
 AtSign,
 Lock,
 Eye,
 EyeOff,
 Check,
 X,
 Loader2, // Imported the loading spinner icon
} from "lucide-react";
import styles from "./onboarding.module.css";
// IMPORT YOUR FRONTEND SUPABASE CLIENT
import { supabase } from "../../config/supabaseClient.js";
import SmartImage from "../../components/SmartImage/SmartImage.jsx";
import { PROFILE_UPDATED_EVENT } from "../../components/navbar/navbar.jsx";
import { useAuth } from "../../contexts/AuthContext";
import { API_BASE_URL } from '../../config/urls';


// AuthContext owns this key; it holds the ACCESS token, which is exactly what
// the Bearer header needs. Read directly rather than through the context so the
// pre-render redirect below can run before any request is built.
const SESSION_KEY = "yahora_session";

const MIN_PASSWORD_LENGTH = 8;

// `is_username_available()` reports one of four reasons, and each is kept as a
// distinct status so the UI can behave differently even where it now READS the
// same — see USERNAME_STATUS_COPY, where "taken" and "reserved" deliberately
// share one sentence. Keep the statuses separate here regardless: collapsing
// them at this layer would throw away the reason before anything can use it.
const REASON_TO_STATUS = {
  TAKEN: "taken",
  RESERVED: "reserved",
  INVALID_FORMAT: "invalid",
  RECENTLY_RELEASED: "recently_released",
};

// The same three codes come back from POST /api/auth/onboarding when the handle
// was taken between the availability check and submit.
const SUBMIT_ERROR_TO_STATUS = {
  USERNAME_TAKEN: "taken",
  USERNAME_RESERVED: "reserved",
  INVALID_FORMAT: "invalid",
};

const USERNAME_STATUS_COPY = {
  checking: "Checking availability…",
  available: "Available",
  taken: "That handle is already taken. Please choose another.",
  // Deliberately WORD-FOR-WORD identical to `taken`.
  //
  // A reserved handle is one on the `reserved_usernames` list — "admin",
  // "support", "root". Telling a student it is "reserved" does two unhelpful
  // things: it reads as a system error they might retry, and, said across
  // enough guesses, it maps out the reserved list for anyone who cares to
  // probe. "Already taken" is true from where the student is standing — the
  // handle is not available and never will be — and it points them at the
  // suggestions instead of at the rule.
  //
  // The API still reports the real reason (`reason: "RESERVED"`); this is the
  // human copy only.
  reserved: "That handle is already taken. Please choose another.",
  // Mirrors `users_username_valid` in migration 005 (^[a-z][a-z0-9._-]*$,
  // length 3–25) — the database is the only place the rule is enforced, and
  // this is the only place it is spelled out for a student. If the constraint
  // ever changes, this sentence changes with it.
  //
  // Leads with "start with a letter" because that is the rule INVALID_FORMAT
  // most often means: the other ways in (too short, too long, a stray space or
  // @) are self-evident from the field, a leading digit is not.
  //
  // Case is deliberately absent. Uppercase is folded as they type, so it never
  // reaches this status — naming it here would describe an error they cannot
  // hit. Trailing and doubled separators (rahul_, rahul..sharma) are ALLOWED by
  // the constraint, so they are not named either.
  invalid:
    "Start with a letter — the rest can be letters, numbers, dots, underscores or hyphens, 3–25 characters in total.",
  recently_released:
    "That handle was given up recently and is on a 30-day hold.",
  unknown: "Couldn't check that right now — we'll confirm when you continue.",
};

const BAD_USERNAME_STATUSES = new Set([
  "taken",
  "reserved",
  "invalid",
  "recently_released",
]);

const PASSWORD_ERROR_FALLBACK = {
  WEAK_PASSWORD: "That password is too weak. Please choose a stronger one.",
  COMMON_PASSWORD: "That password is too common. Please choose another.",
};

// API.md still has the suggestion payload marked TODO — it may ship as a bare
// array, `{ suggestions: [] }` or the `items` envelope. Accept all three rather
// than render nothing the day the contract is settled the other way.
const normalizeSuggestions = (payload) => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.suggestions)
      ? payload.suggestions
      : Array.isArray(payload?.items)
        ? payload.items
        : [];
  return list.filter((item) => typeof item === "string" && item).slice(0, 3);
};

// A searchable react-select wrapper with two behaviours the plain <Select>
// lacks on this page:
//   1. Editable selection — once a value is chosen, focusing the field drops
//      its label into the search box (cursor at the end) so the user can
//      backspace through it one character at a time, with the list re-filtering
//      after every delete (instead of react-select wiping the whole selection
//      on a single Backspace). Pre-filling the box is what makes this work on
//      mobile too: deleting from a filled box is ordinary text editing, whereas
//      catching the Backspace *key* on an empty box is unreliable on Android.
//   2. Portaled menu — the dropdown renders into <body> with a high z-index so
//      it always floats above the fields below it (the year field used to paint
//      on top of the open course list).
// Make search forgiving of punctuation and spacing: strip everything except
// letters/digits from both the option label and the query before matching, so
// "Btech", "B tech" and "B-tech" all find "B. Tech" (and vice-versa). Matching
// against the (empty) query "" is always true, so an empty box shows every
// option.
const normalizeForSearch = (str) => (str ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const fuzzyFilterOption = (option, rawInput) =>
  normalizeForSearch(option.label).includes(normalizeForSearch(rawInput));

const SearchableSelect = ({ value, onChange, ...props }) => {
  const [inputValue, setInputValue] = useState("");
  const clearedAtRef = useRef(0);

  return (
    <Select
      {...props}
      value={value}
      filterOption={fuzzyFilterOption}
      inputValue={inputValue}
      onFocus={(e) => {
        if (!value) return;
        // Tapping the ✕ focuses the field on mobile, which would otherwise
        // re-seed the label right after it was cleared — making the removed
        // value reappear as text. Skip the seed for a beat after a clear.
        if (Date.now() - clearedAtRef.current < 400) return;
        const label = value.label ?? "";
        setInputValue(label);
        // A programmatically-set input value leaves the caret at position 0,
        // where Backspace has nothing to delete. Push it to the end so the
        // first Backspace removes the last character.
        const input = e.target;
        requestAnimationFrame(() => {
          const end = input.value.length;
          input.setSelectionRange(end, end);
        });
      }}
      onInputChange={(next, meta) => {
        if (meta.action !== "input-change") {
          // blur / select / menu-close: drop the search text so the chosen
          // value shows as a chip again instead of leftover text.
          setInputValue("");
          return;
        }
        setInputValue(next);
        // Emptying the box (Cut, or clearing it out) also drops the current
        // selection, so the field ends up truly empty and ready for a fresh
        // pick instead of the old value snapping back as a chip.
        if (next === "" && value) onChange(null, { action: "clear", name: props.name });
      }}
      onBlur={() => setInputValue("")}
      onChange={(option, meta) => {
        setInputValue("");
        // Record clears (✕ or programmatic) so onFocus won't re-seed the label
        // straight after; a real pick resets it so editing works normally.
        clearedAtRef.current = option ? 0 : Date.now();
        onChange(option, meta);
      }}
      menuPortalTarget={document.body}
    />
  );
};

const Onboarding = () => {
 const navigate = useNavigate();
 const location = useLocation();

 // Safely grab the passed profile, or default to an empty object if it's a new user
 const existingProfile = location.state?.profile || {};

 const { login, setProfileComplete } = useAuth();

 // 1. Form State (Pre-filled with existing data if available)
 const [formData, setFormData] = useState({
   fullName: existingProfile.full_name || "",
   username: existingProfile.username || "",
   qualification: existingProfile.qualification || "",
   courseId: existingProfile.course_id || "",
   yearOfStudy: existingProfile.year_of_study || "",
   specializationId: existingProfile.specialization_id || "",
   bio: existingProfile.bio || "",
   avatarUrl: existingProfile.avatar_url || "",
 });

 // 2. State for Backend Lists
 const [courses, setCourses] = useState([]);
 const [specializations, setSpecializations] = useState([]);
 const [fetchingLists, setFetchingLists] = useState(true);

 const [loading, setLoading] = useState(false);
 const [error, setError] = useState("");

 // Username availability. `status` drives both the message and the submit gate:
 //   idle | checking | available | taken | reserved | invalid |
 //   recently_released | unknown
 // "unknown" means the check itself failed (endpoint down, network) — see the
 // gating note further down for why that is not treated as a rejection.
 const [usernameStatus, setUsernameStatus] = useState("idle");
 const [usernameServerError, setUsernameServerError] = useState("");
 const [usernameSuggestions, setUsernameSuggestions] = useState([]);
 const [nameSuggestions, setNameSuggestions] = useState([]);

 // Monotonic request ids. The 400ms debounce collapses a burst of keystrokes,
 // but it does not order the responses that do go out — these do.
 const usernameRequestIdRef = useRef(0);
 const suggestionRequestIdRef = useRef(0);

 // Passwords live in component state only. They are never written to
 // localStorage/sessionStorage and never logged.
 const [password, setPassword] = useState("");
 const [confirmPassword, setConfirmPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [showConfirmPassword, setShowConfirmPassword] = useState(false);
 const [passwordError, setPasswordError] = useState("");

 // NEW: State and Ref for Image Upload
 const [uploadingImage, setUploadingImage] = useState(false);
 const fileInputRef = useRef(null);

 // Check if they are a demo user
 const isDemoUser = localStorage.getItem("yahora_demo_user") === "true";

 // Short, fixed lists — still rendered via the searchable react-select so
 // every academic field (qualification, course, year, specialization) has
 // the same "type to jump to it" behavior when editing an existing profile.
 const QUALIFICATION_OPTIONS = [
   { value: "PhD", label: "PhD" },
   { value: "Post Graduation", label: "Post Graduation" },
   { value: "Graduation", label: "Graduation" },
   { value: "Intermediate (12th)", label: "Intermediate (12th)" },
   { value: "High School (10th)", label: "High School (10th)" },
 ];
 const YEAR_OPTIONS = [
   { value: "1st year", label: "1st year" },
   { value: "2nd year", label: "2nd year" },
   { value: "3rd year", label: "3rd year" },
   { value: "4th year", label: "4th year" },
   { value: "5th year", label: "5th year" },
 ];

 // 3. Fetch Courses and Specializations on Mount
 useEffect(() => {
   const fetchAcademicData = async () => {
     try {
       const [coursesRes, specsRes] = await Promise.all([
         fetch(`${API_BASE_URL}/academic/courses`),
         fetch(
           `${API_BASE_URL}/academic/specializations`,
         ),
       ]);

       if (coursesRes.ok && specsRes.ok) {
         const coursesData = await coursesRes.json();
         const specsData = await specsRes.json();
         setCourses(coursesData);
         setSpecializations(specsData);
       } else {
         setError("Failed to load academic options. Please refresh.");
       }
     } catch (err) {
       setError("Network error while loading academic options.");
     } finally {
       setFetchingLists(false);
     }
   };

   fetchAcademicData();
 }, []);

 // 3b. There is no route guard on /onboarding, and the endpoint now sits behind
 // requireAuth. With no stored session the POST can only ever return 401, so
 // send them to the login form instead of letting them fill in the whole form
 // and hit an error screen at the end.
 useEffect(() => {
   if (!localStorage.getItem(SESSION_KEY)) {
     navigate("/auth", { replace: true });
   }
 }, [navigate]);

 // 3c. Live username availability, debounced by 400ms.
 //
 // Unthrottled, typing "rahulsharma" fires 11 requests. They come back out of
 // order, so the answer for "rahul" can land AFTER the answer for "rahulsharma"
 // and overwrite it — the student is told a handle is free when it isn't. The
 // debounce collapses the burst; the request counter discards anything stale
 // that still arrives late.
 useEffect(() => {
   const handle = formData.username.trim();

   // Whatever the server said about the last handle no longer applies.
   setUsernameServerError("");

   if (!handle) {
     setUsernameStatus("idle");
     setUsernameSuggestions([]);
     return;
   }

   setUsernameStatus("checking");

   const timer = setTimeout(() => {
     const requestId = ++usernameRequestIdRef.current;
     const token = localStorage.getItem(SESSION_KEY);

     fetch(
       `${API_BASE_URL}/users/username-available?username=${encodeURIComponent(handle)}`,
       // Auth is optional here, but sending it means a student editing their
       // profile sees their own current handle as available, not "taken".
       { headers: token ? { Authorization: `Bearer ${token}` } : {} },
     )
       .then(async (res) => {
         const data = await res.json().catch(() => ({}));

         // A newer keystroke already fired. Drop this answer on the floor.
         if (requestId !== usernameRequestIdRef.current) return;

         if (!res.ok) {
           setUsernameStatus("unknown");
           setUsernameSuggestions([]);
           return;
         }

         if (data.available) {
           setUsernameStatus("available");
           setUsernameSuggestions([]);
           return;
         }

         setUsernameStatus(REASON_TO_STATUS[data.reason] || "invalid");
         setUsernameSuggestions(normalizeSuggestions(data.suggestions));
       })
       .catch(() => {
         if (requestId !== usernameRequestIdRef.current) return;
         setUsernameStatus("unknown");
         setUsernameSuggestions([]);
       });
   }, 400);

   return () => clearTimeout(timer);
 }, [formData.username]);

 // 3d. Three suggested handles derived from the name they typed. Same debounce
 // and same stale-response guard, for the same reason.
 useEffect(() => {
   const name = formData.fullName.trim();

   if (name.length < 2) {
     setNameSuggestions([]);
     return;
   }

   const timer = setTimeout(() => {
     const requestId = ++suggestionRequestIdRef.current;
     const token = localStorage.getItem(SESSION_KEY);

     fetch(
       `${API_BASE_URL}/users/username-suggestions?name=${encodeURIComponent(name)}`,
       { headers: token ? { Authorization: `Bearer ${token}` } : {} },
     )
       .then(async (res) => {
         const data = await res.json().catch(() => ({}));
         if (requestId !== suggestionRequestIdRef.current) return;
         setNameSuggestions(res.ok ? normalizeSuggestions(data) : []);
       })
       .catch(() => {
         if (requestId !== suggestionRequestIdRef.current) return;
         setNameSuggestions([]);
       });
   }, 400);

   return () => clearTimeout(timer);
 }, [formData.fullName]);

 // 4. Handlers
 const handleChange = (e) => {
   const { name, value } = e.target;
   if (name === "bio" && value.length > 250) return;
   // Handles are lowercase in the database. Convert silently as they type —
   // a capital letter is a keyboard habit, not a mistake worth an error for.
   const next = name === "username" ? value.toLowerCase() : value;
   setFormData((prev) => ({ ...prev, [name]: next }));
 };

 const applySuggestion = (suggestion) => {
   setFormData((prev) => ({ ...prev, username: suggestion }));
 };

 const handleDropdownChange = (selectedOption, actionMeta) => {
   // selectedOption is null when the field is cleared via the "x" button.
   setFormData((prev) => ({
     ...prev,
     [actionMeta.name]: selectedOption ? selectedOption.value : "",
   }));
 };

 // Handle Image Upload to Supabase Storage
 const handleImageUpload = async (event) => {
   try {
     setError("");
     const file = event.target.files[0];
     if (!file) return;

     // Basic validation (limit to 5MB)
     if (file.size > 5 * 1024 * 1024) {
       setError("Image size must be less than 5MB.");
       return;
     }

     setUploadingImage(true);

     // Create a unique file name to prevent overwriting
     const fileExt = file.name.split(".").pop();
     const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
     const filePath = `profiles/${fileName}`;

     // Upload to Supabase Storage (in the 'avatars' bucket)
     const { error: uploadError } = await supabase.storage
       .from("avatars")
       .upload(filePath, file);

     if (uploadError) throw uploadError;

     // Get the Public URL to display and save to database
     const { data: publicUrlData } = supabase.storage
       .from("avatars")
       .getPublicUrl(filePath);

     // Update state with the new image URL
     setFormData((prev) => ({ ...prev, avatarUrl: publicUrlData.publicUrl }));
   } catch (error) {
     console.error("Upload error:", error);
     setError("Failed to upload image. Please try again.");
   } finally {
     setUploadingImage(false);
   }
 };

 const handleSubmit = async (e) => {
   e.preventDefault();
   setError("");
   setUsernameServerError("");
   setPasswordError("");
   setLoading(true);

   const handle = formData.username.trim();

   // Frontend Validation
   if (
     !formData.fullName ||
     !handle ||
     !formData.qualification ||
     !formData.courseId ||
     !formData.yearOfStudy ||
     !formData.specializationId
   ) {
     setError("Please fill in all required fields.");
     setLoading(false);
     return;
   }

   if (password.length < MIN_PASSWORD_LENGTH) {
     setPasswordError(
       `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
     );
     setLoading(false);
     return;
   }

   if (password !== confirmPassword) {
     setPasswordError("Both passwords must match.");
     setLoading(false);
     return;
   }

   // No session means no Bearer token means a guaranteed 401. Send them to log
   // in rather than firing a request that cannot succeed.
   const token = localStorage.getItem(SESSION_KEY);
   if (!token) {
     setLoading(false);
     navigate("/auth", { replace: true });
     return;
   }

   try {
     const response = await fetch(`${API_BASE_URL}/auth/onboarding`, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         Authorization: `Bearer ${token}`,
       },
       // No `userId` here, deliberately. The backend takes the target user from
       // the verified token and ignores anything sent in the body — until it
       // grew requireAuth, that field was an account-takeover hole.
       body: JSON.stringify({
         full_name: formData.fullName,
         username: handle,
         password: password,
         avatar_url: formData.avatarUrl,
         qualification: formData.qualification,
         course_id: formData.courseId,
         year_of_study: formData.yearOfStudy,
         specialization_id: formData.specializationId,
         bio: formData.bio,
       }),
     });

     const data = await response.json();

     if (response.ok) {
       // Setting a password revokes every existing GoTrue session, so the token
       // that authorised this very call is dead as of now. The endpoint returns
       // no new session today; if it ever starts to, adopt it here so the
       // student isn't bounced to the login form the instant signup succeeds.
       if (data.session?.access_token) {
         login(
           data.session.access_token,
           data.session.user?.id || data.userProfile?.id,
           data.session.refresh_token,
         );
       }
       // The profile is complete as of this 200. Record it before navigating:
       // <GuestOnly> reads this flag, and leaving it false would send a student
       // who lands back on /auth straight into onboarding again. Same
       // urgent-vs-transition ordering as the login handler — see App.jsx.
       setProfileComplete(true);

       // Tell the navbar (mounted since login) to pull the new photo/name.
       window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
       navigate("/dashboard");
       return;
     }

     // Put each server code next to the field that caused it. Nothing in here
     // clears an input: a password the server rejected must still be sitting
     // there for them to edit.
     if (SUBMIT_ERROR_TO_STATUS[data.error]) {
       setUsernameStatus(SUBMIT_ERROR_TO_STATUS[data.error]);
       setUsernameServerError(data.message || "");
     } else if (PASSWORD_ERROR_FALLBACK[data.error]) {
       setPasswordError(data.message || PASSWORD_ERROR_FALLBACK[data.error]);
     } else if (response.status === 401) {
       navigate("/auth", { replace: true });
     } else {
       setError(data.message || data.error || "Failed to save profile.");
     }
   } catch (err) {
     setError("Network error. Please try again.");
   } finally {
     setLoading(false);
   }
 };

 // Live validity, recomputed each render — these drive both the inline hints
 // and the submit gate, so the button can never disagree with the messages.
 const trimmedUsername = formData.username.trim();
 const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;
 const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

 // "unknown" = the availability endpoint itself failed. Treating that as a
 // rejection would dead-end the page on an outage, and the handle is re-checked
 // by POST /api/auth/onboarding anyway — the unique index is the real arbiter.
 const usernameAccepted =
   usernameStatus === "available" || usernameStatus === "unknown";

 const requiredFieldsFilled = Boolean(
   formData.fullName &&
     trimmedUsername &&
     formData.qualification &&
     formData.courseId &&
     formData.yearOfStudy &&
     formData.specializationId,
 );

 const canSubmit =
   requiredFieldsFilled &&
   usernameAccepted &&
   passwordLongEnough &&
   passwordsMatch &&
   !loading &&
   !fetchingLists &&
   !uploadingImage;

 // Suggestions derived from the rejected handle beat name-derived ones — they
 // are closer to what the student actually wanted.
 const suggestionChips = usernameSuggestions.length
   ? usernameSuggestions
   : nameSuggestions;

 const usernameStatusClass =
   usernameStatus === "available"
     ? styles.statusOk
     : BAD_USERNAME_STATUSES.has(usernameStatus)
       ? styles.statusBad
       : styles.statusNeutral;

 // Format data for react-select
 const courseOptions = courses.map((course) => ({
   value: course.id,
   label: course.name,
 }));

 const specializationOptions = specializations.map((spec) => ({
   value: spec.id,
   label: spec.name,
 }));

 // Reusable custom styles for react-select to match your UI
 const customSelectStyles = {
   control: (base, state) => ({
     ...base,
     padding: "0.3rem",
     borderRadius: "0.8rem",
     borderColor: state.isFocused ? "var(--purple-light)" : "#e0e0e0",
     backgroundColor: "#FAFAFA",
     fontFamily: "'Inter', sans-serif",
     boxShadow: state.isFocused ? "0 0 0 3px rgba(215, 0, 215, 0.1)" : "none",
     cursor: "pointer",
     "&:hover": {
       borderColor: "var(--purple-light)",
     },
   }),
   option: (base, state) => ({
     ...base,
     fontFamily: "'Inter', sans-serif",
     backgroundColor: state.isSelected
       ? "var(--purple)"
       : state.isFocused
         ? "var(--pink-bg)"
         : "white",
     color: state.isSelected ? "white" : "var(--black-soft)",
     cursor: "pointer",
     "&:active": {
       backgroundColor: "var(--purple-light)",
     },
   }),
   placeholder: (base) => ({
     ...base,
     color: "#aaa",
     fontSize: "0.95rem",
   }),
   singleValue: (base) => ({
     ...base,
     color: "var(--black)",
     fontSize: "0.95rem",
   }),
   // Portaled dropdown needs a high z-index to float above the fields below it.
   menuPortal: (base) => ({ ...base, zIndex: 9999 }),
 };

 // Same as customSelectStyles, with room on the left for the leading icon
 // (qualification/year fields keep their icon; course/specialization don't have one).
 const iconSelectStyles = {
   ...customSelectStyles,
   valueContainer: (base) => ({
     ...base,
     paddingLeft: "1.8rem",
   }),
 };

 return (
   <div className={styles.onboardingContainer}>
     <div className={`${styles.glowOrb} ${styles.purpleOrb}`}></div>
     <div className={`${styles.glowOrb} ${styles.pinkOrb}`}></div>

     <div className={styles.onboardingCard}>
       <div className={styles.onboardingHeader}>
         <h2>{existingProfile.full_name ? "Update Your Profile" : "Complete Your Profile"}</h2>
         <p>
           Let your campus know who you are before you start buying and
           selling.
         </p>
       </div>
       {isDemoUser && (
         <button
           type="button"
           onClick={() => navigate("/marketplace")}
           className={styles.skipBtn}
         >
           Skip for now
         </button>
       )}
       {error && <div className={styles.errorBanner}>{error}</div>}

       <form onSubmit={handleSubmit} className={styles.onboardingForm}>
         {/* Section 1: Identity */}
         <div className={styles.formSection}>
           <h3 className={styles.sectionTitle}>Identity</h3>

           <div className={styles.avatarUploadWrapper}>
             <div className={styles.avatarPreview}>
               {formData.avatarUrl ? (
                 <SmartImage
                   src={formData.avatarUrl}
                   alt="Profile preview"
                   style={{
                     width: "100%",
                     height: "100%",
                     objectFit: "cover",
                     borderRadius: "50%",
                   }}
                 />
               ) : uploadingImage ? (
                 <Loader2 size={40} color="#888" className={styles.spinner} />
               ) : (
                 <User size={40} color="#888" />
               )}
             </div>
             <div className={styles.avatarActions}>
               <input
                 type="file"
                 accept="image/png, image/jpeg, image/webp"
                 style={{ display: "none" }}
                 ref={fileInputRef}
                 onChange={handleImageUpload}
                 disabled={uploadingImage}
               />

               <button
                 type="button"
                 className={`${styles.cuteBtn} ${styles.avatarBtn}`}
                 onClick={() => fileInputRef.current.click()}
                 disabled={uploadingImage}
               >
                 <ImagePlus size={16} />{" "}
                 {uploadingImage ? "Uploading..." : "Upload Photo (Optional)"}
               </button>
               <p className={styles.helperText}>A real photo builds trust.</p>
             </div>
           </div>

           <div className={styles.inputGroup}>
             <label>
               FULL NAME <span className={styles.required}>*</span>
             </label>
             <div className={styles.inputWithIcon}>
               <User size={18} className={styles.inputIcon} />
               <input
                 type="text"
                 name="fullName"
                 placeholder="Enter Your Name"
                 value={formData.fullName}
                 onChange={handleChange}
                 required
               />
             </div>
           </div>

           <div className={styles.inputGroup}>
             <label>
               USERNAME <span className={styles.required}>*</span>
             </label>
             <div className={styles.inputWithIcon}>
               <AtSign size={18} className={styles.inputIcon} />
               <input
                 type="text"
                 name="username"
                 placeholder="rahul.sharma"
                 value={formData.username}
                 onChange={handleChange}
                 autoComplete="username"
                 autoCapitalize="none"
                 autoCorrect="off"
                 spellCheck="false"
                 required
               />
             </div>

             {trimmedUsername && (
               <p className={styles.handlePreview}>
                 yahora.com/<strong>{trimmedUsername}</strong>
               </p>
             )}

             {usernameStatus !== "idle" && (
               <p className={`${styles.fieldStatus} ${usernameStatusClass}`}>
                 {usernameStatus === "checking" ? (
                   <Loader2 size={14} className={styles.spinner} />
                 ) : usernameStatus === "available" ? (
                   <Check size={14} style={{ flexShrink: 0 }} />
                 ) : BAD_USERNAME_STATUSES.has(usernameStatus) ? (
                   <X size={14} style={{ flexShrink: 0 }} />
                 ) : null}
                 <span>
                   {usernameServerError || USERNAME_STATUS_COPY[usernameStatus]}
                 </span>
               </p>
             )}

             {usernameStatus !== "available" && suggestionChips.length > 0 && (
               <div className={styles.suggestionChips}>
                 {suggestionChips.map((suggestion) => (
                   <button
                     key={suggestion}
                     type="button"
                     className={styles.chip}
                     onClick={() => applySuggestion(suggestion)}
                   >
                     {suggestion}
                   </button>
                 ))}
               </div>
             )}

             <p className={styles.helperText}>
               You can change this once every 30 days.
             </p>
           </div>
         </div>

         {/* Section 2: Academic Details */}
         <div className={styles.formSection}>
           <h3 className={styles.sectionTitle}>Academic Details</h3>

           <div className={styles.inputRow}>
             <div className={styles.inputGroup}>
               <label>
                 QUALIFICATION <span className={styles.required}>*</span>
               </label>
               <div className={styles.inputWithIcon}>
                 <GraduationCap size={18} className={styles.inputIcon} style={{ zIndex: 1 }} />
                 <div style={{ width: "100%" }}>
                   <SearchableSelect
                     name="qualification"
                     options={QUALIFICATION_OPTIONS}
                     onChange={handleDropdownChange}
                     value={
                       QUALIFICATION_OPTIONS.find(
                         (opt) => opt.value === formData.qualification,
                       ) || null
                     }
                     placeholder="Search qualification..."
                     isSearchable={true}
                     isClearable={true}
                     styles={iconSelectStyles}
                   />
                 </div>
               </div>
             </div>

             <div className={styles.inputGroup}>
               <label>
                 COURSE (Select 'Others' if not listed){" "}
                 <span className={styles.required}>*</span>
               </label>
               <div>
                 <SearchableSelect
                   name="courseId"
                   options={courseOptions}
                   onChange={handleDropdownChange}
                   value={courseOptions.find(opt => opt.value === formData.courseId) || null}
                   placeholder={
                     fetchingLists ? "Loading courses..." : "Search course..."
                   }
                   isDisabled={fetchingLists}
                   isSearchable={true}
                   isClearable={true}
                   styles={customSelectStyles}
                 />
               </div>
             </div>
           </div>

           <div className={styles.inputRow}>
             <div className={styles.inputGroup}>
               <label>
                 YEAR OF STUDY <span className={styles.required}>*</span>
               </label>
               <div className={styles.inputWithIcon}>
                 <Calendar size={18} className={styles.inputIcon} style={{ zIndex: 1 }} />
                 <div style={{ width: "100%" }}>
                   <SearchableSelect
                     name="yearOfStudy"
                     options={YEAR_OPTIONS}
                     onChange={handleDropdownChange}
                     value={
                       YEAR_OPTIONS.find((opt) => opt.value === formData.yearOfStudy) || null
                     }
                     placeholder="Search year..."
                     isSearchable={true}
                     isClearable={true}
                     styles={iconSelectStyles}
                   />
                 </div>
               </div>
             </div>

             <div className={styles.inputGroup}>
               <label>
                 SPECIALIZATION (Select 'Others' if not listed)
                 <span className={styles.required}>*</span>
               </label>
               <div>
                 <SearchableSelect
                   name="specializationId"
                   options={specializationOptions}
                   onChange={handleDropdownChange}
                   value={specializationOptions.find(opt => opt.value === formData.specializationId) || null}
                   placeholder={
                     fetchingLists
                       ? "Loading specializations..."
                       : "Search specialization..."
                   }
                   isDisabled={fetchingLists}
                   isSearchable={true}
                   isClearable={true}
                   styles={customSelectStyles}
                 />
               </div>
             </div>
           </div>
         </div>

         {/* Section 3: Personal Touch */}
         <div className={styles.formSection}>
           <h3 className={styles.sectionTitle}>Personal Touch</h3>
           <div className={styles.inputGroup}>
             <label>
               SHORT BIO (Optional)
               <span className={styles.charCount}>
                 {formData.bio.length}/250
               </span>
             </label>
             <div className={styles.textareaWrapper}>
               <Sparkles
                 size={18}
                 className={`${styles.inputIcon} ${styles.textareaIcon}`}
               />
               <textarea
                 name="bio"
                 placeholder="e.g., CSE student, selling mostly electronics and books."
                 value={formData.bio}
                 onChange={handleChange}
                 rows="3"
               ></textarea>
             </div>
           </div>
         </div>

         {/* Section 4: Password.
             Note there is no onPaste handler anywhere below, deliberately:
             blocking paste breaks password managers, and password managers are
             the reason students end up with strong passwords at all. */}
         <div className={styles.formSection}>
           <h3 className={styles.sectionTitle}>Password</h3>

           <div className={styles.inputRow}>
             <div className={styles.inputGroup}>
               <label>
                 PASSWORD <span className={styles.required}>*</span>
               </label>
               <div className={styles.inputWithIcon}>
                 <Lock size={18} className={styles.inputIcon} />
                 <input
                   type={showPassword ? "text" : "password"}
                   name="password"
                   className={styles.withToggle}
                   placeholder="At least 8 characters"
                   value={password}
                   onChange={(e) => {
                     setPassword(e.target.value);
                     setPasswordError("");
                   }}
                   autoComplete="new-password"
                   required
                 />
                 <button
                   type="button"
                   className={styles.toggleBtn}
                   onClick={() => setShowPassword((visible) => !visible)}
                   aria-label={showPassword ? "Hide password" : "Show password"}
                 >
                   {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                 </button>
               </div>
             </div>

             <div className={styles.inputGroup}>
               <label>
                 CONFIRM PASSWORD <span className={styles.required}>*</span>
               </label>
               <div className={styles.inputWithIcon}>
                 <Lock size={18} className={styles.inputIcon} />
                 <input
                   type={showConfirmPassword ? "text" : "password"}
                   name="confirmPassword"
                   className={styles.withToggle}
                   placeholder="Type it again"
                   value={confirmPassword}
                   onChange={(e) => {
                     setConfirmPassword(e.target.value);
                     setPasswordError("");
                   }}
                   autoComplete="new-password"
                   required
                 />
                 <button
                   type="button"
                   className={styles.toggleBtn}
                   onClick={() =>
                     setShowConfirmPassword((visible) => !visible)
                   }
                   aria-label={
                     showConfirmPassword ? "Hide password" : "Show password"
                   }
                 >
                   {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                 </button>
               </div>
             </div>
           </div>

           <div className={styles.passwordFeedback}>
             <p
               className={`${styles.fieldStatus} ${
                 passwordLongEnough ? styles.statusOk : styles.statusNeutral
               }`}
             >
               {passwordLongEnough ? (
                 <Check size={14} style={{ flexShrink: 0 }} />
               ) : (
                 <span className={styles.ruleDot} />
               )}
               <span>At least 8 characters</span>
             </p>

             {confirmPassword.length > 0 && !passwordsMatch && (
               <p className={`${styles.fieldStatus} ${styles.statusBad}`}>
                 <X size={14} style={{ flexShrink: 0 }} />
                 <span>Both passwords must match.</span>
               </p>
             )}

             {/* Server verdict (WEAK_PASSWORD / COMMON_PASSWORD). What they
                 typed stays in the field — they edit it, they don't retype it. */}
             {passwordError && (
               <p className={`${styles.fieldStatus} ${styles.statusBad}`}>
                 <X size={14} style={{ flexShrink: 0 }} />
                 <span>{passwordError}</span>
               </p>
             )}
           </div>
         </div>

           <button
             type="submit"
             className={styles.btnPrimary}
             disabled={!canSubmit}
             style={{ flex: 1 }}
           >
             {loading ? "Saving Profile..." : "Save & Enter Yahora"}
           </button>
       </form>
     </div>
   </div>
 );
};

export default Onboarding;