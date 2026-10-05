"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@spine/ui";
import { apiClient } from "../../../../lib/api-client";

interface MyJob {
  id: string;
  number: string | null;
  name: string;
  contactName: string | null;
  siteAddress: string | null;
  nextMilestone: { id: string; name: string; dueDate: string | null } | null;
}

/** "due Sat", "due today", "due 12 Oct". */
function dueLabel(date: string): string {
  const due = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days > 1 && days < 7) return `due ${due.toLocaleDateString("en-GB", { weekday: "short" })}`;
  return `due ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

/**
 * US-DASH-18 — a Field user's assigned jobs: name and number, customer,
 * site address with "Directions", and the next milestone. No money: the
 * API leaves it out for Field (D-048, D-072).
 */
export function MyJobs() {
  const [jobs, setJobs] = useState<MyJob[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<MyJob[]>("/jobs?assignedToMe=true&status=active&include=next_milestone")
      .then(setJobs)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  return (
    <Card data-testid="my-jobs">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          My jobs
          <Link href="/jobs" className="text-[13px] font-normal text-primary hover:underline">
            All my jobs
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!jobs ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : jobs.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-on-surface-muted">No jobs assigned to you yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-start justify-between gap-3 py-3" data-job={job.id}>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link href={`/jobs/${job.id}`} className="text-[14px] font-semibold text-on-surface hover:underline">
                    {job.name} {job.number && <span className="text-[12px] font-normal text-on-surface-muted">{job.number}</span>}
                  </Link>
                  <span className="text-[13px] text-on-surface">{[job.contactName, job.siteAddress].filter(Boolean).join(" · ")}</span>
                  {job.nextMilestone && (
                    <span className="text-[12px] text-on-surface-muted">
                      Next: {job.nextMilestone.name}
                      {job.nextMilestone.dueDate ? ` · ${dueLabel(job.nextMilestone.dueDate)}` : ""}
                    </span>
                  )}
                </div>
                {job.siteAddress && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.siteAddress)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[13px] text-primary hover:underline"
                  >
                    Directions
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
