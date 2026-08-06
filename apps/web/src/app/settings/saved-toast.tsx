"use client";

import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@spine/ui";

/**
 * Shared "Saved" confirmation for every Settings section page — Settings has
 * no wizard "advance to next step" to signal success, so each save needs its
 * own explicit confirmation instead.
 */
export function SavedToast({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <ToastProvider swipeDirection="right" duration={2500}>
      <Toast open={open} onOpenChange={onOpenChange}>
        <div>
          <ToastTitle>Saved</ToastTitle>
          <ToastDescription>Your changes have been saved.</ToastDescription>
        </div>
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}
