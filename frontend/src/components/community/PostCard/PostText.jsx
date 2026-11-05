// frontend/src/components/community/PostCard/PostText.jsx
//
// Spec §3 "Text": folds after POST_FOLD_LINES behind See more, which expands
// it in place. Used by posts and replies.
//
// It folds with a max-height and overflow: clip (see .folded in the CSS).
//
// Whether it overflows is measured, not guessed from the length: six lines of a
// narrow panel hold far less text than six lines of a maximised one.

import React, { useLayoutEffect, useRef, useState } from "react";
import { splitLinks } from "../../../utils/community";
import styles from "./PostCard.module.css";

export default function PostText({ content, className = "" }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
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
                {run.text}
              </a>
            ) : (
              <React.Fragment key={i}>{run.text}</React.Fragment>
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
