"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Skeleton, cn } from "@spine/ui";
import type { VendorBillActivityEntry } from "@spine/shared";
import { Ban, Banknote, FileCheck, FilePlus, ArrowRightLeft, Trash2 } from "lucide-react";
import { apiClient } from "../../../lib/api-client";
import { formatMoney, orgLocaleTag } from "../../../lib/money";
import { AiFilledMark } from "../../../components/ai-filled-mark";
import { AgentMark } from "../../../components/agent-mark";

function when(iso: string): string {
  const d = new Date(iso);
  const locale = orgLocaleTag();
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })}, ${d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}

/** US-PUR-32 — what an entry says; `link` is the payment or credit it names. */
export function billActivityText(item: VendorBillActivityEntry, currency: string): { text: string; link?: { label: string; href: string }; after?: string } {
  const money = (v?: string | null) => (v ? formatMoney(BigInt(v), currency) : "");
  switch (item.type) {
    case "created":
      return { text: "Created as a draft" };
    case "recorded":
      return { text: `Recorded · posted ${money(item.amount)} to Accounts Payable` };
    case "paid":
      // US-PUR-49: the payment's own page; a deleted one is named without a link.
      return item.linkId ? { text: `Paid ${money(item.amount)} by`, link: { label: item.detail ?? "a payment", href: `/vendor-payments/${item.linkId}` } } : { text: `Paid ${money(item.amount)} by ${item.detail ?? "a payment"}` };
    case "credit_applied":
      return { text: `Credit applied ${money(item.amount)} from`, link: item.linkId ? { label: item.detail ?? "a credit", href: `/vendor-credits/${item.linkId}` } : undefined };
    case "voided":
      return { text: "Voided", after: item.detail ?? undefined };
    case "payment_deleted":
      return { text: `Payment ${item.detail ?? ""} deleted · owes ${money(item.amount)} again`.replace("  ", " ") };
  }
}

const ICONS: Record<VendorBillActivityEntry["type"], React.ComponentType<{ size?: number }>> = {
  created: FilePlus,
  recorded: FileCheck,
  paid: Banknote,
  credit_applied: ArrowRightLeft,
  voided: Ban,
  payment_deleted: Trash2,
};

const SHOWN = 6;

/**
 * US-PUR-32 (D-225) — a bill's story, newest first: created, recorded, each
 * payment and vendor credit put against it, voided (with why), with who and
 * when. "View history" keeps the field-level changes.
 */
export function VendorBillActivity({ billId, currency, refreshKey, onViewHistory }: { billId: string; currency: string; refreshKey?: unknown; onViewHistory: () => void }) {
  const [items, setItems] = useState<VendorBillActivityEntry[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    apiClient
      .get<VendorBillActivityEntry[]>(`/vendor-bills/${billId}/activity`)
      .then(setItems)
      .catch(() => setItems([]));
  }, [billId, refreshKey]);

  const shown = items ? (all ? items : items.slice(0, SHOWN)) : null;

  return (
    <Card className="flex flex-col gap-1 p-0" data-testid="bill-activity">
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
          const { text, link, after } = billActivityText(item, currency);
          return (
            <li key={`${item.type}-${item.at}-${i}`} className="relative grid grid-cols-[26px_minmax(0,1fr)] gap-2.5 py-2" data-testid="bill-activity-entry">
              {i < shown.length - 1 && <span className="absolute bottom-[-8px] left-[12.5px] top-[34px] w-px bg-border" aria-hidden />}
              <span
                className={cn(
                  "flex h-[26px] w-[26px] items-center justify-center rounded-full border",
                  item.type === "paid" || item.type === "credit_applied" ? "border-transparent bg-paid-bg text-paid" : item.type === "voided" || item.type === "payment_deleted" ? "border-transparent bg-overdue-bg text-overdue" : "border-border bg-surface-sunken text-on-surface-muted",
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
                  {item.aiAssisted && <AiFilledMark />}
                  {item.via && <AgentMark agent={item.via} person={item.actorName} />}
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
