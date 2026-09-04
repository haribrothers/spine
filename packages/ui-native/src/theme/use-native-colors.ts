import { useColorScheme } from "nativewind";
import { lightColors, darkColors } from "../tokens";

/**
 * Resolves the current color scheme to a plain hex-string color-token map.
 *
 * Most `@expo/ui`-backed components take NO direct color prop at all (e.g.
 * `Switch`/`Slider` — confirmed against their real TS types, which expose no
 * `color`/`tint` field) — `@expo/ui`'s own theming mechanism is `Host`'s
 * `seedColor`/`colorScheme` props, which theme an entire native subtree at
 * once (real Material You generation on Android via `SchemeTonalSpot`, real
 * SwiftUI tint propagation on iOS), not a per-component prop to thread
 * through. This hook exists for the narrower set of cases that still need a
 * raw resolved value directly — a `Host`'s own `seedColor`/`colorScheme`
 * props (see `nativeHostThemeProps` below), or a component whose style prop
 * genuinely does take a color (e.g. `Button`'s `style.backgroundColor`, a
 * `UniversalStyle` field) — not a blanket "pass this into every native
 * component" pattern like NativeWind's `className` is for the non-native
 * ones.
 */
export function useNativeColors() {
  const { colorScheme } = useColorScheme();
  return colorScheme === "dark" ? darkColors : lightColors;
}

/**
 * The `<Host colorScheme seedColor>` props that theme an entire native
 * subtree at once — pass a design-system color token as `seedColor` (e.g.
 * `colors.primary` for the default tint, `colors.overdue` for a destructive
 * action's own nested `<Host>`) to theme every `@expo/ui` component inside
 * it without threading color through each one individually.
 */
export function useNativeHostTheme(seedColor?: string) {
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;
  return {
    colorScheme: colorScheme === "dark" ? ("dark" as const) : ("light" as const),
    seedColor: seedColor ?? colors.primary,
  };
}
