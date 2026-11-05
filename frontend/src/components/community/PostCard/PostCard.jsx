// frontend/src/components/community/PostCard/PostCard.jsx
//
// One post in a feed — docs/design/COMMUNITY_SPEC.md §3. A flat row split from
// the next by a hairline, with the avatar as a drop cap: it floats in the corner
// and everything below its height runs the post's full width. Takes a PostItem
// (runbook Appendix A) exactly as the API sends it, and reports reactions
// through onReact(postId, emoji | null); it never changes the post itself.
//
// `showCampus` is off in the campus feed, where the campus is obvious. Elsewhere
// the campus shows only if the panel has room (the @container rule in the CSS).

import React, { memo, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Ellipsis, MessageCircle } from "lucide-react";
import AvatarImg from "../../AvatarImg/AvatarImg";
import ImageLightbox from "../../ImageLightbox/ImageLightbox";
import ReactionBar from "../ReactionBar/ReactionBar";
import ReactionSummary from "../ReactionSummary/ReactionSummary";
import PostPhotos from "./PostPhotos";
import PostGif from "./PostGif";
import PostText from "./PostText";
import PostThread from "./PostThread";
import { formatCount, formatPostTime } from "../../../utils/community";
import styles from "./PostCard.module.css";

/* The stagger stops here, so a long page doesn't keep arriving for a second. */
const STAGGER_MAX = 6;

function PostCard({
  post,
  index = 0,
  showCampus = true,
  canReply = false,
  onReact,
  onReply,
  loadReplies,
  addedReplies,
}) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [moreRequest, setMoreRequest] = useState(0);
  const profile = `/user/${post.author_id}`;
  const time = formatPostTime(post.created_at);

  const react = useCallback((emoji) => onReact(post.id, emoji), [onReact, post.id]);

  const onReplyPress = () => {
    if (canReply) onReply?.(post);
    else setMoreRequest((n) => n + 1);
  };

  const count = post.replies_count;
  const countWords = `${count} ${count === 1 ? "reply" : "replies"}`;

  return (
    <article
      className={styles.post}
      style={{ "--post-i": Math.min(index, STAGGER_MAX) }}
      aria-label={`Post by ${post.author_name}`}
    >
      <Link to={profile} className={styles.avatarLink} aria-label={post.author_name} tabIndex={-1}>
        <AvatarImg src={post.author_avatar} name={post.author_name} size={28} className={styles.avatar} />
      </Link>

      {/* The frosted layer sits behind the author line and the text (spec §3). */}
      <div className={styles.readable}>
        <header className={styles.header}>
          <Link to={profile} className={styles.name}>
            {post.author_name}
          </Link>
          <span className={`${styles.meta} ${styles.username}`}>@{post.author_username}</span>
          {showCampus && <span className={`${styles.meta} ${styles.campus}`}>{post.author_university}</span>}
          {time && (
            <Link
              to={`/post/${post.id}`}
              className={`${styles.meta} ${styles.time}`}
              title={new Date(post.created_at).toLocaleString()}
            >
              <time dateTime={post.created_at}>{time}</time>
            </Link>
          )}
          {/* Part 3 (CC-N4c) fills this menu: Report, and Delete for your own. */}
          <button type="button" className={styles.moreBtn} aria-label="More options">
            <Ellipsis size={15} aria-hidden="true" />
          </button>
        </header>

        {post.content && <PostText content={post.content} />}
      </div>

      {post.image_urls?.length > 0 && (
        <PostPhotos urls={post.image_urls} authorName={post.author_name} onOpen={setLightboxIndex} />
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

      <PostThread
        post={post}
        showCampus={showCampus}
        onReact={onReact}
        loadReplies={loadReplies}
        addedReplies={addedReplies}
        moreRequest={moreRequest}
      />

      {/* In a portal: the feed's container query makes it the containing block
          for anything fixed inside it, which would trap the viewer in the panel. */}
      {lightboxIndex !== null &&
        createPortal(
          <ImageLightbox
            images={post.image_urls}
            startIndex={lightboxIndex}
            alt={`Photo from ${post.author_name}`}
            onClose={() => setLightboxIndex(null)}
          />,
          document.body,
        )}
    </article>
  );
}

export default memo(PostCard);
