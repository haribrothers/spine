"use client";

import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";
import { Children, forwardRef } from "react";
import { cn } from "../lib/cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

/**
 * Visually similar to Button but tracks on/off state rather than firing an
 * action — e.g. a rich-text formatting control. US-OPS-36 (D-210): on is a
 * light primary tint with a primary outline, so the state shows by more
 * than the icon's colour.
 */
export const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md border border-border-strong bg-surface text-[13px] font-medium text-on-surface transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-info-bg aria-pressed:text-primary",
  {
    variants: {
      size: {
        default: "h-10 px-3",
        sm: "h-8 px-2",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

/** The tooltip text: `tooltip` when given; for an item with no text of its own, its `aria-label`. */
export function tooltipText(tooltip: string | false | undefined, ariaLabel: string | undefined, children: React.ReactNode): string | null {
  if (tooltip === false) return null;
  if (tooltip) return tooltip;
  const hasText = Children.toArray(children).some((child) => typeof child === "string" || typeof child === "number");
  return !hasText && ariaLabel ? ariaLabel : null;
}

/** Wraps a control in the `@spine/ui` tooltip (shown on hover and keyboard focus). */
export function WithTooltip({ text, children }: { text: string | null; children: React.ReactElement }) {
  if (!text) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

export interface ToggleProps
  extends React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>,
    VariantProps<typeof toggleVariants> {
  /** Shown on hover and focus. An icon-only toggle uses its `aria-label` by default; `false` turns it off. */
  tooltip?: string | false;
}

export const Toggle = forwardRef<React.ElementRef<typeof TogglePrimitive.Root>, ToggleProps>(
  ({ className, size, tooltip, children, ...props }, ref) => {
    const text = tooltipText(tooltip, props["aria-label"], children);
    const toggle = (
      <TogglePrimitive.Root ref={ref} className={cn(toggleVariants({ size, className }))} {...props}>
        {children}
      </TogglePrimitive.Root>
    );
    return text ? (
      <TooltipProvider delayDuration={300}>
        <WithTooltip text={text}>{toggle}</WithTooltip>
      </TooltipProvider>
    ) : (
      toggle
    );
  },
);

Toggle.displayName = "Toggle";
