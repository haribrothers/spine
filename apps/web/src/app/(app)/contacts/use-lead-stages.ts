"use client";

import { useCallback, useEffect, useState } from "react";
import type { LeadStage } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { t } from "../../../lib/i18n";

/**
 * US-CRM-19 — the organisation's pipeline stages in board order, shared by
 * the board, the lead forms and the Pipeline stages settings pane.
 */
export function useLeadStages() {
  const [stages, setStages] = useState<LeadStage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    apiClient
      .get<LeadStage[]>("/org/lead-stages")
      .then((rows) => {
        setStages(rows);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("contacts.leadStages.loadError")));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { stages, error, reload, setStages };
}

/** Text and dot classes for a stage's category colour (design tokens; light and dark come from the CSS variables). */
export const STAGE_DOT_CLASS: Record<LeadStage["color"], string> = {
  slate: "bg-category-slate",
  blue: "bg-category-blue",
  teal: "bg-category-teal",
  amber: "bg-category-amber",
  purple: "bg-category-purple",
  pink: "bg-category-pink",
  green: "bg-category-green",
  red: "bg-category-red",
};
