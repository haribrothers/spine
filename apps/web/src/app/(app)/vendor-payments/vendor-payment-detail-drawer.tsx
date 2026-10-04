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
import { useCanEditOwnership } from "../../../lib/capabilities-context";
import { HistorySection } from "../../../components/history-section";
import { PAYMENT_METHOD_LABELS, type VendorPayment } from "./types";
import { formatMoney } from "../../../lib/money";

/**
 * Read-only detail Drawer — a vendor payment has no draft/edit lifecycle
 * (single atomic "record a payment" action, same as the customer side),
 * mirroring payments/payment-detail-drawer.tsx exactly, minus "Download
 * PDF"/"Email receipt" (no such story for vendor payments — no document
 * is ever generated or sent) and minus "Apply credit" (no vendor-credit
 * concept in this phase, per createVendorPaymentSchema's own doc comment).
 * Only a payment with nothing allocated can be deleted — see
 * VendorPaymentsService.delete's own guard; in practice this schema
 * requires full allocation at create time, so the Delete button is kept
 * for symmetry/defensive cleanup only, same as the service's own comment.
 */
export function VendorPaymentDetailDrawer({
  open,
  onOpenChange,
  paymentId,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string | null;
  onDeleted: (payment: VendorPayment) => void;
}) {
  const [payment, setPayment] = useState<VendorPayment | null>(null);
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
      .get<VendorPayment>(`/vendor-payments/${paymentId}`)
      .then(setPayment)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load payment."));
  }, [open, paymentId]);

  async function handleDelete() {
    if (!payment) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.delete(`/vendor-payments/${payment.id}`);
      setConfirmOpen(false);
      onOpenChange(false);
      onDeleted(payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this payment.");
    } finally {
      setBusy(false);
    }
  }

  const hasDeleteCapability = useCanEditOwnership(payment?.createdByUserId ?? null, {
    own: "vendor_payments.delete_own",
    others: "vendor_payments.delete_others",
  });
  const canDelete = payment && payment.allocatedAmount === "0" && hasDeleteCapability;

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
                    value={formatMoney(BigInt(payment.amount), payment.currency)}
                  />
                </div>

                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-on-surface-muted">Allocated to</h3>
                  {!payment.allocations?.length ? (
                    <p className="text-[13px] text-on-surface-muted">No allocations recorded.</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-border">
                      {payment.allocations.map((a) => (
                        <div key={a.id} className="flex items-center justify-between py-2">
                          <Link href={`/vendor-bills/${a.billId}`} className="text-[13px] font-medium text-on-surface hover:text-primary hover:underline">
                            {a.billNumber ?? "Vendor bill"}
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
          </DrawerBody>
          <DrawerFooter>
            {payment && <HistorySection endpoint={`/vendor-payments/${payment.id}/history`} subjectLabel="this vendor payment" />}
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
