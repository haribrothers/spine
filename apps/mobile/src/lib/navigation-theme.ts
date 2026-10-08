import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import { useNativeColors, useTheme } from "@spine/ui-native";

/**
 * The navigation theme for native headers and stacks, from the app's own
 * light/dark mode and tokens. Without it React Navigation's light default
 * paints pushed screens' headers white in dark mode (US-MOB-19).
 */
export function useNavigationTheme(): Theme {
  const { resolvedMode } = useTheme();
  const colors = useNativeColors();
  const base = resolvedMode === "dark" ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: { ...base.colors, primary: colors.primary, background: colors.background, card: colors.background, text: colors.onSurface, border: colors.border, notification: colors.overdue },
  };
}
