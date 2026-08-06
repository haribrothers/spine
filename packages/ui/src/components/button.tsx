"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "../lib/cn";

/**
 * Variants and sizing follow docs/DESIGN.md's Button spec: one primary
 * (filled) action per screen, disabled state uses the border color rather
 * than a dimmed fill so it stays unambiguous, and `touch` size meets the
 * 44px minimum target required for the mobile field-companion app.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-transparent disabled:text-on-surface-muted",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-hover",
        secondary:
          "border border-border-strong bg-transparent text-on-surface hover:bg-surface-sunken",
        danger: "bg-overdue text-white hover:opacity-90",
        ghost: "bg-transparent text-on-surface hover:bg-surface-sunken",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 px-3 text-[12px]",
        touch: "h-11 px-4",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
