"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { DialogOverlay } from "./dialog";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

const DRAWER_SIDES = {
  right: "inset-y-0 right-0 border-l",
  left: "inset-y-0 left-0 border-r",
} as const;

/**
 * `"sm"`/`"md"`/`"lg"` follow the same naming convention as `DialogContent`'s
 * `size` prop (see dialog.tsx) so the two stay consistent. `"md"` is the
 * default and matches the drawer's original fixed `max-w-md` width, so
 * omitting `size` doesn't regress any existing usage.
 */
const DRAWER_SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
} as const;

/**
 * Same underlying Dialog primitive as Modal — full-height, anchored to an
 * edge instead of centered, per §F0. No padding here: `DrawerHeader` and
 * `DrawerFooter` own their own padding and stay fixed (shrink-0); the
 * scrollable middle region (see `DrawerBody`) owns its own padding too, so
 * only that middle region scrolls when content is tall.
 */
const drawerVariants = cva(
  "fixed z-modal flex h-full w-full flex-col border-border bg-surface shadow-[0_10px_30px_rgba(33,31,26,0.14)] focus:outline-none",
  {
    variants: {
      side: DRAWER_SIDES,
      size: DRAWER_SIZES,
    },
    defaultVariants: {
      side: "right",
      size: "md",
    },
  },
);

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof drawerVariants> {}

export const DrawerContent = forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DrawerContentProps>(
  ({ className, side, size, children, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content ref={ref} className={cn(drawerVariants({ side, size, className }))} {...props}>
        {children}
        <DialogPrimitive.Close
          aria-label="Close"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md text-on-surface-muted transition-colors hover:bg-surface-sunken hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X size={16} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
DrawerContent.displayName = "DrawerContent";

/** Fixed to the top, never scrolls. Owns its own padding. */
export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shrink-0 border-b border-border p-5 pr-11", className)} {...props} />;
}

/**
 * The only scrollable region of a Drawer. Sits between `DrawerHeader` and
 * `DrawerFooter` and fills the remaining height (`flex-1 overflow-y-auto`).
 * Owns its own padding so header/footer stay visually flush with the edges
 * while the body's content gets normal inset spacing.
 */
export function DrawerBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto p-5", className)} {...props} />;
}

export const DrawerTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-[16px] font-semibold text-on-surface", className)} {...props} />
));
DrawerTitle.displayName = "DrawerTitle";

export const DrawerDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-[13px] text-on-surface-muted", className)} {...props} />
));
DrawerDescription.displayName = "DrawerDescription";

/** Fixed to the bottom, never scrolls. Owns its own padding. */
export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-end gap-2 border-t border-border p-5", className)}
      {...props}
    />
  );
}
