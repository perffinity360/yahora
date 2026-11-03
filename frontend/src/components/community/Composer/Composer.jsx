// frontend/src/components/community/Composer/Composer.jsx
//
// The composer — docs/design/COMMUNITY_SPEC.md §2: the closed row, the open
// composer, and every result of pressing Post (§2.3). All rules live in
// hooks/useComposer.js; this file is only the look and the wiring.
//
// Props
//   feed            "campus" | "country" | "global" — where the post goes
//   countryName     the country's name, for a country feed ("India")
//   viewer          { username, campus, name?, avatar? }
//   parentId        set for a reply: always open, text and a GIF, no photos
//   replyToUsername the parent post's author, for the reply's grey text
//   onSubmit        (formData, { confirm }) → Promise<{ status, body }>
//   onPosted        optional (post) — a 201, so the feed can show it on top

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, MessageCircleWarning, Smile, X } from "lucide-react";
import AvatarImg from "../../AvatarImg/AvatarImg";
import AppToast, { useToast } from "../../AppToast/AppToast";
import ConfirmDialog from "../../ConfirmDialog/ConfirmDialog";
import Popover from "../Popover/Popover";
import EmojiPickerPopover from "../ReactionBar/EmojiPickerPopover";
import GifPicker from "../GifPicker/GifPicker";
import SupportCard from "./SupportCard";
import useComposer, { COMPOSER_TEXT } from "../../../hooks/useComposer";
import styles from "./Composer.module.css";

/* Spec §2.1 (and §4 for a reply). */
function placeholderFor(feed, countryName, isReply, replyToUsername) {
  if (isReply) return `Reply to @${replyToUsername ?? ""}…`;
  if (feed === "country") return `Share with students in ${countryName}`;
  if (feed === "global") return "Share with students everywhere";
  return "What's happening on campus?";
}

/* Spec §2.2, the destination chip. */
function chipFor(feed, countryName) {
  if (feed === "country") return countryName;
  if (feed === "global") return "Global";
  return "Campus";
}

export default function Composer({
  feed = "campus",
  countryName = "",
  viewer,
  parentId = null,
  replyToUsername,
  onSubmit,
  onPosted,
}) {
  const c = useComposer({ scope: feed, parentId });
  const isReply = c.isReply;
  const [open, setOpen] = useState(isReply);
  const [gifAnchor, setGifAnchor] = useState(null);
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const [picker, setPicker] = useState(null); // null | "gif" | "emoji"
  const { toast, showToast } = useToast();
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const selection = useRef({ start: 0, end: 0 });

  const placeholder = placeholderFor(feed, countryName, isReply, replyToUsername);

  // The textarea grows with the text (spec §2.2).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [c.text, open]);

  // The results that are a moment, not a state: show, then let go.
  useEffect(() => {
    if (c.result === "posted") {
      if (c.post) onPosted?.(c.post);
      if (!isReply) setOpen(false);
      c.dismissResult();
    } else if (c.result === "held") {
      showToast(COMPOSER_TEXT.held);
      if (!isReply) setOpen(false);
      c.dismissResult();
    } else if (c.result === "error") {
      showToast(COMPOSER_TEXT.error);
      c.dismissResult();
    }
    // Keyed on the result alone: each new result runs this once, and c.post
    // and onPosted are read as they are at that moment.
  }, [c.result]);

  const rememberSelection = () => {
    const el = textareaRef.current;
    if (el) selection.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const insertEmoji = (emoji) => {
    const { start, end } = selection.current;
    const caret = c.insertText(emoji, start, end);
    selection.current = { start: caret, end: caret };
  };

  const closePicker = () => {
    const wasEmoji = picker === "emoji";
    setPicker(null);
    if (wasEmoji) {
      // Back to the text, with the cursor after what was inserted.
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(selection.current.start, selection.current.end);
      });
    }
  };

  const post = () => c.submit(onSubmit);

  const inlineMessage =
    c.result === "rate-limited"
      ? COMPOSER_TEXT.rateLimited
      : c.result === "not-allowed"
        ? COMPOSER_TEXT.notAllowed
        : c.result === "invalid"
          ? c.message
          : c.photoError;

  // Spec §2.4 takes the composer's place until it is closed.
  if (c.result === "support") {
    return (
      <div className={styles.root}>
        <SupportCard onClose={c.dismissResult} />
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {!open ? (
        // Spec §2.1: the closed row.
        <button
          type="button"
          className={styles.closed}
          onClick={() => {
            setOpen(true);
            requestAnimationFrame(() => textareaRef.current?.focus());
          }}
        >
          <AvatarImg
            src={viewer?.avatar}
            name={viewer?.name || viewer?.username}
            size={32}
            className={styles.avatar}
          />
          <span>{placeholder}</span>
        </button>
      ) : (
        <div className={styles.open}>
          {/* Always visible: seeing your own name is the cheapest moderation. */}
          <p className={styles.postingAs}>
            Posting as @{viewer?.username} · {viewer?.campus}
          </p>

          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={c.text}
            placeholder={placeholder}
            rows={isReply ? 1 : 3}
            aria-label={placeholder}
            onChange={(e) => {
              c.setText(e.target.value);
              rememberSelection();
            }}
            onSelect={rememberSelection}
            onKeyUp={rememberSelection}
            onClick={rememberSelection}
          />

          {c.photos.length > 0 && (
            <ul className={styles.previews}>
              {c.photos.map((p, i) => (
                <li key={p.id} className={styles.preview}>
                  <img src={p.url} alt={`Photo ${i + 1}`} />
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => c.removePhoto(p.id)}
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {c.gif && (
            <div className={styles.gifPreview}>
              <img src={c.gif.preview_url} alt="Chosen GIF" />
              <span className={styles.gifBadge} aria-hidden="true">GIF</span>
              <button
                type="button"
                className={styles.remove}
                onClick={c.removeGif}
                aria-label="Remove the GIF"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}

          {inlineMessage && (
            <p className={styles.inlineMessage} role="alert">
              {inlineMessage}
            </p>
          )}

          <div className={styles.toolbar}>
            <div className={styles.tools}>
              {!isReply && (
                <>
                  <button
                    type="button"
                    className={styles.tool}
                    aria-disabled={Boolean(c.photosBlocked)}
                    // A title on an aria-disabled (not disabled) button still
                    // shows, so the hint explains why it's off (spec §2.2).
                    title={c.photosBlocked ?? "Add photos"}
                    aria-label={c.photosBlocked ?? "Add photos"}
                    onClick={() => !c.photosBlocked && fileRef.current?.click()}
                  >
                    <ImagePlus size={20} aria-hidden="true" />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={(e) => {
                      c.addPhotos(e.target.files);
                      e.target.value = ""; // so picking the same file again still fires
                    }}
                  />
                </>
              )}
              <button
                ref={setGifAnchor}
                type="button"
                className={`${styles.tool} ${styles.gifTool}`}
                aria-disabled={Boolean(c.gifBlocked)}
                title={c.gifBlocked ?? "Add a GIF"}
                aria-label={c.gifBlocked ?? "Add a GIF"}
                aria-expanded={picker === "gif"}
                onClick={() => !c.gifBlocked && setPicker((p) => (p === "gif" ? null : "gif"))}
              >
                GIF
              </button>
              <button
                ref={setEmojiAnchor}
                type="button"
                className={styles.tool}
                title="Add an emoji"
                aria-label="Add an emoji"
                aria-expanded={picker === "emoji"}
                onClick={() => {
                  rememberSelection();
                  setPicker((p) => (p === "emoji" ? null : "emoji"));
                }}
              >
                <Smile size={20} aria-hidden="true" />
              </button>
            </div>

            {!isReply && <span className={styles.chip}>{chipFor(feed, countryName)}</span>}

            {c.showCounter && (
              <span
                className={`${styles.counter} ${c.remaining <= 0 ? styles.counterOver : ""}`}
                aria-live="polite"
                aria-label={`${c.remaining} characters left`}
              >
                {c.remaining}
              </span>
            )}

            <button
              type="button"
              className={styles.post}
              disabled={!c.canPost}
              onClick={post}
              aria-busy={c.posting}
            >
              {c.posting ? (
                <Loader2 size={16} className={styles.spinner} aria-label="Posting" />
              ) : isReply ? (
                "Reply"
              ) : (
                "Post"
              )}
            </button>
          </div>
        </div>
      )}

      {picker === "gif" && (
        <Popover anchorEl={gifAnchor} placement="top" onClose={closePicker} role="presentation">
          <GifPicker
            onPick={(gif) => {
              c.attachGif(gif);
              setPicker(null);
            }}
            onClose={closePicker}
          />
        </Popover>
      )}

      {picker === "emoji" && (
        <EmojiPickerPopover anchorEl={emojiAnchor} placement="top" onPick={insertEmoji} onClose={closePicker} />
      )}

      {c.result === "nudge" && (
        // Spec §2.3: Edit is the primary button and keeps everything; Post
        // anyway re-sends with confirm=true.
        <ConfirmDialog
          title="Post this?"
          message="Some of this might come across as hurtful to other students. You can edit it, or post it as it is."
          confirmLabel="Post anyway"
          cancelLabel="Edit"
          primary="cancel"
          Icon={MessageCircleWarning}
          busy={c.posting}
          busyLabel="Posting…"
          onConfirm={c.confirmNudge}
          onCancel={() => {
            c.dismissResult();
            requestAnimationFrame(() => textareaRef.current?.focus());
          }}
        />
      )}

      <AppToast toast={toast} bottom={8} />
    </div>
  );
}
