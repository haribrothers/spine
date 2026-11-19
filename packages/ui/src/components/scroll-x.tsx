"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface ScrollXProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Names the box when it scrolls: "Lines, scrolls sideways". */
  label: string;
}

/**
 * A box whose content can be wider than the screen and scrolls sideways inside it (US-OPS-15).
 * It's `relative`, so an absolutely positioned child (an `sr-only` header label) is clipped with
 * the rest instead of widening the page (US-OPS-62). When it actually scrolls, usually only on
 * a phone, it becomes a focusable, named
 * region, so a keyboard can scroll it too (WCAG 2.1.1; axe `scrollable-region-focusable`,
 * US-OPS-62). When everything fits, it adds no tab stop.
 */
/** The ARIA role it takes while it scrolls. */
const REGION = "region";

export function ScrollX({ label, className, children, ...props }: ScrollXProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={scrolls ? 0 : undefined}
      role={scrolls ? REGION : undefined}
      aria-label={scrolls ? label : undefined}
      className={cn("relative overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary", className)}
      {...props}
    >
      {children}
    </div>
  );
}
