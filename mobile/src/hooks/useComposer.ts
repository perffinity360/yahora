import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';

import { emitComposeResult, useCreatePost, type CreatePostAnswer } from './useCommunity';
import type { ApiError } from '../lib/api';
import {
  codePointLength,
  POST_MAX_CHARS,
  POST_MAX_PHOTOS,
  POST_PHOTO_MAX_BYTES,
} from '../lib/community';
import type { GifRef } from '../types';

/**
 * The compose screen's rules — COMMUNITY_SPEC.md §2.2 and §2.3 — with no markup.
 * The website's twin is frontend/src/hooks/useComposer.js; same texts, same
 * states.
 *
 *   · the text, counted in code points (runbook §1.12): the counter shows at
 *     100 or fewer left; Post is off above POST_MAX_CHARS or with nothing to post;
 *   · photos: at most POST_MAX_PHOTOS, JPEG / PNG / WebP, POST_PHOTO_MAX_BYTES
 *     each; or one GIF; never both. A reply takes text and a GIF only;
 *   · submit() and what each answer means (`result`):
 *       201           → the post goes into the caches; the screen closes
 *       202           → `held` (toast on the feed) or `support` (the card here)
 *       422 nudge     → `nudge`: "Post this?"; everything is kept
 *       429           → `rate-limited`, inline; kept
 *       403           → `not-allowed`, inline; kept
 *       400 known     → `invalid`, inline `message`; kept
 *       anything else → `error`: the toast; kept
 *     The text is never thrown away unless the post went through or was held.
 *
 * A half-written post is kept while the app is open, one per destination, so
 * closing the screen and coming back finds it again (spec §4: "a half-written
 * post is kept and comes back afterwards").
 */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const COUNTER_FROM = 100;

export const COMPOSER_TEXT = {
  photoTooBig: 'That photo is bigger than 5 MB.',
  photoType: 'Photos must be JPEG, PNG or WebP.',
  photoCount: `You can add up to ${POST_MAX_PHOTOS} photos.`,
  tooLong: `Posts can be up to ${POST_MAX_CHARS.toLocaleString('en-IN')} characters.`,
  gifBlocked: 'Remove the photos to add a GIF',
  photosBlocked: 'Remove the GIF to add photos',
  rateLimited: "You've reached the posting limit for now. Please try again in a little while.",
  notAllowed: "You can't post in this feed.",
  held: "Thanks — your post is being checked and will appear once it's approved.",
  error: "Couldn't post. Check your connection and try again.",
  noLibrary: "Couldn't open your photos. Please try again.",
} as const;

const INVALID_MESSAGES: Record<string, string> = {
  CONTENT_TOO_LONG: COMPOSER_TEXT.tooLong,
  FILE_TOO_LARGE: COMPOSER_TEXT.photoTooBig,
  INVALID_FILE_TYPE: COMPOSER_TEXT.photoType,
  TOO_MANY_IMAGES: COMPOSER_TEXT.photoCount,
  MEDIA_CONFLICT: COMPOSER_TEXT.gifBlocked,
};

export type ComposerPhoto = { id: number; uri: string; type: string; name: string };
export type ComposerResult =
  | null
  | 'nudge'
  | 'support'
  | 'rate-limited'
  | 'not-allowed'
  | 'invalid'
  | 'error';

type Draft = { text: string; photos: ComposerPhoto[]; gif: GifRef | null };
const drafts = new Map<string, Draft>();
let nextPhotoId = 1;

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/** The asset's real type: the picker's own, else from the file name. */
function typeOf(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType) return asset.mimeType.toLowerCase();
  const ext = (asset.fileName ?? asset.uri).split('?')[0].split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return ext ? `image/${ext}` : '';
}

function sizeOf(asset: ImagePicker.ImagePickerAsset) {
  if (typeof asset.fileSize === 'number') return asset.fileSize;
  try {
    return new File(asset.uri).size ?? 0;
  } catch {
    return 0;
  }
}

export function useComposer({
  scope,
  parentId,
}: {
  scope: 'campus' | 'country' | 'global';
  /** The post being replied to; a reply takes text and a GIF, no photos. */
  parentId: string | null;
}) {
  const isReply = !!parentId;
  const draftKey = parentId ? `reply:${parentId}` : `post:${scope}`;
  const saved = drafts.get(draftKey);
  const [text, setText] = useState(saved?.text ?? '');
  const [photos, setPhotos] = useState<ComposerPhoto[]>(saved?.photos ?? []);
  const [gif, setGif] = useState<GifRef | null>(saved?.gif ?? null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [result, setResult] = useState<ComposerResult>(null);
  const [message, setMessage] = useState<string | null>(null);
  const create = useCreatePost();
  const posting = create.isPending;

  // Keep the draft for next time, until it is sent.
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current) return;
    if (text || photos.length || gif) drafts.set(draftKey, { text, photos, gif });
    else drafts.delete(draftKey);
  }, [draftKey, text, photos, gif]);

  const length = codePointLength(text);
  const remaining = POST_MAX_CHARS - length;
  const hasContent = text.trim() !== '' || photos.length > 0 || gif !== null;
  const canPost = hasContent && remaining >= 0 && !posting;

  // Why a button is off, or null when it's on. The text doubles as the hint.
  const photosBlocked = isReply
    ? "Replies can't have photos"
    : gif
      ? COMPOSER_TEXT.photosBlocked
      : photos.length >= POST_MAX_PHOTOS
        ? COMPOSER_TEXT.photoCount
        : null;
  const gifBlocked = photos.length > 0 ? COMPOSER_TEXT.gifBlocked : null;

  const pickPhotos = useCallback(async () => {
    if (isReply || gif) return;
    const room = POST_MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setPhotoError(COMPOSER_TEXT.photoCount);
      return;
    }
    let picked: ImagePicker.ImagePickerResult;
    try {
      picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: room,
        // Re-encodes the picked photo as JPEG (an iPhone's HEIC included) and
        // keeps most photos well under 5 MB.
        quality: 0.85,
        orderedSelection: true,
      });
    } catch {
      setPhotoError(COMPOSER_TEXT.noLibrary);
      return;
    }
    if (picked.canceled) return;

    const accepted: ComposerPhoto[] = [];
    let error: string | null = null;
    for (const asset of picked.assets) {
      // selectionLimit isn't honoured on every Android version.
      if (accepted.length >= room) {
        error = COMPOSER_TEXT.photoCount;
        break;
      }
      const type = typeOf(asset);
      if (!PHOTO_TYPES.includes(type)) {
        error = COMPOSER_TEXT.photoType;
        continue;
      }
      if (sizeOf(asset) > POST_PHOTO_MAX_BYTES) {
        error = COMPOSER_TEXT.photoTooBig;
        continue;
      }
      const id = nextPhotoId++;
      // A neutral name: never a user id, never the phone's own file name.
      accepted.push({ id, uri: asset.uri, type, name: `photo-${id}.${EXT[type]}` });
    }
    setPhotoError(error);
    if (accepted.length) setPhotos((prev) => [...prev, ...accepted].slice(0, POST_MAX_PHOTOS));
  }, [isReply, gif, photos.length]);

  const removePhoto = useCallback((id: number) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
    setPhotoError(null);
  }, []);

  const attachGif = useCallback((next: GifRef) => {
    setGif(next);
    setPhotoError(null);
  }, []);
  const removeGif = useCallback(() => setGif(null), []);

  /**
   * Send it. Resolves to 'posted' or 'held' when the screen should close (the
   * draft is gone and the feed has been told), or to the result to show here.
   */
  const submit = useCallback(
    async ({ confirm = false }: { confirm?: boolean } = {}): Promise<'posted' | 'held' | ComposerResult> => {
      if (!(hasContent && remaining >= 0) || create.isPending) return null;
      setResult(null);
      setMessage(null);
      let answer: CreatePostAnswer;
      try {
        answer = await create.mutateAsync({
          content: text,
          scope,
          parentId,
          gif,
          photos: photos.map(({ uri, type, name }) => ({ uri, type, name })),
          confirm,
        });
      } catch (err) {
        const e = err as ApiError;
        const code = e?.fromApi ? (e.body?.error as string | undefined) : undefined;
        let next: ComposerResult = 'error';
        if (e?.status === 422 && code === 'MODERATION_NUDGE') next = 'nudge';
        else if (e?.status === 429 && (code === 'RATE_LIMIT_POSTS' || code === 'RATE_LIMIT_REPLIES')) next = 'rate-limited';
        else if (e?.status === 403 && code === 'NOT_ALLOWED_HERE') next = 'not-allowed';
        else if (e?.status === 400 && code && INVALID_MESSAGES[code]) {
          next = 'invalid';
          setMessage(INVALID_MESSAGES[code]);
        }
        setResult(next);
        return next;
      }

      // Through, or held: the draft is done with.
      sentRef.current = true;
      drafts.delete(draftKey);
      if (answer?.held) {
        if (answer.support) {
          setText('');
          setPhotos([]);
          setGif(null);
          setResult('support');
          return 'support';
        }
        emitComposeResult({ kind: 'held' });
        return 'held';
      }
      if (answer?.post) emitComposeResult({ kind: 'posted', post: answer.post });
      return 'posted';
    },
    [hasContent, remaining, create, text, scope, parentId, gif, photos, draftKey],
  );

  /** Close whatever result is showing (Edit after a nudge, or a message). */
  const dismissResult = useCallback(() => {
    setResult(null);
    setMessage(null);
  }, []);

  return {
    isReply,
    text,
    setText: (next: string) => {
      setText(next);
      // A new edit answers the inline messages about the old text.
      if (result === 'invalid' || result === 'rate-limited' || result === 'not-allowed') dismissResult();
    },
    remaining,
    showCounter: remaining <= COUNTER_FROM,
    overLimit: remaining < 0,
    photos,
    pickPhotos,
    removePhoto,
    photoError,
    photosBlocked,
    gif,
    attachGif,
    removeGif,
    gifBlocked,
    canPost,
    posting,
    submit,
    result,
    message,
    dismissResult,
  };
}

/** A half-written post for this destination, if there is one (the dock shows it). */
export function draftFor(scope: 'campus' | 'country' | 'global', parentId?: string | null): string | null {
  const d = drafts.get(parentId ? `reply:${parentId}` : `post:${scope}`);
  if (!d) return null;
  return d.text.trim() || (d.gif ? 'GIF' : d.photos.length ? `${d.photos.length} photo${d.photos.length > 1 ? 's' : ''}` : null);
}
