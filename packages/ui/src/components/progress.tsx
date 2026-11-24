"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import { forwardRef } from "react";
import { cn } from "../lib/cn";

const TONES = {
  default: "bg-primary",
  /** Getting close to a limit, e.g. a job at 80% of its budget. */
  warning: "bg-due-soon",
  /** Past a limit, e.g. a job over budget. */
  danger: "bg-overdue",
  /** A neutral second measure beside a primary one, e.g. work complete beside billed. */
  neutral: "bg-on-surface-muted",
} as const;

export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** The fill colour. Never the only signal — pair a warning or danger tone with text and an icon. */
  tone?: keyof typeof TONES;
}

/** e.g. "72% of matrix requirements met" or job cost-vs-budget. Primary-filled track by default. */
export const Progress = forwardRef<React.ElementRef<typeof ProgressPrimitive.Root>, ProgressProps>(({ className, value, tone = "default", ...props }, ref) => (
  <ProgressPrimitive.Root ref={ref} className={cn("relative h-2 w-full overflow-hidden rounded-full bg-border", className)} {...props}>
    <ProgressPrimitive.Indicator
      className={cn("h-full w-full flex-1 rounded-full transition-transform duration-slow", TONES[tone])}
      style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value ?? 0))}%)` }}
    />
  </ProgressPrimitive.Root>
));

Progress.displayName = "Progress";
