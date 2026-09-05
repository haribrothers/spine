import { Platform } from "react-native";
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
 * (a group folder holding its own `_layout.tsx` Stack, so this tab gets
 * its own real native-stack header) registers as the route name `"(home)"`
 * itself, not `"index"`. Using the bare name here silently drops the whole
 * tab with no visible error (`withLayoutContext`'s
 * `useOnlyUserDefinedScreens` filters out the unmatched route) — confirmed
 * empirically before landing this file. `components`/`templates`/`search`
 * work with a plain `name="components"` etc. only because
 * `getSortedChildren` DOES special-case the `${name}/index` fallback for a
 * plain (non-group) subdirectory; that fallback doesn't apply to a
 * parenthesized group segment.
 *
 * **Profile is no longer a tab at all** (user request) — it moved to a
 * root-level modal sheet reached via a header avatar icon on every other
 * tab (`ProfileHeaderButton`, see `app/_layout.tsx`'s own doc comment for
 * the `presentation: "formSheet"` registration). Removing its `Trigger`
 * here was the other half of that change — a route can still be pushed to
 * without ever appearing as a `NativeTabs.Trigger`.
 *
 * **Search's `Trigger` is genuinely platform-divergent, not a shared
 * pattern like Profile's avatar was** — iOS gets `role="search"`, a real,
 * confirmed `@platform iOS`-only feature of `NativeTabs.Trigger`
 * (confirmed in `expo-router`'s own bundled types:
 * `SUPPORTED_TAB_BAR_ITEM_ROLES` includes `"search"`, and the `role` prop
 * itself is tagged `@platform iOS` with no Android counterpart at all) —
 * this produces the native separated/floating search-tab treatment
 * (`UITabBar`'s own built-in search-tab presentation, iOS 18+). Android's
 * Material bottom nav has no equivalent concept whatsoever, so per
 * explicit user decision it gets an ordinary 4th tab there instead — same
 * destination screen (`/search`), no special chrome to mimic since none
 * exists on Android to begin with.
 *
 * `labelVisibilityMode="labeled"` (`@platform android`-only, per
 * `expo-router`'s own bundled types — a no-op on iOS's `UITabBar`, which
 * always shows every tab's label anyway) — a real, user-reported bug fix:
 * Android's Material bottom nav defaulted to `"auto"` (its own upstream
 * default), which only shows a label for the currently-SELECTED tab and
 * hides the rest, confirmed live via screenshot (only "Home" had visible
 * text, the other three tabs showed icon-only). Set once here on the
 * top-level `NativeTabs`, applying to every tab — per-`Trigger` overrides
 * exist too ("takes precedence over the value set on `NativeTabs`," per
 * its own doc comment) but aren't needed here since every tab wants the
 * same always-labeled behavior.
 *
 * `backgroundColor={colors.surfaceSunken}`, NOT `colors.surface` — a
 * real, user-reported bug fix, Android-only in practice. `colors.surface`
 * is literally `#FFFFFF` in light mode, IDENTICAL to `colors.background`
 * (also `#FFFFFF`) — confirmed directly in `packages/ui-native`'s own
 * color tokens — so the bottom nav bar and the screen body had zero
 * visible boundary between them in light mode specifically (dark mode
 * happened to look fine only because `dark.surface`/`dark.background`
 * genuinely differ, `#191815` vs `#121110`, not because the tab bar was
 * doing anything different). `colors.surfaceSunken` (`#FAFAF9` light /
 * `#2C2B26` dark) is genuinely distinct from `background` in BOTH themes,
 * giving the nav bar a real, subtle boundary consistently rather than one
 * that only worked by accident in dark mode. This is the same light-gray
 * token already used elsewhere on this screen (the welcome card, the
 * quick-action tiles) — a subtle elevation-style tint, not a stark
 * contrast, matching real Material Design bottom-nav styling and an
 * explicit user preference over a more visibly distinct gray.
 */
export default function TabsLayout() {
  const colors = useNativeColors();

  return (
    <NativeTabs
      tintColor={colors.primary}
      iconColor={{ default: colors.onSurfaceMuted, selected: colors.primary }}
      backgroundColor={colors.surfaceSunken}
      labelVisibilityMode="labeled"
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
      {Platform.OS === "ios" ? (
        <NativeTabs.Trigger name="search" role="search" />
      ) : (
        <NativeTabs.Trigger name="search">
          <NativeTabs.Trigger.Icon sf={{ default: "magnifyingglass", selected: "magnifyingglass" }} md="search" />
          <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      )}
    </NativeTabs>
  );
}
