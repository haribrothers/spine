"use client";

import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { tooltipText, WithTooltip } from "./toggle";
import { TooltipProvider } from "./tooltip";

/**
 * US-OPS-36 (D-210) — one segmented control everywhere: the options sit in
 * a grey track and the chosen one is a raised chip with a primary outline
 * and a semibold, primary label (3:1 against the track for the outline,
 * 4.5:1 for the label, in light and dark). Screens don't restyle it.
 * The chosen state is read from aria-checked (single) / aria-pressed
 * (multiple), not data-state: a tooltip trigger sets its own data-state.
 */
const toggleGroupItemVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent text-[13px] font-medium text-on-surface-muted transition-colors hover:bg-control-selected/60 hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 aria-checked:border-primary aria-checked:bg-control-selected aria-checked:font-semibold aria-checked:text-primary aria-checked:shadow-sm aria-pressed:border-primary aria-pressed:bg-control-selected aria-pressed:font-semibold aria-pressed:text-primary aria-pressed:shadow-sm",
  {
    variants: {
      size: {
        default: "h-8 min-w-8 px-2.5",
        sm: "h-7 min-w-7 px-2",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

/** A row of options, one (or several) chosen — e.g. a list's view switcher or Accrual / Cash. */
export const ToggleGroup = forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  // One provider per group, so moving between options shows the next tooltip straight away.
  <TooltipProvider delayDuration={300}>
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn("inline-flex w-fit items-center gap-0.5 rounded-lg border border-border bg-neutral-100 p-0.5", className)}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  </TooltipProvider>
));
ToggleGroup.displayName = "ToggleGroup";

export interface ToggleGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>,
    VariantProps<typeof toggleGroupItemVariants> {
  /** Shown on hover and focus. An icon-only option uses its `aria-label` by default; `false` turns it off. */
  tooltip?: string | false;
}

export const ToggleGroupItem = forwardRef<React.ElementRef<typeof ToggleGroupPrimitive.Item>, ToggleGroupItemProps>(
  ({ className, size, tooltip, children, ...props }, ref) => (
    <WithTooltip text={tooltipText(tooltip, props["aria-label"], children)}>
      <ToggleGroupPrimitive.Item ref={ref} className={cn(toggleGroupItemVariants({ size, className }))} {...props}>
        {children}
      </ToggleGroupPrimitive.Item>
    </WithTooltip>
  ),
);
ToggleGroupItem.displayName = "ToggleGroupItem";
