"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Skeleton, cn } from "@spine/ui";
import type { JobActivityEntry } from "@spine/shared";
import { Check, Flag, GitBranch, Image as ImageIcon, LockOpen, ListChecks, MessageSquare, Pencil, Plus, Receipt, RefreshCw, UserMinus, Users } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../../lib/money";
import { groupJobActivity, type JobActivityItem } from "../job-page-state";
import { JOB_STATUS_LABELS, type JobStatus } from "../types";

function when(iso: string): string {
  const d = new Date(iso);
  const locale = orgLocaleTag();
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/** US-JOB-37 — what an entry says: the event in bold, then what it was about. */
export function jobActivityText(item: JobActivityItem, currency: string): { title: string; rest: string | null } {
  const d = item.detail;
  switch (item.type) {
    case "created":
      return { title: "Created", rest: null };
    case "created_from_quote":
      return { title: "Created", rest: d ? `from ${d}` : "from a quote" };
    case "status_changed":
      return { title: "Status changed", rest: `to ${JOB_STATUS_LABELS[d as JobStatus] ?? d}` };
    case "updated":
      return { title: "Job details edited", rest: null };
    case "milestones_set":
      return { title: "Milestones set", rest: d ? `· ${d} ${d === "1" ? "milestone" : "milestones"}` : null };
    case "milestone_completed":
      return { title: "Milestone completed", rest: d ? `· ${d}` : null };
    case "milestone_invoiced":
      return { title: "Milestone invoiced", rest: d ? `· ${d}` : null };
    case "variation_order_created":
      return { title: "Variation raised", rest: d ? `· ${d}` : null };
    case "variation_order_applied": {
      const delta = d ? BigInt(d) : null;
      return { title: "Variation applied", rest: delta === null ? null : `· ${delta >= 0n ? "+" : "−"}${formatMoney(delta >= 0n ? delta : -delta, currency)}` };
    }
    case "photo_added": {
      const n = item.photos ?? 1;
      return { title: n > 1 ? `${n} photos added` : "Photo added", rest: d ? `with ${d}` : null };
    }
    case "note_added":
      return { title: "Note added", rest: null };
    case "crew_assigned":
      return { title: "Crew assigned", rest: d ? `· ${d}` : null };
    case "crew_unassigned":
      return { title: "Removed from crew", rest: d ? `· ${d}` : null };
    case "retention_released":
      return { title: "Retention released", rest: d ? `· ${d}` : null };
  }
}

const ICONS: Record<JobActivityEntry["type"], React.ComponentType<{ size?: number }>> = {
  created: Plus,
  created_from_quote: Plus,
  status_changed: RefreshCw,
  updated: Pencil,
  milestones_set: ListChecks,
  milestone_completed: Flag,
  milestone_invoiced: Receipt,
  variation_order_created: GitBranch,
  variation_order_applied: GitBranch,
  photo_added: ImageIcon,
  note_added: MessageSquare,
  crew_assigned: Users,
  crew_unassigned: UserMinus,
  retention_released: LockOpen,
};

function linkFor(item: JobActivityItem): string | null {
  if (!item.linkId) return null;
  if (item.type === "created_from_quote" || item.type === "variation_order_created") return `/quotes/${item.linkId}`;
  if (item.type === "milestone_invoiced" || item.type === "retention_released") return `/invoices/${item.linkId}`;
  return null;
}

/** US-JOB-37 — more than this many show "Show N earlier". */
const SHOWN = 8;

/**
 * US-JOB-37 (D-215) — the job's story, newest first: created, status
 * changes, milestones set, completed and invoiced, variations, photos
 * (added together, one entry), notes, crew and retention. "View history"
 * keeps the field-level changes. Never shown to Field users.
 */
export function JobActivity({ jobId, currency, refreshKey, onViewHistory }: { jobId: string; currency: string; refreshKey?: unknown; onViewHistory: () => void }) {
  const [items, setItems] = useState<JobActivityItem[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    apiClient
      .get<JobActivityEntry[]>(`/jobs/${jobId}/activity`)
      .then((rows) => setItems(groupJobActivity(rows)))
      .catch(() => setItems([]));
  }, [jobId, refreshKey]);

  const shown = items ? (all ? items : items.slice(0, SHOWN)) : null;

  return (
    <Card className="flex flex-col gap-1 p-0" data-testid="job-activity">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h3 className="text-[14px] font-semibold text-on-surface">Activity</h3>
        <button type="button" onClick={onViewHistory} className="text-[12.5px] font-medium text-primary hover:underline">
          View history
        </button>
      </div>
      <ol className="flex flex-col px-4 pb-4">
        {!shown && (
          <li className="flex flex-col gap-2 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </li>
        )}
        {shown?.length === 0 && <li className="py-2 text-[13px] text-on-surface-muted">Nothing has happened on this job yet.</li>}
        {shown?.map((item, i) => {
          const Icon = item.type === "status_changed" && item.detail === "completed" ? Check : ICONS[item.type];
          const href = linkFor(item);
          const text = jobActivityText(item, currency);
          const done = item.type === "status_changed" && item.detail === "completed";
          return (
            <li key={`${item.type}-${item.at}-${i}`} className="relative grid grid-cols-[26px_minmax(0,1fr)] gap-2.5 py-2">
              {i < shown.length - 1 && <span className="absolute bottom-[-8px] left-[12.5px] top-[34px] w-px bg-border" aria-hidden />}
              <span
                className={cn(
                  "flex h-[26px] w-[26px] items-center justify-center rounded-full border",
                  done ? "border-transparent bg-paid-bg text-paid" : item.type === "photo_added" ? "border-transparent bg-info-bg text-primary" : "border-border bg-surface-sunken text-on-surface-muted",
                )}
                aria-hidden
              >
                <Icon size={13} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-on-surface">
                  {href ? (
                    <Link href={href} className="font-semibold hover:text-primary hover:underline">
                      {text.title}
                    </Link>
                  ) : (
                    <span className="font-semibold">{text.title}</span>
                  )}
                  {text.rest && <> {text.rest}</>}
                </p>
                <p className="mt-0.5 text-[12px] text-on-surface-muted">{[item.actorName, when(item.at)].filter(Boolean).join(" · ")}</p>
              </div>
            </li>
          );
        })}
        {items && !all && items.length > SHOWN && (
          <li>
            <button type="button" onClick={() => setAll(true)} className="mt-1 text-[12.5px] font-medium text-primary hover:underline">
              Show {items.length - SHOWN} earlier
            </button>
          </li>
        )}
      </ol>
    </Card>
  );
}
