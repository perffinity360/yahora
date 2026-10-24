import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  FlatList,
  Image as RNImage,
  Linking,
  Platform,
  Pressable,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '../../src/components/CircleButton';
import { AppText } from '../../src/components/AppText';
import { AppToast, useToast } from '../../src/components/AppToast';
import { DeleteMessagesDialog } from '../../src/components/DeleteMessagesDialog';
import {
  MessageActionMenu,
  type MenuRect,
  type MessageAction,
} from '../../src/components/MessageActionMenu';
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
  useDeleteForEveryone,
  useDeleteForMe,
  useInbox,
  useMarkRead,
  useSendMessage,
  useServerBack,
} from '../../src/hooks/useMessages';
import type { ApiError } from '../../src/lib/api';
import { useUniversities } from '../../src/hooks/useUniversities';
import {
  chatRowKey,
  flattenThread,
  formatClockTime,
  formatDayLabel,
  isGroupedWith,
  isSameDay,
} from '../../src/lib/messages';
import { jumboEmojiCount, splitEmoji } from '../../src/lib/emoji';
import {
  canDeleteForEveryone,
  firstName,
  isDeleted,
  isReply,
  JUMP_HIGHLIGHT_FADE_MS,
  JUMP_HIGHLIGHT_HOLD_MS,
  JUMP_MAX_EXTRA_PAGES,
  LONG_PRESS_MS,
  REPLY_MIN_BUBBLE_WIDTH,
  SWIPE_REPLY_MAX,
  SWIPE_REPLY_TRIGGER,
} from '../../src/lib/messageActions';
import { welcomeStickerFor } from '../../src/lib/stickers';
import { hrefWithFrom } from '../../src/lib/nav';
import { supabase } from '../../src/lib/supabase';
import {
  CHAT_WALLPAPER_OPACITY,
  colors,
  EMOJI_SIZES,
  font,
  radius,
  SENT_BUBBLE_STYLE,
  spacing,
} from '../../src/theme';
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
/** Welcome sticker display size; the files are 360 px, 3x of this. */
const STICKER_SIZE = 120;
/** Scrolled up further than this (dp) and the jump-to-latest button shows —
 *  about one message, so it appears as soon as the newest one leaves view. */
const JUMP_SHOW_AFTER = 80;
/** Where the unread band lands when the thread is scrolled to it: a third of
 *  the thread above it, so it reads as a seam between old and new rather than
 *  the top of the chat — the web's UNREAD_ANCHOR_LEAD_RATIO (0.35). Inverted
 *  list, so viewPosition 1 is the TOP of the screen. */
const UNREAD_VIEW_POSITION = 1 - 0.35;
/** A row has been seen once half of it is on screen, or once it fills half the
 *  thread. The second is for a row taller than twice the thread (a long
 *  message on a phone), which can never be half on screen. A row has to pass
 *  only one of the two configs. Module-level: FlatList throws if a viewability
 *  config changes identity. Web: READ_VISIBLE_RATIO. */
const SEEN_BY_ROW = { itemVisiblePercentThreshold: 50 };
const SEEN_BY_THREAD = { viewAreaCoveragePercentThreshold: 50 };
/** Newly seen unread rows are gathered until the list settles this long, then
 *  marked read in one call. */
const READ_DEBOUNCE_MS = 300;
/** After scrolling to the unread line, reading waits this long: past the
 *  scrollToIndex retries, a glide, and viewability's own 250 ms minimum view
 *  time, so what counts as "on screen" is where the line put the reader. */
const ANCHOR_SETTLE_MS = 600;
/** scrollToIndex retries for a row that has not been measured yet. */
const SCROLL_RETRY_MAX = 4;
/** New content at the newest end holds the reader in place, unless they were
 *  within this of the newest message (the web's BOTTOM_STICK_THRESHOLD). */
const KEEP_POSITION = { minIndexForVisible: 0, autoscrollToTopThreshold: JUMP_SHOW_AFTER };
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

/* Message actions (MESSAGES_SPEC.md §10.1), in the order the menu shows them.
   A tombstone has Delete only; a pending or failed message has no menu. */
const REPLY_ACTION: MessageAction = { key: 'reply', label: 'Reply', icon: 'corner-up-left' };
const COPY_ACTION: MessageAction = { key: 'copy', label: 'Copy', icon: 'copy' };
const DELETE_ACTION: MessageAction = { key: 'delete', label: 'Delete', icon: 'trash-2', danger: true };
const MESSAGE_ACTIONS = [REPLY_ACTION, COPY_ACTION, DELETE_ACTION];
const TOMBSTONE_ACTIONS = [DELETE_ACTION];
/** TalkBack / VoiceOver: the standard long-press action selects the message,
 *  and in selection mode the standard activate action adds or removes it. */
const A11Y_ACTIONS = [{ name: 'longpress', label: 'Select message' }];
const A11Y_SELECTING_ACTIONS = [
  { name: 'activate', label: 'Select or unselect' },
  { name: 'longpress', label: 'Select or unselect' },
];
/** Swipe to reply lets go of the bubble with this spring (§10.3). */
const SWIPE_SPRING = { damping: 20, stiffness: 220 };
/** Android 13 and newer confirm a copy themselves; an app toast would double it (§10.7). */
const SYSTEM_CONFIRMS_COPY = Platform.OS === 'android' && Number(Platform.Version) >= 33;
/** The toast floats this far above the composer (§10.7). */
const TOAST_ABOVE_COMPOSER = 16;
const DELETE_FAILED = "Couldn't delete. Try again.";

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
    // Your own message is always followed, wherever you were (web parity).
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    // A reply (§10.4): the quote goes with it, and the bar closes.
    const quoted = replyTo && !isDeleted(replyTo) ? replyTo : null;
    sendMessage.mutate({
      content,
      clientTag: newClientTag(),
      replyToId: quoted?.id ?? null,
      replyToSenderId: quoted?.sender_id ?? null,
      replyPreview: quoted?.content ?? null,
    });
    setReplyToId(null);

    // Demo campus: the bot is about to reply, so show its typing bubble now.
    if (isDemoUser) {
      setContactTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setContactTyping(false), DEMO_TYPING_MS);
    }
  };

  const handleRetry = (message: PendingMessage) => {
    if (!message.client_tag) return;
    // A failed reply is sent again as the same reply: its quote is on the bubble.
    sendMessage.mutate({
      content: message.content,
      clientTag: message.client_tag,
      replyToId: message.reply_to_id,
      replyToSenderId: message.reply_to_sender_id,
      replyPreview: message.reply_preview,
    });
  };
  // One stable function for every row, so the memoised bubbles do not
  // re-render each time the screen does. Same send, same mutation.
  const retryRef = useRef(handleRetry);
  retryRef.current = handleRetry;
  const onRetry = useCallback((message: PendingMessage) => retryRef.current(message), []);

  /* ── MESSAGE ACTIONS (spec §10.1, §10.2, §10.7, §10.8) — WhatsApp's model ──
     Long-press a message (the bubble or the empty part of its row) and it is
     SELECTED: its row gets the band, the header turns into "1 selected", and a
     menu opens next to it in the thread. While anything is selected, a tap on
     another message adds it (and a tap on a selected one removes it); the
     menu closes as soon as the thread is touched, and the header carries the
     actions for everything selected. Back, or the header's arrow, leaves.

     The screen holds the selection as ids and reads the messages from the
     thread, so a message deleted for everyone while selected loses Copy, and
     one that leaves the thread leaves the selection. */
  const deleteForEveryone = useDeleteForEveryone(contactId, productId);
  const deleteForMe = useDeleteForMe(contactId, productId);
  const { toast, showToast } = useToast();
  // The raw name: firstName() gives "Yahora student" when there is none (§10.4).
  const contactFirstName = firstName(inboxRow?.contact_name || params.contactName);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** The menu beside the long-pressed message, in the root view's coordinates. */
  const [menu, setMenu] = useState<{ id: string; anchor: MenuRect; bounds: MenuRect } | null>(
    null,
  );
  /** The messages the delete dialog is open for. */
  const [deleteTargets, setDeleteTargets] = useState<PendingMessage[] | null>(null);

  // Oldest first, like the thread: copying several gives them in chat order.
  const selectedMessages = useMemo(() => {
    if (!selectedIds.length) return [];
    const ids = new Set(selectedIds);
    return thread.filter((m) => ids.has(m.id));
  }, [selectedIds, thread]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selecting = selectedIds.length > 0;
  const menuMessage = menu ? (selectedMessages.find((m) => m.id === menu.id) ?? null) : null;

  // A selected message that leaves the thread (hidden for me here, or a new
  // conversation's history) leaves the selection too.
  useEffect(() => {
    if (selectedMessages.length !== selectedIds.length) {
      setSelectedIds(selectedMessages.map((m) => m.id));
    }
  }, [selectedMessages, selectedIds.length]);
  useEffect(() => {
    if (!selecting) setMenu(null);
  }, [selecting]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setMenu(null);
  }, []);

  useEffect(() => {
    clearSelection();
    setDeleteTargets(null);
  }, [contactId, productId, clearSelection]);

  // Android back leaves selection mode before it leaves the chat.
  useEffect(() => {
    if (!selecting) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      clearSelection();
      return true;
    });
    return () => sub.remove();
  }, [selecting, clearSelection]);

  const rootRef = useRef<View>(null);
  const threadBoxRef = useRef<View>(null);
  const selectingRef = useRef(selecting);
  selectingRef.current = selecting;

  const toggleSelected = useCallback((id: string) => {
    setMenu(null);
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  /* Stable, so passing them to every memoised row re-renders none of them.
     `bubble` is the bubble's box in window coordinates; the menu is placed in
     the root view's, inside the thread's. */
  const onLongPressMessage = useCallback(
    (id: string, bubble: MenuRect | null) => {
      if (selectingRef.current) {
        toggleSelected(id);
        return;
      }
      const root = rootRef.current;
      const box = threadBoxRef.current;
      if (!bubble || !root || !box) {
        setSelectedIds([id]);
        return;
      }
      // Selected and menu in the same render, so the header never shows its
      // own actions for the frame before the menu arrives.
      root.measureInWindow((rx, ry) => {
        box.measureInWindow((tx, ty, tw, th) => {
          setSelectedIds([id]);
          setMenu({
            id,
            anchor: { ...bubble, x: bubble.x - rx, y: bubble.y - ry },
            bounds: { x: tx - rx, y: ty - ry, width: tw, height: th },
          });
        });
      });
    },
    [toggleSelected],
  );

  const copyMessages = async (messages: PendingMessage[]) => {
    let copied = false;
    try {
      copied = await Clipboard.setStringAsync(messages.map((m) => m.content).join('\n'));
    } catch {
      copied = false;
    }
    // Android shows nothing when a copy fails, so that toast is on every phone.
    if (!copied) showToast("Couldn't copy");
    else if (!SYSTEM_CONFIRMS_COPY) showToast('Copied');
  };

  /* Several at once is one request per message, all together; the hooks keep
     the thread right for each (a tombstone in place, or the row gone). */
  const runDelete = async (messages: PendingMessage[], forEveryone: boolean) => {
    setDeleteTargets(null);
    clearSelection();
    const results = await Promise.allSettled(
      messages.map((m) =>
        forEveryone ? deleteForEveryone.mutateAsync(m.id) : deleteForMe.mutateAsync(m.id),
      ),
    );
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (!failed.length) return;
    // The hour can run out while the dialog is open; the server decides.
    const expired = failed.some(
      (r) => (r.reason as ApiError)?.body?.error === 'DELETE_WINDOW_EXPIRED',
    );
    const one = messages.length === 1;
    if (expired) {
      showToast(
        one ? "It's too late to delete this for everyone" : 'Some were too old to delete for everyone',
      );
    } else showToast(one ? DELETE_FAILED : "Couldn't delete some messages. Try again.");
  };

  /** What the selection offers, in the header and (for one message) the menu. */
  const selectionHasTombstone = selectedMessages.some(isDeleted);
  const canReplyToSelection = selectedMessages.length === 1 && !selectionHasTombstone;
  const canCopySelection = selectedMessages.length > 0 && !selectionHasTombstone;

  const handleAction = (key: string) => {
    const messages = selectedMessages;
    if (!messages.length) return;
    if (key === 'reply') {
      if (messages.length !== 1) return;
      clearSelection();
      startReplyRef.current(messages[0].id);
    } else if (key === 'copy') {
      clearSelection();
      copyMessages(messages);
    } else if (key === 'delete') {
      // The selection stays under the dialog; Cancel goes back to it.
      setMenu(null);
      setDeleteTargets(messages);
    }
  };

  const deleteOffersEveryone =
    !!deleteTargets && deleteTargets.every((m) => canDeleteForEveryone(m, myId));

  /* ── REPLY (spec §10.4) ── The message being answered, shown in the reply bar
     over the composer. By id, read from the thread: deleted for everyone or
     hidden while the bar is up, it closes. */
  const inputRef = useRef<TextInput>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const replyTo = useMemo(
    () => (replyToId ? (thread.find((m) => m.id === replyToId) ?? null) : null),
    [replyToId, thread],
  );
  useEffect(() => {
    if (replyToId && (!replyTo || isDeleted(replyTo))) setReplyToId(null);
  }, [replyToId, replyTo]);
  useEffect(() => {
    setReplyToId(null);
  }, [contactId, productId]);

  const startReply = (id: string) => {
    const message = threadRef.current.find((m) => m.id === id);
    if (!message || isDeleted(message) || message.pending || message.failed) return;
    setReplyToId(id);
    setShowEmoji(false);
    inputRef.current?.focus();
  };
  // Swipes call it from every row; one stable function keeps the rows memoised.
  const startReplyRef = useRef(startReply);
  startReplyRef.current = startReply;
  const onSwipeReply = useCallback((id: string) => startReplyRef.current(id), []);

  /* SENDING AGAIN ON ITS OWN (spec §2). A message that failed because the
     server couldn't be reached goes again by itself once the server answers,
     and a history load that failed is reloaded first. A message the server
     refused (auto_retry false) never goes by itself, only by a tap. Only while
     this chat is on screen and live: leave it, and its failed messages wait
     for you to come back. */
  const waitingOnServer = isError || thread.some((m) => m.failed && m.auto_retry);
  useServerBack(waitingOnServer && focused && reachable, async () => {
    let list = thread;
    if (isError) {
      const result = await refetch();
      if (result.data) list = flattenThread(result.data);
    }
    list.filter((m) => m.failed && m.auto_retry).forEach((m) => retryRef.current(m));
  });

  const goBack = () => {
    if (fromParam) router.replace(fromParam);
    else if (router.canGoBack()) router.back();
    else router.replace(MESSAGES_HREF);
  };

  /* ── "N unread messages" divider (web parity: Messages.jsx unreadMarker) ──
     Pinned at open time, NOT derived from is_read on every render. Opening the
     thread soon leads to PUT /messages/read (READ ON SIGHT), which flips those
     rows' is_read to true — a derived marker would appear and then vanish while you
     were still looking for where you left off, which is the one moment it is
     for. Pinned, it stays put until you leave the thread or reply.

     `undefined` = not pinned yet. Until then it is derived, so the first render
     that has messages already has the line — pinning it in an effect alone
     would paint the messages one frame without it.

     Pinned only once the history has SETTLED — no fetch in flight. Every cache
     is persisted, so the first render can be yesterday's copy of this thread;
     a line pinned on that would miss whatever arrived since. Nothing is marked
     read before the pin (see READ ON SIGHT), so the server's is_read flags are
     still the ones the line is built from.

     More unread than one page: the line goes above the oldest unread message
     that IS loaded, counting only the loaded ones — exactly the web. No extra
     page is fetched to find the real first one. */
  type UnreadMarker = { firstId: string; count: number };
  const [unreadMarker, setUnreadMarker] = useState<UnreadMarker | null | undefined>(undefined);

  const openMarker = useMemo(() => {
    if (unreadMarker !== undefined) return unreadMarker;
    const fromContact = thread.filter((m) => m.sender_id !== myId);
    let unread = fromContact.filter((m) => m.is_read === false);
    // Web parity (Messages.jsx handleSelectChat): the inbox count is the
    // server's answer for this thread, and wins when it says there are more —
    // the rows' is_read can already have been flipped by a receipt in flight.
    const reported = Number(inboxRow?.unread_count || 0);
    if (reported > unread.length) unread = fromContact.slice(-reported);
    return unread.length ? { firstId: unread[0].id, count: unread.length } : null;
  }, [unreadMarker, thread, myId, inboxRow?.unread_count]);

  const historySettled = !isFetching && (history !== undefined || isError);

  /** A line to bring into view once it is among the rendered rows: the open
   *  line instantly, the away line with a glide. State, not a ref: nothing is
   *  read while one is waiting — see READ ON SIGHT. */
  const [lineToShow, setLineToShow] = useState<{ firstId: string; animated: boolean } | null>(null);

  /* READ ON SIGHT bookkeeping (used further down): the message rows on screen
     right now, the ones already sent to the server, and the pending batch. */
  const visibleIdsRef = useRef<Set<string>>(new Set());
  // What each viewability config last reported; visibleIdsRef is their union.
  const visibleByConfigRef = useRef<Set<string>[]>([new Set(), new Set()]);
  const reportedIdsRef = useRef<Set<string>>(new Set());
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A different conversation is a different marker, and starts unread-blind.
  // Declared before the pin below: on mount both set `lineToShow` in the same
  // flush, and the pin's, coming second, is the one that stands.
  useEffect(() => {
    setUnreadMarker(undefined);
    setLineToShow(null);
    visibleIdsRef.current = new Set();
    visibleByConfigRef.current = [new Set(), new Set()];
    reportedIdsRef.current = new Set();
    pendingIdsRef.current = new Set();
  }, [contactId, productId]);

  useEffect(() => {
    if (unreadMarker !== undefined || !historySettled) return;
    setUnreadMarker(openMarker);
    if (openMarker) setLineToShow({ firstId: openMarker.firstId, animated: false });
  }, [unreadMarker, openMarker, historySettled]);

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
     screen moves — and only then can READ ON SIGHT send PUT /messages/read and
     turn the sender's ticks blue. The inbox badge counts them until then.

     A chat under another screen is not on screen: leaving it is not "away",
     and nothing is read while it is unfocused. */
  const [away, setAway] = useState<{ lastSeenId: string | null } | null>(null);
  const awayRef = useRef(away);
  awayRef.current = away;
  /** The re-read after a return has finished; the line can be pinned. */
  const [resynced, setResynced] = useState(false);
  /** Bumped by every departure and return, so a stale re-read cannot flush. */
  const returnSeqRef = useRef(0);

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
      // Leaving the chat (e.g. to the product page). What is on screen when it
      // comes back into focus is read on sight, like anything else.
      returnSeqRef.current += 1;
      setAway(null);
      setResynced(false);
      return;
    }
    if (!reachable) {
      returnSeqRef.current += 1;
      setResynced(false);
      setAway((prev) => prev ?? { lastSeenId: lastContactMessageIdRef.current });
      return;
    }
    // Live and not coming back from away: nothing to do here — rows are marked
    // read as they reach the screen.
    if (!awayRef.current) return;
    // Back. Joins the resync's refetch if that one started first.
    const seq = ++returnSeqRef.current;
    refetch({ cancelRefetch: false }).then(() => {
      if (returnSeqRef.current === seq) setResynced(true);
    });
  }, [focused, reachable, contactId, productId, isSelfChat, refetch]);

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
    if (!away || !resynced || isFetching) return;
    setAway(null);
    setResynced(false);
    if (!awayMarker) return;
    setLineToShow({ firstId: awayMarker.firstId, animated: true });
    setUnreadMarker(awayMarker);
  }, [away, resynced, isFetching, awayMarker]);

  /** Replying is reading (WhatsApp): the line goes, and stays gone. The send
   *  scrolls to the newest message, which marks it read on sight. */
  const clearUnreadLine = () => {
    setUnreadMarker(null);
    setLineToShow(null);
    // Still away (a reply typed offline): what is on screen now has been
    // seen, but anything that arrives after it still gets a line.
    if (awayRef.current) setAway({ lastSeenId: lastContactMessageIdRef.current });
  };

  /* ── READ ON SIGHT (§1.10) ─────────────────────────────────────────────
     A message is read once half of its row, or half the thread, has been on screen
     (viewabilityPairs: SEEN_BY_ROW, SEEN_BY_THREAD) — not when the chat opens.
     Newly seen unread ids are gathered and, once the list has been still for
     READ_DEBOUNCE_MS, sent as ONE PUT /messages/read through useMarkRead.

     The call says "read UP TO the newest of them" (`upToId`, backend/API.md
     PUT /api/messages/read — Telegram's read position). Everything at or before
     it turns read on the sender's phone; anything after it stays unread, keeps
     the inbox badge, and is the line next time. Read the band's first three
     and leave, and the sender sees three read, not six.

     Nothing is read while:
       - the chat is under another screen, or the app is backgrounded or
         offline (AWAY);
       - the line is not pinned yet — a read sent before the pin would race
         the history and erase the line;
       - a line is waiting to be scrolled to, or has just been (ANCHOR_SETTLE_MS).
         Until then the screen shows wherever the list happened to start — the
         NEWEST messages — and a read position taken there would mark the whole
         run read before the reader is ever shown the line. */
  const [anchorHold, setAnchorHold] = useState(false);
  const anchorHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (anchorHoldTimerRef.current) clearTimeout(anchorHoldTimerRef.current);
    },
    [],
  );

  const canRead =
    focused && reachable && !away && unreadMarker !== undefined && !lineToShow && !anchorHold;

  const threadRef = useRef(thread);
  threadRef.current = thread;

  /** Send the pending batch as one read position: its newest message. */
  const flushRead = (chatContactId: string, chatProductId: string) => {
    const batch = pendingIdsRef.current;
    pendingIdsRef.current = new Set();
    if (!batch.size) return;
    const list = threadRef.current;
    let bound = -1;
    for (let i = list.length - 1; i >= 0; i--) {
      if (batch.has(list[i].id)) {
        bound = i;
        break;
      }
    }
    // Gone from the thread (a different chat's rows by now): drop the batch
    // rather than send a read position nobody saw.
    if (bound === -1) {
      batch.forEach((id) => reportedIdsRef.current.delete(id));
      return;
    }
    let remaining = 0;
    for (let i = bound + 1; i < list.length; i++) {
      if (list[i].sender_id !== myId && list[i].is_read === false) remaining++;
    }
    markReadRef.current.mutate(
      { contactId: chatContactId, productId: chatProductId, upToId: list[bound].id, remaining },
      // Not sent: let these be seen again instead of stranded as "reported".
      { onError: () => batch.forEach((id) => reportedIdsRef.current.delete(id)) },
    );
  };
  const flushReadRef = useRef(flushRead);
  flushReadRef.current = flushRead;

  const markSeenRef = useRef<() => void>(() => {});
  markSeenRef.current = () => {
    if (!canRead || !contactId || !productId) return;
    const visible = visibleIdsRef.current;
    const reported = reportedIdsRef.current;
    const fresh: string[] = [];
    for (const m of thread) {
      if (m.sender_id !== myId && m.is_read === false && visible.has(m.id) && !reported.has(m.id)) {
        fresh.push(m.id);
      }
    }
    if (!fresh.length) return;
    fresh.forEach((id) => {
      reported.add(id);
      pendingIdsRef.current.add(id);
    });
    if (readTimerRef.current) clearTimeout(readTimerRef.current);
    readTimerRef.current = setTimeout(() => {
      readTimerRef.current = null;
      flushReadRef.current(contactId, productId);
    }, READ_DEBOUNCE_MS);
  };

  // FlatList throws if these change identity, so they are created once and
  // read everything live through refs. Each config reports its own rows; a row
  // either one reports is on screen.
  const viewabilityPairs = useRef(
    [SEEN_BY_ROW, SEEN_BY_THREAD].map((viewabilityConfig, config) => ({
      viewabilityConfig,
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken<ChatRow>[] }) => {
        const ids = new Set<string>();
        for (const token of viewableItems) {
          if (token.isViewable && token.item?.kind === 'msg') ids.add(token.item.message.id);
        }
        visibleByConfigRef.current[config] = ids;
        visibleIdsRef.current = new Set(visibleByConfigRef.current.flatMap((set) => [...set]));
        markSeenRef.current();
      },
    })),
  ).current;

  // Rows already on screen when reading becomes allowed (line pinned, back
  // from away, refocused), or that turn unread under the reader (a new
  // message at the bottom), report no viewability CHANGE — check them here.
  useEffect(() => {
    markSeenRef.current();
  }, [canRead, thread]);

  // Leaving with a batch still pending sends it: those rows were seen.
  useEffect(
    () => () => {
      if (!readTimerRef.current) return;
      clearTimeout(readTimerRef.current);
      readTimerRef.current = null;
      if (contactId && productId) flushReadRef.current(contactId, productId);
    },
    [contactId, productId],
  );

  const listRef = useRef<FlatList<ChatRow>>(null);
  /** The list has measured itself; scrollToIndex before this lands wrong. */
  const [listLaidOut, setListLaidOut] = useState(false);
  const scrollRetryRef = useRef(0);

  /* ── JUMP TO LATEST (WhatsApp's ⌄ button) ──────────────────────────────
     Shows once the student has scrolled up past JUMP_SHOW_AFTER. The list is
     inverted, so offset 0 is the newest message and scrolling up GROWS the
     offset. State flips only when the threshold is crossed, never per frame.

     The badge counts the contact's messages that arrived after the student
     scrolled away — the newest message at that moment is the anchor. Purely
     visual: it reads the thread, and changes nothing about reading, marking
     read or the unread line. */
  const [scrolledUp, setScrolledUp] = useState(false);
  const [jumpAnchor, setJumpAnchor] = useState<string | null>(null);
  const scrolledUpRef = useRef(false);
  const lastMessageIdRef = useRef(lastMessageId);
  lastMessageIdRef.current = lastMessageId;

  const onListScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const up = e.nativeEvent.contentOffset.y > JUMP_SHOW_AFTER;
    if (up === scrolledUpRef.current) return;
    scrolledUpRef.current = up;
    setScrolledUp(up);
    setJumpAnchor(up ? lastMessageIdRef.current : null);
  }, []);

  // A different conversation starts at the bottom, with no button.
  useEffect(() => {
    scrolledUpRef.current = false;
    setScrolledUp(false);
    setJumpAnchor(null);
  }, [contactId, productId]);

  const newBelow = useMemo(() => {
    if (!scrolledUp || !jumpAnchor) return 0;
    const at = thread.findIndex((m) => m.id === jumpAnchor);
    if (at === -1) return 0;
    let count = 0;
    for (let i = at + 1; i < thread.length; i++) if (thread[i].sender_id !== myId) count++;
    return count;
  }, [scrolledUp, jumpAnchor, thread, myId]);

  const jumpToLatest = () => listRef.current?.scrollToOffset({ offset: 0, animated: true });

  /* ── Rows: day separators + grouping, built oldest-first then reversed
        because the list is inverted (index 0 renders at the bottom). ────── */
  const rows = useMemo<ChatRow[]>(() => {
    const out: ChatRow[] = [];
    thread.forEach((message, i) => {
      const previous = thread[i - 1];
      const next = thread[i + 1];
      if (!previous || !isSameDay(previous.created_at, message.created_at)) {
        const day = formatDayLabel(message.created_at);
        out.push({ kind: 'day', key: `day-${day}-${chatRowKey(message)}`, label: day });
      }
      // Above the first message they had not read, below everything they had.
      if (marker && message.id === marker.firstId) {
        out.push({ kind: 'unread', key: `unread-${message.id}`, count: marker.count });
      }
      out.push({
        kind: 'msg',
        // Not `message.id`: a bubble sent from here changes id when the server
        // row arrives, and a new key would rebuild it on screen (chatRowKey).
        key: chatRowKey(message),
        message,
        mine: message.sender_id === myId,
        firstOfRun: !previous || !isGroupedWith(previous, message),
        lastOfRun: !next || !isGroupedWith(message, next),
      });
    });
    return out.reverse();
  }, [thread, myId, marker]);

  /** THE scroller for a row by index: the unread line, and the jump to a
   *  quoted message (§10.6) — the same placement (UNREAD_VIEW_POSITION, 35%
   *  down the thread) and the same retries (onScrollToIndexFailed). */
  const scrollToRow = (index: number, animated: boolean) => {
    scrollRetryRef.current = 0;
    listRef.current?.scrollToIndex({ index, viewPosition: UNREAD_VIEW_POSITION, animated });
  };

  /* ── JUMP TO THE ORIGINAL (spec §10.6) ──────────────────────────────────
     Pressing a quote scrolls to the message it quotes and flashes its row.
     Not loaded yet: older pages are fetched — the same fetchNextPage that
     scrolling up uses — at most JUMP_MAX_EXTRA_PAGES of them, checking after
     each. Nothing here touches read state or the unread line. */
  const [flash, setFlash] = useState<{ id: string; n: number } | null>(null);
  const [pendingJump, setPendingJump] = useState<{ id: string; pagesLeft: number } | null>(null);
  const jumpFetchingRef = useRef(false);

  const jumpToRow = (id: string): boolean => {
    const index = rows.findIndex((row) => row.kind === 'msg' && row.message.id === id);
    if (index === -1) return false;
    scrollToRow(index, true);
    setFlash((prev) => ({ id, n: (prev?.n ?? 0) + 1 }));
    return true;
  };
  const jumpToRowRef = useRef(jumpToRow);
  jumpToRowRef.current = jumpToRow;

  const onJumpToOriginal = useCallback((id: string) => {
    if (selectingRef.current) return;
    if (!jumpToRowRef.current(id)) setPendingJump({ id, pagesLeft: JUMP_MAX_EXTRA_PAGES });
  }, []);

  useEffect(() => {
    if (!pendingJump || isFetchingNextPage || jumpFetchingRef.current) return;
    if (jumpToRowRef.current(pendingJump.id)) {
      setPendingJump(null);
      return;
    }
    if (!hasNextPage || pendingJump.pagesLeft <= 0) {
      setPendingJump(null);
      showToast("Couldn't find the original message");
      return;
    }
    jumpFetchingRef.current = true;
    const { id } = pendingJump;
    fetchNextPage().finally(() => {
      jumpFetchingRef.current = false;
      // Checked again once the page has rendered (this effect, on `rows`).
      setPendingJump((prev) => (prev?.id === id ? { id, pagesLeft: prev.pagesLeft - 1 } : prev));
    });
  }, [pendingJump, rows, hasNextPage, isFetchingNextPage, fetchNextPage, showToast]);

  useEffect(() => {
    setPendingJump(null);
    setFlash(null);
  }, [contactId, productId]);

  /* A line was pinned — on open, or on return from away: bring it into view,
     a third of the way down (UNREAD_VIEW_POSITION). A long run would otherwise
     leave it above the top of the screen. Once, per pin: receipts and older
     pages never move the viewport after this. Opening with nothing unread
     asks for nothing, and an inverted list starts at the newest message. */
  useEffect(() => {
    // Before the list has measured itself, scrollToIndex computes against a
    // zero-height viewport.
    if (!lineToShow || !listLaidOut) return;
    // This effect can run in the same commit that scheduled the line, before
    // the line is in `rows`. Only once it is here has it reached the screen.
    const index = rows.findIndex(
      (row) => row.kind === 'unread' && row.key === `unread-${lineToShow.firstId}`,
    );
    if (index === -1) return;
    setLineToShow(null);
    // From near the bottom the offset clamps and nothing moves, which is right
    // — the line is already in view.
    scrollToRow(index, lineToShow.animated);
    // Reading waits until the viewport has settled on the line (READ ON SIGHT).
    setAnchorHold(true);
    if (anchorHoldTimerRef.current) clearTimeout(anchorHoldTimerRef.current);
    anchorHoldTimerRef.current = setTimeout(() => {
      anchorHoldTimerRef.current = null;
      setAnchorHold(false);
    }, ANCHOR_SETTLE_MS);
  }, [lineToShow, rows, listLaidOut]);

  /* The realtime "active chat" (RealtimeContext) is the one whose arrivals do
     not raise the inbox badge. Only while it is being read live AND sitting at
     the newest message — anything arriving while scrolled up has not been
     seen, so it is counted until READ ON SIGHT reaches it. */
  useEffect(() => {
    if (!contactId || !productId || isSelfChat) return;
    setActiveChat(focused && reachable && !away && !scrolledUp ? { contactId, productId } : null);
  }, [focused, reachable, away, scrolledUp, contactId, productId, isSelfChat, setActiveChat]);

  const canSend = !!draft.trim() && !!contactId && !!productId;

  /** This conversation's welcome sticker — fixed per chat; see src/lib/stickers.ts. */
  const welcomeSticker = useMemo(
    () => welcomeStickerFor(myId, contactId, productId),
    [myId, contactId, productId],
  );

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
          contactFirstName={contactFirstName}
          // Selecting one more message changes only that row's `selected`, and
          // a flash only that row's `flashToken`: the memo re-renders that row
          // and no other. Entering or leaving selection mode (`selecting`)
          // re-renders the rows on screen once.
          selected={selectedSet.has(item.message.id)}
          selecting={selecting}
          flashToken={flash?.id === item.message.id ? flash.n : 0}
          onLongPress={onLongPressMessage}
          onTap={toggleSelected}
          onSwipeReply={onSwipeReply}
          onJumpToOriginal={onJumpToOriginal}
        />
      ),
    [
      contactName,
      contactAvatar,
      bubbleWidth,
      onRetry,
      contactFirstName,
      selectedSet,
      selecting,
      flash,
      onLongPressMessage,
      toggleSelected,
      onSwipeReply,
      onJumpToOriginal,
    ],
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
    <View style={styles.root} ref={rootRef}>
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

            {/* Selection mode (WhatsApp): over the header, in the same box, so
                nothing below it moves. The actions show here once the menu
                beside the message has closed. */}
            {selecting ? (
              <Reanimated.View
                entering={FadeIn.duration(140)}
                exiting={FadeOut.duration(120)}
                style={styles.selectionBar}
              >
                <CircleButton
                  icon="arrow-left"
                  iconSize={22}
                  iconColor={colors.purple}
                  onPress={clearSelection}
                  variant="plain"
                  hitSlop={10}
                  accessibilityLabel="Cancel selection"
                />
                <AppText style={styles.selectionCount} accessibilityLiveRegion="polite">
                  {selectedMessages.length} selected
                </AppText>
                {!menu ? (
                  <View style={styles.selectionActions}>
                    {canReplyToSelection ? (
                      <CircleButton
                        icon="corner-up-left"
                        iconColor={colors.blackSoft}
                        onPress={() => handleAction('reply')}
                        variant="plain"
                        accessibilityLabel="Reply"
                      />
                    ) : null}
                    {canCopySelection ? (
                      <CircleButton
                        icon="copy"
                        iconColor={colors.blackSoft}
                        onPress={() => handleAction('copy')}
                        variant="plain"
                        accessibilityLabel="Copy"
                      />
                    ) : null}
                    <CircleButton
                      icon="trash-2"
                      iconColor={colors.errorText}
                      onPress={() => handleAction('delete')}
                      variant="plain"
                      accessibilityLabel="Delete"
                    />
                  </View>
                ) : null}
              </Reanimated.View>
            ) : null}
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

          {/* ── Thread ── Any touch in it closes the menu beside a message (the
              touch itself still selects, scrolls or opens a link). */}
          <View
            style={styles.thread}
            ref={threadBoxRef}
            onTouchStart={menu ? () => setMenu(null) : undefined}
          >
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
                    <WelcomeSticker source={welcomeSticker.source} />
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
                onLayout={() => setListLaidOut(true)}
                // Only the unread line scrolls by index. Rows differ in height and
                // a row past the first render is not measured yet: go there by
                // estimate, which renders it, then exactly on the next frame.
                // Bounded, so a row that never measures cannot loop forever.
                onScrollToIndexFailed={(info) => {
                  if (scrollRetryRef.current >= SCROLL_RETRY_MAX) return;
                  scrollRetryRef.current += 1;
                  listRef.current?.scrollToOffset({
                    offset: info.averageItemLength * info.index,
                    animated: false,
                  });
                  requestAnimationFrame(() =>
                    listRef.current?.scrollToIndex({
                      index: info.index,
                      viewPosition: UNREAD_VIEW_POSITION,
                      animated: false,
                    }),
                  );
                }}
                // READ ON SIGHT — both must keep their identity for the list's life.
                viewabilityConfigCallbackPairs={viewabilityPairs}
                // A message arriving while scrolled up joins index 0 — the newest
                // end — and would push the reader's rows along by its height.
                // Hold them still, unless they were at the newest message.
                maintainVisibleContentPosition={KEEP_POSITION}
                keyExtractor={(row) => row.key}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
                onScroll={onListScroll}
                scrollEventThrottle={32}
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
                extraData={renderRow}
                // The menu belongs to where the message was; scrolling closes it
                // and keeps the selection.
                onScrollBeginDrag={menu ? () => setMenu(null) : undefined}
              />
            )}

            {/* Over the thread, outside the list: it must not scroll or flip. */}
            {scrolledUp && thread.length > 0 ? (
              <Reanimated.View
                entering={ZoomIn.duration(180)}
                exiting={ZoomOut.duration(140)}
                style={styles.jumpWrap}
              >
                <Pressable
                  onPress={jumpToLatest}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    newBelow > 0
                      ? `${newBelow} new message${newBelow > 1 ? 's' : ''}. Jump to latest`
                      : 'Jump to latest message'
                  }
                  style={({ pressed }) => [styles.jumpBtn, pressed && styles.jumpBtnPressed]}
                >
                  <Feather name="chevrons-down" size={20} color={colors.purple} />
                </Pressable>
                {newBelow > 0 ? (
                  <LinearGradient
                    colors={BRAND}
                    start={GRADIENT_START}
                    end={GRADIENT_END}
                    style={styles.jumpBadge}
                    pointerEvents="none"
                  >
                    <AppText style={styles.jumpBadgeText}>{newBelow > 99 ? '99+' : newBelow}</AppText>
                  </LinearGradient>
                ) : null}
              </Reanimated.View>
            ) : null}

            {/* Bottom of the thread = top of the composer (or the emoji tray). */}
            <AppToast message={toast} bottom={TOAST_ABOVE_COMPOSER} />
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
                    // maxLength only limits typing; text set from code skips
                    // it. Refuse the whole emoji rather than split it.
                    onPress={() =>
                      setDraft((prev) =>
                        prev.length + emoji.length > MAX_MESSAGE_LENGTH ? prev : prev + emoji,
                      )
                    }
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
            {replyTo ? (
              <ReplyBar
                name={replyTo.sender_id === myId ? 'You' : contactFirstName}
                text={replyTo.content}
                onClose={() => setReplyToId(null)}
              />
            ) : null}
            <View style={styles.composerRow}>
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
                ref={inputRef}
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
          </View>
        </SafeAreaView>
      </KeyboardAvoider>

      {menu && menuMessage ? (
        <MessageActionMenu
          anchor={menu.anchor}
          bounds={menu.bounds}
          side={menuMessage.sender_id === myId ? 'mine' : 'theirs'}
          actions={isDeleted(menuMessage) ? TOMBSTONE_ACTIONS : MESSAGE_ACTIONS}
          onSelect={handleAction}
        />
      ) : null}

      <DeleteMessagesDialog
        visible={!!deleteTargets}
        count={deleteTargets?.length ?? 0}
        canDeleteForEveryone={deleteOffersEveryone}
        contactName={contactFirstName}
        onCancel={() => setDeleteTargets(null)}
        onDeleteForMe={() => deleteTargets && runDelete(deleteTargets, false)}
        onDeleteForEveryone={() => deleteTargets && runDelete(deleteTargets, true)}
      />
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
   a new message re-renders one row, not the thread. No shadows on mobile (§5).

   THE ROW, NOT THE BUBBLE, TAKES THE GESTURES (WhatsApp): it spans the thread's
   full width, so a long-press on the empty space beside a message selects it
   too. All of it runs on the UI thread; the only JS calls are the ones that
   change something (select, unselect, reply), once per gesture. */
const MessageBubble = memo(function MessageBubble({
  message,
  mine,
  firstOfRun,
  lastOfRun,
  contactName,
  contactAvatar,
  widthStyle,
  onRetry,
  contactFirstName,
  selected,
  selecting,
  flashToken,
  onLongPress,
  onTap,
  onSwipeReply,
  onJumpToOriginal,
}: {
  message: PendingMessage;
  mine: boolean;
  firstOfRun: boolean;
  lastOfRun: boolean;
  contactName: string;
  contactAvatar: string | null;
  widthStyle: { maxWidth: number };
  onRetry: (message: PendingMessage) => void;
  /** The name in a quote of their message (§10.5). */
  contactFirstName: string;
  /** Selected: the row gets the full-width band (spec §10.2). */
  selected: boolean;
  /** Something is selected: a tap selects or unselects, and links, quotes and swipes rest. */
  selecting: boolean;
  /** Changes each time this row is jumped to (§10.6); 0 = never. */
  flashToken: number;
  /** `bubble`: the bubble's box in window coordinates, for the menu beside it. */
  onLongPress: (messageId: string, bubble: MenuRect | null) => void;
  onTap: (messageId: string) => void;
  onSwipeReply: (messageId: string) => void;
  onJumpToOriginal: (messageId: string) => void;
}) {
  const deleted = isDeleted(message);
  // A message still sending, or failed, has no actions (spec §10.1): its
  // failed pill handles it. A tombstone can't be replied to (§10.3).
  const actionable = !message.pending && !message.failed;
  const swipeable = actionable && !deleted;
  const reply = isReply(message) && !deleted;
  const messageId = message.id;
  const bubbleRef = useRef<View>(null);

  const handleLongPress = useCallback(() => {
    const node = bubbleRef.current;
    if (!node) {
      onLongPress(messageId, null);
      return;
    }
    node.measureInWindow((x, y, width, height) => onLongPress(messageId, { x, y, width, height }));
  }, [messageId, onLongPress]);

  /* Swipe right to reply (§10.3). The bubble follows the finger up to
     SWIPE_REPLY_MAX; let go past SWIPE_REPLY_TRIGGER and it is a reply. */
  const swipeX = useSharedValue(0);
  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: swipeX.value }] }));
  const swipeIconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(swipeX.value, [0, SWIPE_REPLY_TRIGGER], [0, 1], 'clamp'),
  }));

  /* Long-press: select (or, in selection mode, select / unselect). A finger
     that moves (a scroll) fails it, and a quick tap still reaches a link's
     onPress. Tap: only in selection mode. Pan: the swipe; 12 to the right
     starts it, 10 up or down or 12 to the left gives the touch to the list.
     Race: whichever activates first cancels the others. */
  const gesture = useMemo(() => {
    const longPress = Gesture.LongPress()
      .minDuration(LONG_PRESS_MS)
      .enabled(actionable)
      .onStart(() => {
        runOnJS(handleLongPress)();
      });
    const tap = Gesture.Tap()
      .enabled(actionable && selecting)
      .onEnd((_event, success) => {
        if (success) runOnJS(onTap)(messageId);
      });
    const pan = Gesture.Pan()
      .enabled(swipeable && !selecting)
      .activeOffsetX(12)
      .failOffsetX(-12)
      .failOffsetY([-10, 10])
      .onUpdate((event) => {
        swipeX.value = Math.min(Math.max(event.translationX, 0), SWIPE_REPLY_MAX);
      })
      .onEnd(() => {
        if (swipeX.value >= SWIPE_REPLY_TRIGGER) runOnJS(onSwipeReply)(messageId);
      })
      .onFinalize(() => {
        swipeX.value = withSpring(0, SWIPE_SPRING);
      });
    return Gesture.Race(pan, longPress, tap);
  }, [actionable, swipeable, selecting, messageId, handleLongPress, onTap, onSwipeReply, swipeX]);

  /* The flash after a jump to this message (§10.6): the band at full strength,
     held, then faded. Only this row re-renders for it. */
  const flashOpacity = useSharedValue(0);
  useEffect(() => {
    if (!flashToken) return;
    flashOpacity.value = withSequence(
      withTiming(1, { duration: 0 }),
      withDelay(JUMP_HIGHLIGHT_HOLD_MS, withTiming(0, { duration: JUMP_HIGHLIGHT_FADE_MS })),
    );
  }, [flashToken, flashOpacity]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

  // "You" when the quoted message is mine: on my bubble I am the sender, on
  // theirs the receiver.
  const quoteName =
    message.reply_to_sender_id === (mine ? message.sender_id : message.receiver_id)
      ? 'You'
      : contactFirstName;

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[styles.row, firstOfRun ? styles.runStart : styles.runNext, selected && styles.rowSelected]}
        // Selecting: the whole row is one target, so a tap on a link or a
        // quote selects the message instead of opening it.
        pointerEvents={selecting ? 'box-only' : 'auto'}
      >
        {flashToken ? (
          <Reanimated.View pointerEvents="none" style={[styles.rowFlash, flashStyle]} />
        ) : null}
        <View>
          {swipeable ? (
            <Reanimated.View pointerEvents="none" style={[styles.swipeIcon, swipeIconStyle]}>
              <Feather name="corner-up-left" size={18} color={colors.purple} />
            </Reanimated.View>
          ) : null}
          <Reanimated.View style={[styles.messageRow, mine ? styles.rowMine : styles.rowTheirs, swipeStyle]}>
            {!mine ? (
              lastOfRun ? (
                <Avatar name={contactName} uri={contactAvatar} size={26} />
              ) : (
                <View style={styles.avatarSpacer} />
              )
            ) : null}

            <View
              ref={bubbleRef}
              collapsable={false}
              style={[
                styles.bubble,
                widthStyle,
                mine ? styles.bubbleMine : styles.bubbleTheirs,
                mine && lastOfRun && styles.bubbleMineTail,
                !mine && lastOfRun && styles.bubbleTheirsTail,
                message.failed && styles.bubbleFailed,
                reply && styles.bubbleReply,
              ]}
              accessibilityState={selecting ? { selected } : undefined}
              accessibilityActions={
                actionable ? (selecting ? A11Y_SELECTING_ACTIONS : A11Y_ACTIONS) : undefined
              }
              onAccessibilityAction={
                actionable
                  ? () => (selecting ? onTap(messageId) : handleLongPress())
                  : undefined
              }
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
              {deleted ? (
                <Tombstone mine={mine} />
              ) : (
                <>
                  {reply ? (
                    <ReplyQuote
                      message={message}
                      mine={mine}
                      name={quoteName}
                      onJump={onJumpToOriginal}
                    />
                  ) : null}
                  <MessageText content={message.content} mine={mine} />
                </>
              )}
              <View style={styles.bubbleMeta}>
                <AppText style={[styles.bubbleTime, mine ? styles.bubbleMetaMine : styles.bubbleMetaTheirs]}>
                  {formatClockTime(message.created_at)}
                </AppText>
                {/* A tombstone shows its time only, never ticks (§10.8). */}
                {mine && !deleted ? <Ticks message={message} /> : null}
              </View>
            </View>
          </Reanimated.View>
        </View>

        {message.failed ? (
          <Pressable
            onPress={() => onRetry(message)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Message not sent. Tap to try again"
            style={({ pressed }) => [styles.retryRow, pressed && styles.retryRowPressed]}
          >
            <Feather name="rotate-cw" size={11} color={colors.errorText} />
            {/* Shown only after the automatic retries gave up (useSendMessage).
                Tapping starts them again. */}
            <AppText style={styles.retryText}>Failed to send</AppText>
          </Pressable>
        ) : null}
      </View>
    </GestureDetector>
  );
});

/**
 * The quote at the top of a reply (MESSAGES_SPEC.md §10.5). Pressing it jumps
 * to the original (§10.6) — unless the original was deleted for everyone
 * (`reply_preview` null) or is gone from the table (`reply_to_id` null).
 */
function ReplyQuote({
  message,
  mine,
  name,
  onJump,
}: {
  message: PendingMessage;
  mine: boolean;
  name: string;
  onJump: (messageId: string) => void;
}) {
  const gone = message.reply_preview == null;
  const target = gone ? null : (message.reply_to_id ?? null);
  const body = (
    <>
      <View style={[styles.quoteAccent, mine ? styles.quoteAccentMine : styles.quoteAccentTheirs]} />
      <AppText style={[styles.quoteName, mine ? styles.quoteNameMine : styles.quoteNameTheirs]} numberOfLines={1}>
        {name}
      </AppText>
      <AppText
        style={[
          gone ? styles.quoteGone : styles.quoteText,
          mine ? styles.quoteTextMine : styles.quoteTextTheirs,
        ]}
        numberOfLines={2}
      >
        {gone ? 'Original message was deleted' : message.reply_preview}
      </AppText>
    </>
  );
  const look = [styles.quote, mine ? styles.quoteMine : styles.quoteTheirs];
  if (!target) return <View style={look}>{body}</View>;
  return (
    <Pressable
      onPress={() => onJump(target)}
      accessibilityRole="button"
      accessibilityLabel={`Reply to ${name}: ${message.reply_preview}. Show the original`}
      style={({ pressed }) => [look, pressed && styles.quotePressed]}
    >
      {body}
    </Pressable>
  );
}

/** The reply bar over the composer's input (MESSAGES_SPEC.md §10.4). */
function ReplyBar({ name, text, onClose }: { name: string; text: string; onClose: () => void }) {
  return (
    <Reanimated.View entering={FadeIn.duration(150)} style={styles.replyBar}>
      <View style={styles.replyAccent} />
      <View style={styles.replyBarText}>
        <AppText style={styles.replyBarName} numberOfLines={1}>
          Replying to {name}
        </AppText>
        {/* Plain text: an emoji-only message stays at this size (no jumbo). */}
        <AppText style={styles.replyBarQuote} numberOfLines={1}>
          {text}
        </AppText>
      </View>
      <Pressable
        onPress={onClose}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel="Cancel reply"
        style={({ pressed }) => [styles.replyClose, pressed && styles.replyClosePressed]}
      >
        <Feather name="x" size={16} color={colors.mutedText} />
      </Pressable>
    </Reanimated.View>
  );
}

/**
 * Message body: tappable links, and emoji drawn at emoji size (src/lib/emoji.ts).
 * A message of only one to three emoji is drawn jumbo instead, the whole text
 * at that size — WhatsApp's rule.
 */
function MessageText({ content, mine }: { content: string; mine: boolean }) {
  const jumbo = useMemo(() => jumboEmojiCount(content), [content]);
  const parts = useMemo(
    () =>
      jumbo
        ? []
        : content.split(/(https?:\/\/\S+|www\.\S+)/gi).map((part) => ({
            part,
            url: /^(https?:\/\/|www\.)/i.test(part)
              ? part.startsWith('www.')
                ? `https://${part}`
                : part
              : null,
            runs: splitEmoji(part),
          })),
    [content, jumbo],
  );
  const textStyle = [styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs];

  if (jumbo) {
    return <AppText style={[textStyle, JUMBO_STYLES[jumbo as 1 | 2 | 3]]}>{content}</AppText>;
  }

  return (
    <AppText style={textStyle}>
      {parts.map(({ part, url, runs }, i) => {
        const body = runs.map((run, k) =>
          run.emoji ? (
            <AppText key={k} style={styles.emojiInline}>
              {run.text}
            </AppText>
          ) : (
            run.text
          ),
        );
        if (!url) return <Fragment key={i}>{body}</Fragment>;
        return (
          <AppText
            key={`${part}-${i}`}
            style={[styles.link, mine ? styles.linkMine : styles.linkTheirs]}
            onPress={() => Linking.openURL(url).catch(() => {})}
          >
            {body}
          </AppText>
        );
      })}
    </AppText>
  );
}

/**
 * MESSAGES_SPEC.md §10.8 "The tombstone": a message deleted for everyone. Drawn
 * inside the normal bubble of its side. No MessageText, so no emoji sizing and
 * no links: there is no text left to draw.
 */
function Tombstone({ mine }: { mine: boolean }) {
  const color = mine ? colors.chatTombstoneMine : colors.mutedText;
  return (
    <View style={styles.tombstone}>
      <Feather name="slash" size={14} color={color} />
      <AppText style={[styles.tombstoneText, mine ? styles.tombstoneMine : styles.tombstoneTheirs]}>
        {mine ? 'You deleted this message' : 'This message was deleted'}
      </AppText>
    </View>
  );
}

/** MESSAGES_SPEC.md §2 "Ticks": clock · ✓ · ✓✓ · ✓✓ in blue when read · alert. */
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

/* ────────────────────────── Welcome sticker ────────────────────────── */
/**
 * Telegram-style greeting in an empty chat: one of the welcome stickers
 * (src/lib/stickers.ts), chosen per conversation. An animated WebP, played by
 * expo-image. With the phone's reduce-motion setting on, it holds still on its
 * first frame. Decorative: the card's text says everything a screen reader needs.
 */
function WelcomeSticker({ source }: { source: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <Image
      source={source}
      style={styles.sticker}
      contentFit="contain"
      autoplay={!reduceMotion}
      accessible={false}
    />
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
  selectionBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: THREAD_PAD,
    backgroundColor: colors.white,
  },
  selectionCount: {
    flex: 1,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.title,
    color: colors.blackSoft,
  },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  // Full-bleed, like the unread band: undo the list's side padding, then put
  // it back inside. The whole width is the row's touch target (a long-press
  // beside a message selects it), and the bands below cover all of it.
  row: {
    marginHorizontal: -THREAD_PAD,
    paddingHorizontal: THREAD_PAD,
  },
  // Spec §2: 8 between runs, 2 inside one. Padding, not margin, so the gap
  // above a row is part of it: selected rows' bands meet, and a long-press in
  // the gap still lands on a message.
  runStart: { paddingTop: spacing.sm },
  runNext: { paddingTop: 2 },
  rowSelected: { backgroundColor: colors.chatRowSelected },
  rowFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.chatRowHighlight,
  },
  /* Swipe to reply — spec §10.3: at the row's left edge, bottom-aligned. */
  swipeIcon: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    shadowColor: colors.chatMenuShadow,
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  /* The quote inside a reply — spec §10.5. */
  bubbleReply: { minWidth: REPLY_MIN_BUBBLE_WIDTH },
  quote: {
    alignSelf: 'stretch',
    marginBottom: 6,
    paddingVertical: 6,
    paddingLeft: 11,
    paddingRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  quoteMine: { backgroundColor: colors.chatQuoteMineBg },
  quoteTheirs: { backgroundColor: colors.chatQuoteTheirsBg },
  quotePressed: { opacity: 0.75 },
  quoteAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  quoteAccentMine: { backgroundColor: colors.chatQuoteMineBar },
  quoteAccentTheirs: { backgroundColor: colors.purple },
  quoteName: { fontFamily: font.family.semibold, fontSize: font.sizes.caption, lineHeight: 16 },
  quoteNameMine: { color: colors.white },
  quoteNameTheirs: { color: colors.purple },
  quoteText: { fontFamily: font.family.regular, fontSize: font.sizes.caption, lineHeight: 16 },
  quoteGone: { fontFamily: font.family.italic, fontSize: font.sizes.caption, lineHeight: 16 },
  quoteTextMine: { color: colors.chatQuoteMineText },
  quoteTextTheirs: { color: colors.mutedText },
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
  /** An emoji inside text. The paragraph keeps its 20 line height. */
  emojiInline: { fontSize: EMOJI_SIZES.inline },
  bubbleTextMine: { color: colors.white },
  bubbleTextTheirs: { color: colors.blackSoft },
  tombstone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tombstoneText: {
    fontFamily: font.family.italic,
    fontSize: font.sizes.bodyLg,
    lineHeight: 20,
  },
  tombstoneMine: { color: colors.chatTombstoneMine },
  tombstoneTheirs: { color: colors.mutedText },
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

  /* Jump to latest — sized and coloured from the composer's send button and the
     inbox badge, so nothing new is introduced. */
  jumpWrap: {
    position: 'absolute',
    right: THREAD_PAD,
    bottom: 12,
  },
  jumpBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.messagesLine,
    shadowColor: colors.purple,
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  jumpBtnPressed: { transform: [{ scale: 0.94 }], backgroundColor: colors.pinkLight },
  jumpBadge: {
    position: 'absolute',
    top: -8,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpBadgeText: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    color: colors.white,
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
  sticker: { width: STICKER_SIZE, height: STICKER_SIZE },
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
    paddingHorizontal: 10,
    paddingTop: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.messagesBarBorder,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  /* Reply bar — spec §10.4. */
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 13,
    paddingRight: 6,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.chatQuoteTheirsBg,
  },
  replyAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.purple,
  },
  replyBarText: { flex: 1, minWidth: 0 },
  replyBarName: {
    fontFamily: font.family.semibold,
    fontSize: font.sizes.caption,
    lineHeight: 16,
    color: colors.purple,
  },
  replyBarQuote: {
    fontFamily: font.family.regular,
    fontSize: font.sizes.caption,
    lineHeight: 16,
    color: colors.mutedText,
  },
  replyClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyClosePressed: { backgroundColor: colors.inboxRowPressed },
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

/** Emoji-only messages: 1, 2 or 3 emoji, each a size step down (EMOJI_SIZES). */
const JUMBO_STYLES = StyleSheet.create(
  Object.fromEntries(
    ([1, 2, 3] as const).map((n) => [
      n,
      { fontSize: EMOJI_SIZES.jumbo[n], lineHeight: Math.round(EMOJI_SIZES.jumbo[n] * 1.25) },
    ]),
  ) as Record<1 | 2 | 3, { fontSize: number; lineHeight: number }>,
);
