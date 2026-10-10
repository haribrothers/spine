"use client";

import { useMemo } from "react";
import type { Quote } from "./types";

/**
 * Real counts derived client-side from the already-fetched quote list, per
 * this codebase's established rule against fabricated stat-card numbers
 * (see use-contact-stats.ts's own comment). "Expired" counts sent quotes
 * whose computed `isExpired` is true (S-03.11) — a real, actionable
 * number, not a placeholder.
 */
export function useQuoteStats(quotes: Quote[] | null) {
  return useMemo(() => {
    if (!quotes) {
      return { total: null, draft: null, sent: null, accepted: null, expired: null };
    }
    return {
      total: quotes.length,
      draft: quotes.filter((q) => q.status === "draft").length,
      sent: quotes.filter((q) => q.status === "sent" && !q.isExpired).length,
      accepted: quotes.filter((q) => q.status === "accepted").length,
      expired: quotes.filter((q) => q.isExpired).length,
    };
  }, [quotes]);
}
