import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { lightColors, darkColors } from "../tokens";

/**
 * A fully custom bottom tab bar (GitHub-iOS-style: a floating, rounded,
 * inset pill rather than a full-width bar flush with the screen edge, icon
 * stacked above its label on every tab, with the active tab additionally
 * shown inside its own soft rounded highlight capsule that slides between
 * tabs rather than instantly swapping) — requested explicitly as a
 * from-scratch replacement, not a themed version of React Navigation's own
 * tab bar (see `tab-bar.tsx`'s `spineTabBarScreenOptions`/`TabBarIcon` for
 * that lighter option).
 *
 * Height/label-size follow iOS's own `UITabBar` defaults (Apple's Human
 * Interface Guidelines / the stock `UITabBarItem` appearance): 49pt bar
 * content height, 10pt labels — the same numbers every unmodified iOS
 * app's tab bar uses, so this reads as a genuinely native-feeling bar
 * rather than an arbitrary custom size. Icon size is 24pt (a deliberate
 * 1pt departure from iOS's own 25pt default, matching Lucide's natural
 * default size instead).
 *
 * Icons are `lucide-react-native` components (the same icon set web's
 * `packages/ui` uses via `lucide-react`), passed as a component reference
 * via each `Tab.Screen`'s `tabBarIcon` option, not a string name — see
 * `tab-bar.tsx`'s `TabBarIcon` doc comment for why this migrated off
 * `@expo/vector-icons`' Feather (a real, user-reported icon-vertical-
 * alignment bug caused by icon-font glyph-metric inconsistency, which
 * Lucide's uniform SVG bounding boxes fix as a side effect).
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

/** iOS `UITabBar`'s standard content height (excludes the home-indicator safe-area inset, added separately via `insets.bottom`). */
const TAB_BAR_HEIGHT = 49;
/** Lucide's natural default icon size — see this file's own doc comment on the deliberate 1pt departure from iOS's 25pt default. */
const TAB_ICON_SIZE = 24;
/** iOS `UITabBarItem`'s standard label size. */
const TAB_LABEL_FONT_SIZE = 10;
const TAB_BAR_OUTER_PADDING = 6;

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
export const FLOATING_TAB_BAR_RESERVED_HEIGHT = TAB_BAR_HEIGHT + TAB_BAR_OUTER_PADDING * 2 + 16;

interface TabLayout {
  x: number;
  width: number;
}

export function FloatingTabBar({ state, descriptors, navigation, insets, resolvedMode }: FloatingTabBarProps) {
  const colors = resolvedMode === "dark" ? darkColors : lightColors;
  const tabLayouts = useRef<Record<number, TabLayout>>({});
  const [highlightReady, setHighlightReady] = useState(false);
  const highlightX = useRef(new Animated.Value(0)).current;
  const highlightWidth = useRef(new Animated.Value(0)).current;

  function animateHighlightTo(index: number) {
    const layout = tabLayouts.current[index];
    if (!layout) return;
    if (!highlightReady) {
      // First measurement (initial mount / initial focused tab): snap
      // instead of sliding in from the top-left corner, which is what an
      // Animated.Value's un-set 0 default would otherwise animate from.
      highlightX.setValue(layout.x);
      highlightWidth.setValue(layout.width);
      setHighlightReady(true);
      return;
    }
    Animated.parallel([
      Animated.spring(highlightX, { toValue: layout.x, useNativeDriver: false, bounciness: 6, speed: 16 }),
      Animated.spring(highlightWidth, { toValue: layout.width, useNativeDriver: false, bounciness: 6, speed: 16 }),
    ]).start();
  }

  useEffect(() => {
    animateHighlightTo(state.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index]);

  return (
    <View
      style={{ paddingBottom: insets.bottom || 16 }}
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 items-center px-4"
    >
      <View
        style={{ backgroundColor: colors.surface, borderColor: colors.border, height: TAB_BAR_HEIGHT + TAB_BAR_OUTER_PADDING * 2 }}
        className="w-full max-w-md flex-row items-center justify-between rounded-full border px-1.5 shadow-lg"
      >
        {/* Sliding highlight — a single animated capsule positioned behind the focused tab's icon+label, rather than each tab toggling its own background instantly. */}
        {highlightReady ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: highlightX,
              width: highlightWidth,
              top: TAB_BAR_OUTER_PADDING,
              height: TAB_BAR_HEIGHT,
              backgroundColor: colors.infoBg,
              borderRadius: 9999,
            }}
          />
        ) : null}

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

          function onLayout(event: LayoutChangeEvent) {
            const { x, width } = event.nativeEvent.layout;
            tabLayouts.current[index] = { x, width };
            if (isFocused) animateHighlightTo(index);
          }

          return (
            <Pressable
              key={route.key}
              onLayout={onLayout}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              style={{ height: TAB_BAR_HEIGHT }}
              className="z-10 flex-1 items-center justify-center gap-0.5 px-2"
            >
              {options.tabBarIcon?.({ focused: isFocused, color, size: TAB_ICON_SIZE })}
              <Text style={{ color, fontSize: TAB_LABEL_FONT_SIZE }} className="font-semibold">
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
