// frontend/src/components/community/PostCard/PostCard.jsx
//
// One post in a feed — docs/design/COMMUNITY_SPEC.md §3. A flat row split from
// the next by a line, with the avatar in a column of its own, so the text, media,
// actions and replies all hang off one left edge. Takes a PostItem
// (runbook Appendix A) exactly as the API sends it, and reports reactions
// through onReact(postId, emoji | null); it never changes the post itself.
//
// `showCampus` is off in the campus feed, where the campus is obvious. Elsewhere
// the campus shows only if the panel has room (the @container rule in the CSS).
//
// `arriving` (0, 1, 2…, or null) marks a post the "new posts" pill just brought
// in (spec §8): it slides down into place instead, staggered by that number.
//
// `variant="page"` is the post's own page (spec §4): text at 15/22 and never
// folded, and every reply paged by "Load more replies" (PostPageThread)
// instead of the feed's preview. The ⋯ menu is PostMenu: Report, or Delete
// for your own. Your own held or covered post carries its label (spec §3.1);
// nobody else is ever sent one.

import React, { memo, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { GraduationCap, MessageCircle } from "lucide-react";
import AvatarImg from "../../AvatarImg/AvatarImg";
import ImageLightbox from "../../ImageLightbox/ImageLightbox";
import ReactionBar from "../ReactionBar/ReactionBar";
import ReactionSummary from "../ReactionSummary/ReactionSummary";
import ProfileHover from "../ProfileHover/ProfileHover";
import PostPhotos from "./PostPhotos";
import PostGif from "./PostGif";
import PostText from "./PostText";
import PostThread, { PostPageThread } from "./PostThread";
import PostMenu from "../PostMenu/PostMenu";
import { formatCount, formatPostTime } from "../../../utils/community";
import styles from "./PostCard.module.css";

/* The stagger stops here, so a long page doesn't keep arriving for a second. */
const STAGGER_MAX = 6;

/* Spec §3.1: only the author ever receives these. */
const STATUS_LABELS = { pending: "Being checked", under_review: "Under review" };

function PostCard({
  post,
  index = 0,
  showCampus = true,
  canReply = false,
  onReact,
  onReply,
  loadReplies,
  loadProfile,
  addedReplies,
  variant = "feed",
  pageSize,
  arriving = null,
}) {
  const onPage = variant === "page";
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [moreRequest, setMoreRequest] = useState(0);
  const profile = `/user/${post.author_id}`;
  const time = formatPostTime(post.created_at);
  const person = {
    id: post.author_id,
    name: post.author_name, // the avatar's initials only; never shown
    username: post.author_username,
    avatar: post.author_avatar,
    campus: post.author_university,
  };

  const react = useCallback((emoji) => onReact(post.id, emoji), [onReact, post.id]);

  const onReplyPress = () => {
    if (canReply) onReply?.(post);
    else setMoreRequest((n) => n + 1);
  };

  const count = post.replies_count;
  const countWords = `${count} ${count === 1 ? "reply" : "replies"}`;

  return (
    <article
      className={`${styles.post} ${onPage ? styles.postLarge : ""} ${arriving !== null ? styles.postArriving : ""}`}
      style={{ "--post-i": Math.min(index, STAGGER_MAX), "--arrive-i": Math.min(arriving ?? 0, STAGGER_MAX) }}
      aria-label={`Post by @${post.author_username}`}
    >
      {/* Resting on the avatar opens the profile glimpse too, as on the
          username (owner, 10 Nov). */}
      <ProfileHover person={person} loadProfile={loadProfile}>
        <Link to={profile} className={styles.avatarLink} aria-label={`@${post.author_username}`} tabIndex={-1}>
          <AvatarImg src={post.author_avatar} name={post.author_name} size={28} className={styles.avatar} />
        </Link>
      </ProfileHover>

      {/* The top of the thread's line, shown only when the post has a thread. */}
      <span className={styles.stem} aria-hidden="true" />

      <div className={styles.postBody}>
        <div>
          <header className={styles.header}>
            {/* Usernames only, never full names (owner, 10 Nov). */}
            <ProfileHover person={person} loadProfile={loadProfile}>
              <Link to={profile} className={styles.username}>
                @{post.author_username}
              </Link>
            </ProfileHover>
            {showCampus && (
              <span className={`${styles.campus} ${styles.collegePill}`} title={post.author_university}>
                <GraduationCap size={11} aria-hidden="true" />
                <span>{post.author_university}</span>
              </span>
            )}
            {time && (
              <Link
                to={`/post/${post.id}`}
                className={`${styles.meta} ${styles.time}`}
                title={new Date(post.created_at).toLocaleString()}
              >
                <time dateTime={post.created_at}>{time}</time>
              </Link>
            )}
            {STATUS_LABELS[post.moderation_status] && (
              <span className={styles.statusLabel}>{STATUS_LABELS[post.moderation_status]}</span>
            )}
            <PostMenu post={post} className={styles.moreBtn} size={15} />
          </header>

          {post.content && <PostText content={post.content} unfolded={onPage} />}
        </div>

        {post.image_urls?.length > 0 && (
          <PostPhotos urls={post.image_urls} authorName={`@${post.author_username}`} onOpen={setLightboxIndex} />
        )}

        {post.gif && <PostGif gif={post.gif} />}

        <div className={styles.actions}>
          {post.reactions_total > 0 && (
            <ReactionSummary
              counts={post.reaction_counts}
              total={post.reactions_total}
              mine={post.viewer_reaction}
              onReact={react}
            />
          )}
          <ReactionBar reaction={post.viewer_reaction} onReact={react} />
          <button
            type="button"
            className={styles.replyPill}
            aria-label={canReply ? `${countWords}. Write a reply` : `${countWords}. Show them`}
            title={canReply ? "Reply" : "Replies"}
            onClick={onReplyPress}
          >
            <MessageCircle size={14} aria-hidden="true" />
            {count > 0 && <span>{formatCount(count)}</span>}
          </button>
        </div>
      </div>

      {onPage ? (
        <PostPageThread
          post={post}
          showCampus={showCampus}
          onReact={onReact}
          loadReplies={loadReplies}
          loadProfile={loadProfile}
          addedReplies={addedReplies}
          pageSize={pageSize}
        />
      ) : (
        <PostThread
          post={post}
          showCampus={showCampus}
          onReact={onReact}
          loadReplies={loadReplies}
          loadProfile={loadProfile}
          addedReplies={addedReplies}
          moreRequest={moreRequest}
        />
      )}

      {/* In a portal: the feed's container query makes it the containing block
          for anything fixed inside it, which would trap the viewer in the panel. */}
      {lightboxIndex !== null &&
        createPortal(
          <ImageLightbox
            images={post.image_urls}
            startIndex={lightboxIndex}
            alt={`Photo from @${post.author_username}`}
            onClose={() => setLightboxIndex(null)}
          />,
          document.body,
        )}
    </article>
  );
}

export default memo(PostCard);
