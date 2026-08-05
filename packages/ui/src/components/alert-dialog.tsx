"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { forwardRef } from "react";
import { cn } from "../lib/cn";

export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogOverlay = forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-[1300] bg-black/30", className)}
    {...props}
  />
));
AlertDialogOverlay.displayName = "AlertDialogOverlay";

/**
 * A modal requiring explicit confirmation before a critical/destructive
 * action (e.g. voiding an invoice), per docs/DESIGN.md — unlike Dialog,
 * always renders an explicit Cancel action alongside the primary one.
 * Reach for this specifically when an action can't be undone.
 */
export const AlertDialogContent = forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Portal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[1300] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-[0_10px_30px_rgba(33,31,26,0.14)] focus:outline-none",
        className,
      )}
      {...props}
    />
  </AlertDialogPrimitive.Portal>
));
AlertDialogContent.displayName = "AlertDialogContent";

export function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex flex-col gap-1", className)} {...props} />;
}

export const AlertDialogTitle = forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn("text-[16px] font-semibold text-on-surface", className)} {...props} />
));
AlertDialogTitle.displayName = "AlertDialogTitle";

export const AlertDialogDescription = forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn("text-[13px] text-on-surface-muted", className)} {...props} />
));
AlertDialogDescription.displayName = "AlertDialogDescription";

export function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-5 flex items-center justify-end gap-2", className)} {...props} />;
}

export const AlertDialogCancel = forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md border border-border-strong bg-transparent px-4 text-[13px] font-semibold text-on-surface transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      className,
    )}
    {...props}
  />
));
AlertDialogCancel.displayName = "AlertDialogCancel";

export const AlertDialogAction = forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-overdue px-4 text-[13px] font-semibold text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      className,
    )}
    {...props}
  />
));
AlertDialogAction.displayName = "AlertDialogAction";
