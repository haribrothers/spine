"use client";

import { useEffect, useState } from "react";
import { Card, Spinner } from "@spine/ui";
import type { ActivityFeedEntry } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { ActivityFeedList } from "../../../components/activity-feed-list";

/** US-DASH-19 — the last 100 events the member may see (Field: their jobs, no money). */
export function ActivityExplorer() {
  const [entries, setEntries] = useState<ActivityFeedEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<ActivityFeedEntry[]>("/dashboard/activity-feed?limit=100")
      .then(setEntries)
      .catch(() => setFailed(true));
  }, []);

  return (
    <Card data-testid="activity-page">
      {failed ? (
        <p className="py-6 text-center text-[13px] text-on-surface-muted">Couldn&apos;t load the activity. Refresh the page to try again.</p>
      ) : !entries ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-on-surface-muted">Nothing yet.</p>
      ) : (
        <ActivityFeedList entries={entries} />
      )}
    </Card>
  );
}
