"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, DatePicker, Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, Label, Spinner, Tabs, TabsList, TabsTrigger } from "@spine/ui";
import { canOpenReport, REPORTS, type AnalysisDocumentRef } from "@spine/shared";
import { apiClient } from "../../../lib/api-client";
import { useCapabilities } from "../../../lib/capabilities-context";
import { formatMoney } from "../../../lib/money";
import { useMyRole } from "../../../lib/role-context";

export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const day = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/** The first day of the current quarter. */
export function quarterStart(): Date {
  const today = new Date();
  return new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
}

/** The organisation's currency, USD until it loads. */
export function useCurrency(): string {
  const [currency, setCurrency] = useState("USD");
  useEffect(() => {
    apiClient
      .get<{ value: { code: string } | null }>("/org/settings/currency")
      .then((res) => res.value?.code && setCurrency(res.value.code))
      .catch(() => {});
  }, []);
  return currency;
}

/** Two reports on one screen, each its own page: the tabs switch between them. A tab the person can't open isn't shown. */
export function ReportTabs({ value, tabs }: { value: string; tabs: { value: string; label: string; href: string }[] }) {
  const router = useRouter();
  const role = useMyRole();
  const { capabilities } = useCapabilities();
  const visible = tabs.filter((t) => {
    const report = REPORTS.find((r) => r.href === t.href);
    return t.value === value || !report || canOpenReport(report, role, capabilities);
  });
  if (visible.length < 2) return null;
  return (
    <Tabs value={value} onValueChange={(v) => router.push(tabs.find((t) => t.value === v)!.href)}>
      <TabsList>
        {visible.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

/** From, To and Refresh, with the page's actions (Export) on the right. */
export function RangeBar({
  from,
  to,
  onFrom,
  onTo,
  onRefresh,
  loading,
  actions,
}: {
  from: Date;
  to: Date;
  onFrom: (d: Date) => void;
  onTo: (d: Date) => void;
  onRefresh: () => void;
  loading: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>From</Label>
        <DatePicker value={from} onChange={(d) => d && onFrom(d)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>To</Label>
        <DatePicker value={to} onChange={(d) => d && onTo(d)} />
      </div>
      <Button variant="secondary" onClick={onRefresh} disabled={loading}>
        {loading ? <Spinner size="sm" /> : "Refresh"}
      </Button>
      {actions && <div className="ml-auto">{actions}</div>}
    </div>
  );
}

/** The documents behind a row, each opening on click. */
export function DocumentsDialog({ title, description, documents, currency, onClose }: { title: string; description: string; documents: AnalysisDocumentRef[] | null; currency: string; onClose: () => void }) {
  return (
    <Dialog open={documents !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {documents?.length === 0 ? (
            <p className="text-[14px] text-on-surface-muted">No documents in this range.</p>
          ) : (
            <table className="w-full text-[14px]" data-testid="analysis-documents">
              <thead>
                <tr className="border-b border-border text-left text-on-surface-muted">
                  <th className="py-2 font-medium">Number</th>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {documents?.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="py-2">
                      <Link href={d.href} className="text-primary hover:underline">
                        {d.number ?? "Draft"}
                      </Link>
                    </td>
                    <td className="py-2 text-on-surface">{day(d.date)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(d.total, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
