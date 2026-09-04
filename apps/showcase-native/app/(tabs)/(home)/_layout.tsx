import { Platform } from "react-native";
import { Stack } from "expo-router";
import { useNativeColors } from "@spine/ui-native";

/**
 * A nested `Stack` inside the Home tab's own route group — `NativeTabs`
 * itself is purely a tab bar (via `react-native-screens`' tab host, no
 * header of its own), so a tab that wants a real native-stack header needs
 * its own `Stack.Screen` here.
 *
 * `headerLargeTitleEnabled` (NOT the deprecated `headerLargeTitle` — using
 * the deprecated prop produced a real on-device layout bug during Phase 4
 * verification: the large title rendered OVER the screen's content instead
 * of reserving space above it, confirmed via screenshot) is the only
 * iOS-specific option set — NOT `headerTransparent`/`headerBlurEffect`
 * (the older pre-iOS-26 mechanism
 * `apps/design-system-native`'s own `native-header.tsx` doc page still
 * demonstrates, since that app targets a wider iOS range). This app's
 * toolchain runs against a real iOS 26 simulator, where
 * `react-native-screens`' native-stack already applies real scroll-edge
 * blur automatically via `scrollEdgeEffects` (default `"automatic"` on all
 * four edges, confirmed in `expo-router`'s own bundled native-stack types —
 * "Using both `headerBlurEffect` and `scrollEdgeEffects` (>= iOS 26)
 * simultaneously may cause overlapping effects"). Combining the two
 * produced exactly that overlap warning live on-device during Phase 3
 * verification (`[RNScreens] Using both blurEffect and scrollEdgeEffects
 * simultaneously may cause overlapping effects`), confirming this isn't
 * just a docs note — setting `headerTransparent`/`headerBlurEffect` here
 * would be actively redundant with, and conflicting with, what the
 * platform default already provides for free on iOS 26+.
 *
 * Android gets its own themed solid header via ordinary `headerStyle`/
 * `headerTintColor` (the Material `TopAppBar` look), resolved from
 * `useNativeColors()` — the same theming source every other reworked
 * component in this package uses now, in place of the old
 * `spineLightNavigationTheme`/`spineDarkNavigationTheme` mechanism (which
 * still exists for `apps/mobile`/`apps/design-system-native`'s React
 * Navigation-based screens, untouched by this rework).
 */
export default function HomeLayout() {
  const colors = useNativeColors();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Home",
          ...(Platform.OS === "ios"
            ? { headerLargeTitleEnabled: true }
            : {
                headerStyle: { backgroundColor: colors.surface },
                headerTintColor: colors.onSurface,
              }),
        }}
      />
    </Stack>
  );
}
