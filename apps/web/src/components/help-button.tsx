"use client";

import { HelpCircle } from "lucide-react";

/**
 * Placeholder help entry point in the sidebar footer, next to the
 * notification bell — no functionality wired up yet.
 */
export function HelpButton({ collapsed }: { collapsed: boolean }) {
  return (
    <button
      type="button"
      aria-label="Help"
      className={
        collapsed
          ? "flex h-9 w-9 items-center justify-center rounded-sm text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
          : "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface"
      }
    >
      <HelpCircle size={16} />
    </button>
  );
}
