import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import {
  mergeMessage,
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
      const unsent = cached.filter(
        (m) =>
          (m.pending || m.failed) &&
          !items.some((s) => s.sender_id === m.sender_id && s.content === m.content),
      );
      return { items: unsent.length ? [...items, ...unsent] : items, next_cursor };
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!myId && !!contactId && !!productId,
  });
}

/** Generates the id an optimistic bubble is tracked by until the server replies. */
export function newClientTag(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type SendVars = { content: string; clientTag: string };

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
    mutationFn: (vars: SendVars) => {
      if (!myId || !contactId || !productId) {
        return Promise.reject(new Error('This chat is not ready yet.'));
      }
      return api.post<{ message: Message }>('/api/messages/send', {
        sender_id: myId,
        receiver_id: contactId,
        product_id: productId,
        content: vars.content,
      });
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
          };
          // At the bottom of the thread, where it was typed. Not sorted.
          return [...list, optimistic];
        }),
      );
    },

    onSuccess: (data, vars) => {
      queryClient.setQueryData<ChatCache>(chatKey, (prev) =>
        updateNewestPage(prev, (list) => {
          const withoutPlaceholder = list.filter((m) => m.client_tag !== vars.clientTag);
          // Realtime may already have inserted the real row while we waited —
          // mergeMessage refreshes it rather than appending a duplicate.
          return mergeMessage(withoutPlaceholder, data.message);
        }),
      );
      // A first message creates a conversation the inbox has never seen.
      queryClient.invalidateQueries({ queryKey: ['inbox', myId] });
    },

    onError: (_err, vars) => {
      queryClient.setQueryData<ChatCache>(chatKey, (prev) =>
        prev
          ? updateNewestPage(prev, (list) =>
              list.map((m) =>
                m.client_tag === vars.clientTag ? { ...m, pending: false, failed: true } : m,
              ),
            )
          : prev,
      );
    },
  });
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
