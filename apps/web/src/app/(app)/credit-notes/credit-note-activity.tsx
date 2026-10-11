"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Skeleton, cn } from "@spine/ui";
import type { CreditNoteActivityEntry } from "@spine/shared";
import { ArrowRightLeft, Banknote, MailCheck, Send, Undo2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "../invoices/types";

function when(iso: string): string {
  const d = new Date(iso);
  const locale = orgLocaleTag();
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/** US-INV-39 — what an entry says; `link` is the invoice it names, shown as a link. */
export function creditNoteActivityText(item: CreditNoteActivityEntry, currency: string): { text: string; link?: string; after?: string } {
  const money = (v?: string | null) => (v ? formatMoney(BigInt(v), currency) : "");
  const method = item.detail ? (PAYMENT_METHOD_LABELS[item.detail as PaymentMethod] ?? item.detail) : null;
  switch (item.type) {
    case "issued": {
      const parts = [BigInt(item.amount ?? "0") > 0n ? `${money(item.amount)} off it` : null, item.creditPart ? `${money(item.creditPart)} as credit` : null].filter(Boolean);
      return { text: "Issued against", link: item.detail ?? undefined, after: parts.length ? parts.join(", ") : undefined };
    }
    case "emailed":
      return { text: item.detail ? `Emailed to ${item.detail}` : "Emailed" };
    case "applied":
      return { text: `Credit applied · ${money(item.amount)} to`, link: item.detail ?? undefined };
    case "refunded":
      return { text: ["Refunded", money(item.amount), method].filter(Boolean).join(" · ") };
    case "refund_deleted":
      return { text: ["Refund deleted", money(item.amount)].filter(Boolean).join(" · ") };
  }
}

const ICONS: Record<CreditNoteActivityEntry["type"], React.ComponentType<{ size?: number }>> = {
  issued: Send,
  emailed: MailCheck,
  applied: ArrowRightLeft,
  refunded: Banknote,
  refund_deleted: Undo2,
};

const SHOWN = 6;

/**
 * US-INV-39 (D-219) — a credit note's story, newest first: issued against
 * its invoice (what came off it and what became credit), emailed, credit
 * applied to invoices, refunds and refunds deleted, with who and when.
 * "View history" keeps the field-level changes.
 */
export function CreditNoteActivity({ creditNoteId, currency, refreshKey, onViewHistory }: { creditNoteId: string; currency: string; refreshKey?: unknown; onViewHistory: () => void }) {
  const [items, setItems] = useState<CreditNoteActivityEntry[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    apiClient
      .get<CreditNoteActivityEntry[]>(`/credit-notes/${creditNoteId}/activity`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [creditNoteId, refreshKey]);

  const shown = items ? (all ? items : items.slice(0, SHOWN)) : null;

  return (
    <Card className="flex flex-col gap-1 p-0" data-testid="credit-note-activity">
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h3 className="text-[14px] font-semibold text-on-surface">Activity</h3>
        <button type="button" onClick={onViewHistory} className="text-[12.5px] font-medium text-primary hover:underline">
          View history
        </button>
      </div>
      <ol className="flex flex-col px-4 pb-4">
        {!shown && (
          <li className="flex flex-col gap-2 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </li>
        )}
        {shown?.length === 0 && <li className="py-2 text-[13px] text-on-surface-muted">Nothing has happened yet.</li>}
        {shown?.map((item, i) => {
          const Icon = ICONS[item.type];
          const { text, link, after } = creditNoteActivityText(item, currency);
          const href = link && item.linkId && (item.type === "issued" || item.type === "applied") ? `/invoices/${item.linkId}` : null;
          return (
            <li key={`${item.type}-${item.at}-${i}`} className="relative grid grid-cols-[26px_minmax(0,1fr)] gap-2.5 py-2" data-testid="credit-note-activity-entry">
              {i < shown.length - 1 && <span className="absolute bottom-[-8px] left-[12.5px] top-[34px] w-px bg-border" aria-hidden />}
              <span
                className={cn(
                  "flex h-[26px] w-[26px] items-center justify-center rounded-full border",
                  item.type === "applied" ? "border-transparent bg-paid-bg text-paid" : item.type === "refund_deleted" ? "border-transparent bg-overdue-bg text-overdue" : "border-border bg-surface-sunken text-on-surface-muted",
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
                      {href ? (
                        <Link href={href} className="font-medium text-primary hover:underline">
                          {link}
                        </Link>
                      ) : (
                        <span className="font-medium">{link}</span>
                      )}
                    </>
                  )}
                  {after && <> · {after}</>}
                </p>
                <p className="mt-0.5 text-[12px] text-on-surface-muted">{[item.actorName, when(item.at)].filter(Boolean).join(" · ")}</p>
              </div>
            </li>
          );
        })}
        {items && !all && items.length > SHOWN && (
          <li>
            <button type="button" onClick={() => setAll(true)} className="mt-1 text-[12.5px] font-medium text-primary hover:underline">
              Show {items.length - SHOWN} earlier
            </button>
          </li>
        )}
      </ol>
    </Card>
  );
}
