// frontend/src/components/community/ProfileHover/ProfileHover.jsx
//
// A glimpse of someone's profile while the mouse rests on their username or
// avatar — docs/design/COMMUNITY_SPEC.md §4.1, after Instagram's. It wraps the
// link it belongs to:
//
//   <ProfileHover person={…} loadProfile={…}><Link …>@priya.nair</Link></ProfileHover>
//
// The photo, username and campus come with the post. The counts and the
// latest photos load (loadProfile) from the moment the mouse arrives, and the
// card waits for them, photos decoded, before it opens, so it opens once at its
// final size (owner, 10 Nov: a card that opened and then grew as its photos
// came in flickered). If they take longer than MAX_WAIT_MS it opens anyway,
// with a shimmer. The photos are a small gallery grid, four across, like a
// phone's.
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
/** How long past HOVER_OPEN_MS the card waits for the counts and photos. */
const MAX_WAIT_MS = 700;
/** How long a loaded profile is reused before it is asked for again. */
const CACHE_MS = 60_000;
// The card at its tallest, with two rows of photos (ProfileHover.module.css):
// padding 28 + head 57 + stats 71 + photos 139 + buttons 44. Only used when it
// opens before its profile arrived (MAX_WAIT_MS): the Popover then picks above
// or below for this height at once, so the card never jumps sides as it grows.
const CARD_MAX_HEIGHT = 340;

/* Loaded profiles by person id: { promise, data, failed, at }. Shared by every
   username, so the same person's card opens at once the second time. */
const profiles = new Map();

function decodePhotos(urls) {
  return Promise.all(
    urls.map((url) => {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      // decode() settles once the photo can be painted without a blank frame.
      return img.decode().catch(() => {});
    }),
  );
}

function fetchProfile(id, loadProfile) {
  const cached = profiles.get(id);
  if (cached && !cached.failed && Date.now() - cached.at < CACHE_MS) return cached;
  const entry = { data: null, failed: false, at: Date.now() };
  entry.promise = Promise.resolve(loadProfile?.(id))
    .then(async (d) => {
      await decodePhotos((d?.recent_photos ?? []).slice(0, MAX_PHOTOS));
      entry.data = d ?? null;
    })
    .catch(() => {
      entry.failed = true;
    });
  profiles.set(id, entry);
  return entry;
}

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

function ProfileCard({ person, entry }) {
  const [data, setData] = useState(entry.data);
  const [failed, setFailed] = useState(entry.failed);
  const [soon, setSoon] = useState(false);
  const isMe = person.id === localStorage.getItem("yahora_user_id");

  useEffect(() => {
    if (!soon) return undefined;
    const t = setTimeout(() => setSoon(false), SOON_MS);
    return () => clearTimeout(t);
  }, [soon]);

  // Only when it opened before the profile arrived (MAX_WAIT_MS).
  useEffect(() => {
    let alive = true;
    entry.promise.then(() => {
      if (!alive) return;
      setData(entry.data);
      setFailed(entry.failed);
    });
    return () => {
      alive = false;
    };
  }, [entry]);

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
            // Not lazy: the card is placed off screen for its first frame, and a
            // lazy photo waited for that, then painted a frame late.
            <img key={url + i} src={url} alt="" className={styles.photo} />
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
  const [open, setOpen] = useState(null); // null | { anchor, entry }
  const openTimer = useRef(null);
  const waitTimer = useRef(null);
  const closeTimer = useRef(null);
  const attempt = useRef(0); // bumped on leave, so a late profile can't open it

  useEffect(
    () => () => {
      clearTimeout(openTimer.current);
      clearTimeout(waitTimer.current);
      clearTimeout(closeTimer.current);
    },
    [],
  );

  const stay = () => clearTimeout(closeTimer.current);
  const leave = () => {
    attempt.current += 1;
    clearTimeout(openTimer.current);
    clearTimeout(waitTimer.current);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(null), HOVER_CLOSE_MS);
  };
  const enter = (e) => {
    if (e.pointerType !== "mouse") return;
    stay();
    if (open) return;
    const anchor = e.currentTarget;
    const entry = fetchProfile(person.id, loadProfile);
    const mine = ++attempt.current;
    const show = () => {
      if (attempt.current !== mine) return;
      clearTimeout(waitTimer.current);
      setOpen((o) => o ?? { anchor, entry });
    };
    clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => {
      if (entry.data || entry.failed) return show();
      entry.promise.then(show);
      waitTimer.current = setTimeout(show, MAX_WAIT_MS);
    }, HOVER_OPEN_MS);
  };

  if (!person?.id) return children;

  return (
    <>
      {cloneElement(children, { onPointerEnter: enter, onPointerLeave: leave })}
      {open && (
        <Popover
          anchorEl={open.anchor}
          placement="bottom"
          reserveHeight={open.entry.data || open.entry.failed ? 0 : CARD_MAX_HEIGHT}
          onClose={() => setOpen(null)}
          onPointerEnter={stay}
          onPointerLeave={leave}
          ariaLabel={`@${person.username}'s profile`}
        >
          <ProfileCard person={person} entry={open.entry} />
        </Popover>
      )}
    </>
  );
}
