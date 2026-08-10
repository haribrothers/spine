"use client";

import { useState } from "react";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@spine/ui";

/** Same shape as invoices/payments/quotes' own entity-toast.tsx — duplicated rather than shared, matching that file's own precedent. */
export function useEntityToast() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState({ title: "", description: "" });

  function show(title: string, description: string) {
    setMessage({ title, description });
    setOpen(false);
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
