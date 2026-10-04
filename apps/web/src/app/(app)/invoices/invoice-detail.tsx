"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  RichTextContent,
  Spinner,
} from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { HistorySection } from "../../../components/history-section";
import { CreateCreditNoteDialog } from "./create-credit-note-dialog";
import { CreditNotesSection } from "./credit-notes-section";
import { useEntityToast } from "./entity-toast";
import { PaymentsSection } from "./payments-section";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { INVOICE_STATUS_LABELS, PAYMENT_STATUS_LABELS, type Invoice } from "./types";

/**
 * `GET /invoices/:id/pdf` streams a binary PDF, not JSON — `apiClient`
 * always JSON-parses responses, so this opens the route directly in a new
 * tab instead, matching quotes/quote-detail.tsx's own `quotePdfUrl`.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
function invoicePdfUrl(invoiceId: string): string {
  return `${API_URL}/invoices/${invoiceId}/pdf`;
}

const STATUS_BADGE_CLASS: Record<Invoice["status"], string> = {
  draft: "bg-draft-bg text-draft",
  issued: "bg-due-soon-bg text-due-soon",
  void: "bg-overdue-bg text-overdue",
};

/**
 * Detail view for an invoice — full line breakdown, totals (including a
 * "Paid"/"Balance due" pair once anything's been paid, mirroring
 * InvoicePdfDocument's own presentation), and status. Offers: Edit (draft
 * only), Issue Invoice (draft only), Void (issued only — requires a
 * reason, S-05.8), Delete draft (draft only), and Record payment (issued
 * with a balance still owing — opens RecordPaymentDialog).
 */
export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentsRefreshKey, setPaymentsRefreshKey] = useState(0);
  const [creditNoteOpen, setCreditNoteOpen] = useState(false);
  const [creditNotesRefreshKey, setCreditNotesRefreshKey] = useState(0);
  const { show: showToast, toast } = useEntityToast();

  const hasEditCapability = useCanEditOwnership(invoice?.createdByUserId ?? null, { own: "invoices.edit_own", others: "invoices.edit_others" });
  const hasDeleteCapability = useCanEditOwnership(invoice?.createdByUserId ?? null, { own: "invoices.delete_own", others: "invoices.delete_others" });
  const hasIssueCapability = useCapability("invoices.issue");
  const hasVoidCapability = useCapability("invoices.void");
  const hasSendCapability = useCapability("invoices.send");
  const hasSendReminderCapability = useCapability("invoices.send_reminder");
  const hasRecordPaymentCapability = useCapability("payments.edit_own");
  const hasIssueCreditNoteCapability = useCapability("credit_notes.issue");

  const load = useCallback(() => {
    apiClient
      .get<Invoice>(`/invoices/${invoiceId}`)
      .then(setInvoice)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load invoice."));
  }, [invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  // S-05.7's email is sent by a queued worker, out of band from the
  // request that triggered it (see handleSendEmail's own comment) — same
  // polling pattern as quote-detail.tsx's own emailStatus effect, so "was
  // it sent?" resolves on its own without a manual refresh.
  useEffect(() => {
    if (invoice?.emailStatus !== "pending") return;
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [invoice?.emailStatus, load]);

  async function handleIssue() {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Invoice>(`/invoices/${invoice.id}/issue`);
      setInvoice(updated);
      showToast("Invoice issued", `${updated.number} has been issued and posted to the ledger.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not issue this invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendEmail() {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Invoice>(`/invoices/${invoice.id}/send-email`);
      setInvoice(updated);
      showToast(
        "Emailing invoice",
        updated.contactName
          ? `Sending ${updated.number} to ${updated.contactName} has been queued.`
          : `Sending ${updated.number} has been queued.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not email this invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendReminder() {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiClient.post<Invoice>(`/invoices/${invoice.id}/send-reminder`);
      setInvoice(updated);
      showToast(
        "Reminder sent",
        updated.contactName ? `A reminder for ${updated.number} has been queued to ${updated.contactName}.` : `A reminder for ${updated.number} has been queued.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send this reminder.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVoid() {
    if (!invoice) return;
    if (!voidReason.trim()) {
      setVoidError("A reason is required to void an invoice.");
      return;
    }
    setBusy(true);
    setVoidError(null);
    try {
      const updated = await apiClient.post<Invoice>(`/invoices/${invoice.id}/void`, { reason: voidReason.trim() });
      setInvoice(updated);
      setVoidOpen(false);
      setVoidReason("");
      showToast("Invoice voided", `${updated.number} has been voided and a reversing entry posted.`);
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : "Could not void this invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/invoices/${invoice.id}`);
      router.push("/invoices");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this invoice.");
      setBusy(false);
    }
  }

  if (error && !invoice) {
    return (
      <Alert variant="critical">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!invoice) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const canEdit = invoice.status === "draft" && hasEditCapability;
  const canDelete = invoice.status === "draft" && hasDeleteCapability;
  const canIssue = invoice.status === "draft" && hasIssueCapability;
  const canVoid = invoice.status === "issued" && hasVoidCapability;
  const canSendEmail = invoice.status === "issued" && hasSendCapability;
  const canSendReminder = invoice.isOverdue && hasSendReminderCapability;
  const balanceDue = BigInt(invoice.balanceDue);
  const amountPaid = BigInt(invoice.amountPaid);
  // S-05.4 — an advance invoice never posts to AR on issue (see
  // InvoicesService.issue's own doc comment), so it has no real ledger
  // balance to record a payment or credit note against — that money
  // flows through PaymentsService.create's own "Advance received"
  // posting (S-06.4, record the deposit as an unallocated payment)
  // instead, not through this invoice.
  const canRecordPayment = invoice.status === "issued" && balanceDue > 0n && invoice.type !== "advance" && hasRecordPaymentCapability;
  const canIssueCreditNote = invoice.status === "issued" && balanceDue > 0n && invoice.type !== "advance" && hasIssueCreditNoteCapability;
  const creditedAmount = BigInt(invoice.creditedAmount);

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/invoices")}
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-on-surface-muted transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={14} />
        Back to invoices
      </button>

      {error && (
        <Alert variant="critical">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-semibold text-on-surface">{invoice.number ?? "Draft invoice"}</h2>
              <Badge className={STATUS_BADGE_CLASS[invoice.status]}>{INVOICE_STATUS_LABELS[invoice.status]}</Badge>
              {invoice.type === "advance" && <Badge className="bg-draft-bg text-draft">Deposit</Badge>}
              {invoice.isOverdue && <Badge className="bg-overdue-bg text-overdue">Overdue</Badge>}
          {PAYMENT_STATUS_LABELS[invoice.paymentStatus] && (
            <Badge className={invoice.paymentStatus === "paid" ? "bg-paid-bg text-paid" : "bg-due-soon-bg text-due-soon"}>{PAYMENT_STATUS_LABELS[invoice.paymentStatus]}</Badge>
          )}
            </div>
            <p className="mt-1 text-[13px] text-on-surface-muted">
              {invoice.contactName ?? "Unknown contact"}
              {invoice.dueDate && <> · Due {new Date(invoice.dueDate).toLocaleDateString()}</>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HistorySection endpoint={`/invoices/${invoice.id}/history`} subjectLabel="this invoice" />
            <Button variant="secondary" asChild>
              <a href={invoicePdfUrl(invoice.id)} target="_blank" rel="noreferrer">
                {invoice.status === "draft" ? "Preview PDF" : "Download PDF"}
              </a>
            </Button>
            {canEdit && (
              <Button variant="secondary" asChild>
                <Link href={`/invoices/${invoice.id}/edit`}>Edit</Link>
              </Button>
            )}
            {canIssue && (
              <Button onClick={handleIssue} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Issue Invoice"}
              </Button>
            )}
            {canRecordPayment && (
              <Button onClick={() => setPaymentOpen(true)} disabled={busy}>
                Record payment
              </Button>
            )}
            {canIssueCreditNote && (
              <Button variant="secondary" onClick={() => setCreditNoteOpen(true)} disabled={busy}>
                Issue credit note
              </Button>
            )}
            {canSendEmail && (
              <Button variant="secondary" onClick={handleSendEmail} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Email invoice"}
              </Button>
            )}
            {canSendReminder && (
              <Button variant="secondary" onClick={handleSendReminder} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Send reminder"}
              </Button>
            )}
            {canVoid && (
              <Button variant="ghost" onClick={() => setVoidOpen(true)} disabled={busy}>
                Void
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" onClick={handleDelete} disabled={busy}>
                Delete draft
              </Button>
            )}
          </div>
        </div>

        {invoice.status === "void" && invoice.voidReason && (
          <Alert variant="warning">
            <AlertDescription>
              Voided{invoice.voidedAt && <> on {new Date(invoice.voidedAt).toLocaleString()}</>}: {invoice.voidReason}
            </AlertDescription>
          </Alert>
        )}

        {/* S-05.7 — "was the email sent?", same pattern as quote-detail.tsx's own emailStatus block. Nothing renders until Email invoice has been clicked at least once (emailStatus is null until then). */}
        {invoice.emailStatus === "pending" && (
          <p className="flex items-center gap-1.5 text-[13px] text-on-surface-muted">
            <Clock size={14} className="shrink-0" />
            Sending email to {invoice.contactName ?? "the contact"}…
          </p>
        )}
        {invoice.emailStatus === "sent" && (
          <p className="flex items-center gap-1.5 text-[13px] text-paid">
            <CheckCircle2 size={14} className="shrink-0" />
            Emailed to {invoice.contactName ?? "the contact"}
            {invoice.emailSentAt && <> on {new Date(invoice.emailSentAt).toLocaleString()}</>}.
          </p>
        )}
        {invoice.emailStatus === "failed" && (
          <Alert variant="critical">
            <AlertDescription className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 font-medium">
                <XCircle size={14} className="shrink-0" />
                Email delivery failed
              </span>
              {invoice.emailError && <span className="text-[13px]">{invoice.emailError}</span>}
            </AlertDescription>
          </Alert>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 className="text-[14px] font-semibold text-on-surface">Lines</h3>
        <div className="flex flex-col divide-y divide-border">
          {(invoice.lines ?? []).map((line) => (
            <div key={line.id} className="flex items-start justify-between gap-4 py-2">
              <div>
                <p className={line.type === "heading" ? "font-semibold text-on-surface" : "text-on-surface"}>{line.name}</p>
                {line.description && <p className="text-[13px] text-on-surface-muted">{line.description}</p>}
                {line.type === "item" && (
                  <p className="text-[12px] text-on-surface-muted">
                    {line.quantity} × {toDecimalString({ amount: BigInt(line.unitPriceAmount), currency: invoice.currency })}
                    {line.discountPercentage > 0 && <> · {line.discountPercentage}% off</>}
                    {line.taxRatePercentage > 0 && <> · {line.taxRatePercentage}% tax</>}
                  </p>
                )}
              </div>
              {line.type === "item" && (
                <span className="shrink-0 font-mono tabular-nums text-on-surface">
                  {toDecimalString({ amount: BigInt(line.lineTotalAmount), currency: invoice.currency })}
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <PaymentsSection invoiceId={invoice.id} refreshKey={paymentsRefreshKey} />
      <CreditNotesSection invoiceId={invoice.id} refreshKey={creditNotesRefreshKey} />

      <Card className="ml-auto flex w-full max-w-sm flex-col gap-2 sm:w-80">
        <TotalRow label="Subtotal" value={invoice.subtotalAmount} currency={invoice.currency} />
        <TotalRow
          label="Discount"
          value={`-${toDecimalString({ amount: BigInt(invoice.discountAmount), currency: invoice.currency })}`}
          currency=""
          raw
        />
        <TotalRow label="Tax" value={invoice.taxAmount} currency={invoice.currency} />
        <div className="border-t border-border pt-2">
          <TotalRow label="Total" value={invoice.totalAmount} currency={invoice.currency} emphasize />
        </div>
        {amountPaid > 0n && (
          <TotalRow label="Paid" value={`-${toDecimalString({ amount: amountPaid, currency: invoice.currency })}`} currency="" raw />
        )}
        {creditedAmount > 0n && (
          <TotalRow label="Credited" value={`-${toDecimalString({ amount: creditedAmount, currency: invoice.currency })}`} currency="" raw />
        )}
        {(amountPaid > 0n || creditedAmount > 0n) && (
          <div className="border-t border-border pt-2">
            <TotalRow label="Balance due" value={invoice.balanceDue} currency={invoice.currency} emphasize critical />
          </div>
        )}
      </Card>

      {(invoice.notes || invoice.termsAndConditions) && (
        <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {invoice.notes && (
            <div>
              <h3 className="text-[13px] font-semibold text-on-surface-muted">Notes</h3>
              <RichTextContent html={invoice.notes} />
            </div>
          )}
          {invoice.termsAndConditions && (
            <div>
              <h3 className="text-[13px] font-semibold text-on-surface-muted">Terms & conditions</h3>
              <RichTextContent html={invoice.termsAndConditions} />
            </div>
          )}
        </Card>
      )}

      {/* S-05.8 — void requires a reason; the API rejects an empty one, so this is a required field, not optional. */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void this invoice?</DialogTitle>
            <DialogDescription>
              Posts a reversing journal entry and marks {invoice.number} as void. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {voidError && (
              <Alert variant="critical">
                <AlertDescription>{voidError}</AlertDescription>
              </Alert>
            )}
            <FormField label="Reason" required>
              {(field) => (
                <Input
                  {...field}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Why is this invoice being voided?"
                />
              )}
            </FormField>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setVoidOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={handleVoid} disabled={busy}>
              {busy ? <Spinner size="sm" /> : "Void invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RecordPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        contactId={invoice.contactId}
        contactName={invoice.contactName}
        presetInvoiceId={invoice.id}
        presetBalanceDue={balanceDue}
        onRecorded={() => {
          load();
          setPaymentsRefreshKey((key) => key + 1);
          showToast("Payment recorded", "The invoice's balance has been updated.");
        }}
      />

      <CreateCreditNoteDialog
        open={creditNoteOpen}
        onOpenChange={setCreditNoteOpen}
        invoiceId={invoice.id}
        currency={invoice.currency}
        maxAmount={balanceDue}
        onIssued={() => {
          load();
          setCreditNotesRefreshKey((key) => key + 1);
          showToast("Credit note issued", "The invoice's balance has been updated.");
        }}
      />

      {toast}
    </div>
  );
}

function TotalRow({
  label,
  value,
  currency,
  emphasize,
  raw,
  critical,
}: {
  label: string;
  value: string;
  currency: string;
  emphasize?: boolean;
  raw?: boolean;
  critical?: boolean;
}) {
  const display = raw ? value : `${toDecimalString({ amount: BigInt(value), currency })} ${currency}`;
  return (
    <div className="flex items-center justify-between">
      <span className={emphasize ? "text-[14px] font-semibold text-on-surface" : "text-[13px] text-on-surface-muted"}>
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${emphasize ? "text-[16px] font-bold" : "text-[14px]"} ${critical ? "text-overdue" : "text-on-surface"}`}
      >
        {display}
      </span>
    </div>
  );
}
