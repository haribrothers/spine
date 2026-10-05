"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, Button, Card, DonutChart, Progress, Spinner, cn } from "@spine/ui";
import { BUDGET_NEAR_PCT, billingGapMessage } from "@spine/shared";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import Link from "next/link";
import { apiClient } from "../../../../lib/api-client";
import { useCapability } from "../../../../lib/capabilities-context";
import { DrilldownDialog } from "../../reports/reports-explorer";
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-on-surface">Job costing</h3>
          {/* US-PUR-22: what makes up the cost. */}
          <Link href={`/vendor-bills?jobId=${job.id}`} className="text-[13px] font-medium text-primary hover:underline">
            View bills and expenses
          </Link>
        </div>
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
        <BillingCard report={report} />
      </div>

      <CostByCategoryCard report={report} jobId={job.id} />
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

/** US-JOB-27 (D-127) — billed to date (gross, before retention) against the contract value. */
function BillingCard({ report }: { report: JobCostingReport }) {
  const { billing } = report;
  const fmt = (amount: string | bigint) => formatMoney(BigInt(amount), report.currency);
  const left = BigInt(billing.leftToBill);
  const billedPct = billing.billedPct ?? 0;
  // US-JOB-28 — only when the owner has set percent complete and the gap is 10 points or more.
  const gapMessage = billingGapMessage(billing.gapPts);

  return (
    <Card className="flex flex-col gap-4">
      <h3 className="text-[15px] font-semibold text-on-surface">Billing</h3>
      <dl className="grid grid-cols-3 gap-4">
        <Figure label="Contract value" value={fmt(billing.contractValue)} />
        <Figure label="Billed to date" value={fmt(billing.billedToDate)} note={billing.billedPct === null ? undefined : `${billing.billedPct}% of contract`} />
        {left < 0n ? (
          <Figure label="Left to bill" value={`Billed over contract by ${fmt(-left)}`} tone="danger" />
        ) : (
          <Figure label="Left to bill" value={fmt(left)} />
        )}
      </dl>
      <div className="grid grid-cols-[6rem_1fr_3rem] items-center gap-x-3 gap-y-2 text-[13px]">
        <span className="text-on-surface-muted">Billed</span>
        <Progress value={Math.min(100, billedPct)} aria-label={`Billed ${billedPct}% of the contract`} />
        <span className="text-right font-semibold tabular-nums text-on-surface">{billedPct}%</span>
        {billing.percentComplete !== null && (
          <>
            <span className="text-on-surface-muted">Work complete</span>
            <Progress value={billing.percentComplete} tone="neutral" aria-label={`Work complete ${billing.percentComplete}%`} />
            <span className="text-right font-semibold tabular-nums text-on-surface">{billing.percentComplete}%</span>
          </>
        )}
      </div>
      {gapMessage && (
        <Alert variant="warning">
          <AlertDescription>{gapMessage}</AlertDescription>
        </Alert>
      )}
    </Card>
  );
}

/** Categorical colours from the theme tokens: primary first, then the semantic and neutral tones; "Other" is always the faintest. */
const CATEGORY_COLORS = ["var(--color-primary)", "var(--color-paid)", "var(--color-due-soon)", "var(--color-on-surface)", "var(--color-on-surface-muted)"];
const OTHER_COLOR = "var(--color-border-strong)";

/**
 * US-JOB-26 — the job's cost by the expense account it posted to (from
 * journal lines, D-011), largest first, with a donut of the five largest
 * and "Other" past six. Rows open the account drill-down for this job
 * with `ledger.view`.
 */
function CostByCategoryCard({ report, jobId }: { report: JobCostingReport; jobId: string }) {
  const canDrill = useCapability("ledger.view");
  const [drill, setDrill] = useState<{ accountId: string; label: string } | null>(null);
  const fmt = (amount: string | bigint) => formatMoney(BigInt(amount), report.currency);
  const rows = report.byCategory;

  if (!rows.length) {
    return (
      <Card className="flex flex-col gap-2">
        <h3 className="text-[15px] font-semibold text-on-surface">Cost by category</h3>
        <p className="text-[14px] text-on-surface-muted">No costs yet — bills and approved expenses tagged to this job show up here.</p>
      </Card>
    );
  }

  const colorOf = new Map<string, string>();
  const ringRows = rows.length > 6 ? rows.slice(0, 5) : rows;
  ringRows.forEach((r, i) => colorOf.set(r.accountId, CATEGORY_COLORS[i] ?? OTHER_COLOR));
  const otherAmount = rows.length > 6 ? rows.slice(5).reduce((sum, r) => sum + BigInt(r.amount), 0n) : 0n;
  const segments = [
    ...ringRows.map((r) => ({ key: r.accountId, label: `${r.code} · ${r.name}`, value: Number(BigInt(r.amount)), color: colorOf.get(r.accountId)!, formattedValue: fmt(r.amount) })),
    ...(otherAmount > 0n ? [{ key: "other", label: "Other", value: Number(otherAmount), color: OTHER_COLOR, formattedValue: fmt(otherAmount) }] : []),
  ];

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-on-surface">Cost by category</h3>
        <span className="text-[13px] text-on-surface-muted">From bills and approved expenses tagged to this job</span>
      </div>
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <DonutChart segments={segments} legend={false} aria-label="Cost by category" centerLabel={fmt(report.cost)} className="shrink-0" />
        <table className="w-full text-[14px]">
          <caption className="sr-only">Cost by category</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Account</th>
              <th scope="col">Amount</th>
              <th scope="col">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const label = `${r.code} · ${r.name}`;
              return (
                <tr key={r.accountId} className="border-t border-border">
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colorOf.get(r.accountId) ?? OTHER_COLOR }} aria-hidden />
                      {canDrill ? (
                        <button type="button" onClick={() => setDrill({ accountId: r.accountId, label })} className="text-left text-on-surface hover:text-primary hover:underline">
                          {label}
                        </button>
                      ) : (
                        <span className="text-on-surface">{label}</span>
                      )}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-on-surface">{fmt(r.amount)}</td>
                  <td className="w-16 py-2 text-right tabular-nums text-on-surface-muted">{r.sharePct}%</td>
                </tr>
              );
            })}
            <tr className="border-t border-border font-semibold">
              <td className="py-2 text-on-surface">Total cost</td>
              <td className="py-2 text-right tabular-nums text-on-surface">{fmt(report.cost)}</td>
              <td className="py-2 text-right tabular-nums text-on-surface">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
      {drill && (
        <DrilldownDialog accountId={drill.accountId} accountLabel={drill.label} from="2000-01-01" to="2999-12-31" currency={report.currency} jobId={jobId} onClose={() => setDrill(null)} />
      )}
    </Card>
  );
}
