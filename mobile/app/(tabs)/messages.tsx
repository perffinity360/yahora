import Feather from '@expo/vector-icons/Feather';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '../../src/components/Avatar';
import { ConnectionBanner } from '../../src/components/ConnectionBanner';
import { Skeleton } from '../../src/components/Skeleton';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRealtime } from '../../src/contexts/RealtimeContext';
import { useInbox } from '../../src/hooks/useMessages';
import { formatInboxTime } from '../../src/lib/messages';
import { hrefWithFrom } from '../../src/lib/nav';
import { colors, font, radius, spacing } from '../../src/theme';
import type { InboxItem } from '../../src/types';

const INBOX_HREF = '/(tabs)/messages';

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

  const openChat = (row: InboxItem) => {
    router.push(
      hrefWithFrom(`/chat/${row.contact_id}?productId=${row.product_id}`, INBOX_HREF),
    );
  };

  const refreshControl = (
    <RefreshControl
      refreshing={isRefetching && !isLoading}
      onRefresh={refetch}
      tintColor={colors.purple}
      colors={[colors.purple]}
    />
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ConnectionBanner />

      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.searchBar}>
          <Feather name="search" size={15} color={colors.mutedLabel} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search conversations…"
            placeholderTextColor={colors.mutedPlaceholder}
            style={styles.searchInput}
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
              <Feather name="x" size={15} color={colors.mutedLabel} />
            </Pressable>
          ) : null}
        </View>
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
          renderItem={({ item }) => (
            <ConversationRow
              row={item}
              // Demo campus contacts are always shown online, mirroring the web.
              online={isDemoUser || (onlineUsers.has(item.contact_id) && item.contact_id !== myId)}
              isSelf={item.contact_id === myId}
              onPress={() => openChat(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        />
      )}
    </SafeAreaView>
  );
}

/* ────────────────────────── Row ────────────────────────── */
function ConversationRow({
  row,
  online,
  isSelf,
  onPress,
}: {
  row: InboxItem;
  online: boolean;
  isSelf: boolean;
  onPress: () => void;
}) {
  const unread = Number(row.unread_count || 0);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chat with ${row.contact_name ?? 'this student'} about ${row.product_title ?? 'an item'}${unread > 0 ? `, ${unread} unread` : ''}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View>
        <Avatar name={row.contact_name} uri={row.contact_avatar} size={50} />
        {online ? <View style={styles.onlineDot} /> : null}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>
            {row.contact_name || 'Yahora student'}
            {isSelf ? ' (You)' : ''}
          </Text>
          <Text style={styles.time}>{formatInboxTime(row.last_message_time)}</Text>
        </View>

        <View style={styles.productChip}>
          {row.product_image ? (
            <Image source={{ uri: row.product_image }} style={styles.productThumb} contentFit="cover" />
          ) : (
            <View style={[styles.productThumb, styles.productThumbFallback]}>
              <Feather name="image" size={9} color={colors.mutedPlaceholder} />
            </View>
          )}
          <Text style={styles.productTitle} numberOfLines={1}>
            {row.product_title || 'Item'}
          </Text>
        </View>

        <View style={styles.rowBottom}>
          <Text
            style={[styles.preview, unread > 0 && styles.previewUnread]}
            numberOfLines={1}
          >
            {row.last_message || 'Start the conversation ✨'}
          </Text>
          {unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

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

function InboxSkeleton() {
  return (
    <View style={styles.listContent}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={50} height={50} rounded={25} />
          <View style={styles.rowBody}>
            <Skeleton width="55%" height={14} rounded={7} />
            <Skeleton width={120} height={18} rounded={9} style={{ marginTop: 8 }} />
            <Skeleton width="80%" height={12} rounded={6} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: font.family.serif,
    fontSize: 28,
    color: colors.blackSoft,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: 999,
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  searchInput: {
    flex: 1,
    fontFamily: font.family.regular,
    fontSize: 14,
    color: colors.blackSoft,
    padding: 0,
  },

  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },

  /* Conversation row */
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  rowPressed: {
    backgroundColor: colors.pinkLight,
    borderColor: colors.inputBorderFocus,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontFamily: font.family.bold,
    fontSize: 14.5,
    color: colors.blackSoft,
  },
  time: {
    fontFamily: font.family.medium,
    fontSize: 11,
    color: colors.mutedLabel,
  },
  productChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: 6,
    marginTop: 6,
    paddingRight: 10,
    paddingLeft: 4,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  productThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.inputBg,
  },
  productThumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productTitle: {
    flexShrink: 1,
    fontFamily: font.family.semibold,
    fontSize: 11.5,
    color: colors.mutedText,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 6,
  },
  preview: {
    flex: 1,
    fontFamily: font.family.regular,
    fontSize: 13,
    color: colors.mutedText,
  },
  previewUnread: {
    fontFamily: font.family.bold,
    color: colors.blackSoft,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.purple,
  },
  unreadText: {
    fontFamily: font.family.extrabold,
    fontSize: 10.5,
    color: colors.white,
  },

  /* States */
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
});
