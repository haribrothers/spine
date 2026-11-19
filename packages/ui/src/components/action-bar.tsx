"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import { usePhone } from "../lib/use-phone";

/** Where the shell puts a record's action bar on a phone: just above the tab bar. */
const SLOT = "[data-action-bar-slot]";

/**
 * US-OPS-58 (D-283) — the shell's place for a record's `ActionBar` on a phone, between the
 * scrolling page and the tab bar, so the bar never covers the page's last lines. Empty, it
 * takes no room. It steps aside with the tab bar while a full-screen dialog is open or the
 * keyboard is up.
 */
export function ActionBarSlot({ className }: { className?: string }) {
  return <div data-action-bar-slot="" className={cn("shrink-0 empty:hidden md:hidden", className)} />;
}

export interface ActionBarProps {
  /** The record's main action for its state (Send reminder, Issue invoice, Record payment): one `Button`. */
  children: React.ReactNode;
  className?: string;
}

/**
 * US-OPS-58 (D-283) — a record's main action. From 768px up it's the button as it was, where
 * it was. Under 768px it's a full-width button in a bar at the bottom of the screen, above the
 * tab bar (in the shell's `ActionBarSlot`); the record's other actions go under the top bar's ⋯.
 */
export function ActionBar({ children, className }: ActionBarProps) {
  const phone = usePhone();
  const [slot, setSlot] = useState<Element | null>(null);

  useEffect(() => {
    setSlot(phone ? document.querySelector(SLOT) : null);
  }, [phone]);

  if (!phone) return <>{children}</>;
  const bar = (
    <div
      data-action-bar=""
      className={cn(
        "border-t border-border bg-surface px-4 py-2.5",
        // The one button, the full width and 48px tall.
        "[&>*]:h-12 [&>*]:w-full [&>*]:text-[15px]",
        // Without the shell (a doc page), it sits at the bottom of the screen.
        !slot && "fixed inset-x-0 bottom-0 z-[var(--z-sticky-header)] pb-[max(10px,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </div>
  );
  return slot ? createPortal(bar, slot) : bar;
}
