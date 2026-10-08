import { useMemo, useSyncExternalStore } from "react";
import { outbox } from "./outbox";
import type { OutboxItem } from "./types";

/**
 * What hasn't reached the office yet, from the outbox: every item not yet
 * sent, whether it's waiting, sending or needs fixing. Sign out (US-MOB-02),
 * the sync pill and Profile read it.
 */
export interface PendingSummary {
  photos: number;
  expenses: number;
  completions: number;
}

export function summarize(items: readonly OutboxItem[]): PendingSummary {
  const open = items.filter((item) => item.status !== "sent");
  return {
    photos: open.filter((item) => item.kind === "photos").reduce((sum, item) => sum + (item.kind === "photos" ? item.payload.photos.length : 0), 0),
    expenses: open.filter((item) => item.kind === "expense").length,
    completions: open.filter((item) => item.kind === "completion").length,
  };
}

/** The outbox's items, live. */
export function useOutboxItems(): readonly OutboxItem[] {
  return useSyncExternalStore(outbox.subscribe, outbox.snapshot, outbox.snapshot);
}

export function usePendingSummary(): PendingSummary {
  const items = useOutboxItems();
  return useMemo(() => summarize(items), [items]);
}

/** Items not yet sent — photos counted per batch, as the Sync screen lists them. */
export function pendingItems(items: readonly OutboxItem[]): number {
  return items.filter((item) => item.status !== "sent").length;
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
