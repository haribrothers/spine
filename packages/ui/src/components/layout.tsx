import { forwardRef } from "react";
import { cn } from "../lib/cn";

/**
 * Spacing-scale keys mapped to literal, fully-static Tailwind class names —
 * not built via template-string interpolation (`` `p-${n}` ``), since
 * Tailwind's content scanner can only pick up class names it can see as
 * literal text, not ones assembled at runtime.
 */
const paddingScale = {
  none: "",
  xs: "p-1",
  sm: "p-2",
  md: "p-3",
  lg: "p-5",
  xl: "p-8",
  "2xl": "p-12",
} as const;

const gapScale = {
  none: "",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-5",
  xl: "gap-8",
  "2xl": "gap-12",
} as const;

type SpacingKey = keyof typeof paddingScale;

/** The base primitive — a plain element with a `p` (padding) shorthand mapped to the spacing scale. Everything else here composes it. */
export interface BoxProps extends React.HTMLAttributes<HTMLDivElement> {
  p?: SpacingKey;
}

export const Box = forwardRef<HTMLDivElement, BoxProps>(({ p, className, ...props }, ref) => (
  <div ref={ref} className={cn(p && paddingScale[p], className)} {...props} />
));
Box.displayName = "Box";

/** Flexbox layout — direction/align/justify/wrap/gap props, gap mapped to the spacing scale. */
export interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "column";
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  justify?: "start" | "center" | "end" | "between" | "around";
  wrap?: boolean;
  gap?: SpacingKey;
}

const alignMap = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
} as const;

const justifyMap = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
} as const;

export const Flex = forwardRef<HTMLDivElement, FlexProps>(
  ({ direction = "row", align, justify, wrap = false, gap, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex",
        direction === "column" && "flex-col",
        align && alignMap[align],
        justify && justifyMap[justify],
        wrap && "flex-wrap",
        gap && gapScale[gap],
        className,
      )}
      {...props}
    />
  ),
);
Flex.displayName = "Flex";

/** CSS grid with a fixed columns count (1–6); pair with Tailwind's responsive prefixes via className for responsive column counts. */
export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: SpacingKey;
}

const columnsMap = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
} as const;

export const Grid = forwardRef<HTMLDivElement, GridProps>(({ columns = 1, gap, className, ...props }, ref) => (
  <div ref={ref} className={cn("grid", columnsMap[columns], gap && gapScale[gap], className)} {...props} />
));
Grid.displayName = "Grid";

/** Centers content and caps it at the container-max token (1200px), with the standard margin-desktop/margin-mobile horizontal padding. */
export const Container = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("mx-auto max-w-[1200px] px-4 sm:px-8", className)} {...props} />
  ),
);
Container.displayName = "Container";

/** A vertical page section — generous top/bottom padding at one of four sizes; pair with Container for horizontal constraint. */
export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  size?: "sm" | "md" | "lg" | "xl";
}

const sectionSizeMap = { sm: "py-8", md: "py-12", lg: "py-16", xl: "py-24" } as const;

export const Section = forwardRef<HTMLElement, SectionProps>(({ size = "md", className, ...props }, ref) => (
  <section ref={ref} className={cn(sectionSizeMap[size], className)} {...props} />
));
Section.displayName = "Section";
