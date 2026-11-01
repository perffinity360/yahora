// frontend/src/components/community/ReactionBar/EmojiPickerPopover.jsx
//
// The full emoji picker (spec §5.2): a search box, Frequently used (the
// library remembers it in this browser's localStorage), then every category
// with its tabs. Styled with our tokens in the .module.css next to this file.
//
// Two ways to show it:
//   · EmojiPickerPanel   — the picker on its own, for a caller that already
//                          has a popover (the quick bar opens it under its
//                          own emojis, so they stay where they were);
//   · EmojiPickerPopover — the picker in its own popover (the breakdown's ⊕).
//
// The library is loaded on first open, not with the page: most visits never
// press ⊕, and it is the biggest thing on the Community page.

import React, { Suspense, lazy, useState } from "react";
import Popover from "../Popover/Popover";
import styles from "./ReactionBar.module.css";

const EmojiPicker = lazy(() => import("emoji-picker-react"));

const MAX_HEIGHT = 400;
const MIN_HEIGHT = 260;

/* 400 px, or less on a short window so the whole picker fits on screen. */
const fitHeight = () => Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, window.innerHeight - 32));

/** `height` when the caller has already worked out the room it has. */
export function EmojiPickerPanel({ onPick, height: wanted }) {
  const [height] = useState(() => wanted ?? fitHeight());

  return (
    <div className={styles.pickerShell}>
      <Suspense fallback={<div className={styles.pickerLoading} style={{ height }} aria-hidden="true" />}>
        <EmojiPicker
          className={styles.picker}
          width={340}
          height={height}
          searchPlaceholder="Search emoji"
          suggestedEmojisMode="frequent"
          previewConfig={{ showPreview: false }}
          lazyLoadEmojis
          autoFocusSearch
          onEmojiClick={(data) => onPick(data.emoji)}
        />
      </Suspense>
    </div>
  );
}

export default function EmojiPickerPopover({ anchorEl, onPick, onClose, placement = "bottom" }) {
  return (
    <Popover anchorEl={anchorEl} placement={placement} onClose={onClose} ariaLabel="Choose an emoji">
      <EmojiPickerPanel onPick={onPick} />
    </Popover>
  );
}
