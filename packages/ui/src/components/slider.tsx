"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { forwardRef } from "react";
import { cn } from "../lib/cn";

/** Selects a value across a range — e.g. a discount percentage or retention percentage. Primary-filled track. */
export const Slider = forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, "aria-label": ariaLabel, "aria-labelledby": ariaLabelledBy, value, defaultValue, ...props }, ref) => {
  // Radix puts role="slider" on each Thumb, not the Root — an aria-label
  // passed to <Slider> needs to land there or the accessible name never
  // reaches the actual interactive element. One Thumb is rendered per
  // value entry so a multi-thumb range (e.g. a discount min/max) gets a
  // labeled thumb each.
  const thumbCount = (value ?? defaultValue ?? [0]).length;
  return (
    <SliderPrimitive.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-border">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }, (_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="block h-4 w-4 rounded-full border-2 border-primary bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
});

Slider.displayName = "Slider";
