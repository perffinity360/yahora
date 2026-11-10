// frontend/src/components/community/ProfileHover/ProfileHover.jsx
//
// A glimpse of someone's profile while the mouse rests on their username —
// docs/design/COMMUNITY_SPEC.md §4.1, after Instagram's. It wraps the
// username link it belongs to:
//
//   <ProfileHover person={…} loadProfile={…}><Link …>@priya.nair</Link></ProfileHover>
//
// The photo, username and campus come with the post, so they show at
// once; the counts and the latest photos load (loadProfile), with a shimmer
// meanwhile. The photos are a small gallery grid, four across, like a phone's.
// "Follow" is a placeholder until follows exist (it says so when pressed);
// "View profile" opens the profile page.
//
// Mouse only: it opens after resting HOVER_OPEN_MS on the name, and stays while
// the mouse moves onto the card, so its button can be pressed. A touch screen
// has no hover; there a tap on the name opens the profile, as before. Esc, a
// press elsewhere or scrolling the name away closes it (Popover).
//
// person: { id, name, username, avatar, campus }. `name` only picks the
// avatar's initials and colour; no full name is ever shown (owner, 10 Nov).
// loadProfile: (id) → Promise<{ posts_count, followers_count, following_count,
//              recent_photos }>

import React, { cloneElement, useEffect, useRef, useState } from "react";

const MAX_PHOTOS = 8;
const SOON_MS = 1600;
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import AvatarImg from "../../AvatarImg/AvatarImg";
import Popover from "../Popover/Popover";
import { formatCount } from "../../../utils/community";
import styles from "./ProfileHover.module.css";

const HOVER_OPEN_MS = 450;
const HOVER_CLOSE_MS = 180;

function Stat({ value, label }) {
  return (
    <div className={styles.stat}>
      {value == null ? (
        <span className={`${styles.statValue} ${styles.shimmer}`} aria-hidden="true" />
      ) : (
        <span className={styles.statValue}>{formatCount(value)}</span>
      )}
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function ProfileCard({ person, loadProfile }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [soon, setSoon] = useState(false);
  const isMe = person.id === localStorage.getItem("yahora_user_id");

  useEffect(() => {
    if (!soon) return undefined;
    const t = setTimeout(() => setSoon(false), SOON_MS);
    return () => clearTimeout(t);
  }, [soon]);

  useEffect(() => {
    let alive = true;
    loadProfile?.(person.id)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [person.id, loadProfile]);

  const profile = `/user/${person.id}`;
  const photos = (data?.recent_photos ?? []).slice(0, MAX_PHOTOS);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <Link to={profile} className={styles.avatarRing} tabIndex={-1} aria-hidden="true">
          <AvatarImg src={person.avatar} name={person.name} size={52} className={styles.avatar} />
        </Link>
        <div className={styles.who}>
          {/* Usernames only, never full names (owner, 10 Nov). */}
          <Link to={profile} className={styles.username}>
            @{person.username}
          </Link>
          {person.campus && (
            <span className={styles.campus}>
              <GraduationCap size={12} aria-hidden="true" />
              <span>{person.campus}</span>
            </span>
          )}
        </div>
      </div>

      {!failed && (
        <div className={styles.stats}>
          <Stat value={data?.posts_count} label={data?.posts_count === 1 ? "post" : "posts"} />
          <Stat value={data?.followers_count} label="followers" />
          <Stat value={data?.following_count} label="following" />
        </div>
      )}

      {photos.length > 0 && (
        <div className={styles.photos}>
          {photos.map((url, i) => (
            <img key={url + i} src={url} alt="" loading="lazy" decoding="async" className={styles.photo} />
          ))}
        </div>
      )}

      <div className={styles.buttons}>
        {!isMe && (
          // ⚠ Follows aren't built yet (the social module): until they are,
          // the button only says so.
          <button
            type="button"
            className={styles.follow}
            title="Following is coming soon"
            aria-live="polite"
            onClick={() => setSoon(true)}
          >
            {soon ? "Coming soon" : "Follow"}
          </button>
        )}
        <Link to={profile} className={styles.viewProfile}>
          View profile
        </Link>
      </div>
    </div>
  );
}

export default function ProfileHover({ person, loadProfile, children }) {
  const [anchor, setAnchor] = useState(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);

  useEffect(
    () => () => {
      clearTimeout(openTimer.current);
      clearTimeout(closeTimer.current);
    },
    [],
  );

  const stay = () => clearTimeout(closeTimer.current);
  const leave = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setAnchor(null), HOVER_CLOSE_MS);
  };
  const enter = (e) => {
    if (e.pointerType !== "mouse") return;
    stay();
    const el = e.currentTarget;
    clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => setAnchor(el), HOVER_OPEN_MS);
  };

  if (!person?.id) return children;

  return (
    <>
      {cloneElement(children, { onPointerEnter: enter, onPointerLeave: leave })}
      {anchor && (
        <Popover
          anchorEl={anchor}
          placement="bottom"
          onClose={() => setAnchor(null)}
          onPointerEnter={stay}
          onPointerLeave={leave}
          ariaLabel={`@${person.username}'s profile`}
        >
          <ProfileCard person={person} loadProfile={loadProfile} />
        </Popover>
      )}
    </>
  );
}
