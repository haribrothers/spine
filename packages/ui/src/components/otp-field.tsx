"use client";

import * as OTPFieldPrimitive from "@radix-ui/react-one-time-password-field";
import { forwardRef } from "react";
import { cn } from "../lib/cn";

/**
 * A boxed single-digit-input field for one-time passcodes. Not currently
 * used anywhere in Spine's auth flow (email+password + org invite per
 * §5/§10.3, no OTP step) — included in the catalogue for completeness.
 */
export const OTPField = OTPFieldPrimitive.Root;

export const OTPFieldInput = forwardRef<
  React.ElementRef<typeof OTPFieldPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof OTPFieldPrimitive.Input>
>(({ className, ...props }, ref) => (
  <OTPFieldPrimitive.Input
    ref={ref}
    className={cn(
      "h-12 w-10 rounded-sm border border-border-strong bg-surface text-center font-mono text-[18px] text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
      className,
    )}
    {...props}
  />
));
OTPFieldInput.displayName = "OTPFieldInput";

export const OTPFieldHiddenInput = OTPFieldPrimitive.HiddenInput;
