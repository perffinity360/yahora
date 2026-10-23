import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useAuth } from '../contexts/AuthContext';
import { api, type ApiError } from '../lib/api';
import {
  adoptServerRow,
  clearReplyPreviews,
  mergeMessage,
  newestServerId,
  removeMessage,
  replaceMessage,
  unsentStillMissing,
  updateEveryPage,
  updateNewestPage,
  type ChatCache,
  type ChatPage,
} from '../lib/messages';
import type { InboxItem, Message, Paged, PendingMessage } from '../types';

/**
 * Messaging queries and the send path.
 *
 * Realtime (`RealtimeContext`) writes into these exact cache keys, so a thread
 * stays live without any screen subscribing to anything.
 */

/**
 * My conversations, newest first.
 *
 * ⚠ FIRST PAGE ONLY (the newest 20). Phase 4 Block N-C renamed the envelope
 * `inbox` -> `items` and this hook was never updated, so it read `undefined`
 * and showed an empty inbox; fixed in Phase 5 V-E. Paging the inbox was not
 * part of V-E — `next_cursor` is ignored here, and a student with more than 20
 * conversations cannot reach the rest yet.
 */
export function useInbox() {
  const { profile } = useAuth();
  const userId = profile?.id;

  return useQuery({
    queryKey: ['inbox', userId],
    queryFn: () =>
      api.get<Paged<InboxItem>>(`/api/messages/inbox/${userId}`).then((r) =>
        // The RPC can hand back counts as strings; normalise once, here.
        (r?.items ?? []).map((row) => ({ ...row, unread_count: Number(row.unread_count || 0) })),
      ),
    enabled: !!userId,
    // Inert on native (TanStack's focusManager is web-only unless wired up).
    // The real foreground refresh is the AppState resync in RealtimeContext,
    // which is deliberately scoped to messaging — a global focus refetch would
    // also re-run GET /products/:id and inflate view counts.
    refetchOnWindowFocus: true,
  });
}

/** Total unread across every conversation — drives the Messages tab badge. */
export function useUnreadTotal(): number {
  const { data } = useInbox();
  return (data ?? []).reduce((sum, row) => sum + Number(row.unread_count || 0), 0);
}

/**
 * One thread, paged BACKWARDS (Phase 5 V-E).
 *
 * The first page is the NEWEST 20 messages — the end of the conversation, which
 * is what a thread opens on. Each `fetchNextPage()` loads the stretch
 * immediately before the oldest one loaded, using that page's `next_cursor`
 * (the server makes it the page's OLDEST message). `next_cursor: null` is the
 * start of the conversation and the only end-of-list signal.
 *
 * Every page arrives oldest-first and is cached exactly as sent. Nothing sorts —
 * see src/lib/messages.ts. The screen reads it through `flattenThread()`.
 *
 * Shares its key with the realtime writer and the send path below, which both
 * add new messages to the end of `pages[0]`.
 */
export function useChatHistory(contactId?: string, productId?: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const myId = profile?.id;
  const queryKey = ['chat', contactId, productId];

  return useInfiniteQuery({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }): Promise<ChatPage> => {
      const params = new URLSearchParams({
        userId: String(myId),
        contactId: String(contactId),
        productId: String(productId),
      });
      if (pageParam) params.append('cursor', pageParam);
      const page = await api.get<Paged<PendingMessage>>(`/api/messages/history?${params.toString()}`);
      const items = page?.items ?? [];
      const next_cursor = page?.next_cursor ?? null;

      // An older page is just older messages. Only the NEWEST page competes
      // with sends in flight, so only it carries anything over.
      if (pageParam) return { items, next_cursor };

      // A refetch (foreground resync, reconnect) replaces the newest page.
      // Carry over anything still in flight or failed, or a send that was
      // interrupted by backgrounding would vanish along with its retry button.
      const cached = queryClient.getQueryData<ChatCache>(queryKey)?.pages[0]?.items ?? [];
      const unsent = unsentStillMissing(
        items,
        cached.filter((m) => m.pending || m.failed),
      );
      // Bubbles sent from here keep their key and typed time across a refetch
      // too (adoptServerRow), so a resync doesn't rebuild or shift them.
      const sentHere = new Map(
        cached.filter((m) => m.client_tag && m.id !== m.client_tag).map((m) => [m.id, m]),
      );
      const fresh = sentHere.size
        ? items.map((s) => {
            const local = sentHere.get(s.id);
            return local ? adoptServerRow(local, s) : s;
          })
        : items;
      return { items: unsent.length ? [...fresh, ...unsent] : fresh, next_cursor };
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!myId && !!contactId && !!productId,
  });
}

/** Generates the id an optimistic bubble is tracked by until the server replies. */
export function newClientTag(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type SendVars = {
  content: string;
  clientTag: string;
  /* A reply (§10.4). Only the id is sent; the server fills the quote. The
     other two are for the optimistic bubble, so its quote shows at once. */
  replyToId?: string | null;
  replyToSenderId?: string | null;
  replyPreview?: string | null;
};

/** `reply_preview` as the database writes it: `left(content, 200)`, in characters, not UTF-16 units. */
const REPLY_PREVIEW_LENGTH = 200;
const previewOf = (text: string | null | undefined) =>
  text == null ? null : Array.from(text).slice(0, REPLY_PREVIEW_LENGTH).join('');

/**
 * How long a send may take before it counts as failed. fetch has no timeout of
 * its own, so on a connection that accepts the request and then goes quiet
 * (weak signal, a server waking up) the bubble would sit on its clock forever,
 * with no retry pill to tap. Same value on web (Messages.jsx).
 */
export const SEND_TIMEOUT_MS = 15_000;

/**
 * AUTOMATIC RETRY (MESSAGES_SPEC §2 "Failed message"). A send that fails for a
 * reason that can pass is tried again by itself, after 2, 4, 8, 16 and 30
 * seconds. The bubble keeps its clock the whole time. Only when all of those
 * fail, or the server refuses the message outright, does it turn into
 * "Failed to send". Offline (NetInfo) the clock simply waits, using up no
 * tries, and the send goes when the phone is back. Same numbers on web.
 */
export const SEND_MAX_RETRIES = 5;

export function sendRetryDelay(attempt: number): number {
  return Math.min(2000 * 2 ** attempt, 30_000);
}

/**
 * Worth trying again: no answer (network, timeout), 401 (the session was being
 * refreshed; the next try reads the new token), 408, 429, and any 5xx. Every
 * other 4xx is the server saying no to THIS message (too long, wrong campus,
 * listing deleted…), and asking again gets the same answer.
 */
export function isRetryableSendError(err: unknown): boolean {
  const e = err as ApiError;
  if (!e?.status) return true;
  return e.status === 401 || e.status === 408 || e.status === 429 || e.status >= 500;
}

/** One line for the Metro log, saying why a send failed. */
function describeSendError(err: unknown): string {
  const e = err as ApiError;
  if (e?.name === 'AbortError') return `timed out after ${SEND_TIMEOUT_MS / 1000}s`;
  if (e?.status) return `${e.status} ${String(e.body?.error ?? e.message)}`;
  return `network: ${e?.message ?? String(err)}`;
}

/**
 * Send, optimistically and dedupe-safely.
 *
 * The bubble appears the instant you hit send and is reconciled exactly once:
 * the POST response replaces the placeholder, unless realtime beat it there, in
 * which case the placeholder is simply dropped. Retrying re-uses the same
 * `client_tag`, so a retry updates the failed bubble instead of adding another.
 */
export function useSendMessage(contactId?: string, productId?: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const myId = profile?.id;
  const chatKey = ['chat', contactId, productId];

  return useMutation({
    // One send at a time per conversation, in the order typed. A message that
    // is retrying holds the ones after it, so they can't overtake it.
    scope: { id: `send:${contactId}:${productId}` },
    // Offline: wait for the network instead of burning tries (see _layout.tsx).
    networkMode: 'online',
    retry: (failureCount, err) => {
      const again = failureCount <= SEND_MAX_RETRIES && isRetryableSendError(err);
      if (again) {
        console.info(
          `[send] try ${failureCount} failed (${describeSendError(err)}); ` +
            `retrying in ${sendRetryDelay(failureCount - 1) / 1000}s`,
        );
      }
      return again;
    },
    retryDelay: (failureCount) => sendRetryDelay(failureCount - 1),

    mutationFn: async (vars: SendVars): Promise<{ message: Message | null }> => {
      if (!myId || !contactId || !productId) {
        throw Object.assign(new Error('This chat is not ready yet.'), { status: 400 });
      }
      // Before a RETRY: if the bubble is no longer waiting, Realtime already
      // brought the real row in. The previous try reached the server and only
      // the answer got lost, so sending again would post the message twice.
      // By id: the real row keeps the `client_tag` (adoptServerRow), but only
      // the placeholder has it as its id.
      const waiting = (queryClient.getQueryData<ChatCache>(chatKey)?.pages[0]?.items ?? []).some(
        (m) => m.id === vars.clientTag,
      );
      if (!waiting) return { message: null };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
      try {
        return await api.post<{ message: Message }>(
          '/api/messages/send',
          {
            sender_id: myId,
            receiver_id: contactId,
            product_id: productId,
            content: vars.content,
            reply_to_id: vars.replyToId ?? null,
          },
          undefined,
          controller.signal,
        );
      } finally {
        clearTimeout(timer);
      }
    },

    onMutate: (vars) => {
      if (!myId || !contactId || !productId) return;
      queryClient.setQueryData<ChatCache>(chatKey, (prev) =>
        updateNewestPage(prev, (list) => {
          const existing = list.findIndex((m) => m.client_tag === vars.clientTag);
          if (existing > -1) {
            // Retry of a failed send — flip it back to pending in place.
            const next = [...list];
            next[existing] = { ...next[existing], pending: true, failed: false };
            return next;
          }
          const optimistic: PendingMessage = {
            id: vars.clientTag,
            client_tag: vars.clientTag,
            pending: true,
            sender_id: myId,
            receiver_id: contactId,
            product_id: productId,
            university_id: profile?.university_id ?? '',
            content: vars.content,
            is_read: false,
            is_delivered: false,
            created_at: new Date().toISOString(),
            sent_after_id: newestServerId(list),
            // The quote shows before the server answers. The server's row
            // replaces all three (the trigger writes them), and a retry sends
            // them again from this bubble (handleRetry in the chat screen).
            reply_to_id: vars.replyToId ?? null,
            reply_to_sender_id: vars.replyToId ? (vars.replyToSenderId ?? null) : null,
            reply_preview: vars.replyToId ? previewOf(vars.replyPreview) : null,
            deleted_at: null,
          };
          // At the bottom of the thread, where it was typed. Not sorted.
          return [...list, optimistic];
        }),
      );
    },

    onSuccess: (data, vars) => {
      // `message: null`: Realtime already swapped the real row in (see mutationFn).
      const sent = data.message;
      if (sent) {
        // In place, in the placeholder's slot. Removing it and appending the
        // real row moved it below any later message still queued behind it,
        // so a burst sent offline shuffled itself when the network came back.
        // If Realtime already inserted the real row, mergeMessage refreshes it
        // instead of adding a duplicate.
        queryClient.setQueryData<ChatCache>(chatKey, (prev) =>
          updateNewestPage(prev, (list) => mergeMessage(list, sent, vars.clientTag)),
        );
      }
      // A first message creates a conversation the inbox has never seen.
      queryClient.invalidateQueries({ queryKey: ['inbox', myId] });
    },

    onError: (err, vars) => {
      // Reached only after the last automatic try, or at once for a refusal.
      // Say why in the Metro log; without it a failure tells you nothing.
      console.warn(`[send] gave up (${vars.clientTag}): ${describeSendError(err)}`);
      queryClient.setQueryData<ChatCache>(chatKey, (prev) =>
        prev
          ? updateNewestPage(prev, (list) =>
              list.map((m) =>
                m.client_tag === vars.clientTag
                  ? { ...m, pending: false, failed: true, auto_retry: isRetryableSendError(err) }
                  : m,
              ),
            )
          : prev,
      );
    },
  });
}

/**
 * DELETE FOR EVERYONE (MESSAGES_SPEC §10.8). The message becomes a tombstone
 * for both people. The other phone hears it as a Realtime UPDATE; this one
 * puts the returned tombstone in at once, on whichever page holds it, and wipes
 * the quote on cached replies to it. Errors (DELETE_WINDOW_EXPIRED,
 * NOT_MESSAGE_SENDER, MESSAGE_NOT_FOUND) are the caller's to show; nothing in
 * the cache changes until the server says yes.
 */
export function useDeleteForEveryone(contactId?: string, productId?: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const myId = profile?.id;
  const chatKey = ['chat', contactId, productId];

  return useMutation({
    mutationFn: (messageId: string) =>
      api.post<{ message: Message }>(`/api/messages/${messageId}/delete-for-everyone`),
    onSuccess: ({ message: tombstone }) => {
      queryClient.setQueryData<ChatCache>(chatKey, (prev) =>
        updateEveryPage(prev, (items) =>
          clearReplyPreviews(replaceMessage(items, tombstone), tombstone.id),
        ),
      );
      // The conversation's preview may have been this message (§10.9).
      queryClient.invalidateQueries({ queryKey: ['inbox', myId] });
    },
  });
}

/** Where a message sat in the chat cache, so a failed "Delete for me" can put it back there. */
type RemovedMessage = { message: PendingMessage; page: number; index: number };

/**
 * DELETE FOR ME (MESSAGES_SPEC §10.8). Gone from my view only. There is NO
 * Realtime event for this, on purpose (runbook §1.7: the other person must not
 * learn of it), so this local removal is the only update the screen gets. It
 * happens at once; a failure puts the message back where it was.
 */
export function useDeleteForMe(contactId?: string, productId?: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const myId = profile?.id;
  const chatKey = ['chat', contactId, productId];

  const removeEverywhere = (messageId: string) =>
    queryClient.setQueryData<ChatCache>(chatKey, (prev) =>
      updateEveryPage(prev, (items) => removeMessage(items, messageId)),
    );

  return useMutation({
    mutationFn: (messageId: string) =>
      api.post<{ id: string; hidden: true }>(`/api/messages/${messageId}/delete-for-me`),
    onMutate: (messageId): RemovedMessage | undefined => {
      const pages = queryClient.getQueryData<ChatCache>(chatKey)?.pages ?? [];
      let removed: RemovedMessage | undefined;
      pages.forEach((p, page) => {
        const index = p.items.findIndex((m) => m.id === messageId);
        if (index > -1 && !removed) removed = { message: p.items[index], page, index };
      });
      removeEverywhere(messageId);
      return removed;
    },
    onSuccess: (_data, messageId) => {
      // Again: a history refetch that left before the server hid it may have
      // brought it back in the meantime.
      removeEverywhere(messageId);
      queryClient.invalidateQueries({ queryKey: ['inbox', myId] });
    },
    onError: (_err, messageId, removed) => {
      if (!removed) return;
      queryClient.setQueryData<ChatCache>(chatKey, (prev) => {
        if (!prev || prev.pages.some((p) => p.items.some((m) => m.id === messageId))) return prev;
        const pages = [...prev.pages];
        const at = Math.min(removed.page, pages.length - 1);
        const items = [...pages[at].items];
        items.splice(Math.min(removed.index, items.length), 0, removed.message);
        pages[at] = { ...pages[at], items };
        return { ...prev, pages };
      });
    },
  });
}

/**
 * How often to ask whether the server is back, while something is waiting on
 * it. Same value on web (Messages.jsx).
 */
export const SERVER_PROBE_MS = 10_000;

/**
 * SENDING AGAIN ON ITS OWN (MESSAGES_SPEC §2). While `waiting`, ask
 * GET /api/health at once and then every SERVER_PROBE_MS; an answer calls
 * `onBack`, which sends the failed messages again. The chat screen folds
 * "on screen, app in front, phone online" into `waiting`, so the network or
 * the app coming back starts a probe straight away. One probe at a time, each
 * given up after SERVER_PROBE_MS, so a server that hangs can't pile them up.
 * Stops by itself once nothing waits (the messages are sending again).
 */
export function useServerBack(waiting: boolean, onBack: () => void | Promise<void>) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!waiting) return;
    let stopped = false;
    let busy = false;
    const probe = async () => {
      if (busy) return;
      busy = true;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SERVER_PROBE_MS);
      try {
        await api.get('/api/health', controller.signal);
        if (!stopped) await onBackRef.current();
      } catch {
        // Not back yet: the next tick asks again.
      } finally {
        clearTimeout(timer);
        busy = false;
      }
    };
    probe();
    const interval = setInterval(probe, SERVER_PROBE_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [waiting]);
}

/**
 * Mark a thread read and set its inbox badge immediately, so the badge never
 * lags behind what the user is plainly looking at.
 *
 * `upToId` (optional) is a read position: only messages up to and including it
 * are marked (PUT /api/messages/read, Phase 6A V-E). `remaining` is how many of
 * the contact's unread messages come after it — the badge drops to that, not 0.
 * Without `upToId` the whole thread is marked and the badge goes to 0.
 */
export function useMarkRead() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const myId = profile?.id;

  return useMutation({
    mutationFn: (vars: {
      contactId: string;
      productId: string;
      upToId?: string;
      remaining?: number;
    }) => {
      if (!myId) return Promise.reject(new Error('Not signed in.'));
      return api.put('/api/messages/read', {
        userId: myId,
        contactId: vars.contactId,
        productId: vars.productId,
        ...(vars.upToId ? { upToId: vars.upToId } : {}),
      });
    },
    onMutate: (vars) => {
      const left = vars.upToId ? Math.max(0, vars.remaining ?? 0) : 0;
      queryClient.setQueryData<InboxItem[]>(['inbox', myId], (prev) =>
        prev
          ? prev.map((row) =>
              row.contact_id === vars.contactId && row.product_id === vars.productId
                ? { ...row, unread_count: left }
                : row,
            )
          : prev,
      );
    },
  });
}
