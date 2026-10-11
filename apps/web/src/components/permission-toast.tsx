"use client";

import { useEffect } from "react";
import { FORBIDDEN_EVENT } from "../lib/api-client";
import { useToast } from "./toast-host";

/**
 * US-OPS-12 — when an action is refused (403), explain it in a toast
 * instead of leaving a raw error. Fired by `apiClient` for any refused
 * create, change or delete; page loads that are refused show the
 * no-access page instead. Shown through the app's toast host (D-223), so
 * it stacks with the others.
 */
export function PermissionToast() {
  const toast = useToast();

  useEffect(() => {
    const onForbidden = () =>
      toast("You don't have permission to do that", "Your account can't make this change. If you need to, ask an owner.", { duration: 6000, testId: "permission-toast" });
    window.addEventListener(FORBIDDEN_EVENT, onForbidden);
    return () => window.removeEventListener(FORBIDDEN_EVENT, onForbidden);
  }, [toast]);

  return null;
}
