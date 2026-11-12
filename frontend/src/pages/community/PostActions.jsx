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
//           A REPLY goes at once, before the answer: it leaves its thread,
//           and its parent's 💬 count drops by one in every list that shows
//           the parent (useReplyCounts). If the delete fails, both come back
//           and the toast says so.
//
// `hidden` (the ids reported or deleted here) is read by each list through
// PostActionsContext, and so is `showToast`, the one toast every list shares.
// `onRemoved(post, "reported" | "deleted")` lets the screen react too (the
// post page shows "This post was deleted.").

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import AppToast, { useToast } from "../../components/AppToast/AppToast";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import ReportModal from "../../components/community/ReportModal/ReportModal";
import { PostActionsContext, usePostActions } from "../../components/community/PostMenu/PostMenu";
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
  // Lists that hold posts, told when one of their posts gains or loses a reply.
  const countListeners = useRef(new Set());

  const hide = useCallback((post, why) => {
    setHidden((prev) => new Set(prev).add(post.id));
    onRemovedRef.current?.(post, why);
  }, []);

  const unhide = useCallback((post) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.delete(post.id);
      return next;
    });
  }, []);

  const subscribeReplyCounts = useCallback((listener) => {
    countListeners.current.add(listener);
    return () => countListeners.current.delete(listener);
  }, []);
  const changeReplyCount = (parentId, delta) => {
    countListeners.current.forEach((listener) => listener(parentId, delta));
  };

  // A reply goes at once; the answer only decides whether it comes back.
  const deleteReply = async (reply) => {
    hide(reply, "deleted");
    changeReplyCount(reply.parent_post_id, -1);
    let ok = false;
    try {
      const { status } = await deletePost(reply.id);
      // 404: it's already gone, which is what was asked for.
      ok = status === 200 || status === 404;
    } catch {
      ok = false;
    }
    if (!ok) {
      unhide(reply);
      changeReplyCount(reply.parent_post_id, +1);
      showToast(DELETE_FAILED);
    }
  };

  const openDelete = useCallback((post) => {
    setError(null);
    setDeleting(post);
  }, []);

  const confirmDelete = async () => {
    const post = deleting;
    if (post.parent_post_id) {
      setDeleting(null);
      deleteReply(post);
      return;
    }
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
    () => ({ hidden, openReport: setReporting, openDelete, showToast, subscribeReplyCounts }),
    [hidden, openDelete, showToast, subscribeReplyCounts],
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

/** For a list of posts: `update(parentId, delta)` runs when one of its posts
    loses a reply (−1) or gets it back after a failed delete (+1), so the list
    changes its own copy of `replies_count`. Each list keeps its own copy: a
    feed loaded afterwards already has the server's count, so nothing is
    applied twice. Sending a reply is counted by the list it was sent from. */
export function useReplyCounts(update) {
  const subscribe = usePostActions()?.subscribeReplyCounts;
  const updateRef = useRef(update);
  updateRef.current = update;
  useEffect(() => subscribe?.((parentId, delta) => updateRef.current(parentId, delta)), [subscribe]);
}

/** `items` with `replies_count` of post `parentId` moved by `delta`, never below 0. */
export function withReplyCount(items, parentId, delta) {
  return items.map((p) =>
    p.id === parentId ? { ...p, replies_count: Math.max(0, (p.replies_count ?? 0) + delta) } : p,
  );
}
