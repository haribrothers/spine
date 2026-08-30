import { Feather } from "@expo/vector-icons";
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import { lightColors, darkColors } from "../tokens";

/**
 * Themed `screenOptions` for `createBottomTabNavigator`, shared across
 * every app so a themed bottom-tab bar isn't hand-rolled per app the way
 * the disabled-Button/loading-spinner colors once were. `tabBarStyle`,
 * `tabBarActiveTintColor`, `tabBarInactiveTintColor` are all raw RN style
 * props (not NativeWind classNames — the tab bar is React Navigation's own
 * chrome, same "not a className-styled component" situation as
 * `navigation-theme.ts`'s `NavigationContainer` theme), so they need
 * direct color values resolved from the same `resolvedMode` the rest of
 * the app already reads via `useTheme()`.
 *
 * This only covers the SHARED options (colors/background) — each
 * `Tab.Screen` still supplies its own `tabBarIcon` (via `TabBarIcon`
 * below) and `title`, since those are necessarily per-route.
 */
export function spineTabBarScreenOptions(resolvedMode: "light" | "dark"): BottomTabNavigationOptions {
  const colors = resolvedMode === "dark" ? darkColors : lightColors;
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.onSurfaceMuted,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
    },
  };
}

/** `Feather` icon names used by `apps/mobile`'s tab bar — kept as a named type so a typo in a screen's `name` prop is a build error, not a silent blank icon. */
export type TabBarIconName = React.ComponentProps<typeof Feather>["name"];

/**
 * Renders a themed tab icon for a `Tab.Screen`'s `tabBarIcon` — a thin
 * wrapper so apps don't need their own `@expo/vector-icons` import and
 * per-tab color-resolution boilerplate; React Navigation already resolves
 * `color` correctly per tab (active vs. inactive) from
 * `spineTabBarScreenOptions`'s tint colors above and passes it straight
 * through.
 */
export function TabBarIcon({ name, color, size }: { name: TabBarIconName; color: string; size: number }) {
  return <Feather name={name} color={color} size={size} />;
}
