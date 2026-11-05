"use client";

import { useEffect } from "react";
import { FORBIDDEN_EVENT } from "../lib/api-client";
import { useToast } from "./toast-host";
import { useT } from "../lib/i18n";

/**
 * US-OPS-12 — when an action is refused (403), explain it in a toast
 * instead of leaving a raw error. Fired by `apiClient` for any refused
 * create, change or delete; page loads that are refused show the
 * no-access page instead. Shown through the app's toast host (D-223), so
 * it stacks with the others.
 */
export function PermissionToast() {
  const t = useT();
  const toast = useToast();

  useEffect(() => {
    const onForbidden = () =>
      toast(t("common.permissionToast.title"), t("common.permissionToast.description"), { duration: 6000, testId: "permission-toast" });
    window.addEventListener(FORBIDDEN_EVENT, onForbidden);
    return () => window.removeEventListener(FORBIDDEN_EVENT, onForbidden);
  }, [toast, t]);

  return null;
}
