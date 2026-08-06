"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "../lib/cn";

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-toast flex w-full max-w-sm flex-col gap-2 p-4 outline-none",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

/**
 * Dark chrome, auto-dismissing — confirms an action succeeded, per §F0.
 * Never carries a validation error (that's HelperText's job). Uses the
 * `inverse-*` tokens rather than `neutral-900`/hardcoded white: this chrome
 * is deliberately dark regardless of the app's light/dark theme, but
 * `neutral-900` itself is theme-*reactive* (it flips to near-white in dark
 * mode per docs/DESIGN.md's dark palette) — pairing it with hardcoded white
 * text used to collapse to ~1.1:1 contrast in dark mode (WCAG AA a11y pass,
 * 2026-08-06).
 */
export const Toast = forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(
      "flex items-center justify-between gap-3 rounded-md bg-inverse-surface px-3.5 py-2.5 text-inverse-on-surface shadow-[0_4px_14px_rgba(33,31,26,0.16)] transition-all duration-base data-[state=closed]:opacity-0 data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
      className,
    )}
    {...props}
  />
));
Toast.displayName = "Toast";

export const ToastTitle = forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn("text-[13px] font-medium", className)} {...props} />
));
ToastTitle.displayName = "ToastTitle";

export const ToastDescription = forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn("text-[12px] text-inverse-on-surface-muted", className)} {...props} />
));
ToastDescription.displayName = "ToastDescription";

export const ToastClose = forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    aria-label="Dismiss"
    className={cn(
      "shrink-0 rounded-sm text-inverse-on-surface-muted transition-colors hover:text-inverse-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-on-surface",
      className,
    )}
    {...props}
  >
    <X size={14} />
  </ToastPrimitive.Close>
));
ToastClose.displayName = "ToastClose";

export const ToastAction = ToastPrimitive.Action;
