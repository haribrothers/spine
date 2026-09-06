import { useEffect } from "react";
import { TextField as SwiftUITextField, Host, useNativeState } from "@expo/ui/swift-ui";
import { background, disabled as iosDisabled, keyboardType as iosKeyboardType, padding, strokeBorder, textFieldStyle } from "@expo/ui/swift-ui/modifiers";
import { useNativeColors } from "../theme/use-native-colors";

/**
 * A genuinely native iOS text field, built directly from Apple's own
 * SwiftUI `TextField` API (https://developer.apple.com/documentation/
 * swiftui/textfield) via `@expo/ui`'s SwiftUI bridge — iOS ONLY. There is
 * no Android branch: an earlier version of this component also covered
 * Android via Compose's Material3 `OutlinedTextField`, but was reverted
 * (undo the whole thing before rebuilding, not incrementally) per explicit
 * instruction to scope this to iOS alone. Do not add an Android branch
 * back without a separate, explicit request to do so.
 *
 * Additive, NOT a replacement for `TextField` (the existing NativeWind/
 * `cva`-styled `TextInput` wrapper, still the default field on every other
 * screen and on Android everywhere) — reach for `NativeTextField`
 * specifically where a screen wants iOS's own native field behavior
 * (real system text editing: native selection handles, real
 * cut/copy/paste/lookup menu, autofill, Live Text/QuickType, IME
 * composition) instead of RN's `TextInput` bridge.
 *
 * **Why `.textFieldStyle('plain')` + hand-drawn `background`/`strokeBorder`,
 * not `.textFieldStyle('roundedBorder')`** — confirmed against SwiftUI's
 * actual documented behavior, not a guess: `.roundedBorder` is a real,
 * built-in bordered style, but its border color is NOT independently
 * customizable — Apple provides no modifier for it, and the standard
 * workaround (used across SwiftUI reference material) is exactly what this
 * component does: `.plain` (no built-in chrome at all) plus your own
 * `background`/`strokeBorder`(`shape: 'roundedRectangle'`)/`cornerRadius`.
 * Since "the color system must be ours" was an explicit, non-negotiable
 * requirement here, `.plain` + hand-drawn chrome is the only path that
 * actually satisfies it — `.roundedBorder` cannot.
 *
 * **Color is threaded through explicitly, never left at the system
 * default** — `background`/`strokeBorder` resolve from this design
 * system's own tokens (`colors.surface`, `colors.borderStrong`/
 * `colors.overdue` for the error state), the same mechanism already used
 * for `Button`/`Switch`/`DateTimePicker`'s own `tint`/`accentColor`
 * theming.
 *
 * **`value`/`onChangeText` are plain controlled-component props, but
 * `@expo/ui`'s underlying field is driven by an `ObservableState` (a real
 * native `SharedObject`, not a plain JS value) — NOT a `{get, set}`
 * plain-object shape.** This component creates that observable once via
 * `useNativeState("")` and keeps it in sync with the external `value` prop
 * through a `useEffect` (writing `.value` imperatively whenever the prop
 * changes elsewhere, e.g. a form reset) — reads flow the other direction
 * through `onTextChange` (the plain JS callback `@expo/ui` also exposes,
 * not the observable's own worklet-only `onChange`, which requires
 * `react-native-worklets` and runs on the UI thread — not needed here
 * since this component has no synchronous-update requirement).
 *
 * **`useNativeState` constructs a real native-bridge `ExpoUI.ObservableState`
 * class that `jest-expo`'s own `expo-modules-core` mock has no built-in
 * stand-in for** (`ExpoUI.ObservableState is not a constructor` under
 * test, confirmed live) — this package's `jest.setup.ts` augments
 * `globalThis.expo.modules.ExpoUI` with a working mock class, following
 * the exact same precedent `jest-expo`'s OWN setup file already
 * establishes for `expo/fetch`'s `ExpoFetchModule.NativeRequest`/
 * `NativeResponse` stub classes. Any future `useNativeState`-based
 * component relies on that same setup file.
 *
 * **`Host` needs BOTH `matchContents={{ vertical: true }}` AND an explicit
 * `style={{ width: "100%" }}`** — the same two-part fix `DateTimePicker`'s
 * own doc comment documents: `matchContents` alone only ever bounds
 * height, never width, so a `Host` with no explicit width collapses to
 * intrinsic content size inside a shrink-to-content parent. Do not drop
 * either half of this pairing.
 */
export interface NativeTextFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "decimal" | "email" | "numeric" | "phone";
  testID?: string;
}

const KEYBOARD_TYPE_TO_IOS: Record<
  NonNullable<NativeTextFieldProps["keyboardType"]>,
  "default" | "email-address" | "numeric" | "phone-pad" | "decimal-pad"
> = {
  default: "default",
  decimal: "decimal-pad",
  email: "email-address",
  numeric: "numeric",
  phone: "phone-pad",
};

export function NativeTextField({
  value,
  onChangeText,
  placeholder = "",
  error = false,
  disabled = false,
  multiline = false,
  keyboardType = "default",
  testID,
}: NativeTextFieldProps) {
  const colors = useNativeColors();
  const borderColor = error ? colors.overdue : colors.borderStrong;
  const state = useNativeState(value);

  useEffect(() => {
    if (state.get() !== value) state.set(value);
  }, [state, value]);

  return (
    <Host matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <SwiftUITextField
        text={state}
        onTextChange={onChangeText}
        placeholder={placeholder}
        axis={multiline ? "vertical" : "horizontal"}
        modifiers={[
          textFieldStyle("plain"),
          iosKeyboardType(KEYBOARD_TYPE_TO_IOS[keyboardType]),
          padding({ horizontal: 12, vertical: 10 }),
          background(colors.surface),
          strokeBorder({ color: borderColor, shape: "roundedRectangle", cornerRadius: 10 }),
          iosDisabled(disabled),
        ]}
        testID={testID}
      />
    </Host>
  );
}
