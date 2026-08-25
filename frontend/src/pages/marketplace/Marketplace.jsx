import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import ProductCard from "../../components/ProductCard/ProductCard";
import styles from "./Marketplace.module.css";
import { supabase } from "../../config/supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import {
  Search,
  LayoutGrid,
  Layers,
  ArrowRightLeft,
  SlidersHorizontal,
  X,
  ChevronDown,
  ChevronUp,
  Heart,
  Tag,
  Banknote,
  Star,
  Calendar,
  List,
  Check,
  Plus,
  Laptop,
  Armchair,
  BookOpen,
  Shirt,
  Bike,
  PlugZap,
  Dumbbell,
  Package,
  ShoppingBag,
  PartyPopper,
  Globe2,
} from "lucide-react";

const CATEGORIES = [
  {
    id: "electronics",
    label: "Electronics & Tech",
    icon: <Laptop size={16} />,
  },
  { id: "furniture", label: "Furniture & Decor", icon: <Armchair size={16} /> },
  {
    id: "books",
    label: "Books & Study Materials",
    icon: <BookOpen size={16} />,
  },
  {
    id: "clothing",
    label: "Clothing & Accessories",
    icon: <Shirt size={16} />,
  },
  { id: "vehicles", label: "Vehicles & Bikes", icon: <Bike size={16} /> },
  { id: "appliances", label: "Appliances", icon: <PlugZap size={16} /> },
  { id: "sports", label: "Sports & Fitness", icon: <Dumbbell size={16} /> },
  { id: "misc", label: "Miscellaneous", icon: <Package size={16} /> },
];

const CONDITIONS = ["Mint", "Like New", "Good", "Fair", "Poor"];

const SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "lowest_price", label: "Lowest Price" },
  { key: "trending", label: "Trending" },
];

const POSTING_DATE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "older", label: "Older" },
];

const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL}/api`;

/* Freezes the page behind an overlay so scrolling inside the overlay can't
   chain through to the feed. Refcounted, because more than one overlay can be
   mounted at a time and the last one to unmount must not unlock early. */
let scrollLockCount = 0;
function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;

    if (scrollLockCount === 0) {
      document.body.dataset.prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    scrollLockCount++;

    return () => {
      scrollLockCount--;
      if (scrollLockCount === 0) {
        document.body.style.overflow = document.body.dataset.prevOverflow || "";
        delete document.body.dataset.prevOverflow;
      }
    };
  }, [active]);
}

const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className={styles.skeleton}>
      <div className={`${styles.skeletonImg} ${styles.shimmer}`} />
      <div className={styles.skeletonBody}>
        <div
          className={`${styles.skeletonLine} ${styles.skeletonLineSm} ${styles.shimmer}`}
        />
        <div
          className={`${styles.skeletonLine} ${styles.skeletonLineLg} ${styles.shimmer}`}
        />
        <div className={`${styles.skeletonLine} ${styles.shimmer}`} />
      </div>
    </div>
  );
});

const SWIPE_THRESHOLD = 100;
/* Movement (px) before we commit to an axis. Under this the gesture is still
   ambiguous and we must not steal it from the page scroller. */
const AXIS_LOCK_SLOP = 8;

const SwipeCard = memo(function SwipeCard({
  product,
  onLike,
  onPass,
  onSave,
  onCardClick,
  zIndex,
  isTop,
  currentUserId,
}) {
  const cardRef = useRef(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  /* null = axis undecided, "x" = we own the gesture (swipe),
     "y" = the page owns it (vertical scroll) and we stay out of the way. */
  const axis = useRef(null);
  const activePointer = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const rotate = offsetX / 20;
  const likeOp = Math.min(offsetX / SWIPE_THRESHOLD, 1);
  const passOp = Math.min(-offsetX / SWIPE_THRESHOLD, 1);

  const resetGesture = useCallback(() => {
    activePointer.current = null;
    axis.current = null;
    setDragging(false);
  }, []);

  const onPointerDown = useCallback(
    (e) => {
      if (!isTop) return;
      if (e.target.closest("button")) {
        return;
      }
      /* Deliberately do NOT capture the pointer yet — capturing here would take
         the gesture away from the page scroller before we know whether the user
         is swiping sideways or scrolling the feed. */
      startX.current = e.clientX;
      startY.current = e.clientY;
      currentX.current = 0;
      axis.current = null;
      activePointer.current = e.pointerId;
    },
    [isTop],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (activePointer.current !== e.pointerId) return;

      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;

      if (axis.current === null) {
        // Still ambiguous — wait for a decisive movement.
        if (Math.abs(dx) < AXIS_LOCK_SLOP && Math.abs(dy) < AXIS_LOCK_SLOP)
          return;

        if (Math.abs(dx) > Math.abs(dy)) {
          axis.current = "x";
          cardRef.current?.setPointerCapture(e.pointerId);
          setDragging(true);
        } else {
          // Vertical intent: hand the gesture back so the page can scroll.
          axis.current = "y";
          activePointer.current = null;
          return;
        }
      }

      if (axis.current !== "x") return;
      currentX.current = dx;
      setOffsetX(dx);
    },
    [],
  );

  const onPointerUp = useCallback(
    (e) => {
      if (activePointer.current !== e.pointerId || axis.current !== "x") {
        resetGesture();
        return;
      }
      resetGesture();

      if (Math.abs(currentX.current) >= SWIPE_THRESHOLD) {
        const dir = currentX.current > 0 ? "like" : "pass";
        setLeaving(true);
        setTimeout(() => {
          dir === "like" ? onLike(product.id) : onPass(product.id);
        }, 350);
      } else {
        setOffsetX(0);
      }
    },
    [product.id, onLike, onPass, resetGesture],
  );

  // The browser fires this when it takes the gesture over for native scrolling.
  const onPointerCancel = useCallback(() => {
    resetGesture();
    setOffsetX(0);
  }, [resetGesture]);

  /* Swallow the click that browsers synthesise at the end of a drag, so
     finishing a swipe never navigates to the product page. */
  const handleCardClick = useCallback(
    (id) => {
      if (Math.abs(currentX.current) > AXIS_LOCK_SLOP) return;
      onCardClick?.(id);
    },
    [onCardClick],
  );

  const triggerLike = useCallback(() => {
    setLeaving(true);
    setOffsetX(400);
    setTimeout(() => onLike(product.id), 350);
  }, [product.id, onLike]);

  return (
    <div
      ref={cardRef}
      className={`${styles.swipeCardWrapper} ${leaving ? styles.swipeLeaving : ""}`}
      style={{
        zIndex,
        transform: `translateX(${offsetX}px) rotate(${rotate}deg)`,
        transition: dragging
          ? "none"
          : "transform 0.35s cubic-bezier(.4,0,.2,1)",
        cursor: isTop ? (dragging ? "grabbing" : "grab") : "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        className={styles.swipeLikeStamp}
        style={{ opacity: likeOp, zIndex: 10 }}
      >
        LIKE 💚
      </div>
      <div
        className={styles.swipePassStamp}
        style={{ opacity: passOp, zIndex: 10 }}
      >
        PASS ✕
      </div>

      <div
        style={{
          pointerEvents: dragging ? "none" : "all",
          width: "100%",
          height: "100%",
        }}
      >
        <ProductCard
          product={product}
          currentUserId={currentUserId}
          onCardClick={onCardClick ? handleCardClick : null}
          onToggleLike={triggerLike}
          onToggleSave={() => onSave(product.id, product.is_saved)}
        />
      </div>
    </div>
  );
});

function UniSwitcher({ current, universities, onSelect, onClose }) {
  const [searchQuery, setSearchQuery] = useState("");

  useBodyScrollLock(true);

  const filteredUniversities = universities.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.domain.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className={styles.uniOverlay} onClick={onClose}>
      <div className={styles.uniModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.uniModalHead}>
          <span className={styles.uniModalTitle}>Switch Campus</span>
          <button className={styles.uniCloseBtn} onClick={onClose}>
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{ padding: "0 1rem 1rem 1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: "#f3f4f6",
              borderRadius: "8px",
              padding: "0.5rem",
            }}
          >
            <Search size={16} color="#6b7280" style={{ marginRight: "8px" }} />
            <input
              type="text"
              placeholder="Search universities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                width: "100%",
                fontSize: "0.9rem",
              }}
            />
          </div>
        </div>

        <div className={styles.uniList}>
          {filteredUniversities.length > 0 ? (
            filteredUniversities.map((u) => (
              <button
                key={u.id}
                className={`${styles.uniItem} ${current.id === u.id ? styles.uniItemActive : ""}`}
                onClick={() => {
                  onSelect(u);
                  onClose();
                }}
              >
                <span
                  className={styles.uniItemDot}
                  style={{
                    background: current.id === u.id ? "var(--purple)" : "#ddd",
                  }}
                />
                <div style={{ textAlign: "left" }}>
                  <div className={styles.uniItemName}>{u.name}</div>
                  <div className={styles.uniItemDomain}>{u.domain}</div>
                </div>
                {current.id === u.id && (
                  <span className={styles.uniItemCheck}>
                    <Check size={16} strokeWidth={2.5} />
                  </span>
                )}
              </button>
            ))
          ) : (
            <div
              style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}
            >
              No campuses found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterSection({ icon, title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={styles.filterSection}>
      <button
        className={styles.filterSectionHead}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.filterSectionIcon}>{icon}</span>
        <span className={styles.filterSectionTitle}>{title}</span>
        <span className={styles.filterChevron}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>
      {open && <div className={styles.filterSectionBody}>{children}</div>}
    </div>
  );
}

export default function Marketplace() {
  const navigate = useNavigate();
  const { logout, sessionReady } = useAuth();
  const [currentUserId] = useState(localStorage.getItem("yahora_user_id"));
  const isDemoUser = localStorage.getItem("yahora_demo_user") === "true";
  const [universities, setUniversities] = useState([]);
  const [university, setUniversity] = useState(null);

  // <-- NEW: State to track the user's home university
  const [homeUniversityId, setHomeUniversityId] = useState(null);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [activeSort, setActiveSort] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUniModal, setShowUniModal] = useState(false);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [swipeDeck, setSwipeDeck] = useState([]);
  const [showDemoAlert, setShowDemoAlert] = useState(false);

  const [selCategories, setSelCategories] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 50000]);
  const [selConditions, setSelConditions] = useState([]);
  const [selPostingDate, setSelPostingDate] = useState("");
  const [showWishlist, setShowWishlist] = useState(false);
  const [showMyListings, setShowMyListings] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Freeze the feed behind the mobile filter drawer while it's open.
  useBodyScrollLock(showMobileFilter);

  /* Reveal the back-to-top affordance once the user is a couple of rows deep.
     Grid view only — swipe view isn't a long scroller. */
  useEffect(() => {
    if (viewMode !== "grid") {
      setShowBackToTop(false);
      return;
    }

    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [viewMode]);

  // Protect marketplace route
  useEffect(() => {
    const userId = localStorage.getItem("yahora_user_id");
    const session = localStorage.getItem("yahora_session");

    if (!userId || !session) {
      navigate("/auth");
    }
  }, [navigate]);

  /* ── 1. Fetch Universities & Restore Last Campus on Mount ── */
  useEffect(() => {
    // For a signed-in student this effect reads `users` directly from Supabase to
    // resolve their home campus, so it has to wait for AuthContext to hand the
    // session to the client — otherwise the query runs as `anon` and, once
    // migration 004 lands, returns nothing and the campus switcher can no longer
    // tell "my campus" from "browse-only". Signed-out visitors never reach that
    // query, so they are not held up.
    if (currentUserId && !sessionReady) return;

    const fetchInitialData = async () => {
      try {
        const uniResponse = await fetch(`${API_BASE_URL}/universities`);
        const uniData = await uniResponse.json();

        if (uniResponse.ok) {
          setUniversities(uniData);

          let targetUniId = sessionStorage.getItem("yahora_last_visited_uni");
          let homeUniId = null;

          if (currentUserId) {
            const { data: userData } = await supabase
              .from("users")
              .select("university_id")
              .eq("id", currentUserId)
              .single();

            if (userData) homeUniId = userData.university_id;
          }

          if (!homeUniId)
            homeUniId = localStorage.getItem("yahora_university_id");

          setHomeUniversityId(homeUniId); // Save home university to state

          if (!targetUniId) targetUniId = homeUniId;
          const defaultUni =
            uniData.find((u) => u.id === targetUniId) || uniData[0];
          setUniversity(defaultUni);
        }
      } catch (error) {
        console.error("Failed to load initial data:", error);
      }
    };
    fetchInitialData();
  }, [currentUserId, sessionReady]);

  /* ── 2. Fetch Products when University changes ── */
  useEffect(() => {
    if (!university) return;

    const fetchMarketplaceFeed = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ university_id: university.id });
        if (currentUserId) params.append("user_id", currentUserId);

        const response = await fetch(`${API_BASE_URL}/products?${params.toString()}`);
        const data = await response.json();

        if (response.ok) {
          setProducts(data.products);
          setSwipeDeck([...data.products].reverse());
        } else {
          console.error("Failed to fetch products:", data.error);
        }
      } catch (error) {
        console.error("Network error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketplaceFeed();
  }, [university, currentUserId]);

  const handleSetUniversity = (u) => {
    // Check if they are in demo mode and trying to leave the demo campus
    if (isDemoUser && homeUniversityId && u.id !== homeUniversityId) {
      setShowDemoAlert(true); // Show the beautiful alert
      return; // Stop them from actually switching
    }
    setUniversity(u);
    sessionStorage.setItem("yahora_last_visited_uni", u.id);
  };

  /* ── Grid Interactions (Optimistic UI) ── */
  const handleToggleGridLike = async (productId, currentLikeState) => {
    if (!currentUserId) return;

    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              is_liked: !currentLikeState,
              likes_count: p.likes_count + (!currentLikeState ? 1 : -1),
            }
          : p,
      ),
    );

    try {
      // 🔒 /like is behind requireAuth (backend §1.6 — docs/CHANGELOG.md
      // 2026-08-23). The actor now comes from this token; the `user_id` in the
      // body is ignored by the backend and kept only to avoid churn.
      const token = localStorage.getItem("yahora_session");

      const res = await fetch(`${API_BASE_URL}/products/${productId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: currentUserId }),
      });

      if (!res.ok) throw new Error(`like ${res.status}`);
    } catch (error) {
      // Roll the optimistic update back. Without this a rejected like stays lit
      // until the next reload, which is the same silent-failure shape that hid
      // the 401 on /messages/history.
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? {
                ...p,
                is_liked: currentLikeState,
                likes_count: p.likes_count + (!currentLikeState ? -1 : 1),
              }
            : p,
        ),
      );
      console.error("Failed to toggle like:", error);
    }
  };

  const handleToggleGridSave = async (productId, currentSaveState) => {
    if (!currentUserId) return;

    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, is_saved: !currentSaveState } : p,
      ),
    );
    setSwipeDeck((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, is_saved: !currentSaveState } : p,
      ),
    );

    try {
      // 🔒 See the note on handleToggleGridLike above.
      const token = localStorage.getItem("yahora_session");

      const res = await fetch(`${API_BASE_URL}/products/${productId}/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ user_id: currentUserId }),
      });

      if (!res.ok) throw new Error(`save ${res.status}`);
    } catch (error) {
      // Roll back both views the optimistic update touched.
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, is_saved: currentSaveState } : p,
        ),
      );
      setSwipeDeck((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, is_saved: currentSaveState } : p,
        ),
      );
      console.error("Failed to toggle save:", error);
    }
  };

  /* ── Swipe Handlers ── */
  const handleSwipeLike = useCallback(
    async (id) => {
      const swiped = swipeDeck.find((p) => p.id === id);
      setSwipeDeck((prev) => prev.filter((p) => p.id !== id));
      if (!currentUserId) return;

      /* /like is a TOGGLE on the backend, but a right-swipe always means "like".
         Firing it on an already-liked item would silently un-like it, so skip
         the request when the item is already liked. */
      if (swiped?.is_liked) return;

      // Optimistically reflect the like in the grid view too.
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, is_liked: true, likes_count: (p.likes_count || 0) + 1 }
            : p,
        ),
      );

      try {
        // 🔒 See the note on handleToggleGridLike above. The `!res.ok`
        // reconciliation below already existed and now actually fires on a
        // rejected like instead of every like silently 401ing.
        const token = localStorage.getItem("yahora_session");

        const res = await fetch(`${API_BASE_URL}/products/${id}/like`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ user_id: currentUserId }),
        });
        const data = await res.json().catch(() => ({}));

        // Reconcile with the server's authoritative is_liked.
        if (!res.ok || data.is_liked === false) {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === id
                ? {
                    ...p,
                    is_liked: false,
                    likes_count: Math.max(0, (p.likes_count || 1) - 1),
                  }
                : p,
            ),
          );
        }
      } catch (error) {
        console.error("Failed to register swipe like:", error);
        setProducts((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  is_liked: false,
                  likes_count: Math.max(0, (p.likes_count || 1) - 1),
                }
              : p,
          ),
        );
      }
    },
    [currentUserId, swipeDeck],
  );

  const handleSwipePass = useCallback((id) => {
    setSwipeDeck((prev) => prev.filter((p) => p.id !== id));
  }, []);

  /* ── Filtering Logic ── */
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (selCategories.length) n++;
    if (selConditions.length) n++;
    if (selPostingDate) n++;
    if (priceRange[0] > 0 || priceRange[1] < 50000) n++;
    if (showWishlist) n++;
    if (showMyListings) n++;
    return n;
  }, [
    selCategories,
    selConditions,
    selPostingDate,
    priceRange,
    showWishlist,
    showMyListings,
  ]);

  const clearFilters = useCallback(() => {
    setSelCategories([]);
    setPriceRange([0, 50000]);
    setSelConditions([]);
    setSelPostingDate("");
    setShowWishlist(false);
    setShowMyListings(false);
  }, []);

  const toggleCategory = useCallback(
    (id) =>
      setSelCategories((prev) =>
        prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
      ),
    [],
  );
  const toggleCondition = useCallback(
    (c) =>
      setSelConditions((prev) =>
        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
      ),
    [],
  );

  const isWithinPostingDate = useCallback((isoDate, key) => {
    if (!key) return true;
    const diff = Date.now() - new Date(isoDate).getTime();
    if (key === "today") return diff < 86400000;
    if (key === "week") return diff < 86400000 * 7;
    if (key === "month") return diff < 86400000 * 30;
    if (key === "older") return diff >= 86400000 * 30;
    return true;
  }, []);

  const displayProducts = useMemo(() => {
    let list = products.filter((p) => p.status !== "sold");

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }

    if (selCategories.length)
      list = list.filter((p) => selCategories.includes(p.category));
    list = list.filter((p) => {
      const meetsMin = p.price >= priceRange[0];
      // If the max slider is at 50000, treat it as infinity (no upper limit)
      const meetsMax = priceRange[1] >= 50000 ? true : p.price <= priceRange[1];
      return meetsMin && meetsMax;
    });
    if (selConditions.length)
      list = list.filter((p) => selConditions.includes(p.condition));
    if (selPostingDate)
      list = list.filter((p) =>
        isWithinPostingDate(p.created_at, selPostingDate),
      );
    if (showWishlist) list = list.filter((p) => p.is_saved);
    if (showMyListings)
      list = list.filter((p) => p.seller?.id === currentUserId);

    if (activeSort === "newest")
      list = [...list].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
    if (activeSort === "lowest_price")
      list = [...list].sort((a, b) => a.price - b.price);
    if (activeSort === "trending")
      list = [...list].sort(
        (a, b) => b.likes_count + b.views - (a.likes_count + a.views),
      );

    return list;
  }, [
    products,
    searchQuery,
    selCategories,
    priceRange,
    selConditions,
    selPostingDate,
    showWishlist,
    showMyListings,
    activeSort,
    currentUserId,
    isWithinPostingDate,
  ]);

  if (!university) {
    return (
      <div
        className={styles.loadingScreen}
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "calc(100dvh - var(--app-chrome))",
        }}
      >
        <p>Loading Campus Ecosystem...</p>
      </div>
    );
  }

  // <-- NEW: Check if the user is currently viewing a foreign campus
  const isForeignCampus =
    homeUniversityId && university.id !== homeUniversityId;

  const isHomeCampus = homeUniversityId && university.id === homeUniversityId;

  const SidebarContent = (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarUni}>
        <span className={styles.sidebarUniBrand}>Yahora</span>
        <span className={styles.sidebarUniSep}>—</span>
        <span className={styles.sidebarUniName}>{university.name}</span>
        <button
          className={styles.sidebarUniSwitch}
          onClick={() => setShowUniModal(true)}
          title="Switch campus"
        >
          <ArrowRightLeft size={16} />
        </button>
      </div>

      <div className={styles.filterList}>
        <FilterSection icon={<Tag size={16} />} title="Categories">
          <div className={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`${styles.categoryChip} ${selCategories.includes(cat.id) ? styles.categoryChipActive : ""}`}
                onClick={() => toggleCategory(cat.id)}
              >
                <span className={styles.categoryIcon}>{cat.icon}</span>
                <span className={styles.categoryLabel}>{cat.label}</span>
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection icon={<Banknote size={16} />} title="Price Range">
          <div className={styles.priceRangeWrap}>
            <div className={styles.priceRangeLabels}>
              <span>₹{priceRange[0].toLocaleString("en-IN")}</span>
              {/* Show a '+' sign if the slider is at max capacity */}
              <span>
                {priceRange[1] >= 50000
                  ? "₹50,000+"
                  : `₹${priceRange[1].toLocaleString("en-IN")}`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="50000"
              step="500"
              value={priceRange[0]}
              className={styles.rangeInput}
              onChange={(e) => setPriceRange([+e.target.value, priceRange[1]])}
            />
            <input
              type="range"
              min="0"
              max="50000"
              step="500"
              value={priceRange[1]}
              className={styles.rangeInput}
              onChange={(e) => setPriceRange([priceRange[0], +e.target.value])}
            />
          </div>
        </FilterSection>

        <FilterSection icon={<Star size={16} />} title="Item Condition">
          <div className={styles.conditionList}>
            {CONDITIONS.map((c) => (
              <button
                key={c}
                className={`${styles.conditionChip} ${selConditions.includes(c) ? styles.conditionChipActive : ""}`}
                onClick={() => toggleCondition(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </FilterSection>

        <FilterSection icon={<Heart size={16} />} title="My Wishlist">
          <button
            className={`${styles.toggleFilter} ${showWishlist ? styles.toggleFilterActive : ""}`}
            onClick={() => {
              const next = !showWishlist;
              setShowWishlist(next);
              /* The swipe deck is built from the raw feed and ignores filters,
                 so turning this on there would look like nothing happened.
                 Hand the user to the grid, which does honour it. */
              if (next && viewMode === "swipe") setViewMode("grid");
              setShowMobileFilter(false);
            }}
          >
            {showWishlist ? "✓ Showing saved items" : "Show my saved items"}
          </button>
        </FilterSection>

        <FilterSection icon={<Calendar size={16} />} title="Posting Date">
          <div className={styles.dateList}>
            {POSTING_DATE_OPTIONS.map((d) => (
              <button
                key={d.key}
                className={`${styles.dateChip} ${selPostingDate === d.key ? styles.dateChipActive : ""}`}
                onClick={() =>
                  setSelPostingDate((prev) => (prev === d.key ? "" : d.key))
                }
              >
                {d.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {isHomeCampus && (
          <FilterSection icon={<List size={16} />} title="My Listings">
            <button
              className={`${styles.toggleFilter} ${showMyListings ? styles.toggleFilterActive : ""}`}
              onClick={() => setShowMyListings((v) => !v)}
            >
              {showMyListings
                ? "✓ Showing my listings"
                : "Show only my listings"}
            </button>
          </FilterSection>
        )}
      </div>

      {/* <-- NEW: Conditional Disclaimer vs "List New Item" Card */}
      {isForeignCampus ? (
        <div className={styles.visitorDisclaimer}>
          <div className={styles.disclaimerIcon}>
            <Globe2 size={20} />
          </div>
          <div className={styles.disclaimerTitle}>Exploring Another Campus</div>
          <div className={styles.disclaimerText}>
            Browse, like, and save freely. Buying and selling are reserved for
            your home campus.
          </div>
        </div>
      ) : (
        <div
          className={styles.listNewCard}
          onClick={() => {
            navigate("/sell");
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
          }}
        >
          <button className={styles.listNewIcon}>
            <Plus size={16} strokeWidth={2.5} />
          </button>
          <div className={styles.listNewTitle}>List New Item</div>
          <div className={styles.listNewSub}>Earn some campus cash</div>
        </div>
      )}

      {activeFilterCount > 0 && (
        <button className={styles.clearBtn} onClick={clearFilters}>
          <X size={14} /> Clear All Filters{" "}
          <span className={styles.clearBadge}>{activeFilterCount}</span>
        </button>
      )}
    </aside>
  );

  return (
    <div className={styles.root}>
      {/* <-- NEW: Hide FAB if on a foreign campus */}
      {!isForeignCampus && (
        <div style={{ position: "fixed", bottom: 32, right: 32, zIndex: 100 }}>
          <button
            className={`${styles.fab} ${styles.fabEnter}`}
            title="List a new item"
            onClick={() => {
              navigate("/sell");
              window.scrollTo({ top: 0, left: 0, behavior: "instant" });
            }}
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <button
        className={`${styles.backToTop} ${showBackToTop ? styles.backToTopVisible : ""}`}
        onClick={() =>
          window.scrollTo({
            top: 0,
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "auto"
              : "smooth",
          })
        }
        aria-label="Back to top of feed"
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
      >
        <ChevronUp size={20} strokeWidth={2.5} />
      </button>

      {showUniModal && (
        <UniSwitcher
          current={university}
          universities={universities}
          onSelect={handleSetUniversity}
          onClose={() => setShowUniModal(false)}
        />
      )}

      {showDemoAlert && (
        <div className={styles.demoAlertOverlay} onClick={() => setShowDemoAlert(false)}>
          <div className={styles.demoAlertBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.demoAlertIconWrap}>
              <Globe2 size={32} color="var(--purple)" />
            </div>
            <h3 className={styles.demoAlertTitle}>Unlock All Campuses</h3>
            <p className={styles.demoAlertText}>
              You are currently exploring the Interactive Sandbox. To view real listings from other universities like IIITDM Kurnool or NIET, please create a verified student account.
            </p>
            <div className={styles.demoAlertActions}>
              <button className={styles.demoAlertBtnCancel} onClick={() => setShowDemoAlert(false)}>
                Stay in Sandbox
              </button>
              <button 
                className={styles.demoAlertBtnPrimary} 
                onClick={() => {
                  // Must be logout(), not a hand-rolled localStorage clear:
                  // only logout() flips AuthContext's isAuthenticated, and the
                  // GuestOnly guard on /auth reads that flag. Clearing the keys
                  // directly leaves the context believing we're still signed in,
                  // which bounces this button straight back to the home page.
                  logout();
                  navigate("/auth");
                }}
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.sidebarWrap}>{SidebarContent}</div>

      {showMobileFilter && (
        <div
          className={styles.mobileDrawerOverlay}
          onClick={() => setShowMobileFilter(false)}
        >
          <div
            className={styles.mobileDrawer}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.mobileDrawerHandle} />
            <div className={styles.mobileDrawerHeader}>
              <span className={styles.mobileDrawerTitle}>Filters</span>
              <button
                className={styles.mobileDrawerClose}
                onClick={() => setShowMobileFilter(false)}
                aria-label="Close filters"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>
            {SidebarContent}
          </div>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.topBar}>
          <div
            className={`${styles.searchWrap} ${searchQuery ? styles.searchWrapFilled : ""}`}
          >
            <span className={styles.searchIcon} aria-hidden="true">
              <Search size={18} />
            </span>
            <input
              type="search"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              aria-label="Search listings"
            />
            {searchQuery && (
              <button
                className={styles.searchClear}
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className={styles.sortGroup}>
            <span className={styles.sortLabel}>Sort by:</span>
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.key}
                className={`${styles.sortBtn} ${activeSort === s.key ? styles.sortBtnActive : ""}`}
                onClick={() => setActiveSort(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid size={16} /> <span>Grid</span>
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === "swipe" ? styles.viewBtnActive : ""}`}
              onClick={() => setViewMode("swipe")}
            >
              <Layers size={16} /> <span>Swipe</span>
            </button>
          </div>

          <button
            className={styles.mobileFilterBtn}
            onClick={() => setShowMobileFilter(true)}
          >
            <SlidersHorizontal size={20} />
            {activeFilterCount > 0 && (
              <span className={styles.mobileFilterBadge}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {viewMode === "grid" && (
          <>
            {loading ? (
              <div className={styles.grid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : displayProducts.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <ShoppingBag size={56} strokeWidth={1.5} color="#d0d0d0" />
                </div>
                <h3 className={styles.emptyTitle}>
                  {searchQuery
                    ? `No results for "${searchQuery}"`
                    : showWishlist
                      ? "Your wishlist is empty"
                      : `No items listed in ${university.name} right now`}
                </h3>
                <p className={styles.emptyDesc}>
                  {showWishlist
                    ? "Explore the marketplace and save items you love."
                    : "Be the first to list something! Your campus is waiting."}
                </p>
                <div className={styles.emptyActions}>
                  {activeFilterCount > 0 && (
                    <button
                      className={styles.emptyBtnSecondary}
                      onClick={clearFilters}
                    >
                      Clear filters
                    </button>
                  )}

                  {/* <-- NEW: Hide "List an item" button in empty state if on foreign campus */}
                  {!isForeignCampus && (
                    <button
                      className={styles.emptyBtnPrimary}
                      onClick={() => navigate("/sell")}
                    >
                      <Plus size={16} /> List an item
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.grid}>
                {displayProducts.map((product, i) => (
                  <div
                    key={product.id}
                    className={styles.gridItem}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <ProductCard
                      product={product}
                      currentUserId={currentUserId}
                      onCardClick={(id) => navigate(`/product/${id}`)}
                      onToggleLike={() =>
                        handleToggleGridLike(product.id, product.is_liked)
                      }
                      onToggleSave={() =>
                        handleToggleGridSave(product.id, product.is_saved)
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {viewMode === "swipe" && (
          <div className={styles.swipeViewWrap}>
            {loading ? (
              <div className={styles.swipeLoading}>
                <div className={styles.swipeSkeletonCard} />
                <p>Loading items…</p>
              </div>
            ) : swipeDeck.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>
                  <PartyPopper size={56} strokeWidth={1.5} color="#d0d0d0" />
                </div>
                <h3 className={styles.emptyTitle}>You've seen everything!</h3>
                <p className={styles.emptyDesc}>
                  Check back later for new listings, or browse in Grid mode.
                </p>
                <div className={styles.emptyActions}>
                  <button
                    className={styles.emptyBtnSecondary}
                    onClick={() => setViewMode("grid")}
                  >
                    Switch to Grid
                  </button>
                  <button
                    className={styles.emptyBtnPrimary}
                    onClick={() => setSwipeDeck([...displayProducts].reverse())}
                  >
                    See again
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.swipeDeck}>
                  {swipeDeck.slice(-3).map((product, i, arr) => (
                    <SwipeCard
                      key={product.id}
                      product={product}
                      isTop={i === arr.length - 1}
                      zIndex={i + 1}
                      onLike={handleSwipeLike}
                      onPass={handleSwipePass}
                      onSave={handleToggleGridSave}
                      onCardClick={(id) => navigate(`/product/${id}`)}
                      currentUserId={currentUserId}
                    />
                  ))}
                </div>
                <p className={styles.swipeCounter}>
                  {swipeDeck.length} item{swipeDeck.length !== 1 ? "s" : ""}{" "}
                  remaining
                </p>
                <p className={styles.swipeHint}>
                  Swipe <span style={{ color: "#4ade80" }}>Right to like</span>{" "}
                  · <span style={{ color: "#f87171" }}>Left to pass</span>
                </p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
