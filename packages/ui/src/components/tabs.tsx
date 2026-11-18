"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { forwardRef } from "react";
import { cn } from "../lib/cn";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    // US-OPS-61: under 768px the row scrolls sideways rather than wrapping, so no label or count
    // lands on another. The underline becomes an inset shadow there, because a scrolling box
    // would clip the triggers' -1px overlap with a real border.
    className={cn(
      "flex items-center gap-4 border-b border-border max-md:overflow-x-auto max-md:overflow-y-hidden max-md:border-b-0 max-md:shadow-[inset_0_-1px_0_var(--color-border)] max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative -mb-px shrink-0 whitespace-nowrap rounded-t-sm border-b-2 border-transparent px-1 py-2.5 text-[13px] max-md:mb-0 max-md:inline-flex max-md:items-center max-md:gap-1.5 max-md:focus-visible:ring-inset font-medium text-on-surface-muted transition-colors hover:text-on-surface data-[state=active]:border-primary data-[state=active]:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("rounded-sm pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
