"use client";

import { useMemo } from "react";
import type { CreditNoteRow } from "./types";

/**
 * Real counts/sums derived client-side from the already-fetched list, per
 * this codebase's established rule against fabricated stat-card numbers
 * (see payments/use-payment-stats.ts's own comment). "Total credited" sums
 * only ISSUED credit notes (a draft has no real ledger effect yet), and is
 * only meaningful when every issued one shares a currency.
 */
export function useCreditNoteStats(creditNotes: CreditNoteRow[] | null) {
  return useMemo(() => {
    if (!creditNotes) {
      return { total: null, issuedTotal: null, currency: null, hasMixedCurrencies: false };
    }
    const issued = creditNotes.filter((c) => c.status === "issued");
    const currencies = new Set(issued.map((c) => c.currency));
    const hasMixedCurrencies = currencies.size > 1;
    const issuedTotal = hasMixedCurrencies ? null : issued.reduce((sum, c) => sum + BigInt(c.totalAmount), 0n);
    return {
      total: creditNotes.length,
      issuedTotal,
      currency: issued[0]?.currency ?? null,
      hasMixedCurrencies,
    };
  }, [creditNotes]);
}
