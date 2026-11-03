// frontend/src/components/community/PostCard/PostCard.jsx
//
// One post in a feed — docs/design/COMMUNITY_SPEC.md §3. Takes a PostItem
// (runbook Appendix A) exactly as the API sends it, and reports reactions
// through onReact(postId, emoji | null); it never changes the post itself.

import React, { memo, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Ellipsis, MessageCircle } from "lucide-react";
import AvatarImg from "../../AvatarImg/AvatarImg";
import ImageLightbox from "../../ImageLightbox/ImageLightbox";
import ReactionBar from "../ReactionBar/ReactionBar";
import ReactionSummary from "../ReactionSummary/ReactionSummary";
import PostPhotos from "./PostPhotos";
import PostGif from "./PostGif";
import { formatCount, formatPostTime, splitLinks } from "../../../utils/community";
import styles from "./PostCard.module.css";

/* Spec §3 "Text": folds after POST_FOLD_LINES (6, set in the CSS clamp) behind
   See more, which expands it in place. Whether it overflows is measured, not
   guessed from the length: six lines of a narrow panel hold far less text
   than six lines of a maximised one. */
function PostText({ content }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return undefined;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    // Resizing the panel changes how many lines the text needs.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [content, expanded]);

  return (
    <>
      <div ref={ref} className={`${styles.text} ${expanded ? "" : styles.folded}`}>
        {splitLinks(content).map((run, i) =>
          run.href ? (
            <a
              key={i}
              href={run.href}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className={styles.link}
            >
              {run.text}
            </a>
          ) : (
            <React.Fragment key={i}>{run.text}</React.Fragment>
          ),
        )}
      </div>
      {overflows && !expanded && (
        <button type="button" className={styles.seeMore} onClick={() => setExpanded(true)}>
          See more
        </button>
      )}
    </>
  );
}

function PostCard({ post, onReact }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const profile = `/user/${post.author_id}`;
  const time = formatPostTime(post.created_at);

  const react = (emoji) => onReact(post.id, emoji);

  return (
    <article className={styles.card} aria-label={`Post by ${post.author_name}`}>
      <Link to={profile} className={styles.avatarLink} aria-label={post.author_name} tabIndex={-1}>
        <AvatarImg
          src={post.author_avatar}
          name={post.author_name}
          size={40}
          className={styles.avatar}
        />
      </Link>

      <div className={styles.body}>
        <header className={styles.header}>
          <div className={styles.author}>
            <Link to={profile} className={styles.name}>
              {post.author_name}
            </Link>
            <span className={styles.meta}>
              @{post.author_username} · {post.author_university}
              {time && (
                <>
                  {" · "}
                  <time dateTime={post.created_at} title={new Date(post.created_at).toLocaleString()}>
                    {time}
                  </time>
                </>
              )}
            </span>
          </div>
          {/* Part 3 (CC-N4c) fills this menu: Report, and Delete for your own. */}
          <button type="button" className={styles.moreBtn} aria-label="More options">
            <Ellipsis size={18} aria-hidden="true" />
          </button>
        </header>

        {post.content && <PostText content={post.content} />}

        {post.image_urls?.length > 0 && (
          <PostPhotos
            urls={post.image_urls}
            authorName={post.author_name}
            onOpen={setLightboxIndex}
          />
        )}

        {post.gif && <PostGif gif={post.gif} />}

        {post.reactions_total > 0 && (
          <div className={styles.summaryRow}>
            <ReactionSummary
              counts={post.reaction_counts}
              total={post.reactions_total}
              mine={post.viewer_reaction}
              onReact={react}
            />
          </div>
        )}

        <div className={styles.actions}>
          <ReactionBar reaction={post.viewer_reaction} onReact={react} />
          <Link
            to={`/post/${post.id}`}
            className={styles.replies}
            aria-label={`${post.replies_count} ${post.replies_count === 1 ? "reply" : "replies"}`}
          >
            <MessageCircle size={18} aria-hidden="true" />
            <span>{formatCount(post.replies_count)}</span>
          </Link>
        </div>
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={post.image_urls}
          startIndex={lightboxIndex}
          alt={`Photo from ${post.author_name}`}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </article>
  );
}

export default memo(PostCard);
