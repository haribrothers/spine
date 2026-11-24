import type { LucideIcon } from "lucide-react-native";
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

/**
 * Renders a themed tab icon for a `Tab.Screen`'s `tabBarIcon` — a thin
 * wrapper so a screen doesn't need to resolve stroke width/size boilerplate
 * itself; React Navigation already resolves `color` correctly per tab
 * (active vs. inactive) from `spineTabBarScreenOptions`'s tint colors above
 * and passes it straight through.
 *
 * Takes the icon COMPONENT directly (`icon={Home}`, from `lucide-react-native`
 * — the same icon set web's `packages/ui` uses via `lucide-react`, so both
 * platforms share one visual icon language) rather than a string name
 * looked up at render time: a typo becomes an import error at the call
 * site, not a silently-blank icon, and there's no separate icon-name union
 * type to keep in sync with whatever's actually imported.
 *
 * Migrated off `@expo/vector-icons`' `Feather` (confirmed removed as a
 * dependency in the same change): Feather's icon-FONT glyphs have
 * inconsistent internal vertical centering per icon (a well-known icon-font
 * characteristic), which showed up as a real, user-reported bug — icons
 * across different tabs sitting at visibly different heights despite an
 * identical declared `size`. Lucide's SVG-based icons render a uniform,
 * predictable bounding box per icon, which fixes that misalignment as a
 * side effect of the migration, not a separate fix.
 */
export function TabBarIcon({ icon: Icon, color, size }: { icon: LucideIcon; color: string; size: number }) {
  return <Icon color={color} size={size} />;
}
