import { useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import EyeIcon from "lucide-react-native/icons/eye";
import EyeOff from "lucide-react-native/icons/eye-off";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import { useNativeColors } from "../theme/use-native-colors";
import { radius } from "../tokens";
import { FORM_ROW_HEIGHT } from "./form-row";
import Svg, { Path } from "react-native-svg";

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
  const colors = useNativeColors();
  // Material 3: the `outline` role at rest, primary while focused, the error colour on error.
  const borderColor = error ? colors.overdue : focused ? colors.primary : colors.outline;
  const labelTone = error ? "text-overdue dark:text-overdue-dark" : focused ? "text-primary dark:text-primary-dark" : "text-on-surface-muted dark:text-on-surface-muted-dark";
  // The thicker outline takes its extra pixel from the padding and the
  // label's inset (both measured inside the border), so nothing shifts.
  const border = focused || error ? 2 : 1;
  const inset = border - 1;
  return (
    <View testID={testID} className="gap-1 pt-2">
      <View
        className={multiline ? "min-h-[96px]" : "justify-center"}
        // 56 tall like Material's field (FORM_ROW_HEIGHT), with the tokens' input radius.
        style={{ borderWidth: border, borderColor, borderRadius: radius.sm, height: multiline ? undefined : FORM_ROW_HEIGHT, paddingHorizontal: PAD_X - inset, paddingVertical: multiline ? PAD_Y - inset : 0 }}
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

export interface OutlinedTextFieldProps extends Pick<TextInputProps, "keyboardType" | "autoCapitalize" | "autoComplete" | "autoCorrect" | "returnKeyType" | "onSubmitEditing" | "maxLength"> {
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
  /** A password: hidden, with Material's show/hide eye at the end. */
  secureTextEntry?: boolean;
  inputRef?: React.Ref<TextInput>;
  testID?: string;
}

export function OutlinedTextField({ label, value, onChangeText, placeholder, multiline = false, error = false, helperText, prefix, labelBackgroundClassName, secureTextEntry = false, inputRef, testID, ...input }: OutlinedTextFieldProps) {
  const t = useT();
  const colors = useNativeColors();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const Eye = revealed ? EyeOff : EyeIcon;
  return (
    <OutlinedFrame label={label} focused={focused} error={error} multiline={multiline} helperText={helperText} labelBackgroundClassName={labelBackgroundClassName}>
      <View className={cn("flex-row gap-2", multiline ? "flex-1 items-start" : "items-center")}>
        {prefix ? <Text className="text-[16px] text-on-surface-muted dark:text-on-surface-muted-dark">{prefix}</Text> : null}
        <TextInput
          ref={inputRef}
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
          secureTextEntry={secureTextEntry && !revealed}
          {...input}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setRevealed((shown) => !shown)} hitSlop={8} accessibilityRole="button" accessibilityLabel={revealed ? t("uiNative.outlinedTextField.hidePassword") : t("uiNative.outlinedTextField.showPassword")} className="h-11 w-11 items-center justify-center">
            <Eye size={22} color={colors.onSurfaceMuted} />
          </Pressable>
        ) : error && !multiline ? (
          // Material's trailing error icon; the message itself is under the outline.
          <CircleAlert size={22} color={colors.overdue} accessibilityElementsHidden importantForAccessibility="no" />
        ) : null}
      </View>
    </OutlinedFrame>
  );
}

/** Material's `arrow_drop_down`: the small filled ▾ at the end of an exposed dropdown. */
export function DropdownArrow({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M7 10l5 5 5-5z" fill={color} />
    </Svg>
  );
}
