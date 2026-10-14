"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Skeleton, cn } from "@spine/ui";
import type { ExpenseActivityEntry } from "@spine/shared";
import { Check, Pencil, Receipt, RotateCw, Send, X } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";

function when(iso: string): string {
  const d = new Date(iso);
  const locale = orgLocaleTag();
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/** US-PUR-43 — what an entry says; `link` is the invoice it was billed on. */
export function expenseActivityText(item: ExpenseActivityEntry, currency: string): { text: string; link?: { label: string; href: string }; after?: string } {
  switch (item.type) {
    case "submitted":
      return { text: "Submitted for approval" };
    case "edited":
      return { text: item.detail ? `Edited · ${item.detail}` : "Edited" };
    case "rejected":
      return { text: "Rejected", after: item.detail ?? undefined };
    case "resubmitted":
      return { text: "Fixed and resubmitted" };
    case "approved":
      return { text: `Approved${item.amount ? ` · posted ${formatMoney(BigInt(item.amount), currency)}` : ""}`, after: item.detail ?? undefined };
    case "billed":
      return { text: "Billed on", link: item.linkId ? { label: item.detail ?? "an invoice", href: `/invoices/${item.linkId}` } : undefined };
  }
}

const ICONS: Record<ExpenseActivityEntry["type"], React.ComponentType<{ size?: number }>> = {
  submitted: Send,
  edited: Pencil,
  rejected: X,
  resubmitted: RotateCw,
  approved: Check,
  billed: Receipt,
};

/**
 * US-PUR-43 (D-227) — an expense's story, newest first: submitted, edited
 * (what changed), rejected (with the reason), resubmitted, approved (with
 * the comment) and billed (with the invoice), with who and when.
 */
export function ExpenseActivity({ expenseId, currency, refreshKey, onViewHistory }: { expenseId: string; currency: string; refreshKey?: unknown; onViewHistory: () => void }) {
  const [items, setItems] = useState<ExpenseActivityEntry[] | null>(null);

  useEffect(() => {
    apiClient
      .get<ExpenseActivityEntry[]>(`/expenses/${expenseId}/activity`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [expenseId, refreshKey]);

  return (
    <Card className="flex flex-col gap-1 p-0" data-testid="expense-activity">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h3 className="text-[14px] font-semibold text-on-surface">Activity</h3>
        <button type="button" onClick={onViewHistory} className="text-[12.5px] font-medium text-primary hover:underline">
          View history
        </button>
      </div>
      <ol className="flex flex-col px-4 pb-4">
        {!items && (
          <li className="flex flex-col gap-2 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </li>
        )}
        {items?.length === 0 && <li className="py-2 text-[13px] text-on-surface-muted">Nothing has happened yet.</li>}
        {items?.map((item, i) => {
          const Icon = ICONS[item.type];
          const { text, link, after } = expenseActivityText(item, currency);
          return (
            <li key={`${item.type}-${item.at}-${i}`} className="relative grid grid-cols-[26px_minmax(0,1fr)] gap-2.5 py-2" data-testid="expense-activity-entry">
              {i < items.length - 1 && <span className="absolute bottom-[-8px] left-[12.5px] top-[34px] w-px bg-border" aria-hidden />}
              <span
                className={cn(
                  "flex h-[26px] w-[26px] items-center justify-center rounded-full border",
                  item.type === "approved" || item.type === "billed" ? "border-transparent bg-paid-bg text-paid" : item.type === "rejected" ? "border-transparent bg-overdue-bg text-overdue" : "border-border bg-surface-sunken text-on-surface-muted",
                )}
                aria-hidden
              >
                <Icon size={13} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-on-surface">
                  <span className="font-semibold">{text}</span>
                  {link && (
                    <>
                      {" "}
                      <Link href={link.href} className="font-medium text-primary hover:underline">
                        {link.label}
                      </Link>
                    </>
                  )}
                  {after && <> · “{after}”</>}
                </p>
                <p className="mt-0.5 text-[12px] text-on-surface-muted">{[item.actorName, when(item.at)].filter(Boolean).join(" · ")}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
