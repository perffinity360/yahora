import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { mergeMessage, sortByTime } from '../lib/messages';
import type { InboxItem, Message, PendingMessage } from '../types';

/**
 * Messaging queries and the send path.
 *
 * Realtime (`RealtimeContext`) writes into these exact cache keys, so a thread
 * stays live without any screen subscribing to anything.
 */

/** All my conversations, newest first. */
export function useInbox() {
  const { profile } = useAuth();
  const userId = profile?.id;

  return useQuery({
    queryKey: ['inbox', userId],
    queryFn: () =>
      api.get<{ inbox: InboxItem[] }>(`/api/messages/inbox/${userId}`).then((r) =>
        // The RPC can hand back counts as strings; normalise once, here.
        (r.inbox ?? []).map((row) => ({ ...row, unread_count: Number(row.unread_count || 0) })),
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

/** One thread, oldest first. Shares its key with the realtime writer. */
export function useChatHistory(contactId?: string, productId?: string) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const myId = profile?.id;
  const queryKey = ['chat', contactId, productId];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await api.get<{ messages: Message[] }>(
        `/api/messages/history?userId=${myId}&contactId=${contactId}&productId=${productId}`,
      );
      const server = sortByTime((response.messages ?? []) as PendingMessage[]);

      // A refetch (foreground resync, reconnect) replaces the whole thread. Carry
      // over anything still in flight or failed, or a send that was interrupted
      // by backgrounding would vanish along with its retry button.
      const cached = queryClient.getQueryData<PendingMessage[]>(queryKey) ?? [];
      const unsent = cached.filter(
        (m) =>
          (m.pending || m.failed) &&
          !server.some((s) => s.sender_id === m.sender_id && s.content === m.content),
      );

      return unsent.length ? sortByTime([...server, ...unsent]) : server;
    },
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
      queryClient.setQueryData<PendingMessage[]>(chatKey, (prev) => {
        const list = prev ?? [];
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
        return sortByTime([...list, optimistic]);
      });
    },

    onSuccess: (data, vars) => {
      queryClient.setQueryData<PendingMessage[]>(chatKey, (prev) => {
        const withoutPlaceholder = (prev ?? []).filter((m) => m.client_tag !== vars.clientTag);
        // Realtime may already have inserted the real row while we waited —
        // mergeMessage refreshes it rather than appending a duplicate.
        return mergeMessage(withoutPlaceholder, data.message);
      });
      // A first message creates a conversation the inbox has never seen.
      queryClient.invalidateQueries({ queryKey: ['inbox', myId] });
    },

    onError: (_err, vars) => {
      queryClient.setQueryData<PendingMessage[]>(chatKey, (prev) =>
        prev
          ? prev.map((m) =>
              m.client_tag === vars.clientTag ? { ...m, pending: false, failed: true } : m,
            )
          : prev,
      );
    },
  });
}

/**
 * Mark a thread read and zero its inbox badge immediately, so the badge never
 * lags behind what the user is plainly looking at.
 */
export function useMarkRead() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const myId = profile?.id;

  return useMutation({
    mutationFn: (vars: { contactId: string; productId: string }) => {
      if (!myId) return Promise.reject(new Error('Not signed in.'));
      return api.put('/api/messages/read', {
        userId: myId,
        contactId: vars.contactId,
        productId: vars.productId,
      });
    },
    onMutate: (vars) => {
      queryClient.setQueryData<InboxItem[]>(['inbox', myId], (prev) =>
        prev
          ? prev.map((row) =>
              row.contact_id === vars.contactId && row.product_id === vars.productId
                ? { ...row, unread_count: 0 }
                : row,
            )
          : prev,
      );
    },
  });
}
