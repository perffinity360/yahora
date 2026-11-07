// frontend/src/pages/community/BrandMenu.jsx
//
// The centre brand pill — docs/design/COMMUNITY_SPEC.md §1.1. On a laptop the
// Community page hides the site navbar to give the feeds the whole window, and
// this pill takes its place at the top of the divider, where the two panel
// headers meet. It moves with the divider (--split-pct, set by Community.jsx).
//
// Pressing it opens the menu under it: Home, Marketplace, Community (here),
// Messages with its unread count, Saved / Cart, Notifications, and you. Esc or a
// press elsewhere closes it; Esc gives the focus back to the pill.
//
// The unread count, your name and photo come from the navbar, which stays
// mounted, hidden, and publishes them (NAV_STATE_EVENT), so there is still only
// one Realtime subscription for them.

import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  House,
  LogOut,
  MessageSquare,
  ShoppingCart,
  Store,
  Users,
} from "lucide-react";
import AvatarImg from "../../components/AvatarImg/AvatarImg";
import { NAV_STATE_EVENT } from "../../components/navbar/navbar";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./BrandMenu.module.css";

const EMPTY = { unreadCount: 0, avatarUrl: null, userName: "" };

function subscribe(onChange) {
  window.addEventListener(NAV_STATE_EVENT, onChange);
  return () => window.removeEventListener(NAV_STATE_EVENT, onChange);
}

function useNavState() {
  return useSyncExternalStore(subscribe, () => window.yahoraNavState ?? EMPTY, () => EMPTY);
}

const badge = (n) => (n > 99 ? "99+" : String(n));

export default function BrandMenu() {
  const { unreadCount, avatarUrl, userName } = useNavState();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const pillRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    // The first link takes the focus, so the keyboard can go straight on.
    menuRef.current?.querySelector("a, button")?.focus({ preventScroll: true });
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      pillRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const name = userName || "You";

  const items = [
    { to: "/", label: "Home", Icon: House },
    { to: "/marketplace", label: "Marketplace", Icon: Store },
    { to: "/community", label: "Community", Icon: Users, current: true },
    { to: "/messages", label: "Messages", Icon: MessageSquare, count: unreadCount },
    // The navbar's cart button doesn't go anywhere yet; saved listings are the
    // Watchlist tab of the dashboard.
    { to: "/dashboard", label: "Saved / Cart", Icon: ShoppingCart },
  ];

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={pillRef}
        type="button"
        className={styles.centerBrandPill}
        data-brand-pill=""
        data-open={open || undefined}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={unreadCount > 0 ? `Yahora menu, ${unreadCount} unread messages` : "Yahora menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.logoCrop} aria-hidden="true">
          <img src="/yahora_logo.svg" alt="" className={styles.logo} />
        </span>
        <span className={styles.pillDivider} aria-hidden="true" />
        <span className={styles.burger} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {unreadCount > 0 && (
          <span className={styles.pillBadge} aria-hidden="true">
            {badge(unreadCount)}
          </span>
        )}
      </button>

      <nav
        ref={menuRef}
        id={menuId}
        className={styles.menu}
        data-open={open || undefined}
        aria-label="Yahora"
        inert={!open}
      >
        <ul className={styles.list}>
          {items.map(({ to, label, Icon, current, count }, i) => (
            <li key={label} style={{ "--i": i }}>
              <Link
                to={to}
                className={`${styles.item} ${current ? styles.itemCurrent : ""}`}
                aria-current={current ? "page" : undefined}
                onClick={close}
              >
                <Icon size={16} aria-hidden="true" className={styles.itemIcon} />
                <span className={styles.itemLabel}>{label}</span>
                {count > 0 && <span className={styles.count}>{badge(count)}</span>}
              </Link>
            </li>
          ))}
          <li style={{ "--i": items.length }}>
            {/* Nothing to open yet, the same as the navbar's bell. */}
            <span className={`${styles.item} ${styles.itemSoon}`} aria-disabled="true">
              <Bell size={16} aria-hidden="true" className={styles.itemIcon} />
              <span className={styles.itemLabel}>Notifications</span>
              <span className={styles.soon}>Soon</span>
            </span>
          </li>
        </ul>

        <div className={styles.me} style={{ "--i": items.length + 1 }}>
          <Link to="/dashboard" className={styles.meLink} onClick={close}>
            <AvatarImg src={avatarUrl} name={name} size={34} className={styles.meAvatar} />
            <span className={styles.meText}>
              <span className={styles.meName}>{name}</span>
              <span className={styles.meHint}>Your profile</span>
            </span>
          </Link>
          <button
            type="button"
            className={styles.logout}
            aria-label="Log out"
            title="Log out"
            onClick={() => {
              close();
              logout();
              navigate("/auth");
            }}
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
  );
}
