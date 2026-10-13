"use client";

import { useEffect } from "react";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@spine/ui";
import { useSettingsSaved } from "../../lib/settings-dirty";

/**
 * Shared "Saved" confirmation for every Settings section page — Settings has
 * no wizard "advance to next step" to signal success, so each save needs its
 * own explicit confirmation instead.
 */
export function SavedToast({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  // US-SET-33: once saved, leaving the pane doesn't ask.
  const markSaved = useSettingsSaved();
  useEffect(() => {
    if (open) markSaved();
  }, [open, markSaved]);
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
