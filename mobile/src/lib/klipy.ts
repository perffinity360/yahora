import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GifRef } from '../types';

/**
 * KLIPY, the GIF provider — runbook §1.9, COMMUNITY_SPEC.md §6. Every KLIPY call
 * in the app lives in this file. The website's twin is frontend/src/utils/klipy.js.
 *
 * ⚠ The ONE place EXPO_PUBLIC_KLIPY_API_KEY is read. KLIPY's terms say searches
 * run from the student's device, so the key ships inside the app by design
 * (runbook §1.16).
 *
 * The API, as it answers (checked by the website against the live test key, 2 Nov):
 *   GET https://api.klipy.com/api/v1/{key}/gifs/trending?page&per_page&customer_id
 *   GET https://api.klipy.com/api/v1/{key}/gifs/search?q&page&per_page&customer_id
 *   200 → { result: true, data: { data: [item…], current_page, per_page, has_next } }
 *   bad key → 404 { result: false, errors: { message: ["…"] } }
 * An item is { id, slug, title, type: "gif", file: { hd, md, sm, xs } }, each
 * size holding { gif, webp, jpg, mp4, webm }: { url, width, height, size }.
 *
 * KLIPY's rules: show its results as they come (no re-ordering, no filtering
 * of our own; the content filter is a setting in KLIPY's panel), link to its
 * files rather than copying them, and show "Powered by KLIPY".
 */

const API = 'https://api.klipy.com/api/v1';
const PER_PAGE = 24;
const CUSTOMER_KEY = 'yahora.klipy.customer_id';

/** Every failure; the picker shows spec §6's one message for all of them. */
export class KlipyError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'KlipyError';
    this.status = status;
  }
}

export function hasKlipyKey() {
  return !!(process.env.EXPO_PUBLIC_KLIPY_API_KEY ?? '').trim();
}

function apiKey() {
  const key = (process.env.EXPO_PUBLIC_KLIPY_API_KEY ?? '').trim();
  if (!key) throw new KlipyError('No KLIPY key: set EXPO_PUBLIC_KLIPY_API_KEY in mobile/.env (runbook §1.16).');
  return key;
}

/* KLIPY asks for a per-user `customer_id` (it powers its "recent" lists). We
   never send the student's real id, nor the device id the OTP limiter uses: a
   random one of its own, kept on this phone. */
let customer: string | null = null;
function randomId() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
async function customerId() {
  if (customer) return customer;
  try {
    customer = (await AsyncStorage.getItem(CUSTOMER_KEY)) ?? null;
    if (!customer) {
      customer = randomId();
      await AsyncStorage.setItem(CUSTOMER_KEY, customer);
    }
  } catch {
    customer = customer ?? randomId();
  }
  return customer;
}

type Rendition = { url?: string; width?: number; height?: number };
type Size = { gif?: Rendition; webp?: Rendition };
type Item = { id?: string | number; type?: string; file?: { md?: Size; sm?: Size; xs?: Size } };

/* Animated WebP first, GIF second, never MP4: expo-image plays both image
   formats itself, and WebP is a fraction of the GIF's size for the same
   animation. A video rendition would need a video player in every post. */
function pick(size: Size | undefined): Required<Rendition> | null {
  const r = size?.webp?.url ? size.webp : size?.gif?.url ? size.gif : null;
  if (!r?.url || !r.width || !r.height) return null;
  return { url: r.url, width: r.width, height: r.height };
}

/** KLIPY item → our GifRef (runbook §1.9). Null for anything without the
 *  renditions we need, and for anything that isn't a GIF (KLIPY can mix in
 *  other item types, such as ads, which we don't show). */
export function toGifRef(item: Item): GifRef | null {
  if (!item || (item.type && item.type !== 'gif')) return null;
  const small = pick(item.file?.sm) ?? pick(item.file?.xs);
  const medium = pick(item.file?.md) ?? small;
  if (!small || !medium || item.id === undefined) return null;
  return {
    provider: 'klipy',
    id: String(item.id),
    url: medium.url, // medium: what a post or a message shows
    preview_url: small.url, // small and animated: the picker's tiles
    width: medium.width,
    height: medium.height,
  };
}

export type GifPage = { items: GifRef[]; next: number | null };

async function request(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<GifPage> {
  const query = new URLSearchParams({ ...params, per_page: String(PER_PAGE), customer_id: await customerId() });
  let res: Response;
  try {
    res = await fetch(`${API}/${encodeURIComponent(apiKey())}/${path}?${query.toString()}`, { signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new KlipyError('KLIPY could not be reached.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.result) {
    throw new KlipyError(body?.errors?.message?.[0] || `KLIPY answered ${res.status}.`, res.status);
  }
  const page = body.data ?? {};
  return {
    items: ((page.data ?? []) as Item[]).map(toGifRef).filter((g): g is GifRef => g !== null),
    // The next page number, or null at the end.
    next: page.has_next ? (page.current_page ?? Number(params.page)) + 1 : null,
  };
}

/** Trending GIFs (an empty `query`) or search results. `page` starts at 1. */
export function fetchGifs({ query, page, signal }: { query: string; page: number; signal?: AbortSignal }) {
  return query
    ? request('gifs/search', { q: query, page: String(page) }, signal)
    : request('gifs/trending', { page: String(page) }, signal);
}
