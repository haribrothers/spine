"use client";

import { useMemo } from "react";
import type { Invoice } from "./types";

/**
 * Real counts derived client-side from the already-fetched invoice list,
 * per this codebase's established rule against fabricated stat-card
 * numbers (see quotes/use-quote-stats.ts's own comment). "Overdue" counts
 * the API's own computed `isOverdue` flag (S-05.9) — never recomputed
 * client-side.
 */
export function useInvoiceStats(invoices: Invoice[] | null) {
  return useMemo(() => {
    if (!invoices) {
      return { total: null, draft: null, issued: null, overdue: null };
    }
    return {
      total: invoices.length,
      draft: invoices.filter((inv) => inv.status === "draft").length,
      issued: invoices.filter((inv) => inv.status === "issued").length,
      overdue: invoices.filter((inv) => inv.isOverdue).length,
    };
  }, [invoices]);
}
