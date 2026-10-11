"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Skeleton, cn } from "@spine/ui";
import type { VendorCreditActivityEntry } from "@spine/shared";
import { ArrowRightLeft, Ban, Banknote, FileCheck, FilePlus, Undo2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";

function when(iso: string): string {
  const d = new Date(iso);
  const locale = orgLocaleTag();
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/** US-PUR-37 — what an entry says; `link` is the bill it names. */
export function creditActivityText(item: VendorCreditActivityEntry, currency: string, vendor: string): { text: string; link?: { label: string; href: string }; after?: string } {
  const money = (v?: string | null) => (v ? formatMoney(BigInt(v), currency) : "");
  switch (item.type) {
    case "created":
      return { text: "Created as a draft" };
    case "recorded":
      return { text: `Recorded · ${money(item.amount)} off what you owe ${vendor}` };
    case "applied":
      return { text: `Applied ${money(item.amount)} to`, link: item.linkId ? { label: item.detail ?? "a bill", href: `/vendor-bills/${item.linkId}` } : undefined };
    case "unapplied":
      return { text: `Removed ${money(item.amount)} from ${item.detail ?? "a bill"}` };
    case "refunded":
      return { text: `Refunded ${money(item.amount)} by ${vendor}` };
    case "refund_deleted":
      return { text: `Refund of ${money(item.amount)} deleted` };
    case "voided":
      return { text: "Voided", after: item.detail ?? undefined };
  }
}

const ICONS: Record<VendorCreditActivityEntry["type"], React.ComponentType<{ size?: number }>> = {
  created: FilePlus,
  recorded: FileCheck,
  applied: ArrowRightLeft,
  unapplied: Undo2,
  refunded: Banknote,
  refund_deleted: Undo2,
  voided: Ban,
};

const SHOWN = 6;

/**
 * US-PUR-37 (D-226) — a credit's story, newest first: created, recorded,
 * each application to a bill and its removal, refunds and deleted refunds,
 * voided (with why), with who and when. "View history" keeps the
 * field-level changes.
 */
export function VendorCreditActivity({ creditId, currency, vendor, refreshKey, onViewHistory }: { creditId: string; currency: string; vendor: string; refreshKey?: unknown; onViewHistory: () => void }) {
  const [items, setItems] = useState<VendorCreditActivityEntry[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    apiClient
      .get<VendorCreditActivityEntry[]>(`/vendor-credits/${creditId}/activity`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [creditId, refreshKey]);

  const shown = items ? (all ? items : items.slice(0, SHOWN)) : null;

  return (
    <Card className="flex flex-col gap-1 p-0" data-testid="credit-activity">
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
          const { text, link, after } = creditActivityText(item, currency, vendor);
          return (
            <li key={`${item.type}-${item.at}-${i}`} className="relative grid grid-cols-[26px_minmax(0,1fr)] gap-2.5 py-2" data-testid="credit-activity-entry">
              {i < shown.length - 1 && <span className="absolute bottom-[-8px] left-[12.5px] top-[34px] w-px bg-border" aria-hidden />}
              <span
                className={cn(
                  "flex h-[26px] w-[26px] items-center justify-center rounded-full border",
                  item.type === "applied" || item.type === "refunded" ? "border-transparent bg-paid-bg text-paid" : item.type === "voided" ? "border-transparent bg-overdue-bg text-overdue" : "border-border bg-surface-sunken text-on-surface-muted",
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
