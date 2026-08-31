import { Picker, type PickerProps } from "@react-native-picker/picker";
import { View } from "react-native";
import { useColorScheme } from "nativewind";
import { cn } from "../lib/cn";
import { lightColors, darkColors } from "../tokens";

export type SelectOption<T extends string | number> = {
  label: string;
  value: T;
};

export interface SelectProps<T extends string | number> {
  options: SelectOption<T>[];
  value: T;
  onValueChange: PickerProps<T>["onValueChange"];
  error?: boolean;
  enabled?: boolean;
  className?: string;
}

/**
 * Ports `packages/ui`'s NativeSelect to `@react-native-picker/picker` — the
 * standard Expo-supported picker (an OS-native wheel/dialog on iOS/Android,
 * a real `<select>` on web), the RN equivalent of a plain flat-option-list
 * `<select>`. Reach for a custom Modal + FlatList (matching
 * `SearchPalette`'s own pattern) if a richer, custom-styled menu is ever
 * needed — same "escalate past this for custom chrome" relationship
 * `NativeSelect`/`Select` have on web.
 *
 * `@react-native-picker/picker` is a NEW dependency of this package (not
 * previously installed anywhere in the repo) — a real native module (not
 * pure JS/RN), added specifically for this component per an explicit
 * decision to prefer the standard library over a hand-rolled Modal+FlatList
 * picker.
 *
 * `Picker` only accepts a `style` prop (not `className` — confirmed against
 * its own type definitions, which type `style` as `StyleProp<TextStyle>`
 * with no `className` in its props at all, since it's a third-party native
 * module rather than a plain RN core component NativeWind's babel plugin
 * transforms). Given the real, confirmed-live bug already hit with
 * `Animated.View`'s `className` silently no-op'ing on web (see
 * `skeleton.tsx`), this doesn't risk the same class of bug on a component
 * that was never going to support `className` in the first place: the
 * border/background/error styling lives on a wrapping `View` (which DOES
 * support `className`, being a plain RN core component), and `Picker`
 * itself only receives resolved raw colors via `style`.
 *
 * `style` needs an explicit `backgroundColor`, not just `color` — confirmed
 * live: on the web target, `@react-native-picker/picker` renders a real
 * `<select>` (its `Picker.web.js` uses `react-native-web`'s
 * `unstable_createElement("select", ...)`), and passing only `color` left
 * the browser's own white `<select>` background showing through in dark
 * mode, since nothing else in this component sets it. `dropdownIconColor`
 * is iOS/Android-only per its own type comment and has no effect on web.
 */
export function Select<T extends string | number>({
  options,
  value,
  onValueChange,
  error = false,
  enabled = true,
  className,
}: SelectProps<T>) {
  const { colorScheme } = useColorScheme();
  const colors = colorScheme === "dark" ? darkColors : lightColors;

  return (
    <View
      className={cn(
        "h-11 w-full justify-center overflow-hidden rounded-sm border bg-surface dark:bg-surface-dark",
        error ? "border-overdue dark:border-overdue-dark" : "border-border-strong dark:border-border-strong-dark",
        enabled ? "" : "opacity-50",
        className,
      )}
    >
      <Picker
        selectedValue={value}
        onValueChange={onValueChange}
        enabled={enabled}
        style={{ color: colors.onSurface, backgroundColor: colors.surface }}
        dropdownIconColor={colors.onSurfaceMuted}
      >
        {options.map((option) => (
          <Picker.Item key={String(option.value)} label={option.label} value={option.value} color={colors.onSurface} />
        ))}
      </Picker>
    </View>
  );
}
