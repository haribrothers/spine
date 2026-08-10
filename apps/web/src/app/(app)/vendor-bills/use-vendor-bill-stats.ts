"use client";

import { useMemo } from "react";
import type { VendorBill } from "./types";

/**
 * Real counts derived client-side from the already-fetched vendor bill
 * list, per this codebase's established rule against fabricated stat-card
 * numbers (see invoices/use-invoice-stats.ts's own comment). "Overdue"
 * isn't a server-computed flag here — unlike Invoice.isOverdue (S-05.9),
 * VendorBillsService has no equivalent — so it's computed client-side:
 * `dueDate` in the past, still recorded, and a balance still owing.
 */
export function useVendorBillStats(bills: VendorBill[] | null) {
  return useMemo(() => {
    if (!bills) {
      return { total: null, draft: null, recorded: null, overdue: null };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      total: bills.length,
      draft: bills.filter((b) => b.status === "draft").length,
      recorded: bills.filter((b) => b.status === "recorded").length,
      overdue: bills.filter(
        (b) => b.status === "recorded" && b.dueDate !== null && new Date(b.dueDate) < today && BigInt(b.balanceDue) > 0n,
      ).length,
    };
  }, [bills]);
}
