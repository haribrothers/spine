import { View } from "react-native";
import { BottomSheet as ExpoBottomSheet, RNHostView, type SnapPoint } from "@expo/ui";
import { useNativeColors } from "../theme/use-native-colors";

/**
 * `@expo/ui`'s universal `BottomSheet` — genuinely cross-platform (iOS,
 * Android, AND web, ships in Expo Go, unlike the SwiftUI/Compose-subpath
 * components), real native modal-sheet chrome on every platform. Net-new
 * component.
 *
 * Themed content inside the sheet uses ordinary `packages/ui-native`
 * components; the sheet's own chrome (backdrop, drag indicator, corner
 * radius) IS directly themeable here — `containerColor` (the sheet's own
 * background) and `scrimColor` (Android backdrop) are real props on
 * `@expo/ui`'s component, resolved from the design system's `surface`/
 * `onSurface`-derived tokens below, not left at each platform's own
 * default. `contentColor` (Android-only, for native Compose content that
 * isn't RN) has no bearing on this sheet's `children`, which are always RN
 * views — see `@expo/ui`'s own doc comment on that prop.
 *
 * **Do NOT wrap this in our own `<Host>`** — unlike Button/Switch/Select/
 * Slider (which need an explicit wrapping `Host` for theming, since they
 * take no direct color prop), `@expo/ui`'s own `BottomSheet` implementation
 * already renders its own internal `Host style={{position:'absolute'}}
 * pointerEvents="none"` on both platforms (confirmed by reading
 * `@expo/ui/src/universal/BottomSheet/index.ios.tsx`/`index.android.tsx` —
 * the sheet's real content is presented detached from that zero-footprint
 * anchor via SwiftUI's `.sheet()`/Compose's `ModalBottomSheet`, not by the
 * Host's own layout). This component previously nested an extra `<Host
 * matchContents>` around `ExpoBottomSheet`, which was a contributing shipped
 * bug (an outer `Host`'s `matchContents` sizing collapsing against the inner
 * Host's own zero-intrinsic-size `{position:'absolute'}` view) — removed.
 *
 * **`children` must be wrapped in `RNHostView matchContents`, a SECOND, real
 * gap in `@expo/ui`'s universal `BottomSheet` found while fixing the above**:
 * even after removing the outer `Host`, the sheet on iOS still opened with a
 * visible backdrop/drag-indicator but completely blank content — confirmed
 * live on a real iOS simulator. Root cause, confirmed by reading `@expo/ui`'s
 * own source: the UNIVERSAL `BottomSheet` (`@expo/ui/src/universal/
 * BottomSheet/index.ios.tsx`, what the top-level `@expo/ui` import resolves
 * to) passes `children` straight into a SwiftUI `<Group>` with no measurement
 * bridge — plain RN views (`Text`, `View`) have no way to report their
 * intrinsic size into SwiftUI's layout system without one. `@expo/ui`'s OWN,
 * separate, more feature-complete `@expo/ui/community/bottom-sheet`
 * implementation (`@gorhom/bottom-sheet`-compatible, a much larger API with
 * refs/snap-index methods/custom handles — not a drop-in match for this
 * wrapper's simple `isPresented`/`onDismiss` shape) DOES wrap its children in
 * exactly `<RNHostView matchContents={fitToContents}>` for this reason,
 * confirmed by reading `@expo/ui/src/community/bottom-sheet/
 * BottomSheet.ios.tsx` — proving this is a real, narrow gap in the universal
 * component specifically, not something we were supposed to already know to
 * do. Rather than switching to the much larger community API for this one
 * fix, `RNHostView` (also universal — real `.ios.tsx`/`.android.tsx`
 * variants, exported from the same `@expo/ui` top-level barrel) is applied
 * here directly, the same bridge the community implementation and
 * `ListItem.ios.tsx` both use.
 *
 * **`matchContents` must be tied to whether `snapPoints` is set, NOT
 * unconditional — a real, reported bug.** `matchContents` doesn't just fix
 * "blank content" (the gap above); per `RNHostView.swift`'s own source, it
 * sizes the hosted SwiftUI wrapper to the RN child's Yoga-measured
 * INTRINSIC size — the same "size to content, not to the available
 * container" mechanism documented at length in `full-width-button.tsx`'s
 * own history. With a caller that sets real `snapPoints` (a genuinely
 * fixed-height sheet, e.g. `SelectListField`'s search box + `FlatList`),
 * there's no available width for the content's own `100%`/`flex: 1` to
 * resolve against at that boundary, so it collapses to its narrowest
 * intrinsic content (e.g. a line of text) instead of stretching to the
 * sheet's real presented width — confirmed live: the search box and list
 * rendered visibly narrower than the sheet itself. `@expo/ui`'s OWN
 * community bottom-sheet implementation already establishes the correct
 * rule for this exact fork (`BottomSheet.ios.tsx`'s `fitToContents =
 * enableDynamicSizing && (!snapPointsProp || snapPointsProp.length ===
 * 0)`) — `matchContents` here now follows the same rule: `true` only when
 * `snapPoints` is NOT set (the genuine "size the sheet to its content"
 * case, e.g. `BottomSheetDemo`'s plain `<BottomSheet>` with no
 * `snapPoints`), `false` whenever `snapPoints` IS set (a real, explicit
 * fixed-height sheet), letting the content genuinely fill that height via
 * `RNHostView`'s own fill-branch (`.frame(maxWidth: .infinity, maxHeight:
 * .infinity)`, see `RNHostView.swift`) instead of shrinking to content.
 */
export interface BottomSheetProps {
  isPresented: boolean;
  onDismiss: () => void;
  children?: React.ReactNode;
  showDragIndicator?: boolean;
  snapPoints?: SnapPoint[];
  testID?: string;
}

export function BottomSheet({ isPresented, onDismiss, children, showDragIndicator = true, snapPoints, testID }: BottomSheetProps) {
  const colors = useNativeColors();
  // See this file's own doc comment: only a sheet with NO explicit
  // `snapPoints` wants to size itself to its content's intrinsic size —
  // one WITH real `snapPoints` (a fixed-height sheet) needs its content to
  // fill that height/width instead, which `RNHostView`'s non-`matchContents`
  // fill branch provides.
  const fitToContents = !snapPoints || snapPoints.length === 0;

  return (
    <ExpoBottomSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      showDragIndicator={showDragIndicator}
      snapPoints={snapPoints}
      containerColor={colors.surface}
      scrimColor={`${colors.onSurface}80`}
      testID={testID}
    >
      <RNHostView matchContents={fitToContents}>
        <View style={fitToContents ? undefined : { flex: 1, width: "100%" }}>{children}</View>
      </RNHostView>
    </ExpoBottomSheet>
  );
}
