import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { api } from '../lib/api';
import { contactIdOf, mergeMessage, replaceMessage } from '../lib/messages';
import { supabase } from '../lib/supabase';
import type { InboxItem, Message, PendingMessage } from '../types';

/**
 * The app's single realtime connection.
 *
 * Mounted once in `app/_layout.tsx` and deliberately NOT owned by any screen:
 * a channel created inside a screen effect is torn down and re-subscribed on
 * every navigation, and messages that arrive during that gap are lost forever.
 * The effect below depends on the user id ALONE. Everything that changes while
 * the app runs — which chat is open, who is online — lives in refs so updating
 * it can never re-run the subscription.
 *
 * Incoming messages are written straight into the TanStack Query caches
 * (`['chat', contactId, productId]` and `['inbox', userId]`), so any mounted
 * screen re-renders without knowing realtime exists.
 */

export type ActiveChat = { contactId: string; productId: string } | null;

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting';

interface RealtimeValue {
  /** User ids currently present on the `online-users` presence channel. */
  onlineUsers: Set<string>;
  /** Chat screens register/clear themselves here so unread counts stay right. */
  setActiveChat: (chat: ActiveChat) => void;
  connection: ConnectionState;
  /** Device has no network (NetInfo). Drives the "Connecting…" strip. */
  isOffline: boolean;
}

const RealtimeContext = createContext<RealtimeValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [isOffline, setIsOffline] = useState(false);

  // Live values the subscription reads at fire time — never dependencies.
  const activeChatRef = useRef<ActiveChat>(null);
  const userIdRef = useRef<string | undefined>(undefined);

  /**
   * The user id is tracked through Supabase auth rather than through `useAuth`.
   * `AuthContext` re-creates its value object on every profile edit, and taking
   * the id from there would risk re-running the subscription effect; the auth
   * user id changes only on sign-in/sign-out, which is exactly when the socket
   * *should* be rebuilt.
   */
  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setUserId(data.session?.user?.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  /** Pull everything back from the server — used after a reconnect or resume. */
  const resync = useCallback(() => {
    const myId = userIdRef.current;
    if (!myId) return;
    api.put('/api/messages/deliver', { userId: myId }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['inbox', myId] });
    queryClient.invalidateQueries({ queryKey: ['chat'] });
  }, [queryClient]);

  /* ── Incoming message ───────────────────────────────────────────────── */
  const handleIncoming = useCallback(
    (msg: Message) => {
      const myId = userIdRef.current;
      if (!myId) return;
      // The channel is unfiltered (a filter would need one channel per user and
      // breaks on re-auth), so drop everything that isn't mine.
      if (msg.sender_id !== myId && msg.receiver_id !== myId) return;

      const contactId = contactIdOf(msg, myId);
      const active = activeChatRef.current;
      const isActiveChat =
        !!active && active.contactId === contactId && active.productId === msg.product_id;

      // 1. The thread itself. Only touch a cache that already exists — if the
      //    chat was never opened, its next fetch brings this message anyway.
      const chatKey = ['chat', contactId, msg.product_id];
      if (queryClient.getQueryData<PendingMessage[]>(chatKey)) {
        queryClient.setQueryData<PendingMessage[]>(chatKey, (prev) => mergeMessage(prev, msg));
      }

      // 2. The inbox row: freshen the preview, float it to the top, and count it
      //    as unread only when it is for me and I am not already reading it.
      const inboxKey = ['inbox', myId];
      const inbox = queryClient.getQueryData<InboxItem[]>(inboxKey);
      if (inbox) {
        const idx = inbox.findIndex(
          (row) => row.product_id === msg.product_id && row.contact_id === contactId,
        );
        if (idx === -1) {
          // First message of a brand-new conversation — we have no contact or
          // product metadata here, so let the server build the row.
          queryClient.invalidateQueries({ queryKey: inboxKey });
        } else {
          const next = [...inbox];
          const [row] = next.splice(idx, 1);
          next.unshift({
            ...row,
            last_message: msg.content,
            last_message_time: msg.created_at,
            unread_count:
              msg.receiver_id === myId && !isActiveChat
                ? Number(row.unread_count || 0) + 1
                : Number(row.unread_count || 0),
          });
          queryClient.setQueryData(inboxKey, next);
        }
      }

      // 3. Reading it right now → tell the server, so the sender sees blue ticks.
      if (msg.receiver_id === myId && isActiveChat) {
        api
          .put('/api/messages/read', {
            userId: myId,
            contactId,
            productId: msg.product_id,
          })
          .catch(() => {});
      }
    },
    [queryClient],
  );

  /* ── Message updated (delivered / read ticks) ────────────────────────── */
  const handleUpdate = useCallback(
    (msg: Message) => {
      const myId = userIdRef.current;
      if (!myId) return;
      if (msg.sender_id !== myId && msg.receiver_id !== myId) return;

      const contactId = contactIdOf(msg, myId);
      const chatKey = ['chat', contactId, msg.product_id];
      if (!queryClient.getQueryData<PendingMessage[]>(chatKey)) return;
      queryClient.setQueryData<PendingMessage[]>(chatKey, (prev) => replaceMessage(prev, msg));
    },
    [queryClient],
  );

  /* ── THE channel. Mounted once per signed-in user. ───────────────────── */
  useEffect(() => {
    if (!userId) {
      setConnection('connecting');
      return;
    }

    let mounted = true;
    let hadDrop = false;

    const channel = supabase
      .channel('realtime:messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => handleIncoming(payload.new as Message),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => handleUpdate(payload.new as Message),
      )
      .subscribe((status) => {
        if (!mounted) return;
        if (status === 'SUBSCRIBED') {
          setConnection('connected');
          // Recovered from a drop: anything that happened while the socket was
          // down never reached us, so re-read it from the server.
          if (hadDrop) {
            hadDrop = false;
            resync();
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          hadDrop = true;
          setConnection('reconnecting');
        }
      });

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [userId, handleIncoming, handleUpdate, resync]);

  /* ── Presence (the green online dots). Also mounted once. ────────────── */
  useEffect(() => {
    if (!userId) {
      setOnlineUsers(new Set());
      return;
    }

    let mounted = true;
    const presence = supabase.channel('online-users', {
      config: { presence: { key: userId } },
    });

    presence.on('presence', { event: 'sync' }, () => {
      if (!mounted) return;
      setOnlineUsers(new Set(Object.keys(presence.presenceState())));
    });

    presence.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && mounted) {
        await presence.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      mounted = false;
      supabase.removeChannel(presence);
    };
  }, [userId]);

  /* ── Foreground resync — MOBILE-CRITICAL ─────────────────────────────
     iOS and Android suspend sockets in the background, so realtime silently
     stops delivering. Every return to the foreground re-reads from the server,
     which is what guarantees a message can never be permanently lost. */
  useEffect(() => {
    if (!userId) return;

    // Opening the app is itself a "came to the foreground" moment.
    resync();

    const appState = { current: AppState.currentState as AppStateStatus };
    const sub = AppState.addEventListener('change', (next) => {
      const wasBackgrounded = appState.current.match(/inactive|background/);
      appState.current = next;
      if (next === 'active' && wasBackgrounded) resync();
    });

    return () => sub.remove();
  }, [userId, resync]);

  /* ── Connectivity, for the "Connecting…" strip ─────────────────────────
     NetInfo is a native module. If the runtime doesn't have it linked, treat
     the device as online rather than taking the whole app down — the channel
     status already covers the case that actually matters. */
  useEffect(() => {
    try {
      const unsubscribe = NetInfo.addEventListener((state) => {
        setIsOffline(state.isConnected === false);
      });
      return () => unsubscribe();
    } catch {
      setIsOffline(false);
      return undefined;
    }
  }, []);

  const setActiveChat = useCallback((chat: ActiveChat) => {
    activeChatRef.current = chat;
  }, []);

  const value = useMemo<RealtimeValue>(
    () => ({ onlineUsers, setActiveChat, connection, isOffline }),
    [onlineUsers, setActiveChat, connection, isOffline],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside <RealtimeProvider>');
  return ctx;
}
