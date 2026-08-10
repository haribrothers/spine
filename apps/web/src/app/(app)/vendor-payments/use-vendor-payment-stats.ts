"use client";

import { useMemo } from "react";
import type { VendorPayment } from "./types";

/**
 * Real counts/sums derived client-side from the already-fetched vendor
 * payment list, per this codebase's established rule against fabricated
 * stat-card numbers (see payments/use-payment-stats.ts's own comment).
 * There's no "unallocated" concept to sum here the way the customer side
 * has (createVendorPaymentSchema requires allocations to sum to exactly
 * `amount` — see that schema's own doc comment on why there's no vendor-
 * credit concept in this phase), so this only tracks total count/amount.
 */
export function useVendorPaymentStats(payments: VendorPayment[] | null) {
  return useMemo(() => {
    if (!payments) {
      return { total: null, totalAmount: null, currency: null, hasMixedCurrencies: false };
    }
    const currencies = new Set(payments.map((p) => p.currency));
    const hasMixedCurrencies = currencies.size > 1;
    const totalAmount = hasMixedCurrencies ? null : payments.reduce((sum, p) => sum + BigInt(p.amount), 0n);
    return {
      total: payments.length,
      totalAmount,
      currency: payments[0]?.currency ?? null,
      hasMixedCurrencies,
    };
  }, [payments]);
}
