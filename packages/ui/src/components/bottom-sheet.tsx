"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";
import { DialogOverlay } from "./dialog";

/** How far a downward drag on the grabber or header closes the sheet. */
const CLOSE_DISTANCE = 80;

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Names the sheet for screen readers and shows in its header. */
  title: string;
  /** Read after the title; not shown. */
  description?: string;
  /** "auto" rises to its content (up to the top bar); "full" takes the whole screen below a 12px gap. */
  height?: "auto" | "full";
  /** Pinned under the content: the sheet's buttons ("Clear all", "Show results"). */
  footer?: React.ReactNode;
  /** Replaces the Close button on the right of the header. */
  headerAction?: React.ReactNode;
  /** US-OPS-59: a button on the left of the header (Cancel); the title is then centred. */
  headerLeading?: React.ReactNode;
  /** US-MTG-18: content that has its own title and close (an event's quick view) — only the grabber shows; the title is still read. */
  hideHeader?: boolean;
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

/**
 * US-OPS-60 (D-283) — a sheet that rises from the bottom of a phone, on Radix Dialog: a
 * grabber, its title and Close, the content (which scrolls) and an optional footer. Focus
 * stays inside it; Escape, Close, the dimmed page or a downward swipe on the grabber or
 * header closes it. With reduced motion it appears without sliding. It's for screens under
 * 768px; wider screens keep their dialogs, menus and drawers.
 */
export function BottomSheet({ open, onOpenChange, title, description, height = "auto", footer, headerAction, headerLeading, hideHeader = false, children, className, "data-testid": testId }: BottomSheetProps) {
  const t = useT();
  const start = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);

  const dragHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      // A press on Close (or any control in the header) is a press, not the start of a swipe:
      // capturing the pointer here would take its click away.
      if ((e.target as HTMLElement).closest("button, a, input")) return;
      start.current = e.clientY;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current));
    },
    onPointerUp: () => {
      if (drag > CLOSE_DISTANCE) onOpenChange(false);
      start.current = null;
      setDrag(0);
    },
    onPointerCancel: () => {
      start.current = null;
      setDrag(0);
    },
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          data-testid={testId}
          data-bottom-sheet=""
          {...(height === "full" ? { "data-phone-fullscreen": "" } : {})}
          // Without a description, say so, so Radix doesn't look for one.
          {...(description ? {} : { "aria-describedby": undefined })}
          style={drag ? { transform: `translateY(${drag}px)` } : undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-[var(--z-modal)] flex max-h-[calc(100dvh-56px)] flex-col rounded-t-lg bg-surface shadow-overlay focus:outline-none motion-safe:animate-sheet-in dark:bg-neutral-100",
            height === "full" && "top-3 max-h-none",
            className,
          )}
        >
          <div {...dragHandlers} className="shrink-0 touch-none select-none">
            <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-border-strong" />
            {hideHeader ? (
              <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            ) : (
            <div className={cn("flex min-h-[52px] items-center gap-1 py-1 pr-1", headerLeading ? "pl-1" : "pl-4")}>
              {headerLeading ? <div className="flex w-[88px] shrink-0 justify-start">{headerLeading}</div> : null}
              <DialogPrimitive.Title className={cn("min-w-0 flex-1 truncate text-[17px] font-semibold text-on-surface", headerLeading && "text-center")}>{title}</DialogPrimitive.Title>
              {headerLeading && headerAction ? <div className="flex w-[88px] shrink-0 justify-end">{headerAction}</div> : null}
              {headerLeading && headerAction ? null : headerAction ?? (
                <DialogPrimitive.Close
                  aria-label={t("ui.bottomSheet.close")}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X size={20} aria-hidden />
                </DialogPrimitive.Close>
              )}
            </div>
            )}
          </div>
          {description ? <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description> : null}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
          {footer ? <div className="flex shrink-0 gap-2 border-t border-border px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
