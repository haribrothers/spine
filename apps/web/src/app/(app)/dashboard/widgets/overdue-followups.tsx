"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@spine/ui";
import Link from "next/link";
import { apiClient } from "../../../../lib/api-client";

interface Activity {
  id: string;
  contactId: string | null;
  leadId: string | null;
  type: "call" | "meeting" | "note" | "task";
  notes: string | null;
  dueAt: string;
}

const TYPE_LABELS: Record<Activity["type"], string> = {
  call: "Call",
  meeting: "Meeting",
  note: "Note",
  task: "Task",
};

function daysOverdue(dueAt: string): number {
  const due = new Date(dueAt);
  const now = new Date();
  return Math.max(1, Math.ceil((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)));
}

/**
 * S-01.7 / S-09.12 (dashboard v2) — "a list of overdue follow-ups on my
 * dashboard." The backend (`GET /activities/overdue`) has existed since
 * FEAT-01 but was never actually surfaced on the dashboard until now —
 * this widget is the only new thing here, no new API work.
 */
export function OverdueFollowups() {
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<Activity[]>("/activities/overdue")
      .then(setActivities)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">My overdue follow-ups</CardTitle>
      </CardHeader>
      <CardContent>
        {!activities ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : activities.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-on-surface-muted">Nothing overdue.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {activities.map((a) => (
              <Link
                key={a.id}
                href={a.contactId ? `/contacts/${a.contactId}` : "/leads"}
                className="flex items-center justify-between gap-3 rounded-sm px-1 py-1.5 text-[13px] hover:bg-surface-secondary"
              >
                <div className="flex flex-col">
                  <span className="text-on-surface">{a.notes || TYPE_LABELS[a.type]}</span>
                  <span className="text-[11px] text-on-surface-muted">{TYPE_LABELS[a.type]}</span>
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-overdue">
                  {daysOverdue(a.dueAt)}d overdue
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
