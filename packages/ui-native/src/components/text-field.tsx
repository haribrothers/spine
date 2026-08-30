import { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";

/** Ports `packages/ui`'s Input to RN's `TextInput` — see button.tsx's own doc comment on the NativeWind-className-not-StyleSheet approach this package takes throughout. */
export interface TextFieldProps extends TextInputProps {
  error?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(({ className, error = false, editable = true, ...props }, ref) => (
  <TextInput
    ref={ref}
    editable={editable}
    accessibilityState={{ disabled: !editable }}
    placeholderTextColor="#726C5A"
    className={[
      "h-11 w-full rounded-sm border bg-surface dark:bg-surface-dark px-2.5 text-[14px] text-on-surface dark:text-on-surface-dark",
      error ? "border-overdue dark:border-overdue-dark" : "border-border-strong dark:border-border-strong-dark",
      editable ? "" : "opacity-50",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
    {...props}
  />
));

TextField.displayName = "TextField";
