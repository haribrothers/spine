import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";
import { lightColors, darkColors } from "@spine/ui-native/tokens";

/**
 * React Navigation's native-stack header is NOT a NativeWind-styled
 * component — it's rendered by React Navigation itself outside our
 * className-based component tree, so pairing `dark:` classes everywhere
 * else in the app does nothing for it. It only reacts to the `theme` prop
 * passed to `NavigationContainer` (`@react-navigation/native`'s own
 * `DefaultTheme`/`DarkTheme`, which default to a generic blue/gray palette
 * having nothing to do with our tokens). Building our own light/dark
 * `Theme` objects from `lightColors`/`darkColors` is the correct fix — this
 * is what shipped as a real bug (header stayed light in dark mode) since
 * `RootNavigator` never passed a `theme` prop at all, confirmed via a
 * screenshot showing a light header above an otherwise-correctly-dark body.
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
