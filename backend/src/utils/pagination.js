// backend/src/utils/pagination.js
// ══════════════════════════════════════════════
// OWNER: VISHWAJEET   —   added in Phase 7 (Block V-A)
// Neeraj: please import from this file; do not edit it.
// ══════════════════════════════════════════════
//
// The messages and products modules each keep a private copy of these helpers.
// The posts module is the third user, so they are shared from here. The two
// older copies are deliberately left alone for now.

export const PAGE_LIMIT_DEFAULT = 20;
export const PAGE_LIMIT_MAX = 50;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Date.parse alone is too loose for a value that reaches Postgres: it accepts
// "foo 1", which then fails the timestamptz cast and answers 500 instead of 400.
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:\d{2})?)?$/;

// Number() alone accepts '', '0x10' and 'Infinity'. The exponent has to stay:
// a very small hot_score is written as 1.5e-7.
const NUMBER_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

/** Cap first, then floor — the rule from `user.controller.js -> searchUsers`. */
export function parsePageLimit(raw) {
  const requested = Number.parseInt(raw, 10);
  return Number.isNaN(requested)
    ? PAGE_LIMIT_DEFAULT
    : Math.min(Math.max(requested, 1), PAGE_LIMIT_MAX);
}

/** Absent unless a non-empty string. `?cursor=` and a repeated cursor mean page one. */
export function readCursorParam(raw) {
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

/**
 * Compound cursor, `value|id`, base64url. `value` is what the list sorts on
 * (created_at or hot_score) and `id` breaks ties, because two rows can share a
 * value. base64url because a timestamp's `+00:00` needs escaping in a query string.
 */
export function encodeCursor(value, id) {
  return Buffer.from(`${value}|${id}`, 'utf8').toString('base64url');
}

/**
 * Returns `{ value, id }`, or `null` for anything this API did not issue. `kind`
 * is 'timestamp' (value stays a string, keeping Postgres's microseconds) or
 * 'number' (value is a number). `Buffer.from(..., 'base64url')` does not throw on
 * junk — it drops what it cannot read — so validating both halves is the real
 * check. A `null` here MUST become a 400 INVALID_FORMAT.
 */
export function decodeCursor(raw, kind) {
  if (typeof raw !== 'string') return null;

  const parts = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  if (parts.length !== 2) return null;

  const [value, id] = parts;
  if (!isUuid(id)) return null;

  if (kind === 'timestamp') {
    if (!ISO_TIMESTAMP_RE.test(value) || Number.isNaN(Date.parse(value))) return null;
    return { value, id };
  }

  if (kind === 'number') {
    const parsed = Number(value);
    if (!NUMBER_RE.test(value) || !Number.isFinite(parsed)) return null;
    return { value: parsed, id };
  }

  return null;
}
