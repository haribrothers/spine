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
      "h-11 w-full rounded-sm border bg-surface px-2.5 text-[14px] text-on-surface",
      error ? "border-overdue" : "border-border-strong",
      editable ? "" : "opacity-50",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
    {...props}
  />
));

TextField.displayName = "TextField";
