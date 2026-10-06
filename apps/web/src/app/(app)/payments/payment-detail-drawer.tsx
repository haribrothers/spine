"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import { useCanEditOwnership, useCapability } from "../../../lib/capabilities-context";
import { HistorySection } from "../../../components/history-section";
import { ApplyCreditDialog } from "./apply-credit-dialog";
import { useEntityToast } from "./entity-toast";
import { PAYMENT_METHOD_LABELS, type Payment } from "./types";
import { formatMoney } from "../../../lib/money";
import { AttachmentsSection } from "../../../components/attachments-section";

/**
 * `GET /payments/:id/pdf` streams a binary PDF, not JSON — same reasoning
 * as invoice-detail.tsx's own `invoicePdfUrl`.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
function paymentPdfUrl(paymentId: string): string {
  return `${API_URL}/payments/${paymentId}/pdf`;
}

/**
 * Read-only detail Drawer — a payment has no draft/edit lifecycle (see
 * payments.ts's own schema comment: it's a single atomic "record a
 * payment" action, not a document), so this only ever shows/deletes, never
 * edits, unlike CatalogItemDrawer's create-or-edit form. Only an
 * unallocated payment (`allocatedAmount === "0"`) can be deleted — see
 * PaymentsService.delete's own guard; the Delete button is hidden entirely
 * otherwise rather than shown-then-rejected. S-06.6 adds "Download PDF"
 * (opens the live-rendered receipt directly, same pattern as invoices'
 * "Download PDF") and "Email receipt" (synchronous send, not queued — see
 * PaymentsService.sendReceiptEmail's own doc comment on why).
 */
export function PaymentDetailDrawer({
  open,
  onOpenChange,
  paymentId,
  onDeleted,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string | null;
  onDeleted: (payment: Payment) => void;
  /** Fired after applying credit — lets the parent list refresh its own row (unallocatedAmount changed) without a full page reload. */
  onChanged?: () => void;
}) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applyCreditOpen, setApplyCreditOpen] = useState(false);
  const { show: showToast, toast } = useEntityToast();

  function reload() {
    if (!paymentId) return;
    apiClient
      .get<Payment>(`/payments/${paymentId}`)
      .then(setPayment)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load payment."));
  }

  useEffect(() => {
    if (!open || !paymentId) {
      setPayment(null);
      return;
    }
    setError(null);
    apiClient
      .get<Payment>(`/payments/${paymentId}`)
      .then(setPayment)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load payment."));
  }, [open, paymentId]);

  async function handleDelete() {
    if (!payment) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/payments/${payment.id}`);
      setConfirmOpen(false);
      onOpenChange(false);
      onDeleted(payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this payment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendReceipt() {
    if (!payment) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/payments/${payment.id}/send-receipt`);
      showToast("Receipt sent", `The receipt for ${payment.number ?? "this payment"} has been emailed to ${payment.contactName ?? "the contact"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not email this receipt.");
    } finally {
      setBusy(false);
    }
  }

  const hasDeleteCapability = useCanEditOwnership(payment?.createdByUserId ?? null, {
    own: "payments.delete_own",
    others: "payments.delete_others",
  });
  const hasApplyCreditCapability = useCapability("payments.apply_credit");
  const hasSendReceiptCapability = useCapability("payments.send_receipt");
  const canDelete = payment && payment.allocatedAmount === "0" && hasDeleteCapability;
  const canApplyCredit = payment && payment.unallocatedAmount !== "0" && hasApplyCreditCapability;

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{payment?.number ?? "Payment"}</DrawerTitle>
            <DrawerDescription>{payment?.contactName ?? "—"}</DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            {error && (
              <Alert variant="critical">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!payment ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Date" value={new Date(payment.date).toLocaleDateString()} />
                  <Field label="Method" value={PAYMENT_METHOD_LABELS[payment.method]} />
                  {payment.moneyAccount && <Field label="Paid into" value={payment.moneyAccount.name} />}
                  <Field label="Reference" value={payment.reference ?? "—"} />
                  <Field
                    label="Amount"
                    value={formatMoney(BigInt(payment.amount), payment.currency)}
                  />
                  <Field
                    label="Allocated"
                    value={formatMoney(BigInt(payment.allocatedAmount), payment.currency)}
                  />
                  <Field
                    label="Unallocated"
                    value={formatMoney(BigInt(payment.unallocatedAmount), payment.currency)}
                  />
                </div>

                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-on-surface-muted">Allocated to</h3>
                  {!payment.allocations?.length ? (
                    <p className="text-[13px] text-on-surface-muted">
                      Not allocated to any invoice — held entirely as unallocated customer credit.
                    </p>
                  ) : (
                    <div className="flex flex-col divide-y divide-border">
                      {payment.allocations.map((a) => (
                        <div key={a.id} className="flex items-center justify-between py-2">
                          <Link href={`/invoices/${a.invoiceId}`} className="text-[13px] font-medium text-on-surface hover:text-primary hover:underline">
                            {a.invoiceNumber ?? "Invoice"}
                          </Link>
                          <span className="text-[13px] tabular-nums text-on-surface">
                            {formatMoney(BigInt(a.amount), payment.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {payment.notes && (
                  <div>
                    <h3 className="mb-1 text-[13px] font-semibold text-on-surface-muted">Notes</h3>
                    <p className="text-[13px] text-on-surface">{payment.notes}</p>
                  </div>
                )}
              </div>
            )}
            {payment && (
              <div className="mt-5">
                <AttachmentsSection entityType="payment" entityId={payment.id} />
              </div>
            )}
          </DrawerBody>
          <DrawerFooter>
            {payment && <HistorySection endpoint={`/payments/${payment.id}/history`} subjectLabel="this payment" />}
            {payment && (
              <Button variant="secondary" asChild>
                <a href={paymentPdfUrl(payment.id)} target="_blank" rel="noreferrer">
                  Download PDF
                </a>
              </Button>
            )}
            {payment && hasSendReceiptCapability && (
              <Button variant="secondary" onClick={handleSendReceipt} disabled={busy}>
                {busy ? <Spinner size="sm" /> : "Email receipt"}
              </Button>
            )}
            {canApplyCredit && (
              <Button variant="secondary" onClick={() => setApplyCreditOpen(true)} disabled={busy}>
                Apply credit
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" onClick={() => setConfirmOpen(true)} disabled={busy}>
                Delete payment
              </Button>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ApplyCreditDialog
        open={applyCreditOpen}
        onOpenChange={setApplyCreditOpen}
        payment={payment}
        onApplied={() => {
          reload();
          onChanged?.();
          showToast("Credit applied", `Credit from ${payment?.number ?? "this payment"} has been applied to the selected invoice(s).`);
        }}
      />
      {toast}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This posts a reversing journal entry and permanently removes {payment?.number ?? "this payment"}. This cannot be undone.
              {error && <span className="mt-2 block text-overdue">{error}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="danger" disabled={busy} onClick={handleDelete}>
              {busy ? <Spinner size="sm" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-on-surface-muted">{label}</span>
      <span className="text-[13px] text-on-surface">{value}</span>
    </div>
  );
}
