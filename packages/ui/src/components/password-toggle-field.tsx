"use client";

import * as PasswordToggleFieldPrimitive from "@radix-ui/react-password-toggle-field";
import { Eye, EyeOff } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "../lib/cn";

export const PasswordToggleField = PasswordToggleFieldPrimitive.Root;

export const PasswordToggleFieldInput = forwardRef<
  React.ElementRef<typeof PasswordToggleFieldPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof PasswordToggleFieldPrimitive.Input>
>(({ className, ...props }, ref) => (
  <PasswordToggleFieldPrimitive.Input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-sm border border-border-strong bg-surface px-2.5 pr-10 text-[14px] text-on-surface placeholder:text-on-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
PasswordToggleFieldInput.displayName = "PasswordToggleFieldInput";

export const PasswordToggleFieldToggle = forwardRef<
  React.ElementRef<typeof PasswordToggleFieldPrimitive.Toggle>,
  React.ComponentPropsWithoutRef<typeof PasswordToggleFieldPrimitive.Toggle>
>(({ className, ...props }, ref) => (
  <PasswordToggleFieldPrimitive.Toggle
    ref={ref}
    className={cn(
      "absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-on-surface-muted transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      className,
    )}
    {...props}
  >
    <PasswordToggleFieldPrimitive.Icon
      visible={<Eye size={16} />}
      hidden={<EyeOff size={16} />}
    />
  </PasswordToggleFieldPrimitive.Toggle>
));
PasswordToggleFieldToggle.displayName = "PasswordToggleFieldToggle";
