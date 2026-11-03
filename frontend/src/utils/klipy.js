/* KLIPY, the GIF provider — runbook §1.9, spec §6. Every KLIPY call lives in
   this file.

   ⚠ This is the ONE place `import.meta.env.VITE_KLIPY_API_KEY` is read
   (CC-N4b, CC-NS). KLIPY's terms say searches run from the student's browser,
   so the key ships to the browser by design (runbook §1.16).

   The API, as it answers (checked against the live test key, 2 Nov 2026):
     GET https://api.klipy.com/api/v1/{key}/gifs/trending?page&per_page&customer_id
     GET https://api.klipy.com/api/v1/{key}/gifs/search?q&page&per_page&customer_id
     200 → { result: true, data: { data: [item…], current_page, per_page, has_next } }
     bad key → 404 { result: false, errors: { message: [ "…" ] } }
   An item is { id, slug, title, type: "gif", file: { hd, md, sm, xs } }, each
   size holding { gif, webp, jpg, mp4, webm }: { url, width, height, size }.

   KLIPY's rules: show its results as they come (no re-ordering, no filtering
   of our own — the content filter is a setting in KLIPY's panel), link to its
   files rather than copying them, and show "Powered by KLIPY". */

const API = "https://api.klipy.com/api/v1";
const PER_PAGE = 24;
const CUSTOMER_KEY = "yahora.klipy.customer_id";

/** Thrown for every failure; the picker shows spec §6's one message for all. */
export class KlipyError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = "KlipyError";
    this.status = status;
  }
}

function apiKey() {
  const key = (import.meta.env.VITE_KLIPY_API_KEY ?? "").trim();
  if (!key) {
    throw new KlipyError("No KLIPY key: set VITE_KLIPY_API_KEY in frontend/.env (runbook §1.16).");
  }
  return key;
}

/* KLIPY asks for a per-user `customer_id` (it powers its "recent" lists).
   We never send the student's real id: a random one, kept in this browser. */
function customerId() {
  try {
    let id = localStorage.getItem(CUSTOMER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CUSTOMER_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked (private mode): a fresh random id for this page load.
    return crypto.randomUUID();
  }
}

/* The first rendition present, in order of preference: WebP is a fraction of
   the GIF's size for the same animation. */
function pick(size) {
  return size?.webp?.url ? size.webp : size?.gif?.url ? size.gif : null;
}

/** KLIPY item → our GifRef (runbook §1.9). Null for anything without the
    renditions we need, and for anything that isn't a GIF (KLIPY can mix in
    other item types, such as ads, which we don't show). */
export function toGifRef(item) {
  if (!item || (item.type && item.type !== "gif")) return null;
  const small = pick(item.file?.sm) ?? pick(item.file?.xs);
  const medium = pick(item.file?.md) ?? small;
  if (!small || !medium) return null;
  return {
    provider: "klipy",
    id: String(item.id),
    url: medium.url, // medium: what a post or a message shows
    preview_url: small.url, // small and animated: the picker's tiles
    width: medium.width,
    height: medium.height,
  };
}

async function request(path, params, signal) {
  const query = new URLSearchParams({
    ...params,
    per_page: String(PER_PAGE),
    customer_id: customerId(),
  });
  let res;
  try {
    res = await fetch(`${API}/${encodeURIComponent(apiKey())}/${path}?${query}`, { signal });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new KlipyError("KLIPY could not be reached.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.result) {
    const detail = body?.errors?.message?.[0];
    throw new KlipyError(detail || `KLIPY answered ${res.status}.`, { status: res.status });
  }
  const page = body.data ?? {};
  return {
    items: (page.data ?? []).map(toGifRef).filter(Boolean),
    // The next page number, or null at the end.
    next: page.has_next ? (page.current_page ?? Number(params.page)) + 1 : null,
  };
}

/** Trending GIFs. `page` starts at 1. → { items: GifRef[], next } */
export function trendingGifs({ page = 1, signal } = {}) {
  return request("gifs/trending", { page: String(page) }, signal);
}

/** Search results for `query`. `page` starts at 1. → { items: GifRef[], next } */
export function searchGifs({ query, page = 1, signal } = {}) {
  return request("gifs/search", { q: query, page: String(page) }, signal);
}
