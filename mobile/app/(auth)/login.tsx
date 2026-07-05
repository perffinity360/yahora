import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuroraBackground } from '../../src/components/AuroraBackground';
import { DemoModal } from '../../src/components/DemoModal';
import { UniversitiesModal } from '../../src/components/UniversitiesModal';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, font, spacing } from '../../src/theme';

type Step = 'email' | 'otp';

const HEADING_GRADIENT = [colors.purpleDark, colors.purple, colors.pinkDark] as const;
const BRAND_GRADIENT = [colors.purple, colors.pinkDark] as const;

const LOGO = require('../../assets/yahora-logo.png');
const MARK = require('../../assets/yahora-mark.png');

export default function LoginScreen() {
  const { requestOtp, verifyOtp, demoLogin } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  const [emailFocused, setEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [universitiesOpen, setUniversitiesOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  // Staggered entrance for the content groups.
  const introLogo = useRef(new Animated.Value(0)).current;
  const introCopy = useRef(new Animated.Value(0)).current;
  const introCard = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(130, [
      Animated.timing(introLogo, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(introCopy, {
        toValue: 1,
        duration: 560,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(introCard, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [introLogo, introCopy, introCard]);

  const handleRequestOtp = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Please enter your university email.');
      return;
    }
    setSending(true);
    try {
      const res = await requestOtp(email.trim());
      setStep('otp');
      setInfo(
        res.university
          ? `Code sent to ${email.trim()} (${res.university}).`
          : `Code sent to ${email.trim()}.`,
      );
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 403) {
        setError('Yahora is not yet available at your university.');
      } else {
        setError(e instanceof Error ? e.message : 'Could not send code.');
      }
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (otp.length !== 8) {
      setError('Enter the 8-digit code from your email.');
      return;
    }
    setVerifying(true);
    try {
      await verifyOtp(email.trim(), otp);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify code.');
    } finally {
      setVerifying(false);
    }
  };

  const goBackToEmail = () => {
    setStep('email');
    setOtp('');
    setError(null);
    setInfo(null);
  };

  const handleSandboxPreview = async () => {
    try {
      await demoLogin();
      setDemoOpen(false);
    } catch (e) {
      setDemoOpen(false);
      setError(e instanceof Error ? e.message : 'Could not start demo.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <AuroraBackground />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.formWrapper}>
            <Animated.View style={[styles.logoWrap, rise(introLogo, 22)]}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            </Animated.View>

            <Animated.View style={rise(introCopy, 18)}>
              <GradientHeading text="Keep the story going." />

              <Text style={styles.tagline}>
                Find, share, and pass on the things that made campus home, with the
                students right beside you.
              </Text>
            </Animated.View>

            <Animated.View style={[styles.cardWrap, rise(introCard, 26, true)]}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Join Yahora</Text>

                {step === 'email' ? (
                  <>
                    <Text style={styles.subtitle}>
                      Enter your university email to get started
                    </Text>

                    <Text style={styles.inputLabel}>UNIVERSITY EMAIL ADDRESS</Text>
                    <View style={[styles.pillGroup, emailFocused && styles.pillGroupFocused]}>
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        onFocus={() => setEmailFocused(true)}
                        onBlur={() => setEmailFocused(false)}
                        placeholder="you@university.edu"
                        placeholderTextColor={colors.mutedPlaceholder}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        autoCorrect={false}
                        editable={!sending}
                        returnKeyType="send"
                        onSubmitEditing={handleRequestOtp}
                        style={styles.pillInput}
                      />
                      <GradientButton
                        onPress={handleRequestOtp}
                        disabled={sending}
                        label={sending ? 'Sending…' : 'Send Code'}
                        busy={sending}
                      />
                    </View>

                    {error ? <InlineMessage tone="error" text={error} /> : null}
                    {info && !error ? <InlineMessage tone="success" text={info} /> : null}

                    <View style={styles.pillRow}>
                      <PillBtn
                        label="See Supported Universities"
                        onPress={() => setUniversitiesOpen(true)}
                      />
                      <PillBtn
                        label="Explore Live Demo"
                        leading="✦"
                        onPress={() => setDemoOpen(true)}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.subtitle}>
                      Enter the 8-digit code sent to{' '}
                      <Text style={styles.subtitleEmphasis}>{email.trim()}</Text>
                    </Text>

                    <Text style={styles.inputLabel}>8-DIGIT VERIFICATION CODE</Text>
                    <View style={[styles.pillGroup, otpFocused && styles.pillGroupFocused]}>
                      <TextInput
                        value={otp}
                        onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 8))}
                        onFocus={() => setOtpFocused(true)}
                        onBlur={() => setOtpFocused(false)}
                        placeholder="• • • • • • • •"
                        placeholderTextColor={colors.mutedPlaceholder}
                        keyboardType="number-pad"
                        maxLength={8}
                        editable={!verifying}
                        returnKeyType="done"
                        onSubmitEditing={handleVerifyOtp}
                        style={[styles.pillInput, styles.otpInput]}
                      />
                      <GradientButton
                        onPress={handleVerifyOtp}
                        disabled={verifying}
                        label={verifying ? 'Verifying…' : 'Verify'}
                        busy={verifying}
                      />
                    </View>

                    {error ? <InlineMessage tone="error" text={error} /> : null}
                    {info && !error ? <InlineMessage tone="success" text={info} /> : null}

                    <Pressable
                      onPress={goBackToEmail}
                      style={({ pressed }) => [styles.backLink, pressed && styles.backLinkPressed]}
                    >
                      <Text style={styles.backLinkText}>← Wrong email? Go back</Text>
                    </Pressable>
                  </>
                )}
              </View>

              <View style={styles.floatingIcon} pointerEvents="none">
                <View style={styles.floatingIconInner}>
                  <Image source={MARK} style={styles.floatingIconImg} resizeMode="contain" />
                </View>
              </View>
            </Animated.View>

            <Text style={styles.footerNote}>Because every item has a memory.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      <UniversitiesModal
        visible={universitiesOpen}
        onClose={() => setUniversitiesOpen(false)}
      />
      <DemoModal
        visible={demoOpen}
        onClose={() => setDemoOpen(false)}
        onSandboxPreview={handleSandboxPreview}
      />
    </View>
  );
}

/** Opacity + slide-up (and optional subtle scale) entrance, native-driven. */
function rise(value: Animated.Value, distance: number, scale = false) {
  return {
    opacity: value,
    transform: [
      { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
      ...(scale
        ? [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }]
        : []),
    ],
  };
}

function GradientHeading({ text }: { text: string }) {
  return (
    <View style={styles.headingWrap}>
      <MaskedView
        style={styles.headingMask}
        maskElement={
          <Text style={styles.headingText} numberOfLines={1}>
            {text}
          </Text>
        }
      >
        <LinearGradient
          colors={HEADING_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headingGradientFill}
        >
          <Text style={[styles.headingText, styles.headingTextHidden]} numberOfLines={1}>
            {text}
          </Text>
        </LinearGradient>
      </MaskedView>
    </View>
  );
}

function GradientButton({
  onPress,
  disabled,
  label,
  busy,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.insideBtn, (disabled || pressed) && styles.insideBtnPressed]}
    >
      <LinearGradient
        colors={BRAND_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.insideBtnGradient}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.insideBtnText}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function PillBtn({
  label,
  onPress,
  leading,
}: {
  label: string;
  onPress: () => void;
  leading?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pillBtn, pressed && styles.pillBtnPressed]}
    >
      {leading ? <Text style={styles.pillBtnLeading}>{leading}</Text> : null}
      <Text style={styles.pillBtnText}>{label}</Text>
    </Pressable>
  );
}

function InlineMessage({ tone, text }: { tone: 'error' | 'success'; text: string }) {
  return (
    <View style={[styles.message, tone === 'error' ? styles.messageError : styles.messageSuccess]}>
      <Text
        style={[
          styles.messageText,
          tone === 'error' ? styles.messageTextError : styles.messageTextSuccess,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.auroraBottom,
  },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  formWrapper: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },

  logoWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logo: {
    width: 208,
    height: 94,
  },

  headingWrap: {
    marginBottom: spacing.sm + 2,
  },
  headingMask: {
    flexDirection: 'row',
  },
  headingGradientFill: {
    flex: 1,
  },
  headingText: {
    fontFamily: font.family.serif,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: colors.black,
  },
  headingTextHidden: {
    opacity: 0,
  },
  tagline: {
    fontFamily: font.family.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.mutedText,
    marginBottom: spacing.lg,
    maxWidth: 380,
  },

  cardWrap: {
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.cardSurface,
    padding: spacing.lg,
    paddingTop: spacing.xl + spacing.sm,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.purple,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  floatingIcon: {
    position: 'absolute',
    top: -30,
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  floatingIconInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0E6F5',
    shadowColor: colors.purple,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  floatingIconImg: {
    width: 38,
    height: 38,
  },

  cardTitle: {
    fontFamily: font.family.serif,
    textAlign: 'center',
    fontSize: 23,
    color: colors.blackSoft,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: font.family.regular,
    textAlign: 'center',
    color: colors.mutedText,
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  subtitleEmphasis: {
    fontFamily: font.family.bold,
    color: colors.purpleDark,
  },

  inputLabel: {
    fontFamily: font.family.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.mutedLabel,
    marginBottom: spacing.sm,
    paddingLeft: spacing.md,
  },

  // NOTE: focus state changes paint-only props (colors), never layout props
  // like elevation/shadow/borderWidth, so the keyboard can't get dismissed by
  // a native re-layout of the focused input's container.
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 40,
    paddingLeft: spacing.md + 4,
    paddingRight: 7,
    paddingVertical: 7,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillGroupFocused: {
    backgroundColor: colors.white,
    borderColor: colors.inputBorderFocus,
  },
  pillInput: {
    flex: 1,
    fontFamily: font.family.medium,
    fontSize: 14,
    color: colors.blackSoft,
    paddingVertical: 0,
    minHeight: 38,
  },
  otpInput: {
    fontFamily: font.family.bold,
    letterSpacing: 6,
    color: colors.purpleDark,
  },

  // No drop shadow: the button sits inside the rounded input pill, so a shadow
  // would bleed past the pill edge and look like it is escaping the field.
  insideBtn: {
    borderRadius: 32,
    overflow: 'hidden',
  },
  insideBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  insideBtnGradient: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 32,
    minWidth: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insideBtnText: {
    fontFamily: font.family.semibold,
    color: colors.white,
    fontSize: 14,
  },

  message: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  messageError: {
    backgroundColor: colors.errorBg,
  },
  messageSuccess: {
    backgroundColor: colors.successBg,
  },
  messageText: {
    fontFamily: font.family.medium,
    textAlign: 'center',
    fontSize: 13,
  },
  messageTextError: {
    color: colors.errorText,
  },
  messageTextSuccess: {
    color: colors.successText,
  },

  pillRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.purple,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 32,
    shadowColor: colors.purpleLight,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  pillBtnPressed: {
    backgroundColor: colors.purpleDark,
    transform: [{ translateY: -1 }],
  },
  pillBtnLeading: {
    fontFamily: font.family.bold,
    color: colors.white,
    fontSize: 13,
  },
  pillBtnText: {
    fontFamily: font.family.semibold,
    color: colors.white,
    fontSize: 12,
    letterSpacing: 0.2,
  },

  backLink: {
    marginTop: spacing.sm,
    alignSelf: 'center',
    backgroundColor: colors.purple,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 32,
  },
  backLinkPressed: {
    backgroundColor: colors.purpleDark,
  },
  backLinkText: {
    fontFamily: font.family.semibold,
    color: colors.white,
    fontSize: 12,
  },

  footerNote: {
    fontFamily: font.family.serif,
    textAlign: 'center',
    color: colors.purpleDark,
    opacity: 0.65,
    fontSize: 13,
    marginTop: spacing.lg,
  },
});
