"use client";

import { useState } from "react";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@spine/ui";

/**
 * Generic create-confirmation toast for this module's five entities
 * (contact, contact person, address, lead, activity) — same composition
 * as apps/settings/saved-toast.tsx, but the title/description vary per
 * call site instead of always saying "Saved," so `useEntityToast` takes a
 * message per `show()` call rather than being a single fixed string.
 */
export function useEntityToast() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState({ title: "", description: "" });

  function show(title: string, description: string) {
    setMessage({ title, description });
    setOpen(false);
    // Re-open on next tick so a rapid second toast still re-triggers the animation.
    setTimeout(() => setOpen(true), 0);
  }

  const toast = (
    <ToastProvider swipeDirection="right" duration={2500}>
      <Toast open={open} onOpenChange={setOpen}>
        <div>
          <ToastTitle>{message.title}</ToastTitle>
          <ToastDescription>{message.description}</ToastDescription>
        </div>
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );

  return { show, toast };
}
