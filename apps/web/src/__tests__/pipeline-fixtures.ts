import type { Lead } from "../app/(app)/contacts/types";

export const DAY = 86_400_000;
export const NOW = Date.UTC(2026, 9, 10, 10, 0, 0);
export const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

/** A lead for the board's pure helpers; open, unassigned, created and moved today unless overridden. */
export function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    orgId: "org",
    contactId: "c1",
    stageId: "s-new",
    stageName: "New",
    stageKind: "open",
    valueAmount: "100000",
    valueCurrency: "INR",
    source: null,
    ownerUserId: null,
    createdByUserId: null,
    title: "Ground-floor extension",
    stageChangedAt: daysAgo(0),
    expectedCloseDate: null,
    lostReason: null,
    lostNote: null,
    lastActivityAt: null,
    nextFollowUp: null,
    createdAt: daysAgo(0),
    updatedAt: daysAgo(0),
    ...overrides,
  };
}
