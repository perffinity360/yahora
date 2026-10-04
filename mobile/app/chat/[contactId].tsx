import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  FlatList,
  Image as RNImage,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '../../src/components/CircleButton';
import { AppText } from '../../src/components/AppText';
import { AppTextInput } from '../../src/components/AppTextInput';
import { Avatar } from '../../src/components/Avatar';
import { ConnectionBanner } from '../../src/components/ConnectionBanner';
import { KeyboardAvoider } from '../../src/components/KeyboardAvoider';
import { resolveMediaUrl } from '../../src/lib/config';
import { Skeleton } from '../../src/components/Skeleton';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRealtime } from '../../src/contexts/RealtimeContext';
import {
  newClientTag,
  useChatHistory,
  useInbox,
  useMarkRead,
  useSendMessage,
} from '../../src/hooks/useMessages';
import { useUniversities } from '../../src/hooks/useUniversities';
import {
  flattenThread,
  formatClockTime,
  formatDayLabel,
  isGroupedWith,
  isSameDay,
} from '../../src/lib/messages';
import { hrefWithFrom } from '../../src/lib/nav';
import { supabase } from '../../src/lib/supabase';
import { CHAT_WALLPAPER_OPACITY, colors, font, radius, SENT_BUBBLE_STYLE, spacing } from '../../src/theme';
import type { PendingMessage } from '../../src/types';

const BRAND = [colors.purple, colors.pinkDark] as const;
/** The sent bubble's 135° gradient (MESSAGES_SPEC.md §2), or null for 'solid'.
 *  Module-level, with the points below, so a bubble's gradient props never
 *  change identity and it is never rebuilt on a re-render. */
const SENT_GRADIENT =
  SENT_BUBBLE_STYLE === 'gradient' ? ([colors.purple, colors.bubbleMineEnd] as const) : null;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };
/** Composer bottom padding (spec §2), raised to the home-indicator inset. */
const COMPOSER_BOTTOM = 12;
/** Bubble corner radius; the tail corner is BUBBLE_TAIL (spec §2). */
const BUBBLE_RADIUS = 18;
const BUBBLE_TAIL = 5;
/** Thread side padding (mockup `.wall`); the unread band bleeds past it. */
const THREAD_PAD = 12;
/** Bubble max width: 78% of the thread, never above 520 (spec §2). */
const BUBBLE_MAX = 520;
const MESSAGES_HREF = '/(tabs)/messages';
const MAX_MESSAGE_LENGTH = 2000;
/** Seamless 420×420 doodle tile; copies of docs/design/assets/. Never edit the PNGs. */
const CHAT_PATTERN = require('../../assets/chat-pattern.png');
/** The tile's size in dp — the web tiles the same artwork at 420 px. */
const TILE = 420;

/** Broadcast at most one typing ping every 2s, and hide theirs after 3s of silence. */
const TYPING_THROTTLE_MS = 2000;
const TYPING_TIMEOUT_MS = 3000;
/** Demo campus: the backend bot replies in ~3s, so show its "typing" for 5s. */
const DEMO_TYPING_MS = 5000;

const EMOJI_TABS = [
  { label: 'Smileys', emojis: ['😊', '😂', '😍', '🥺', '😭', '😎', '🤔', '🥳', '😘', '🤗', '😅', '🤩', '😆', '🙂', '😉', '🫡'] },
  { label: 'Gestures', emojis: ['👍', '👏', '🙌', '🤝', '💪', '🫶', '👌', '✌️', '🤙', '🙏', '🫂', '❤️', '💕', '🔥', '✨', '💯'] },
  { label: 'Campus', emojis: ['📚', '🎒', '💻', '📱', '☕', '🍕', '🏫', '🎓', '📝', '💡', '🎯', '⚡', '🛍️', '📦', '💰', '🎁'] },
];

type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'unread'; key: string; count: number }
  | {
      kind: 'msg';
      key: string;
      message: PendingMessage;
      mine: boolean;
      firstOfRun: boolean;
      lastOfRun: boolean;
    };

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    contactId: string;
    productId?: string;
    from?: string;
    contactName?: string;
    contactAvatar?: string;
    productTitle?: string;
    productImage?: string;
  }>();

  const contactId = typeof params.contactId === 'string' ? params.contactId : undefined;
  const productId = typeof params.productId === 'string' ? params.productId : undefined;
  const fromParam = typeof params.from === 'string' ? params.from : undefined;

  const { profile, isDemoUser } = useAuth();
  const myId = profile?.id;
  const { onlineUsers, setActiveChat, connection, isOffline } = useRealtime();

  const isSelfChat = !!myId && !!contactId && myId === contactId;

  /* Header details: the inbox row is authoritative; the params passed by
     "Message Seller" let a brand-new conversation render instantly. */
  const { data: inbox } = useInbox();
  const inboxRow = useMemo(
    () => (inbox ?? []).find((r) => r.contact_id === contactId && r.product_id === productId),
    [inbox, contactId, productId],
  );
  const contactName = inboxRow?.contact_name || params.contactName || 'Yahora student';
  const contactAvatar = inboxRow?.contact_avatar || params.contactAvatar || null;
  const productTitle = inboxRow?.product_title || params.productTitle || 'this item';
  const productImage = inboxRow?.product_image || params.productImage || null;

  const {
    data: history,
    isLoading,
    isError,
    refetch,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useChatHistory(isSelfChat ? undefined : contactId, isSelfChat ? undefined : productId);

  const sendMessage = useSendMessage(contactId, productId);
  const markRead = useMarkRead();

  const [draft, setDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const [contactTyping, setContactTyping] = useState(false);

  // Mutations get new object identities every render; refs keep the focus and
  // channel effects from re-running (and re-subscribing) because of that.
  const markReadRef = useRef(markRead);
  markReadRef.current = markRead;
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  const isOnline = isDemoUser || (!!contactId && onlineUsers.has(contactId) && !isSelfChat);

  /* Header status line (spec §2): "<University> · online", or the university
     alone. A chat is always within one campus — the backend refuses a send
     across two — so the contact's university is the viewer's own. Read from
     the cached universities list the app already holds; no new request shape. */
  const { data: universities } = useUniversities();
  const campusName = useMemo(
    () => universities?.find((u) => u.id === profile?.university_id)?.name ?? null,
    [universities, profile?.university_id],
  );
  const statusLine = [campusName, isOnline ? 'online' : null].filter(Boolean).join(' · ');

  /* Whether this chat is on screen and receiving live. Registering as the
     realtime "active chat" and marking read both wait on it — see "AWAY FROM
     THE CHAT" below. Leaving the screen stands down at once, in the cleanup,
     so no message is counted read during the render it takes to notice. */
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => {
        setFocused(false);
        setActiveChat(null);
      };
    }, [setActiveChat]),
  );
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setAppActive(next === 'active'));
    return () => sub.remove();
  }, []);
  // Offline (NetInfo) or the socket retrying: nothing reaches this phone live.
  const reachable = appActive && !isOffline && connection !== 'reconnecting';

  /* ── Typing indicator: the ONLY chat-scoped channel ──────────────────── */
  useEffect(() => {
    if (!myId || !contactId || !productId || isSelfChat) return;

    const room = `typing:${[myId, contactId].sort().join(':')}:${productId}`;
    const channel = supabase.channel(room, { config: { broadcast: { self: false } } });

    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (!payload || payload.userId === myId) return;
      setContactTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setContactTyping(false), TYPING_TIMEOUT_MS);
    });
    channel.subscribe();
    typingChannelRef.current = channel;

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingChannelRef.current = null;
      setContactTyping(false);
      supabase.removeChannel(channel);
    };
  }, [myId, contactId, productId, isSelfChat]);

  // Oldest first, in exactly the order the server sent it — NOT sorted here.
  // If this is ever out of order, the backend sent it out of order.
  const thread = useMemo(() => flattenThread(history), [history]);
  const lastMessageId = thread.length ? thread[thread.length - 1].id : null;
  const lastSenderId = thread.length ? thread[thread.length - 1].sender_id : null;

  /* Their message arriving means they have stopped typing. */
  useEffect(() => {
    if (lastSenderId && lastSenderId === contactId) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      setContactTyping(false);
    }
  }, [lastMessageId, lastSenderId, contactId]);

  const broadcastTyping = useCallback(() => {
    const channel = typingChannelRef.current;
    if (!channel || !myId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    channel.send({ type: 'broadcast', event: 'typing', payload: { userId: myId } }).catch(() => {});
  }, [myId]);

  const handleChangeText = (text: string) => {
    setDraft(text);
    if (text.trim()) broadcastTyping();
  };

  const handleSend = () => {
    const content = draft.trim();
    if (!content || !contactId || !productId) return;
    setDraft('');
    setShowEmoji(false);
    clearUnreadLine();
    sendMessage.mutate({ content, clientTag: newClientTag() });

    // Demo campus: the bot is about to reply, so show its typing bubble now.
    if (isDemoUser) {
      setContactTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setContactTyping(false), DEMO_TYPING_MS);
    }
  };

  const handleRetry = (message: PendingMessage) => {
    if (!message.client_tag) return;
    sendMessage.mutate({ content: message.content, clientTag: message.client_tag });
  };
  // One stable function for every row, so the memoised bubbles do not
  // re-render each time the screen does. Same send, same mutation.
  const retryRef = useRef(handleRetry);
  retryRef.current = handleRetry;
  const onRetry = useCallback((message: PendingMessage) => retryRef.current(message), []);

  const goBack = () => {
    if (fromParam) router.replace(fromParam);
    else if (router.canGoBack()) router.back();
    else router.replace(MESSAGES_HREF);
  };

  /* ── "N unread messages" divider (web parity: Messages.jsx unreadMarker) ──
     Pinned at open time, NOT derived from is_read on every render. Opening the
     thread fires PUT /messages/read within a second or two, which flips every
     is_read to true — a derived marker would appear and then vanish while you
     were still looking for where you left off, which is the one moment it is
     for. Pinned, it stays put until you leave the thread or reply.

     `undefined` = not pinned yet. Until then it is derived, so the first render
     that has messages already has the line — pinning it in an effect alone
     would paint the messages one frame without it. */
  type UnreadMarker = { firstId: string; count: number };
  const [unreadMarker, setUnreadMarker] = useState<UnreadMarker | null | undefined>(undefined);

  // A different conversation is a different marker.
  useEffect(() => {
    setUnreadMarker(undefined);
  }, [contactId, productId]);

  const openMarker = useMemo(() => {
    if (unreadMarker !== undefined) return unreadMarker;
    const unread = thread.filter((m) => m.sender_id !== myId && m.is_read === false);
    return unread.length ? { firstId: unread[0].id, count: unread.length } : null;
  }, [unreadMarker, thread, myId]);

  useEffect(() => {
    if (unreadMarker === undefined && thread.length > 0) setUnreadMarker(openMarker);
  }, [unreadMarker, openMarker, thread.length]);

  /* ── AWAY FROM THE CHAT (web parity: Messages.jsx flushAwayUnread) ──────
     "Away" is any stretch where this chat is open but nothing reaches it live:
     the app in the background (the screen stays mounted and focused, but
     nobody is reading it), the phone offline (hostels, lifts), or the socket
     retrying. While away:

       - this chat stands down as the realtime "active chat". A message that
         arrives is delivered (two grey ticks) and counted unread in the inbox,
         NOT marked read.
       - the contact's newest message on screen is remembered. Everything they
         sent after it is what the student has not seen, and it gets the
         "N unread messages" line.

     That line is DERIVED from the thread while away, in the same render as
     the messages it covers, so they can never appear first and the line a
     render later. Messages the socket delivers in the background already sit
     under it before the app is back on screen.

     On return, the thread is re-read from the server (the socket misses
     messages while away, so the cache alone is not enough). Once that re-read
     has rendered, the line is pinned — same message, same count, so nothing on
     screen moves — and only then does PUT /messages/read go out and the
     sender's ticks turn blue. The inbox badge counts them until then.

     Registered on focus only: a chat under another screen is not on screen. */
  const [away, setAway] = useState<{ lastSeenId: string | null } | null>(null);
  const awayRef = useRef(away);
  awayRef.current = away;
  /** The re-read after a return has finished; the line can be pinned. */
  const [resynced, setResynced] = useState(false);
  /** Bumped by every departure and return, so a stale re-read cannot flush. */
  const returnSeqRef = useRef(0);
  /** The away line's first message id, until PUT /messages/read has gone out
   *  for it — which waits for the line to be among the rendered rows. */
  const readAfterLineRef = useRef<string | null>(null);

  // The contact's messages always carry server ids, so this survives a refetch;
  // one of mine could still be an optimistic `local-…` placeholder.
  const lastContactMessageId = useMemo(() => {
    for (let i = thread.length - 1; i >= 0; i--) {
      if (thread[i].sender_id === contactId) return thread[i].id;
    }
    return null;
  }, [thread, contactId]);
  const lastContactMessageIdRef = useRef(lastContactMessageId);
  lastContactMessageIdRef.current = lastContactMessageId;

  useEffect(() => {
    if (!contactId || !productId || isSelfChat) return;
    if (!focused) {
      // Leaving the chat: coming back in is a fresh open, marked read on focus.
      returnSeqRef.current += 1;
      setAway(null);
      setResynced(false);
      return;
    }
    if (!reachable) {
      returnSeqRef.current += 1;
      setResynced(false);
      setActiveChat(null);
      setAway((prev) => prev ?? { lastSeenId: lastContactMessageIdRef.current });
      return;
    }
    if (!awayRef.current) {
      // Opened (or refocused) while live: reading it now.
      setActiveChat({ contactId, productId });
      markReadRef.current.mutate({ contactId, productId });
      return;
    }
    // Back. Joins the resync's refetch if that one started first.
    const seq = ++returnSeqRef.current;
    refetch({ cancelRefetch: false }).then(() => {
      if (returnSeqRef.current === seq) setResynced(true);
    });
  }, [focused, reachable, contactId, productId, isSelfChat, setActiveChat, refetch]);

  const awayMarker = useMemo(() => {
    if (!away) return null;
    const seenAt = away.lastSeenId ? thread.findIndex((m) => m.id === away.lastSeenId) : -1;
    const run =
      away.lastSeenId && seenAt === -1
        ? // The remembered message is no longer loaded (more arrived than the
          // re-read's pages hold): fall back to the server's own unread flag.
          thread.filter((m) => m.sender_id !== myId && m.is_read === false)
        : thread.slice(seenAt + 1).filter((m) => m.sender_id !== myId);
    return run.length ? { firstId: run[0].id, count: run.length } : null;
  }, [away, thread, myId]);

  // A line from being away replaces the one from opening; none leaves it be.
  const marker = awayMarker ?? openMarker;

  useEffect(() => {
    // `isFetching` goes false in the same render that brings the re-read's
    // data, so `awayMarker` here already counts everything it brought.
    if (!away || !resynced || isFetching || !contactId || !productId) return;
    setAway(null);
    setResynced(false);
    setActiveChat({ contactId, productId });
    if (!awayMarker) {
      markReadRef.current.mutate({ contactId, productId });
      return;
    }
    readAfterLineRef.current = awayMarker.firstId;
    setUnreadMarker(awayMarker);
  }, [away, resynced, isFetching, awayMarker, contactId, productId, setActiveChat]);

  /** Replying is reading (WhatsApp): the line goes, and stays gone. */
  const clearUnreadLine = () => {
    setUnreadMarker(null);
    // Still away (a reply typed offline): what is on screen now has been
    // seen, but anything that arrives after it still gets a line.
    if (awayRef.current) setAway({ lastSeenId: lastContactMessageIdRef.current });
    if (readAfterLineRef.current && contactId && productId) {
      readAfterLineRef.current = null;
      markReadRef.current.mutate({ contactId, productId });
    }
  };

  const listRef = useRef<FlatList<ChatRow>>(null);

  /* ── Rows: day separators + grouping, built oldest-first then reversed
        because the list is inverted (index 0 renders at the bottom). ────── */
  const rows = useMemo<ChatRow[]>(() => {
    const out: ChatRow[] = [];
    thread.forEach((message, i) => {
      const previous = thread[i - 1];
      const next = thread[i + 1];
      if (!previous || !isSameDay(previous.created_at, message.created_at)) {
        const day = formatDayLabel(message.created_at);
        out.push({ kind: 'day', key: `day-${day}-${message.id}`, label: day });
      }
      // Above the first message they had not read, below everything they had.
      if (marker && message.id === marker.firstId) {
        out.push({ kind: 'unread', key: `unread-${message.id}`, count: marker.count });
      }
      out.push({
        kind: 'msg',
        key: message.id,
        message,
        mine: message.sender_id === myId,
        firstOfRun: !previous || !isGroupedWith(previous, message),
        lastOfRun: !next || !isGroupedWith(message, next),
      });
    });
    return out.reverse();
  }, [thread, myId, marker]);

  /* The away line is committed: bring it into view — a long run would leave it
     above the top of the screen — and now it is true that they have read it. */
  useEffect(() => {
    const firstId = readAfterLineRef.current;
    if (!firstId || !contactId || !productId) return;
    // This effect can run in the same commit that scheduled the line, before
    // the line is in `rows`. Only once it is here has it reached the screen.
    const index = rows.findIndex((row) => row.kind === 'unread' && row.key === `unread-${firstId}`);
    if (index === -1) return;
    readAfterLineRef.current = null;
    // Inverted list: viewPosition 1 is the TOP of the screen. From near the
    // bottom the offset clamps and nothing moves, which is right — the line is
    // already in view.
    listRef.current?.scrollToIndex({ index, viewPosition: 1, animated: true });
    markReadRef.current.mutate({ contactId, productId });
  }, [unreadMarker, rows, contactId, productId]);

  const canSend = !!draft.trim() && !!contactId && !!productId;

  const { width: windowWidth } = useWindowDimensions();
  const bubbleWidth = useMemo(
    () => ({ maxWidth: Math.min(Math.round((windowWidth - THREAD_PAD * 2) * 0.78), BUBBLE_MAX) }),
    [windowWidth],
  );

  const renderRow = useCallback(
    ({ item }: { item: ChatRow }) =>
      item.kind === 'day' ? (
        <DaySeparator label={item.label} />
      ) : item.kind === 'unread' ? (
        <UnreadDivider count={item.count} />
      ) : (
        <MessageBubble
          message={item.message}
          mine={item.mine}
          firstOfRun={item.firstOfRun}
          lastOfRun={item.lastOfRun}
          contactName={contactName}
          contactAvatar={contactAvatar}
          widthStyle={bubbleWidth}
          onRetry={onRetry}
        />
      ),
    [contactName, contactAvatar, bubbleWidth, onRetry],
  );

  /* ── Self-chat guard ─────────────────────────────────────────────────── */
  if (isSelfChat) {
    return (
      <SafeAreaView style={styles.root}>
        <ChatState
          icon="user"
          title="That's you"
          subtitle="You can't start a conversation with yourself — pick another student's listing to chat about."
          actionLabel="Back to messages"
          onAction={goBack}
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoider style={styles.flex}>
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
          <ConnectionBanner />

          {/* ── Header ── */}
          <View style={styles.header}>
            <CircleButton
              icon="chevron-left"
              iconSize={24}
              iconColor={colors.purple}
              onPress={goBack}
              variant="plain"
              hitSlop={10}
              accessibilityLabel="Back"
            />

            <View>
              <Avatar name={contactName} uri={contactAvatar} size={36} />
              {isOnline ? <View style={styles.headerDot} /> : null}
            </View>

            <View style={styles.headerInfo}>
              <AppText style={styles.headerName} numberOfLines={1}>
                {contactName}
              </AppText>
              {statusLine ? (
                <AppText style={styles.headerStatus} numberOfLines={1}>
                  {statusLine}
                </AppText>
              ) : null}
            </View>
          </View>

          {/* ── Product snippet: on the header's white surface (spec §2) ── */}
          <View style={styles.snippetBar}>
            <Pressable
              onPress={() =>
                productId &&
                router.push(
                  hrefWithFrom(
                    `/product/${productId}`,
                    hrefWithFrom(`/chat/${contactId}?productId=${productId}`, fromParam),
                  ),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`View ${productTitle}`}
              style={({ pressed }) => [styles.snippet, pressed && styles.snippetPressed]}
            >
              {productImage ? (
                <Image
                  // Loopback-safe in local dev; see src/lib/config.ts.
                  source={{ uri: resolveMediaUrl(productImage) ?? productImage }}
                  style={styles.productThumb}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.productThumb, styles.productThumbFallback]}>
                  <Feather name="image" size={13} color={colors.mutedPlaceholder} />
                </View>
              )}
              <AppText style={styles.productTitle} numberOfLines={1}>
                {productTitle}
              </AppText>
              <Feather name="chevron-right" size={13} color={colors.purple} />
            </Pressable>
          </View>

          {/* ── Thread ── */}
          <View style={styles.thread}>
            {/* OUTSIDE the inverted FlatList on purpose: inside, it would be
                flipped and would scroll with the messages. */}
            <ChatWallpaper />
            {isLoading ? (
              <ChatSkeleton />
            ) : isError && thread.length === 0 ? (
              <ChatState
                icon="wifi-off"
                title="Couldn't load this chat"
                subtitle="Check your connection and try again."
                actionLabel="Retry"
                onAction={refetch}
              />
            ) : thread.length === 0 ? (
              <ScrollView contentContainerStyle={styles.emptyScroll} keyboardShouldPersistTaps="handled">
                <View style={styles.emptyWrap}>
                  {/* On a card, so the wallpaper never runs through the words. */}
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyEmoji}>👋</Text>
                    <Text style={styles.emptyTitle}>Start the conversation about {productTitle}.</Text>
                    <Text style={styles.emptyText}>
                      Ask if it&apos;s still available, agree a price, and meet somewhere public on campus.
                    </Text>
                  </View>
                  <View style={styles.suggestions}>
                    {['Hi! Is this still available? 😊', "What's the condition?", 'Can we meet on campus?'].map(
                      (suggestion) => (
                        <Pressable
                          key={suggestion}
                          onPress={() => setDraft(suggestion)}
                          accessibilityRole="button"
                          style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
                        >
                          <AppText style={styles.suggestionText}>{suggestion}</AppText>
                        </Pressable>
                      ),
                    )}
                  </View>
                </View>
              </ScrollView>
            ) : (
              <FlatList
                ref={listRef}
                data={rows}
                inverted
                // Only the away line scrolls by index. A row not laid out yet is
                // reached by estimate, then exactly on the next frame.
                onScrollToIndexFailed={(info) => {
                  listRef.current?.scrollToOffset({
                    offset: info.averageItemLength * info.index,
                    animated: false,
                  });
                  requestAnimationFrame(() =>
                    listRef.current?.scrollToIndex({ index: info.index, viewPosition: 1, animated: true }),
                  );
                }}
                keyExtractor={(row) => row.key}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
                // Both must stay transparent — either one painting a colour hides
                // the wallpaper behind it completely.
                style={styles.list}
                contentContainerStyle={styles.listContent}
                // Inverted: the header renders at the BOTTOM, under the newest message.
                ListHeaderComponent={
                  contactTyping ? <TypingBubble name={contactName} avatar={contactAvatar} /> : null
                }
                // ── OLDER MESSAGES (Phase 5 V-E) ──
                // Inverted, "the end" of the list is the TOP of the screen, so this
                // fires as the student scrolls UP. The older page is appended to the
                // end of the data, which renders above everything already on
                // screen — nothing under the reader moves, so they keep their place.
                // The guard is what stops it firing the same request several times
                // while one is already in flight.
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage) fetchNextPage();
                }}
                onEndReachedThreshold={0.5}
                // Inverted: the footer renders at the TOP, above the oldest message.
                // A spinner while an older page loads; the "beginning" line only
                // once next_cursor is null, because until then it is not true.
                ListFooterComponent={
                  isFetchingNextPage ? (
                    <ActivityIndicator color={colors.purple} style={styles.olderSpinner} />
                  ) : !hasNextPage ? (
                    <View style={styles.threadStartPill}>
                      <AppText style={styles.threadStart}>
                        This is the beginning of your conversation about {productTitle}.
                      </AppText>
                    </View>
                  ) : null
                }
                renderItem={renderRow}
              />
            )}
          </View>

          {/* ── Emoji tray ── */}
          {showEmoji ? (
            <View style={styles.emojiTray}>
              <View style={styles.emojiTabs}>
                {EMOJI_TABS.map((tab, i) => (
                  <Pressable
                    key={tab.label}
                    onPress={() => setEmojiTab(i)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: emojiTab === i }}
                    style={[styles.emojiTab, emojiTab === i && styles.emojiTabActive]}
                  >
                    <AppText style={[styles.emojiTabText, emojiTab === i && styles.emojiTabTextActive]}>
                      {tab.label}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              <View style={styles.emojiGrid}>
                {EMOJI_TABS[emojiTab].emojis.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => setDraft((prev) => prev + emoji)}
                    accessibilityRole="button"
                    accessibilityLabel={`Insert ${emoji}`}
                    style={({ pressed }) => [styles.emojiBtn, pressed && styles.emojiBtnPressed]}
                  >
                    <AppText style={styles.emoji}>{emoji}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* ── Composer ── */}
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, COMPOSER_BOTTOM) }]}>
            <Pressable
              onPress={() => setShowEmoji((prev) => !prev)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showEmoji ? 'Hide emoji' : 'Show emoji'}
              style={({ pressed }) => [
                styles.emojiToggle,
                showEmoji && styles.emojiToggleActive,
                pressed && styles.emojiTogglePressed,
              ]}
            >
              <Feather name="smile" size={20} color={showEmoji ? colors.purple : colors.mutedText} />
            </Pressable>

            <AppTextInput
              value={draft}
              onChangeText={handleChangeText}
              onFocus={() => setShowEmoji(false)}
              placeholder="Message"
              placeholderTextColor={colors.mutedPlaceholder}
              style={styles.input}
              multiline
              maxLength={MAX_MESSAGE_LENGTH}
              accessibilityLabel="Message"
            />

            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !canSend }}
              style={({ pressed }) => [
                styles.sendBtn,
                !canSend && styles.sendBtnDisabled,
                pressed && canSend && styles.sendBtnPressed,
              ]}
            >
              <LinearGradient
                colors={BRAND}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendGradient}
              >
                <Feather name="send" size={17} color={colors.white} />
              </LinearGradient>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoider>
    </View>
  );
}

/* ────────────────────────── Wallpaper ────────────────────────── */
/**
 * The doodle wallpaper behind the thread (MESSAGES_SPEC.md §2): the 420×420
 * tile, unscaled, repeated over the whole thread area and never moving.
 *
 * TILED BY HAND, NOT `resizeMode="repeat"`. On Android, repeat is a Fresco
 * post-process that paints one bitmap sized to the view with a "start inside"
 * scale, and on device it drew a single tile at the top and left the rest of
 * the thread bare. Here every tile is its own 420×420 dp image, so the size and
 * the coverage are the same on every phone. A phone needs 2–4 of them.
 *
 * React Native's own Image, with the 1x path only: RN picks @2x/@3x by suffix.
 * The tile size on device was confirmed with exactly this component.
 */
function ChatWallpaper() {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const cols = Math.ceil(box.w / TILE);
  const rows = Math.ceil(box.h / TILE);
  return (
    // RN's Image takes no pointerEvents prop, so the wrapper carries it.
    <View
      style={[StyleSheet.absoluteFill, styles.wallpaper]}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        // The keyboard resizes the thread; a layout pass at the same size
        // must not re-render.
        setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
      }}
    >
      {Array.from({ length: rows * cols }, (_, i) => (
        <RNImage
          key={i}
          source={CHAT_PATTERN}
          style={[styles.wallpaperTile, { left: (i % cols) * TILE, top: Math.floor(i / cols) * TILE }]}
        />
      ))}
    </View>
  );
}

/* ────────────────────────── Bubble ──────────────────────────
   MESSAGES_SPEC.md §2 "Bubbles". Memoised: every prop is either a message from
   the cache (whose identity only changes when that message does) or stable, so
   a new message re-renders one row, not the thread. No shadows on mobile (§5). */
const MessageBubble = memo(function MessageBubble({
  message,
  mine,
  firstOfRun,
  lastOfRun,
  contactName,
  contactAvatar,
  widthStyle,
  onRetry,
}: {
  message: PendingMessage;
  mine: boolean;
  firstOfRun: boolean;
  lastOfRun: boolean;
  contactName: string;
  contactAvatar: string | null;
  widthStyle: { maxWidth: number };
  onRetry: (message: PendingMessage) => void;
}) {
  return (
    <View style={firstOfRun ? styles.runStart : styles.runNext}>
      <View style={[styles.messageRow, mine ? styles.rowMine : styles.rowTheirs]}>
        {!mine ? (
          lastOfRun ? (
            <Avatar name={contactName} uri={contactAvatar} size={26} />
          ) : (
            <View style={styles.avatarSpacer} />
          )
        ) : null}

        <View
          style={[
            styles.bubble,
            widthStyle,
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            mine && lastOfRun && styles.bubbleMineTail,
            !mine && lastOfRun && styles.bubbleTheirsTail,
            message.failed && styles.bubbleFailed,
          ]}
        >
          {/* Always the first child of a sent bubble, with constant props, so it
              is created once per bubble and never rebuilt. The bubble clips it
              to its corners. */}
          {mine && SENT_GRADIENT ? (
            <LinearGradient
              colors={SENT_GRADIENT}
              start={GRADIENT_START}
              end={GRADIENT_END}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          ) : null}
          <MessageText content={message.content} mine={mine} />
          <View style={styles.bubbleMeta}>
            <AppText style={[styles.bubbleTime, mine ? styles.bubbleMetaMine : styles.bubbleMetaTheirs]}>
              {formatClockTime(message.created_at)}
            </AppText>
            {mine ? <Ticks message={message} /> : null}
          </View>
        </View>
      </View>

      {message.failed ? (
        <Pressable
          onPress={() => onRetry(message)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Retry sending this message"
          style={({ pressed }) => [styles.retryRow, pressed && styles.retryRowPressed]}
        >
          <Feather name="rotate-cw" size={11} color={colors.errorText} />
          <AppText style={styles.retryText}>Failed — tap to retry</AppText>
        </Pressable>
      ) : null}
    </View>
  );
});

/** Message body with tappable links. */
function MessageText({ content, mine }: { content: string; mine: boolean }) {
  const parts = content.split(/(https?:\/\/\S+|www\.\S+)/gi);
  return (
    <AppText style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
      {parts.map((part, i) => {
        if (!/^(https?:\/\/|www\.)/i.test(part)) return part;
        const url = part.startsWith('www.') ? `https://${part}` : part;
        return (
          <AppText
            key={`${part}-${i}`}
            style={[styles.link, mine ? styles.linkMine : styles.linkTheirs]}
            onPress={() => Linking.openURL(url).catch(() => {})}
          >
            {part}
          </AppText>
        );
      })}
    </AppText>
  );
}

/** MESSAGES_SPEC.md §2 "Ticks": clock · ✓ · ✓✓ · ✓✓ in amber when read · alert. */
function Ticks({ message }: { message: PendingMessage }) {
  if (message.failed) {
    return <Feather name="alert-circle" size={12} color={colors.chatFailedTick} />;
  }
  if (message.pending) {
    return <Feather name="clock" size={11} color={colors.bubbleMineMeta} />;
  }
  if (message.is_read) {
    return <MaterialCommunityIcons name="check-all" size={15} color={colors.chatReadTick} />;
  }
  if (message.is_delivered) {
    return <MaterialCommunityIcons name="check-all" size={15} color={colors.bubbleMineMeta} />;
  }
  return <MaterialCommunityIcons name="check" size={14} color={colors.bubbleMineMeta} />;
}

function DaySeparator({ label }: { label: string }) {
  // A chip, not a label between hairlines: on the wallpaper, bare text has the
  // doodles running through it. MESSAGES_SPEC.md §2 "Date chip".
  return (
    <View style={styles.dayChip}>
      <AppText style={styles.dayLabel}>{label}</AppText>
    </View>
  );
}

/**
 * "3 unread messages" — the line you scroll back up to find. Pink rather than
 * the day separator's hairline grey, because it marks your place rather than
 * dividing time, and the two must not read as the same thing.
 */
function UnreadDivider({ count }: { count: number }) {
  return (
    // A full-bleed band rather than a line, so the label sits on a backing
    // instead of on the wallpaper. MESSAGES_SPEC.md §2 "Unread band".
    <View style={styles.unreadBand}>
      <AppText style={styles.unreadLabel}>
        {count} unread message{count > 1 ? 's' : ''}
      </AppText>
    </View>
  );
}

/* ────────────────────────── Typing ────────────────────────── */
function TypingBubble({ name, avatar }: { name: string; avatar: string | null }) {
  return (
    <View style={[styles.messageRow, styles.rowTheirs, { marginTop: spacing.md }]}>
      <Avatar name={name} uri={avatar} size={26} />
      <View style={[styles.bubble, styles.bubbleTheirs, styles.bubbleTheirsTail, styles.typingBubble]}>
        <TypingDot delay={0} />
        <TypingDot delay={160} />
        <TypingDot delay={320} />
      </View>
    </View>
  );
}

function TypingDot({ delay }: { delay: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 320, useNativeDriver: true }),
        Animated.delay(480 - delay),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, delay]);

  return <Animated.View style={[styles.typingDot, { opacity }]} />;
}

/* ────────────────────────── States ────────────────────────── */
function ChatSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[
        { mine: false, width: '62%' as const },
        { mine: true, width: '48%' as const },
        { mine: false, width: '70%' as const },
        { mine: true, width: '40%' as const },
        { mine: false, width: '55%' as const },
      ].map((row, i) => (
        <View key={i} style={[styles.skeletonRow, row.mine ? styles.rowMine : styles.rowTheirs]}>
          <Skeleton width={row.width} height={44} rounded={BUBBLE_RADIUS} />
        </View>
      ))}
    </View>
  );
}

function ChatState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.stateWrap}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={26} color={colors.purple} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [styles.stateBtn, pressed && styles.stateBtnPressed]}
        >
          <LinearGradient
            colors={BRAND}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.stateGradient}
          >
            <AppText style={styles.stateBtnText}>{actionLabel}</AppText>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.chatCanvas },
  flex: { flex: 1 },

  /* Header — MESSAGES_SPEC.md §2; paddings and gap from the mockup `.chead`. */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: THREAD_PAD,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.messagesBarBorder,
  },
  headerDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.swipeLike,
    borderWidth: 2,
    borderColor: colors.white,
  },
  headerInfo: { flex: 1, minWidth: 0 },
  headerName: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.title,
    color: colors.black,
  },
  headerStatus: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.micro,
    color: colors.mutedText,
  },

  /* Product snippet — spec §2; bar padding from the mockup `.snip`. */
  snippetBar: {
    paddingTop: 6,
    paddingHorizontal: THREAD_PAD,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.messagesBarBorder,
  },
  snippet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.pinkLight,
  },
  snippetPressed: { backgroundColor: colors.demoCardPinkBg },
  productThumb: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.inputBg,
  },
  productThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  productTitle: {
    flex: 1,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.black,
  },

  /* Thread */
  // Ground is the root's colors.chatCanvas; the wallpaper tiles over it here.
  thread: { flex: 1, position: 'relative' },
  wallpaper: { overflow: 'hidden' },
  wallpaperTile: {
    position: 'absolute',
    width: TILE,
    height: TILE,
    opacity: CHAT_WALLPAPER_OPACITY,
  },
  list: { backgroundColor: 'transparent' },
  listContent: {
    paddingHorizontal: THREAD_PAD,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  olderSpinner: {
    paddingVertical: spacing.md,
  },
  // Backed, like every other piece of text on the wallpaper.
  threadStartPill: {
    alignSelf: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.chatNoteSurface,
  },
  threadStart: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.caption,
    lineHeight: 17,
    color: colors.mutedText,
    textAlign: 'center',
  },
  // Spec §2: 8 between runs, 2 inside one.
  runStart: { marginTop: spacing.sm },
  runNext: { marginTop: 2 },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  avatarSpacer: { width: 26 },
  // maxWidth comes from `bubbleWidth`: 78% of the thread, capped at 520.
  bubble: {
    paddingHorizontal: 12,
    paddingTop: spacing.sm,
    paddingBottom: 6,
    borderRadius: BUBBLE_RADIUS,
  },
  bubbleMine: {
    // 'solid' paints this; 'gradient' paints over it, clipped to the corners.
    backgroundColor: colors.bubbleMineSolid,
    overflow: 'hidden',
  },
  bubbleTheirs: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.bubbleTheirsBorder,
  },
  bubbleMineTail: { borderBottomRightRadius: BUBBLE_TAIL },
  bubbleTheirsTail: { borderBottomLeftRadius: BUBBLE_TAIL },
  bubbleFailed: { opacity: 0.72 },
  bubbleText: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.bodyLg,
    lineHeight: 20,
  },
  bubbleTextMine: { color: colors.white },
  bubbleTextTheirs: { color: colors.blackSoft },
  link: { textDecorationLine: 'underline' },
  linkMine: { color: colors.blueLight },
  linkTheirs: { color: colors.blueDark },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  bubbleTime: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.micro,
  },
  bubbleMetaMine: { color: colors.bubbleMineMeta },
  bubbleMetaTheirs: { color: colors.mutedText },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    marginTop: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.errorBg,
  },
  retryRowPressed: { opacity: 0.7 },
  retryText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.micro,
    color: colors.errorText,
  },
  dayChip: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 11,
    borderRadius: 99,
    backgroundColor: colors.chatDateChip,
    marginTop: 10,
    marginBottom: 6,
  },
  dayLabel: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedText,
  },

  unreadBand: {
    // Full-bleed: undo the list's side padding.
    marginHorizontal: -THREAD_PAD,
    marginVertical: spacing.sm,
    paddingVertical: 5,
    backgroundColor: colors.chatUnreadBand,
  },
  unreadLabel: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    textAlign: 'center',
    color: colors.purple,
  },

  /* Typing */
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mutedPlaceholder,
  },

  /* Empty */
  emptyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  emptyWrap: { alignItems: 'center' },
  emptyCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.chatNoteSurface,
  },
  emptyEmoji: { fontSize: font.sizes.display },
  emptyTitle: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.bodyLg,
    color: colors.blackSoft,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  emptyText: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    lineHeight: 19,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  suggestions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
  suggestion: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  suggestionPressed: { backgroundColor: colors.demoCardPinkBg },
  suggestionText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.purpleDark,
  },

  /* Emoji tray */
  emojiTray: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.cardSurface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  emojiTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  emojiTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.inputBg,
  },
  emojiTabActive: { backgroundColor: colors.demoCardPurpleBg },
  emojiTabText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    color: colors.mutedText,
  },
  emojiTabTextActive: { color: colors.purpleDark },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emojiBtn: {
    width: `${100 / 8}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  emojiBtnPressed: { backgroundColor: colors.pinkLight },
  emoji: { fontSize: font.sizes.headline },

  /* Composer — spec §2; the gap between controls is the mockup's `.comp`. */
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: 10,
    paddingTop: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.messagesBarBorder,
  },
  emojiToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBg,
  },
  emojiToggleActive: { backgroundColor: colors.demoCardPurpleBg },
  emojiTogglePressed: { transform: [{ scale: 0.94 }] },
  input: {
    flex: 1,
    minHeight: 40,
    // Five lines of 20, plus the vertical padding.
    maxHeight: 5 * 20 + 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 20,
    backgroundColor: colors.inputBg,
    fontFamily: font.family.regular,
    fontSize: font.sizes.bodyLg,
    lineHeight: 20,
    color: colors.blackSoft,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sendBtnPressed: { transform: [{ scale: 0.94 }] },
  sendBtnDisabled: { opacity: 0.4 },

  /* Skeleton + states */
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: THREAD_PAD,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  skeletonRow: { flexDirection: 'row' },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
    marginBottom: spacing.md,
  },
  stateTitle: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.title,
    color: colors.blackSoft,
    textAlign: 'center',
  },
  stateText: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    lineHeight: 19,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  stateBtn: {
    marginTop: spacing.lg,
    borderRadius: 999,
    overflow: 'hidden',
  },
  stateBtnPressed: { opacity: 0.88 },
  stateGradient: {
    height: 44,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBtnText: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    color: colors.white,
  },
});
