// frontend/src/components/community/PostCard/PostThread.jsx
//
// The replies under a post — docs/design/COMMUNITY_SPEC.md §4. The most-liked
// replies show by default (`post.top_replies`), then "Show more replies" loads
// the rest in place, oldest first. One rail runs down from the post, curving
// into each reply's avatar.
//
//   · a reply can only be liked (❤️, the default reaction), not given any emoji;
//   · the post's own author gets a highlighted username;
//   · a reply shows the student's username; the campus only if there is room
//     (the @container rule in the CSS) and never in the campus feed.
//
// `moreRequest` is a counter: when it goes up, the next page loads. It lets the
// post's reply button open the thread where the student can't reply.

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Ellipsis, Heart, Loader2 } from "lucide-react";
import AvatarImg from "../../AvatarImg/AvatarImg";
import PostGif from "./PostGif";
import PostText from "./PostText";
import { DEFAULT_REACTION, formatCount, formatPostTime } from "../../../utils/community";
import styles from "./PostCard.module.css";

const ReplyRow = memo(function ReplyRow({ reply, isAuthor, showCampus, onReact }) {
  const [mine, setMine] = useState(reply.viewer_reaction);
  const [total, setTotal] = useState(reply.reactions_total);
  const [popKey, setPopKey] = useState(0);
  const profile = `/user/${reply.author_id}`;
  const time = formatPostTime(reply.created_at);

  const toggleLike = () => {
    const next = mine ? null : DEFAULT_REACTION;
    setMine(next);
    setTotal((t) => Math.max(0, t + (next ? 1 : -1)));
    if (next) setPopKey((k) => k + 1);
    onReact(reply.id, next);
  };

  return (
    <li className={styles.reply}>
      <Link to={profile} className={styles.replyAvatarLink} aria-label={reply.author_username} tabIndex={-1}>
        <AvatarImg src={reply.author_avatar} name={reply.author_name} size={22} className={styles.replyAvatar} />
      </Link>

      <header className={styles.replyHeader}>
        <Link
          to={profile}
          className={`${styles.replyUsername} ${isAuthor ? styles.replyUsernameAuthor : ""}`}
          title={isAuthor ? "Author of this post" : undefined}
        >
          @{reply.author_username}
        </Link>
        {showCampus && <span className={`${styles.meta} ${styles.campus}`}>{reply.author_university}</span>}
        {time && (
          <time className={`${styles.meta} ${styles.time}`} dateTime={reply.created_at}>
            {time}
          </time>
        )}
        <span className={styles.replyTools}>
          <button
            type="button"
            className={`${styles.likeBtn} ${mine ? styles.likeBtnOn : ""}`}
            aria-pressed={Boolean(mine)}
            aria-label={`${total} ${total === 1 ? "like" : "likes"}. ${mine ? "Remove your like" : "Like this reply"}`}
            title={mine ? "Unlike" : "Like"}
            onClick={toggleLike}
          >
            <span key={popKey} className={popKey ? styles.likePop : undefined}>
              <Heart size={13} fill={mine ? "currentColor" : "none"} aria-hidden="true" />
            </span>
            {total > 0 && <span>{formatCount(total)}</span>}
          </button>
          {/* Part 3 (CC-N4c) fills this menu: Report, and Delete for your own. */}
          <button type="button" className={styles.replyMore} aria-label="More options">
            <Ellipsis size={14} aria-hidden="true" />
          </button>
        </span>
      </header>

      {reply.content && <PostText content={reply.content} className={styles.replyText} />}
      {reply.gif && (
        <div className={styles.replyGif}>
          <PostGif gif={reply.gif} />
        </div>
      )}
    </li>
  );
});

export default function PostThread({
  post,
  showCampus,
  onReact,
  loadReplies,
  addedReplies,
  moreRequest = 0,
}) {
  const [loaded, setLoaded] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);

  // The preview, then pages, then what you just wrote. A preview reply comes
  // round again in the oldest-first pages, so each id is kept only once.
  const replies = useMemo(() => {
    const seen = new Set();
    return [...(post.top_replies ?? []), ...loaded, ...(addedReplies ?? [])].filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [post.top_replies, loaded, addedReplies]);

  const hasMore = !exhausted && post.replies_count > replies.length;

  const loadMore = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadReplies(post.id, cursor);
      setLoaded((prev) => [...prev, ...page.items]);
      setCursor(page.next_cursor);
      if (page.next_cursor === null) setExhausted(true);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [loadReplies, post.id, cursor]);

  useEffect(() => {
    if (moreRequest > 0) loadMore();
    // Only a new request loads; loadMore changes with every page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moreRequest]);

  if (replies.length === 0 && !hasMore) return null;

  return (
    <ul className={styles.thread} aria-label="Replies">
      {replies.map((reply) => (
        <ReplyRow
          key={reply.id}
          reply={reply}
          isAuthor={reply.author_id === post.author_id}
          showCampus={showCampus}
          onReact={onReact}
        />
      ))}
      {hasMore && (
        <li className={styles.threadMore}>
          <button type="button" className={styles.showMore} onClick={loadMore} disabled={loading}>
            {loading ? (
              <Loader2 size={13} className={styles.spinner} aria-hidden="true" />
            ) : (
              <ChevronDown size={13} aria-hidden="true" />
            )}
            {failed ? "Couldn't load replies. Try again" : "Show more replies"}
          </button>
        </li>
      )}
    </ul>
  );
}
