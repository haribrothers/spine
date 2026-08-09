"use client";

import { useMemo } from "react";
import type { Payment } from "./types";

/**
 * Real counts/sums derived client-side from the already-fetched payment
 * list, per this codebase's established rule against fabricated stat-card
 * numbers (see quotes/use-quote-stats.ts's own comment). "Unallocated"
 * sums each payment's own server-computed `unallocatedAmount` — never
 * recomputed client-side — but is only meaningful when every payment
 * shares one currency, since a raw cross-currency sum would be nonsense;
 * `hasMixedCurrencies` lets the explorer decide whether to show it.
 */
export function usePaymentStats(payments: Payment[] | null) {
  return useMemo(() => {
    if (!payments) {
      return { total: null, unallocatedTotal: null, currency: null, hasMixedCurrencies: false };
    }
    const currencies = new Set(payments.map((p) => p.currency));
    const hasMixedCurrencies = currencies.size > 1;
    const unallocatedTotal = hasMixedCurrencies
      ? null
      : payments.reduce((sum, p) => sum + BigInt(p.unallocatedAmount), 0n);
    return {
      total: payments.length,
      unallocatedTotal,
      currency: payments[0]?.currency ?? null,
      hasMixedCurrencies,
    };
  }, [payments]);
}
