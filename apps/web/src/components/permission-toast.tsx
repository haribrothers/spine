"use client";

import { useEffect, useState } from "react";
import { Toast, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@spine/ui";
import { FORBIDDEN_EVENT } from "../lib/api-client";

/**
 * US-OPS-12 — when an action is refused (403), explain it in a toast
 * instead of leaving a raw error. Fired by `apiClient` for any refused
 * create, change or delete; page loads that are refused show the
 * no-access page instead.
 */
export function PermissionToast() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const onForbidden = () => {
      setKey((k) => k + 1);
      setOpen(true);
    };
    window.addEventListener(FORBIDDEN_EVENT, onForbidden);
    return () => window.removeEventListener(FORBIDDEN_EVENT, onForbidden);
  }, []);

  return (
    <ToastProvider swipeDirection="right" duration={6000}>
      <Toast key={key} open={open} onOpenChange={setOpen} data-testid="permission-toast">
        <div>
          <ToastTitle>You don't have permission to do that</ToastTitle>
          <ToastDescription>Your account can't make this change. If you need to, ask an owner.</ToastDescription>
        </div>
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}
