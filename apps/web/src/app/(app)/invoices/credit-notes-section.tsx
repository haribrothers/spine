"use client";

import { useEffect, useState } from "react";
import { Card, Spinner } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { apiClient } from "../../../lib/api-client";

interface CreditNoteRow {
  id: string;
  number: string | null;
  status: "draft" | "issued";
  reason: string | null;
  currency: string;
  totalAmount: string;
  issuedAt: string | null;
}

/**
 * Every credit note issued against this invoice — mirrors payments-
 * section.tsx's own shape (read-only summary, "no credit notes yet" when
 * empty, no per-row detail/delete here since a credit note is a small,
 * mostly-write-once record — S-05.6 doesn't ask for a dedicated detail
 * page/drawer the way payments' own S-06.x stories do).
 */
export function CreditNotesSection({ invoiceId, refreshKey }: { invoiceId: string; refreshKey: number }) {
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCreditNotes(null);
    apiClient
      .get<CreditNoteRow[]>(`/credit-notes?invoiceId=${invoiceId}`)
      .then(setCreditNotes)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load credit notes."));
  }, [invoiceId, refreshKey]);

  if (error) return null; // non-critical subsection — a failure here shouldn't block the rest of the invoice page

  const issued = (creditNotes ?? []).filter((cn) => cn.status === "issued");
  if (creditNotes !== null && issued.length === 0) return null; // nothing to show — same "don't render an empty section" posture the invoice page already takes for optional blocks

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-[14px] font-semibold text-on-surface">Credit notes</h3>
      {!creditNotes ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {issued.map((cn) => (
            <div key={cn.id} className="flex items-center justify-between gap-4 py-2">
              <div>
                <span className="text-[13px] font-medium text-on-surface">{cn.number ?? "Credit note"}</span>
                {cn.reason && <p className="text-[12px] text-on-surface-muted">{cn.reason}</p>}
              </div>
              <span className="shrink-0 font-mono text-[13px] tabular-nums text-overdue">
                -{toDecimalString({ amount: BigInt(cn.totalAmount), currency: cn.currency })} {cn.currency}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
