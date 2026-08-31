import { useEffect, useRef } from "react";
import { Animated, View, type ViewProps } from "react-native";
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
 * The `className` (bg-border, sizing, rounding) is applied to a plain
 * `View` NESTED inside the `Animated.View`, not on the `Animated.View`
 * itself — confirmed live via a real `expo export --platform web` render
 * that `Animated.View`'s own `className` prop does not compile through
 * NativeWind on the web target (the opacity animation worked, but every
 * NativeWind class on the same element was silently dropped, leaving an
 * invisible unstyled div). Only the animated `style={{ opacity }}` lives on
 * the outer `Animated.View`; every themed class lives on the inner `View`,
 * which fills its parent so the pulse still applies visually to the whole
 * shape.
 */
export function Skeleton({ className, style, ...props }: ViewProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.5, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[{ opacity }, style]}>
      <View className={cn("h-full w-full rounded-sm bg-border dark:bg-border-dark", className)} {...props} />
    </Animated.View>
  );
}
