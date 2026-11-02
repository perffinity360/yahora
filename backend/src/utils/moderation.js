// backend/src/utils/moderation.js
// ══════════════════════════════════════════════
// OWNER: VISHWAJEET   —   added in Phase 7 (Block V-A)
// Neeraj: please import from this file; do not edit it.
// ══════════════════════════════════════════════
//
// The automatic check on every post and reply, before it is saved (runbook §1.6).
// A temporary setup for Phase 7: a full moderation stack comes later.
//
// Nothing becomes public unchecked. If any part of a post can't be checked, the
// answer is `hold` with `checked: false`, and a later job checks it again.
import sharp from 'sharp';

const MODERATION_URL = 'https://api.openai.com/v1/moderations';
const MODERATION_MODEL = 'omni-moderation-latest';
const DEFAULT_TIMEOUT_MS = 3000;
const PHOTO_MAX_SIDE = 768;
const PHOTO_JPEG_QUALITY = 80;
const PHOTO_FORMATS = new Set(['jpeg', 'png', 'webp']);

/**
 * Each part of a post is judged on its own, by the group for its kind. A nudge also
 * happens when OpenAI's result says `flagged`. This is the one place to tune them.
 */
export const MODERATION_THRESHOLDS = {
  text: {
    hold: {
      'sexual/minors': 0.2,
      'harassment/threatening': 0.2,
      'hate/threatening': 0.7,
      'violence/graphic': 0.8,
      'illicit/violent': 0.7,
      illicit: 0.25,
      sexual: 0.25,
      'self-harm': 0.4,
      'self-harm/intent': 0.5,
      'self-harm/instructions': 0.5,
    },
    nudge: { illicit: 0.15 },
  },
  image: {
    hold: {
      'self-harm': 0.5,
      'self-harm/intent': 0.5,
      'self-harm/instructions': 0.5,
      violence: 0.3,
      sexual: 0.5,
    },
    nudge: { sexual: 0.2 },
  },
};

const OUTCOMES_MILDEST_FIRST = ['publish', 'nudge', 'hold'];

function notChecked(reason, scores) {
  // The reason only: never the key, the post's text or its photos.
  console.warn(`[moderation] check skipped: ${reason}`);
  return { outcome: 'hold', support: false, categories: [], scores, checked: false };
}

function failureReason(err, timeoutMs) {
  if (err.name === 'AbortError') return `timed out after ${timeoutMs} ms`;
  return err.cause?.code ?? err.name;
}

/** A small copy for the check only. The original buffer is what gets stored and shown. */
function smallCopy(buffer) {
  return sharp(buffer)
    .rotate() // A JPEG copy loses the EXIF orientation, so apply it first.
    .resize({ width: PHOTO_MAX_SIDE, height: PHOTO_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: PHOTO_JPEG_QUALITY })
    .toBuffer();
}

/**
 * True when an upload really is a JPEG, PNG or WebP that decodes all the way through.
 * A photo that can't be read can never be checked, so it would wait at the front of
 * the re-check queue forever. The declared mimetype proves nothing, and reading only
 * the header would pass a cut-off file, so this makes the same copy the check makes.
 */
export async function isReadablePhoto(image) {
  try {
    const { format } = await sharp(image.buffer).metadata();
    if (!PHOTO_FORMATS.has(format)) return false;
    await smallCopy(image.buffer);
    return true;
  } catch {
    return false;
  }
}

async function photoDataUrl(image) {
  try {
    const copy = await smallCopy(image.buffer);
    return `data:image/jpeg;base64,${copy.toString('base64')}`;
  } catch {
    throw Object.assign(new Error('unreadable photo'), { name: 'UnreadablePhoto' });
  }
}

/** One moderation request. Answers `{ result }`, or `{ failure }` with the reason. */
async function requestModeration(input, apiKey, signal) {
  const response = await fetch(MODERATION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODERATION_MODEL, input }),
    signal,
  });
  if (!response.ok) return { failure: `HTTP ${response.status}` };

  const body = await response.json();
  const result = body.results?.[0];
  if (!result?.category_scores) return { failure: 'unexpected response' };
  return { result };
}

/** The outcome of one part, and the categories that caused it. */
function judge(result, { hold, nudge }) {
  const reached = (limits) =>
    Object.entries(limits)
      .filter(([category, threshold]) => (result.category_scores[category] ?? 0) >= threshold)
      .map(([category]) => category);

  const heldBy = reached(hold);
  if (heldBy.length > 0) return { outcome: 'hold', categories: heldBy };

  const flaggedBy = Object.entries(result.categories ?? {})
    .filter(([, isFlagged]) => isFlagged)
    .map(([category]) => category);
  const nudgedBy = [...new Set([...reached(nudge), ...flaggedBy])];
  if (result.flagged || nudgedBy.length > 0) return { outcome: 'nudge', categories: nudgedBy };

  return { outcome: 'publish', categories: [] };
}

/** Checks one part. Never rejects, so one failure can't lose the other parts' scores. */
async function checkPart(buildInput, thresholds, apiKey, signal, timeoutMs) {
  try {
    const input = await buildInput();
    const { result, failure } = await requestModeration(input, apiKey, signal);
    if (failure) return { failure };
    return { ...judge(result, thresholds), scores: result.category_scores };
  } catch (err) {
    return { failure: failureReason(err, timeoutMs) };
  }
}

/**
 * Checks a post's text and photos, each in its own request, because a photo's scores
 * change with the text sent beside it (and OpenAI takes only one image per request).
 * `images` is an array of Multer files ({ buffer, mimetype }), possibly empty. The
 * strictest outcome wins. Never throws.
 *
 * @returns {Promise<{
 *   outcome: 'publish' | 'nudge' | 'hold',
 *   support: boolean,
 *   categories: string[],
 *   scores: { text: object | null, images: Array<object | null> },
 *   checked: boolean,
 * }>}
 */
export async function checkContent({ text, images = [] } = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const scores = { text: null, images: [] };
  let timer;

  try {
    const trimmed = text?.trim() ?? '';
    scores.images = images.map(() => null);

    // A GIF-only post has nothing to send. That is a finished check, not a failed
    // one, so the re-check job doesn't pick the post up every 10 minutes.
    if (!trimmed && images.length === 0) {
      return { outcome: 'publish', support: false, categories: [], scores, checked: true };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return notChecked('OPENAI_API_KEY is not set', scores);

    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), timeoutMs);
    const check = (buildInput, thresholds) =>
      checkPart(buildInput, thresholds, apiKey, controller.signal, timeoutMs);

    const [textPart, photoParts] = await Promise.all([
      trimmed ? check(() => [{ type: 'text', text: trimmed }], MODERATION_THRESHOLDS.text) : null,
      Promise.all(
        images.map((image) =>
          check(
            async () => [{ type: 'image_url', image_url: { url: await photoDataUrl(image) } }],
            MODERATION_THRESHOLDS.image
          )
        )
      ),
    ]);

    scores.text = textPart?.scores ?? null;
    scores.images = photoParts.map((part) => part.scores ?? null);

    // All or nothing: a post with one unread photo has not been checked.
    const parts = textPart ? [textPart, ...photoParts] : photoParts;
    const failed = parts.find((part) => part.failure);
    if (failed) return notChecked(failed.failure, scores);

    const outcome = OUTCOMES_MILDEST_FIRST[
      Math.max(...parts.map((part) => OUTCOMES_MILDEST_FIRST.indexOf(part.outcome)))
    ];
    const categories = [
      ...new Set(parts.filter((part) => part.outcome === outcome).flatMap((part) => part.categories)),
    ];
    const support = outcome === 'hold' && categories.some((category) => category.startsWith('self-harm'));

    return { outcome, support, categories, scores, checked: true };
  } catch (err) {
    return notChecked(failureReason(err, timeoutMs), scores);
  } finally {
    clearTimeout(timer);
  }
}
