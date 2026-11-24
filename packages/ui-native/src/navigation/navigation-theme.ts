import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";
import { lightColors, darkColors } from "../tokens";

/**
 * React Navigation's own chrome (native-stack headers, bottom-tab bars,
 * drawer chrome, etc.) is NOT NativeWind-styled — it's rendered by React
 * Navigation itself outside any app's className-based component tree, so
 * pairing `dark:` classes everywhere else in an app does nothing for it.
 * It only reacts to the `theme` prop passed to `NavigationContainer`
 * (`@react-navigation/native`'s own `DefaultTheme`/`DarkTheme`, a generic
 * blue/gray palette unrelated to this design system's tokens).
 *
 * Originally built for `apps/design-system-native` after a real, shipped
 * bug there (a dark-mode screenshot showed a correctly-dark screen body
 * under a still-light header, because its `NavigationContainer` never
 * passed a `theme` prop at all) — moved here since `apps/mobile` needs the
 * identical fix for its bottom-tab bar and has no reason to duplicate it.
 *
 * Every app using React Navigation with this design system must pass one
 * of these two themes (selected via `useTheme().resolvedMode`) to its
 * `NavigationContainer` — there is no other way to theme React
 * Navigation's own chrome correctly.
 */
export const spineLightNavigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: lightColors.primary,
    background: lightColors.background,
    card: lightColors.surface,
    text: lightColors.onSurface,
    border: lightColors.border,
  },
};

export const spineDarkNavigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.primary,
    background: darkColors.background,
    card: darkColors.surface,
    text: darkColors.onSurface,
    border: darkColors.border,
  },
};
