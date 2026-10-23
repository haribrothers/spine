"use client";

import { useEffect, useState } from "react";
import { Banner } from "@spine/ui";
import { backupWarningMessage, type BackupStatus } from "@spine/shared";
import { DatabaseBackup } from "lucide-react";
import { apiClient } from "../lib/api-client";

/** Once an hour is plenty for something counted in days. */
const REFRESH_MS = 60 * 60 * 1000;

/**
 * US-OPS-03 (D-105) — tells Owners, on every page, when the last backup is
 * more than 2 days old (or there has never been one on an install older than
 * that). Rendered only for Owners (decided server-side in the layout); shows
 * nothing while loading or if the check fails.
 */
export function BackupBanner() {
  const [status, setStatus] = useState<BackupStatus | null>(null);

  useEffect(() => {
    const load = () =>
      apiClient
        .get<BackupStatus>("/org/backup-status")
        .then(setStatus)
        .catch(() => setStatus(null));
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const message = backupWarningMessage(status);
  if (!message) return null;
  return (
    <Banner variant="warning" icon={<DatabaseBackup />} data-testid="backup-banner">
      {message}
    </Banner>
  );
}
