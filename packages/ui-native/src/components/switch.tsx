import { Switch as ExpoSwitch, Host } from "@expo/ui";
import { useNativeHostTheme } from "../theme/use-native-colors";

/**
 * `@expo/ui`'s universal `Switch` — real SwiftUI `Toggle`/Jetpack Compose
 * `Switch` via a `Host` bridge. Net-new component (no prior ui-native
 * implementation existed) — prop names deliberately match `@expo/ui`'s own
 * `value`/`onValueChange`, NOT web `packages/ui`'s `checked`/
 * `onCheckedChange` — confirmed against `SwitchProps`'s real TS type, which
 * has no `color` prop at all (unlike Button, Switch's accent color is
 * theme-only, set via `Host`'s `seedColor`, with no per-instance override).
 */
export interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  testID?: string;
}

export function Switch({ value, onValueChange, disabled = false, label, testID }: SwitchProps) {
  const hostTheme = useNativeHostTheme();

  return (
    <Host matchContents colorScheme={hostTheme.colorScheme} seedColor={hostTheme.seedColor}>
      <ExpoSwitch value={value} onValueChange={onValueChange} disabled={disabled} label={label} testID={testID} />
    </Host>
  );
}
