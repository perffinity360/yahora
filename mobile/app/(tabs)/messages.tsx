import Feather from '@expo/vector-icons/Feather';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '../../src/components/AppText';
import { AppTextInput } from '../../src/components/AppTextInput';
import { Avatar } from '../../src/components/Avatar';
import { ConnectionBanner } from '../../src/components/ConnectionBanner';
import { ScreenGradient } from '../../src/components/ScreenGradient';
import { Skeleton } from '../../src/components/Skeleton';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRealtime } from '../../src/contexts/RealtimeContext';
import { useInbox } from '../../src/hooks/useMessages';
import { formatInboxTime } from '../../src/lib/messages';
import { hrefWithFrom } from '../../src/lib/nav';
import { colors, font, spacing } from '../../src/theme';
import type { InboxItem } from '../../src/types';

const INBOX_HREF = '/(tabs)/messages';
/** The unread badge's 135° gradient (MESSAGES_SPEC.md §1). */
const BADGE = [colors.purple, colors.pinkDark] as const;

export default function MessagesScreen() {
  const router = useRouter();
  const { profile, isDemoUser } = useAuth();
  const { onlineUsers } = useRealtime();
  const { data, isLoading, isError, refetch, isRefetching } = useInbox();
  const [query, setQuery] = useState('');

  const myId = profile?.id;
  const conversations = useMemo(() => data ?? [], [data]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter(
      (row) =>
        row.contact_name?.toLowerCase().includes(needle) ||
        row.product_title?.toLowerCase().includes(needle) ||
        row.last_message?.toLowerCase().includes(needle),
    );
  }, [conversations, query]);

  // Over every conversation, not the filtered rows: the header counts the inbox.
  const unreadConversations = useMemo(
    () => conversations.filter((row) => Number(row.unread_count || 0) > 0).length,
    [conversations],
  );

  const openChat = useCallback(
    (row: InboxItem) => {
      router.push(
        hrefWithFrom(`/chat/${row.contact_id}?productId=${row.product_id}`, INBOX_HREF),
      );
    },
    [router],
  );

  const renderRow = useCallback(
    ({ item, index }: { item: InboxItem; index: number }) => (
      <ConversationRow
        row={item}
        first={index === 0}
        // Demo campus contacts are always shown online, mirroring the web.
        online={isDemoUser || (onlineUsers.has(item.contact_id) && item.contact_id !== myId)}
        isSelf={item.contact_id === myId}
        onOpen={openChat}
      />
    ),
    [isDemoUser, onlineUsers, myId, openChat],
  );

  const refreshControl = (
    <RefreshControl
      refreshing={isRefetching && !isLoading}
      onRefresh={refetch}
      tintColor={colors.purple}
      colors={[colors.purple]}
    />
  );

  return (
    <View style={styles.root}>
      <ScreenGradient variant="app" />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ConnectionBanner />

      <View style={styles.header}>
        <AppText style={styles.title}>Messages</AppText>
        {unreadConversations > 0 ? (
          <AppText style={styles.subtitle}>
            {unreadConversations} unread conversation{unreadConversations === 1 ? '' : 's'}
          </AppText>
        ) : null}
      </View>

      <View style={styles.filter}>
        <Feather name="search" size={15} color={colors.mutedText} />
        <AppTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search conversations"
          placeholderTextColor={colors.mutedText}
          style={styles.filterInput}
          returnKeyType="search"
          accessibilityLabel="Search conversations"
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Feather name="x" size={15} color={colors.mutedText} />
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <InboxSkeleton />
      ) : isError && conversations.length === 0 ? (
        <ScrollView contentContainerStyle={styles.stateScroll} refreshControl={refreshControl}>
          <InboxState
            icon="wifi-off"
            title="Couldn't load your messages"
            subtitle="Check your connection and pull to refresh."
          />
        </ScrollView>
      ) : rows.length === 0 ? (
        <ScrollView contentContainerStyle={styles.stateScroll} refreshControl={refreshControl}>
          {query ? (
            <InboxState
              icon="search"
              title={`No results for “${query.trim()}”`}
              subtitle="Try a different name or item."
            />
          ) : (
            <InboxState
              icon="message-square"
              title="No conversations yet"
              subtitle="Message a seller from any listing and the chat shows up right here."
            />
          )}
        </ScrollView>
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(row) => `${row.contact_id}-${row.product_id}`}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        />
      )}
      </SafeAreaView>
    </View>
  );
}

/* ────────────────────────── Row ──────────────────────────
   MESSAGES_SPEC.md §1 "Row". No card: rows sit straight on the canvas, split by
   a hairline that starts at the text column. Unread is carried by weight and
   colour on all three lines, plus the badge. Memoised — the inbox re-renders on
   every presence change, and only the rows whose props moved should follow. */
const ConversationRow = memo(function ConversationRow({
  row,
  first,
  online,
  isSelf,
  onOpen,
}: {
  row: InboxItem;
  /** No divider above the first row. */
  first: boolean;
  online: boolean;
  isSelf: boolean;
  onOpen: (row: InboxItem) => void;
}) {
  const unread = Number(row.unread_count || 0);
  const isUnread = unread > 0;

  return (
    <Pressable
      onPress={() => onOpen(row)}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${row.contact_name ?? 'this student'} about ${row.product_title ?? 'an item'}${isUnread ? `, ${unread} unread` : ''}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {first ? null : <View style={styles.divider} />}

      <View>
        <Avatar name={row.contact_name} uri={row.contact_avatar} size={48} />
        {online ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <AppText style={[styles.name, isUnread && styles.nameUnread]} numberOfLines={1}>
            {row.contact_name || 'Yahora student'}
            {isSelf ? ' (You)' : ''}
          </AppText>
          <AppText style={[styles.time, isUnread && styles.timeUnread]}>
            {formatInboxTime(row.last_message_time)}
          </AppText>
        </View>

        <View style={styles.rowBottom}>
          <AppText style={[styles.preview, isUnread && styles.previewUnread]} numberOfLines={1}>
            {row.last_message || 'Start the conversation ✨'}
          </AppText>
          {isUnread ? (
            <LinearGradient
              colors={BADGE}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.badge}
            >
              <AppText style={styles.badgeText}>{unread > 99 ? '99+' : unread}</AppText>
            </LinearGradient>
          ) : null}
        </View>

        <AppText style={styles.productChip} numberOfLines={1}>
          {row.product_title || 'Item'}
        </AppText>
      </View>
    </Pressable>
  );
});

/* ────────────────────────── States ────────────────────────── */
function InboxState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.stateWrap}>
      <View style={styles.stateIcon}>
        <Feather name={icon} size={26} color={colors.purple} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{subtitle}</Text>
    </View>
  );
}

/** Spec §1 "Loading": avatar circle + two bars, laid out like a real row. */
function InboxSkeleton() {
  return (
    <View style={styles.listContent}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.row}>
          {i === 0 ? null : <View style={styles.divider} />}
          <Skeleton width={48} height={48} rounded={24} />
          <View style={styles.rowBody}>
            <Skeleton width="55%" height={14} rounded={7} />
            <Skeleton width="80%" height={12} rounded={6} style={styles.skeletonBar} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* Every value below is MESSAGES_SPEC.md §1; where the spec is silent, the
   mockup (docs/design/messages-mockup.html) — noted inline. */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.appBgBottom },
  // The root holds the gradient; the safe area sits transparently on top of it.
  safe: { flex: 1 },

  // Padding: mockup `.ihead`.
  header: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: 12,
  },
  title: {
    fontFamily: font.family.serif,
    fontSize: font.sizes.headline,
    color: colors.black,
  },
  subtitle: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.caption,
    color: colors.mutedText,
    marginTop: 2, // mockup
  },

  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm, // mockup
    height: 38,
    marginTop: 10,
    marginHorizontal: spacing.md,
    marginBottom: 6,
    paddingHorizontal: 14, // mockup
    borderRadius: 19,
    backgroundColor: colors.inboxFilterBg,
    borderWidth: 1,
    borderColor: colors.messagesLine,
  },
  filterInput: {
    flex: 1,
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    color: colors.blackSoft,
    padding: 0,
  },

  listContent: {
    paddingBottom: spacing.xl,
  },

  /* Conversation row */
  row: {
    flexDirection: 'row',
    alignItems: 'center', // mockup
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  rowPressed: { backgroundColor: colors.inboxRowPressed },
  divider: {
    position: 'absolute',
    top: 0,
    left: 76,
    right: spacing.md,
    height: 1,
    backgroundColor: colors.messagesLine,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.swipeLike,
    borderWidth: 2,
    borderColor: colors.cardSurface,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline', // mockup
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.bodyLg,
    color: colors.black,
  },
  nameUnread: { fontFamily: font.family.extrabold },
  time: {
    fontFamily: font.family.medium,
    fontSize: font.sizes.micro,
    color: colors.mutedText,
  },
  timeUnread: {
    fontFamily: font.family.bold,
    color: colors.purple,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm, // mockup
    marginTop: 3, // mockup
  },
  preview: {
    flex: 1,
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    color: colors.mutedText,
  },
  previewUnread: {
    fontFamily: font.family.medium,
    color: colors.blackSoft,
  },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: font.family.bold,
    fontSize: font.sizes.micro,
    color: colors.white,
  },
  productChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    marginTop: 5,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.inboxProductChipBg,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.micro,
    color: colors.pinkDark,
  },
  skeletonBar: { marginTop: spacing.sm },

  /* States — the existing empty state, its text on the row tokens above. */
  stateScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  stateWrap: {
    alignItems: 'center',
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
    fontFamily: font.family.semibold,
    fontSize: font.sizes.bodyLg,
    color: colors.black,
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
});
