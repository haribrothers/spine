"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { usePhone } from "../lib/use-phone";

export interface FloatingActionButtonProps {
  /** The page's main action, as it is on the desktop: a `Button` (or `Button asChild` with a link) with its icon and label. */
  children: React.ReactNode;
  className?: string;
}

/**
 * US-OPS-57 (D-283) — the page's main action (New quote, Record payment, Add lead). From 768px
 * up it's the button as it was, where it was. Under 768px it floats above the tab bar, bottom
 * right, as a round-ended button with its label; while the page scrolls it shrinks to its icon
 * (the label stays for screen readers). It's marked `data-main-action` for the phone check
 * (US-OPS-62).
 */
export function FloatingActionButton({ children, className }: FloatingActionButtonProps) {
  const phone = usePhone();
  const ref = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (!phone) return;
    // The app's scrolling region is <main>; the window for pages outside the shell.
    const scroller: HTMLElement | Window = ref.current?.closest("main") ?? window;
    let timer: number | undefined;
    const onScroll = () => {
      setCompact(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCompact(false), 600);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [phone]);

  if (!phone) return <>{children}</>;
  return (
    <div
      ref={ref}
      data-main-action=""
      data-compact={compact || undefined}
      className={cn(
        "fixed right-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[var(--z-sticky-header)]",
        // The button itself: 52px tall, round-ended, raised; compact, just its icon.
        "[&>*]:h-[52px] [&>*]:rounded-full [&>*]:px-5 [&>*]:text-[15px] [&>*]:shadow-raised [&>*]:transition-[width,padding] [&_svg]:size-[22px]",
        "data-[compact]:[&>*]:w-[52px] data-[compact]:[&>*]:px-0 data-[compact]:[&>*]:text-[0px] data-[compact]:[&>*]:gap-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
