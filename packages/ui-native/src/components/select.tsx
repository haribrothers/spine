import { Picker, Host } from "@expo/ui";
import { useNativeHostTheme } from "../theme/use-native-colors";

export type SelectOption<T extends string | number> = {
  label: string;
  value: T;
};

export interface SelectProps<T extends string | number> {
  options: SelectOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  enabled?: boolean;
  testID?: string;
}

/**
 * `@expo/ui`'s universal `Picker` — real SwiftUI `Picker`/Jetpack Compose
 * dropdown via a `Host` bridge, replacing the previous
 * `@react-native-picker/picker` implementation entirely (that dependency is
 * dropped from this package's package.json in the same change). The public
 * API (`options`/`value`/`onValueChange`) is preserved from the old
 * implementation to minimize churn for callers.
 *
 * `appearance="menu"` (the default) is used rather than `"wheel"` — `wheel`
 * is iOS-only and falls back to a menu on Android/web anyway (per
 * `PickerAppearance`'s own doc comment), so there's no cross-platform
 * benefit to requesting it explicitly.
 *
 * Unlike `Button`, `error` styling has no equivalent here — `@expo/ui`'s
 * `Picker` has no border/background style props (confirmed against its
 * real TS type, which only exposes `selectedValue`/`onValueChange`/
 * `appearance`/`enabled`/`children`/`testID`) — an invalid-state affordance
 * for this control needs to live in a wrapping label/helper-text element at
 * the call site, not inside this component.
 */
export function Select<T extends string | number>({ options, value, onValueChange, enabled = true, testID }: SelectProps<T>) {
  const hostTheme = useNativeHostTheme();

  return (
    <Host matchContents colorScheme={hostTheme.colorScheme} seedColor={hostTheme.seedColor}>
      <Picker selectedValue={value} onValueChange={onValueChange} enabled={enabled} testID={testID}>
        {options.map((option) => (
          <Picker.Item key={String(option.value)} label={option.label} value={option.value} />
        ))}
      </Picker>
    </Host>
  );
}
