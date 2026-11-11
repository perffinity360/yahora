// frontend/src/pages/community/api.js
//
// The posts and reports API — backend/API.md, "posts module (Phase 7)" and
// "reports module (Phase 7)". Raw fetch with the session token, the way
// ProductDetail does it. Every route requires the token.
//
// Two kinds of function:
//   · reads and reactions resolve to the parsed JSON, and throw on any
//     answer that isn't 2xx (the screens show "Couldn't load" and a retry);
//   · createPost and report resolve to { status, body } whatever the status,
//     because useComposer and useReport turn each status into its own screen.
//     They reject only when no answer came back at all.
//
// ⚠ Cursors are opaque (runbook §1.3): sent back exactly as received, never
// parsed or built here.

import { API_BASE_URL } from "../../config/urls";
import { FEED_PAGE_SIZE, REPLIES_PAGE_SIZE } from "../../utils/community";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("yahora_session");
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* "?a=1&b=2", leaving out anything null or undefined (a first page has no cursor). */
function query(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

/* A JSON body, or {} for an empty or non-JSON one (a proxy's error page). */
async function readBody(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function getJson(path) {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  const body = await readBody(res);
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function send(method, path, { json, form } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    // FormData sets its own multipart Content-Type, boundary included.
    headers: authHeaders(json !== undefined ? { "Content-Type": "application/json" } : {}),
    body: json !== undefined ? JSON.stringify(json) : form,
  });
  return { status: res.status, body: await readBody(res) };
}

const id = (value) => encodeURIComponent(value);

/** GET /posts/countries → { items: [{ code, name, is_mine }], next_cursor: null } */
export const getCountries = () => getJson("/posts/countries");

/** kind "campus" | "country" | "global" → { items, next_cursor, can_post? }.
    Campus has no sort and no can_post: it is always newest first, and always yours. */
export function getFeed(kind, { country = null, sort = "hot", cursor = null } = {}) {
  if (kind === "campus") {
    return getJson(`/posts/feed/campus${query({ limit: FEED_PAGE_SIZE, cursor })}`);
  }
  if (kind === "country") {
    return getJson(`/posts/feed/country/${id(country)}${query({ sort, limit: FEED_PAGE_SIZE, cursor })}`);
  }
  return getJson(`/posts/feed/global${query({ sort, limit: FEED_PAGE_SIZE, cursor })}`);
}

/** GET /posts/feed/campus/new-count?since= → { count } */
export const getNewCount = (since) => getJson(`/posts/feed/campus/new-count${query({ since })}`);

/** GET /posts/:id → { post, can_reply }. Throws with err.body.error
    POST_UNDER_REVIEW (403), POST_NOT_FOUND (404), POST_DELETED or POST_REMOVED (410). */
export const getPost = (postId) => getJson(`/posts/${id(postId)}`);

/** GET /posts/:id/replies → { items, next_cursor }, oldest first. A feed's
    thread pages by REPLIES_PAGE_SIZE (spec §4); the post's page passes its own. */
export const getReplies = (postId, cursor = null, limit = REPLIES_PAGE_SIZE) =>
  getJson(`/posts/${id(postId)}/replies${query({ limit, cursor })}`);

/** GET /posts/by-user/:userId → { items, next_cursor }, newest first. */
export const getUserPosts = (userId, cursor = null) =>
  getJson(`/posts/by-user/${id(userId)}${query({ limit: FEED_PAGE_SIZE, cursor })}`);

/** POST /posts, multipart (useComposer builds the form) → { status, body }. */
export const createPost = (formData) => send("POST", "/posts", { form: formData });

/** DELETE /posts/:id → { status, body }; 200 { id, deleted: true }. */
export const deletePost = (postId) => send("DELETE", `/posts/${id(postId)}`);

async function reaction(method, postId, emoji) {
  const { status, body } = await send(method, `/posts/${id(postId)}/reaction`, emoji ? { json: { emoji } } : {});
  if (status !== 200) {
    const err = new Error(body.error || `HTTP ${status}`);
    err.status = status;
    err.body = body;
    throw err;
  }
  return body;
}

/** PUT /posts/:id/reaction → { post_id, viewer_reaction, reactions_total, reaction_counts } */
export const react = (postId, emoji) => reaction("PUT", postId, emoji);

/** DELETE /posts/:id/reaction → the same answer, viewer_reaction null. */
export const unreact = (postId) => reaction("DELETE", postId, null);

/** Who you are, for the composer and your avatar: the same dashboard call the
    navbar makes. → the profile ({ username, full_name, avatar_url,
    university, … }), or null without a session or on any error answer. */
export async function getViewerProfile() {
  const userId = localStorage.getItem("yahora_user_id");
  if (!userId || !localStorage.getItem("yahora_session")) return null;
  const res = await fetch(`${API_BASE_URL}/user/${id(userId)}/dashboard`, { headers: authHeaders() });
  if (!res.ok) return null;
  return (await readBody(res)).profile ?? null;
}

/** POST /reports { target_type, target_id, reason, details? } → { status, body }.
    201 { reported: true } whatever the report caused. */
export const report = (body) => send("POST", "/reports", { json: body });
