import { useSyncExternalStore } from "react";

/**
 * What hasn't reached the office yet. The outbox itself arrives with
 * offline sync (US-MOB-07 to US-MOB-09); until then nothing is ever queued,
 * so the summary is always empty and signing out never warns. Sign out
 * (US-MOB-02) already reads it through this one store.
 */
export interface PendingSummary {
  photos: number;
  expenses: number;
  completions: number;
}

const EMPTY: PendingSummary = { photos: 0, expenses: 0, completions: 0 };
let current: PendingSummary = EMPTY;
const listeners = new Set<() => void>();

export const pendingStore = {
  get: () => current,
  set(next: PendingSummary) {
    current = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function usePendingSummary(): PendingSummary {
  return useSyncExternalStore(pendingStore.subscribe, pendingStore.get, pendingStore.get);
}

export function pendingTotal(summary: PendingSummary): number {
  return summary.photos + summary.expenses + summary.completions;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 site photos and 1 expense" — only the kinds that are waiting. */
export function describePending(summary: PendingSummary): string {
  const parts = [
    summary.photos ? plural(summary.photos, "site photo", "site photos") : null,
    summary.expenses ? plural(summary.expenses, "expense", "expenses") : null,
    summary.completions ? plural(summary.completions, "milestone update", "milestone updates") : null,
  ].filter((part): part is string => part !== null);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** US-MOB-02 — the sign-out warning's title and message. */
export function signOutWarning(summary: PendingSummary): { title: string; message: string } {
  const total = pendingTotal(summary);
  return {
    title: `${total} ${total === 1 ? "item hasn't" : "items haven't"} reached your office yet. Sign out anyway?`,
    message: `${describePending(summary)} ${total === 1 ? "is" : "are"} still waiting to sync. Signing out deletes ${total === 1 ? "it" : "them"} from this phone.`,
  };
}
