"use client";

import { RotateCw } from "lucide-react";
import { Alert, Button } from "@spine/ui";
import { useT } from "../lib/i18n";

/**
 * US-AI-07 — the inline message by an AI control when its request didn't
 * work. The first sentence is bold ("AI didn't answer."); `detail` adds
 * what still happened ("RTE-3318.pdf is attached either way."). "Try
 * again" shows only when trying again can help — not for a paused budget
 * or too many requests. The form around it stays as it was.
 */
export function AiUnavailableNotice({ message, detail, onRetry }: { message: string; detail?: string; onRetry?: () => void }) {
  const t = useT();
  const split = message.indexOf(". ");
  const [lead, rest] = split < 0 ? [message, ""] : [message.slice(0, split + 1), message.slice(split + 2)];
  return (
    <Alert variant="critical" data-testid="ai-unavailable" className="items-center">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-on-surface">
          <strong className="font-semibold">{lead}</strong>
          {rest && ` ${rest}`}
          {detail && ` ${detail}`}
        </p>
        {onRetry && (
          <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
            <RotateCw size={14} aria-hidden />
            {t("common.aiUnavailable.tryAgain")}
          </Button>
        )}
      </div>
    </Alert>
  );
}
