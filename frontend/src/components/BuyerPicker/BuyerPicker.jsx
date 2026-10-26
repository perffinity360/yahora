// frontend/src/components/BuyerPicker/BuyerPicker.jsx
//
// "Who bought it?" — docs/design/MARK_SOLD_SPEC.md §1, the web column: a
// 440-wide modal over a scrim. Opens from Mark as sold (mode "sell") and from
// Change buyer on a sold card (mode "change").
//
// The list: with fewer than 2 characters typed, the people who messaged the
// seller about this listing (GET /api/products/:id/buyer-candidates); with 2
// or more, students on the listing's campus who match (?q=), 300 ms after
// typing stops. "Someone not on Yahora" is always there, and sends
// buyer_id: null. Exactly one row is selected at a time.
//
// It saves itself (POST /api/products/:id/sold) so the spinner and the error
// toasts stay here; onSaved(product, buyer) gets the server's row and the
// chosen person (or null), and the caller updates its card.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleCheck, Search, UserX, X } from "lucide-react";
import styles from "./BuyerPicker.module.css";
import { API_BASE_URL } from "../../config/urls";
import AvatarImg from "../AvatarImg/AvatarImg";
import AppToast, { useToast } from "../AppToast/AppToast";

/* §1: searching starts this long after typing stops, from this many characters. */
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

const LOAD_ERROR = "Couldn't load students. Try again.";
/* §1 "Errors from the server → toast text". */
const SAVE_ERRORS = {
  BUYER_NOT_ON_CAMPUS: "That student isn't on this listing's campus.",
  BUYER_NOT_FOUND: "That student's account no longer exists.",
  PRODUCT_NOT_FOUND: "This listing no longer exists.",
  NOT_PRODUCT_OWNER: "Only the seller can mark this as sold.",
};
const SAVE_FALLBACK = "Couldn't save. Check your connection and try again.";

const authHeaders = () => {
  const token = localStorage.getItem("yahora_session");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/* GET buyer-candidates; `q` only when searching. Throws on any non-200. */
async function fetchCandidates(productId, q, signal) {
  const query = q ? `?${new URLSearchParams({ q }).toString()}` : "";
  const res = await fetch(
    `${API_BASE_URL}/products/${productId}/buyer-candidates${query}`,
    { headers: authHeaders(), signal },
  );
  if (!res.ok) throw new Error(`buyer-candidates ${res.status}`);
  const body = await res.json();
  return body.items || [];
}

/* §1 "States": three rows of a 36 circle and two bars. */
function SkeletonRows() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.skeletonRow}>
          <span className={styles.skeletonAvatar} />
          <span className={styles.skeletonBars}>
            <span className={styles.skeletonName} />
            <span className={styles.skeletonHandle} />
          </span>
        </div>
      ))}
    </div>
  );
}

function PersonRow({ person, selected, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`${styles.row} ${selected ? styles.rowSelected : ""}`}
      onClick={() => onSelect(person)}
    >
      <AvatarImg
        src={person.avatar_url}
        name={person.full_name || person.username}
        size={36}
        className={styles.avatar}
      />
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{person.full_name || person.username}</span>
        {person.username && (
          <span className={styles.rowSubtitle}>@{person.username}</span>
        )}
      </span>
      {selected && <CircleCheck size={20} className={styles.check} aria-hidden="true" />}
    </button>
  );
}

/**
 * product        — the listing: { id, title, buyer? }
 * mode           — "sell" (button: Mark as sold) or "change" (button: Save)
 * initialBuyerId — undefined: nothing selected · null: "Someone not on Yahora"
 *                  selected · an id: that person selected (taken from
 *                  product.buyer, which the dashboard sends the seller)
 * onClose()      — Esc, the scrim, or the close button
 * onSaved(product, buyer) — after a 200 from /sold
 */
export default function BuyerPicker({ product, mode, initialBuyerId, onClose, onSaved }) {
  // undefined = nothing chosen yet; null = off-platform; else the person.
  const [selected, setSelected] = useState(() => {
    if (initialBuyerId === undefined || initialBuyerId === null) return initialBuyerId;
    return product.buyer?.id === initialBuyerId ? product.buyer : { id: initialBuyerId };
  });
  const [query, setQuery] = useState("");
  const [messaged, setMessaged] = useState({ status: "loading", items: [] });
  const [search, setSearch] = useState(null); // { q, status, items } while searching
  const [saving, setSaving] = useState(false);
  const { toast, showToast } = useToast();
  const searchRef = useRef(null);

  const q = query.trim();
  const searching = q.length >= SEARCH_MIN_CHARS;

  // The "Messaged you about this" list, once per opening.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchCandidates(product.id, null, ctrl.signal)
      .then((items) => setMessaged({ status: "ready", items }))
      .catch((err) => {
        if (err.name === "AbortError") return;
        setMessaged({ status: "error", items: [] });
        showToast(LOAD_ERROR);
      });
    return () => ctrl.abort();
  }, [product.id, showToast]);

  // "On your campus": 300 ms after typing stops. A newer query cancels the
  // older one's timer and request, so results never arrive out of order.
  useEffect(() => {
    if (!searching) {
      setSearch(null);
      return undefined;
    }
    setSearch({ q, status: "loading", items: [] });
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetchCandidates(product.id, q, ctrl.signal)
        .then((items) => setSearch({ q, status: "ready", items }))
        .catch((err) => {
          if (err.name === "AbortError") return;
          setSearch({ q, status: "error", items: [] });
          showToast(LOAD_ERROR);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, searching, product.id, showToast]);

  // Esc closes, like the scrim — but not while a save is in flight, so its
  // result (or its error toast) is never lost.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  // A mouse lands in the search field; a phone is not handed its keyboard.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      searchRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const save = async () => {
    if (selected === undefined || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/products/${product.id}/sold`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ buyer_id: selected?.id ?? null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaving(false);
        showToast(SAVE_ERRORS[body?.error] ?? SAVE_FALLBACK);
        return;
      }
      onSaved(body.product ?? {}, selected);
    } catch {
      setSaving(false);
      showToast(SAVE_FALLBACK);
    }
  };

  const list = searching ? search : messaged;
  const listItems = list?.status === "ready" ? list.items : [];
  // The chosen person stays on screen even when the list in view doesn't
  // have them (Change buyer on someone found by search; a search cleared
  // after choosing) — above the section, with no label of its own.
  const pinned =
    selected && !listItems.some((p) => p.id === selected.id) && selected.full_name !== undefined
      ? selected
      : null;

  let section = null;
  if (searching) {
    section = (
      <>
        <p className={styles.sectionLabel}>On your campus</p>
        {search?.status === "ready" && search.items.length === 0 ? (
          <p className={styles.noMatch}>
            No students on your campus match “{search.q}”.
          </p>
        ) : search?.status === "ready" ? (
          search.items.map((p) => (
            <PersonRow
              key={p.id}
              person={p}
              selected={selected?.id === p.id}
              onSelect={setSelected}
            />
          ))
        ) : search?.status === "error" ? null : (
          <SkeletonRows />
        )}
      </>
    );
  } else if (messaged.status === "loading") {
    section = <SkeletonRows />;
  } else if (messaged.items.length > 0) {
    // Left out entirely when nobody messaged about it (§1).
    section = (
      <>
        <p className={styles.sectionLabel}>Messaged you about this</p>
        {messaged.items.map((p) => (
          <PersonRow
            key={p.id}
            person={p}
            selected={selected?.id === p.id}
            onSelect={setSelected}
          />
        ))}
      </>
    );
  }

  return createPortal(
    <div className={styles.scrim} onClick={() => !saving && onClose()}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="buyer-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="buyer-picker-title" className={styles.title}>
          Who bought it?
        </h2>
        <p className={styles.subtitle}>{product.title}</p>

        <div className={styles.searchField}>
          <Search size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            className={styles.searchInput}
            placeholder="Search by name or @username"
            aria-label="Search by name or @username"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className={styles.clearBtn}
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus({ preventScroll: true });
              }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className={styles.list} role="radiogroup" aria-label="Who bought it?">
          {pinned && (
            <PersonRow person={pinned} selected onSelect={setSelected} />
          )}
          {section}
          <div className={styles.divider} />
          <button
            type="button"
            role="radio"
            aria-checked={selected === null}
            className={`${styles.row} ${selected === null ? styles.rowSelected : ""}`}
            onClick={() => setSelected(null)}
          >
            <span className={styles.offPlatformIcon} aria-hidden="true">
              <UserX size={18} />
            </span>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Someone not on Yahora</span>
              <span className={styles.rowSubtitle}>No one will be tagged</span>
            </span>
            {selected === null && (
              <CircleCheck size={20} className={styles.check} aria-hidden="true" />
            )}
          </button>
        </div>

        <button
          type="button"
          className={styles.confirmBtn}
          disabled={selected === undefined || saving}
          aria-busy={saving}
          aria-label={saving ? "Saving" : undefined}
          onClick={save}
        >
          {saving ? (
            <span className={styles.spinner} aria-hidden="true" />
          ) : mode === "change" ? (
            "Save"
          ) : (
            "Mark as sold"
          )}
        </button>

        <AppToast toast={toast} bottom={76} />
      </div>
    </div>,
    document.body,
  );
}
