import { useMemo, useSyncExternalStore } from "react";
import { outbox } from "./outbox";
import type { OutboxItem } from "./types";
import { t } from "../i18n";

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
/** When the phone last sent something to the office (Profile's "Last sent 9:38 AM"), or null. */
export function lastSentAt(items: readonly OutboxItem[]): number | null {
  const times = items.filter((item) => item.status === "sent" && item.sentAt).map((item) => item.sentAt!);
  return times.length ? Math.max(...times) : null;
}

export function pendingItems(items: readonly OutboxItem[]): number {
  return items.filter((item) => item.status !== "sent").length;
}

export function pendingTotal(summary: PendingSummary): number {
  return summary.photos + summary.expenses + summary.completions;
}

/** "2 site photos and 1 expense" — only the kinds that are waiting. */
export function describePending(summary: PendingSummary): string {
  const parts = [
    summary.photos ? t("mobileApp.outbox.sitePhotos", { count: summary.photos }) : null,
    summary.expenses ? t("mobileApp.pending.expenses", { count: summary.expenses }) : null,
    summary.completions ? t("mobileApp.pending.milestoneUpdates", { count: summary.completions }) : null,
  ].filter((part): part is string => part !== null);
  if (parts.length <= 1) return parts[0] ?? "";
  return t("mobileApp.pending.list", { first: parts.slice(0, -1).join(", "), last: parts[parts.length - 1] });
}

/** US-MOB-02 — the sign-out warning's title and message. */
export function signOutWarning(summary: PendingSummary): { title: string; message: string } {
  const total = pendingTotal(summary);
  return {
    title: t("mobileApp.signOut.warningTitle", { count: total }),
    message: t("mobileApp.signOut.warningMessage", { count: total, what: describePending(summary) }),
  };
}
