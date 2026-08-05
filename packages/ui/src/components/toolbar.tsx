"use client";

import * as ToolbarPrimitive from "@radix-ui/react-toolbar";
import { forwardRef } from "react";
import { cn } from "../lib/cn";

export const Toolbar = forwardRef<
  React.ElementRef<typeof ToolbarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.Root
    ref={ref}
    className={cn("flex items-center gap-1 rounded-md border border-border bg-surface p-1", className)}
    {...props}
  />
));
Toolbar.displayName = "Toolbar";

export const ToolbarButton = forwardRef<
  React.ElementRef<typeof ToolbarPrimitive.Button>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.Button
    ref={ref}
    className={cn(
      "flex h-8 items-center justify-center rounded-sm px-2 text-[13px] font-medium text-on-surface transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      className,
    )}
    {...props}
  />
));
ToolbarButton.displayName = "ToolbarButton";

export const ToolbarSeparator = forwardRef<
  React.ElementRef<typeof ToolbarPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.Separator ref={ref} className={cn("mx-1 h-5 w-px bg-border", className)} {...props} />
));
ToolbarSeparator.displayName = "ToolbarSeparator";

export const ToolbarLink = ToolbarPrimitive.Link;
export const ToolbarToggleGroup = ToolbarPrimitive.ToggleGroup;
export const ToolbarToggleItem = forwardRef<
  React.ElementRef<typeof ToolbarPrimitive.ToggleItem>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.ToggleItem>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.ToggleItem
    ref={ref}
    className={cn(
      "flex h-8 items-center justify-center rounded-sm px-2 text-[13px] font-medium text-on-surface-muted transition-colors hover:bg-surface-sunken data-[state=on]:bg-surface-sunken data-[state=on]:text-primary",
      className,
    )}
    {...props}
  />
));
ToolbarToggleItem.displayName = "ToolbarToggleItem";
