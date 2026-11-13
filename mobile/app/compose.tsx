import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../src/components/AppText';
import { AppTextInput } from '../src/components/AppTextInput';
import { AppToast, useToast } from '../src/components/AppToast';
import { Avatar } from '../src/components/Avatar';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { KeyboardAvoider } from '../src/components/KeyboardAvoider';
import { GifPicker } from '../src/components/community/GifPicker';
import { SupportCard } from '../src/components/community/SupportCard';
import { WorldGlyph } from '../src/components/community/CommunitySwitcher';
import { useAuth } from '../src/contexts/AuthContext';
import { useCountries } from '../src/hooks/useCommunity';
import { COMPOSER_TEXT, useComposer } from '../src/hooks/useComposer';
import { useLeaveOnce } from '../src/hooks/useLeaveOnce';
import { countryName, GLOBAL } from '../src/lib/community';
import { colors, font } from '../src/theme';

/**
 * The compose screen — COMMUNITY_SPEC.md §2.2 and §2.3, opened as a modal:
 *
 *   router.push('/compose?feed=campus|country|global&country=IN')
 *   router.push('/compose?feed=…&parent=<post id>&to=<username>')   a reply
 *   …&pick=photos | gif     opens the photo library or the GIF picker at once
 *
 *   · your avatar, then a text box that grows; no "Posting as" line (spec §2.2);
 *   · the destination chip in the top bar (checkpoint V-D4b), or "Replying to
 *     @username" for a reply. Where the post goes can't be changed here;
 *   · at the bottom, over the keyboard: photo, GIF, the counter (at 100 or
 *     fewer left) and Post. A reply has no photo button;
 *   · a button that can't be used says why when pressed (photos or a GIF,
 *     never both): spec §2.2's press hint;
 *   · every result of spec §2.3: closing after a post (the feed shows it at its
 *     top) or a hold (the feed shows the toast); the "Post this?" dialog; the
 *     support card; inline messages above Post; the toast for a network error.
 *
 * The rules are all in useComposer; this file is the look.
 */
export default function ComposeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const leaveOnce = useLeaveOnce();
  const { profile } = useAuth();
  const { toast, showToast } = useToast();
  const params = useLocalSearchParams<{ feed?: string; country?: string; parent?: string; to?: string; pick?: string }>();
  const scope = params.feed === 'country' || params.feed === 'global' ? params.feed : 'campus';
  const parentId = typeof params.parent === 'string' && params.parent ? params.parent : null;
  const replyTo = typeof params.to === 'string' ? params.to : '';
  const countries = useCountries().data ?? [];

  const c = useComposer({ scope, parentId });
  const [gifOpen, setGifOpen] = useState(false);
  const world = scope === 'country' ? (params.country ?? '').toUpperCase() : scope === 'global' ? GLOBAL : null;
  const accent = scope === 'campus' ? colors.purpleDark : colors.communityWorldStrong;

  const close = () => leaveOnce(() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/community' as never)));

  // `pick`: the closed composer's photo button opens the library straight away.
  const picked = useRef(false);
  useEffect(() => {
    if (picked.current) return;
    picked.current = true;
    if (params.pick === 'photos' && !parentId) void c.pickPhotos();
    if (params.pick === 'gif') setGifOpen(true);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (confirm = false) => {
    const outcome = await c.submit({ confirm });
    if (outcome === 'posted' || outcome === 'held') close();
    else if (outcome === 'error') showToast(COMPOSER_TEXT.error);
  };

  const onPhotoPress = () => {
    if (c.photosBlocked) showToast(c.photosBlocked);
    else void c.pickPhotos();
  };
  const onGifPress = () => {
    if (c.gifBlocked) showToast(c.gifBlocked);
    else setGifOpen(true);
  };

  const placeholder = parentId
    ? `Reply to @${replyTo}…`
    : scope === 'campus'
      ? "What's happening on campus?"
      : scope === 'global'
        ? 'Share with students everywhere'
        : `Share with students in ${countryName(world ?? '', countries)}`;

  const inline =
    c.result === 'rate-limited'
      ? COMPOSER_TEXT.rateLimited
      : c.result === 'not-allowed'
        ? COMPOSER_TEXT.notAllowed
        : c.result === 'invalid'
          ? c.message
          : (c.photoError ?? null);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />

      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable
          onPress={close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <Feather name="x" size={22} color={colors.blackSoft} />
        </Pressable>
        {parentId ? (
          <View style={styles.chip}>
            <Feather name="corner-up-left" size={13} color={colors.purple} />
            <AppText numberOfLines={1} style={styles.chipText}>
              Replying to @{replyTo}
            </AppText>
          </View>
        ) : (
          <View style={styles.chip} accessibilityLabel={`Posting to ${destination(scope, world, countries)}`}>
            {world ? (
              <WorldGlyph world={world} size={14} />
            ) : (
              <Ionicons name="school" size={13} color={colors.purple} />
            )}
            <AppText numberOfLines={1} style={styles.chipText}>
              {destination(scope, world, countries)}
            </AppText>
          </View>
        )}
      </View>

      {c.result === 'support' ? (
        <View style={styles.supportWrap}>
          <SupportCard onClose={close} />
        </View>
      ) : (
        <KeyboardAvoider style={styles.flex}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.writeRow}>
              <Avatar name={profile?.full_name} uri={profile?.avatar_url} size={36} />
              <AppTextInput
                value={c.text}
                onChangeText={c.setText}
                placeholder={placeholder}
                placeholderTextColor={colors.mutedLabel}
                multiline
                autoFocus={params.pick !== 'photos' && params.pick !== 'gif'}
                scrollEnabled={false}
                textAlignVertical="top"
                accessibilityLabel={placeholder}
                style={styles.input}
              />
            </View>

            {c.photos.length ? (
              <View style={styles.previews}>
                {c.photos.map((p, i) => (
                  <Reanimated.View key={p.id} entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
                    <Image source={{ uri: p.uri }} style={styles.photo} contentFit="cover" />
                    <RemoveButton label={`Remove photo ${i + 1}`} onPress={() => c.removePhoto(p.id)} />
                  </Reanimated.View>
                ))}
              </View>
            ) : null}

            {c.gif ? (
              <Reanimated.View entering={FadeIn.duration(180)} style={styles.gifWrap}>
                <View style={[styles.gif, { aspectRatio: c.gif.width / c.gif.height || 1 }]}>
                  <Image source={{ uri: c.gif.url }} style={StyleSheet.absoluteFill} contentFit="contain" />
                </View>
                <RemoveButton label="Remove the GIF" onPress={c.removeGif} />
              </Reanimated.View>
            ) : null}
          </ScrollView>

          {inline ? (
            <AppText style={styles.inline} accessibilityLiveRegion="polite">
              {inline}
            </AppText>
          ) : null}

          <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {!parentId ? (
              <ToolButton
                icon="image"
                label="Add photos"
                blocked={!!c.photosBlocked}
                color={accent}
                onPress={onPhotoPress}
              />
            ) : null}
            <ToolButton gif label="Add a GIF" blocked={!!c.gifBlocked} color={accent} onPress={onGifPress} />
            <View style={styles.flex} />
            {c.showCounter ? (
              <AppText style={[styles.counter, c.remaining <= 0 && styles.counterOver]}>{c.remaining}</AppText>
            ) : null}
            <Pressable
              onPress={() => void send()}
              disabled={!c.canPost}
              accessibilityRole="button"
              accessibilityLabel={parentId ? 'Reply' : 'Post'}
              accessibilityState={{ disabled: !c.canPost, busy: c.posting }}
              style={({ pressed }) => [
                styles.post,
                { backgroundColor: accent },
                !c.canPost && !c.posting && styles.postDisabled,
                pressed && styles.postPressed,
              ]}
            >
              {c.posting ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <AppText style={styles.postText}>{parentId ? 'Reply' : 'Post'}</AppText>
              )}
            </Pressable>
          </View>
        </KeyboardAvoider>
      )}

      {/* Spec §2.3: the nudge. Edit is the primary button and keeps
          everything; Post anyway sends it again with confirm. A tap outside
          is Edit, never Post anyway. */}
      <ConfirmDialog
        content={
          c.result === 'nudge'
            ? {
                title: 'Post this?',
                message:
                  'Some of this might come across as hurtful to other students. You can edit it, or post it as it is.',
                confirmLabel: 'Edit',
                cancelLabel: 'Post anyway',
                icon: 'edit-3',
              }
            : null
        }
        onConfirm={c.dismissResult}
        onDismiss={c.dismissResult}
        onCancel={() => {
          c.dismissResult();
          void send(true);
        }}
      />

      <GifPicker
        visible={gifOpen}
        onClose={() => setGifOpen(false)}
        onPick={(gif) => {
          setGifOpen(false);
          c.attachGif(gif);
        }}
      />

      <AppToast message={toast} bottom={insets.bottom + 72} />
    </View>
  );
}

function destination(scope: string, world: string | null, countries: { code: string; name: string }[]) {
  if (scope === 'campus') return 'Campus';
  if (world === GLOBAL) return 'Global';
  return countryName(world ?? '', countries);
}

function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
    >
      <Feather name="x" size={12} color={colors.white} />
    </Pressable>
  );
}

function ToolButton({
  icon,
  gif,
  label,
  blocked,
  color,
  onPress,
}: {
  icon?: keyof typeof Feather.glyphMap;
  gif?: boolean;
  label: string;
  blocked: boolean;
  color: string;
  onPress: () => void;
}) {
  // A blocked button still takes the press, to say why (spec §2.2).
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked }}
      style={({ pressed }) => [styles.tool, blocked && styles.toolBlocked, pressed && styles.pressed]}
    >
      {gif ? (
        <View style={[styles.gifGlyph, { borderColor: color }]}>
          <AppText style={[styles.gifGlyphText, { color }]}>GIF</AppText>
        </View>
      ) : (
        <Feather name={icon!} size={20} color={color} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.communityHairline,
  },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexShrink: 1,
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.reactionMineBg,
  },
  chipText: {
    flexShrink: 1,
    fontFamily: font.family.semibold,
    fontSize: font.sizes.body,
    lineHeight: 16,
    color: colors.purple,
  },

  body: { padding: 14, gap: 12 },
  writeRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    minHeight: 80,
    paddingTop: 7,
    paddingBottom: 4,
    paddingHorizontal: 0,
    fontFamily: font.family.regular,
    fontSize: 15,
    lineHeight: 20,
    color: colors.blackSoft,
  },
  previews: { flexDirection: 'row', gap: 8, paddingLeft: 46 },
  photo: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.inputBg },
  gifWrap: { marginLeft: 46, alignSelf: 'flex-start', width: 200 },
  gif: { width: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: colors.reactionPillBorder },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.toastBg,
  },

  inline: {
    paddingHorizontal: 14,
    paddingBottom: 6,
    fontFamily: font.family.regular,
    fontSize: font.sizes.body,
    lineHeight: 18,
    color: colors.errorText,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    paddingHorizontal: 10,
    backgroundColor: colors.communityDock,
    borderTopWidth: 1.5,
    borderTopColor: colors.communityRail,
  },
  tool: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  toolBlocked: { opacity: 0.35 },
  gifGlyph: { paddingHorizontal: 3, borderWidth: 1.5, borderRadius: 4 },
  gifGlyphText: { fontFamily: font.family.bold, fontSize: 10, lineHeight: 13 },
  counter: {
    marginRight: 8,
    fontFamily: font.family.medium,
    fontSize: font.sizes.caption,
    color: colors.communityMuted,
    fontVariant: ['tabular-nums'],
  },
  counterOver: { color: colors.errorText },
  post: {
    minWidth: 68,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postDisabled: { opacity: 0.45 },
  postPressed: { transform: [{ scale: 0.97 }] },
  postText: { fontFamily: font.family.semibold, fontSize: font.sizes.body, color: colors.white },

  supportWrap: { padding: 14 },
});
