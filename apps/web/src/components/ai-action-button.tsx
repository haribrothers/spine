"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@spine/ui";

/**
 * The shared rules (D-242), US-AI-07 — the button that starts an AI
 * request. While it runs, it shows a spinner and "Reading…" or
 * "Drafting…" with "Cancel" beside it; reduced motion shows the words
 * without the spinner. Nothing else on the form is disabled.
 */
export function AiActionButton({
  label,
  workingLabel,
  working,
  disabled,
  onClick,
  onCancel,
}: {
  label: string;
  workingLabel: string;
  working: boolean;
  /** A paused budget: shown disabled, with why beside it (US-AI-04). */
  disabled?: boolean;
  onClick: () => void;
  onCancel: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-2" aria-live="polite">
      <Button type="button" variant="secondary" size="sm" disabled={working || disabled} aria-busy={working || undefined} onClick={onClick}>
        {working ? <Loader2 size={14} aria-hidden className="animate-spin motion-reduce:hidden" /> : <Sparkles size={14} aria-hidden className="text-primary" />}
        {working ? workingLabel : label}
      </Button>
      {working && (
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </span>
  );
}
