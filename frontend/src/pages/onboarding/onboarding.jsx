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
 Loader2, // Imported the loading spinner icon
} from "lucide-react";
import styles from "./onboarding.module.css";
// IMPORT YOUR FRONTEND SUPABASE CLIENT
import { supabase } from "../../config/supabaseClient.js";

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

 // 1. Form State (Pre-filled with existing data if available)
 const [formData, setFormData] = useState({
   fullName: existingProfile.full_name || "",
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
         fetch(`${import.meta.env.VITE_API_BASE_URL}/api/academic/courses`),
         fetch(
           `${import.meta.env.VITE_API_BASE_URL}/api/academic/specializations`,
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

 // 4. Handlers
 const handleChange = (e) => {
   const { name, value } = e.target;
   if (name === "bio" && value.length > 250) return;
   setFormData((prev) => ({ ...prev, [name]: value }));
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
   setLoading(true);

   // Frontend Validation
   if (
     !formData.fullName ||
     !formData.qualification ||
     !formData.courseId ||
     !formData.yearOfStudy ||
     !formData.specializationId
   ) {
     setError("Please fill in all required fields.");
     setLoading(false);
     return;
   }

   try {
     const token = localStorage.getItem("yahora_session");
     const userId =
       localStorage.getItem("yahora_user_id") || "replace-with-actual-uuid";

     const response = await fetch(
       `${import.meta.env.VITE_API_BASE_URL}/api/auth/onboarding`,
       {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${token}`,
         },
         body: JSON.stringify({
           userId: userId,
           full_name: formData.fullName,
           avatar_url: formData.avatarUrl,
           qualification: formData.qualification,
           course_id: formData.courseId,
           year_of_study: formData.yearOfStudy,
           specialization_id: formData.specializationId,
           bio: formData.bio,
         }),
       },
     );

     const data = await response.json();

     if (response.ok) {
       navigate("/dashboard");
     } else {
       setError(data.error || data.message || "Failed to save profile.");
     }
   } catch (err) {
     setError("Network error. Please try again.");
   } finally {
     setLoading(false);
   }
 };

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
                 <img
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
                 <Loader2
                   size={40}
                   color="#888"
                   style={{ animation: "spin 1s linear infinite" }}
                 />
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

           <button
             type="submit"
             className={styles.btnPrimary}
             disabled={loading || fetchingLists}
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