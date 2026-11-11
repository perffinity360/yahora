// frontend/src/pages/post/PostDetail.jsx
//
// A post's own page, /post/:id — docs/design/COMMUNITY_SPEC.md §4 and §3.1.
// The post larger (15/22, never folded), then every reply oldest first,
// REPLIES_PAGE_SIZE_ON_PAGE at a time behind "Load more replies", and the reply
// box pinned at the bottom: the Composer with parentId (text and a GIF, no
// photos). Where you can only view, the view-only line takes its place.
//
// It wears the community's own look: the zone's wallpaper and cards
// (Community.module.css), campus colours for a campus post, the other side's
// for a country or Global one.
//
// What a direct link answers when the post isn't there (runbook §1.7):
//   404                       This post isn't available.
//   410 POST_DELETED          This post was deleted.
//   410 POST_REMOVED          This post was removed for breaking the Community Guidelines.
//   403 POST_UNDER_REVIEW     This post was reported and is being reviewed.
// The last one never shows any of the post, and there is no way to open it.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Eye } from "lucide-react";
import Composer from "../../components/community/Composer/Composer";
import PostCard from "../../components/community/PostCard/PostCard";
import useReactionPatches, { applyPatches } from "../../hooks/useReactionPatches";
import { countryName } from "../../utils/community";
import { createPost, getPost, getReplies, getViewerProfile } from "../community/api";
import { SkeletonPost, loadProfile } from "../community/CommunityFeed";
import PostActionsProvider from "../community/PostActions";
import styles from "../community/Community.module.css";
import pageStyles from "./PostDetail.module.css";

/* Runbook checkpoint N-D3: "Load more replies" once there are more than 20,
   the API's own page. A feed's thread pages by REPLIES_PAGE_SIZE instead. */
const REPLIES_PAGE_SIZE_ON_PAGE = 20;

/* Spec §3.1 and runbook §1.7. */
const GONE_TEXT = {
  POST_NOT_FOUND: "This post isn't available.",
  POST_DELETED: "This post was deleted.",
  POST_REMOVED: "This post was removed for breaking the Community Guidelines.",
  POST_UNDER_REVIEW: "This post was reported and is being reviewed.",
};

function goneCode(err) {
  const code = err?.body?.error;
  if (code === "POST_DELETED" || code === "POST_REMOVED" || code === "POST_UNDER_REVIEW") return code;
  // 404, and a link whose id isn't even a uuid (400).
  if (err?.status === 404 || err?.status === 400) return "POST_NOT_FOUND";
  return null;
}

export default function PostDetail() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [canReply, setCanReply] = useState(false);
  const [gone, setGone] = useState(null); // a key of GONE_TEXT
  const [failed, setFailed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [added, setAdded] = useState([]);
  const [focusSignal, setFocusSignal] = useState(0);
  const { patches, onReact } = useReactionPatches();

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const answer = await getPost(id);
      setPost(answer.post);
      setCanReply(answer.can_reply === true);
    } catch (err) {
      const code = goneCode(err);
      if (code) setGone(code);
      else setFailed(true);
    }
  }, [id]);

  useEffect(() => {
    setPost(null);
    setGone(null);
    setAdded([]);
    load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    getViewerProfile()
      .then((p) => alive && setProfile(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const viewer = useMemo(
    () => ({
      username: profile?.username ?? "",
      name: profile?.full_name ?? "",
      avatar: profile?.avatar_url ?? null,
      campus: profile?.university ?? "",
    }),
    [profile],
  );

  const shown = useMemo(() => (post ? applyPatches([post], patches)[0] : null), [post, patches]);
  const react = useCallback((postId, emoji) => onReact(postId, emoji, postId === shown?.id ? shown : undefined), [onReact, shown]);

  const onPosted = useCallback((reply) => {
    setAdded((prev) => [...prev, reply]);
    setPost((p) => (p ? { ...p, replies_count: p.replies_count + 1 } : p));
  }, []);

  // Deleting the post itself from its ⋯ menu leaves only the notice.
  const onRemoved = useCallback(
    (removed, why) => {
      if (why === "deleted" && removed.id === id) setGone("POST_DELETED");
    },
    [id],
  );

  const world = shown && shown.scope !== "campus";
  const country = shown ? countryName(shown.country_code) : "";

  let body;
  if (gone) {
    body = <p className={styles.empty}>{GONE_TEXT[gone]}</p>;
  } else if (failed) {
    body = (
      <div className={styles.failed} role="alert">
        <span>Couldn't load this post.</span>
        <button type="button" className={styles.retry} onClick={load}>
          Try again
        </button>
      </div>
    );
  } else if (!shown) {
    body = (
      <div className={styles.list} role="status" aria-label="Loading post">
        <SkeletonPost />
      </div>
    );
  } else {
    body = (
      <div className={styles.list}>
        <PostCard
          post={shown}
          variant="page"
          showCampus={shown.scope !== "campus"}
          canReply={canReply}
          onReact={react}
          onReply={() => setFocusSignal((n) => n + 1)}
          loadReplies={getReplies}
          loadProfile={loadProfile}
          addedReplies={added}
          pageSize={REPLIES_PAGE_SIZE_ON_PAGE}
        />
      </div>
    );
  }

  const dock =
    !shown || gone ? null : canReply ? (
      <Composer
        feed={shown.scope}
        countryName={country}
        viewer={viewer}
        parentId={shown.id}
        replyToUsername={shown.author_username}
        onSubmit={createPost}
        onPosted={onPosted}
        focusSignal={focusSignal}
      />
    ) : (
      <p className={styles.viewOnly} role="note">
        <Eye size={14} aria-hidden="true" className={styles.viewOnlyIcon} />
        <span>Only students in {country} can reply.</span>
      </p>
    );

  return (
    <PostActionsProvider onRemoved={onRemoved}>
      <div className={`${styles.narrow} ${pageStyles.page}`} data-feed={world ? "world" : "campus"}>
        <div className={`${styles.feed} ${pageStyles.feed}`}>{body}</div>
        {dock && (
          <div className={`${styles.dockFloat} ${world ? styles.dockWorld : styles.dockCampus}`}>{dock}</div>
        )}
      </div>
    </PostActionsProvider>
  );
}
