import { useEffect, useRef, useState } from "react";
import { Animated, Platform, View, type TextInput, type TextInputProps } from "react-native";
import { TextField } from "./text-field";
import { NativeTextField, type NativeTextFieldProps } from "./native-text-field";
import { useNativeColors } from "../theme/use-native-colors";

export interface FloatingLabelFieldProps {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  error?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  keyboardType?: NativeTextFieldProps["keyboardType"];
  /** Forces the Android/`TextField` branch even on iOS — for a call site not (yet) ready to adopt `NativeTextField`. */
  forceTextField?: boolean;
  /**
   * Forwarded to the underlying `TextField`'s RN `TextInput` ref — needed
   * by a caller with its own keyboard-scroll-into-view mechanism keyed off
   * a real `TextInput` instance (see `job-edit-form.tsx`'s own doc comment
   * for the worked example). Has no effect on the `NativeTextField`
   * branch, which is a native-bridge view with no forwardable RN ref at
   * all — same documented limitation `job-edit-form.tsx` already carries
   * for its iOS Title pilot.
   */
  inputRef?: React.Ref<TextInput>;
  /** Forwarded in addition to this component's own internal focus tracking — for a caller that also needs to know when this field is focused (e.g. to update its own "currently focused input" ref). */
  onFocus?: () => void;
  onBlur?: () => void;
  testID?: string;
  /**
   * US-MOB-01 — hides what's typed (a password). `@expo/ui`'s native text
   * field has no secure mode, so a secure field always takes the RN
   * `TextField` branch, on iOS too.
   */
  secureTextEntry?: boolean;
  /** Passed to the RN `TextField` branch (Android, `forceTextField`, `secureTextEntry`): e.g. `"none"` for an email or a server address. */
  autoCapitalize?: TextInputProps["autoCapitalize"];
  /** Passed to the RN `TextField` branch so the OS can offer saved credentials (`"email"`, `"current-password"`, `"url"`). */
  autoComplete?: TextInputProps["autoComplete"];
  /** Passed to the RN `TextField` branch: the keyboard's return key (`"next"`, `"go"`, `"done"`). */
  returnKeyType?: TextInputProps["returnKeyType"];
  /** Passed to the RN `TextField` branch: fires when the return key is pressed. */
  onSubmitEditing?: () => void;
}

const RESTING_TOP = 18;
const FLOATING_TOP = 6;
/** Multiline (Notes) floats to a fixed top-anchored caption position, not the single-line `FLOATING_TOP` — see this component's own doc comment on why a textarea needs its own vertical rhythm, tuned independently from the single-line fields. */
const MULTILINE_FLOATING_TOP = 8;
const RESTING_FONT_SIZE = 14;
const FLOATING_FONT_SIZE = 11;

/**
 * The Material-style "floating label" treatment for a row text field, per
 * explicit design request: when the field is empty and unfocused, the label
 * sits centered in the row acting as a placeholder; on focus (or once a
 * value exists), the label animates up to a small caption above the value,
 * which then renders below it in the same row. This REPLACES `FormRow`'s
 * previous "label left, value right" layout for `TextField`/`NativeTextField`
 * rows specifically — the label is now part of THIS component's own
 * absolutely-positioned overlay, not a separate element `FormRow` renders
 * beside the input, since the animation and focus state are intrinsically
 * tied to the input itself.
 *
 * `SelectField`/`SelectListField` get the equivalent visual treatment via
 * their own `floatLabel` prop (see those components) — they have no
 * "focus" state (tapping opens a menu/sheet immediately rather than
 * entering an inline edit mode), so their floating condition is simply
 * "has a value" vs. "empty," with no animated focus transition.
 *
 * Required asterisk renders as part of the label text itself (`"Client *"`)
 * in both the resting/placeholder and floating states, per explicit
 * decision — not a separately-positioned element. Error state tints the
 * label (both states) red instead of recoloring a border, same reasoning
 * as `TextField`/`NativeTextField`'s existing `variant="row"` error
 * treatment (there's no border left in row mode to recolor).
 *
 * `NativeTextField` needed a real, added capability for this to work at
 * all: it previously exposed no focus/blur callback whatsoever, so this
 * component could not have known when to animate the label for the iOS
 * pilot field. Fixed by wiring `@expo/ui`'s real `onFocusChange` through
 * `NativeTextField`'s own `onFocus`/`onBlur` props (see that component's
 * doc comment) — a genuine capability gap, not a workaround.
 *
 * Neither field renders its own native/RN `placeholder` — this component's
 * animated label IS the placeholder; passing one to the underlying field
 * would visually double up once the label has floated up but the value
 * area is still empty (mid-focus, before the user has typed anything).
 *
 * The label is layered UNDER the input via z-order (rendered first, input
 * on top with a transparent background) rather than as a sibling overlay
 * on top of it, specifically so the native text cursor/selection handles
 * (real system UI on both `TextField`'s RN `TextInput` and
 * `NativeTextField`'s SwiftUI field) are never visually occluded by label
 * text — the two only visually overlap for one still frame at the very
 * start of the float-up animation, which reads as an intentional
 * transition rather than a stacking bug.
 *
 * **`TextField`'s `textAlignVertical` must be `"top"` unconditionally, not
 * only for `multiline` — a real, reported Android-only bug, confirmed on
 * a real emulator.** RN's `TextInput` on Android defaults an unset
 * `textAlignVertical` to `"center"`, vertically centering the value text
 * within the field's FULL height regardless of any `pt-*` top padding —
 * so on Android specifically, a single-line `TextField` (Title/Job value)
 * rendered its value vertically centered in the row, landing beside the
 * already-floated label on the same visual line instead of below it (iOS
 * has no such default-centering behavior for `NativeTextField`'s SwiftUI
 * field, so this never showed up there). The original code only set
 * `textAlignVertical="top"` when `multiline`, leaving the single-line
 * case at Android's default. Fixed by setting it unconditionally.
 *
 * **The outer wrapper `View` must NOT be `h-full` for `multiline` — a
 * real, reported "Notes field isn't working at all" bug, confirmed on a
 * real device (tapping it produced no focus ring, no keyboard, nothing).**
 * `h-full` resolves against the IMMEDIATE parent's own height — for every
 * single-line field this component renders, that parent is `FormRow`'s
 * fixed `ROW_HEIGHT`-tall slot, so `h-full` correctly fills it. Notes is
 * the one `multiline` consumer in this form, and its parent (`job-edit-
 * form.tsx`'s own wrapping `View`) has NO explicit height at all — so
 * `h-full` there resolved to a collapsed/near-zero height, shrinking this
 * wrapper's actual tappable hit-test area to almost nothing even though
 * the visual card behind it (drawn by `FormSection`, a sibling concern)
 * still looked like a normal-sized box. The underlying `TextField` itself
 * still rendered at its own explicit `h-24`, which is why the field
 * LOOKED fine in a screenshot — only interaction was broken. Fixed by
 * sizing the wrapper to content (`justify-center` only, no `h-full`) for
 * the `multiline` case specifically, letting `TextField`'s own height
 * define the real tappable area instead of an ambiguous percentage of an
 * unconstrained parent.
 */
export function FloatingLabelField({
  label,
  required = false,
  value,
  onChangeText,
  error = false,
  disabled = false,
  multiline = false,
  keyboardType = "default",
  forceTextField = false,
  inputRef,
  onFocus,
  onBlur,
  testID,
  secureTextEntry = false,
  autoCapitalize,
  autoComplete,
  returnKeyType,
  onSubmitEditing,
}: FloatingLabelFieldProps) {
  const colors = useNativeColors();
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = isFocused || value.length > 0;
  const animatedProgress = useRef(new Animated.Value(isFloating ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: isFloating ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [isFloating, animatedProgress]);

  const labelColor = error ? colors.overdue : colors.onSurfaceMuted;
  const labelText = required ? `${label} *` : label;

  const floatingTop = multiline ? MULTILINE_FLOATING_TOP : FLOATING_TOP;
  const animatedLabelStyle = {
    transform: [
      { translateY: animatedProgress.interpolate({ inputRange: [0, 1], outputRange: [RESTING_TOP, floatingTop] }) },
      { scale: animatedProgress.interpolate({ inputRange: [0, 1], outputRange: [1, FLOATING_FONT_SIZE / RESTING_FONT_SIZE] }) },
    ],
  };

  const useNativeField = Platform.OS === "ios" && !forceTextField && !secureTextEntry;

  return (
    <View className={multiline ? "w-full" : "h-full w-full justify-center"}>
      {/*
        NO `className` on this `Animated.Text` — a real, reproduced bug:
        NativeWind's `cssInterop` wraps every classed `Text`/`Animated.Text`
        in its own state-tracking component (`CssInterop.Text`), and
        combining that with an `Animated.Value`-driven `style` on the same
        node produced a live "Cannot update a component (CssInterop.Text)
        while rendering a different component (CssInterop.Text)" error,
        confirmed on a real device. All styling here (font size, position,
        transform-origin) is plain inline `style` instead, sidestepping
        NativeWind's runtime entirely for this one animated element — the
        static `TextField`/`NativeTextField`/label-caption text elsewhere
        in this file keep their normal classNames, since only the ANIMATED
        node triggered this.
      */}
      <Animated.Text
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: 0,
            top: 0,
            fontSize: RESTING_FONT_SIZE,
            color: labelColor,
            transformOrigin: "left top",
          },
          animatedLabelStyle,
        ]}
      >
        {labelText}
      </Animated.Text>

      {useNativeField ? (
        <NativeTextField
          value={value}
          onChangeText={onChangeText}
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          error={error}
          disabled={disabled}
          multiline={multiline}
          keyboardType={keyboardType}
          variant="row"
          floatingAbove
          testID={testID}
        />
      ) : (
        <TextField
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => {
            setIsFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          editable={!disabled}
          error={error}
          multiline={multiline}
          keyboardType={
            keyboardType === "decimal"
              ? "decimal-pad"
              : keyboardType === "numeric"
                ? "numeric"
                : keyboardType === "email"
                  ? "email-address"
                  : keyboardType === "phone"
                    ? "phone-pad"
                    : "default"
          }
          variant="row"
          accessibilityLabel={label}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCapitalize === "none" ? false : undefined}
          autoComplete={autoComplete}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          testID={testID}
          textAlignVertical="top"
          className={multiline ? "h-24 pt-7 pb-2" : "h-14 pt-7 pb-1"}
          style={{ includeFontPadding: false }}
        />
      )}
    </View>
  );
}
