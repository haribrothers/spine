"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Spinner,
} from "@spine/ui";
import { apiClient } from "../../../lib/api-client";
import { HistorySection } from "../../../components/history-section";
import type { CreditNote } from "./types";
import { formatMoney } from "../../../lib/money";
import { AttachmentsSection } from "../../../components/attachments-section";

/** US-INV-17 — opened in a new tab: the route streams a PDF, not JSON. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const STATUS_BADGE_CLASS: Record<CreditNote["status"], string> = {
  draft: "bg-draft-bg text-draft",
  issued: "bg-due-soon-bg text-due-soon",
};

/**
 * A minimal credit-note detail view — credit notes have no standalone list
 * page or route (only reachable as rows inside an invoice's own
 * `credit-notes-section.tsx`, since S-05.6 never asked for one), so this
 * is a Drawer opened from that row rather than a full page, matching
 * `payment-detail-drawer.tsx`'s own precedent for a document type that's
 * simple enough not to need a dedicated route. Built specifically to give
 * `HistorySection` somewhere to live (§9's "no `GET /:id/history` endpoint
 * for invoices, credit notes, or payments" gap) — read-only, no edit/void
 * actions here, since a credit note has none once issued (see
 * CreditNotesService's own immutability comments) and this component never
 * renders for a draft (credit-notes-section.tsx only lists issued ones).
 */
export function CreditNoteDetailDrawer({
  creditNoteId,
  onOpenChange,
}: {
  creditNoteId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [creditNote, setCreditNote] = useState<CreditNote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!creditNoteId) {
      setCreditNote(null);
      return;
    }
    setCreditNote(null);
    setError(null);
    apiClient
      .get<CreditNote>(`/credit-notes/${creditNoteId}`)
      .then(setCreditNote)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load this credit note."));
  }, [creditNoteId]);

  return (
    <Drawer open={creditNoteId !== null} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{creditNote?.number ?? "Credit note"}</DrawerTitle>
          <DrawerDescription>{creditNote?.contactName ?? "—"}</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          {error && (
            <Alert variant="critical">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!creditNote ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <Badge className={STATUS_BADGE_CLASS[creditNote.status]}>{creditNote.status === "issued" ? "Issued" : "Draft"}</Badge>
                {creditNote.issuedAt && <span className="text-[12px] text-on-surface-muted">Issued {new Date(creditNote.issuedAt).toLocaleDateString()}</span>}
              </div>

              {creditNote.reason && (
                <div>
                  <h3 className="mb-1 text-[13px] font-semibold text-on-surface-muted">Reason</h3>
                  <p className="text-[13px] text-on-surface">{creditNote.reason}</p>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-[13px] font-semibold text-on-surface-muted">Lines</h3>
                <div className="flex flex-col divide-y divide-border">
                  {creditNote.lines.map((line) => (
                    <div key={line.id} className="flex items-center justify-between gap-4 py-2 text-[13px]">
                      <span className="text-on-surface">{line.name}</span>
                      <span className="shrink-0 tabular-nums text-on-surface">
                        {formatMoney(BigInt(line.lineTotalAmount), creditNote.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3 text-[13px] font-semibold">
                <span className="text-on-surface">Total</span>
                <span className="tabular-nums text-overdue">
                  {formatMoney(-BigInt(creditNote.totalAmount), creditNote.currency)}
                </span>
              </div>

              {/* US-PAY-16: the part held as customer credit, still to apply or refund. */}
              {BigInt(creditNote.creditRemainingAmount ?? "0") > 0n && (
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-on-surface-muted">Credit for the customer</span>
                  <span className="tabular-nums text-on-surface">{formatMoney(BigInt(creditNote.creditRemainingAmount!), creditNote.currency)}</span>
                </div>
              )}

              {creditNote.invoiceNumber && (
                <a href={`/invoices/${creditNote.invoiceId}`} className="text-[13px] text-primary hover:underline">
                  View source invoice ({creditNote.invoiceNumber})
                </a>
              )}
            </div>
          )}
          {creditNote && (
            <div className="mt-5">
              <AttachmentsSection entityType="credit_note" entityId={creditNote.id} />
            </div>
          )}
        </DrawerBody>
        <DrawerFooter>
          {creditNote && <HistorySection endpoint={`/credit-notes/${creditNote.id}/history`} subjectLabel="this credit note" />}
          {creditNote && (
            <Button variant="secondary" asChild>
              <a href={`${API_URL}/credit-notes/${creditNote.id}/pdf`} target="_blank" rel="noreferrer">
                {creditNote.status === "draft" ? "Preview PDF" : "Download PDF"}
              </a>
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
