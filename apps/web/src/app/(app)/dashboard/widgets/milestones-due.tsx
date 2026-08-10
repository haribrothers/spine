"use client";

import { useEffect, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner } from "@spine/ui";
import Link from "next/link";
import { apiClient } from "../../../../lib/api-client";

interface MilestoneDueRow {
  milestoneId: string;
  jobId: string;
  jobName: string;
  name: string;
  dueDate: string | null;
  isOverdue: boolean;
}

function dueLabel(row: MilestoneDueRow): string {
  if (!row.dueDate) return "";
  const days = Math.round((new Date(row.dueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (row.isOverdue) return `${Math.abs(days)}d overdue`;
  if (days <= 0) return "Due today";
  return `Due in ${days}d`;
}

/**
 * S-09.12 (dashboard v2) — "job milestones due." Reads Stage 1's new
 * `GET /jobs/milestones/due`, the first cross-job milestone query — every
 * other milestone view in the app is scoped to one job at a time.
 */
export function MilestonesDue() {
  const [rows, setRows] = useState<MilestoneDueRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<MilestoneDueRow[]>("/jobs/milestones/due")
      .then(setRows)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          Job milestones due
          <Link href="/jobs" className="text-[13px] font-normal text-primary hover:underline">
            View all
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!rows ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-on-surface-muted">Nothing due soon.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {rows.map((row) => (
              <Link key={row.milestoneId} href={`/jobs/${row.jobId}`} className="flex items-center justify-between gap-3 rounded-sm px-1 py-1.5 text-[13px] hover:bg-surface-secondary">
                <div className="flex flex-col">
                  <span className="text-on-surface">{row.name}</span>
                  <span className="text-[11px] text-on-surface-muted">{row.jobName}</span>
                </div>
                <Badge className={row.isOverdue ? "bg-overdue-bg text-overdue" : "bg-due-soon-bg text-due-soon"}>{dueLabel(row)}</Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
