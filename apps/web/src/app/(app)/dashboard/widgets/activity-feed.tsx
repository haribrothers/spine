"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@spine/ui";
import Link from "next/link";
import { apiClient } from "../../../../lib/api-client";

interface ActivityFeedEntry {
  type: string;
  message: string;
  link: string | null;
  occurredAt: string;
}

function formatWhen(occurredAt: string): string {
  const d = new Date(occurredAt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.round(diffMs / (60 * 1000));
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * S-09.14 (dashboard v2) — org-wide "what just happened" feed. Reads
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
        <CardTitle className="text-[15px]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!entries ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-on-surface-muted">Nothing yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {entries.slice(0, 6).map((entry, i) => {
              const row = (
                <div className="flex items-center justify-between gap-3 rounded-sm px-1 py-1.5 text-[13px]">
                  <span className="text-on-surface">{entry.message}</span>
                  <span className="shrink-0 text-[11px] text-on-surface-muted">{formatWhen(entry.occurredAt)}</span>
                </div>
              );
              return entry.link ? (
                <Link key={`${entry.type}-${i}`} href={entry.link} className="rounded-sm hover:bg-surface-sunken">
                  {row}
                </Link>
              ) : (
                <div key={`${entry.type}-${i}`}>{row}</div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
