// frontend/src/components/community/PostCard/PostText.jsx
//
// Spec §3 "Text": folds after POST_FOLD_LINES behind See more, which expands
// it in place. Used by posts and replies. Emoji inside the text are drawn a
// size up (1.28 em, the chat's 18 on 14), because the emoji font draws many of
// them smaller than the letters around them.
//
// It folds with a max-height and overflow: clip (see .folded in the CSS).
//
// Whether it overflows is measured, not guessed from the length: six lines of a
// narrow panel hold far less text than six lines of a maximised one.

import React, { useLayoutEffect, useRef, useState } from "react";
import { splitLinks } from "../../../utils/community";
import { splitEmoji } from "../../../utils/emoji";
import styles from "./PostCard.module.css";

function withEmoji(text) {
  return splitEmoji(text).map((run, i) =>
    run.emoji ? (
      <span key={i} className={styles.emoji}>
        {run.text}
      </span>
    ) : (
      <React.Fragment key={i}>{run.text}</React.Fragment>
    ),
  );
}

/* `unfolded`: the whole text from the start (a post's own page). */
export default function PostText({ content, className = "", unfolded = false }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const [expanded, setExpanded] = useState(unfolded);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner || expanded) return undefined;
    const measure = () => setOverflows(inner.offsetHeight > box.clientHeight + 1);
    measure();
    // Resizing the panel changes how many lines the text needs.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(box);
    ro?.observe(inner);
    return () => ro?.disconnect();
  }, [content, expanded]);

  return (
    <>
      <div ref={boxRef} className={`${styles.text} ${className} ${expanded ? "" : styles.folded}`}>
        <div ref={innerRef}>
          {splitLinks(content).map((run, i) =>
            run.href ? (
              <a
                key={i}
                href={run.href}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className={styles.link}
              >
                {withEmoji(run.text)}
              </a>
            ) : (
              <React.Fragment key={i}>{withEmoji(run.text)}</React.Fragment>
            ),
          )}
        </div>
      </div>
      {overflows && !expanded && (
        <button type="button" className={styles.seeMore} onClick={() => setExpanded(true)}>
          See more
        </button>
      )}
    </>
  );
}
