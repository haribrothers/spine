"use client";

import { useEffect, useState } from "react";
import { Button, Card, Spinner } from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import Link from "next/link";
import { formatMoney } from "../../../lib/money";
import { SendEmailDialog } from "../../../components/send-email-dialog";
import { useEntityToast } from "../payments/entity-toast";

interface CreditNoteRow {
  id: string;
  number: string | null;
  status: "draft" | "issued";
  reason: string | null;
  currency: string;
  totalAmount: string;
  issuedAt: string | null;
  createdByUserId: string | null;
}

/**
 * Every credit note issued against this invoice — mirrors payments-
 * section.tsx's own shape (nothing renders when there are none). Each row
 * opens the credit note's page (US-INV-38, D-219).
 */
export function CreditNotesSection({ invoiceId, refreshKey, canEmail = false }: { invoiceId: string; refreshKey: number; canEmail?: boolean }) {
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[] | null>(null);
  // US-SET-21 — emailing a credit note, from the "Credit note" email template.
  const [emailing, setEmailing] = useState<CreditNoteRow | null>(null);
  const { show: showToast, toast } = useEntityToast();
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
    <>
      <Card className="flex flex-col gap-3">
        <h3 className="text-[14px] font-semibold text-on-surface">Credit notes</h3>
        {!creditNotes ? (
          <div className="flex justify-center py-6">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {issued.map((cn) => (
              <div key={cn.id} className="flex items-center gap-2 py-2">
                <Link
                  href={`/credit-notes/${cn.id}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-4 rounded text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div>
                    <span className="text-[13px] font-medium text-on-surface">{cn.number ?? "Credit note"}</span>
                    {cn.reason && <p className="text-[12px] text-on-surface-muted">{cn.reason}</p>}
                  </div>
                  <span className="shrink-0 text-[13px] tabular-nums text-on-surface">{formatMoney(-BigInt(cn.totalAmount), cn.currency)}</span>
                </Link>
                {canEmail && (
                  <Button variant="secondary" size="sm" onClick={() => setEmailing(cn)} aria-label={`Email credit note ${cn.number ?? ""}`.trim()}>
                    Email
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      {emailing && (
        <SendEmailDialog
          open
          onOpenChange={(open) => !open && setEmailing(null)}
          title={`Email credit note ${emailing.number ?? ""}`.trim()}
          description={formatMoney(BigInt(emailing.totalAmount), emailing.currency)}
          draftPath={`/email-drafts/credit_note/${emailing.id}`}
          sendLabel="Send credit note"
          pdfLabel="Attach the credit note PDF"
          onSend={async (email) => {
            const result = await apiClient.post<{ sentTo: string }>(`/credit-notes/${emailing.id}/send-email`, email);
            showToast("Credit note emailed", `${emailing.number ?? "The credit note"} was sent to ${result.sentTo}.`);
          }}
        />
      )}
      {toast}
    </>
  );
}
