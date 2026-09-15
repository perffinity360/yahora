import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuroraBackground } from '../../src/components/AuroraBackground';
import { DemoModal } from '../../src/components/DemoModal';
import { KeyboardAvoider } from '../../src/components/KeyboardAvoider';
import type { ApiError } from '../../src/lib/api';
import { TurnstileWebView } from '../../src/components/TurnstileWebView';
import type { TurnstileHandle } from '../../src/components/TurnstileWebView';
import { UniversitiesModal } from '../../src/components/UniversitiesModal';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, font, spacing } from '../../src/theme';

type Step = 'email' | 'otp';

// Public by design (it only names the widget) and inlined at bundle time, so
// restart Metro with `npx expo start -c` after changing it. The SECRET key
// lives in the Supabase dashboard and never in this app.
const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';

const HEADING_GRADIENT = [colors.purpleDark, colors.purple, colors.pinkDark] as const;
const BRAND_GRADIENT = [colors.purple, colors.pinkDark] as const;

/** Breathing room left between the field being typed into and the keyboard. */
const REVEAL_GAP = 20;

const LOGO = require('../../assets/yahora-logo.png');
const MARK = require('../../assets/yahora-mark.png');

export default function LoginScreen() {
  const { requestOtp, verifyOtp, demoLogin, profile } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  const [emailFocused, setEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // The Turnstile token for the NEXT request-otp. Single use: cleared and the
  // widget reset after every attempt. Supabase rejects a tokenless request
  // once captcha protection is on, so Send Code stays disabled until one lands.
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // True when the check cannot run (no network, Cloudflare unreachable, bad
  // key) — or cannot even start, because this build has no site key.
  const [captchaFailed, setCaptchaFailed] = useState(!TURNSTILE_SITE_KEY);

  const [universitiesOpen, setUniversitiesOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  // ── Keeping the field you are typing in above the keyboard ───────────────
  //
  // KeyboardAvoider shrinks this screen to the space left over by the keyboard,
  // which gives the ScrollView something to scroll. It does not decide WHERE to
  // scroll to, and React Native's own "reveal the focused input" only lifts the
  // field until its bottom edge is level with the fold — which on this card
  // left the email row half-covered, because the row's rounded pill and its
  // Send Code button extend below that edge.
  //
  // So the scrolling is done here: measure the row in window coordinates, work
  // out how far it reaches past the top of the keyboard, and scroll exactly
  // that much plus a gap. Window coordinates are the point — they are true
  // whether or not the avoiding padding has landed yet, and on Android in
  // edge-to-edge mode (where the keyboard is an inset and the window never
  // shrinks) they are the only reading that stays honest.
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  /** Live scroll offset — ScrollView has no getter, so onScroll keeps it. */
  const scrollY = useRef(0);
  /** Window y of the keyboard's top edge. 0 when there is no keyboard. */
  const keyboardTop = useRef(0);
  /** Whichever row is being typed into, so the listener knows what to lift. */
  const focusedRow = useRef<RefObject<View | null> | null>(null);
  const emailRow = useRef<View>(null);
  const otpRow = useRef<View>(null);

  const revealFocusedRow = useCallback(() => {
    const row = focusedRow.current?.current;
    if (!row || keyboardTop.current === 0) return;

    row.measureInWindow((_x, y, _w, height) => {
      if (!Number.isFinite(y) || !Number.isFinite(height)) return;
      const hidden = y + height + REVEAL_GAP - keyboardTop.current;
      // Only ever scroll down to uncover. Scrolling back up when the row is
      // already clear would fight the student if they had scrolled deliberately.
      if (hidden > 1) {
        scrollRef.current?.scrollTo({ y: scrollY.current + hidden, animated: true });
      }
    });
  }, []);

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      // Android: derive the keyboard's top edge the same way KeyboardAvoider
      // does, from the IME height, because `screenY` is measured against the
      // visible display frame and an edge-to-edge window never shrinks that.
      // iOS reports screenY correctly.
      keyboardTop.current =
        Platform.OS === 'android'
          ? windowHeight - (e.endCoordinates.height + insets.bottom)
          : e.endCoordinates.screenY;
      setKeyboardOpen(true);
      // One beat for the avoiding padding and the taller content to land, so
      // the measurement reads the final layout rather than the previous one.
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = setTimeout(revealFocusedRow, 80);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = 0;
      setKeyboardOpen(false);
    });
    return () => {
      show.remove();
      hide.remove();
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, [insets.bottom, windowHeight, revealFocusedRow]);

  /** Called from a field's onFocus: remember the row, then lift it. */
  const focusRow = useCallback(
    (row: RefObject<View | null>) => {
      focusedRow.current = row;
      // Already-open keyboard (switching fields) needs no wait; a closed one is
      // handled by the keyboardDidShow listener above.
      if (keyboardTop.current !== 0) revealFocusedRow();
    },
    [revealFocusedRow],
  );

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

  // Drop the spent token and render a fresh widget (runbook D3.2).
  const resetCaptcha = () => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  };

  const retryCaptcha = () => {
    setCaptchaFailed(false);
    resetCaptcha();
  };

  const handleRequestOtp = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Please enter your university email.');
      return;
    }
    // The keyboard's Send key does not respect the disabled button, so the
    // token is checked here too. A tokenless request would only earn a 400.
    if (!captchaToken) {
      if (!captchaFailed) setInfo('Just a moment, finishing a quick security check.');
      return;
    }
    setSending(true);
    try {
      const res = await requestOtp(email.trim(), captchaToken);
      setStep('otp');
      setInfo(
        res.university
          ? `Code sent to ${email.trim()} (${res.university}).`
          : `Code sent to ${email.trim()}.`,
      );
    } catch (e) {
      const { status, fromApi } = e as ApiError;
      // api.ts puts the backend's `error` field in e.message, which for these
      // responses is a machine code, not a sentence (backend/API.md).
      const code = e instanceof Error ? e.message : '';
      if (!fromApi && status) {
        // Someone other than our backend answered — see api.ts. Its status says
        // nothing about this student or their university, so do not translate
        // it. The common cause is the API port: on macOS the AirPlay Receiver
        // holds 5000 and 403s everything.
        setError('Could not reach the Yahora server. Please try again.');
      } else if (status === 403) {
        setError('Yahora is not yet available at your university.');
      } else if (code === 'CAPTCHA_FAILED') {
        // Retryable at once: the reset below has already started a new check.
        setError('We could not verify that you are a real visitor. Please try again.');
      } else if (code === 'RATE_LIMITED') {
        setError('Too many code requests. Please try again shortly.');
      } else if (code === 'SERVICE_BUSY') {
        setError("We're having trouble sending codes right now. Please try again in a few minutes.");
      } else {
        setError(e instanceof Error ? e.message : 'Could not send code.');
      }
    } finally {
      setSending(false);
      // EVERY attempt, success or failure: the token is spent the moment
      // Supabase sees it, and reusing it makes the second send always fail.
      resetCaptcha();
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (otp.length !== 6) {
      setError('Enter the 6-digit code from your email.');
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
      <AuroraBackground variant="signin" />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        {/* The card fits the screen exactly, so the ScrollView has no overflow
            of its own — without this the email row just sits under the keyboard
            with nothing to scroll. KeyboardAvoider explains why the core
            avoiding view is not enough on Android. */}
        <KeyboardAvoider style={styles.flex}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[styles.scroll, keyboardOpen && styles.scrollKeyboardOpen]}
            // "always", not "handled": with "handled" a tap on any empty part of
            // the screen closed the keyboard, which is exactly what someone does
            // when they mean to nudge the card up a little.
            keyboardShouldPersistTaps="always"
            // "none", not "on-drag": dragging is how you scroll, and dismissing
            // the keyboard mid-scroll re-expands the screen under the finger and
            // throws away what was being typed into view.
            keyboardDismissMode="none"
            onScroll={(e) => {
              scrollY.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
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
                      <View
                        ref={emailRow}
                        style={[styles.pillGroup, emailFocused && styles.pillGroupFocused]}
                      >
                        <TextInput
                          value={email}
                          onChangeText={setEmail}
                          onFocus={() => {
                            setEmailFocused(true);
                            focusRow(emailRow);
                          }}
                          onBlur={() => setEmailFocused(false)}
                          placeholder="you@uni.edu"
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
                        {/* No token, no send — same rule as the web form. */}
                        <GradientButton
                          onPress={handleRequestOtp}
                          disabled={sending || !captchaToken}
                          label={sending ? 'Sending…' : 'Send Code'}
                          busy={sending}
                        />
                      </View>

                      {/* OTP FLOW ONLY — never on demo login. Usually draws
                          nothing (Managed mode, interaction-only). It lives in
                          the email step, so "Wrong email? Go back" remounts it
                          with a fresh widget as well.

                          BELOW the email row, matching the web form
                          (Auth.jsx): when Cloudflare does want a tap, the
                          student has already typed an address and the check
                          reads as the last step before sending, not as a
                          challenge posted before there is anything to send. */}
                      {TURNSTILE_SITE_KEY ? (
                        <TurnstileWebView
                          ref={turnstileRef}
                          siteKey={TURNSTILE_SITE_KEY}
                          onToken={(token) => {
                            setCaptchaToken(token);
                            setCaptchaFailed(false);
                          }}
                          onExpire={() => setCaptchaToken(null)}
                          onError={(message) => {
                            console.warn('[turnstile]', message);
                            setCaptchaToken(null);
                            setCaptchaFailed(true);
                          }}
                        />
                      ) : null}

                      {captchaFailed ? (
                        <>
                          <InlineMessage
                            tone="error"
                            text={
                              TURNSTILE_SITE_KEY
                                ? "We couldn't load the security check. Check your connection and try again."
                                : 'Sign-in is unavailable in this build: the security check is not configured.'
                            }
                          />
                          {TURNSTILE_SITE_KEY ? (
                            <View style={styles.captchaRetry}>
                              <PillBtn label="Try again" onPress={retryCaptcha} />
                            </View>
                          ) : null}
                        </>
                      ) : null}

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
                        Enter the 6-digit code sent to{' '}
                        <Text style={styles.subtitleEmphasis}>{email.trim()}</Text>
                      </Text>

                      <Text style={styles.inputLabel}>6-DIGIT VERIFICATION CODE</Text>
                      <View
                        ref={otpRow}
                        style={[styles.pillGroup, otpFocused && styles.pillGroupFocused]}
                      >
                        <TextInput
                          value={otp}
                          onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, '').slice(0, 6))}
                          onFocus={() => {
                            setOtpFocused(true);
                            focusRow(otpRow);
                          }}
                          onBlur={() => setOtpFocused(false)}
                          placeholder="• • • • • •"
                          placeholderTextColor={colors.mutedPlaceholder}
                          keyboardType="number-pad"
                          maxLength={6}
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
        </KeyboardAvoider>
      </SafeAreaView>

      <UniversitiesModal
        visible={universitiesOpen}
        onClose={() => setUniversitiesOpen(false)}
        // Null on this screen in practice — the router guard sends anyone with
        // a session to (tabs), so nobody signed in reaches the login page. Wired
        // anyway so the pin is correct the moment this modal is reachable from
        // somewhere a signed-in student can stand.
        homeId={profile?.university_id ?? null}
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
    // Matches the sign-in aurora's last stop, so an overscroll or a frame
    // before the gradient paints shows the same colour rather than white.
    backgroundColor: colors.signinBottom,
  },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  // Scroll room while the keyboard is up. The reveal above can only scroll if
  // there is somewhere to scroll TO, and the footer note is only a few points
  // below the card — without this the last field on the card cannot be lifted
  // clear no matter how the overlap is measured.
  scrollKeyboardOpen: {
    paddingBottom: 160,
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

  captchaRetry: {
    alignSelf: 'center',
    marginBottom: spacing.md,
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
