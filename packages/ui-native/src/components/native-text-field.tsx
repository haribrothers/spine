import { useEffect } from "react";
import { Platform } from "react-native";
import { TextField as SwiftUITextField, Host as IOSHost, useNativeState as useNativeStateIOS } from "@expo/ui/swift-ui";
import { background, disabled as iosDisabled, keyboardType as iosKeyboardType, padding, strokeBorder, textFieldStyle } from "@expo/ui/swift-ui/modifiers";
import {
  OutlinedTextField,
  Host as AndroidHost,
  useNativeState as useNativeStateAndroid,
  type TextFieldColors,
} from "@expo/ui/jetpack-compose";
import { useNativeColors } from "../theme/use-native-colors";

/**
 * A genuinely native text field — SwiftUI's `TextField` on iOS, Material3's
 * `OutlinedTextField` (Compose) on Android — colored with this design
 * system's own tokens rather than each platform's default theme. Additive,
 * NOT a replacement for `TextField` (the existing NativeWind/`cva`-styled
 * `TextInput` wrapper): reach for `NativeTextField` specifically when a
 * screen wants the platform's own native field chrome (an underlined
 * borderless row inside a grouped `List`/`Form` on iOS, a Material outlined
 * field on Android) instead of `TextField`'s custom-drawn bordered box —
 * see the Edit-job-form pilot for the intended usage shape. `TextField`
 * itself is unchanged and remains the default field for every other
 * existing screen.
 *
 * **Why two component families exist side by side, not one migrated to
 * the other**: this mirrors the same "additive, not a replacement" posture
 * `apps/design-system-native`'s `native-tab-view.tsx`/`native-header.tsx`
 * pilot already established for other native-first experiments — adopting
 * real native field/list chrome is a deliberate, scoped design direction
 * being piloted on one screen (Edit job form) before any decision to
 * migrate the whole design system, unlike the EARLIER `@expo/ui` rework
 * wave (Button/Switch/Select/Slider/ContextMenu/DateTimePicker/BottomSheet)
 * which fully replaced their NativeWind predecessors outright. Do not
 * treat this component as implying `TextField` is deprecated.
 *
 * **Color is threaded through explicitly on both platforms — never left at
 * platform/theme defaults** (a deliberate, explicit requirement, not an
 * afterthought): iOS via SwiftUI modifiers (`background`, `strokeBorder`
 * with an explicit `cornerRadius`, `textFieldStyle('plain')` to strip the
 * system's own default field chrome so ours is the only visible styling);
 * Android via Compose Material3's own `TextFieldColors` map (a real,
 * first-class prop covering focused/unfocused/disabled/error container,
 * border/"indicator", text, and label colors independently — not a
 * workaround, this is `@expo/ui`'s documented, intended customization
 * surface for this exact control).
 *
 * **`value`/`onChangeText` are plain controlled-component props, but
 * `@expo/ui`'s underlying field is driven by an `ObservableState` (a real
 * native `SharedObject`, not a plain JS value) — NOT a `{get, set}`
 * plain-object shape.** This component creates that observable once via
 * `useNativeState("")` and keeps it in sync with the external `value` prop
 * through a `useEffect` (writing `.value` imperatively whenever the prop
 * changes elsewhere, e.g. a form reset) — reads flow the other direction
 * through `onTextChange`/`onValueChange` (the plain JS callback both
 * platforms also expose, not the observable's own worklet-only `onChange`,
 * which requires `react-native-worklets` and runs on the UI thread — not
 * needed here since this component has no synchronous-update requirement).
 *
 * **BOTH platforms need `Host` — a real, on-device runtime error, not just
 * a styling nicety.** Android's Compose `OutlinedTextField` throws at
 * runtime if it isn't a direct child of `<Host>` ("A Jetpack Compose view
 * ... must be rendered as a direct child of a <Host> component") —
 * confirmed live (this shipped without one initially and crashed
 * immediately on-device); this constraint isn't visible in
 * `OutlinedTextField`'s own prop types, only in its runtime behavior. Both
 * platforms' `Host` gets `matchContents={{ vertical: true }}` AND an
 * explicit `style={{ width: "100%" }}` — the same two-part fix
 * `DateTimePicker`'s own doc comment documents: `matchContents` alone only
 * ever bounds height, never width, so a `Host` with no explicit width
 * collapses to intrinsic content size inside a shrink-to-content parent.
 * Deliberately `{ vertical: true }`, NOT the bare `matchContents={true}`
 * shorthand (which sets BOTH axes) — `matchContentsHorizontal: true` on
 * Android's `Host` forces its own native width measurement to
 * `MeasureSpec.UNSPECIFIED` unconditionally (confirmed in `@expo/ui`'s
 * `HostView.kt`, the same root cause `SelectField`'s own doc comment
 * documents fixing for `MenuView`) — using only the vertical half avoids
 * ever exercising that bug here. Do not drop any of these three pieces
 * (both platforms' `Host`, the `{ vertical: true }` scoping, the explicit
 * width).
 *
 * **`testID` has no effect on Android** — `@expo/ui`'s Compose
 * `OutlinedTextField`/`CommonTextFieldProperties` exposes no `testID` prop
 * at all (confirmed against its real type), unlike its iOS `TextField`
 * sibling (via `CommonViewModifierProps`). `NativeTextField`'s own
 * `testID` prop is accepted on both platforms for a consistent call-site
 * API, but only reaches the native view on iOS.
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

const KEYBOARD_TYPE_TO_ANDROID: Record<NonNullable<NativeTextFieldProps["keyboardType"]>, "text" | "decimal" | "email" | "number" | "phone"> = {
  default: "text",
  decimal: "decimal",
  email: "email",
  numeric: "number",
  phone: "phone",
};

type ResolvedNativeTextFieldProps = Required<Omit<NativeTextFieldProps, "testID">> & Pick<NativeTextFieldProps, "testID">;

function AndroidNativeTextField({ value, onChangeText, placeholder, error, disabled, multiline, keyboardType }: ResolvedNativeTextFieldProps) {
  const colors = useNativeColors();
  const state = useNativeStateAndroid(value);

  useEffect(() => {
    if (state.get() !== value) state.set(value);
  }, [state, value]);

  const fieldColors: TextFieldColors = {
    focusedContainerColor: colors.surface,
    unfocusedContainerColor: colors.surface,
    disabledContainerColor: colors.surface,
    errorContainerColor: colors.surface,
    focusedTextColor: colors.onSurface,
    unfocusedTextColor: colors.onSurface,
    disabledTextColor: colors.onSurfaceMuted,
    errorTextColor: colors.onSurface,
    focusedIndicatorColor: colors.primary,
    unfocusedIndicatorColor: colors.borderStrong,
    disabledIndicatorColor: colors.border,
    errorIndicatorColor: colors.overdue,
    cursorColor: colors.primary,
    errorCursorColor: colors.overdue,
    unfocusedPlaceholderColor: colors.onSurfaceMuted,
    focusedPlaceholderColor: colors.onSurfaceMuted,
  };

  return (
    <AndroidHost matchContents={{ vertical: true }} style={{ width: "100%" }}>
      <OutlinedTextField
        value={state}
        onValueChange={onChangeText}
        enabled={!disabled}
        isError={error}
        singleLine={!multiline}
        minLines={multiline ? 3 : 1}
        keyboardOptions={{ keyboardType: KEYBOARD_TYPE_TO_ANDROID[keyboardType] }}
        colors={fieldColors}
      >
        {placeholder ? <OutlinedTextField.Placeholder>{placeholder}</OutlinedTextField.Placeholder> : null}
      </OutlinedTextField>
    </AndroidHost>
  );
}

function IOSNativeTextField({ value, onChangeText, placeholder, error, disabled, multiline, keyboardType, testID }: ResolvedNativeTextFieldProps) {
  const colors = useNativeColors();
  const borderColor = error ? colors.overdue : colors.borderStrong;
  const state = useNativeStateIOS(value);

  useEffect(() => {
    if (state.get() !== value) state.set(value);
  }, [state, value]);

  return (
    <IOSHost matchContents={{ vertical: true }} style={{ width: "100%" }}>
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
          strokeBorder({ color: borderColor, cornerRadius: 10 }),
          iosDisabled(disabled),
        ]}
        testID={testID}
      />
    </IOSHost>
  );
}

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
  const props = { value, onChangeText, placeholder, error, disabled, multiline, keyboardType, testID };
  return Platform.OS === "android" ? <AndroidNativeTextField {...props} /> : <IOSNativeTextField {...props} />;
}
