import { SegmentedControl as ExpoSegmentedControl } from "@expo/ui/community/segmented-control";
import type { StyleProp, ViewStyle } from "react-native";
import { useNativeColors } from "../theme/use-native-colors";

/**
 * `@expo/ui/community/segmented-control`'s real, genuinely native component
 * — a real SwiftUI `Picker` in `.segmented` style on iOS, a real Jetpack
 * Compose `SingleChoiceSegmentedButtonRow` on Android (confirmed by reading
 * both platform implementation files directly) — wrapped here so consuming
 * apps never import `@expo/ui` directly for this control. Was previously
 * imported straight from `@expo/ui` in `apps/showcase-native`'s Home
 * screen; moved here as part of making `packages/ui-native` the sole
 * `@expo/ui`/styling touchpoint for consuming apps.
 *
 * Prop names/shape simplified to this package's own convention
 * (`value`/`onValueChange` by string, matching `Select`/`SelectField`)
 * rather than `@expo/ui`'s own `values`/`selectedIndex`/`onChange`
 * (index-based, with a native-event-shaped callback) — the underlying
 * component already exposes a plain `onValueChange(value: string)`
 * alternative for exactly this reason (see its own `types.tsx`), so no
 * index/native-event bridging is needed here at all.
 *
 * Color is NOT threaded through a per-component prop the way `tintColor`
 * might suggest — this package's other `@expo/ui`-backed components theme
 * via a wrapping `Host`'s `seedColor` instead, but `SegmentedControl` has
 * no direct color prop reaching a `Host` context on Android/web (its own
 * `tintColor` is `@platform android, web`-only per its type, with no iOS
 * equivalent at all) — passed through directly from `useNativeColors()`
 * for the platforms that do support it, left unset on iOS (native default
 * accent color, matching this control's own real platform convention).
 */
export interface SegmentedControlProps {
  values: string[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SegmentedControl({ values, value, onValueChange, disabled = false, style, testID }: SegmentedControlProps) {
  const colors = useNativeColors();
  const selectedIndex = values.indexOf(value);

  return (
    <ExpoSegmentedControl
      values={values}
      selectedIndex={selectedIndex}
      onValueChange={onValueChange}
      enabled={!disabled}
      tintColor={colors.primary}
      style={style}
      testID={testID}
    />
  );
}
