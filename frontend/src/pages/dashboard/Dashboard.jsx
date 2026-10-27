// frontend/src/pages/dashboard/Dashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, Trash2, UserX } from "lucide-react";
import styles from "./Dashboard.module.css";
import ProductCard from "../../components/ProductCard/ProductCard";
import SmartImage from "../../components/SmartImage/SmartImage";
import cardStyles from "../../components/ProductCard/ProductCard.module.css";
import { PROFILE_UPDATED_EVENT } from "../../components/navbar/navbar";
import { API_BASE_URL } from '../../config/urls';
import { useHistoryEntryState } from "../../hooks/useScrollRestoration";
import BuyerPicker from "../../components/BuyerPicker/BuyerPicker";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
// Renamed: the component has its own `firstName` (the greeting's), which
// shadowed the helper and made the Relist dialog call a string.
import { firstName as getFirstName } from "../../utils/messageActions";
import { formatShortDate } from "../../utils/messageFormat";

/* ─────────────────────────────────────────────
 CONSTANTS
───────────────────────────────────────────── */
const STATUS_CONFIG = {
 available: { label: "ACTIVE", bg: "#1a1a2e", color: "#4ade80" },
 pending: { label: "PENDING", bg: "#1a1a2e", color: "#facc15" },
 sold: { label: "SOLD", bg: "#1a1a2e", color: "#f87171" },
};

const fmt = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

/* ─────────────────────────────────────────────
 ICONS
───────────────────────────────────────────── */
const HeartIcon = ({ size = 18, fill = "none", stroke = "currentColor" }) => (
 <svg
   width={size}
   height={size}
   viewBox="0 0 24 24"
   fill={fill}
   stroke={stroke}
   strokeWidth="2.5"
   strokeLinecap="round"
   strokeLinejoin="round"
 >
   <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
 </svg>
);

const PenIcon = ({ size = 16 }) => (
 <svg
   width={size}
   height={size}
   viewBox="0 0 24 24"
   fill="none"
   stroke="currentColor"
   strokeWidth="2.5"
   strokeLinecap="round"
   strokeLinejoin="round"
 >
   <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
   <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
 </svg>
);

const BellIcon = ({ size = 18 }) => (
 <svg
   width={size}
   height={size}
   viewBox="0 0 24 24"
   fill="none"
   stroke="currentColor"
   strokeWidth="2"
   strokeLinecap="round"
   strokeLinejoin="round"
 >
   <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
   <path d="M13.73 21a2 2 0 0 1-3.46 0" />
 </svg>
);

const GearIcon = ({ size = 18 }) => (
 <svg
   width={size}
   height={size}
   viewBox="0 0 24 24"
   fill="none"
   stroke="currentColor"
   strokeWidth="2"
   strokeLinecap="round"
   strokeLinejoin="round"
 >
   <circle cx="12" cy="12" r="3" />
   <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
 </svg>
);

const PlusIcon = ({ size = 20 }) => (
 <svg
   width={size}
   height={size}
   viewBox="0 0 24 24"
   fill="none"
   stroke="currentColor"
   strokeWidth="2.5"
   strokeLinecap="round"
 >
   <line x1="12" y1="5" x2="12" y2="19" />
   <line x1="5" y1="12" x2="19" y2="12" />
 </svg>
);

const CheckIcon = ({ size = 14 }) => (
 <svg
   width={size}
   height={size}
   viewBox="0 0 24 24"
   fill="none"
   stroke="currentColor"
   strokeWidth="2.5"
   strokeLinecap="round"
   strokeLinejoin="round"
 >
   <polyline points="20 6 9 17 4 12" />
 </svg>
);

const XIcon = ({ size = 14 }) => (
 <svg
   width={size}
   height={size}
   viewBox="0 0 24 24"
   fill="none"
   stroke="currentColor"
   strokeWidth="2.5"
   strokeLinecap="round"
 >
   <line x1="18" y1="6" x2="6" y2="18" />
   <line x1="6" y1="6" x2="18" y2="18" />
 </svg>
);


/* ─────────────────────────────────────────────
 SUB-COMPONENTS
───────────────────────────────────────────── */
function Avatar({
 src,
 name,
 size,
 editable,
 onUpload,
 onRemove,
 isUploading,
 onImageClick // Added for image zoom
}) {
 const [showMenu, setShowMenu] = useState(false);
 const editRef = useRef(null);
 const menuRef = useRef(null);

 // The menu closes on a press anywhere outside it and the pencil (the pencil
 // toggles it itself), and on Escape — not only by picking an option.
 useEffect(() => {
   if (!showMenu) return;
   const onPointerDown = (e) => {
     if (editRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
     setShowMenu(false);
   };
   const onKeyDown = (e) => {
     if (e.key === "Escape") setShowMenu(false);
   };
   document.addEventListener("pointerdown", onPointerDown);
   document.addEventListener("keydown", onKeyDown);
   return () => {
     document.removeEventListener("pointerdown", onPointerDown);
     document.removeEventListener("keydown", onKeyDown);
   };
 }, [showMenu]);

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
       onClick={onImageClick}
       style={{ cursor: onImageClick ? "pointer" : "default" }}
     >
       {isUploading ? (
         <div
           className={styles.avatarPlaceholder}
           style={{ background: "#eee", color: "#888", fontSize: "14px" }}
         >
           Wait...
         </div>
       ) : src ? (
         <SmartImage src={src} alt="avatar" className={styles.avatarImg} />
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
     {editable && !isUploading && (
       <>
         <button
           ref={editRef}
           className={styles.avatarEdit}
           onClick={() => setShowMenu(!showMenu)}
           title="Change photo"
         >
           <PenIcon size={14} />
         </button>
         {showMenu && (
           <div ref={menuRef} className={styles.avatarMenu}>
             <button
               onClick={() => {
                 onUpload();
                 setShowMenu(false);
               }}
             >
               Upload New
             </button>
             {src && (
               <button
                 onClick={() => {
                   onRemove();
                   setShowMenu(false);
                 }}
                 className={styles.dangerText}
               >
                 Remove Photo
               </button>
             )}
           </div>
         )}
       </>
     )}
   </div>
 );
}

function EditableField({ label, value, onSave, textarea, placeholder }) {
 const [editing, setEditing] = useState(false);
 const [draft, setDraft] = useState(value || "");
 const save = () => {
   onSave(draft);
   setEditing(false);
 };
 const cancel = () => {
   setDraft(value || "");
   setEditing(false);
 };
 return (
   <div className={styles.ef}>
     {label && <div className={styles.efLabel}>{label}</div>}
     {editing ? (
       <div className={styles.efEdit}>
         {textarea ? (
           <textarea
             className={styles.efInput}
             value={draft}
             onChange={(e) => setDraft(e.target.value)}
             placeholder={placeholder}
             rows={3}
           />
         ) : (
           <input
             className={styles.efInput}
             value={draft}
             onChange={(e) => setDraft(e.target.value)}
             placeholder={placeholder}
           />
         )}
         <div className={styles.efActions}>
           <button
             className={`${styles.efBtn} ${styles.efBtnSave}`}
             onClick={save}
           >
             <CheckIcon />
           </button>
           <button
             className={`${styles.efBtn} ${styles.efBtnCancel}`}
             onClick={cancel}
           >
             <XIcon />
           </button>
         </div>
       </div>
     ) : (
       <div className={styles.efDisplay}>
         <span className={styles.efValue}>
           {value || <em style={{ color: "#aaa" }}>Not set</em>}
         </span>
         <button className={styles.efTrigger} onClick={() => setEditing(true)}>
           <PenIcon size={13} />
         </button>
       </div>
     )}
   </div>
 );
}

/* A Bought Items card. Drawn with ProductCard's own styles (card, the square
   photo frame, price, title) so it matches the My Items cards at every width,
   without ProductCard's owner and like/save controls — a purchase has none.
   Until Block N-H it used class names this file never defined, so the photo
   rendered at its natural size. Then MARK_SOLD_SPEC §4: who sold it to you
   and when it was marked sold, and "That wasn't me". */
function PurchaseCard({ item, onOpen, onRemove }) {
 const p = item.product;
 const imageUrl =
   p.image_urls?.[0] || "https://via.placeholder.com/600x400?text=No+Image";
 const sellerName =
   p.seller?.full_name ||
   (p.seller?.username ? `@${p.seller.username}` : "a Yahora student");
 return (
   <article
     className={cardStyles.card}
     onClick={() => onOpen(p.id)}
     style={{ cursor: "pointer" }}
   >
     <div className={cardStyles.imageWrap}>
       <SmartImage
         src={imageUrl}
         alt={p.title}
         className={cardStyles.image}
         loading="lazy"
         draggable={false}
         onError={(e) => {
           // As on ProductCard: a broken photo shows the grey frame instead.
           e.currentTarget.style.visibility = "hidden";
         }}
       />
     </div>
     <div className={cardStyles.infoWrap}>
       <div className={cardStyles.metaRow}>
         <span />
         <span className={cardStyles.price}>{fmt(p.price)}</span>
       </div>
       <h3 className={cardStyles.title}>{p.title}</h3>
       <p className={styles.purchaseFrom}>
         From {sellerName} · {formatShortDate(p.sold_at || item.created_at)}
       </p>
       <button
         type="button"
         className={styles.purchaseRemoveBtn}
         onClick={(e) => {
           e.stopPropagation();
           onRemove(item);
         }}
       >
         <UserX size={14} aria-hidden="true" />
         That wasn't me
       </button>
     </div>
   </article>
 );
}

/* ─────────────────────────────────────────────
 MAIN DASHBOARD COMPONENT
───────────────────────────────────────────── */

export default function Dashboard() {
 const navigate = useNavigate();

 const [data, setData] = useState(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 // Per history entry, like isDashboard below: Back from a listing returns to
 // the same tab and view (see useHistoryEntryState).
 const [tab, setTab] = useHistoryEntryState("tab", "listings");

 const fileInputRef = React.useRef(null);
 const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

 /* The listing in the Delete dialog (the whole row: the dialog shows its
    photo and title, like the app's). */
 const [itemToDelete, setItemToDelete] = useState(null);
 const [isDeleting, setIsDeleting] = useState(false);
 const [deleteError, setDeleteError] = useState(null);

 /* MARK_SOLD_SPEC §1 and §3. `buyerPicker`: the open "Who bought it?" —
    { product, mode: "sell" | "change", initialBuyerId }. `relistTarget`: the
    sold listing in the Relist dialog. */
 const [buyerPicker, setBuyerPicker] = useState(null);
 const [relistTarget, setRelistTarget] = useState(null);
 /* MARK_SOLD_SPEC §4: the purchase in the "That wasn't me" dialog. */
 const [purchaseToRemove, setPurchaseToRemove] = useState(null);
 const [isRemovingPurchase, setIsRemovingPurchase] = useState(false);
 const [removePurchaseError, setRemovePurchaseError] = useState(null);

 const [isDashboard, setIsDashboard] = useHistoryEntryState("isDashboard", false);

 // Mobile shows one continuous scrollable page (no UI1↔UI2 animated
 // switch). Desktop behavior is left completely unchanged.
 const [isMobile, setIsMobile] = useState(
   typeof window !== "undefined"
     ? window.matchMedia("(max-width: 600px)").matches
     : false,
 );

 // Ref to the dashboard/split section — used to scroll to it on mobile.
 const dashViewRef = React.useRef(null);

 // Image Zoom Modal State
 const [isImageModalOpen, setIsImageModalOpen] = useState(false);

 /* ── Avatar Upload Logic ── */
 const handleAvatarEditClick = () => {
   fileInputRef.current?.click();
 };

 const handleFileChange = async (event) => {
   const file = event.target.files[0];
   if (!file) return;

   setIsUploadingAvatar(true);
   const formData = new FormData();
   formData.append("avatar", file);

   try {
     const userId = localStorage.getItem("yahora_user_id");
     const token = localStorage.getItem("yahora_session");
     if (!userId || !token) return;

     const res = await fetch(
       `${API_BASE_URL}/user/${userId}/avatar`,
       {
         method: "POST",
         headers: { Authorization: `Bearer ${token}` },
         body: formData,
       },
     );

     if (!res.ok) throw new Error("Failed to upload avatar");

     const responseData = await res.json();

     setData((prev) => ({
       ...prev,
       profile: { ...prev.profile, avatar_url: responseData.avatar_url },
     }));
     // Keep the navbar avatar in sync without a page refresh.
     window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
   } catch (e) {
     console.error("Failed to upload avatar:", e);
     alert("Failed to update profile photo.");
   } finally {
     setIsUploadingAvatar(false);
     if (fileInputRef.current) fileInputRef.current.value = "";
   }
 };

 /* ── Fetch ── */
 useEffect(() => {
   const fetchDashboard = async () => {
     try {
       const userId = localStorage.getItem("yahora_user_id");
       const token = localStorage.getItem("yahora_session");
       if (!userId || !token) {
         navigate("/auth");
         return;
       }

       const res = await fetch(
         `${API_BASE_URL}/user/${userId}/dashboard`,
         {
           headers: { Authorization: `Bearer ${token}` },
         },
       );
       if (!res.ok) throw new Error("Failed to fetch dashboard data");
       setData(await res.json());
     } catch (err) {
       console.error("Dashboard fetch failed:", err);
       setError("Could not load dashboard. Please try refreshing.");
     } finally {
       setLoading(false);
     }
   };
   fetchDashboard();
 }, [navigate]);

 /* ── Track viewport: mobile vs desktop ── */
 useEffect(() => {
   const mq = window.matchMedia("(max-width: 600px)");
   const handler = (e) => setIsMobile(e.matches);
   mq.addEventListener("change", handler);
   return () => mq.removeEventListener("change", handler);
 }, []);

 /* ── Smooth Scroll Intent Logic (Desktop only) ── */
 useEffect(() => {
   // On mobile it's one continuous scroll page — don't hijack scrolling.
   if (isMobile) return;

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
 }, [isDashboard, isMobile]);

 /* ── Profile field update ── */
 const updateField = useCallback(async (field, value) => {
   setData((prev) => ({
     ...prev,
     profile: { ...prev.profile, [field]: value },
   }));
   try {
     const userId = localStorage.getItem("yahora_user_id");
     const token = localStorage.getItem("yahora_session");
     if (!userId || !token) return;
     await fetch(
       `${API_BASE_URL}/user/${userId}/profile`,
       {
         method: "PUT",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${token}`,
         },
         body: JSON.stringify({ [field]: value }),
       },
     );
     // The navbar shows initials from the name — keep it in sync live.
     if (field === "full_name") {
       window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
     }
   } catch (e) {
     console.error("Failed to update profile field:", e);
   }
 }, []);

 /* ── Avatar Menu Actions ── */
 const handleRemoveAvatar = async () => {
   setData((prev) => ({
     ...prev,
     profile: { ...prev.profile, avatar_url: null },
   }));
   try {
     const userId = localStorage.getItem("yahora_user_id");
     const token = localStorage.getItem("yahora_session");
     await fetch(
       `${API_BASE_URL}/user/${userId}/profile`,
       {
         method: "PUT",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${token}`,
         },
         body: JSON.stringify({ avatar_url: null }),
       },
     );
     // Revert the navbar avatar to initials without a page refresh.
     window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
   } catch (e) {
     console.error("Failed to remove avatar:", e);
   }
 };

 /* ── Dashboard Product Card Actions ── */

 /* The picker saved (POST /sold returned 200): the card shows SOLD, the
    buyer and the date at once. The first sold_at is kept on a Change buyer,
    and the server's row says so. */
 const handleBuyerSaved = useCallback((row, buyer) => {
   setData((prev) => ({
     ...prev,
     listings: prev.listings.map((p) =>
       p.id === row.id || p.id === buyerPicker?.product.id
         ? {
             ...p,
             status: "sold",
             sold_at: row.sold_at ?? p.sold_at ?? new Date().toISOString(),
             buyer: buyer
               ? {
                   id: buyer.id,
                   username: buyer.username,
                   full_name: buyer.full_name,
                   avatar_url: buyer.avatar_url,
                 }
               : null,
           }
         : p,
     ),
   }));
   setBuyerPicker(null);
 }, [buyerPicker]);

 const closeBuyerPicker = useCallback(() => setBuyerPicker(null), []);

 /* "That wasn't me" (§4): DELETE /api/products/:id/purchase. The listing
    stays sold for the seller, with no buyer; here the card leaves the list.
    PURCHASE_NOT_FOUND means it is already gone (a retry), so that counts as
    done too. */
 const executeRemovePurchase = async () => {
   const item = purchaseToRemove;
   if (!item || isRemovingPurchase) return;
   setIsRemovingPurchase(true);
   setRemovePurchaseError(null);
   try {
     const token = localStorage.getItem("yahora_session");
     const res = await fetch(
       `${API_BASE_URL}/products/${item.product.id}/purchase`,
       { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
     );
     const body = await res.json().catch(() => ({}));
     if (!res.ok && body?.error !== "PURCHASE_NOT_FOUND") {
       throw new Error(body?.error || `purchase ${res.status}`);
     }
     setData((prev) => ({
       ...prev,
       purchases: prev.purchases.filter((p) => p.id !== item.id),
     }));
     setPurchaseToRemove(null);
   } catch (e) {
     console.error("Failed to remove purchase:", e);
     setRemovePurchaseError("Couldn't remove it. Check your connection and try again.");
   } finally {
     setIsRemovingPurchase(false);
   }
 };

 const closeRemovePurchase = () => {
   if (isRemovingPurchase) return;
   setPurchaseToRemove(null);
   setRemovePurchaseError(null);
 };

 const executeMarkAvailable = async (productId) => {
   // Optimistic UI update
   setData((prev) => ({
     ...prev,
     listings: prev.listings.map((p) =>
       // Relisting removes the buyer and sold_at too (POST /available).
       p.id === productId
         ? { ...p, status: "available", sold_at: null, buyer: null }
         : p,
     ),
   }));

   try {
     const token = localStorage.getItem("yahora_session");
     await fetch(
       `${API_BASE_URL}/products/${productId}/available`,
       {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           Authorization: `Bearer ${token}`,
         },
       },
     );
   } catch (e) {
     console.error("Failed to mark as available:", e);
   }
 };

 const handleToggleGridLike = async (productId, currentLikeState) => {
   const userId = localStorage.getItem("yahora_user_id");
   if (!userId) return;
   setData((prev) => ({
     ...prev,
     listings: prev.listings.map((p) =>
       p.id === productId
         ? {
             ...p,
             is_liked: !currentLikeState,
             likes_count: (p.likes_count || 0) + (!currentLikeState ? 1 : -1),
           }
         : p,
     ),
   }));
   try {
     // 🔒 /like is behind requireAuth (backend §1.6 — docs/CHANGELOG.md
     // 2026-08-23). The actor now comes from this token; the `user_id` in the
     // body is ignored by the backend and kept only to avoid churn.
     const token = localStorage.getItem("yahora_session");

     const res = await fetch(
       `${API_BASE_URL}/products/${productId}/like`,
       {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           ...(token ? { Authorization: `Bearer ${token}` } : {}),
         },
         body: JSON.stringify({ user_id: userId }),
       },
     );

     if (!res.ok) throw new Error(`like ${res.status}`);
   } catch (e) {
     // Roll the optimistic update back. This catch used to be empty, so a
     // rejected like stayed lit until the next reload with nothing logged.
     setData((prev) => ({
       ...prev,
       listings: prev.listings.map((p) =>
         p.id === productId
           ? {
               ...p,
               is_liked: currentLikeState,
               likes_count: (p.likes_count || 0) + (!currentLikeState ? -1 : 1),
             }
           : p,
       ),
     }));
     console.error("Failed to toggle like:", e);
   }
 };

 const handleToggleGridSave = async (productId, currentSaveState) => {
   const userId = localStorage.getItem("yahora_user_id");
   if (!userId) return;
   setData((prev) => ({
     ...prev,
     listings: prev.listings.map((p) =>
       p.id === productId ? { ...p, is_saved: !currentSaveState } : p,
     ),
   }));
   try {
     // 🔒 See the note on handleToggleGridLike above.
     const token = localStorage.getItem("yahora_session");

     const res = await fetch(
       `${API_BASE_URL}/products/${productId}/save`,
       {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           ...(token ? { Authorization: `Bearer ${token}` } : {}),
         },
         body: JSON.stringify({ user_id: userId }),
       },
     );

     if (!res.ok) throw new Error(`save ${res.status}`);
   } catch (e) {
     setData((prev) => ({
       ...prev,
       listings: prev.listings.map((p) =>
         p.id === productId ? { ...p, is_saved: currentSaveState } : p,
       ),
     }));
     console.error("Failed to toggle save:", e);
   }
 };

 /* ── Product Management Logic ── */
 const confirmDelete = (item) => {
   setDeleteError(null);
   setItemToDelete(item);
 };

 const closeDelete = () => {
   if (isDeleting) return;
   setItemToDelete(null);
   setDeleteError(null);
 };

 const executeDelete = async () => {
   if (!itemToDelete) return;
   const productId = itemToDelete.id;
   setIsDeleting(true);
   setDeleteError(null);

   try {
     const token = localStorage.getItem("yahora_session");
     const res = await fetch(
       `${API_BASE_URL}/products/${productId}`,
       {
         method: "DELETE",
         headers: { Authorization: `Bearer ${token}` },
       },
     );

     if (!res.ok) throw new Error("Failed to delete product");

     setData((prev) => ({
       ...prev,
       listings: prev.listings.filter((item) => item.id !== productId),
     }));
     setItemToDelete(null);
   } catch (e) {
     console.error("Failed to delete listing:", e);
     // In the dialog, like "That wasn't me", not the browser's alert().
     setDeleteError("Couldn't delete it. Check your connection and try again.");
   } finally {
     setIsDeleting(false);
   }
 };

 const handleEditProduct = (product) => {
   navigate("/sell", { state: { editProduct: product } });
 };

 /* ── Guards ── */
 if (loading)
   return (
     <div className={styles.loading}>
       <div className={styles.spinner} />
       <span>Loading your dashboard…</span>
     </div>
   );
 if (error)
   return (
     <div className={styles.loading}>
       <span>{error}</span>
     </div>
   );
 if (!data) return null;

 const { profile, listings, purchases } = data;
 const firstName = (profile.full_name || "User").split(" ")[0];

 return (
   <div
     className={styles.dashboardRoot}
     style={{ position: "relative", minHeight: "100vh", overflowX: "hidden" }}
   >
     <input
       type="file"
       accept="image/*"
       style={{ display: "none" }}
       ref={fileInputRef}
       onChange={handleFileChange}
     />

     {/* ── Delete dialog (MARK_SOLD_SPEC §3 v1.2): the app's, in the danger tone ── */}
     {itemToDelete && (
       <ConfirmDialog
         title="Delete this listing?"
         message={
           <>
             <ConfirmDialog.Strong>{itemToDelete.title}</ConfirmDialog.Strong>{" "}
             will be removed for good. This can't be undone.
           </>
         }
         confirmLabel="Delete"
         busyLabel="Deleting…"
         Icon={Trash2}
         imageUrl={itemToDelete.image_urls?.[0]}
         tone="danger"
         busy={isDeleting}
         error={deleteError}
         onConfirm={executeDelete}
         onCancel={closeDelete}
       />
     )}

     {/* ── Who bought it? (MARK_SOLD_SPEC §1) ── */}
     {buyerPicker && (
       <BuyerPicker
         product={buyerPicker.product}
         mode={buyerPicker.mode}
         initialBuyerId={buyerPicker.initialBuyerId}
         onClose={closeBuyerPicker}
         onSaved={handleBuyerSaved}
       />
     )}

     {/* ── Relist dialog (MARK_SOLD_SPEC §3 v1.1): the app's ConfirmDialog ── */}
     {relistTarget && (
       <ConfirmDialog
         title="Relist this item?"
         message={
           <>
             <ConfirmDialog.Strong>{relistTarget.title}</ConfirmDialog.Strong>{" "}
             goes back on the marketplace.
             {relistTarget.buyer
               ? ` ${getFirstName(relistTarget.buyer.full_name)} will no longer be shown as its buyer.`
               : ""}
           </>
         }
         confirmLabel="Relist"
         Icon={RotateCcw}
         imageUrl={relistTarget.image_urls?.[0]}
         onConfirm={() => {
           const id = relistTarget.id;
           setRelistTarget(null);
           executeMarkAvailable(id);
         }}
         onCancel={() => setRelistTarget(null)}
       />
     )}

     {/* ── That wasn't me (MARK_SOLD_SPEC §4): the same dialog, danger tone ── */}
     {purchaseToRemove && (
       <ConfirmDialog
         title="Remove this purchase?"
         message={
           <>
             {getFirstName(purchaseToRemove.product.seller?.full_name)} marked{" "}
             <ConfirmDialog.Strong>{purchaseToRemove.product.title}</ConfirmDialog.Strong>{" "}
             as sold to you. If that's wrong, remove it. The listing stays sold;
             you just won't be shown as its buyer.
           </>
         }
         confirmLabel="Remove"
         busyLabel="Removing…"
         Icon={UserX}
         imageUrl={purchaseToRemove.product.image_urls?.[0]}
         tone="danger"
         busy={isRemovingPurchase}
         error={removePurchaseError}
         onConfirm={executeRemovePurchase}
         onCancel={closeRemovePurchase}
       />
     )}

     {/* ══════════════════════════════════════
        UI 1 — HERO VIEW
    ══════════════════════════════════════ */}
     <div
       className={styles.heroView}
       style={{
         opacity: isMobile ? 1 : isDashboard ? 0 : 1,
         transform: isMobile
           ? "none"
           : isDashboard
             ? "translateY(-40px) scale(0.96)"
             : "translateY(0) scale(1)",
         pointerEvents: isMobile ? "all" : isDashboard ? "none" : "all",
         transition:
           "opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
         position: isMobile
           ? "relative"
           : isDashboard
             ? "absolute"
             : "relative",
         width: "100%",
         top: 0,
         zIndex: isMobile ? "auto" : isDashboard ? 0 : 10,
       }}
     >
       <div className={styles.heroHeader}>
         <Avatar
           src={profile.avatar_url}
           name={profile.full_name}
           size={140}
           editable
           onUpload={handleAvatarEditClick}
           onRemove={handleRemoveAvatar}
           isUploading={isUploadingAvatar}
           onImageClick={() => setIsImageModalOpen(true)}
         />
         <div className={styles.heroText}>
           <div className={styles.heroEyebrow}>Student Dashboard</div>
           <div className={styles.sidebarUni}>
             <span className={styles.sidebarUniDot} />
             {profile.university || "Your University"}
           </div>
           <div className={styles.heroGreeting}>Hi, {firstName}! 👋</div>
           <div className={styles.heroSub}>
             Manage your academic journey and marketplace activities.
           </div>
         </div>
         <div className={styles.heroIcons}>
           <button className={styles.iconBtn} title="Notifications">
             <BellIcon />
           </button>
           <button className={styles.iconBtn} title="Settings">
             <GearIcon />
           </button>
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
             <span className={styles.sectionTitle}>Short Bio</span>
           </div>
           <p className={styles.bioText}>
             "{profile.bio || "Tell the campus who you are!"}"
           </p>
           <div className={styles.tags}>
             {["Campus", "Student", "Yahora"].map((t) => (
               <span key={t} className={styles.tag}>
                 {t}
               </span>
             ))}
           </div>
         </div>
       </div>
       <div className={styles.ui1Btn}>
         <button
           className={styles.sellBtn}
           style={{ width: "215px" }}
           onClick={() =>
             navigate(`/user/${localStorage.getItem("yahora_user_id")}`)
           }
         >
           View Your Public Profile
         </button>
        <button
           className={styles.sellBtn}
           style={{ 
             width: "150px", 
             display: "flex", 
             alignItems: "center", 
             justifyContent: "center", 
             gap: "8px" 
           }}
           onClick={() => navigate("/onboarding", { state: { profile: data.profile } })}
         >
           <PenIcon size={16} /> Edit Profile
         </button>
         <button
           className={styles.sellBtn}
           onClick={() => {
             if (isMobile) {
               dashViewRef.current?.scrollIntoView({ behavior: "smooth" });
             } else {
               setIsDashboard(true);
               window.scrollTo({ top: 0, behavior: "smooth" });
             }
           }}
         >
           Manage Your Items
         </button>
         
        
       </div>
     </div>

     {/* ══════════════════════════════════════
        UI 2 — SPLIT / DASHBOARD VIEW
    ══════════════════════════════════════ */}
     <div
       ref={dashViewRef}
       className={styles.dashView}
       style={{
         opacity: isMobile ? 1 : isDashboard ? 1 : 0,
         transform: isMobile
           ? "none"
           : isDashboard
             ? "translateY(0)"
             : "translateY(40px)",
         pointerEvents: isMobile ? "all" : isDashboard ? "all" : "none",
         transition:
           "opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
         position: isMobile
           ? "relative"
           : isDashboard
             ? "relative"
             : "absolute",
         width: "100%",
         top: isMobile ? 0 : -30,
         zIndex: isMobile ? "auto" : isDashboard ? 10 : 0,
       }}
     >
       <div className={styles.sidebar}>
         <div className={styles.sidebarProfileCard}>
           <Avatar
             src={profile.avatar_url}
             name={profile.full_name}
             size={140}
             editable
             onUpload={handleAvatarEditClick}
             onRemove={handleRemoveAvatar}
             isUploading={isUploadingAvatar}
             onImageClick={() => setIsImageModalOpen(true)}
           />
           <div className={styles.sidebarName}>{profile.full_name}</div>
           <div className={styles.sidebarUni}>
             <span className={styles.sidebarUniDot} />
             {profile.university || "Your University"}
           </div>
           <div className={styles.sidebarBio}>
             <EditableField
               value={profile.bio}
               placeholder="Tell the campus who you are…"
               textarea
               onSave={(v) => updateField("bio", v)}
             />
           </div>
         </div>

         <div className={styles.sidebarActions}>
           <button className={styles.sidebarIconBtn} title="Notifications">
             <BellIcon />
           </button>
           <button className={styles.sidebarIconBtn} title="Settings">
             <GearIcon />
           </button>
         </div>

         {/* The whole card is the button — the plus is decorative. A nested
             <button> would be invalid HTML and was the reason only the icon
             responded to clicks. */}
         <button
           type="button"
           className={styles.listNewCard}
           onClick={() => {
             navigate("/sell");
             window.scrollTo({ top: 0, left: 0, behavior: "auto" });
           }}
         >
           <span className={styles.listNewIcon}>
             <PlusIcon size={20} />
           </span>
           <div className={styles.listNewTitle}>List New Item</div>
           <div className={styles.listNewSub}>Earn some campus cash</div>
         </button>

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

         {!profile.is_profile_complete && (
           <button
             className={styles.completeBtn}
             onClick={() => navigate("/onboarding")}
           >
             Complete Profile
           </button>
         )}
       </div>

       <div className={styles.mainContent}>
         <div className={styles.tabs}>
           {[
             { key: "listings", label: "My Items" },
             { key: "purchases", label: "Bought Items" },
             { key: "watchlist", label: "Watchlist" },
           ].map((t) => (
             <button
               key={t.key}
               className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
               onClick={() => setTab(t.key)}
             >
               {t.label}
             </button>
           ))}
         </div>

         <div className={styles.grid} key={tab}>
           {tab === "listings" &&
             (listings.length ? (
               listings.map((item) => (
                 <ProductCard
                   key={item.id}
                   product={item}
                   isOwner={true}
                   currentUserId={localStorage.getItem("yahora_user_id")}
                   onEdit={() => handleEditProduct(item)}
                   onDelete={() => confirmDelete(item)}
                   onMarkSold={() =>
                     setBuyerPicker({ product: item, mode: "sell" })
                   }
                   onChangeBuyer={() =>
                     setBuyerPicker({
                       product: item,
                       mode: "change",
                       initialBuyerId: item.buyer?.id ?? null,
                     })
                   }
                   onMarkAvailable={() => setRelistTarget(item)}
                   onToggleLike={() =>
                     handleToggleGridLike(item.id, item.is_liked)
                   }
                   onToggleSave={() =>
                     handleToggleGridSave(item.id, item.is_saved)
                   }
                   onCardClick={() => navigate(`/product/${item.id}`)}
                   onChat={() => navigate("/messages")}
                 />
               ))
             ) : (
               <div className={styles.emptyState}>
                 You haven't listed anything yet.
                 <br />
                 Hit the + button to start selling!
               </div>
             ))}

           {tab === "purchases" &&
             (purchases.length ? (
               purchases.map((item) => (
                 <PurchaseCard
                   key={item.id}
                   item={item}
                   onOpen={(id) => navigate(`/product/${id}`)}
                   onRemove={(purchase) => {
                     setRemovePurchaseError(null);
                     setPurchaseToRemove(purchase);
                   }}
                 />
               ))
             ) : (
               <div className={styles.emptyState}>
                 You haven't bought anything yet.
                 <br />
                 Go explore the marketplace!
               </div>
             ))}

           {tab === "watchlist" && (
             <div className={styles.emptyState}>
               Your wishlist is empty.
               <br />
               Swipe right on items you love!
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
           <Avatar 
             src={profile.avatar_url} 
             name={profile.full_name} 
             size={Math.min(window.innerWidth * 0.8, 350)} 
             editable={false} 
             onImageClick={() => {}} 
           />
         </div>
       </div>
     )}

     <div
       style={{
         position: "fixed",
         bottom: 32,
         right: 32,
         zIndex: 100,
         opacity: isDashboard ? 1 : 0,
         transform: isDashboard ? "scale(1)" : "scale(0)",
         pointerEvents: isDashboard ? "all" : "none",
         transition:
           "opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
       }}
     >
       <button
         className={styles.fab}
         title="List a new item"
         onClick={() => {
           navigate("/sell");
           window.scrollTo({ top: 0, left: 0, behavior: "instant" });
         }}
       >
         <PlusIcon size={24} />
       </button>
     </div>
   </div>
 );
}