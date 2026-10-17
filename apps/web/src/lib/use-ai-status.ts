"use client";

import { useEffect, useState } from "react";
import type { AiFeatureKey, AiStatus } from "@spine/shared";
import { apiClient } from "./api-client";
import { useModules } from "./modules-context";

/**
 * US-AI-03, US-AI-05 — what this person's AI controls may show, from
 * `GET /ai/status`; null while AI is off or unknown, so nothing flashes up.
 */
export function useAiStatus(): AiStatus | null {
  const aiOn = useModules().modules?.ai === true;
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    if (!aiOn) return setStatus(null);
    let cancelled = false;
    apiClient
      .get<AiStatus>("/ai/status")
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setStatus(null));
    return () => {
      cancelled = true;
    };
  }, [aiOn]);
  return status;
}

/** The shared rules — a control shows only with AI on, the feature on and the right to use it. */
export function aiFeatureShown(status: AiStatus | null, feature: AiFeatureKey): boolean {
  return Boolean(status?.canUse && status.features[feature]);
}
