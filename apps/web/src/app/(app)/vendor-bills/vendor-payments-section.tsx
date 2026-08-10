"use client";

import { useEffect, useState } from "react";
import { Card, Spinner } from "@spine/ui";
import { toDecimalString } from "@spine/shared/money";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import { PAYMENT_METHOD_LABELS, type BillVendorPaymentRow } from "./types";

/**
 * Every vendor payment allocated against this bill —
 * `GET /vendor-payments?billId=` (VendorPaymentsService.listForBill, a real
 * join through vendor_payment_allocations, not a `contactId` filter that
 * would also surface a payment touching a different bill for the same
 * vendor). Read-only: a payment's own detail/delete lives on the
 * standalone `/vendor-payments` page (linked via each row's number), not
 * duplicated here — mirrors invoices/payments-section.tsx exactly.
 */
export function VendorPaymentsSection({ billId, refreshKey }: { billId: string; refreshKey: number }) {
  const [payments, setPayments] = useState<BillVendorPaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPayments(null);
    apiClient
      .get<BillVendorPaymentRow[]>(`/vendor-payments?billId=${billId}`)
      .then(setPayments)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load payments."));
  }, [billId, refreshKey]);

  if (error) return null; // non-critical subsection — a failure here shouldn't block the rest of the bill page

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-[14px] font-semibold text-on-surface">Vendor Payments</h3>
      {!payments ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : payments.length === 0 ? (
        <p className="text-[13px] text-on-surface-muted">No payments recorded against this bill yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {payments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between gap-4 py-2">
              <div>
                <Link href="/vendor-payments" className="text-[13px] font-medium text-on-surface hover:text-primary hover:underline">
                  {payment.number ?? "Payment"}
                </Link>
                <p className="text-[12px] text-on-surface-muted">
                  {new Date(payment.date).toLocaleDateString()} · {PAYMENT_METHOD_LABELS[payment.method]}
                  {payment.reference && <> · {payment.reference}</>}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[13px] tabular-nums text-on-surface">
                {toDecimalString({ amount: BigInt(payment.allocatedToThisBill), currency: payment.currency })} {payment.currency}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
