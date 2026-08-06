import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuroraBackground } from '../src/components/AuroraBackground';
import { ProductCard } from '../src/components/ProductCard';
import { PickerOption, SearchablePicker } from '../src/components/SearchablePicker';
import { useAuth } from '../src/contexts/AuthContext';
import { useProduct } from '../src/hooks/useProduct';
import { api } from '../src/lib/api';
import { toUploadFile } from '../src/lib/upload';
import { colors, font, radius, spacing } from '../src/theme';
import type { ProductCardItem } from '../src/types';

const BRAND_GRADIENT = [colors.purple, colors.pinkDark] as const;
const MAX_IMAGES = 5;
const GRID_COLS = 3;
const SCREEN_PAD = spacing.lg;
const CARD_PAD = spacing.lg;
const GRID_GAP = spacing.sm;
const CARD_MAX_W = 480;

// Category chips — same 8 as the web, each with an @expo/vector-icons glyph.
type CategoryIcon = keyof typeof MaterialCommunityIcons.glyphMap;
const CATEGORIES: { label: string; icon: CategoryIcon }[] = [
  { label: 'Electronics & Tech', icon: 'laptop' },
  { label: 'Furniture & Decor', icon: 'sofa' },
  { label: 'Books & Study Materials', icon: 'book-open-variant' },
  { label: 'Clothing & Accessories', icon: 'tshirt-crew' },
  { label: 'Vehicles & Bikes', icon: 'bike' },
  { label: 'Appliances', icon: 'toaster-oven' },
  { label: 'Sports & Fitness', icon: 'dumbbell' },
  { label: 'Miscellaneous', icon: 'package-variant-closed' },
];

// Store the short value; show the descriptive label. Default = "Good".
const CONDITIONS: PickerOption[] = [
  { label: 'Mint (Like Brand New)', value: 'Mint' },
  { label: 'Like New (Barely Used)', value: 'Like New' },
  { label: 'Good (Normal Wear)', value: 'Good' },
  { label: 'Fair (Noticeable Wear)', value: 'Fair' },
  { label: 'Poor (Needs Repair)', value: 'Poor' },
];

export default function SellScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const isEditing = !!edit;

  const { profile } = useAuth();
  const userId = profile?.id;

  // Edit mode: fetch the listing to pre-fill the text fields.
  const productQuery = useProduct(edit, userId);
  const editProduct = productQuery.data;

  const { width } = useWindowDimensions();
  const cardOuter = Math.min(width - SCREEN_PAD * 2, CARD_MAX_W);
  const tile = Math.floor((cardOuter - CARD_PAD * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);
  const previewWidth = Math.min(width * 0.6, 230);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState('Good');
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

  const [seeded, setSeeded] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageNote, setImageNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Seed the form from the fetched listing exactly once, in edit mode.
  useEffect(() => {
    if (!editProduct || seeded) return;
    setTitle(editProduct.title ?? '');
    setDescription(editProduct.description ?? '');
    setPrice(editProduct.price != null ? String(editProduct.price) : '');
    setCategory(editProduct.category ?? '');
    setLocation(editProduct.location ?? '');
    setCondition(editProduct.condition ?? 'Good');
    setExistingImages(editProduct.image_urls ?? []);
    setSeeded(true);
  }, [editProduct, seeded]);

  const goBack = () => router.replace('/(tabs)/profile');

  const pickImages = async () => {
    setError(null);
    setImageNote(null);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setImageNote(`You can add up to ${MAX_IMAGES} photos.`);
      return;
    }
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Photo library access is needed to add photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.7,
      });
      if (result.canceled) return;
      // selectionLimit isn't honored on every OS version, so clamp defensively.
      if (result.assets.length > remaining) {
        setImageNote(`Added the first ${remaining} — that's the ${MAX_IMAGES}-photo max.`);
      }
      setImages((prev) => [...prev, ...result.assets.slice(0, remaining)]);
    } catch {
      setError('Could not open your photo library. Please try again.');
    }
  };

  const removeImage = (uri: string) => {
    setImageNote(null);
    setImages((prev) => prev.filter((a) => a.uri !== uri));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!userId) {
      setError('Your session has expired. Please sign in again.');
      return;
    }
    if (!isEditing && images.length === 0) {
      setError('Please add at least one photo.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }
    const priceNum = Number(price);
    if (!price.trim() || Number.isNaN(priceNum) || priceNum < 0) {
      setError('Please enter a valid price.');
      return;
    }
    if (!category) {
      setError('Please select a category.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && edit) {
        await api.put(`/api/products/${edit}`, {
          title: title.trim(),
          description: description.trim(),
          price: price.trim(),
          category,
          location: location.trim(),
          condition,
        });
      } else {
        const form = new FormData();
        form.append('seller_id', userId);
        form.append('title', title.trim());
        form.append('description', description.trim());
        form.append('price', price.trim());
        form.append('category', category);
        form.append('location', location.trim());
        form.append('condition', condition);
        images.forEach((asset) => {
          form.append(
            'images',
            toUploadFile({ uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.mimeType }),
          );
        });
        await api.uploadForm('/api/products', form);
      }

      // New/edited item shows up in the dashboard Listings + public profile.
      await queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
      await queryClient.invalidateQueries({ queryKey: ['publicProfile', userId] });
      if (isEditing) await queryClient.invalidateQueries({ queryKey: ['product', edit] });
      router.replace('/(tabs)/profile');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your listing.');
      setSubmitting(false);
    }
  };

  const showPrefillLoader = isEditing && !seeded && productQuery.isLoading;
  const showPrefillError = isEditing && !seeded && productQuery.isError;

  // Live preview of the card the campus will see, driven by the form state.
  const previewImages = isEditing ? existingImages : images.map((a) => a.uri);
  const previewProduct: ProductCardItem = {
    id: 'preview',
    title: title.trim() || 'Your item title',
    price: Number(price) || 0,
    condition: condition || 'Good',
    status: 'available',
    image_urls: previewImages,
    created_at: new Date().toISOString(),
    likes_count: 0,
    views: 0,
    comments_count: 0,
    location: location.trim() || null,
    is_liked: false,
    is_saved: false,
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <AuroraBackground />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {showPrefillLoader ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator size="large" color={colors.purple} />
              <Text style={styles.stateText}>Loading your listing…</Text>
            </View>
          ) : showPrefillError ? (
            <View style={styles.stateWrap}>
              <View style={styles.stateIcon}>
                <Feather name="wifi-off" size={24} color={colors.purple} />
              </View>
              <Text style={styles.stateTitle}>Couldn&apos;t load this listing</Text>
              <Text style={styles.stateText}>Check your connection and try again.</Text>
              <Pressable
                onPress={() => productQuery.refetch()}
                style={({ pressed }) => [styles.retryBtn, pressed && styles.submitBtnPressed]}
              >
                <LinearGradient
                  colors={BRAND_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.retryGradient}
                >
                  <Feather name="refresh-cw" size={16} color={colors.white} />
                  <Text style={styles.submitText}>Retry</Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formWrapper}>
                <View style={styles.header}>
                  <Text style={styles.title}>{isEditing ? 'Edit Your Listing' : 'List a New Item'}</Text>
                  <Text style={styles.subtitle}>
                    {isEditing
                      ? 'Update your item details below.'
                      : 'Fill in the details — it only takes a minute.'}
                  </Text>
                </View>

                {error ? (
                  <View style={styles.banner}>
                    <Feather name="alert-triangle" size={15} color={colors.errorText} />
                    <Text style={styles.bannerText}>{error}</Text>
                  </View>
                ) : null}

                <View style={styles.card}>
                  {/* 01 · Photos */}
                  <SectionLabel
                    num="01"
                    title="Photos"
                    hint={isEditing ? undefined : `Up to ${MAX_IMAGES} · first is the cover`}
                    first
                  />
                  {isEditing ? (
                    <>
                      <View style={styles.imageGrid}>
                        {existingImages.map((uri, idx) => (
                          <View key={uri} style={[styles.tile, { width: tile, height: tile }]}>
                            <Image
                              source={{ uri }}
                              style={styles.tileImg}
                              contentFit="cover"
                              transition={200}
                            />
                            {idx === 0 ? (
                              <View style={styles.coverBadge}>
                                <Text style={styles.coverBadgeText}>COVER</Text>
                              </View>
                            ) : null}
                          </View>
                        ))}
                      </View>
                      <Text style={styles.readonlyNote}>
                        Photos can&apos;t be changed here yet.
                      </Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.imageGrid}>
                        {images.map((asset, idx) => (
                          <View key={asset.uri} style={[styles.tile, { width: tile, height: tile }]}>
                            <Image
                              source={{ uri: asset.uri }}
                              style={styles.tileImg}
                              contentFit="cover"
                              transition={200}
                            />
                            {idx === 0 ? (
                              <View style={styles.coverBadge}>
                                <Text style={styles.coverBadgeText}>COVER</Text>
                              </View>
                            ) : null}
                            <Pressable
                              onPress={() => removeImage(asset.uri)}
                              hitSlop={6}
                              accessibilityRole="button"
                              accessibilityLabel="Remove photo"
                              style={({ pressed }) => [styles.removeBtn, pressed && styles.removeBtnPressed]}
                            >
                              <Feather name="x" size={13} color={colors.white} />
                            </Pressable>
                          </View>
                        ))}

                        {images.length < MAX_IMAGES ? (
                          <Pressable
                            onPress={pickImages}
                            accessibilityRole="button"
                            style={({ pressed }) => [
                              styles.addTile,
                              { width: tile, height: tile },
                              pressed && styles.addTilePressed,
                            ]}
                          >
                            <Feather name="plus" size={22} color={colors.purple} />
                            <Text style={styles.addTileText}>
                              {images.length === 0 ? 'Add Photos' : 'Add More'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {imageNote ? <Text style={styles.imageNote}>{imageNote}</Text> : null}
                    </>
                  )}

                  {/* 02 · Title */}
                  <SectionLabel num="02" title="Title" required />
                  <View style={[styles.inputRow, focused === 'title' && styles.inputRowFocused]}>
                    <Feather name="tag" size={18} color={colors.purple} style={styles.inputIcon} />
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      onFocus={() => setFocused('title')}
                      onBlur={() => setFocused(null)}
                      placeholder="e.g., Slightly used study table"
                      placeholderTextColor={colors.mutedPlaceholder}
                      style={styles.input}
                      returnKeyType="next"
                    />
                  </View>

                  {/* 03 · Category */}
                  <SectionLabel num="03" title="Category" required />
                  <View style={styles.categoryGrid}>
                    {CATEGORIES.map((cat) => {
                      const active = category === cat.label;
                      return (
                        <Pressable
                          key={cat.label}
                          onPress={() => setCategory(active ? '' : cat.label)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          style={({ pressed }) => [
                            styles.catChip,
                            active && styles.catChipActive,
                            pressed && styles.catChipPressed,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={cat.icon}
                            size={24}
                            color={active ? colors.white : colors.purple}
                          />
                          <Text
                            style={[styles.catLabel, active && styles.catLabelActive]}
                            numberOfLines={2}
                          >
                            {cat.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* 04 · Condition */}
                  <SectionLabel num="04" title="Item condition" />
                  <SearchablePicker
                    label="Condition"
                    leadingIcon="award"
                    options={CONDITIONS}
                    value={condition}
                    onChange={setCondition}
                    placeholder="Select condition"
                    searchable={false}
                  />

                  {/* 05 · Location */}
                  <SectionLabel num="05" title="Hostel / location" />
                  <View style={[styles.inputRow, focused === 'location' && styles.inputRowFocused]}>
                    <Feather name="map-pin" size={18} color={colors.purple} style={styles.inputIcon} />
                    <TextInput
                      value={location}
                      onChangeText={setLocation}
                      onFocus={() => setFocused('location')}
                      onBlur={() => setFocused(null)}
                      placeholder="e.g., Hall 1 or Kalam Hostel"
                      placeholderTextColor={colors.mutedPlaceholder}
                      style={styles.input}
                      returnKeyType="next"
                    />
                  </View>

                  {/* 06 · Price */}
                  <SectionLabel num="06" title="Price" required />
                  <View style={[styles.inputRow, focused === 'price' && styles.inputRowFocused]}>
                    <Text style={styles.rupee}>₹</Text>
                    <TextInput
                      value={price}
                      onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, ''))}
                      onFocus={() => setFocused('price')}
                      onBlur={() => setFocused(null)}
                      placeholder="0"
                      placeholderTextColor={colors.mutedPlaceholder}
                      style={styles.input}
                      keyboardType="numeric"
                    />
                  </View>

                  {/* 07 · Description */}
                  <SectionLabel num="07" title="Description" />
                  <View style={[styles.textareaWrap, focused === 'description' && styles.inputRowFocused]}>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      onFocus={() => setFocused('description')}
                      onBlur={() => setFocused(null)}
                      placeholder="Describe the condition, age, and reason for selling…"
                      placeholderTextColor={colors.mutedPlaceholder}
                      style={styles.textarea}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                </View>

                <Pressable
                  onPress={handleSubmit}
                  disabled={submitting}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    (submitting || pressed) && styles.submitBtnPressed,
                  ]}
                >
                  <LinearGradient
                    colors={BRAND_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.submitGradient}
                  >
                    {submitting ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <>
                        <Feather
                          name={isEditing ? 'check' : 'arrow-up-circle'}
                          size={18}
                          color={colors.white}
                        />
                        <Text style={styles.submitText}>
                          {isEditing ? 'Save Changes' : 'Post Item to Campus'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                {/* Live preview — how this item appears in the marketplace. */}
                <View style={styles.previewSection}>
                  <View style={styles.previewHeader}>
                    <View style={styles.previewDot} />
                    <Text style={styles.previewLabel}>LIVE PREVIEW</Text>
                  </View>
                  <Text style={styles.previewHint}>How your item appears in the marketplace</Text>
                  <ProductCard product={previewProduct} style={{ width: previewWidth }} />
                </View>
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>

        {/* Rendered last + raised so it stays above the elevated form card. */}
        <Pressable
          onPress={goBack}
          disabled={submitting}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
        >
          <Feather name="arrow-left" size={22} color={colors.purpleDark} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

/* ────────────────────────── Section label ────────────────────────── */
function SectionLabel({
  num,
  title,
  hint,
  required,
  first,
}: {
  num: string;
  title: string;
  hint?: string;
  required?: boolean;
  first?: boolean;
}) {
  return (
    <View style={[styles.sectionLabel, first && styles.sectionLabelFirst]}>
      <View style={styles.sectionNum}>
        <Text style={styles.sectionNumText}>{num}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {required ? <Text style={styles.sectionRequired}> *</Text> : null}
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.auroraBottom,
  },
  safe: { flex: 1 },
  flex: { flex: 1 },

  backBtn: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.lg,
    zIndex: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardSurface,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.purple,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  backBtnPressed: {
    backgroundColor: colors.pinkLight,
    borderColor: colors.inputBorderFocus,
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_PAD,
    paddingVertical: spacing.xl,
  },
  formWrapper: {
    width: '100%',
    maxWidth: CARD_MAX_W,
    alignSelf: 'center',
  },

  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: font.family.serif,
    fontSize: 28,
    color: colors.purpleDark,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: font.family.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedText,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 360,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorBg,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  bannerText: {
    flex: 1,
    fontFamily: font.family.medium,
    fontSize: 13,
    color: colors.errorText,
  },

  card: {
    backgroundColor: colors.cardSurface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: CARD_PAD,
    shadowColor: colors.purple,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  /* Section labels */
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionLabelFirst: {
    marginTop: 0,
  },
  sectionNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
  },
  sectionNumText: {
    fontFamily: font.family.bold,
    fontSize: 10,
    color: colors.purpleDark,
  },
  sectionTitle: {
    fontFamily: font.family.bold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.blackSoft,
  },
  sectionRequired: {
    fontFamily: font.family.bold,
    fontSize: 12,
    color: colors.pinkDark,
    marginLeft: -spacing.sm + 2,
  },
  sectionHint: {
    flex: 1,
    fontFamily: font.family.regular,
    fontSize: 11,
    color: colors.mutedLabel,
    textAlign: 'right',
  },

  /* Image grid */
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  tile: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  tileImg: {
    width: '100%',
    height: '100%',
  },
  coverBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.purple,
  },
  coverBadgeText: {
    fontFamily: font.family.extrabold,
    fontSize: 8,
    letterSpacing: 0.5,
    color: colors.white,
  },
  removeBtn: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
  removeBtnPressed: {
    backgroundColor: colors.pinkDark,
  },
  addTile: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.pinkLight,
    borderWidth: 1.5,
    borderColor: colors.inputBorderFocus,
    borderStyle: 'dashed',
  },
  addTilePressed: {
    backgroundColor: colors.demoCardPurpleBg,
  },
  addTileText: {
    fontFamily: font.family.semibold,
    fontSize: 11,
    color: colors.purple,
  },
  imageNote: {
    fontFamily: font.family.regular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: spacing.sm,
  },
  readonlyNote: {
    fontFamily: font.family.regular,
    fontSize: 12,
    color: colors.mutedLabel,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },

  /* Text inputs */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md + 4,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputRowFocused: {
    backgroundColor: colors.white,
    borderColor: colors.inputBorderFocus,
  },
  inputIcon: {
    marginRight: 2,
  },
  rupee: {
    fontFamily: font.family.semibold,
    fontSize: 17,
    color: colors.purple,
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontFamily: font.family.medium,
    fontSize: 15,
    color: colors.blackSoft,
    paddingVertical: 0,
    minHeight: 44,
  },
  textareaWrap: {
    borderRadius: radius.md + 4,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textarea: {
    fontFamily: font.family.medium,
    fontSize: 15,
    lineHeight: 21,
    color: colors.blackSoft,
    minHeight: 96,
    paddingVertical: spacing.xs,
  },

  /* Category chips */
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  catChip: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 82,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md + 2,
    backgroundColor: colors.cardSurface,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
  catChipActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  catChipPressed: {
    borderColor: colors.inputBorderFocus,
  },
  catLabel: {
    fontFamily: font.family.semibold,
    fontSize: 12,
    lineHeight: 15,
    color: colors.blackSoft,
    textAlign: 'center',
  },
  catLabelActive: {
    color: colors.white,
  },

  /* Submit */
  submitBtn: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: colors.purple,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  submitBtnPressed: {
    opacity: 0.9,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl + spacing.md,
    borderRadius: 32,
  },
  submitText: {
    fontFamily: font.family.semibold,
    fontSize: 16,
    color: colors.white,
  },

  /* Prefill loading / error */
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  stateIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pinkLight,
    borderWidth: 1,
    borderColor: colors.inputBorderFocus,
    marginBottom: spacing.xs,
  },
  stateTitle: {
    fontFamily: font.family.bold,
    fontSize: 16,
    color: colors.blackSoft,
    textAlign: 'center',
  },
  stateText: {
    fontFamily: font.family.regular,
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.md,
    borderRadius: 999,
    overflow: 'hidden',
  },
  retryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: 999,
  },

  /* Live preview */
  previewSection: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.pinkDark,
  },
  previewLabel: {
    fontFamily: font.family.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.purpleDark,
  },
  previewHint: {
    fontFamily: font.family.regular,
    fontSize: 12,
    color: colors.mutedText,
    marginTop: 4,
    marginBottom: spacing.md,
  },
});
