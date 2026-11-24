import { useCallback, useEffect, useState } from "react";
import { Keyboard, Platform, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { SpineLogo, useNativeColors } from "@spine/ui-native";
import { BrandGlow, JobCard, MilestonePill, PhotoCard, Sparkle } from "../brand/illustration";
import { Orbits, type OrbitDot, type OrbitRing } from "../brand/orbits";
import { useT } from "../../lib/i18n";

const HEIGHT = 250;
const FADE = 64;
const RINGS: OrbitRing[] = [
  { rx: 172, ry: 68 },
  { rx: 116, ry: 44 },
];
const DOTS: OrbitDot[] = [
  { ring: 0, tone: "teal", r: 4, period: 24000, phase: 0.1 },
  { ring: 1, tone: "sky", r: 3, period: 18000, phase: 0.53, reverse: true },
];
const SPARKS = [
  { x: 96, top: 40, tone: "teal", size: 7, delay: 0 },
  { x: -112, top: 128, tone: "sky", size: 7, delay: 900 },
  { x: 80, top: 200, tone: "deep", size: 5, delay: 1700 },
] as const;

/** True while the keyboard is up, so Sign in can fold its illustration away. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

function Twinkle({ spark, on }: { spark: (typeof SPARKS)[number]; on: boolean }) {
  const dim = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(dim);
    dim.value = on ? withDelay(spark.delay, withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) })), -1, false)) : 0;
    return () => cancelAnimation(dim);
  }, [on, dim, spark.delay]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - 0.75 * dim.value, transform: [{ scale: 1 - 0.4 * dim.value }] }));
  return (
    <Animated.View style={[{ position: "absolute", left: "50%", marginLeft: spark.x, top: spark.top }, style]}>
      <Sparkle tone={spark.tone} size={spark.size} />
    </Animated.View>
  );
}

/**
 * US-MOB-01 · `MobSignIn` — the Spine logo (read as "Spine") over a short
 * version of Welcome's illustration: the glow, dashed orbits, sparkles and
 * three faded cards, fading into the page. No entrance; only the orbits
 * drift and the sparkles twinkle, and nothing moves with Reduce Motion (D-204).
 */
export function SignInHero() {
  const t = useT();
  const colors = useNativeColors();
  const still = useReducedMotion();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const moving = focused && !still;

  return (
    <View testID="sign-in-hero" style={{ height: HEIGHT, overflow: "hidden" }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}>
        <View style={{ position: "absolute", left: "50%", marginLeft: -170, top: -70 }}>
          <BrandGlow size={340} />
        </View>
        <View style={{ position: "absolute", left: "50%", marginLeft: -180, top: 22 }}>
          <Orbits width={360} height={160} rings={RINGS} dots={DOTS} moving={moving} driftPeriod={18000} />
        </View>
        <View style={{ position: "absolute", left: -30, top: 30, width: 156, opacity: 0.55, transform: [{ rotate: "-8deg" }] }}>
          <JobCard showDue={false} />
        </View>
        <View style={{ position: "absolute", right: -18, top: 108, width: 104, opacity: 0.55, transform: [{ rotate: "9deg" }] }}>
          <PhotoCard label={t("mobileApp.illustration.photos")} photoHeight={52} />
        </View>
        <View style={{ position: "absolute", left: 16, top: 178, opacity: 0.55, transform: [{ rotate: "4deg" }] }}>
          <MilestonePill compact />
        </View>
        {SPARKS.map((spark) => (
          <Twinkle key={spark.x} spark={spark} on={moving} />
        ))}
      </View>
      <View style={{ position: "absolute", left: "50%", marginLeft: -66, top: 48 }}>
        <SpineLogo variant="vertical" size={132} testID="sign-in-logo" />
      </View>
      <Svg pointerEvents="none" width="100%" height={FADE} style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Defs>
          <LinearGradient id="sign-in-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={FADE} fill="url(#sign-in-fade)" />
      </Svg>
    </View>
  );
}

/** While the keyboard is up: the horizontal logo alone, above the 96 dp wordmark minimum. */
export function SignInCompactLogo() {
  return (
    <View testID="sign-in-compact-logo" className="px-1 pb-2 pt-2">
      <SpineLogo variant="horizontal" size={110} />
    </View>
  );
}
