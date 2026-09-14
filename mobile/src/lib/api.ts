import { API_BASE_URL } from './config';
import { supabase } from './supabase';

/**
 * `fromApi` distinguishes an error the Yahora backend produced from one an
 * intermediary produced. Only the former has a meaningful status code.
 */
export type ApiError = Error & { status?: number; fromApi?: boolean };

async function request<T>(path: string, init: RequestInit, json = true): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const authHeader: Record<string, string> = data.session
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : {};

  const response = await fetch(`${API_BASE_URL}${path}`, {
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
    // Did THIS backend answer, or did something between us and it? Every error
    // this API returns carries an `error` field (utils/respond.js sendError).
    // A status with no such body came from an intermediary — a proxy, a captive
    // portal, or the macOS AirPlay Receiver squatting on the API port, which
    // answers every request with a bodiless 403 Forbidden.
    //
    // Callers must branch on `fromApi` before trusting a status code, or they
    // will translate someone else's 403 into a confident statement about the
    // student's university. That is exactly what happened once already.
    const bodyMessage =
      (parsed && typeof parsed === 'object' && (parsed as any).error) ||
      (parsed && typeof parsed === 'object' && (parsed as any).message) ||
      null;
    const err = new Error(
      bodyMessage || `Request failed (${response.status})`,
    ) as ApiError;
    err.status = response.status;
    err.fromApi = Boolean(bodyMessage);
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
