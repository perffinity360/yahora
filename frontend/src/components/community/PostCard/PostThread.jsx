// frontend/src/components/community/PostCard/PostThread.jsx
//
// The replies under a post — docs/design/COMMUNITY_SPEC.md §4. The most-liked
// replies show by default (`post.top_replies`), then "Show more replies" loads
// the next REPLIES_PAGE_SIZE in place, oldest first, and comes back while there
// are more. Once it has been pressed, "Hide replies" folds the thread back to
// the preview, and "Show more replies" unfolds it again without reloading.
//
//   · a post with fewer than REPLIES_FOLD_MIN replies never shows the button:
//     the preview already holds them all;
//   · a page that would leave only one or two replies unloaded brings them in
//     too, so the button never stands in for one or two replies;
//   · a reply can only be liked (❤️, the default reaction), not given any emoji;
//   · the post's own author gets a highlighted username;
//   · a reply shows the student's username; the campus only if there is room
//     (the @container rule in the CSS) and never in the campus feed.
//
// One line runs down from the post and curves into each reply's avatar (Rail).
//
// `moreRequest` is a counter: when it goes up, the thread shows more. It lets
// the post's reply button open the thread where the student can't reply.

import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Ellipsis, Heart, Loader2 } from "lucide-react";
import AvatarImg from "../../AvatarImg/AvatarImg";
import PostGif from "./PostGif";
import PostText from "./PostText";
import ProfileHover from "../ProfileHover/ProfileHover";
import {
  DEFAULT_REACTION,
  REPLIES_FOLD_MIN,
  formatCount,
  formatPostTime,
} from "../../../utils/community";
import styles from "./PostCard.module.css";

/* The curve from the line into an avatar: a quarter circle of RAIL_RADIUS
   (the --rail-r in the CSS), then straight on, stopping RAIL_GAP short of the
   avatar 22 px from the line. */
const RAIL_RADIUS = 14;
const RAIL_GAP = 4;
const RAIL_END = 22 - RAIL_GAP;
const BRANCH = `M0 0A${RAIL_RADIUS} ${RAIL_RADIUS} 0 0 0 ${RAIL_RADIUS} ${RAIL_RADIUS}H${RAIL_END}`;

/* Never more rounds than this for one press, whatever the counts say. */
const MAX_PAGES_PER_PRESS = 3;

function distinct(list) {
  const seen = new Set();
  return list.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

/* One row's piece of the line: straight down through the row (only as far as
   the curve, in the last row), and the curve. Each part takes the pointer 3 px
   either side of what you see. */
function Rail() {
  return (
    <>
      <span className={styles.railTrunk} aria-hidden="true" />
      <svg
        className={styles.railBranch}
        width={RAIL_END}
        height={RAIL_RADIUS}
        viewBox={`0 0 ${RAIL_END} ${RAIL_RADIUS}`}
        aria-hidden="true"
        focusable="false"
      >
        <path className={styles.railHit} d={BRANCH} />
        <path className={styles.railLine} d={BRANCH} />
      </svg>
    </>
  );
}

const ReplyRow = memo(function ReplyRow({ reply, isAuthor, showCampus, onReact, loadProfile }) {
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
      <Rail />
      <Link to={profile} className={styles.replyAvatarLink} aria-label={reply.author_username} tabIndex={-1}>
        <AvatarImg src={reply.author_avatar} name={reply.author_name} size={22} className={styles.replyAvatar} />
      </Link>

      <div className={`${styles.replyBody} ${styles.readable}`}>
        <header className={styles.replyHeader}>
          <ProfileHover
            person={{
              id: reply.author_id,
              name: reply.author_name,
              username: reply.author_username,
              avatar: reply.author_avatar,
              campus: reply.author_university,
            }}
            loadProfile={loadProfile}
          >
            <Link
              to={profile}
              className={`${styles.replyUsername} ${isAuthor ? styles.replyUsernameAuthor : ""}`}
            >
              @{reply.author_username}
            </Link>
          </ProfileHover>
          {/* The post's own author, replying (spec §4). */}
          {isAuthor && <span className={styles.authorTag}>Author</span>}
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
                <Heart size={14} fill={mine ? "currentColor" : "none"} aria-hidden="true" />
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
      </div>
    </li>
  );
});

export default function PostThread({
  post,
  showCampus,
  onReact,
  loadReplies,
  loadProfile,
  addedReplies,
  moreRequest = 0,
}) {
  const [loaded, setLoaded] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [exhausted, setExhausted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const moreRowRef = useRef(null);
  const folding = useRef(false);

  // Without top_replies (the API doesn't send it yet, spec §4), a post with
  // fewer than REPLIES_FOLD_MIN replies loads them by itself and shows them
  // as its preview, so the button still never stands in for one or two.
  const previewKnown = Array.isArray(post.top_replies);
  const [selfPreview, setSelfPreview] = useState(false);

  // Folded: the preview and what you just wrote. Unfolded: the pages too. A
  // preview reply comes round again in the oldest-first pages, so each id is
  // kept only once.
  const folded = useMemo(
    () =>
      distinct([...(post.top_replies ?? []), ...(selfPreview ? loaded : []), ...(addedReplies ?? [])]),
    [post.top_replies, selfPreview, loaded, addedReplies],
  );
  const unfolded = useMemo(
    () => distinct([...(post.top_replies ?? []), ...loaded, ...(addedReplies ?? [])]),
    [post.top_replies, loaded, addedReplies],
  );
  const replies = expanded ? unfolded : folded;

  const total = Math.max(post.replies_count ?? 0, unfolded.length);
  const canLoad = !exhausted && total > unfolded.length;
  const hasUnshownLoaded = unfolded.length > folded.length;
  // Spec §4: never for fewer than REPLIES_FOLD_MIN replies.
  const showMore = total >= REPLIES_FOLD_MIN && (expanded ? canLoad : hasUnshownLoaded || canLoad);
  const showHide = expanded && hasUnshownLoaded;

  const loadMore = useCallback(async ({ asPreview = false } = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setFailed(false);
    try {
      let from = cursor;
      let known = unfolded;
      for (let round = 0; round < MAX_PAGES_PER_PRESS; round += 1) {
        const page = await loadReplies(post.id, from);
        known = distinct([...known, ...page.items]);
        from = page.next_cursor;
        setLoaded((prev) => [...prev, ...page.items]);
        setCursor(from);
        if (asPreview) setSelfPreview(true);
        else setExpanded(true);
        if (from === null) {
          setExhausted(true);
          break;
        }
        // One or two left over come in with this press, not behind a button.
        const left = total - known.length;
        if (left <= 0 || left >= REPLIES_FOLD_MIN) break;
      }
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [loadReplies, post.id, cursor, unfolded, total]);

  const fewWithoutPreview =
    !previewKnown && (post.replies_count ?? 0) > 0 && (post.replies_count ?? 0) < REPLIES_FOLD_MIN;
  useEffect(() => {
    if (fewWithoutPreview && !selfPreview) loadMore({ asPreview: true });
    // Once, when such a post appears; loadMore changes with every page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fewWithoutPreview]);

  const onShowMore = () => {
    // Folded with replies already here: unfold them first. The button stays
    // if there are still more to load.
    if (!expanded && hasUnshownLoaded) setExpanded(true);
    else if (canLoad) loadMore();
  };

  const onHide = () => {
    folding.current = true;
    setExpanded(false);
  };

  // Folding a long thread can leave you far below it. Bring its last row
  // back on screen, as little as needed.
  useLayoutEffect(() => {
    if (!folding.current) return;
    folding.current = false;
    moreRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [expanded]);

  useEffect(() => {
    if (moreRequest > 0) onShowMore();
    // Only a new request counts; onShowMore changes with every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moreRequest]);

  if (replies.length === 0 && !showMore) return null;

  return (
    <ul className={styles.thread} aria-label="Replies">
      {replies.map((reply) => (
        <ReplyRow
          key={reply.id}
          reply={reply}
          isAuthor={reply.author_id === post.author_id}
          showCampus={showCampus}
          onReact={onReact}
          loadProfile={loadProfile}
        />
      ))}
      {(showMore || showHide) && (
        <li ref={moreRowRef} className={styles.threadMore}>
          <Rail />
          <div className={styles.threadButtons}>
            {showMore && (
              <button
                type="button"
                className={styles.showMore}
                onClick={onShowMore}
                disabled={loading}
                aria-expanded={expanded}
              >
                {loading ? (
                  <Loader2 size={13} className={styles.spinner} aria-hidden="true" />
                ) : (
                  <ChevronDown size={13} aria-hidden="true" />
                )}
                {failed ? "Couldn't load replies. Try again" : "Show more replies"}
              </button>
            )}
            {showHide && (
              <button type="button" className={`${styles.showMore} ${styles.hideReplies}`} onClick={onHide}>
                <ChevronUp size={13} aria-hidden="true" />
                Hide replies
              </button>
            )}
          </div>
        </li>
      )}
    </ul>
  );
}
