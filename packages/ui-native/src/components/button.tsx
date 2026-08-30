import { forwardRef } from "react";
import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { useColorScheme } from "nativewind";
import { cn } from "../lib/cn";
import { lightColors, darkColors } from "../tokens";

/**
 * Ports `packages/ui`'s Button (variants/sizing) to RN primitives —
 * `Pressable`/`Text`, styled via NativeWind `className` (not `StyleSheet`,
 * consistent with this package's NativeWind-first approach). `touch` size
 * (44px min height) mirrors the web component's own comment: this is the
 * PRIMARY size for a field-companion app, not an opt-in variant — every
 * mobile screen should default to it, unlike web where `default` is more
 * common.
 *
 * No `asChild`/`Slot` equivalent — RN has no `Slot` primitive the way
 * Radix does; a future icon-button/link-button need is solved with its
 * own dedicated variant, not composition, if/when one arises.
 *
 * The final className is run through `cn` (clsx + tailwind-merge), not just
 * `cva`'s own plain string concatenation — `packages/ui`'s Button resolves
 * its disabled look via Tailwind's `disabled:` pseudo-class (a real
 * specificity bump that reliably overrides the variant classes), but
 * NativeWind has no such pseudo-class for `Pressable`, so `disabled`'s
 * override classes here are ordinary same-specificity utilities (e.g.
 * `bg-transparent`) competing with the variant's own (e.g. `bg-primary`).
 * Without `tailwind-merge` deduping, which one wins is decided by
 * Tailwind's CSS-discovery order at build time, NOT by class-string order —
 * this silently broke disabled-text visibility on web (`<Button disabled>`
 * with the default `primary` variant rendered white text on a transparent
 * background). `cn` makes the later class in the list win deterministically,
 * matching what the string order already visually implies.
 */
export const buttonVariants = cva("flex-row items-center justify-center gap-2 rounded-md", {
  variants: {
    variant: {
      primary: "bg-primary dark:bg-primary-dark active:bg-primary-hover active:dark:bg-primary-hover-dark",
      secondary:
        "border border-border-strong dark:border-border-strong-dark bg-transparent active:bg-surface-sunken active:dark:bg-surface-sunken-dark",
      danger: "bg-overdue dark:bg-overdue-dark active:opacity-90",
      ghost: "bg-transparent active:bg-surface-sunken active:dark:bg-surface-sunken-dark",
    },
    size: {
      default: "h-10 px-4",
      sm: "h-8 px-3",
      touch: "h-11 px-4",
      icon: "h-11 w-11",
    },
    disabled: {
      true: "border border-border dark:border-border-dark bg-transparent opacity-100",
      false: "",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "touch",
    disabled: false,
  },
});

const textVariants = cva("font-semibold text-[13px]", {
  variants: {
    variant: {
      primary: "text-white",
      secondary: "text-on-surface dark:text-on-surface-dark",
      danger: "text-white",
      ghost: "text-on-surface dark:text-on-surface-dark",
    },
    disabled: {
      true: "text-on-surface-muted dark:text-on-surface-muted-dark",
      false: "",
    },
  },
  defaultVariants: {
    variant: "primary",
    disabled: false,
  },
});

export interface ButtonProps extends Omit<PressableProps, "disabled" | "children">, VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
}

export const Button = forwardRef<React.ComponentRef<typeof Pressable>, ButtonProps>(
  ({ className, variant, size, disabled = false, loading = false, children, ...props }, ref) => {
    const isDisabled = disabled || loading;
    const { colorScheme } = useColorScheme();

    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        className={cn(buttonVariants({ variant, size, disabled: isDisabled }), className)}
        {...props}
      >
        {loading ? (
          // `loading` sets `isDisabled`, so the button's background is
          // always the disabled look (bg-transparent, see buttonVariants'
          // own doc comment) regardless of variant — the spinner must use
          // the same on-surface-muted color the disabled label text uses,
          // not a variant-specific color like the old hardcoded white,
          // which was invisible against the (now-transparent) button.
          <ActivityIndicator size="small" color={colorScheme === "dark" ? darkColors.onSurfaceMuted : lightColors.onSurfaceMuted} />
        ) : typeof children === "string" ? (
          <Text className={cn(textVariants({ variant, disabled: isDisabled }))}>{children}</Text>
        ) : (
          children
        )}
      </Pressable>
    );
  },
);

Button.displayName = "Button";
