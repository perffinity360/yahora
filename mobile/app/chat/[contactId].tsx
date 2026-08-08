import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '../../src/components/Avatar';
import { ConnectionBanner } from '../../src/components/ConnectionBanner';
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
import { formatClockTime, formatDayLabel, isGroupedWith, sortByTime } from '../../src/lib/messages';
import { hrefWithFrom } from '../../src/lib/nav';
import { supabase } from '../../src/lib/supabase';
import { colors, font, radius, spacing } from '../../src/theme';
import type { PendingMessage } from '../../src/types';

const BRAND = [colors.purple, colors.pinkDark] as const;
const MESSAGES_HREF = '/(tabs)/messages';
const MAX_MESSAGE_LENGTH = 2000;

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
  const { onlineUsers, setActiveChat } = useRealtime();

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
    data: messages,
    isLoading,
    isError,
    refetch,
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

  /* ── Tell realtime which chat is open, and clear the unread badge ────── */
  useFocusEffect(
    useCallback(() => {
      if (!contactId || !productId || isSelfChat) return;
      setActiveChat({ contactId, productId });
      markReadRef.current.mutate({ contactId, productId });
      return () => setActiveChat(null);
    }, [contactId, productId, isSelfChat, setActiveChat]),
  );

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

  const thread = useMemo(() => sortByTime(messages ?? []), [messages]);
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

  const goBack = () => {
    if (fromParam) router.replace(fromParam);
    else if (router.canGoBack()) router.back();
    else router.replace(MESSAGES_HREF);
  };

  /* ── Rows: day separators + grouping, built oldest-first then reversed
        because the list is inverted (index 0 renders at the bottom). ────── */
  const rows = useMemo<ChatRow[]>(() => {
    const out: ChatRow[] = [];
    thread.forEach((message, i) => {
      const previous = thread[i - 1];
      const next = thread[i + 1];
      const day = formatDayLabel(message.created_at);
      if (!previous || formatDayLabel(previous.created_at) !== day) {
        out.push({ kind: 'day', key: `day-${day}-${message.id}`, label: day });
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
  }, [thread, myId]);

  const canSend = !!draft.trim() && !!contactId && !!productId;

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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
          <ConnectionBanner />

          {/* ── Header ── */}
          <View style={styles.header}>
            <Pressable
              onPress={goBack}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            >
              <Feather name="arrow-left" size={21} color={colors.purpleDark} />
            </Pressable>

            <View>
              <Avatar name={contactName} uri={contactAvatar} size={42} />
              {isOnline ? <View style={styles.headerDot} /> : null}
            </View>

            <View style={styles.headerInfo}>
              <View style={styles.headerNameRow}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {contactName}
                </Text>
                {isOnline ? <Text style={styles.onlineLabel}>Online</Text> : null}
              </View>

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
                style={({ pressed }) => [styles.productStrip, pressed && styles.productStripPressed]}
              >
                {productImage ? (
                  <Image source={{ uri: productImage }} style={styles.productThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.productThumb, styles.productThumbFallback]}>
                    <Feather name="image" size={9} color={colors.mutedPlaceholder} />
                  </View>
                )}
                <Text style={styles.productTitle} numberOfLines={1}>
                  {productTitle}
                </Text>
                <Feather name="chevron-right" size={13} color={colors.purple} />
              </Pressable>
            </View>
          </View>

          {/* ── Thread ── */}
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
                <Text style={styles.emptyEmoji}>👋</Text>
                <Text style={styles.emptyTitle}>Start the conversation about {productTitle}.</Text>
                <Text style={styles.emptyText}>
                  Ask if it&apos;s still available, agree a price, and meet somewhere public on campus.
                </Text>
                <View style={styles.suggestions}>
                  {['Hi! Is this still available? 😊', "What's the condition?", 'Can we meet on campus?'].map(
                    (suggestion) => (
                      <Pressable
                        key={suggestion}
                        onPress={() => setDraft(suggestion)}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
                      >
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                      </Pressable>
                    ),
                  )}
                </View>
              </View>
            </ScrollView>
          ) : (
            <FlatList
              data={rows}
              inverted
              keyExtractor={(row) => row.key}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              // Inverted: the header renders at the BOTTOM, under the newest message.
              ListHeaderComponent={
                contactTyping ? <TypingBubble name={contactName} avatar={contactAvatar} /> : null
              }
              ListFooterComponent={
                <Text style={styles.threadStart}>
                  This is the beginning of your conversation about {productTitle}.
                </Text>
              }
              renderItem={({ item }) =>
                item.kind === 'day' ? (
                  <DaySeparator label={item.label} />
                ) : (
                  <MessageBubble
                    message={item.message}
                    mine={item.mine}
                    firstOfRun={item.firstOfRun}
                    lastOfRun={item.lastOfRun}
                    contactName={contactName}
                    contactAvatar={contactAvatar}
                    onRetry={() => handleRetry(item.message)}
                  />
                )
              }
            />
          )}

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
                    <Text style={[styles.emojiTabText, emojiTab === i && styles.emojiTabTextActive]}>
                      {tab.label}
                    </Text>
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
                    <Text style={styles.emoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* ── Composer ── */}
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
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

            <TextInput
              value={draft}
              onChangeText={handleChangeText}
              onFocus={() => setShowEmoji(false)}
              placeholder="Type a message…"
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
      </KeyboardAvoidingView>
    </View>
  );
}

/* ────────────────────────── Bubble ────────────────────────── */
function MessageBubble({
  message,
  mine,
  firstOfRun,
  lastOfRun,
  contactName,
  contactAvatar,
  onRetry,
}: {
  message: PendingMessage;
  mine: boolean;
  firstOfRun: boolean;
  lastOfRun: boolean;
  contactName: string;
  contactAvatar: string | null;
  onRetry: () => void;
}) {
  return (
    <View style={{ marginTop: firstOfRun ? spacing.md : 3 }}>
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
            mine ? styles.bubbleMine : styles.bubbleTheirs,
            mine && lastOfRun && styles.bubbleMineTail,
            !mine && lastOfRun && styles.bubbleTheirsTail,
            message.failed && styles.bubbleFailed,
          ]}
        >
          <MessageText content={message.content} mine={mine} />
          <View style={styles.bubbleMeta}>
            <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
              {formatClockTime(message.created_at)}
            </Text>
            {mine ? <Ticks message={message} /> : null}
          </View>
        </View>
      </View>

      {message.failed ? (
        <Pressable
          onPress={onRetry}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Retry sending this message"
          style={({ pressed }) => [styles.retryRow, pressed && styles.retryRowPressed]}
        >
          <Feather name="rotate-cw" size={11} color={colors.errorText} />
          <Text style={styles.retryText}>Failed — tap to retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Message body with tappable links. */
function MessageText({ content, mine }: { content: string; mine: boolean }) {
  const parts = content.split(/(https?:\/\/\S+|www\.\S+)/gi);
  return (
    <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
      {parts.map((part, i) => {
        if (!/^(https?:\/\/|www\.)/i.test(part)) return part;
        const url = part.startsWith('www.') ? `https://${part}` : part;
        return (
          <Text
            key={`${part}-${i}`}
            style={[styles.link, mine ? styles.linkMine : styles.linkTheirs]}
            onPress={() => Linking.openURL(url).catch(() => {})}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

/** Sending → clock · sent → ✓ · delivered → ✓✓ · read → ✓✓ in blue. */
function Ticks({ message }: { message: PendingMessage }) {
  if (message.failed) {
    return <Feather name="alert-circle" size={12} color={colors.swipePass} />;
  }
  if (message.pending) {
    return <Feather name="clock" size={11} color={colors.pinkBg} />;
  }
  if (message.is_read) {
    return <MaterialCommunityIcons name="check-all" size={15} color={colors.blueLight} />;
  }
  if (message.is_delivered) {
    return <MaterialCommunityIcons name="check-all" size={15} color={colors.pinkBg} />;
  }
  return <MaterialCommunityIcons name="check" size={14} color={colors.pinkBg} />;
}

function DaySeparator({ label }: { label: string }) {
  return (
    <View style={styles.daySeparator}>
      <View style={styles.dayLine} />
      <Text style={styles.dayLabel}>{label}</Text>
      <View style={styles.dayLine} />
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
          <Skeleton width={row.width} height={44} rounded={radius.lg} />
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
            <Text style={styles.stateBtnText}>{actionLabel}</Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: { backgroundColor: colors.pinkLight },
  headerDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.swipeLike,
    borderWidth: 2,
    borderColor: colors.cardSurface,
  },
  headerInfo: { flex: 1, minWidth: 0 },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerName: {
    flexShrink: 1,
    fontFamily: font.family.bold,
    fontSize: 15,
    color: colors.blackSoft,
  },
  onlineLabel: {
    fontFamily: font.family.semibold,
    fontSize: 10.5,
    color: colors.successText,
  },
  productStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 5,
    marginTop: 4,
    paddingLeft: 3,
    paddingRight: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  productStripPressed: { backgroundColor: colors.demoCardPinkBg },
  productThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.inputBg,
  },
  productThumbFallback: { alignItems: 'center', justifyContent: 'center' },
  productTitle: {
    flexShrink: 1,
    fontFamily: font.family.semibold,
    fontSize: 11.5,
    color: colors.purpleDark,
  },

  /* Thread */
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  threadStart: {
    fontFamily: font.family.regular,
    fontSize: 11.5,
    lineHeight: 17,
    color: colors.mutedLabel,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  avatarSpacer: { width: 26 },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 18,
  },
  bubbleMine: { backgroundColor: colors.purple },
  bubbleTheirs: {
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  bubbleMineTail: { borderBottomRightRadius: 5 },
  bubbleTheirsTail: { borderBottomLeftRadius: 5 },
  bubbleFailed: { opacity: 0.72 },
  bubbleText: {
    fontFamily: font.family.regular,
    fontSize: 14,
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
    fontFamily: font.family.regular,
    fontSize: 10,
  },
  bubbleTimeMine: { color: colors.pinkBg },
  bubbleTimeTheirs: { color: colors.mutedLabel },
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
    fontSize: 10.5,
    color: colors.errorText,
  },
  daySeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: 2,
  },
  dayLine: { flex: 1, height: 1, backgroundColor: colors.hairline },
  dayLabel: {
    fontFamily: font.family.bold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedLabel,
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
  emptyEmoji: { fontSize: 40 },
  emptyTitle: {
    fontFamily: font.family.bold,
    fontSize: 16,
    color: colors.blackSoft,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  emptyText: {
    fontFamily: font.family.regular,
    fontSize: 13,
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
    fontSize: 12.5,
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
    fontSize: 11.5,
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
  emoji: { fontSize: 22 },

  /* Composer */
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.cardSurface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
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
    maxHeight: 110,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.inputBorderFocus,
    backgroundColor: colors.white,
    fontFamily: font.family.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.blackSoft,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
  sendGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sendBtnPressed: { transform: [{ scale: 0.94 }] },
  sendBtnDisabled: { opacity: 0.4 },

  /* Skeleton + states */
  skeletonWrap: {
    flex: 1,
    paddingHorizontal: spacing.md,
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
    fontSize: 17,
    color: colors.blackSoft,
    textAlign: 'center',
  },
  stateText: {
    fontFamily: font.family.regular,
    fontSize: 13,
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
    fontSize: 14,
    color: colors.white,
  },
});
