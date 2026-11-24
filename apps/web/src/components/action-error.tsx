"use client";

import { Alert, AlertDescription } from "@spine/ui";
import { X } from "lucide-react";
import { useT } from "../lib/i18n";

/**
 * US-OPS-38 (D-223) — a failed action's error, above the list or page where
 * the action was: what went wrong and what to do next, with a × to close
 * it. The page clears it on its next action. A toast never carries an error.
 */
export function ActionError({ title, message, onDismiss }: { title: string; message: string; onDismiss: () => void }) {
  const t = useT();
  return (
    <Alert variant="critical" data-testid="action-error">
      <div className="flex items-start justify-between gap-3">
        <AlertDescription>
          <span className="font-medium text-on-surface">{title}</span> {message}
        </AlertDescription>
        <button
          type="button"
          aria-label={t("common.actionError.close")}
          onClick={onDismiss}
          className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-on-surface-muted transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </Alert>
  );
}
