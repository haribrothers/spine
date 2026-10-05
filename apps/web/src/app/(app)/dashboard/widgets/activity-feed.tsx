"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@spine/ui";
import Link from "next/link";
import type { ActivityFeedEntry } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { ActivityFeedList } from "../../../../components/activity-feed-list";

/**
 * S-09.14 (dashboard v2) — org-wide "what just happened" feed. US-DASH-19:
 * rows name who did it, amounts are bold, repeated quote views are one row,
 * and "View all" opens the full feed. Reads
 * `GET /dashboard/activity-feed`, which already does its own role-based
 * filtering server-side (Field's version excludes payment/expense
 * events) — this component has no role logic of its own, matching
 * `UpcomingMeetings`' own "server already resolved it" convention.
 * Session-gated only on the API side, so unlike every other dashboard
 * widget this one never renders nothing on a 403 — an empty array is the
 * only "nothing to show" case.
 */
export function ActivityFeed({ title = "Recent activity" }: { title?: string } = {}) {
  const [entries, setEntries] = useState<ActivityFeedEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<ActivityFeedEntry[]>("/dashboard/activity-feed")
      .then(setEntries)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          {title}
          <Link href="/activity" className="text-[13px] font-normal text-primary hover:underline">
            View all
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!entries ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-on-surface-muted">Nothing yet.</p>
        ) : (
          <ActivityFeedList entries={entries.slice(0, 6)} />
        )}
      </CardContent>
    </Card>
  );
}
