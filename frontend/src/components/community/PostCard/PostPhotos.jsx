// frontend/src/components/community/PostCard/PostPhotos.jsx
//
// Spec §3 "Photos": radius 12, 2 px gaps; tapping one opens the image viewer.
//   1 photo  — full width in its own shape, kept between 4:5 and 16:9 and never
//              taller than 480 px;
//   2 photos — two squares side by side;
//   3 photos — one large on the left, two stacked on the right.

import React, { useState } from "react";
import styles from "./PostCard.module.css";

const MIN_RATIO = 4 / 5;
const MAX_RATIO = 16 / 9;

export default function PostPhotos({ urls, authorName, onOpen }) {
  // The single photo's shape is only known once it loads; until then a 4:3
  // box keeps the card from jumping by more than a little.
  const [ratio, setRatio] = useState(4 / 3);
  const count = Math.min(urls.length, 3);
  const layout = count === 1 ? styles.photos1 : count === 2 ? styles.photos2 : styles.photos3;

  return (
    <div
      className={`${styles.photos} ${layout}`}
      style={count === 1 ? { aspectRatio: String(ratio) } : undefined}
    >
      {urls.slice(0, 3).map((url, i) => (
        <button
          key={url + i}
          type="button"
          className={styles.photoBtn}
          aria-label={`Open photo ${i + 1} of ${count}`}
          onClick={() => onOpen(i)}
        >
          <img
            src={url}
            alt={`Photo ${i + 1} from ${authorName}`}
            loading="lazy"
            decoding="async"
            className={styles.photo}
            onLoad={
              count === 1
                ? (e) => {
                    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
                    if (w && h) setRatio(Math.min(Math.max(w / h, MIN_RATIO), MAX_RATIO));
                  }
                : undefined
            }
          />
        </button>
      ))}
    </div>
  );
}
