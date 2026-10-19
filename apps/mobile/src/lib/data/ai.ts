import type { AiStatus } from "@spine/shared/schemas";
import { useCachedQuery } from "./use-cached-query";
import { useModules } from "./modules";

/**
 * US-AI-10 — what this person's AI controls may show (`GET /ai/status`),
 * asked only while AI is on (every `/ai/*` route answers 403 while it's
 * off). Kept like any read, so a phone that goes offline still knows to
 * show "Read receipt" disabled; null while AI is off, unknown, or refused.
 */
export function useAiStatus(): AiStatus | null {
  const aiOn = useModules().ai === true;
  const { data, status } = useCachedQuery<AiStatus>("ai-status", "/ai/status", { enabled: aiOn, refreshOnForeground: true });
  return aiOn && status !== "error" ? data : null;
}

/**
 * The shared rules (21-ai.md) — "Read receipt" shows with the feature on
 * and the right to use it (Field: their own receipt, D-245). A phone's
 * receipt is always a photo, so a model that can't read images hides it.
 */
export function receiptReadOffered(status: AiStatus | null): boolean {
  return Boolean(status && status.features.readDocuments && (status.canUse || status.canReadOwnReceipt) && status.supportsImages !== false);
}
