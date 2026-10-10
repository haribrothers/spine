"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@spine/ui";
import type { UnbilledWork } from "@spine/shared";
import { apiClient } from "../../../../lib/api-client";
import { formatMoney } from "../../../../lib/money";
import { useDashboardCurrency } from "../dashboard-currency";
import { WidgetSkeleton } from "../dashboard-skeleton";

/**
 * US-DASH-24 (D-160) — `DashboardOwnerBooks` › Ready to bill: completed
 * milestones not invoiced and approved billable expenses not billed, each
 * opening its list. Only billable expenses when Jobs & field is off. Not
 * shown without `reports.view_receivables`.
 */
export function ReadyToBillCard() {
  const [data, setData] = useState<UnbilledWork | null>(null);
  const [failed, setFailed] = useState(false);
  const orgCurrency = useDashboardCurrency();
  const currency = orgCurrency ?? "USD";
  const [jobsOpen, setJobsOpen] = useState(false);

  useEffect(() => {
    apiClient
      .get<UnbilledWork>("/dashboard/unbilled")
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  const money = (minor: string) => formatMoney(BigInt(minor), currency);
  const nothing = data && (data.milestones?.count ?? 0) === 0 && data.billableExpenses.count === 0;

  return (
    <Card data-testid="ready-to-bill">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-[15px]">
          Ready to bill
          <Link href="/invoices" className="text-[13px] font-normal text-primary hover:underline">
            Invoices
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data || !orgCurrency ? (
          <WidgetSkeleton kind="line" />
        ) : nothing ? (
          <p className="py-6 text-center text-[14px] text-on-surface-muted">Nothing waiting to be billed.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-[14px]">
            {data.milestones && data.milestones.count > 0 && (
              <li className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <button type="button" className="text-left text-primary hover:underline" onClick={() => setJobsOpen(true)}>
                  Completed milestones not invoiced · {data.milestones.count}
                </button>
                <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-on-surface">{money(data.milestones.amount)}</span>
              </li>
            )}
            {data.billableExpenses.count > 0 && (
              <li className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <Link href="/expenses?billable=unbilled" className="text-primary hover:underline">
                  Approved billable expenses not billed · {data.billableExpenses.count}
                </Link>
                <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-on-surface">{money(data.billableExpenses.amount)}</span>
              </li>
            )}
          </ul>
        )}
      </CardContent>
      <Dialog open={jobsOpen} onOpenChange={setJobsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completed milestones not invoiced</DialogTitle>
            <DialogDescription>Open a job to invoice its completed milestones.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ul className="flex flex-col divide-y divide-border text-[14px]" data-testid="ready-to-bill-jobs">
              {data?.milestones?.jobs.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/jobs/${j.id}?tab=milestones`} className="text-primary hover:underline">
                    {j.number ? `${j.number} · ${j.name}` : j.name}
                  </Link>
                  <span className="whitespace-nowrap tabular-nums text-on-surface">
                    {j.count} · {money(j.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
