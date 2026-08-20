import { getDevHost } from './devHost';
import { supabase } from './supabase';

const API_PORT = (process.env.EXPO_PUBLIC_API_PORT ?? '5000').trim();

/**
 * Resolve the backend base URL.
 *
 * Priority:
 *  1. EXPO_PUBLIC_API_URL when set — used verbatim. Required for
 *     production/staging builds, where there is no Metro dev server to infer a
 *     host from.
 *  2. Otherwise (local dev) derive the host from the Expo dev server URI. The
 *     machine running Metro is the same one running the backend, so we reuse its
 *     LAN IP and just swap in the backend port. A changing Wi-Fi IP then "just
 *     works" with no manual .env edits.
 */
function resolveApiUrl(): string {
  const explicit = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;

  // e.g. "192.168.1.10:8081" — take the host, swap in the backend port.
  const host = getDevHost();
  if (host) return `http://${host}:${API_PORT}`;

  return '';
}

const API_URL = resolveApiUrl();

async function request<T>(path: string, init: RequestInit, json = true): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const authHeader: Record<string, string> = data.session
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : {};

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      // Multipart bodies must NOT get an explicit Content-Type — fetch has to
      // set the boundary itself, or the backend can't parse the form.
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      Accept: 'application/json',
      ...authHeader,
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const parsed = text ? safeJson(text) : undefined;

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === 'object' && (parsed as any).error) ||
      (parsed && typeof parsed === 'object' && (parsed as any).message) ||
      `Request failed (${response.status})`;
    const err = new Error(message) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return (parsed ?? (undefined as T)) as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  /** Multipart upload (e.g. avatar). Auth header only — no Content-Type. */
  uploadForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }, false),
};
