// frontend/src/pages/sell/Sell.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Laptop,
  Armchair,
  BookOpen,
  Shirt,
  Bike,
  Coffee,
  Dumbbell,
  Package,ChevronDown,
} from "lucide-react";
import ProductCard from "../../components/ProductCard/ProductCard";
import styles from "./Sell.module.css";

// Premium Lucide Icons instead of emojis
const CATEGORIES = [
  { label: "Electronics & Tech", icon: Laptop },
  { label: "Furniture & Decor", icon: Armchair },
  { label: "Books & Study Materials", icon: BookOpen },
  { label: "Clothing & Accessories", icon: Shirt },
  { label: "Vehicles & Bikes", icon: Bike },
  { label: "Appliances", icon: Coffee },
  { label: "Sports & Fitness", icon: Dumbbell },
  { label: "Miscellaneous", icon: Package },
];

const PLACEHOLDER_IMAGE = `data:image/svg+xml;utf8,%3Csvg width='600' height='600' viewBox='0 0 600 600' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='600' height='600' fill='%23f8fafc'/%3E%3Cg transform='translate(268,250)' stroke='%23cbd5e1' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='-24' y='-24' width='112' height='112' rx='12'/%3E%3Ccircle cx='8' cy='8' r='8'/%3E%3Cpath d='M-24 56l32-32 24 24 16-16 40 40'/%3E%3C/g%3E%3Ctext x='300' y='420' font-family='sans-serif' font-size='16' font-weight='600' fill='%2394a3b8' text-anchor='middle'%3EUpload photos to preview%3C/text%3E%3C/svg%3E`;

export default function Sell() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

  // Check if we are in "Edit Mode" based on data passed from Dashboard
  const editProduct = location.state?.editProduct || null;

  // Pre-fill state if editing
  const [formData, setFormData] = useState({
    title: editProduct?.title || "",
    description: editProduct?.description || "",
    price: editProduct?.price || "",
    category: editProduct?.category || "",
    location: editProduct?.location || "",
    condition: editProduct?.condition || "Good",
  });

  // If editing, load existing image URLs to display in preview
  const [images, setImages] = useState(editProduct?.image_urls || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [sellerProfile, setSellerProfile] = useState({
    full_name: "Loading...",
    avatar_url: null,
  });

  /* ── Fetch Real User Profile for Preview ── */
  useEffect(() => {
    const fetchProfile = async () => {
      const userId = localStorage.getItem("yahora_user_id");
      const token = localStorage.getItem("yahora_session");
      if (!userId || !token) return;

      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/user/${userId}/dashboard`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setSellerProfile({
              full_name: data.profile.full_name || "Anonymous Student",
              avatar_url: data.profile.avatar_url,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load seller profile", err);
      }
    };
    fetchProfile();
  }, []);

  /* ── Handlers ── */
  const handleInputChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleCategoryToggle = (label) => {
    setFormData((prev) => ({
      ...prev,
      category: prev.category === label ? "" : label,
    }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 5) {
      setError("You can only upload a maximum of 5 images.");
      return;
    }
    setError("");
    setImages((prev) => [...prev, ...files]);
  };

  const removeImage = (indexToRemove) =>
    setImages(images.filter((_, i) => i !== indexToRemove));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (images.length === 0) {
      setError("Please add at least one photo.");
      return;
    }
    if (!formData.category) {
      setError("Please select a category.");
      return;
    }
    if (!formData.location) {
      setError("Please enter a location/hostel.");
      return;
    }

    setLoading(true);
    try {
      const userId = localStorage.getItem("yahora_user_id");
      const token = localStorage.getItem("yahora_session");
      if (!userId || !token) {
        navigate("/auth");
        return;
      }

      let res;

      if (editProduct) {
        // --- EDIT MODE (PUT REQUEST) ---
        res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/api/products/${editProduct.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: formData.title,
              description: formData.description,
              price: formData.price,
              category: formData.category,
              location: formData.location,
              condition: formData.condition,
            }),
          },
        );
      } else {
        // --- CREATE MODE (POST REQUEST) ---
        const submitData = new FormData();
        submitData.append("seller_id", userId);
        submitData.append("title", formData.title);
        submitData.append("description", formData.description);
        submitData.append("price", formData.price);
        submitData.append("category", formData.category);
        submitData.append("location", formData.location);
        submitData.append('condition',   formData.condition);
        images.forEach((img) => submitData.append("images", img));

        res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/products`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: submitData,
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save listing");
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Live Preview Object ── */
  const previewProduct = {
    id: null,
    title: formData.title || "Your Item Title",
    price: formData.price || "0",
    description:
      formData.description || "Your item description will appear here...",
    category: formData.category || "Category",
    location: formData.location || "Campus Location",
    condition: formData.condition || 'Good',
    // Handle mix of existing URL strings and new File objects for preview
    image_urls:
      images.length > 0
        ? images.map((img) =>
            typeof img === "string" ? img : URL.createObjectURL(img),
          )
        : [PLACEHOLDER_IMAGE],
    status: "available",
    views: 0,
    likes_count: 0,
    comments_count: 0,
    created_at: new Date().toISOString(),
    is_liked: false,
    is_saved: false,
    seller: {
      full_name: sellerProfile.full_name,
      avatar_url: sellerProfile.avatar_url,
    },
  };

  /* ── Render ── */
  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <div className={styles.wrapper}>
        <aside className={styles.aside}>
          <div className={styles.asideStickyContent}>
            <div className={styles.asideBadge}>Campus Marketplace</div>
            <h2 className={styles.asideHeading}>
              Turn your
              <em> unused gear </em>
              into cash.
            </h2>

            <div className={styles.livePreviewHeader}>
              <span className={styles.pulseDot}></span>
              Live Preview
            </div>
            <div className={styles.previewWrapper}>
              <ProductCard product={previewProduct} />
            </div>
          </div>
        </aside>

        <main className={styles.formPanel}>
          <div className={styles.formHeader}>
            <h1 className={styles.formTitle}>
              {editProduct ? "Edit Item" : "List a New Item"}
            </h1>
            <p className={styles.formSub}>
              {editProduct
                ? "Update your item details below."
                : "Fill in the details below — it only takes 60 seconds."}
            </p>
          </div>

          {error && (
            <div className={styles.errorMsg}>
              <span className={styles.errorIcon}>⚠️</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* ── Photos ── */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>
                <span className={styles.sectionNum}>01</span>
                Photos
                <span className={styles.sectionHint}>
                  Up to 5 · First photo is the cover
                </span>
              </div>

              <div className={styles.imageGrid}>
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className={`${styles.previewWrap} ${idx === 0 ? styles.coverWrap : ""}`}
                  >
                    <img
                      // Handle both existing URLs and new file objects
                      src={
                        typeof img === "string" ? img : URL.createObjectURL(img)
                      }
                      alt={`preview ${idx + 1}`}
                      className={styles.previewImg}
                    />
                    {idx === 0 && (
                      <span className={styles.coverBadge}>Cover</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className={styles.removeBtn}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {images.length < 5 && !editProduct && (
                  <button
                    type="button"
                    className={styles.uploadBox}
                    onClick={() => fileInputRef.current.click()}
                  >
                    <span className={styles.uploadPlus}>+</span>
                    <span className={styles.uploadLabel}>
                      {images.length === 0 ? "Add Photos" : "Add More"}
                    </span>
                  </button>
                )}
              </div>

              {/* Hide file input in edit mode for now to keep image updating simple */}
              {!editProduct && (
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                />
              )}
            </div>

            {/* ── Title ── */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>
                <span className={styles.sectionNum}>02</span>
                Title
              </div>
              <input
                type="text"
                name="title"
                required
                placeholder="e.g., Slightly used Study Table"
                className={styles.input}
                value={formData.title}
                onChange={handleInputChange}
              />
            </div>


            {/* ── Category ── */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>
                <span className={styles.sectionNum}>03</span>
                Category
              </div>
              <div className={styles.categoryGrid}>
                {CATEGORIES.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    className={`${styles.catChip} ${formData.category === label ? styles.catActive : ""}`}
                    onClick={() => handleCategoryToggle(label)}
                  >
                    <span className={styles.catIcon}>
                      <Icon strokeWidth={1.5} size={28} />
                    </span>
                    <span className={styles.catLabel}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Condition ── */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>
                <span className={styles.sectionNum}>04</span>
                Item Condition
              </div>
              <div style={{ position: 'relative' }}>
                <select 
                  name="condition" 
                  className={styles.input} 
                  value={formData.condition} 
                  onChange={handleInputChange}
                  style={{ appearance: 'none', paddingRight: '40px' }} 
                >
                  <option value="Mint">Mint (Like Brand New)</option>
                  <option value="Like New">Like New (Barely Used)</option>
                  <option value="Good">Good (Normal Wear)</option>
                  <option value="Fair">Fair (Noticeable Wear)</option>
                  <option value="Poor">Poor (Needs Repair)</option>
                </select>
                {/* Custom Dropdown Arrow */}
                <ChevronDown 
                  size={18} 
                  style={{ 
                    position: 'absolute', right: '14px', top: '50%', 
                    transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' 
                  }} 
                />
              </div>
            </div>

            {/* ── Location ── */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>
                <span className={styles.sectionNum}>05</span>
                Hostel / Location
              </div>
              <input
                type="text"
                name="location"
                required
                placeholder="e.g., Hall 1 or Kalam Hostel"
                className={styles.input}
                value={formData.location}
                onChange={handleInputChange}
              />
            </div>

            {/* ── Price ── */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>
                <span className={styles.sectionNum}>06</span>
                Price
              </div>
              <div className={styles.priceWrap}>
                <span className={styles.priceSymbol}>₹</span>
                <input
                  type="number"
                  name="price"
                  required
                  min="0"
                  placeholder="0"
                  className={`${styles.input} ${styles.priceInput}`}
                  value={formData.price}
                  onChange={handleInputChange}
                  onWheel={(e) => e.target.blur()}
                />
              </div>
            </div>

            {/* ── Description ── */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>
                <span className={styles.sectionNum}>07</span>
                Description
              </div>
              <textarea
                name="description"
                required
                placeholder="Describe the condition, age, and reason for selling…"
                className={`${styles.input} ${styles.textarea}`}
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>

            {/* ── Submit ── */}
            <center>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className={styles.submitSpinner} />
                    {editProduct ? "Saving changes..." : "Posting your item…"}
                  </>
                ) : (
                  <>
                    <span className={styles.submitArrow}>✦</span>
                    {editProduct ? "Save Changes" : "Post Item to Campus"}
                  </>
                )}
              </button>
            </center>
          </form>
        </main>
      </div>
    </div>
  );
}
