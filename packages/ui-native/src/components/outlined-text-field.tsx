import { useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";
import { cn } from "../lib/cn";
import { useNativeColors } from "../theme/use-native-colors";

/**
 * Material 3's outlined field, the Android form look in the field app's
 * designs (`MobPhotoReviewAndroid`, `MobExpenseNewAndroid`): a rounded
 * outline with its label sitting in a notch on the top edge, primary and
 * thicker while focused, the overdue colour on error. iOS forms keep
 * `FormSection`/`FormRow`; screens pick per platform.
 *
 * The notch is the label's own background, so it must match what's behind
 * the field: `labelBackgroundClassName` (the page background by default; a
 * field on a card passes the surface classes).
 */
export interface OutlinedFrameProps {
  label: string;
  focused?: boolean;
  error?: boolean;
  multiline?: boolean;
  labelBackgroundClassName?: string;
  /** Shown under the outline: the error message or a hint. */
  helperText?: string;
  testID?: string;
  children: React.ReactNode;
}

/** Field padding (`px-4`/`py-3`) and label inset (`left-3`, `-top-2.5`). */
const PAD_X = 16;
const PAD_Y = 12;
const LABEL_LEFT = 12;
const LABEL_TOP = -10;

export function OutlinedFrame({ label, focused = false, error = false, multiline = false, labelBackgroundClassName = "bg-background dark:bg-background-dark", helperText, testID, children }: OutlinedFrameProps) {
  const tone = error ? "border-overdue dark:border-overdue-dark" : focused ? "border-primary dark:border-primary-dark" : "border-border-strong dark:border-border-strong-dark";
  const labelTone = error ? "text-overdue dark:text-overdue-dark" : focused ? "text-primary dark:text-primary-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark";
  // The thicker outline takes its extra pixel from the padding and the
  // label's inset (both measured inside the border), so nothing shifts.
  const border = focused || error ? 2 : 1;
  const inset = border - 1;
  return (
    <View testID={testID} className="gap-1 pt-2">
      <View
        className={cn("rounded-lg", multiline ? "min-h-[96px]" : "h-14 justify-center", tone)}
        style={{ borderWidth: border, paddingHorizontal: PAD_X - inset, paddingVertical: multiline ? PAD_Y - inset : 0 }}
      >
        {children}
        <View pointerEvents="none" className={cn("absolute px-1", labelBackgroundClassName)} style={{ left: LABEL_LEFT - inset, top: LABEL_TOP - inset }}>
          <Text className={cn("text-[12px]", labelTone)}>{label}</Text>
        </View>
      </View>
      {helperText ? <Text className={cn("px-4 text-[12px]", error ? "text-overdue dark:text-overdue-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark")}>{helperText}</Text> : null}
    </View>
  );
}

export interface OutlinedTextFieldProps extends Pick<TextInputProps, "keyboardType" | "autoCapitalize" | "autoComplete" | "returnKeyType" | "onSubmitEditing" | "maxLength"> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  error?: boolean;
  helperText?: string;
  /** Text before the value, e.g. "$" on an amount. */
  prefix?: string;
  labelBackgroundClassName?: string;
  testID?: string;
}

export function OutlinedTextField({ label, value, onChangeText, placeholder, multiline = false, error = false, helperText, prefix, labelBackgroundClassName, testID, ...input }: OutlinedTextFieldProps) {
  const colors = useNativeColors();
  const [focused, setFocused] = useState(false);
  return (
    <OutlinedFrame label={label} focused={focused} error={error} multiline={multiline} helperText={helperText} labelBackgroundClassName={labelBackgroundClassName}>
      <View className={cn("flex-row gap-1", multiline ? "flex-1 items-start" : "items-center")}>
        {prefix ? <Text className="text-[16px] text-on-surface-muted dark:text-on-surface-muted-dark">{prefix}</Text> : null}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceMuted}
          multiline={multiline}
          accessibilityLabel={label}
          accessibilityHint={error && helperText ? helperText : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn("flex-1 px-0 py-0 text-[16px] text-on-surface dark:text-on-surface-dark", multiline ? "min-h-[68px]" : "")}
          style={multiline ? { textAlignVertical: "top" } : undefined}
          {...input}
        />
      </View>
    </OutlinedFrame>
  );
}
