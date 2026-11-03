// frontend/src/hooks/useComposer.js
//
// The composer's behaviour — spec §2.2 and §2.3 — with no markup, so the
// composer's look can change without touching any rule here:
//   · the text, counted in code points (runbook §1.12); the counter shows at
//     100 or fewer left, and Post is off above POST_MAX_CHARS;
//   · photos: at most POST_MAX_PHOTOS, JPEG / PNG / WebP, POST_PHOTO_MAX_BYTES
//     each; or one GIF; never both;
//   · submit(onSubmit) and what the answer means.
//
// `onSubmit` is passed in from outside: the dev sandbox passes a sample
// answer, CC-N4b passes the real POST /api/posts. The hook builds the
// multipart body (runbook Appendix A) and calls
//
//   onSubmit(formData, { confirm }) → Promise<{ status, body }>
//
// with `status` the HTTP status and `body` the parsed JSON. A rejected promise
// means the request never got an answer (network down, server unreachable).
//
// The answer becomes `result`, one of spec §2.3's states:
//   null           nothing to show
//   "posted"       201 — cleared; `post` holds the new post
//   "nudge"        422 MODERATION_NUDGE — the "Post this?" question; kept
//   "held"         202 — the "being checked" message; cleared
//   "support"      202 with support: true — the support card; cleared
//   "rate-limited" 429 RATE_LIMIT_POSTS / RATE_LIMIT_REPLIES — inline; kept
//   "not-allowed"  403 NOT_ALLOWED_HERE — inline; kept
//   "invalid"      400 too long / bad file — inline `message`; kept
//   "error"        anything else, or no answer — the toast; kept
// Spec §2.3: the text is never thrown away unless the post succeeded or was held.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  POST_MAX_CHARS,
  POST_MAX_PHOTOS,
  POST_PHOTO_MAX_BYTES,
  codePointLength,
} from "../utils/community";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const COUNTER_FROM = 100;

/* Spec §2.2. The first is the spec's own text; the type and count texts are
   not in the spec yet — the redesign should add them there (V-P). */
export const COMPOSER_TEXT = {
  photoTooBig: "That photo is bigger than 5 MB.",
  photoType: "Photos must be JPEG, PNG or WebP.",
  photoCount: `You can add up to ${POST_MAX_PHOTOS} photos.`,
  tooLong: `Posts can be up to ${POST_MAX_CHARS.toLocaleString("en-IN")} characters.`,
  gifBlocked: "Remove the photos to add a GIF",
  photosBlocked: "Remove the GIF to add photos",
  rateLimited: "You've reached the posting limit for now. Please try again in a little while.",
  notAllowed: "You can't post in this feed.",
  held: "Thanks — your post is being checked and will appear once it's approved.",
  error: "Couldn't post. Check your connection and try again.",
};

const INVALID_MESSAGES = {
  CONTENT_TOO_LONG: COMPOSER_TEXT.tooLong,
  FILE_TOO_LARGE: COMPOSER_TEXT.photoTooBig,
  INVALID_FILE_TYPE: COMPOSER_TEXT.photoType,
  TOO_MANY_IMAGES: COMPOSER_TEXT.photoCount,
  MEDIA_CONFLICT: COMPOSER_TEXT.gifBlocked,
};

let nextPhotoId = 1;

/**
 * scope: "campus" | "country" | "global" (ignored for a reply);
 * parentId: the post being replied to — a reply takes text and a GIF, no photos.
 */
export default function useComposer({ scope = "campus", parentId = null } = {}) {
  const isReply = Boolean(parentId);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState([]); // [{ id, file, url }]
  const [gif, setGif] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState(null);
  const [post, setPost] = useState(null);
  const lastSubmit = useRef(null);

  // Object URLs for previews are released when a photo goes, and on unmount.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const length = codePointLength(text);
  const remaining = POST_MAX_CHARS - length;
  const hasContent = text.trim() !== "" || photos.length > 0 || gif !== null;

  // Why a button is off, or null when it's on. The text doubles as the hint.
  const photosBlocked = isReply
    ? "Replies can't have photos"
    : gif
      ? COMPOSER_TEXT.photosBlocked
      : photos.length >= POST_MAX_PHOTOS
        ? COMPOSER_TEXT.photoCount
        : null;
  const gifBlocked = photos.length > 0 ? COMPOSER_TEXT.gifBlocked : null;

  const addPhotos = useCallback(
    (fileList) => {
      if (isReply || gif) return;
      const files = [...(fileList ?? [])];
      const accepted = [];
      let error = null;
      for (const file of files) {
        if (photosRef.current.length + accepted.length >= POST_MAX_PHOTOS) {
          error = COMPOSER_TEXT.photoCount;
          break;
        }
        if (!PHOTO_TYPES.includes(file.type)) {
          error = COMPOSER_TEXT.photoType;
          continue;
        }
        if (file.size > POST_PHOTO_MAX_BYTES) {
          error = COMPOSER_TEXT.photoTooBig;
          continue;
        }
        accepted.push({ id: nextPhotoId++, file, url: URL.createObjectURL(file) });
      }
      setPhotoError(error);
      if (accepted.length) setPhotos((prev) => [...prev, ...accepted]);
    },
    [isReply, gif],
  );

  const removePhoto = useCallback((id) => {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.id !== id);
    });
    setPhotoError(null);
  }, []);

  const attachGif = useCallback((gifRef) => {
    if (photosRef.current.length > 0) return;
    setGif(gifRef);
  }, []);

  const removeGif = useCallback(() => setGif(null), []);

  /* Put `insert` in place of text[start, end) — the emoji button inserts at
     the cursor. Returns where the cursor goes, in UTF-16 units for
     setSelectionRange. */
  const insertText = useCallback(
    (insert, start = text.length, end = start) => {
      setText(text.slice(0, start) + insert + text.slice(end));
      return start + insert.length;
    },
    [text],
  );

  const clear = useCallback(() => {
    photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    setText("");
    setPhotos([]);
    setGif(null);
    setPhotoError(null);
  }, []);

  const canPost = hasContent && remaining >= 0 && !posting;

  const buildForm = (confirm) => {
    const form = new FormData();
    form.append("content", text);
    if (isReply) form.append("parent_post_id", parentId);
    else form.append("scope", scope);
    if (gif) form.append("gif", JSON.stringify(gif));
    photos.forEach((p) => form.append("images", p.file));
    if (confirm) form.append("confirm", "true");
    return form;
  };

  const submit = useCallback(
    async (onSubmit, { confirm = false } = {}) => {
      if (!(hasContent && remaining >= 0) || posting) return null;
      lastSubmit.current = onSubmit;
      setPosting(true);
      setResult(null);
      setMessage(null);
      let next = "error";
      try {
        const { status, body } = (await onSubmit(buildForm(confirm), { confirm })) ?? {};
        const code = body?.error;
        if (status === 201) {
          next = "posted";
          setPost(body?.post ?? null);
          clear();
        } else if (status === 202) {
          next = body?.support ? "support" : "held";
          setPost(body?.post ?? null);
          clear();
        } else if (status === 422 && code === "MODERATION_NUDGE") {
          next = "nudge";
        } else if (status === 429 && (code === "RATE_LIMIT_POSTS" || code === "RATE_LIMIT_REPLIES")) {
          next = "rate-limited";
        } else if (status === 403 && code === "NOT_ALLOWED_HERE") {
          next = "not-allowed";
        } else if (status === 400 && INVALID_MESSAGES[code]) {
          next = "invalid";
          setMessage(INVALID_MESSAGES[code]);
        }
      } catch {
        next = "error";
      } finally {
        setPosting(false);
      }
      setResult(next);
      return next;
    },
    // buildForm reads text, photos, gif, scope and parentId, hence those.
    [hasContent, remaining, posting, text, photos, gif, scope, parentId, clear],
  );

  /** After a nudge: "Post anyway" sends the same post again with confirm. */
  const confirmNudge = useCallback(
    () => (lastSubmit.current ? submit(lastSubmit.current, { confirm: true }) : null),
    [submit],
  );

  /** Close whatever result is showing (Edit after a nudge, Close on the card). */
  const dismissResult = useCallback(() => {
    setResult(null);
    setMessage(null);
  }, []);

  return {
    // text
    text,
    setText,
    insertText,
    length,
    remaining,
    showCounter: remaining <= COUNTER_FROM,
    overLimit: remaining < 0,
    // media
    isReply,
    photos,
    addPhotos,
    removePhoto,
    photoError,
    photosBlocked,
    gif,
    attachGif,
    removeGif,
    gifBlocked,
    // posting
    canPost,
    posting,
    submit,
    confirmNudge,
    result,
    message,
    post,
    dismissResult,
    clear,
  };
}
