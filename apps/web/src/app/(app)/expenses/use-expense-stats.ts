"use client";

import { useMemo } from "react";
import type { Expense } from "./types";

/**
 * Real counts derived client-side from the already-fetched expense list,
 * per this codebase's established rule against fabricated stat-card
 * numbers (see invoices/use-invoice-stats.ts's own comment).
 */
export function useExpenseStats(expenses: Expense[] | null) {
  return useMemo(() => {
    if (!expenses) {
      return { total: null, submitted: null, approved: null, rejected: null };
    }
    return {
      total: expenses.length,
      submitted: expenses.filter((e) => e.status === "submitted").length,
      approved: expenses.filter((e) => e.status === "approved").length,
      rejected: expenses.filter((e) => e.status === "rejected").length,
    };
  }, [expenses]);
}
