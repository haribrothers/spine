"use client";

import { useMemo } from "react";
import type { CatalogItem } from "./types";

/**
 * Real counts derived client-side from the already-fetched item list, per
 * this codebase's established rule against fabricated stat-card numbers
 * (see use-contact-stats.ts's own comment) — no new `/catalog-items/stats`
 * endpoint for four counts cheaply derivable from data already in memory.
 * "Missing tax rate"/"Missing account mapping" are actionable setup gaps
 * (an item at the 0% default and an item with neither income nor expense
 * account set) rather than a plain archived count or an average price —
 * averaging `defaultPriceAmount` across items would be misleading since
 * currency is a free per-item field, not guaranteed uniform org-wide.
 */
export function useCatalogStats(items: CatalogItem[] | null) {
  return useMemo(() => {
    if (!items) {
      return { total: null, categories: null, missingTaxRate: null, missingAccountMapping: null };
    }
    const active = items.filter((item) => !item.archivedAt);
    return {
      total: active.length,
      categories: new Set(active.map((item) => item.category).filter((c): c is string => Boolean(c))).size,
      missingTaxRate: active.filter((item) => item.defaultTaxRatePercentage === 0).length,
      missingAccountMapping: active.filter((item) => !item.incomeAccountId && !item.expenseAccountId).length,
    };
  }, [items]);
}
