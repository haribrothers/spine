"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { forwardRef, useCallback, useRef } from "react";
import { cn } from "../lib/cn";

export const ToastProvider = ToastPrimitive.Provider;

/**
 * Re-sends Escape from where it was pressed once the closing toast has left
 * the page (and with it the top layer), so the dialog or drawer underneath
 * hears it. Gives up after about a second if the toast never unmounts.
 */
function passEscapeOn(toast: Element, from: Element) {
  const win = toast.ownerDocument.defaultView;
  if (!win) return;
  let frames = 0;
  const step = () => {
    if (toast.isConnected) {
      if (++frames < 60) win.requestAnimationFrame(step);
      return;
    }
    // One more frame lets the layer underneath register its Escape listener.
    win.requestAnimationFrame(() => from.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  };
  win.requestAnimationFrame(step);
}

export const ToastViewport = forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-[var(--z-toast)] flex w-full max-w-sm flex-col gap-2 p-4 outline-none",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

/**
 * Dark chrome, auto-dismissing — confirms an action succeeded, per §F0.
 * Never carries a validation error (that's HelperText's job). Uses the
 * `inverse-*` tokens rather than `neutral-900`/hardcoded white: this chrome
 * is deliberately dark regardless of the app's light/dark theme, but
 * `neutral-900` itself is theme-*reactive* (it flips to near-white in dark
 * mode per docs/DESIGN.md's dark palette) — pairing it with hardcoded white
 * text used to collapse to ~1.1:1 contrast in dark mode (WCAG AA a11y pass,
 * 2026-08-06).
 *
 * Escape: Radix makes an open toast the topmost dismissable layer, so it
 * would swallow the first Escape even while the person is working in a
 * dialog or drawer underneath. When focus isn't on the toast, the toast
 * closes and the same Escape is passed on once it has gone, so the dialog
 * or drawer closes too — one press does what the person meant. With focus
 * on the toast, Escape closes only the toast.
 */
export const Toast = forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root>
>(({ className, onEscapeKeyDown, ...props }, ref) => {
  const localRef = useRef<HTMLLIElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLLIElement | null) => {
      localRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  return (
    <ToastPrimitive.Root
      ref={setRefs}
      className={cn(
        "flex items-center justify-between gap-3 rounded-md bg-inverse-surface px-3.5 py-2.5 text-inverse-on-surface shadow-toast transition-all duration-base data-[state=closed]:opacity-0 data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
        className,
      )}
      onEscapeKeyDown={(event) => {
        onEscapeKeyDown?.(event);
        if (event.defaultPrevented) return;
        const node = localRef.current;
        const target = event.target instanceof Element ? event.target : null;
        if (!node || (target && node.contains(target))) return;
        passEscapeOn(node, target ?? node.ownerDocument.body);
      }}
      {...props}
    />
  );
});
Toast.displayName = "Toast";

export const ToastTitle = forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn("text-[13px] font-medium", className)} {...props} />
));
ToastTitle.displayName = "ToastTitle";

export const ToastDescription = forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn("text-[12px] text-inverse-on-surface-muted", className)} {...props} />
));
ToastDescription.displayName = "ToastDescription";

export const ToastClose = forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    aria-label="Dismiss"
    className={cn(
      "shrink-0 rounded-sm text-inverse-on-surface-muted transition-colors hover:text-inverse-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-on-surface",
      className,
    )}
    {...props}
  >
    <X size={14} />
  </ToastPrimitive.Close>
));
ToastClose.displayName = "ToastClose";

export const ToastAction = ToastPrimitive.Action;
