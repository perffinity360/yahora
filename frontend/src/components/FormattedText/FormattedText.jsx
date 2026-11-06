// frontend/src/components/FormattedText/FormattedText.jsx
//
// Draws text the way WhatsApp does: *bold*, _italic_, ~strike~, `code`,
// ```monospace```, bullets, numbered items and quotes, with links —
// docs/design/TEXT_FORMAT_SPEC.md. The rules live in src/utils/textFormat.js;
// this file is only the look.
//
// It returns one block per line and no container, so it goes inside the
// caller's own text element (a <p> or a <div>) and takes its font and colour.
// Every line keeps its spaces (white-space: pre-wrap), so the caller's
// container doesn't need to.
//
// Props
//   content        the text, exactly as typed
//   renderText     optional (text) → node, for plain runs: the chat uses it to
//                  draw emoji larger. Not used inside code, which stays as is.
//   linkClassName  the caller's look for a link (colours differ per surface)

import React, { Fragment, useMemo } from "react";
import { parseFormatted } from "../../utils/textFormat";
import styles from "./FormattedText.module.css";

const TAGS = { bold: "strong", italic: "em", strike: "s" };
const asIs = (text) => text;

function Nodes({ nodes, renderText, linkClassName }) {
  return nodes.map((node, i) => {
    switch (node.type) {
      case "text":
        return <Fragment key={i}>{renderText(node.text)}</Fragment>;
      case "link":
        return (
          <a
            key={i}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className={`${styles.link} ${linkClassName ?? ""}`}
          >
            {renderText(node.text)}
          </a>
        );
      case "mono":
        return (
          <code key={i} className={styles.mono}>
            {node.text}
          </code>
        );
      case "code":
        return (
          <code key={i} className={styles.code}>
            {node.text}
          </code>
        );
      default: {
        const Tag = TAGS[node.type];
        return (
          <Tag key={i} className={styles[node.type]}>
            <Nodes nodes={node.children} renderText={renderText} linkClassName={linkClassName} />
          </Tag>
        );
      }
    }
  });
}

export default function FormattedText({ content, renderText = asIs, linkClassName }) {
  const lines = useMemo(() => parseFormatted(content), [content]);
  return lines.map((line, i) => {
    // An empty line still takes a line's height.
    const body = line.nodes.length ? (
      <Nodes nodes={line.nodes} renderText={renderText} linkClassName={linkClassName} />
    ) : (
      <br />
    );
    if (line.kind === "bullet" || line.kind === "number") {
      return (
        <span key={i} className={`${styles.line} ${styles.item}`}>
          <span className={styles.marker}>{line.kind === "bullet" ? "•" : line.marker}</span>
          <span className={styles.itemText}>{body}</span>
        </span>
      );
    }
    return (
      <span key={i} className={`${styles.line} ${line.kind === "quote" ? styles.quote : ""}`}>
        {body}
      </span>
    );
  });
}
