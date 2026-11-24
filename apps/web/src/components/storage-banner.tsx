"use client";

import { useEffect, useState } from "react";
import { Banner } from "@spine/ui";
import { storageWarningMessage, type StorageStatus } from "@spine/shared";
import { HardDrive } from "lucide-react";
import { apiClient } from "../lib/api-client";

/** Matches how often the API measures the files volume. */
const REFRESH_MS = 15 * 60 * 1000;

/**
 * US-OPS-31 — tells Owners, on every page, when the files volume is more
 * than 85% full. Rendered only for Owners (decided server-side in the
 * layout); Staff and Field only ever see the upload error. Shows nothing
 * for the `s3` driver, while loading, or if the check fails.
 */
export function StorageBanner() {
  const [storage, setStorage] = useState<StorageStatus | null>(null);

  useEffect(() => {
    const load = () =>
      apiClient
        .get<{ storage?: StorageStatus }>("/health/ready")
        .then((res) => setStorage(res.storage ?? null))
        .catch(() => setStorage(null));
    void load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const message = storageWarningMessage(storage?.usedPercent ?? null);
  if (!message) return null;
  return (
    <Banner variant="warning" icon={<HardDrive />} data-testid="storage-banner">
      {message}
    </Banner>
  );
}
