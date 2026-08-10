"use client";

import { useEffect, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import Link from "next/link";
import { apiClient } from "../../../../lib/api-client";

interface InvoiceDueRow {
  id: string;
  number: string | null;
  contactName: string | null;
  currency: string;
  dueDate: string | null;
  balanceDue: string;
  daysOverdue: number;
}

function dueLabel(dueDate: string | null): string {
  if (!dueDate) return "";
  const days = Math.round((new Date(dueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

/**
 * S-09.12 (dashboard v2) — "invoices due this week." Reads Stage 1's new
 * `GET /reports/invoices-due-this-week`, a thin filter over `receivables()`
 * — no new balance logic, same figures the Receivables page itself shows.
 */
export function InvoicesDue() {
  const [rows, setRows] = useState<InvoiceDueRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient
      .get<InvoiceDueRow[]>("/reports/invoices-due-this-week")
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
          Invoices due this week
          <Link href="/receivables" className="text-[13px] font-normal text-primary hover:underline">
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
          <p className="py-4 text-center text-[13px] text-on-surface-muted">Nothing due this week.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {rows.map((row) => (
              <Link key={row.id} href={`/invoices/${row.id}`} className="flex items-center justify-between gap-3 rounded-sm px-1 py-1.5 text-[13px] hover:bg-surface-secondary">
                <div className="flex flex-col">
                  <span className="text-on-surface">{row.number ?? "Draft"}</span>
                  <span className="text-[11px] text-on-surface-muted">{row.contactName ?? "—"}</span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono tabular-nums text-on-surface">
                    {toDecimalString({ amount: BigInt(row.balanceDue), currency: row.currency })} {row.currency}
                  </span>
                  <Badge className="bg-due-soon-bg text-due-soon">{dueLabel(row.dueDate)}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
