import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform, ScrollView, Text, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FullWidthButton, useNativeColors } from "@spine/ui-native";
import { BrandGlow, JobCard, MarkLayer, MilestonePill, PhotoCard, QuoteCard, ReceiptCard, SIGNATURE_LENGTH, SIGNATURE_PATH, Sparkle } from "../brand/illustration";
import { Orbits, type OrbitDot, type OrbitRing } from "../brand/orbits";
import { hideSplash } from "../../lib/splash";

export const WELCOME_TITLE = "Today’s jobs, in your pocket";
/** Broken where the design breaks it; screen readers hear WELCOME_TITLE. */
const WELCOME_TITLE_LINES = "Today’s jobs,\nin your pocket";
export const WELCOME_BODY = "Photos, expenses and sign-offs reach your office — even when there’s no signal.";
export const WELCOME_FOOTER = "Your office sets up your account — you’ll sign in next.";

/** The illustration is drawn on a 440-tall stage (canvas "11 Splash and Welcome") and scaled down when space is short. */
const STAGE = 440;
const MARK = 128;
const MARK_TOP = 150;
/** The splash draws the mark at 96 dp in the middle of the screen (US-MOB-25). */
const SPLASH_MARK = 96;

const RINGS: OrbitRing[] = [
  { rx: 192, ry: 94 },
  { rx: 138, ry: 66 },
];
const DOTS: OrbitDot[] = [
  { ring: 0, tone: "teal", r: 4.5, period: 16000, phase: 0.11 },
  { ring: 1, tone: "sky", r: 3.5, period: 11000, phase: 0.6, reverse: true },
];

/** Where each card lands, from the stage's centre line; `fx`/`fy` lead back to the mark's centre. */
const CARDS = [
  { key: "job", x: -186, top: 26, width: 184, fx: 94, fy: 146, rotate: -5, delay: 450, float: 1600 },
  { key: "photo", x: 68, top: 6, width: 118, fx: -127, fy: 156, rotate: 6, delay: 550, float: 2400 },
  { key: "receipt", x: 60, top: 252, width: 124, fx: -122, fy: -68, rotate: 4, delay: 650, float: 2000 },
  { key: "quote", x: -186, top: 270, width: 166, fx: 103, fy: -102, rotate: -4, delay: 750, float: 2800 },
  { key: "milestone", x: -82, top: 378, width: undefined, fx: -21, fy: -184, rotate: 0, delay: 850, float: 2200 },
] as const;

const SPARKS = [
  { x: -132, top: 212, tone: "teal", size: 7, delay: 1400 },
  { x: 150, top: 208, tone: "sky", size: 7, delay: 2200 },
  { x: 34, top: 126, tone: "deep", size: 5, delay: 1800 },
  { x: 148, top: 352, tone: "sky", size: 7, delay: 2600 },
] as const;

const OUT = Easing.bezier(0.2, 0.8, 0.2, 1);
const OVERSHOOT = Easing.bezier(0.2, 0.9, 0.25, 1.12);

/** True while Welcome is on screen and the app is in front — the idle loop runs only then. */
function useOnScreen(): boolean {
  const [focused, setFocused] = useState(true);
  const [active, setActive] = useState(AppState.currentState !== "background");
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => setActive(next === "active"));
    return () => subscription.remove();
  }, []);
  return focused && active;
}

/** A gentle up-and-down drift while `on`, from rest. */
function useFloat(on: boolean, distance: number, period: number, delay: number): SharedValue<number> {
  const offset = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(offset);
    if (on) {
      offset.value = withDelay(delay, withRepeat(withSequence(withTiming(-distance, { duration: period / 2, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: period / 2, easing: Easing.inOut(Easing.sin) })), -1, false));
    } else {
      offset.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(offset);
  }, [on, offset, distance, period, delay]);
  return offset;
}

/** 0 → 1 once `play` turns true, after `delay` ms; already 1 when motion is reduced. */
function useEntrance(play: boolean, still: boolean, delay: number, duration: number, easing: EasingFunction | EasingFunctionFactory = OUT): SharedValue<number> {
  const progress = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) progress.value = 1;
    else if (play) progress.value = withDelay(delay, withTiming(1, { duration, easing }));
  }, [play, still, delay, duration, easing, progress]);
  return progress;
}

function FlyOut({ card, play, still, idle, children }: { card: (typeof CARDS)[number]; play: boolean; still: boolean; idle: boolean; children: ReactNode }) {
  const progress = useEntrance(play, still, card.delay, 750, OVERSHOOT);
  const float = useFloat(idle, 6, 6000, card.float - 1400);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: Math.min(1, p / 0.3),
      transform: [{ translateX: card.fx * (1 - p) }, { translateY: card.fy * (1 - p) + float.value }, { scale: 0.3 + 0.7 * p }, { rotate: `${card.rotate * p}deg` }],
    };
  });
  return <Animated.View style={[{ position: "absolute", left: "50%", marginLeft: card.x, top: card.top, width: card.width, zIndex: 2 }, style]}>{children}</Animated.View>;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

function Signature({ play, still }: { play: boolean; still: boolean }) {
  const colors = useNativeColors();
  const drawn = useEntrance(play, still, 1250, 1000, Easing.inOut(Easing.ease));
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: SIGNATURE_LENGTH * (1 - drawn.value) }));
  return (
    <Svg width="100%" height={30} viewBox="0 0 140 30" style={{ marginTop: 4 }}>
      <AnimatedPath d={SIGNATURE_PATH} fill="none" stroke={colors.onSurface} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={SIGNATURE_LENGTH} animatedProps={animatedProps} />
    </Svg>
  );
}

function Twinkle({ spark, play, still, idle }: { spark: (typeof SPARKS)[number]; play: boolean; still: boolean; idle: boolean }) {
  const shown = useEntrance(play, still, 1000, 400);
  const dim = useFloat(idle, 0.75, 2800, spark.delay - 1400);
  const style = useAnimatedStyle(() => ({ opacity: shown.value * (1 + dim.value), transform: [{ scale: 1 + dim.value * 0.53 }] }));
  return (
    <Animated.View style={[{ position: "absolute", left: "50%", marginLeft: spark.x, top: spark.top }, style]}>
      <Sparkle tone={spark.tone} size={spark.size} />
    </Animated.View>
  );
}

function FadeUp({ play, still, delay, children }: { play: boolean; still: boolean; delay: number; children: ReactNode }) {
  const progress = useEntrance(play, still, delay, 550);
  const style = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: 14 * (1 - progress.value) }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * US-MOB-26 · `MobWelcome` / `MobWelcomeAndroid` — shown once, on the first
 * launch: the mark rises out of the splash and its layers breathe apart,
 * the app's work slides out from behind it, then one promise, one sentence
 * and "Get started". About 1.4 s, then a gentle idle while on screen;
 * nothing moves with Reduce Motion. The button works from the first frame.
 */
export function WelcomeScreen({ onGetStarted }: { onGetStarted: () => void }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const still = useReducedMotion();
  const onScreen = useOnScreen();
  const [textHeight, setTextHeight] = useState(0);
  const [footHeight, setFootHeight] = useState(0);
  const [play, setPlay] = useState(false);
  const measured = useRef(false);

  // The illustration gives way first when the words need room (large text).
  const stageHeight = useMemo(() => {
    const room = window.height - insets.top - insets.bottom - textHeight - footHeight - 24;
    return textHeight && footHeight ? Math.max(200, Math.min(STAGE, room)) : STAGE;
  }, [window.height, insets.top, insets.bottom, textHeight, footHeight]);
  const scale = stageHeight / STAGE;

  // The mark starts exactly where the splash drew it: the middle of the screen, at 96 dp.
  const markCentre = insets.top + (MARK_TOP + MARK / 2) * scale;
  const riseFrom = (window.height / 2 - markCentre) / scale;
  const startScale = SPLASH_MARK / (MARK * scale);

  const rise = useEntrance(play, still, 0, 550);
  const lift = useSharedValue(0);
  const glow = useEntrance(play, still, 150, 900);
  const orbitsIn = useEntrance(play, still, 500, 600);
  const idle = play && onScreen && !still;
  const bobTop = useFloat(idle, 5, 4200, 0);
  const bobBase = useFloat(idle, -3, 4200, 0);

  useEffect(() => {
    if (!play || still) return;
    lift.value = withDelay(350, withSequence(withTiming(1, { duration: 340, easing: OUT }), withSpring(0, { damping: 9, stiffness: 120 })));
  }, [play, still, lift]);

  const markStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: riseFrom * (1 - rise.value) }, { scale: startScale + (1 - startScale) * rise.value }],
  }));
  const topStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -16 * lift.value + bobTop.value }] }));
  const baseStyle = useAnimatedStyle(() => ({ transform: [{ translateY: 10 * lift.value + bobBase.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.3 + 0.7 * glow.value }] }));
  const orbitStyle = useAnimatedStyle(() => ({ opacity: orbitsIn.value }));

  // Start once the layout is known, then hand over from the splash.
  const onStageLayout = useCallback(() => {
    if (measured.current || !textHeight || !footHeight) return;
    measured.current = true;
    hideSplash();
    setPlay(true);
  }, [textHeight, footHeight]);
  useEffect(() => {
    if (textHeight && footHeight) onStageLayout();
  }, [textHeight, footHeight, onStageLayout]);

  return (
    <View testID="welcome" className="flex-1 bg-background dark:bg-background-dark">
      <ScrollView bounces={false} contentInsetAdjustmentBehavior="never" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top }}>
        <View testID="welcome-illustration" style={{ height: stageHeight }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" onLayout={onStageLayout}>
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: STAGE, transform: [{ scale }], transformOrigin: "50% 0%" }}>
            <Animated.View style={[{ position: "absolute", left: "50%", marginLeft: -190, top: 24 }, glowStyle]}>
              <BrandGlow size={380} />
            </Animated.View>
            <Animated.View style={[{ position: "absolute", left: "50%", marginLeft: -200, top: 104 }, orbitStyle]}>
              <Orbits width={400} height={220} rings={RINGS} dots={DOTS} moving={idle} />
            </Animated.View>
            {SPARKS.map((spark) => (
              <Twinkle key={`${spark.x}-${spark.top}`} spark={spark} play={play} still={still} idle={idle} />
            ))}
            <FlyOut card={CARDS[0]} play={play} still={still} idle={idle}>
              <JobCard />
            </FlyOut>
            <FlyOut card={CARDS[1]} play={play} still={still} idle={idle}>
              <PhotoCard />
            </FlyOut>
            <FlyOut card={CARDS[2]} play={play} still={still} idle={idle}>
              <ReceiptCard />
            </FlyOut>
            <FlyOut card={CARDS[3]} play={play} still={still} idle={idle}>
              <QuoteCard signature={<Signature play={play} still={still} />} />
            </FlyOut>
            <FlyOut card={CARDS[4]} play={play} still={still} idle={idle}>
              <MilestonePill />
            </FlyOut>
            <Animated.View style={[{ position: "absolute", left: "50%", marginLeft: -MARK / 2, top: MARK_TOP, width: MARK, height: MARK, zIndex: 3 }, markStyle]}>
              <Animated.View style={[{ position: "absolute" }, baseStyle]}>
                <MarkLayer layer={0} size={MARK} />
              </Animated.View>
              <View style={{ position: "absolute" }}>
                <MarkLayer layer={1} size={MARK} />
              </View>
              <Animated.View style={[{ position: "absolute" }, topStyle]}>
                <MarkLayer layer={2} size={MARK} />
              </Animated.View>
            </Animated.View>
          </View>
        </View>
        <View testID="welcome-copy" className="px-6 pt-3" onLayout={(e: LayoutChangeEvent) => setTextHeight(e.nativeEvent.layout.height)}>
          <FadeUp play={play} still={still} delay={900}>
            <Text accessibilityRole="header" accessibilityLabel={WELCOME_TITLE} className={`text-on-surface dark:text-on-surface-dark ${Platform.OS === "android" ? "text-[32px] leading-[40px]" : "text-[30px] font-bold leading-[35px]"}`}>
              {WELCOME_TITLE_LINES}
            </Text>
          </FadeUp>
          <FadeUp play={play} still={still} delay={1000}>
            <Text className="mt-3 text-[16px] leading-[23px] text-on-surface-muted dark:text-on-surface-muted-dark">{WELCOME_BODY}</Text>
          </FadeUp>
        </View>
      </ScrollView>
      <View testID="welcome-actions" className="gap-3.5 px-6 pt-4" style={{ paddingBottom: insets.bottom + 16 }} onLayout={(e: LayoutChangeEvent) => setFootHeight(e.nativeEvent.layout.height)}>
        <FadeUp play={play} still={still} delay={1150}>
          <FullWidthButton testID="welcome-get-started" label="Get started" controlSize="large" onPress={onGetStarted} />
          <Text className="mt-3.5 text-center text-[12px] text-on-surface-muted dark:text-on-surface-muted-dark">{WELCOME_FOOTER}</Text>
        </FadeUp>
      </View>
    </View>
  );
}
