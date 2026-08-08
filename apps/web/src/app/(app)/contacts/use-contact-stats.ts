"use client";

import { useMemo } from "react";
import type { Contact } from "./types";

/**
 * Real counts derived client-side from the already-fetched contact list,
 * per this codebase's established rule against fabricated stat-card
 * numbers (see apps/web/src/app/dashboard/page.tsx's comment on why it
 * omits stat cards entirely until real data exists) — Contacts DOES have
 * real data now, so the cards are built directly off it rather than adding
 * a new `/contacts/stats` endpoint for four counts cheaply derivable from
 * data already in memory (avoids over-fetching, per the task brief).
 * "Active leads" is the one count not present in the contacts list itself
 * — fetched separately by the caller and passed in, since a lead isn't a
 * contact-list field.
 */
export function useContactStats(contacts: Contact[] | null, activeLeadCount: number | null) {
  return useMemo(() => {
    if (!contacts) {
      return { total: null, customers: null, vendors: null, activeLeads: activeLeadCount };
    }
    const active = contacts.filter((c) => !c.archivedAt);
    return {
      total: active.length,
      customers: active.filter((c) => c.type === "customer" || c.type === "both").length,
      vendors: active.filter((c) => c.type === "vendor" || c.type === "both").length,
      activeLeads: activeLeadCount,
    };
  }, [contacts, activeLeadCount]);
}
