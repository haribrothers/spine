"use client";

import { useEffect, useState } from "react";
import { Card, Spinner } from "@spine/ui";
import Link from "next/link";
import { apiClient } from "../../../lib/api-client";
import { PAYMENT_METHOD_LABELS, type BillVendorPaymentRow } from "./types";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { calendarDate } from "../quotes/quotes-list-state";

/**
 * Every vendor payment allocated against this bill —
 * `GET /vendor-payments?billId=` (a join through
 * vendor_payment_allocations). US-PUR-33: each opens that payment
 * (`/vendor-payments/:id`, US-PUR-49), its date in the business's format, the method
 * with the reference under it.
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

  const today = new Date();
  const locale = orgLocaleTag();

  return (
    <Card className="p-0" data-testid="bill-payments">
      <h3 className="px-4 pb-2 pt-4 text-[14px] font-semibold text-on-surface">Payments</h3>
      {!payments ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : payments.length === 0 ? (
        <p className="px-4 pb-4 text-[13px] text-on-surface-muted">No payments against this bill yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead className="bg-surface-sunken text-[12px] text-on-surface-muted">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Payment</th>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Method</th>
                <th className="px-4 py-2 text-right font-medium">On this bill</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-t border-border" data-testid="bill-payment-row">
                  <td className="px-4 py-2.5">
                    <Link href={`/vendor-payments/${payment.id}`} className="font-medium text-primary hover:underline">
                      {payment.number ?? "Payment"}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">{calendarDate(payment.date.slice(0, 10), today, locale)}</td>
                  <td className="px-4 py-2.5">
                    {PAYMENT_METHOD_LABELS[payment.method]}
                    {payment.reference && <span className="block text-[12px] text-on-surface-muted">{payment.reference}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(BigInt(payment.allocatedToThisBill), payment.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
