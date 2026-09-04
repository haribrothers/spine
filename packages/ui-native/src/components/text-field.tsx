import { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";

/**
 * Ports `packages/ui`'s Input to RN's `TextInput` — see button.tsx's own
 * doc comment on the NativeWind-className-not-StyleSheet approach this
 * package takes throughout.
 *
 * Phase 4 visual-consistency pass: corner radius bumped from `rounded-sm`
 * (6px) to `rounded-lg` (12px), matching `Card`'s own radius — confirmed
 * via a real on-device mixed screen (a `Card` containing this `TextField`
 * next to native `@expo/ui` pill-shaped `Button`/`Switch` controls) that
 * the old 6px radius read as visibly, unintentionally squarer than every
 * other rounded surface on screen (Card at 12px, Badge/StatusChip/Button
 * fully pill-shaped). No prop/behavior change, purely the token swap.
 */
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
      "h-11 w-full rounded-lg border bg-surface dark:bg-surface-dark px-2.5 text-[14px] text-on-surface dark:text-on-surface-dark",
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
