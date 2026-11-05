"use client";

import { useEffect, useState } from "react";
import { Card, Spinner } from "@spine/ui";
import type { ActivityFeedEntry } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { ActivityFeedList } from "../../../components/activity-feed-list";
import { useT } from "../../../lib/i18n";

/** US-DASH-19 — the last 100 events the member may see (Field: their jobs, no money). */
export function ActivityExplorer() {
  const t = useT();
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
        <p className="py-6 text-center text-[13px] text-on-surface-muted">{t("activity.explorer.loadFailed")}</p>
      ) : !entries ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-on-surface-muted">{t("activity.explorer.empty")}</p>
      ) : (
        <ActivityFeedList entries={entries} />
      )}
    </Card>
  );
}
