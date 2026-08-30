import { forwardRef } from "react";
import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";

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
 */
export const buttonVariants = cva("flex-row items-center justify-center gap-2 rounded-md", {
  variants: {
    variant: {
      primary: "bg-primary active:bg-primary-hover",
      secondary: "border border-border-strong bg-transparent active:bg-surface-sunken",
      danger: "bg-overdue active:opacity-90",
      ghost: "bg-transparent active:bg-surface-sunken",
    },
    size: {
      default: "h-10 px-4",
      sm: "h-8 px-3",
      touch: "h-11 px-4",
      icon: "h-11 w-11",
    },
    disabled: {
      true: "border border-border bg-transparent opacity-100",
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
      secondary: "text-on-surface",
      danger: "text-white",
      ghost: "text-on-surface",
    },
    disabled: {
      true: "text-on-surface-muted",
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
    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        className={buttonVariants({ variant, size, disabled: isDisabled, className })}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size="small" color={variant === "secondary" || variant === "ghost" ? undefined : "#FFFFFF"} />
        ) : typeof children === "string" ? (
          <Text className={textVariants({ variant, disabled: isDisabled })}>{children}</Text>
        ) : (
          children
        )}
      </Pressable>
    );
  },
);

Button.displayName = "Button";
