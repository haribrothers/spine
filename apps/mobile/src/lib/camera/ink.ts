import { useNativeColors, useTheme } from "@spine/ui-native";

/**
 * Dark in both themes: the camera's controls, and a photo's veil ("+9"),
 * are light "ink" on the token scrim over a near-black base.
 */
export function useCameraInk() {
  const colors = useNativeColors();
  const { resolvedMode } = useTheme();
  const dark = resolvedMode === "dark";
  return { ink: dark ? colors.onSurface : colors.surface, onInk: dark ? colors.background : colors.onSurface, glass: colors.scrim, base: dark ? colors.background : colors.onSurface, primary: colors.primary, onPrimary: colors.onPrimary };
}
