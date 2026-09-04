import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useNativeColors } from "@spine/ui-native";

/**
 * Real native chrome (Phase 3) — `expo-router`'s `unstable-native-tabs`
 * renders a genuine `UITabBar` on iOS (Liquid Glass automatically, per its
 * own upstream doc comment quoted in CLAUDE.md's `@expo/ui` note) and a
 * Material bottom nav on Android, from one declarative API. This replaces
 * Phase 0's placeholder `Tabs` entirely.
 *
 * Icons use `sf` (SF Symbol name, iOS) + `md` (Material Symbol name,
 * Android) — NOT `lucide-react-native`, a deliberate, confirmed exception
 * to CLAUDE.md's Lucide-only icon rule for this ONE surface. Passing a
 * Lucide (or any non-`VectorIcon`) React element as `Icon`'s `src` prop is
 * silently unsupported — confirmed live via a real device log
 * (`console.warn('Only VectorIcon is supported as a React element in
 * Icon.src')`, traced to `expo-router`'s own
 * `convertComponentSrcToImageSource`, which only special-cases `VectorIcon`
 * (an `@expo/vector-icons` wrapper — reintroducing it here would be exactly
 * the icon-font glyph-centering risk Lucide's migration fixed) and its own
 * internal `PromiseIcon` (a private, unexported escape hatch). `sf`/`md`
 * are real native icon catalogs (SF Symbols / Material Symbols) with a
 * fully-supported, zero-extra-tooling path — visually different shapes
 * from Lucide's set, an explicitly accepted tradeoff for native tab-bar
 * chrome specifically; every OTHER icon anywhere in this app (in-screen
 * content, not tab-bar items) still uses Lucide per the unchanged rule.
 *
 * `iconColor`/`tintColor` are resolved from the design system's own color
 * tokens via `useNativeColors()` — the same theming source every other
 * `@expo/ui`-backed component in this rework uses — rather than left at
 * the OS default tint.
 *
 * The Home tab's `Trigger` uses `name="(home)"`, NOT `name="index"` —
 * confirmed by tracing `expo-router`'s own route-matching code
 * (`useScreens.js`'s `getSortedChildren`, which only special-cases an
 * unmatched name by trying `${name}/index`, never strips a group's
 * parentheses). Groups are transparent to the URL, not to the route name
 * `expo-router` registers for a `NativeTabs` child — `app/(tabs)/(home)/`
 * (a group folder holding its own `_layout.tsx` Stack, so this tab alone
 * gets a real native-stack header) registers as route name `"(home)"`
 * itself, not `"index"`. Using `"index"` here silently drops the whole tab
 * with no visible error (`withLayoutContext`'s `useOnlyUserDefinedScreens`
 * filters out the unmatched route) — confirmed empirically before landing
 * this file. `components`/`templates` work with a plain `name="components"`
 * only because `getSortedChildren` DOES special-case the `${name}/index`
 * fallback for a plain (non-group) subdirectory; that fallback doesn't
 * apply to a parenthesized group segment.
 */
export default function TabsLayout() {
  const colors = useNativeColors();

  return (
    <NativeTabs
      tintColor={colors.primary}
      iconColor={{ default: colors.onSurfaceMuted, selected: colors.primary }}
      backgroundColor={colors.surface}
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="components">
        <NativeTabs.Trigger.Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} md="grid_view" />
        <NativeTabs.Trigger.Label>Components</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="templates">
        <NativeTabs.Trigger.Icon sf={{ default: "rectangle.stack", selected: "rectangle.stack.fill" }} md="dashboard" />
        <NativeTabs.Trigger.Label>Templates</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
