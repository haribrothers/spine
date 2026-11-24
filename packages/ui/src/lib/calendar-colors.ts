import type { CalendarEventColor } from "./calendar-utils";

/**
 * Static per-color class lookup — not built via template-string
 * interpolation (`` `bg-category-${color}-bg` ``), since Tailwind's
 * content scanner can only pick up class names it can see as literal
 * text, not ones assembled at runtime (same pattern as layout.tsx's
 * paddingScale/gapScale).
 */
export const COLOR_CLASSES: Record<CalendarEventColor, { bg: string; fg: string; dot: string; border: string }> = {
  blue: { bg: "bg-category-blue-bg", fg: "text-category-blue", dot: "bg-category-blue", border: "border-category-blue" },
  green: { bg: "bg-category-green-bg", fg: "text-category-green", dot: "bg-category-green", border: "border-category-green" },
  amber: { bg: "bg-category-amber-bg", fg: "text-category-amber", dot: "bg-category-amber", border: "border-category-amber" },
  red: { bg: "bg-category-red-bg", fg: "text-category-red", dot: "bg-category-red", border: "border-category-red" },
  purple: { bg: "bg-category-purple-bg", fg: "text-category-purple", dot: "bg-category-purple", border: "border-category-purple" },
  teal: { bg: "bg-category-teal-bg", fg: "text-category-teal", dot: "bg-category-teal", border: "border-category-teal" },
  pink: { bg: "bg-category-pink-bg", fg: "text-category-pink", dot: "bg-category-pink", border: "border-category-pink" },
  slate: { bg: "bg-category-slate-bg", fg: "text-category-slate", dot: "bg-category-slate", border: "border-category-slate" },
};

export function colorClasses(color: CalendarEventColor) {
  return COLOR_CLASSES[color];
}

