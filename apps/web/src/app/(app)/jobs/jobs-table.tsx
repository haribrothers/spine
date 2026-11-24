"use client";

import { Badge, DataTable, Tooltip, TooltipContent, TooltipTrigger, cn, type TableColumn, type TableSort } from "@spine/ui";
import Link from "next/link";
import { budgetUsedLabel } from "@spine/shared";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { JOB_STATUS_LABELS, type Job } from "./types";
import { calendarDate } from "../quotes/quotes-list-state";
import { completePct, nextMilestoneNote } from "./jobs-list-state";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { useT } from "../../../lib/i18n";

export const STATUS_BADGE_CLASS: Record<Job["status"], string> = {
  active: "bg-due-soon-bg text-due-soon",
  on_hold: "bg-draft-bg text-draft",
  completed: "bg-paid-bg text-paid",
  cancelled: "bg-overdue-bg text-overdue",
};

const TONE_CLASS = { "": "text-on-surface-muted", soon: "font-medium text-due-soon", over: "font-medium text-overdue" } as const;

/** A short labelled bar: "Complete ▬▬ 35%". */
function ProgressRow({ label, pct, tone = "" }: { label: string; pct: number | null; tone?: "" | "done" | "over" }) {
  const t = useT();
  const width = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <>
      <span className="text-[11.5px] text-on-surface-muted">{label}</span>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden>
        <span className={cn("block h-full rounded-full", tone === "over" ? "bg-overdue" : tone === "done" ? "bg-paid" : "bg-primary")} style={{ width: `${width}%` }} />
      </span>
      {tone === "over" ? (
        // US-JOB-33: billing over the contract, said in words as well as colour.
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-flex items-center gap-1 rounded-sm text-[12px] font-medium tabular-nums text-overdue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={t("jobs.table.billedOverAria", { pct: String(pct) })}>
              {pct}%
              <AlertTriangle size={12} aria-hidden />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("jobs.table.billedOver")}</TooltipContent>
        </Tooltip>
      ) : (
        <span className="text-[12px] font-medium tabular-nums text-on-surface">{pct === null ? "—" : `${pct}%`}</span>
      )}
    </>
  );
}

/**
 * The jobs table (US-JOB-33, D-215): the name with its number and site,
 * the next milestone and its due state, complete % beside billed % (billing
 * over the contract flagged), the end date and the contract value. Field
 * users get no money or billed figures (US-JOB-19). Budget used and
 * retention are in Columns.
 */
export function JobsTable({
  jobs,
  now,
  sort,
  onSortChange,
  page,
  onPageChange,
  toolbarStart,
}: {
  jobs: Job[];
  now: Date;
  sort?: TableSort | null;
  onSortChange?: (sort: TableSort | null) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  toolbarStart?: React.ReactNode;
}) {
  const t = useT();
  const locale = orgLocaleTag();
  const withMoney = jobs.some((job) => job.contractValueAmount !== undefined);
  const withBilling = jobs.some((job) => job.billedPct !== undefined);
  const columns: TableColumn<Job>[] = [
    {
      key: "name",
      header: t("jobs.table.job"),
      render: (row) => (
        <div className="flex max-w-52 flex-col whitespace-normal">
          <Link href={`/jobs/${row.id}`} className="font-semibold text-on-surface hover:text-primary hover:underline">
            {row.name}
          </Link>
          <span className="truncate text-[12.5px] text-on-surface-muted" title={row.siteAddress ?? undefined}>
            {[row.number, row.siteAddress?.replace(/\s*\n\s*/g, ", ")].filter(Boolean).join(" · ")}
          </span>
        </div>
      ),
      // US-OPS-56: on a phone, the number alone; the job's name goes on the second line.
      phone: "title",
      phoneRender: (row) => <Link href={`/jobs/${row.id}`}>{row.number ?? row.name}</Link>,
      sortValue: (row) => row.name,
    },
    {
      key: "contact",
      phone: "subtitle",
      phoneRender: (row) => [row.number ? row.name : null, row.contactName].filter(Boolean).join(" · ") || null,
      header: t("jobs.table.contact"),
      render: (row) => (
        <span className="block max-w-40 truncate" title={row.contactName ?? undefined}>
          {row.contactName ?? "—"}
        </span>
      ),
      sortValue: (row) => row.contactName ?? "",
    },
    {
      key: "status",
      phone: "badge",
      header: t("jobs.table.status"),
      render: (row) => <Badge className={STATUS_BADGE_CLASS[row.status]}>{JOB_STATUS_LABELS[row.status]}</Badge>,
      sortValue: (row) => row.status,
    },
    {
      key: "next",
      phone: "hidden",
      header: t("jobs.table.nextMilestone"),
      render: (row) => {
        const note = nextMilestoneNote(row, now, locale);
        return (
          <div className="flex max-w-40 flex-col whitespace-normal" data-testid="job-next">
            <span className="truncate font-medium text-on-surface">{note.name}</span>
            {note.text && <span className={cn("text-[12px]", TONE_CLASS[note.tone])}>{note.text}</span>}
          </div>
        );
      },
      sortValue: (row) => row.nextMilestone?.dueDate ?? "9999",
    },
    {
      key: "progress",
      // On a phone: how far along, under the contract value (or on its own for Field users, who see no money).
      phone: withMoney ? "trailingSub" : "trailing",
      phoneRender: (row) => {
        const complete = completePct(row);
        return complete === null ? null : t("jobs.table.pctComplete", { pct: complete });
      },
      header: t("jobs.table.progress"),
      render: (row) => {
        const complete = completePct(row);
        const billed = row.billedPct ?? null;
        const over = billed !== null && billed > 100;
        return (
          <div className="grid w-48 grid-cols-[3.75rem_minmax(0,1fr)_3.5rem] items-center gap-x-2 gap-y-1" data-testid="job-progress">
            <ProgressRow label={t("jobs.table.complete")} pct={complete} tone={complete === 100 ? "done" : ""} />
            {withBilling && <ProgressRow label={t("jobs.table.billed")} pct={billed} tone={over ? "over" : ""} />}
          </div>
        );
      },
      sortValue: (row) => completePct(row) ?? -1,
    },
    {
      key: "endDate",
      phone: "hidden",
      header: t("jobs.table.endDate"),
      render: (row) => (row.endDate ? calendarDate(row.endDate, now, locale) : <span className="text-on-surface-muted">—</span>),
      sortValue: (row) => row.endDate ?? "",
    },
  ];
  if (withMoney) {
    columns.push(
      {
        key: "contractValue",
        phone: "trailing",
        header: t("jobs.table.contract"),
        align: "right",
        render: (row) => <span className="tabular-nums">{formatMoney(BigInt(row.contractValueAmount ?? 0), row.currency)}</span>,
        sortValue: (row) => BigInt(row.contractValueAmount ?? 0),
      },
      {
        key: "retentionPct",
        phone: "hidden",
        header: t("jobs.table.retention"),
        render: (row) => ((row.retentionPct ?? 0) > 0 ? `${row.retentionPct}%` : "—"),
        sortValue: (row) => row.retentionPct ?? 0,
      },
    );
  }
  // US-JOB-25: only present for members with reports.view_job_profitability.
  if (jobs.some((job) => job.budgetState !== undefined)) {
    columns.push({
      key: "budgetUsed",
      phone: "hidden",
      header: t("jobs.table.budgetUsed"),
      align: "right",
      render: (row) => (
        <span className={cn("inline-flex items-center gap-1 tabular-nums", row.budgetState === "over" ? "text-overdue" : row.budgetState === "near" ? "text-due-soon" : "text-on-surface")}>
          {row.budgetState === "over" && <OctagonAlert size={13} aria-hidden />}
          {row.budgetState === "near" && <AlertTriangle size={13} aria-hidden />}
          {budgetUsedLabel(row.budgetState, row.budgetUsedPct)}
        </span>
      ),
      sortValue: (row) => row.budgetUsedPct ?? -1,
    });
  }

  return (
    <DataTable
      columns={columns}
      data={jobs}
      rowKey={(row) => row.id}
      configurablePageSize
      toolbarStart={toolbarStart}
      sort={sort}
      onSortChange={onSortChange}
      page={page}
      onPageChange={onPageChange}
      defaultHidden={["retentionPct", "budgetUsed"]}
    />
  );
}
