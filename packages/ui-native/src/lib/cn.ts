import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Ports `packages/ui`'s `cn` helper. Needed here because NativeWind has no
 * `:disabled`-pseudo-class equivalent for `Pressable` (unlike web Tailwind,
 * which `packages/ui`'s Button leans on for its disabled overrides) —
 * without `twMerge` deduping, two same-specificity conflicting utility
 * classes for the same CSS property (e.g. a variant's `bg-primary` vs. a
 * disabled override's `bg-transparent`) resolve by Tailwind's CSS-discovery
 * order at build time, not by which class appears later in the className
 * string, which is fragile and was the root cause of a real disabled-text
 * visibility bug in Button (see button.tsx's own comment).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
