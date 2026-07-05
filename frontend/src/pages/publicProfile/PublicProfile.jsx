// frontend/src/pages/publicProfile/PublicProfile.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "../dashboard/Dashboard.module.css";
import ProductCard from "../../components/ProductCard/ProductCard";

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

function DisplayAvatar({ src, name, size, onClick }) {
  // Generate beautiful fallback avatar data
  const initials = (name || "User")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hue =
    (name || "User").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    360;

  return (
    <div className={styles.avatarWrap} style={{ "--av-size": size + "px" }}>
      <div 
        className={styles.avatarRing} 
        onClick={onClick}
        style={{ cursor: onClick ? "pointer" : "default" }}
      >
        {src ? (
          <img src={src} alt="avatar" className={styles.avatarImg} />
        ) : (
          <div
            className={styles.avatarPlaceholder}
            style={{
              background: `linear-gradient(135deg, hsl(${hue}, 60%, 55%), hsl(${hue + 40}, 60%, 45%))`,
            }}
          >
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  // 1. Fetch the current logged-in user's ID
  const currentUserId = localStorage.getItem("yahora_user_id");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDashboard, setIsDashboard] = useState(false);
  
  // NEW: State for the Image Modal
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // We pass the currentUserId in the query so the backend knows if the visitor has liked/saved these items
        const res = await fetch(
          `${API_BASE_URL}/user/${id}/public${currentUserId ? `?user_id=${currentUserId}` : ""}`,
        );
        if (!res.ok) throw new Error("Failed to fetch profile");
        setData(await res.json());
      } catch (err) {
        console.error("Fetch failed:", err);
        setError("Could not load this profile. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id, currentUserId]);

  /* ── 2. Add Like and Save Handlers ── */
  const handleToggleLike = async (productId, currentState) => {
    if (!currentUserId) return;

    // Optimistic UI update
    setData((prev) => ({
      ...prev,
      listings: prev.listings.map((p) =>
        p.id === productId
          ? {
              ...p,
              is_liked: !currentState,
              likes_count: p.likes_count + (!currentState ? 1 : -1),
            }
          : p,
      ),
    }));

    try {
      await fetch(`${API_BASE_URL}/products/${productId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUserId }),
      });
    } catch (e) {
      console.error("Failed to toggle like:", e);
    }
  };

  const handleToggleSave = async (productId, currentState) => {
    if (!currentUserId) return;

    // Optimistic UI update
    setData((prev) => ({
      ...prev,
      listings: prev.listings.map((p) =>
        p.id === productId ? { ...p, is_saved: !currentState } : p,
      ),
    }));

    try {
      await fetch(`${API_BASE_URL}/products/${productId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUserId }),
      });
    } catch (e) {
      console.error("Failed to toggle save:", e);
    }
  };

  /* ── Smooth Scroll Intent Logic ── */
  useEffect(() => {
    let touchStartY = 0;
    let isCooldown = false;

    const startCooldown = () => {
      isCooldown = true;
      setTimeout(() => {
        isCooldown = false;
      }, 800);
    };

    const handleWheel = (e) => {
      if (isCooldown) return;
      if (!isDashboard && e.deltaY > 20) {
        setIsDashboard(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        startCooldown();
      } else if (isDashboard && e.deltaY < -20 && window.scrollY <= 0) {
        setIsDashboard(false);
        startCooldown();
      }
    };

    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchMove = (e) => {
      if (isCooldown) return;
      const delta = touchStartY - e.touches[0].clientY;
      if (!isDashboard && delta > 30) {
        setIsDashboard(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        startCooldown();
      } else if (isDashboard && delta < -30 && window.scrollY <= 0) {
        setIsDashboard(false);
        startCooldown();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isDashboard]);

  if (loading)
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Loading profile…</span>
      </div>
    );
  if (error)
    return (
      <div className={styles.loading}>
        <span>{error}</span>
      </div>
    );
  if (!data) return null;

  const { profile, listings } = data;
  const firstName = (profile.full_name || "User").split(" ")[0];

  return (
    <div
      className={styles.dashboardRoot}
      style={{ position: "relative", minHeight: "100vh", overflowX: "hidden" }}
    >
      {/* HERO VIEW */}
      <div
        className={styles.heroView}
        style={{
          opacity: isDashboard ? 0 : 1,
          transform: isDashboard
            ? "translateY(-40px) scale(0.96)"
            : "translateY(0) scale(1)",
          pointerEvents: isDashboard ? "none" : "all",
          transition:
            "opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          position: isDashboard ? "absolute" : "relative",
          width: "100%",
          top: 0,
          zIndex: isDashboard ? 0 : 10,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#666",
            fontWeight: "bold",
            fontSize: "1rem",
            zIndex: 20,
          }}
        >
          ← Back
        </button>

        <div className={styles.heroHeader}>
          <DisplayAvatar
            src={profile.avatar_url}
            name={profile.full_name}
            size={160}
            onClick={() => setIsImageModalOpen(true)}
          />
          <div className={styles.heroText}>
            <div className={styles.heroEyebrow}>Verified Campus Seller</div>
            <div className={styles.sidebarUni}>
              <span className={styles.sidebarUniDot} />
              {profile.university || "University"}
            </div>
            <div className={styles.heroGreeting}>Hi! I am {firstName} 👋</div>
            <div className={styles.heroSub}>
              Welcome to my page! Browse my pre-loved items and find something
              great for your campus life.
            </div>
          </div>
        </div>

        <div className={styles.heroCards}>
          <div className={styles.academicCard}>
            <div className={styles.cardTitleRow}>
              <span className={styles.sectionTitle}>Academic Profile</span>
            </div>
            <div className={styles.acadGrid}>
              <div>
                <div className={styles.acadLabel}>Qualification</div>
                <div className={styles.acadValue}>
                  {profile.qualification || "—"}
                </div>
              </div>
              <div>
                <div className={styles.acadLabel}>Course</div>
                <div className={styles.acadValue}>
                  {profile.courseName || "—"}
                </div>
              </div>
              <div>
                <div className={styles.acadLabel}>Current Year</div>
                <div className={styles.acadValue}>
                  {profile.year_of_study || "—"}
                </div>
              </div>
              <div>
                <div className={styles.acadLabel}>Specialization</div>
                <div className={styles.acadValue}>
                  {profile.specializationName || "—"}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.bioCard}>
            <div className={styles.bioCardHead}>
              <span className={styles.sectionTitle}>A bit about me</span>
            </div>
            <p className={styles.bioText}>
              "
              {profile.bio ||
                "Happy to help you find what you need. Feel free to message me!"}
              "
            </p>
            <div className={styles.tags}>
              {["Trusted Seller", "Fast Replier", "Campus Verified"].map(
                (t) => (
                  <span key={t} className={styles.tag}>
                    {t}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>

        <button
          className={styles.sellBtn}
          onClick={() => {
            setIsDashboard(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          Explore My Listings
        </button>
      </div>

      {/* DASHBOARD/SPLIT VIEW */}
      <div
        className={styles.dashView}
        style={{
          gap: "20px",
          opacity: isDashboard ? 1 : 0,
          transform: isDashboard ? "translateY(0)" : "translateY(40px)",
          pointerEvents: isDashboard ? "all" : "none",
          transition:
            "opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          position: isDashboard ? "relative" : "absolute",
          width: "100%",
          top: -30,
          zIndex: isDashboard ? 10 : 0,
        }}
      >
        <div
          className={styles.sidebar}
          style={{
            position: "relative",
            top: "17px",
          }}
        >
          <div className={styles.sidebarProfileCard}>
            <DisplayAvatar
              src={profile.avatar_url}
              name={profile.full_name}
              size={140}
              onClick={() => setIsImageModalOpen(true)}
            />
            <div className={styles.sidebarName}>{profile.full_name}</div>
            <div className={styles.sidebarUni}>
              <span className={styles.sidebarUniDot} />
              {profile.university || "University"}
            </div>
            <div
              className={styles.sidebarBio}
              style={{
                marginTop: "16px",
                color: "#555",
                fontStyle: "italic",
                fontSize: "0.9rem",
                lineHeight: "1.5",
              }}
            >
              "{profile.bio || "No bio provided yet."}"
            </div>
          </div>
          <div className={styles.sidebarDetailsCard}>
            <div className={styles.detailRow}>
              <div className={styles.detailPill}>
                <div className={styles.detailPillLabel}>Qualification</div>
                <div className={styles.detailPillValue}>
                  {profile.qualification || "—"}
                </div>
              </div>
              <div className={styles.detailPill}>
                <div className={styles.detailPillLabel}>Course</div>
                <div className={styles.detailPillValue}>
                  {profile.courseName || "—"}
                </div>
              </div>
              <div className={styles.yearSpecRow}>
                <div className={styles.detailPill}>
                  <div className={styles.detailPillLabel}>Year</div>
                  <div className={styles.detailPillValue}>
                    {profile.year_of_study || "—"}
                  </div>
                </div>
                <div className={styles.detailPill}>
                  <div className={styles.detailPillLabel}>Specialization</div>
                  <div className={styles.detailPillValue}>
                    {profile.specializationName || "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.mainContent}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${styles.tabActive}`}>
              {firstName}'s Active Listings
            </button>
          </div>

          <div className={styles.grid}>
            {listings.length ? (
              listings.map((item) => (
                <ProductCard
                  key={item.id}
                  product={{ ...item, seller: profile }}
                  isOwner={false}
                  // 3. Pass all necessary props to the ProductCard
                  currentUserId={currentUserId}
                  onToggleLike={() => handleToggleLike(item.id, item.is_liked)}
                  onToggleSave={() => handleToggleSave(item.id, item.is_saved)}
                  onCardClick={() => navigate(`/product/${item.id}`)}
                />
              ))
            ) : (
              <div className={styles.emptyState}>
                {firstName} has no active items for sale right now.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NEW: IMAGE ZOOM MODAL */}
      {isImageModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
            animation: "fadeIn 0.2s ease"
          }}
          onClick={() => setIsImageModalOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
            <DisplayAvatar 
              src={profile.avatar_url} 
              name={profile.full_name} 
              size={Math.min(window.innerWidth * 0.8, 350)} 
            />
          </div>
        </div>
      )}
    </div>
  );
}