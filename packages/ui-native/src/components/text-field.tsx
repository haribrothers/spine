import { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { cn } from "../lib/cn";
import { useNativeColors } from "../theme/use-native-colors";

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
 *
 * **`variant="row"` (form redesign, added alongside `Divider`)**: drops the
 * field's own border/background/radius entirely — no chrome of its own —
 * for use inside a grouped form card whose shared surface + `Divider`
 * rows provide the boundary instead (see `job-edit-form.tsx`'s "Details"/
 * "Schedule"/etc. sections). `variant="bordered"` (the default, unchanged)
 * keeps the original standalone bordered-box look for every other existing
 * consumer (login screen, search, design-system-native docs) — this is an
 * additive prop, not a global restyle, specifically so those screens don't
 * need to be touched. Error state in `"row"` mode has no border to
 * recolor — the row's label/helper text (rendered by the caller, e.g.
 * `FieldLabel`/`FieldError` in `job-edit-form.tsx`) carries the rest of
 * the error affordance.
 *
 * **`className` merging now goes through `cn` (twMerge), not a plain array
 * `.join(" ")` — a real, reported bug this fixed.** `FloatingLabelField`
 * needs to override this component's own row-mode `h-11` (a fixed 44px)
 * with a taller height to fit a floated label above the value, by passing
 * its own `className="h-14 ..."`. With a plain `.join(" ")`, the final
 * className string contained BOTH `h-11` and `h-14` side by side — with no
 * dedup, NativeWind resolved the conflict by its own internal CSS rule
 * generation order (not source/string order), which kept `h-11` in effect
 * regardless of what `FloatingLabelField` passed — confirmed live on a
 * real Android device: `pt-*`/`h-*` overrides from 6 up through 100 (an
 * intentionally extreme test value) either produced literally
 * pixel-identical text position or outright clipping, never the
 * proportional shift a real height/padding override should have produced.
 * `cn` (the same helper `SelectField`/`SelectListField`/`Button` already
 * use for exactly this reason, per this package's own established
 * pattern) resolves same-property conflicts deterministically in favor of
 * whichever class appears LAST — i.e. the caller's override — fixing this
 * for any future consumer that needs to override `TextField`'s row-mode
 * sizing, not just `FloatingLabelField`.
 */
export interface TextFieldProps extends TextInputProps {
  error?: boolean;
  variant?: "bordered" | "row";
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ className, error = false, editable = true, variant = "bordered", ...props }, ref) => {
    // US-OPS-25: a native prop, so it can't take a dark: class — resolved per mode instead.
    const colors = useNativeColors();
    return (
      <TextInput
        ref={ref}
        editable={editable}
        accessibilityState={{ disabled: !editable }}
        placeholderTextColor={colors.onSurfaceMuted}
        className={cn(
          "w-full text-[14px] text-on-surface dark:text-on-surface-dark",
          variant === "row"
            ? cn("h-11 px-0", error ? "text-overdue dark:text-overdue-dark" : "")
            : cn(
                "h-11 rounded-lg border bg-surface px-2.5 dark:bg-surface-dark",
                error ? "border-overdue dark:border-overdue-dark" : "border-border-strong dark:border-border-strong-dark",
              ),
          editable ? "" : "opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

TextField.displayName = "TextField";
