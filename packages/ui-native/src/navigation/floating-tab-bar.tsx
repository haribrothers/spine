import { Pressable, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { lightColors, darkColors } from "../tokens";

/**
 * A fully custom bottom tab bar (GitHub-iOS-style: a floating, rounded,
 * inset pill rather than a full-width bar flush with the screen edge, icon
 * stacked above its label on every tab, with the active tab additionally
 * shown inside its own soft rounded highlight capsule) — requested
 * explicitly as a from-scratch replacement, not a themed version of React
 * Navigation's own tab bar (see `tab-bar.tsx`'s
 * `spineTabBarScreenOptions`/`TabBarIcon` for that lighter option).
 *
 * Passed via `Tab.Navigator`'s `tabBar` prop, which fully replaces React
 * Navigation's default tab bar — this component is therefore responsible
 * for everything the native tab bar normally provides for free: safe-area
 * insets (via `BottomTabBarProps.insets`, already resolved by React
 * Navigation — no separate `useSafeAreaInsets` call needed), active-state
 * detection (`state.index`), reading each screen's `tabBarIcon`/`title`
 * from `descriptors`, press handling with the same `tabPress`/`navigate`
 * event contract the default tab bar uses (so back-button/re-tap-to-scroll
 * behavior isn't silently lost), and accessibility roles/state
 * (`accessibilityRole="button"`, `accessibilityState.selected`).
 *
 * Colors are raw values (not NativeWind classNames) resolved from
 * `resolvedMode` — same reason as everywhere else in this file: a
 * `View`/`Pressable`'s background/border here isn't a case NativeWind's
 * `dark:` variant can reach any more cleanly than a direct color would.
 */
export interface FloatingTabBarProps extends BottomTabBarProps {
  resolvedMode: "light" | "dark";
}

/**
 * Because `FloatingTabBar` is `position: absolute` (it floats over content,
 * unlike the default tab bar which reserves its own space in the layout),
 * every screen using it needs bottom padding at least this tall or its
 * last row of content sits behind the floating bar — pass
 * `{ paddingBottom: FLOATING_TAB_BAR_RESERVED_HEIGHT + insets.bottom }` to
 * `Tab.Navigator`'s `screenOptions.sceneStyle` (per-screen `insets` come
 * from `useSafeAreaInsets()` in the consuming app, not from this constant,
 * since safe-area insets vary by device).
 */
export const FLOATING_TAB_BAR_RESERVED_HEIGHT = 76;

export function FloatingTabBar({ state, descriptors, navigation, insets, resolvedMode }: FloatingTabBarProps) {
  const colors = resolvedMode === "dark" ? darkColors : lightColors;

  return (
    <View
      style={{ paddingBottom: insets.bottom || 16 }}
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 items-center px-4"
    >
      <View
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        className="w-full max-w-md flex-row items-center justify-between rounded-full border px-2 py-2 shadow-lg"
      >
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;
          const { options } = descriptor;
          const isFocused = state.index === index;
          const label = typeof options.title === "string" ? options.title : route.name;
          const color = isFocused ? colors.primary : colors.onSurfaceMuted;

          function onPress() {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              style={isFocused ? { backgroundColor: colors.infoBg } : undefined}
              className="flex-1 items-center justify-center gap-1 rounded-full px-2 py-2"
            >
              {options.tabBarIcon?.({ focused: isFocused, color, size: 22 })}
              <Text style={{ color }} className="text-[11px] font-semibold">
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
