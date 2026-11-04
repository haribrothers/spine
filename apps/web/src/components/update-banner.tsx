"use client";

import { useEffect, useState } from "react";
import { Banner } from "@spine/ui";
import { UPDATE_GUIDE_URL, availableUpdate, updateNotice, type UpdateStatus } from "@spine/shared";
import { CircleArrowUp } from "lucide-react";
import { apiClient } from "../lib/api-client";

/** The version whose banner this browser closed. */
export const DISMISSED_UPDATE_KEY = "spine.update.dismissed";

function dismissedVersion(): string | null {
  try {
    return window.localStorage.getItem(DISMISSED_UPDATE_KEY);
  } catch {
    return null;
  }
}

/**
 * US-OPS-06 (D-055) — tells Owners when a newer Spine release exists.
 * Rendered only for Owners (decided server-side in the layout, and the API
 * answers Owners only). Closing it hides it until the next version. Shows
 * nothing while loading, if the check fails, or with `UPDATE_CHECK=off`.
 */
export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(dismissedVersion());
    apiClient
      .get<UpdateStatus>("/org/update-status")
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const latest = availableUpdate(status);
  if (!status || !latest || latest === dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_UPDATE_KEY, latest!);
    } catch {
      // Still closes for this visit.
    }
    setDismissed(latest);
  }

  const notice = updateNotice(latest, status.current);
  return (
    <Banner
      variant="info"
      icon={<CircleArrowUp />}
      title={notice.title}
      data-testid="update-banner"
      actions={
        <>
          {status.releaseUrl && (
            <a href={status.releaseUrl} target="_blank" rel="noreferrer">
              What&apos;s new
            </a>
          )}
          <a href={UPDATE_GUIDE_URL} target="_blank" rel="noreferrer">
            How to update
          </a>
        </>
      }
      onDismiss={dismiss}
      dismissLabel="Close the update notice"
    >
      {notice.body}
    </Banner>
  );
}
