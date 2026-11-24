import { ActivityIndicator, View } from "react-native";
import { useColorScheme } from "nativewind";
import { useT } from "../lib/i18n";
import { lightColors, darkColors } from "../tokens";

const sizeMap = {
  sm: { indicatorSize: "small" as const, scale: 1 },
  md: { indicatorSize: "small" as const, scale: 1.3 },
  lg: { indicatorSize: "large" as const, scale: 1 },
};

export interface SpinnerProps {
  size?: keyof typeof sizeMap;
  label?: string;
}

/**
 * Ports `packages/ui`'s Spinner — an indeterminate loading indicator for
 * actions with no known duration (prefer a skeleton-shaped placeholder for
 * content with a known shape, once this package has one).
 *
 * RN's `ActivityIndicator` only supports `size="small"|"large"` (not an
 * arbitrary pixel value like web's Lucide `Loader2`), so the 3-size scale
 * is approximated with a `transform: scale()` on top of those two sizes
 * rather than a real third rendered size.
 *
 * Wrapped in a `View` with `accessibilityRole="alert"` +
 * `accessibilityLiveRegion="polite"` — the RN equivalent of web's
 * `role="status"` + `aria-label` span: a polite announcement without
 * focus moving anywhere, exactly like `Button`'s own `loading` state
 * already relies on (this is the same `ActivityIndicator` + theme-aware
 * color resolution `Button` uses, extracted into its own component now
 * that a second, non-Button use needs it).
 */
export function Spinner({ size = "md", label }: SpinnerProps) {
  const t = useT();
  const { colorScheme } = useColorScheme();
  const color = colorScheme === "dark" ? darkColors.onSurfaceMuted : lightColors.onSurfaceMuted;
  const { indicatorSize, scale } = sizeMap[size];

  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={label ?? t("uiNative.spinner.loading")}>
      <ActivityIndicator size={indicatorSize} color={color} style={{ transform: [{ scale }] }} />
    </View>
  );
}
