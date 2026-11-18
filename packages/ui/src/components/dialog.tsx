"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { useT } from "../lib/i18n";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-[var(--z-overlay)] bg-scrim", className)}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

/**
 * Both sizes are height-BOUNDED (`max-h-[85vh]`/a fixed height), never
 * content-driven past that cap — this is what makes `DialogBody`'s scroll
 * containment actually do something: a dialog that could grow without
 * limit would never need its middle region to scroll, the footer would
 * just get pushed along with everything else. `"md"` still shrinks to fit
 * short content (no fixed height, just a ceiling); `"lg"` keeps its
 * original fixed `h-[min(720px,85vh)]` for tall multi-pane content like a
 * settings dialog. Neither has padding here anymore — `DialogHeader`/
 * `DialogBody`/`DialogFooter` each own their own, matching Drawer's exact
 * split (see drawer.tsx) — a dialog NOT using those three (e.g. Settings,
 * which builds its own internal two-pane layout) is unaffected and keeps
 * doing its own thing inside a plain `h-full` flex column.
 */
const DIALOG_SIZES = {
  md: "max-w-md max-h-[85vh]",
  lg: "max-w-4xl h-[min(720px,85vh)]",
  // US-SET-32 (D-236): roomy on large screens (up to 1152 × 960, 90% of the window, 24px margin), the whole screen on a phone.
  xl: "max-w-[min(1152px,calc(100vw-48px))] h-[min(960px,90vh)] max-md:h-dvh max-md:w-full max-md:max-w-none max-md:rounded-none max-md:border-0",
} as const;

export interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /**
   * `"md"` (default) is the standard centered task dialog (e.g. confirming
   * a void, or a form like Record Payment). `"lg"` is a large, tall panel
   * for multi-pane content like a settings dialog (roughly 2/3 viewport
   * width, near-full height). `"xl"` is the roomier version (Settings,
   * US-SET-32): up to 1152 × 960 px on large screens, full screen on phones.
   */
  size?: keyof typeof DIALOG_SIZES;
}

export const DialogContent = forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, size = "md", ...props }, ref) => {
    const t = useT();
    return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // US-OPS-15: under 768px a 16px gutter each side (xl is the whole screen there, D-236).
          "fixed left-1/2 top-1/2 z-[var(--z-modal)] flex w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-surface shadow-overlay focus:outline-none md:w-full",
          DIALOG_SIZES[size],
          className,
        )}
        // US-OPS-54: xl fills a phone's screen, so the tab bar steps aside while it's open.
        {...(size === "xl" ? { "data-phone-fullscreen": "" } : {})}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={t("ui.dialog.close")}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X size={16} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
    );
  },
);
DialogContent.displayName = "DialogContent";

/** Fixed to the top, never scrolls. Owns its own padding — matches DrawerHeader exactly, including the bottom border separating it from DialogBody. */
export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex shrink-0 flex-col gap-1 border-b border-border p-5 pr-11", className)} {...props} />;
}

/**
 * The only scrollable region of a Dialog that uses the header/body/footer
 * split — sits between `DialogHeader` and `DialogFooter` and fills the
 * remaining height (`flex-1 overflow-y-auto`), matching `DrawerBody`
 * exactly. Owns its own horizontal padding so header/footer stay flush
 * with the dialog's edges (with their own border) while the body's
 * content gets normal inset spacing. A dialog with no header/footer (a
 * bare confirmation) doesn't need this — only reach for it once content
 * can plausibly outgrow the dialog's own height cap.
 */
export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto p-5", className)} {...props} />;
}

export const DialogTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-[16px] font-semibold text-on-surface", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-[13px] text-on-surface-muted", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";

/** Fixed to the bottom, never scrolls. Owns its own padding — matches DrawerFooter exactly. */
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex shrink-0 items-center justify-end gap-2 border-t border-border p-5", className)} {...props} />
  );
}
