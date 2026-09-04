import ExpoDateTimePicker, { type DateTimePickerProps as ExpoDateTimePickerProps } from "@expo/ui/community/datetime-picker";
import { useNativeColors } from "../theme/use-native-colors";

/**
 * `@expo/ui`'s community `DateTimePicker` — `@react-native-community/
 * datetimepicker`-compatible, real native pickers on both platforms
 * (SwiftUI `DatePicker` on iOS, Android's Material date/time dialogs).
 * Net-new component.
 *
 * Prop shape is simplified from `@expo/ui`'s own (which mirrors the older
 * community library closely, including a deprecated `onChange` and a
 * `DateTimePickerEvent` wrapper) down to the plain `value`/`onChange` pair
 * matching web `packages/ui`'s DatePicker — this wrapper maps that onto
 * `@expo/ui`'s `onValueChange`, discarding the event wrapper's
 * timestamp/utcOffset fields callers don't need for a controlled `Date`.
 *
 * `accentColor` defaults to the design system's `primary` token (via
 * `useNativeColors()`) rather than requiring every call site to pass it —
 * this is a plain color prop on `@expo/ui`'s own component (unlike Button/
 * Switch/Slider/Picker, which take no color prop at all and rely entirely
 * on `Host`'s `seedColor`), so it's resolved the same way `select.tsx`
 * resolved raw colors for `@react-native-picker/picker` before this
 * rework: a direct prop, not a `Host` wrapper.
 */
export interface DateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  mode?: ExpoDateTimePickerProps["mode"];
  minimumDate?: Date;
  maximumDate?: Date;
  disabled?: boolean;
  testID?: string;
}

export function DateTimePicker({ value, onChange, mode = "date", minimumDate, maximumDate, disabled = false, testID }: DateTimePickerProps) {
  const colors = useNativeColors();

  return (
    <ExpoDateTimePicker
      value={value}
      onValueChange={(_event, date) => onChange(date)}
      mode={mode}
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      disabled={disabled}
      accentColor={colors.primary}
      testID={testID}
    />
  );
}
