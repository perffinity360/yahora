// frontend/src/components/community/Composer/Composer.jsx
//
// The composer — docs/design/COMMUNITY_SPEC.md §2: one thin line that opens
// into the full composer, and every result of pressing Post (§2.3). All rules
// live in hooks/useComposer.js; this file is only the look and the wiring.
//
// Props
//   feed            "campus" | "country" | "global" — where the post goes
//   countryName     the country's name, for a country feed ("India")
//   viewer          { username, campus, name?, avatar? }
//   showAvatar      the avatar inside the line; off on a laptop, where the page
//                   shows one shared avatar on the panels' divider
//   parentId        set for a reply: always open, text and a GIF, no photos
//   replyToUsername the parent post's author, for the reply's grey text
//   autoFocus       put the cursor in the text on mount
//   onCancelReply   optional () — shows the ✕ on "Replying to", and is called
//                   when an empty reply is left
//   onSubmit        (formData, { confirm }) → Promise<{ status, body }>
//   onPosted        optional (post) — a 201, so the feed can show it on top

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUp,
  GraduationCap,
  Globe,
  ImagePlus,
  Loader2,
  MessageCircleWarning,
  Smile,
  X,
} from "lucide-react";
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

/* Spec §2.2, where the post goes: an icon, or the country's name. */
function Destination({ feed, countryName }) {
  if (feed === "country") return <span className={styles.chip}>{countryName}</span>;
  const [Icon, label] = feed === "global" ? [Globe, "Global"] : [GraduationCap, "Campus"];
  return (
    <span className={`${styles.chip} ${styles.chipIcon}`} role="img" aria-label={`Posting to ${label}`} title={label}>
      <Icon size={13} aria-hidden="true" />
    </span>
  );
}

export default function Composer({
  feed = "campus",
  countryName = "",
  viewer,
  showAvatar = true,
  parentId = null,
  replyToUsername,
  autoFocus = false,
  onCancelReply,
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
  const rootRef = useRef(null);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);
  const selection = useRef({ start: 0, end: 0 });

  const placeholder = placeholderFor(feed, countryName, isReply, replyToUsername);
  const isEmpty = c.text.trim() === "" && c.photos.length === 0 && !c.gif;

  // The textarea grows with the text (spec §2.2).
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [c.text, open]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus({ preventScroll: true });
    // A new reply target puts the cursor back in the reply.
  }, [autoFocus, parentId]);

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

  const leave = () => {
    if (isReply) onCancelReply?.();
    else setOpen(false);
  };

  // Pressing elsewhere folds an EMPTY composer back to its line, so it gives
  // the feed its room back. Anything written stays open: text is never lost.
  useEffect(() => {
    if (!open || !isEmpty || picker || c.result) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) leave();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, isEmpty, picker, c.result]);

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

  const onTextKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (c.canPost) post();
    } else if (e.key === "Escape" && isEmpty) {
      e.currentTarget.blur();
      leave();
    }
  };

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

  const postLabel = isReply ? "Reply" : "Post";

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={`${styles.shell} ${open ? styles.shellOpen : ""}`}>
        {/* Always visible once open: seeing your own name is the cheapest
            moderation. */}
        <div className={`${styles.reveal} ${open ? styles.revealOpen : ""}`} inert={!open}>
          <div className={styles.revealInner}>
            <div className={styles.topLine}>
              <p className={styles.postingAs}>
                Posting as @{viewer?.username} · {viewer?.campus}
              </p>
              {isReply && onCancelReply && (
                <span className={styles.replyChip}>
                  <span className={styles.replyChipName}>Replying to @{replyToUsername}</span>
                  <button
                    type="button"
                    className={styles.replyCancel}
                    onClick={onCancelReply}
                    aria-label="Cancel the reply"
                    title="Cancel"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.inputRow}>
          {showAvatar && (
            <AvatarImg
              src={viewer?.avatar}
              name={viewer?.name || viewer?.username}
              size={24}
              className={styles.avatar}
            />
          )}
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={c.text}
            placeholder={placeholder}
            rows={1}
            aria-label={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              c.setText(e.target.value);
              rememberSelection();
            }}
            onKeyDown={onTextKeyDown}
            onSelect={rememberSelection}
            onKeyUp={rememberSelection}
            onClick={rememberSelection}
          />
        </div>

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
                  <X size={12} aria-hidden="true" />
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
              <X size={12} aria-hidden="true" />
            </button>
          </div>
        )}

        {inlineMessage && (
          <p className={styles.inlineMessage} role="alert">
            {inlineMessage}
          </p>
        )}

        <div className={`${styles.reveal} ${open ? styles.revealOpen : ""}`} inert={!open}>
          <div className={styles.revealInner}>
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
                      <ImagePlus size={16} aria-hidden="true" />
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
                  <Smile size={16} aria-hidden="true" />
                </button>
              </div>

              {!isReply && <Destination feed={feed} countryName={countryName} />}

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
                aria-label={c.posting ? "Posting" : postLabel}
                title={postLabel}
              >
                {c.posting ? (
                  <Loader2 size={14} className={styles.spinner} aria-hidden="true" />
                ) : (
                  <ArrowUp size={15} strokeWidth={2.5} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

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

      <AppToast toast={toast} bottom={40} />
    </div>
  );
}
