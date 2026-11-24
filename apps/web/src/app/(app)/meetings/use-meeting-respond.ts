"use client";

import { useState } from "react";
import { apiClient } from "../../../lib/api-client";
import { useT } from "../../../lib/i18n";
import type { MeetingAttendee } from "./types";

/**
 * PRD S-01.12 — self-service accept/decline/tentative, extracted so both
 * MeetingAttendeesPanel and MeetingQuickViewPopover (S-01.13) share one
 * implementation instead of two copies of the same POST + refetch.
 */
export function useMeetingRespond(meetingId: string, onResponded: (rows: MeetingAttendee[]) => void) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(status: "accepted" | "declined" | "tentative") {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/meetings/${meetingId}/respond`, { status });
      const rows = await apiClient.get<MeetingAttendee[]>(`/meetings/${meetingId}/attendees`);
      onResponded(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("meetings.respondFailed"));
    } finally {
      setBusy(false);
    }
  }

  return { respond, busy, error };
}
