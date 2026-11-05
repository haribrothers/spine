"use client";

import { useEffect, useState } from "react";
import { Alert } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";

interface IntegritySummary {
  problemCount: number;
  message: string | null;
  files: { id: string; problem: "damaged" | "missing"; label: string }[];
}

const LISTED = 5;

/**
 * US-OPS-28 — the Owners' warning when the integrity check (weekly, or on
 * opening a file) found stored files that are damaged or missing. Renders
 * nothing while loading, when every file is intact, or on any error —
 * `GET /files/integrity` is Owner-only, so this is never the gate.
 */
export function StorageIntegrityAlert() {
  const t = useT();
  const [summary, setSummary] = useState<IntegritySummary | null>(null);

  useEffect(() => {
    apiClient
      .get<IntegritySummary>("/files/integrity")
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  if (!summary?.problemCount || !summary.message) return null;
  const more = summary.files.length - LISTED;

  return (
    <Alert variant="critical" data-testid="storage-integrity-alert">
      <p className="font-medium">{summary.message}</p>
      <ul className="mt-1 list-disc pl-5">
        {summary.files.slice(0, LISTED).map((file) => (
          <li key={file.id}>
            {t("dashboard.storageAlert.file", { label: file.label, problem: file.problem })}
          </li>
        ))}
        {more > 0 && <li>{t("dashboard.storageAlert.more", { more })}</li>}
      </ul>
    </Alert>
  );
}
