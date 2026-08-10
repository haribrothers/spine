"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { apiClient } from "../../../lib/api-client";

interface DashboardSummaryReport {
  cashPosition: string;
  totalReceivables: string;
  overdueInvoiceCount: number;
  monthRevenue: string;
}

/**
 * S-09.10 — "a dashboard with cash position, receivables, overdue count
 * and month revenue, so one screen tells me how things stand." Backed by
 * `GET /reports/dashboard-summary` (`dashboard.view`-gated, same as every
 * other Staff-reachable report) — renders nothing on a 403/error rather
 * than showing a broken card row, since a Field user never reaches this
 * page at all and a Staff user without the grant just sees the checklist
 * below with no KPI row, matching every other pane's "no client-side
 * capability check, degrade quietly" convention.
 */
export function DashboardSummary() {
  const [report, setReport] = useState<DashboardSummaryReport | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => {
        if (res.value?.code) setCurrency(res.value.code);
      })
      .catch(() => {});
    apiClient
      .get<DashboardSummaryReport>("/reports/dashboard-summary")
      .then(setReport)
      .catch(() => setFailed(true));
  }, []);

  if (failed || !report) {
    return null;
  }

  const money = (amount: string) => `${toDecimalString({ amount: BigInt(amount), currency })} ${currency}`;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="Cash position" value={money(report.cashPosition)} />
      <StatCard label="Receivables" value={money(report.totalReceivables)} />
      <StatCard label="Overdue invoices" value={String(report.overdueInvoiceCount)} />
      <StatCard label="Revenue this month" value={money(report.monthRevenue)} />
    </div>
  );
}
