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
   setFormData((prev) => ({
     ...prev,
     [actionMeta.name]: selectedOption.value,
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
                 <GraduationCap size={18} className={styles.inputIcon} />
                 <select
                   name="qualification"
                   value={formData.qualification}
                   onChange={handleChange}
                   required
                 >
                   <option value="" disabled>
                     Select Qualification
                   </option>
                   <option value="PhD">PhD</option>
                   <option value="Post Graduation">Post Graduation</option>
                   <option value="Graduation">Graduation</option>
                   <option value="Intermediate (12th)">
                     Intermediate (12th)
                   </option>
                   <option value="High School (10th)">
                     High School (10th)
                   </option>
                 </select>
               </div>
             </div>

             <div className={styles.inputGroup}>
               <label>
                 COURSE (Select 'Others' if not listed){" "}
                 <span className={styles.required}>*</span>
               </label>
               <div style={{ position: "relative", zIndex: 50 }}>
                 <Select
                   name="courseId"
                   options={courseOptions}
                   onChange={handleDropdownChange}
                   value={courseOptions.find(opt => opt.value === formData.courseId) || null}
                   placeholder={
                     fetchingLists ? "Loading courses..." : "Search course..."
                   }
                   isDisabled={fetchingLists}
                   isSearchable={true}
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
                 <Calendar size={18} className={styles.inputIcon} />
                 <select
                   name="yearOfStudy"
                   value={formData.yearOfStudy}
                   onChange={handleChange}
                   required
                 >
                   <option value="" disabled>
                     Select Year
                   </option>
                   <option value="1st year">1st year</option>
                   <option value="2nd year">2nd year</option>
                   <option value="3rd year">3rd year</option>
                   <option value="4th year">4th year</option>
                   <option value="5th year">5th year</option>
                 </select>
               </div>
             </div>

             <div className={styles.inputGroup}>
               <label>
                 SPECIALIZATION (Select 'Others' if not listed)
                 <span className={styles.required}>*</span>
               </label>
               <div style={{ position: "relative", zIndex: 40 }}>
                 <Select
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