import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, View, type ViewProps } from "react-native";
import { cn } from "../lib/cn";

/**
 * Ports `packages/ui`'s Skeleton — a pulsing block matching the shape of
 * the loading content, used for genuinely slow loads, not every async
 * state.
 *
 * Web's `animate-pulse` is a Tailwind CSS keyframe utility; NativeWind
 * (checked directly against the installed v4 dist — no `animate-pulse`/
 * `animation` implementation found) doesn't compile Tailwind's `animate-*`
 * utilities to anything on RN, so a `className="animate-pulse"` here would
 * silently do nothing. This drives the same opacity pulse with RN's own
 * `Animated` API instead — the same primitive `FloatingTabBar`'s highlight
 * transition already uses elsewhere in this package.
 *
 * The `className` (bg-border-strong, sizing, rounding) is applied to a
 * plain `View` NESTED inside the `Animated.View`, not on the `Animated.View`
 * itself — confirmed live via a real `expo export --platform web` render
 * that `Animated.View`'s own `className` prop does not compile through
 * NativeWind on the web target (the opacity animation worked, but every
 * NativeWind class on the same element was silently dropped, leaving an
 * invisible unstyled div). Only the animated `style={{ opacity }}` lives on
 * the outer `Animated.View`; every themed class lives on the inner `View`,
 * which fills its parent so the pulse still applies visually to the whole
 * shape.
 *
 * Uses `border-strong`, not the plain `border` token web's own Skeleton
 * uses (`bg-border`) — `border`'s dark value (#2C2B26) is IDENTICAL to
 * `surface-sunken`'s dark value, the background `ComponentPreview` (and any
 * similarly sunken container) renders this against, making the skeleton
 * invisible in dark mode by token coincidence (the same class of bug
 * already fixed once in the Layouts primitives demo — see that file's own
 * comment). `border-strong` is a genuinely distinct color from
 * `surface-sunken` in both themes, and reads better for a placeholder block
 * anyway, which should be more visible than a subtle 1px border color.
 */
/**
 * With Reduce Motion on, the block holds still (WCAG 2.3.3, CLAUDE.md). It's
 * decorative: screen readers skip it, and the screen labels the loading
 * section as a whole ("Loading jobs", busy).
 */
export function Skeleton({ className, style, ...props }: ViewProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    const start = (reduceMotion: boolean) => {
      loop?.stop();
      opacity.setValue(reduceMotion ? 0.75 : 1);
      if (reduceMotion || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.5, duration: 750, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        ]),
      );
      loop.start();
    };
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduce) => !cancelled && start(reduce))
      .catch(() => !cancelled && start(false));
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", start);
    return () => {
      cancelled = true;
      loop?.stop();
      subscription.remove();
    };
  }, [opacity]);

  return (
    <Animated.View style={[{ opacity }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View className={cn("h-full w-full rounded-sm bg-border-strong dark:bg-border-strong-dark", className)} {...props} />
    </Animated.View>
  );
}
