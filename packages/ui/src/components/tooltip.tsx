"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { forwardRef } from "react";
import { cn } from "../lib/cn";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * Uses the `inverse-*` tokens rather than `neutral-900`/hardcoded white —
 * this chrome is deliberately dark regardless of theme, but `neutral-900`
 * is theme-*reactive* (flips to near-white in dark mode), so the old
 * `bg-neutral-900 text-white` pairing collapsed to ~1.1:1 contrast in dark
 * mode (WCAG AA a11y pass, 2026-08-06).
 */
export const TooltipContent = forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-tooltip rounded-sm bg-inverse-surface px-2 py-1 text-[12px] font-medium text-inverse-on-surface",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";
