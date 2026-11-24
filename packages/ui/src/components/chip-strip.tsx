"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";

export interface ChipStripProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Names the row for screen readers: "Invoice totals". */
  label?: string;
}

/** What a keyboard can already reach inside the row. */
const FOCUSABLE = "a[href], button:not([disabled]), input, select, textarea, [tabindex]";
/** The ARIA role it takes while it scrolls with nothing inside to focus. */
const REGION = "region";

/**
 * US-OPS-57 (D-283) — a list's summary cards. From 768px up it lays them out as the page's
 * own className says (a grid). Under 768px they're compact chips — each card's label and
 * figure, its detail and hint left out — in one row that scrolls sideways, so the list itself
 * is on the first screen. A card that filters the list still does when tapped.
 * When the row scrolls and none of its cards can take focus (they're figures, not buttons),
 * it becomes a focusable, named region so a keyboard can scroll it (WCAG 2.1.1, US-OPS-62).
 */
export function ChipStrip({ label, className, children, ...props }: ChipStripProps) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [needsStop, setNeedsStop] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setNeedsStop(el.scrollWidth > el.clientWidth + 1 && !el.querySelector(FOCUSABLE));
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      role={needsStop ? REGION : label ? "group" : undefined}
      aria-label={needsStop ? (label ?? t("ui.chipStrip.label")) : label}
      tabIndex={needsStop ? 0 : undefined}
      data-chip-strip=""
      className={cn(
        className,
        "max-md:-mx-4 max-md:flex max-md:gap-2 max-md:overflow-x-auto max-md:px-4 max-md:pb-1 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden max-md:[&>*]:shrink-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
      )}
      {...props}
    >
      {children}
    </div>
  );
}
