import { View, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useNativeColors } from "../theme/use-native-colors";

export interface ScrollEdgeMaskProps {
  edge: "top" | "bottom";
  height?: number;
  style?: ViewStyle;
}

/**
 * A fade-to-background gradient mask for the top/bottom edge of a scrollable
 * viewport — the Android (and web) counterpart to iOS's real
 * system-compositor blur, which `headerTransparent`/`headerBlurEffect`
 * (top) and `NativeTabs`'s own default `disableTransparentOnScrollEdge:
 * false` behavior (bottom) already provide for free on iOS with zero extra
 * component needed.
 *
 * Android has no performant JS-side realtime blur-of-scrolling-content
 * primitive available here (confirmed during Phase 3 research — `@expo/ui`'s
 * `GlassEffectContainer` is a SwiftUI-only primitive for blending multiple
 * `.glassEffect()`-modified views together, not a scroll-edge blur
 * mechanism, and has no Jetpack Compose counterpart at all), so this
 * deliberately fades to the background color instead of attempting to fake
 * a real blur — an accepted, documented platform difference, not a bug.
 *
 * Built on `react-native-svg` (already a dependency of this package) rather
 * than adding `expo-linear-gradient` as a new dependency for a single
 * component.
 *
 * Absolutely positioned — the consumer places it inside a `relative`
 * container pinned to the edge it should mask (e.g. `position: "absolute",
 * top: 0` for the top edge, under a transparent header; `bottom: 0` above
 * a tab bar). `pointerEvents="none"` so it never blocks taps on content
 * scrolling underneath it.
 */
export function ScrollEdgeMask({ edge, height = 32, style }: ScrollEdgeMaskProps) {
  const colors = useNativeColors();

  return (
    <View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, height, [edge]: 0 }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="fade" x1="0" y1={edge === "top" ? "0" : "1"} x2="0" y2={edge === "top" ? "1" : "0"}>
            <Stop offset="0" stopColor={colors.background} stopOpacity="1" />
            <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
      </Svg>
    </View>
  );
}
