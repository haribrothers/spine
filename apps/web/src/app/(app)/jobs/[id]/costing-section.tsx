"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Card, Progress, Spinner, cn } from "@spine/ui";
import { BUDGET_NEAR_PCT } from "@spine/shared";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { apiClient } from "../../../../lib/api-client";
import type { Job, JobCostingReport } from "../types";
import { formatMoney } from "../../../../lib/money";

/**
 * The job's Costing tab (`JobCostingBudget`): contract value, revenue, cost
 * and margin read live off journal lines tagged to the job (D-011), and
 * the cost budget card (US-JOB-25). Needs `reports.view_job_profitability`,
 * like the route behind it.
 */
export function CostingSection({ job, onEditJob }: { job: Job; onEditJob?: () => void }) {
  const [report, setReport] = useState<JobCostingReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<JobCostingReport>(`/jobs/${job.id}/costing`)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load job costing."));
  }, [job.id, job.costBudgetAmount, job.contractValueAmount]);

  if (error) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!report) {
    return (
      <Card className="flex justify-center py-8">
        <Spinner />
      </Card>
    );
  }

  const fmt = (amount: string) => formatMoney(BigInt(amount), report.currency);
  const margin = BigInt(report.margin);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <h3 className="text-[15px] font-semibold text-on-surface">Job costing</h3>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Figure label="Contract value" value={fmt(report.contractValueAmount)} note="Includes applied variations" />
          <Figure label="Revenue recognised" value={fmt(report.revenue)} />
          <Figure label="Cost" value={fmt(report.cost)} note="Bills and approved expenses" />
          <Figure label="Margin" value={fmt(report.margin)} tone={margin < 0n ? "danger" : undefined} note={margin < 0n ? "Cost is ahead of billing" : undefined} />
          <Figure label="Margin %" value={report.marginPct === null ? "—" : `${report.marginPct.toFixed(1)}%`} tone={margin < 0n ? "danger" : undefined} />
        </dl>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BudgetCard report={report} onEditJob={onEditJob} />
      </div>
    </div>
  );
}

function Figure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "danger" | "good" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[13px] text-on-surface-muted">{label}</dt>
      <dd className={cn("text-[20px] font-semibold tabular-nums text-on-surface", tone === "danger" && "text-overdue", tone === "good" && "text-paid")}>{value}</dd>
      {note && <dd className="text-[12px] text-on-surface-muted">{note}</dd>}
    </div>
  );
}

/** US-JOB-25 (D-125) — cost budget, spent, remaining and how much is used, warning at 80% and over at 100%. */
function BudgetCard({ report, onEditJob }: { report: JobCostingReport; onEditJob?: () => void }) {
  const { budget } = report;
  const fmt = (amount: string) => formatMoney(BigInt(amount), report.currency);

  if (budget.state === "none") {
    return (
      <Card className="flex flex-col gap-3">
        <h3 className="text-[15px] font-semibold text-on-surface">Budget</h3>
        <p className="text-[14px] text-on-surface-muted">No budget set</p>
        {onEditJob && (
          <div>
            <Button variant="secondary" size="sm" onClick={onEditJob}>
              Set a budget
            </Button>
          </div>
        )}
      </Card>
    );
  }

  const remaining = BigInt(budget.remaining!);
  const over = budget.state === "over";
  const near = budget.state === "near";
  const label = over ? `Over budget by ${fmt((-remaining).toString())}` : near ? `Nearing budget — ${budget.usedPct}% used` : `${budget.usedPct ?? 0}% of budget used`;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold text-on-surface">Budget</h3>
        {onEditJob && (
          <Button variant="secondary" size="sm" onClick={onEditJob}>
            Edit budget
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-4">
        <Figure label="Cost budget" value={fmt(budget.amount!)} />
        <Figure label="Spent" value={fmt(budget.spent)} />
        <Figure label="Remaining" value={fmt(budget.remaining!)} tone={remaining < 0n ? "danger" : "good"} />
      </dl>
      <div className="flex flex-col gap-2">
        <Progress value={over ? 100 : (budget.usedPct ?? 0)} tone={over ? "danger" : near ? "warning" : "default"} aria-label={label} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <span className={cn("flex items-center gap-1.5 font-semibold text-on-surface", near && "text-due-soon", over && "text-overdue")}>
            {over && <OctagonAlert size={14} aria-hidden />}
            {near && <AlertTriangle size={14} aria-hidden />}
            {label}
          </span>
          <span className="text-on-surface-muted">Warning at {BUDGET_NEAR_PCT}% · over at 100%</span>
        </div>
      </div>
    </Card>
  );
}
