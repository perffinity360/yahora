// frontend/src/pages/community/PostActions.jsx
//
// What the ⋯ menu does (components/community/PostMenu): every screen that
// shows posts wraps them in <PostActionsProvider>.
//
//   Report  the ReportModal (spec §7) → POST /api/reports. Sent: the toast,
//           and the post is hidden from this student's loaded lists.
//           "Already reported" and errors stay inside the form (useReport).
//   Delete  the author only. ConfirmDialog with the spec's words (§3) →
//           DELETE /api/posts/:id → the post leaves every loaded list.
//
// `hidden` (the ids reported or deleted here) is read by each list through
// PostActionsContext, and so is `showToast`, the one toast every list shares.
// `onRemoved(post, "reported" | "deleted")` lets the screen react too (the
// post page shows "This post was deleted.").

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import AppToast, { useToast } from "../../components/AppToast/AppToast";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import ReportModal from "../../components/community/ReportModal/ReportModal";
import { PostActionsContext } from "../../components/community/PostMenu/PostMenu";
import menuStyles from "../../components/community/PostMenu/PostMenu.module.css";
import { REPORT_TEXT } from "../../hooks/useReport";
import { deletePost, report } from "./api";

/* ⚠ Not in the spec: it has no words for a failed delete. */
const DELETE_FAILED = "Couldn't delete. Try again.";

export default function PostActionsProvider({ children, onRemoved }) {
  const [hidden, setHidden] = useState(() => new Set());
  const [reporting, setReporting] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { toast, showToast } = useToast();
  const onRemovedRef = useRef(onRemoved);
  onRemovedRef.current = onRemoved;

  const hide = useCallback((post, why) => {
    setHidden((prev) => new Set(prev).add(post.id));
    onRemovedRef.current?.(post, why);
  }, []);

  const openDelete = useCallback((post) => {
    setError(null);
    setDeleting(post);
  }, []);

  const confirmDelete = async () => {
    const post = deleting;
    setBusy(true);
    setError(null);
    try {
      const { status } = await deletePost(post.id);
      // 404: it's already gone, which is what was asked for.
      if (status === 200 || status === 404) {
        setDeleting(null);
        hide(post, "deleted");
      } else {
        setError(DELETE_FAILED);
      }
    } catch {
      setError(DELETE_FAILED);
    } finally {
      setBusy(false);
    }
  };

  // showToast is shared too, so a list can say something went wrong (spec §8).
  const value = useMemo(
    () => ({ hidden, openReport: setReporting, openDelete, showToast }),
    [hidden, openDelete, showToast],
  );

  return (
    <PostActionsContext.Provider value={value}>
      {children}

      {reporting && (
        <ReportModal
          postId={reporting.id}
          onSubmit={report}
          onClose={(result) => {
            const post = reporting;
            setReporting(null);
            if (result === "sent") {
              showToast(REPORT_TEXT.sent);
              hide(post, "reported");
            }
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this post?"
          message="It will be removed for everyone."
          confirmLabel="Delete"
          Icon={Trash2}
          imageUrl={deleting.image_urls?.[0]}
          tone="danger"
          busy={busy}
          busyLabel="Deleting…"
          error={error}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      <div className={menuStyles.toastLayer}>
        <AppToast toast={toast} bottom={88} />
      </div>
    </PostActionsContext.Provider>
  );
}
