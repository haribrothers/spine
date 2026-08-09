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
import { toDecimalString } from "@spine/shared/money";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import { PAYMENT_METHOD_LABELS, type Payment } from "./types";

/**
 * Read-only detail Drawer — a payment has no draft/edit lifecycle (see
 * payments.ts's own schema comment: it's a single atomic "record a
 * payment" action, not a document), so this only ever shows/deletes, never
 * edits, unlike CatalogItemDrawer's create-or-edit form. Only an
 * unallocated payment (`allocatedAmount === "0"`) can be deleted — see
 * PaymentsService.delete's own guard; the Delete button is hidden entirely
 * otherwise rather than shown-then-rejected.
 */
export function PaymentDetailDrawer({
  open,
  onOpenChange,
  paymentId,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string | null;
  onDeleted: (payment: Payment) => void;
}) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const canDelete = payment && payment.allocatedAmount === "0";

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
                  <Field label="Reference" value={payment.reference ?? "—"} />
                  <Field
                    label="Amount"
                    value={`${toDecimalString({ amount: BigInt(payment.amount), currency: payment.currency })} ${payment.currency}`}
                  />
                  <Field
                    label="Allocated"
                    value={`${toDecimalString({ amount: BigInt(payment.allocatedAmount), currency: payment.currency })} ${payment.currency}`}
                  />
                  <Field
                    label="Unallocated"
                    value={`${toDecimalString({ amount: BigInt(payment.unallocatedAmount), currency: payment.currency })} ${payment.currency}`}
                  />
                </div>

                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-on-surface-muted">Allocated to</h3>
                  {!payment.allocations?.length ? (
                    <p className="text-[13px] text-on-surface-muted">
                      Not allocated to any invoice — held entirely as unallocated customer credit (S-06.4).
                    </p>
                  ) : (
                    <div className="flex flex-col divide-y divide-border">
                      {payment.allocations.map((a) => (
                        <div key={a.id} className="flex items-center justify-between py-2">
                          <Link href={`/invoices/${a.invoiceId}`} className="text-[13px] font-medium text-on-surface hover:text-primary hover:underline">
                            {a.invoiceNumber ?? "Invoice"}
                          </Link>
                          <span className="font-mono text-[13px] tabular-nums text-on-surface">
                            {toDecimalString({ amount: BigInt(a.amount), currency: payment.currency })} {payment.currency}
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
          </DrawerBody>
          <DrawerFooter>
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
            <AlertDialogAction disabled={busy} onClick={handleDelete}>
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
